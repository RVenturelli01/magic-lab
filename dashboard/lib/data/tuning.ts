import { configValue } from "./config.ts";
import { configValues, optionLabel } from "./run-filters.ts";
import type {
  MetricDefinition,
  Run,
  TuningParameterSpace,
  TuningStudyDefinition,
} from "./types";

export interface TuningStudy {
  id: string;
  name: string;
  runs: Run[];
  parameters: string[];
  objectiveKey?: string;
  searchSpace?: Record<string, TuningParameterSpace>;
}

const contextKeys = new Set(["algorithm", "dataset", "group", "seed"]);

/** Study metadata may be supplied by an Optuna adapter in config.tuning. */
export function buildTuningStudies(
  runs: Run[],
  definitions: TuningStudyDefinition[] = [],
): TuningStudy[] {
  const groups = new Map<string, { name: string; runs: Run[] }>();
  for (const run of runs) {
    const tuning = run.config.tuning;
    const metadata =
      tuning && typeof tuning === "object" && !Array.isArray(tuning)
        ? tuning
        : {};
    const algorithm = run.config.algorithm;
    const id =
      typeof metadata.study_id === "string" && metadata.study_id
        ? metadata.study_id
        : typeof algorithm === "string" && algorithm
          ? algorithm
          : "all";
    const name =
      typeof metadata.study_name === "string" && metadata.study_name
        ? metadata.study_name
        : id === "all"
          ? "All configurations"
          : `${id} configurations`;
    if (!groups.has(id)) groups.set(id, { name, runs: [] });
    groups.get(id)!.runs.push(run);
  }
  return [...groups].map(([id, group]) => {
    const definition = definitions.find((item) => item.id === id);
    return {
      id,
      name: definition?.name ?? group.name,
      runs: group.runs,
      objectiveKey: definition?.objectiveKey,
      searchSpace: definition?.searchSpace,
      parameters: [
        ...new Set([
          ...Object.keys(definition?.searchSpace ?? {}),
          ...group.runs.flatMap((run) =>
            configValues(run.config)
              .map(([key]) => key)
              .filter(
                (key) => !contextKeys.has(key) && !key.startsWith("tuning."),
              ),
          ),
        ]),
      ].sort(),
    };
  });
}

export function formatParameterSpace(space: TuningParameterSpace): string {
  if (space.type === "categorical")
    return space.choices.map(String).join(" · ");
  return `${space.low}–${space.high}${space.log ? " · log" : ""}${space.step ? ` · step ${space.step}` : ""}`;
}

export function parameterValue(run: Run, key: string): string | undefined {
  const value = configValue(run.config, key);
  return value === undefined || (value !== null && typeof value === "object")
    ? undefined
    : optionLabel(JSON.stringify(value));
}

export function metricValue(run: Run, key: string): number | undefined {
  const value = run.summary[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export type TuningRunSortKey =
  | "trial"
  | "objective"
  | "status"
  | `parameter:${string}`;
export type TuningRunSortDirection = "asc" | "desc";

export function trialNumber(run: Run): number | undefined {
  const tuning = run.config.tuning;
  if (!tuning || typeof tuning !== "object" || Array.isArray(tuning)) return;
  return typeof tuning.trial_number === "number" &&
    Number.isFinite(tuning.trial_number)
    ? tuning.trial_number
    : undefined;
}

/** Sort the full filtered set before the view takes a page. Missing values stay last. */
export function sortTuningRuns(
  runs: Run[],
  key: TuningRunSortKey,
  direction: TuningRunSortDirection,
  objectiveKey?: string,
): Run[] {
  const sign = direction === "asc" ? 1 : -1;
  const compareText = (a: string, b: string) =>
    a.localeCompare(b, undefined, { numeric: true });
  const compareOptional = (
    a: string | number | undefined,
    b: string | number | undefined,
  ) => {
    if (a === undefined) return b === undefined ? 0 : 1;
    if (b === undefined) return -1;
    const aNumber = typeof a === "number" ? a : Number(a);
    const bNumber = typeof b === "number" ? b : Number(b);
    return (
      sign *
      (Number.isFinite(aNumber) && Number.isFinite(bNumber)
        ? aNumber - bNumber
        : compareText(String(a), String(b)))
    );
  };
  return runs.toSorted((a, b) => {
    const result =
      key === "trial"
        ? trialNumber(a) !== undefined || trialNumber(b) !== undefined
          ? compareOptional(trialNumber(a), trialNumber(b))
          : sign * compareText(a.name, b.name)
        : key === "objective"
          ? compareOptional(
              objectiveKey ? metricValue(a, objectiveKey) : undefined,
              objectiveKey ? metricValue(b, objectiveKey) : undefined,
            )
          : key === "status"
            ? sign * compareText(a.status, b.status)
            : compareOptional(
                parameterValue(a, key.slice("parameter:".length)),
                parameterValue(b, key.slice("parameter:".length)),
              );
    return result || compareText(a.name, b.name) || compareText(a.id, b.id);
  });
}

export function bestRun(
  runs: Run[],
  metric: MetricDefinition,
): Run | undefined {
  const direction = metric.preferredDirection === "minimize" ? 1 : -1;
  let best: Run | undefined;
  let bestValue = 0;
  for (const run of runs) {
    const value = metricValue(run, metric.key);
    if (run.status !== "finished" || value === undefined) continue;
    if (
      !best ||
      direction * (value - bestValue) < 0 ||
      (value === bestValue && run.id.localeCompare(best.id) < 0)
    ) {
      best = run;
      bestValue = value;
    }
  }
  return best;
}
