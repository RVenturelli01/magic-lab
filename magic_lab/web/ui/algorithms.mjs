import { xml } from "../../core/text.mjs";
import { moduleGraph } from "./algorithm-graph.mjs";
import {
  algorithmGraph,
  sharedModuleNote,
} from "../../core/algorithm-graph.mjs";

export function algorithmTabs(catalog, path) {
  const graph = algorithmGraph(catalog);
  const roots = catalog.algorithms.filter(
    (entry) => !graph.edges.some((edge) => edge.to === entry.id),
  );
  return (
    roots
      .map(
        (entry) =>
          '<button data-algo-select="' +
          xml(entry.id) +
          '"' +
          (entry.id === path[0] ? ' aria-current="page" class="active"' : "") +
          ">" +
          xml(entry.title) +
          "</button>",
      )
      .join("") +
    (catalog.pendingAlgorithms ?? [])
      .map(
        (entry) =>
          '<button class="algorithm-tab-pending" disabled aria-label="' +
          xml(entry.title + " — Not extracted") +
          '">' +
          xml(entry.title) +
          "</button>",
      )
      .join("")
  );
}

/** HTML receives a math renderer explicitly; no browser globals or effects. */
export function algorithmsScreen(catalog, path, math, graphWidth = 34) {
  const selected = path.at(-1) ?? catalog.root;
  const algorithm = catalog.algorithms.find((a) => a.id === selected);
  const graph = algorithmGraph(catalog);
  const layout = (content) =>
    '<div class="algorithm-layout" style="--algorithm-graph-width:' +
    graphWidth +
    '%">' +
    content +
    (algorithm
      ? '<div class="algorithm-divider" data-algo-resize role="separator" tabindex="0" aria-label="Graph width" aria-orientation="vertical" aria-controls="algorithm-graph-panel" aria-valuemin="20" aria-valuemax="55" aria-valuenow="' +
        graphWidth +
        '"></div><aside id="algorithm-graph-panel">' +
        moduleGraph(catalog, selected, path[0]) +
        "</aside>"
      : "") +
    "</div>";
  if (!algorithm)
    return layout(
      '<div class="algorithm-reader"><p class="notice">No algorithms in this document.</p></div>',
    );
  const module = (id) => catalog.algorithms.find((a) => a.id === id);
  const tokens = (items) =>
    items
      .map((token) => {
        if (token.math) return math(token.math, false, catalog.symbols ?? []);
        if (token.keyword) return "<strong>" + xml(token.keyword) + "</strong>";
        if (token.call) {
          const target = module(token.call);
          const shared = sharedModuleNote(graph, target.id);
          return (
            '<button class="algorithm-call" data-algo-call="' +
            xml(target.id) +
            '" aria-label="Open module: ' +
            xml(target.title) +
            '">' +
            xml(target.title) +
            '<span class="algorithm-call-hint" aria-hidden="true"> ↗</span></button>' +
            (shared
              ? '<button class="algorithm-shared-help" data-algo-note="' +
                xml(shared) +
                '" aria-label="Shared module: ' +
                xml(target.title) +
                '">?</button>'
              : "")
          );
        }
        return xml(token.text);
      })
      .join("");
  let number = 0;
  function row(html, depth, kind = "line", note) {
    const guides =
      '<span class="algorithm-guides" aria-hidden="true">' +
      "<i></i>".repeat(depth) +
      "</span>";
    const label = kind === "comment" ? "" : ++number;
    return (
      '<div class="algorithm-row algorithm-' +
      kind +
      '"><span class="algorithm-number" aria-hidden="true">' +
      label +
      "</span>" +
      guides +
      '<div class="algorithm-content">' +
      html +
      "</div>" +
      (note
        ? '<button class="algorithm-step-help" data-algo-note="' +
          xml(note) +
          '" aria-label="Note for step ' +
          label +
          '">?</button>'
        : "") +
      "</div>"
    );
  }
  function body(nodes, depth = 0) {
    return nodes
      .map((node) => {
        if (node.kind === "comment")
          return row("// " + xml(node.text), depth, "comment");
        if (node.kind === "equation")
          return row(
            math("\\displaystyle " + node.math, false, catalog.symbols ?? []),
            depth,
            "equation",
            node.note,
          );
        if (node.kind === "block")
          return (
            row(tokens(node.header), depth, "line", node.note) +
            body(node.body, depth + 1) +
            row("<strong>end</strong>", depth)
          );
        return row(tokens(node.content), depth, "line", node.note);
      })
      .join("");
  }
  const hierarchy =
    path.length > 1
      ? '<div class="algorithm-toolbar"><nav aria-label="Algorithm hierarchy">' +
        path
          .map(
            (id, i) =>
              (i ? '<span aria-hidden="true"> / </span>' : "") +
              (i === path.length - 1
                ? '<span aria-current="page">' +
                  xml(module(id).title) +
                  "</span>"
                : '<button data-algo-level="' +
                  i +
                  '">' +
                  xml(module(id).title) +
                  "</button>"),
          )
          .join("") +
        "</nav></div>"
      : "";
  return (
    hierarchy +
    layout(
      '<div class="algorithm-reader"><article class="algorithm-paper" aria-labelledby="algorithm-title"><header class="algorithm-caption"><h2 id="algorithm-title" tabindex="-1">' +
        xml(algorithm.title) +
        '</h2></header><div class="algorithm-input"><strong>Input:</strong><div>' +
        tokens(algorithm.input) +
        '</div></div><div class="algorithm-body">' +
        body(algorithm.body) +
        '</div><div class="algorithm-output"><strong>Output:</strong><div>' +
        tokens(algorithm.output) +
        "</div></div></article>" +
        (algorithm.notes.length
          ? '<details class="algorithm-notes"><summary>Conventions & assumptions</summary><ul>' +
            algorithm.notes
              .map((note) => "<li>" + xml(note) + "</li>")
              .join("") +
            "</ul></details>"
          : "") +
        "</div>",
    )
  );
}
