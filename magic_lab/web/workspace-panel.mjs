/** Transient workspace geometry; resizing never replaces the application DOM. */
export function mountWorkspacePanel(root, { width = null, commit } = {}) {
  const win = root?.ownerDocument.defaultView;
  if (!root || !win) return null;
  const menus = [
    ...root.querySelectorAll('[data-menu="style"], [data-menu="settings"]'),
  ];
  const cleanups = [];
  const deck = root.querySelector(".plot-deck");
  const cardCount = deck?.querySelectorAll(":scope > .chart-card").length ?? 0;
  let automatic = width === null,
    current = width ?? 320,
    drag = null;
  const columns = () => {
    const preferred =
      Number.parseFloat(
        deck
          ? win.getComputedStyle?.(deck)?.getPropertyValue("--chart-width")
          : "",
      ) || 640;
    const available = root.getBoundingClientRect().width - 304;
    return {
      preferred,
      count: Math.max(
        1,
        Math.min(
          cardCount || 1,
          Math.floor((available + 20) / (preferred + 20)),
        ),
      ),
    };
  };
  const listen = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    cleanups.push(() => target.removeEventListener(type, fn, options));
  };
  const limits = () => {
    const available = root.getBoundingClientRect().width;
    const max = Math.max(
      0,
      win.innerWidth <= 800 ? available : available - 344,
    );
    return { min: Math.min(280, max), max };
  };
  const apply = (value) => {
    const { min, max } = limits();
    current = Math.round(Math.max(min, Math.min(max, value)));
    root.style.setProperty("--workspace-panel-width", current + "px");
    const leftWidth = root.getBoundingClientRect().width - current - 24;
    root.style.setProperty(
      "--workspace-chart-columns",
      Math.max(
        1,
        Math.min(columns().count, Math.floor((leftWidth + 20) / 340)),
      ),
    );
    for (const menu of menus) {
      const handle = menu.querySelector("[data-panel-resize]");
      handle.setAttribute("aria-valuemin", Math.round(min));
      handle.setAttribute("aria-valuemax", Math.round(max));
      handle.setAttribute("aria-valuenow", current);
      if (!menu.open) continue;
      const editor = menu.querySelector(".paper-editor");
      const top = editor.getBoundingClientRect().top;
      const viewportHeight = win.visualViewport?.height ?? win.innerHeight;
      const viewportTop = win.visualViewport?.offsetTop ?? 0;
      const height = Math.max(
        80,
        viewportTop + viewportHeight - Math.max(viewportTop + 16, top) - 16,
      );
      editor.style.maxHeight = Math.floor(height) + "px";
      root.style.setProperty(
        "--workspace-panel-height",
        editor.getBoundingClientRect().height + "px",
      );
    }
  };
  const update = () => {
    const available = root.getBoundingClientRect().width;
    const { preferred, count } = columns();
    const chartsWidth = cardCount
      ? count * preferred + (count - 1) * 20
      : available * 0.65;
    apply(automatic ? available - chartsWidth - 24 : current);
  };
  const finish = (cancel = false) => {
    if (!drag) return;
    const previous = drag;
    drag = null;
    if (cancel) {
      automatic = previous.automatic;
      apply(previous.width);
    } else {
      automatic = false;
      commit?.(current);
    }
    if (previous.handle.hasPointerCapture(previous.id))
      previous.handle.releasePointerCapture(previous.id);
  };
  for (const menu of menus) {
    const handle = menu.querySelector("[data-panel-resize]");
    listen(menu, "toggle", update);
    listen(handle, "pointerdown", (event) => {
      if (event.button !== 0 || win.innerWidth <= 800) return;
      event.preventDefault();
      handle.focus({ preventScroll: true });
      drag = {
        handle,
        id: event.pointerId,
        x: event.clientX,
        width: current,
        automatic,
      };
      automatic = false;
      handle.setPointerCapture(event.pointerId);
    });
    listen(handle, "pointermove", (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      apply(drag.width + drag.x - event.clientX);
    });
    listen(handle, "pointerup", (event) => {
      if (drag?.id === event.pointerId) finish();
    });
    for (const type of ["pointercancel", "lostpointercapture"])
      listen(handle, type, () => finish(true));
    listen(handle, "keydown", (event) => {
      if (event.key === "Escape" && drag) {
        event.preventDefault();
        event.stopPropagation();
        finish(true);
      } else if (
        ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
      ) {
        event.preventDefault();
        automatic = false;
        const { min, max } = limits();
        apply(
          event.key === "Home"
            ? min
            : event.key === "End"
              ? max
              : current +
                (event.key === "ArrowLeft" ? 1 : -1) *
                  (event.shiftKey ? 50 : 10),
        );
        commit?.(current);
      }
    });
  }
  listen(win, "resize", update);
  listen(win, "scroll", update, { passive: true });
  if (win.visualViewport) {
    listen(win.visualViewport, "resize", update);
    listen(win.visualViewport, "scroll", update);
  }
  const observer = win.ResizeObserver ? new win.ResizeObserver(update) : null;
  observer?.observe(root);
  for (const menu of menus)
    observer?.observe(menu.querySelector(".paper-editor"));
  const toolbar = root.querySelector(".workspace-toolbar");
  if (toolbar) observer?.observe(toolbar);
  update();
  return {
    destroy() {
      finish(true);
      observer?.disconnect();
      cleanups.forEach((cleanup) => cleanup());
    },
  };
}
