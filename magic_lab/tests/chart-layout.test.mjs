import { createFixture } from "./support/dataset.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { mountChartLayout } from "../web/chart-layout.mjs";

import { moveChart, resizeCharts } from "../core/chart-layout.mjs";
import { defaultView, normalizeView } from "../core/view.mjs";
import { buildExportPack } from "../reporting/export-pack.mjs";
import { restoreReproduction } from "../core/reproduction.mjs";

test("Chart movement keeps metric identities and supports both directions", () => {
  assert.deepEqual(moveChart(["a", "b", "c"], "a", "c"), ["b", "c", "a"]);
  assert.deepEqual(moveChart(["a", "b", "c"], "c", "a"), ["c", "a", "b"]);
  assert.deepEqual(moveChart(["a", "b"], "gone", "a"), ["a", "b"]);
});
test("Shared resize clamps dimensions and fits narrow workspaces without invalid saved state", () => {
  assert.deepEqual(resizeCharts({ width: 560, height: 420 }, 100, -40, 1000), {
    width: 660,
    height: 380,
  });
  assert.deepEqual(
    resizeCharts({ width: 560, height: 420 }, -1000, 10000, 250),
    { width: 320, height: 1200 },
  );
  assert.deepEqual(
    resizeCharts({ width: 560, height: 420 }, 1000, -1000, 700),
    { width: 700, height: 280 },
  );
});
test("Actual layout controller reorders, resizes live and restores size on cancel", async () => {
  const handlers = {},
    pointerHandlers = {},
    classes = { add() {}, remove() {}, toggle() {} };
  const card = {
    dataset: { chartMetric: "b" },
    classList: classes,
    getBoundingClientRect: () => ({ width: 560, height: 420 }),
  };
  const handle = {
    dataset: { chartResize: "b" },
    closest: (selector) =>
      selector === "[data-chart-resize]"
        ? handle
        : selector === ".chart-card"
          ? card
          : null,
    addEventListener: (name, fn) => (pointerHandlers[name] = fn),
    removeEventListener: (name) => delete pointerHandlers[name],
    setPointerCapture() {},
    hasPointerCapture: () => true,
    releasePointerCapture() {},
  };
  const deck = {
    querySelectorAll: () => [card],
    getBoundingClientRect: () => ({ width: 1000 }),
    addEventListener: (name, fn) => (handlers[name] = fn),
  };
  const state = { charts: ["a", "b"], chartSize: { width: 560, height: 420 } },
    updates = [];
  mountChartLayout(deck, {
    getView: () => state,
    reorder: (charts) => (state.charts = [...charts]),
    resize: (size, done) => {
      state.chartSize = { ...size };
      updates.push({ size: { ...size }, done });
    },
  });
  const drag = {
    dataset: { chartDrag: "a" },
    closest: (selector) =>
      selector === "[data-chart-drag]"
        ? drag
        : selector === ".chart-card"
          ? card
          : null,
  };
  const transfer = { setData() {} };
  handlers.dragstart({ target: drag, dataTransfer: transfer });
  handlers.drop({ target: { closest: () => card }, preventDefault() {} });
  assert.deepEqual(state.charts, ["b", "a"]);
  handlers.pointerdown({
    target: handle,
    button: 0,
    clientX: 560,
    clientY: 420,
    pointerId: 1,
    preventDefault() {},
  });
  pointerHandlers.pointermove({ pointerId: 1, clientX: 660, clientY: 500 });
  assert.deepEqual(state.chartSize, { width: 660, height: 500 });
  assert.equal(updates.at(-1).done, false);
  pointerHandlers.pointerup({ pointerId: 1 });
  assert.equal(updates.at(-1).done, true);
  handlers.pointerdown({
    target: handle,
    button: 0,
    clientX: 560,
    clientY: 420,
    pointerId: 2,
    preventDefault() {},
  });
  pointerHandlers.pointermove({ pointerId: 2, clientX: 760, clientY: 600 });
  pointerHandlers.pointercancel({ pointerId: 2 });
  assert.deepEqual(state.chartSize, { width: 660, height: 500 });
  handlers.keydown({
    target: handle,
    key: "ArrowDown",
    shiftKey: false,
    preventDefault() {},
  });
  assert.equal(state.chartSize.height, 520);
});
test("Shared dimensions and graph order survive exports and saved view normalization", async () => {
  const dataset = createFixture();
  const view = {
    ...defaultView(dataset),
    charts: dataset.metrics.map((m) => m.id).reverse(),
    chartSize: { width: 700, height: 480 },
  };
  assert.deepEqual(normalizeView(view, dataset).chartSize, view.chartSize);
  assert.throws(
    () =>
      normalizeView({ ...view, chartSize: { width: 0, height: 400 } }, dataset),
    /Invalid chart size/,
  );
  const old = { ...view };
  delete old.chartSize;
  assert.deepEqual(normalizeView(old, dataset).chartSize, {
    width: 560,
    height: 420,
  });
  const pack = await buildExportPack(dataset, view, { format: "csv" }),
    restored = await restoreReproduction(pack.reproduction);
  assert.deepEqual(restored.view.chartSize, view.chartSize);
  assert.deepEqual(restored.view.charts, view.charts);
});
