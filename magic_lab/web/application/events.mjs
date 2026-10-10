import { runMetadata } from "./run-catalog.mjs";
import { plotAxes } from "../../core/plot-axes.mjs";
import { capturePreset, applyPreset } from "../../core/analysis-presets.mjs";
import { applyPaperInput } from "../paper-editor.mjs";
import { normalizePaper } from "../../core/paper-style.mjs";
import { seriesMode } from "../../core/run-grouping.mjs";
import { workspaceRunTable, selectTableRuns } from "../../core/run-table.mjs";
import { validateDataset } from "../../core/dataset.mjs";
import {
  defaultView,
  normalizeView as normalizePortableView,
} from "../../core/view.mjs";
import { filterRuns } from "../../core/analysis.mjs";
export function createEventHandlers(state, runtime) {
  const {
    el,
    document,
    localStorage,
    fetch,
    prompt,
    toast,
    render,
    persistPresets,
    pruneSelection,
    exportAnalysis,
  } = runtime;
  const normalizeView = (view, dataset) =>
    normalizePortableView(
      view,
      dataset,
      (dataset === state.dataset
        ? runMetadata(state)
        : runMetadata({ dataset })
      ).fields,
    );
  const click = async (event) => {
    for (const menu of document.querySelectorAll(".command-menu[open]"))
      if (
        !["style", "settings"].includes(menu.dataset.menu) &&
        !menu.contains(event.target)
      )
        menu.open = false;
    const b = event.target.closest("[data-action]");
    if (state.fieldPickerOpen && !event.target.closest(".filter-add")) {
      state.fieldPickerOpen = false;
      if (!b) render();
    }
    if (!b) return;
    try {
      const action = b.dataset.action;
      if (action === "run-page" || action === "filter-page") {
        if (action === "run-page") state.runPage = Number(b.dataset.page);
        else
          state.filterOptionPages.set(b.dataset.field, Number(b.dataset.page));
        render();
        const control = [
          ...document.querySelectorAll(`[data-action="${action}"]`),
        ].find(
          (t) =>
            t.dataset.direction === b.dataset.direction &&
            t.dataset.field === b.dataset.field,
        );
        control?.focus({ preventScroll: true });
        return;
      }
      if (action === "toggle-latex-preview") {
        state.view = normalizeView(
          {
            ...state.view,
            displayMode:
              state.view.displayMode === "latex" ? "interactive" : "latex",
          },
          state.dataset,
        );
        render("latexPreview");
        return;
      }
      if (action === "close-settings") {
        const settings = b.closest(".paper-style");
        if (settings) {
          settings.open = false;
          settings.querySelector("summary")?.focus();
        }
        return;
      }
      if (action === "save-preset") {
        const kind = b.dataset.kind,
          name = prompt("Name this " + kind + " configuration");
        if (!name?.trim()) return;
        const value =
          kind === "export"
            ? { mode: state.exportMode }
            : capturePreset(state.view, kind);
        state.presets[kind].push({ name: name.trim(), value });
        persistPresets();
      } else if (action === "load-preset") {
        const kind = b.dataset.kind,
          value = state.presets[kind][Number(b.dataset.index)].value;
        if (kind === "export") {
          if (!["combined", "separate"].includes(value.mode))
            throw Error("Invalid export configuration");
          state.exportMode = value.mode;
        } else {
          state.view = normalizeView(
            applyPreset(state.view, kind, value),
            state.dataset,
          );
          state.view.chartRanges = {};
        }
      } else if (action === "reset-panel") {
        const kind = b.dataset.kind;
        if (kind === "export") state.exportMode = "combined";
        else {
          state.view = applyPreset(
            state.view,
            kind,
            kind === "style"
              ? normalizePaper()
              : capturePreset(defaultView(state.dataset), "settings"),
          );
          state.view.chartRanges = {};
        }
      } else if (action === "delete-preset") {
        state.presets[b.dataset.kind].splice(Number(b.dataset.index), 1);
        persistPresets();
      } else if (action === "tab") {
        if (["charts", "ablation", "tables"].includes(b.dataset.tab)) {
          state.view.tab = "workspace";
          state.view.workspaceMode = b.dataset.tab;
        } else state.view.tab = b.dataset.tab;
        state.fieldPickerOpen = false;
      } else if (action === "expand-group") {
        const group = workspaceRunTable(state.dataset, state.view).groups[
          Number(b.dataset.group)
        ];
        if (state.expandedGroups.has(group.key))
          state.expandedGroups.delete(group.key);
        else state.expandedGroups.add(group.key);
      } else if (action === "toggle-run") {
        const id = b.dataset.runId;
        state.view.selected = selectTableRuns(
          state.view.selected,
          [id],
          !state.view.selected.includes(id),
        );
      } else if (action === "toggle-field-picker")
        state.fieldPickerOpen = !state.fieldPickerOpen;
      else if (action === "add-filter") {
        if (
          runMetadata(state).filters.some((f) => f.field === b.dataset.field) &&
          !state.view.filters.some((rule) => rule.field === b.dataset.field)
        )
          state.view.filters.push({ field: b.dataset.field, values: [] });
        state.fieldPickerOpen = false;
      } else if (action === "remove-filter")
        state.view.filters.splice(Number(b.dataset.index), 1);
      else if (action === "toggle-filter-value") {
        let rule = state.view.filters.find(
          (rule) => rule.field === b.dataset.field,
        );
        if (!rule) {
          rule = { field: b.dataset.field, values: [] };
          state.view.filters.push(rule);
        }
        const key = b.dataset.value;
        rule.values = rule.values.includes(key)
          ? rule.values.filter((value) => value !== key)
          : [...rule.values, key];
      } else if (action === "toggle-chart") {
        const id = b.dataset.metric;
        state.view.charts = state.view.charts.some(
          (key) => plotAxes(state.view, key).y === id,
        )
          ? state.view.charts.filter(
              (metric) => plotAxes(state.view, metric).y !== id,
            )
          : [...state.view.charts, id];
      } else if (action === "reset-filters")
        state.view.filters = state.view.filters.map((rule) => ({
          ...rule,
          values: [],
        }));
      else if (action === "reset-range")
        Object.assign(state.view, { minStep: "", maxStep: "" });
      else if (action === "export") {
        const label = b.textContent;
        b.disabled = true;
        b.textContent = "Preparing...";
        try {
          await exportAnalysis(b.dataset.format, b.dataset.metric);
        } finally {
          b.disabled = false;
          b.textContent = label;
        }
      } else if (action === "reload") {
        const response = await fetch("/api/dataset");
        if (!response.ok) throw Error(await response.text());
        const next = validateDataset(await response.json());
        const nextView = normalizeView(state.view, next);
        state.dataset = next;
        state.view = nextView;
        toast("Data reloaded");
      }
      state.view = normalizeView(state.view, state.dataset);
      if (
        [
          "toggle-filter-value",
          "remove-filter",
          "add-filter",
          "reset-filters",
          "reload",
        ].includes(action)
      ) {
        state.runPage = 0;
        pruneSelection();
      }
      render();
      if (action === "toggle-filter-value") {
        const option = [
          ...document.querySelectorAll('[data-action="toggle-filter-value"]'),
        ].find(
          (button) =>
            button.dataset.field === b.dataset.field &&
            button.dataset.value === b.dataset.value,
        );
        option?.focus({ preventScroll: true });
      }
      if (action === "tab")
        document
          .querySelector('.nav [aria-current="page"]')
          ?.focus({ preventScroll: true });
      if (["toggle-run", "expand-group"].includes(action)) {
        const button = [...document.querySelectorAll("[data-action]")].find(
          (t) =>
            t.dataset.action === action &&
            (action === "toggle-run"
              ? t.dataset.runId === b.dataset.runId
              : t.dataset.group === b.dataset.group),
        );
        button?.focus({ preventScroll: true });
      }
      if (action === "toggle-chart") {
        const option = [
          ...document.querySelectorAll('[data-action="' + action + '"]'),
        ].find((button) => button.dataset.metric === b.dataset.metric);
        option?.focus({ preventScroll: true });
      }
    } catch (error) {
      toast(error.message, true);
      render();
    }
  };
  const keydown = (event) => {
    if (
      event.key === "Escape" &&
      document.querySelector(".command-menu[open]")
    ) {
      const menu = document.querySelector(".command-menu[open]");
      menu.open = false;
      menu.querySelector("summary")?.focus();
      event.preventDefault();
      return;
    }
    if (
      event.key === "Escape" &&
      [...document.querySelectorAll(".paper-style")].some((p) => p.open)
    ) {
      const settings = [...document.querySelectorAll(".paper-style")].find(
        (p) => p.open,
      );
      settings.open = false;
      settings.querySelector("summary")?.focus();
      event.preventDefault();
      return;
    }
    if (event.key === "Escape" && state.fieldPickerOpen) {
      state.fieldPickerOpen = false;
      render();
      document
        .querySelector('[data-action="toggle-field-picker"]')
        ?.focus({ preventScroll: true });
    }
  };
  const change = async (event) => {
    const t = event.target;
    try {
      if (t.id === "theme") {
        if (!globalThis.observatoryTheme.set(t.value))
          toast(
            "Theme applied, but could not be saved: storage unavailable",
            true,
          );
        return;
      }
      if (t.dataset.exportMode !== undefined) {
        state.exportMode = t.value;
        render();
        return;
      }
      if (t.dataset.paperScope) {
        state.view = applyPaperInput(state.view, t);
      } else if (t.dataset.run) {
        state.view.selected = t.checked
          ? [...new Set([...state.view.selected, t.dataset.run])]
          : state.view.selected.filter((id) => id !== t.dataset.run);
      } else if (t.dataset.group !== undefined) {
        const group = workspaceRunTable(state.dataset, state.view).groups[
          Number(t.dataset.group)
        ];
        state.view.selected = selectTableRuns(
          state.view.selected,
          group.runs.map((r) => r.id),
          t.checked,
        );
      } else if (t.dataset.visible) {
        state.view.selected = selectTableRuns(
          state.view.selected,
          filterRuns(state.dataset.runs, state.view).map((r) => r.id),
          t.checked,
        );
      } else if (t.id === "runGrouping") {
        state.view.runGrouping = t.value;
        state.view.chartSeries = seriesMode({
          ...state.view,
          chartSeries: "runs",
        });
        state.view.chartRanges = {};
        state.expandedGroups.clear();
        state.runPage = 0;
      } else if (
        [
          "ablationMetric",
          "ablationXMetric",
          "ablationRow",
          "ablationColumn",
          "window",
          "alignment",
          "incomplete",
          "band",
          "minStep",
          "maxStep",
        ].includes(t.id)
      ) {
        if (t.id === "ablationMetric") state.view.ablationXMetric = "";
        state.view = normalizeView(
          {
            ...state.view,
            [t.id]: t.id === "window" ? Number(t.value) : t.value,
          },
          state.dataset,
        );
        if (t.id === "band") state.view.chartRanges = {};
      }
      state.view = normalizeView(state.view, state.dataset);
      render();
      if (["runGrouping", "ablationMetric"].includes(t.id))
        document.getElementById(t.id)?.focus({ preventScroll: true });
      if (t.dataset.run) {
        const checkbox = [...document.querySelectorAll("[data-run]")].find(
          (input) => input.dataset.run === t.dataset.run,
        );
        checkbox?.focus({ preventScroll: true });
      }
    } catch (error) {
      toast(error.message, true);
      render();
    }
  };
  return { click, keydown, change };
}
