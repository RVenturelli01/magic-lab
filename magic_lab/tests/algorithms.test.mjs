import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import katex from "katex";
import { validateAlgorithms } from "../core/algorithms.mjs";
import { algorithmsScreen, algorithmTabs } from "../web/ui/algorithms.mjs";
import { createAlgorithmsApplication } from "../web/application/algorithms.mjs";
import { createMathRenderer } from "../web/math.mjs";
import { createServer } from "../server/http.mjs";
import { algorithmGraph, sharedModuleNote } from "../core/algorithm-graph.mjs";

function fixture() {
  const module = (id, number) => ({
    id,
    number,
    title: id,
    input: [{ math: "x" }],
    output: [{ math: "y" }],
    notes: [],
    body: [{ kind: "equation", math: "y=x^2" }],
  });
  const root = module("root", 1),
    child = module("child", 2);
  root.body = [
    {
      kind: "block",
      header: [{ keyword: "repeat" }],
      body: [
        {
          kind: "line",
          content: [{ math: "y\\leftarrow" }, { call: "child" }],
        },
      ],
    },
  ];
  return {
    version: 2,
    name: "Contract fixture",
    hypothetical: true,
    root: "root",
    algorithms: [root, child],
  };
}
test("Modular documents reject dangling calls, cycles, duplicate IDs and excessive nesting", () => {
  const doc = fixture();
  assert.equal(validateAlgorithms(doc), doc);
  doc.algorithms[1].body = [{ kind: "line", content: [{ call: "missing" }] }];
  assert.throws(() => validateAlgorithms(doc), /unknown module/);
  doc.algorithms[1].body[0].content[0].call = "root";
  assert.throws(() => validateAlgorithms(doc), /cyclic/);
  doc.algorithms[1].id = "root";
  assert.throws(() => validateAlgorithms(doc), /duplicate/);
  const deep = fixture();
  let nodes = deep.algorithms[1].body;
  for (let i = 0; i < 14; i++)
    nodes = [{ kind: "block", header: [{ text: "loop" }], body: nodes }];
  deep.algorithms[1].body = nodes;
  assert.throws(() => validateAlgorithms(deep), /nesting/);
});
test("The root shows calls but hides child formulas; math renders as real accessible typesetting", () => {
  const doc = fixture(),
    math = createMathRenderer(katex);
  doc.algorithms[0].title = "<img src=x>";
  const root = algorithmsScreen(doc, ["root"], math);
  assert.match(root, /&lt;img/);
  assert.doesNotMatch(root, /<img|y=x\^2/);
  assert.match(root, /data-algo-call="child"/);
  const child = algorithmsScreen(doc, ["root", "child"], math);
  assert.match(child, /class="katex"/);
  assert.match(child, /<math/);
  assert.match(child, /data-algo-level="0"/);
  assert.match(
    algorithmsScreen({ ...doc, algorithms: [] }, [], math),
    /No algorithms/,
  );
  assert.throws(
    () => math("\\nonexistentcommand"),
    /Undefined control sequence/,
  );
  assert.doesNotMatch(math("\\href{javascript:alert(1)}{click}"), /href=/);
});
test("Drill-down and parent navigation restore focus and scroll without fetching again", async () => {
  let click,
    fetches = 0,
    focused = 0;
  const scrolls = [],
    view = {
      scrollY: 300,
      scrollTo: (_, y) => {
        scrolls.push(y);
        view.scrollY = y;
      },
    };
  const el = {
    innerHTML: "",
    ownerDocument: { defaultView: view },
    addEventListener: (_, handler) => {
      click = handler;
    },
    removeEventListener: () => {
      click = null;
    },
    querySelector: () => ({
      focus() {
        focused++;
      },
    }),
  };
  const app = createAlgorithmsApplication({
    el,
    katex,
    fetch: async () => {
      fetches++;
      return { ok: true, json: async () => fixture() };
    },
  });
  await app.start();
  const press = (dataset) =>
    click({
      target: { closest: () => ({ dataset, hasAttribute: () => false }) },
    });
  press({ algoCall: "child" });
  assert.match(el.innerHTML, /y=x\^2/);
  press({ algoLevel: "0" });
  assert.doesNotMatch(el.innerHTML, /y=x\^2/);
  assert.deepEqual(scrolls, [0, 300]);
  assert.equal(focused, 2);
  assert.equal(fetches, 1);
  app.destroy();
  assert.equal(click, null);
});
test("Header lists only main algorithms, with disabled pending entries and active parent navigation", async () => {
  const doc = fixture();
  doc.pendingAlgorithms = [{ id: "pending", title: "<Pending algorithm>" }];
  assert.equal(validateAlgorithms(doc), doc);
  assert.throws(
    () =>
      validateAlgorithms({
        ...doc,
        pendingAlgorithms: [{ id: "root", title: "Duplicate" }],
      }),
    /pending/,
  );
  assert.throws(
    () =>
      validateAlgorithms({
        ...doc,
        pendingAlgorithms: [doc.pendingAlgorithms[0], doc.pendingAlgorithms[0]],
      }),
    /pending/,
  );
  const html = algorithmTabs(doc, ["root"]);
  assert.ok(
    html.indexOf('data-algo-select="root"') < html.indexOf("Not extracted"),
  );
  assert.match(html, /algorithm-tab-pending" disabled/);
  assert.doesNotMatch(html, /data-algo-select="child"/);
  assert.match(html, /&lt;Pending algorithm&gt;/);
  assert.doesNotMatch(html, /data-algo-select="pending"/);
  let click;
  const el = {
    innerHTML: "",
    addEventListener: (_, fn) => {
      click = fn;
    },
    removeEventListener() {},
    querySelector: () => ({ focus() {} }),
  };
  const app = createAlgorithmsApplication({
    el,
    tabsEl: el,
    katex,
    fetch: async () => ({ ok: true, json: async () => doc }),
  });
  await app.start();
  const press = (id) =>
    click({
      target: {
        closest: () => ({
          dataset: { algoSelect: id },
          hasAttribute: () => false,
        }),
      },
    });
  press("child");
  assert.doesNotMatch(el.innerHTML, /data-algo-level="0"/);
  assert.match(
    algorithmTabs(doc, ["root", "child"]),
    /data-algo-select="root" aria-current="page"/,
  );
  const selected = el.innerHTML;
  press("pending");
  assert.equal(el.innerHTML, selected);
  press("root");
  assert.doesNotMatch(el.innerHTML, /data-algo-level="0"/);
  app.destroy();
});

test("Graph derives deduplicated nested calls and lays out shared modules below all callers", () => {
  const doc = fixture();
  const extra = {
    ...structuredClone(doc.algorithms[1]),
    id: "extra",
    number: 3,
  };
  const leaf = { ...structuredClone(extra), id: "leaf", number: 4 };
  doc.algorithms.push(extra, leaf);
  doc.algorithms[0].body.push({
    kind: "line",
    content: [{ call: "extra" }, { call: "child" }],
  });
  doc.algorithms[1].body = [{ kind: "line", content: [{ call: "leaf" }] }];
  extra.body = [
    { kind: "line", content: [{ call: "child" }, { call: "leaf" }] },
  ];
  validateAlgorithms(doc);
  const graph = algorithmGraph(doc),
    nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  assert.equal(graph.edges.length, 5);
  assert.deepEqual(nodes.get("leaf").path, ["root", "child", "leaf"]);
  for (const edge of graph.edges)
    assert.ok(nodes.get(edge.to).y > nodes.get(edge.from).y);
  assert.equal(new Set(graph.nodes.map((n) => n.x + "," + n.y)).size, 4);
});
test("Graph stays beside the document while node selection recovers the root navigation path", async () => {
  let click;
  const el = {
    innerHTML: "",
    addEventListener: (_, fn) => {
      click = fn;
    },
    removeEventListener() {},
    querySelector: () => ({ focus() {} }),
  };
  const app = createAlgorithmsApplication({
    el,
    katex,
    fetch: async () => ({ ok: true, json: async () => fixture() }),
  });
  await app.start();
  const press = (dataset) =>
    click({
      target: {
        closest: () => ({
          dataset,
          hasAttribute: (name) =>
            name === "data-algo-graph" && dataset.algoGraph !== undefined,
        }),
      },
    });
  assert.match(el.innerHTML, /data-algo-node=/);
  assert.match(el.innerHTML, /data-algo-resize/);
  assert.doesNotMatch(
    el.innerHTML,
    /Select a module|Illustrative algorithm|Show module graph/,
  );
  press({ algoNode: "child" });
  assert.match(el.innerHTML, /data-algo-node="child" aria-pressed="true"/);
  assert.match(el.innerHTML, /data-algo-level="0"/);
  assert.match(el.innerHTML, /data-algo-node=/);
  app.destroy();
});

test("Shared modules expose caller names in notes and retain the selected main algorithm's path", async () => {
  const doc = fixture();
  doc.algorithms.push({
    ...structuredClone(doc.algorithms[0]),
    id: "second",
    title: "Second",
    number: 3,
  });
  const graph = algorithmGraph(validateAlgorithms(doc));
  assert.equal(
    sharedModuleNote(graph, "child"),
    "Shared module. Called by: root, Second.",
  );
  assert.equal(sharedModuleNote(graph, "root"), "");
  const html = algorithmsScreen(doc, ["root"], createMathRenderer(katex));
  assert.equal((html.match(/data-algo-note="Shared module/g) ?? []).length, 2);
  let click;
  const el = {
    innerHTML: "",
    addEventListener: (_, fn) => {
      click = fn;
    },
    removeEventListener() {},
    querySelector: () => ({ focus() {} }),
  };
  const app = createAlgorithmsApplication({
    el,
    katex,
    fetch: async () => ({ ok: true, json: async () => doc }),
  });
  await app.start();
  const press = (dataset) =>
    click({
      target: { closest: () => ({ dataset, hasAttribute: () => false }) },
    });
  press({ algoSelect: "second" });
  press({ algoNode: "child" });
  assert.match(el.innerHTML, /data-algo-level="0">Second/);
  app.destroy();
});
test("Disposed applications ignore pending responses; missing documents have explicit Retry", async () => {
  let finish;
  const el = { innerHTML: "", addEventListener() {}, removeEventListener() {} };
  const app = createAlgorithmsApplication({
    el,
    katex,
    fetch: () =>
      new Promise((r) => {
        finish = r;
      }),
  });
  const start = app.start();
  app.destroy();
  el.innerHTML = "destination";
  finish({ ok: true, json: async () => fixture() });
  await start;
  assert.equal(el.innerHTML, "destination");
  const missing = createAlgorithmsApplication({
    el,
    katex,
    fetch: async () => ({ ok: false, status: 404 }),
  });
  await missing.start();
  assert.match(el.innerHTML, /data\/algorithms.json/);
  assert.match(el.innerHTML, /data-algo-retry/);
  missing.destroy();
});
test("Algorithm HTTP endpoint and local math assets are independent of host run data", async () => {
  const host = await mkdtemp(path.join(tmpdir(), "magicalgo-contract-"));
  await writeFile(path.join(host, "catalog.json"), JSON.stringify(fixture()));
  const server = createServer({
    repoRoot: host,
    algorithmsPath: "catalog.json",
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    assert.equal((await fetch(base + "/api/algorithms")).status, 200);
    for (const asset of [
      "katex.min.js",
      "katex.min.css",
      "fonts/KaTeX_Main-Regular.woff2",
    ])
      assert.equal((await fetch(base + "/web/katex/" + asset)).status, 200);
    assert.equal((await fetch(base + "/web/katex/package.json")).status, 404);
    assert.equal((await fetch(base + "/catalog.json")).status, 404);
    await writeFile(path.join(host, "catalog.json"), '{"version":999}');
    assert.equal((await fetch(base + "/api/algorithms")).status, 500);
  } finally {
    await new Promise((r) => server.close(r));
    await rm(host, { recursive: true, force: true });
  }
});
