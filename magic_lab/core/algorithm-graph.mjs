/** Derive actual module calls from document tokens, including nested blocks. */
export function algorithmGraph(catalog) {
  const edges = [],
    seen = new Set();
  function tokens(items, from) {
    for (const token of items)
      if (token.call) {
        const key = JSON.stringify([from, token.call]);
        if (!seen.has(key)) {
          seen.add(key);
          edges.push({ from, to: token.call });
        }
      }
  }
  function body(nodes, from) {
    for (const node of nodes) {
      if (node.content) tokens(node.content, from);
      if (node.header) tokens(node.header, from);
      if (node.body) body(node.body, from);
    }
  }
  for (const a of catalog.algorithms) {
    tokens(a.input, a.id);
    tokens(a.output, a.id);
    body(a.body, a.id);
  }
  const paths = new Map();
  if (catalog.algorithms.length) paths.set(catalog.root, [catalog.root]);
  const queue = catalog.algorithms.length ? [catalog.root] : [];
  for (let i = 0; i < queue.length; i++) {
    for (const edge of edges.filter((e) => e.from === queue[i])) {
      if (!paths.has(edge.to)) {
        paths.set(edge.to, [...paths.get(edge.from), edge.to]);
        queue.push(edge.to);
      }
    }
  }
  // Longest-path layers keep every DAG edge pointing down, including shared modules.
  const depths = new Map();
  const depth = (id) => {
    if (!depths.has(id)) {
      const parents = edges.filter((e) => e.to === id);
      depths.set(
        id,
        parents.length ? Math.max(...parents.map((e) => depth(e.from))) + 1 : 0,
      );
    }
    return depths.get(id);
  };
  const levels = new Map();
  for (const a of catalog.algorithms) {
    const d = depth(a.id);
    if (!levels.has(d)) levels.set(d, []);
    levels.get(d).push(a);
  }
  const columns = Math.max(
    1,
    ...[...levels.values()].map((level) => level.length),
  );
  const width = columns * 248 + 32,
    height = levels.size * 120 + 32;
  const nodes = [...levels].flatMap(([d, items]) =>
    items.map((a, i) => ({
      id: a.id,
      title: a.title,
      number: a.number,
      x: width / 2 + (i - (items.length - 1) / 2) * 248,
      y: 48 + d * 120,
      path: paths.get(a.id) ?? [a.id],
    })),
  );
  return { nodes, edges, width, height };
}

export function sharedModuleNote(graph, id) {
  const parents = graph.edges
    .filter((edge) => edge.to === id)
    .map((edge) => graph.nodes.find((node) => node.id === edge.from).title);
  return parents.length > 1
    ? "Shared module. Called by: " + parents.join(", ") + "."
    : "";
}
