import { escapeLatex } from "./text.mjs";
import { summaryRows } from "./analysis.mjs";
import { bandLimits, bandLabel } from "./uncertainty.mjs";
export function curveRows(result, view) {
  return result.groups.flatMap((g, i) =>
    g.points.map((p) => {
      const limits = view ? bandLimits(p, view.band) : null;
      return {
        group: "G" + (i + 1),
        algorithm: g.algorithm,
        environment: g.environment,
        step: p.sourceStep ?? p.step,
        ...(view?.xMetric
          ? { x_metric: view.xMetric, x_value: p.step, y_metric: view.metric }
          : {}),
        mean: p.mean,
        sample_sd: p.sd ?? "",
        n: p.n,
        ...(view
          ? {
              band: view.band,
              band_lower: limits?.lower ?? "",
              band_upper: limits?.upper ?? "",
            }
          : {}),
      };
    }),
  );
}
export function latex(result, metric, view) {
  const rows = summaryRows(result);
  return (
    "% " +
    metric.phase +
    "; " +
    metric.unit +
    "; " +
    metric.xUnit +
    "; band=" +
    bandLabel(view.band) +
    "; trailing window=" +
    view.window +
    "; alignment=" +
    view.alignment +
    "; incomplete=" +
    view.incomplete +
    "\n" +
    "\\begin{tabular}{llrrrr}\n\\hline\nGroup & Algorithm & Step & Mean & SD & $n$ \\\\\n\\hline\n" +
    rows
      .map(
        (r) =>
          [
            escapeLatex(r.group),
            escapeLatex(r.algorithm),
            escapeLatex(r.step),
            r.mean === "" ? "--" : Number(r.mean).toFixed(2),
            r.sd === "" ? "--" : Number(r.sd).toFixed(2),
            r.n,
          ].join(" & ") + " \\\\",
      )
      .join("\n") +
    "\n\\hline\n\\end{tabular}\n"
  );
}
export function curvesLatex(result, metric) {
  const rows = curveRows(result),
    end = " " + String.fromCharCode(92, 92);
  return (
    "% " +
    metric.phase +
    "; " +
    metric.unit +
    "; " +
    metric.xUnit +
    "\n" +
    "\\begin{tabular}{lrrrr}\nGroup & Step & Mean & SD & $n$" +
    end +
    "\n\\hline\n" +
    rows
      .map(
        (row) =>
          [
            row.group,
            row.step,
            row.mean,
            row.sample_sd === "" ? "--" : row.sample_sd,
            row.n,
          ]
            .map(escapeLatex)
            .join(" & ") + end,
      )
      .join("\n") +
    "\n\\end{tabular}\n"
  );
}
