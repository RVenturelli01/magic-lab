# Visual verification for dashboard changes

The next coding agent should inspect the rendered dashboard after UI changes. Typecheck, unit tests, and a successful build do not establish that spacing, mathematical notation, scrolling, or controls look right.
Use [CHANGE_WORKFLOW.md](CHANGE_WORKFLOW.md) to connect this capture loop to the requested behavior, code checks, and completion report. The local screenshots show MagicLab; REA reference observations are separate evidence about an external application.

## Repeatable local loop

1. Start the dashboard from its own directory in one terminal:

   ```sh
   npm run dev -- --host 127.0.0.1
   ```

2. In another terminal in the same directory, install Chromium once (skip this if Chrome is already installed), then capture:

   ```sh
   npm run visual:install
   npm run visual:check
   ```

   The script imports `playwright-core` from the dashboard's own dependencies, with no REA requirement. It uses the downloaded Chromium or finds Chrome in common Windows, macOS and Linux locations. Set `CHROME_PATH` to select a specific executable; an invalid explicit path is an error. For Linux browser libraries see [ADOPTION.md](ADOPTION.md). The script opens an isolated headless browser, navigates the three MagicLab sections, and saves desktop and mobile screenshots plus `report.json` in a new `outputs/visual-check/<run-id>/` directory inside the dashboard. This directory is ignored by Git. Set `DASHBOARD_URL` or `DASHBOARD_VISUAL_OUTPUT` if the defaults do not fit the machine. In the original Windows checkout, `./start-dashboard.ps1` and `./start-dashboard.ps1 visual` remain convenient wrappers. If tooling is unavailable, perform the same targeted interaction and viewport checks with an available browser, inspect captures, and report what remains unverified.

3. Open the relevant PNG files with an image-viewing tool. Compare the affected view with its baseline and closest peer using equivalent viewport, theme and state. Check the requested change, visible math, clipping, line wrapping, hierarchy, mobile layout, and interaction states. Record the image paths and concrete observations in the [change review](CHANGE_WORKFLOW.md#6-report-the-result). The report's `passed: true` means navigation and DOM checks passed without page errors; it is not a visual approval. Automated screenshots cannot establish that the code was reused correctly; also inspect the diff and its shared owners.
4. Fix what the images reveal and run the same command again. Compare the new run with the previous screenshots. Continue until the requested views and interactions are visually sound. Add new capture steps in `scripts/visual-check.mjs` when a change affects a view the script does not yet cover.

Current captures include MagicPlot Runs, Tables, and Workspace, MagicTuner selection, overview, and charts, MagicAlgo selection, A2C/PPO/SAC algorithm tops and notation sections, and PPO with notes at 1440 × 900. The selection views include theme and filter interactions; the script checks counts, reordering, and table highlights. MagicTuner trial captures check column sorting in both directions, pagination after sorting, and sorted desktop and mobile views. It also captures representative views at 390 × 844. Read each run's `report.json` for its exact captures. The script uses the sample dataset and does not log into a hosted service.

For detail-sidebar changes, run `node scripts/sidebar-check.mjs` against the same preview. It checks close and keyboard reopen, the retained rail and arrow bounds, across all four sections (including tuner overview and charts), desktop/mobile and light/dark themes. Open its captures in `outputs/sidebar-check/` for visual review.

## REA MCP tools

The MagicAlgo path also exercises comparison from the selection table by keyboard
and from the sidebar, checks restore after reload and closing, reversed comparisons,
notes alignment, PPO inserted-line gaps, and SAC adaptive-temperature formulas.
Comparison captures cover desktop light/dark/high-contrast and both sides of the
horizontally scrollable mobile document.

The exact input schemas for the dashboard-relevant REA 6.8.0 tools are exported in [REA_TOOLS.json](REA_TOOLS.json). Refresh that file after an REA upgrade with `scripts/export-rea-tools.mjs` using the repository's Node 24 runtime. The export only runs MCP `initialize` and `tools/list`; it does not open a browser.

| MCP tool                                | Use it when                                                                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `mcp__rea__list_browser_targets`        | Select the exact HTTP(S) page in a Chrome instance exposing a loopback CDP endpoint.                                                            |
| `mcp__rea__inspect_web_page`            | Read the current DOM, accessibility tree, resources, and attach-window console metadata without acting on the page.                             |
| `mcp__rea__capture_web_screenshot`      | Capture pixels from the selected existing tab after navigation has settled. It does not scroll or click.                                        |
| `mcp__rea__capture_browser_scenario`    | Reproduce a controlled sequence of navigation, clicks, form actions, and waits; request screenshots and DOM/accessibility snapshots explicitly. |
| `mcp__rea__observe_web_session`         | Record evidence while the user performs interactions in their own browser.                                                                      |
| `mcp__rea__compare_web_screenshots`     | Compare two REA screenshots at compatible viewports after a layout change.                                                                      |
| `mcp__rea__compare_web_captures`        | Compare two REA page captures or scenarios for DOM, state, and behavior changes.                                                                |
| `mcp__rea__inspect_web_event_listeners` | Investigate a UI control whose event handler seems absent or incorrect.                                                                         |
| `mcp__rea__observe_web_execution`       | Measure which JavaScript ran while reproducing a runtime problem.                                                                               |
| `mcp__rea__inspect_web_network_capture` | Inspect a saved HAR or other supported capture for API/data-loading failures.                                                                   |
| `mcp__rea__inspect_analysis_view`       | Read selected pages of retained REA evidence without recapturing the site.                                                                      |
| `mcp__rea__analyze_web_bundle`          | Inspect a shipped web bundle when its source code is unavailable; ordinary dashboard source work should use repository tools.                   |

For an existing Chrome tab, start `tooling/rea/start-browser.ps1 -Url http://127.0.0.1:5173` from the repository root, select the returned `http://127.0.0.1:9222` target with `list_browser_targets`, then use passive tools or a declared scenario. A scenario's connect mode navigates the selected tab to its start URL and may discard unsaved form state. REA scenarios need explicit timeouts for waits; a stalled or incomplete capture is not evidence of a successful visual check.

For normal local iteration, use `visual-check.mjs` first. It completed the MagicAlgo desktop/mobile path in this workspace where a REA controlled-navigation call stalled. REA remains useful for observing a user-owned or hosted reference browser and for recording comparison evidence.
