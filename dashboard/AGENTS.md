# Dashboard coding-agent instructions

## Primary rule: minimum added entropy

This directory is a portable personal dashboard for ML researchers, including researchers extending it through another coding agent. For every change, implement only the requested behavior with the least additional structure, code, logic, styling, and configuration. Find and name the closest existing implementation before editing. Prefer existing data records and shared components over a new abstraction; extend the existing owner when needed. New dependencies, controls, settings, layers, and special cases need a concrete requirement that the existing code cannot meet. Explicit user instructions may justify a departure; explain it and keep it scoped. Do not perform unrelated cleanup or rewrite existing user work.

Use [docs/ADOPTION.md](docs/ADOPTION.md) for installation and customization. Keep runtime, installation, documentation, and verification usable from this directory without the parent repository, its optional REA tools, or machine-specific paths. Keep the lockfile and license with the source.

Before completion, perform the acceptance, reuse, screenshot, and self-critique loop in [docs/CHANGE_WORKFLOW.md](docs/CHANGE_WORKFLOW.md). Inspect actual images with an image-viewing tool, compare the closest peer, remove unnecessary differences, and repeat affected checks after fixes. Record concrete evidence using that guide's review template. Unavailable checks remain explicitly unverified; never substitute a passing build or an unchecked checklist for observed correctness.

Keep the same style and reuse the code if there is no reason to have it different. Treat this as the default for every UI and code change across MagicPlot, MagicAlgo, and MagicTuner. Check for an existing component, token, layout, or behavior before creating a section-specific version. A difference needs a concrete reason in the data, interaction, accessibility, or an explicit user request. When a common pattern changes, update its shared source and check each section that uses it.

## Required map and process

Read `docs/ARCHITECTURE.md` to locate the owner of a change, `docs/STYLE_GUIDE.md` for visual and interaction rules, and `docs/CHANGE_WORKFLOW.md` for the implementation, checking, and iteration loop. For source or metric changes also read `docs/DATA_ADAPTER.md`; for plots and calculations read `docs/CHARTS.md`; for mathematical algorithms read `docs/ALGORITHM_STYLE.md`. Confirm the guides against current code and update them when a feature changes the map or behavior.

Preserve synthetic-data provenance, the adapter boundary, exact algorithm/version identity, missing metric values, and existing saved browser state. Keep real experiment logs, credentials, reference captures, and generated outputs outside committed source. A failed real data source must surface an error rather than silently showing sample data.

## Priority dashboard consistency rule

Keep MagicPlot, MagicAlgo, and MagicTuner selection sections as similar as their data allows. Use the shared `ViewHeader`, `FilterToggle`/`FilterBoard`, `SelectionTable`, `useFilterReorder`, and `FilterColumnHeader` for selection pages. Match spacing, colors, table headers and rows, pagination, toolbar controls, filter defaults, how option counts are displayed, drag highlights, keyboard reordering, responsive behavior, and theme styling across sections. Values, counts, and defaults may differ when the data or task requires it. Extend shared components when a common pattern changes; avoid section-specific copies of the same layout or interaction logic. Check all three sections in desktop and mobile visual verification after changing a shared pattern.

For MagicAlgo and MagicTuner selection tables, use the shared `SelectionRadio` and selection row styles. The item name is plain text. Clicking a row or radio selects it; the section navigation opens its detail view.

Across all three selection pages, enabling filters makes table columns follow the displayed filters in their chosen order, alongside the selection control and an identity column when needed. Disabling filters restores the section's ordinary information columns. Clearing filters removes their columns. Keep the selected item within the visible filtered set when results remain.

Use `SidebarHeading` and `SidebarListHeader` for MagicPlot, MagicAlgo, and MagicTuner detail sidebars. Keep their widths, heading rhythm, list headers, row selection states, and mobile treatment aligned through shared CSS. Use section-specific controls and row content only where the underlying task calls for them.

Reuse the typed `Formulation` records in `lib/algorithms/formulations.ts` and the shared `AlgorithmDocument` renderer in `components/dashboard/algorithm-document.tsx` for every current and future algorithm. Do not create algorithm-specific layout, JSX, or CSS for the shared caption, input/output, pseudocode, notes, and notation elements. If a new element is needed, extend the shared interface and renderer.

Every new algorithm must supply brief meanings for its variables in `Formulation.symbols` so the shared renderer can show an immediate description on mouse hover and an accessible focus or touch path. Indicate hoverability with the cursor and hover state, without a persistent underline. Check the input, output, and every pseudocode line for symbols without a description; add algorithm-specific meanings to the formulation and extend the shared elementary-symbol fallback only when the meaning is universal.

Follow `docs/ALGORITHM_STYLE.md` for mathematical notation and editorial standards. Match each formulation to an exact algorithm/version key and verify it against the implementation before claiming it describes executed training behavior.

## Completion rule

MagicData follows the same minimum-entropy rule: reuse the selection frame, `SelectionRadio`, `Pagination`, headers and sidebar controls. Its dataset parsing and browser storage are separate from experiment data; do not add experiment filters merely to imitate another section. Include all four sections when checking a shared visual or navigation change.

Follow `docs/CHANGE_WORKFLOW.md` until the requested behavior and relevant states are observable, the applicable tests/typecheck/lint/build checks pass, and the rendered result meets `docs/STYLE_GUIDE.md`. After any dashboard UI change, run the loop in `docs/VISUAL_VERIFICATION.md`: exercise the changed action, inspect the saved screenshots with an image-viewing tool, fix visible problems, and rerun the affected desktop and mobile views. Extend the capture script when it misses the changed path. A passing script report or build alone does not establish visual correctness. Report the checks actually run and any state left unverified.
