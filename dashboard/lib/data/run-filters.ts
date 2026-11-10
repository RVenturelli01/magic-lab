import { configValue } from "./config.ts";
import type { JsonObject, Run } from "./types";

export const filterLabels: Record<string, string> = {
  group: "Group",
  algorithm: "Algorithm",
  learning_rate: "Learning rate",
  batch_size: "Batch size",
  optimizer: "Optimizer",
  seed: "Seed",
  epochs: "Epochs",
  dataset: "Dataset",
  "model.name": "Model name",
  "model.width": "Model width",
};

export function configValues(
  value: JsonObject,
  prefix = "",
): [string, string][] {
  const entries: [string, string][] = Object.entries(value).flatMap(
    ([key, item]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (item && typeof item === "object" && !Array.isArray(item))
        return configValues(item, path);
      return item === undefined || Array.isArray(item)
        ? []
        : [[path, JSON.stringify(item)]];
    },
  );
  if (prefix) return entries;
  // A literal dotted key can shadow a nested path. Offer only the value that
  // filtering will actually read, rather than an impossible duplicate option.
  return [...new Set(entries.map(([key]) => key))].flatMap((key) => {
    const item = configValue(value, key);
    return item === undefined || (item !== null && typeof item === "object")
      ? []
      : [[key, JSON.stringify(item)]];
  });
}

export function filterValue(run: Run, key: string): string[] {
  if (key === "status") return [JSON.stringify(run.status)];
  if (key === "tags") return run.tags.map((tag) => JSON.stringify(tag));
  if (!key.startsWith("config:")) return [];
  const value = configValue(run.config, key.slice("config:".length));
  return value === undefined || (value !== null && typeof value === "object")
    ? []
    : [JSON.stringify(value)];
}

export function optionLabel(value: string): string {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed === null ? "None" : String(parsed);
  } catch {
    return value;
  }
}

/** Values within a facet are OR; independent facets are AND. */
export function matchesRunFilters(
  run: Run,
  filters: Record<string, string[]>,
  except?: string,
  valueFor: (run: Run, key: string) => string[] = filterValue,
): boolean {
  return Object.entries(filters).every(
    ([key, values]) =>
      key === except ||
      !values.length ||
      valueFor(run, key).some((value) => values.includes(value)),
  );
}
