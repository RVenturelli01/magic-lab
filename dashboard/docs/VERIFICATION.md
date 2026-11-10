# Reference and verification

Reference inspected on 2026-11-08: the user-provided CoreWeave Forge W&B project workspace and Runs view. REA used a dedicated, user-authenticated Chrome session. Inspection and navigation did not edit the hosted project.

## Observed design

Source Sans 3 was confirmed from a public font resource in the page DOM. At the matched 1295 x 837 captured viewport, the reference has an approximately 80 px global header and navigation rail, 70 px workspace header, 510 px run sidebar, 55 px rows, and two bordered chart panels with 20 px gaps. These are screenshot dimensions; Windows display scaling means CSS dimensions differ.

The local implementation reproduces these boundaries, pale gray/white surfaces, blue controls, grouped run rows, chart sections and typography. Reference training values were not copied. Synthetic metric curves, local account labels and some icons/menus intentionally differ. The second reference panel combines metrics; the local default displays reward and episode length separately.

## Evidence ledger

| Evidence                                                              | Observation                                                                                                                                                                            |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ev_e6ee85a6ca2e07a1e85890e007a2232b1b660c934bc0f4be00bfa44758b600b8` | Initial authenticated reference screenshot, 1295 x 837                                                                                                                                 |
| `ev_0a9b38696838ae64887244fd98feb0c864eb03d9bfd888d59d4b24d7c438362f` | Passive DOM/accessibility/resource inspection                                                                                                                                          |
| `ev_1aca3ae66853c2a81c23d1f7fdfb0e3d02bac42f7c7db2cb7e2d09062ab02f1d` | Reference Runs table navigation and capture                                                                                                                                            |
| `ev_9169bbae312fa27f0d565dd98f9c43e07a56f5bcefdc8500b2c79348613e44d9` | First completed local viewport comparison; revealed scale mismatch                                                                                                                     |
| `ev_f41ae7e22565189d7aa2310f456565f0b7212fff3c8b2db694414767484a42fd` | Local comparison after layout scaling corrections                                                                                                                                      |
| `ev_768773e2673ef4beca227f084d6675b6292d02b4880068277d40aebc3fd63a74` | Passive local screenshot at the measured 1295 x 837 viewport                                                                                                                           |
| `ev_77bac07467d95482bfc2c95214c59495cc36ed357381564832ae738bd849f06e` | Search, unique group result, expand group, open run, inspect config, close, navigate to table: all steps passed; no browser errors/warnings                                            |
| `ev_b6fc96ce1d8c3ed9deed91bb8a45c1f08734899210fcdb7a036e407788a16402` | Running filter, hide/show curves and empty state, clear filters, metric search, chart expand/restore, smoothing, add accuracy panel: all 24 actions passed; no browser errors/warnings |
| `ev_d50585b8698a351c869190cf577a4ea6031267f20d100fa6d5d1ef3171ac3978` | Added panel persisted across reload; default panels and smoothing restored through UI                                                                                                  |
| `ev_e8a3adc8f35e97c7a936c2693c83216e46a6e66f7489a3289ed9659746b81933` | Final workspace screenshot, measured 1295 x 837                                                                                                                                        |
| `ev_acc75a5d0891356ce2aa5692e5e5ac877ff3f2087bbc6955328be783a2375aa1` | Final grouped table screenshot, measured 1295 x 837                                                                                                                                    |

These captures were reviewed visually; there is no claim of pixel-perfect or exhaustive feature parity. Screenshots and complete reference HTML stay in ignored local evidence storage, because they may contain private project information.

## Browser tooling diagnosis

Passive REA capture worked after login. `capture_browser_scenario` initially returned a generic provider `execution_failure`. The actual cause was its default service-worker blocking policy: a reference frame rejected `navigator.serviceWorker.getRegistrations()` with `InvalidStateError`. Setting `environment.service_workers` to `allow` made the scenario succeed. No browser permission expansion or repeated login was needed.

REA attached-mode screenshots can include blank margins or briefly resize responsive charts under Windows display scaling. For reliable visual comparison, navigate both pages in the same browser window and use `capture_web_screenshot` after the scenario completes. Check its reported viewport, rather than assuming requested emulation dimensions equal the final screenshot. A requested 1440 x 900 scenario returned to the native 1295 x 837 viewport after cleanup, so it is not counted as a second verified size. After each scenario, REA disconnects and restores emulation; it leaves the user-owned browser open.

## Limits

Final checks passed: production build, strict TypeScript check, ESLint on authored application/data code, Prettier check, and all six adapter tests. Browser scenarios reported no page errors or console warnings after the chart sizing fix. The production builder emits a Vinext route-classification notice; it does not prevent a successful build.

Passive reference inspection was origin-filtered and attach-limited. No network response bodies, credentials or private training files were imported. Desktop workspace and table received the principal visual comparison; narrower layouts are responsive adaptations, not a verified mobile replica of W&B.

## Chart refinement — 9 November 2026

REA reconnected to the same reference after the user renewed its login. The reference editor's Data, Grouping, Display preferences and Expressions tabs, smoothing options, panel menu and focused-chart view were inspected. Preview changes were cancelled on the reference. Complete evidence is retained in ignored `tooling/rea/local/chart-refinement-2026-11-09.json`.

The visual comparison used a measured 1920 × 911 reference viewport and the same dimensions locally. It corrected card dimensions and spacing, the legend above the plot, plain numeric Y ticks, right-aligned X labels, controls shown on hover/focus, and the wide editor's 60.8% preview / 39.2% settings layout with its shared footer. Local editor layouts were additionally checked at 1295 × 911 and 390 × 844. The earlier user-requested larger small text and single row-hover background are retained. Curves, group names and account/source labels still describe the local sample.

| Evidence                                                              | Verified observation                                                                                                                                                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ev_38da12ddc0b7ea3c722da9437a6f12b302204547935d6ff7724bf405fad0fce8` | Native reference workspace, measured 1920 × 911                                                                                                                                                                          |
| `ev_0f390be55e48dc4c8399a65da7d4a2539a99173b2d671e6379a27df8a651188d` | Native reference Data editor at that viewport                                                                                                                                                                            |
| `ev_5ac6dd8f920a7d29a438da1a13fba6ec47ab8e1e8cdc145bb18c6a55f399ba24` | Reference Grouping and Display preferences screenshots; Cancel completed                                                                                                                                                 |
| `ev_c6b47f5d76de71f336414e49b348f09a62e50836bd51e43b8292aa2e3ee1900b` | Zoom, pan, reset, hide/isolate/show curves, expansion, next/previous and return to workspace                                                                                                                             |
| `ev_a7aa8dc61ecd89f07d9a71b620fd0eeac83151811e5bf75ae29895cfa57e703f` | 47 completed scenario steps: axis bounds/log scale, smoothing, multiple metrics, grouped ranges, legend preferences, valid/invalid expressions, Apply, persistence after reload, Cancel, export generation and expansion |
| `ev_d731949521f1545b22962861be4c8c8c2efd59a999f2e5c5ebe86e2323251c60` | Final desktop editor, Grouping selection and return to Data                                                                                                                                                              |
| `ev_97cecbfa30ef9c3799c92fae8b5b461b4a1f8706b7571e7f3ed896375a0a444d` | Editor at 1295 px; controls and footer remained usable                                                                                                                                                                   |
| `ev_40341e21bcf8de4c01ca3ec0632d4cd39f66a0a400e0b42119470288ce17d393` | Editor at 390 px; controls and footer remained usable                                                                                                                                                                    |

These successful scenarios recorded no page errors or console warnings. CSV, SVG and PNG generation reached the browser's download action; REA intentionally cancelled the three file transfers, so saved downloads are not claimed. Its current scenario action vocabulary does not record pointer dragging or wheel gestures: those transformations are covered by calculation tests, while zoom/pan/reset buttons and keyboard focus were exercised in the browser.

Sixteen automated tests, strict TypeScript, authored-code ESLint and formatting checks pass. A production build also passed in an isolated staging directory, preserving the running development preview. Vinext emitted its existing route-classification notice and plugin-timing advisories.

### Panel handles

The top-left dot handle now reorders panels in their section, and the bottom-right corner changes width and height. Geometry is stored separately from the chart's statistical settings. REA scenario `ev_6fa4907307fbd732cf550dd702ebeca15c0b579e782ea7b7e46cb2d72ac09bba` completed 20 steps covering grow/shrink, saved dimensions after reload, reordering and saved order, expansion/restore and default-size reset, with no page errors or console warnings. These scenario actions exercised the keyboard equivalents; pointer resizing calculations also have boundary tests. All 18 automated tests pass.

### Shared chart size and filter columns

Shared workspace dimensions supersede the independent panel dimensions described above. Resizing any workspace or run-detail chart changes every chart to the same height and column width, with up to six equal columns and a responsive 240 px minimum width. Home or double-click resets all charts. Chart settings and panel ordering remain independent of these shared dimensions.

REA scenario `ev_f067fbb02464adf54738b66904f11b5fde5151ed182cef911cad09b06b11f0c1` completed all 18 actions at 1920 × 911: resize from several different charts, two/three-column changes, shared height changes and persistence after reload. Scenario `ev_39119141ad940703545cd2a91e40504b25b0891a2bdbe67e189e1605918adee4` completed seven actions at 390 × 844 for shared height and global reset. Neither reported page errors; the desktop development capture recorded resource-response errors, while the mobile capture had no console errors. Pointer calculations have boundary tests; the scenarios used keyboard equivalents.

REA scenario `ev_c841bde51876b9262625088a99bd77912c63044e19346eb9b2913da5b5db6b03` completed 24 actions with no page errors. With Filter on and no values selected, table headers were Name, Tags, Group, Learning rate and Optimizer. Selecting Adam reduced the runs from 60 to 45. Switching Filter off restored State, Tags, Created, reward and Runtime while retaining the 45-run selection. Reopening restored the filter columns and selected value; resetting a value kept its column, removing Group removed its column, and re-adding it placed it last.

All 19 automated tests, TypeScript and authored-code ESLint pass. Evidence is retained in ignored `tooling/rea/local/uniform-layout-filters-2026-11-09.json`.

## Portable adoption and agent workflow — 2026-11-09

Installed 168 source files into a separate research-repository directory with `scripts/install-into.mjs`, then ran a fresh `npm ci`, `npm run check` (31 tests, TypeScript and lint), and `npm run build` there. All passed on Windows with Node 24.18.0 and npm 11.16.0. The installer tests cover dry-run without writes, repeat installation from a transferred copy, required runtime/docs/license files, local-state exclusion, existing-destination preservation, nested-destination refusal and source junction rejection. Negative ESLint probes also confirmed that a dashboard sample-source import and a React import in a data module are rejected.

Ran the copied dashboard on port 5174 and its own `npm run visual:check`, using installed Chrome and the dashboard-local Playwright dependency, without parent REA tooling. The report contains 91 captures, `passed: true`, no page errors and no console errors. Local evidence: `outputs/adoption-visual-check/2026-11-09T22-54-20-627Z/report.json`. Ten PNGs were opened with an image viewer: the three desktop selection views, MagicAlgo and MagicTuner mobile selections, MagicPlot dark mobile selection, MagicAlgo and MagicTuner dark desktop selections, the PPO mobile document and MagicPlot mobile workspace. Shared headings, table rows, selection controls and theme styling remained readable; wide mobile study tables retain their existing horizontal scrolling. This is representative image review, not a claim that every captured pixel or feature was inspected.

Reuse/self-critique: extended the existing agent guides, ESLint config, startup wrapper and capture script. The only new development dependency is the same pinned `playwright-core` version already used by the optional tooling, now owned by the transferable dashboard. The installer is source-copy only; it introduces no plugin registry, configuration framework, automatic updater or visual pattern. Review identified an unchecked symlink parent for the explicitly copied hosting file; preflight now checks that parent too, and tooling tests and the transferred installation were rerun successfully. No UI source or styles were changed by this adoption work.

Limits: Linux/macOS execution and real-data integrations were not tested. `visual:install` was checked with `--dry-run`; the browser download was not needed for this Chrome-based run. Production build warnings include a large client chunk and Vinext route-classification/plugin-timing advisories. Development logs also contain Recharts container-size warnings during transitions; the report records errors, not warnings. These observations do not establish unbounded dataset scalability. Detailed local review: `outputs/adoption-change-review.md`.

## Consistency and performance review — 2026-11-10

Reviewed the active dashboard and its transfer/install path against the minimum-entropy rule. Removed 67 unused UI/template files, 18 direct dependencies and 129 package-lock entries. Fresh installation on Windows went from 686 to 557 installed packages. Configuration access, numeric reductions, table models/validation, downloads, table exports and pagination now have shared owners documented in ARCHITECTURE.md. Lightweight selections remain eager; charts, mathematical documents and expensive views load when opened. No chart sampling or statistical precision setting was reduced.

The isolated installed copy passes 44 unit/tooling tests, TypeScript, warning-free ESLint and the production build. Changed-file Prettier checks and git diff whitespace checks pass. The final application source (app, components, lib) matched that production copy. The build retains Vinext's route-classification/plugin-timing notices.

The main browser report passes with 104 captures, no page errors and no console errors: `outputs/code-review-20261110/visual-final/2026-11-09T23-49-58-682Z/report.json`. MagicData import, invalid input, search, pagination, export, reload and removal checks also pass, as do sidebar close/reopen checks across all four sections in desktop/mobile and light/dark. A controlled delayed/failed chart download verified loading, error, continued navigation and Reload recovery. That intentionally failed download is separate from the clean normal-flow report.

Representative images were opened: selection peers in all four sections, light/dark desktop/mobile, charts, ablations, tables, mathematical documents, dataset viewers, high contrast, chart editor, panel settings and loading/error states. Review found a legacy MagicPlot row-height override; removing it leaves all four selection lists at the shared 50 px height. It also found temporary loading-grid misplacement, corrected at the shared style boundary. The capture script now waits for lazy views and the preview SVG's resized geometry, so mobile screenshots no longer show a stale desktop chart over the editor controls. Apply/Cancel, saved settings after reload, exports and reorder paths pass. See the ignored `outputs/code-review-20261110/change-review.md` for the reuse and iteration record.

Production measurements used Chrome on Windows, 1440 × 900, five fresh contexts and 4× CPU slowdown, with builds/checks stopped. Resource bytes below are decoded, before compression; calculation timings are medians of five warm Node samples. Baseline and final reports are `outputs/code-review-20261110/performance-baseline-final.json` and `performance-release.json` in the same directory.

| Measurement                                 |      Before |     After |
| ------------------------------------------- | ----------: | --------: |
| Initial JavaScript                          | 1,198,738 B | 492,812 B |
| Initial CSS                                 |   208,363 B |  96,360 B |
| Four configuration lookups over 10,000 runs |    167.8 ms |   30.1 ms |
| Sample chart model                          |     5.28 ms |   4.81 ms |
| Initial selection ready                     |    1,503 ms |  1,431 ms |
| First workspace navigation                  |    2,544 ms |  2,217 ms |
| First algorithm selection navigation        |      382 ms |    360 ms |
| First study selection navigation            |      133 ms |    133 ms |
| First study overview navigation             |    1,300 ms |  1,934 ms |

The initial client is about 59% smaller in JavaScript and 54% in CSS. Cold study-overview navigation is slower because its renderer is deferred; this is not a claim that every interaction became faster. Repeated runs varied with machine load. Current measurements include concurrent dataset, algorithm-comparison, sidebar and workspace-setting additions preserved during this review. Run catalogs and histories still load in bounded batches into memory. Large real datasets, remote adapters, memory ceilings and Linux/macOS execution remain unmeasured; no unbounded-scalability claim is made.
