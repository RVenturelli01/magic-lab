import { readFile, stat } from "node:fs/promises";
import { adaptRuns } from "../adapters/runs.mjs";
import { validateDataset } from "../core/dataset.mjs";

export async function loadDataset(source) {
  return (await stat(source)).isDirectory()
    ? adaptRuns(source)
    : validateDataset(JSON.parse(await readFile(source, "utf8")));
}
