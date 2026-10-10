import { fieldValue, valueKey, legacyFilters } from "./filters.mjs";
import { groupKey } from "./run-identity.mjs";
import { indexObservations, runObservations } from "./observations.mjs";
export function filterRuns(runs, v) {
  const filters = v.filters ?? legacyFilters(v, runs);
  const active = filters
    .filter((rule) => rule.values.length)
    .map((rule) => ({
      field: rule.field,
      values: new Set(rule.values),
    }));
  return runs.filter((run) =>
    active.every((rule) =>
      rule.values.has(valueKey(fieldValue(run, rule.field))),
    ),
  );
}
export function selectedRuns(d, v) {
  const selected = new Set(v.selected);
  return filterRuns(d.runs, v).filter((r) => selected.has(r.id));
}
export function smooth(points, window) {
  let sum = 0;
  return points.map((p, i) => {
    sum += p.value;
    if (i >= window) sum -= points[i - window].value;
    return { ...p, value: sum / Math.min(i + 1, window) };
  });
}
export function summarize(values) {
  const n = values.length,
    mean = n ? values.reduce((a, b) => a + b, 0) / n : null;
  return {
    n,
    mean,
    sd:
      n > 1
        ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1))
        : null,
  };
}
export function aggregate(
  d,
  v,
  {
    groupBy = groupKey,
    nameFor = () => undefined,
    observations = indexObservations(d.points),
  } = {},
) {
  const chosen = selectedRuns(d, v),
    eligible = chosen.filter(
      (r) => v.incomplete === "include" || r.status === "completed",
    ),
    groups = new Map();
  for (const r of eligible) {
    const key = groupBy(r);
    if (!groups.has(key))
      groups.set(key, {
        key,
        name: nameFor(r),
        algorithm: r.algorithm,
        environment: r.environment,
        config: r.config,
        code: r.code,
        runs: [],
      });
    groups.get(key).runs.push(r);
  }
  const output = [];
  for (const g of groups.values()) {
    const series = g.runs.map((r) =>
      smooth(runObservations(observations, v.metric, r.id), v.window),
    );
    const steps = [
        ...new Set(series.flatMap((s) => s.map((p) => p.step))),
      ].sort((a, b) => a - b),
      maps = series.map((s) => new Map(s.map((p) => [p.step, p.value])));
    const points = steps
      .filter(
        (step) =>
          (v.minStep === "" || step >= Number(v.minStep)) &&
          (v.maxStep === "" || step <= Number(v.maxStep)),
      )
      .flatMap((step) => {
        const values = maps.filter((m) => m.has(step)).map((m) => m.get(step));
        if (v.alignment === "intersection" && values.length !== series.length)
          return [];
        return [{ step, ...summarize(values) }];
      });
    const unique = (field) => [
      ...new Map(
        g.runs.map((run) => [JSON.stringify(run[field]), run[field]]),
      ).values(),
    ];
    const configs = unique("config"),
      codes = unique("code");
    output.push({
      ...g,
      algorithm: unique("algorithm").join(" · "),
      environment: unique("environment").join(" · "),
      config:
        configs.length === 1 ? configs[0] : { groupedConfigurations: configs },
      code:
        codes.length === 1
          ? codes[0]
          : {
              commit: [...new Set(codes.map((c) => c.commit))].join(" · "),
              dirty: codes.some((c) => c.dirty),
            },
      points,
      missing: g.runs.filter((r, i) => !series[i].length).map((r) => r.id),
    });
  }
  return {
    groups: output,
    selected: chosen.length,
    excluded: chosen.length - eligible.length,
    eligible: eligible.length,
  };
}
export function summaryRows(result) {
  return result.groups.map((g, index) => {
    const p = g.points.at(-1);
    return {
      group: "G" + (index + 1),
      algorithm: g.algorithm,
      environment: g.environment,
      configuration: JSON.stringify(g.config),
      commit: g.code.commit,
      dirty: g.code.dirty,
      seeds: g.runs.map((r) => r.seed).join(";"),
      step: p?.step ?? "",
      mean: p?.mean ?? "",
      sd: p?.sd ?? "",
      n: p?.n ?? 0,
    };
  });
}
