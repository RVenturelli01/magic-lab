import { plotAxes, plotMetric } from "./plot-axes.mjs";
import { scientificTableLatex } from "./table-figure.mjs";
import {
  hasGrouping,
  runGroupKey,
  runGroupName,
  seriesMode,
  groupingLabels,
} from "./run-grouping.mjs";
import { groupKey } from "./run-identity.mjs";
import { aggregate, selectedRuns, smooth } from "./analysis.mjs";
import { indexObservations, runObservations } from "./observations.mjs";
export function plotResult(
  dataset,
  view,
  observations = indexObservations(dataset.points),
) {
  if (view.xMetric) {
    const points = [];
    for (const run of selectedRuns(dataset, view)) {
      const x = new Map(
        smooth(
          runObservations(observations, view.xMetric, run.id),
          view.window,
        ).map((p) => [p.step, p.value]),
      );
      const y = smooth(
        runObservations(observations, view.metric, run.id),
        view.window,
      );
      for (const point of y)
        if (x.has(point.step)) {
          points.push({
            runId: run.id,
            metricId: "__pair_y",
            step: point.step,
            value: point.value,
          });
          points.push({
            runId: run.id,
            metricId: "__pair_x",
            step: point.step,
            value: x.get(point.step),
          });
        }
    }
    const paired = { ...dataset, points },
      index = indexObservations(points);
    const options = { ...view, xMetric: "", window: 1 };
    const y = plotResult(paired, { ...options, metric: "__pair_y" }, index);
    const x = plotResult(paired, { ...options, metric: "__pair_x" }, index);
    const xGroups = new Map(
      x.groups.map((group) => [
        group.key,
        new Map(group.points.map((p) => [p.step, p.mean])),
      ]),
    );
    y.groups = y.groups.map((group) => ({
      ...group,
      points: group.points.flatMap((point) => {
        const value = xGroups.get(group.key)?.get(point.step);
        return value === undefined
          ? []
          : [{ ...point, sourceStep: point.step, step: value }];
      }),
    }));
    return y;
  }
  if (
    hasGrouping(view) ||
    ["seed-mean", "group-mean"].includes(view.chartSeries)
  ) {
    const labels = groupingLabels(dataset.runs, view);
    const grouping = hasGrouping(view)
      ? {
          groupBy: (r) => runGroupKey(r, view),
          nameFor: (r) => runGroupName(r, view, labels),
        }
      : {};
    const result = aggregate(dataset, view, { ...grouping, observations }),
      keys = [
        ...new Set(
          dataset.runs.map((r) =>
            hasGrouping(view) ? runGroupKey(r, view) : groupKey(r),
          ),
        ),
      ];
    result.groups = result.groups.map((g) => ({
      ...g,
      name: g.name ?? g.runs[0].name ?? g.algorithm,
      colorIndex: keys.indexOf(g.key),
    }));
    return result;
  }
  const chosen = selectedRuns(dataset, view),
    eligible = chosen.filter(
      (run) => view.incomplete === "include" || run.status === "completed",
    );
  const colors = new Map(dataset.runs.map((run, index) => [run.id, index]));
  const groups = eligible.map((run) => {
    const points = smooth(
      runObservations(observations, view.metric, run.id),
      view.window,
    )
      .filter(
        (p) =>
          (view.minStep === "" || p.step >= Number(view.minStep)) &&
          (view.maxStep === "" || p.step <= Number(view.maxStep)),
      )
      .map((p) => ({ step: p.step, mean: p.value, sd: null, n: 1 }));
    return {
      key: run.id,
      colorIndex: colors.get(run.id),
      name: run.name ?? run.id,
      algorithm: run.algorithm,
      environment: run.environment,
      config: run.config,
      code: run.code,
      runs: [run],
      points,
      missing: points.length ? [] : [run.id],
    };
  });
  return {
    groups,
    selected: chosen.length,
    eligible: eligible.length,
    excluded: chosen.length - eligible.length,
  };
}
export function workspaceCharts(dataset, view) {
  const observations = indexObservations(dataset.points);
  return (view.charts ?? [view.metric]).flatMap((id) => {
    const metric = plotMetric(dataset, view, id);
    if (!metric) return [];
    const chartView = {
      ...view,
      metric: plotAxes(view, id).y,
      plotId: id,
      xMetric: plotAxes(view, id).x,
      chartSeries: seriesMode(view),
    };
    return [
      {
        key: id,
        metric,
        view: chartView,
        result: plotResult(dataset, chartView, observations),
      },
    ];
  });
}
export function workspaceTable(dataset, view) {
  const observations = indexObservations(dataset.points);
  const colorKeys = [
    ...new Set(
      dataset.runs.map((r) =>
        hasGrouping(view) ? runGroupKey(r, view) : groupKey(r),
      ),
    ),
  ];
  const charts = [
      ...new Set(
        (view.charts ?? [view.metric]).map((id) => plotAxes(view, id).y),
      ),
    ]
      .map((id) => {
        const metric = dataset.metrics.find((m) => m.id === id);
        return metric
          ? {
              metric,
              result: hasGrouping(view)
                ? plotResult(dataset, { ...view, metric: id }, observations)
                : aggregate(dataset, { ...view, metric: id }, { observations }),
            }
          : null;
      })
      .filter(Boolean),
    rows = new Map();
  for (const chart of charts)
    for (const group of chart.result.groups) {
      if (!rows.has(group.key))
        rows.set(group.key, {
          key: group.key,
          name: group.name ?? group.runs[0].name ?? group.runs[0].id,
          seeds: [...new Set(group.runs.map((r) => r.seed))],
          environment: [...new Set(group.runs.map((r) => r.environment))].join(
            " · ",
          ),
          algorithm: group.algorithm,
          colorIndex: group.colorIndex ?? colorKeys.indexOf(group.key),
          values: {},
        });
      rows.get(group.key).values[chart.metric.id] = group.points.at(-1) ?? null;
    }
  return { metrics: charts.map((c) => c.metric), rows: [...rows.values()] };
}
export function tableRows(table) {
  return table.rows.map((row) => {
    const output = { experiment: row.name, environment: row.environment };
    for (const metric of table.metrics) {
      const p = row.values[metric.id];
      for (const field of ["step", "mean", "sd", "n"])
        output[metric.id + "." + field] = p?.[field] ?? "";
    }
    return output;
  });
}

export const tableLatex = scientificTableLatex;
