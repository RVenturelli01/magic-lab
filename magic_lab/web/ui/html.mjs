import { xml as esc } from "../../core/text.mjs";
export const panelResizeHandle =
  '<div class="workspace-panel-resize" data-panel-resize role="separator" tabindex="0" aria-label="Panel width" aria-orientation="vertical" title="Drag to resize panel · arrow keys"></div>';
export const option = (value, label, selected) =>
  '<option value="' +
  esc(value) +
  '" ' +
  (value === selected ? "selected" : "") +
  ">" +
  esc(label) +
  "</option>";
export const select = (id, label, values, current) =>
  "<label>" +
  label +
  '<select id="' +
  id +
  '">' +
  values
    .map((v) =>
      option(Array.isArray(v) ? v[0] : v, Array.isArray(v) ? v[1] : v, current),
    )
    .join("") +
  "</select></label>";
export const field = (id, label, value, type = "text") =>
  "<label>" +
  label +
  '<input id="' +
  id +
  '" type="' +
  type +
  '" value="' +
  esc(value) +
  '" ' +
  (type === "number" ? 'min="0"' : "") +
  "></label>";
export const badge = (status) =>
  '<span class="status ' +
  esc(status) +
  '">' +
  esc(status.replaceAll("_", " ")) +
  "</span>";
export function panelActions(kind) {
  return (
    '<div class="paper-header-actions"><button data-action="reset-panel" data-kind="' +
    kind +
    '">Reset</button><button data-action="save-preset" data-kind="' +
    kind +
    '">Save configuration</button></div>'
  );
}
export function commandPanel(kind, title, body, trigger = title) {
  return (
    '<details class="paper-style command-menu" name="workspace-command" data-menu="' +
    kind +
    '"><summary' +
    (trigger !== title ? ' aria-label="' + esc(title) + '"' : "") +
    ">" +
    trigger +
    "</summary>" +
    (kind === "settings" ? panelResizeHandle : "") +
    '<div class="paper-editor"><div class="paper-heading"><strong>' +
    title +
    "</strong>" +
    (kind === "settings"
      ? '<button class="panel-close" data-action="close-settings" aria-label="Close settings panel" title="Close settings panel">&#215;</button>'
      : "") +
    (kind.startsWith("export") ? "" : panelActions(kind)) +
    "</div>" +
    body +
    "</div></details>"
  );
}
