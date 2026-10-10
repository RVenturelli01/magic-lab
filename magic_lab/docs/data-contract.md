# Data and portable views

This guide owns serialized dataset, CSV, view and reproduction formats. Numerical
semantics are in [STATISTICS.md](STATISTICS.md); catalogue/panel presentation is in
[MagicPlot design](design/MAGICPLOT.md).

Runtime validation: `core/dataset.mjs`. JSON Schema: `schemas/dataset.schema.json`. Runtime checks also enforce cross-record references, duplicate IDs/observations and repeated seeds in identical config/code groups.

## Dataset v1

```js
{schemaVersion:1,id,description?,runs:[],metrics:[],points:[],artifacts:[],campaigns:[]}
```

All collections are required; metrics has at least one definition. Extra JSON fields are allowed for host extensions. Finite values only; missing observations are absent records. `id` identifies a dataset collection and namespaces its browser session.

| Record   | Required fields and semantics                                                                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run      | `id` unique; `algorithm`, `environment` nonempty; integer `seed`; `status` completed/running/failed/queued; object `config`; `code.commit` nonempty and `code.dirty` boolean |
| Metric   | `id` unique, `label`, `unit`, `xUnit` nonempty; `phase` training/evaluation; `direction` higher/lower/neutral                                                                |
| Point    | `runId`, `metricId` refer to existing records; finite nonnegative `step`; finite `value`; unique (run,metric,step)                                                           |
| Artifact | unique `id`, existing `runId`, `kind` checkpoint/video/image/file, nonempty `label`, safe relative `path`                                                                    |

Run `name` is optional but, when present, nonempty; seed replicas share the original experiment name. IDs remain unique per replica. Full config/code objects define strict replicate identity; an identical group cannot repeat a seed. Include wrapper/version/protocol/budget/normalization factors in config. Unknown code revision must be explicit, e.g. `unknown`.

Artifact paths are metadata only, not download endpoints. Absolute paths, URI schemes and parent traversal are rejected. Source files/logs and artifacts live in the host.

Campaign records remain an optional extension collection (empty array is normal). Each has unique id, title, hypothesis, status proposed/approved/in_progress/completed/cancelled, unique nonempty integer seeds, unique nonempty environments and variants with unique name/algorithm/object parameters/ablation/command. Commands must contain `{seed}` and `{environment}` and are never executed. There is no campaign UI or automatic completion inference.

## Run folders

`adapters/runs.mjs` reads a collection directory containing `manifest.json` and
one folder per run. `OBSERVATORY_DATASET` may select this directory instead of a
normalized JSON file. The default host path remains `data/dataset.json`.

```text
runs/
  manifest.json
  experiment-seed0/
    config.json
    metrics.csv
  experiment-seed1/
    config.json
    metrics.csv
```

The manifest contains `schemaVersion: 1`, dataset `id`, optional `description`,
`metrics` definitions, `stepColumn` (e.g. `step`), and `runs`, an ordered array of
relative folder paths. Optional `artifacts` and `campaigns` default to empty arrays.
Each `config.json` is a complete Run record from Dataset v1, including the nested
`config` object and explicit status/provenance. Each `metrics.csv` has a step
column and metric columns named by their exact metric IDs. A run may omit columns
for metrics it does not log; blank metric cells are omitted, never zero-filled.
Unknown metric columns, invalid steps/values, duplicate observations and duplicate
run identities fail validation. Empty logs may contain only a header, for example
for a queued run; status is never inferred from the log.

Folder and file paths, including resolved symbolic links, must remain within the
collection. Sources are read-only and are reread on Reload. See the
[portable examples](../examples/magicplot/README.md) for a complete collection.
JSON configuration is supported directly; YAML configurations or other logger
formats need a host adapter. The browser and export contract remains Dataset v1;
the directory structure only changes source loading.

## CSV manifest

`adapters/csv.mjs` reads a directory containing `manifest.json`:

```json
{
  "id": "my-research",
  "stepColumn": "step",
  "columns": { "eval_return": "eval/return" },
  "metrics": [
    {
      "id": "eval/return",
      "label": "Return",
      "phase": "evaluation",
      "unit": "reward",
      "xUnit": "environment steps",
      "direction": "higher"
    }
  ],
  "runs": [
    {
      "id": "run-0",
      "name": "experiment",
      "file": "progress.csv",
      "algorithm": "method",
      "environment": "env-v1",
      "seed": 0,
      "status": "completed",
      "config": {},
      "code": { "commit": "unknown", "dirty": false }
    }
  ]
}
```

Step cells are required. Blank metric cells are omitted. Column keys map actual source columns to metric IDs. Files must remain within the input directory. The reader validates normalized output and leaves source files unchanged. Repository-specific semantics/conversions belong in a host adapter and documentation.

## View v4

`core/view.mjs` owns defaults and validation. Fields include name, tab runs/workspace, workspaceMode charts/ablation/tables, filters, selected IDs, runGrouping, chartSeries, ordered charts, active metric, ablationMetric/Row/Column, smoothing window, incomplete/alignment/band, minStep/maxStep, chartSize, chartRanges and paper style. Empty min/max means auto; empty charts intentionally selects no metrics.

Filters are `{field,values}`. Fields are JSON Pointers into runs with standard `~0`/`~1` escaping. Values are canonical serialized wrappers from `valueKey`: `{"value":0.1}`, `{"value":"0.1"}`, `{"missing":true}`. Arrays/objects compare as whole typed values. OR within a field, AND across fields, empty values unrestricted. Unavailable imported options remain explicit instead of being silently discarded.

`runGrouping` is none/configuration/a discovered JSON Pointer. Configuration selects Seeds; group identity and pooling assumptions are defined in
[STATISTICS.md](STATISTICS.md#selection-and-grouping). Chart series is runs/seed-mean/group-mean. Charts/Ablations/Tables share filtering, selection and settings; filters/catalogue appear only in Runs.

Restored/imported selection must satisfy the [selection invariants](STATISTICS.md#selection-and-grouping).
Catalogue ordering, expansion and paginated selection behavior belong to
[MagicPlot design](design/MAGICPLOT.md#runs).

Chart size is shared CSS width 320–2400 and height 280–1200 (defaults 560×420). Metric ranges have finite increasing xmin/xmax/ymin/ymax. Missing ranges restore shared observed bounds. DOM viewport and plot controllers are transient. Paper style defines physical sizes, display divisors, per-metric labels/ranges and per-series appearance/order/visibility.

`view.plotAxes` maps custom plot IDs to `{x, y}` source metrics; legacy metric IDs
represent training-step plots. `ablationXMetric` and `ablationMetric` identify
Ablations coordinates. Plot IDs own styling/zoom; source metric IDs own observations
and CSV provenance. Saved pairings remain supported even without axis-pair UI.
`displayMode` is specified in [PREVIEW.md](PREVIEW.md#api-and-saved-state).

Versions 1–3 and old v4 fields are migrated to current defaults. Legacy search/operators use observed typed options, negative operators preserve empty/no-match results, Compare maps to workspace, unknown sections map to Runs and old single-metric views get one chart. `seed` grouping migrates to configuration. Compatibility is for saved artifacts, not obsolete UI/modules.

## Session and reproduction

Browser storage is origin-local and not portable. `web/view-session.mjs` saves current view/expanded groups per dataset. Presets use storage separate from the current dataset session. Storage failure
behavior follows the [shared interaction rules](DESIGN.md#interaction-and-accessibility). Version experiment-specific view JSON in the host when sharing.

`core/reproduction.mjs` produces schemaVersion/appVersion/createdAt/datasetSha256/view/statistics/dataset. The SHA-256 hashes UTF-8 `JSON.stringify(dataset)` and is verified on restore. It detects accidental data changes, not trusted provenance. Reproduction restores a complete snapshot; subsequent Reload returns to the host dataset. Use the same dashboard revision for reproduction.

Export packs retain complete member metadata and active grid/table membership.
Numeric payload semantics are defined in [STATISTICS.md](STATISTICS.md#bands-and-summaries);
module ownership is listed in [architecture](ARCHITECTURE.md#file-map).
