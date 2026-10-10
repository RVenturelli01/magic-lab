import { performance } from "node:perf_hooks";
import { testApplication } from "../magic_lab/tests/support/application.mjs";
import { createFixture } from "../magic_lab/tests/support/dataset.mjs";
import { normalizeView } from "../magic_lab/core/view.mjs";
import { runMetadata } from "../magic_lab/web/application/run-catalog.mjs";
const dataset = createFixture();
dataset.id = "selection-benchmark-2000";
dataset.runs = Array.from({ length: 2000 }, (_, i) => ({
  ...dataset.runs[0], id: `benchmark-${i}`, seed: i,
  config: Object.fromEntries(Array.from({ length: 30 }, (_, j) => [`parameter_${j}`, (i + j) % (j + 2)])),
}));
dataset.points = [];
dataset.artifacts = dataset.runs.map((run) => ({ runId: run.id, kind: "log", label: "log", path: `${run.id}.log` }));
const app = testApplication(dataset);
const metadata = runMetadata(app.state);
function measure(fn, count = 20) {
  for (let i = 0; i < 3; i++) fn();
  const times = [];
  for (let i = 0; i < count; i++) { const start = performance.now(); fn(); times.push(performance.now() - start); }
  times.sort((a,b) => a - b);
  return { medianMs: +times[Math.floor(times.length / 2)].toFixed(2), p95Ms: +times[Math.floor(times.length * .95)].toFixed(2) };
}
const result = {
  runs: dataset.runs.length,
  configFields: 30,
  normalizationWithoutSnapshot: measure(() => normalizeView(app.state.view, dataset)),
  normalizationWithSnapshot: measure(() => normalizeView(app.state.view, dataset, metadata.fields)),
  selectionAndHtml: measure(() => {
    const id = dataset.runs[0].id;
    app.state.view.selected = app.state.view.selected.includes(id) ? app.state.view.selected.slice(1) : [id, ...app.state.view.selected];
    app.state.view = normalizeView(app.state.view, dataset, metadata.fields);
    app.render();
  }),
  renderedRows: (app.el.innerHTML.match(/data-run="benchmark-/g) ?? []).length,
};
console.log(JSON.stringify(result, null, 2));
app.destroy();
