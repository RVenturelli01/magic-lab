import { groupingOptions } from "../../core/run-grouping.mjs";
import { workspaceRunTable, catalogCounts } from "../../core/run-table.mjs";
import {
  filterFields,
  ablationFilterFields,
  fieldOptions,
  fieldLabel,
  fieldValue,
  valueLabel,
  valueKey,
} from "../../core/filters.mjs";
import { xml as esc } from "../../core/text.mjs";
import { select, badge } from "./html.mjs";
const PAGE_SIZE = 100;
function pageControls(action, page, total, size, field = "") {
  if (total <= size) return "";
  const pages = Math.ceil(total / size);
  return (
    '<div class="actions" role="group" aria-label="' +
    (action === "run-page"
      ? "Catalogue pages"
      : esc(fieldLabel(field)) + " value pages") +
    '">' +
    [
      ["previous", page - 1, page === 0],
      ["next", page + 1, page === pages - 1],
    ]
      .map(
        ([direction, target, disabled]) =>
          '<button data-action="' +
          action +
          '" data-direction="' +
          direction +
          '" data-page="' +
          target +
          '" data-field="' +
          esc(field) +
          '" ' +
          (disabled ? "disabled" : "") +
          ' aria-label="' +
          (direction === "previous" ? "Previous page" : "Next page") +
          '">' +
          (direction === "previous" ? "&#8592;" : "&#8594;") +
          "</button>",
      )
      .join("") +
    '<span class="small" role="status">' +
    (page + 1) +
    "/" +
    pages +
    " &middot; " +
    total +
    (action === "run-page" ? " rows" : " values") +
    "</span></div>"
  );
}
function filterPicker(fields) {
  return (
    '<div class="field-picker" id="extra-filter-picker" role="group" aria-label="Add filters">' +
    fields
      .map(
        (f) =>
          '<button data-action="add-filter" data-field="' +
          esc(f.field) +
          '">' +
          esc(f.label) +
          "</button>",
      )
      .join("") +
    "</div>"
  );
}
export function filters(state) {
  const fields =
    state.runMetadata?.filters ?? ablationFilterFields(state.dataset.runs);
  const available = fields.filter(
    (f) => !state.view.filters.some((rule) => rule.field === f.field),
  );
  const rules = state.view.filters
    .map((rule, index) => {
      const f = { field: rule.field, label: fieldLabel(rule.field) };
      const values = [
        ...(state.runMetadata?.fields.find((f) => f.field === rule.field)
          ?.options ?? fieldOptions(state.dataset.runs, rule.field)),
      ];
      for (const key of rule.values)
        if (!values.some((v) => v.key === key)) {
          const parsed = JSON.parse(key);
          values.push({
            key,
            label: parsed.value?.legacyNoMatch
              ? "(no matches)"
              : (parsed.missing ? "(missing)" : valueLabel(parsed.value)) +
                " (unavailable)",
          });
        }
      const page = Math.max(
        0,
        Math.min(
          state.filterOptionPages?.get(rule.field) ?? 0,
          Math.ceil(values.length / 60) - 1,
        ),
      );
      const selectedValues = new Set(rule.values);
      return (
        '<div class="filter-rule" data-filter-field="' +
        esc(rule.field) +
        '"><div class="filter-rule-head"><button class="filter-drag" draggable="true" data-filter-drag="' +
        esc(rule.field) +
        '" aria-label="Move ' +
        esc(f.label) +
        ' filter" title="Drag name to reorder filters; use arrow keys">' +
        esc(f.label) +
        "</button>" +
        '<button class="filter-remove" aria-label="Remove ' +
        esc(f.label) +
        ' filter" data-action="remove-filter" data-index="' +
        index +
        '">×</button>' +
        '</div><div class="filter-options" role="group" aria-label="' +
        esc(f.label) +
        '">' +
        values
          .slice(page * 60, (page + 1) * 60)
          .map(
            (value) =>
              '<button class="filter-chip ' +
              (selectedValues.has(value.key) ? "selected" : "") +
              '" aria-pressed="' +
              selectedValues.has(value.key) +
              '" data-action="toggle-filter-value" data-field="' +
              esc(rule.field) +
              '" data-value="' +
              esc(value.key) +
              '">' +
              esc(value.label) +
              "</button>",
          )
          .join("") +
        "</div>" +
        pageControls("filter-page", page, values.length, 60, rule.field) +
        "</div>"
      );
    })
    .join("");
  return (
    '<div class="card filter-builder"><div class="filter-toolbar"><h2>Filters</h2><div class="actions"><div class="filter-add"><button data-action="toggle-field-picker" aria-controls="extra-filter-picker" aria-expanded="' +
    state.fieldPickerOpen +
    '" ' +
    (!available.length ? "disabled" : "") +
    ">+ Filter</button>" +
    (state.fieldPickerOpen ? filterPicker(available) : "") +
    "</div>" +
    (state.view.filters.some((rule) => rule.values.length)
      ? '<button data-action="reset-filters">Clear</button>'
      : "") +
    "</div></div>" +
    (rules
      ? '<div class="filter-rules">' + rules + "</div>"
      : '<p class="small">Add a filter to narrow the runs</p>') +
    "</div>"
  );
}
export function runs(state, snapshot = {}) {
  const table = snapshot.table ?? workspaceRunTable(state.dataset, state.view),
    filtered = table.runs,
    columns = table.columns;
  const selection = new Set(state.view.selected);
  const hasSeedColumn = columns.some((c) => c.field === "/seed");
  const activeFields = new Set(
    state.view.filters
      .filter((rule) => rule.values.length)
      .map((rule) => rule.field),
  );
  const columnAttrs = (c) =>
    ' data-field="' +
    esc(c.field) +
    '"' +
    (activeFields.has(c.field) ? ' class="filter-active"' : "");
  const cell = (run, column) =>
    column.field === "/status"
      ? badge(run.status)
      : esc(valueLabel(fieldValue(run, column.field)));
  const detail = (r) =>
    "<details><summary>Config & artifacts</summary><pre>" +
    esc(JSON.stringify(r.config, null, 2)) +
    "</pre>" +
    (state.runMetadata
      ? (state.runMetadata.artifacts.get(r.id) ?? [])
      : state.dataset.artifacts.filter((a) => a.runId === r.id)
    )
      .map(
        (a) =>
          '<p class="small">' +
          esc(a.kind) +
          " &middot; " +
          esc(a.label) +
          "<br><code>" +
          esc(a.path) +
          "</code></p>",
      )
      .join("") +
    "</details>";
  const row = (r, child = false) =>
    '<tr class="' +
    (child ? "group-child" : "") +
    '"><td><input aria-label="Select ' +
    esc(r.id) +
    '" class="check" type="checkbox" data-run="' +
    esc(r.id) +
    '" ' +
    (selection.has(r.id) ? "checked" : "") +
    "></td>" +
    columns
      .map((c) => "<td" + columnAttrs(c) + ">" + cell(r, c) + "</td>")
      .join("") +
    '<td><div class="rowtitle">' +
    esc(r.name ?? r.id) +
    "</div>" +
    detail(r) +
    "</td></tr>";
  const titleFields = (
    snapshot.titleFields ??
    (table.grouped && table.groups.some((g) => g.name == null)
      ? filterFields(filtered)
      : [])
  ).filter(
    (f) =>
      (f.field.startsWith("/config/") || f.field.startsWith("/code/")) &&
      !columns.some((c) => c.field === f.field) &&
      f.options.length > 1,
  );
  const seedChips = (group) =>
    '<div class="seed-chips">' +
    group.runs
      .map(
        (run) =>
          '<button class="seed-chip ' +
          (selection.has(run.id) ? "selected" : "") +
          '" data-action="toggle-run" data-run-id="' +
          esc(run.id) +
          '" aria-label="Seed ' +
          run.seed +
          " &middot; " +
          esc(run.id) +
          '" aria-pressed="' +
          selection.has(run.id) +
          '" title="' +
          esc(run.id) +
          '">' +
          run.seed +
          "</button>",
      )
      .join("") +
    "</div>";
  const groupRow = (group, index) => {
    const r = group.runs[0],
      selected = group.runs.filter((run) => selection.has(run.id)).length,
      expanded = state.expandedGroups.has(group.key);
    const title =
      group.name ??
      [
        r.algorithm,
        r.environment,
        ...titleFields.map(
          (f) =>
            f.label.replace(/^Config · /, "") +
            "=" +
            valueLabel(fieldValue(r, f.field)),
        ),
      ].join(" / ");
    const disclosure =
      '<button class="group-disclosure" data-action="expand-group" data-group="' +
      index +
      '" aria-expanded="' +
      expanded +
      '"><span aria-hidden="true">' +
      (expanded ? "&#9662;" : "&#9656;") +
      "</span> " +
      esc(title) +
      "</button>";
    return (
      '<tr class="run-group ' +
      (selected ? "has-selection" : "") +
      '"><td><input class="check" type="checkbox" aria-label="Select group ' +
      esc(title) +
      '" data-group="' +
      index +
      '" data-partial="' +
      (selected > 0 && selected < group.runs.length) +
      '" ' +
      (selected === group.runs.length ? "checked" : "") +
      "></td>" +
      columns
        .map((c) => {
          if (c.field === "/seed")
            return "<td" + columnAttrs(c) + ">" + seedChips(group) + "</td>";
          const values = [
            ...new Set(
              group.runs.map((run) => valueKey(fieldValue(run, c.field))),
            ),
          ];
          return (
            "<td" +
            columnAttrs(c) +
            ">" +
            (values.length === 1
              ? cell(r, c)
              : esc(
                  group.runs
                    .map((run) => valueLabel(fieldValue(run, c.field)))
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .join(" · "),
                )) +
            "</td>"
          );
        })
        .join("") +
      '<td class="group-title">' +
      disclosure +
      (!hasSeedColumn ? seedChips(group) : "") +
      "</td></tr>"
    );
  };
  const selected = filtered.filter((r) => selection.has(r.id)).length;
  const grouping =
    '<div class="grouping-control">' +
    select(
      "runGrouping",
      "GROUP BY",
      groupingOptions(state.dataset.runs, state.runMetadata?.fields),
      state.view.runGrouping,
    ) +
    "</div>";
  const count = catalogCounts(
    state.dataset,
    state.view,
    table,
    snapshot.totalGroups,
  );
  const counts =
    count.runs +
    "/" +
    count.totalRuns +
    " runs · " +
    count.groups +
    "/" +
    count.totalGroups +
    " groups";
  const entries = table.grouped
    ? table.groups.flatMap((group, index) => [
        { group, index },
        ...(state.expandedGroups.has(group.key)
          ? group.runs.map((run) => ({ run, child: true }))
          : []),
      ])
    : filtered.map((run) => ({ run }));
  const page = Math.max(
    0,
    Math.min(state.runPage ?? 0, Math.ceil(entries.length / PAGE_SIZE) - 1),
  );
  const pagination = pageControls("run-page", page, entries.length, PAGE_SIZE);
  return (
    '<div class="card run-catalog"><div class="cardhead"><div><h2>Runs</h2><div class="group-count">' +
    counts +
    '</div></div><div class="actions">' +
    grouping +
    pagination +
    '</div></div><div class="tablewrap"><table><thead><tr><th><input class="check" type="checkbox" aria-label="Select all filtered runs (all pages)" data-visible="true" data-partial="' +
    (selected > 0 && selected < filtered.length) +
    '" ' +
    (filtered.length && selected === filtered.length ? "checked" : "") +
    " " +
    (filtered.length ? "" : "disabled") +
    "></th>" +
    columns
      .map(
        (c) =>
          '<th scope="col"' +
          columnAttrs(c) +
          (activeFields.has(c.field)
            ? ' title="This column is constrained by the selected filter values" aria-label="' +
              esc(c.label) +
              ' (filter active)"'
            : "") +
          ">" +
          esc(c.label) +
          "</th>",
      )
      .join("") +
    "<th>Details</th></tr></thead><tbody>" +
    entries
      .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
      .map((entry) =>
        entry.group
          ? groupRow(entry.group, entry.index)
          : row(entry.run, entry.child),
      )
      .join("") +
    "</tbody></table></div>" +
    (!filtered.length ? '<div class="empty">No runs</div>' : "") +
    "</div>"
  );
}
