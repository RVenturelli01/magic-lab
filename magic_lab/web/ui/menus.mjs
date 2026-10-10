import { plotAxes } from "../../core/plot-axes.mjs";
import { paperEditor } from "../paper-editor.mjs";
import { paperSeries } from "../../core/paper-style.mjs";
import { filterFields } from "../../core/filters.mjs";
import { xml as esc } from "../../core/text.mjs";
import { select, commandPanel, panelActions } from "./html.mjs";
export function presetMenu(state, kind) {
  return (
    '<details data-paper-section="' +
    kind +
    ' presets"><summary>Saved configurations</summary><div class="paper-fields">' +
    (state.presets[kind].length
      ? state.presets[kind]
          .map(
            (p, i) =>
              '<div class="saved-option"><button data-action="load-preset" data-kind="' +
              kind +
              '" data-index="' +
              i +
              '">' +
              esc(p.name) +
              '</button><button data-action="delete-preset" data-kind="' +
              kind +
              '" data-index="' +
              i +
              '" aria-label="Delete ' +
              esc(p.name) +
              '">&#215;</button></div>',
          )
          .join("")
      : "<p>No saved configurations</p>") +
    "</div></details>"
  );
}

export function controls(state) {
  const uncertainty =
    state.view.workspaceMode !== "tables" && state.view.chartSeries !== "runs"
      ? select(
          "band",
          "UNCERTAINTY",
          [
            ["ci95", "95% CI (Student t)"],
            ["sd", "±1 STD"],
            ["sd2", "±2 STD"],
            ["sd3", "±3 STD"],
            ["none", "None"],
          ],
          state.view.band,
        )
      : "";
  const statistics =
    '<div class="settings">' +
    '<label>SMOOTHING<input id="window" type="number" min="1" max="50" step="1" value="' +
    esc(state.view.window) +
    '"></label>' +
    uncertainty +
    "</div>";
  return commandPanel(
    "settings",
    "Settings",
    '<details open data-paper-section="Data &amp; statistics"><summary>Data &amp; statistics</summary>' +
      statistics +
      "</details>" +
      curveVisibility(state) +
      presetMenu(state, "settings"),
  );
}
export function curveVisibility(state) {
  if (state.view.workspaceMode === "tables") return "";
  const series = [
    ...new Map(
      [...state.chartResults.values()].flatMap((c) =>
        c.result.groups.map((g, i) => {
          const s = paperSeries(g, i, state.view);
          return [s.key, s];
        }),
      ),
    ).values(),
  ];
  return (
    '<details data-paper-section="Visible runs"><summary>Visible runs</summary><div class="curve-visibility-list">' +
    series
      .map(
        (s) =>
          '<label class="curve-visibility-row"><input type="checkbox" data-paper-scope="series" data-paper-key="hidden" data-paper-id="' +
          esc(s.key) +
          '" data-curve-visible aria-label="Show ' +
          esc(s.originalLabel) +
          '" ' +
          (!s.hidden ? "checked" : "") +
          '><i class="swatch" aria-hidden="true" style="background:' +
          s.color +
          '"></i><span>' +
          esc(s.originalLabel) +
          "</span></label>",
      )
      .join("") +
    "</div></details>"
  );
}
export function styleMenu(state) {
  return paperEditor(state.view, [...state.chartResults.values()], {
    presets: presetMenu(state, "style"),
    headerActions: panelActions("style"),
  });
}
export function mainNavigation(state) {
  const active = state.view.tab === "runs" ? "runs" : state.view.workspaceMode;
  return (
    '<nav class="nav" aria-label="Main navigation">' +
    [
      ["runs", "Runs"],
      ["charts", "Charts"],
      ["ablation", "Ablations"],
      ["tables", "Tables"],
    ]
      .map(
        ([tab, label]) =>
          '<button data-action="tab" data-tab="' +
          tab +
          '" class="' +
          (active === tab ? "active" : "") +
          '" ' +
          (active === tab ? 'aria-current="page"' : "") +
          ">" +
          label +
          "</button>",
      )
      .join("") +
    "</nav>"
  );
}
export function exportMenu(state, metricId) {
  const formats = ["png", "svg", "pdf", "csv", "latex"];
  const tables = state.view.workspaceMode === "tables";
  const downloadMode = metricId
    ? ""
    : '<label>Download as<select data-export-mode><option value="combined" ' +
      (state.exportMode === "combined" ? "selected" : "") +
      ">One file with all " +
      (tables ? "metrics" : "charts") +
      '</option><option value="separate" ' +
      (state.exportMode === "separate" ? "selected" : "") +
      ">Separate files per " +
      (tables ? "metric" : "chart") +
      "</option></select></label>";
  const body =
    '<div class="paper-fields">' +
    downloadMode +
    "<p>Choose a format</p>" +
    formats
      .map(
        (format) =>
          '<button data-action="export" data-format="' +
          format +
          '" ' +
          (metricId ? 'data-metric="' + esc(metricId) + '"' : "") +
          ">" +
          format.toUpperCase() +
          "</button>",
      )
      .join("") +
    "</div>";
  return metricId
    ? commandPanel("export-chart", "Export chart", body, "&#8943;")
    : commandPanel("export", "Export", body);
}
export function workspaceToolbar(state) {
  const mode = state.view.workspaceMode,
    metrics =
      mode === "ablation"
        ? select(
            "ablationMetric",
            "Plot:",
            state.dataset.metrics.map((m) => [
              m.id,
              m.phase + " \u00b7 " + m.label,
            ]),
            state.view.ablationMetric,
          )
        : '<details class="metric-menu command-menu" name="workspace-command" data-menu="metrics"><summary>' +
          (mode === "tables"
            ? "Metrics \u00b7 " + state.view.charts.length
            : "Plots") +
          '</summary><div class="option-menu"><div class="menu-label">' +
          (mode === "tables" ? "Displayed metrics" : "Available plots") +
          '</div><div class="metric-picks" role="group" aria-label="' +
          (mode === "tables" ? "Metrics" : "Plots") +
          '">' +
          state.dataset.metrics
            .map((m) => {
              const selected = state.view.charts.some(
                (id) => plotAxes(state.view, id).y === m.id,
              );
              return (
                '<button class="chart-chip ' +
                (selected ? "selected" : "") +
                '" aria-pressed="' +
                selected +
                '" data-action="' +
                "toggle-chart" +
                '" data-metric="' +
                esc(m.id) +
                '"><span aria-hidden="true">' +
                (selected ? "☑" : "☐") +
                "</span> " +
                esc(m.phase + " · " + m.label) +
                "</button>"
              );
            })
            .join("") +
          "</div></div></details>";
  const fields = filterFields(state.dataset.runs)
    .filter(
      (f) =>
        !["/id", "/name", "/seed"].includes(f.field) &&
        (f.field.startsWith("/config/") || f.options.length > 1),
    )
    .map((f) => [f.field, f.label]);
  const grid =
    mode === "ablation"
      ? select(
          "ablationRow",
          "ROWS",
          [
            ["", "All"],
            ...fields.filter((f) => f[0] !== state.view.ablationColumn),
          ],
          state.view.ablationRow,
        ) +
        select(
          "ablationColumn",
          "COLUMNS",
          [
            ["", "All"],
            ...fields.filter((f) => f[0] !== state.view.ablationRow),
          ],
          state.view.ablationColumn,
        )
      : "";
  return (
    '<div class="workspace-toolbar" data-workspace-mode="' +
    esc(mode) +
    '" role="group" aria-label="Analysis controls"><div class="workspace-tools">' +
    metrics +
    '</div><div class="workspace-settings-actions">' +
    (mode !== "tables"
      ? '<button id="latexPreview" data-action="toggle-latex-preview" aria-pressed="' +
        (state.view.displayMode === "latex") +
        '" class="' +
        (state.view.displayMode === "latex" ? "active" : "") +
        '">LaTeX preview</button>'
      : "") +
    controls(state) +
    styleMenu(state) +
    exportMenu(state) +
    "</div>" +
    (grid ? '<div class="ablation-controls">' + grid + "</div>" : "") +
    "</div>"
  );
}
