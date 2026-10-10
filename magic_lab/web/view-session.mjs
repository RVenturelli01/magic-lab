import { defaultView, normalizeView } from "../core/view.mjs";

const key = (dataset) =>
  "rl-observatory.current-view.v1:" + encodeURIComponent(dataset.id);

export function loadSession(storage, dataset) {
  const fallback = () => {
    const view = defaultView(dataset);
    view.paper.enabled = true;
    return { view, expandedGroups: [] };
  };
  try {
    const raw = storage.getItem(key(dataset));
    if (!raw) return fallback();
    const session = JSON.parse(raw);
    if (session.datasetId !== dataset.id) return fallback();
    return {
      view: normalizeView(session.view, dataset),
      expandedGroups: Array.isArray(session.expandedGroups)
        ? session.expandedGroups.filter((k) => typeof k === "string")
        : [],
    };
  } catch {
    return fallback();
  }
}

export function saveSession(storage, dataset, view, expandedGroups = []) {
  storage.setItem(
    key(dataset),
    JSON.stringify({
      datasetId: dataset.id,
      view,
      expandedGroups: [...expandedGroups],
    }),
  );
}
