import { validateDataset } from "../../core/dataset.mjs";
import { filterRuns } from "../../core/analysis.mjs";
import { xml } from "../../core/text.mjs";
import { createState } from "./state.mjs";
import { createPersistence } from "./storage.mjs";

import { createExportService } from "./exports.mjs";
import { renderApplication } from "./render.mjs";
import { createEventHandlers } from "./events.mjs";

/** Composition root. Importing this module has no DOM or network side effects. */
export function createApplication({
  el,
  document,
  localStorage,
  fetch,
  prompt,
  Plotly,
}) {
  const state = createState();
  let destroyed = false;
  const toast = (message, error = false) => {
    document.querySelector(".toast")?.remove();
    const element = document.createElement("div");
    element.className = "toast" + (error ? " error" : "");
    element.role = error ? "alert" : "status";
    element.textContent = (error ? "Error: " : "") + message;
    document.body.append(element);
    setTimeout(() => element.remove(), 6000);
  };
  const persistence = createPersistence(state, localStorage, toast);
  const exports = createExportService(state, {
    document,
    fetch,
    Plotly,
    toast,
  });
  function pruneSelection() {
    const visible = new Set(
      filterRuns(state.dataset.runs, state.view).map((run) => run.id),
    );
    state.view.selected = state.view.selected.filter((id) => visible.has(id));
  }

  const runtime = {
    el,
    document,
    localStorage,
    fetch,
    prompt,
    toast,
    pruneSelection,
    ...persistence,
    ...exports,
    render,
    Plotly,
  };
  function render(focusId) {
    renderApplication(state, runtime, focusId);
  }
  const handlers = createEventHandlers(state, runtime);
  for (const [name, handler] of Object.entries(handlers))
    el.addEventListener(name, handler);
  return {
    state,
    render,
    destroy() {
      destroyed = true;
      for (const [name, handler] of Object.entries(handlers))
        el.removeEventListener(name, handler);
      state.plotController?.destroy();
      state.previewController?.destroy();
      state.panelController?.destroy();
    },
    async start() {
      try {
        const response = await fetch("/api/dataset");
        if (!response.ok) throw Error(await response.text());
        const dataset = validateDataset(await response.json());
        if (destroyed) return;
        state.dataset = dataset;
        persistence.restore();
        render();
      } catch (error) {
        if (destroyed) return;
        el.innerHTML =
          '<div class="loading"><h1>Could not load the workspace</h1><p>' +
          xml(error.message) +
          "</p></div>";
      }
    },
  };
}
