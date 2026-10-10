import test from "node:test";
import assert from "node:assert/strict";
import { indexObservations, runObservations } from "../core/observations.mjs";
import { geometry } from "../core/chart-geometry.mjs";
import { extent } from "../core/extent.mjs";

test("Index separates metrics/runs and sorts without mutating raw observations", () => {
  const points = [
    { metricId: "a", runId: "r", step: 2, value: 4 },
    { metricId: "b", runId: "r", step: 0, value: 99 },
    { metricId: "a", runId: "r", step: 0, value: 1 },
  ];
  const original = structuredClone(points),
    index = indexObservations(points);
  assert.deepEqual(
    runObservations(index, "a", "r").map((p) => p.value),
    [1, 4],
  );
  assert.deepEqual(runObservations(index, "a", "missing"), []);
  assert.deepEqual(points, original);
  points[0] = { ...points[0], value: 8 };
  assert.equal(
    runObservations(indexObservations(points), "a", "r")[1].value,
    8,
  );
});

test("Large series bounds avoid argument-stack overflow and include both sides of uncertainty", () => {
  const points = Array.from({ length: 200000 }, (_, step) => ({
    step,
    mean: 10,
    sd: 2,
    n: 2,
  }));
  const bounds = geometry({ groups: [{ points }] }, { band: "sd3" });
  assert.equal(bounds.xmax, 199999);
  assert.ok(bounds.ymin < 4 && bounds.ymax > 16);
  assert.deepEqual(extent([]), [0, 1]);
});
