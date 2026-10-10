import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsers } from "prettier/plugins/babel";

const root = fileURLToPath(new URL("../", import.meta.url));
const layers = {
  core: ["core"],
  reporting: ["core", "panels", "reporting"],
  panels: ["core", "panels"],
  web: ["core", "panels", "reporting", "web"],
  server: ["core", "reporting", "server", "adapters"],
  adapters: ["core", "adapters"],
  examples: ["core", "panels", "reporting", "examples", "adapters"],
};
const problems = [];
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(path.join(directory, entry.name))
          : path.join(directory, entry.name),
      ),
    )
  ).flat();
}
const sources = (
  await Promise.all(
    [
      "core",
      "panels",
      "reporting",
      "web",
      "server",
      "adapters",
      "scripts",
      "tests",
      "examples",
    ].map((name) => files(path.join(root, name))),
  )
)
  .flat()
  .filter((file) => file.endsWith(".mjs"));
sources.push(path.join(root, "server.mjs"));
const modules = new Map();
function exportedNames(ast) {
  const names = new Set();
  for (const node of ast.program.body) {
    if (node.type === "ExportDefaultDeclaration") names.add("default");
    if (node.type !== "ExportNamedDeclaration") continue;
    if (node.declaration?.id) names.add(node.declaration.id.name);
    for (const declaration of node.declaration?.declarations ?? [])
      names.add(declaration.id.name);
    for (const specifier of node.specifiers ?? [])
      names.add(specifier.exported.name);
  }
  return names;
}
for (const file of sources) {
  try {
    const ast = parsers.babel.parse(await readFile(file, "utf8"));
    modules.set(file, { ast, exports: exportedNames(ast) });
  } catch (error) {
    problems.push(path.relative(root, file) + ": " + error.message);
  }
}
for (const [file, { ast }] of modules) {
  const from = path.relative(root, file).split(path.sep)[0];
  for (const node of ast.program.body.filter(
    (node) => node.type === "ImportDeclaration",
  )) {
    const specifier = node.source.value;
    if (specifier.startsWith("node:")) {
      if (["core", "panels", "reporting", "web"].includes(from))
        problems.push(
          path.relative(root, file) + ": browser layer imports " + specifier,
        );
      continue;
    }
    if (!specifier.startsWith(".")) continue;
    const target = path.resolve(path.dirname(file), specifier),
      to = path.relative(root, target).split(path.sep)[0];
    if (!target.startsWith(root))
      problems.push(
        path.relative(root, file) + ": imports a host file " + specifier,
      );
    if (layers[from] && !layers[from].includes(to))
      problems.push(
        path.relative(root, file) + ": forbidden dependency on " + to,
      );
    const module = modules.get(target);
    if (!module) {
      try {
        await stat(target);
      } catch {
        problems.push(
          path.relative(root, file) + ": missing import " + specifier,
        );
      }
      continue;
    }
    for (const binding of node.specifiers) {
      const name =
        binding.type === "ImportDefaultSpecifier"
          ? "default"
          : binding.imported?.name;
      if (name && !module.exports.has(name))
        problems.push(
          path.relative(root, file) +
            ": " +
            specifier +
            " does not export " +
            name,
        );
    }
  }
}
if (problems.length) throw Error(problems.join("\n"));
console.log(
  "Code OK: " +
    modules.size +
    " modules; imports, exports and layer boundaries verified.",
);
