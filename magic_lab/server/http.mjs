import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadDataset } from "./load-dataset.mjs";
import { resolveDatasetPath } from "./dataset-path.mjs";
import { repositoryRoot } from "./dataset-path.mjs";
import { validateAlgorithms } from "../core/algorithms.mjs";
import { createLatexPreview, readPreviewRequest } from "./latex-preview.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};
export function createServer({
  repoRoot,
  datasetPath,
  algorithmsPath = process.env.MAGICLAB_ALGORITHMS,
  latexPreview = createLatexPreview(),
} = {}) {
  const datasetFile = resolveDatasetPath({ repoRoot, datasetPath });
  const algorithmsFile = path.resolve(
    repoRoot ?? repositoryRoot,
    algorithmsPath || "data/algorithms.json",
  );

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (req.method === "POST" && url.pathname === "/api/preview/latex") {
        const abort = new AbortController();
        res.on("close", () => {
          if (!res.writableEnded) abort.abort();
        });
        try {
          const input = await readPreviewRequest(req);
          const result = await latexPreview.compile(input, abort.signal);
          res.writeHead(200, {
            "Content-Type": mime[".json"],
            "Cache-Control": "no-store",
          });
          return res.end(JSON.stringify(result));
        } catch (error) {
          if (abort.signal.aborted) return;
          res.writeHead(error.status ?? 400, {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          });
          return res.end(error.message);
        }
      }
      if (req.method !== "GET") {
        res.writeHead(405);
        return res.end("Read-only server");
      }
      let name =
        url.pathname === "/"
          ? "web/index.html"
          : decodeURIComponent(url.pathname).slice(1);
      if (name === "api/preview/capabilities") {
        res.writeHead(200, {
          "Content-Type": mime[".json"],
          "Cache-Control": "no-store",
        });
        return res.end(JSON.stringify(await latexPreview.capabilities()));
      }
      if (name === "api/dataset") {
        const data = await loadDataset(datasetFile);
        res.writeHead(200, {
          "Content-Type": mime[".json"],
          "Cache-Control": "no-store",
        });
        return res.end(JSON.stringify(data));
      }
      if (name === "api/algorithms") {
        const catalog = validateAlgorithms(
          JSON.parse(await readFile(algorithmsFile, "utf8")),
        );
        res.writeHead(200, {
          "Content-Type": mime[".json"],
          "Cache-Control": "no-store",
        });
        return res.end(JSON.stringify(catalog));
      }
      if (name === "web/plotly.min.js") {
        const data = await readFile(
          path.join(root, "node_modules/plotly.js-dist-min/plotly.min.js"),
        );
        res.writeHead(200, {
          "Content-Type": mime[".mjs"],
          "X-Content-Type-Options": "nosniff",
        });
        return res.end(data);
      }
      const allowed = ["web/", "core/", "panels/", "reporting/"];
      if (
        /^web\/katex\/(?:katex\.min\.(?:js|css)|fonts\/KaTeX_[A-Za-z0-9_-]+\.(?:woff2?|ttf))$/.test(
          name,
        )
      ) {
        const extension = path.extname(name);
        const contentType = {
          ".js": mime[".mjs"],
          ".css": mime[".css"],
          ".woff": "font/woff",
          ".woff2": "font/woff2",
          ".ttf": "font/ttf",
        }[extension];
        const data = await readFile(
          path.join(
            root,
            "node_modules/katex/dist",
            name.slice("web/katex/".length),
          ),
        );
        res.writeHead(200, {
          "Content-Type": contentType,
          "X-Content-Type-Options": "nosniff",
        });
        return res.end(data);
      }
      if (
        !allowed.some((p) => name.startsWith(p)) ||
        name.split(/[\\/]/).some((p) => p === "..") ||
        !mime[path.extname(name)]
      ) {
        res.writeHead(404);
        return res.end("Not found");
      }
      const data = await readFile(path.join(root, name));
      res.writeHead(200, {
        "Content-Type": mime[path.extname(name)],
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(data);
    } catch (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain",
      });
      res.end(error.code === "ENOENT" ? "Not found" : error.message);
    }
  });
}
