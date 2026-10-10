import { validateAlgorithms } from "../../core/algorithms.mjs";
import { xml } from "../../core/text.mjs";
import { algorithmsScreen, algorithmTabs } from "../ui/algorithms.mjs";
import { createMathRenderer } from "../math.mjs";
import { algorithmGraph } from "../../core/algorithm-graph.mjs";
import { mountAlgorithmHelp } from "../algorithm-help.mjs";
import { mountAlgorithmSplit } from "../algorithm-split.mjs";
import { mountGraphView } from "../algorithm-graph-view.mjs";

export function createAlgorithmsApplication({
  el,
  tabsEl,
  fetch,
  katex = globalThis.katex,
}) {
  let catalog = null,
    path = [],
    math,
    destroyed = false,
    generation = 0;
  let graphWidth = 34;
  let graphView;
  const graphPositions = new Map();
  let graphRoot;
  const split = mountAlgorithmSplit(el, {
    getWidth: () => graphWidth,
    commit: (value) => {
      graphWidth = value;
    },
  });
  const positions = new Map();
  const help = mountAlgorithmHelp(
    el,
    (id) => catalog?.symbols?.find((s) => s.id === id)?.description,
  );
  function render() {
    if (graphView) {
      graphPositions.set(graphRoot, graphView.state());
      graphView.destroy();
    }
    if (tabsEl) tabsEl.innerHTML = algorithmTabs(catalog, path);
    el.innerHTML = algorithmsScreen(catalog, path, math, graphWidth);
    help.refresh();
    graphRoot = path[0];
    graphView = mountGraphView(
      el.querySelector("#algorithm-graph-panel"),
      graphPositions.get(graphRoot),
    );
  }
  function navigate(next) {
    const view = el.ownerDocument?.defaultView;
    positions.set(path.join("/"), view?.scrollY ?? 0);
    const previous = [...path];
    path = next;
    try {
      render();
      el.querySelector("#algorithm-title")?.focus({ preventScroll: true });
      view?.scrollTo(0, positions.get(path.join("/")) ?? 0);
    } catch (error) {
      path = previous;
      const notice = el.ownerDocument?.createElement("p");
      if (notice) {
        notice.role = "alert";
        notice.className = "notice warning";
        notice.textContent = error.message;
        el.prepend(notice);
      }
    }
  }
  function click(event) {
    const button = event.target.closest(
      "[data-algo-call],[data-algo-level],[data-algo-retry],[data-algo-node],[data-algo-select]",
    );
    if (!button) return;
    if (button.hasAttribute("data-algo-retry")) {
      void start();
      return;
    }
    if (!catalog) return;
    if (button.dataset.algoNode || button.dataset.algoSelect) {
      const currentGraph = algorithmGraph({
        ...catalog,
        root: path[0] ?? catalog.root,
      });
      const node = currentGraph.nodes.find(
        (n) => n.id === (button.dataset.algoSelect ?? button.dataset.algoNode),
      );
      if (
        node &&
        (!button.dataset.algoSelect ||
          !currentGraph.edges.some((edge) => edge.to === node.id))
      )
        navigate(node.path);
      return;
    }
    if (
      button.dataset.algoCall &&
      catalog.algorithms.some((a) => a.id === button.dataset.algoCall)
    )
      navigate([...path, button.dataset.algoCall]);
    else if (button.dataset.algoLevel !== undefined) {
      const level = Number(button.dataset.algoLevel);
      if (Number.isInteger(level) && level >= 0 && level < path.length - 1)
        navigate(path.slice(0, level + 1));
    }
  }
  el.addEventListener("click", click);
  tabsEl?.addEventListener("click", click);
  async function start() {
    const request = ++generation;
    el.innerHTML = '<p class="loading" role="status">Loading algorithm…</p>';
    try {
      const response = await fetch("/api/algorithms");
      if (!response.ok)
        throw Error(
          response.status === 404
            ? "No algorithm document found at data/algorithms.json. Restart the server after updating MagicLab."
            : await response.text(),
        );
      const next = validateAlgorithms(await response.json());
      if (destroyed || request !== generation) return;
      math = createMathRenderer(katex);
      catalog = next;
      path = catalog.algorithms.length ? [catalog.root] : [];
      render();
    } catch (error) {
      if (!destroyed && request === generation)
        el.innerHTML =
          '<div class="notice warning" role="alert"><h2>Could not load MagicAlgo</h2><p>' +
          xml(error.message) +
          "</p><button data-algo-retry>Retry</button></div>";
    }
  }
  return {
    start,
    destroy() {
      destroyed = true;
      help.destroy();
      split.destroy();
      graphView?.destroy();
      generation++;
      el.removeEventListener("click", click);
      tabsEl?.removeEventListener("click", click);
      if (tabsEl) tabsEl.innerHTML = "";
    },
  };
}
