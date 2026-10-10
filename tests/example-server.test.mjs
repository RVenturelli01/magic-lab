import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import os from "node:os";

async function start(args, overrides = {}) {
  const env = { ...process.env, PORT: "0" };
  delete env.OBSERVATORY_DATASET;
  delete env.MAGICLAB_ALGORITHMS;
  Object.assign(env, overrides);
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(new URL("../magic_lab/server.mjs", import.meta.url)),
      ...args,
    ],
    { cwd: os.tmpdir(), env, windowsHide: true },
  );
  let output = "";
  const base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Server startup timed out: " + output));
    }, 10000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error("Server exited: " + code + " " + output));
    });
    child.stdout.on("data", (data) => {
      output += data;
      const match = output.match(/MagicLab: (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
    child.stderr.on("data", (data) => {
      output += data;
    });
  });
  return {
    base,
    async stop() {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    },
  };
}

test("explicit examples mode serves both portable references independently of cwd", async () => {
  const server = await start(["--examples"]);
  try {
    const dataset = await fetch(server.base + "/api/dataset");
    const algorithms = await fetch(server.base + "/api/algorithms");
    assert.equal(dataset.status, 200);
    assert.equal(algorithms.status, 200);
    assert.equal((await dataset.json()).runs.length, 108);
    assert.equal((await algorithms.json()).root, "ppo");
    assert.equal((await fetch(server.base + "/")).status, 200);
    assert.equal(
      (await fetch(server.base + "/examples/magicplot/manifest.json")).status,
      404,
    );
  } finally {
    await server.stop();
  }
});

test("host overrides take precedence over bundled references", async () => {
  const server = await start(["--examples"], {
    OBSERVATORY_DATASET: "missing-host-data.json",
    MAGICLAB_ALGORITHMS: "missing-host-algorithms.json",
  });
  try {
    assert.equal((await fetch(server.base + "/api/dataset")).status, 404);
    assert.equal((await fetch(server.base + "/api/algorithms")).status, 404);
  } finally {
    await server.stop();
  }
});

test("normal startup does not fall back to examples when host data is missing", async () => {
  const server = await start([]);
  try {
    assert.equal((await fetch(server.base + "/api/dataset")).status, 404);
    assert.equal((await fetch(server.base + "/api/algorithms")).status, 404);
  } finally {
    await server.stop();
  }
});
