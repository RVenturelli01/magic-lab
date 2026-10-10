import test from "node:test";
import assert from "node:assert/strict";
import { defaultView, normalizeView } from "../core/view.mjs";
import { normalizePaper, paperChart } from "../core/paper-style.mjs";
import { paperFigure } from "../web/paper-figure.mjs";
import {
  paperEntries,
  paperTexText,
  paperDocument,
  paperTikz,
} from "../core/paper-export.mjs";
import { applyPaperInput } from "../web/paper-editor.mjs";
import { buildExportPack } from "../reporting/export-pack.mjs";
import { restoreReproduction } from "../core/reproduction.mjs";
import { workspaceCharts } from "../core/workspace.mjs";
import { bandHalfWidth } from "../core/uncertainty.mjs";

import { testApplication } from "./support/application.mjs";
import { workspace } from "../web/ui/workspace.mjs";
const d = {
  schemaVersion: 1,
  id: "paper-test",
  runs: [0, 1].map((seed) => ({
    id: "r" + seed,
    name: "Method",
    seed,
    algorithm: "EG",
    environment: "bandit",
    status: "completed",
    config: { epsilon: 0.1 },
    code: { commit: "test", dirty: false },
  })),
  metrics: [
    {
      id: "eval",
      phase: "evaluation",
      label: "Return",
      unit: "reward",
      xUnit: "steps",
      direction: "higher",
    },
  ],
  points: [
    { runId: "r0", metricId: "eval", step: 0, value: 1 },
    { runId: "r1", metricId: "eval", step: 0, value: 3 },
    { runId: "r0", metricId: "eval", step: 1000, value: 5 },
    { runId: "r1", metricId: "eval", step: 1000, value: 7 },
  ],
  artifacts: [],
  campaigns: [],
};
const view = () =>
  normalizeView(
    {
      ...defaultView(d),
      runGrouping: "configuration",
      paper: normalizePaper(),
      workspaceMode: "charts",
      band: "ci95",
    },
    d,
  );
test("Reference preset uses serif, boxed axes, top-left legend, thin marker-free curves and shaded uncertainty", () => {
  const c = workspaceCharts(d, view())[0],
    f = paperFigure(c);
  assert.equal(f.traces.length, 3);
  assert.equal(f.traces[2].mode, "lines");
  assert.equal(f.traces[2].line.color, "#000000");
  assert.equal(f.layout.legend.xanchor, "left");
  assert.equal(f.layout.legend.yanchor, "top");
  assert.equal(f.layout.xaxis.showgrid, false);
  assert.equal(f.layout.xaxis.mirror, true);
  assert.match(f.layout.font.family, /Serif/);
  const error = bandHalfWidth(c.result.groups[0].points[0], "ci95");
  assert.equal(f.traces[0].y[0], 2 - error);
  assert.equal(f.traces[1].y[0], 2 + error);
  assert.ok(
    f.layout.yaxis.range[0] < 2 - error && f.layout.yaxis.range[1] > 6 + error,
  );
});
test("Paper style validates physical sizes, mappings and unsafe color values; old views remain valid", () => {
  for (const bad of [
    { width: 0 },
    { width: 4, marginLeft: 4 },
    { legend: "bad" },
    { metrics: { eval: { xScale: 0 } } },
    { metrics: { eval: { xmin: 2, xmax: 1 } } },
    { series: { a: { color: "red;display:none" } } },
  ])
    assert.throws(() => normalizePaper(bad));
  const old = defaultView(d);
  delete old.paper;
  assert.equal(normalizeView(old, d).paper.enabled, false);
});
test("Scaled data, displayed limits and error sizes agree; source observations are unchanged", () => {
  const v = view();
  v.paper.metrics.eval = {
    xScale: 1000,
    yScale: 2,
    xlabel: "Steps ($\\times 10^3$)",
    xmin: 0,
    xmax: 1,
    xTick: 0.2,
    yTick: 1,
  };
  const c = workspaceCharts(d, v)[0],
    p = paperChart(c),
    f = paperFigure(c);
  assert.deepEqual(
    p.groups[0].points.map((q) => q.step),
    [0, 1],
  );
  assert.deepEqual(
    p.groups[0].points.map((q) => q.mean),
    [1, 3],
  );
  assert.equal(
    p.groups[0].points[0].error,
    bandHalfWidth(c.result.groups[0].points[0], "ci95") / 2,
  );
  assert.equal(f.layout.xaxis.dtick, 0.2);
  assert.equal(p.bounds.xmax, 1);
  assert.equal(c.result.groups[0].points[1].step, 1000);
  c.view.chartRanges = { eval: { xmin: 0, xmax: 500, ymin: 0, ymax: 10 } };
  delete c.view.paper.metrics.eval.xmax;
  assert.equal(paperChart(c).bounds.xmax, 0.5);
});
test("Undefined uncertainty remains a gap, and bars never fabricate singleton error estimates", () => {
  const c = workspaceCharts(d, view())[0];
  c.result.groups[0].points[1].sd = null;
  c.result.groups[0].points[1].n = 1;
  let f = paperFigure(c);
  assert.equal(f.traces[0].y[1], null);
  assert.equal(f.traces[1].y[1], null);
  c.view.paper.uncertainty = "bars";
  f = paperFigure(c);
  assert.equal(f.traces.length, 1);
  assert.equal(f.traces[0].error_y.array[1], null);
  const tex = paperTikz(paperDocument([c], c.view));
  assert.ok(!tex.includes("(1000,6) +-"));
  assert.ok(!tex.includes("null"));
});
test("Series styling and visibility are shared by preview, TeX, JSON, saved views and reproduction", async () => {
  let v = view(),
    c = workspaceCharts(d, v)[0],
    key = c.result.groups[0].key;
  v = applyPaperInput(v, {
    dataset: { paperScope: "series", paperKey: "label", paperId: key },
    type: "text",
    value: "Ours: $\\omega=4$",
  });
  v.paper.series[key].color = "#ff1493";
  v.paper.series[key].dash = "dash";
  v.paper.metrics.eval = { ylabel: "Return" };
  v = normalizeView(v, d);
  const pack = await buildExportPack(d, v, { format: "paper" });
  const doc = JSON.parse(
    pack.entries.find(([n]) => n === "paper/figure.json")[1],
  );
  assert.equal(doc.panels[0].groups[0].color, "#ff1493");
  assert.match(
    pack.entries.find(([n]) => n === "paper/figure.tex")[1],
    /\\omega=4/,
  );
  const restored = await restoreReproduction(pack.reproduction);
  assert.deepEqual(restored.view.paper, v.paper);
  v.paper.series[key].hidden = true;
  c = workspaceCharts(d, v)[0];
  assert.equal(paperFigure(c).traces.length, 0);
  assert.equal(paperDocument([c], v).panels[0].groups.length, 0);
});
test("Native TeX escapes log text while preserving common math; multi-panel figure exports portable sources", () => {
  assert.equal(paperTexText("loss_% & A"), "loss\\_\\% \\& A");
  assert.equal(paperTexText("$\\omega=4$"), "$\\omega=4$");
  assert.ok(paperTexText("$\\input{secret}$").includes("textbackslash"));
  const v = view(),
    charts = workspaceCharts(d, v),
    entries = paperEntries([...charts, ...charts], v);
  assert.equal(
    JSON.parse(entries.find(([n]) => n === "paper/figure.json")[1]).columns,
    2,
  );
  const tex = entries.find(([n]) => n === "paper/figure.tex")[1];
  assert.equal((tex.match(/\\begin{axis}/g) || []).length, 2);
  assert.ok(tex.includes("\\closedcycle") && tex.includes("fill opacity="));
  assert.ok(tex.includes("tick align=outside"));
  assert.ok(
    entries.some(
      ([n, s]) =>
        n === "paper/render.py" &&
        s.includes("pdf") &&
        s.includes("svg") &&
        s.includes("png"),
    ),
  );
});
test("Actual app includes the Paper editor and handles style changes without touching source data", async () => {
  const { state, handlers } = testApplication(d);
  state.view = view();
  let html = workspace(state);
  assert.ok(
    html.includes("Chart style") &&
      html.includes('data-format="latex"') &&
      html.includes("paper-deck"),
  );
  assert.equal((html.match(/<summary>Settings<\/summary>/g) || []).length, 1);
  assert.ok(
    !html.includes('data-paper-section="Metrics &amp; layout"') &&
      !html.includes('data-paper-section="Export"'),
  );
  assert.ok(
    html.indexOf('aria-label="Metrics"') <
      html.indexOf("workspace-settings-actions"),
  );
  assert.ok(!html.includes("Paper style") && !html.includes("Paper preview"));
  for (const section of [
    "Data &amp; statistics",
    "Typography",
    "Lines &amp; uncertainty",
    "Axes",
    "Legend",
    "Labels &amp; ranges",
    "Curves",
    "Export size &amp; layout",
  ])
    assert.ok(html.includes('data-paper-section="' + section + '"'));
  await handlers.change({
    target: {
      dataset: { paperScope: "global", paperKey: "width", paperId: "" },
      type: "number",
      value: "10",
    },
  });
  assert.equal(state.view.paper.width, 10);
  await handlers.change({
    target: {
      dataset: {
        paperScope: "series",
        paperKey: "hidden",
        paperId: "visibility-fixture",
        curveVisible: "",
      },
      type: "checkbox",
      checked: false,
    },
  });
  assert.equal(state.view.paper.series["visibility-fixture"].hidden, true);
  await handlers.change({
    target: {
      dataset: {
        paperScope: "series",
        paperKey: "hidden",
        paperId: "visibility-fixture",
        curveVisible: "",
      },
      type: "checkbox",
      checked: true,
    },
  });
  assert.equal(state.view.paper.series["visibility-fixture"].hidden, false);
  html = workspace(state);
  assert.ok(html.includes("--chart-width:560px"));
  assert.ok(html.includes("data-chart-resize="));
  state.view.workspaceMode = "ablation";
  assert.ok(workspace(state).includes("Chart style"));
  assert.ok(workspace(state).includes("data-chart-resize="));
  assert.equal(state.dataset.points[0].value, 1);
});

test("Paper math preview escapes HTML and displays the reference Greek and scientific notation", async () => {
  const { paperPreviewText } = await import("../web/paper-figure.mjs");
  assert.equal(
    paperPreviewText("Steps ($\\times 10^6$)"),
    "Steps (× 10<sup>6</sup>)",
  );
  assert.equal(paperPreviewText("$\\omega=4$"), "ω=4");
  assert.equal(paperPreviewText("<img>"), "&lt;img&gt;");
});
test("Ablation shares full confidence bounds before display scaling, and zoom overrides manual limits", async () => {
  const { ablationGrid } = await import("../panels/ablation-grid.mjs");
  const v = view();
  v.workspaceMode = "ablation";
  v.ablationRow = "/config/epsilon";
  v.ablationColumn = "";
  v.paper.metrics.eval = { xScale: 1000, yScale: 2, xmin: 0, xmax: 1 };
  const grid = ablationGrid(d, v),
    c = paperChart(grid.cells[0]),
    q = grid.cells[0].result.groups[0].points[0];
  assert.ok(c.bounds.ymin < (q.mean - bandHalfWidth(q, v.band)) / 2);
  v.chartRanges = { eval: { xmin: 100, xmax: 500, ymin: 0, ymax: 10 } };
  const zoom = paperChart(ablationGrid(d, v).cells[0]);
  assert.equal(zoom.bounds.xmin, 0.1);
  assert.equal(zoom.bounds.xmax, 0.5);
  const updated = applyPaperInput(v, {
    dataset: { paperScope: "metric", paperKey: "xmin", paperId: "eval" },
    type: "number",
    value: "0",
  });
  assert.deepEqual(updated.chartRanges, {});
  assert.ok(v.chartRanges.eval);
});
test("Paper-enabled image exports request the styled renderer and retain editable source alongside previews", async () => {
  const v = view(),
    calls = [];
  const pack = await buildExportPack(d, v, {
    format: "svg",
    paperImage: async (chart, format) => {
      calls.push([chart.metric.id, format]);
      return new TextEncoder().encode("<svg/>");
    },
  });
  assert.deepEqual(calls, [["eval", "svg"]]);
  assert.ok(pack.entries.some(([n]) => n === "paper/figure-01.svg"));
  assert.ok(pack.entries.some(([n]) => n === "paper/figure.tex"));
  assert.ok(!pack.entries.some(([n]) => n.endsWith("learning-curves.svg")));
});
