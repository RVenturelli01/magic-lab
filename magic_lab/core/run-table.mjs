import { filterRuns } from "./analysis.mjs";
import { hasGrouping, groupRuns } from "./run-grouping.mjs";
import { fieldLabel } from "./filters.mjs";

// Columns follow the displayed filter fields, even for constant or empty results.
export function workspaceRunTable(dataset, view) {
  const runs = filterRuns(dataset.runs, view);
  const columns = [...new Set(view.filters.map((rule) => rule.field))].map(
    (field) => ({ field, label: fieldLabel(field) }),
  );
  const grouped = hasGrouping(view);
  const groups = grouped ? groupRuns(runs, view, dataset.runs) : [];
  return { runs, columns, groups, grouped };
}
// Restrict group actions to their visible members; retain hidden selections.
export function selectTableRuns(selected, ids, checked) {
  const removed = new Set(ids);
  return checked
    ? [...new Set([...selected, ...ids])]
    : selected.filter((id) => !removed.has(id));
}

export function catalogCounts(
  dataset,
  view,
  table = workspaceRunTable(dataset, view),
  totalGroups,
) {
  const selection = new Set(view.selected);
  const visible = table.runs,
    selected = visible.filter((r) => selection.has(r.id));
  const groups = table.groups,
    groupCount =
      totalGroups ??
      (hasGrouping(view) ? groupRuns(dataset.runs, view).length : 0);
  return {
    runs: selected.length,
    totalRuns: dataset.runs.length,
    groups: groups.filter((g) => g.runs.some((r) => selection.has(r.id)))
      .length,
    totalGroups: groupCount,
  };
}
