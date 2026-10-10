# Verification

This guide owns validation procedures. Report what ran for the current change and
distinguish automated, browser and exported-artifact evidence. Do not treat
historical pass counts or screenshot captions as current verification.

## Automated commands

From `magic_lab/`:

```sh
npm ci
npm run check
npm test
npm run package:check
```

`check` verifies syntax/imports/exports/layer boundaries and canonical formatting.
Tests cover numerical contracts, filters/grouping, saved formats, imported application
modules, controllers and loopback HTTP. Neither requires real host experiment data.
Application DOM/network/storage and Plotly controller stubs do not establish browser
geometry or pixel appearance; PDF signatures do not establish visual quality.

## Host data and examples

After adapting data, run `npm --prefix magic_lab run check:data` from the host root
and its adapter/algorithm integration tests. Compare source and normalized values
and independently calculate a two-replica mean/sample SD, singleton tail and a
configuration/code difference that remains separate.

In the development repository, use `npm run check:data` and `npm test` from the
root. They check synthetic references, generator provenance, authored formulas,
explicit examples startup, override precedence and no fallback when host data is
missing. Startup/regeneration commands are in [portable examples](../examples/README.md).

## Manual browser checks

Read [DESIGN.md](DESIGN.md) and the relevant tool guide with its images/examples.
Use 1440, 1024 and 390 px, 200% zoom, keyboard navigation, pointer cancellation,
confined scrolling and actual visual inspection. Record gaps without claiming
that screenshots or automated fixtures prove these checks.

- MagicLab: launcher/direct routes, back/forward, theme continuity, return via brand, delayed-response disposal and data-independent placeholder routes.
- MagicPlot Runs: typed filter OR/AND, discarded selection after filter changes, paginated selection across pages, grouped/individual rows and config expansion.
- MagicPlot analysis: empty selections, saved-session refresh, presets/storage failure, reorder/resize/scrub cancellation, zoom/pan/reset, ranges, labels, legend styling and editor focus/scroll.
- MagicAlgo: main/module navigation, ancestor focus/scroll restoration, shared modules, graph/resize controls, glossary/step help, local fonts/formulas, and empty/missing/loading exit cases.
- MagicTuner: explicit planned state, shared theme and return navigation, without implying implemented tuning.

For preview changes, exercise [MagicPlot preview rules](design/MAGICPLOT.md#preview-and-export)
with a local compiler. Check individual charts/cells, return to interactive mode,
layout independence from download mode, cancellation, errors and actual PDF fitting.
Setup and protocol are in [PREVIEW.md](PREVIEW.md).

## Exported artifacts

Export affected formats in combined/separate mode. Inspect SVG/PNG/PDF visually
and CSV/LaTeX numerically. Verify current metric/grid/table membership, units,
missing values, singleton uncertainty and actual endpoints/n. Reproduction must
retain data/settings/member metadata and restore the same result. Use the
[data contract](data-contract.md#session-and-reproduction) and
[statistical invariants](STATISTICS.md#bands-and-summaries) as expected behavior.

## Distribution check

Build with `npm run package` in the module. Inspect the allowlist/archive for both
example folders, source/docs/images and lockfile; exclude dependencies, caches,
logs, real host experiments and generated exports.

Extract under a fresh host, install dependencies and run baseline checks without
host data. Verify explicit `--examples` mode loads references, then normal startup
uses only host paths. Missing input must not silently load examples. Finally
provide separate host data and algorithms and verify both endpoints/tools.
