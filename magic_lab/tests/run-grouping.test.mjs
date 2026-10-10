import test from "node:test";
import assert from "node:assert/strict";
import { defaultView, normalizeView } from "../core/view.mjs";
import { groupRuns, groupingOptions } from "../core/run-grouping.mjs";
import {
  workspaceRunTable,
  selectTableRuns,
  catalogCounts,
} from "../core/run-table.mjs";
import { workspaceCharts, workspaceTable } from "../core/workspace.mjs";
import { valueKey } from "../core/filters.mjs";
import { buildExportPack } from "../reporting/export-pack.mjs";
import { restoreReproduction } from "../core/reproduction.mjs";
import { plotlyFigure } from "../web/plotly-figure.mjs";
import { ablationGrid } from "../panels/ablation-grid.mjs";
const run = (id, seed, epsilon, status = "completed") => ({
  id,
  name: "eps" + epsilon,
  seed,
  algorithm: "EG",
  environment: "Bandit",
  status,
  config: { epsilon },
  code: { commit: "abc", dirty: false },
});
const d = {
  schemaVersion: 1,
  id: "grouping",
  runs: [
    run("a0", 0, 0.1),
    run("a1", 1, 0.1),
    run("b0", 0, 0.2),
    run("b1", 1, 0.2),
  ],
  metrics: [
    {
      id: "reward",
      label: "Reward",
      phase: "evaluation",
      unit: "reward",
      xUnit: "pulls",
      direction: "higher",
    },
  ],
  points: [1, 3, 5, 7].map((value, i) => ({
    runId: ["a0", "a1", "b0", "b1"][i],
    metricId: "reward",
    step: 0,
    value,
  })),
  artifacts: [],
  campaigns: [],
};
const view = () => defaultView(d);

test("Seeds preserves full identity; explicit fields form groups by exact typed value", () => {
  assert.deepEqual(
    groupRuns(d.runs, { runGrouping: "configuration" }).map((g) =>
      g.runs.map((r) => r.id),
    ),
    [
      ["a0", "a1"],
      ["b0", "b1"],
    ],
  );
  assert.equal(groupRuns(d.runs, { runGrouping: "/algorithm" }).length, 1);
  const runs = d.runs.map((r, i) => ({
    ...r,
    config: i === 0 ? {} : { epsilon: i === 1 ? 0 : i === 2 ? "0" : null },
  }));
  assert.equal(groupRuns(runs, { runGrouping: "/config/epsilon" }).length, 4);
  assert.equal(
    new Set(
      groupRuns(runs, { runGrouping: "/config/epsilon" }).map((g) => g.name),
    ).size,
    4,
  );
  const options = groupingOptions(d.runs);
  assert.ok(options.some((o) => o[0] === "configuration" && o[1] === "Seeds"));
  assert.ok(options.some((o) => o[0] === "/config/epsilon"));
  assert.ok(!options.some((o) => o[0] === "/id"));
});

test("Counts use selected visible runs/groups over all dataset members; None has no groups", () => {
  const v = {
    ...view(),
    runGrouping: "configuration",
    filters: [{ field: "/config/epsilon", values: [valueKey(0.1)] }],
    selected: ["a0", "b0"],
  };
  assert.deepEqual(catalogCounts(d, v), {
    runs: 1,
    totalRuns: 4,
    groups: 1,
    totalGroups: 2,
  });
  assert.deepEqual(catalogCounts(d, { ...v, runGrouping: "/algorithm" }), {
    runs: 1,
    totalRuns: 4,
    groups: 1,
    totalGroups: 1,
  });
  assert.deepEqual(catalogCounts(d, { ...v, runGrouping: "none" }), {
    runs: 1,
    totalRuns: 4,
    groups: 0,
    totalGroups: 0,
  });
  const table = workspaceRunTable(d, { ...v, runGrouping: "/algorithm" });
  assert.deepEqual(
    table.groups[0].runs.map((r) => r.id),
    ["a0", "a1"],
  );
  assert.deepEqual(
    selectTableRuns(
      v.selected,
      table.groups[0].runs.map((r) => r.id),
      false,
    ),
    ["b0"],
  );
});

test("Explicit field grouping drives tables, means and uncertainty; Seeds never pools ablations", () => {
  const grouped = normalizeView({ ...view(), runGrouping: "/algorithm" }, d);
  assert.equal(grouped.chartSeries, "group-mean");
  const chart = workspaceCharts(d, grouped)[0],
    g = chart.result.groups[0];
  assert.equal(chart.result.groups.length, 1);
  assert.equal(g.name, "Algorithm = EG");
  assert.deepEqual(g.points, [
    { step: 0, n: 4, mean: 4, sd: Math.sqrt(20 / 3) },
  ]);
  assert.equal(g.config.groupedConfigurations.length, 2);
  const figure = plotlyFigure(chart);
  assert.equal(figure.traces.length, 3);
  assert.equal(figure.traces[2].y[0], 4);
  assert.ok(figure.traces[0].y[0] < 4);
  const table = workspaceTable(d, grouped);
  assert.equal(table.rows.length, 1);
  assert.equal(table.rows[0].values.reward.mean, 4);
  const seed = workspaceCharts(d, {
    ...view(),
    runGrouping: "configuration",
  })[0];
  assert.deepEqual(
    seed.result.groups.map((g) => g.points[0].mean),
    [2, 6],
  );
});

test("Field grouping survives filtered selection, grid partitions, exports and stale field migration", async () => {
  const v = normalizeView(
    {
      ...view(),
      runGrouping: "/config/epsilon",
      band: "ci95",
      selected: ["a0", "a1", "b0"],
    },
    d,
  );
  const pack = await buildExportPack(d, v, { format: "csv" }),
    restored = await restoreReproduction(pack.reproduction);
  assert.equal(restored.view.runGrouping, "/config/epsilon");
  assert.equal(restored.view.chartSeries, "group-mean");
  assert.deepEqual(
    workspaceCharts(d, restored.view)[0].result.groups.map(
      (g) => g.points[0].n,
    ),
    [2, 1],
  );
  const grid = ablationGrid(d, {
    ...v,
    ablationRow: "/config/epsilon",
    ablationColumn: "",
  });
  assert.ok(grid.cells.every((c) => c.view.chartSeries === "group-mean"));
  assert.equal(grid.cells.length, 2);
  const stale = normalizeView({ ...v, runGrouping: "/config/missing" }, d);
  assert.equal(stale.runGrouping, "none");
  assert.equal(stale.chartSeries, "runs");
  assert.throws(() =>
    normalizeView({ ...v, runGrouping: "/config/bad~escape" }, d),
  );
});
