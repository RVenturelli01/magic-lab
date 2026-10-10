import { tableSVG, tableTexText } from "../core/table-figure.mjs";
import {
  workspaceCharts,
  workspaceTable,
  tableRows,
  tableLatex,
} from "../core/workspace.mjs";
import { ablationGrid } from "../panels/ablation-grid.mjs";
import { csv, xml } from "../core/text.mjs";
import { curveRows } from "../core/export-data.mjs";
import { paperDocument, paperTikz } from "../core/paper-export.mjs";
import { normalizePaper } from "../core/paper-style.mjs";

export function standaloneTex(body) {
  return (
    "\\documentclass[border=2pt]{standalone}\n\\usepackage[T1]{fontenc}\n\\usepackage{lmodern}\n\\usepackage{pgfplots}\n\\usepgfplotslibrary{fillbetween}\n\\pgfplotsset{compat=1.18}\n\\begin{document}\n" +
    body +
    "\n\\end{document}\n"
  );
}
export function composeSVG(
  panels,
  { columns, width, height, gapX, gapY, grid } = {},
) {
  const cm = 96 / 2.54,
    cols = Math.max(1, Math.min(columns, panels.length)),
    rows = Math.ceil(panels.length / cols);
  const left = grid ? 64 : 0,
    top = grid ? 36 : 0,
    W = (cols * width + (cols - 1) * gapX) * cm + left,
    H = (rows * height + (rows - 1) * gapY) * cm + top;
  const out = [
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' +
      W +
      '" height="' +
      H +
      '" viewBox="0 0 ' +
      W +
      " " +
      H +
      '"><rect width="100%" height="100%" fill="white"/>',
  ];
  panels.forEach((svg, i) => {
    const x = left + (i % cols) * (width + gapX) * cm,
      y = top + Math.floor(i / cols) * (height + gapY) * cm;
    // Give each panel its own ID namespace, including clip paths and references.
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    for (const id of new Set(ids)) {
      const next = "panel" + i + "-" + id;
      svg = svg
        .replaceAll('id="' + id + '"', 'id="' + next + '"')
        .replaceAll("url(#" + id + ")", "url(#" + next + ")")
        .replaceAll('href="#' + id + '"', 'href="#' + next + '"');
    }
    svg = svg.replace(/<svg\b/, '<svg x="' + x + '" y="' + y + '"');
    out.push(svg);
  });
  if (grid) {
    grid.columns.forEach((c, i) =>
      out.push(
        '<text x="' +
          (left + i * (width + gapX) * cm + (width * cm) / 2) +
          '" y="24" text-anchor="middle" font-family="sans-serif" font-size="12">' +
          xml(c.label) +
          "</text>",
      ),
    );
    grid.rows.forEach((r, i) =>
      out.push(
        '<text transform="translate(20 ' +
          (top + i * (height + gapY) * cm + (height * cm) / 2) +
          ') rotate(-90)" text-anchor="middle" font-family="sans-serif" font-size="12">' +
          xml(r.label) +
          "</text>",
      ),
    );
  }
  return { svg: out.join("") + "</svg>", widthCm: W / cm, heightCm: H / cm };
}
export function imagePDF({ bytes, width, height, widthPt, heightPt }) {
  const enc = new TextEncoder(),
    parts = [],
    offsets = [0];
  let length = 0;
  const push = (v) => {
    const b = typeof v === "string" ? enc.encode(v) : v;
    parts.push(b);
    length += b.length;
  };
  const obj = (id, body) => {
    offsets[id] = length;
    push(id + " 0 obj\n");
    push(body);
    push("\nendobj\n");
  };
  push("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(
    3,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
      widthPt +
      " " +
      heightPt +
      "] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>",
  );
  offsets[4] = length;
  push(
    "4 0 obj\n<< /Type /XObject /Subtype /Image /Width " +
      width +
      " /Height " +
      height +
      " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
      bytes.length +
      " >>\nstream\n",
  );
  push(bytes);
  push("\nendstream\nendobj\n");
  const content = "q " + widthPt + " 0 0 " + heightPt + " 0 0 cm /Im0 Do Q";
  obj(
    5,
    "<< /Length " +
      enc.encode(content).length +
      " >>\nstream\n" +
      content +
      "\nendstream",
  );
  const xref = length;
  push(
    "xref\n0 6\n0000000000 65535 f \n" +
      offsets
        .slice(1)
        .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
        .join("") +
      "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" +
      xref +
      "\n%%EOF\n",
  );
  const output = new Uint8Array(length);
  let pos = 0;
  for (const part of parts) {
    output.set(part, pos);
    pos += part.length;
  }
  return output;
}
export async function directExport(
  dataset,
  view,
  { format, metricId, mode = "combined", renderSVG, rasterize } = {},
) {
  if (!["png", "svg", "pdf", "csv", "latex"].includes(format))
    throw Error("Invalid export format");
  if (!["combined", "separate"].includes(mode))
    throw Error("Invalid export mode");
  const v = metricId
    ? {
        ...view,
        metric: metricId,
        charts: [metricId],
        ablationMetric: metricId,
      }
    : view;
  if (v.workspaceMode === "tables") {
    const views =
      mode === "separate"
        ? v.charts.map((id) => ({ ...v, charts: [id] }))
        : [v];
    if (!views.length) throw Error("Select at least one metric");
    const files = [],
      p = normalizePaper(v.paper);
    for (const [i, current] of views.entries()) {
      const table = workspaceTable(dataset, current);
      if (!table.metrics.length) throw Error("Select at least one metric");
      const name =
        "comparison" +
        (mode === "separate" ? "-" + String(i + 1).padStart(2, "0") : "");
      if (format === "csv") {
        files.push({
          name: name + ".csv",
          type: "text/csv",
          data: csv(tableRows(table)),
        });
        continue;
      }
      if (format === "latex") {
        const body =
          "\\noindent " +
          tableTexText(p.caption || "Experiment comparison") +
          "\\par\\smallskip\n" +
          tableLatex(table);
        const tex =
          "\\documentclass[border=6pt]{standalone}\n\\usepackage[T1]{fontenc}\n\\usepackage[utf8]{inputenc}\n\\usepackage{lmodern}\n\\usepackage{booktabs}\n\\usepackage[table]{xcolor}\n" +
          (p.font === "times" ? "\\usepackage{mathptmx}\n" : "") +
          "\\begin{document}\n" +
          (p.font === "sans" ? "\\sffamily\n" : "") +
          "\\fontsize{" +
          p.fontSize +
          "}{" +
          p.fontSize * 1.5 +
          "}\\selectfont\n\\begin{minipage}{" +
          tableSVG(table, p).widthCm +
          "cm}\n" +
          body +
          "\\end{minipage}\n\\end{document}\n";
        files.push({
          name: name + ".tex",
          type: "application/x-tex",
          data: tex,
        });
        continue;
      }
      const figure = tableSVG(table, p);
      const dimensions = { widthCm: figure.widthCm, heightCm: figure.heightCm };
      if (format === "svg")
        files.push({
          name: name + ".svg",
          type: "image/svg+xml",
          data: figure.svg,
          ...dimensions,
        });
      else {
        const raster = await rasterize(figure.svg, {
          format,
          dpi: p.dpi,
          ...figure,
        });
        files.push({
          name: name + "." + format,
          type: format === "pdf" ? "application/pdf" : "image/png",
          data: format === "pdf" ? imagePDF(raster) : raster.bytes,
          ...dimensions,
        });
      }
    }
    return files;
  }
  const grid = v.workspaceMode === "ablation" ? ablationGrid(dataset, v) : null,
    charts = grid ? grid.cells : workspaceCharts(dataset, v);
  if (!charts.length) throw Error("Select at least one chart or run");
  const p = normalizePaper(v.paper),
    sets = mode === "separate" ? charts.map((c) => [c]) : [charts],
    files = [];
  for (const [i, set] of sets.entries()) {
    const name =
      mode === "separate"
        ? "chart-" +
          String(i + 1).padStart(2, "0") +
          "-" +
          set[0].metric.id.replace(/[^a-zA-Z0-9_-]/g, "-")
        : "figure";
    if (format === "csv") {
      files.push({
        name: name + ".csv",
        type: "text/csv",
        data: csv(
          set.flatMap((c) =>
            curveRows(c.result, c.view).map((r) => ({
              metric: c.metric.id,
              row: c.rowLabel ?? "",
              column: c.columnLabel ?? "",
              ...r,
            })),
          ),
        ),
      });
      continue;
    }
    if (format === "latex") {
      files.push({
        name: name + ".tex",
        type: "application/x-tex",
        data: standaloneTex(
          paperTikz(
            paperDocument(set, v, {
              columns:
                mode === "combined" && grid
                  ? grid.columns.length
                  : mode === "separate"
                    ? 1
                    : p.columns,
            }),
          ),
        ),
      });
      continue;
    }
    const panels = [];
    for (const c of set) panels.push(await renderSVG(c));
    const composed = composeSVG(panels, {
      ...p,
      columns:
        mode === "combined" && grid
          ? grid.columns.length
          : mode === "separate"
            ? 1
            : p.columns,
      grid: mode === "combined" ? grid : null,
    });
    const dimensions = {
      widthCm: composed.widthCm,
      heightCm: composed.heightCm,
    };
    if (format === "svg")
      files.push({
        name: name + ".svg",
        type: "image/svg+xml",
        data: composed.svg,
        ...dimensions,
      });
    else {
      const raster = await rasterize(composed.svg, {
        format,
        dpi: p.dpi,
        ...composed,
      });
      files.push({
        name: name + "." + format,
        type: format === "pdf" ? "application/pdf" : "image/png",
        data: format === "pdf" ? imagePDF(raster) : raster.bytes,
        ...dimensions,
      });
    }
  }
  return files;
}
