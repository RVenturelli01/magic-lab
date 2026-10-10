import { createFixture } from "./support/dataset.mjs";
import test from "node:test";
import assert from "node:assert/strict";

import { testApplication } from "./support/application.mjs";
import { normalizeView } from "../core/view.mjs";
import { filterRuns } from "../core/analysis.mjs";
import { workspaceRunTable } from "../core/run-table.mjs";
import { xml } from "../core/text.mjs";
import { runs, filters } from "../web/ui/runs.mjs";
import { workspace } from "../web/ui/workspace.mjs";
import {
  mainNavigation,
  workspaceToolbar,
  controls,
} from "../web/ui/menus.mjs";
import { defaultView } from "../core/view.mjs";

test("actual app renders grouped Runs and Workspace with imported dependencies", async () => {
  const dataset = createFixture();
  const application = testApplication(dataset);
  const { state, el: app, render } = application;
  const v = {
    ...defaultView(dataset),
    runGrouping: "configuration",
    filters: [
      { field: "/config/learning_rate", values: [] },
      { field: "/status", values: [] },
    ],
  };
  state.view = v;
  for (const embedded of [false, true]) {
    const html = runs(state);
    assert.ok(html.includes('class="seed-chip selected"'));
    assert.ok(html.includes('id="runGrouping"'));
    assert.ok(html.includes('data-action="expand-group"'));
    assert.ok(!html.includes("<summary>Selection</summary>"));
    assert.ok(
      !html.includes('data-action="clear-selection"') &&
        !html.includes("run-clear"),
    );
    assert.ok(
      !html.includes("<summary>Config & artifacts</summary>") &&
        !html.includes("<pre>"),
    );
    const headers = [...html.matchAll(/<th(?:\s[^>]*)?>([^<]+)<\/th>/g)].map(
      (match) => match[1],
    );
    assert.deepEqual(headers, ["learning_rate", "Status", "Details"]);
    assert.ok(!/\d+ runs · \d+ selected/.test(html));
    const titles = [
      ...html.matchAll(/class="group-disclosure"[^>]*>[\s\S]*?<\/button>/g),
    ].map((match) => match[0]);
    assert.ok(titles.length > 0);
    assert.ok(
      titles.every(
        (title) =>
          !title.includes("budget=") &&
          !title.includes("eval_every=") &&
          !title.includes("evaluation_policy="),
      ),
    );
    assert.ok(
      titles.every(
        (title) =>
          !title.includes("learning_rate=") && !title.includes("gamma="),
      ),
    );
    for (const name of new Set(dataset.runs.map((run) => run.name)))
      assert.ok(titles.some((title) => title.includes(name)));
  }
  for (const mode of ["charts", "tables", "ablation"]) {
    state.view = normalizeView(
      { ...state.view, tab: "workspace", workspaceMode: mode },
      dataset,
    );

    const html = workspace(state);
    assert.ok(
      !html.includes("Export preview") && !html.includes("data-preview-format"),
    );
    assert.ok(!html.includes('data-action="download-preview"'));
    assert.ok(
      !html.includes("preview-edit") &&
        !html.includes("Edit charts / explore data"),
    );
    assert.ok(html.includes('class="workspace-content"'));
    render();
    assert.ok(
      app.innerHTML.includes('class="theme-control"') &&
        app.innerHTML.includes('id="theme"'),
    );
    assert.ok(
      app.innerHTML.includes(
        "<h1>" +
          (mode === "ablation"
            ? "Ablations"
            : mode === "tables"
              ? "Tables"
              : "Charts") +
          "</h1>",
      ),
    );
    assert.ok(
      !app.innerHTML.includes("filter-builder") &&
        !app.innerHTML.includes("run-catalog"),
    );
    const navigation = mainNavigation(state);
    assert.match(
      navigation,
      new RegExp('data-tab="' + mode + '" class="active" aria-current="page"'),
    );
    assert.equal((navigation.match(/data-action="tab"/g) || []).length, 4);
    assert.ok(navigation.includes(">Ablations</button>"));
    assert.ok(
      !html.includes("filter-builder") &&
        !html.includes("run-catalog") &&
        !html.includes("GROUP BY"),
    );
    if (mode !== "tables")
      assert.ok(
        html.includes('class="chart-plot"') &&
          !html.includes("data-plot-tool="),
      );
    if (mode === "charts")
      assert.ok(
        html.includes("data-chart-drag=") &&
          html.includes("data-chart-resize=") &&
          html.includes("--chart-width:560px"),
      );
    if (mode === "tables") {
      assert.ok(
        html.includes("comparison-table") && html.includes("scientific-table"),
      );
      assert.ok(html.includes("Table style") && html.includes("PNG / PDF DPI"));
      for (const format of ["png", "svg", "pdf", "csv", "latex"])
        assert.ok(html.includes('data-format="' + format + '"'));
      assert.ok(html.includes("Separate files per metric"));
    }
    if (mode === "ablation")
      assert.ok(
        html.includes('id="ablationRow"') &&
          html.includes('id="ablationColumn"') &&
          html.includes("ablation-matrix"),
      );
    assert.ok(!html.includes('class="stats"'));
  }
  state.expandedGroups.add(
    workspaceRunTable(dataset, state.view).groups[0].key,
  );
  const expandedHtml = runs(state);
  assert.ok(expandedHtml.includes('class="group-child"'));
  assert.ok(expandedHtml.includes("<summary>Config & artifacts</summary>"));
  for (const groupRow of expandedHtml.matchAll(
    /<tr class="run-group [^"]*">([\s\S]*?)<\/tr>/g,
  ))
    assert.ok(
      !groupRow[1].includes("<details>") && !groupRow[1].includes("<pre>"),
    );
  const originalConfig = xml(
    JSON.stringify(
      workspaceRunTable(dataset, state.view).groups[0].runs[0].config,
      null,
      2,
    ),
  );
  assert.ok(expandedHtml.includes("<pre>" + originalConfig + "</pre>"));
  state.view.runGrouping = "none";
  const html = runs(state);
  assert.ok(html.includes('value="none" selected'));
  assert.ok(!html.includes('class="seed-chips"'));
  assert.ok(html.includes("<summary>Config & artifacts</summary>"));
  state.view.tab = "runs";
  render();
  assert.ok(
    app.innerHTML.includes("<h1>Runs</h1>") &&
      app.innerHTML.includes("filter-builder") &&
      app.innerHTML.includes("run-catalog"),
  );
});

test("Actual grouping selection switches plots between means and individuals and exposes bands", async () => {
  const dataset = createFixture();
  const { state, handlers } = testApplication(dataset);
  state.view.filters.push({ field: "/config/gamma", values: [] });
  const initialFilters = filters(state);
  assert.ok(initialFilters.includes('aria-label="Code version"'));
  assert.match(
    runs(state),
    /<th[^>]*data-field="\/code\/commit"[^>]*>Code version<\/th>/,
  );
  assert.ok(initialFilters.includes('aria-label="learning_rate"'));

  assert.ok(!initialFilters.includes("Config ·"));
  const filterCount = state.view.filters.length;
  assert.equal(
    (initialFilters.match(/class="filter-rule"/g) || []).length,
    filterCount,
  );
  assert.ok(
    initialFilters.includes("+ Filter") &&
      !initialFilters.includes("startedAt"),
  );
  assert.ok(
    initialFilters.includes('aria-label="Seed"') &&
      initialFilters.includes('aria-label="Status"'),
  );
  assert.equal(
    (initialFilters.match(/data-action="remove-filter"/g) || []).length,
    filterCount,
  );
  const click = (dataset) =>
    handlers.click({ target: { closest: () => ({ dataset }) } });
  const initialSelection = JSON.stringify(state.view.selected);
  const initialFilterState = JSON.stringify(state.view.filters);
  for (const tab of ["charts", "ablation", "tables", "runs"]) {
    await click({ action: "tab", tab });
    assert.equal(state.view.tab, tab === "runs" ? "runs" : "workspace");
    if (tab !== "runs") assert.equal(state.view.workspaceMode, tab);
    assert.equal(JSON.stringify(state.view.filters), initialFilterState);
    const nav = mainNavigation(state);
    assert.match(
      nav,
      new RegExp('data-tab="' + tab + '" class="active" aria-current="page"'),
    );
  }
  await click({ action: "tab", tab: "charts" });
  assert.equal(JSON.stringify(state.view.selected), initialSelection);
  const menu = workspaceToolbar(state);
  assert.equal((menu.match(/data-action="save"/g) || []).length, 0);
  assert.equal((menu.match(/data-action="reload"/g) || []).length, 0);
  assert.ok(!menu.includes("<summary>Views</summary>"));
  assert.equal((menu.match(/data-format="all"/g) || []).length, 0);
  assert.ok(menu.includes("data-export-mode"));
  for (const format of ["png", "svg", "pdf", "csv", "latex"])
    assert.ok(menu.includes('data-format="' + format + '"'));
  for (const name of ["Settings", "Style", "Export"])
    assert.ok(menu.includes("<summary>" + name + "</summary>"));
  assert.ok(menu.includes('data-menu="metrics"'));
  const initialMetricCount = state.view.charts.length;
  const metricId = dataset.metrics[0].id;
  await click({ action: "toggle-chart", metric: metricId });
  assert.equal(state.view.charts.length, initialMetricCount - 1);
  await click({ action: "toggle-chart", metric: metricId });
  assert.equal(state.view.charts.length, initialMetricCount);
  await click({
    action: "toggle-filter-value",
    field: "/config/learning_rate",
    value: '{"value":0.0001}',
  });
  const narrowedSelection = JSON.stringify(state.view.selected);
  assert.equal(state.view.selected.length, 6);
  assert.ok(
    state.view.selected.every((id) =>
      filterRuns(dataset.runs, state.view).some((run) => run.id === id),
    ),
  );
  for (const runGrouping of ["none", "configuration"]) {
    state.view.runGrouping = runGrouping;
    const table = runs(state);
    assert.match(
      table,
      /<th[^>]*data-field="\/config\/learning_rate" class="filter-active"/,
    );
    assert.match(
      table,
      /<td data-field="\/config\/learning_rate" class="filter-active">/,
    );
    assert.ok(!table.includes('data-field="/status" class="filter-active"'));
  }
  assert.equal(filterRuns(dataset.runs, state.view).length, 6);
  assert.ok(
    filterRuns(dataset.runs, state.view).every(
      (run) => run.config.learning_rate === 0.0001,
    ),
  );
  await click({ action: "reset-filters" });
  assert.equal(JSON.stringify(state.view.selected), narrowedSelection);
  assert.ok(!runs(state).includes('class="filter-active"'));
  assert.equal(
    filterRuns(dataset.runs, state.view).length,
    dataset.runs.length,
  );
  assert.equal(
    (filters(state).match(/class="filter-rule"/g) || []).length,
    filterCount,
  );
  const seedIndex = state.view.filters.findIndex(
    (rule) => rule.field === "/seed",
  );
  await click({ action: "remove-filter", index: String(seedIndex) });
  assert.ok(!filters(state).includes('aria-label="Seed"'));
  const savedFilters = JSON.stringify(
    normalizeView(state.view, dataset).filters,
  );
  assert.ok(!JSON.parse(savedFilters).some((rule) => rule.field === "/seed"));
  await click({ action: "toggle-field-picker" });
  assert.ok(
    filters(state).includes('data-action="add-filter" data-field="/seed"'),
  );
  await click({ action: "add-filter", field: "/seed" });
  assert.ok(filters(state).includes('aria-label="Seed"'));
  await click({
    action: "toggle-filter-value",
    field: "/seed",
    value: '{"value":0}',
  });
  assert.ok(
    filterRuns(dataset.runs, state.view).every((run) => run.seed === 0),
  );
  await click({ action: "reset-filters" });
  const grouping = (value) =>
    handlers.change({ target: { id: "runGrouping", dataset: {}, value } });
  await grouping("configuration");
  assert.equal(state.view.chartSeries, "seed-mean");
  assert.equal(state.view.runGrouping, "configuration");
  let html = workspace(state);
  assert.ok(html.includes('id="band"'));
  assert.ok(html.includes('value="ci95"'));
  assert.ok(html.includes('value="sd2"') && html.includes('value="sd3"'));
  assert.ok(html.includes("Mean · ±1 sample SD"));
  await handlers.change({ target: { id: "band", dataset: {}, value: "ci95" } });
  assert.equal(state.view.band, "ci95");
  assert.ok(workspace(state).includes("Mean · 95% CI (Student t)"));
  await grouping("/config/learning_rate");
  assert.equal(state.view.chartSeries, "group-mean");
  assert.ok(workspace(state).includes("learning_rate ="));
  assert.match(runs(state), /\d+\/\d+ runs · \d+\/\d+ groups/);
  assert.ok(!runs(state).includes("selected groups"));
  assert.ok(controls(state).includes('id="band"'));
  await grouping("none");
  assert.equal(state.view.chartSeries, "runs");
  assert.equal(state.view.runGrouping, "none");
  assert.ok(!workspace(state).includes('id="band"'));
  await click({
    action: "toggle-filter-value",
    field: "/seed",
    value: '{"value":1}',
  });
  assert.equal(state.view.selected.length, 0);
  await click({ action: "reset-filters" });
  assert.equal(state.view.selected.length, 0);
});
