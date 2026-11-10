# Dashboard architecture

This is the maintained map for an agent changing MagicLab. Read it with the task-specific guides, then confirm the relevant paths in the current source before editing. Update this map when a feature changes a boundary, data flow, shared component, or persisted state. The [README](../README.md) describes how to run the app; [CHANGE_WORKFLOW.md](CHANGE_WORKFLOW.md) describes how to finish a change.

## Product and scope

The product is a personal dashboard for ML researchers, designed to live inside a research repository and be customized through coding agents. The standalone adoption path is [ADOPTION.md](ADOPTION.md). Minimize added entropy at every boundary: extend existing data records, utilities and shared UI before introducing a new layer or convention. Scalability means keeping these owners clear and addressing measured limits, not introducing speculative frameworks.

MagicLab is a local, browser-based workspace with four sections. **MagicPlot** explores experiment runs through selection, a chart workspace, ablations, and tables. Its Inspections view is currently an empty entry point. **MagicAlgo** derives algorithm and version choices from those runs, then shows a mathematical document for a selected formulation. **MagicTuner** shows study selection, overview, trials, and charts; the bundled studies are simulated. **MagicData** imports and inspects flat CSV/JSON datasets in the browser. The bundled data is deterministic and synthetic. The app does not execute training or tuning jobs or connect to a W&B account.

The current UI is a useful starting point for local research and for connecting a real data source. A visual resemblance to a reference service does not imply that its data, calculations, authentication, or every menu are reproduced. [VERIFICATION.md](VERIFICATION.md) is a dated evidence log, not a promise of current feature parity.

## Entry point and data flow

```text
app/page.tsx
  -> components/dashboard/workspace.tsx (Dashboard)
     -> lib/data/index.ts (selected DashboardDataAdapter)
        -> lib/data/types.ts (contract)
        -> lib/data/sample-adapter.ts + sample-tuning.ts (current source)
     -> MagicPlot views, MagicAlgo, MagicTuner
     -> lib/data chart/filter/layout calculations and lib/algorithms inventory
```

`app/layout.tsx` loads `app/globals.css`. `workspace.tsx` owns the top-level section and view choices, project/run loading, global filters, panel layout, and the theme. It requests project metadata, every page of runs, and optional tuning data. Run histories then load in batches of at most eight requests; charts can show a loading state while histories arrive. The components consume the adapter contract through `lib/data/index.ts`. A real file or service source belongs behind that boundary, with filesystem access and credentials on a server. Read [DATA_ADAPTER.md](DATA_ADAPTER.md) before changing any source, run identity, metric, or loading behavior.

## Screen map

| Section and view                           | User task                                                                                  | Main owner                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| MagicPlot Runs                             | Filter, select, inspect, and export runs                                                   | `workspace.tsx`                                                      |
| MagicPlot Workspace                        | Group runs and arrange interactive metric panels                                           | `workspace.tsx`, `metric-chart.tsx`, `chart-settings.tsx`            |
| MagicPlot Ablations                        | Compare metrics across parameter choices                                                   | `ablations.tsx`, chart model                                         |
| MagicPlot Tables                           | Compare and export run summaries                                                           | `scalar-tables.tsx`                                                  |
| MagicPlot Inspections                      | Reserved entry point with no implemented analysis yet                                      | `workspace.tsx`                                                      |
| MagicAlgo Selection and Paper              | Choose a recorded algorithm/version, read it, and compare another formulation side by side | `magic-algo.tsx`, `algorithm-document.tsx`, `lib/algorithms/diff.ts` |
| MagicTuner Selection, Overview, and Charts | Browse studies, trials, objectives, and parameter plots                                    | `magic-tuner.tsx`, `tuner-overview.tsx`, `tuner-scatter-panel.tsx`   |

The `worker/`, `db/`, `drizzle/`, and connector files support hosting or future integrations. They are not the current sample run source. Confirm that a new integration actually uses those paths before changing them to affect the dashboard data.

| Concern                                             | Current source of truth                                                                            |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Adapter and JSON data types                         | `lib/data/types.ts`, `lib/data/index.ts`                                                           |
| Synthetic runs and studies                          | `lib/data/sample-adapter.ts`, `sample-tuning.ts`                                                   |
| Run filtering, charts, tuning, and panel geometry   | `lib/data/run-filters.ts`, `chart-model.ts`, `chart-expression.ts`, `tuning.ts`, `panel-layout.ts` |
| Algorithm inventory and exact-version formulations  | `lib/algorithms/catalog.ts`, `formulations.ts`, `preferences.ts`                                   |
| Top-level navigation, loading, theme, and MagicPlot | `components/dashboard/workspace.tsx`                                                               |
| MagicAlgo and shared mathematical document          | `magic-algo.tsx`, `algorithm-document.tsx`                                                         |
| MagicTuner selection, overview, and charts          | `magic-tuner.tsx`, `tuner-overview.tsx`, `tuner-scatter-panel.tsx`                                 |
| Chart rendering and editor                          | `metric-chart.tsx`, `chart-settings.tsx`                                                           |
| Tables and ablations                                | `scalar-tables.tsx`, `ablations.tsx`                                                               |
| Visual styles and theme palettes                    | `app/globals.css`                                                                                  |

`CHARTS.md` defines the current chart controls and calculations. `ALGORITHM_STYLE.md` defines formulation content and provenance. Tests in `tests/data/` cover adapter, algorithm, chart, layout, and tuning calculations. The browser capture in `scripts/visual-check.mjs` covers rendered paths and interactions; it needs human image review.

## Shared interface boundaries

Keep the inexpensive selection views immediately available. `lazy-view.tsx` defers chart rendering, table/ablation views, mathematical documents and other expensive views until opened, with a shared loading/error boundary. Chart settings load with their chart so opening the editor does not add a second loading step. Import calculations and types from `lib/data`, never through a chart component; a formatting helper must not pull a renderer into a selection screen.

`lib/data/config.ts` owns exact-key/nested configuration access; `run-filters.ts` discovers facets using that precedence. `statistics.ts` provides numeric reductions; `table-model.ts` owns table validation, pivot grouping and summaries. Table views memoize models separately from editor drafts. `lib/download.ts` owns browser download cleanup; `lib/table-export.ts` renders table files. Reuse these instead of embedding another parser, aggregation or download implementation in a view.

`Pagination` supplies count and previous/next controls inside the existing table/sidebar frame. The unused generic UI scaffold has been removed: the working examples for new features are the actual dashboard components, not a second component library.

The three selection views share `ViewHeader`, `FilterToggle`, `FilterBoard`, `SelectionTable`, `FilterColumnHeader`, and `useFilterReorder`. MagicAlgo and MagicTuner use `SelectionRadio` for their single-choice rows. Detail sidebars share `SidebarHeading` and `SidebarListHeader`. `IconButton` gives icon controls an accessible label. Extend these shared pieces and their common CSS when the same behavior changes across sections. Keep section-specific data and actions in their owning views. See [STYLE_GUIDE.md](STYLE_GUIDE.md) for the visual rules and examples.

Every algorithm document goes through the typed `Formulation` records and `AlgorithmDocument`. Its key is the exact recorded `[name, version]` pair. An unknown version must remain unknown; do not reuse another version's mathematics. Sample formulations are references, not proof of executed training behavior.

MagicAlgo's optional `comparisonVariantKey` is stored alongside the current selection in the existing `magic-algo-v3` preferences; old preferences default to no comparison. Compare actions keep the current document and choose the right-hand formulation independently from the run-derived inventory. The shared document renderer aligns pseudocode through `lib/algorithms/diff.ts`, keeps original line numbers, and highlights changed row backgrounds without altering the underlying LaTeX/MathML. This is a notation comparison, not a claim of mathematical equivalence. Unknown formulations and self-comparisons disable the compare action. Narrow screens scroll the comparison horizontally within its own surface.

## State and failure boundaries

Browser `localStorage` holds theme, MagicPlot workspace and table preferences, MagicAlgo preferences, MagicTuner selection/layout, and per-chart settings. The owning components validate restored values and tolerate unavailable storage. When changing a stored shape or key, inspect its current reader and writer, keep old saved views usable where practical, and test a fresh browser and a browser with previous state. Do not silently discard a user's saved configuration.

`magic-tuner.tsx` owns trial selection and the trial-number color scale shared by Overview and Charts. Overview table/point selection, the Charts trial picker, chart legends and curve clicks update the same run IDs. `MetricChart` optionally accepts `selectedRunIds` and delegates selection through `onSelectRuns`, using the chart model's source run IDs; other sections retain their panel-local legend behavior. Switching between these views preserves selection; unselected trials remain visible and clickable at reduced opacity, preserving the full data and axis ranges. Trial colors use the full study range so selection does not recolor trials. This transient trial selection is separate from saved study filters and chart settings.

Keep loading, valid empty data, unknown runs, invalid input, and rejected source requests distinct. A failed real source must show an error and retry path; it must not quietly switch to sample data. Missing metric values stay missing rather than becoming zero. `Project.isSample` controls the provenance badge; set it false only for actual records.

Generated builds, screenshots, browser profiles, runtime downloads, local diagnostics, credentials, and real experiment logs are not application source. Keep them out of commits. Preserve original logs and document any lossy normalization when connecting real experiments.

## Portable distribution and checks

`scripts/install-into.mjs` copies an explicit source allowlist into a new directory; `LICENSE`, `AGENTS.md`, the docs, tests and lockfile are part of that distribution. When adding a top-level source path required at runtime, update the allowlist and verify the installed copy. Do not depend on files outside this directory. `.openai/hosting.json` is required by `vite.config.ts`; checkout-local `.sites-runtime` and optional parent `tooling/rea` are not distributed. The visual checker imports the dashboard's own `playwright-core` dependency and uses installed Chromium or Chrome. `npm run check` combines unit/tooling tests, typecheck and lint; image inspection remains an explicit agent responsibility.

ESLint rejects direct sample-source imports in dashboard views and React/view imports in data and algorithm modules. These checks protect the existing adapter and calculation boundaries; they cannot prove appropriate reuse or design consistency. The diff and image review in [CHANGE_WORKFLOW.md](CHANGE_WORKFLOW.md) remain required.

## Adding or changing a feature

Find the nearest existing user flow, component, state owner, CSS rule, and calculation before adding code. Put source-specific normalization in an adapter, reusable calculations in `lib/data`, shared interaction patterns in shared components, and section-specific presentation in its view. Keep the relevant guide and capture steps current as part of the feature. Complete the checks and visual iteration in [CHANGE_WORKFLOW.md](CHANGE_WORKFLOW.md).

## MagicData ownership

MagicData is the fourth top-level section. `workspace.tsx` owns its selection/viewer
navigation and lazy-loads `components/dashboard/magic-data.tsx`. This view reuses
ViewHeader, SelectionTable, SelectionRadio, SidebarHeading, SidebarListHeader,
the algorithm workspace layout and the tuning search control. The catalog combines
three built-in synthetic datasets with browser imports, independently of experiment
data. `lib/data/sample-datasets.ts` supplies fresh deterministic records, labeled
through `Dataset.isSample`. They are not written to IndexedDB or removable.
Storage errors remain visible rather than falling back to samples. `lib/data/datasets.ts`
owns flat CSV/JSON parsing and column profiles; `lib/data/dataset-store.ts` owns
IndexedDB transactions. Only completed write transactions update the displayed
catalog. No dependency, server endpoint or experiment adapter change is required.
