import test from "node:test";
import assert from "node:assert/strict";
import { mountWorkspacePanel } from "../web/workspace-panel.mjs";

test("Panel bounds, live resize, cancellation, keyboard and disposal", () => {
  const node = () => {
    const handlers = new Map(),
      props = new Map(),
      attrs = new Map();
    return {
      handlers,
      props,
      attrs,
      style: { setProperty: (key, value) => props.set(key, String(value)) },
      addEventListener: (type, fn) => handlers.set(type, fn),
      removeEventListener: (type) => handlers.delete(type),
      setAttribute: (key, value) => attrs.set(key, String(value)),
      emit(type, data = {}) {
        handlers.get(type)?.({
          preventDefault() {},
          stopPropagation() {},
          ...data,
        });
      },
    };
  };
  const win = { ...node(), innerWidth: 1440, innerHeight: 900 };
  const handle = {
    ...node(),
    focus() {},
    setPointerCapture() {},
    hasPointerCapture: () => true,
    releasePointerCapture() {},
  };
  const editor = {
    ...node(),
    getBoundingClientRect() {
      return {
        top: 200,
        height: Number.parseFloat(this.style.maxHeight) || 600,
      };
    },
  };
  const menu = {
    ...node(),
    open: true,
    querySelector: (selector) =>
      selector === "[data-panel-resize]" ? handle : editor,
  };
  const root = {
    ...node(),
    available: 1400,
    ownerDocument: { defaultView: win },
    getBoundingClientRect() {
      return { width: this.available };
    },
    querySelectorAll: () => [menu],
    querySelector: () => null,
  };
  const commits = [];
  const controller = mountWorkspacePanel(root, {
    width: 320,
    commit: (width) => commits.push(width),
  });
  assert.equal(editor.style.maxHeight, "684px");
  handle.emit("pointerdown", { button: 0, pointerId: 1, clientX: 1100 });
  handle.emit("pointermove", { pointerId: 1, clientX: 900 });
  assert.equal(root.props.get("--workspace-panel-width"), "520px");
  assert.deepEqual(commits, []);
  handle.emit("pointerup", { pointerId: 1 });
  assert.deepEqual(commits, [520]);
  handle.emit("pointerdown", { button: 0, pointerId: 2, clientX: 1100 });
  handle.emit("pointermove", { pointerId: 2, clientX: 900 });
  handle.emit("pointercancel", { pointerId: 2 });
  assert.equal(root.props.get("--workspace-panel-width"), "520px");
  root.available = 900;
  win.innerHeight = 650;
  win.emit("resize");
  assert.equal(editor.style.maxHeight, "434px");
  handle.emit("keydown", { key: "End" });
  assert.equal(root.props.get("--workspace-panel-width"), "556px");
  handle.emit("keydown", { key: "Home" });
  assert.equal(root.props.get("--workspace-panel-width"), "280px");
  handle.emit("keydown", { key: "ArrowLeft" });
  assert.equal(handle.attrs.get("aria-valuenow"), "290");
  handle.emit("pointerdown", { button: 0, pointerId: 3, clientX: 1100 });
  handle.emit("pointermove", { pointerId: 3, clientX: 900 });
  handle.emit("keydown", { key: "Escape" });
  assert.equal(root.props.get("--workspace-panel-width"), "290px");
  controller.destroy();
  assert.equal(handle.handlers.size, 0);
  assert.equal(menu.handlers.size, 0);
  assert.equal(win.handlers.size, 0);
  root.available = 1800;
  const deck = { querySelectorAll: () => [{}, {}] };
  root.querySelector = (selector) => (selector === ".plot-deck" ? deck : null);
  const automaticPanel = mountWorkspacePanel(root);
  assert.equal(root.props.get("--workspace-panel-width"), "476px");
  assert.equal(root.props.get("--workspace-chart-columns"), "2");
  handle.emit("pointerdown", { button: 0, pointerId: 4, clientX: 1300 });
  handle.emit("pointermove", { pointerId: 4, clientX: 1100 });
  assert.equal(root.props.get("--workspace-panel-width"), "676px");
  assert.equal(root.props.get("--workspace-chart-columns"), "2");
  handle.emit("pointerup", { pointerId: 4 });
  automaticPanel.destroy();
});
