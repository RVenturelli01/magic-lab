import { createSampleAdapter } from "./sample-adapter";
import type { DashboardDataAdapter } from "./types";

/** Replace only this construction when connecting an actual data source. */
export const dataAdapter: DashboardDataAdapter = createSampleAdapter();

export { createSampleAdapter, DataAdapterError } from "./sample-adapter";
export type {
  ConfigFilter,
  DashboardDataAdapter,
  JsonObject,
  JsonScalar,
  JsonValue,
  MetricDefinition,
  MetricPoint,
  Project,
  Run,
  RunPage,
  RunQuery,
  RunSortKey,
  RunStatus,
  TuningData,
  TuningParameterSpace,
  TuningStudyDefinition,
} from "./types";
