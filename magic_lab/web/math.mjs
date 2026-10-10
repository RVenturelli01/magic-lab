import { annotateSymbols } from "../core/algorithm-symbols.mjs";
export function createMathRenderer(katex) {
  if (!katex?.renderToString)
    throw Error(
      "The local formula renderer could not be loaded. Reload MagicLab.",
    );
  return (tex, displayMode = false, symbols = []) => {
    const options = {
      displayMode,
      throwOnError: true,
      trust: false,
      output: "htmlAndMathml",
      maxExpand: 1000,
      maxSize: 10,
      strict: "error",
    };
    // Parse the unmodified input with all HTML extensions disabled first.
    const original = katex.renderToString(tex, options);
    if (!symbols.length) return original;
    const ids = new Set(symbols.map((s) => s.id));
    return katex.renderToString(annotateSymbols(tex, symbols), {
      ...options,
      strict: (code) => (code === "htmlExtension" ? "ignore" : "error"),
      trust: (context) =>
        context.command === "\\htmlData" &&
        Object.keys(context.attributes).length === 1 &&
        ids.has(context.attributes["data-algo-symbol"]),
    });
  };
}
