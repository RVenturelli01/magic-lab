import type {
  ConfigFilter,
  DashboardDataAdapter,
  JsonObject,
  JsonValue,
  MetricPoint,
  Project,
  Run,
  RunPage,
  RunQuery,
  RunStatus,
} from "./types";
import { configValue as lookup } from "./config.ts";
import { createSampleTuningData } from "./sample-tuning.ts";

export class DataAdapterError extends Error {
  readonly code:
    | "invalid_query"
    | "invalid_metric"
    | "not_found"
    | "unavailable";

  constructor(code: DataAdapterError["code"], message: string) {
    super(message);
    this.name = "DataAdapterError";
    this.code = code;
  }
}

const metrics: Project["metrics"] = [
  {
    key: "eval/mean_reward",
    label: "eval/mean_reward",
    preferredDirection: "maximize",
  },
  {
    key: "eval/mean_ep_length",
    label: "eval/mean_ep_length",
    preferredDirection: "maximize",
  },
  { key: "train/loss", label: "train/loss", preferredDirection: "minimize" },
  { key: "val/loss", label: "val/loss", preferredDirection: "minimize" },
  { key: "accuracy", label: "accuracy", preferredDirection: "maximize" },
  { key: "learning_rate", label: "learning_rate" },
];

const project: Project = {
  id: "local-demo",
  name: "Example experiments",
  entity: "local-research",
  description: "Local experiment workspace · deterministic sample data",
  isSample: true,
  metrics,
};

const sampleTuning = createSampleTuningData();

const palette = [
  "#f43f54",
  "#5087e8",
  "#409a61",
  "#b27150",
  "#8257d8",
  "#74cbbb",
  "#d4a72c",
  "#ed77ad",
  "#757f98",
  "#658f3d",
  "#bf6949",
  "#7f98d8",
];
const groupNames = [
  "ppo-baseline",
  "ppo-low-lr",
  "ppo-wide",
  "ppo-long-rollout",
  "sac-baseline",
  "sac-low-lr",
  "sac-wide",
  "sac-auto-entropy",
  "a2c-baseline",
  "a2c-low-lr",
  "a2c-wide",
  "a2c-long-rollout",
];
const referenceTime = Date.UTC(2026, 10, 7, 14, 0, 0);
const round = (value: number, precision = 5) =>
  Number(value.toFixed(precision));

function makeHistory(
  index: number,
  createdAt: number,
  duration: number,
): MetricPoint[] {
  const groupIndex = Math.floor(index / 5);
  const samples = index === 8 ? 24 : index < 3 ? 61 + index * 5 : 101;
  const learningRate = [0.001, 0.0003, 0.0001][groupIndex % 3];
  return Array.from({ length: samples }, (_, sample) => {
    const step = sample * 10_000;
    const progress = sample / 100;
    const noise =
      Math.sin(sample * 1.73 + index * 0.79) * 0.035 +
      Math.cos(sample * 0.47 + index) * 0.019;
    const residual = 0.11 + (index % 6) * 0.025;
    const trainLoss = Math.max(
      0.03,
      1.72 * Math.exp(-progress * (4.2 + (index % 4) * 0.3)) +
        residual +
        noise * (1 - progress * 0.5),
    );
    const valLoss =
      trainLoss +
      0.07 +
      Math.sin(sample * 0.28 + index) * 0.025 +
      (index % 5) * progress * 0.007;
    return {
      step,
      timestamp: new Date(
        createdAt + (sample / (samples - 1)) * duration * 1000,
      ).toISOString(),
      values: {
        "eval/mean_reward": round(
          Math.max(
            0,
            (6800 - groupIndex * 170) *
              (1 - Math.exp(-progress * (4.6 - groupIndex * 0.11))) +
              noise * 2000 +
              Math.sin(sample * 0.12 + index) * 120,
          ),
          2,
        ),
        "eval/mean_ep_length": round(
          Math.min(
            1000,
            Math.max(
              0,
              175 +
                (825 - groupIndex * 13) * (1 - Math.exp(-progress * 5)) +
                noise * 200,
            ),
          ),
          2,
        ),
        "train/loss": round(trainLoss),
        "val/loss": round(valLoss),
        accuracy: round(
          Math.min(
            0.995,
            0.38 +
              0.57 * (1 - Math.exp(-progress * 4.7)) -
              (index % 6) * 0.008 -
              noise * 0.11,
          ),
        ),
        learning_rate: round(
          learningRate *
            (0.15 + (0.85 * (1 + Math.cos(Math.PI * progress))) / 2),
          8,
        ),
      },
    };
  });
}

const histories = new Map<string, MetricPoint[]>();
const runs: Run[] = Array.from({ length: 60 }, (_, index) => {
  const groupIndex = Math.floor(index / 5);
  const id = `sample-${String(index + 1).padStart(3, "0")}`;
  const created = referenceTime - index * 3_600_000 * 2.7;
  const durationSeconds = 720 + ((index * 317) % 2800);
  const history = makeHistory(index, created, durationSeconds);
  histories.set(id, history);
  const status: RunStatus =
    index < 3 ? "running" : index === 8 ? "failed" : "finished";
  return {
    id,
    name: `${groupNames[groupIndex]}-seed-${index % 5}`,
    color: palette[groupIndex],
    status,
    createdAt: new Date(created).toISOString(),
    updatedAt: new Date(created + durationSeconds * 1000).toISOString(),
    durationSeconds,
    tags: [
      "sample",
      groupIndex % 4 === 0 ? "baseline" : "sweep",
      ["ppo", "sac", "a2c"][Math.floor(groupIndex / 4)],
    ],
    config: {
      group: groupNames[groupIndex],
      algorithm: ["PPO", "SAC", "A2C"][Math.floor(groupIndex / 4)],
      ...(groupIndex % 4 >= 2
        ? {
            algorithm_version: [
              "demo-normalized",
              "demo-auto-temperature",
              "demo-no-entropy",
            ][Math.floor(groupIndex / 4)],
          }
        : {}),
      learning_rate: [0.001, 0.0003, 0.0001][groupIndex % 3],
      batch_size: [32, 64, 128][groupIndex % 3],
      optimizer: groupIndex % 4 === 0 ? "sgd" : "adam",
      seed: index % 5,
      epochs: 80,
      dataset: "synthetic-demo",
      model: { name: "mlp", width: groupIndex % 4 === 2 ? 256 : 128 },
    },
    summary: {
      ...history[history.length - 1].values,
      _step: history[history.length - 1].step,
      _runtime: durationSeconds,
    },
  };
});

function matchesFilter(config: JsonObject, filter: ConfigFilter): boolean {
  const candidate = lookup(config, filter.key);
  if (candidate === undefined) return false;
  const expected = filter.value;
  switch (filter.operator) {
    case "eq":
      return candidate === expected;
    case "neq":
      return candidate !== expected;
    case "in":
      return (
        Array.isArray(expected) && expected.some((item) => item === candidate)
      );
    case "contains":
      return (
        typeof candidate === "string" &&
        typeof expected === "string" &&
        candidate.toLowerCase().includes(expected.toLowerCase())
      );
    case "gt":
      return (
        typeof candidate === "number" &&
        typeof expected === "number" &&
        candidate > expected
      );
    case "gte":
      return (
        typeof candidate === "number" &&
        typeof expected === "number" &&
        candidate >= expected
      );
    case "lt":
      return (
        typeof candidate === "number" &&
        typeof expected === "number" &&
        candidate < expected
      );
    case "lte":
      return (
        typeof candidate === "number" &&
        typeof expected === "number" &&
        candidate <= expected
      );
    default:
      throw new DataAdapterError(
        "invalid_query",
        "Unsupported configuration filter operator.",
      );
  }
}

function sortableValue(
  run: Run,
  key: NonNullable<RunQuery["sortBy"]>,
): JsonValue | undefined {
  if (key.startsWith("config:")) return lookup(run.config, key.slice(7));
  if (key.startsWith("summary:")) return lookup(run.summary, key.slice(8));
  return run[
    key as "name" | "status" | "createdAt" | "updatedAt" | "durationSeconds"
  ];
}

function validateQuery(query: RunQuery) {
  for (const name of ["offset", "limit"] as const) {
    const value = query[name];
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      throw new DataAdapterError(
        "invalid_query",
        `${name} must be a non-negative integer.`,
      );
    }
  }
  const statuses =
    query.status === undefined
      ? []
      : Array.isArray(query.status)
        ? query.status
        : [query.status];
  if (
    statuses.some(
      (status) => !["finished", "running", "failed"].includes(status),
    )
  ) {
    throw new DataAdapterError("invalid_query", "Unsupported run status.");
  }
  if (query.sortDirection && !["asc", "desc"].includes(query.sortDirection)) {
    throw new DataAdapterError("invalid_query", "Unsupported sort direction.");
  }
  if (
    query.sortBy &&
    !["name", "status", "createdAt", "updatedAt", "durationSeconds"].includes(
      query.sortBy,
    ) &&
    !/^(config|summary):.+/.test(query.sortBy)
  ) {
    throw new DataAdapterError("invalid_query", "Unsupported sort field.");
  }
  for (const filter of query.configFilters ?? []) {
    if (
      !filter.key ||
      !["eq", "neq", "in", "gt", "gte", "lt", "lte", "contains"].includes(
        filter.operator,
      )
    ) {
      throw new DataAdapterError(
        "invalid_query",
        "A configuration filter requires a key and a supported operator.",
      );
    }
    if ((filter.operator === "in") !== Array.isArray(filter.value)) {
      throw new DataAdapterError(
        "invalid_query",
        "Only the 'in' operator accepts an array, and it requires one.",
      );
    }
    if (
      ["gt", "gte", "lt", "lte"].includes(filter.operator) &&
      typeof filter.value !== "number"
    ) {
      throw new DataAdapterError(
        "invalid_query",
        "Numeric comparisons require a numeric value.",
      );
    }
  }
}

/** Fresh clones protect source data from accidental mutation by UI consumers. */
export function createSampleAdapter(): DashboardDataAdapter {
  return {
    async getTuningData() {
      return structuredClone(sampleTuning);
    },
    async getProject() {
      return structuredClone(project);
    },
    async listRuns(query: RunQuery = {}): Promise<RunPage> {
      validateQuery(query);
      const search = query.search?.trim().toLowerCase() ?? "";
      const statuses =
        query.status === undefined
          ? null
          : Array.isArray(query.status)
            ? query.status
            : [query.status];
      const filtered = runs.filter(
        (run) =>
          (!search ||
            [run.name, run.id, ...run.tags].some((value) =>
              value.toLowerCase().includes(search),
            )) &&
          (!statuses || statuses.includes(run.status)) &&
          (query.configFilters ?? []).every((filter) =>
            matchesFilter(run.config, filter),
          ),
      );
      const sortBy = query.sortBy ?? "createdAt";
      const direction = (query.sortDirection ?? "desc") === "asc" ? 1 : -1;
      filtered.sort((left, right) => {
        const a = sortableValue(left, sortBy);
        const b = sortableValue(right, sortBy);
        const aMissing = a === undefined || a === null || typeof a === "object";
        const bMissing = b === undefined || b === null || typeof b === "object";
        if (aMissing !== bMissing) return aMissing ? 1 : -1;
        if (aMissing || bMissing) return left.id.localeCompare(right.id);
        const compared =
          typeof a === "number" && typeof b === "number"
            ? a - b
            : String(a).localeCompare(String(b), "en", { numeric: true });
        return compared * direction || left.id.localeCompare(right.id);
      });
      const offset = query.offset ?? 0;
      const limit = query.limit ?? 100;
      return structuredClone({
        runs: filtered.slice(offset, offset + limit),
        total: filtered.length,
        offset,
        limit,
      });
    },
    async getRun(id: string) {
      return structuredClone(runs.find((run) => run.id === id) ?? null);
    },
    async getHistory(runId: string, keys?: string[]) {
      const history = histories.get(runId);
      if (!history)
        throw new DataAdapterError("not_found", `Run ${runId} was not found.`);
      if (keys?.some((key) => !metrics.some((metric) => metric.key === key))) {
        throw new DataAdapterError(
          "invalid_metric",
          "One or more requested metric keys are not available.",
        );
      }
      if (!keys) return structuredClone(history);
      if (!keys.length) return [];
      return history.map((point) => ({
        step: point.step,
        timestamp: point.timestamp,
        values: Object.fromEntries(
          keys
            .filter((key) => key in point.values)
            .map((key) => [key, point.values[key]]),
        ),
      }));
    },
  };
}
