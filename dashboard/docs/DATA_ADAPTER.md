# Connecting actual experiment data

The dashboard receives data exclusively through `DashboardDataAdapter`, defined
in `lib/data/types.ts`. Its currently selected implementation is constructed in
`lib/data/index.ts`. Replace that construction to connect a new source; keep the
interface and dashboard components unchanged.

## Current source

`createSampleAdapter()` supplies **synthetic demonstration data**, not captured
training runs: 60 runs in 12 groups of five seeds each, with generic example
project metadata. `Project.isSample` is `true` so the
interface can display that provenance. Identifiers, timestamps, configurations,
rewards and other metrics are generated deterministically and remain stable
across reloads. No network service, filesystem, account or training job is used.

The metric catalog currently includes `eval/mean_reward`, `eval/mean_ep_length`,
`train/loss`, `val/loss`, `accuracy`, and `learning_rate`. Run grouping is represented
by the ordinary configuration field `config.group`; individual runs expose
`config.seed`. Each group shares a color. Sample histories span up to one million
steps, with shorter histories for running and failed runs.

Each sample algorithm retains ten unversioned runs and has ten runs with an explicit
demonstration version: PPO `demo-normalized`, SAC `demo-auto-temperature`, and A2C
`demo-no-entropy`. These version identities are recorded in `config.algorithm_version`
and describe reference formulations only. Histories remain synthetic; they do not
measure the effect of those algorithm changes. Run IDs, groups and histories are
unchanged by the version labels.

MagicTuner receives three separate **simulated Optuna studies** through the optional
`getTuningData()` adapter method. Each has 32 numbered, completed trials and does
not change MagicPlot's 60-run catalog. PPO searches learning rate, batch size,
model width, dropout, and optimizer to minimize `val/loss`. SAC searches learning
rate, batch size, model width, entropy coefficient, and target update rate to
maximize `eval/mean_reward`. A2C searches learning rate, rollout steps, discount
factor, entropy coefficient, and model width to maximize `eval/mean_reward`. Each
study declares exact bounds or choices in `sample-tuning.ts`. Trial values and
histories come from deterministic illustrative formulas; no Optuna process or
training was run. When this optional tuning data is present, MagicTuner displays
these studies; ordinary sample runs remain in MagicPlot.

## Contract

All adapter methods are asynchronous. JSON values use `JsonValue` / `JsonObject`;
functions, class instances, date objects, `undefined` and non-finite numbers must
not cross this boundary. Timestamps are UTC ISO 8601 strings, durations are in
seconds, metric steps are finite numbers, and IDs are stable opaque strings.

| Method                     | Result          | Behavior                                                     |
| -------------------------- | --------------- | ------------------------------------------------------------ |
| `getProject()`             | `Project`       | Project identity, sample provenance and metric catalog.      |
| `listRuns(query?)`         | `RunPage`       | Filtered, sorted, paginated runs plus total filtered count.  |
| `getRun(id)`               | `Run \| null`   | Complete configuration and summary for a single run.         |
| `getHistory(runId, keys?)` | `MetricPoint[]` | Step-ordered history; omitted keys requests all metrics.     |
| `getTuningData?()`         | `TuningData`    | Optional study definitions, trial runs, and their histories. |

When `getTuningData()` is absent, MagicTuner can still organize ordinary runs by
`config.tuning.study_id` or `config.algorithm`. A study definition adds its objective
metric and declared parameter space. Each trial run may carry
`config.tuning.trial_number`; its `summary` holds final metrics and its history uses
the same `MetricPoint` contract as MagicPlot. Study-specific trial IDs must not
collide with IDs in the general run catalog.

`Run` includes identity, display name, color, status, timestamps, duration, tags,
configuration and summary. Statuses are `finished`, `running`, and `failed`.
Map source-specific values such as `crashed` to `failed` in your adapter.

Each history point contains:

```ts
{
  step: 10000,
  timestamp: "2026-11-07T14:00:30.000Z",
  values: { "eval/mean_reward": 418.5, "train/loss": 0.93 }
}
```

Missing metrics are absent keys, never implicit zeros. Return `[]` for a known
run with no history or an explicitly empty metric selection. Unknown runs reject
history requests with `DataAdapterError("not_found", ...)`; `getRun` returns null.
Unknown requested metrics reject with `invalid_metric`. A new adapter should
deduplicate steps according to an explicitly documented source policy and sort
the final rows by step. Keep a metric catalog in `Project.metrics`; add new
metric definitions there instead of hardcoding them in UI components.

### Filtering and pagination

`RunQuery` accepts:

- `search`: case-insensitive substring of run ID, name or tags.
- `status`: one status or an array of statuses; an empty array selects no runs.
- `configFilters`: AND-combined `{ key, operator, value }` rules. Keys first match
  exact configuration keys, then dot-separated nested paths such as `model.width`.
  Operators are `eq`, `neq`, `in`, `gt`, `gte`, `lt`, `lte`, `contains`. `in` requires
  a scalar array; other operators accept scalars. Comparisons are type-sensitive,
  numeric comparisons require numbers, and missing fields fail every filter.
- `sortBy`: `name`, `status`, `createdAt`, `updatedAt`, `durationSeconds`,
  `config:<key>` or `summary:<key>`; default `createdAt`.
- `sortDirection`: `asc` or `desc`; default `desc`.
- `offset`, `limit`: nonnegative integers; defaults 0 and 100. `limit: 0` returns
  the filtered count without rows. Offset beyond the result returns empty rows.

`RunPage.total` is counted **after filtering and before pagination**. Missing or
structured sort values come last regardless of direction. Ties break by run ID.
To preserve selection through filtering, UI state should store run IDs rather
than indexes into the current page.

## An actual file adapter

For local JSON/CSV/Parquet files, place filesystem reading in a local server or
API route. A browser component cannot read arbitrary paths on the user's disk.
The server should validate its configured data root, normalize source files,
and expose the four operations. The client adapter only converts those responses
to the contract. Never bundle real experiment logs into client source or sample data.

For example, create `lib/data/http-adapter.ts`:

```ts
import type { DashboardDataAdapter, RunQuery } from "./types";

export function createHttpAdapter(baseUrl: string): DashboardDataAdapter {
  async function read<T>(path: string): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`);
    if (!response.ok)
      throw new Error(`Data request failed: ${response.status}`);
    return response.json() as Promise<T>; // Validate actual responses before returning.
  }
  return {
    getProject: () => read("/project"),
    listRuns: (query: RunQuery = {}) =>
      read(`/runs?query=${encodeURIComponent(JSON.stringify(query))}`),
    getRun: (id) => read(`/runs/${encodeURIComponent(id)}`),
    getHistory: (id, keys) =>
      read(
        `/runs/${encodeURIComponent(id)}/history?keys=${encodeURIComponent(JSON.stringify(keys ?? null))}`,
      ),
  };
}
```

This is a wiring example, not an implemented endpoint. Supply real schema
validation, structured errors and the desired authentication at that boundary.
Then replace `createSampleAdapter()` in `lib/data/index.ts` with
`createHttpAdapter("/api/data")`. Return `isSample: false` only once the source
contains actual runs. Do not silently substitute sample data when real data
is unavailable.

Before connecting files, establish their formats, run identity rules, config
and summary locations, metric column names, units, timestamp timezone, and
duplicate-step handling. Preserve original source data. Document any lossy
normalization, and derive summaries from the same history the UI displays.

## Loading, empty results and errors

- While a promise is pending, show a loading state and prevent stale responses
  from replacing a newer query result.
- Empty `runs` with `total: 0` means a valid empty selection, not an error.
- `getRun(id) === null` means the run disappeared or the link is invalid.
- An empty known history should show “No metric history” rather than a zero curve.
- Rejected requests should surface a recoverable error and retry action. Never
  describe an unavailable source as zero runs or fabricate successful results.
- The sample adapter returns fresh copies, so edits to UI objects cannot mutate
  its source. New adapters should provide the same consumer isolation.

## Contract checks

From `dashboard/`, after `npm ci`, use any supported Node installation:

```sh
node --test tests/data/adapter.test.mjs
```

These tests verify grouping, filtering plus pagination, metric sorting, histories,
summary consistency, deterministic data, mutation isolation and error semantics.
Run equivalent checks against any future adapter before switching the UI source.

## User-imported datasets

MagicData's user-selected CSV/JSON files use the separate dataset boundary in
`datasets.ts` and `dataset-store.ts`, not the experiment adapter. Browser File
access is limited to explicitly imported files; there is no arbitrary filesystem
reading. IndexedDB persists normalized scalar rows per browser origin. CSV text
is preserved except empty fields become null; JSON absent fields become null and
columns are the union of object keys. Source files are never modified. Imports
with malformed rows, duplicate/blank columns or nested JSON fail visibly.
