import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { resolveDatasetPath, repositoryRoot } from "../server/dataset-path.mjs";
import { createServer } from "../server/http.mjs";

test("dataset paths default to the host root and configured paths ignore shell cwd", () => {
  assert.equal(
    resolveDatasetPath({ datasetPath: "" }),
    path.join(repositoryRoot, "data/dataset.json"),
  );
  const host = path.join(os.tmpdir(), "host-repo");
  assert.equal(
    resolveDatasetPath({ repoRoot: host, datasetPath: "logs/normalized.json" }),
    path.join(host, "logs/normalized.json"),
  );
  const absolute = path.join(os.tmpdir(), "dataset.json");
  assert.equal(
    resolveDatasetPath({ repoRoot: host, datasetPath: absolute }),
    absolute,
  );
});

test("server reads a separate host dataset without exposing host files as static assets", async () => {
  const host = await mkdtemp(path.join(os.tmpdir(), "observatory-host-"));
  const dataset = {
    schemaVersion: 1,
    id: "external-host",
    runs: [],
    metrics: [
      {
        id: "score",
        label: "Score",
        phase: "evaluation",
        unit: "points",
        xUnit: "steps",
        direction: "higher",
      },
    ],
    points: [],
    artifacts: [],
    campaigns: [],
  };
  const server = createServer({
    repoRoot: host,
    datasetPath: "logs/normalized.json",
  });
  try {
    await mkdir(path.join(host, "logs"));
    await writeFile(
      path.join(host, "logs/normalized.json"),
      JSON.stringify(dataset),
    );
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + server.address().port;
    const response = await fetch(base + "/api/dataset");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), dataset);
    assert.equal((await fetch(base + "/logs/normalized.json")).status, 404);
    assert.equal((await fetch(base + "/")).status, 200);
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await rm(host, { recursive: true, force: true });
  }
});
