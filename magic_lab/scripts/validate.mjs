import { loadDataset } from "../server/load-dataset.mjs";
import { resolveDatasetPath } from "../server/dataset-path.mjs";
const file = resolveDatasetPath({
  datasetPath: process.argv[2] || process.env.OBSERVATORY_DATASET,
});
const d = await loadDataset(file);
console.log(
  "Valid dataset: " +
    d.runs.length +
    " runs, " +
    d.points.length +
    " points. Source: " +
    file,
);
