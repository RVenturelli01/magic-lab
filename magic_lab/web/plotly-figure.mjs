import { paperFigure } from "./paper-figure.mjs";
import { paperChart } from "../core/paper-style.mjs";
import { bandHalfWidth, bandLabel } from "../core/uncertainty.mjs";
import { geometry } from "../core/chart-geometry.mjs";
import { COLORS, xml } from "../core/text.mjs";

export function plotBounds(chart) {
  if (chart.view.paper?.enabled) return paperChart(chart).bounds;
  const { xmin, xmax, ymin, ymax } = geometry(chart.result, chart.view);
  return { xmin, xmax, ymin, ymax };
}
export function plotlyFigure(chart) {
  if (chart.view.paper?.enabled) return paperFigure(chart);
  const { metric, view, result } = chart,
    traces = [],
    series = [];
  result.groups.forEach((group, index) => {
    const color = COLORS[(group.colorIndex ?? index) % COLORS.length],
      points = group.points;
    const name =
      (group.name ?? group.runs[0]?.name ?? group.algorithm) +
      (view.chartSeries === "runs" ? " · seed " + group.runs[0].seed : "");
    const indices = [],
      x = points.map((p) => p.step);
    if (view.band !== "none" && view.chartSeries !== "runs") {
      const rgb = [1, 3, 5]
        .map((k) => parseInt(color.slice(k, k + 2), 16))
        .join(",");
      for (const sign of [-1, 1]) {
        indices.push(traces.length);
        traces.push({
          type: "scatter",
          mode: "lines",
          x,
          y: points.map((p) =>
            bandHalfWidth(p, view.band) === null
              ? null
              : p.mean + sign * bandHalfWidth(p, view.band),
          ),
          line: { width: 0, color },
          connectgaps: false,
          hoverinfo: "skip",
          showlegend: false,
          ...(sign === 1
            ? { fill: "tonexty", fillcolor: "rgba(" + rgb + ",0.13)" }
            : {}),
        });
      }
    }
    indices.push(traces.length);
    traces.push({
      type: "scatter",
      mode: "lines+markers",
      x,
      y: points.map((p) => p.mean),
      name: xml(name),
      line: {
        color,
        width: 2,
        dash: ["solid", "dash", "dot"][
          Math.floor((group.colorIndex ?? index) / COLORS.length) % 3
        ],
      },
      marker: { size: 5, color },
      connectgaps: false,
      customdata: points.map((p) => [
        p.n,
        p.sd === null ? "undefined" : p.sd,
        bandHalfWidth(p, view.band) ?? "undefined",
      ]),
      hovertemplate:
        xml(name) +
        "<br>%{x:.6g} " +
        xml(metric.xUnit) +
        "<br>%{y:.6g} " +
        xml(metric.unit) +
        (view.chartSeries !== "runs"
          ? "<br>sample SD: %{customdata[1]} · n=%{customdata[0]}" +
            (view.band === "none"
              ? ""
              : "<br>" + xml(bandLabel(view.band)) + ": ±%{customdata[2]}")
          : "") +
        "<extra></extra>",
    });
    series.push({ indices, name, color });
  });
  const b = plotBounds(chart);
  return {
    traces,
    series,
    layout: {
      autosize: true,
      margin: { l: 66, r: 18, t: 32, b: 52 },
      paper_bgcolor: "#fff",
      plot_bgcolor: "#fff",
      font: { family: "Consolas, monospace", size: 14, color: "#414b4f" },
      xaxis: {
        title: { text: xml(metric.xUnit), font: { size: 14 } },
        range: [b.xmin, b.xmax],
        autorange: false,
        gridcolor: "#edf1f2",
        zerolinecolor: "#839296",
        automargin: true,
      },
      yaxis: {
        title: { text: xml(metric.unit), font: { size: 14 } },
        range: [b.ymin, b.ymax],
        autorange: false,
        gridcolor: "#edf1f2",
        zerolinecolor: "#839296",
        automargin: true,
      },
      showlegend: false,
      hovermode: "closest",
      dragmode: "zoom",
      annotations: traces.some((t) => t.y.some((y) => y !== null))
        ? []
        : [
            {
              text: "No observations",
              showarrow: false,
              x: 0.5,
              y: 0.5,
              xref: "paper",
              yref: "paper",
            },
          ],
    },
  };
}
