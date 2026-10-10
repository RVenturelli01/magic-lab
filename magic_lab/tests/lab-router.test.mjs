import test from "node:test";
import assert from "node:assert/strict";
import { createLabRouter } from "../web/application/router.mjs";
import { createApplication } from "../web/application/application.mjs";
import { createFixture } from "./support/dataset.mjs";

function harness(hash = "") {
  const listeners = new Map();
  const mount = { querySelector: () => null, focus() {} };
  const el = {
    innerHTML: "",
    querySelector: () => mount,
    addEventListener() {},
    removeEventListener() {},
  };
  const window = {
    location: { hash },
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name) => listeners.delete(name),
  };
  let starts = 0,
    disposals = 0;
  const router = createLabRouter(
    { el, window, document: {} },
    () => {
      return {
        start: async () => {
          starts++;
        },
        destroy: () => {
          disposals++;
        },
      };
    },
    () => ({ start: async () => {}, destroy() {} }),
  );
  return {
    router,
    el,
    listeners,
    counts: () => ({ starts, disposals }),
    navigate(hash) {
      window.location.hash = hash;
      listeners.get("hashchange")();
    },
  };
}

test("MagicLab opens without starting MagicPlot; placeholders remain independent", () => {
  const app = harness();
  app.router.start();
  assert.match(app.el.innerHTML, /href="#magicplot"/);
  app.navigate("#magicalgo");
  assert.match(app.el.innerHTML, /MagicAlgo workspace/);
  app.navigate("#magictuner");
  assert.match(app.el.innerHTML, /MagicTuner workspace/);
  assert.deepEqual(app.counts(), { starts: 0, disposals: 0 });
  app.navigate("#unknown");
  assert.match(app.el.innerHTML, /Choose a workspace/);
  app.router.destroy();
  assert.equal(app.listeners.size, 0);
});

test("Direct MagicPlot links mount once and navigation disposes before reentry", async () => {
  const app = harness("#magicplot");
  app.router.start();
  app.navigate("#magicplot");
  assert.deepEqual(app.counts(), { starts: 1, disposals: 0 });
  app.navigate("#magiclab");
  app.navigate("#magicplot");
  await Promise.resolve();
  assert.deepEqual(app.counts(), { starts: 2, disposals: 1 });
  app.router.destroy();
  assert.deepEqual(app.counts(), { starts: 2, disposals: 2 });
});

test("Leaving MagicPlot while its dataset loads prevents late rendering", async () => {
  let finish;
  const el = {
    innerHTML: "unchanged",
    addEventListener() {},
    removeEventListener() {},
  };
  const app = createApplication({
    el,
    document: {},
    localStorage: {},
    fetch: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const starting = app.start();
  app.destroy();
  finish({ ok: true, json: async () => createFixture() });
  await starting;
  assert.equal(el.innerHTML, "unchanged");
  assert.equal(app.state.dataset, null);
});
