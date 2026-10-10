import { workspaceRunTable } from "../../core/run-table.mjs";
import { groupRuns, hasGrouping } from "../../core/run-grouping.mjs";
import { filterFields, ablationFilterFields } from "../../core/filters.mjs";

// Validated datasets are replaced on reload. Keep metadata scoped to this instance.
export function runMetadata(state) {
  if (state.runMetadata?.dataset === state.dataset) return state.runMetadata;
  const fields = filterFields(state.dataset.runs);
  const artifacts = new Map();
  for (const artifact of state.dataset.artifacts) {
    if (!artifacts.has(artifact.runId)) artifacts.set(artifact.runId, []);
    artifacts.get(artifact.runId).push(artifact);
  }
  state.runMetadata = {
    dataset: state.dataset,
    fields,
    filters: ablationFilterFields(state.dataset.runs, fields),
    artifacts,
  };
  return state.runMetadata;
}

export function runCatalogue(state) {
  const metadata = runMetadata(state);
  const signature = JSON.stringify([
    state.view.filters,
    state.view.runGrouping,
  ]);
  if (metadata.catalogue?.signature === signature) return metadata.catalogue;
  const table = workspaceRunTable(state.dataset, state.view);
  if (metadata.grouping !== state.view.runGrouping) {
    metadata.grouping = state.view.runGrouping;
    metadata.totalGroups = hasGrouping(state.view)
      ? groupRuns(state.dataset.runs, state.view).length
      : 0;
  }
  metadata.catalogue = {
    signature,
    table,
    totalGroups: metadata.totalGroups,
    titleFields:
      table.grouped && table.groups.some((g) => g.name == null)
        ? filterFields(table.runs)
        : [],
  };
  return metadata.catalogue;
}
