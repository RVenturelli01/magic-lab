import test from "node:test";
import assert from "node:assert/strict";
import { createFixture } from "./support/dataset.mjs";
import { testApplication } from "./support/application.mjs";
import { workspace } from "../web/ui/workspace.mjs";
import { createApplication } from "../web/application/application.mjs";

test("Analysis controls render intact arrows, separators and close symbols in every mode", () => {
  const app = testApplication(createFixture());
  app.state.view.tab = "workspace";
  app.state.view.paper.legendPositions = { individual: "upper right" };
  for (const mode of ["charts", "ablation", "tables"]) {
    app.state.view.workspaceMode = mode;
    app.render();
    assert.doesNotMatch(app.el.innerHTML, /[?\uFFFD]/);
    assert.match(app.el.innerHTML, /Close settings panel">&#215;<\/button>/);
    if (mode !== "tables") {
      assert.match(app.el.innerHTML, /use &#8593; \/ &#8595; to reorder/);
      assert.match(app.el.innerHTML, /Individual positions: choose for all/);
    }
  }
  app.destroy();
});

for (const kind of ["style", "settings"])
  test(`${kind} stays open while using charts and closes explicitly with focus restored`, async () => {
    let focused = 0;
    const style = {
        dataset: { menu: kind },
        open: true,
        contains: () => false,
        querySelector: () => ({ focus: () => focused++ }),
      },
      popup = {
        dataset: { menu: "export" },
        open: true,
        contains: () => false,
      },
      document = {
        querySelectorAll: () => [style, popup].filter((menu) => menu.open),
        querySelector: () => (style.open ? style : null),
      },
      app = testApplication(createFixture(), undefined, { document });
    await app.handlers.click({ target: { closest: () => null } });
    assert.equal(style.open, true);
    assert.equal(popup.open, false);
    let prevented = false;
    app.handlers.keydown({
      key: "Escape",
      preventDefault: () => (prevented = true),
    });
    assert.equal(style.open, false);
    assert.equal(focused, 1);
    assert.equal(prevented, true);
    style.open = true;
    await app.handlers.click({
      target: {
        closest: () => ({
          dataset: { action: "close-settings" },
          closest: () => style,
        }),
      },
    });
    assert.equal(style.open, false);
    assert.equal(focused, 2);
    app.destroy();
  });

test("Application instances isolate selection and unregister their listeners on disposal", async () => {
  const dataset = createFixture(),
    first = testApplication(dataset),
    second = testApplication(dataset);
  await first.handlers.change({
    target: { dataset: { run: dataset.runs[0].id }, checked: false },
  });
  assert.ok(!first.state.view.selected.includes(dataset.runs[0].id));
  assert.ok(second.state.view.selected.includes(dataset.runs[0].id));
  first.destroy();
  assert.deepEqual(Object.keys(first.handlers), []);
  assert.equal(Object.keys(second.handlers).length, 3);
});

test("Workspace templates do not mutate application state and omit named-view controls", () => {
  const { state, render, el } = testApplication(createFixture());
  state.view.tab = "workspace";
  const originalView = structuredClone(state.view),
    originalResults = state.chartResults;
  assert.match(workspace(state), /chart-plot/);
  assert.deepEqual(state.view, originalView);
  assert.equal(state.chartResults, originalResults);
  render();
  for (const action of ["save", "import", "export-view"])
    assert.ok(!el.innerHTML.includes('data-action="' + action + '"'));
});

test("Startup renders an escaped dataset error before requesting any figures", async () => {
  const el = { innerHTML: "", addEventListener() {} },
    paths = [];
  const app = createApplication({
    el,
    document: {},
    localStorage: { getItem: () => null },
    fetch: async (path) => {
      paths.push(path);
      return { ok: false, text: async () => "<unsafe>" };
    },
  });
  await app.start();
  assert.match(el.innerHTML, /&lt;unsafe&gt;/);
  assert.deepEqual(paths, ["/api/dataset"]);
});

test("Failed preset persistence reports an error without a success message", async () => {
  const storage = {
    getItem: () => null,
    setItem() {
      throw Error("quota");
    },
  };
  const app = testApplication(createFixture(), storage, {
    prompt: () => "my preset",
  });
  await app.handlers.click({
    target: {
      closest: () => ({ dataset: { action: "save-preset", kind: "style" } }),
    },
  });
  assert.equal(app.state.storageOK, false);
  assert.deepEqual(
    app.notices.map((element) => element.textContent),
    ["Error: Storage unavailable"],
  );
});
