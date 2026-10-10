import test from "node:test";
import assert from "node:assert/strict";
import { createFixture } from "./support/dataset.mjs";
import { testApplication } from "./support/application.mjs";
import { defaultView, normalizeView } from "../core/view.mjs";
import { plotId } from "../core/plot-axes.mjs";
import { workspaceCharts, workspaceTable } from "../core/workspace.mjs";
import { ablationGrid } from "../panels/ablation-grid.mjs";
import { directExport } from "../reporting/direct-export.mjs";
import {
  makeReproduction,
  restoreReproduction,
} from "../core/reproduction.mjs";
function fixture() {
  const dataset = createFixture(),
    [r1, r2] = dataset.runs,
    [x, y] = dataset.metrics.map((m) => m.id);
  dataset.points = [
    [r1.id, x, 0, 10],
    [r1.id, y, 0, 20],
    [r2.id, x, 0, 20],
    [r2.id, y, 0, 40],
    [r1.id, x, 1, 12],
    [r1.id, y, 1, 25],
    [r2.id, y, 1, 45],
  ].map(([runId, metricId, step, value]) => ({ runId, metricId, step, value }));
  const id = plotId(x, y),
    view = {
      ...defaultView(dataset),
      tab: "workspace",
      charts: [id, y],
      plotAxes: { [id]: { x, y } },
      selected: [r1.id, r2.id],
    };
  return { dataset, x, y, id, view };
}
test("Pair coordinates join exact training steps per run and grouping uses the same joint sample", () => {
  const { dataset, view } = fixture(),
    original = structuredClone(dataset);
  let c = workspaceCharts(dataset, view)[0];
  assert.deepEqual(
    c.result.groups[0].points.map((p) => [p.sourceStep, p.step, p.mean]),
    [
      [0, 10, 20],
      [1, 12, 25],
    ],
  );
  assert.equal(c.result.groups[1].points.length, 1);
  c = workspaceCharts(dataset, {
    ...view,
    runGrouping: "configuration",
    chartSeries: "seed-mean",
    alignment: "available",
  })[0];
  assert.deepEqual(
    c.result.groups[0].points.map((p) => [p.sourceStep, p.step, p.mean, p.n]),
    [
      [0, 15, 30, 2],
      [1, 12, 25, 1],
    ],
  );
  assert.equal(c.result.groups[0].points[0].sd, Math.sqrt(200));
  assert.deepEqual(dataset, original);
});
test("Plot pairs preserve identities through exports, reproduction and table metric selection", async () => {
  const { dataset, view, id, x, y } = fixture(),
    v = normalizeView(view, dataset),
    charts = workspaceCharts(dataset, v);
  assert.deepEqual(v.charts, [id, y]);
  assert.equal(v.metric, y);
  assert.equal(charts[0].metric.sourceMetric, y);
  assert.match(charts[0].metric.xUnit, /Score/);
  const csv = await directExport(dataset, v, { format: "csv", metricId: id });
  assert.match(csv[0].data, /"x_metric","x_value","y_metric"/);
  assert.ok(csv[0].data.includes(x));
  const latex = await directExport(dataset, v, {
    format: "latex",
    mode: "separate",
  });
  assert.equal(latex.length, 2);
  assert.match(latex[0].data, /xlabel=\{Score/);
  assert.deepEqual(
    (await restoreReproduction(await makeReproduction(dataset, v))).view
      .plotAxes,
    v.plotAxes,
  );
  assert.equal(workspaceTable(dataset, v).metrics.length, 1);
});
test("Charts keeps the Plots menu and Ablations selects a plot through a dropdown", async () => {
  const { dataset, x, y, view } = fixture(),
    app = testApplication(dataset);
  app.state.view.tab = "workspace";
  const old = structuredClone(app.state.view);
  delete old.plotAxes;
  delete old.ablationXMetric;
  assert.equal(normalizeView(old, dataset).ablationXMetric, "");
  const event = (action, metric) => ({
    target: {
      closest: (s) =>
        s === "[data-action]" ? { dataset: { action, metric } } : null,
    },
  });
  app.render();
  assert.match(app.el.innerHTML, />Plots<\/summary>/);
  assert.doesNotMatch(app.el.innerHTML, /New plot|newPlot[XY]Metric/);
  app.state.view.charts = [];
  await app.handlers.click(event("toggle-chart", x));
  await app.handlers.click(event("toggle-chart", y));
  assert.deepEqual(app.state.view.charts, [x, y]);
  await app.handlers.click(event("toggle-chart", x));
  assert.deepEqual(app.state.view.charts, [y]);
  await app.handlers.click(event("toggle-chart", y));
  assert.deepEqual(app.state.view.charts, []);
  const grid = ablationGrid(dataset, {
    ...view,
    workspaceMode: "ablation",
    ablationXMetric: x,
    ablationMetric: y,
    ablationRow: "",
    ablationColumn: "",
  });
  assert.equal(grid.cells[0].result.groups[0].points[0].step, 10);
  app.state.view.workspaceMode = "ablation";
  app.state.view.ablationXMetric = x;
  app.render();
  assert.match(app.el.innerHTML, /<label>Plot:<select id="ablationMetric">/);
  assert.doesNotMatch(
    app.el.innerHTML,
    /data-menu="metrics"|id="ablation[XY]Metric"/,
  );
  await app.handlers.change({
    target: { id: "ablationMetric", value: y, dataset: {} },
  });
  assert.equal(app.state.view.ablationMetric, y);
  assert.equal(app.state.view.ablationXMetric, "");
  await app.handlers.change({
    target: { id: "ablationMetric", value: x, dataset: {} },
  });
  assert.equal(app.state.view.ablationMetric, x);
  assert.ok(app.el.innerHTML.includes('<option value="' + x + '" selected>'));
  const dropdown = app.el.innerHTML.match(
    /<select id="ablationMetric">([\s\S]*?)<\/select>/,
  )[1];
  assert.equal(
    (dropdown.match(/<option /g) ?? []).length,
    dataset.metrics.length,
  );
  app.destroy();
});
