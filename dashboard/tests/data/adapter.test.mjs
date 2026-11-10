import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSampleAdapter,
  DataAdapterError,
} from "../../lib/data/sample-adapter.ts";

test("sample dataset is explicitly labeled and contains 12 independent five-seed groups", async () => {
  const adapter = createSampleAdapter();
  const project = await adapter.getProject();
  assert.equal(project.isSample, true);
  assert.ok(project.metrics.some(({ key }) => key === "eval/mean_reward"));
  const page = await adapter.listRuns();
  assert.equal(page.total, 60);
  assert.equal(new Set(page.runs.map(({ id }) => id)).size, 60);
  const groups = Map.groupBy(page.runs, (run) => run.config.group);
  assert.equal(groups.size, 12);
  for (const group of groups.values()) {
    assert.equal(group.length, 5);
    assert.deepEqual(
      group.map((run) => run.config.seed).sort(),
      [0, 1, 2, 3, 4],
    );
    assert.equal(new Set(group.map((run) => run.color)).size, 1);
  }
});

test("query combines search, status and nested configuration filters before pagination", async () => {
  const adapter = createSampleAdapter();
  const query = {
    search: " PPO ",
    status: "finished",
    configFilters: [{ key: "model.width", operator: "gte", value: 128 }],
    sortBy: "name",
    sortDirection: "asc",
  };
  const complete = await adapter.listRuns(query);
  const page = await adapter.listRuns({ ...query, offset: 2, limit: 3 });
  assert.equal(complete.total, 16);
  assert.equal(page.total, complete.total);
  assert.deepEqual(page.runs, complete.runs.slice(2, 5));
  assert.deepEqual(await adapter.listRuns({ ...query, offset: 200 }), {
    runs: [],
    total: 16,
    offset: 200,
    limit: 100,
  });
  assert.equal((await adapter.listRuns({ search: "not-a-real-run" })).total, 0);
});

test("summary sorting is numeric and missing keys remain missing rather than matching undefined", async () => {
  const adapter = createSampleAdapter();
  const page = await adapter.listRuns({
    sortBy: "summary:eval/mean_reward",
    sortDirection: "asc",
  });
  const values = page.runs.map((run) => run.summary["eval/mean_reward"]);
  assert.deepEqual(
    values,
    values.toSorted((a, b) => a - b),
  );
  assert.equal(
    (
      await adapter.listRuns({
        configFilters: [{ key: "unknown", operator: "neq", value: 0 }],
      })
    ).total,
    0,
  );
  assert.equal(
    (
      await adapter.listRuns({
        configFilters: [
          { key: "algorithm", operator: "in", value: ["PPO", "SAC"] },
        ],
      })
    ).total,
    40,
  );
});

test("histories have ordered steps, finite metrics, and final samples agree with summaries", async () => {
  const adapter = createSampleAdapter();
  for (const run of (await adapter.listRuns()).runs) {
    const history = await adapter.getHistory(run.id);
    assert.ok(history.length > 1);
    for (let i = 0; i < history.length; i++) {
      assert.ok(Number.isFinite(Date.parse(history[i].timestamp)));
      assert.ok(Object.values(history[i].values).every(Number.isFinite));
      if (i) assert.ok(history[i].step > history[i - 1].step);
    }
    for (const [key, value] of Object.entries(history.at(-1).values))
      assert.equal(run.summary[key], value);
    if (run.status === "finished") assert.equal(history.at(-1).step, 1_000_000);
  }
  const selected = await adapter.getHistory("sample-001", ["eval/mean_reward"]);
  assert.deepEqual(Object.keys(selected[0].values), ["eval/mean_reward"]);
  assert.deepEqual(await adapter.getHistory("sample-001", []), []);
});

test("source is deterministic and isolated from consumer mutations", async () => {
  const first = createSampleAdapter();
  const second = createSampleAdapter();
  assert.deepEqual(await first.listRuns(), await second.listRuns());
  const run = await first.getRun("sample-001");
  run.config.model.width = 999;
  run.tags.push("mutated");
  const history = await first.getHistory(run.id);
  history[0].values["eval/mean_reward"] = -10;
  assert.equal((await second.getRun(run.id)).config.model.width, 128);
  assert.equal((await second.getRun(run.id)).tags.includes("mutated"), false);
  assert.notEqual(
    (await second.getHistory(run.id))[0].values["eval/mean_reward"],
    -10,
  );
});

test("missing run and invalid query errors are distinguishable from empty results", async () => {
  const adapter = createSampleAdapter();
  assert.equal(await adapter.getRun("missing"), null);
  await assert.rejects(
    adapter.getHistory("missing"),
    (error) => error instanceof DataAdapterError && error.code === "not_found",
  );
  await assert.rejects(adapter.getHistory("sample-001", ["not_a_metric"]), {
    code: "invalid_metric",
  });
  for (const query of [
    { offset: -1 },
    { limit: 1.5 },
    { sortBy: "oops" },
    { status: "other" },
    { configFilters: [{ key: "x", operator: "gt", value: "1" }] },
  ]) {
    await assert.rejects(adapter.listRuns(query), { code: "invalid_query" });
  }
});
