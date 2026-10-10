import test from "node:test";
import assert from "node:assert/strict";
import { plotlyFigure, plotBounds } from "../web/plotly-figure.mjs";
import { mountPlotTools } from "../web/plot-tools.mjs";
import { createServer } from "../server/http.mjs";
import { normalizePaper } from "../core/paper-style.mjs";

const chart = {
  metric: {
    id: "eval",
    label: "Return",
    phase: "evaluation",
    unit: "reward",
    xUnit: "steps",
  },
  view: {
    metric: "eval",
    chartSeries: "seed-mean",
    band: "sd",
    chartRanges: {},
  },
  result: {
    groups: [
      {
        name: "<experiment>",
        algorithm: "EG",
        runs: [{ seed: 0 }, { seed: 1 }],
        points: [
          { step: 0, mean: 2, sd: 1, n: 2 },
          { step: 10, mean: 4, sd: null, n: 1 },
          { step: 20, mean: 6, sd: 2, n: 2 },
        ],
      },
    ],
  },
};

test("Live figure preview coalesces moves, preserves Plotly controls and restores original style", async () => {
  const previous = {
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  const frames = new Map();
  let id = 0,
    active = 0,
    maxActive = 0,
    release,
    changes = 0;
  globalThis.requestAnimationFrame = (fn) => {
    frames.set(++id, fn);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  try {
    let current = {
      ...chart,
      view: { ...chart.view, paper: normalizePaper() },
    };
    const target = { on() {} },
      container = {
        getBoundingClientRect: () => ({ width: 500, height: 300 }),
      };
    const card = {
        dataset: { chartMetric: "eval" },
        querySelector: (s) => (s === ".chart" ? container : target),
        querySelectorAll: () => [],
      },
      calls = [];
    const controller = mountPlotTools(
      { querySelector: () => target, querySelectorAll: () => [card] },
      {
        lookup: () => current,
        changeRange: () => changes++,
        plotly: {
          async react(t, traces, layout, config) {
            calls.push({ traces, layout, config });
            active++;
            maxActive = Math.max(maxActive, active);
            if (calls.length === 2)
              await new Promise((resolve) => (release = resolve));
            active--;
          },
          purge() {},
        },
      },
    );
    await controller.ready;
    const runFrame = () => {
      const [key, fn] = frames.entries().next().value;
      frames.delete(key);
      return fn();
    };
    current = {
      ...current,
      view: { ...current.view, paper: normalizePaper({ lineWidth: 2 }) },
    };
    controller.refreshFigures();
    controller.refreshFigures();
    assert.equal(frames.size, 1);
    const pending = runFrame();
    assert.equal(calls.length, 2);
    assert.equal(calls[1].traces.at(-1).line.width, (2 * 96) / 72);
    assert.equal(calls[1].layout.width, 500);
    assert.equal(calls[1].config, calls[0].config);
    current = {
      ...current,
      view: { ...current.view, paper: normalizePaper() },
    };
    controller.refreshFigures();
    assert.equal(frames.size, 0);
    release();
    await pending;
    assert.equal(frames.size, 1);
    await runFrame();
    assert.equal(calls[2].traces.at(-1).line.width, 0.7 * (96 / 72));
    assert.equal(maxActive, 1);
    assert.equal(changes, 0);
    controller.refreshFigures();
    controller.destroy();
    assert.equal(frames.size, 0);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

test("Plotly receives exact means, SD gaps, explicit units and export-compatible bounds", () => {
  const figure = plotlyFigure(chart);
  assert.deepEqual(figure.traces[0].y, [1, null, 4]);
  assert.deepEqual(figure.traces[1].y, [3, null, 8]);
  assert.deepEqual(figure.traces[2].y, [2, 4, 6]);
  assert.deepEqual(figure.traces[2].customdata, [
    [2, 1, 1],
    [1, "undefined", "undefined"],
    [2, 2, 2],
  ]);
  assert.equal(figure.traces[0].connectgaps, false);
  assert.equal(figure.layout.xaxis.title.text, "steps");
  assert.equal(figure.layout.yaxis.title.text, "reward");
  const b = plotBounds(chart);
  assert.deepEqual(figure.layout.yaxis.range, [b.ymin, b.ymax]);
  assert.ok(figure.traces[2].name.includes("&lt;experiment&gt;"));
  const individual = plotlyFigure({
    ...chart,
    view: { ...chart.view, chartSeries: "runs" },
  });
  assert.equal(individual.traces.length, 1);
});

test("Native modebar persists zoom, resets shared bounds, locks X/Y and hides all seed-band traces", async () => {
  const c = structuredClone(chart),
    events = {},
    legendEvents = {},
    legend = {
      dataset: { plotSeries: "0" },
      pressed: "true",
      getAttribute() {
        return this.pressed;
      },
      setAttribute(k, v) {
        this.pressed = v;
      },
      addEventListener(k, fn) {
        legendEvents[k] = fn;
      },
    };
  const target = { on: (key, fn) => (events[key] = fn) };
  const card = {
    dataset: { chartMetric: "eval" },
    querySelector: () => target,
    querySelectorAll: () => [legend],
  };
  let config,
    controller,
    changes = 0,
    purges = 0;
  const patches = [],
    restyles = [];
  const plotly = {
    async react(t, traces, layout, options) {
      t.layout = layout;
      config = options;
    },
    async relayout(t, patch) {
      patches.push(patch);
      for (const [key, value] of Object.entries(patch)) {
        const [axis, field] = key.split(".");
        if (field) t.layout[axis][field] = value;
        else t.layout[axis] = value;
      }
      events.plotly_relayout?.(patch);
    },
    async restyle(t, patch, indices) {
      restyles.push({ patch, indices });
    },
    purge() {
      purges++;
    },
    Plots: { resize() {} },
  };
  controller = mountPlotTools(
    { querySelector: () => target, querySelectorAll: () => [card] },
    {
      plotly,
      lookup: () => c,
      changeRange: (id, b) => {
        changes++;
        c.view.chartRanges = b ? { [id]: b } : {};
        controller.refresh();
      },
    },
  );
  await controller.ready;
  assert.equal(config.displayModeBar, "hover");
  assert.equal(config.displaylogo, false);
  assert.equal(config.scrollZoom, false);
  const x = config.modeBarButtonsToAdd.find((b) => b.name === "Zoom X");
  await x.click();
  assert.equal(target.layout.yaxis.fixedrange, true);
  assert.equal(target.layout.xaxis.fixedrange, false);
  await config.modeBarButtonsToAdd.find((b) => b.name === "Zoom Y").click();
  assert.equal(target.layout.xaxis.fixedrange, true);
  assert.equal(target.layout.yaxis.fixedrange, false);
  await config.modeBarButtonsToAdd.find((b) => b.name === "Zoom XY").click();
  assert.equal(target.layout.xaxis.fixedrange, false);
  assert.equal(target.layout.yaxis.fixedrange, false);
  target.layout.xaxis.range = [5, 15];
  target.layout.yaxis.range = [3, 5];
  events.plotly_relayout({ "xaxis.range[0]": 5, "xaxis.range[1]": 15 });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(c.view.chartRanges.eval, {
    xmin: 5,
    xmax: 15,
    ymin: 3,
    ymax: 5,
  });
  assert.equal(changes, 1);
  legendEvents.click();
  await Promise.resolve();
  assert.deepEqual(restyles[0], {
    patch: { visible: false },
    indices: [0, 1, 2],
  });
  events.plotly_relayout({ "xaxis.autorange": true, "yaxis.autorange": true });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(c.view.chartRanges, {});
  assert.equal(changes, 2);
  const bounds = plotBounds(c);
  assert.deepEqual(target.layout.xaxis.range, [bounds.xmin, bounds.xmax]);
  controller.destroy();
  assert.equal(purges, 1);
  assert.ok(patches.length >= 5);
});

test("Local server serves the installed Plotly bundle and loads it before the app", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const base = "http://127.0.0.1:" + server.address().port;
    const response = await fetch(base + "/web/plotly.min.js");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /javascript/);
    assert.match((await response.text()).slice(0, 500), /plotly.js v/);
    const html = await fetch(base).then((r) => r.text());
    assert.ok(
      html.indexOf("/web/plotly.min.js") < html.indexOf("/web/app.mjs"),
    );
    assert.equal(
      (await fetch(base + "/node_modules/plotly.js-dist-min/package.json"))
        .status,
      404,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Destroying a pending Plotly render purges it without installing stale listeners", async () => {
  let finish,
    purges = 0;
  const target = {
    on() {
      throw Error("Stale listener installed");
    },
  };
  const card = {
    dataset: { chartMetric: "eval" },
    querySelector: () => target,
  };
  const controller = mountPlotTools(
    { querySelector: () => target, querySelectorAll: () => [card] },
    {
      lookup: () => structuredClone(chart),
      changeRange() {},
      plotly: {
        react: () => new Promise((resolve) => (finish = resolve)),
        purge() {
          purges++;
        },
      },
    },
  );
  controller.destroy();
  finish();
  await controller.ready;
  assert.equal(purges, 1);
});

test("Live resize applies latest measured dimensions each frame without debounced Plotly resize", async () => {
  const previous = {
    ResizeObserver: globalThis.ResizeObserver,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  let notify,
    frame,
    scheduled = 0,
    disconnected = false,
    cancelled = false,
    width = 620,
    height = 350,
    changes = 0;
  globalThis.ResizeObserver = class {
    constructor(callback) {
      notify = callback;
    }
    observe() {}
    disconnect() {
      disconnected = true;
    }
  };
  globalThis.requestAnimationFrame = (fn) => {
    scheduled++;
    frame = fn;
    return scheduled;
  };
  globalThis.cancelAnimationFrame = () => {
    cancelled = true;
    frame = null;
  };
  try {
    const container = { getBoundingClientRect: () => ({ width, height }) },
      target = { on() {} },
      patches = [];
    const card = {
      dataset: { chartMetric: "eval" },
      querySelector: (s) => (s === ".chart" ? container : target),
      querySelectorAll: () => [],
    };
    const plotly = {
      async react(t, data, layout) {
        t.layout = layout;
      },
      async relayout(t, patch) {
        patches.push(patch);
        Object.assign(t.layout, patch);
      },
      purge() {},
      Plots: {
        resize() {
          throw Error("Debounced resize must not be used during drag");
        },
      },
    };
    const controller = mountPlotTools(
      { querySelector: () => target, querySelectorAll: () => [card] },
      {
        plotly,
        lookup: () => structuredClone(chart),
        changeRange() {
          changes++;
        },
      },
    );
    await controller.ready;
    assert.equal(target.layout.width, 620);
    assert.equal(target.layout.height, 350);
    width = 500;
    notify();
    width = 450;
    notify();
    width = 400;
    height = 290;
    notify();
    assert.equal(scheduled, 1);
    frame();
    await Promise.resolve();
    assert.deepEqual(patches, [{ width: 400, height: 290, autosize: false }]);
    assert.equal(changes, 0);
    notify();
    frame();
    assert.equal(patches.length, 1);
    width = 700;
    height = 410;
    notify();
    frame();
    await Promise.resolve();
    assert.deepEqual(patches[1], { width: 700, height: 410, autosize: false });
    notify();
    controller.destroy();
    assert.equal(disconnected, true);
    assert.equal(cancelled, true);
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  }
});
