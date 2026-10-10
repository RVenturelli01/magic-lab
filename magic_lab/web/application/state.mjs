/** Mutable state owned by one application instance. Only view is portable. */
export function createState() {
  return {
    dataset: null,
    view: null,
    storageOK: true,
    chartResults: new Map(),
    expandedGroups: new Set(),
    fieldPickerOpen: false,
    runMetadata: null,
    runPage: 0,
    filterOptionPages: new Map(),
    presets: { settings: [], style: [], export: [] },
    exportMode: "combined",
    plotController: null,
    previewController: null,
    panelController: null,
    panelWidth: null,
  };
}
