import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildTable,
  defaultPanel,
  isPanel,
  tableFields,
} from "../../lib/data/table-model.ts";
import { extent, mean, sampleDeviation } from "../../lib/data/statistics.ts";

const project = { metrics: [{ key: "loss", label: "Loss" }] };
const runs = [
  {
    id: "a",
    name: "A",
    status: "finished",
    config: { batch_size: 32, optimizer: "adam" },
    summary: { loss: 2 },
  },
  {
    id: "b",
    name: "B",
    status: "finished",
    config: { batch_size: 32, optimizer: "adam" },
    summary: { loss: 4 },
  },
  {
    id: "c",
    name: "C",
    status: "running",
    config: { batch_size: 64, optimizer: "sgd" },
    summary: {},
  },
];
test("pivot tables group once by both dimensions and preserve missing metrics", () => {
  const panel = { ...defaultPanel(project), uncertainty: "range" };
  const result = buildTable(panel, runs, project);
  assert.deepEqual(result.headers, [
    "Batch Size ↓  Optimizer →",
    "adam",
    "sgd",
  ]);
  assert.deepEqual(result.values, [
    ["32", "3 (2–4)", "—"],
    ["64", "—", "—"],
  ]);
  assert.equal(
    buildTable({ ...panel, aggregation: "min" }, runs, project).values[0][1],
    "2",
  );
  assert.equal(
    buildTable({ ...panel, uncertainty: "stderr" }, runs, project).values[0][1],
    "3 ± 1",
  );
  assert.deepEqual(
    buildTable({ ...panel, runIds: [] }, runs, project).values,
    [],
  );
});
test("run/manual tables preserve selected order, column labels and literal values", () => {
  const panel = {
    ...defaultPanel(project),
    mode: "runs",
    columns: ["run", "loss"],
    runIds: ["b", "a"],
  };
  assert.deepEqual(buildTable(panel, runs, project), {
    headers: ["Run", "Loss"],
    values: [
      ["A", "2"],
      ["B", "4"],
    ],
  });
  assert.deepEqual(
    buildTable(
      { ...panel, mode: "manual", rows: [["=literal"], ["x", "y", "z"]] },
      runs,
      project,
    ).values,
    [
      ["=literal", ""],
      ["x", "y"],
    ],
  );
});
test("saved table validation accepts existing panels and rejects malformed optional fields", () => {
  assert.equal(isPanel(defaultPanel(project)), true);
  assert.equal(
    isPanel({ ...defaultPanel(project), aggregation: "median" }),
    false,
  );
  assert.equal(isPanel({ ...defaultPanel(project), rowField: {} }), false);
  assert.equal(isPanel({ ...defaultPanel(project), rows: [[null]] }), false);
  assert.deepEqual(tableFields(runs), ["batch_size", "optimizer"]);
});
test("shared statistics handle large groups without call-stack overflow", () => {
  assert.deepEqual(
    extent(Array.from({ length: 200000 }, (_, i) => i)),
    [0, 199999],
  );
  assert.equal(mean([2, 4]), 3);
  assert.equal(sampleDeviation([2, 4]), Math.sqrt(2));
  assert.equal(sampleDeviation([2]), 0);
});
