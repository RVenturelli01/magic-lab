const clamp = (value) => Math.max(0.25, Math.min(2.5, value));

export function fitGraph(width, height, worldWidth, worldHeight) {
  const scale = Math.max(
    0.05,
    Math.min(1, (width - 32) / worldWidth, (height - 32) / worldHeight),
  );
  return {
    scale,
    x: (width - worldWidth * scale) / 2,
    y: (height - worldHeight * scale) / 2,
  };
}

export function zoomGraph(state, factor, x, y) {
  const scale = clamp(state.scale * factor),
    ratio = scale / state.scale;
  return { scale, x: x - (x - state.x) * ratio, y: y - (y - state.y) * ratio };
}

/** Pan and zoom one fixed-coordinate world, preserving node and edge alignment. */
export function mountGraphView(panel, saved) {
  const viewport = panel?.querySelector?.("[data-graph-viewport]");
  if (!viewport) return { state: () => saved, destroy() {} };
  const world = viewport.querySelector("[data-graph-world]");
  const output = panel.querySelector("[data-graph-scale]");
  let state = saved ? { ...saved } : null,
    drag,
    suppressClick = false,
    automatic = !saved || saved.automatic === true;
  let clickTimer;
  function apply() {
    world.style.transform =
      "translate(" +
      state.x +
      "px," +
      state.y +
      "px) scale(" +
      state.scale +
      ")";
    output.textContent = Math.round(state.scale * 100) + "%";
  }
  function fit() {
    state = fitGraph(
      viewport.clientWidth,
      viewport.clientHeight,
      Number(world.dataset.width),
      Number(world.dataset.height),
    );
    automatic = true;
    apply();
  }
  function zoom(
    factor,
    x = viewport.clientWidth / 2,
    y = viewport.clientHeight / 2,
  ) {
    state = zoomGraph(state, factor, x, y);
    automatic = false;
    apply();
  }
  function down(event) {
    if (event.button !== 0 || drag || event.target.closest("[data-algo-note]"))
      return;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      initial: { ...state },
      automatic,
      moved: false,
    };
  }
  function move(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (!drag.moved) {
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add("is-panning");
      drag.moved = true;
    }
    event.preventDefault();
    state = { ...drag.initial, x: drag.initial.x + dx, y: drag.initial.y + dy };
    automatic = false;
    apply();
  }
  function finish(cancel) {
    if (!drag) return;
    const current = drag;
    drag = null;
    if (cancel) {
      state = current.initial;
      automatic = current.automatic;
      apply();
    }
    if (current.moved) {
      suppressClick = true;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        suppressClick = false;
      }, 0);
    }
    viewport.classList.remove("is-panning");
    if (viewport.hasPointerCapture(current.id))
      viewport.releasePointerCapture(current.id);
  }
  function up(event) {
    if (drag?.id === event.pointerId) finish(false);
  }
  function cancel(event) {
    if (drag?.id === event.pointerId) finish(true);
  }
  function click(event) {
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    }
  }
  function wheel(event) {
    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const delta =
      event.deltaY *
      (event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? viewport.clientHeight
          : 1);
    zoom(
      Math.exp(-Math.max(-200, Math.min(200, delta)) * 0.002),
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
  }
  function controls(event) {
    if (event.target.closest("[data-graph-fit]")) fit();
    const button = event.target.closest("[data-graph-zoom]");
    if (button) zoom(button.dataset.graphZoom === "in" ? 1.2 : 1 / 1.2);
  }
  function key(event) {
    if (event.target !== viewport) return;
    const shift = {
      ArrowLeft: [40, 0],
      ArrowRight: [-40, 0],
      ArrowUp: [0, 40],
      ArrowDown: [0, -40],
    }[event.key];
    if (shift) {
      state.x += shift[0];
      state.y += shift[1];
      automatic = false;
      apply();
    } else if (event.key === "+" || event.key === "=") zoom(1.2);
    else if (event.key === "-") zoom(1 / 1.2);
    else if (event.key === "Home" || event.key === "0") fit();
    else if (event.key === "Escape") finish(true);
    else return;
    event.preventDefault();
  }
  function focus(event) {
    const node = event.target
      .closest("[data-algo-node]")
      ?.closest(".module-node");
    if (!node) return;
    const rect = node.getBoundingClientRect(),
      bounds = viewport.getBoundingClientRect();
    if (
      rect.left < bounds.left ||
      rect.right > bounds.right ||
      rect.top < bounds.top ||
      rect.bottom > bounds.bottom
    ) {
      state.x += bounds.left + bounds.width / 2 - (rect.left + rect.width / 2);
      state.y += bounds.top + bounds.height / 2 - (rect.top + rect.height / 2);
      automatic = false;
      apply();
    }
  }
  const handlers = {
    pointerdown: down,
    pointermove: move,
    pointerup: up,
    pointercancel: cancel,
    lostpointercapture: cancel,
    keydown: key,
    focusin: focus,
  };
  for (const [name, fn] of Object.entries(handlers))
    viewport.addEventListener(name, fn);
  viewport.addEventListener("click", click, true);
  viewport.addEventListener("wheel", wheel, { passive: false });
  panel.addEventListener("click", controls);
  const Observer = panel.ownerDocument.defaultView.ResizeObserver;
  const observer = Observer
    ? new Observer(() => {
        if (automatic) fit();
      })
    : null;
  observer?.observe(viewport);
  if (state && !automatic) apply();
  else fit();
  return {
    state: () => ({ ...state, automatic }),
    destroy() {
      finish(true);
      clearTimeout(clickTimer);
      observer?.disconnect();
      for (const [name, fn] of Object.entries(handlers))
        viewport.removeEventListener(name, fn);
      viewport.removeEventListener("click", click, true);
      viewport.removeEventListener("wheel", wheel);
      panel.removeEventListener("click", controls);
    },
  };
}
