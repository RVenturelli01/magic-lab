import { axisTicks } from "./axis-format.mjs";
import { paperChart, normalizePaper } from "./paper-style.mjs";
import { PYTHON_RENDERER } from "./paper-python.mjs";
const plain = (s) =>
  String(s)
    .replace(
      /[\\&%$#_{}~^]/g,
      (c) =>
        ({
          "\\": "\\textbackslash{}",
          "~": "\\textasciitilde{}",
          "^": "\\textasciicircum{}",
        })[c] || "\\" + c,
    )
    .replaceAll("·", "\\textperiodcentered{}")
    .replaceAll("−", "-");
export function paperTexText(value) {
  const allowed = new Set(
    "alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi pi rho sigma tau upsilon phi varphi chi psi omega Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega mathrm mathit mathbf mathsf text frac sqrt bar hat tilde overline underline left right cdot times pm leq geq infty sum prod log exp sin cos tan".split(
      " ",
    ),
  );
  return String(value)
    .split(/(\$[^$\n]+\$)/g)
    .map((part) => {
      if (!part.startsWith("$") || !part.endsWith("$")) return plain(part);
      const math = part.slice(1, -1),
        commands = [...math.matchAll(/\\([a-zA-Z]+|.)/g)].map((m) => m[1]);
      let balance = 0;
      for (const ch of math) {
        if (ch === "{") balance++;
        if (ch === "}") balance--;
        if (balance < 0) return plain(part);
      }
      if (
        balance ||
        /[\x00-\x1f%#&]/.test(math) ||
        commands.some(
          (c) => !allowed.has(c) && !["{", "}", ",", ";", "!", " "].includes(c),
        )
      )
        return plain(part);
      return part;
    })
    .join("");
}
const marker = {
  none: "none",
  circle: "*",
  square: "square*",
  diamond: "diamond*",
  "triangle-up": "triangle*",
  cross: "+",
};
const dash = {
  solid: "solid",
  dash: "dashed",
  dot: "dotted",
  dashdot: "dashdotted",
  none: "only marks",
};
export function paperDocument(charts, view, { columns } = {}) {
  const style = normalizePaper(view.paper),
    panels = charts.map(paperChart);
  return {
    version: 1,
    style,
    columns: Math.max(
      1,
      Math.min(columns ?? style.columns, panels.length || 1),
    ),
    panels,
  };
}
export function paperTikz(doc) {
  const p = doc.style,
    cols = doc.columns,
    rows = Math.ceil(doc.panels.length / cols),
    W = cols * p.width + (cols - 1) * p.gapX,
    H = rows * p.height + (rows - 1) * p.gapY;
  const out = [
    "% Requires pgfplots and the fillbetween library. Lengths are explicit.",
    "\\begin{tikzpicture}",
    "\\path (0,0) rectangle (" + W + "," + H + ");",
  ];
  doc.panels.forEach((c, idx) => {
    const legend = c.style?.legend ?? p.legend;
    const col = idx % cols,
      row = Math.floor(idx / cols),
      x = col * (p.width + p.gapX) + p.marginLeft,
      y = H - (row + 1) * p.height - row * p.gapY + p.marginBottom;
    const opts = [
      "at={(" + x + "cm," + y + "cm)}",
      "anchor=south west",
      "scale only axis",
      "width=" + (p.width - p.marginLeft - p.marginRight) + "cm",
      "height=" + (p.height - p.marginTop - p.marginBottom) + "cm",
      "xmin=" + c.bounds.xmin,
      "xmax=" + c.bounds.xmax,
      "ymin=" + c.bounds.ymin,
      "ymax=" + c.bounds.ymax,
      "xlabel={" + paperTexText(c.xlabel) + "}",
      "ylabel={\\parbox{" +
        (p.height - p.marginTop - p.marginBottom) +
        "cm}{\\centering " +
        paperTexText(c.ylabel) +
        "}}",
      "title={" + paperTexText(c.title) + "}",
      "font={\\fontsize{" +
        p.fontSize +
        "}{" +
        p.fontSize * 1.2 +
        "}\\selectfont" +
        (p.font === "sans"
          ? "\\sffamily"
          : p.font === "times"
            ? "\\fontfamily{ptm}\\selectfont"
            : "\\rmfamily") +
        "}",
      "label style={font=\\fontsize{" +
        p.labelSize +
        "}{" +
        p.labelSize * 1.2 +
        "}\\selectfont}",
      "xlabel style={text width=" +
        (p.width - p.marginLeft - p.marginRight) +
        "cm,align=center}",
      "ylabel style={text width=" +
        (p.height - p.marginTop - p.marginBottom) +
        "cm,align=center}",
      "tick label style={font=\\fontsize{" +
        p.tickSize +
        "}{" +
        p.tickSize * 1.2 +
        "}\\selectfont}",
      "title style={font=\\fontsize{" +
        p.titleSize +
        "}{" +
        p.titleSize * 1.2 +
        "}\\selectfont}",
      "axis line style={line width=" + p.axisWidth + "pt}",
      "axis lines=" + (p.box ? "box" : "left"),
      "tick align=" + (p.tickDirection === "in" ? "inside" : "outside"),
      "grid=" + (p.grid ? "major" : "none"),
      "scaled ticks=false",
      "unbounded coords=jump",
      "clip=true",
      "legend columns=" + p.legendColumns,
    ];
    for (const a of ["x", "y"]) {
      const ticks = axisTicks(
        c.bounds[a + "min"],
        c.bounds[a + "max"],
        c[a + "Tick"],
        c[a + "NumberFormat"],
        c[a + "Exponent"],
      );
      if (ticks) {
        opts.push(
          a + "tick={" + ticks.values.join(",") + "}",
          a + "ticklabels={" + ticks.labels.join(",") + "}",
        );
        if (ticks.exponent !== null)
          opts.push(
            "extra description/.append code={\\node[anchor=" +
              (a === "x" ? "north east" : "south west") +
              ",font=\\fontsize{" +
              p.tickSize +
              "}{" +
              p.tickSize * 1.2 +
              "}\\selectfont] at (axis description cs:" +
              (a === "x" ? "1,-0.13" : "0,1.02") +
              ") {$\\times 10^{" +
              ticks.exponent +
              "}$};}",
          );
      } else if (c[a + "Tick"]) opts.push(a + "tick distance=" + c[a + "Tick"]);
    }
    const positions = {
      "upper right": "at={(.98,.98)},anchor=north east",
      "upper left": "at={(.02,.98)},anchor=north west",
      "lower right": "at={(.98,.02)},anchor=south east",
      "lower left": "at={(.02,.02)},anchor=south west",
      "outside right": "at={(1.02,1)},anchor=north west",
    };
    opts.push(
      "legend style={" +
        (positions[legend] ?? positions["lower right"]) +
        ",draw=" +
        (p.legendFrame ? "gray!50" : "none") +
        ",fill=white,fill opacity=" +
        p.legendOpacity +
        ",text opacity=1,font=\\fontsize{" +
        p.legendSize +
        "}{" +
        p.legendSize * 1.2 +
        "}\\selectfont,cells={anchor=west}}",
    );
    out.push("\\begin{axis}[\n" + opts.join(",\n") + "\n]");
    c.groups.forEach((g, i) => {
      const color = "papercolor" + idx + "x" + i;
      out.push("\\definecolor{" + color + "}{HTML}{" + g.color.slice(1) + "}");
      if (p.uncertainty === "band") {
        let seg = [];
        const flush = () => {
          if (seg.length) {
            // Explicit polygons avoid fillbetween's deferred axis/layer bounds.
            const lower = seg.map(
                (q) => "(" + q.step + "," + (q.mean - q.error) + ")",
              ),
              upper = [...seg]
                .reverse()
                .map((q) => "(" + q.step + "," + (q.mean + q.error) + ")");
            out.push(
              "\\addplot[fill=" +
                color +
                ",fill opacity=" +
                p.bandOpacity +
                ",draw=none,forget plot,mark=none] coordinates {" +
                [...lower, ...upper].join(" ") +
                "} \\closedcycle;",
            );
            seg = [];
          }
        };
        for (const q of g.points) {
          if (q.error === null) flush();
          else seg.push(q);
        }
        flush();
      }
      out.push(
        "\\addplot[color=" +
          color +
          ",line width=" +
          p.lineWidth +
          "pt," +
          dash[g.dash] +
          ",mark=" +
          marker[g.marker] +
          ",mark size=" +
          p.markerSize / 2 +
          "pt,mark repeat=" +
          p.markerEvery +
          "] coordinates {" +
          g.points.map((q) => "(" + q.step + "," + q.mean + ")").join(" ") +
          "};",
      );
      if (legend !== "none")
        out.push("\\addlegendentry{" + paperTexText(g.label) + "}");
      if (p.uncertainty === "bars")
        out.push(
          "\\addplot[only marks,mark=none,color=" +
            color +
            ",forget plot,error bars/.cd,y dir=both,y explicit,error bar style={line width=" +
            p.errorWidth +
            "pt},error mark options={rotate=90,mark size=" +
            p.errorCap +
            "pt}] coordinates {" +
            g.points
              .filter((q, j) => q.error !== null && j % p.errorEvery === 0)
              .map(
                (q) => "(" + q.step + "," + q.mean + ") +- (0," + q.error + ")",
              )
              .join(" ") +
            "};",
        );
    });
    out.push("\\end{axis}");
    if (c.panelCaption)
      out.push(
        "\\node[anchor=north,font=\\fontsize{" +
          p.titleSize +
          "}{" +
          p.titleSize * 1.2 +
          "}\\selectfont] at (" +
          (col * (p.width + p.gapX) + p.width / 2) +
          "," +
          (y - p.marginBottom) +
          ") {" +
          paperTexText(c.panelCaption) +
          "};",
      );
  });
  if (p.caption)
    out.push(
      "\\node[anchor=north,font=\\fontsize{" +
        p.titleSize +
        "}{" +
        p.titleSize * 1.2 +
        "}\\selectfont] at (" +
        W / 2 +
        ",-0.25) {" +
        paperTexText(p.caption) +
        "};",
    );
  out.push("\\end{tikzpicture}");
  return out.join("\n") + "\n";
}
export function paperEntries(charts, view, options = {}) {
  const doc = paperDocument(charts, view, options),
    caption = paperTexText(doc.style.caption);
  return [
    ["paper/figure.json", JSON.stringify(doc, null, 2)],
    ["paper/figure.tex", paperTikz(doc)],
    [
      "paper/standalone.tex",
      "\\documentclass[border=2pt]{standalone}\n\\usepackage[T1]{fontenc}\n\\usepackage{lmodern}\n\\usepackage{pgfplots}\n\\usepgfplotslibrary{fillbetween}\n\\pgfplotsset{compat=1.18}\n\\begin{document}\n\\input{figure.tex}\n\\end{document}\n",
    ],
    [
      "paper/include.tex",
      "\\begin{figure}[t]\n\\centering\n\\input{figure.tex}\n\\caption{" +
        caption +
        "}\n\\label{fig:experiment}\n\\end{figure}\n",
    ],
    ["paper/render.py", PYTHON_RENDERER],
    [
      "paper/README.txt",
      "Compile standalone.tex with pdflatex (pgfplots >= 1.18, lmodern, fillbetween). Or insert figure.tex into your paper with \\\\input and add the packages from standalone.tex to the preamble. Common math commands inside $...$ are supported; other text is escaped.\n\nFor vector PDF/SVG and high-resolution PNG: python -m pip install matplotlib; python render.py. True LaTeX typography: python render.py --usetex (requires TeX). The script reads figure.json and can be edited freely. It never trains or reaggregates data.\n\nWidth/height in cm describe EACH panel; fonts, strokes and markers are in pt. Gaps separate panels. Data retains sample SD, n, selected SD/CI and provenance in reproduction.json. Undefined uncertainty stays missing. Paper-style hidden curves are omitted from the figure, not the reproduction dataset. Use Paper style > Curves for export visibility; exploration legend clicks are transient.\n\nBrowser preview uses an available serif font; final TeX glyphs and spacing resolve on compilation. For outside legends allow more right margin. Reserve vertical gap for panel captions. Browser preview SVG/PNG, when included, are per panel. The legacy report exports remain separate.\n",
    ],
  ];
}
