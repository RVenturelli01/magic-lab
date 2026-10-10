import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { zip } from "../core/archive.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const entries = [];
async function collect(relative) {
  const absolute = path.resolve(root, relative);
  const contained = path.relative(root, absolute);
  if (
    contained === ".." ||
    contained.startsWith(".." + path.sep) ||
    path.isAbsolute(contained)
  )
    throw Error("Package source escapes module: " + relative);
  if (relative.endsWith("/")) {
    for (const entry of await readdir(absolute, { withFileTypes: true })) {
      if (entry.isSymbolicLink())
        throw Error(
          "Package sources must not be symbolic links: " + entry.name,
        );
      await collect(relative + entry.name + (entry.isDirectory() ? "/" : ""));
    }
  } else {
    if (
      /(?:^|\/)(?:node_modules|\.npm-cache|data|logs|coverage)(?:\/|$)|\.(?:log|tgz|zip)$/.test(
        relative,
      )
    )
      throw Error("Unexpected generated file in package: " + relative);
    entries.push(["magic_lab/" + relative, await readFile(absolute)]);
  }
}
for (const relative of new Set([
  "package.json",
  "package-lock.json",
  "README.md",
  "LICENSE",
  ".gitignore",
  ...manifest.files,
]))
  await collect(relative);
entries.sort(([a], [b]) => a.localeCompare(b));
if (process.argv.includes("--check")) {
  console.log(
    "Package OK: " +
      entries.length +
      " source/documentation/test/reference files, including portable examples and the lockfile; no installed dependencies or real host data.",
  );
} else {
  const target = path.resolve(
    process.argv[2] || path.join(root, "../magic-lab-starter.zip"),
  );
  const relative = path.relative(root, target);
  if (
    !(relative === ".." || relative.startsWith(".." + path.sep)) &&
    !path.isAbsolute(relative)
  )
    throw Error("Write the archive outside the reusable module.");
  await writeFile(target, zip(entries));
  console.log("Starter archive: " + target + " (" + entries.length + " files)");
}
