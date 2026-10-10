import { mkdir, writeFile } from "node:fs/promises";
import { adaptRuns } from "../../adapters/runs.mjs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { defaultView, normalizeView } from "../../core/view.mjs";
import { normalizePaper } from "../../core/paper-style.mjs";
import { workspaceCharts } from "../../core/workspace.mjs";
import { buildExportPack } from "../../reporting/export-pack.mjs";
import { zip } from "../../core/archive.mjs";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const d = await adaptRuns(fileURLToPath(new URL("./", import.meta.url)));
const selected = d.runs
  .filter(
    (r) =>
      r.config.learning_rate === 0.0003 &&
      r.config.gamma === 0.99 &&
      ((r.algorithm === "SAC" && r.config.ent_coef === 0.05) ||
        (r.algorithm === "PPO" && r.config.clip_range === 0.2) ||
        (r.algorithm === "A2C" && r.config.ent_coef === 0.01)),
  )
  .map((r) => r.id);
let v = normalizeView(
  {
    ...defaultView(d),
    name: "Paper reference · synthetic Reacher",
    tab: "workspace",
    runGrouping: "configuration",
    workspaceMode: "charts",
    charts: ["eval/return", "eval/distance"],
    selected,
    paper: normalizePaper({
      width: 8,
      height: 6.6,
      gapX: 1.2,
      columns: 2,
      caption:
        "Synthetic Reacher-v5 test data. SAC, PPO and A2C; mean and sample SD across three synthetic seeds. No training executed.",
    }),
  },
  d,
);
for (const chart of workspaceCharts(d, v)) {
  for (const group of chart.result.groups) {
    const algorithm = group.algorithm,
      index = ["SAC", "PPO", "A2C"].indexOf(algorithm);
    v.paper.series[group.key] = {
      label: algorithm,
      color: ["#000000", "#ff1493", "#668cff"][index],
      order: index,
    };
  }
  v.paper.metrics[chart.metric.id] = {
    xScale: 1000,
    xlabel: "Simulated environment steps (thousands)",
    xmin: 0,
    xmax: 100,
    xTick: 25,
    ylabel:
      chart.metric.id === "eval/return"
        ? "Synthetic episode return"
        : "Synthetic distance (m)",
    panelCaption:
      chart.metric.id === "eval/return"
        ? "(a) Synthetic evaluation return"
        : "(b) Synthetic target distance",
  };
}
const output = path.join(root, "exports/paper-reference");
await mkdir(output, { recursive: true });
const pack = await buildExportPack(d, v, { format: "paper" });
// Include inspectable vector figures and numerical summaries alongside the editable paper source.
for (const format of ["svg", "pdf", "csv", "latex"]) {
  const report = await buildExportPack(d, v, { format });
  for (const entry of report.entries)
    if (!pack.entries.some(([name]) => name === entry[0]))
      pack.entries.push(entry);
}
for (const [name, data] of pack.entries) {
  const dest = path.join(output, name);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, data);
}
await writeFile(
  path.join(output, "view.json"),
  JSON.stringify(v, null, 2) + "\n",
);
await writeFile(path.join(output, "paper-reference.zip"), zip(pack.entries));
console.log(
  "Wrote " +
    pack.entries.length +
    " files, importable view and ZIP to " +
    output,
);
