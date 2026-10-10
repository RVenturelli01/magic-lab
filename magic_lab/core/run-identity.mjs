import { canonical } from "./filters.mjs";
/** Strict statistical identity; the catalogue adds run.name via run-grouping. */
export const groupKey = (run) =>
  canonical([run.algorithm, run.environment, run.config, run.code]);
