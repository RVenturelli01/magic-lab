import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve host data independently of the shell's working directory.
export const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
export function resolveDatasetPath({
  repoRoot = repositoryRoot,
  datasetPath = process.env.OBSERVATORY_DATASET,
} = {}) {
  return path.resolve(repoRoot, datasetPath || "data/dataset.json");
}
