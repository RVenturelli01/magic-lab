import test from "node:test";
import assert from "node:assert/strict";
import katex from "katex";
import {
  singleModuleExample,
  sharedModulesExample,
} from "../examples/magicalgo/algorithm-documents.mjs";
import { validateAlgorithms } from "../core/algorithms.mjs";
import { algorithmGraph } from "../core/algorithm-graph.mjs";
import { algorithmsScreen } from "../web/ui/algorithms.mjs";
import { createMathRenderer } from "../web/math.mjs";

test("Portable authoring examples validate and render every module with real KaTeX", () => {
  for (const factory of [singleModuleExample, sharedModulesExample]) {
    const catalog = validateAlgorithms(factory());
    const math = createMathRenderer(katex, catalog.symbols);
    for (const module of catalog.algorithms) {
      const html = algorithmsScreen(catalog, [module.id], math);
      assert.match(html, /katex/);
      assert.match(html, /math/);
      assert.ok(html.includes(module.title));
    }
    catalog.algorithms[0].title = "Changed by host";
    assert.notEqual(factory().algorithms[0].title, "Changed by host");
  }
});

test("Shared-module example exposes two callers through the document graph", () => {
  const graph = algorithmGraph(validateAlgorithms(sharedModulesExample()));
  assert.equal(graph.edges.filter((edge) => edge.to === "update").length, 2);
});
