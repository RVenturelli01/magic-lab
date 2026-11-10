import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchBrowser } from "./browser-check.mjs";

// Compare production builds on the same machine/browser. Timings are evidence,
// not universal budgets; failures and resource sizes are recorded separately.
const root = path.resolve(
  process.env.DASHBOARD_SOURCE ??
    fileURLToPath(new URL("../", import.meta.url)),
);
const url = process.env.DASHBOARD_URL ?? "http://127.0.0.1:5173";
const output = path.resolve(
  process.env.DASHBOARD_PERFORMANCE_OUTPUT ?? "outputs/performance.json",
);
const { createSampleAdapter } = await import(
  pathToFileURL(path.join(root, "lib/data/sample-adapter.ts"))
);
const { buildChartData, defaultChartSettings } = await import(
  pathToFileURL(path.join(root, "lib/data/chart-model.ts"))
);
const { filterValue } = await import(
  pathToFileURL(path.join(root, "lib/data/run-filters.ts"))
);
const adapter = createSampleAdapter();
const { runs } = await adapter.listRuns();
const histories = Object.fromEntries(
  await Promise.all(
    runs.map(async (run) => [run.id, await adapter.getHistory(run.id)]),
  ),
);
const series = [...Map.groupBy(runs, (run) => run.config.group)].map(
  ([id, items]) => ({ id, name: id, color: items[0].color, runs: items }),
);
const median = (values) =>
  values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
function benchmark(action) {
  action(); // warm the module before collecting five samples
  return Array.from({ length: 5 }, () => {
    const start = performance.now();
    action();
    return performance.now() - start;
  });
}
const manyRuns = Array.from(
  { length: 10000 },
  (_, index) => runs[index % runs.length],
);
const report = {
  url,
  node: process.version,
  source: root,
  cpuThrottle: 4,
  samples: [],
  calculations: {
    filter10kMs: benchmark(() => {
      for (const run of manyRuns)
        for (const key of [
          "algorithm",
          "model.width",
          "optimizer",
          "batch_size",
        ])
          filterValue(run, `config:${key}`);
    }),
    chartMs: benchmark(() =>
      buildChartData(
        series,
        histories,
        defaultChartSettings("eval/mean_reward"),
      ),
    ),
  },
  errors: [],
};
const browser = await launchBrowser();
try {
  for (let i = 0; i < 5; i++) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push(error.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", {
      rate: report.cpuThrottle,
    });
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    const painted = () =>
      page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
    const start = performance.now();
    await page.goto(url);
    await page.locator(".selection-table-runs tbody tr").first().waitFor();
    await painted();
    const initialMs = performance.now() - start;
    const initialResources = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((r) => ({
        name: r.name,
        bytes: r.decodedBodySize,
        type: r.initiatorType,
      })),
    );
    const timings = {};
    for (const [name, button, selector] of [
      ["workspace", "Workspace", ".recharts-line-curve"],
      ["algorithms", "MagicAlgo", ".algo-selection-table"],
      ["studies", "MagicTuner", ".tuner-study-list"],
      ["overview", "Study overview", ".tuner-history-plot .recharts-surface"],
    ]) {
      const before = performance.now();
      await page.getByRole("button", { name: button, exact: true }).click();
      await page.locator(selector).first().waitFor();
      await painted();
      timings[name] = performance.now() - before;
    }
    report.samples.push({
      initialMs,
      initialJavaScriptBytes: initialResources
        .filter((r) => /\.js(?:\?|$)/.test(r.name))
        .reduce((sum, r) => sum + r.bytes, 0),
      initialCssBytes: initialResources
        .filter((r) => /\.css(?:\?|$)/.test(r.name))
        .reduce((sum, r) => sum + r.bytes, 0),
      timings,
    });
    await context.close();
  }
  report.medians = {
    initialMs: median(report.samples.map((s) => s.initialMs)),
    initialJavaScriptBytes: median(
      report.samples.map((s) => s.initialJavaScriptBytes),
    ),
    initialCssBytes: median(report.samples.map((s) => s.initialCssBytes)),
    interactions: Object.fromEntries(
      Object.keys(report.samples[0].timings).map((key) => [
        key,
        median(report.samples.map((s) => s.timings[key])),
      ]),
    ),
    calculations: Object.fromEntries(
      Object.entries(report.calculations).map(([key, values]) => [
        key,
        median(values),
      ]),
    ),
  };
} finally {
  await browser.close();
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
}
console.log(
  JSON.stringify(
    { output, medians: report.medians, errors: report.errors },
    null,
    2,
  ),
);
if (report.errors.length) process.exitCode = 1;
