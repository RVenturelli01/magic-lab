// Adapt an existing CSV export; never modify the source logs.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDataset } from "../core/dataset.mjs";
export function parseCSV(text) {
  return parseCSVTable(text).rows;
}
export function parseCSVTable(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if (c === "\n" && !quoted) {
      row.push(field.replace(/\r$/, ""));
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw Error("Unclosed CSV quote");
  row.push(field.replace(/\r$/, ""));
  if (row.some(Boolean)) rows.push(row);
  if (!rows.length) throw Error("Empty CSV");
  const [header, ...data] = rows;
  if (new Set(header).size !== header.length)
    throw Error("Duplicate CSV header");
  return {
    header,
    rows: data.map((r, i) => {
      if (r.length !== header.length)
        throw Error("CSV column count at row " + (i + 2));
      return Object.fromEntries(header.map((h, j) => [h, r[j]]));
    }),
  };
}
export async function adapt(directory) {
  const manifest = JSON.parse(
    await readFile(path.join(directory, "manifest.json"), "utf8"),
  );
  const d = {
    schemaVersion: 1,
    id: manifest.id,
    runs: manifest.runs.map(({ file, ...r }) => r),
    metrics: manifest.metrics,
    points: [],
    artifacts: manifest.artifacts || [],
    campaigns: manifest.campaigns || [],
  };
  for (const run of manifest.runs) {
    const file = path.resolve(directory, run.file),
      base = path.resolve(directory) + path.sep;
    if (!file.startsWith(base))
      throw Error("CSV must be within source directory");
    const rows = parseCSV(await readFile(file, "utf8"));
    for (const row of rows) {
      const stepText = row[manifest.stepColumn];
      if (stepText === undefined || stepText.trim() === "")
        throw Error("Missing step column");
      const step = Number(stepText);
      for (const [column, metricId] of Object.entries(manifest.columns)) {
        if (!(column in row)) throw Error("Missing mapped column: " + column);
        if (row[column].trim() === "") continue;
        d.points.push({
          runId: run.id,
          metricId,
          step,
          value: Number(row[column]),
        });
      }
    }
  }
  return validateDataset(d);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [source, target] = process.argv.slice(2);
  if (!source || !target)
    throw Error("Usage: node adapters/csv.mjs SOURCE_DIR OUTPUT_JSON");
  const d = await adapt(source);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(d, null, 2));
  console.log("Adapted " + d.runs.length + " runs → " + target);
}
