import { workspaceCharts } from "../core/workspace.mjs";
import { ablationGrid } from "../panels/ablation-grid.mjs";

/** Derived analysis snapshot shared by templates and Plotly; never persisted. */
export function analysisState(dataset, view) {
  const grid =
    view.workspaceMode === "ablation" ? ablationGrid(dataset, view) : null;
  const charts = grid ? grid.cells : workspaceCharts(dataset, view);
  return {
    grid,
    charts,
    chartResults: new Map(
      charts.map((chart) => [chart.key ?? chart.metric.id, chart]),
    ),
  };
}
