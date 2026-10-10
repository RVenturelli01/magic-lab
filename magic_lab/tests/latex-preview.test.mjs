import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { createLatexPreview } from "../server/latex-preview.mjs";
import { createServer } from "../server/http.mjs";
import { createFixture } from "./support/dataset.mjs";
import { defaultView } from "../core/view.mjs";
import { directExport } from "../reporting/direct-export.mjs";

function input() {
  const dataset = createFixture();
  return {
    dataset,
    view: { ...defaultView(dataset), tab: "workspace", displayMode: "latex" },
    mode: "combined",
  };
}

test("Compiler receives only generated export source, runs locally without shell escape and cleans temporary files", async () => {
  const request = input(),
    calls = [];
  const service = createLatexPreview({
    run: async (command, args, options) => {
      calls.push({ command, args, options });
      if (args[0] === "--version") return { stdout: "MiKTeX-pdfTeX" };
      const source = await readFile(
        path.join(options.cwd, "figure.tex"),
        "utf8",
      );
      const expected = await directExport(request.dataset, request.view, {
        format: "latex",
        mode: "separate",
      });
      assert.equal(source, expected[0].data);
      await writeFile(
        path.join(options.cwd, "figure.pdf"),
        "%PDF-1.4\nfixture",
      );
      return { stdout: "Compiled" };
    },
  });
  assert.equal((await service.capabilities()).latex.available, true);
  const result = await service.compile({ ...request, tex: "\\input{secret}" });
  assert.equal(
    Buffer.from(result.files[0].data, "base64").toString(),
    "%PDF-1.4\nfixture",
  );
  assert.equal(calls.length, 2);
  assert.ok(calls[1].args.includes("-no-shell-escape"));
  assert.ok(calls[1].args.includes("--disable-installer"));
  assert.equal(calls[1].options.windowsHide, true);
  assert.equal(calls[1].options.timeout, 30000);
  assert.equal(calls[1].options.shell, undefined);
  await assert.rejects(stat(calls[1].options.cwd), { code: "ENOENT" });
});

test("Missing compilers and failed compilations cleanly report failures", async () => {
  const absent = createLatexPreview({
    run: async () => {
      throw Object.assign(Error("missing"), { code: "ENOENT" });
    },
  });
  assert.equal((await absent.capabilities()).latex.available, false);
  await assert.rejects(absent.compile(input()), /requires local pdflatex/);
  let directory;
  const failure = createLatexPreview({
    run: async (_command, args, options) => {
      if (args[0] === "--version") return { stdout: "pdfTeX" };
      directory = options.cwd;
      throw Object.assign(Error("compile failed"), {
        stdout: "! LaTeX Error: File `standalone.cls' not found.",
      });
    },
  });
  await assert.rejects(failure.compile(input()), /standalone\.cls/);
  await assert.rejects(stat(directory), { code: "ENOENT" });
});

test("Cancellation reaches the compiler and removes generated files", async () => {
  let enter, directory;
  const entered = new Promise((resolve) => {
    enter = resolve;
  });
  const service = createLatexPreview({
    run: async (_command, args, options) => {
      if (args[0] === "--version") return { stdout: "pdfTeX" };
      directory = options.cwd;
      enter();
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener(
          "abort",
          () => reject(Error("aborted")),
          { once: true },
        );
      });
    },
  });
  const abort = new AbortController(),
    compiling = service.compile(input(), abort.signal);
  await entered;
  abort.abort();
  await assert.rejects(compiling, /aborted/);
  await assert.rejects(stat(directory), { code: "ENOENT" });
});

test("Preview HTTP boundary accepts JSON view snapshots and rejects unrelated methods, origins and raw TeX", async () => {
  const requests = [];
  const server = createServer({
    latexPreview: {
      capabilities: async () => ({ latex: { available: true } }),
      compile: async (value) => {
        requests.push(value);
        if (!value.dataset || !value.view)
          throw Error("Expected dataset and view");
        return { files: [] };
      },
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    assert.equal(
      (await (await fetch(base + "/api/preview/capabilities")).json()).latex
        .available,
      true,
    );
    const post = (body, headers = { "Content-Type": "application/json" }) =>
      fetch(base + "/api/preview/latex", { method: "POST", headers, body });
    assert.equal((await post(JSON.stringify(input()))).status, 200);
    assert.equal(requests.length, 1);
    assert.equal(
      (await post("{}", { "Content-Type": "text/plain" })).status,
      415,
    );
    assert.equal(
      (
        await post("{}", {
          "Content-Type": "application/json",
          Origin: "https://example.com",
        })
      ).status,
      403,
    );
    assert.equal((await post("{")).status, 400);
    assert.equal(
      (await post(JSON.stringify({ tex: "\\input{secret}" }))).status,
      400,
    );
    assert.equal(
      (await fetch(base + "/api/dataset", { method: "POST" })).status,
      405,
    );
    assert.equal(
      (await fetch(base + "/api/preview/latex", { method: "PUT" })).status,
      405,
    );
    assert.equal(
      (await post(JSON.stringify({ payload: "x".repeat(8 * 1024 * 1024) })))
        .status,
      413,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Unchanged LaTeX sources reuse PDFs; changed appearance recompiles without returning stale output", async () => {
  let compiles = 0;
  const service = createLatexPreview({
    run: async (_command, args, options) => {
      if (args[0] === "--version") return { stdout: "pdfTeX" };
      compiles++;
      await writeFile(
        path.join(options.cwd, "figure.pdf"),
        "%PDF-1.4\ncompile-" + compiles,
      );
      return { stdout: "Compiled" };
    },
  });
  const request = input();
  const first = await service.compile(request);
  const count = compiles;
  request.view.displayMode = "interactive";
  request.view.chartSize.width += 100;
  request.mode = "separate";
  assert.deepEqual(await service.compile(request), first);
  assert.equal(compiles, count);
  request.view.paper.fontSize += 1;
  const changed = await service.compile(request);
  assert.ok(compiles > count);
  assert.notDeepEqual(changed, first);
  assert.deepEqual(await service.compile(request), changed);
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(service.compile(request, abort.signal), /abort/i);
});
