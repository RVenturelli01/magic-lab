import test from "node:test";
import assert from "node:assert/strict";
import { moveCurve } from "../web/curve-order.mjs";
import { mountNumberScrub, scrubValue } from "../web/number-scrub.mjs";
import { paperEditor } from "../web/paper-editor.mjs";
import { paperChart, normalizePaper } from "../core/paper-style.mjs";
import { paperFigure } from "../web/paper-figure.mjs";

test("Curve insertion preserves styling and matches foreground order in Plotly and restored editor", () => {
  const keys = moveCurve(["c", "b", "a"], "a", "c");
  assert.deepEqual(keys, ["a", "c", "b"]);
  assert.deepEqual(moveCurve(keys, "a", "b", true), ["c", "b", "a"]);
  const series = Object.fromEntries(
    keys.map((key, i) => [
      key,
      { order: keys.length - 1 - i, color: "#123456", label: key },
    ]),
  );
  const view = {
    paper: normalizePaper({ series, uncertainty: "none" }),
    chartSeries: "runs",
    band: "none",
  };
  const chart = {
    view,
    metric: { id: "m", label: "Metric", unit: "reward", xUnit: "step" },
    result: {
      groups: ["a", "b", "c"].map((key) => ({
        key,
        name: key,
        points: [
          { step: 0, mean: 1, sd: null, n: 1 },
          { step: 1, mean: 2, sd: null, n: 1 },
        ],
      })),
    },
  };
  assert.deepEqual(
    paperChart(chart).groups.map((g) => g.key),
    ["b", "c", "a"],
  );
  assert.deepEqual(
    paperFigure(chart).series.map((g) => g.key),
    ["b", "c", "a"],
  );
  const html = paperEditor(view, [chart]);
  assert.ok(
    html.indexOf('data-curve-key="a"') < html.indexOf('data-curve-key="c"'),
  );
  assert.ok(!html.includes('data-paper-key="order"'));
  assert.equal(view.paper.series.a.color, "#123456");
});

test("Numeric scrub respects bounds, precision and integer constraints", () => {
  assert.equal(scrubValue(0.7, 16), 1.5);
  assert.equal(scrubValue(0.7, -16), -0.1);
  assert.equal(scrubValue(0.7, 16, { fine: true }), 0.72);
  assert.equal(scrubValue(0.95, 80, { step: 0.01, max: 1 }), 1);
  assert.equal(scrubValue(1, -80, { integer: true, step: 1, min: 1 }), 1);
  assert.equal(scrubValue(10, 16, { integer: true, step: 1, fine: true }), 10);
});

test("Pointer scrub commits once on release and cancellation restores blank or previous value", () => {
  const handlers = {},
    events = [],
    popups = [],
    previews = [];
  let capture = false;
  const doc = {
    documentElement: { clientWidth: 800, clientHeight: 600 },
    body: { append: (p) => popups.push(p) },
    createElement: () => {
      const children = {};
      return {
        style: {},
        querySelector: (key) =>
          (children[key] ??= { style: {}, textContent: "" }),
        setAttribute() {},
        remove() {
          this.removed = true;
        },
      };
    },
  };
  const input = {
    dataset: { paperKey: "lineWidth" },
    value: ".7",
    step: "any",
    min: "0",
    max: "6",
    classList: { add() {}, remove() {} },
    addEventListener: (name, fn) => (handlers[name] = fn),
    setPointerCapture() {
      capture = true;
    },
    hasPointerCapture: () => capture,
    releasePointerCapture() {
      capture = false;
      handlers.lostpointercapture();
    },
    blur() {},
    getBoundingClientRect: () => ({ top: 100, right: 200 }),
    dispatchEvent: (event) => events.push(event.type),
  };
  mountNumberScrub(
    { ownerDocument: doc, querySelectorAll: () => [input] },
    { preview: (t) => previews.push(t ? Number(t.value) : null) },
  );
  const event = { button: 0, pointerId: 1, clientY: 100, preventDefault() {} };
  handlers.pointerdown(event);
  handlers.pointermove({ ...event, clientY: 84 });
  assert.equal(input.value, 1.5);
  assert.deepEqual(events, []);
  handlers.pointermove({ ...event, clientY: 84, shiftKey: true });
  assert.equal(input.value, 1.5);
  handlers.pointermove({ ...event, clientY: 68, shiftKey: true });
  assert.equal(input.value, 1.52);
  handlers.pointermove({ ...event, clientY: 68, shiftKey: false });
  assert.equal(input.value, 1.52);
  handlers.pointermove({ ...event, clientY: 60, shiftKey: false });
  assert.equal(input.value, 1.92);
  assert.deepEqual(previews, [1.5, 1.52, 1.92]);
  handlers.pointerup();
  assert.deepEqual(events, ["change"]);
  assert.ok(popups[0].removed);
  assert.equal(previews.at(-1), null);
  input.value = "";
  handlers.pointerdown(event);
  handlers.pointermove({ ...event, clientY: 60 });
  handlers.pointercancel();
  assert.equal(input.value, "");
  assert.deepEqual(events, ["change"]);
  assert.ok(popups[1].removed);
});
