import { loadSession, saveSession } from "../view-session.mjs";

const PRESETS = "rl-observatory.presets.v1";

/** Storage errors are visible; they never stop the in-memory workspace. */
export function createPersistence(state, storage, notify) {
  try {
    const stored = JSON.parse(storage.getItem(PRESETS) || "{}");
    for (const kind of ["settings", "style", "export"])
      if (Array.isArray(stored[kind])) state.presets[kind] = stored[kind];
  } catch {
    state.storageOK = false;
  }
  function write(key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
      state.storageOK = true;
      return true;
    } catch {
      state.storageOK = false;
      notify("Storage unavailable", true);
      return false;
    }
  }
  return {
    persistPresets: () => write(PRESETS, state.presets),
    saveCurrentView() {
      if (!state.dataset || !state.view) return;
      try {
        saveSession(storage, state.dataset, state.view, state.expandedGroups);
        state.storageOK = true;
      } catch {
        state.storageOK = false;
      }
    },
    restore() {
      const session = loadSession(storage, state.dataset);
      state.view = session.view;
      state.expandedGroups = new Set(session.expandedGroups);
    },
  };
}
