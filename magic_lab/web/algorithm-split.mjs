/** Preview pane resizing without rebuilding the mathematical document. */
export function mountAlgorithmSplit(root, { getWidth, commit }) {
  if (!root.ownerDocument?.createElement) return { destroy() {} };
  let drag;
  const clamp = (value) => Math.max(20, Math.min(55, value));
  function apply(handle, value) {
    handle
      .closest(".algorithm-layout")
      .style.setProperty("--algorithm-graph-width", value + "%");
    handle.setAttribute("aria-valuenow", value);
    handle.setAttribute("aria-valuetext", Math.round(value) + "%");
  }
  function finish(cancel) {
    if (!drag) return;
    const current = drag;
    drag = null;
    if (cancel) apply(current.handle, current.initial);
    else commit(current.value);
    if (current.handle.hasPointerCapture(current.id))
      current.handle.releasePointerCapture(current.id);
  }
  function down(event) {
    const handle = event.target.closest("[data-algo-resize]");
    if (!handle || event.button !== 0 || drag) return;
    const rect = handle.closest(".algorithm-layout").getBoundingClientRect();
    event.preventDefault();
    handle.focus({ preventScroll: true });
    drag = {
      handle,
      id: event.pointerId,
      initial: getWidth(),
      value: getWidth(),
      x: event.clientX,
      rect,
    };
    handle.setPointerCapture(event.pointerId);
  }
  function move(event) {
    if (!drag || drag.id !== event.pointerId) return;
    drag.value = clamp(
      drag.initial + ((drag.x - event.clientX) / drag.rect.width) * 100,
    );
    apply(drag.handle, drag.value);
  }
  function up(event) {
    if (drag?.id === event.pointerId) finish(false);
  }
  function cancel(event) {
    if (drag?.id === event.pointerId) finish(true);
  }
  function key(event) {
    const handle = event.target.closest("[data-algo-resize]");
    if (!handle) return;
    if (event.key === "Escape" && drag) {
      event.preventDefault();
      finish(true);
      return;
    }
    const value = {
      ArrowLeft: getWidth() + 2,
      ArrowRight: getWidth() - 2,
      Home: 20,
      End: 55,
    }[event.key];
    if (value === undefined || drag) return;
    event.preventDefault();
    apply(handle, clamp(value));
    commit(clamp(value));
  }
  const handlers = {
    pointerdown: down,
    pointermove: move,
    pointerup: up,
    pointercancel: cancel,
    lostpointercapture: cancel,
    keydown: key,
  };
  for (const [name, fn] of Object.entries(handlers))
    root.addEventListener(name, fn);
  return {
    destroy() {
      finish(true);
      for (const [name, fn] of Object.entries(handlers))
        root.removeEventListener(name, fn);
    },
  };
}
