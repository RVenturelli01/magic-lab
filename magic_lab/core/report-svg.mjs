import { COLORS, xml, fmt } from "./text.mjs";
import { geometry } from "./chart-geometry.mjs";
import { bandHalfWidth, bandLabel } from "./uncertainty.mjs";
const tickLabel = (value, span) =>
  Math.abs(value) > 0 && (Math.abs(value) < 0.001 || Math.abs(value) >= 1e6)
    ? value.toExponential(1)
    : Number(
        value.toFixed(
          Math.min(6, Math.max(0, 2 - Math.floor(Math.log10(span || 1)))),
        ),
      ).toLocaleString("en-US", { maximumFractionDigits: 6 });
export function chartSVG(result, view, metric, metadata = "") {
  const b = geometry(result, view),
    parts = [],
    font = 12;
  const clip =
    "clip-" +
    String(view.plotId ?? metric.id).replace(/[^a-zA-Z0-9_-]/g, "-") +
    "-" +
    b.W +
    "-" +
    b.H;
  parts.push(
    '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
      xml(metric.label + " by " + metric.xUnit) +
      '" viewBox="0 0 ' +
      b.W +
      " " +
      b.H +
      '" width="' +
      b.W +
      '" height="' +
      b.H +
      '"><metadata>' +
      xml(metadata) +
      '</metadata><rect width="' +
      b.W +
      '" height="' +
      b.H +
      '" fill="white"/><defs><clipPath id="' +
      clip +
      '"><rect x="' +
      b.left +
      '" y="' +
      b.top +
      '" width="' +
      (b.W - b.left - b.right) +
      '" height="' +
      (b.H - b.top - b.bottom) +
      '"/></clipPath></defs>',
  );
  const ny = Math.max(
      1,
      Math.min(7, Math.floor((b.H - b.top - b.bottom) / 55)),
    ),
    nx = Math.max(1, Math.min(7, Math.floor((b.W - b.left - b.right) / 85)));
  for (let i = 0; i <= ny; i++) {
    const value = b.ymin + ((b.ymax - b.ymin) * i) / ny,
      y = b.y(value);
    parts.push(
      '<line x1="' +
        b.left +
        '" y1="' +
        y +
        '" x2="' +
        (b.W - b.right) +
        '" y2="' +
        y +
        '" stroke="#e9eeea"/><text x="' +
        (b.left - 8) +
        '" y="' +
        (y + 4) +
        '" text-anchor="end" font-family="Arial" font-size="' +
        font +
        '" fill="#718075">' +
        tickLabel(value, b.ymax - b.ymin) +
        "</text>",
    );
  }
  for (let i = 0; i <= nx; i++) {
    const value = b.xmin + ((b.xmax - b.xmin) * i) / nx,
      x = b.x(value);
    parts.push(
      '<line x1="' +
        x +
        '" y1="' +
        b.top +
        '" x2="' +
        x +
        '" y2="' +
        (b.H - b.bottom) +
        '" stroke="#eef1ee"/><text x="' +
        x +
        '" y="' +
        (b.H - b.bottom + 20) +
        '" text-anchor="middle" font-family="Arial" font-size="' +
        font +
        '" fill="#718075">' +
        tickLabel(value, b.xmax - b.xmin) +
        "</text>",
    );
  }
  parts.push(
    '<text x="' +
      (b.left + b.W - b.right) / 2 +
      '" y="' +
      (b.H - 8) +
      '" text-anchor="middle" font-family="Arial" font-size="' +
      font +
      '" fill="#596d60">' +
      xml(metric.xUnit) +
      '</text><text transform="translate(15 ' +
      (b.top + b.H - b.bottom) / 2 +
      ') rotate(-90)" text-anchor="middle" font-family="Arial" font-size="' +
      font +
      '" fill="#596d60">' +
      xml(metric.unit) +
      "</text>",
  );
  if (b.ymin < 0 && b.ymax > 0)
    parts.push(
      '<line x1="' +
        b.left +
        '" x2="' +
        (b.W - b.right) +
        '" y1="' +
        b.y(0) +
        '" y2="' +
        b.y(0) +
        '" stroke="#adb8af"/>',
    );
  parts.push('<g clip-path="url(#' + clip + ')">');
  result.groups.forEach((g, i) => {
    const color = COLORS[(g.colorIndex ?? i) % COLORS.length],
      p = g.points;
    if (view.band !== "none") {
      let segment = [];
      const flush = () => {
        if (segment.length) {
          const polygon = [
            ...segment.map((q) => [
              b.x(q.step),
              b.y(q.mean + bandHalfWidth(q, view.band)),
            ]),
            ...segment
              .slice()
              .reverse()
              .map((q) => [
                b.x(q.step),
                b.y(q.mean - bandHalfWidth(q, view.band)),
              ]),
          ]
            .map((x) => x.join(","))
            .join(" ");
          parts.push(
            '<polygon points="' +
              polygon +
              '" fill="' +
              color +
              '" opacity=".13"/>',
          );
          segment = [];
        }
      };
      for (const q of p) {
        if (bandHalfWidth(q, view.band) === null) flush();
        else segment.push(q);
      }
      flush();
    }
    parts.push(
      '<polyline fill="none" stroke="' +
        color +
        '" stroke-width="2" stroke-linejoin="round" points="' +
        p.map((q) => b.x(q.step) + "," + b.y(q.mean)).join(" ") +
        '"/>',
    );
    p.forEach((q) =>
      parts.push(
        '<circle cx="' +
          b.x(q.step) +
          '" cy="' +
          b.y(q.mean) +
          '" r="' +
          (p.length === 1 ? 4 : 2.5) +
          '" fill="' +
          color +
          '"><title>' +
          xml(
            (g.name ?? g.algorithm) +
              " | seeds " +
              g.runs.map((r) => r.seed).join(",") +
              " | step " +
              q.step +
              " | mean " +
              fmt(q.mean) +
              " | sample SD " +
              (q.sd === null ? "undefined" : fmt(q.sd)) +
              " | n=" +
              q.n,
          ) +
          "</title></circle>",
      ),
    );
  });
  parts.push("</g>");
  if (!result.groups.some((g) => g.points.length))
    parts.push(
      '<text x="' +
        b.W / 2 +
        '" y="' +
        b.H / 2 +
        '" text-anchor="middle" font-family="Arial" font-size="12" fill="#7c8980">No observations match this view</text>',
    );
  return parts.join("") + "</svg>";
}
export function reportSVG(result, view, metric, metadata = "") {
  const height = 490 + result.groups.length * 24;
  let svg = chartSVG(result, view, metric, metadata)
    .replace(
      'viewBox="0 0 1000 400" width="1000" height="400"',
      'viewBox="0 0 1000 ' + height + '" width="1000" height="' + height + '"',
    )
    .replace(
      '<rect width="1000" height="400"',
      '<rect width="1000" height="' + height + '"',
    );
  const label = (x, y, s, size = 12) =>
    '<text x="' +
    x +
    '" y="' +
    y +
    '" font-family="Arial" font-size="' +
    size +
    '" fill="#344c40">' +
    xml(s) +
    "</text>";
  let footer =
    label(
      85,
      425,
      "RL Observatory / " +
        metric.phase +
        " / " +
        metric.label +
        " (" +
        metric.unit +
        ")",
      17,
    ) +
    label(
      85,
      449,
      view.chartSeries === "runs"
        ? "Individual runs"
        : "Mean across runs" +
            (" · " +
              bandLabel(view.band) +
              (view.band === "ci95"
                ? "; pointwise interval."
                : "; n−1 sample SD.")) +
            " SD undefined for n=1.",
    ) +
    label(
      85,
      470,
      "Trailing window: " +
        view.window +
        " observations; " +
        view.alignment +
        " steps; incomplete runs: " +
        view.incomplete +
        ".",
    );
  result.groups.forEach((g, i) => {
    footer +=
      '<line x1="85" x2="110" y1="' +
      (489 + i * 24) +
      '" y2="' +
      (489 + i * 24) +
      '" stroke="' +
      COLORS[(g.colorIndex ?? i) % COLORS.length] +
      '" stroke-width="3"/>' +
      label(
        120,
        494 + i * 24,
        "G" +
          (i + 1) +
          " · " +
          g.algorithm +
          " · " +
          g.environment +
          " · seeds " +
          g.runs.map((r) => r.seed).join(", ") +
          " · " +
          g.code.commit +
          (g.code.dirty ? " (dirty)" : ""),
      );
  });
  return svg.replace("</svg>", footer + "</svg>");
}
