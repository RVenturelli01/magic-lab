import test from "node:test";
import assert from "node:assert/strict";
import { workspaceRunTable, selectTableRuns } from "../core/run-table.mjs";
import { defaultView, normalizeView } from "../core/view.mjs";
import { valueKey } from "../core/filters.mjs";
import { buildExportPack } from "../reporting/export-pack.mjs";
import { restoreReproduction } from "../core/reproduction.mjs";
const dataset = {
  schemaVersion: 1,
  id: "table",
  runs: [
    {
      id: "a",
      seed: 1,
      algorithm: "PPO",
      environment: "Env",
      status: "completed",
      config: { lr: 0.1 },
      code: { commit: "abc", dirty: false },
    },
    {
      id: "b",
      seed: 0,
      algorithm: "PPO",
      environment: "Env",
      status: "completed",
      config: { lr: 0.2 },
      code: { commit: "abc", dirty: false },
    },
    {
      id: "c",
      seed: 1,
      algorithm: "PPO",
      environment: "Env",
      status: "failed",
      config: { lr: 0.2 },
      code: { commit: "abc", dirty: false },
    },
  ],
  metrics: [
    {
      id: "return",
      label: "Return",
      phase: "evaluation",
      unit: "reward",
      xUnit: "steps",
      direction: "higher",
    },
  ],
  points: [],
  artifacts: [],
  campaigns: [],
};
const view = () => ({
  ...defaultView(dataset),
  filters: [
    { field: "/algorithm", values: [] },
    { field: "/seed", values: [] },
    { field: "/config/lr", values: [] },
    { field: "/status", values: [] },
  ],
});
test("Run columns follow all displayed filters in order, including constant and empty results", () => {
  const v = view();
  v.selected = ["a"];
  const fields = ["/algorithm", "/seed", "/config/lr", "/status"];
  assert.deepEqual(
    workspaceRunTable(dataset, v).columns.map((c) => c.field),
    fields,
  );
  v.filters[2].values = [valueKey(0.2)];
  assert.deepEqual(
    workspaceRunTable(dataset, v).columns.map((c) => c.field),
    fields,
  );
  v.filters[3].values = [valueKey("completed")];
  assert.deepEqual(
    workspaceRunTable(dataset, v).columns.map((c) => c.field),
    fields,
  );
  v.filters[2].values = [valueKey(9)];
  assert.deepEqual(
    workspaceRunTable(dataset, v).columns.map((c) => c.field),
    fields,
  );
  v.filters = [
    { field: "/code/commit", values: [] },
    { field: "/name", values: [] },
    { field: "/id", values: [] },
  ];
  assert.deepEqual(
    workspaceRunTable(dataset, v).columns.map((c) => c.label),
    ["Code version", "Run name", "Run"],
  );
});
test("Grouping collapses replicas of identical configuration, never different configurations", () => {
  const v = { ...view(), runGrouping: "configuration" },
    table = workspaceRunTable(dataset, v);
  assert.equal(table.groups.length, 2);
  assert.deepEqual(
    table.groups.map((g) => g.runs.map((r) => r.id)),
    [["a"], ["b", "c"]],
  );
  assert.deepEqual(
    table.groups[1].runs.map((r) => r.seed),
    [0, 1],
  );
  v.filters[3].values = [valueKey("completed")];
  assert.deepEqual(
    workspaceRunTable(dataset, v).groups.map((g) => g.runs.map((r) => r.id)),
    [["a"], ["b"]],
  );
  assert.equal(
    workspaceRunTable(dataset, { ...v, runGrouping: "none" }).grouped,
    false,
  );
});
test("Environment and code changes keep seed groups separate", () => {
  const d = {
    ...dataset,
    runs: [
      dataset.runs[1],
      { ...dataset.runs[1], id: "other-env", seed: 2, environment: "Other" },
      {
        ...dataset.runs[1],
        id: "other-code",
        seed: 3,
        code: { commit: "xyz", dirty: false },
      },
    ],
  };
  assert.equal(
    workspaceRunTable(d, { ...view(), runGrouping: "configuration" }).groups
      .length,
    3,
  );
});
test("Group selection preserves hidden selections and chip deselection", () => {
  let selected = selectTableRuns(["hidden", "a"], ["a", "b"], true);
  assert.deepEqual(selected, ["hidden", "a", "b"]);
  selected = selectTableRuns(selected, ["a"], false);
  assert.deepEqual(selected, ["hidden", "b"]);
  selected = selectTableRuns(selected, ["a", "b"], false);
  assert.deepEqual(selected, ["hidden"]);
});
test("Table comparison preserves missing values and value types", () => {
  const d = {
    ...dataset,
    runs: dataset.runs.map((r, i) => ({
      ...r,
      config: i === 0 ? {} : { lr: i === 1 ? 0 : "0" },
    })),
  };
  assert.deepEqual(
    workspaceRunTable(d, view()).columns.map((c) => c.field),
    ["/algorithm", "/seed", "/config/lr", "/status"],
  );
});
test("Seed grouping survives view normalization and reproduction export", async () => {
  const v = { ...view(), runGrouping: "configuration" };
  assert.equal(normalizeView(v, dataset).runGrouping, "configuration");
  assert.equal(
    normalizeView({ ...v, runGrouping: "seed" }, dataset).runGrouping,
    "configuration",
  );
  const old = { ...v };
  delete old.runGrouping;
  assert.equal(normalizeView(old, dataset).runGrouping, "none");
  assert.throws(
    () => normalizeView({ ...v, runGrouping: "algorithm" }, dataset),
    /Invalid run grouping/,
  );
  const pack = await buildExportPack(dataset, v, { format: "csv" });
  const restored = await restoreReproduction(pack.reproduction);
  assert.equal(restored.view.runGrouping, "configuration");
});

test("Shared names group seed replicas and remain stable under filtering", () => {
  const d = {
    ...dataset,
    runs: dataset.runs.map((r) => ({
      ...r,
      name: r.config.lr === 0.1 ? "baseline" : "ablation",
    })),
  };
  const v = { ...view(), runGrouping: "configuration" },
    table = workspaceRunTable(d, v);
  assert.deepEqual(
    table.groups.map((g) => [g.name, g.runs.map((r) => r.id)]),
    [
      ["baseline", ["a"]],
      ["ablation", ["b", "c"]],
    ],
  );
  v.filters = [{ field: "/seed", values: [valueKey(1)] }];
  assert.deepEqual(
    workspaceRunTable(d, v).groups.map((g) => g.name),
    ["baseline", "ablation"],
  );
});
test("Different names stay separate and same-name config differences never merge", () => {
  const d = {
    ...dataset,
    runs: dataset.runs.map((r) => ({ ...r, name: "experiment" })),
  };
  const v = { ...view(), runGrouping: "configuration" };
  assert.equal(workspaceRunTable(d, v).groups.length, 2);
  d.runs[2].name = "other";
  assert.equal(workspaceRunTable(d, v).groups.length, 3);
});
