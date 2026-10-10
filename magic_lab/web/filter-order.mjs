export function moveFilter(filters, field, target) {
  const from = filters.findIndex((rule) => rule.field === field),
    to = filters.findIndex((rule) => rule.field === target);
  if (from < 0 || to < 0 || from === to) return filters;
  const next = [...filters],
    moved = next.splice(from, 1)[0];
  next.splice(to, 0, moved);
  return next;
}

export function mountFilterOrder(root, { getFilters, reorder }) {
  if (!root) return;
  let dragged = null;
  const cards = () => [...root.querySelectorAll(".filter-rule")];
  const clear = () =>
    cards().forEach((card) => card.classList.remove("dragging", "drop-target"));
  root.addEventListener("dragstart", (event) => {
    const handle = event.target.closest("[data-filter-drag]");
    if (!handle) return;
    dragged = handle.dataset.filterDrag;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", dragged);
    handle.closest(".filter-rule").classList.add("dragging");
  });
  root.addEventListener("dragover", (event) => {
    const card = event.target.closest(".filter-rule");
    if (!dragged || !card || card.dataset.filterField === dragged) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    cards().forEach((c) => c.classList.toggle("drop-target", c === card));
  });
  root.addEventListener("drop", (event) => {
    const card = event.target.closest(".filter-rule");
    if (!dragged || !card) return;
    event.preventDefault();
    const field = dragged,
      filters = moveFilter(getFilters(), field, card.dataset.filterField);
    dragged = null;
    clear();
    reorder(filters, field);
  });
  root.addEventListener("dragend", () => {
    dragged = null;
    clear();
  });
  root.addEventListener("keydown", (event) => {
    const handle = event.target.closest("[data-filter-drag]");
    if (
      !handle ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    const filters = getFilters(),
      field = handle.dataset.filterDrag,
      index = filters.findIndex((rule) => rule.field === field);
    const target =
      filters[index + (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1)];
    if (target) reorder(moveFilter(filters, field, target.field), field);
  });
}
