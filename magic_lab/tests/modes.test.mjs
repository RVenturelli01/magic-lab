import test from "node:test";
import assert from "node:assert/strict";
import { defaultView, normalizeView } from "../core/view.mjs";
import { valueKey } from "../core/filters.mjs";
import { buildExportPack } from "../reporting/export-pack.mjs";
import { restoreReproduction } from "../core/reproduction.mjs";
import { parseCSV } from "../adapters/csv.mjs";
const runs = [0, 1].flatMap((seed) =>
  [0.1, 0.2].map((epsilon) => ({
    id: epsilon + "-" + seed,
    name: "eps-" + epsilon,
    algorithm: "EG",
    environment: "Bandit",
    seed,
    status: "completed",
    config: { epsilon, initial_q: 0 },
    code: { commit: "abc", dirty: false },
  })),
);
const dataset = {
  schemaVersion: 1,
  id: "ablation",
  runs,
  metrics: [
    {
      id: "eval",
      label: "Return",
      phase: "evaluation",
      unit: "reward",
      xUnit: "pulls",
      direction: "higher",
    },
  ],
  points: runs.flatMap((run) =>
    [10, 20, ...(run.config.epsilon === 0.2 ? [30] : [])].map((step) => ({
      runId: run.id,
      metricId: "eval",
      step,
      value: (run.config.epsilon === 0.1 ? 10 : 30) + run.seed * 10,
    })),
  ),
  artifacts: [],
  campaigns: [],
};
const view = () =>
  normalizeView(
    {
      ...defaultView(dataset),
      workspaceMode: "ablation",
      ablationField: "/config/epsilon",
      ablationBaseline: valueKey(0.1),
    },
    dataset,
  );
test("Workspace mode and ablation settings normalize and survive reproduction exports", async () => {
  assert.equal(
    normalizeView(
      { ...view(), workspaceMode: "tables", tableKind: "curves" },
      dataset,
    ).workspaceMode,
    "tables",
  );
  const old = { ...view() };
  delete old.workspaceMode;
  delete old.tableKind;
  assert.equal(normalizeView(old, dataset).workspaceMode, "charts");
  assert.throws(() =>
    normalizeView({ ...view(), workspaceMode: "bad" }, dataset),
  );
  const pack = await buildExportPack(dataset, view(), { format: "csv" });
  const exported = parseCSV(
    pack.entries.find(([name]) => name.endsWith("ablation.csv"))[1],
  );
  assert.ok(
    exported.some((row) => row.row === "0.1") &&
      exported.some((row) => row.row === "0.2"),
  );
  const restored = await restoreReproduction(pack.reproduction);
  assert.equal(restored.view.workspaceMode, "ablation");
  assert.equal(restored.view.ablationBaseline, valueKey(0.1));
  const tex = await buildExportPack(dataset, view(), { format: "latex" });
  assert.ok(tex.entries.some(([name]) => name.endsWith("summary.tex")));
});

test("Tables all-step LaTeX export includes every displayed step", async () => {
  const pack = await buildExportPack(
    dataset,
    { ...view(), workspaceMode: "tables", tableKind: "curves" },
    { format: "latex" },
  );
  const tex = pack.entries.find(([name]) => name.endsWith("curves.tex"))[1];
  assert.ok(tex.includes("G1 & 10 & 15") && tex.includes("G2 & 30 & 35"));
});
