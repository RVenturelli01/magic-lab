import {
  algorithmGraph,
  sharedModuleNote,
} from "../../core/algorithm-graph.mjs";
import { xml } from "../../core/text.mjs";

export function moduleGraph(catalog, selected, root = catalog.root) {
  const all = algorithmGraph({ ...catalog, root });
  const reachable = new Set([root]);
  for (let changed = true; changed;) {
    changed = false;
    for (const edge of all.edges)
      if (reachable.has(edge.from) && !reachable.has(edge.to)) {
        reachable.add(edge.to);
        changed = true;
      }
  }
  const graph = algorithmGraph({
      ...catalog,
      root,
      algorithms: catalog.algorithms.filter((entry) => reachable.has(entry.id)),
    }),
    nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  return (
    '<section class="algorithm-graph" aria-label="Module call graph"><div class="algorithm-graph-toolbar"><h3>Module graph</h3><div class="algorithm-graph-controls"><button data-graph-zoom="out" aria-label="Zoom out">−</button><output data-graph-scale aria-label="Graph zoom">100%</output><button data-graph-zoom="in" aria-label="Zoom in">+</button><button data-graph-fit>Fit</button></div></div><div class="algorithm-graph-viewport" data-graph-viewport tabindex="0" aria-label="Module graph. Drag to pan, scroll to zoom. Arrow keys pan, plus and minus zoom, Home fits the graph."><div class="algorithm-graph-canvas" data-graph-world data-width="' +
    graph.width +
    '" data-height="' +
    graph.height +
    '" style="width:' +
    graph.width +
    "px;height:" +
    graph.height +
    'px"><svg aria-hidden="true" viewBox="0 0 ' +
    graph.width +
    " " +
    graph.height +
    '"><defs><marker id="module-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>' +
    graph.edges
      .map((edge) => {
        const a = nodes.get(edge.from),
          b = nodes.get(edge.to),
          y1 = a.y + 36,
          y2 = b.y - 36;
        return (
          '<path class="module-edge' +
          (edge.from === selected || edge.to === selected
            ? " module-edge-active"
            : "") +
          '" d="M ' +
          a.x +
          " " +
          y1 +
          " C " +
          a.x +
          " " +
          (y1 + y2) / 2 +
          ", " +
          b.x +
          " " +
          (y1 + y2) / 2 +
          ", " +
          b.x +
          " " +
          y2 +
          '" marker-end="url(#module-arrow)"/>'
        );
      })
      .join("") +
    "</svg>" +
    graph.nodes
      .map((node) => {
        const shared = sharedModuleNote(all, node.id);
        return (
          '<div class="module-node" style="left:' +
          node.x +
          "px;top:" +
          (node.y - 36) +
          'px"><button class="module-node-open' +
          (node.id === selected ? " primary" : "") +
          '" data-algo-node="' +
          xml(node.id) +
          '" aria-pressed="' +
          (node.id === selected) +
          '"><strong>' +
          xml(node.title) +
          "</strong></button>" +
          (shared
            ? '<button class="algorithm-shared-help graph-shared-help" data-algo-note="' +
              xml(shared) +
              '" aria-label="Shared module: ' +
              xml(node.title) +
              '">?</button>'
            : "") +
          "</div>"
        );
      })
      .join("") +
    '</div></div><ul class="algorithm-graph-links">' +
    graph.edges
      .map(
        (edge) =>
          "<li>" +
          xml(nodes.get(edge.from).title) +
          " calls " +
          xml(nodes.get(edge.to).title) +
          "</li>",
      )
      .join("") +
    "</ul></section>"
  );
}
