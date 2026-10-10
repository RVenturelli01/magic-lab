import { xml, fmt, COLORS } from "./text.mjs";
import { normalizePaper } from "./paper-style.mjs";

const number = (value) =>
  value === null || value === undefined
    ? "—"
    : value !== 0 && Math.abs(value) < 0.01
      ? value.toExponential(2)
      : fmt(value);
const note = "Last visible step · sample SD (n−1) · — = missing or undefined";
export const tableTexText = (value) =>
  String(value)
    .replace(
      /[\\&%$#_{}~^]/g,
      (c) =>
        ({
          "\\": "\\textbackslash{}",
          "~": "\\textasciitilde{}",
          "^": "\\textasciicircum{}",
        })[c] || "\\" + c,
    )
    .replaceAll("−", "$-$")
    .replaceAll("\n", " ");

// One presentation model supplies the browser, vector image and LaTeX exports.
export function tableFigure(table, paper) {
  const p = normalizePaper(paper),
    font =
      p.font === "sans"
        ? "Arial, sans-serif"
        : p.font === "times"
          ? "Times New Roman, serif"
          : "Latin Modern Roman, Computer Modern, Georgia, serif";
  const headers = table.metrics.map((m) => ({
    title: m.phase + " · " + m.label,
    columns: ["Mean ± SD (" + m.unit + ")", "n", "Step (" + m.xUnit + ")"],
  }));
  const rows = table.rows.map((r, i) => ({
    name: r.name,
    environment: r.environment,
    color: COLORS[(r.colorIndex ?? i) % COLORS.length],
    separator:
      i > 0 &&
      (r.environment !== table.rows[i - 1].environment ||
        r.algorithm !== table.rows[i - 1].algorithm),
    cells: table.metrics.flatMap((m) => {
      const q = r.values[m.id];
      return q
        ? [number(q.mean) + " ± " + number(q.sd), String(q.n), number(q.step)]
        : ["—", "—", "—"];
    }),
  }));
  return {
    headers,
    rows,
    font,
    fontSize: (p.fontSize * 96) / 72,
    caption: p.caption || "Experiment comparison",
    note,
  };
}

export function tableHTML(table, paper) {
  const f = tableFigure(table, paper);
  return (
    '<table class="scientific-table" style="font-family:' +
    xml(f.font) +
    ";font-size:" +
    f.fontSize +
    'px"><caption>' +
    xml(f.caption || "Experiment comparison") +
    '</caption><thead><tr><th scope="col" rowspan="2">Experiment</th>' +
    f.headers
      .map(
        (h) =>
          '<th class="metric-heading" scope="colgroup" colspan="3">' +
          xml(h.title) +
          "</th>",
      )
      .join("") +
    "</tr><tr>" +
    f.headers
      .map((h) =>
        h.columns
          .map(
            (label, i) =>
              '<th scope="col" class="' +
              (i === 0 ? "metric-start" : "") +
              '">' +
              xml(label) +
              "</th>",
          )
          .join(""),
      )
      .join("") +
    "</tr></thead><tbody>" +
    f.rows
      .map(
        (r) =>
          "<tr" +
          (r.separator ? ' class="block-start"' : "") +
          '><th scope="row"><span class="table-series" style="border-color:' +
          r.color +
          ";color:" +
          r.color +
          '" aria-hidden="true">■</span> ' +
          xml(r.name) +
          '<span class="table-environment">' +
          xml(r.environment) +
          "</span></th>" +
          r.cells
            .map(
              (cell, i) =>
                '<td class="' +
                (i % 3 === 0 ? "metric-start" : "") +
                '">' +
                xml(cell) +
                "</td>",
            )
            .join("") +
          "</tr>",
      )
      .join("") +
    "</tbody></table>"
  );
}

export function tableSVG(table, paper) {
  const f = tableFigure(table, paper),
    s = f.fontSize,
    pad = 12,
    line = s * 1.5;
  // Conservative glyph widths keep long labels and scientific notation inside cells.
  const measure = (text) => [...String(text)].length * s * 0.68;
  const first =
    Math.max(
      100,
      measure("Experiment"),
      ...f.rows.map((r) =>
        Math.max(measure(r.name) + s * 1.5, measure(r.environment) * 0.8),
      ),
    ) +
    pad * 2;
  const widths = f.headers.flatMap((h, j) => {
    const w = h.columns.map(
      (label, k) =>
        Math.max(
          measure(label),
          ...f.rows.map((r) => measure(r.cells[j * 3 + k])),
        ) +
        pad * 2,
    );
    const extra = Math.max(
      0,
      measure(h.title) + pad * 2 - w.reduce((a, b) => a + b, 0),
    );
    return w.map((v) => v + extra / 3);
  });
  const xs = [pad, first + pad];
  for (const w of widths) xs.push(xs.at(-1) + w);
  const W = xs.at(-1) + pad,
    caption = f.caption ? line * 1.5 : 0,
    top = pad + caption,
    header = line * 2.6,
    rowHeight = line * 2,
    footer = line * 2,
    H = top + header + Math.max(1, f.rows.length) * rowHeight + footer + pad;
  const out = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      W +
      '" height="' +
      H +
      '" viewBox="0 0 ' +
      W +
      " " +
      H +
      '" role="img" aria-label="Experiment comparison"><rect width="100%" height="100%" fill="white"/><g fill="#111" font-family="' +
      xml(f.font) +
      '" font-size="' +
      s +
      '">',
  ];
  const text = (x, y, value, anchor = "middle", size = s, color = "#111") =>
    out.push(
      '<text x="' +
        x +
        '" y="' +
        y +
        '" text-anchor="' +
        anchor +
        '" font-size="' +
        size +
        '" fill="' +
        color +
        '">' +
        xml(value) +
        "</text>",
    );
  const rule = (x1, x2, y, width = 1) =>
    out.push(
      '<path d="M' +
        x1 +
        " " +
        y +
        "H" +
        x2 +
        '" stroke="#333" stroke-width="' +
        width +
        '" fill="none"/>',
    );
  if (f.caption) text(pad, pad + line, f.caption, "start");
  rule(pad, W - pad, top, 1.5);
  text(pad, top + line * 1.7, "Experiment", "start");
  f.headers.forEach((h, j) => {
    const start = xs[j * 3 + 1],
      end = xs[j * 3 + 4];
    text((start + end) / 2, top + line, h.title);
    rule(start + 6, end - 6, top + line * 1.35, 0.7);
    h.columns.forEach((label, k) =>
      text(
        (xs[j * 3 + k + 1] + xs[j * 3 + k + 2]) / 2,
        top + line * 2.2,
        label,
      ),
    );
  });
  rule(pad, W - pad, top + header);
  f.rows.forEach((r, i) => {
    const y = top + header + i * rowHeight;
    if (r.separator) rule(pad, W - pad, y, 0.7);
    text(pad, y + line * 1.05, "■", "start", s, r.color);
    text(pad + s * 1.5, y + line * 1.05, r.name, "start");
    text(
      pad + s * 1.5,
      y + line * 1.8,
      r.environment,
      "start",
      s * 0.8,
      "#555",
    );
    r.cells.forEach((v, k) => {
      if (k % 3 === 0 && i % 2 === 1)
        out.push(
          '<rect x="' +
            (xs[k + 1] + 4) +
            '" y="' +
            (y + line * 0.25) +
            '" width="' +
            (widths[k] - 8) +
            '" height="' +
            line +
            '" fill="#eee"/>',
        );
      text((xs[k + 1] + xs[k + 2]) / 2, y + line * 1.05, v);
    });
  });
  const bottom = top + header + Math.max(1, f.rows.length) * rowHeight;
  rule(pad, W - pad, bottom, 1.5);
  f.headers.forEach((h, j) =>
    out.push(
      '<path d="M' +
        xs[j * 3 + 1] +
        " " +
        (top + line * 1.5) +
        "V" +
        bottom +
        '" stroke="#aaa" stroke-width=".6"/>',
    ),
  );
  if (!f.rows.length) text(W / 2, top + header + line, "No selected runs");
  text(pad, bottom + line * 1.4, f.note, "start", s * 0.8, "#555");
  out.push("</g></svg>");
  return {
    svg: out.join(""),
    widthCm: (W / 96) * 2.54,
    heightCm: (H / 96) * 2.54,
  };
}

export function scientificTableLatex(table) {
  const f = tableFigure(table),
    e = tableTexText,
    end = "\\\\";
  const out = [
    "\\begin{tabular}{l" + f.headers.map(() => "rrr").join("") + "}",
    "\\toprule",
    "Experiment & " +
      f.headers
        .map((h) => "\\multicolumn{3}{c}{" + e(h.title) + "}")
        .join(" & ") +
      " " +
      end,
  ];
  f.headers.forEach((h, i) =>
    out.push("\\cmidrule(lr){" + (i * 3 + 2) + "-" + (i * 3 + 4) + "}"),
  );
  out.push(
    " & " + f.headers.flatMap((h) => h.columns.map(e)).join(" & ") + " " + end,
    "\\midrule",
  );
  for (const [i, r] of f.rows.entries()) {
    if (r.separator) out.push("\\midrule");
    out.push(
      "\\textcolor[HTML]{" +
        r.color.slice(1) +
        "}{\\rule{.5em}{.5em}} " +
        e(r.name) +
        " (" +
        e(r.environment) +
        ") & " +
        r.cells
          .map(
            (c, k) =>
              (i % 2 === 1 && k % 3 === 0 ? "\\cellcolor[gray]{0.93}" : "") +
              e(c).replaceAll("±", "$\\pm$").replaceAll("—", "--"),
          )
          .join(" & ") +
        " " +
        end,
    );
  }
  out.push(
    "\\bottomrule",
    "\\end{tabular}",
    "\\par\\smallskip {\\footnotesize " + e(note).replaceAll("—", "--") + "}",
  );
  return out.join("\n") + "\n";
}
