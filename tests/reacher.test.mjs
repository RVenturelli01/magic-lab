import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { adaptRuns } from "../magic_lab/adapters/runs.mjs";
import { createDemo, grid } from "../magic_lab/examples/magicplot/generate.mjs";
import { groupKey } from "../magic_lab/core/run-identity.mjs";
import { defaultView } from "../magic_lab/core/view.mjs";
import { aggregate } from "../magic_lab/core/analysis.mjs";
import { workspaceCharts } from "../magic_lab/core/workspace.mjs";
import { ablationGrid } from "../magic_lab/panels/ablation-grid.mjs";

test("bundled MagicPlot dataset matches its current generator and provenance", async () => {
  const stored = await adaptRuns(
    fileURLToPath(new URL("../magic_lab/examples/magicplot/", import.meta.url)),
  );
  const expected = createDemo();
  const ordered = (points) =>
    points.toSorted(
      (a, b) =>
        a.runId.localeCompare(b.runId) ||
        a.step - b.step ||
        a.metricId.localeCompare(b.metricId),
    );
  assert.deepEqual(
    { ...stored, points: ordered(stored.points) },
    { ...expected, points: ordered(expected.points) },
  );
});

test("Reacher grid is deterministic, explicitly synthetic and separates 36 configurations", () => {
  const d = createDemo();
  assert.deepEqual(d, createDemo());
  assert.equal(d.runs.length, 108);
  assert.equal(new Set(d.runs.map(groupKey)).size, 36);
  assert.deepEqual(
    [...new Set(d.runs.map((r) => r.algorithm))],
    grid.algorithms,
  );
  assert.ok(
    d.runs.every(
      (r) =>
        r.environment === "Reacher-v5" &&
        r.config.data_source === "synthetic" &&
        r.config.environment_executed === false,
    ),
  );
  assert.ok(
    d.runs.every(
      (r) =>
        r.code.commit === "unknown-unversioned" &&
        /^[a-f0-9]{64}$/.test(r.code.sourceHash),
    ),
  );
  assert.deepEqual(d.artifacts, []);
  assert.deepEqual(d.campaigns, []);
  assert.equal(d.points.length, 18936);
  assert.ok(
    d.points
      .filter((p) => p.metricId.endsWith("/return"))
      .every((p) => p.value < 0),
  );
  assert.ok(
    !d.points.some((p) => p.metricId.startsWith("train/") && p.step === 0),
  );
  for (const r of d.runs) {
    const metrics = new Set(
      d.points.filter((p) => p.runId === r.id).map((p) => p.metricId),
    );
    assert.equal(metrics.has("train/approx_kl"), r.algorithm === "PPO");
    assert.equal(metrics.has("train/clip_fraction"), r.algorithm === "PPO");
    assert.equal(metrics.has("train/entropy"), r.algorithm !== "SAC");
  }
});

test("Reacher seed means match an independent two-seed calculation and factors never pool", () => {
  const d = createDemo(),
    run = d.runs[0],
    members = d.runs.filter((r) => groupKey(r) === groupKey(run));
  const selected = members.slice(0, 2).map((r) => r.id);
  const view = {
    ...defaultView(d),
    selected,
    metric: "eval/return",
    runGrouping: "configuration",
    chartSeries: "seed-mean",
  };
  const result = aggregate(d, view),
    values = selected.map(
      (id) =>
        d.points.find(
          (p) =>
            p.runId === id && p.metricId === view.metric && p.step === 100000,
        ).value,
    );
  const last = result.groups[0].points.at(-1);
  assert.equal(last.n, 2);
  assert.ok(Math.abs(last.mean - (values[0] + values[1]) / 2) < 1e-12);
  assert.ok(
    Math.abs(last.sd - Math.abs(values[0] - values[1]) / Math.sqrt(2)) < 1e-12,
  );
  assert.equal(
    aggregate(d, { ...view, selected: d.runs.map((r) => r.id) }).groups.length,
    36,
  );
  const charts = workspaceCharts(d, {
    ...view,
    charts: ["eval/return", "train/return", "eval/distance"],
  });
  assert.equal(charts.length, 3);
  assert.equal(charts[1].result.groups[0].points[0].step, 2500);
  const ablation = ablationGrid(d, {
    ...view,
    selected: d.runs.map((r) => r.id),
    ablationMetric: "eval/return",
    ablationRow: "/algorithm",
    ablationColumn: "/config/learning_rate",
  });
  assert.equal(ablation.rows.length, 3);
  assert.equal(ablation.columns.length, 3);
  assert.equal(ablation.cells.length, 9);
  assert.ok(ablation.cells.every((cell) => cell.result.groups.length === 4));
});
