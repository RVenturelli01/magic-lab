import {
  canonical,
  fieldValue,
  fieldLabel,
  valueKey,
  valueLabel,
  filterFields,
  fieldOptions,
} from "./filters.mjs";

export const hasGrouping = (view) =>
  view.runGrouping === "configuration" ||
  view.runGrouping === "seed" ||
  view.runGrouping?.startsWith("/");
export function groupingOptions(runs, fields = filterFields(runs)) {
  return [
    ["none", "None"],
    ["configuration", "Seeds"],
    ...fields
      .filter((f) => !["/id", "/seed"].includes(f.field))
      .map((f) => [f.field, f.label]),
  ];
}
export function runGroupKey(run, view) {
  if (view.runGrouping?.startsWith("/"))
    return canonical([
      view.runGrouping,
      valueKey(fieldValue(run, view.runGrouping)),
    ]);
  if (view.runGrouping === "configuration" || view.runGrouping === "seed")
    return canonical([
      run.name ?? null,
      run.algorithm,
      run.environment,
      run.config,
      run.code,
    ]);
  return canonical(["run", run.id]);
}
export function groupingLabels(runs, view) {
  return new Map(
    view.runGrouping?.startsWith("/")
      ? fieldOptions(runs, view.runGrouping).map((o) => [o.key, o.label])
      : [],
  );
}
export function runGroupName(run, view, labels = new Map()) {
  if (view.runGrouping?.startsWith("/"))
    return (
      fieldLabel(view.runGrouping) +
      " = " +
      (labels.get(valueKey(fieldValue(run, view.runGrouping))) ??
        valueLabel(fieldValue(run, view.runGrouping)))
    );
  return run.name ?? null;
}
export function groupRuns(runs, view, scope = runs) {
  const groups = new Map(),
    labels = groupingLabels(scope, view);
  for (const run of runs) {
    const key = runGroupKey(run, view);
    if (!groups.has(key))
      groups.set(key, { key, name: runGroupName(run, view, labels), runs: [] });
    groups.get(key).runs.push(run);
  }
  return [...groups.values()].map((g) => ({
    ...g,
    runs: g.runs.sort((a, b) => a.seed - b.seed || a.id.localeCompare(b.id)),
  }));
}
export const seriesMode = (view) =>
  view.runGrouping?.startsWith("/")
    ? "group-mean"
    : hasGrouping(view)
      ? "seed-mean"
      : view.chartSeries;
