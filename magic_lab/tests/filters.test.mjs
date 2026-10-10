import test from "node:test";
import assert from "node:assert/strict";
import {
  valueKey,
  filterFields,
  ablationFilterFields,
  fieldOptions,
  fieldValue,
  normalizeFilters,
} from "../core/filters.mjs";
import { filterRuns, aggregate } from "../core/analysis.mjs";
import { defaultView, normalizeView } from "../core/view.mjs";
import {
  makeReproduction,
  restoreReproduction,
} from "../core/reproduction.mjs";

const runs = [
  {
    id: "a",
    algorithm: "PPO",
    environment: "EnvA",
    status: "completed",
    seed: 0,
    config: {
      epsilon: 0.1,
      enabled: false,
      "learning/rate": 0.001,
      labels: ["a", "b"],
    },
    code: { commit: "abc", dirty: false },
  },
  {
    id: "b",
    algorithm: "PPO",
    environment: "EnvA",
    status: "running",
    seed: 1,
    config: { epsilon: 0.2, enabled: true },
    code: { commit: "abc", dirty: true },
  },
  {
    id: "c",
    algorithm: "SAC",
    environment: "EnvB",
    status: "completed",
    seed: 2,
    config: { epsilon: 0.1, enabled: 0 },
    code: { commit: "def", dirty: false },
  },
  {
    id: "d",
    algorithm: "SAC",
    environment: "EnvB",
    status: "failed",
    seed: 3,
    config: {},
    code: { commit: "def", dirty: false },
  },
];
const dataset = {
  schemaVersion: 1,
  id: "filter-fixture",
  runs,
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
  points: runs.map((r, i) => ({
    runId: r.id,
    metricId: "return",
    step: 10,
    value: i + 1,
  })),
  artifacts: [],
  campaigns: [],
};
const facet = (field, values) => ({ field, values: values.map(valueKey) });
const ids = (filters) => filterRuns(runs, { filters }).map((r) => r.id);

test("visible options use OR within a field and exact typed equality", () => {
  assert.deepEqual(ids([facet("/seed", [0, 2])]), ["a", "c"]);
  assert.deepEqual(ids([facet("/seed", ["1"])]), []);
  assert.deepEqual(ids([facet("/seed", [1])]), ["b"]);
});
test("selected fields combine with AND, including config and code", () => {
  assert.deepEqual(
    ids([
      facet("/config/epsilon", [0.1, 0.2]),
      facet("/status", ["completed"]),
      facet("/code/dirty", [false]),
    ]),
    ["a", "c"],
  );
  assert.deepEqual(
    ids([facet("/environment", ["EnvA"]), facet("/seed", [1, 2])]),
    ["b"],
  );
});
test("catalogue discovers nested and escaped keys and all observed options", () => {
  const fields = filterFields(runs);
  assert.ok(fields.some((f) => f.field === "/config/epsilon"));
  assert.ok(fields.some((f) => f.field === "/config/learning~1rate"));
  assert.equal(fieldValue(runs[0], "/config/learning~1rate"), 0.001);
  assert.deepEqual(
    fieldOptions(runs, "/seed").map((v) => v.value),
    [0, 1, 2, 3],
  );
  assert.deepEqual(
    fieldOptions(runs, "/config/epsilon").map((v) => v.value),
    [0.1, 0.2, undefined],
  );
  const typed = fieldOptions(
    [{ config: { x: 1 } }, { config: { x: "1" } }],
    "/config/x",
  );
  assert.notEqual(typed[0].label, typed[1].label);
});
test("missing, false, zero and arrays are distinct clickable options", () => {
  assert.deepEqual(ids([facet("/config/epsilon", [undefined])]), ["d"]);
  assert.deepEqual(ids([facet("/config/enabled", [false])]), ["a"]);
  assert.deepEqual(ids([facet("/config/enabled", [0])]), ["c"]);
  assert.deepEqual(ids([facet("/config/labels", [["a", "b"]])]), ["a"]);
  assert.notEqual(valueKey(null), valueKey(undefined));
});
test("clearing values makes a field unrestricted; removing filters restores all runs", () => {
  assert.deepEqual(ids([facet("/seed", [])]), ["a", "b", "c", "d"]);
  assert.deepEqual(ids([]), ["a", "b", "c", "d"]);
});
test("selection validation rejects invalid paths/value keys and deduplicates options", () => {
  assert.throws(() =>
    normalizeFilters([{ field: "/seed", values: ["broken"] }]),
  );
  assert.throws(() => normalizeFilters([facet("seed", [0])]));
  assert.throws(() => normalizeFilters([facet("/config/~broken", [0])]));
  assert.throws(() =>
    normalizeFilters([{ ...facet("/seed", [0]), operator: "contains" }]),
  );
  assert.deepEqual(normalizeFilters([facet("/seed", [1, 1])]), [
    facet("/seed", [1]),
  ]);
});
test("views have no operator; old positive and negative operators migrate to selected options", () => {
  const old = {
    ...defaultView(dataset),
    version: 2,
    filters: [
      {
        field: "/seed",
        operator: "not in",
        values: [valueKey(0), valueKey(2)],
      },
    ],
  };
  const migrated = normalizeView(old, dataset);
  assert.equal(migrated.version, 4);
  assert.equal("operator" in migrated.filters[0], false);
  assert.deepEqual(
    filterRuns(runs, migrated).map((r) => r.id),
    ["b", "d"],
  );
  old.filters = [
    { field: "/status", operator: "is", values: [valueKey("completed")] },
  ];
  assert.deepEqual(normalizeView(old, dataset).filters, [
    facet("/status", ["completed"]),
  ]);
  old.filters = [
    { field: "/seed", operator: "not in", values: [0, 1, 2, 3].map(valueKey) },
  ];
  assert.deepEqual(filterRuns(runs, normalizeView(old, dataset)), []);
});
test("only Runs and Workspace are valid sections; legacy Compare and fixed filters migrate", () => {
  assert.equal(defaultView(dataset).tab, "runs");
  assert.deepEqual(
    defaultView(dataset).filters,
    ablationFilterFields(runs).map(({ field }) => ({ field, values: [] })),
  );
  assert.equal(
    normalizeView({ ...defaultView(dataset), tab: "diagnostics" }, dataset).tab,
    "runs",
  );
  const legacy = {
    ...defaultView(dataset),
    version: 1,
    tab: "compare",
    algorithm: "PPO",
    environment: "EnvA",
    status: "completed",
    search: "",
  };
  delete legacy.filters;
  const migrated = normalizeView(legacy, dataset);
  assert.equal(migrated.tab, "workspace");
  assert.equal(migrated.version, 4);
  assert.deepEqual(
    filterRuns(runs, migrated).map((r) => r.id),
    ["a"],
  );
  assert.equal("algorithm" in migrated, false);
});
test("legacy text search preserves hits and empty results", () => {
  const legacy = {
    ...defaultView(dataset),
    version: 1,
    tab: "compare",
    search: "no-such-run",
  };
  delete legacy.filters;
  assert.deepEqual(filterRuns(runs, normalizeView(legacy, dataset)), []);
  legacy.search = "PPO";
  assert.deepEqual(
    filterRuns(runs, normalizeView(legacy, dataset)).map((r) => r.id),
    ["a", "b"],
  );
});
test("option selections intersect selected runs and reproduce exact results", async () => {
  const view = {
    ...defaultView(dataset),
    tab: "workspace",
    selected: ["a", "b", "c"],
    filters: [facet("/seed", [0, 1]), facet("/status", ["completed"])],
  };
  const result = aggregate(dataset, view);
  assert.equal(result.selected, 1);
  assert.equal(result.groups[0].points[0].mean, 1);
  const pack = await makeReproduction(dataset, view),
    restored = await restoreReproduction(JSON.parse(JSON.stringify(pack)));
  assert.deepEqual(restored.view, view);
  assert.deepEqual(aggregate(restored.dataset, restored.view), result);
});
