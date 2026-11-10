# Chart controls

The chart editor follows the Forge/W&B interface inspected with REA on 9 November 2026. At wide desktop widths it places the preview to the left of the settings; below 1,400 px it places the preview above them. Data, Grouping, Display preferences and Expressions share an Apply/Cancel footer. Changes remain in the preview until Apply. Each panel stores its settings independently in this browser.

## Reading and navigating

- Hover or focus a panel to reveal its toolbar. The title and gear open its editor.
- The dot handle in the top-left corner moves a panel within its section; it also accepts arrow keys. Panel order persists with the workspace.
- The bottom-right corner resizes all workspace and run-detail charts together. Width snaps to equal columns, with one to six charts per row as space permits and a 240 px minimum width. Arrow keys resize; Home or a double-click restores the default two-column, 465 px layout for all charts. The workspace saves the shared dimensions; narrow screens use a single column.
- MagicTuner parameter graphs use the same shared column and height controls. Their dimensions are saved separately from MagicPlot, and narrow screens show one graph per row.
- Drag a rectangle in zoom mode to select X/Y bounds. A nearly horizontal or vertical drag changes only the corresponding axis.
- Pan mode moves the axes. Ctrl + scroll zooms around the pointer; ordinary scrolling moves the workspace.
- The plot can receive keyboard focus: `+`/`-` zoom, left/right arrows pan, and `0` resets. Double-click also resets the axes.
- When all curves are shown, click a legend entry to show only that curve. Once any curve is hidden, clicking a legend entry toggles only that curve. The toolbar's Show all button restores every curve. Hover/focus highlights a curve without recalculating chart geometry.
- In MagicTuner, trial selection is shared between Overview and Charts. Use the Overview table or points, the Charts trial picker, a chart legend, or a curve (a click selects; dragging still zooms or pans). With all study trials selected, a graph selection isolates that trial; otherwise it toggles it. Unselected trials remain visible and clickable at reduced opacity in both views. Selection keeps the axes unchanged. Restore all trials with Show all in a chart toolbar, All in the Overview table, or its plot background. Colors follow the full study's trial-number scale and stay stable when selection changes.
- Expand keeps the workspace sidebar and adds Workspace, Previous and Next controls. Charts opened from run details expand in a dialog.
- The panel menu exports the current chart as SVG or PNG, or exports the visible series and selected X interval as CSV.

## Settings

The workspace Panel settings drawer opens at the right with a fixed heading and independently scrolling controls. It controls shared columns, chart height and default smoothing strength, saved in the existing workspace preferences. Inputs update immediately while React defers chart layout and smoothing renders so slider interaction stays responsive. It can expand/collapse all metric sections and reset layout and smoothing to two columns, 465 px and zero smoothing. Narrow screens retain a single column. An explicit per-chart smoothing value takes precedence over the workspace default. Escape, the close button or clicking outside dismisses the drawer; keyboard focus stays inside while open and returns to its trigger on closing.

Data selects the title, X axis (step, relative time, wall time or a metric), X formatting, multiple Y metrics, individual automatic/manual axis bounds, log scales, maximum groups, outlier scaling, point sampling, smoothing and line/area/percent area plots. Zero in the maximum-groups field means all groups. Log scales omit nonpositive values. Percent area plots require nonnegative values and use a linear 0–100 Y axis.

Grouping uses the runs-table groups or individual runs. It supports mean, min/max and min–max, standard deviation, standard error or no uncertainty band. The underlying model also supports median aggregation for stored configurations.

Display preferences selects legend visibility, North/South/East/West position, font size, summary values, per-series colors and widths, label templates, tooltip behavior, grid, point markers and whether to connect missing observations. Templates support `${name}`, `${metric}`, `${x}`, `${mean}`, `${min}`, `${max}`, `${last}` and `${runs}`. Here `x`, `mean`, `min` and `max` describe the last available observation/group; summary-value controls can separately show the minimum/maximum across the whole curve.

Expressions add arithmetic curves and transform the X axis. Available variables include `x`, `y`, `_step`, `_runtime`, `${metric/name}` and numeric `${config:path}` values. The parser supports arithmetic, parentheses and the listed mathematical functions; it never executes JavaScript. Invalid expressions prevent Apply. Missing inputs and nonfinite results remain missing.

## Calculations

Observations align at exactly equal X values; there is no interpolation or zero filling. Aggregation uses the available finite observations at each X value. The sample variance uses `n - 1`; standard error is the sample standard deviation divided by `sqrt(n)`. Single observations have no uncertainty band. Bands describe original observations; smoothing transforms the aggregate line.

EMA uses the selected decay. Time weighted EMA adjusts decay by each X interval relative to the mean interval. Running average uses a trailing window derived from strength; Gaussian uses a symmetric, truncated Gaussian kernel. These are defined local implementations: REA established the reference's controls, not a byte-for-byte identity with its calculation engine.

Full fidelity retains every aligned observation. Random sampling uses a seeded reservoir with at most 1,000 rows and preserves the endpoints. The optional outlier setting trims the lowest/highest 0.5% only when calculating automatic Y bounds; it does not delete observations or change exports.
