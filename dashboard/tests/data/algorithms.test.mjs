import { test } from "node:test";
import assert from "node:assert/strict";
import katex from "katex";
import {
  algorithmVariants,
  filterAlgorithmVariants,
  variantKey,
} from "../../lib/algorithms/catalog.ts";
import { formulations } from "../../lib/algorithms/formulations.ts";
import { createSampleAdapter } from "../../lib/data/sample-adapter.ts";
import { parseAlgorithmPreferences } from "../../lib/algorithms/preferences.ts";
import {
  alignAlgorithmLines,
  matchingIndices,
} from "../../lib/algorithms/diff.ts";

test("MagicAlgo inventory covers every sample algorithm without inventing versions", async () => {
  const runs = (await createSampleAdapter().listRuns()).runs;
  const variants = algorithmVariants(runs);
  assert.deepEqual(
    variants.map(({ name, version, runCount }) => [name, version, runCount]),
    [
      ["A2C", null, 10],
      ["A2C", "demo-no-entropy", 10],
      ["PPO", null, 10],
      ["PPO", "demo-normalized", 10],
      ["SAC", null, 10],
      ["SAC", "demo-auto-temperature", 10],
    ],
  );
  assert.ok(variants.every((variant) => formulations[variantKey(variant)]));
});

test("a newly recorded version gets its own entry and no stale formulation", async () => {
  const source = (await createSampleAdapter().listRuns()).runs[0];
  const v1 = {
    ...source,
    config: { ...source.config, algorithm_version: "1.0" },
  };
  const v2 = {
    ...source,
    config: { ...source.config, algorithm: { name: "PPO", version: "2.0" } },
  };
  const variants = algorithmVariants([source, v1, v2]);
  assert.deepEqual(
    variants.map(({ name, version, runCount }) => [name, version, runCount]),
    [
      ["PPO", null, 1],
      ["PPO", "1.0", 1],
      ["PPO", "2.0", 1],
    ],
  );
  assert.equal(formulations[variantKey(variants[1])], undefined);
  assert.equal(formulations[variantKey(variants[2])], undefined);
  assert.equal(
    filterAlgorithmVariants(variants, {
      search: "",
      filters: { algorithm: ["PPO"], version: ["1.0"] },
      sort: "version",
    }).length,
    1,
  );
});

test("variant filters use OR within a facet and AND between facets", async () => {
  const runs = (await createSampleAdapter().listRuns()).runs;
  const variants = algorithmVariants([
    ...runs,
    { ...runs[0], config: { ...runs[0].config, algorithm_version: "2.0" } },
  ]);
  const filters = {
    algorithm: ["PPO", "SAC"],
    version: ["Unversioned"],
  };
  const visible = filterAlgorithmVariants(variants, {
    search: "",
    filters,
    sort: "name",
  });
  assert.equal(visible.length, 2);
  assert.deepEqual(
    visible.map((variant) => variant.name),
    ["PPO", "SAC"],
  );
  assert.equal(
    filterAlgorithmVariants(variants, { search: "ppo", filters, sort: "name" })
      .length,
    1,
  );
});

test("reference algorithms have numbered nested lines and valid mathematical notation", () => {
  for (const formulation of Object.values(formulations)) {
    assert.ok(formulation.lines.length > 0);
    assert.ok(formulation.symbols.length > 0);
    for (const tex of [
      formulation.input,
      ...formulation.lines.map((line) => line.tex),
      formulation.output,
    ]) {
      assert.doesNotThrow(() =>
        katex.renderToString(tex, { throwOnError: true, strict: "ignore" }),
      );
    }
    assert.ok(
      formulation.lines.every(
        (line) => Number.isInteger(line.depth) && line.depth >= 0,
      ),
    );
  }
});

test("saved variant selection and paper preferences restore with invalid fields ignored", () => {
  const restored = parseAlgorithmPreferences({
    selectedVariantKey: '["PPO",null]',
    filters: { algorithm: ["PPO", 2] },
    visibleFilterKeys: ["algorithm"],
    sort: "version",
    showNotes: true,
  });
  assert.equal(restored.selectedVariantKey, '["PPO",null]');
  assert.deepEqual(restored.filters.algorithm, ["PPO"]);
  assert.deepEqual(restored.visibleFilterKeys, ["algorithm"]);
  assert.equal(restored.showNotes, true);
  assert.equal(parseAlgorithmPreferences({ search: "ppo" }).search, "");
  assert.equal(parseAlgorithmPreferences({ sort: "unsafe" }).sort, "name");
  assert.equal(restored.comparisonVariantKey, null);
  assert.equal(
    parseAlgorithmPreferences({
      comparisonVariantKey: '["PPO","demo-normalized"]',
    }).comparisonVariantKey,
    '["PPO","demo-normalized"]',
  );
  assert.equal(
    parseAlgorithmPreferences({ comparisonVariantKey: 42 })
      .comparisonVariantKey,
    null,
  );
});

test("algorithm diff aligns insertions and removals without shifting unchanged steps", () => {
  const baseline = formulations['["PPO",null]'];
  const normalized = formulations['["PPO","demo-normalized"]'];
  const rows = alignAlgorithmLines(baseline.lines, normalized.lines);
  assert.equal(rows.length, normalized.lines.length);
  assert.deepEqual(
    rows.filter((row) => row.changed),
    [
      { left: null, right: 10, changed: true },
      { left: null, right: 11, changed: true },
    ],
  );
  assert.deepEqual(rows[12], { left: 10, right: 12, changed: false });
  assert.deepEqual(
    alignAlgorithmLines(normalized.lines, baseline.lines).filter(
      (row) => row.changed,
    ),
    [
      { left: 10, right: null, changed: true },
      { left: 11, right: null, changed: true },
    ],
  );
});

test("algorithm diff pairs replacements and detects notes and nesting changes", () => {
  const lines = [
    { depth: 0, tex: "a" },
    { depth: 1, tex: "b" },
    { depth: 0, tex: "c" },
  ];
  assert.deepEqual(
    alignAlgorithmLines(lines, [lines[0], { depth: 1, tex: "x" }, lines[2]]),
    [
      { left: 0, right: 0, changed: false },
      { left: 1, right: 1, changed: true },
      { left: 2, right: 2, changed: false },
    ],
  );
  assert.ok(
    alignAlgorithmLines(
      [lines[0]],
      [{ ...lines[0], note: "Changed explanation" }],
    )[0].changed,
  );
  assert.ok(
    alignAlgorithmLines([lines[0]], [{ ...lines[0], depth: 1 }])[0].changed,
  );
  assert.deepEqual(alignAlgorithmLines([], []), []);
  assert.deepEqual(alignAlgorithmLines([], [lines[0]]), [
    { left: null, right: 0, changed: true },
  ]);
  assert.deepEqual(
    matchingIndices("x+α".split(""), "x+β".split(""), (a, b) => a === b),
    [
      [0, 0],
      [1, 1],
    ],
  );
});
