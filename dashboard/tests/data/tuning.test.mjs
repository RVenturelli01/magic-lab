import { test } from "node:test";
import assert from "node:assert/strict";
import { createSampleAdapter } from "../../lib/data/sample-adapter.ts";
import {
  bestRun,
  buildTuningStudies,
  metricValue,
  parameterValue,
  sortTuningRuns,
} from "../../lib/data/tuning.ts";

test("trial table sorts numeric values across the full set and keeps missing values last", async () => {
  const { runs } = await createSampleAdapter().listRuns({ limit: 4 });
  const entries = [
    {
      ...runs[0],
      id: "ten",
      name: "trial-010",
      status: "failed",
      config: { batch_size: 128, tuning: { trial_number: 10 } },
      summary: { score: 0.9 },
    },
    {
      ...runs[1],
      id: "two",
      name: "trial-002",
      status: "finished",
      config: { batch_size: 32, tuning: { trial_number: 2 } },
      summary: { score: 0.2 },
    },
    {
      ...runs[2],
      id: "missing",
      name: "trial-missing",
      status: "running",
      config: {},
      summary: {},
    },
    {
      ...runs[3],
      id: "one",
      name: "trial-001",
      status: "finished",
      config: { batch_size: 64, tuning: { trial_number: 1 } },
      summary: { score: 0.5 },
    },
  ];
  const ids = (key, direction) =>
    sortTuningRuns(entries, key, direction, "score").map(({ id }) => id);
  assert.deepEqual(ids("trial", "asc"), ["one", "two", "ten", "missing"]);
  assert.deepEqual(ids("trial", "desc"), ["ten", "two", "one", "missing"]);
  assert.deepEqual(ids("objective", "asc"), ["two", "one", "ten", "missing"]);
  assert.deepEqual(ids("objective", "desc"), ["ten", "one", "two", "missing"]);
  assert.deepEqual(ids("parameter:batch_size", "asc"), [
    "two",
    "one",
    "ten",
    "missing",
  ]);
  assert.deepEqual(ids("status", "asc"), ["ten", "one", "two", "missing"]);
  assert.deepEqual(
    sortTuningRuns(entries, "trial", "asc")
      .slice(0, 2)
      .map(({ id }) => id),
    ["one", "two"],
  );
});

test("sample comparisons reuse run configurations without treating seeds as parameters", async () => {
  const adapter = createSampleAdapter();
  const { runs } = await adapter.listRuns();
  const studies = buildTuningStudies(runs);
  assert.deepEqual(
    studies.map(({ id }) => id),
    ["PPO", "SAC", "A2C"],
  );
  assert.ok(
    studies.every(
      ({ runs, parameters }) =>
        runs.length === 20 &&
        parameters.includes("learning_rate") &&
        !parameters.includes("seed") &&
        !parameters.includes("group"),
    ),
  );
  const metric = (await adapter.getProject()).metrics.find(
    ({ key }) => key === "val/loss",
  );
  const best = bestRun(studies[0].runs, metric);
  assert.equal(
    metricValue(best, metric.key),
    Math.min(
      ...studies[0].runs
        .filter((run) => run.status === "finished")
        .map((run) => metricValue(run, metric.key)),
    ),
  );
  assert.equal(
    parameterValue(best, "learning_rate"),
    String(best.config.learning_rate),
  );
});

test("explicit study metadata keeps same-algorithm Optuna studies separate", async () => {
  const { runs } = await createSampleAdapter().listRuns({ limit: 2 });
  const trial = (id, number) => ({
    ...runs[0],
    id,
    config: {
      ...runs[0].config,
      tuning: { study_id: id, study_name: `Study ${id}`, trial_number: number },
    },
  });
  const studies = buildTuningStudies([
    trial("study-a", 0),
    trial("study-b", 1),
  ]);
  assert.deepEqual(
    studies.map(({ id, name }) => [id, name]),
    [
      ["study-a", "Study study-a"],
      ["study-b", "Study study-b"],
    ],
  );
  assert.ok(
    studies.every(
      ({ parameters }) => !parameters.some((key) => key.startsWith("tuning.")),
    ),
  );
});

test("every simulated tuner study explores its declared space and objective", async () => {
  const adapter = createSampleAdapter();
  const data = await adapter.getTuningData();
  assert.deepEqual(
    data.studies.map(({ id }) => id),
    ["optuna-ppo-example", "optuna-sac-example", "optuna-a2c-example"],
  );
  assert.equal(data.runs.length, 96);
  assert.equal(new Set(data.runs.map(({ id }) => id)).size, 96);
  const metrics = (await adapter.getProject()).metrics;
  const studies = buildTuningStudies(data.runs, data.studies);
  for (const definition of data.studies) {
    const study = studies.find(({ id }) => id === definition.id);
    assert.equal(study.runs.length, 32);
    assert.deepEqual(study.searchSpace, definition.searchSpace);
    assert.deepEqual(
      study.parameters,
      Object.keys(definition.searchSpace).sort(),
    );
    assert.deepEqual(
      study.runs.map((run) => run.config.tuning.trial_number),
      Array.from({ length: 32 }, (_, index) => index),
    );
    const combinations = new Set();
    for (const run of study.runs) {
      const combination = [];
      for (const [key, space] of Object.entries(definition.searchSpace)) {
        const value = parameterValue(run, key);
        assert.notEqual(value, undefined);
        combination.push(value);
        if (space.type === "categorical") {
          assert.ok(
            space.choices.map(String).includes(value),
            `${key}: ${value}`,
          );
        } else {
          const numeric = Number(value);
          assert.ok(
            numeric >= space.low && numeric <= space.high,
            `${key}: ${value}`,
          );
          if (space.step) {
            const steps = (numeric - space.low) / space.step;
            assert.ok(
              Math.abs(steps - Math.round(steps)) < 1e-8,
              `${key}: ${value}`,
            );
          }
        }
      }
      combinations.add(JSON.stringify(combination));
      assert.equal(
        data.histories[run.id].at(-1).values[definition.objectiveKey],
        run.summary[definition.objectiveKey],
      );
    }
    assert.ok(combinations.size >= 30);
    const metric = metrics.find(({ key }) => key === definition.objectiveKey);
    assert.ok(metric?.preferredDirection);
    const best = bestRun(study.runs, metric);
    const objectives = study.runs.map(
      (run) => run.summary[definition.objectiveKey],
    );
    assert.equal(
      metricValue(best, definition.objectiveKey),
      metric.preferredDirection === "minimize"
        ? Math.min(...objectives)
        : Math.max(...objectives),
    );
  }
  data.runs[0].config.learning_rate = 99;
  assert.notEqual(
    (await adapter.getTuningData()).runs[0].config.learning_rate,
    99,
  );
});

test("best trial uses the objective direction, excludes incomplete/missing values and resolves ties by ID", () => {
  const runs = [
    { id: "z", status: "finished", summary: { score: 4 } },
    { id: "a", status: "finished", summary: { score: 4 } },
    { id: "b", status: "finished", summary: { score: 8 } },
    { id: "running", status: "running", summary: { score: -10 } },
    { id: "missing", status: "finished", summary: {} },
  ];
  assert.equal(
    bestRun(runs, { key: "score", preferredDirection: "minimize" }).id,
    "a",
  );
  assert.equal(
    bestRun(runs, { key: "score", preferredDirection: "maximize" }).id,
    "b",
  );
  assert.equal(bestRun([], { key: "score" }), undefined);
  assert.deepEqual(
    runs.map((run) => run.id),
    ["z", "a", "b", "running", "missing"],
  );
});
