import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { parseCSVTable } from "./csv.mjs";
import { validateDataset } from "../core/dataset.mjs";

// Read a collection of run folders without changing any source files.
export async function adaptRuns(directory) {
  const root = await realpath(directory);
  async function readSource(relative) {
    if (typeof relative !== "string" || !relative || path.isAbsolute(relative))
      throw Error("Run source must be a relative path");
    const candidate = path.resolve(root, relative);
    const inside = (file) => {
      const rel = path.relative(root, file);
      return (
        rel &&
        rel !== ".." &&
        !rel.startsWith(".." + path.sep) &&
        !path.isAbsolute(rel)
      );
    };
    if (!inside(candidate) || !inside(await realpath(candidate)))
      throw Error("Run source must stay within the collection directory");
    return readFile(candidate, "utf8");
  }
  const manifest = JSON.parse(await readSource("manifest.json"));
  if (
    manifest.schemaVersion !== 1 ||
    !Array.isArray(manifest.runs) ||
    !Array.isArray(manifest.metrics) ||
    !manifest.metrics.length ||
    typeof manifest.stepColumn !== "string" ||
    !manifest.stepColumn ||
    manifest.metrics.some((m) => m.id === manifest.stepColumn)
  )
    throw Error("Invalid run collection manifest");
  const dataset = {
    schemaVersion: 1,
    id: manifest.id,
    ...(manifest.description === undefined
      ? {}
      : { description: manifest.description }),
    runs: [],
    metrics: manifest.metrics,
    points: [],
    artifacts: manifest.artifacts || [],
    campaigns: manifest.campaigns || [],
  };
  for (const folder of manifest.runs) {
    if (typeof folder !== "string" || !folder)
      throw Error("Invalid run folder");
    const run = JSON.parse(await readSource(folder + "/config.json"));
    dataset.runs.push(run);
    const { header, rows } = parseCSVTable(
      await readSource(folder + "/metrics.csv"),
    );
    if (!header.includes(manifest.stepColumn))
      throw Error("Missing step column in " + folder);
    for (const column of header)
      if (
        column !== manifest.stepColumn &&
        !manifest.metrics.some((m) => m.id === column)
      )
        throw Error("Undeclared metric column: " + column);
    for (const [index, row] of rows.entries()) {
      const stepText = row[manifest.stepColumn];
      if (stepText === undefined || stepText.trim() === "")
        throw Error("Missing step in " + folder + " at row " + (index + 2));
      for (const metric of manifest.metrics) {
        // Different algorithms may log different subsets of the declared metrics.
        const cell = row[metric.id];
        if (cell === undefined || cell.trim() === "") continue;
        dataset.points.push({
          runId: run.id,
          metricId: metric.id,
          step: Number(stepText),
          value: Number(cell),
        });
      }
      if (!Number.isFinite(Number(stepText)) || Number(stepText) < 0)
        throw Error("Invalid step in " + folder + " at row " + (index + 2));
    }
  }
  return validateDataset(dataset);
}
