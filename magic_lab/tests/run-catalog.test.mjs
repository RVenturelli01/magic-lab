import test from "node:test";
import assert from "node:assert/strict";
import { createFixture } from "./support/dataset.mjs";
import { testApplication } from "./support/application.mjs";
import { runMetadata, runCatalogue } from "../web/application/run-catalog.mjs";
import { filters, runs } from "../web/ui/runs.mjs";
import { defaultView, normalizeView } from "../core/view.mjs";
import { valueKey } from "../core/filters.mjs";

function catalogueFixture(count = 121) {
  const dataset = createFixture();
  dataset.runs = Array.from({ length: count }, (_, i) => ({
    ...dataset.runs[0],
    id: `row-${i}`,
    seed: i,
    name: "replicas",
  }));
  dataset.points = [];
  return dataset;
}
const click = (app, dataset) =>
  app.handlers.click({ target: { closest: () => ({ dataset }) } });

test("Metadata is reused within an instance, replaced on reload, and leaves source options intact", () => {
  const app = testApplication(catalogueFixture());
  const metadata = runMetadata(app.state);
  assert.equal(runMetadata(app.state), metadata);
  assert.deepEqual(
    normalizeView(app.state.view, app.state.dataset, metadata.fields),
    normalizeView(app.state.view, app.state.dataset),
  );
  app.state.view.filters = [{ field: "/seed", values: [valueKey(999)] }];
  filters(app.state);
  assert.equal(
    metadata.fields.find((f) => f.field === "/seed").options.length,
    121,
  );
  app.state.dataset = {
    ...app.state.dataset,
    runs: app.state.dataset.runs.slice(0, 1),
  };
  assert.notEqual(runMetadata(app.state), metadata);
  assert.equal(
    app.state.runMetadata.fields.find((f) => f.field === "/seed").options
      .length,
    1,
  );
  app.destroy();
});

test("Catalogue pages bound rendered rows while selection covers all filtered pages", async () => {
  const app = testApplication(catalogueFixture());
  app.render();
  assert.equal((app.el.innerHTML.match(/data-run="row-/g) ?? []).length, 100);
  await click(app, {
    action: "run-page",
    page: "1",
    direction: "next",
    field: "",
  });
  assert.equal((app.el.innerHTML.match(/data-run="row-/g) ?? []).length, 21);
  assert.match(app.el.innerHTML, /data-run="row-120"/);
  await app.handlers.change({
    target: { dataset: { run: "row-120" }, checked: false },
  });
  assert.equal(app.state.runPage, 1);
  await app.handlers.change({
    target: { dataset: { visible: "true" }, checked: false },
  });
  assert.deepEqual(app.state.view.selected, []);
  await app.handlers.change({
    target: { dataset: { visible: "true" }, checked: true },
  });
  assert.equal(app.state.view.selected.length, 121);
  await click(app, {
    action: "toggle-filter-value",
    field: "/seed",
    value: valueKey(0),
  });
  assert.equal(app.state.runPage, 0);
  assert.deepEqual(app.state.view.selected, ["row-0"]);
  await click(app, { action: "reset-filters" });
  assert.deepEqual(app.state.view.selected, ["row-0"]);
  app.destroy();
});

test("Expanded group children are paged and group actions keep full membership", async () => {
  const app = testApplication(catalogueFixture());
  app.state.view.runGrouping = "configuration";
  await click(app, { action: "expand-group", group: "0" });
  assert.equal((app.el.innerHTML.match(/data-run="row-/g) ?? []).length, 99);
  await click(app, {
    action: "run-page",
    page: "1",
    direction: "next",
    field: "",
  });
  assert.match(app.el.innerHTML, /data-run="row-120"/);
  await app.handlers.change({
    target: { dataset: { group: "0" }, checked: false },
  });
  assert.deepEqual(app.state.view.selected, []);
  app.destroy();
});

test("Filter value pages retain typed selected values and unavailable imported options", async () => {
  const app = testApplication(catalogueFixture());
  app.state.view.filters = [
    { field: "/seed", values: [valueKey(120), valueKey(999)] },
  ];
  runMetadata(app.state);
  assert.equal(
    (filters(app.state).match(/data-action="toggle-filter-value"/g) ?? [])
      .length,
    60,
  );
  await click(app, {
    action: "filter-page",
    field: "/seed",
    page: "2",
    direction: "next",
  });
  assert.match(filters(app.state), /999.*unavailable/);
  assert.equal(
    (filters(app.state).match(/aria-pressed="true"/g) ?? []).length,
    2,
  );
  assert.deepEqual(app.state.view.filters[0].values, [
    valueKey(120),
    valueKey(999),
  ]);
  app.destroy();
});

test("Catalogue clamps stale page numbers for empty results", () => {
  const app = testApplication(catalogueFixture());
  app.state.runPage = 20;
  app.state.view.filters = [{ field: "/seed", values: [valueKey(-1)] }];
  assert.match(runs(app.state), /No runs/);
  assert.doesNotMatch(runs(app.state), /data-action="run-page"/);
  app.destroy();
});

test("Catalogue snapshot survives selection/page changes and refreshes for filter/group changes", () => {
  const app = testApplication(catalogueFixture());
  app.state.dataset.runs = app.state.dataset.runs.map(
    ({ name, ...run }) => run,
  );
  app.state.view.runGrouping = "configuration";
  const initial = runCatalogue(app.state);
  app.state.view.selected = [];
  app.state.runPage = 1;
  assert.equal(runCatalogue(app.state), initial);
  app.state.view.filters = [{ field: "/seed", values: [valueKey(120)] }];
  const filtered = runCatalogue(app.state);
  assert.notEqual(filtered, initial);
  assert.deepEqual(
    filtered.table.runs.map((r) => r.id),
    ["row-120"],
  );
  assert.equal(filtered.totalGroups, 1);
  app.state.view.runGrouping = "none";
  assert.equal(runCatalogue(app.state).totalGroups, 0);
  app.destroy();
});
