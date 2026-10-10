import { runMetadata, runCatalogue } from "./run-catalog.mjs";
import { mountCurveOrder } from "../curve-order.mjs";
import { mountNumberScrub } from "../number-scrub.mjs";
import { mountWorkspacePanel } from "../workspace-panel.mjs";
import { applyPaperInput } from "../paper-editor.mjs";
import { normalizePaper, setPaperLegend } from "../../core/paper-style.mjs";

import { mountPlotTools } from "../plot-tools.mjs";
import { mountChartLayout } from "../chart-layout.mjs";
import { mountFilterOrder } from "../filter-order.mjs";
import { ablationGrid } from "../../panels/ablation-grid.mjs";
import { workspaceCharts } from "../../core/workspace.mjs";
import { normalizeView } from "../../core/view.mjs";
import { option } from "../ui/html.mjs";
import { xml as esc } from "../../core/text.mjs";
import { mainNavigation } from "../ui/menus.mjs";
import { filters, runs } from "../ui/runs.mjs";
import { workspace } from "../ui/workspace.mjs";
import { analysisState } from "../analysis-state.mjs";
import { mountExportPreview } from "./export-preview.mjs";
export function renderApplication(state, runtime, focusId) {
  const { el, document, toast, pruneSelection, saveCurrentView, render } =
    runtime;
  runMetadata(state);
  pruneSelection();
  saveCurrentView();
  const analysis =
    state.view.tab === "workspace"
      ? analysisState(state.dataset, state.view)
      : null;
  state.chartResults = analysis?.chartResults ?? new Map();

  const catalogScroll =
    document.querySelector(".run-catalog .tablewrap")?.scrollLeft ?? 0;
  const metricsWasOpen =
    document.querySelector('[data-menu="metrics"]')?.open ?? false;
  const openPanel = [...document.querySelectorAll(".paper-style")].find(
    (p) => p.open,
  );
  const paperMenu = openPanel?.dataset.menu,
    paperWasOpen = !!openPanel,
    paperScroll = openPanel?.querySelector(".paper-editor")?.scrollTop ?? 0;
  const paperSections = [...document.querySelectorAll("[data-paper-section]")]
    .filter((e) => e.open)
    .map((e) => e.dataset.paperSection);
  const paperActive = document.activeElement,
    paperFocus =
      paperActive?.dataset?.paperScope ||
      (paperActive?.id && paperActive?.closest?.(".paper-style"))
        ? { id: paperActive.id, ...paperActive.dataset }
        : null;
  const paperSelection =
    paperFocus && typeof paperActive.selectionStart === "number"
      ? {
          start: paperActive.selectionStart,
          end: paperActive.selectionEnd,
          direction: paperActive.selectionDirection,
        }
      : null;
  state.plotController?.destroy();
  state.plotController = null;
  state.previewController?.destroy();
  state.previewController = null;
  state.panelController?.destroy();
  state.panelController = null;

  const titles = {
    runs: "Runs",
    charts: "Charts",
    ablation: "Ablations",
    tables: "Tables",
  };
  const title =
    titles[state.view.tab === "runs" ? "runs" : state.view.workspaceMode];
  el.innerHTML =
    '<div class="shell"><header class="app-header"><a class="brand lab-home-link" href="#magiclab" aria-label="Back to MagicLab"><span class="brandmark" aria-hidden="true">◈</span>MagicLab</a><span class="tool-name">MagicPlot</span>' +
    mainNavigation(state) +
    '<label class="theme-control">Theme<select id="theme">' +
    [
      ["dark", "Dark"],
      ["light", "Light"],
      ["blue", "Blue"],
      ["purple", "Purple"],
      ["green", "Green"],
      ["amber", "Amber"],
      ["system", "System"],
    ]
      .map(([value, label]) =>
        option(value, label, globalThis.observatoryTheme?.get() ?? "dark"),
      )
      .join("") +
    '</select></label><button data-action="reload" title="' +
    esc(state.dataset.id) +
    '">↻ Reload</button></header><main><div class="heading"><div class="page-title"><h1>' +
    title +
    "</h1>" +
    (state.dataset.id === "rl-demo-v1"
      ? '<span class="pill">DEMO</span>'
      : "") +
    "</div></div>" +
    (!state.storageOK
      ? '<div class="notice warning">Storage unavailable</div>'
      : "") +
    (state.view.tab === "runs"
      ? filters(state) + runs(state, runCatalogue(state))
      : workspace(state, analysis)) +
    "</main></div>";
  const catalog = document.querySelector(".run-catalog .tablewrap");
  if (catalog) catalog.scrollLeft = catalogScroll;
  const metricsDetails = document.querySelector('[data-menu="metrics"]');

  if (metricsDetails) metricsDetails.open = metricsWasOpen;
  const paperDetails = [...document.querySelectorAll(".paper-style")].find(
    (p) => p.dataset.menu === paperMenu,
  );
  if (paperDetails) {
    paperDetails.open = paperWasOpen ?? false;
    // Restore content height before scrollTop; collapsed sections otherwise clamp it.
    for (const section of document.querySelectorAll("[data-paper-section]"))
      section.open = paperSections.includes(section.dataset.paperSection);
    paperDetails.querySelector(".paper-editor").scrollTop = paperScroll;
  }
  if (paperFocus && paperDetails) {
    const input = [
      ...paperDetails.querySelectorAll("input,select,textarea"),
    ].find((t) =>
      paperFocus.id
        ? t.id === paperFocus.id
        : paperFocus.paperScope &&
          t.dataset.paperScope === paperFocus.paperScope &&
          t.dataset.paperKey === paperFocus.paperKey &&
          t.dataset.paperId === paperFocus.paperId,
    );
    input?.focus({ preventScroll: true });
    if (input && paperSelection)
      input.setSelectionRange(
        paperSelection.start,
        paperSelection.end,
        paperSelection.direction,
      );
  }
  document
    .querySelectorAll("[data-partial]")
    .forEach(
      (input) => (input.indeterminate = input.dataset.partial === "true"),
    );
  document
    .querySelectorAll("button:disabled,input:disabled")
    .forEach((control) => {
      const reason =
        control.dataset.action === "toggle-field-picker"
          ? "All available filter fields are already shown."
          : ["run-page", "filter-page"].includes(control.dataset.action)
            ? "No " + control.dataset.direction + " page."
            : control.dataset.action === "export"
              ? "Select a metric to export."
              : "No visible runs to select.";
      control.title = reason;
      control.setAttribute("aria-description", reason);
    });
  state.panelController = mountWorkspacePanel(
    document.querySelector(".analysis-workspace"),
    {
      width: state.panelWidth,
      commit: (width) => {
        state.panelWidth = width;
      },
    },
  );
  const originalCharts = state.chartResults;
  mountNumberScrub(document.querySelector(".shell"), {
    preview: (target) => {
      if (!target) {
        state.chartResults = originalCharts;
        state.plotController?.refreshFigures();
        return;
      }
      try {
        const next = target.dataset.paperScope
          ? applyPaperInput(state.view, target)
          : normalizeView(
              {
                ...state.view,
                [target.id]:
                  target.id === "window" ? Number(target.value) : target.value,
              },
              state.dataset,
            );
        const charts = target.dataset.paperScope
          ? [...originalCharts.values()].map((chart) => ({
              ...chart,
              view: {
                ...chart.view,
                paper: next.paper,
                chartRanges: next.chartRanges,
              },
            }))
          : next.workspaceMode === "ablation"
            ? ablationGrid(state.dataset, next).cells
            : workspaceCharts(state.dataset, next);
        state.chartResults = new Map(
          charts.map((chart) => [chart.key ?? chart.metric.id, chart]),
        );
        state.plotController?.refreshFigures();
      } catch {
        /* Invalid intermediate bounds/margins keep the last valid preview. */
      }
    },
  });
  mountCurveOrder(document.querySelector('[data-paper-section="Curves"]'), {
    reorder: (keys) => {
      const series = { ...state.view.paper.series };
      keys.forEach((key, index) => {
        series[key] = { ...series[key], order: keys.length - 1 - index };
      });
      state.view.paper = normalizePaper({ ...state.view.paper, series });
      render();
    },
  });
  mountChartLayout(document.querySelector(".chart-grid"), {
    getView: () => state.view,
    reorder: (charts, id) => {
      state.view = normalizeView({ ...state.view, charts }, state.dataset);
      render();
      if (id)
        [...document.querySelectorAll("[data-chart-drag]")]
          .find((b) => b.dataset.chartDrag === id)
          ?.focus({ preventScroll: true });
    },
    resize: (chartSize, done, id) => {
      state.view.chartSize = chartSize;
      const deck = document.querySelector(".chart-grid");
      deck?.style.setProperty("--chart-width", chartSize.width + "px");
      deck?.style.setProperty("--chart-height", chartSize.height + "px");
      if (done) {
        state.view = normalizeView(state.view, state.dataset);
        render();
        if (id)
          [...document.querySelectorAll("[data-chart-resize]")]
            .find((b) => b.dataset.chartResize === id)
            ?.focus({ preventScroll: true });
      }
    },
  });
  mountFilterOrder(document.querySelector(".filter-builder"), {
    getFilters: () => state.view.filters,
    reorder: (filters, field) => {
      state.view = normalizeView({ ...state.view, filters }, state.dataset);
      render();
      [...document.querySelectorAll("[data-filter-drag]")]
        .find((button) => button.dataset.filterDrag === field)
        ?.focus({ preventScroll: true });
    },
  });
  if (focusId) document.getElementById(focusId)?.focus();
  if (
    state.view.tab === "workspace" &&
    state.view.displayMode === "latex" &&
    state.view.workspaceMode !== "tables"
  ) {
    state.previewController = mountExportPreview(state, runtime);
    return;
  }
  state.plotController = mountPlotTools(el, {
    plotly: runtime.Plotly,
    lookup: (key) => state.chartResults.get(key),
    onError: (error) => toast(error.message, true),
    changeLegend: (position, key) => {
      const chart = state.chartResults.get(key);
      if (!chart) return;
      state.view.paper = setPaperLegend(state.view.paper, position, chart);
      saveCurrentView();
      render();
    },
    changeRange: (metricId, bounds) => {
      if (
        bounds &&
        (!["xmin", "xmax", "ymin", "ymax"].every((key) =>
          Number.isFinite(bounds[key]),
        ) ||
          bounds.xmin >= bounds.xmax ||
          bounds.ymin >= bounds.ymax)
      )
        return;
      if (bounds && state.view.paper.enabled) {
        const metric = state.view.paper.metrics[metricId] ?? {},
          xs = metric.xScale ?? 1,
          ys = metric.yScale ?? 1;
        bounds = {
          xmin: bounds.xmin * xs,
          xmax: bounds.xmax * xs,
          ymin: bounds.ymin * ys,
          ymax: bounds.ymax * ys,
        };
      }
      state.view.chartRanges = { ...state.view.chartRanges };
      if (bounds) state.view.chartRanges[metricId] = bounds;
      else delete state.view.chartRanges[metricId];
      for (const chart of state.chartResults.values())
        chart.view.chartRanges = state.view.chartRanges;
      state.plotController?.refresh();
      saveCurrentView();
    },
  });
}
