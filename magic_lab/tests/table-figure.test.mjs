import test from "node:test";
import assert from "node:assert/strict";
import {
  tableHTML,
  tableSVG,
  tableFigure,
  scientificTableLatex,
} from "../core/table-figure.mjs";
const table = {
  metrics: [
    {
      id: "return",
      label: "Return <test>",
      phase: "evaluation",
      unit: "reward",
      xUnit: "steps",
    },
  ],
  rows: [
    {
      name: "A & B_<script>",
      environment: "Env",
      algorithm: "PPO",
      values: { return: { mean: 10, sd: null, n: 1, step: 100 } },
    },
    {
      name: "C",
      environment: "Env",
      algorithm: "SAC",
      values: { return: null },
    },
    {
      name: "D",
      environment: "Env",
      algorithm: "SAC",
      values: { return: { mean: 0.00002, sd: 0, n: 2, step: 200 } },
    },
  ],
};
test("Scientific table keeps singleton uncertainty undefined, missing observations absent and tiny values visible", () => {
  const f = tableFigure(table);
  assert.deepEqual(f.rows[0].cells, ["10 ± —", "1", "100"]);
  assert.deepEqual(f.rows[1].cells, ["—", "—", "—"]);
  assert.equal(f.rows[2].cells[0], "2.00e-5 ± 0");
  assert.equal(f.rows[1].separator, true);
  assert.equal(f.rows[2].separator, false);
  const html = tableHTML(table),
    svg = tableSVG(table).svg,
    tex = scientificTableLatex(table);
  for (const source of [html, svg]) {
    assert.ok(!source.includes("<script>"));
    assert.ok(source.includes("&lt;script&gt;"));
    assert.ok(source.includes("10 ± —"));
    assert.ok(source.includes("2.00e-5 ± 0"));
  }
  assert.match(html, /scope="colgroup" colspan="3"/);
  assert.match(html, /scope="row"/);
  assert.match(tex, /A \\& B\\_/);
  assert.match(tex, /10 \$\\pm\$ --/);
  assert.match(tex, /\\cmidrule\(lr\)\{2-4\}/);
});
test("Table typography changes image dimensions and empty tables keep valid finite geometry", () => {
  const small = tableSVG(table, { fontSize: 8 }),
    large = tableSVG(table, { fontSize: 16 });
  assert.ok(large.widthCm > small.widthCm && large.heightCm > small.heightCm);
  const empty = tableSVG({ ...table, rows: [] });
  assert.match(empty.svg, /No selected runs/);
  assert.ok(!empty.svg.includes("NaN") && !empty.svg.includes("Infinity"));
});
