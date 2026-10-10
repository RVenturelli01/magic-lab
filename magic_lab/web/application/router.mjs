import { createApplication } from "./application.mjs";
import { createAlgorithmsApplication } from "./algorithms.mjs";
import { labScreen, labTools } from "../ui/lab.mjs";

/** Top-level tool navigation is separate from MagicPlot's portable views. */
export function createLabRouter(
  { window, ...runtime },
  makePlot = createApplication,
  makeAlgo = createAlgorithmsApplication,
) {
  let plot = null;
  let activeRoute = null;
  let started = false;
  const route = () => {
    const id = window.location.hash.slice(1).toLowerCase();
    return labTools.some((tool) => tool.id === id) ? id : "magiclab";
  };
  function render() {
    const next = route();
    if (next === activeRoute) return;
    const wasMounted = activeRoute !== null;
    plot?.destroy();
    plot = null;
    activeRoute = next;
    runtime.document.title =
      (next === "magiclab"
        ? "MagicLab"
        : labTools.find((tool) => tool.id === next).name + " · MagicLab") +
      " · Research workspace";
    if (next === "magicplot") {
      // A dedicated mount keeps router theme events out of plot event handlers.
      runtime.el.innerHTML =
        '<div data-plot-root><p class="loading" role="status">Loading MagicPlot…</p></div>';
      const mount = runtime.el.querySelector("[data-plot-root]");
      plot = makePlot({ ...runtime, el: mount });
      const current = plot;
      void current.start().then(() => {
        if (plot === current && wasMounted) {
          const heading = mount.querySelector("h1");
          heading?.setAttribute("tabindex", "-1");
          heading?.focus();
        }
      });
    } else {
      runtime.el.innerHTML = labScreen(
        next,
        globalThis.observatoryTheme?.get() ?? "dark",
      );
      if (wasMounted) runtime.el.querySelector("#lab-title")?.focus();
      if (next === "magicalgo") {
        plot = makeAlgo({
          ...runtime,
          el: runtime.el.querySelector("[data-algo-root]"),
          tabsEl: runtime.el.querySelector("[data-algo-tabs]"),
        });
        void plot.start();
      }
    }
    window.scrollTo?.(0, 0);
  }
  function change(event) {
    if (!event.target.matches?.("[data-lab-theme]")) return;
    if (globalThis.observatoryTheme?.set(event.target.value) === false) {
      const notice = runtime.document.createElement("p");
      notice.className = "notice warning";
      notice.role = "alert";
      notice.textContent =
        "Theme changed, but could not be saved: storage unavailable.";
      runtime.el.querySelector("main")?.prepend(notice);
    }
  }
  return {
    start() {
      if (started) return;
      started = true;
      window.addEventListener("hashchange", render);
      runtime.el.addEventListener("change", change);
      render();
    },
    destroy() {
      window.removeEventListener("hashchange", render);
      runtime.el.removeEventListener("change", change);
      plot?.destroy();
      plot = null;
      activeRoute = null;
      started = false;
    },
  };
}
