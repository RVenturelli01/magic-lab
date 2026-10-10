# Coding-agent instructions

## Read first

This directory is a reusable dashboard module inside a host repository. Read the host's own instructions, then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the relevant recipe in [docs/EXTENDING.md](docs/EXTENDING.md). For a new repository, follow [docs/ADAPTATION.md](docs/ADAPTATION.md). Paths below are relative to this module.

For a first implementation or host adaptation, follow [docs/FIRST_IMPLEMENTATION.md](docs/FIRST_IMPLEMENTATION.md): propose small base lists of run-classification filters and selectable plot curves, and collect the user's confirmation or modifications before implementing those choices. Explain that this first scope is provisional and recommend starting simply; optional plot/table images can clarify the request.

Keep experiment code, repository-specific adapters, raw logs, normalized datasets, configurations, checkpoints, saved experiment views and generated figures **outside** this directory. The curated synthetic reference examples under `examples/magicplot/` and `examples/magicalgo/` are an explicit exception; never write real host experiments or exports there. Tests inside `tests/` use small contract fixtures or temporary directories, never host experiment generators or `../data`. Do not launch training or add integrated chat as part of dashboard adaptation.

## Ownership and boundaries

- `core/`: pure dataset/view contracts, statistics, grouping, observation indexing and format primitives. No DOM, Node APIs, filesystem or host imports.
- `panels/`: pure analysis panels; depend on core, never on browser state.
- `reporting/`: export orchestration across core and panels. Browser and Node compatible.
- `web/ui/`: HTML templates receiving explicit state/snapshots. No storage, network or event listeners.
- `web/application/`: composition, event handlers, rendering lifecycle, persistence and browser export effects. `web/app.mjs` only boots one instance.
- `server/`: local read-only HTTP and dataset-path resolution. `server.mjs` only starts the server.
- `adapters/`: generic readers. Repository-specific mappings live in the host.

Use relative ESM imports and update all callers when moving modules. Do not leave compatibility facades or duplicate implementations for deleted source files. Saved artifact formats are different: retain supported view-version migration in `core/view.mjs` and `core/filters.mjs`.

## Invariants

Read [docs/STATISTICS.md](docs/STATISTICS.md) before changing computations. Never silently change statistical defaults, pooling, missing observations, units, provenance or evaluation protocols. All displayed band widths use `core/uncertainty.mjs`.

Runs alone owns filters and the selectable catalogue. Navigation exposes Runs, Charts, Ablations and Tables, using `tab=workspace` and `workspaceMode` internally for saved views. Selection intersects filters and remains discarded after filters broaden, including imported/restored views. Every analysis consumes the shared selection.

Use `core/run-grouping.mjs` for explicit grouping and typed keys; Seeds includes name/full config/code/environment identity. Group selection acts on visible members. Metadata for pooled groups must retain all configurations and code versions. Catalogue columns follow all displayed filters, including constant fields; use `fieldLabel`, preserve JSON pointers internally. Groups expand into individual config/artifact rows; a group must not pretend its first member is representative. Filter reorder inserts and shifts, never swaps.

Escape log-provided strings with `core/text.mjs` `xml` before HTML/SVG insertion; use DOM `textContent` for dynamic text. Use typed `valueKey` for equality, distinguishing missing/null/number/string. Do not execute campaign commands or fetch artifact paths.

Before UI changes, read [docs/DESIGN.md](docs/DESIGN.md), the relevant tool guide ([MagicPlot](docs/design/MAGICPLOT.md) or [MagicAlgo](docs/design/MAGICALGO.md)) with its embedded screenshots, and the corresponding portable examples in `examples/`. Preserve the approved aesthetic and shared CSS tokens. Written design rules take precedence over incidental image details. Keep accessibility, pointer cancellation, keyboard handles, focus/scroll restoration and storage-failure reporting.

Installation, migration and host-data adaptation do not authorize a restyle. Preserve the shared frame and each tool's specific identity in `docs/DESIGN.md` unless the user explicitly requests a style change; apply it only to the requested scope. The tool guides own their visual references and capture limitations. Keep this design documentation and its images in every distributed copy. MagicTuner has no approved full UI yet. For MagicAlgo authoring, read `examples/magicalgo/README.md` and the portable JavaScript document factories: these are viewer-contract documentation, never executable training code. The bundled synthetic reference documents in `examples/` are portable documentation. Real host algorithms, data and generated documents remain outside this module.

Do not rerender during pointer resize/scrub; preview transient changes and normalize on commit. Plotly stays local through the pinned lockfile. Use measured dimensions and the existing Plotly lifecycle controller; always destroy old controllers. Zoom ranges are portable per metric; measured viewport and DOM objects are transient. Ablation reset recovers shared data bounds. Preserve series styling, order and visibility across figures/exports without deleting hidden source data.

Charts and Ablations use local Plotly. Image exports use the same exporter; standalone LaTeX exports generate source without a compiler. Optional compiled LaTeX previews use the bounded local POST endpoint and an external temporary directory described in [docs/PREVIEW.md](docs/PREVIEW.md). Keep generated source/PDF/log files outside the module, dispose preview requests/URLs and never accept arbitrary TeX from the client.

Use English for documentation, code comments and authored example content. Keep shared design rules in `docs/DESIGN.md`, tool-specific rules and images in the respective tool guides, and data/authoring explanations in `examples/`; link between them rather than duplicating rules.

## Verify and document

Run `npm run check`, `npm test`, and `npm run package:check` here (or `npm --prefix magic_lab ...` in the host). When data changes, run `npm run check:data` and the host's own tests. Add independent expected numerical fixtures for statistical/adapter changes; test application behavior through imported modules, not source-string eval.

For UI/export changes, also exercise navigation, filtering, grouping, empty selections, saved-session refresh, dimensions/ranges and active-mode exports in a real browser. Inspect actual SVG/PNG/PDF and CSV/LaTeX values when affected. State exactly which checks ran; automated stubs are not a browser or PDF visual inspection.

Update the architecture/extension/data/statistics documents when their contracts change. Keep Node >=22, MIT licensing and local operation. Add dependencies only for concrete needs. `npm run check` enforces layer direction and import/export correctness; `npm run format` keeps source readable. Do not add historical implementation notes or obsolete feature examples to the starter.
