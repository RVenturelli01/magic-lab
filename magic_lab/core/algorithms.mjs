/** A modular, authored algorithm document. It never executes repository code. */
export function validateAlgorithms(catalog) {
  const fail = (message) => {
    throw Error("Invalid algorithm document: " + message);
  };
  const string = (v) => typeof v === "string" && v.trim().length > 0;
  if (
    !catalog ||
    catalog.version !== 2 ||
    !string(catalog.name) ||
    typeof catalog.hypothetical !== "boolean" ||
    !Array.isArray(catalog.algorithms)
  )
    fail("expected version 2, name, hypothetical flag and algorithms");
  const ids = new Set(),
    references = new Map();
  if (catalog.symbols !== undefined) {
    if (!Array.isArray(catalog.symbols)) fail("invalid symbols");
    const symbolIds = new Set(),
      expressions = new Set();
    for (const s of catalog.symbols) {
      if (
        !s ||
        !/^[a-z][a-z0-9-]*$/.test(s.id) ||
        !string(s.tex) ||
        !string(s.description) ||
        symbolIds.has(s.id) ||
        expressions.has(s.tex)
      )
        fail("invalid or duplicate symbol");
      symbolIds.add(s.id);
      expressions.add(s.tex);
    }
  }
  for (const a of catalog.algorithms) {
    if (!a || !string(a.id) || ids.has(a.id))
      fail("duplicate or missing module id");
    ids.add(a.id);
    references.set(a.id, []);
  }
  if (catalog.pendingAlgorithms !== undefined) {
    if (!Array.isArray(catalog.pendingAlgorithms))
      fail("invalid pending algorithms");
    const pendingIds = new Set();
    for (const entry of catalog.pendingAlgorithms) {
      if (
        !entry ||
        !string(entry.id) ||
        !string(entry.title) ||
        ids.has(entry.id) ||
        pendingIds.has(entry.id)
      )
        fail("invalid or duplicate pending algorithm");
      pendingIds.add(entry.id);
    }
  }
  function content(tokens, id) {
    if (!Array.isArray(tokens) || !tokens.length) fail("empty content");
    for (const token of tokens) {
      if (!token || Object.keys(token).length !== 1) fail("invalid token");
      const key = Object.keys(token)[0];
      if (
        !["text", "math", "keyword", "call"].includes(key) ||
        !string(token[key])
      )
        fail("invalid token");
      if (key === "call") {
        if (!ids.has(token.call)) fail("unknown module reference");
        references.get(id).push(token.call);
      }
    }
  }
  function body(nodes, id, depth = 0) {
    if (!Array.isArray(nodes) || !nodes.length || depth > 12)
      fail("invalid body or excessive nesting");
    for (const node of nodes) {
      if (!node) fail("invalid node");
      if (node.note !== undefined && !string(node.note))
        fail("invalid step note");
      if (node.kind === "line") content(node.content, id);
      else if (node.kind === "equation") {
        if (!string(node.math)) fail("empty equation");
      } else if (node.kind === "comment") {
        if (!string(node.text)) fail("empty comment");
      } else if (node.kind === "block") {
        content(node.header, id);
        body(node.body, id, depth + 1);
      } else fail("unknown node kind");
    }
  }
  const numbers = new Set();
  for (const a of catalog.algorithms) {
    if (
      !string(a.title) ||
      !Number.isInteger(a.number) ||
      a.number < 1 ||
      numbers.has(a.number)
    )
      fail("invalid module title or number");
    numbers.add(a.number);
    content(a.input, a.id);
    content(a.output, a.id);
    body(a.body, a.id);
    if (!Array.isArray(a.notes) || !a.notes.every(string))
      fail("invalid notes");
  }
  if (catalog.algorithms.length && !ids.has(catalog.root))
    fail("unknown root module");
  const visiting = new Set(),
    visited = new Set();
  function visit(id) {
    if (visiting.has(id)) fail("cyclic module references");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const child of references.get(id)) visit(child);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of ids) visit(id);
  return catalog;
}
