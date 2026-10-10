import test from "node:test";
import assert from "node:assert/strict";
import { defaultView, normalizeView } from "../core/view.mjs";
import { valueKey } from "../core/filters.mjs";
import {
  workspaceCharts,
  workspaceTable,
  tableRows,
} from "../core/workspace.mjs";
import { ablationGrid } from "../panels/ablation-grid.mjs";
import { buildExportPack } from "../reporting/export-pack.mjs";
import { restoreReproduction } from "../core/reproduction.mjs";
const dataset = {
  schemaVersion: 1,
  id: "grid-fixture",
  runs: [
    {
      id: "a0",
      name: "a",
      algorithm: "EG",
      environment: "Env",
      seed: 0,
      status: "completed",
      config: { epsilon: 0.1, q: 0 },
      code: { commit: "abc", dirty: false },
    },
    {
      id: "a1",
      name: "a",
      algorithm: "EG",
      environment: "Env",
      seed: 1,
      status: "completed",
      config: { epsilon: 0.1, q: 0 },
      code: { commit: "abc", dirty: false },
    },
    {
      id: "b0",
      name: "b",
      algorithm: "EG",
      environment: "Env",
      seed: 0,
      status: "completed",
      config: { epsilon: 0.2, q: 1 },
      code: { commit: "abc", dirty: false },
    },
  ],
  metrics: [
    {
      id: "eval",
      label: "Return",
      phase: "evaluation",
      unit: "reward",
      xUnit: "steps",
      direction: "higher",
    },
    {
      id: "train",
      label: "Loss",
      phase: "training",
      unit: "loss",
      xUnit: "steps",
      direction: "lower",
    },
  ],
  points: [
    { runId: "a0", metricId: "eval", step: 10, value: 10 },
    { runId: "a1", metricId: "eval", step: 10, value: 20 },
    { runId: "b0", metricId: "eval", step: 10, value: 30 },
    { runId: "a0", metricId: "train", step: 10, value: 100 },
    { runId: "a1", metricId: "train", step: 10, value: 200 },
  ],
  artifacts: [],
  campaigns: [],
};
const view = () =>
  normalizeView(
    {
      ...defaultView(dataset),
      charts: ["eval", "train"],
      ablationMetric: "eval",
      ablationRow: "/config/epsilon",
      ablationColumn: "/config/q",
    },
    dataset,
  );
test("Charts overlay each selected run separately without mixing metrics or filling missing data", () => {
  const charts = workspaceCharts(dataset, view());
  assert.deepEqual(
    charts[0].result.groups.map((g) => g.points[0].mean),
    [10, 20, 30],
  );
  assert.equal(charts[1].result.groups.length, 3);
  assert.deepEqual(charts[1].result.groups.at(-1).points, []);
  const v = { ...view(), filters: [{ field: "/seed", values: [valueKey(1)] }] };
  assert.deepEqual(
    workspaceCharts(dataset, v)[0].result.groups.map((g) => g.key),
    ["a1"],
  );
  assert.equal(
    workspaceCharts(dataset, { ...view(), chartSeries: "seed-mean" })[0].result
      .groups[0].points[0].mean,
    15,
  );
});
test("Ablation partitions typed row/column values, keeps empty combinations and shares bounds", () => {
  const grid = ablationGrid(dataset, view());
  assert.equal(grid.cells.length, 4);
  assert.deepEqual(
    grid.cells.map((c) => c.result.groups.map((g) => g.key)),
    [["a0", "a1"], [], [], ["b0"]],
  );
  assert.ok(grid.cells.every((c) => c.metric.id === "eval"));
  for (const cell of grid.cells)
    assert.deepEqual(cell.view.plotBounds, grid.cells[0].view.plotBounds);
  const selected = { ...view(), selected: ["a1"] };
  assert.equal(ablationGrid(dataset, selected).cells.length, 1);
  assert.deepEqual(
    ablationGrid(dataset, { ...view(), selected: [] }).cells,
    [],
  );
  const noAxes = ablationGrid(dataset, {
    ...view(),
    ablationRow: "",
    ablationColumn: "",
  });
  assert.equal(noAxes.cells.length, 1);
  assert.equal(noAxes.cells[0].result.groups.length, 3);
});
test("Grid exports retain axes, exact cell assignment and one metric independently from Charts choices", async () => {
  const v = { ...view(), workspaceMode: "ablation", charts: [] };
  const pack = await buildExportPack(dataset, v, { format: "svg" });
  assert.ok(pack.entries.some(([name]) => name === "ablation-grid.svg"));
  assert.equal(
    pack.entries.filter(
      ([name]) => name.startsWith("cells/") && name.endsWith(".svg"),
    ).length,
    4,
  );
  const restored = await restoreReproduction(pack.reproduction);
  assert.deepEqual(restored.view.charts, []);
  assert.equal(restored.view.ablationColumn, "/config/q");
  assert.deepEqual(
    ablationGrid(restored.dataset, restored.view).cells.map((c) =>
      c.result.groups.map((g) => g.key),
    ),
    [["a0", "a1"], [], [], ["b0"]],
  );
  const pdf = await buildExportPack(dataset, v, { format: "pdf" });
  assert.equal(pdf.entries.filter(([name]) => name.endsWith(".pdf")).length, 4);
  const csv = await buildExportPack(dataset, v, { format: "csv" });
  assert.ok(
    csv.entries.find(([name]) => name === "ablation.csv")[1].includes("column"),
  );
});
test("Tables align configurations across metrics with seed means and absent values", async () => {
  const table = workspaceTable(dataset, view());
  assert.equal(table.rows.length, 2);
  assert.equal(table.rows[0].values.eval.mean, 15);
  assert.equal(table.rows[0].values.train.mean, 150);
  assert.equal(table.rows[1].values.train, null);
  assert.equal(tableRows(table)[0]["eval.n"], 2);
  assert.equal(tableRows(table)[1]["train.mean"], "");
  const pack = await buildExportPack(
    dataset,
    { ...view(), workspaceMode: "tables" },
    { format: "csv" },
  );
  assert.ok(
    pack.entries
      .find(([name]) => name === "comparison.csv")[1]
      .includes("train.mean"),
  );
  const tex = await buildExportPack(
    dataset,
    { ...view(), workspaceMode: "tables" },
    { format: "latex" },
  );
  assert.ok(
    tex.entries
      .find(([name]) => name === "comparison.tex")[1]
      .includes("Return"),
  );
});
