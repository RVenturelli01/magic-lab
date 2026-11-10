import type { MetricPoint, Run } from "./types";
import { compileExpression, expressionError } from "./chart-expression.ts";
import { configValue } from "./config.ts";
import { extent, mean, sampleDeviation } from "./statistics.ts";

export type Series = { id: string; name: string; color: string; runs: Run[] };
const OVERLAY_COLORS = [
  "#267fc0",
  "#df7138",
  "#8b63be",
  "#31a47d",
  "#c8598b",
  "#bb8d20",
];
export type AxisRange = [number, number];
export type ChartSettings = {
  title: string;
  metrics: string[];
  xAxis: string;
  xFormat: "number" | "scientific" | "duration";
  xLabel: string;
  yLabel: string;
  xScale: "linear" | "log";
  yScale: "linear" | "log";
  xMin: string;
  xMax: string;
  yMin: string;
  yMax: string;
  smoothing: number | null;
  smoothingMethod: "none" | "ema" | "twema" | "moving-average" | "gaussian";
  aggregate: "mean" | "median" | "min" | "max";
  band: "range" | "stddev" | "stderr" | "none";
  groupRuns: boolean;
  showRaw: boolean;
  showGrid: boolean;
  showPoints: boolean;
  connectMissing: boolean;
  lineWidth: number;
  legend: "top" | "bottom" | "left" | "right" | "none";
  legendValue: "last" | "min" | "max" | "none";
  seriesLabels: Record<string, string>;
  seriesStyles: Record<string, { color?: string; width?: number }>;
  fontSize: "auto" | "small" | "medium" | "large";
  chartType: "line" | "area" | "percent-area";
  maxSeries: number;
  ignoreOutliers: boolean;
  pointAggregation: "full" | "sample";
  xExpression: string;
  expressions: { name: string; formula: string }[];
  tooltip: "hover" | "click";
};

export function defaultChartSettings(metric: string): ChartSettings {
  return {
    title: "",
    metrics: [metric],
    xAxis: "step",
    xFormat: "number",
    xLabel: "",
    yLabel: "",
    xScale: "linear",
    yScale: "linear",
    xMin: "",
    xMax: "",
    yMin: "",
    yMax: "",
    smoothing: null,
    smoothingMethod: "ema",
    aggregate: "mean",
    band: "range",
    groupRuns: true,
    showRaw: false,
    showGrid: true,
    showPoints: false,
    connectMissing: false,
    lineWidth: 1.2,
    legend: "top",
    legendValue: "none",
    seriesLabels: {},
    seriesStyles: {},
    fontSize: "auto",
    chartType: "line",
    maxSeries: 0,
    ignoreOutliers: false,
    pointAggregation: "full",
    xExpression: "",
    expressions: [],
    tooltip: "hover",
  };
}

/** Storage is untrusted: restore only supported fields and valid values. */
export function restoreChartSettings(
  metric: string,
  input: unknown,
): ChartSettings {
  const settings = defaultChartSettings(metric);
  if (!input || typeof input !== "object" || Array.isArray(input))
    return settings;
  const saved = input as Record<string, unknown>;
  for (const key of [
    "title",
    "xAxis",
    "xLabel",
    "yLabel",
    "xMin",
    "xMax",
    "yMin",
    "yMax",
    "xExpression",
  ] as const)
    if (typeof saved[key] === "string") settings[key] = saved[key];
  for (const key of [
    "groupRuns",
    "showRaw",
    "showGrid",
    "showPoints",
    "connectMissing",
    "ignoreOutliers",
  ] as const)
    if (typeof saved[key] === "boolean") settings[key] = saved[key];
  const choices = {
    xScale: ["linear", "log"],
    xFormat: ["number", "scientific", "duration"],
    yScale: ["linear", "log"],
    smoothingMethod: ["none", "ema", "twema", "moving-average", "gaussian"],
    aggregate: ["mean", "median", "min", "max"],
    band: ["range", "stddev", "stderr", "none"],
    legend: ["top", "bottom", "left", "right", "none"],
    legendValue: ["last", "min", "max", "none"],
    tooltip: ["hover", "click"],
    fontSize: ["auto", "small", "medium", "large"],
    chartType: ["line", "area", "percent-area"],
    pointAggregation: ["full", "sample"],
  };
  for (const key of Object.keys(choices) as (keyof typeof choices)[])
    if (
      typeof saved[key] === "string" &&
      choices[key].includes(saved[key] as never)
    )
      Object.assign(settings, { [key]: saved[key] });
  if (
    Array.isArray(saved.metrics) &&
    saved.metrics.every((key) => typeof key === "string")
  )
    settings.metrics = [...new Set(saved.metrics)];
  if (
    typeof saved.smoothing === "number" &&
    Number.isFinite(saved.smoothing) &&
    saved.smoothing >= 0 &&
    saved.smoothing <= 0.99
  )
    settings.smoothing = saved.smoothing;
  if (
    typeof saved.lineWidth === "number" &&
    saved.lineWidth >= 1 &&
    saved.lineWidth <= 4
  )
    settings.lineWidth = saved.lineWidth;
  if (
    typeof saved.maxSeries === "number" &&
    Number.isInteger(saved.maxSeries) &&
    saved.maxSeries >= 0 &&
    saved.maxSeries <= 1000
  )
    settings.maxSeries = saved.maxSeries;
  if (Array.isArray(saved.expressions))
    settings.expressions = saved.expressions
      .filter(
        (value): value is { name: string; formula: string } =>
          value &&
          typeof value.name === "string" &&
          typeof value.formula === "string" &&
          value.formula.trim() &&
          !expressionError(value.formula),
      )
      .slice(0, 10);
  if (expressionError(settings.xExpression)) settings.xExpression = "";
  if (
    saved.seriesLabels &&
    typeof saved.seriesLabels === "object" &&
    !Array.isArray(saved.seriesLabels)
  ) {
    settings.seriesLabels = Object.fromEntries(
      Object.entries(saved.seriesLabels)
        .filter(([, value]) => typeof value === "string" && value.length <= 500)
        .slice(0, 200),
    ) as Record<string, string>;
  }
  if (
    saved.seriesStyles &&
    typeof saved.seriesStyles === "object" &&
    !Array.isArray(saved.seriesStyles)
  ) {
    for (const [key, value] of Object.entries(saved.seriesStyles).slice(
      0,
      200,
    )) {
      if (!value || typeof value !== "object") continue;
      const style = value as Record<string, unknown>;
      settings.seriesStyles[key] = {
        color:
          typeof style.color === "string" && /^#[0-9a-f]{6}$/i.test(style.color)
            ? style.color
            : undefined,
        width:
          typeof style.width === "number" &&
          style.width >= 1 &&
          style.width <= 4
            ? style.width
            : undefined,
      };
    }
  }
  if (!settings.metrics.length && !settings.expressions.length)
    settings.metrics = [metric];
  return settings;
}

export function compact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  if (Math.abs(value) >= 1e6) return `${+(value / 1e6).toPrecision(4)}M`;
  if (Math.abs(value) >= 1e3) return `${+(value / 1e3).toPrecision(4)}k`;
  return String(+value.toPrecision(4));
}

export type PlotRow = { x: number; [key: string]: number | number[] | null };
export type PlotSeries = {
  id: string;
  runIds: string[];
  key: string;
  name: string;
  color: string;
  metric: string;
  metricIndex: number;
  runCount: number;
  last: number | undefined;
  min: number | undefined;
  max: number | undefined;
  lastX: number;
  lastLow: number;
  lastHigh: number;
};

export function legendLabel(line: PlotSeries, settings: ChartSettings): string {
  const template = settings.seriesLabels[line.id];
  if (!template) return line.name;
  const variables: Record<string, string> = {
    name: line.name,
    metric: line.metric,
    x: compact(line.lastX),
    mean: compact(line.last ?? NaN),
    last: compact(line.last ?? NaN),
    min: compact(line.lastLow),
    max: compact(line.lastHigh),
    runs: String(line.runCount),
  };
  return template.replace(
    /\$\{(name|metric|x|mean|last|min|max|runs)\}/g,
    (_, key: string) => variables[key],
  );
}

function smooth(
  values: number[],
  xs: number[],
  weight: number,
  method: ChartSettings["smoothingMethod"],
): number[] {
  if (!weight || method === "none") return values;
  if (method === "moving-average") {
    const window = Math.max(1, Math.round(1 / (1 - weight)));
    let sum = 0;
    return values.map((value, index) => {
      sum += value;
      if (index >= window) sum -= values[index - window];
      return sum / Math.min(index + 1, window);
    });
  }
  if (method === "gaussian") {
    const sigma = Math.max(0.5, weight * 10);
    const radius = Math.ceil(sigma * 3);
    return values.map((_, index) => {
      let total = 0,
        weights = 0;
      for (
        let j = Math.max(0, index - radius);
        j <= Math.min(values.length - 1, index + radius);
        j++
      ) {
        const influence = Math.exp(-0.5 * ((index - j) / sigma) ** 2);
        total += values[j] * influence;
        weights += influence;
      }
      return total / weights;
    });
  }
  let previous = values[0];
  const averageInterval =
    (xs.at(-1)! - xs[0]) / Math.max(1, xs.length - 1) || 1;
  return values.map((value, index) => {
    const decay =
      method === "twema" && index
        ? weight ** ((xs[index] - xs[index - 1]) / averageInterval)
        : weight;
    return (previous = previous * decay + value * (1 - decay));
  });
}

/** Exact X alignment; absent/nonfinite observations are never replaced with zero. */
export function buildChartData(
  series: Series[],
  histories: Record<string, MetricPoint[]>,
  settings: ChartSettings,
  globalSmoothing = 0,
): { data: PlotRow[]; lines: PlotSeries[] } {
  const allGroups = settings.groupRuns
    ? series
    : series.flatMap((group) =>
        group.runs.map((run) => ({
          id: run.id,
          name: run.name,
          color: run.color,
          runs: [run],
        })),
      );
  const groups = settings.maxSeries
    ? allGroups.slice(0, settings.maxSeries)
    : allGroups;
  const rows = new Map<number, PlotRow>();
  const lines: PlotSeries[] = [];
  const weight = settings.smoothing ?? globalSmoothing;
  const extra = settings.expressions.map((value, index) => ({
    key: `expression:${index}`,
    name: value.name || value.formula,
    formula: compileExpression(value.formula),
  }));
  const xFormula = settings.xExpression.trim()
    ? compileExpression(settings.xExpression)
    : undefined;
  const metrics = [
    ...settings.metrics.map((key) => ({
      key,
      name: key,
      formula: undefined as ReturnType<typeof compileExpression> | undefined,
    })),
    ...extra,
  ];
  for (const group of groups)
    for (const [metricIndex, metric] of metrics.entries()) {
      const steps = new Map<number, number[]>();
      for (const run of group.runs) {
        // Step/metric plots do not need to parse timestamps for every sample.
        const createdAt =
          settings.xAxis === "runtime" || xFormula || metric.formula
            ? Date.parse(run.createdAt)
            : 0;
        for (const point of histories[run.id] ?? []) {
          const runtime = () =>
            (Date.parse(point.timestamp) - createdAt) / 1000;
          const baseX =
            settings.xAxis === "timestamp"
              ? Date.parse(point.timestamp)
              : settings.xAxis === "runtime"
                ? runtime()
                : settings.xAxis.startsWith("metric:")
                  ? point.values[settings.xAxis.slice(7)]
                  : point.step;
          const resolve = (name: string): number => {
            if (name === "x") return baseX;
            if (name === "y") return point.values[settings.metrics[0]];
            if (name === "_step") return point.step;
            if (name === "_runtime" || name === "_absolute_runtime")
              return runtime();
            if (name.startsWith("config:")) {
              const value = configValue(run.config, name.slice(7));
              return typeof value === "number" ? value : NaN;
            }
            return point.values[name];
          };
          const value = metric.formula
            ? metric.formula(resolve)
            : point.values[metric.key];
          const x = xFormula ? xFormula(resolve) : baseX;
          if (!Number.isFinite(x) || (settings.xScale === "log" && x <= 0))
            continue;
          // Keep the X position even when this metric is missing, so a gap is drawn.
          if (!rows.has(x)) rows.set(x, { x });
          if (!Number.isFinite(value)) continue;
          const values = steps.get(x);
          if (values) values.push(value);
          else steps.set(x, [value]);
        }
      }
      const entries = [...steps].sort(([a], [b]) => a - b);
      if (!entries.length) continue;
      const raw = entries.map(([, values]) => {
        if (settings.aggregate === "min") return extent(values)[0];
        if (settings.aggregate === "max") return extent(values)[1];
        if (settings.aggregate === "median") {
          const sorted = values.toSorted((a, b) => a - b);
          const middle = Math.floor(sorted.length / 2);
          return sorted.length % 2
            ? sorted[middle]
            : (sorted[middle - 1] + sorted[middle]) / 2;
        }
        return mean(values);
      });
      const values = smooth(
        raw,
        entries.map(([x]) => x),
        weight,
        settings.smoothingMethod,
      );
      const key = `v${lines.length}`; // Opaque keys prevent run IDs/metric names becoming object paths.
      const finite: number[] = [];
      for (const [index, [x, samples]] of entries.entries()) {
        const row = rows.get(x) ?? { x };
        const valid =
          Number.isFinite(values[index]) &&
          (settings.yScale !== "log" || values[index] > 0);
        row[key] = valid ? values[index] : null;
        row[`${key}_raw`] =
          Number.isFinite(raw[index]) &&
          (settings.yScale !== "log" || raw[index] > 0)
            ? raw[index]
            : null;
        if (valid) finite.push(values[index]);
        if (settings.band !== "none" && samples.length > 1) {
          let [low, high] = extent(samples);
          if (settings.band !== "range") {
            const average = mean(samples);
            const spread =
              sampleDeviation(samples, average) /
              (settings.band === "stderr" ? Math.sqrt(samples.length) : 1);
            low = average - spread;
            high = average + spread;
          }
          row[`${key}_range`] =
            !Number.isFinite(low) ||
            !Number.isFinite(high) ||
            (settings.yScale === "log" && low <= 0)
              ? null
              : [low, high];
        }
        rows.set(x, row);
      }
      lines.push({
        id: JSON.stringify([group.id, metric.key]),
        runIds: group.runs.map((run) => run.id),
        key,
        name:
          metrics.length > 1 ? `${group.name} · ${metric.name}` : group.name,
        color:
          settings.seriesStyles[JSON.stringify([group.id, metric.key])]
            ?.color ??
          (groups.length === 1 && metrics.length > 1
            ? OVERLAY_COLORS[metricIndex % OVERLAY_COLORS.length]
            : group.color),
        metric: metric.name,
        metricIndex,
        runCount: group.runs.length,
        lastX: entries.at(-1)![0],
        lastLow: extent(entries.at(-1)![1])[0],
        lastHigh: extent(entries.at(-1)![1])[1],
        last: finite.at(-1),
        min: finite.length
          ? finite.reduce((a, b) => Math.min(a, b))
          : undefined,
        max: finite.length
          ? finite.reduce((a, b) => Math.max(a, b))
          : undefined,
      });
    }
  let data = [...rows.values()].sort((a, b) => a.x - b.x);
  if (settings.pointAggregation === "sample" && data.length > 1000) {
    // Seeded reservoir sampling is repeatable and retains both endpoints.
    const reservoir = data.slice(1, 999);
    let seed = 123456789;
    for (let index = 999; index < data.length - 1; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const candidate = Math.floor((seed / 0x100000000) * index);
      if (candidate < 998) reservoir[candidate] = data[index];
    }
    data = [data[0], ...reservoir, data.at(-1)!].sort((a, b) => a.x - b.x);
  }
  return { data, lines };
}

export function configuredRange(
  min: string,
  max: string,
  scale: "linear" | "log",
  fallback?: AxisRange,
): { range?: AxisRange; error?: string } {
  if (!min.trim() && !max.trim()) return {};
  const hasMin = !!min.trim(),
    hasMax = !!max.trim();
  let low = hasMin ? Number(min) : (fallback?.[0] ?? -Infinity);
  let high = hasMax ? Number(max) : (fallback?.[1] ?? Infinity);
  if (
    (hasMin && !Number.isFinite(low)) ||
    (hasMax && !Number.isFinite(high)) ||
    (hasMin && hasMax && low >= high)
  )
    return { error: "Minimum must be a finite number below maximum." };
  if (scale === "log" && ((hasMin && low <= 0) || (hasMax && high <= 0)))
    return { error: "Logarithmic bounds must be greater than zero." };
  if (!hasMax && high <= low)
    high = scale === "log" ? low * 1.05 : low + (Math.abs(low) * 0.05 || 1);
  if (!hasMin && low >= high)
    low = scale === "log" ? high / 1.05 : high - (Math.abs(high) * 0.05 || 1);
  return Number.isFinite(low) && Number.isFinite(high)
    ? { range: [low, high] }
    : {};
}

export function dataRange(
  data: PlotRow[],
  lines: PlotSeries[],
  axis: "x" | "y",
  log = false,
  ignoreOutliers = false,
): AxisRange {
  let low = Infinity,
    high = -Infinity;
  const values: number[] = [];
  const include = (value: unknown) => {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      (log && value <= 0)
    )
      return;
    low = Math.min(low, value);
    high = Math.max(high, value);
    if (ignoreOutliers) values.push(value);
  };
  for (const row of data) {
    if (axis === "x") include(row.x);
    else
      for (const line of lines) {
        include(row[line.key]);
        const band = row[`${line.key}_range`];
        if (Array.isArray(band)) band.forEach(include);
      }
  }
  if (ignoreOutliers && values.length >= 100) {
    values.sort((a, b) => a - b);
    low = values[Math.floor(values.length * 0.005)];
    high = values[Math.ceil(values.length * 0.995) - 1];
  }
  if (!Number.isFinite(low)) return log ? [1, 10] : [0, 1];
  if (low === high)
    return log
      ? [low / 1.1, high * 1.1]
      : [
          low - (Math.abs(low) * 0.05 || 1),
          high + (Math.abs(high) * 0.05 || 1),
        ];
  if (axis === "x") return [low, high];
  const padding = (high - low) * 0.05;
  if (log) return [low / 1.05, high * 1.05];
  const paddedLow = low >= 0 ? Math.max(0, low - padding) : low - padding;
  const paddedHigh = high + padding;
  const magnitude = 10 ** Math.floor(Math.log10((paddedHigh - paddedLow) / 5));
  const fraction = (paddedHigh - paddedLow) / 5 / magnitude;
  const step =
    (fraction <= 1
      ? 1
      : fraction <= 2
        ? 2
        : fraction <= 2.5
          ? 2.5
          : fraction <= 5
            ? 5
            : 10) * magnitude;
  return [
    Math.floor(paddedLow / step) * step,
    Math.ceil(paddedHigh / step) * step,
  ];
}

export function linearTicks(range: AxisRange, target = 7): number[] {
  const roughStep = (range[1] - range[0]) / target;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const fraction = roughStep / magnitude;
  const step =
    (fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10) * magnitude;
  if (!Number.isFinite(step) || step <= 0) return [];
  const first = Math.ceil(range[0] / step);
  const last = Math.floor(range[1] / step);
  return Array.from(
    { length: Math.min(30, Math.max(0, last - first + 1)) },
    (_, index) => +((first + index) * step).toPrecision(12),
  );
}

export function zoomRange(
  range: AxisRange,
  factor: number,
  fraction = 0.5,
  log = false,
): AxisRange {
  const [low, high] = log ? range.map(Math.log) : range;
  const anchor = low + (high - low) * fraction;
  const result: AxisRange = [
    anchor + (low - anchor) * factor,
    anchor + (high - anchor) * factor,
  ];
  const converted = log ? (result.map(Math.exp) as AxisRange) : result;
  return converted.every(Number.isFinite) &&
    converted[0] < converted[1] &&
    (!log || converted[0] > 0)
    ? converted
    : range;
}

export function rangeValue(
  fraction: number,
  range: AxisRange,
  log = false,
): number {
  return log
    ? Math.exp(Math.log(range[0]) + fraction * Math.log(range[1] / range[0]))
    : range[0] + fraction * (range[1] - range[0]);
}

export function selectedRange(
  start: number,
  end: number,
  range: AxisRange,
  log = false,
): AxisRange {
  return [
    rangeValue(Math.min(start, end), range, log),
    rangeValue(Math.max(start, end), range, log),
  ];
}

export function panRange(
  range: AxisRange,
  delta: number,
  log = false,
): AxisRange {
  const result: AxisRange = log
    ? [
        range[0] * (range[1] / range[0]) ** delta,
        range[1] * (range[1] / range[0]) ** delta,
      ]
    : [
        range[0] + (range[1] - range[0]) * delta,
        range[1] + (range[1] - range[0]) * delta,
      ];
  return result.every(Number.isFinite) &&
    result[0] < result[1] &&
    (!log || result[0] > 0)
    ? result
    : range;
}
