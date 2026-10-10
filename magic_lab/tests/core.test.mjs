import { valueKey } from "../core/filters.mjs";

import {
  makeReproduction,
  restoreReproduction,
} from "../core/reproduction.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateDataset } from "../core/dataset.mjs";
import { defaultView, normalizeView } from "../core/view.mjs";
import {
  aggregate,
  smooth,
  summarize,
  summaryRows,
} from "../core/analysis.mjs";
import { csv } from "../core/text.mjs";
import { latex, curveRows } from "../core/export-data.mjs";
import { chartSVG } from "../core/report-svg.mjs";
import { pdf } from "../core/report-pdf.mjs";
import { zip, crc32 } from "../core/archive.mjs";
import { adapt, parseCSV } from "../adapters/csv.mjs";
import { createServer } from "../server/http.mjs";
import { createFixture } from "./support/dataset.mjs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const demo = createFixture();
const fixture = () => ({
  schemaVersion: 1,
  id: "fixture",
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
  runs: [0, 1, 2].map((seed) => ({
    id: "r" + seed,
    algorithm: "PPO",
    environment: "Env",
    seed,
    status: seed === 2 ? "running" : "completed",
    config: { lr: 0.001 },
    code: { commit: "abc", dirty: false },
  })),
  points: [
    { runId: "r0", metricId: "return", step: 0, value: 0 },
    { runId: "r0", metricId: "return", step: 10, value: 10 },
    { runId: "r1", metricId: "return", step: 0, value: 2 },
    { runId: "r1", metricId: "return", step: 10, value: 14 },
    { runId: "r2", metricId: "return", step: 0, value: 4 },
  ],
  artifacts: [],
  campaigns: [],
});
test("mean and unbiased sample SD are numerically correct", () => {
  assert.deepEqual(summarize([2, 4]), { n: 2, mean: 3, sd: Math.sqrt(2) });
  assert.equal(summarize([2]).sd, null);
});
test("incomplete excluded by default and exact common steps", () => {
  const d = fixture(),
    r = aggregate(d, defaultView(d));
  assert.equal(r.excluded, 1);
  assert.deepEqual(r.groups[0].points, [
    { step: 0, n: 2, mean: 1, sd: Math.sqrt(2) },
    { step: 10, n: 2, mean: 12, sd: Math.sqrt(8) },
  ]);
});
test("including partial run uses intersection or varying n, never fills the tail", () => {
  const d = fixture(),
    v = { ...defaultView(d), incomplete: "include" };
  assert.equal(aggregate(d, v).groups[0].points.length, 1);
  v.alignment = "available";
  const p = aggregate(d, v).groups[0].points;
  assert.equal(p[0].n, 3);
  assert.equal(p[1].n, 2);
  assert.equal(p[1].mean, 12);
});
test("smoothing is trailing per run and applied before aggregation", () => {
  const d = fixture(),
    v = { ...defaultView(d), window: 3 };
  assert.equal(aggregate(d, v).groups[0].points[1].mean, 6.5);
  assert.deepEqual(
    smooth([{ value: 2 }, { value: 4 }, { value: 9 }], 2).map((p) => p.value),
    [2, 3, 6.5],
  );
});
test("range clips after smoothing", () => {
  const d = fixture(),
    v = { ...defaultView(d), window: 3, minStep: 10 };
  assert.equal(aggregate(d, v).groups[0].points[0].mean, 6.5);
});
test("configuration, environment and code changes never pool seeds", () => {
  const d = fixture();
  d.runs[1].config.lr = 0.002;
  assert.equal(aggregate(d, defaultView(d)).groups.length, 2);
  d.runs[1].config.lr = 0.001;
  d.runs[1].code.commit = "new";
  assert.equal(aggregate(d, defaultView(d)).groups.length, 2);
});
test("hidden selections do not contribute", () => {
  const d = fixture(),
    v = {
      ...defaultView(d),
      filters: [{ field: "/id", values: [valueKey("r0")] }],
    };
  assert.equal(aggregate(d, v).selected, 1);
  v.selected = [];
  assert.equal(aggregate(d, v).groups.length, 0);
});
test("missing series suppresses common-step group", () => {
  const d = fixture();
  d.points = d.points.filter((p) => p.runId !== "r1");
  const g = aggregate(d, defaultView(d)).groups[0];
  assert.equal(g.points.length, 0);
  assert.deepEqual(g.missing, ["r1"]);
});
test("rejects nonfinite, duplicate observations, unknown references and repeated seeds", () => {
  for (const mutate of [
    (d) => (d.points[0].value = NaN),
    (d) => d.points.push({ ...d.points[0] }),
    (d) => (d.points[0].runId = "missing"),
    (d) => (d.runs[1].seed = 0),
  ]) {
    const d = fixture();
    mutate(d);
    assert.throws(() => validateDataset(d));
  }
});
test("view validation and restore remove stale run IDs", () => {
  const d = fixture(),
    v = defaultView(d);
  v.selected.push("gone");
  assert.equal(normalizeView(v, d).selected.length, 3);
  assert.throws(() => normalizeView({ ...v, window: 0 }, d));
  assert.throws(() => normalizeView({ ...v, minStep: 20, maxStep: 10 }, d));
});
test("CSV adapter preserves raw values and quoted cells", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "observatory-csv-"));
  try {
    const run = fixture().runs[0];
    await writeFile(
      path.join(directory, "manifest.json"),
      JSON.stringify({
        id: "csv",
        metrics: fixture().metrics,
        stepColumn: "step",
        columns: { value: "return" },
        runs: [{ ...run, file: "progress.csv" }],
      }),
    );
    await writeFile(
      path.join(directory, "progress.csv"),
      "step,value\n0,2\n10,\n20,6\n",
    );
    const adapted = await adapt(directory);
    assert.deepEqual(
      adapted.points.map((p) => [p.step, p.value]),
      [
        [0, 2],
        [20, 6],
      ],
    );
    assert.equal(
      await readFile(path.join(directory, "progress.csv"), "utf8"),
      "step,value\n0,2\n10,\n20,6\n",
    );
    assert.deepEqual(parseCSV('a,b\n"x,y","say ""yes"""\n'), [
      { a: "x,y", b: 'say "yes"' },
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("CSV values round trip including newlines and commas", () => {
  const rows = [{ a: "x,y", b: "one\ntwo", c: '"quote"' }];
  assert.deepEqual(parseCSV(csv(rows)), rows);
});
test("exports preserve statistics and have valid signatures", () => {
  const d = fixture(),
    v = defaultView(d),
    r = aggregate(d, v),
    m = d.metrics[0];
  const svg = chartSVG(r, v, m, JSON.stringify(v));
  assert.ok(svg.includes("<metadata>"));
  assert.ok(svg.includes("sample SD"));
  const tex = latex(r, m, v);
  assert.ok(tex.includes("\\begin{tabular}"));
  assert.ok(tex.includes("12.00"));
  const bytes = pdf(r, v, m, "fixture");
  const text = new TextDecoder().decode(bytes);
  assert.ok(text.startsWith("%PDF-1.4"));
  const start = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(start, start + 4), "xref");
  assert.equal(curveRows(r).length, 2);
  assert.equal(summaryRows(r)[0].mean, 12);
});
test("ZIP CRC, local file records and directory offsets", () => {
  const bytes = zip([
      ["a.txt", "hello"],
      ["b.txt", "world"],
    ]),
    dv = new DataView(bytes.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50);
  assert.equal(
    dv.getUint32(14, true),
    crc32(new TextEncoder().encode("hello")),
  );
  const end = bytes.length - 22;
  assert.equal(dv.getUint32(end, true), 0x06054b50);
  assert.equal(dv.getUint16(end + 10, true), 2);
  const central = dv.getUint32(end + 16, true);
  assert.equal(dv.getUint32(central, true), 0x02014b50);
});
test("local HTTP startup, dataset, static modules, boundaries and read-only methods", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "observatory-test-"));
  const datasetPath = path.join(directory, "dataset.json");
  await writeFile(datasetPath, JSON.stringify(fixture()));
  const server = createServer({ datasetPath });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.ok((await page.text()).includes("MagicLab"));
    const data = await fetch(base + "/api/dataset");
    validateDataset(await data.json());
    assert.equal((await fetch(base + "/core/analysis.mjs")).status, 200);
    assert.equal((await fetch(base + "/core/filters.mjs")).status, 200);
    assert.equal((await fetch(base + "/package.json")).status, 404);
    assert.equal(
      (await fetch(base + "/web/%2e%2e%2fpackage.json")).status,
      404,
    );
    assert.equal(
      (await fetch(base + "/api/dataset", { method: "POST" })).status,
      405,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test("reproduction round trip preserves selected data, filters, settings and aggregation; checksum rejects tampering", async () => {
  const d = fixture(),
    v = {
      ...defaultView(d),
      window: 3,
      incomplete: "include",
      alignment: "available",
      minStep: 0,
      maxStep: 10,
    };
  const pack = await makeReproduction(d, v);
  const restored = await restoreReproduction(JSON.parse(JSON.stringify(pack)));
  assert.deepEqual(restored.view, v);
  assert.deepEqual(aggregate(restored.dataset, restored.view), aggregate(d, v));
  pack.dataset.points[0].value = 123;
  await assert.rejects(() => restoreReproduction(pack), /checksum/);
});
