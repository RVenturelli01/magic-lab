import { createFixture } from "./support/dataset.mjs";
import test from "node:test";
import assert from "node:assert/strict";

import { studentT95, bandHalfWidth, bandLimits } from "../core/uncertainty.mjs";
import { defaultView, normalizeView } from "../core/view.mjs";
import { workspaceCharts } from "../core/workspace.mjs";
import { ablationGrid } from "../panels/ablation-grid.mjs";
import { plotlyFigure } from "../web/plotly-figure.mjs";
import { geometry } from "../core/chart-geometry.mjs";
import { reportSVG } from "../core/report-svg.mjs";
import { buildExportPack } from "../reporting/export-pack.mjs";
import { restoreReproduction } from "../core/reproduction.mjs";
const close = (actual, expected, tolerance = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    actual + " != " + expected,
  );

test("95% Student t critical values agree with analytic and published reference cases", () => {
  close(studentT95(1), 1 / Math.tan(0.025 * Math.PI));
  close(studentT95(2), Math.sqrt((2 * 0.95 ** 2) / (1 - 0.95 ** 2)));
  close(studentT95(9), 2.262157162854099, 1e-8);
  close(studentT95(100), 1.9839715184496334, 1e-8);
  assert.throws(() => studentT95(0));
});
test("STD multiples differ from pointwise confidence intervals and n=1 stays undefined", () => {
  const point = { mean: 53.7, sd: 6.567, n: 10 };
  close(bandHalfWidth(point, "sd"), 6.567);
  close(bandHalfWidth(point, "sd2"), 13.134);
  close(bandHalfWidth(point, "sd3"), 19.701);
  const ci = bandLimits(point, "ci95");
  close(ci.lower, 49.0, 0.01);
  close(ci.upper, 58.4, 0.01);
  for (const band of ["sd", "sd2", "sd3", "ci95", "none"])
    assert.equal(bandHalfWidth({ mean: 4, sd: null, n: 1 }, band), null);
  assert.equal(bandHalfWidth(point, "none"), null);
});

test("Group seeds changes Charts and Ablation to means with the selected uncertainty", async () => {
  const dataset = createFixture();
  const base = defaultView(dataset),
    view = { ...base, runGrouping: "configuration", band: "ci95" };
  const charts = workspaceCharts(dataset, view),
    individual = workspaceCharts(dataset, base);
  assert.ok(
    charts[0].result.groups.length < individual[0].result.groups.length,
  );
  assert.equal(charts[0].view.chartSeries, "seed-mean");
  const group = charts[0].result.groups.find((g) =>
      g.points.some((p) => p.sd > 0),
    ),
    point = group.points.find((p) => p.sd > 0);
  const figure = plotlyFigure({
    ...charts[0],
    result: { ...charts[0].result, groups: [group] },
  });
  const i = group.points.indexOf(point),
    expected = (studentT95(point.n - 1) * point.sd) / Math.sqrt(point.n);
  close(figure.traces[0].y[i], point.mean - expected);
  close(figure.traces[1].y[i], point.mean + expected);
  const bounds = geometry(
    { ...charts[0].result, groups: [group] },
    charts[0].view,
  );
  assert.ok(
    bounds.ymin <= figure.traces[0].y[i] &&
      bounds.ymax >= figure.traces[1].y[i],
  );
  assert.ok(
    ablationGrid(dataset, view).cells.every(
      (cell) => cell.view.chartSeries === "seed-mean",
    ),
  );
  const normalized = normalizeView(view, dataset);
  assert.equal(normalized.chartSeries, "seed-mean");
  assert.throws(() => normalizeView({ ...view, band: "bad" }, dataset));
});

test("Available-step seed count controls the confidence band at an incomplete tail", () => {
  const run = (seed) => ({
    id: "r" + seed,
    name: "experiment",
    algorithm: "EG",
    environment: "Bandit",
    seed,
    status: seed ? "running" : "completed",
    config: {},
    code: { commit: "test", dirty: false },
  });
  const metric = {
    id: "m",
    label: "Reward",
    phase: "evaluation",
    unit: "reward",
    xUnit: "steps",
    direction: "higher",
  };
  const dataset = {
    schemaVersion: 1,
    id: "tail",
    runs: [run(0), run(1)],
    metrics: [metric],
    artifacts: [],
    campaigns: [],
    points: [
      { runId: "r0", metricId: "m", step: 0, value: 1 },
      { runId: "r1", metricId: "m", step: 0, value: 3 },
      { runId: "r0", metricId: "m", step: 1, value: 4 },
    ],
  };
  const view = {
    ...defaultView(dataset),
    runGrouping: "configuration",
    band: "ci95",
    alignment: "available",
    incomplete: "include",
  };
  const chart = workspaceCharts(dataset, view)[0],
    points = chart.result.groups[0].points;
  assert.equal(points[0].n, 2);
  assert.equal(points[1].n, 1);
  const figure = plotlyFigure(chart);
  assert.equal(figure.traces[0].y[1], null);
  assert.equal(figure.traces[1].y[1], null);
  assert.ok(figure.traces[1].y[0] > 3);
  assert.equal(figure.traces[2].y[1], 4);
});

test("All band choices survive reproduction and report/CSV exports use the same bounds", async () => {
  const dataset = createFixture();
  for (const band of ["sd", "sd2", "sd3", "ci95", "none"]) {
    const view = {
      ...defaultView(dataset),
      runGrouping: "configuration",
      band,
    };
    const pack = await buildExportPack(dataset, view, {
      format: "all",
      png: async () => new Uint8Array([137, 80, 78, 71]),
    });
    const restored = await restoreReproduction(pack.reproduction);
    assert.equal(restored.view.band, band);
    assert.equal(restored.view.chartSeries, "seed-mean");
    const csv = pack.entries.find(([name]) => name.endsWith("/curves.csv"))[1];
    assert.ok(csv.includes('"band_lower","band_upper"'));
    assert.ok(csv.includes('"' + band + '"'));
    const chart = workspaceCharts(dataset, normalizeView(view, dataset))[0];
    const svg = reportSVG(chart.result, chart.view, chart.metric);
    assert.equal(svg.includes("<polygon"), band !== "none");
    if (band === "ci95") assert.ok(svg.includes("95% CI (Student t)"));
  }
});
