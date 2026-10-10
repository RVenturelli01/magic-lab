import { createFixture } from "./support/dataset.mjs";
import test from "node:test";
import assert from "node:assert/strict";

import { defaultView } from "../core/view.mjs";
import {
  directExport,
  composeSVG,
  imagePDF,
} from "../reporting/direct-export.mjs";
import { capturePreset, applyPreset } from "../core/analysis-presets.mjs";
const dataset = createFixture();
const view = {
  ...defaultView(dataset),
  charts: dataset.metrics.slice(0, 2).map((m) => m.id),
};
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="332" height="272"><defs><clipPath id="plot"><rect width="1" height="1"/></clipPath></defs><path clip-path="url(#plot)" d="M0 0L1 1"/></svg>';
const callbacks = {
  renderSVG: async () => svg,
  rasterize: async (s, options) => ({
    bytes: new Uint8Array([255, 216, 255, 217]),
    width: 100,
    height: 80,
    widthPt: (options.widthCm / 2.54) * 72,
    heightPt: (options.heightCm / 2.54) * 72,
  }),
};
test("Analysis and visual presets restore independently and preserve selection and data", () => {
  const initial = {
    ...view,
    window: 5,
    band: "ci95",
    paper: {
      ...view.paper,
      lineWidth: 2,
      series: { a: { color: "#123456", hidden: true } },
    },
  };
  const statistics = capturePreset(initial, "settings"),
    style = capturePreset(initial, "style");
  assert.equal(style.series.a.hidden, undefined);
  assert.equal(statistics.paper, undefined);
  const changed = {
    ...initial,
    window: 20,
    band: "sd3",
    paper: {
      ...initial.paper,
      lineWidth: 4,
      series: { a: { color: "#abcdef", hidden: false }, b: { hidden: true } },
    },
  };
  const restoredSettings = applyPreset(changed, "settings", statistics);
  assert.equal(restoredSettings.window, 5);
  assert.equal(restoredSettings.band, "ci95");
  assert.equal(restoredSettings.paper.lineWidth, 4);
  assert.equal(restoredSettings.paper.series.a.color, "#abcdef");
  assert.equal(restoredSettings.paper.series.a.hidden, true);
  const restoredStyle = applyPreset(changed, "style", style);
  assert.equal(restoredStyle.window, 20);
  assert.equal(restoredStyle.band, "sd3");
  assert.equal(restoredStyle.paper.lineWidth, 2);
  assert.equal(restoredStyle.paper.series.a.hidden, false);
  assert.equal(restoredStyle.paper.series.b.hidden, true);
  assert.deepEqual(restoredStyle.selected, initial.selected);
  assert.deepEqual(restoredStyle.filters, initial.filters);
});
test("Every direct format supports a combined file or separate charts without ZIP metadata", async () => {
  for (const format of ["svg", "png", "pdf", "csv", "latex"]) {
    const one = await directExport(dataset, view, { format, ...callbacks });
    const separate = await directExport(dataset, view, {
      format,
      mode: "separate",
      ...callbacks,
    });
    assert.equal(one.length, 1);
    assert.equal(separate.length, 2);
    assert.ok(one.every((f) => !f.name.endsWith(".zip")));
    if (format === "csv")
      for (const id of view.charts) assert.ok(one[0].data.includes(id));
    if (format === "latex") {
      assert.ok(one[0].data.includes("\\documentclass"));
      assert.equal((one[0].data.match(/\\begin\{axis\}/g) || []).length, 2);
      assert.ok(!one[0].data.includes("\\input{"));
      assert.ok(one[0].data.includes("coordinates {"));
    }
    if (format === "pdf")
      assert.equal(
        new TextDecoder().decode(one[0].data.slice(0, 8)),
        "%PDF-1.4",
      );
  }
  const only = await directExport(dataset, view, {
    format: "csv",
    metricId: view.charts[0],
  });
  assert.ok(!only[0].data.includes(view.charts[1]));
  await assert.rejects(
    () => directExport(dataset, view, { format: "all" }),
    /Invalid export format/,
  );
});
test("Ablation exports keep titles empty by default and preserve custom titles", async () => {
  const metricId = dataset.metrics[0].id;
  const ablation = {
    ...view,
    workspaceMode: "ablation",
    ablationMetric: metricId,
    ablationRow: "/config/learning_rate",
    ablationColumn: "/config/gamma",
  };
  for (const mode of ["combined", "separate"]) {
    for (const title of [undefined, "", "My title"]) {
      const configured = {
        ...ablation,
        paper: {
          ...ablation.paper,
          metrics: { [metricId]: title === undefined ? {} : { title } },
        },
      };
      const files = await directExport(dataset, configured, {
        format: "latex",
        mode,
      });
      const titles = files.flatMap((file) =>
        [...file.data.matchAll(/title=\{([^}]*)\}/g)].map((match) => match[1]),
      );
      assert.deepEqual(titles, Array(3).fill(title ?? ""));
    }
  }
});
test("Table files split by metric and combined CSV retains every selected metric", async () => {
  const table = { ...view, workspaceMode: "tables" };
  assert.equal(
    (await directExport(dataset, table, { format: "csv", mode: "separate" }))
      .length,
    2,
  );
  const combined = await directExport(dataset, table, { format: "csv" });
  for (const id of view.charts) assert.ok(combined[0].data.includes(id));
  const latex = await directExport(dataset, table, { format: "latex" });
  assert.ok(latex[0].data.includes("\\begin{tabular}"));
});
test("Table image exports render the active table and preserve DPI and separate metric choices", async () => {
  const table = {
    ...view,
    workspaceMode: "tables",
    paper: { ...view.paper, dpi: 150, caption: "Comparison & results" },
  };
  for (const format of ["svg", "png", "pdf", "latex"]) {
    const requests = [];
    const options = {
      format,
      renderSVG: () => {
        throw Error("Charts must not be rendered for Tables");
      },
      rasterize: async (s, p) => {
        requests.push({ s, p });
        return callbacks.rasterize(s, p);
      },
    };
    const combined = await directExport(dataset, table, options),
      separate = await directExport(dataset, table, {
        ...options,
        mode: "separate",
      });
    assert.equal(combined.length, 1);
    assert.equal(separate.length, 2);
    assert.match(combined[0].name, /^comparison\./);
    if (format === "svg") {
      assert.match(combined[0].data, /Comparison &amp; results/);
      assert.match(combined[0].data, /Mean ± SD/);
      for (const m of dataset.metrics.slice(0, 2))
        assert.ok(combined[0].data.includes(m.label));
      assert.ok(!separate[0].data.includes(dataset.metrics[1].label));
    }
    if (format === "latex") {
      assert.match(combined[0].data, /\\usepackage\{booktabs\}/);
      assert.match(combined[0].data, /\\usepackage\[table\]\{xcolor\}/);
      assert.match(combined[0].data, /\\multicolumn\{3\}/);
      assert.match(combined[0].data, /\\toprule/);
      assert.match(combined[0].data, /Comparison \\& results/);
    }
    if (format === "png" || format === "pdf") {
      assert.equal(requests.length, 3);
      assert.equal(requests[0].p.dpi, 150);
      assert.ok(requests[0].p.widthCm > 0 && requests[0].p.heightCm > 0);
      assert.match(requests[0].s, /Experiment/);
      assert.ok(!requests[0].s.includes("<clipPath"));
    }
  }
  await assert.rejects(
    () => directExport(dataset, { ...table, charts: [] }, { format: "svg" }),
    /Select at least one metric/,
  );
});
test("Composite SVG isolates clip paths; binary PDF has accurate object and xref offsets", () => {
  const out = composeSVG([svg, svg], {
    columns: 2,
    width: 8.8,
    height: 7.2,
    gapX: 1,
    gapY: 1,
  });
  assert.ok(
    out.svg.includes('id="panel0-plot"') &&
      out.svg.includes("url(#panel1-plot)"),
  );
  assert.ok(out.widthCm > 17.6);
  const bytes = imagePDF({
    bytes: new Uint8Array([255, 216, 0, 128, 255, 217]),
    width: 2,
    height: 3,
    widthPt: 100,
    heightPt: 150,
  });
  const content = new TextDecoder("latin1").decode(bytes),
    xref = Number(content.match(/startxref\n(\d+)/)[1]);
  assert.equal(new TextDecoder().decode(bytes.slice(xref, xref + 4)), "xref");
  const offsets = content
    .slice(content.indexOf("xref\n"))
    .match(/\d{10} 00000 n /g)
    .map((line) => Number(line.slice(0, 10)));
  offsets.forEach((offset, i) =>
    assert.ok(
      new TextDecoder()
        .decode(bytes.slice(offset, offset + 12))
        .startsWith(i + 1 + " 0 obj"),
    ),
  );
});
