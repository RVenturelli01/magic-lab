import { bandHalfWidth } from "./uncertainty.mjs";
import { extent } from "./extent.mjs";
export const PAPER_PALETTE = [
  "#000000",
  "#ff1493",
  "#668cff",
  "#E69F00",
  "#009E73",
  "#CC79A7",
  "#0072B2",
];
export const PAPER_DEFAULTS = {
  enabled: true,
  width: 8.8,
  height: 7.2,
  columns: 2,
  gapX: 1.8,
  gapY: 2,
  font: "computer-modern",
  fontSize: 10,
  labelSize: 11,
  tickSize: 9,
  legendSize: 9,
  titleSize: 11,
  lineWidth: 0.7,
  marker: "none",
  markerSize: 3,
  errorWidth: 0.6,
  errorCap: 2,
  errorEvery: 1,
  markerEvery: 1,
  uncertainty: "band",
  bandOpacity: 0.22,
  grid: false,
  box: true,
  axisWidth: 0.6,
  tickDirection: "out",
  legend: "upper left",
  legendFrame: true,
  legendColumns: 1,
  legendOpacity: 1,
  marginLeft: 1.65,
  marginRight: 0.25,
  marginTop: 0.65,
  marginBottom: 1.2,
  dpi: 300,
  caption: "",
  metrics: {},
  series: {},
  legendPositions: {},
};
export const PAPER_LIMITS = {
  width: [4, 40],
  height: [4, 30],
  columns: [1, 8],
  gapX: [0, 8],
  gapY: [0, 8],
  fontSize: [5, 30],
  labelSize: [5, 36],
  tickSize: [5, 30],
  legendSize: [5, 30],
  titleSize: [5, 36],
  lineWidth: [0, 6],
  markerSize: [0, 14],
  errorWidth: [0.1, 5],
  errorCap: [0, 12],
  errorEvery: [1, 1000],
  markerEvery: [1, 1000],
  bandOpacity: [0, 1],
  axisWidth: [0.1, 4],
  legendColumns: [1, 10],
  legendOpacity: [0, 1],
  marginLeft: [0, 8],
  marginRight: [0, 8],
  marginTop: [0, 8],
  marginBottom: [0, 8],
  dpi: [72, 1200],
};
const choices = {
  font: ["computer-modern", "times", "sans"],
  marker: ["none", "circle", "square", "diamond", "triangle-up", "cross"],
  uncertainty: ["bars", "band", "none"],
  tickDirection: ["out", "in"],
  legend: [
    "upper right",
    "upper left",
    "lower right",
    "lower left",
    "outside right",
    "none",
  ],
};
export function normalizePaper(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Invalid chart style");
  const p = { ...PAPER_DEFAULTS, ...input };
  for (const [k, [min, max]] of Object.entries(PAPER_LIMITS))
    if (!Number.isFinite(p[k]) || p[k] < min || p[k] > max)
      throw Error("Chart style: invalid " + k);
  for (const k of [
    "columns",
    "legendColumns",
    "markerEvery",
    "errorEvery",
    "dpi",
  ])
    if (!Number.isInteger(p[k]))
      throw Error("Chart style: " + k + " must be an integer");
  for (const [k, options] of Object.entries(choices))
    if (!options.includes(p[k])) throw Error("Chart style: invalid " + k);
  for (const k of ["enabled", "grid", "box", "legendFrame"])
    if (typeof p[k] !== "boolean") throw Error("Chart style: invalid " + k);
  if (
    p.marginLeft + p.marginRight >= p.width - 1 ||
    p.marginTop + p.marginBottom >= p.height - 1
  )
    throw Error("Margins leave less than 1 cm for the plot");
  if (typeof p.caption !== "string" || p.caption.length > 4000)
    throw Error("Invalid figure caption");
  for (const k of ["metrics", "series", "legendPositions"])
    if (!p[k] || typeof p[k] !== "object" || Array.isArray(p[k]))
      throw Error("Invalid chart " + k);
  p.legendPositions = Object.fromEntries(
    Object.entries(p.legendPositions).map(([key, position]) => {
      if (!choices.legend.includes(position))
        throw Error("Invalid panel legend position");
      return [key, position];
    }),
  );
  p.metrics = Object.fromEntries(
    Object.entries(p.metrics).map(([id, m]) => {
      const out = {};
      for (const k of ["title", "xlabel", "ylabel", "panelCaption"])
        if (m[k] !== undefined) {
          if (typeof m[k] !== "string" || m[k].length > 2000)
            throw Error("Invalid chart label");
          out[k] = m[k];
        }
      for (const k of [
        "xmin",
        "xmax",
        "ymin",
        "ymax",
        "xTick",
        "yTick",
        "xScale",
        "yScale",
      ])
        if (m[k] !== undefined && m[k] !== "") {
          if (
            !Number.isFinite(m[k]) ||
            (["xTick", "yTick", "xScale", "yScale"].includes(k) && m[k] <= 0)
          )
            throw Error("Invalid chart axis");
          out[k] = m[k];
        }
      for (const axis of ["x", "y"]) {
        if (m[axis + "NumberFormat"] !== undefined) {
          if (
            !["auto", "full", "compact", "power"].includes(
              m[axis + "NumberFormat"],
            )
          )
            throw Error("Invalid axis number format");
          out[axis + "NumberFormat"] = m[axis + "NumberFormat"];
        }
        if (m[axis + "Exponent"] !== undefined) {
          if (
            !Number.isInteger(m[axis + "Exponent"]) ||
            Math.abs(m[axis + "Exponent"]) > 12
          )
            throw Error("Invalid axis exponent");
          out[axis + "Exponent"] = m[axis + "Exponent"];
        }
      }
      for (const a of ["x", "y"])
        if (
          out[a + "min"] !== undefined &&
          out[a + "max"] !== undefined &&
          out[a + "min"] >= out[a + "max"]
        )
          throw Error("Axis minimum must be below maximum");
      return [id, out];
    }),
  );
  p.series = Object.fromEntries(
    Object.entries(p.series).map(([id, s]) => {
      const out = {};
      if (s.label !== undefined) {
        if (typeof s.label !== "string" || s.label.length > 2000)
          throw Error("Invalid legend label");
        out.label = s.label;
      }
      if (s.color !== undefined) {
        if (!/^#[0-9a-f]{6}$/i.test(s.color))
          throw Error("Use a six-digit hex color");
        out.color = s.color;
      }
      if (s.marker !== undefined) {
        if (!choices.marker.includes(s.marker)) throw Error("Invalid marker");
        out.marker = s.marker;
      }
      if (s.dash !== undefined) {
        if (!["solid", "dash", "dot", "dashdot", "none"].includes(s.dash))
          throw Error("Invalid line style");
        out.dash = s.dash;
      }
      if (s.hidden !== undefined) {
        if (typeof s.hidden !== "boolean") throw Error("Invalid visibility");
        out.hidden = s.hidden;
      }
      if (s.order !== undefined) {
        if (!Number.isFinite(s.order)) throw Error("Invalid series order");
        out.order = s.order;
      }
      return [id, out];
    }),
  );
  return p;
}
export function paperSeries(group, index, view) {
  const p = normalizePaper(view.paper ?? {}),
    key = group.key ?? group.name ?? String(index),
    s = p.series[key] ?? {},
    originalLabel =
      (group.name ?? group.runs?.[0]?.name ?? group.algorithm) +
      (view.chartSeries === "runs" ? " · seed " + group.runs?.[0]?.seed : "");
  return {
    key,
    originalLabel,
    label: s.label ?? originalLabel,
    color:
      s.color ??
      PAPER_PALETTE[(group.colorIndex ?? index) % PAPER_PALETTE.length],
    marker: s.marker ?? p.marker,
    dash: s.dash ?? "solid",
    hidden: s.hidden ?? false,
    order: s.order ?? index,
  };
}
export function paperLegendKey(chart) {
  return chart.legendKey ?? chart.key ?? chart.metric.id;
}
export function setPaperLegend(paper, position, chart) {
  const p = normalizePaper(paper);
  return normalizePaper(
    chart
      ? {
          ...p,
          legendPositions: {
            ...p.legendPositions,
            [paperLegendKey(chart)]: position,
          },
        }
      : { ...p, legend: position, legendPositions: {} },
  );
}
export function paperChart(chart) {
  const { metric, view, result } = chart,
    p = normalizePaper(view.paper ?? {}),
    m = p.metrics[metric.id] ?? {};
  p.legend = p.legendPositions[paperLegendKey(chart)] ?? p.legend;
  const groups = result.groups
    .map((g, i) => ({
      ...paperSeries(g, i, view),
      points: g.points.map((q) => ({
        ...q,
        error:
          view.chartSeries === "runs" || view.band === "none"
            ? null
            : bandHalfWidth(q, view.band),
      })),
    }))
    .filter((g) => !g.hidden)
    .sort((a, b) => a.order - b.order);
  const xScale = m.xScale ?? 1,
    yScale = m.yScale ?? 1;
  for (const g of groups)
    g.points = g.points.map((q) => ({
      ...q,
      step: q.step / xScale,
      mean: q.mean / yScale,
      sd: q.sd === null ? null : q.sd / yScale,
      error: q.error === null ? null : q.error / yScale,
    }));
  const points = groups.flatMap((g) => g.points),
    xs = points.map((q) => q.step),
    ys = points.flatMap((q) => [
      q.mean - (p.uncertainty === "none" ? 0 : (q.error ?? 0)),
      q.mean + (p.uncertainty === "none" ? 0 : (q.error ?? 0)),
    ]);
  let [xmin, xmax] = extent(xs),
    [ymin, ymax] = extent(ys);
  if (xmin === xmax) {
    xmin -= 0.5;
    xmax += 0.5;
  } else {
    const pad = (xmax - xmin) * 0.04;
    xmin -= pad;
    xmax += pad;
  }
  if (ymin === ymax) {
    ymin -= 0.5;
    ymax += 0.5;
  } else {
    const pad = (ymax - ymin) * 0.08;
    ymin -= pad;
    ymax += pad;
  }
  const bounds = { xmin, xmax, ymin, ymax };
  const fixed = { ...view.plotBounds };
  for (const k of ["xmin", "xmax", "ymin", "ymax"])
    if (fixed[k] !== undefined)
      bounds[k] = fixed[k] / (k[0] === "x" ? xScale : yScale);
  for (const k of ["xmin", "xmax", "ymin", "ymax"])
    if (m[k] !== undefined) bounds[k] = m[k];
  const zoom = view.chartRanges?.[metric.id];
  if (zoom)
    for (const k of ["xmin", "xmax", "ymin", "ymax"])
      bounds[k] = zoom[k] / (k[0] === "x" ? xScale : yScale);
  if (bounds.xmin >= bounds.xmax || bounds.ymin >= bounds.ymax)
    throw Error("Paper axis limits must be increasing");
  return {
    style: p,
    metricId: metric.id,
    title: m.title ?? "",
    xlabel: m.xlabel ?? metric.xUnit,
    ylabel: m.ylabel ?? metric.label + " (" + metric.unit + ")",
    panelCaption: m.panelCaption ?? "",
    bounds,
    xScale,
    yScale,
    xNumberFormat: m.xNumberFormat ?? "auto",
    yNumberFormat: m.yNumberFormat ?? "auto",
    xExponent: m.xExponent ?? 3,
    yExponent: m.yExponent ?? 3,
    xTick: m.xTick,
    yTick: m.yTick,
    groups,
    statistics: {
      band: view.band,
      series: view.chartSeries,
      window: view.window,
      alignment: view.alignment,
      incomplete: view.incomplete,
    },
  };
}
