import type { Project, Run } from "./types";
import { compact } from "./chart-model.ts";
import { configValue } from "./config.ts";
import { configValues } from "./run-filters.ts";
import { restorePanelLayout, type PanelLayout } from "./panel-layout.ts";
import { extent, mean, sampleDeviation } from "./statistics.ts";

export type TablePanel = {
  id: string;
  title: string;
  mode: "pivot" | "runs" | "manual";
  columns: string[];
  rows: string[][];
  runIds: string[] | null;
  rowField?: string;
  columnField?: string;
  valueMetric?: string;
  aggregation?: "mean" | "min" | "max";
  uncertainty?: "none" | "stddev" | "stderr" | "range";
  layout?: PanelLayout;
};

export function defaultPanel(project: Project | null): TablePanel {
  return {
    id: "comparison",
    title: "Result comparison",
    mode: "pivot",
    columns: [],
    rows: [],
    runIds: null,
    rowField: "batch_size",
    columnField: "optimizer",
    valueMetric: project?.metrics[0]?.key,
    aggregation: "mean",
  };
}

export function isPanel(value: unknown): value is TablePanel {
  if (!value || typeof value !== "object") return false;
  const panel = value as Partial<TablePanel>;
  return (
    typeof panel.id === "string" &&
    typeof panel.title === "string" &&
    ["pivot", "runs", "manual"].includes(panel.mode ?? "") &&
    Array.isArray(panel.columns) &&
    panel.columns.every((item) => typeof item === "string") &&
    Array.isArray(panel.rows) &&
    panel.rows.every(
      (row) =>
        Array.isArray(row) && row.every((cell) => typeof cell === "string"),
    ) &&
    (panel.runIds === null ||
      (Array.isArray(panel.runIds) &&
        panel.runIds.every((id) => typeof id === "string"))) &&
    [panel.rowField, panel.columnField, panel.valueMetric].every(
      (field) => field === undefined || typeof field === "string",
    ) &&
    (panel.aggregation === undefined ||
      ["mean", "min", "max"].includes(panel.aggregation)) &&
    (panel.uncertainty === undefined ||
      ["none", "stddev", "stderr", "range"].includes(panel.uncertainty)) &&
    (panel.layout === undefined || restorePanelLayout(panel.layout) !== null)
  );
}

export const fieldLabel = (key: string) =>
  key
    .split(".")
    .at(-1)
    ?.replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? key;
function label(run: Run, key: string) {
  const value = configValue(run.config, key);
  return value === null || value === undefined || typeof value === "object"
    ? "—"
    : String(value);
}
export function tableFields(runs: Run[]): string[] {
  const fields = new Map<string, Set<string>>();
  for (const run of runs)
    for (const [key, encoded] of configValues(run.config)) {
      if (encoded === "null") continue;
      if (!fields.has(key)) fields.set(key, new Set());
      fields.get(key)!.add(label(run, key));
    }
  return [...fields]
    .filter(
      ([key, values]) =>
        values.size > 1 ||
        (values.size === 1 && runs.some((run) => label(run, key) === "—")),
    )
    .map(([key]) => key);
}
function aggregate(
  runs: Run[],
  metric: string,
  method: TablePanel["aggregation"],
  uncertainty: TablePanel["uncertainty"],
) {
  const numbers = runs
    .map((run) => run.summary[metric])
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!numbers.length) return "—";
  const [minimum, maximum] = extent(numbers);
  const average = mean(numbers);
  if (method === "min") return compact(minimum);
  if (method === "max") return compact(maximum);
  if (numbers.length < 2 || !uncertainty || uncertainty === "none")
    return compact(average);
  if (uncertainty === "range")
    return `${compact(average)} (${compact(minimum)}–${compact(maximum)})`;
  return `${compact(average)} ± ${compact(sampleDeviation(numbers, average) / (uncertainty === "stderr" ? Math.sqrt(numbers.length) : 1))}`;
}

export function buildTable(
  panel: TablePanel,
  runs: Run[],
  project: Project | null,
  fields = tableFields(runs),
) {
  const ids = panel.runIds === null ? null : new Set(panel.runIds);
  const selected = ids ? runs.filter((run) => ids.has(run.id)) : runs;
  if (panel.mode === "manual")
    return {
      headers: panel.columns,
      values: panel.rows.map((row) =>
        panel.columns.map((_, i) => row[i] ?? ""),
      ),
    };
  if (panel.mode === "runs")
    return {
      headers: panel.columns.map(
        (key) =>
          ({ run: "Run", state: "State", group: "Group" })[key] ??
          project?.metrics.find((metric) => metric.key === key)?.label ??
          key,
      ),
      values: selected.map((run) =>
        panel.columns.map((key) => {
          if (key === "run") return run.name;
          if (key === "state") return run.status;
          if (key === "group") return String(run.config.group ?? "—");
          const value = run.summary[key];
          return typeof value === "number" && Number.isFinite(value)
            ? compact(value)
            : value == null || typeof value === "number"
              ? "—"
              : String(value);
        }),
      ),
    };
  const rowField = fields.includes(panel.rowField ?? "")
    ? panel.rowField!
    : (fields[0] ?? "");
  const columnField =
    fields.includes(panel.columnField ?? "") && panel.columnField !== rowField
      ? panel.columnField!
      : (fields.find((key) => key !== rowField) ?? "");
  const rows = new Set<string>(),
    columns = new Set<string>();
  const cells = new Map<string, Run[]>();
  for (const run of selected) {
    const row = label(run, rowField),
      column = label(run, columnField),
      key = JSON.stringify([row, column]);
    rows.add(row);
    columns.add(column);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key)!.push(run);
  }
  const order = (a: string, b: string) =>
    a.localeCompare(b, undefined, { numeric: true });
  const sortedColumns = [...columns].sort(order);
  const metric =
    project?.metrics.find((item) => item.key === panel.valueMetric)?.key ??
    project?.metrics[0]?.key ??
    "";
  return {
    headers: [
      `${fieldLabel(rowField)} ↓  ${fieldLabel(columnField)} →`,
      ...sortedColumns,
    ],
    values: [...rows]
      .sort(order)
      .map((row) => [
        row,
        ...sortedColumns.map((column) =>
          aggregate(
            cells.get(JSON.stringify([row, column])) ?? [],
            metric,
            panel.aggregation,
            panel.uncertainty,
          ),
        ),
      ]),
  };
}
