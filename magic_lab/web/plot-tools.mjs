import { plotlyFigure, plotBounds } from "./plotly-figure.mjs";
import { snapLegendPosition } from "./legend-position.mjs";

// Plotly owns gestures and modebar; persist viewport ranges.
export function mountPlotTools(
  root,
  {
    lookup,
    changeRange,
    changeLegend,
    onError = console.error,
    plotly = globalThis.Plotly,
  },
) {
  const plots = [];
  let destroyed = false,
    frame = null,
    figureFrame = null,
    figureBusy = false,
    figurePending = false;
  if (!root.querySelector(".chart-plot"))
    return {
      ready: Promise.resolve(),
      refresh() {},
      refreshFigures() {},
      destroy() {},
    };
  if (!plotly) throw Error("Plotly unavailable. Run npm install and reload.");
  const safe = (promise) =>
    Promise.resolve(promise).catch((error) => {
      if (!destroyed) onError(error);
    });
  const measure = (container) => {
    const rect = container?.getBoundingClientRect?.();
    if (!rect || rect.width < 1 || rect.height < 1) return null;
    return { width: Math.round(rect.width), height: Math.round(rect.height) };
  };
  const resize = () => {
    if (destroyed || frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      for (const p of plots) {
        if (!p.ready) continue;
        const size = measure(p.container);
        if (
          !size ||
          (size.width === p.size?.width && size.height === p.size?.height)
        )
          continue;
        p.size = size;
        // Plots.resize debounces for 100ms; explicit dimensions update during dragging.
        safe(p.update({ ...size, autosize: false }));
      }
    });
  };
  const observer =
    typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  globalThis.addEventListener?.("resize", resize);
  const ready = Promise.all(
    [...root.querySelectorAll(".chart-card")].map(async (card) => {
      const target = card.querySelector(".chart-plot"),
        chart = lookup(card.dataset.chartMetric);
      if (!target || !chart) return;
      const container = card.querySelector(".chart"),
        size = measure(container);
      const figure = plotlyFigure(chart),
        p = {
          key: card.dataset.chartMetric,
          target,
          chart,
          container,
          size,
          applying: 0,
          ready: false,
          signature: JSON.stringify(plotBounds(chart)),
        };
      plots.push(p);
      // Modebar icons are filled SVG paths: open lines disappear without a stroke.
      figure.layout.modebar = {
        bgcolor: "#ffffff",
        color: "#414b4f",
        activecolor: "#006b70",
      };
      if (size) Object.assign(figure.layout, size, { autosize: false });
      const update = async (patch) => {
        p.applying++;
        try {
          await plotly.relayout(target, patch);
        } finally {
          p.applying--;
        }
      };
      const horizontal = "M1 9L7 3V7H21V3L27 9L21 15V11H7V15Z";
      const vertical = "M14 0L20 6H16V12H20L14 18L8 12H12V6H8Z";
      const axisButton = (axis, label) => ({
        name: "Zoom " + label,
        icon: {
          width: 28,
          height: 18,
          path:
            axis === "x"
              ? horizontal
              : axis === "y"
                ? vertical
                : horizontal + vertical,
        },
        click: () =>
          safe(
            update({
              "xaxis.fixedrange": axis === "y",
              "yaxis.fixedrange": axis === "x",
              dragmode: "zoom",
            }),
          ),
      });
      const dragLegend = Boolean(
        changeLegend &&
        ["ablation", "charts"].includes(chart.view.workspaceMode) &&
        chart.view.paper?.enabled,
      );
      p.config = {
        responsive: false,
        displayModeBar: "hover",
        displaylogo: false,
        scrollZoom: false,
        editable: false,
        edits: { legendPosition: dragLegend },
        modeBarButtonsToRemove: [
          "toImage",
          "zoomIn2d",
          "zoomOut2d",
          "autoScale2d",
          "select2d",
          "lasso2d",
          "zoom2d",
        ],
        modeBarButtonsToAdd: [
          axisButton("xy", "XY"),
          axisButton("x", "X"),
          axisButton("y", "Y"),
          {
            name: "Fullscreen",
            icon: {
              width: 20,
              height: 20,
              path: "M1 7V1H7V3H3V7ZM13 1H19V7H17V3H13ZM19 13V19H13V17H17V13ZM7 19H1V13H3V17H7Z",
            },
            click: () =>
              safe(
                document.fullscreenElement === card
                  ? document.exitFullscreen()
                  : card.requestFullscreen?.(),
              ),
          },
        ],
        toImageButtonOptions: {
          format: "png",
          filename: "rl-" + chart.metric.id.replace(/[^a-zA-Z0-9_-]/g, "-"),
          scale: 2,
        },
      };
      await plotly.react(target, figure.traces, figure.layout, p.config);
      if (destroyed) {
        plotly.purge(target);
        return;
      }
      p.ready = true;
      p.update = update;
      target.on("plotly_relayout", (event) => {
        if (destroyed || p.applying) return;
        if (
          dragLegend &&
          Object.keys(event).some((key) => /^legend\.(x|y)$/.test(key))
        ) {
          const position = snapLegendPosition(
            target._fullLayout.legend,
            target._fullLayout._size,
          );
          if (position) changeLegend(position, p.key);
          return;
        }
        const reset =
          event["xaxis.autorange"] === true ||
          event["yaxis.autorange"] === true;
        const changed = Object.keys(event).some((key) =>
          /^([xy]axis\.range)/.test(key),
        );
        if (!reset && !changed) return;
        p.signature = null;
        if (reset) changeRange(chart.metric.id, null);
        else {
          const x = target.layout.xaxis.range,
            y = target.layout.yaxis.range;
          changeRange(chart.metric.id, {
            xmin: x[0],
            xmax: x[1],
            ymin: y[0],
            ymax: y[1],
          });
        }
      });
      card.querySelectorAll("[data-plot-series]").forEach((button) =>
        button.addEventListener("click", () => {
          const group = plotlyFigure(p.chart).series[
            Number(button.dataset.plotSeries)
          ];
          if (destroyed || !group) return;
          const visible = button.getAttribute("aria-pressed") !== "true";
          button.setAttribute("aria-pressed", String(visible));
          safe(plotly.restyle(target, { visible }, group.indices));
        }),
      );
      observer?.observe(container);
    }),
  );
  safe(ready);
  function refresh() {
    for (const p of plots) {
      if (!p.ready || destroyed) continue;
      const b = plotBounds(p.chart),
        signature = JSON.stringify(b);
      if (signature === p.signature) continue;
      p.signature = signature;
      safe(
        p.update({
          "xaxis.range": [b.xmin, b.xmax],
          "yaxis.range": [b.ymin, b.ymax],
          "xaxis.autorange": false,
          "yaxis.autorange": false,
        }),
      );
    }
  }
  function refreshFigures() {
    if (destroyed) return;
    figurePending = true;
    if (figureFrame !== null || figureBusy) return;
    figureFrame = requestAnimationFrame(async () => {
      figureFrame = null;
      figurePending = false;
      figureBusy = true;
      try {
        await Promise.all(
          plots.map(async (p) => {
            if (!p.ready || destroyed) return;
            const chart = lookup(p.key);
            if (!chart) return;
            const figure = plotlyFigure(chart),
              size = measure(p.container);
            figure.layout.modebar = {
              bgcolor: "#ffffff",
              color: "#414b4f",
              activecolor: "#006b70",
            };
            if (size) Object.assign(figure.layout, size, { autosize: false });
            p.chart = chart;
            p.signature = JSON.stringify(plotBounds(chart));
            p.applying++;
            try {
              await plotly.react(
                p.target,
                figure.traces,
                figure.layout,
                p.config,
              );
            } finally {
              p.applying--;
            }
          }),
        );
      } catch (error) {
        if (!destroyed) onError(error);
      } finally {
        figureBusy = false;
        if (figurePending) refreshFigures();
      }
    });
  }
  return {
    ready,
    refresh,
    refreshFigures,
    destroy() {
      destroyed = true;
      observer?.disconnect();
      globalThis.removeEventListener?.("resize", resize);
      if (frame !== null) cancelAnimationFrame(frame);
      if (figureFrame !== null) cancelAnimationFrame(figureFrame);
      for (const p of plots) {
        if (p.ready) plotly.purge(p.target);
      }
    },
  };
}
