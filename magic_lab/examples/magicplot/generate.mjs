import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { validateDataset } from "../../core/dataset.mjs";

const sourceHash = createHash("sha256")
  .update(readFileSync(fileURLToPath(import.meta.url)))
  .digest("hex");
export const grid = {
  algorithms: ["SAC", "PPO", "A2C"],
  learningRates: [0.0001, 0.0003, 0.001],
  gammas: [0.95, 0.99],
  seeds: [0, 1, 2],
};
const settings = {
  SAC: {
    field: "ent_coef",
    values: [0.05, 0.2],
    fixed: {
      batch_size: 256,
      buffer_size: 100000,
      learning_starts: 1000,
      tau: 0.005,
    },
  },
  PPO: {
    field: "clip_range",
    values: [0.1, 0.2],
    fixed: { n_steps: 1024, batch_size: 64, ent_coef: 0, gae_lambda: 0.95 },
  },
  A2C: {
    field: "ent_coef",
    values: [0, 0.01],
    fixed: { n_steps: 5, gae_lambda: 1 },
  },
};
const metric = (id, label, phase, unit, direction = "higher") => ({
  id,
  label,
  phase,
  unit,
  xUnit: "simulated environment steps",
  direction,
});
function randomFor(key) {
  let state = 2166136261;
  for (const c of key) state = Math.imul(state ^ c.charCodeAt(0), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function createDemo() {
  const d = {
    schemaVersion: 1,
    id: "synthetic-reacher-v5-sac-ppo-a2c-v1",
    description:
      "SYNTHETIC test data for Reacher-v5: SAC, PPO and A2C parameter sweeps. No environment, policy, training or evaluation was executed. Curve shapes and algorithm differences are illustrative, not benchmark evidence.",
    runs: [],
    metrics: [
      metric(
        "eval/return",
        "Synthetic evaluation episode return",
        "evaluation",
        "simulated reward / episode",
      ),
      metric(
        "train/return",
        "Synthetic training episode return",
        "training",
        "simulated reward / episode",
      ),
      metric(
        "eval/distance",
        "Synthetic mean fingertip–target distance",
        "evaluation",
        "simulated metres",
        "lower",
      ),
      metric(
        "train/approx_kl",
        "Synthetic approximate KL (PPO)",
        "training",
        "simulated nats",
        "neutral",
      ),
      metric(
        "train/entropy",
        "Synthetic policy entropy (PPO/A2C)",
        "training",
        "simulated nats",
        "neutral",
      ),
      metric(
        "train/clip_fraction",
        "Synthetic clip fraction (PPO)",
        "training",
        "fraction",
        "neutral",
      ),
    ],
    points: [],
    artifacts: [],
    campaigns: [],
  };
  for (const algorithm of grid.algorithms)
    for (const learning_rate of grid.learningRates)
      for (const gamma of grid.gammas)
        for (const factor of settings[algorithm].values) {
          const spec = settings[algorithm];
          const name =
            algorithm.toLowerCase() +
            "-lr" +
            learning_rate +
            "-g" +
            gamma +
            "-" +
            spec.field +
            factor;
          for (const seed of grid.seeds) {
            const id = name + "-s" + seed,
              rng = randomFor(id);
            const config = {
              learning_rate,
              gamma,
              [spec.field]: factor,
              ...spec.fixed,
              budget: 100000,
              log_every: 2500,
              data_source: "synthetic",
              generator_version: 1,
              environment_executed: false,
              reward_normalization: false,
              observation_normalization: false,
              wrappers: [],
              max_episode_steps: 50,
              evaluation_protocol:
                "synthetic observations; no evaluation episodes executed",
              checkpoint_selection: "none; no policy checkpoints",
              policy_architecture: [64, 64],
            };
            d.runs.push({
              id,
              name,
              algorithm,
              environment: "Reacher-v5",
              seed,
              status: "completed",
              config,
              code: { commit: "unknown-unversioned", dirty: true, sourceHash },
            });
            const speed =
              { SAC: 18000, PPO: 30000, A2C: 43000 }[algorithm] *
              (learning_rate === 0.0001
                ? 1.7
                : learning_rate === 0.001
                  ? 0.8
                  : 1);
            const penalty =
              (gamma === 0.95 ? 1.5 : 0) + (learning_rate === 0.001 ? 2 : 0);
            const factorEffect =
              algorithm === "SAC"
                ? factor === 0.2
                  ? 0.9
                  : 0
                : algorithm === "PPO"
                  ? factor === 0.1
                    ? 0.8
                    : 0
                  : factor === 0.01
                    ? -0.6
                    : 0;
            let noise = 0;
            for (
              let step = 0;
              step <= config.budget;
              step += config.log_every
            ) {
              const progress = 1 - Math.exp(-step / speed);
              noise =
                noise * 0.55 +
                (rng() - 0.5) * (learning_rate === 0.001 ? 4 : 2);
              const ret = Math.min(
                -0.1,
                -38 +
                  (32 - penalty - factorEffect) * progress +
                  noise +
                  (seed - 1) * 0.5,
              );
              const add = (metricId, value) =>
                d.points.push({ runId: id, metricId, step, value });
              add("eval/return", ret);
              add(
                "eval/distance",
                Math.max(0.003, 0.22 - 0.18 * progress + (rng() - 0.5) * 0.015),
              );
              // No initial training observation; algorithm-specific metrics are absent elsewhere.
              if (step === 0) continue;
              add("train/return", Math.min(-0.1, ret - 3 + (rng() - 0.5) * 3));
              if (algorithm !== "SAC")
                add(
                  "train/entropy",
                  Math.max(0.05, 1.4 - 0.8 * progress + (rng() - 0.5) * 0.1),
                );
              if (algorithm === "PPO") {
                add(
                  "train/approx_kl",
                  0.008 + learning_rate * 9 + (rng() - 0.5) * 0.006,
                );
                add(
                  "train/clip_fraction",
                  0.06 + factor * 0.45 + (rng() - 0.5) * 0.04,
                );
              }
            }
          }
        }
  return validateDataset(d);
}
export async function writeDemo(directory = new URL("./", import.meta.url)) {
  const d = createDemo();
  const root = new URL("./", directory);
  await mkdir(root, { recursive: true });
  const { runs, points, ...metadata } = d;
  const folders = runs.map((run) => "runs/" + run.id);
  for (const [index, run] of runs.entries()) {
    const folder = new URL(folders[index] + "/", root);
    await mkdir(folder, { recursive: true });
    await writeFile(
      new URL("config.json", folder),
      JSON.stringify(run, null, 2) + "\n",
    );
    const rows = new Map();
    for (const point of points.filter((p) => p.runId === run.id)) {
      if (!rows.has(point.step)) rows.set(point.step, new Map());
      rows.get(point.step).set(point.metricId, point.value);
    }
    const csv = ["step," + d.metrics.map((m) => m.id).join(",")];
    for (const [step, values] of rows)
      csv.push(
        [step, ...d.metrics.map((m) => values.get(m.id) ?? "")].join(","),
      );
    await writeFile(new URL("metrics.csv", folder), csv.join("\n") + "\n");
  }
  await writeFile(
    new URL("manifest.json", root),
    JSON.stringify(
      { ...metadata, stepColumn: "step", runs: folders },
      null,
      2,
    ) + "\n",
  );
  return d;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const d = await writeDemo();
  console.log(
    "Generated " +
      d.runs.length +
      " synthetic Reacher-v5 runs / " +
      d.points.length +
      " points. No training executed.",
  );
}
