import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { adaptRuns } from "../adapters/runs.mjs";
import { createServer } from "../server/http.mjs";

async function fixture(t) {
  const host = await mkdtemp(path.join(os.tmpdir(), "magiclab-runs-"));
  t.after(() => rm(host, { recursive: true, force: true }));
  const root = path.join(host, "runs");
  await mkdir(path.join(root, "seed0"), { recursive: true });
  const manifest = {
    schemaVersion: 1,
    id: "fixture",
    stepColumn: "step",
    runs: ["seed0"],
    metrics: [
      {
        id: "train/loss",
        label: "Loss",
        phase: "training",
        unit: "loss",
        xUnit: "steps",
        direction: "lower",
      },
      {
        id: "eval/score",
        label: "Score",
        phase: "evaluation",
        unit: "points",
        xUnit: "steps",
        direction: "higher",
      },
    ],
  };
  const run = {
    id: "r0",
    name: "method",
    algorithm: "method",
    environment: "fixture",
    seed: 0,
    status: "running",
    config: { learning_rate: 0.01 },
    code: { commit: "unknown", dirty: false },
  };
  const log = path.join(root, "seed0/metrics.csv");
  const csv = "step,train/loss,eval/score\n0,4,\n3,2.5,8\n10,,0\n";
  await writeFile(path.join(root, "manifest.json"), JSON.stringify(manifest));
  await writeFile(path.join(root, "seed0/config.json"), JSON.stringify(run));
  await writeFile(log, csv);
  return { host, root, manifest, run, log, csv };
}

test("run folders preserve config, irregular steps, missing metrics and zero without modifying logs", async (t) => {
  const { root, run, log, csv } = await fixture(t);
  const dataset = await adaptRuns(root);
  assert.deepEqual(dataset.runs, [run]);
  assert.deepEqual(dataset.points, [
    { runId: "r0", metricId: "train/loss", step: 0, value: 4 },
    { runId: "r0", metricId: "train/loss", step: 3, value: 2.5 },
    { runId: "r0", metricId: "eval/score", step: 3, value: 8 },
    { runId: "r0", metricId: "eval/score", step: 10, value: 0 },
  ]);
  assert.equal(await readFile(log, "utf8"), csv);
  await writeFile(log, "step,train/loss\n2,1\n");
  assert.equal((await adaptRuns(root)).points.length, 1);
  await writeFile(log, "step,train/loss\n");
  assert.deepEqual((await adaptRuns(root)).points, []);
  assert.equal((await adaptRuns(root)).runs[0].status, "running");
});

test("run folders reject malformed logs and missing files", async (t) => {
  const { root, log } = await fixture(t);
  for (const csv of [
    "train/loss\n1\n",
    "step,other\n",
    "step,train/loss\n,2\n",
    "step,train/loss\n-1,2\n",
    "step,train/loss\nNaN,\n",
    "step,train/loss\n0,Infinity\n",
    "step,train/loss\n0,2\n0,3\n",
  ]) {
    await writeFile(log, csv);
    await assert.rejects(adaptRuns(root));
  }
  await rm(log);
  await assert.rejects(adaptRuns(root), { code: "ENOENT" });
});

test("run folder sources cannot escape the collection, including through junctions", async (t) => {
  const { host, root, manifest } = await fixture(t);
  const outside = path.join(host, "outside");
  await mkdir(outside);
  await writeFile(path.join(outside, "config.json"), "{}");
  for (const folder of ["../outside", outside]) {
    await writeFile(
      path.join(root, "manifest.json"),
      JSON.stringify({ ...manifest, runs: [folder] }),
    );
    await assert.rejects(
      adaptRuns(root),
      /relative path|within the collection/,
    );
  }
  await symlink(
    outside,
    path.join(root, "linked"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await writeFile(
    path.join(root, "manifest.json"),
    JSON.stringify({ ...manifest, runs: ["linked"] }),
  );
  await assert.rejects(adaptRuns(root), /within the collection/);
});

test("HTTP loads host run folders, rereads changed logs and keeps sources private", async (t) => {
  const { host, root, log } = await fixture(t);
  const server = createServer({ repoRoot: host, datasetPath: "runs" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = "http://127.0.0.1:" + server.address().port;
  assert.deepEqual(
    await (await fetch(base + "/api/dataset")).json(),
    await adaptRuns(root),
  );
  await writeFile(log, "step,train/loss\n50,0.125\n");
  const response = await fetch(base + "/api/dataset");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).points[0].value, 0.125);
  assert.equal((await fetch(base + "/runs/seed0/config.json")).status, 404);
  assert.equal((await fetch(base + "/adapters/runs.mjs")).status, 404);
});
