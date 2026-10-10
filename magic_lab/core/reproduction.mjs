import { validateDataset } from "./dataset.mjs";
import { normalizeView } from "./view.mjs";
export async function datasetHash(dataset) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(dataset)),
      ),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function makeReproduction(dataset, view) {
  const d = structuredClone(dataset),
    v = normalizeView(structuredClone(view), d);
  return {
    schemaVersion: 1,
    appVersion: "0.1.0",
    createdAt: new Date().toISOString(),
    datasetSha256: await datasetHash(d),
    view: v,
    statistics: {
      center: "arithmetic mean",
      dispersion: "sample SD, ddof=1; undefined for n=1",
      smoothing: "trailing observation mean per run, then aggregate",
      alignment: v.alignment,
      interpolation: "none",
      incomplete: v.incomplete,
    },
    dataset: d,
  };
}
export async function restoreReproduction(input) {
  if (input?.schemaVersion !== 1 || typeof input.datasetSha256 !== "string")
    throw Error("Invalid reproduction envelope");
  const dataset = validateDataset(input.dataset);
  if ((await datasetHash(dataset)) !== input.datasetSha256)
    throw Error("Dataset checksum mismatch");
  return { dataset, view: normalizeView(input.view, dataset) };
}
