# Architecture

MagicLab uses native JavaScript ESM with explicit ownership and no framework/build
step. This guide owns module responsibilities, dependency direction and runtime
lifecycle. Host boundaries are defined in [AGENTS.md](../AGENTS.md).

## Documentation ownership

| Document                                                          | Primary responsibility                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------- |
| [ADAPTATION.md](ADAPTATION.md)                                    | Installing and connecting host data/algorithms          |
| [FIRST_IMPLEMENTATION.md](FIRST_IMPLEMENTATION.md)                | Initial conversation and provisional filter/plot scope  |
| [EXTENDING.md](EXTENDING.md)                                      | Implementation recipes                                  |
| [data-contract.md](data-contract.md)                              | Dataset, CSV, saved view and reproduction formats       |
| [ALGORITHMS.md](ALGORITHMS.md)                                    | Algorithm format, validation and viewer internals       |
| [STATISTICS.md](STATISTICS.md)                                    | Numerical semantics and pooling assumptions             |
| [DESIGN.md](DESIGN.md) and [tool guides](DESIGN.md#reading-order) | Features, writing/visual rules, interactions and images |
| [PREVIEW.md](PREVIEW.md)                                          | Local compiler setup, preview API and resource limits   |
| [verification.md](verification.md)                                | Required checks and evidence                            |
| [examples](../examples/README.md)                                 | Reference content and regeneration/startup instructions |

Keep each rule in its owning guide and link from other documents. Feature summaries
and contextual reminders may remain when they help readers find the detailed rule.

## Dependency direction

```text
web/app.mjs -> web/application/ -> web/ui/ + browser controllers
                                  |
                          reporting/ -> panels/ -> core/
server.mjs -> server/ ---------------------------> core/
adapters/ --------------------------------------> core/
```

Core has no DOM, Node, filesystem or host dependencies. Reporting is browser/Node
compatible orchestration without DOM effects. Templates receive explicit state
without storage, network or event listeners. The code checker enforces imports,
exports and layer boundaries; details are in the module agent instructions.

## File map

| Responsibility                                 | Entry points                                                                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dataset validation and cross-record references | `core/dataset.mjs`, `schemas/dataset.schema.json`                                                                                                             |
| Portable view defaults/normalization/migration | `core/view.mjs`                                                                                                                                               |
| Typed field discovery/filter equality          | `core/filters.mjs`                                                                                                                                            |
| Strict config/code identity                    | `core/run-identity.mjs`                                                                                                                                       |
| User-selected field/seed grouping              | `core/run-grouping.mjs`, `core/run-table.mjs`                                                                                                                 |
| Exact-step means, smoothing, sample SD         | `core/analysis.mjs`                                                                                                                                           |
| Observation lookup and scalable extrema        | `core/observations.mjs`, `core/extent.mjs`                                                                                                                    |
| Shared uncertainty                             | `core/uncertainty.mjs`                                                                                                                                        |
| Metric charts and wide summary table           | `core/workspace.mjs`                                                                                                                                          |
| Ablation cell membership/shared scales         | `panels/ablation-grid.mjs`                                                                                                                                    |
| Publication settings and series keys           | `core/paper-style.mjs`, `core/paper-export.mjs`, `core/paper-python.mjs`                                                                                      |
| SVG/PDF/data/archive primitives                | `core/text.mjs`, `core/chart-geometry.mjs`, `core/report-svg.mjs`, `core/report-pdf.mjs`, `core/export-data.mjs`, `core/archive.mjs`, `core/table-figure.mjs` |
| Downloads and reproduction packs               | `reporting/direct-export.mjs`, `reporting/export-pack.mjs`, `core/reproduction.mjs`                                                                           |
| Application instance/state/effects             | `web/application/application.mjs`, `state.mjs`, `storage.mjs`, `events.mjs`, `render.mjs`, `exports.mjs`                                                      |
| Analysis snapshot for HTML/Plotly              | `web/analysis-state.mjs`                                                                                                                                      |
| HTML templates                                 | `web/ui/html.mjs`, `runs.mjs`, `menus.mjs`, `workspace.mjs`                                                                                                   |
| Plotly mapping/lifecycle                       | `web/plotly-figure.mjs`, `web/paper-figure.mjs`, `web/plot-tools.mjs`                                                                                         |
| Pointer/keyboard interactions                  | `web/chart-layout.mjs`, `filter-order.mjs`, `curve-order.mjs`, `number-scrub.mjs`                                                                             |
| Browser session/theme                          | `web/view-session.mjs`, `web/theme.mjs`                                                                                                                       |
| Local HTTP/host path                           | `server/http.mjs`, `server/dataset-path.mjs`                                                                                                                  |

## State and rendering

`web/app.mjs` boots `createLabRouter` in `web/application/router.mjs`. The router
mounts/disposes tool applications on hash changes, keeps tool routes outside
MagicPlot views and ignores responses for a disposed application. Reopening
MagicPlot restores its dataset session. The launcher/template is in `web/ui/lab.mjs`.

`createApplication({el, document, localStorage, fetch, prompt, Plotly})` is the
MagicPlot composition root. Imports have no browser/network side effects. One
`createState()` result owns validated input, portable view and transient maps,
expanded groups and controllers. Do not create a second global store. Serialized
fields and storage scope are defined in [data-contract.md](data-contract.md).

Events normalize edits, update selection and render. Rendering persists the
normalized session, derives a shared analysis snapshot, destroys old controllers,
replaces HTML, restores editor state and mounts replacements. Pointer previews
can update CSS/plot state without replacing DOM until commit. `workspace()` can
derive an isolated-test snapshot without mutating its caller. Numerical work stays
in core/panels; escape source values at the rendering boundary.

`paperSeries` derives `originalLabel` from source metadata separately from the
custom label. Original names are not stored as overrides. Public label/legend
behavior belongs to [MagicPlot design](design/MAGICPLOT.md#settings-and-style-panels).
The independent MagicAlgo application and graph are described in
[ALGORITHMS.md](ALGORITHMS.md#derived-graph-and-navigation-state).

## Analysis and catalogue performance

`indexObservations` builds metric/run/ordered-point lookups once per analysis
operation; charts, tables and grid cells share them. Arrays are owned by the
index and input values/order are unchanged. It is not cached across calls.

Catalogue metadata is cached per application instance and invalidated on validated
dataset replacement. `defaultView`/`normalizeView` accept an optional field snapshot;
callers without it rediscover fields. Do not mutate loaded application data in place.
Catalogue tables, title fields and group totals are cached by dataset/filter/grouping;
selection counts remain current. Membership uses sets and extrema scan arrays
without spreading large series into function arguments.

Page positions are transient; filters/grouping reset the catalogue page. Pagination
limits DOM output, not selected membership, analysis or exports. Page sizes and
public selection behavior are in [MagicPlot design](design/MAGICPLOT.md#runs).
All data remains in memory; live or very large datasets need a separate storage design.

## Plot identity and browser controllers

`core/plot-axes.mjs` maps stable plot IDs to source metrics. Workspace and Ablations
consume this mapping; Tables deduplicates Y metrics. Saved fields are specified
in [the view contract](data-contract.md#view-v4), and paired-observation calculations
in [STATISTICS.md](STATISTICS.md#metric-against-metric-plots).

`web/workspace-panel.mjs` measures remaining viewport space and previews size through
CSS variables. Width is transient and shared between Settings and Style; listeners
and observers are disposed on replacement. Plotly controllers likewise own measured
viewports and lifecycle. Tool guides specify public controls and responsive geometry.

`web/application/export-preview.mjs` owns requests, cancellation and artifact URLs;
`web/ui/export-preview.mjs` receives file metadata only. Export generation uses the
existing reporting pipeline and serialized offscreen Plotly rendering. Detailed
compiler/resource contracts are in [PREVIEW.md](PREVIEW.md).

## Server and distribution

`server/http.mjs` creates a server without listening on import; `server.mjs` binds
to loopback. Dataset/algorithm GET routes validate independent inputs. Static GET
access is limited to dashboard layers and local Plotly/KaTeX asset allowlists;
host paths, server code, adapters, examples and tests are not exposed.
`server/load-dataset.mjs` dispatches normalized JSON files or collection directories
to their reader; `adapters/runs.mjs` implements the [run-folder contract](data-contract.md#run-folders)
and `adapters/csv.mjs` the [CSV manifest contract](data-contract.md#csv-manifest).
The preview helper owns capability probing and bounded compilation as specified
in [PREVIEW.md](PREVIEW.md#api-and-saved-state).

The package allowlist includes source, tests, guides, images, lockfile and curated
reference examples, excluding dependencies, caches, logs and real host experiments.
Startup/adaptation instructions are in [ADAPTATION.md](ADAPTATION.md);
archive checks are in [verification.md](verification.md#distribution-check).
