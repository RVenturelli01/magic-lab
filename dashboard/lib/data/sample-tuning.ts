import type {
  MetricPoint,
  JsonObject,
  Run,
  TuningData,
  TuningStudyDefinition,
} from "./types";

const ppoStudy: TuningStudyDefinition = {
  id: "optuna-ppo-example",
  name: "PPO · simulated Optuna study",
  objectiveKey: "val/loss",
  searchSpace: {
    learning_rate: { type: "float", low: 0.0001, high: 0.01, log: true },
    batch_size: { type: "categorical", choices: [32, 64, 128] },
    "model.width": { type: "categorical", choices: [64, 128, 256] },
    dropout: { type: "float", low: 0, high: 0.3, step: 0.1 },
    optimizer: { type: "categorical", choices: ["adam", "sgd"] },
  },
};

const sacStudy: TuningStudyDefinition = {
  id: "optuna-sac-example",
  name: "SAC · simulated Optuna study",
  objectiveKey: "eval/mean_reward",
  searchSpace: {
    learning_rate: { type: "float", low: 0.00001, high: 0.003, log: true },
    batch_size: { type: "categorical", choices: [64, 128, 256] },
    "model.width": { type: "categorical", choices: [128, 256, 512] },
    ent_coef: { type: "float", low: 0.05, high: 0.2, step: 0.05 },
    tau: { type: "float", low: 0.005, high: 0.02, step: 0.005 },
  },
};

const a2cStudy: TuningStudyDefinition = {
  id: "optuna-a2c-example",
  name: "A2C · simulated Optuna study",
  objectiveKey: "eval/mean_reward",
  searchSpace: {
    learning_rate: { type: "float", low: 0.0001, high: 0.003, log: true },
    n_steps: { type: "categorical", choices: [5, 10, 20] },
    gamma: { type: "categorical", choices: [0.95, 0.99, 0.995] },
    ent_coef: { type: "float", low: 0, high: 0.02, step: 0.01 },
    "model.width": { type: "categorical", choices: [64, 128, 256] },
  },
};

function halton(index: number, base: number): number {
  let value = 0;
  let fraction = 1 / base;
  while (index > 0) {
    value += fraction * (index % base);
    index = Math.floor(index / base);
    fraction /= base;
  }
  return value;
}

const round = (value: number, digits = 5) => Number(value.toFixed(digits));

/** A reproducible simulated study; no Optuna process or real training is claimed. */
export function createSampleTuningData(): TuningData {
  const runs: Run[] = [];
  const histories: Record<string, MetricPoint[]> = {};
  for (let trial = 0; trial < 32; trial++) {
    const index = trial + 1;
    const learningRate = round(10 ** (-4 + 2 * halton(index, 2)), 8);
    const batchSize = [32, 64, 128][Math.floor(3 * halton(index, 3))];
    const width = [64, 128, 256][Math.floor(3 * halton(index, 5))];
    const dropout = round(Math.floor(4 * halton(index, 7)) * 0.1, 1);
    const optimizer = halton(index, 11) < 0.5 ? "adam" : "sgd";
    const objective = round(
      0.115 +
        0.052 * Math.log10(learningRate / 0.002) ** 2 +
        (batchSize === 64 ? 0 : batchSize === 32 ? 0.018 : 0.012) +
        (width === 256 ? 0 : width === 128 ? 0.014 : 0.032) +
        0.12 * (dropout - 0.1) ** 2 +
        (optimizer === "adam" ? 0 : 0.027) +
        0.004 * Math.sin(index * 2.7),
    );
    const id = `optuna-example-${String(trial).padStart(3, "0")}`;
    const created = Date.UTC(2026, 10, 7, 9, 0) + trial * 2_400_000;
    const durationSeconds = 1_200 + (trial % 7) * 75;
    const history = Array.from({ length: 41 }, (_, stepIndex) => {
      const progress = stepIndex / 40;
      const decay = Math.exp(-4.5 * progress);
      const wobble = (1 - progress) * 0.012 * Math.sin(stepIndex * 0.8 + trial);
      const valLoss =
        stepIndex === 40
          ? objective
          : round(
              objective +
                1.1 * decay -
                1.1 * Math.exp(-4.5) * progress +
                wobble,
            );
      const trainLoss = round(Math.max(0.02, valLoss - 0.035 * progress));
      return {
        step: stepIndex * 1_000,
        timestamp: new Date(
          created + progress * durationSeconds * 1_000,
        ).toISOString(),
        values: {
          "train/loss": trainLoss,
          "val/loss": valLoss,
          accuracy: round(
            Math.min(0.99, 0.45 + progress * (0.51 - objective * 0.35)),
          ),
          "eval/mean_reward": round(6_800 * progress * (1 - objective), 2),
          "eval/mean_ep_length": round(
            200 + 780 * progress * (1 - objective),
            2,
          ),
          learning_rate: learningRate,
        },
      };
    });
    histories[id] = history;
    runs.push({
      id,
      name: `trial-${String(trial).padStart(3, "0")}`,
      color: ["#5087e8", "#409a61", "#b27150", "#8257d8"][trial % 4],
      status: "finished",
      createdAt: new Date(created).toISOString(),
      updatedAt: new Date(created + durationSeconds * 1_000).toISOString(),
      durationSeconds,
      tags: ["sample", "simulated-optuna", "ppo"],
      config: {
        algorithm: "PPO",
        learning_rate: learningRate,
        batch_size: batchSize,
        model: { width },
        dropout,
        optimizer,
        tuning: {
          study_id: ppoStudy.id,
          study_name: ppoStudy.name,
          trial_number: trial,
        },
      },
      summary: {
        ...history[history.length - 1].values,
        _step: 40_000,
        _runtime: durationSeconds,
      },
    });
  }
  for (const [studyIndex, study] of [sacStudy, a2cStudy].entries()) {
    const algorithm = studyIndex === 0 ? "SAC" : "A2C";
    for (let trial = 0; trial < 32; trial++) {
      const index = trial + 1;
      const learningRate = round(
        10 **
          ((studyIndex === 0 ? -5 : -4) +
            Math.log10(studyIndex === 0 ? 300 : 30) * halton(index, 2)),
        8,
      );
      const width = (studyIndex === 0 ? [128, 256, 512] : [64, 128, 256])[
        Math.floor(3 * halton(index, 5))
      ];
      const entCoef = round(
        (studyIndex === 0 ? 0.05 : 0) +
          Math.floor((studyIndex === 0 ? 4 : 3) * halton(index, 7)) *
            (studyIndex === 0 ? 0.05 : 0.01),
        3,
      );
      const config: JsonObject =
        studyIndex === 0
          ? {
              learning_rate: learningRate,
              batch_size: [64, 128, 256][Math.floor(3 * halton(index, 3))],
              model: { width },
              ent_coef: entCoef,
              tau: round(0.005 + Math.floor(4 * halton(index, 11)) * 0.005, 3),
            }
          : {
              learning_rate: learningRate,
              n_steps: [5, 10, 20][Math.floor(3 * halton(index, 3))],
              gamma: [0.95, 0.99, 0.995][Math.floor(3 * halton(index, 11))],
              ent_coef: entCoef,
              model: { width },
            };
      const quality =
        studyIndex === 0
          ? 0.09 +
            0.045 * Math.log10(learningRate / 0.0003) ** 2 +
            (config.batch_size === 256
              ? 0
              : config.batch_size === 128
                ? 0.015
                : 0.032) +
            (width === 512 ? 0 : width === 256 ? 0.012 : 0.03) +
            1.8 * (entCoef - 0.1) ** 2 +
            110 * (Number(config.tau) - 0.01) ** 2
          : 0.14 +
            0.05 * Math.log10(learningRate / 0.0007) ** 2 +
            (config.n_steps === 20
              ? 0
              : config.n_steps === 10
                ? 0.014
                : 0.035) +
            (config.gamma === 0.99
              ? 0
              : config.gamma === 0.995
                ? 0.012
                : 0.045) +
            (width === 256 ? 0 : width === 128 ? 0.014 : 0.035) +
            45 * (entCoef - 0.01) ** 2;
      const finalReward = round(
        (studyIndex === 0 ? 7_200 : 6_200) * (1 - quality) +
          18 * Math.sin(index * 2.7 + studyIndex),
        2,
      );
      const finalLoss = round(quality, 5);
      const id = `optuna-${algorithm.toLowerCase()}-${String(trial).padStart(3, "0")}`;
      const created = Date.UTC(2026, 10, 7, 9 + studyIndex) + trial * 2_400_000;
      const durationSeconds = 1_200 + (trial % 7) * 75;
      const history = Array.from({ length: 41 }, (_, stepIndex) => {
        const progress = stepIndex / 40;
        const reward =
          stepIndex === 40
            ? finalReward
            : round(
                (finalReward * (1 - Math.exp(-4.5 * progress))) /
                  (1 - Math.exp(-4.5)),
                2,
              );
        const valLoss =
          stepIndex === 40
            ? finalLoss
            : round(
                finalLoss +
                  1.1 * (Math.exp(-4.5 * progress) - Math.exp(-4.5) * progress),
              );
        return {
          step: stepIndex * 1_000,
          timestamp: new Date(
            created + progress * durationSeconds * 1_000,
          ).toISOString(),
          values: {
            "train/loss": round(Math.max(0.02, valLoss - 0.035 * progress)),
            "val/loss": valLoss,
            accuracy: round(
              Math.min(0.99, 0.45 + progress * (0.51 - quality * 0.35)),
            ),
            "eval/mean_reward": reward,
            "eval/mean_ep_length": round(
              200 + 780 * progress * (1 - quality),
              2,
            ),
            learning_rate: learningRate,
          },
        };
      });
      histories[id] = history;
      runs.push({
        id,
        name: `trial-${String(trial).padStart(3, "0")}`,
        color: studyIndex === 0 ? "#409a61" : "#b27150",
        status: "finished",
        createdAt: new Date(created).toISOString(),
        updatedAt: new Date(created + durationSeconds * 1_000).toISOString(),
        durationSeconds,
        tags: ["sample", "simulated-optuna", algorithm.toLowerCase()],
        config: {
          algorithm,
          ...config,
          tuning: {
            study_id: study.id,
            study_name: study.name,
            trial_number: trial,
          },
        },
        summary: {
          ...history[history.length - 1].values,
          _step: 40_000,
          _runtime: durationSeconds,
        },
      });
    }
  }
  return { studies: [ppoStudy, sacStudy, a2cStudy], runs, histories };
}
