/** Values crossing the adapter boundary must be plain JSON, never framework objects. */
export type JsonScalar = string | number | boolean | null;
export type JsonValue = JsonScalar | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type RunStatus = "finished" | "running" | "failed";

export interface MetricDefinition {
  key: string;
  label: string;
  unit?: string;
  preferredDirection?: "minimize" | "maximize";
}

export interface Project {
  id: string;
  name: string;
  entity: string;
  description: string;
  isSample: boolean;
  metrics: MetricDefinition[];
}

export interface Run {
  id: string;
  name: string;
  color: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  durationSeconds: number;
  tags: string[];
  config: JsonObject;
  summary: JsonObject;
}

/** A missing metric in `values` is missing data, never an implicit zero. */
export interface MetricPoint {
  step: number;
  timestamp: string;
  values: Record<string, number>;
}

export interface ConfigFilter {
  /** Dot-separated configuration path, for example "model.width". */
  key: string;
  operator: "eq" | "neq" | "in" | "gt" | "gte" | "lt" | "lte" | "contains";
  value: JsonScalar | JsonScalar[];
}

export type RunSortKey =
  | "name"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "durationSeconds"
  | `config:${string}`
  | `summary:${string}`;

export interface RunQuery {
  /** Case-insensitive substring match against run name, ID and tags. */
  search?: string;
  status?: RunStatus | RunStatus[];
  /** All configuration filters are combined with AND. */
  configFilters?: ConfigFilter[];
  sortBy?: RunSortKey;
  sortDirection?: "asc" | "desc";
  offset?: number;
  limit?: number;
}

export interface RunPage {
  runs: Run[];
  /** Count after filters and before pagination. */
  total: number;
  offset: number;
  limit: number;
}

export type TuningParameterSpace =
  | {
      type: "float" | "int";
      low: number;
      high: number;
      log?: boolean;
      step?: number;
    }
  | { type: "categorical"; choices: JsonScalar[] };

export interface TuningStudyDefinition {
  id: string;
  name: string;
  objectiveKey: string;
  searchSpace: Record<string, TuningParameterSpace>;
}

export interface TuningData {
  studies: TuningStudyDefinition[];
  runs: Run[];
  histories: Record<string, MetricPoint[]>;
}

/**
 * The UI talks only to this interface. Implement it with local files, an HTTP
 * endpoint, SQLite, or another source without changing dashboard components.
 */
export interface DashboardDataAdapter {
  getProject(): Promise<Project>;
  listRuns(query?: RunQuery): Promise<RunPage>;
  getRun(id: string): Promise<Run | null>;
  /** Chronological step order. Omit keys for all available metric values. */
  getHistory(runId: string, keys?: string[]): Promise<MetricPoint[]>;
  /** Optional study-specific records, separate from the general run catalog. */
  getTuningData?(): Promise<TuningData>;
}
