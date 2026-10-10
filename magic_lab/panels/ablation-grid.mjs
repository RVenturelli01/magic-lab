import { paperChart } from "../core/paper-style.mjs";
import { seriesMode } from "../core/run-grouping.mjs";
import { selectedRuns } from "../core/analysis.mjs";
import { plotResult } from "../core/workspace.mjs";
import { indexObservations } from "../core/observations.mjs";
import {
  fieldOptions,
  fieldValue,
  valueKey,
  fieldLabel,
} from "../core/filters.mjs";
import { geometry } from "../core/chart-geometry.mjs";
import { chartSVG } from "../core/report-svg.mjs";
import { xml, COLORS } from "../core/text.mjs";
export function ablationGrid(dataset, view) {
  const observations = indexObservations(dataset.points);
  const sourceMetric = dataset.metrics.find(
    (m) => m.id === view.ablationMetric,
  );
  const xMetric = dataset.metrics.find((m) => m.id === view.ablationXMetric);
  const metric =
    sourceMetric &&
    (xMetric
      ? {
          ...sourceMetric,
          xUnit: xMetric.label + " (" + xMetric.unit + ")",
          xMetric: xMetric.id,
        }
      : sourceMetric);
  if (!metric) return { metric: null, rows: [], columns: [], cells: [] };
  const runs = selectedRuns(dataset, view);
  const options = (field) =>
    field ? fieldOptions(runs, field) : [{ key: "all", label: "All" }];
  const rows = options(view.ablationRow),
    columns = options(view.ablationColumn);
  const baseView = {
    ...view,
    metric: metric.id,
    xMetric: view.ablationXMetric ?? "",
    chartSeries: seriesMode(view),
  };
  const result = plotResult(dataset, baseView, observations),
    bounds = baseView.paper?.enabled
      ? paperChart({
          metric,
          result,
          view: {
            ...baseView,
            paper: { ...baseView.paper, metrics: {} },
            chartRanges: {},
            plotBounds: undefined,
          },
        }).bounds
      : geometry(result, { ...baseView, chartRanges: {} });
  const plotBounds = {
    xmin: bounds.xmin,
    xmax: bounds.xmax,
    ymin: bounds.ymin,
    ymax: bounds.ymax,
  };
  const cells = rows.flatMap((row, r) =>
    columns.map((column, c) => {
      const ids = runs
        .filter(
          (run) =>
            (!view.ablationRow ||
              valueKey(fieldValue(run, view.ablationRow)) === row.key) &&
            (!view.ablationColumn ||
              valueKey(fieldValue(run, view.ablationColumn)) === column.key),
        )
        .map((run) => run.id);
      const cellView = { ...baseView, selected: ids, plotBounds };
      return {
        key: "cell-" + r + "-" + c,
        legendKey: JSON.stringify([
          "ablation",
          metric.id,
          view.ablationRow,
          row.key,
          view.ablationColumn,
          column.key,
        ]),
        row: r,
        column: c,
        rowLabel: row.label,
        columnLabel: column.label,
        metric,
        view: cellView,
        result: plotResult(dataset, cellView, observations),
      };
    }),
  );
  return {
    metric,
    rowField: view.ablationRow,
    columnField: view.ablationColumn,
    rows,
    columns,
    cells,
  };
}
export function ablationGridSVG(grid, metadata = "") {
  const cellHeight =
    260 +
    Math.ceil(
      Math.max(0, ...grid.cells.map((c) => c.result.groups.length)) / 3,
    ) *
      12;
  const W = grid.columns.length * 600 + 120,
    H = grid.rows.length * cellHeight + 80;
  const parts = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      W +
      '" height="' +
      H +
      '" viewBox="0 0 ' +
      W +
      " " +
      H +
      '"><metadata>' +
      xml(metadata) +
      '</metadata><rect width="100%" height="100%" fill="white"/>',
  ];
  grid.columns.forEach((column, c) =>
    parts.push(
      '<text x="' +
        (120 + c * 600 + 300) +
        '" y="28" text-anchor="middle" font-family="Arial" font-size="14">' +
        xml(
          (grid.columnField ? fieldLabel(grid.columnField) + " = " : "") +
            column.label,
        ) +
        "</text>",
    ),
  );
  grid.rows.forEach((row, r) =>
    parts.push(
      '<text transform="translate(60 ' +
        (60 + r * cellHeight + cellHeight / 2) +
        ') rotate(-90)" text-anchor="middle" font-family="Arial" font-size="12">' +
        xml(
          (grid.rowField ? fieldLabel(grid.rowField) + " = " : "") + row.label,
        ) +
        "</text>",
    ),
  );
  for (const cell of grid.cells) {
    parts.push(
      chartSVG(
        cell.result,
        {
          ...cell.view,
          viewport: { width: 600, height: 240 },
          plotId: cell.key,
        },
        cell.metric,
      ).replace(
        'width="600" height="240"',
        'x="' +
          (120 + cell.column * 600) +
          '" y="' +
          (60 + cell.row * cellHeight) +
          '" width="600" height="240"',
      ),
    );
    cell.result.groups.forEach((group, i) => {
      parts.push(
        '<text x="' +
          (120 + cell.column * 600 + (i % 3) * 195) +
          '" y="' +
          (60 + cell.row * cellHeight + 253 + Math.floor(i / 3) * 12) +
          '" font-family="Arial" font-size="9" fill="' +
          COLORS[(group.colorIndex ?? i) % COLORS.length] +
          '">' +
          xml(
            (group.name ?? group.algorithm) +
              (cell.view.chartSeries === "runs"
                ? " · seed " + group.runs[0].seed
                : ""),
          ) +
          "</text>",
      );
    });
  }
  for (let c = 0; c <= grid.columns.length; c++)
    parts.push(
      '<path d="M ' +
        (120 + c * 600) +
        " 0 V " +
        (60 + grid.rows.length * cellHeight) +
        '" stroke="#839296" fill="none"/>',
    );
  for (let r = 0; r <= grid.rows.length; r++)
    parts.push(
      '<path d="M 0 ' +
        (60 + r * cellHeight) +
        " H " +
        W +
        '" stroke="#839296" fill="none"/>',
    );
  return parts.join("") + "</svg>";
}
