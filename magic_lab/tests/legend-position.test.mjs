import { createFixture } from "./support/dataset.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { mountPlotTools } from "../web/plot-tools.mjs";
import {
  normalizePaper,
  setPaperLegend,
  paperChart,
  paperLegendKey,
} from "../core/paper-style.mjs";

test("Legend dragging is available in Charts and Ablations without color editing", async () => {
  for (const [mode, enabled] of [
    ["ablation", true],
    ["charts", true],
    ["tables", true],
    ["charts", false],
  ]) {
    const events = {},
      target = { on: (key, fn) => (events[key] = fn) },
      positions = [];
    const chart = {
      metric: { id: "eval", label: "Return", unit: "reward", xUnit: "steps" },
      view: {
        workspaceMode: mode,
        paper: normalizePaper({ enabled }),
        chartSeries: "runs",
        band: "none",
        chartRanges: {},
      },
      result: { groups: [] },
    };
    const card = {
      dataset: { chartMetric: "eval" },
      querySelector: () => target,
      querySelectorAll: () => [],
    };
    let options;
    const controller = mountPlotTools(
      { querySelector: () => target, querySelectorAll: () => [card] },
      {
        lookup: () => chart,
        changeLegend: (position, key) => positions.push([position, key]),
        changeRange() {
          throw Error("Legend drag changed axis ranges");
        },
        plotly: {
          async react(t, traces, layout, config) {
            options = config;
            t.layout = layout;
            t._fullLayout = {
              legend: {
                x: 0.8,
                y: 0.2,
                xanchor: "left",
                yanchor: "top",
                _width: 80,
                _height: 40,
              },
              _size: { w: 400, h: 200 },
            };
          },
          purge() {},
        },
      },
    );
    await controller.ready;
    assert.equal(options.editable, false);
    const draggable = enabled && ["charts", "ablation"].includes(mode);
    assert.equal(options.edits.legendPosition, draggable);
    events.plotly_relayout({ "legend.x": 0.8, "legend.y": 0.2 });
    assert.equal(events.plotly_legendclick, undefined);
    assert.deepEqual(positions, draggable ? [["lower right", "eval"]] : []);
    controller.destroy();
  }
});

test("Saved panel legend positions persist in views/exports, and Style resets all panels", async () => {
  const { paperFigure } = await import("../web/paper-figure.mjs");
  const { paperDocument, paperTikz } = await import("../core/paper-export.mjs");
  const { applyPaperInput } = await import("../web/paper-editor.mjs");
  const { defaultView, normalizeView } = await import("../core/view.mjs");
  const { saveSession, loadSession } = await import("../web/view-session.mjs");
  const { workspaceCharts } = await import("../core/workspace.mjs");
  const dataset = createFixture();
  let view = {
    ...defaultView(dataset),
    paper: normalizePaper(),
    charts: dataset.metrics.slice(0, 2).map((m) => m.id),
  };
  let charts = workspaceCharts(dataset, view);
  view.paper = setPaperLegend(view.paper, "lower right", charts[0]);
  view = normalizeView(JSON.parse(JSON.stringify(view)), dataset);
  const storage = new Map(),
    local = {
      setItem: (k, v) => storage.set(k, v),
      getItem: (k) => storage.get(k) ?? null,
    };
  saveSession(local, dataset, view, new Set());
  view = loadSession(local, dataset).view;
  charts = workspaceCharts(dataset, view);
  assert.equal(paperChart(charts[0]).style.legend, "lower right");
  assert.equal(paperChart(charts[1]).style.legend, "upper left");
  assert.equal(paperFigure(charts[0]).layout.legend.y, 0);
  assert.equal(paperFigure(charts[1]).layout.legend.y, 1);
  const doc = paperDocument(charts, view),
    tex = paperTikz(doc);
  assert.equal(doc.panels[0].style.legend, "lower right");
  assert.equal(doc.panels[1].style.legend, "upper left");
  assert.ok(tex.includes("anchor=south east"));
  assert.ok(tex.includes("anchor=north west"));
  view = applyPaperInput(view, {
    dataset: { paperScope: "global", paperKey: "legend" },
    type: "select-one",
    value: "upper left",
  });
  assert.deepEqual(view.paper.legendPositions, {});
  assert.ok(
    workspaceCharts(dataset, view).every(
      (c) => paperChart(c).style.legend === "upper left",
    ),
  );
  assert.throws(() => normalizePaper({ legendPositions: { panel: "bad" } }));
});

test("Ablation legend identity follows field values when earlier rows disappear", async () => {
  const { defaultView } = await import("../core/view.mjs");
  const { ablationGrid } = await import("../panels/ablation-grid.mjs");
  const dataset = createFixture();
  let view = {
    ...defaultView(dataset),
    workspaceMode: "ablation",
    ablationRow: "/algorithm",
    ablationColumn: "",
    paper: normalizePaper(),
  };
  const initial = ablationGrid(dataset, view).cells,
    cell = initial[1];
  view.paper = setPaperLegend(view.paper, "lower left", cell);
  view.selected = cell.view.selected;
  const remaining = ablationGrid(dataset, view).cells[0];
  assert.equal(paperLegendKey(remaining), paperLegendKey(cell));
  assert.notEqual(remaining.key, cell.key);
  assert.equal(paperChart(remaining).style.legend, "lower left");
  assert.equal(
    paperChart({
      ...initial[0],
      view: { ...initial[0].view, paper: view.paper },
    }).style.legend,
    "upper left",
  );
});
