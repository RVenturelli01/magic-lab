import { COLORS, fmt } from "./text.mjs";
import { geometry } from "./chart-geometry.mjs";
import { summaryRows } from "./analysis.mjs";
import { bandHalfWidth, bandLabel } from "./uncertainty.mjs";
export function pdf(result, view, metric, metadata = "") {
  // Dependency-free, single-page vector PDF. Standard Helvetica; ASCII labels in PDF only.
  const b = geometry(result, view),
    commands = [],
    esc = (s) =>
      String(s)
        .replace(/[^\x20-\x7e]/g, "?")
        .replace(/[\\()]/g, "\\$&");
  const line = (x1, y1, x2, y2) =>
    commands.push(x1 + " " + y1 + " m " + x2 + " " + y2 + " l S");
  const label = (x, y, size, s) =>
    commands.push(
      "BT /F1 " + size + " Tf " + x + " " + y + " Td (" + esc(s) + ") Tj ET",
    );
  const px = (x) => x * 0.72 + 30,
    py = (y) => 680 - y * 0.72;
  const color = (hex, fill = false) => {
    const a = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
    commands.push(a.join(" ") + (fill ? " rg" : " RG"));
  };
  label(40, 748, 19, "RL Observatory / " + metric.phase + " / " + metric.label);
  label(
    40,
    725,
    9,
    (view.chartSeries === "runs"
      ? "Individual runs; smoothing window "
      : "Mean across runs; " + bandLabel(view.band) + "; smoothing window ") +
      view.window +
      " observations; " +
      view.alignment +
      " steps; incomplete: " +
      view.incomplete,
  );
  label(40, 710, 9, "X: " + metric.xUnit + " | Y: " + metric.unit);
  commands.push(".7 w");
  for (let i = 0; i <= 4; i++) {
    const v = b.ymin + ((b.ymax - b.ymin) * i) / 4;
    commands.push(".9 G");
    line(px(b.left), py(b.y(v)), px(970), py(b.y(v)));
    commands.push("0 g");
    label(35, py(b.y(v)) - 3, 8, fmt(v));
  }
  for (let i = 0; i <= 5; i++) {
    const v = b.xmin + ((b.xmax - b.xmin) * i) / 5;
    label(px(b.x(v)) - 12, 415, 8, fmt(v));
  }
  commands.push(
    "q",
    px(b.left) +
      " " +
      py(b.H - b.bottom) +
      " " +
      (b.W - b.left - b.right) * 0.72 +
      " " +
      (b.H - b.top - b.bottom) * 0.72 +
      " re W n",
  );
  result.groups.forEach((g, i) => {
    const hue = COLORS[(g.colorIndex ?? i) % COLORS.length];
    if (view.band !== "none") {
      const pale =
        "#" +
        [1, 3, 5]
          .map((k) =>
            Math.round(parseInt(hue.slice(k, k + 2), 16) * 0.18 + 255 * 0.82)
              .toString(16)
              .padStart(2, "0"),
          )
          .join("");
      color(pale, true);
      let seg = [];
      const flush = () => {
        if (seg.length) {
          const vertices = [
            ...seg.map((q) => [
              px(b.x(q.step)),
              py(b.y(q.mean + bandHalfWidth(q, view.band))),
            ]),
            ...seg
              .slice()
              .reverse()
              .map((q) => [
                px(b.x(q.step)),
                py(b.y(q.mean - bandHalfWidth(q, view.band))),
              ]),
          ];
          commands.push(
            vertices.map((p, j) => p.join(" ") + (j ? " l" : " m")).join(" ") +
              " h f",
          );
          seg = [];
        }
      };
      for (const p of g.points) {
        if (bandHalfWidth(p, view.band) === null) flush();
        else seg.push(p);
      }
      flush();
    }
    color(hue);
    commands.push("1.7 w");
    if (g.points.length > 1)
      commands.push(
        g.points
          .map(
            (p, j) =>
              px(b.x(p.step)) + " " + py(b.y(p.mean)) + (j ? " l" : " m"),
          )
          .join(" ") + " S",
      );
    if (g.points.length === 1) {
      const p = g.points[0];
      color(hue, true);
      commands.push(
        px(b.x(p.step)) - 2 + " " + (py(b.y(p.mean)) - 2) + " 4 4 re f",
      );
    }
  });
  commands.push("Q", "0 g");
  result.groups
    .slice(0, 12)
    .forEach((g, i) =>
      label(
        40,
        385 - i * 17,
        9,
        "G" +
          (i + 1) +
          " " +
          g.algorithm +
          " / " +
          g.environment +
          " / seeds " +
          g.runs.map((r) => r.seed).join(",") +
          " / " +
          g.code.commit,
      ),
    );
  label(
    40,
    140,
    9,
    "Last visible step summary (endpoints may differ between groups):",
  );
  summaryRows(result)
    .slice(0, 5)
    .forEach((r, i) =>
      label(
        40,
        123 - i * 15,
        9,
        r.group +
          ": step " +
          r.step +
          "; mean " +
          r.mean +
          "; sample SD " +
          (r.sd === "" ? "undefined" : r.sd) +
          "; n=" +
          r.n,
      ),
    );
  label(
    40,
    30,
    8,
    "Full data, group configurations and view settings are in the accompanying reproduction.json.",
  );
  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream",
    "<< /Subject (" + esc(metadata) + ") /Creator (RL Observatory) >>",
  ];
  let out = "%PDF-1.4\n",
    offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += i + 1 + " 0 obj\n" + o + "\nendobj\n";
  });
  const pos = out.length;
  out +=
    "xref\n0 " +
    (objects.length + 1) +
    "\n0000000000 65535 f \n" +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("") +
    "trailer\n<< /Size " +
    (objects.length + 1) +
    " /Root 1 0 R /Info 6 0 R >>\nstartxref\n" +
    pos +
    "\n%%EOF";
  return new TextEncoder().encode(out);
}
