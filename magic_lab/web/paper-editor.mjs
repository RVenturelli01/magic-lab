import {
  normalizePaper,
  paperSeries,
  PAPER_LIMITS,
  setPaperLegend,
} from "../core/paper-style.mjs";
import { xml } from "../core/text.mjs";
import { panelResizeHandle } from "./ui/html.mjs";
const input = (
  label,
  key,
  value,
  {
    scope = "global",
    id = "",
    type = "number",
    options,
    step = "any",
    wide = false,
  } = {},
) => {
  const attrs =
    ' data-paper-scope="' +
    scope +
    '" data-paper-key="' +
    key +
    '" data-paper-id="' +
    xml(id) +
    '"';
  return (
    '<label class="' +
    (wide ? "style-field-wide " : "") +
    (type === "checkbox" ? "style-checkbox" : "") +
    '"><span>' +
    xml(label) +
    "</span>" +
    (options
      ? "<select" +
        attrs +
        ">" +
        options
          .map((v) => {
            const [val, title] = Array.isArray(v) ? v : [v, v];
            return (
              "<option " +
              (val === "" ? "disabled " : "") +
              'value="' +
              xml(val) +
              '" ' +
              (String(val) === String(value) ? "selected" : "") +
              ">" +
              xml(title) +
              "</option>"
            );
          })
          .join("") +
        "</select>"
      : "<input" +
        attrs +
        ' type="' +
        type +
        '" ' +
        (type === "checkbox"
          ? value
            ? "checked"
            : ""
          : 'value="' + xml(value ?? "") + '"') +
        (type === "number"
          ? ' step="' +
            step +
            '"' +
            (scope === "global" && PAPER_LIMITS[key]
              ? ' min="' +
                PAPER_LIMITS[key][0] +
                '" max="' +
                PAPER_LIMITS[key][1] +
                '"'
              : "")
          : "") +
        ">") +
    "</label>"
  );
};
function seriesFields(s) {
  const opts = { scope: "series", id: s.key };
  return (
    input("Legend label", "label", s.label, { ...opts, type: "text" }) +
    input("Color", "color", s.color, { ...opts, type: "color" }) +
    input("Marker", "marker", s.marker, {
      ...opts,
      options: ["none", "circle", "square", "diamond", "triangle-up", "cross"],
    }) +
    input("Line", "dash", s.dash, {
      ...opts,
      options: ["solid", "dash", "dot", "dashdot", "none"],
    })
  );
}
export function paperEditor(
  view,
  charts,
  { statistics = "", presets = "", headerActions = "" } = {},
) {
  const p = normalizePaper(view.paper),
    field = (label, key, opts) =>
      input(
        label,
        key,
        key === "legend" && Object.keys(p.legendPositions).length ? "" : p[key],
        opts,
      ),
    section = (title, body, wide = false) =>
      '<details class="style-section' +
      (wide ? " style-section-wide" : "") +
      '" data-paper-section="' +
      xml(title) +
      '"><summary>' +
      title +
      '</summary><div class="paper-fields">' +
      body +
      "</div></details>";
  const group = (title, body) =>
    '<div class="style-field-group"><div class="style-group-title">' +
    xml(title) +
    '</div><div class="paper-fields">' +
    body +
    "</div></div>";
  const numbers = (items) =>
    items.map(([key, label]) => field(label, key)).join("");
  const metrics = [
    ...new Map(charts.map((c) => [c.metric.id, c.metric])).values(),
  ];
  const series = [
    ...new Map(
      charts.flatMap((c) =>
        c.result.groups.map((g, i) => {
          const s = paperSeries(g, i, view);
          return [s.key, s];
        }),
      ),
    ).values(),
  ].sort((a, b) => b.order - a.order);
  const font = field("Font family", "font", {
    wide: true,
    options: [
      ["computer-modern", "Computer Modern / serif"],
      ["times", "Times"],
      ["sans", "Sans serif"],
    ],
  });
  const typography = section(
    "Typography",
    font +
      numbers([
        ["fontSize", "Base (pt)"],
        ["titleSize", "Title (pt)"],
        ["labelSize", "Axis labels (pt)"],
        ["tickSize", "Ticks (pt)"],
        ["legendSize", "Legend (pt)"],
      ]),
  );
  const axes = section(
    "Axes",
    field("Grid", "grid", { type: "checkbox" }) +
      field("Box", "box", { type: "checkbox" }) +
      field("Stroke (pt)", "axisWidth") +
      field("Tick direction", "tickDirection", { options: ["out", "in"] }),
  );
  const lines = section(
    "Lines & uncertainty",
    group(
      "Line & markers",
      field("Line width (pt)", "lineWidth") +
        field("Marker", "marker", {
          options: [
            "none",
            "circle",
            "square",
            "diamond",
            "triangle-up",
            "cross",
          ],
        }) +
        field("Marker size (pt)", "markerSize") +
        field("Every N points", "markerEvery"),
    ) +
      group(
        "Uncertainty",
        field("Display", "uncertainty", {
          wide: true,
          options: [
            ["bars", "Error bars"],
            ["band", "Shaded band"],
            ["none", "None"],
          ],
        }) +
          field("Bar width (pt)", "errorWidth") +
          field("Cap size (pt)", "errorCap") +
          field("Every N points", "errorEvery") +
          field("Band opacity", "bandOpacity"),
      ) +
      "<p>SD / CI follows Settings. Group by Seeds to compare means.</p>",
  );
  const legend = section(
    "Legend",
    field("Position", "legend", {
      wide: true,
      options: [
        ...(Object.keys(p.legendPositions).length
          ? [["", "Individual positions: choose for all"]]
          : []),
        "upper right",
        "upper left",
        "lower right",
        "lower left",
        "outside right",
        "none",
      ],
    }) +
      field("Columns", "legendColumns") +
      field("Opacity", "legendOpacity") +
      field("Show frame", "legendFrame", { type: "checkbox" }),
  );
  const labels = section(
    "Labels & ranges",
    metrics
      .map((m) => {
        const settings = p.metrics[m.id] ?? {},
          opts = { scope: "metric", id: m.id };
        const metricField = (label, key, fallback = "", extra = {}) =>
          input(label, key, settings[key] ?? fallback, { ...opts, ...extra });
        const axisFields = (axis, fallback) =>
          group(
            axis.toUpperCase() + " axis · " + fallback,
            metricField("Label", axis + "label", fallback, {
              type: "text",
              wide: true,
            }) +
              metricField("Min", axis + "min") +
              metricField("Max", axis + "max") +
              metricField("Tick interval", axis + "Tick") +
              metricField("Number format", axis + "NumberFormat", "auto", {
                options: [
                  ["auto", "Automatic"],
                  ["full", "20000"],
                  ["compact", "20k"],
                  ["power", "20 ×10³"],
                ],
              }),
          );
        return (
          '<fieldset class="style-metric"><legend>' +
          xml(m.xMetric ? m.label + " vs " + m.xUnit : m.label) +
          '</legend><div class="paper-fields">' +
          metricField("Title", "title", "", { type: "text" }) +
          metricField("Panel caption", "panelCaption", "", { type: "text" }) +
          '<div class="style-axis-pair">' +
          axisFields("x", m.xUnit) +
          axisFields("y", m.label + " (" + m.unit + ")") +
          "</div>" +
          "<p>Blank numeric fields use automatic values.</p></div></fieldset>"
        );
      })
      .join(""),
    true,
  );
  const curves = section(
    "Curves",
    "<p>Drag names or use &#8593; / &#8595; to reorder. Top = foreground.</p>" +
      series
        .map(
          (s) =>
            '<fieldset data-curve-key="' +
            xml(s.key) +
            '"><legend><span draggable="true" tabindex="0" role="button" data-curve-drag="' +
            xml(s.key) +
            '" aria-label="Reorder ' +
            xml(s.originalLabel) +
            '" title="Drag or use Up / Down to reorder">' +
            xml(s.originalLabel) +
            '</span></legend><div class="paper-fields curve-fields">' +
            seriesFields(s) +
            "</div></fieldset>",
        )
        .join(""),
    true,
  );
  const layout = section(
    "Export size & layout",
    group(
      "Panel size",
      numbers([
        ["width", "Width (cm)"],
        ["height", "Height (cm)"],
        ["columns", "Columns"],
        ["dpi", "PNG / PDF DPI"],
      ]),
    ) +
      group(
        "Spacing",
        numbers([
          ["gapX", "Horizontal gap (cm)"],
          ["gapY", "Vertical gap (cm)"],
        ]),
      ) +
      group(
        "Margins (cm)",
        numbers([
          ["marginLeft", "Left"],
          ["marginRight", "Right"],
          ["marginTop", "Top"],
          ["marginBottom", "Bottom"],
        ]),
      ) +
      field("Figure caption", "caption", { type: "text", wide: true }) +
      "<p>Export dimensions are independent of card resizing and view zoom.</p>",
    true,
  );
  const styleSections =
    view.workspaceMode === "tables"
      ? section(
          "Table style",
          font +
            numbers([
              ["fontSize", "Font size (pt)"],
              ["dpi", "PNG / PDF DPI"],
            ]) +
            field("Table caption", "caption", { type: "text", wide: true }) +
            "<p>Dimensions follow the content.</p>",
          true,
        )
      : typography + axes + lines + legend + labels + curves + layout;
  return (
    '<details class="paper-style chart-settings command-menu" data-menu="style" name="workspace-command"><summary>Style</summary>' +
    panelResizeHandle +
    '<div class="paper-editor"><div class="paper-heading"><strong>' +
    (view.workspaceMode === "tables" ? "Table style" : "Chart style") +
    '</strong><button class="panel-close" data-action="close-settings" aria-label="Close style panel" title="Close style panel">×</button>' +
    headerActions +
    "</div>" +
    '<div class="style-sections">' +
    styleSections +
    "</div>" +
    presets +
    "</div></details>"
  );
}
export function applyPaperInput(view, target) {
  const p = structuredClone(normalizePaper(view.paper)),
    { paperScope: scope, paperKey: key, paperId: id } = target.dataset;
  const value =
    target.type === "checkbox"
      ? target.dataset.curveVisible !== undefined
        ? !target.checked
        : target.checked
      : target.type === "number"
        ? target.value === ""
          ? ""
          : Number(target.value)
        : target.value;
  if (scope === "global") {
    if (!Object.hasOwn(p, key) || ["metrics", "series"].includes(key))
      throw Error("Unknown chart setting");
    p[key] = value;
    if (key === "legend") {
      p.enabled = true;
      return { ...view, paper: setPaperLegend(p, value) };
    }
  } else if (scope === "metric" || scope === "series") {
    const map = scope === "metric" ? "metrics" : "series";
    p[map][id] = { ...p[map][id], [key]: value };
  } else throw Error("Unknown chart setting scope");
  p.enabled = true;
  const chartRanges = { ...view.chartRanges };
  if (scope === "metric") delete chartRanges[id];
  return { ...view, chartRanges, paper: normalizePaper(p) };
}
