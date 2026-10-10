import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(
  new URL("../web/theme.mjs", import.meta.url),
  "utf8",
);
function boot({ stored = null, dark = false, blocked = false } = {}) {
  const root = { dataset: {} },
    meta = {},
    values = new Map(),
    listeners = {};
  const media = {
    matches: dark,
    addEventListener: (event, fn) => (listeners[event] = fn),
  };
  const window = { matchMedia: () => media };
  const localStorage = {
    getItem: () => {
      if (blocked) throw Error("blocked");
      return stored;
    },
    setItem: (key, value) => {
      if (blocked) throw Error("blocked");
      values.set(key, value);
    },
  };
  vm.runInNewContext(source, {
    window,
    localStorage,
    document: {
      documentElement: root,
      querySelector: () => ({
        setAttribute: (key, value) => (meta[key] = value),
      }),
    },
  });
  return {
    theme: window.observatoryTheme,
    root,
    meta,
    values,
    media,
    listeners,
  };
}
test("theme restores before app startup and persists changes across reloads", () => {
  const app = boot({ stored: "light" });
  assert.equal(app.root.dataset.theme, "light");
  assert.equal(app.meta.content, "#f1f4f4");
  assert.equal(app.theme.set("dark"), true);
  assert.equal(app.root.dataset.theme, "dark");
  assert.equal(app.meta.content, "#202628");
  assert.equal(
    boot({ stored: app.values.get("rl-observatory.theme.v1") }).theme.get(),
    "dark",
  );
  assert.equal(boot({ stored: "invalid" }).theme.get(), "dark");
});
test("system preference follows OS changes only in automatic mode", () => {
  const app = boot({ stored: "system", dark: true });
  assert.equal(app.root.dataset.theme, "dark");
  app.media.matches = false;
  app.listeners.change();
  assert.equal(app.root.dataset.theme, "light");
  app.theme.set("dark");
  app.listeners.change();
  assert.equal(app.root.dataset.theme, "dark");
  app.theme.set("system");
  assert.equal(app.root.dataset.theme, "light");
  assert.equal(app.theme.get(), "system");
});
test("blocked storage still permits changing theme and reports persistence failure", () => {
  const app = boot({ blocked: true });
  assert.equal(app.theme.get(), "dark");
  assert.equal(app.theme.set("light"), false);
  assert.equal(app.root.dataset.theme, "light");
  assert.throws(() => app.theme.set("invalid"), /Unknown theme/);
  assert.equal(app.theme.get(), "light");
});

test("colored themes restore, persist and keep their choice on OS changes", () => {
  for (const [name, background] of [
    ["blue", "#202630"],
    ["purple", "#282330"],
    ["green", "#202b25"],
    ["amber", "#2d2720"],
  ]) {
    const app = boot({ stored: name });
    assert.equal(app.theme.get(), name);
    assert.equal(app.root.dataset.theme, name);
    assert.equal(app.meta.content, background);
    app.media.matches = true;
    app.listeners.change();
    assert.equal(app.root.dataset.theme, name);
    app.theme.set("light");
    assert.equal(app.theme.set(name), true);
    const restored = boot({
      stored: app.values.get("rl-observatory.theme.v1"),
    });
    assert.equal(restored.theme.get(), name);
    assert.equal(restored.root.dataset.theme, name);
    assert.equal(restored.meta.content, background);
  }
});
