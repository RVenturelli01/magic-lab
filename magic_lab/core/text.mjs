export const COLORS = [
  "#218267",
  "#c19446",
  "#6387b1",
  "#aa6c97",
  "#9ca850",
  "#6c67ac",
];
export const xml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
export const fmt = (x) =>
  Number(x).toLocaleString("en-US", { maximumFractionDigits: 2 });
export function csv(rows) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]),
    cell = (v) => '"' + String(v).replaceAll('"', '""') + '"';
  return (
    [
      keys.map(cell).join(","),
      ...rows.map((r) => keys.map((k) => cell(r[k] ?? "")).join(",")),
    ].join("\r\n") + "\r\n"
  );
}
export const escapeLatex = (s) =>
  String(s).replace(
    /[\\&%$#_{}~^]/g,
    (c) =>
      ({
        "\\": "\\textbackslash{}",
        "~": "\\textasciitilde{}",
        "^": "\\textasciicircum{}",
      })[c] || "\\" + c,
  );
