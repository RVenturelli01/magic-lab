import test from "node:test";
import assert from "node:assert/strict";
import { defaultView, normalizeView } from "../core/view.mjs";
import { valueKey } from "../core/filters.mjs";
import { workspaceCharts } from "../core/workspace.mjs";
import { buildExportPack } from "../reporting/export-pack.mjs";
import { restoreReproduction } from "../core/reproduction.mjs";
import { parseCSV } from "../adapters/csv.mjs";

const dataset = {
  schemaVersion: 1,
  id: "multi-chart-fixture",
  runs: [0, 1].map((seed) => ({
    id: "r" + seed,
    algorithm: "PPO",
    environment: "Env",
    seed,
    status: "completed",
    config: { lr: 0.01 },
    code: { commit: "abc", dirty: false },
  })),
  metrics: [
    {
      id: "eval/return",
      label: "Return",
      phase: "evaluation",
      unit: "reward",
      xUnit: "steps",
      direction: "higher",
    },
    {
      id: "train/return",
      label: "Return",
      phase: "training",
      unit: "reward",
      xUnit: "steps",
      direction: "higher",
    },
  ],
  points: [
    { runId: "r0", metricId: "eval/return", step: 10, value: 10 },
    { runId: "r1", metricId: "eval/return", step: 10, value: 20 },
    { runId: "r0", metricId: "train/return", step: 10, value: 100 },
    { runId: "r1", metricId: "train/return", step: 10, value: 200 },
  ],
  artifacts: [],
  campaigns: [],
};
const view = () => ({
  ...defaultView(dataset),
  tab: "workspace",
  chartSeries: "seed-mean",
  charts: ["eval/return", "train/return"],
});

test("chosen Workspace charts share filters and run selection without mixing metrics", () => {
  let v = view(),
    charts = workspaceCharts(dataset, v);
  assert.deepEqual(
    charts.map((c) => c.metric.id),
    ["eval/return", "train/return"],
  );
  assert.deepEqual(
    charts.map((c) => c.result.groups[0].points[0].mean),
    [15, 150],
  );
  v.filters = [{ field: "/seed", values: [valueKey(0)] }];
  charts = workspaceCharts(dataset, v);
  assert.deepEqual(
    charts.map((c) => c.result.selected),
    [1, 1],
  );
  assert.deepEqual(
    charts.map((c) => c.result.groups[0].points[0].mean),
    [10, 100],
  );
  v.selected = [];
  assert.ok(
    workspaceCharts(dataset, v).every((c) => c.result.groups.length === 0),
  );
});
test("empty, duplicate and stale chart selections normalize predictably", () => {
  assert.deepEqual(
    normalizeView({ ...view(), charts: [] }, dataset).charts,
    [],
  );
  assert.deepEqual(workspaceCharts(dataset, { ...view(), charts: [] }), []);
  assert.deepEqual(
    normalizeView(
      { ...view(), charts: ["eval/return", "gone", "eval/return"] },
      dataset,
    ).charts,
    ["eval/return"],
  );
  assert.throws(() => normalizeView({ ...view(), charts: "bad" }, dataset));
  const old = { ...view(), version: 2, metric: "train/return" };
  delete old.charts;
  assert.deepEqual(normalizeView(old, dataset).charts, ["train/return"]);
});
test("Workspace CSV export contains every selected metric and restores chart choices", async () => {
  const original = view(),
    pack = await buildExportPack(dataset, original, { format: "csv" });
  const summaries = pack.entries.filter(([name]) =>
    name.endsWith("summary.csv"),
  );
  assert.equal(summaries.length, 2);
  assert.notEqual(summaries[0][0], summaries[1][0]);
  assert.deepEqual(
    summaries.map(([, data]) => Number(parseCSV(data)[0].mean)),
    [15, 150],
  );
  const restored = await restoreReproduction(
    JSON.parse(pack.entries.find(([name]) => name === "reproduction.json")[1]),
  );
  assert.deepEqual(restored.view.charts, original.charts);
  assert.deepEqual(
    workspaceCharts(restored.dataset, restored.view).map(
      (c) => c.result.groups[0].points[0].mean,
    ),
    [15, 150],
  );
});
test("per-chart vector export preserves the metric and leaves the Workspace intact", async () => {
  const original = view(),
    pack = await buildExportPack(dataset, original, {
      format: "svg",
      metricId: "train/return",
    });
  assert.equal(
    pack.entries.filter(([name]) => name.endsWith(".svg")).length,
    1,
  );
  assert.deepEqual(pack.reproduction.view.charts, ["train/return"]);
  assert.deepEqual(original.charts, ["eval/return", "train/return"]);
  const svg = pack.entries.find(([name]) => name.endsWith(".svg"))[1];
  assert.ok(svg.includes("training"));
  assert.ok(svg.includes("150"));
  const pdf = await buildExportPack(dataset, original, { format: "pdf" });
  assert.equal(pdf.entries.filter(([name]) => name.endsWith(".pdf")).length, 2);
  await assert.rejects(
    () =>
      buildExportPack(dataset, { ...original, charts: [] }, { format: "csv" }),
    /Select at least one chart/,
  );
});
