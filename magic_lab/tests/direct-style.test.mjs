import test from "node:test";
import assert from "node:assert/strict";
import { createFixture } from "./support/dataset.mjs";
import { testApplication } from "./support/application.mjs";
import { ablationGrid } from "../panels/ablation-grid.mjs";
import { paperEditor } from "../web/paper-editor.mjs";
import { paperDocument, paperTikz } from "../core/paper-export.mjs";
import { plotlyFigure } from "../web/plotly-figure.mjs";
import { mountPlotTools } from "../web/plot-tools.mjs";
import { paperSeries } from "../core/paper-style.mjs";
import { curveVisibility } from "../web/ui/menus.mjs";

test("Renamed series and axes keep source names in editing controls", () => {
  const group = {
      key: "run-a",
      name: "Original <run>",
      runs: [{ name: "Original <run>", seed: 7 }],
    },
    metric = {
      id: "reward",
      label: "Original <metric>",
      unit: "score",
      xUnit: "Original <step>",
    },
    view = {
      workspaceMode: "charts",
      chartSeries: "runs",
      paper: {
        series: { "run-a": { label: "Custom <curve>" } },
        metrics: {
          reward: {
            title: "Custom title",
            xlabel: "Custom X",
            ylabel: "Custom Y",
          },
        },
      },
    },
    chart = { metric, result: { groups: [group] } },
    original = structuredClone(view);
  const series = paperSeries(group, 0, view);
  assert.equal(series.originalLabel, "Original <run> · seed 7");
  assert.equal(series.label, "Custom <curve>");
  const html = paperEditor(view, [chart]);
  assert.match(
    html,
    /<legend><span[^>]+>Original &lt;run&gt; · seed 7<\/span>/,
  );
  assert.match(html, /value="Custom &lt;curve&gt;"/);
  assert.match(html, /<legend>Original &lt;metric&gt;<\/legend>/);
  assert.match(html, /X axis · Original &lt;step&gt;/);
  assert.match(html, /Y axis · Original &lt;metric&gt; \(score\)/);
  for (const label of ["Custom title", "Custom X", "Custom Y"])
    assert.ok(html.includes('value="' + label + '"'));
  const visibility = curveVisibility({
    view,
    chartResults: new Map([[metric.id, chart]]),
  });
  assert.match(visibility, /<span>Original &lt;run&gt; · seed 7<\/span>/);
  assert.doesNotMatch(visibility, /Custom &lt;curve&gt;/);
  assert.deepEqual(view, original);
});

test("Style labels and colors synchronize figures, exports and saved sessions", async () => {
  const dataset = createFixture(),
    app = testApplication(dataset);
  app.state.view.tab = "workspace";
  app.state.view.workspaceMode = "ablation";
  app.state.view.paper.enabled = true;
  app.render();
  const chart = ablationGrid(dataset, app.state.view).cells.find(
    (c) => c.result.groups.length,
  );
  const series = plotlyFigure(chart).series[0];
  const events = {},
    config = {},
    target = { on: (name, handler) => (events[name] = handler) };
  const card = {
    dataset: { chartMetric: chart.key },
    querySelector: () => target,
    querySelectorAll: () => [],
  };
  const controller = mountPlotTools(
    { querySelector: () => target, querySelectorAll: () => [card] },
    {
      lookup: () => chart,
      changeRange() {},
      plotly: {
        async react(t, data, layout, options) {
          Object.assign(config, options);
        },
        purge() {},
      },
    },
  );
  await controller.ready;
  assert.equal(config.editable, false);
  assert.equal(events.plotly_legendclick, undefined);
  assert.equal(events.plotly_restyle, undefined);
  app.handlers.change({
    target: {
      dataset: {
        paperScope: "series",
        paperId: series.key,
        paperKey: "label",
      },
      type: "text",
      value: "Custom <legend>",
    },
  });
  assert.equal(
    app.state.view.paper.series[series.key].label,
    "Custom <legend>",
  );
  app.handlers.change({
    target: {
      dataset: { paperScope: "series", paperId: series.key, paperKey: "color" },
      type: "color",
      value: "#13579b",
    },
  });
  assert.equal(app.state.view.paper.series[series.key].color, "#13579b");
  const cells = ablationGrid(dataset, app.state.view).cells;
  assert.match(paperEditor(app.state.view, cells), /Custom &lt;legend&gt;/);
  const updated = cells.find((c) => c.key === chart.key);
  const trace = plotlyFigure(updated).traces.find(
    (t) => t.legendgroup === series.key,
  );
  assert.equal(trace.name, "Custom &lt;legend&gt;");
  assert.equal(trace.line.color, "#13579b");
  const doc = paperDocument(cells, app.state.view);
  assert.ok(
    doc.panels.some((c) =>
      c.groups.some(
        (g) => g.label === "Custom <legend>" && g.color === "#13579b",
      ),
    ),
  );
  assert.match(paperTikz(doc), /Custom <legend>/);
  assert.doesNotMatch(app.el.innerHTML, /Edit legend|direct-series-editor/);
  const restored = testApplication(dataset, app.storage);
  await restored.start();
  assert.deepEqual(
    restored.state.view.paper.series[series.key],
    app.state.view.paper.series[series.key],
  );
  controller.destroy();
  assert.equal(
    app.state.view.paper.series[series.key].label,
    "Custom <legend>",
  );
  restored.destroy();
  app.destroy();
});
