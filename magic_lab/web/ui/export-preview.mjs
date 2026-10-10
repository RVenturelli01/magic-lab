import { xml } from "../../core/text.mjs";

export function chartPreview(key, label) {
  return (
    '<div class="chart-preview" data-chart-preview="' +
    xml(key) +
    '" aria-label="LaTeX preview: ' +
    xml(label) +
    '" aria-busy="true"><span role="status">Generating preview?</span></div>'
  );
}

export function compiledChart(url, label) {
  return (
    '<object type="application/pdf" aria-label="LaTeX preview: ' +
    xml(label) +
    '" data="' +
    xml(url) +
    '#toolbar=0&navpanes=0&scrollbar=0&view=Fit">PDF preview unavailable in this browser.</object>'
  );
}
