# MagicLab design

This is the entry point for the portable design rules. Keep these guides, images
and examples with the dashboard. Installation or adaptation to another repository
does not authorize a restyle. Apply an explicit style request only to its scope.

## Reading order

| Guide                              | Responsibility                                                     | Reference content                                     |
| ---------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| This file                          | Shared frame, home, themes and controls                            | Original design images below                          |
| [MagicPlot](design/MAGICPLOT.md)   | Runs, charts, ablations and tables, with embedded screenshots      | [Run examples](../examples/magicplot/README.md)       |
| [MagicAlgo](design/MAGICALGO.md)   | Mathematical documents, graphs and help, with embedded screenshots | [Algorithm examples](../examples/magicalgo/README.md) |
| [MagicTuner](design/MAGICTUNER.md) | Current placeholder, implemented scope and writing style           | Shared frame only                                     |
| [Verification](verification.md)    | Automated and manual checks                                        | No additional style rules                             |

Written rules define the constraints, screenshots show geometry and hierarchy,
and CSS/style models define implemented values. Follow written rules when they
conflict with incidental image details, and report the inconsistency. Example
names, algorithms, metrics and values are content, not product requirements.
Data formats, statistics and implementation details belong in their own guides.
All maintained documentation, code comments and authored example content use English.

## Implemented MagicLab features

- Home launcher for MagicPlot, MagicAlgo and MagicTuner with availability/status labels.
- Direct hash links, browser back/forward navigation and return through the MagicLab brand.
- Shared themes: Dark, Light, Blue, Purple, Green, Amber and System, with persisted preference.
- Local operation, independent loading of run data and algorithm documents, and explicit bundled examples mode.
- Common loading, empty and error states, keyboard focus handling and tool lifecycle cleanup.

## Writing style

Use concise, technical English and sentence case for labels. Name actions with
concrete verbs and keep terminology consistent across tools. Home descriptions
explain what the tool helps the user do; status labels distinguish Available,
Prototype and Planned. Empty/error messages state the current condition and a
useful next action. Avoid promotional prose, unnecessary uppercase and implementation
details in working controls. Preserve source names and scientific units.

## Shared frame and home

Use a technical, utilitarian workstation aesthetic inspired by CAD software and
1990s workstations: contiguous panels, compact toolbars, rectangular controls,
monospaced text, petroleum gray surfaces and teal accents. The workspace dominates.
Prioritize usability, readability, quick access, compactness and then retro fidelity.

The home offers rectangular tool links with brief descriptions and textual status.
Its grid becomes one column on narrow screens. The compact header and MagicLab
brand are shared; the brand returns to the home. Placeholder-specific scope is
documented in [MagicTuner design](design/MAGICTUNER.md).

Implementation: [style.css](../web/style.css), [theme.mjs](../web/theme.mjs) and
[lab.mjs](../web/ui/lab.mjs).

## Layout and typography

Use a top bar for project/global actions, a left panel for navigation or tools
when needed, and a right panel for properties when useful. Keep the central area
flexible. Suggested initial widths are 200-240 px on the left and 260-320 px on
the right; tool-specific constraints take precedence. Support closing or resizing.
Use tabs for alternative views and collapsible advanced settings. Avoid duplicate
commands and modal dialogs for frequent operations.

Use a 4, 8, 12, 16, 24 px spacing scale. Desktop controls are 32-36 px high with
at least 8 px horizontal padding; touch targets are approximately 44 px.
When panels constrain the workspace, move them into the flow or collapsible
sections. Confine horizontal scrolling to tables and canvases.

Frame font: `ui-monospace, Consolas, monospace`, 14 px base, 15-16 px for extended
text, line height 1.4-1.5. Limit uppercase to short headings. Do not use pixel
fonts or reproduce unreadably small text from references. Scientific figures
and mathematical documents have their own fonts in the respective tool guides.

Use right angles, 1 px borders and uniform surfaces. Avoid gradients, blurred
glass, decorative shadows, pill buttons and ornamental animations. A subtle
functional button relief is allowed.

## Themes and shared tokens

Dark is the default. Light, Blue, Purple, Green, Amber and System preserve the
same geometry and hierarchy.
Theme applies before rendering and persists separately from the dataset.
Session/preset storage scope is defined in [data-contract.md](data-contract.md#session-and-reproduction).

Shared tokens live in [style.css](../web/style.css) and are reused by tool styles.

| Token       | Applied dark value |
| ----------- | ------------------ |
| `--bg`      | `#202628`          |
| `--panel`   | `#353D40`          |
| `--control` | `#414B4F`          |
| `--text`    | `#EDF1F2`          |
| `--muted`   | `#B8C5C9`          |
| `--accent`  | `#006B70`          |
| `--focus`   | `#62D7D7`          |
| `--border`  | `#A0AFB3`          |

The border is lighter than the original proposal to exceed 3:1 contrast against
hover surfaces. Additional tokens distinguish separators, hover, selection and
operational states. Apply color changes consistently across the frame.

## Interaction and accessibility

Hover slightly lightens surfaces. Selection has an accent and another indicator;
focus is visible and distinct. Provide immediate press feedback. Disabled controls
are recognizable and explain their state. Communicate success and errors with text
or icons as well as color. Name destructive actions and separate them from routine
commands. Show empty, loading, error and completion states explicitly; long tasks
show progress and cancellation when supported.

Menus preserve focus and close with Escape; temporary menus also close on outside
click. Preserve keyboard operation, pointer cancellation, focus/scroll restoration
and storage-failure reporting. No essential action depends only on hover.

## Original visual references

- [Original reference](design/reference/image1.png): structure and geometry; the overlaid face is not part of the design.
- [Design sketch](design/reference/image2.png): illustrative labels and panels, adapted to actual features.

Actual tool screenshots and their captions are embedded in the tool guides.
Their dimensions describe the image files, not verified viewport sizes. Some
are crops. They do not establish keyboard behavior, responsive correctness or
scientific validity. Home, MagicTuner, alternate themes and narrow screens have no
approved screenshots here; use the written rules without claiming visual checks.

For new captures, add the image and a caption to the relevant tool guide with
view, theme, dimensions and relevant details. Keep originals in `design/reference/`.
Consult [verification.md](verification.md) before reporting visual validation.
