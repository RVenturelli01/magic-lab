import { canonical } from "./filters.mjs";
import { groupKey } from "./run-identity.mjs";
export const STATUSES = ["completed", "running", "failed", "queued"];
export function validateDataset(d) {
  const fail = (m) => {
    throw new Error("Invalid dataset: " + m);
  };
  const text = (v) => typeof v === "string" && v.length > 0;
  if (
    d?.schemaVersion !== 1 ||
    !text(d.id) ||
    !Array.isArray(d.runs) ||
    !Array.isArray(d.metrics) ||
    !d.metrics.length ||
    !Array.isArray(d.points) ||
    !Array.isArray(d.artifacts) ||
    !Array.isArray(d.campaigns)
  )
    fail("schemaVersion/id/collections");
  const ids = new Set(),
    metrics = new Map(),
    replicates = new Set();
  for (const m of d.metrics) {
    if (
      !text(m.id) ||
      metrics.has(m.id) ||
      !text(m.label) ||
      !["training", "evaluation"].includes(m.phase) ||
      !text(m.unit) ||
      !text(m.xUnit) ||
      !["higher", "lower", "neutral"].includes(m.direction)
    )
      fail("metric definition");
    metrics.set(m.id, m);
  }
  for (const r of d.runs) {
    if (
      !text(r.id) ||
      ids.has(r.id) ||
      !STATUSES.includes(r.status) ||
      !text(r.algorithm) ||
      !text(r.environment) ||
      !Number.isInteger(r.seed) ||
      !r.config ||
      Array.isArray(r.config) ||
      typeof r.config !== "object" ||
      !text(r.code?.commit) ||
      typeof r.code?.dirty !== "boolean"
    )
      fail("run " + r.id);
    if (r.name !== undefined && !text(r.name)) fail("run name " + r.id);
    ids.add(r.id);
    const key = groupKey(r) + "/" + r.seed;
    if (replicates.has(key))
      fail("duplicate seed in identical configuration: " + r.id);
    replicates.add(key);
  }
  const observations = new Set();
  for (const p of d.points) {
    const key = canonical([p.runId, p.metricId, p.step]);
    if (
      !ids.has(p.runId) ||
      !metrics.has(p.metricId) ||
      !Number.isFinite(p.step) ||
      p.step < 0 ||
      !Number.isFinite(p.value) ||
      observations.has(key)
    )
      fail("point reference/value/duplicate");
    observations.add(key);
  }
  const artifactIds = new Set();
  for (const a of d.artifacts) {
    if (
      !text(a.id) ||
      artifactIds.has(a.id) ||
      !ids.has(a.runId) ||
      !text(a.label) ||
      !text(a.path) ||
      !["checkpoint", "video", "image", "file"].includes(a.kind) ||
      /^[a-z][a-z0-9+.-]*:/i.test(a.path) ||
      a.path.startsWith("/") ||
      a.path.startsWith("\\") ||
      a.path.split(/[\\/]/).includes("..")
    )
      fail("artifact");
    artifactIds.add(a.id);
  }
  const campaigns = new Set();
  for (const c of d.campaigns) {
    if (
      !text(c.id) ||
      campaigns.has(c.id) ||
      !text(c.title) ||
      !text(c.hypothesis) ||
      ![
        "proposed",
        "approved",
        "in_progress",
        "completed",
        "cancelled",
      ].includes(c.status) ||
      !Array.isArray(c.variants) ||
      !c.variants.length ||
      !Array.isArray(c.seeds) ||
      !c.seeds.length ||
      c.seeds.some((s) => !Number.isInteger(s)) ||
      new Set(c.seeds).size !== c.seeds.length ||
      !Array.isArray(c.environments) ||
      !c.environments.length ||
      c.environments.some((e) => !text(e)) ||
      new Set(c.environments).size !== c.environments.length
    )
      fail("campaign");
    campaigns.add(c.id);
    const variants = new Set();
    for (const v of c.variants) {
      if (
        !text(v.name) ||
        variants.has(v.name) ||
        !text(v.algorithm) ||
        !v.parameters ||
        typeof v.parameters !== "object" ||
        Array.isArray(v.parameters) ||
        !text(v.ablation) ||
        !text(v.command) ||
        !v.command.includes("{seed}") ||
        !v.command.includes("{environment}")
      )
        fail("campaign variant");
      variants.add(v.name);
    }
  }
  return d;
}
