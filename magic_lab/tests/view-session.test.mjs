import { createFixture } from "./support/dataset.mjs";
import test from "node:test";
import assert from "node:assert/strict";

import { testApplication } from "./support/application.mjs";
import { defaultView } from "../core/view.mjs";
import { loadSession, saveSession } from "../web/view-session.mjs";
import { moveFilter, mountFilterOrder } from "../web/filter-order.mjs";
import { workspaceRunTable } from "../core/run-table.mjs";
import { valueKey } from "../core/filters.mjs";

const memory = () => {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};
const dataset = createFixture();

test("Last view restores filter order/values, selection, navigation, chart style/ranges and expanded groups", () => {
  const storage = memory(),
    view = defaultView(dataset);
  view.filters.reverse();
  view.filters.find((f) => f.field === "/seed").values = [valueKey(0)];
  view.selected = [dataset.runs[0].id];
  view.tab = "workspace";
  view.workspaceMode = "ablation";
  view.chartSize = { width: 700, height: 500 };
  view.chartRanges = {
    [view.charts[0]]: { xmin: 0, xmax: 10, ymin: 0, ymax: 20 },
  };
  view.paper.enabled = true;
  view.paper.lineWidth = 3;
  saveSession(storage, dataset, view, ["group-a"]);
  const restored = loadSession(storage, dataset);
  assert.deepEqual(restored.view.filters, view.filters);
  assert.deepEqual(restored.view.selected, view.selected);
  assert.equal(restored.view.tab, "workspace");
  assert.equal(restored.view.workspaceMode, "ablation");
  assert.deepEqual(restored.view.chartSize, view.chartSize);
  assert.deepEqual(restored.view.chartRanges, view.chartRanges);
  assert.equal(restored.view.paper.lineWidth, 3);
  assert.deepEqual(restored.expandedGroups, ["group-a"]);
  assert.equal(storage.values.has("rl-observatory.views.v1"), false);
  const changed = {
    ...dataset,
    runs: dataset.runs.filter((run) => run.id !== view.selected[0]),
  };
  assert.deepEqual(loadSession(storage, changed).view.selected, []);
  const other = { ...dataset, id: "other-project" };
  assert.deepEqual(
    loadSession(storage, other).view.filters,
    defaultView(other).filters,
  );
});

test("Invalid or inaccessible browser storage falls back to a working default view", () => {
  const storage = memory();
  saveSession(storage, dataset, defaultView(dataset));
  const key = [...storage.values.keys()][0];
  for (const value of [
    "{bad json",
    JSON.stringify({ datasetId: dataset.id, view: { filters: "invalid" } }),
  ]) {
    storage.setItem(key, value);
    assert.deepEqual(
      loadSession(storage, dataset).view.filters,
      defaultView(dataset).filters,
    );
  }
  assert.equal(
    loadSession(
      {
        getItem() {
          throw Error("blocked");
        },
      },
      dataset,
    ).view.tab,
    "runs",
  );
  assert.throws(
    () =>
      saveSession(
        {
          setItem() {
            throw Error("full");
          },
        },
        dataset,
        defaultView(dataset),
      ),
    /full/,
  );
});

test("Filter reordering preserves values and table column order", () => {
  const filters = [
    { field: "/algorithm", values: [valueKey("A")] },
    { field: "/seed", values: [] },
    { field: "/status", values: [] },
  ];
  const moved = moveFilter(filters, "/algorithm", "/status");
  assert.deepEqual(
    moved.map((f) => f.field),
    ["/seed", "/status", "/algorithm"],
  );
  assert.deepEqual(moved[2].values, [valueKey("A")]);
  assert.deepEqual(
    workspaceRunTable(dataset, {
      ...defaultView(dataset),
      filters: moved,
    }).columns.map((c) => c.field),
    moved.map((f) => f.field),
  );
  const handlers = {},
    classes = { add() {}, remove() {}, toggle() {} };
  let state = filters;
  const source = { dataset: { filterField: "/algorithm" }, classList: classes };
  const target = { dataset: { filterField: "/status" }, classList: classes };
  const grip = {
    dataset: { filterDrag: "/algorithm" },
    closest: (s) => (s === "[data-filter-drag]" ? grip : source),
  };
  const root = {
    querySelectorAll: () => [source, target],
    addEventListener: (name, fn) => (handlers[name] = fn),
  };
  mountFilterOrder(root, {
    getFilters: () => state,
    reorder: (filters) => (state = filters),
  });
  handlers.dragstart({ target: grip, dataTransfer: { setData() {} } });
  handlers.drop({ target: { closest: () => target }, preventDefault() {} });
  assert.deepEqual(state, moved);
  handlers.keydown({ target: grip, key: "ArrowLeft", preventDefault() {} });
  assert.deepEqual(
    state.map((f) => f.field),
    ["/seed", "/algorithm", "/status"],
  );
});

test("Actual app auto-saves edits and restores them in a fresh page boot", async () => {
  const storage = memory();
  const boot = async () => {
    const application = testApplication(dataset, storage);
    await application.start();
    return { app: application.el, handlers: application.handlers };
  };
  const first = await boot();
  const click = (data) =>
    first.handlers.click({ target: { closest: () => ({ dataset: data }) } });
  await click({
    action: "toggle-filter-value",
    field: "/seed",
    value: valueKey(0),
  });
  await click({ action: "remove-filter", index: "0" });
  await first.handlers.change({
    target: { dataset: { run: dataset.runs[0].id }, checked: false },
  });
  await click({ action: "tab", tab: "tables" });
  const snapshot = loadSession(storage, dataset).view;
  assert.equal(snapshot.workspaceMode, "tables");
  assert.equal(snapshot.tab, "workspace");
  assert.ok(!snapshot.selected.includes(dataset.runs[0].id));
  assert.deepEqual(snapshot.filters.find((f) => f.field === "/seed").values, [
    valueKey(0),
  ]);
  const second = await boot();
  assert.ok(second.app.innerHTML.includes("<h1>Tables</h1>"));
  assert.deepEqual(
    loadSession(storage, dataset).view.filters,
    snapshot.filters,
  );
  assert.deepEqual(
    loadSession(storage, dataset).view.selected,
    snapshot.selected,
  );
});
