import { plotAxes } from "./plot-axes.mjs";
import { normalizePaper } from "./paper-style.mjs";
import { seriesMode } from "./run-grouping.mjs";
import { BANDS } from "./uncertainty.mjs";
import {
  normalizeFilters,
  legacyFilters,
  filterFields,
  ablationFilterFields,
} from "./filters.mjs";
export function defaultView(d, fields = filterFields(d.runs)) {
  const factors = fields.filter((f) => f.field.startsWith("/config/"));
  const ablationField =
    (factors.find((f) => f.options.length > 1) ?? factors[0])?.field ?? "";
  return {
    version: 4,
    name: "Workspace",
    tab: "runs",
    filters: ablationFilterFields(d.runs, fields).map(({ field }) => ({
      field,
      values: [],
    })),
    runGrouping: "none",
    workspaceMode: "charts",
    displayMode: "interactive",
    plotAxes: {},
    ablationXMetric: "",
    chartSeries: "runs",
    chartSize: { width: 560, height: 420 },
    chartRanges: {},
    paper: normalizePaper({ enabled: false }),
    ablationMetric:
      d.metrics.find((m) => m.phase === "evaluation")?.id ??
      d.metrics[0]?.id ??
      "",
    ablationRow: ablationField,
    ablationColumn:
      factors.find((f) => f.field !== ablationField && f.options.length > 1)
        ?.field ?? "",
    tableKind: "summary",
    ablationField,
    ablationBaseline:
      fields.find((f) => f.field === ablationField)?.options[0]?.key ?? "",
    selected: d.runs.map((r) => r.id),
    metric:
      d.metrics.find((m) => m.phase === "evaluation")?.id ||
      d.metrics[0]?.id ||
      "",
    charts: [
      d.metrics.find((m) => m.phase === "evaluation")?.id || d.metrics[0]?.id,
    ].filter(Boolean),
    window: 1,
    incomplete: "exclude",
    alignment: "intersection",
    band: "sd",
    minStep: "",
    maxStep: "",
  };
}

export function normalizeView(input, d, fields = filterFields(d.runs)) {
  const base = defaultView(d, fields);
  if (
    !input ||
    ![1, 2, 3, 4].includes(input.version) ||
    !Array.isArray(input.selected)
  )
    throw Error("Invalid view format");
  if (
    input.runGrouping !== undefined &&
    !(
      typeof input.runGrouping === "string" &&
      (["none", "seed", "configuration"].includes(input.runGrouping) ||
        input.runGrouping.startsWith("/"))
    )
  )
    throw Error("Invalid run grouping");
  const filters = normalizeFilters(
    input.version === 1 ? legacyFilters(input, d.runs) : input.filters,
    d.runs,
  );
  const v = { ...base, ...input, version: 4, filters };
  v.paper = normalizePaper(v.paper);
  if (
    !v.plotAxes ||
    typeof v.plotAxes !== "object" ||
    Array.isArray(v.plotAxes)
  )
    throw Error("Invalid plot axes");
  v.plotAxes = Object.fromEntries(
    Object.entries(v.plotAxes)
      .filter(([id, axes]) => {
        if (!axes || typeof axes.x !== "string" || typeof axes.y !== "string")
          throw Error("Invalid plot axes");
        return (
          d.metrics.some((m) => m.id === axes.y) &&
          (!axes.x || d.metrics.some((m) => m.id === axes.x))
        );
      })
      .map(([id, axes]) => [id, { x: axes.x, y: axes.y }]),
  );
  if (typeof v.ablationXMetric !== "string")
    throw Error("Invalid ablation X metric");
  if (v.ablationXMetric && !d.metrics.some((m) => m.id === v.ablationXMetric))
    v.ablationXMetric = "";
  if (v.displayMode === "svg") v.displayMode = "interactive";
  if (!["interactive", "latex"].includes(v.displayMode))
    throw Error("Invalid display mode");
  if (
    !["charts", "ablation", "tables"].includes(v.workspaceMode) ||
    !["summary", "curves"].includes(v.tableKind)
  )
    throw Error("Invalid Workspace mode");
  const factors = fields.filter((f) => f.field.startsWith("/config/"));
  if (
    typeof v.ablationField !== "string" ||
    typeof v.ablationBaseline !== "string"
  )
    throw Error("Invalid ablation settings");
  if (!factors.some((f) => f.field === v.ablationField))
    v.ablationField = base.ablationField;
  const factorOptions = v.ablationField
    ? (fields.find((f) => f.field === v.ablationField)?.options ?? [])
    : [];
  if (!factorOptions.some((o) => o.key === v.ablationBaseline))
    v.ablationBaseline = factorOptions[0]?.key ?? "";
  if (
    !v.chartSize ||
    !Number.isInteger(v.chartSize.width) ||
    !Number.isInteger(v.chartSize.height) ||
    v.chartSize.width < 320 ||
    v.chartSize.width > 2400 ||
    v.chartSize.height < 280 ||
    v.chartSize.height > 1200
  )
    throw Error("Invalid chart size");
  v.chartSize = { width: v.chartSize.width, height: v.chartSize.height };
  if (
    !v.chartRanges ||
    Array.isArray(v.chartRanges) ||
    typeof v.chartRanges !== "object"
  )
    throw Error("Invalid chart ranges");
  v.chartRanges = Object.fromEntries(
    Object.entries(v.chartRanges)
      .filter(([id]) => d.metrics.some((m) => m.id === plotAxes(v, id).y))
      .map(([id, b]) => {
        if (
          !b ||
          !["xmin", "xmax", "ymin", "ymax"].every((k) =>
            Number.isFinite(b[k]),
          ) ||
          b.xmin >= b.xmax ||
          b.ymin >= b.ymax
        )
          throw Error("Invalid chart range");
        return [
          id,
          Object.fromEntries(
            ["xmin", "xmax", "ymin", "ymax"].map((k) => [k, b[k]]),
          ),
        ];
      }),
  );
  if (!["runs", "seed-mean", "group-mean"].includes(v.chartSeries))
    throw Error("Invalid chart series");
  if (
    typeof v.ablationRow !== "string" ||
    typeof v.ablationColumn !== "string" ||
    typeof v.ablationMetric !== "string"
  )
    throw Error("Invalid grid settings");
  const gridFields = fields.filter(
    (f) => !["/id", "/name", "/seed"].includes(f.field),
  );
  if (v.ablationRow && !gridFields.some((f) => f.field === v.ablationRow))
    v.ablationRow = base.ablationRow;
  if (v.ablationColumn && !gridFields.some((f) => f.field === v.ablationColumn))
    v.ablationColumn = base.ablationColumn;
  if (v.ablationRow && v.ablationRow === v.ablationColumn)
    v.ablationColumn = "";
  if (!d.metrics.some((m) => m.id === v.ablationMetric))
    v.ablationMetric = base.ablationMetric;
  if (v.runGrouping === "seed") v.runGrouping = "configuration";
  if (v.runGrouping.startsWith("/")) {
    if (/~(?![01])/u.test(v.runGrouping)) throw Error("Invalid run grouping");
    if (!fields.some((f) => f.field === v.runGrouping)) {
      v.runGrouping = "none";
      v.chartSeries = "runs";
    }
  }
  v.chartSeries = seriesMode(v);
  delete v.search;
  delete v.algorithm;
  delete v.environment;
  delete v.status;
  v.tab =
    input.tab === "compare"
      ? "workspace"
      : ["runs", "workspace"].includes(input.tab)
        ? input.tab
        : "runs";
  const runIds = new Set(d.runs.map((run) => run.id));
  v.selected = [...new Set(v.selected.filter((id) => runIds.has(id)))];
  if (!d.metrics.some((m) => m.id === v.metric)) v.metric = base.metric;
  if (
    input.charts !== undefined &&
    (!Array.isArray(input.charts) ||
      input.charts.some((id) => typeof id !== "string"))
  )
    throw Error("Invalid chart selection");
  v.charts = [
    ...new Set(
      (input.charts ?? [v.metric]).filter((id) =>
        d.metrics.some((m) => m.id === plotAxes(v, id).y),
      ),
    ),
  ];
  if (v.charts.length && !v.charts.includes(v.metric))
    v.metric = plotAxes(v, v.charts[0]).y;
  if (
    !["exclude", "include"].includes(v.incomplete) ||
    !["intersection", "available"].includes(v.alignment) ||
    !BANDS.includes(v.band) ||
    !Number.isInteger(v.window) ||
    v.window < 1 ||
    v.window > 50
  )
    throw Error("Invalid statistics settings");
  for (const k of ["minStep", "maxStep"])
    if (v[k] !== "" && (!Number.isFinite(Number(v[k])) || Number(v[k]) < 0))
      throw Error("Invalid axis range");
  if (
    v.minStep !== "" &&
    v.maxStep !== "" &&
    Number(v.minStep) > Number(v.maxStep)
  )
    throw Error("Invalid axis range");
  for (const k of ["name", "tab"])
    if (typeof v[k] !== "string") throw Error("Invalid view field");
  return v;
}
