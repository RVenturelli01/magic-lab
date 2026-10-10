import { axisTicks } from "../core/axis-format.mjs";
import { paperChart } from "../core/paper-style.mjs";
import { xml } from "../core/text.mjs";
export function paperPreviewText(value) {
  const symbols = {
    alpha: "α",
    beta: "β",
    gamma: "γ",
    delta: "δ",
    epsilon: "ε",
    theta: "θ",
    lambda: "λ",
    mu: "μ",
    pi: "π",
    rho: "ρ",
    sigma: "σ",
    tau: "τ",
    phi: "φ",
    psi: "ψ",
    omega: "ω",
    Delta: "Δ",
    Sigma: "Σ",
    Omega: "Ω",
    times: "×",
    cdot: "·",
    pm: "±",
    infty: "∞",
  };
  return String(value)
    .split(/(\$[^$\n]+\$)/g)
    .map((part) => {
      if (!part.startsWith("$") || !part.endsWith("$")) return xml(part);
      return xml(part.slice(1, -1))
        .replace(/\\([a-zA-Z]+)/g, (all, key) => symbols[key] ?? all)
        .replace(/\\(?:mathrm|text)\{([^{}]*)\}/g, "$1")
        .replace(
          /\^\{([^{}]*)\}|\^([a-zA-Z0-9+-])/g,
          (_, a, b) => "<sup>" + (a ?? b) + "</sup>",
        )
        .replace(
          /_\{([^{}]*)\}|_([a-zA-Z0-9])/g,
          (_, a, b) => "<sub>" + (a ?? b) + "</sub>",
        );
    })
    .join("");
}
export function paperFigure(chart) {
  const c = paperChart(chart),
    p = c.style,
    pt = 96 / 72,
    cm = 96 / 2.54,
    traces = [],
    series = [];
  for (const g of c.groups) {
    const indices = [],
      x = g.points.map((q) => q.step),
      rgb = [1, 3, 5]
        .map((k) => parseInt(g.color.slice(k, k + 2), 16))
        .join(",");
    if (p.uncertainty === "band")
      for (const sign of [-1, 1]) {
        indices.push(traces.length);
        traces.push({
          type: "scatter",
          mode: "lines",
          x,
          y: g.points.map((q) =>
            q.error === null ? null : q.mean + sign * q.error,
          ),
          line: { width: 0, color: g.color },
          connectgaps: false,
          hoverinfo: "skip",
          showlegend: false,
          ...(sign === 1
            ? {
                fill: "tonexty",
                fillcolor: "rgba(" + rgb + "," + p.bandOpacity + ")",
              }
            : {}),
        });
      }
    indices.push(traces.length);
    traces.push({
      type: "scatter",
      mode:
        g.dash === "none"
          ? "markers"
          : g.marker === "none"
            ? "lines"
            : "lines+markers",
      x,
      y: g.points.map((q) => q.mean),
      name: paperPreviewText(g.label),
      legendgroup: g.key,
      line: {
        color: g.color,
        width: p.lineWidth * pt,
        dash: g.dash === "none" ? "solid" : g.dash,
      },
      marker: {
        symbol: g.marker === "none" ? "circle" : g.marker,
        color: g.color,
        size: g.points.map((q, i) =>
          g.marker !== "none" && i % p.markerEvery === 0
            ? p.markerSize * pt
            : 0,
        ),
      },
      error_y: {
        type: "data",
        visible: p.uncertainty === "bars",
        array: g.points.map((q, i) =>
          i % p.errorEvery === 0 ? q.error : null,
        ),
        color: g.color,
        thickness: p.errorWidth * pt,
        width: p.errorCap * pt,
      },
      connectgaps: false,
      customdata: g.points.map((q) => [q.n, q.sd, q.error]),
      hovertemplate:
        paperPreviewText(g.label) +
        "<br>%{x}: %{y}<br>n=%{customdata[0]}<extra></extra>",
    });
    series.push({ indices, name: g.label, color: g.color, key: g.key });
  }
  const font =
    p.font === "sans"
      ? "Arial, sans-serif"
      : p.font === "times"
        ? "Times New Roman, serif"
        : "CMU Serif, Latin Modern Roman, Computer Modern, Times New Roman, serif";
  const formattedTicks = Object.fromEntries(
    ["x", "y"].map((a) => [
      a,
      axisTicks(
        c.bounds[a + "min"],
        c.bounds[a + "max"],
        c[a + "Tick"],
        c[a + "NumberFormat"],
        c[a + "Exponent"],
      ),
    ]),
  );
  const multipliers = ["x", "y"]
    .filter((a) => formattedTicks[a]?.exponent !== null && formattedTicks[a])
    .map((a) => ({
      text: "×10<sup>" + formattedTicks[a].exponent + "</sup>",
      xref: "paper",
      yref: "paper",
      x: a === "x" ? 1 : 0,
      y: a === "x" ? 0 : 1,
      yshift: a === "x" ? -24 : 6,
      xanchor: a === "x" ? "right" : "left",
      yanchor: a === "x" ? "top" : "bottom",
      showarrow: false,
      font: { size: p.tickSize * pt },
    }));
  const axis = (letter, label) => ({
    title: {
      text: paperPreviewText(label),
      font: { size: p.labelSize * pt },
      standoff: 3,
    },
    range: [c.bounds[letter + "min"], c.bounds[letter + "max"]],
    autorange: false,
    automargin: true,
    showgrid: p.grid,
    gridcolor: "#dddddd",
    gridwidth: 0.5,
    zeroline: false,
    showline: true,
    mirror: p.box,
    linewidth: p.axisWidth * pt,
    linecolor: "#333333",
    ticks: p.tickDirection === "in" ? "inside" : "outside",
    tickwidth: p.axisWidth * pt,
    ticklen: 3 * pt,
    tickfont: { size: p.tickSize * pt },
    ...(formattedTicks[letter]
      ? {
          tickmode: "array",
          tickvals: formattedTicks[letter].values,
          ticktext: formattedTicks[letter].labels,
        }
      : c[letter + "Tick"]
        ? { tickmode: "linear", tick0: 0, dtick: c[letter + "Tick"] }
        : { nticks: 6 }),
  });
  const positions = {
    "upper right": [1, 1, "right", "top"],
    "upper left": [0, 1, "left", "top"],
    "lower right": [1, 0, "right", "bottom"],
    "lower left": [0, 0, "left", "bottom"],
    "outside right": [1.02, 1, "left", "top"],
  };
  const [x, y, xanchor, yanchor] =
    positions[p.legend] ?? positions["lower right"];
  return {
    traces,
    series,
    layout: {
      width: p.width * cm,
      height: p.height * cm,
      autosize: false,
      margin: {
        l: p.marginLeft * cm,
        r: Math.max(
          p.marginRight * cm,
          formattedTicks.x
            ? 8 +
                p.tickSize *
                  pt *
                  String(formattedTicks.x.labels.at(-1) ?? "").length *
                  0.3
            : 0,
        ),
        t: p.marginTop * cm,
        b: Math.max(
          p.marginBottom * cm,
          multipliers.some((m) => m.y === 0) ? 48 : 0,
        ),
      },
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#ffffff",
      font: { family: font, size: p.fontSize * pt, color: "#111111" },
      title: {
        text: paperPreviewText(c.title),
        font: { size: p.titleSize * pt },
        x: 0.5,
      },
      xaxis: axis("x", c.xlabel),
      yaxis: axis("y", c.ylabel),
      showlegend: p.legend !== "none",
      legend: {
        x,
        y,
        xanchor,
        yanchor,
        font: { size: p.legendSize * pt },
        bgcolor: "rgba(255,255,255," + p.legendOpacity + ")",
        bordercolor: "#bbbbbb",
        borderwidth: p.legendFrame ? 0.5 : 0,
        itemclick: false,
        itemdoubleclick: false,
        orientation: p.legendColumns > 1 ? "h" : "v",
        ...(p.legendColumns > 1
          ? { entrywidth: 1 / p.legendColumns, entrywidthmode: "fraction" }
          : {}),
      },
      hovermode: "closest",
      dragmode: "zoom",
      annotations: multipliers.concat(
        c.panelCaption
          ? [
              {
                text: paperPreviewText(c.panelCaption),
                xref: "paper",
                yref: "paper",
                x: 0.5,
                y: -0.32,
                showarrow: false,
                font: { size: p.titleSize * pt },
              },
            ]
          : [],
      ),
    },
  };
}
