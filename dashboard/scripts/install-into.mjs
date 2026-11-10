import { constants } from "node:fs";
import { copyFile, lstat, mkdir, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Keep this allowlist aligned with runtime imports and the adoption guide.
// Local profiles, credentials, dependencies, builds and captures are not source.
const sourceEntries = [
  "app",
  "components",
  "db",
  "docs",
  "drizzle",
  "examples",
  "lib",
  "public",
  "scripts",
  "tests",
  "worker",
  ".gitignore",
  ".npmrc",
  ".openai/hosting.json",
  "AGENTS.md",
  "README.md",
  "LICENSE",
  "cloudflare-env.d.ts",
  "drizzle.config.ts",
  "eslint.config.mjs",
  "next.config.ts",
  "package.json",
  "package-lock.json",
  "postcss.config.mjs",
  "tsconfig.json",
  "vite.config.ts",
];
const localNames = new Set([
  "node_modules",
  "outputs",
  "work",
  "tmp",
  "coverage",
  "dist",
  "out",
]);

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

export async function installInto(
  source,
  destination,
  { dryRun = false } = {},
) {
  const sourceRoot = await realpath(source);
  const requested = path.resolve(destination);
  // Require an existing parent (the research repo), resolve junctions, and never
  // overwrite even an empty directory or a dangling destination symlink.
  const target = path.join(
    await realpath(path.dirname(requested)),
    path.basename(requested),
  );
  if (isWithin(sourceRoot, target))
    throw new Error("Choose a destination outside the source dashboard.");
  try {
    await lstat(target);
    throw new Error(
      `Destination already exists: ${target}. Choose a new directory; updates must be reviewed manually.`,
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const files = [];
  async function collect(relative, explicit = false) {
    const name = path.basename(relative);
    if (
      !explicit &&
      (name.startsWith(".") ||
        localNames.has(name) ||
        /\.(pem|key|log|tsbuildinfo)$/i.test(name))
    )
      return;
    const entry = await lstat(path.join(sourceRoot, relative));
    if (entry.isSymbolicLink())
      throw new Error(`Source symlinks are not portable: ${relative}`);
    if (entry.isDirectory()) {
      for (const child of (
        await readdir(path.join(sourceRoot, relative))
      ).sort()) {
        await collect(path.join(relative, child));
      }
    } else if (entry.isFile()) {
      files.push(relative);
    } else {
      throw new Error(`Unsupported source entry: ${relative}`);
    }
  }
  for (const entry of sourceEntries) {
    // Explicit nested files still need their parent checked (e.g. .openai).
    const parent = path.dirname(entry);
    if (
      parent !== "." &&
      (await lstat(path.join(sourceRoot, parent))).isSymbolicLink()
    ) {
      throw new Error(`Source symlinks are not portable: ${parent}`);
    }
    await collect(entry, true);
  }

  if (!dryRun) {
    await mkdir(target);
    for (const relative of files) {
      const output = path.join(target, relative);
      await mkdir(path.dirname(output), { recursive: true });
      await copyFile(
        path.join(sourceRoot, relative),
        output,
        constants.COPYFILE_EXCL,
      );
    }
  }
  return { target, files };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const destinations = args.filter((arg) => arg !== "--dry-run");
  if (destinations.length !== 1 || destinations[0].startsWith("--")) {
    throw new Error(
      "Usage: node scripts/install-into.mjs <new-directory-in-your-repo> [--dry-run]",
    );
  }
  const result = await installInto(
    fileURLToPath(new URL("../", import.meta.url)),
    destinations[0],
    { dryRun },
  );
  process.stdout.write(
    `${dryRun ? "Would copy" : "Copied"} ${result.files.length} source files to ${result.target}\n`,
  );
  if (dryRun) process.stdout.write(result.files.join("\n") + "\n");
  else
    process.stdout.write(
      `Next: open that directory, run npm ci, then npm run dev. See docs/ADOPTION.md.\n`,
    );
}
