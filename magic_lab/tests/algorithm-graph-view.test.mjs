import test from "node:test";
import assert from "node:assert/strict";
import {
  fitGraph,
  zoomGraph,
  mountGraphView,
} from "../web/algorithm-graph-view.mjs";

test("Graph fit preserves proportions and anchored zoom keeps the cursor point fixed", () => {
  assert.deepEqual(fitGraph(600, 500, 528, 392), { scale: 1, x: 36, y: 54 });
  const fitted = fitGraph(300, 500, 528, 392);
  assert.equal(fitted.scale, 268 / 528);
  assert.equal(fitted.x, 16);
  const initial = { scale: 1, x: 10, y: 20 };
  assert.deepEqual(zoomGraph(initial, 2, 110, 220), {
    scale: 2,
    x: -90,
    y: -180,
  });
  assert.equal(zoomGraph(initial, 100, 0, 0).scale, 2.5);
  assert.equal(zoomGraph(initial, 0.01, 0, 0).scale, 0.25);
});

test("Graph drag suppresses accidental navigation, cancels safely and disposes all handlers", () => {
  function surface() {
    return {
      listeners: new Map(),
      style: {},
      classList: { add() {}, remove() {} },
      addEventListener(name, fn) {
        this.listeners.set(name, fn);
      },
      removeEventListener(name) {
        this.listeners.delete(name);
      },
      closest() {
        return null;
      },
    };
  }
  let capture,
    disconnected = false;
  const world = { dataset: { width: "528", height: "392" }, style: {} },
    output = {};
  const viewport = Object.assign(surface(), {
    clientWidth: 600,
    clientHeight: 500,
    querySelector: () => world,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 500 }),
    setPointerCapture: (id) => {
      capture = id;
    },
    hasPointerCapture: (id) => capture === id,
    releasePointerCapture: () => {
      capture = undefined;
    },
  });
  const panel = Object.assign(surface(), {
    querySelector: (selector) =>
      selector === "[data-graph-viewport]" ? viewport : output,
    ownerDocument: {
      defaultView: {
        ResizeObserver: class {
          observe() {}
          disconnect() {
            disconnected = true;
          }
        },
      },
    },
  });
  const controller = mountGraphView(panel);
  const initial = controller.state();
  const event = (extra = {}) => ({
    target: viewport,
    button: 0,
    pointerId: 1,
    clientX: 100,
    clientY: 100,
    preventDefault() {},
    ...extra,
  });
  viewport.listeners.get("pointerdown")(event());
  viewport.listeners.get("pointermove")(event({ clientX: 130, clientY: 150 }));
  assert.equal(controller.state().x, initial.x + 30);
  assert.equal(controller.state().y, initial.y + 50);
  viewport.listeners.get("pointerup")(event());
  let prevented = false,
    stopped = false;
  viewport.listeners.get("click")(
    event({
      preventDefault: () => {
        prevented = true;
      },
      stopPropagation: () => {
        stopped = true;
      },
    }),
  );
  assert.equal(prevented && stopped, true);
  const before = controller.state();
  viewport.listeners.get("pointerdown")(event());
  viewport.listeners.get("pointermove")(event({ clientX: 170 }));
  viewport.listeners.get("pointercancel")(event());
  assert.deepEqual(controller.state(), before);
  viewport.listeners.get("keydown")(event({ key: "+" }));
  assert.equal(controller.state().scale, 1.2);
  panel.listeners.get("click")({
    target: {
      closest: (selector) => (selector === "[data-graph-fit]" ? {} : null),
    },
  });
  assert.deepEqual(controller.state(), initial);
  viewport.listeners.get("wheel")(event({ deltaY: -100, deltaMode: 0 }));
  assert.ok(controller.state().scale > 1);
  controller.destroy();
  assert.equal(viewport.listeners.size, 0);
  assert.equal(panel.listeners.size, 0);
  assert.equal(disconnected, true);
  assert.equal(capture, undefined);
});
