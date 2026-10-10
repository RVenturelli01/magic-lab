/** One transient tooltip per algorithm instance; no rerenders while reading. */
export function mountAlgorithmHelp(root, definition) {
  const document = root.ownerDocument;
  if (!document?.createElement || !document.body)
    return { refresh() {}, destroy() {} };
  const tip = document.createElement("div");
  tip.className = "algorithm-help-tooltip";
  tip.id = "algorithm-help-tooltip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  document.body.append(tip);
  let anchor = null,
    pinned = false,
    timer;
  const target = (event) => {
    const element = event.target.closest?.(
      "[data-algo-symbol],[data-algo-note]",
    );
    return element && root.contains(element) ? element : null;
  };
  function cancel() {
    clearTimeout(timer);
  }
  function hide() {
    cancel();
    anchor?.removeAttribute("aria-describedby");
    anchor = null;
    pinned = false;
    tip.hidden = true;
  }
  function show(element) {
    const message =
      element.dataset.algoNote || definition(element.dataset.algoSymbol);
    if (!message) return;
    cancel();
    if (anchor !== element) {
      anchor?.removeAttribute("aria-describedby");
      pinned = false;
    }
    anchor = element;
    tip.textContent = message;
    tip.hidden = false;
    element.setAttribute("aria-describedby", tip.id);
    const view = document.defaultView,
      rect = element.getBoundingClientRect();
    const width = view.innerWidth,
      height = view.innerHeight;
    const size = tip.getBoundingClientRect();
    tip.style.left =
      Math.max(8, Math.min(rect.left, width - size.width - 8)) + "px";
    tip.style.top =
      Math.max(
        8,
        rect.bottom + size.height + 8 <= height
          ? rect.bottom + 8
          : rect.top - size.height - 8,
      ) + "px";
  }
  function over(event) {
    const element = target(event);
    if (element && !element.contains(event.relatedTarget) && !pinned)
      show(element);
  }
  function out(event) {
    if (
      !anchor ||
      pinned ||
      anchor.contains(event.relatedTarget) ||
      tip.contains(event.relatedTarget)
    )
      return;
    if (document.activeElement === anchor) return;
    timer = setTimeout(hide, 150);
  }
  function focus(event) {
    const element = target(event);
    if (element) show(element);
  }
  function blur(event) {
    if (anchor && !anchor.contains(event.relatedTarget)) hide();
  }
  function click(event) {
    const element = target(event);
    if (!element) {
      if (!tip.contains(event.target)) hide();
      return;
    }
    if (pinned && anchor === element) hide();
    else {
      show(element);
      pinned = true;
    }
  }
  function key(event) {
    if (event.key === "Escape") hide();
  }
  const handlers = {
    pointerover: over,
    pointerout: out,
    focusin: focus,
    focusout: blur,
  };
  for (const [name, fn] of Object.entries(handlers))
    root.addEventListener(name, fn);
  document.addEventListener("click", click);
  document.addEventListener("keydown", key);
  tip.addEventListener("pointerenter", cancel);
  tip.addEventListener("pointerleave", () => {
    if (!pinned) hide();
  });
  document.defaultView.addEventListener("scroll", hide, true);
  document.defaultView.addEventListener("resize", hide);
  return {
    refresh() {
      hide();
      for (const element of root.querySelectorAll("[data-algo-symbol]")) {
        element.closest(".katex-html")?.removeAttribute("aria-hidden");
        element.setAttribute("tabindex", "0");
        element.setAttribute(
          "aria-label",
          definition(element.dataset.algoSymbol) ?? "",
        );
      }
    },
    destroy() {
      hide();
      for (const [name, fn] of Object.entries(handlers))
        root.removeEventListener(name, fn);
      document.removeEventListener("click", click);
      document.removeEventListener("keydown", key);
      document.defaultView.removeEventListener("scroll", hide, true);
      document.defaultView.removeEventListener("resize", hide);
      tip.remove();
    },
  };
}
