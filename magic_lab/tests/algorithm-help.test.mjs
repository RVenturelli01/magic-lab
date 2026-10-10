import test from "node:test";
import assert from "node:assert/strict";
import katex from "katex";
import { annotateSymbols } from "../core/algorithm-symbols.mjs";
import { validateAlgorithms } from "../core/algorithms.mjs";
import { createMathRenderer } from "../web/math.mjs";
import { mountAlgorithmHelp } from "../web/algorithm-help.mjs";

test("Symbol annotations preserve commands, literal text and unbraced subscripts", () => {
  const symbols = [
    { id: "theta", tex: "\\theta", description: "Policy parameters" },
    { id: "index", tex: "i", description: "Sample index" },
  ];
  const tex = "\\pi_\\theta(a_i)+\\text{initial policy}";
  const annotated = annotateSymbols(tex, symbols);
  assert.match(annotated, /\\pi_/);
  assert.match(annotated, /\\text\{initial policy\}/);
  const math = createMathRenderer(katex);
  assert.match(math(tex, false, symbols), /data-algo-symbol="theta"/);
  assert.match(math(tex, false, symbols), /data-algo-symbol="index"/);
  assert.throws(() => math("\\htmlData{algo-symbol=theta}{x}", false, symbols));
  assert.doesNotMatch(
    math("\\href{javascript:alert(1)}{x}", false, symbols),
    /href=/,
  );
  const doc = {
    version: 2,
    name: "Empty",
    hypothetical: true,
    algorithms: [],
    symbols,
  };
  assert.equal(validateAlgorithms(doc), doc);
  assert.throws(
    () => validateAlgorithms({ ...doc, symbols: [...symbols, symbols[0]] }),
    /symbol/,
  );
});

test("Definitions and notes support focus, pinned clicks, Escape and clean disposal", () => {
  function element(dataset = {}) {
    return {
      dataset,
      style: {},
      attributes: new Map(),
      listeners: new Map(),
      setAttribute(name, value) {
        this.attributes.set(name, value);
      },
      removeAttribute(name) {
        this.attributes.delete(name);
      },
      addEventListener(name, fn) {
        this.listeners.set(name, fn);
      },
      removeEventListener(name) {
        this.listeners.delete(name);
      },
      contains(other) {
        return other === this;
      },
      closest() {
        return this;
      },
      getBoundingClientRect() {
        return { left: 20, top: 20, bottom: 40, width: 180, height: 50 };
      },
      remove() {
        this.removed = true;
      },
    };
  }
  const variable = element({ algoSymbol: "theta" }),
    note = element({ algoNote: "Reuse the rollout." });
  let tip;
  const view = Object.assign(element(), { innerWidth: 900, innerHeight: 600 });
  const document = Object.assign(element(), {
    createElement: () => element(),
    body: {
      append: (value) => {
        tip = value;
      },
    },
    defaultView: view,
  });
  const root = Object.assign(element(), {
    ownerDocument: document,
    contains: (other) => other === variable || other === note,
    querySelectorAll: () => [variable],
  });
  const help = mountAlgorithmHelp(root, () => "Policy parameters");
  help.refresh();
  assert.equal(variable.attributes.get("tabindex"), "0");
  root.listeners.get("focusin")({ target: variable });
  assert.equal(tip.textContent, "Policy parameters");
  assert.equal(tip.hidden, false);
  document.listeners.get("click")({ target: note });
  assert.equal(tip.textContent, "Reuse the rollout.");
  root.listeners.get("pointerover")({ target: variable });
  assert.equal(tip.textContent, "Reuse the rollout.");
  document.listeners.get("keydown")({ key: "Escape" });
  assert.equal(tip.hidden, true);
  assert.equal(note.attributes.has("aria-describedby"), false);
  help.destroy();
  assert.equal(tip.removed, true);
  assert.equal(root.listeners.size, 0);
  assert.equal(document.listeners.size, 0);
  assert.equal(view.listeners.size, 0);
});
