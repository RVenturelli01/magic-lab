export function moveCurve(keys, source, target, after = false) {
  if (source === target || !keys.includes(source) || !keys.includes(target))
    return keys;
  const next = keys.filter((key) => key !== source);
  next.splice(next.indexOf(target) + (after ? 1 : 0), 0, source);
  return next;
}
export function mountCurveOrder(root, { reorder }) {
  if (!root) return;
  let dragged = null;
  const cards = () => [...root.querySelectorAll("[data-curve-key]")];
  const clear = () =>
    cards().forEach((card) =>
      card.classList.remove(
        "curve-dragging",
        "curve-drop-before",
        "curve-drop-after",
      ),
    );
  const commit = (keys, key) => {
    reorder(keys);
    [...root.ownerDocument.querySelectorAll("[data-curve-drag]")]
      .find((el) => el.dataset.curveDrag === key)
      ?.focus({ preventScroll: true });
  };
  root.addEventListener("dragstart", (event) => {
    const handle = event.target.closest("[data-curve-drag]");
    if (!handle) return;
    dragged = handle.dataset.curveDrag;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", dragged);
    handle.closest("[data-curve-key]").classList.add("curve-dragging");
  });
  root.addEventListener("dragover", (event) => {
    const card = event.target.closest("[data-curve-key]");
    if (!dragged || !card) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = card.getBoundingClientRect(),
      after = event.clientY > rect.top + rect.height / 2;
    cards().forEach((c) => {
      c.classList.toggle("curve-drop-before", c === card && !after);
      c.classList.toggle("curve-drop-after", c === card && after);
    });
  });
  root.addEventListener("drop", (event) => {
    const card = event.target.closest("[data-curve-key]");
    if (!dragged || !card) return;
    event.preventDefault();
    const key = dragged,
      rect = card.getBoundingClientRect(),
      keys = moveCurve(
        cards().map((c) => c.dataset.curveKey),
        key,
        card.dataset.curveKey,
        event.clientY > rect.top + rect.height / 2,
      );
    dragged = null;
    clear();
    commit(keys, key);
  });
  root.addEventListener("dragend", () => {
    dragged = null;
    clear();
  });
  root.addEventListener("keydown", (event) => {
    const handle = event.target.closest("[data-curve-drag]");
    if (!handle || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const keys = cards().map((c) => c.dataset.curveKey),
      key = handle.dataset.curveDrag,
      index = keys.indexOf(key),
      down = event.key === "ArrowDown",
      target = keys[index + (down ? 1 : -1)];
    if (target) commit(moveCurve(keys, key, target, down), key);
  });
}
