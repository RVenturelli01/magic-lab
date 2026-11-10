# Dashboard style guide

Use this guide when adding or changing any visible dashboard feature. The current shared components and `app/globals.css` are the implementation source of truth; this guide describes the intended relationships so an agent can extend them consistently. Follow [CHANGE_WORKFLOW.md](CHANGE_WORKFLOW.md) to verify the result.

## Visual language

MagicLab uses compact research-workspace layouts: a global header and navigation rail, clear section heading, restrained surfaces, thin borders, and dense but readable data. The locally served **Source Sans 3** is the main UI font. Use the existing control size, type hierarchy, spacing, border radius, and icon treatment nearest to the new feature. Prefer a shared rule over a slightly different value in each section. Keep numerical columns aligned and easy to scan.

The theme palettes live near the end of `app/globals.css` under `:root[data-theme=...]`: `light`, `dark`, `light-modern`, `dark-modern`, and `high-contrast`. Shared semantic colors include `--theme-bg`, `--theme-surface`, `--theme-soft`, `--theme-header`, `--theme-text`, `--theme-muted`, `--theme-hover`, `--theme-accent`, and `--line`. Use these for new surfaces, text, borders, hover, and selected states. Check every theme after changing a shared color; a hardcoded light color can make a dark view unreadable. Keep the selected state visible without relying on color alone.

## Reuse before adding

Minimize visual entropy: each extra label, badge, control, surface, spacing variant and state must serve the requested task. Use the nearest existing pattern as the default, including its logic and accessibility. Do not add decorative explanations, configuration panels, custom card styles or section-specific overrides merely to make a feature appear new. An explicit user instruction can justify a deliberate difference; keep it scoped and record it in the change review.

| Need                                                             | Start from                                                                  |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Section heading and toolbar                                      | `ViewHeader`                                                                |
| Selection frame, scrolling, and pagination                       | `SelectionTable`, `Pagination`                                              |
| Facets, filter state, column headings, drag and keyboard reorder | `FilterToggle`, `FilterBoard`, `FilterColumnHeader`, `useFilterReorder`     |
| Single-choice algorithm, study or dataset row                    | `SelectionRadio` and existing selection row styles                          |
| Detail sidebar heading and list heading                          | `SidebarHeading`, `SidebarListHeader`                                       |
| Icon-only control                                                | `IconButton` with a specific label                                          |
| Plot, editor, layout, and calculations                           | `MetricChart`, `chart-settings.tsx`, `lib/data/chart-model.ts`, `CHARTS.md` |
| Mathematical algorithm document                                  | `Formulation` plus `AlgorithmDocument`, following `ALGORITHM_STYLE.md`      |

Use the same layout and interaction for the same task in MagicPlot, MagicAlgo, and MagicTuner. The actual option values and counts may differ with the data; their presentation should match. A section-specific variation should follow a concrete difference in data, action, accessibility, or the user's request. Document a new shared pattern here and update all affected uses rather than copying its JSX or CSS.

## Interaction states

Use `Pagination` for page counts and previous/next controls inside the existing table or sidebar pagination frame. Keep the page size appropriate to its data while reusing count, disabled-state and navigation behavior.

For each new control or row, define its default, hover, focus, active/selected, disabled, loading, empty, and error states where relevant. Show selection with text, icon, border, or structure as well as color. Use semantic buttons, inputs, tables, and headings; label icon controls and preserve visible focus. A drag action needs a keyboard path when the same result matters to the user. Tooltip-only explanations also need a usable focus or touch path. Keep labels and counts truthful to the filtered data and avoid controls that appear to work but have no action.

Filters should preserve selection when their board is closed. The selected values, displayed columns, option counts, table highlights, and reset behavior must remain consistent. Chart settings should preview changes until Apply; Cancel must leave the applied chart unchanged. If a control changes saved state, check reload behavior and the previous storage shape.

Detail sidebars retain a narrow rail with the shared `CollapsedSidebar` arrow control when closed. Keep the reopen control in this rail, aligned with `SidebarHeading`, across all sections and viewport sizes.

MagicPlot metric section headings use the theme text color and a thin bottom separator. Their six-dot handles reuse `useFilterReorder` and `filter-drag-handle` for drag swaps and arrow-key reordering. Swaps preserve panel order within each section and persist through the existing workspace panel preferences.

## Responsive layout

The existing CSS adapts navigation, tables, sidebars, chart grids, and editors at several breakpoints. The chart editor stacks its preview and settings below 1,400 px; many mobile adjustments occur near 720 px. Extend the closest rule rather than inventing a separate mobile copy. At narrow widths, preserve the primary action, readable labels, scroll access to wide data, and a way back from detail views. Check both 1440 × 900 desktop and 390 × 844 mobile, then any intermediate width affected by the change. Verify light and dark; check high contrast when colors, focus, or selection styling changes.

## CSS and content discipline

Edit the existing component and nearby CSS section when possible. If several selectors express one shared pattern, consolidate the rule rather than adding a later override with greater specificity. Keep theme overrides near the relevant shared theme rules. Do not use `!important` to compensate for an unexplained cascade conflict. Use existing icons and wording conventions; short, concrete labels are easier to scan than decorative copy.

Sample data and reference screenshots are visual aids, not facts about executed algorithms or a hosted service. Keep the sample badge and any reference-formulation label visible when the underlying data is synthetic or illustrative. Protect private reference captures and real experiment data in ignored local storage.

## Style acceptance check

Compare the changed screen with its closest existing peer. Inspect alignment, spacing, type hierarchy, borders, row height, selected state, focus, overflow, scrolling, and control wording. Repeat in desktop and mobile, light and dark, and the changed interaction states. For a shared pattern, inspect all three sections. A passing build or screenshot script does not establish visual quality; open the saved images and fix visible defects before declaring completion.
