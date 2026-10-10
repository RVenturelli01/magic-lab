# Feature recipes

This guide owns implementation steps. Read the host instructions and
[architecture](ARCHITECTURE.md) first, then change the owning layer without
creating a parallel selection, grouping or export pipeline. Format/behavior
requirements belong to the contracts linked below; visual rules belong to
[DESIGN.md](DESIGN.md) and the applicable tool guide.

## Add a metric or filter

Define the metric in host data using [data-contract.md](data-contract.md#dataset-v1).
Filters discover typed metadata automatically; generic fields need no UI branch.
Change initial filters/chart in `core/view.mjs` only when data cannot express the
requested default. Preserve JSON pointers internally and use `fieldLabel` in UI.
Test nested/escaped keys and numeric/string/missing distinctions.

## Add or change a computation

Put generic arithmetic in core or feature-specific work in `panels/<feature>.mjs`.
Accept dataset/view or explicit selected runs and return plain data. Reuse the
shared observation index, grouping and uncertainty implementations. Follow
[STATISTICS.md](STATISTICS.md), stating whether inputs are raw, smoothed or clipped.
Add independent expected fixtures for missing metrics, singleton n and partial tails.
HTML templates consume results; they do not calculate statistics or group identities.

## Add a control or analysis panel

1. Add persistent defaults/validation to `core/view.mjs` using the [view contract](data-contract.md#view-v4); support existing saved artifacts through migration.
2. Add explicit-state templates in `web/ui/`, using `html.mjs` primitives and escaped source text. Shared analysis controls belong in `menus.mjs`; filters/catalogue remain in Runs.
3. Handle edits in `web/application/events.mjs`, normalize state and derive the active analysis in `web/analysis-state.mjs` when needed.
4. Mount/dispose controllers in `web/application/render.mjs`; preserve editor focus/scroll and use transient pointer previews until commit.
5. Update reporting when the panel changes export membership or meaning. Test the active mode, not a previously selected Charts metric.
6. Test imported modules; `tests/support/application.mjs` provides an isolated application but does not establish real browser appearance.

A new analysis section requires coordinated navigation, view normalization, rendering
and exports. Existing portable `tab`/`workspaceMode` compatibility is defined in the
view contract; it does not require another navigation menu.

## Add a top-level tool

Add launcher metadata in `web/ui/lab.mjs` and lifecycle routing in
`web/application/router.mjs`. Tool routes are separate from saved MagicPlot views.
Dispose controllers on exit and support launcher/placeholder routes without data.
Add the tool's feature inventory, writing rules and references under `docs/design/`.

## Change plot appearance or interactions

Use the [architecture file map](ARCHITECTURE.md#file-map) to locate style models,
editors, Plotly mapping and pointer controllers. Keep series identity, visibility,
order, physical dimensions and unit labels consistent across rendering and exports.
Per-metric edits invalidate that metric's saved zoom; source numeric values are
unchanged by display formatting. Public controls belong to
[MagicPlot design](design/MAGICPLOT.md), not this recipe.

For compiled previews, follow [PREVIEW.md](PREVIEW.md) and reuse the reporting
serializers. Preserve `displayMode` compatibility and dispose preview requests/URLs
on state changes. Never substitute an approximate SVG for compiled LaTeX.

## Add an export format

Put pure serialization/geometry in core, active-mode orchestration in reporting
and rasterization/download effects in `web/application/exports.mjs`. Inject rendering
callbacks instead of importing DOM/Plotly into core. Follow the
[export/reproduction contract](data-contract.md#session-and-reproduction) and
[statistical export invariants](STATISTICS.md#bands-and-summaries).

## Add a reader or endpoint

Generic readers belong in adapters; host-specific mappings follow
[ADAPTATION.md](ADAPTATION.md). Test raw-to-normalized values with small temporary fixtures.
For algorithm fields, extend the [validator contract](ALGORITHMS.md#version-2-format)
and template together, retaining provenance and escaping source text.

Place server behavior in `server/http.mjs` or a focused helper. Define explicit
method/path boundaries, avoid exposing host files and add integration tests.
Existing endpoint responsibilities are in [architecture](ARCHITECTURE.md#server-and-distribution).

## Finish

Update the document owning each changed rule rather than copying it into several
guides. Follow [verification.md](verification.md) for required checks and report
numerical, browser and exported-artifact evidence separately.
