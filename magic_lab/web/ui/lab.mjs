import { option } from "./html.mjs";

export const labTools = [
  {
    id: "magicplot",
    name: "MagicPlot",
    description: "Track runs, compare results and build charts and tables.",
    ready: true,
  },
  {
    id: "magicalgo",
    name: "MagicAlgo",
    description:
      "Read repository algorithms as pseudocode and mathematical formulas.",
    ready: true,
    status: "Prototype",
  },
  {
    id: "magictuner",
    name: "MagicTuner",
    description: "Optimize parameters for a chosen metric with a coding agent.",
    ready: false,
  },
];

export function labScreen(route, theme) {
  const tool = labTools.find((item) => item.id === route);
  return (
    '<div class="shell"><header class="app-header"><a class="brand lab-home-link" href="#magiclab" aria-label="MagicLab home"><span class="brandmark" aria-hidden="true">◈</span>MagicLab</a>' +
    (tool ? '<span class="tool-name">' + tool.name + "</span>" : "") +
    (route === "magicalgo"
      ? '<nav class="nav algorithm-tabs" data-algo-tabs aria-label="Main algorithms"></nav>'
      : "") +
    '<label class="theme-control">Theme<select data-lab-theme aria-label="Theme">' +
    [
      ["dark", "Dark"],
      ["light", "Light"],
      ["blue", "Blue"],
      ["purple", "Purple"],
      ["green", "Green"],
      ["amber", "Amber"],
      ["system", "System"],
    ]
      .map(([value, label]) => option(value, label, theme))
      .join("") +
    '</select></label></header><main class="lab-main">' +
    (route === "magicalgo"
      ? ""
      : '<div class="heading"><h1 id="lab-title" tabindex="-1">' +
        (tool ? tool.name : "Research tools") +
        "</h1></div>") +
    (route === "magicalgo"
      ? '<section data-algo-root aria-label="MagicAlgo workspace"></section>'
      : tool
        ? '<section class="lab-empty" aria-label="' +
          tool.name +
          ' workspace"><p>This workspace is not implemented yet.</p><a class="lab-open" href="#magiclab">← Back to MagicLab</a></section>'
        : '<p class="muted">Choose a workspace to start working.</p><nav class="lab-tools" aria-label="Research tools">' +
          labTools
            .map(
              (item) =>
                '<a class="lab-tool" href="#' +
                item.id +
                '"><div class="lab-tool-heading"><h2>' +
                item.name +
                '</h2><span class="pill">' +
                (item.status ?? (item.ready ? "Available" : "Planned")) +
                "</span></div><p>" +
                item.description +
                '</p><span class="lab-open">Open workspace →</span></a>',
            )
            .join("") +
          "</nav>") +
    "</main></div>"
  );
}
