import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import katex from "../magic_lab/node_modules/katex/dist/katex.mjs";
import { validateAlgorithms } from "../magic_lab/core/algorithms.mjs";
import { algorithmsScreen } from "../magic_lab/web/ui/algorithms.mjs";
import { createMathRenderer } from "../magic_lab/web/math.mjs";
import { algorithmGraph } from "../magic_lab/core/algorithm-graph.mjs";

test("PPO and DQN host references have separate graphs and progressively accessible modules; every formula typesets", async () => {
  const doc = validateAlgorithms(
    JSON.parse(
      await readFile(
        new URL(
          "../magic_lab/examples/magicalgo/algorithms.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );
  assert.equal(doc.hypothetical, true);
  assert.equal(doc.root, "ppo");
  assert.deepEqual(algorithmGraph(doc).edges, [
    { from: "ppo", to: "collect" },
    { from: "ppo", to: "optimize" },
    { from: "collect", to: "gae" },
    { from: "dqn", to: "dqn-interaction" },
    { from: "dqn", to: "dqn-update" },
  ]);
  assert.doesNotMatch(JSON.stringify(doc), /[àèéìòù]/);
  assert.deepEqual(
    doc.algorithms.map((a) => a.id),
    [
      "ppo",
      "collect",
      "optimize",
      "gae",
      "dqn",
      "dqn-interaction",
      "dqn-update",
    ],
  );
  const math = createMathRenderer(katex);
  const root = algorithmsScreen(doc, ["ppo"], math);
  assert.match(root, /data-algo-call="collect"/);
  assert.match(root, /data-algo-call="optimize"/);
  assert.match(root, /On-Policy Data Collection/);
  assert.match(root, /PPO Optimization/);
  assert.doesNotMatch(root, /Algorithm 2|Algorithm 3/);
  assert.doesNotMatch(root, /L_i|\\delta_t|data-algo-call="gae"/);
  const collection = algorithmsScreen(doc, ["ppo", "collect"], math);
  assert.match(collection, /data-algo-call="gae"/);
  const dqn = algorithmsScreen(doc, ["dqn"], math);
  assert.match(dqn, /data-algo-call="dqn-update"/);
  assert.doesNotMatch(dqn, /data-algo-node="ppo"/);
  assert.match(dqn, /data-algo-node="dqn"/);
  const update = doc.algorithms.find((entry) => entry.id === "dqn-update");
  assert.ok(update.body.some((node) => node.math?.includes("(1-d_i)")));
  assert.ok(
    update.body.some((node) =>
      node.content?.some((token) => token.math?.includes("\\theta-\\alpha")),
    ),
  );
  for (const a of doc.algorithms) {
    const html = algorithmsScreen(doc, [a.id], math);
    assert.equal((html.match(/data-algo-note=/g) ?? []).length, 1);
    assert.match(html, /data-algo-symbol=/);
    assert.deepEqual(a.notes, []);
  }
});
