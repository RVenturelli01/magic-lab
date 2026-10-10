import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDataset } from "../core/dataset.mjs";
import { normalizeView } from "../core/view.mjs";
import { directExport } from "../reporting/direct-export.mjs";

const execute = promisify(execFile);
const moduleRoot = fileURLToPath(new URL("../", import.meta.url));

export function createLatexPreview({
  command = process.env.MAGICLAB_LATEX || "pdflatex",
  run = execute,
  temporaryRoot = tmpdir(),
} = {}) {
  let probe = null,
    busy = false;
  const cache = new Map();
  let cacheBytes = 0;
  const cacheLimit = 32 * 1024 * 1024;
  function remember(key, data) {
    while (
      cache.size &&
      (cacheBytes + data.length > cacheLimit || cache.size >= 64)
    ) {
      const oldest = cache.keys().next().value;
      cacheBytes -= cache.get(oldest).length;
      cache.delete(oldest);
    }
    cache.set(key, data);
    cacheBytes += data.length;
  }
  function pdfFile(source, data) {
    return {
      name: source.name.replace(/\.tex$/, ".pdf"),
      type: "application/pdf",
      data: data.toString("base64"),
    };
  }
  async function compiler() {
    if (!probe)
      probe = (async () => {
        const candidates = [command];
        if (
          process.platform === "win32" &&
          command === "pdflatex" &&
          !process.env.MAGICLAB_LATEX
        ) {
          for (const base of [
            process.env.LOCALAPPDATA &&
              path.join(process.env.LOCALAPPDATA, "Programs"),
            process.env.ProgramFiles,
            process.env["ProgramFiles(x86)"],
          ].filter(Boolean))
            candidates.push(
              path.join(base, "MiKTeX", "miktex", "bin", "x64", "pdflatex.exe"),
            );
        }
        for (const executable of candidates) {
          try {
            const { stdout } = await run(executable, ["--version"], {
              windowsHide: true,
              timeout: 5000,
              maxBuffer: 65536,
            });
            return {
              available: true,
              miktex: /miktex/i.test(stdout),
              executable,
            };
          } catch {
            /* Try the next standard compiler location. */
          }
        }
        return {
          available: false,
          reason:
            "LaTeX preview requires local pdflatex with standalone, pgfplots, lmodern, booktabs and xcolor. Install TeX Live or MiKTeX, or set MAGICLAB_LATEX to pdflatex's executable path, then restart the server.",
        };
      })();
    return probe;
  }
  return {
    async capabilities() {
      const { miktex, executable, ...status } = await compiler();
      return { latex: status };
    },
    async compile(input, signal) {
      const dataset = validateDataset(input?.dataset);
      const view = normalizeView(input?.view, dataset);
      if (view.tab !== "workspace" || !view.selected.length)
        throw Error("Select an analysis view and runs first");
      const mode = "separate";
      const sources = await directExport(dataset, view, {
        format: "latex",
        mode,
      });
      if (sources.length > 32) throw Error("Preview at most 32 charts");
      signal?.throwIfAborted();
      const keys = sources.map((source) =>
        createHash("sha256").update(source.data).digest("hex"),
      );
      if (keys.every((key) => cache.has(key)))
        return {
          files: sources.map((source, i) =>
            pdfFile(source, cache.get(keys[i])),
          ),
        };
      const available = await compiler();
      if (!available.available)
        throw Object.assign(Error(available.reason), { status: 503 });
      if (busy)
        throw Object.assign(
          Error("A LaTeX preview is already compiling. Try again shortly."),
          { status: 429 },
        );
      const tempRoot = path.resolve(temporaryRoot);
      const relative = path.relative(moduleRoot, tempRoot);
      if (
        !relative ||
        (!relative.startsWith(".." + path.sep) &&
          relative !== ".." &&
          !path.isAbsolute(relative))
      )
        throw Error(
          "LaTeX temporary files must stay outside the dashboard module",
        );
      signal?.throwIfAborted();
      busy = true;
      let directory;
      try {
        directory = await mkdtemp(path.join(tempRoot, "magicplot-latex-"));
        const files = [];
        for (const [index, source] of sources.entries()) {
          signal?.throwIfAborted();
          const key = keys[index];
          if (cache.has(key)) {
            files.push(pdfFile(source, cache.get(key)));
            continue;
          }
          await writeFile(path.join(directory, "figure.tex"), source.data);
          try {
            await run(
              available.executable,
              [
                "-no-shell-escape",
                "-interaction=nonstopmode",
                "-halt-on-error",
                "-file-line-error",
                ...(available.miktex ? ["--disable-installer"] : []),
                "figure.tex",
              ],
              {
                cwd: directory,
                windowsHide: true,
                timeout: 30000,
                maxBuffer: 1024 * 1024,
                signal,
                env: {
                  ...process.env,
                  openout_any: "p",
                  TEXMFOUTPUT: directory,
                },
              },
            );
          } catch (error) {
            if (signal?.aborted) throw error;
            const detail = String(error.stdout ?? "")
              .split(/\r?\n/)
              .filter((line) => /(?:Error|^!|figure\.tex:\d+)/.test(line))
              .slice(0, 3)
              .join(" ")
              .slice(0, 500);
            throw Error(
              "LaTeX compilation failed. Check installed packages and labels." +
                (detail ? " " + detail : ""),
            );
          }
          const data = await readFile(path.join(directory, "figure.pdf"));
          if (
            data.length > 16 * 1024 * 1024 ||
            data.subarray(0, 5).toString() !== "%PDF-"
          )
            throw Error("Invalid or oversized compiled PDF");
          remember(key, data);
          files.push(pdfFile(source, data));
        }
        return { files };
      } finally {
        try {
          if (directory) {
            const target = path.resolve(directory);
            if (
              path.dirname(target) !== tempRoot ||
              !path.basename(target).startsWith("magicplot-latex-")
            )
              throw Error("Invalid temporary cleanup target");
            await rm(target, { recursive: true, force: true });
          }
        } finally {
          busy = false;
        }
      }
    },
  };
}

export async function readPreviewRequest(req) {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    throw Object.assign(Error("Expected application/json"), { status: 415 });
  const origin = req.headers.origin;
  if (origin && origin !== "http://" + req.headers.host)
    throw Object.assign(Error("Cross-origin previews are not allowed"), {
      status: 403,
    });
  const limit = 8 * 1024 * 1024;
  if (Number(req.headers["content-length"]) > limit)
    throw Object.assign(Error("Preview request too large"), { status: 413 });
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit)
      throw Object.assign(Error("Preview request too large"), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(Error("Invalid preview JSON"), { status: 400 });
  }
}
