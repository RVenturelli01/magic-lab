/** Annotate declared TeX symbols without replacing command names or text arguments. */
export function annotateSymbols(tex, symbols) {
  const definitions = [...symbols].sort((a, b) => b.tex.length - a.tex.length);
  const literalCommands = new Set([
    "text",
    "textrm",
    "textbf",
    "mathrm",
    "operatorname",
    "begin",
    "end",
  ]);
  let result = "",
    i = 0;
  while (i < tex.length) {
    const definition = definitions.find(
      (s) =>
        tex.startsWith(s.tex, i) &&
        (!/[A-Za-z]/.test(s.tex[0]) || !/[A-Za-z]/.test(tex[i - 1] ?? "")) &&
        (!/[A-Za-z]/.test(s.tex.at(-1)) ||
          !/[A-Za-z]/.test(tex[i + s.tex.length] ?? "")),
    );
    if (definition) {
      result +=
        "{\\htmlData{algo-symbol=" +
        definition.id +
        "}{" +
        definition.tex +
        "}}";
      i += definition.tex.length;
      continue;
    }
    if (tex[i] === "\\") {
      const command = /^\\([A-Za-z]+|.)/.exec(tex.slice(i));
      if (command) {
        result += command[0];
        i += command[0].length;
        if (literalCommands.has(command[1])) {
          while (tex[i] === " ") result += tex[i++];
          if (tex[i] === "{") {
            let depth = 0;
            do {
              const char = tex[i++];
              result += char;
              if (char === "{") depth++;
              if (char === "}") depth--;
            } while (i < tex.length && depth > 0);
          }
        }
        continue;
      }
    }
    result += tex[i++];
  }
  return result;
}
