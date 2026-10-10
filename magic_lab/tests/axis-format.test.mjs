import test from "node:test";
import assert from "node:assert/strict";
import { axisTicks } from "../core/axis-format.mjs";
import { normalizePaper, paperChart } from "../core/paper-style.mjs";
import { applyPaperInput, paperEditor } from "../web/paper-editor.mjs";
import { defaultView, normalizeView } from "../core/view.mjs";
import { workspaceCharts } from "../core/workspace.mjs";
import { paperFigure } from "../web/paper-figure.mjs";
import { directExport } from "../reporting/direct-export.mjs";
import { createFixture } from "./support/dataset.mjs";

test("Number formats display 20000, 20k or 20 with exponent 3 without changing tick values", () => {
  for (const [format, label] of [
    ["full", "20000"],
    ["compact", "20k"],
    ["power", "20"],
  ]) {
    const ticks = axisTicks(0, 100000, 20000, format, 3);
    assert.equal(ticks.values[1], 20000);
    assert.equal(ticks.labels[1], label);
    assert.equal(ticks.exponent, format === "power" ? 3 : null);
  }
  assert.equal(axisTicks(-40000, 0, 20000, "compact").labels[0], "-40k");
  assert.deepEqual(axisTicks(0, 0.001, 0.0005, "full").labels, [
    "0",
    "0.0005",
    "0.001",
  ]);
  assert.equal(axisTicks(0, 100, undefined, "auto"), null);
  assert.throws(() => axisTicks(0, 100000, 1, "full"), /200 labels/);
  assert.throws(
    () => normalizePaper({ metrics: { test: { xExponent: 2.5 } } }),
    /exponent/,
  );
});

test("Axis edits and number formats affect only the selected metric", async () => {
  const dataset = createFixture(),
    original = structuredClone(dataset);
  let view = defaultView(dataset);
  view.charts = dataset.metrics.map((m) => m.id);
  const [id, other] = view.charts;
  view.paper.metrics[other] = { xTick: 10, xScale: 2 };
  const otherStyle = structuredClone(view.paper.metrics[other]);
  view.chartRanges[other] = { xmin: 0, xmax: 100, ymin: 0, ymax: 100 };
  for (const [key, value] of [
    ["xTick", "20000"],
    ["xScale", "1"],
    ["xmin", "0"],
    ["xmax", "100000"],
    ["xNumberFormat", "power"],
  ])
    view = applyPaperInput(view, {
      dataset: { paperScope: "metric", paperKey: key, paperId: id },
      type: key === "xNumberFormat" ? "select-one" : "number",
      value,
    });
  view = normalizeView(view, dataset);
  assert.deepEqual(view.paper.metrics[other], otherStyle);
  assert.equal(view.chartRanges[other].xmax, 100);
  const charts = workspaceCharts(dataset, view);
  const model = paperChart(charts[0]);
  assert.equal(model.xTick, 20000);
  assert.equal(model.xScale, 1);
  assert.equal(model.bounds.xmax, 100000);
  const figure = paperFigure(charts[0]);
  assert.equal(figure.layout.xaxis.ticktext[1], "20");
  assert.equal(figure.layout.xaxis.tickvals[1], 20000);
  assert.equal(paperChart(charts[1]).xNumberFormat, "auto");
  assert.equal(figure.layout.xaxis.ticktext.at(-1), "100");
  const multiplier = figure.layout.annotations.find((a) =>
    a.text.includes("<sup>"),
  );
  assert.equal(multiplier.y, 0);
  assert.equal(multiplier.yshift, -24);
  assert.ok(figure.layout.margin.b >= 48);
  assert.ok(figure.layout.xaxis.automargin);
  const files = await directExport(dataset, view, {
    format: "latex",
    mode: "separate",
  });
  assert.match(files[0].data, /xticklabels=\{0,20,40,60,80,100\}/);
  assert.doesNotMatch(files[1].data, /xticklabels=/);
  const html = paperEditor(view, charts);
  assert.match(
    html,
    /data-paper-scope="metric" data-paper-key="xNumberFormat"/,
  );
  assert.match(html, /data-paper-scope="metric" data-paper-key="xTick"/);
  assert.deepEqual(dataset, original);
});
