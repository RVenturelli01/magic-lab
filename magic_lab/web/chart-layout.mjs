import { moveChart, resizeCharts } from "../core/chart-layout.mjs";

export function mountChartLayout(deck, { getView, reorder, resize }) {
  if (!deck) return;
  let dragged = null;
  const cards = () => [...deck.querySelectorAll(".chart-card")];
  const clear = () =>
    cards().forEach((card) => card.classList.remove("dragging", "drop-target"));
  deck.addEventListener("dragstart", (event) => {
    const handle = event.target.closest("[data-chart-drag]");
    if (!handle) return;
    dragged = handle.dataset.chartDrag;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", dragged);
    handle.closest(".chart-card").classList.add("dragging");
  });
  deck.addEventListener("dragover", (event) => {
    const card = event.target.closest(".chart-card");
    if (!dragged || !card || card.dataset.chartMetric === dragged) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    cards().forEach((c) => c.classList.toggle("drop-target", c === card));
  });
  deck.addEventListener("drop", (event) => {
    const card = event.target.closest(".chart-card");
    if (!dragged || !card) return;
    event.preventDefault();
    const next = moveChart(getView().charts, dragged, card.dataset.chartMetric);
    dragged = null;
    clear();
    reorder(next);
  });
  deck.addEventListener("dragend", () => {
    dragged = null;
    clear();
  });
  deck.addEventListener("keydown", (event) => {
    const drag = event.target.closest("[data-chart-drag]"),
      handle = event.target.closest("[data-chart-resize]");
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    const direction = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1;
    if (drag) {
      event.preventDefault();
      const charts = getView().charts,
        index = charts.indexOf(drag.dataset.chartDrag),
        target = charts[index + direction];
      if (target)
        reorder(
          moveChart(charts, drag.dataset.chartDrag, target),
          drag.dataset.chartDrag,
        );
    } else if (handle) {
      event.preventDefault();
      const step = (event.shiftKey ? 50 : 20) * direction;
      resize(
        resizeCharts(
          getView().chartSize,
          ["ArrowLeft", "ArrowRight"].includes(event.key) ? step : 0,
          ["ArrowUp", "ArrowDown"].includes(event.key) ? step : 0,
          deck.getBoundingClientRect().width,
        ),
        true,
        handle.dataset.chartResize,
      );
    }
  });
  deck.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest("[data-chart-resize]");
    if (!handle || event.button !== 0) return;
    event.preventDefault();
    const original = { ...getView().chartSize },
      rect = handle.closest(".chart-card").getBoundingClientRect(),
      start = { width: rect.width, height: rect.height },
      x = event.clientX,
      y = event.clientY;
    const maxWidth = deck.getBoundingClientRect().width,
      pointer = event.pointerId;
    let current = original,
      ended = false;
    const move = (e) => {
      if (e.pointerId !== pointer) return;
      current = resizeCharts(start, e.clientX - x, e.clientY - y, maxWidth);
      resize(current, false);
    };
    const finish = (e) => {
      if (e.pointerId !== pointer || ended) return;
      ended = true;
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", cancel);
      handle.removeEventListener("lostpointercapture", cancel);
      if (handle.hasPointerCapture(pointer))
        handle.releasePointerCapture(pointer);
      resize(current, true, handle.dataset.chartResize);
    };
    const cancel = (e) => {
      if (e.pointerId !== pointer || ended) return;
      current = original;
      finish(e);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", cancel);
    handle.addEventListener("lostpointercapture", cancel);
    handle.setPointerCapture(pointer);
  });
}
