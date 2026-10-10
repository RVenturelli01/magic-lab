import { fileURLToPath } from "node:url";
import { createServer } from "./server/http.mjs";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  const examples = process.argv.includes("--examples");
  const server = createServer(
    examples
      ? {
          datasetPath:
            process.env.OBSERVATORY_DATASET ||
            fileURLToPath(new URL("./examples/magicplot/", import.meta.url)),
          algorithmsPath:
            process.env.MAGICLAB_ALGORITHMS ||
            fileURLToPath(
              new URL("./examples/magicalgo/algorithms.json", import.meta.url),
            ),
        }
      : {},
  );
  server.listen(port, "127.0.0.1", () =>
    console.log("MagicLab: http://127.0.0.1:" + server.address().port),
  );
}
