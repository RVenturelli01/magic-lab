import { tableHTML } from "../../core/table-figure.mjs";
import { bandLabel } from "../../core/uncertainty.mjs";
import { workspaceTable } from "../../core/workspace.mjs";
import { analysisState } from "../analysis-state.mjs";
import { fieldLabel } from "../../core/filters.mjs";
import { COLORS } from "../../core/text.mjs";
import { xml as esc } from "../../core/text.mjs";

import { exportMenu, workspaceToolbar } from "./menus.mjs";
import { chartPreview } from "./export-preview.mjs";
export function chartCard(state, chart) {
  const { metric: m, result: r } = chart,
    key = chart.key ?? m.id,
    chartView = chart.view;
  const movable = state.view.workspaceMode === "charts";
  const title =
    "<h2" +
    (movable
      ? ' class="chart-drag" draggable="true" tabindex="0" data-chart-drag="' +
        esc(m.id) +
        '" title="Drag title to reorder; use arrow keys"'
      : "") +
    ">" +
    esc(m.phase + " · " + m.label + (m.xMetric ? " vs " + m.xUnit : "")) +
    "</h2>";
  const handle = ["charts", "ablation"].includes(state.view.workspaceMode)
    ? '<button class="chart-resize" data-chart-resize="' +
      esc(key) +
      '" aria-label="Resize all charts" title="Drag to resize all charts · arrow keys">◢</button>'
    : "";
  return (
    '<section class="card chart-card" tabindex="0" data-chart-metric="' +
    esc(key) +
    '">' +
    (state.view.workspaceMode === "ablation"
      ? ""
      : '<div class="cardhead">' + title + exportMenu(state, m.id) + "</div>") +
    (state.view.displayMode === "latex"
      ? '<div class="chart">' + chartPreview(key, m.label) + "</div>"
      : '<div class="chart"><div class="chart-plot" role="img" aria-label="' +
        esc(m.label + " by " + m.xUnit) +
        '"></div></div><div class="legend" ' +
        (state.view.paper.enabled ? "hidden" : "") +
        ">" +
        r.groups
          .map(
            (g, i) =>
              '<button class="legend-series" data-plot-series="' +
              i +
              '" aria-pressed="true"><i class="swatch" style="background:' +
              COLORS[(g.colorIndex ?? i) % COLORS.length] +
              '"></i>' +
              esc(
                (g.name ?? g.runs[0].name ?? g.algorithm) +
                  (chartView.chartSeries === "runs"
                    ? " · seed " + g.runs[0].seed
                    : ""),
              ) +
              "</button>",
          )
          .join("") +
        "</div>" +
        (chartView.chartSeries !== "runs"
          ? '<div class="chartnote">Mean · ' +
            esc(bandLabel(chartView.band)) +
            "</div>"
          : "")) +
    handle +
    "</section>"
  );
}
export function tablesPanel(state) {
  const table = workspaceTable(state.dataset, state.view);
  return (
    '<section class="card comparison-table"><div class="tablewrap">' +
    tableHTML(table, state.view.paper) +
    "</div>" +
    (!table.rows.length ? '<div class="empty">No selected runs</div>' : "") +
    '<div class="chartnote">Last visible step · sample SD (n−1) · — = missing or undefined</div></section>'
  );
}

export function ablationPanel(state, grid) {
  if (!grid.cells.length)
    return '<div class="card empty">No selected runs</div>';
  return (
    '<div class="ablation-matrix"><table><thead><tr><th></th>' +
    grid.columns
      .map(
        (column) =>
          '<th scope="col">' +
          esc(
            (state.view.ablationColumn
              ? fieldLabel(state.view.ablationColumn) + " = "
              : "") + column.label,
          ) +
          "</th>",
      )
      .join("") +
    "</tr></thead><tbody>" +
    grid.rows
      .map(
        (row, r) =>
          '<tr><th scope="row" class="matrix-row-label"><span>' +
          esc(
            (state.view.ablationRow
              ? fieldLabel(state.view.ablationRow) + " = "
              : "") + row.label,
          ) +
          "</span></th>" +
          grid.columns
            .map(
              (column, c) =>
                "<td>" +
                chartCard(state, grid.cells[r * grid.columns.length + c]) +
                "</td>",
            )
            .join("") +
          "</tr>",
      )
      .join("") +
    "</tbody></table></div>"
  );
}
export function workspace(
  state,
  analysis = analysisState(state.dataset, state.view),
) {
  const mode = state.view.workspaceMode ?? "charts";
  const { charts, grid, chartResults } = analysis;
  state = { ...state, chartResults };
  const panels =
    mode === "ablation"
      ? ablationPanel(state, grid)
      : mode === "tables"
        ? charts.length
          ? tablesPanel(state)
          : '<div class="card empty">No metrics selected</div>'
        : charts.length
          ? charts.map((chart) => chartCard(state, chart)).join("")
          : '<div class="card empty">No metrics selected</div>';
  return (
    '<div class="analysis-workspace">' +
    workspaceToolbar(state) +
    '<div class="workspace-content"><div class="chart-grid ' +
    (state.view.paper.enabled ? "paper-deck " : "") +
    (mode === "charts" ? "plot-deck" : "") +
    '" style="--chart-width:' +
    state.view.chartSize.width +
    "px;--chart-height:" +
    state.view.chartSize.height +
    'px">' +
    panels +
    "</div></div></div>"
  );
}
