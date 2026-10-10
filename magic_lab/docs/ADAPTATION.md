# Adapt to another repository

This guide owns the host-integration workflow. Read the host instructions and
[AGENTS.md](../AGENTS.md) first. Keep real experiments, adapters and outputs in
the host; preserve raw source logs. Bundled references remain documentation.

For the initial implementation or adaptation, follow the required
[first-implementation conversation](FIRST_IMPLEMENTATION.md). Propose base lists
of classification filters and selectable curves, collect the user's choices,
and keep the first scope small and provisional before implementing those choices.

## 1. Install and inspect

Place the complete portable directory at `<host>/magic_lab/`, including examples,
design images, instructions and lockfile. Exclude installed dependencies and caches.
Run `npm --prefix magic_lab ci`, then the baseline checks in
[verification.md](verification.md#automated-commands). These work before host data exists.

Inspect training/evaluation entrypoints and representative logs without launching
training. Record run identities, configuration/protocol differences, source units,
code provenance and completion evidence. Ask about unknown semantics; a log file's
existence does not establish successful completion. Consult the
[data contract](data-contract.md#dataset-v1) for required records and
[statistical invariants](STATISTICS.md) for factors that prevent pooling.

## 2. Normalize host logs

Use the [CSV manifest contract](data-contract.md#csv-manifest) when it matches the
source layout; otherwise write a host-owned adapter importing `core/dataset.mjs`.
The [run-folder contract](data-contract.md#run-folders) also accepts per-run JSON
configuration and CSV logs directly, without a generated aggregate JSON file.
Return `validateDataset(dataset)` and write `<host>/data/dataset.json`, or configure
`OBSERVATORY_DATASET` to a normalized file or supported collection directory.
Relative overrides resolve against the host root.

Document source-to-metric mappings, unit conversions, duplicate-event resolution,
missing observations and unknown provenance. Preserve original experiment names
and unique seed-run IDs. Follow the dataset and statistics contracts rather than
inventing alignment, completion status or unavailable values.

## 3. Verify the mapping

Add a host integration test with a small irregular/missing-log fixture and
independent expected values. Run host data validation and integration tests as
specified in [verification.md](verification.md#host-data-and-examples).
Manually compare source and normalized steps/final values for two replicas, an
incomplete tail and a configuration/code difference that must stay separate.

## 4. Author host algorithms

Read the implementation and prepare descriptions using the
[algorithm contract](ALGORITHMS.md) and [portable authoring examples](../examples/magicalgo/README.md).
Check formulas, conventions and module calls against actual source code; the
viewer does not perform that verification. Put customized generators in the host
and write `<host>/data/algorithms.json`, or select a file with `MAGICLAB_ALGORITHMS`.
Keep hypothetical descriptions explicitly identified.

## 5. Adapt requested features

Use [EXTENDING.md](EXTENDING.md) for implementation recipes. Data-only changes
usually need no UI branch. Follow [DESIGN.md](DESIGN.md) and the applicable tool
guide for visual/writing rules and embedded references. Installing in another
repository does not authorize adopting its branding or restyling MagicLab.

Use [portable examples](../examples/README.md) without replacing them with host
results. Start with `npm --prefix magic_lab start`, without `--examples`, after
connecting host data and algorithms. Validate both tools against their actual sources.

## 6. Handoff

Record source paths, provenance limitations, adapter/authoring commands, requested
customizations, validation and startup instructions in host documentation.
Version experiment-specific views and generated exports outside the module.
Preserve the dashboard guides and examples for the next coding agent.

```text
host/
  scripts/normalize-logs.mjs
  scripts/describe-algorithms.mjs
  logs/                       # untouched sources
  data/dataset.json
  data/algorithms.json
  exports/                    # views and downloaded figures
  tests/adapter.test.mjs
  magic_lab/                  # dashboard and bundled references
```
