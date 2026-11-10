import { test } from "node:test";
import assert from "node:assert/strict";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { installInto } from "../../scripts/install-into.mjs";

const source = fileURLToPath(new URL("../../", import.meta.url));

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "magiclab-install-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("portable copy includes runtime, guides, tests and license without local state", async (t) => {
  const root = await fixture(t);
  const destination = path.join(root, "research dashboard");
  const preview = await installInto(source, destination, { dryRun: true });
  await assert.rejects(access(destination), { code: "ENOENT" });
  const installed = await installInto(source, destination);
  assert.deepEqual(installed.files, preview.files);
  for (const name of [
    "AGENTS.md",
    "LICENSE",
    "package-lock.json",
    ".gitignore",
    ".openai/hosting.json",
    "lib/data/index.ts",
    "scripts/visual-check.mjs",
    "docs/ADOPTION.md",
  ]) {
    assert.equal(
      await readFile(path.join(destination, name), "utf8"),
      await readFile(path.join(source, name), "utf8"),
    );
  }
  for (const name of [
    "node_modules",
    "outputs",
    ".sites-runtime",
    ".wrangler",
    ".env",
    "dist",
    ".git",
    "next-env.d.ts",
  ]) {
    await assert.rejects(access(path.join(destination, name)), {
      code: "ENOENT",
    });
  }
  // A transferred dashboard can itself be installed elsewhere, without its parent.
  const second = await installInto(destination, path.join(root, "second copy"));
  assert.deepEqual(second.files, installed.files);
});

test("installation refuses an existing destination and preserves host files", async (t) => {
  const root = await fixture(t);
  const destination = path.join(root, "dashboard");
  await mkdir(destination);
  await assert.rejects(installInto(source, destination), /already exists/);
  await writeFile(
    path.join(destination, "AGENTS.md"),
    "Researcher instructions",
  );
  await assert.rejects(
    installInto(source, destination, { dryRun: true }),
    /already exists/,
  );
  assert.equal(
    await readFile(path.join(destination, "AGENTS.md"), "utf8"),
    "Researcher instructions",
  );
  await assert.rejects(
    installInto(source, path.join(source, "nested-copy")),
    /outside the source/,
  );
});

test("copies omit local files inside source trees and reject source junctions", async (t) => {
  const root = await fixture(t);
  const copied = path.join(root, "source");
  await installInto(source, copied);
  await writeFile(path.join(copied, "scripts", ".env.local"), "private");
  await writeFile(path.join(copied, "scripts", "private.pem"), "private");
  const preview = await installInto(copied, path.join(root, "clean"), {
    dryRun: true,
  });
  assert.ok(
    !preview.files.some((name) => /private\.pem|\.env\.local/.test(name)),
  );
  await symlink(
    path.join(copied, "lib"),
    path.join(copied, "app", "linked-data"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(
    installInto(copied, path.join(root, "blocked")),
    /symlinks are not portable/,
  );
  await assert.rejects(access(path.join(root, "blocked")), { code: "ENOENT" });
});
