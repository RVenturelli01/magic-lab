import test from "node:test";
import assert from "node:assert/strict";
import { mountAlgorithmSplit } from "../web/algorithm-split.mjs";

test("Pane resize previews without committing, cancels safely and supports keyboard bounds", () => {
  let width = 34,
    commits = 0,
    capture;
  const listeners = new Map(),
    styles = new Map(),
    attrs = new Map();
  const layout = {
    style: { setProperty: (key, value) => styles.set(key, value) },
    getBoundingClientRect: () => ({ width: 1000 }),
  };
  const handle = {
    closest: () => layout,
    setAttribute: (key, value) => attrs.set(key, value),
    focus() {},
    setPointerCapture: (id) => {
      capture = id;
    },
    hasPointerCapture: (id) => capture === id,
    releasePointerCapture: () => {
      capture = undefined;
    },
  };
  const root = {
    ownerDocument: { createElement() {} },
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
  };
  const controller = mountAlgorithmSplit(root, {
    getWidth: () => width,
    commit: (value) => {
      width = value;
      commits++;
    },
  });
  const event = (extra = {}) => ({
    target: { closest: () => handle },
    preventDefault() {},
    button: 0,
    pointerId: 1,
    clientX: 600,
    ...extra,
  });
  listeners.get("pointerdown")(event());
  listeners.get("pointermove")(event({ clientX: 500 }));
  assert.equal(styles.get("--algorithm-graph-width"), "44%");
  assert.equal(width, 34);
  assert.equal(commits, 0);
  listeners.get("pointercancel")(event());
  assert.equal(styles.get("--algorithm-graph-width"), "34%");
  listeners.get("pointerdown")(event());
  listeners.get("pointermove")(event({ clientX: 500 }));
  listeners.get("pointerup")(event());
  assert.equal(width, 44);
  assert.equal(commits, 1);
  listeners.get("keydown")(event({ key: "End" }));
  assert.equal(width, 55);
  listeners.get("keydown")(event({ key: "ArrowLeft" }));
  assert.equal(width, 55);
  listeners.get("keydown")(event({ key: "Home" }));
  assert.equal(width, 20);
  listeners.get("keydown")(event({ key: "ArrowRight" }));
  assert.equal(width, 20);
  listeners.get("pointerdown")(event());
  listeners.get("pointermove")(event({ clientX: 500 }));
  listeners.get("keydown")(event({ key: "Escape" }));
  assert.equal(width, 20);
  assert.equal(styles.get("--algorithm-graph-width"), "20%");
  controller.destroy();
  assert.equal(listeners.size, 0);
  assert.equal(capture, undefined);
});
