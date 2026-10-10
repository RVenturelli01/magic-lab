import { compiledChart } from "../ui/export-preview.mjs";

/** Compiles individual charts and fills their existing cards. */
export function mountExportPreview(state, runtime) {
  const targets = [...runtime.el.querySelectorAll("[data-chart-preview]")];
  if (!targets.length) return null;
  const charts = [...state.chartResults.values()];
  const controller = new AbortController();
  const dataset = state.dataset,
    view = structuredClone(state.view);
  let destroyed = false,
    files = [],
    urls = [];
  const ready = (async () => {
    try {
      if (!view.selected.length)
        throw Error("No selected runs. Select runs in Runs first.");
      const capabilities = await runtime.fetch("/api/preview/capabilities", {
        signal: controller.signal,
      });
      if (!capabilities.ok) throw Error(await capabilities.text());
      const available = await capabilities.json();
      if (!available.latex?.available)
        throw Error(
          available.latex?.reason ||
            "LaTeX preview requires a local pdflatex compiler.",
        );
      const request = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset, view }),
        signal: controller.signal,
      };
      let response;
      for (let attempt = 0; attempt < 4; attempt++) {
        response = await runtime.fetch("/api/preview/latex", request);
        if (response.status !== 429) break;
        if (attempt === 3) break;
        await response.text();
        controller.signal.throwIfAborted();
        await new Promise((resolve, reject) => {
          const cancel = () => {
            clearTimeout(timer);
            reject(controller.signal.reason);
          };
          const timer = setTimeout(() => {
            controller.signal.removeEventListener("abort", cancel);
            resolve();
          }, 250);
          controller.signal.addEventListener("abort", cancel, { once: true });
        });
        controller.signal.throwIfAborted();
      }
      if (!response.ok) throw Error(await response.text());
      files = (await response.json()).files.map((file) => ({
        ...file,
        data: Uint8Array.from(atob(file.data), (char) => char.charCodeAt(0)),
      }));

      if (destroyed) return;
      if (files.length !== charts.length)
        throw Error("Incomplete LaTeX preview response");
      urls = files.map((file) =>
        URL.createObjectURL(new Blob([file.data], { type: file.type })),
      );
      targets.forEach((target) => {
        const index = charts.findIndex(
          (chart) =>
            (chart.key ?? chart.metric.id) === target.dataset.chartPreview,
        );
        if (index < 0) return;
        target.innerHTML = compiledChart(
          urls[index],
          charts[index].metric.label,
        );
        target.setAttribute("aria-busy", "false");
      });
    } catch (error) {
      if (destroyed) return;
      targets.forEach((target) => {
        target.querySelector('[role="status"]').textContent =
          "Preview unavailable: " + error.message;
        target.setAttribute("aria-busy", "false");
      });
    }
  })();
  return {
    ready,
    destroy() {
      destroyed = true;
      controller.abort();
      for (const url of urls) URL.revokeObjectURL(url);
      urls = [];
    },
  };
}
