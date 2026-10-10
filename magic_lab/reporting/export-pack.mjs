import { paperEntries } from "../core/paper-export.mjs";
import { ablationGrid, ablationGridSVG } from "../panels/ablation-grid.mjs";
import { makeReproduction } from "../core/reproduction.mjs";
import {
  workspaceCharts,
  workspaceTable,
  tableRows,
  tableLatex,
} from "../core/workspace.mjs";
import { summaryRows } from "../core/analysis.mjs";
import { reportSVG } from "../core/report-svg.mjs";
import { pdf } from "../core/report-pdf.mjs";
import { csv } from "../core/text.mjs";
import { curveRows, latex, curvesLatex } from "../core/export-data.mjs";
export async function buildExportPack(
  dataset,
  view,
  { format = "all", metricId, png, paperImage } = {},
) {
  if (!["all", "svg", "png", "pdf", "csv", "latex", "paper"].includes(format))
    throw Error("Invalid export format");
  const requested = metricId
    ? {
        ...view,
        metric: metricId,
        ablationMetric: metricId,
        charts: [metricId],
      }
    : view;
  const reproduction = await makeReproduction(dataset, requested),
    v = reproduction.view,
    d = reproduction.dataset;
  const grid = v.workspaceMode === "ablation" ? ablationGrid(d, v) : null;
  const charts = grid
    ? grid.cells
    : workspaceCharts(
        d,
        v.workspaceMode === "tables" ? { ...v, chartSeries: "seed-mean" } : v,
      );
  if (!charts.length) throw Error("Select at least one chart or run");
  const entries = [
    ["reproduction.json", JSON.stringify(reproduction, null, 2)],
    [
      "README.txt",
      "reproduction.json contains portable data, metric selections, grid axes and settings for programmatic restoration with core/reproduction.mjs. Charts overlay individual runs unless Seed mean is chosen. Tables use mean and sample SD at each group’s last visible point; endpoints may differ. Grid cells use shared axes and partition selected runs by exact typed field values; empty cells remain empty. PDF exports contain one figure per cell. No training is executed.",
    ],
    [
      "groups.json",
      JSON.stringify(
        charts.map((chart) => ({
          metricId: chart.metric.id,
          row: chart.rowLabel,
          column: chart.columnLabel,
          groups: chart.result.groups.map(({ points, ...group }) => group),
        })),
        null,
        2,
      ),
    ],
  ];
  if (
    v.workspaceMode !== "tables" &&
    ["paper", "latex", "all"].includes(format)
  ) {
    entries.push(...paperEntries(charts, v, { columns: grid?.columns.length }));
    if (typeof paperImage === "function" && format !== "latex")
      for (const [i, chart] of charts.entries()) {
        for (const kind of ["svg", "png"])
          entries.push([
            "paper/preview-" + String(i + 1).padStart(2, "0") + "." + kind,
            await paperImage(chart, kind),
          ]);
      }
  }
  if (format === "paper") return { entries, reproduction };
  if (
    v.paper.enabled &&
    v.workspaceMode !== "tables" &&
    ["svg", "png"].includes(format) &&
    typeof paperImage === "function"
  ) {
    entries.push(...paperEntries(charts, v, { columns: grid?.columns.length }));
    for (const [i, chart] of charts.entries())
      entries.push([
        "paper/figure-" + String(i + 1).padStart(2, "0") + "." + format,
        await paperImage(chart, format),
      ]);
    return { entries, reproduction };
  }
  if (v.workspaceMode === "tables") {
    const table = workspaceTable(d, v);
    if (format === "all" || format === "csv")
      entries.push(["comparison.csv", csv(tableRows(table))]);
    if (format === "all" || format === "latex")
      entries.push(["comparison.tex", tableLatex(table)]);
  }
  if (grid) {
    entries.push([
      "grid.json",
      JSON.stringify(
        {
          metric: grid.metric,
          rowField: v.ablationRow,
          columnField: v.ablationColumn,
          rows: grid.rows,
          columns: grid.columns,
        },
        null,
        2,
      ),
    ]);
    const svg = ablationGridSVG(
      grid,
      JSON.stringify({ view: v, datasetSha256: reproduction.datasetSha256 }),
    );
    if (format === "all" || format === "svg")
      entries.push(["ablation-grid.svg", svg]);
    if (format === "all" || format === "png") {
      if (typeof png !== "function")
        throw Error("PNG export requires browser Canvas");
      entries.push(["ablation-grid.png", await png(svg)]);
    }
    if (format === "all" || format === "csv")
      entries.push([
        "ablation.csv",
        csv(
          grid.cells.flatMap((cell) =>
            curveRows(cell.result, cell.view).map((row) => ({
              row: cell.rowLabel,
              column: cell.columnLabel,
              ...row,
            })),
          ),
        ),
      ]);
  }
  for (const [index, chart] of charts.entries()) {
    const { metric, result, view: chartView } = chart;
    const folder =
      (grid ? "cells/" : "charts/") +
      String(index + 1).padStart(2, "0") +
      "-" +
      metric.id.replace(/[^a-zA-Z0-9_-]+/g, "-") +
      "/";
    const meta = JSON.stringify({
      datasetSha256: reproduction.datasetSha256,
      view: v,
      metricId: metric.id,
      row: chart.rowLabel,
      column: chart.columnLabel,
    });
    const svg = reportSVG(result, chartView, metric, meta);
    if (format === "all" || format === "svg")
      entries.push([folder + "learning-curves.svg", svg]);
    if (format === "all" || format === "png") {
      if (typeof png !== "function")
        throw Error("PNG export requires browser Canvas");
      entries.push([folder + "learning-curves.png", await png(svg)]);
    }
    if (format === "all" || format === "pdf")
      entries.push([
        folder + "learning-curves.pdf",
        pdf(result, chartView, metric, meta),
      ]);
    if (format === "all" || format === "csv")
      entries.push(
        [folder + "summary.csv", csv(summaryRows(result))],
        [folder + "curves.csv", csv(curveRows(result, chartView))],
      );
    if (
      (format === "all" || format === "latex") &&
      v.workspaceMode === "tables" &&
      v.tableKind === "curves"
    )
      entries.push([folder + "curves.tex", curvesLatex(result, metric)]);
    if (format === "all" || format === "latex")
      entries.push([folder + "summary.tex", latex(result, metric, chartView)]);
  }
  return { entries, reproduction };
}
