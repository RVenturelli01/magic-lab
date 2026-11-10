# Install and personalize MagicLab

MagicLab is a personal ML research workspace that lives in its own directory inside your research repository. Its source, lockfile, agent instructions, documentation, tests, fonts and license travel together. Node.js 24 and npm are sufficient to install and run it; a browser is additionally needed for visual verification. No REA installation, account, API token, Python environment, or training job is required. The initial dataset is explicitly synthetic.

## Install in your repository

Download or clone MagicLab, then run these commands from its `dashboard/` directory. Replace the example destination with a **new** directory directly inside your existing research repository. Quote paths containing spaces. The commands work in PowerShell and POSIX shells.

```sh
node scripts/install-into.mjs /path/to/research-repo/dashboard --dry-run
node scripts/install-into.mjs /path/to/research-repo/dashboard
cd /path/to/research-repo/dashboard
npm ci
npm run dev -- --host 127.0.0.1
```

On Windows a destination can be `"C:/Research/my-project/dashboard"`. Open <http://127.0.0.1:5173>; keep the terminal running and stop it with Ctrl+C. If the port is occupied, append `--port 5174` and use the URL printed by the server. Keep this as an independent npm package; do not merge its dependencies or tooling into your training environment.

The installer needs only Node, even before `npm ci`. It previews or copies an explicit source allowlist, refuses existing destinations (including empty directories), and rejects source symlinks. It excludes dependencies, builds, local profiles, environment files and generated captures. It does not edit the host repository, install packages, or launch services. Inspect the dry run when distributing a customized copy: source code and documentation can themselves contain private material. Store research logs and credentials outside source directories. Keep the included MIT license and third-party notices.

Open your coding agent in the installed directory. If it normally starts at the research repository root, add this routing sentence to that repository's existing `AGENTS.md`, preserving its other instructions:

> For dashboard work, read `dashboard/AGENTS.md` first and follow its linked workflow. Keep changes scoped to the dashboard unless the task explicitly requires integration elsewhere.

The installer never overwrites the host's agent instructions. Adjust that route if you chose a different directory name. There is no automatic updater: install a newer source into a separate directory, review its diff against your customized copy, and apply only the intended changes with the same verification loop.

## Personalize at the existing boundary

Start with [ARCHITECTURE.md](ARCHITECTURE.md) for ownership and [STYLE_GUIDE.md](STYLE_GUIDE.md) for the shared component inventory. Keep customization in ordinary typed source; add configuration or an extension framework only when a real requirement needs it.

| Research need                                           | Smallest existing extension point                                                                                                                                                   |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real runs, project name, metric catalog, tuning studies | Implement `DashboardDataAdapter` and select it in `lib/data/index.ts`; follow [DATA_ADAPTER.md](DATA_ADAPTER.md). Keep private file access and credentials on the server.           |
| A new metric or experiment parameter                    | Supply it through the adapter's metadata and records; reuse filtering, chart and table components.                                                                                  |
| An algorithm/version description                        | Add a typed `Formulation` record for the exact version; use `AlgorithmDocument` and [ALGORITHM_STYLE.md](ALGORITHM_STYLE.md).                                                       |
| A chart calculation or analysis                         | Extend the relevant pure utility in `lib/data/`, its tests and existing chart/table view; follow [CHARTS.md](CHARTS.md).                                                            |
| A new view or interaction                               | Find its nearest existing view, reuse shared headers, tables, filters and sidebars, and keep state at the existing owner. Add a new top-level section only when the task needs one. |
| Appearance                                              | Extend the shared rule or semantic theme token in `app/globals.css`; verify every affected consumer.                                                                                |

Measure a representative dataset before adding performance machinery. The current loader pages through the run catalog and batches histories with at most eight concurrent requests; it still holds the loaded data in the browser. Larger experiments may need on-demand histories, server-side filtering or downsampling at that boundary. Do not claim unlimited scale or add a parallel data pipeline to one view. Preserve IDs, missing values, provenance, and saved browser state.

An example instruction for another agent:

> Read AGENTS.md and the linked architecture, style and change workflow. Implement [requested behavior] in [view], with acceptance criteria [observable results]. Minimize added entropy: first identify the closest existing code and reuse it. Do not add unrelated controls or abstractions. Run applicable checks, exercise the behavior and reset/reload paths, inspect desktop/mobile screenshots against the closest peer, critique the diff for unnecessary logic and styling, fix discrepancies, and repeat. Report actual evidence and anything unverified.

## Verify the installed copy

In the installed directory:

```sh
npm run check
npm run build
npm run visual:install
```

`check` runs unit/tooling tests, TypeScript and lint, stopping at the first failure. Run the build with the development preview stopped. `visual:install` downloads Chromium once; skip it if using an existing Chrome installation. On Linux, Chromium may also need OS libraries; on a machine where you can install them use `npm exec -- playwright-core install --with-deps chromium`.

Start `npm run dev -- --host 127.0.0.1`, then in a second terminal:

```sh
npm run visual:check
```

The capture script uses the bundled sample flows. Keep the sample adapter while smoke-testing installation; after connecting real data, adapt fixtures and captures to that source without inventing or mislabeling real results. Set `DASHBOARD_URL` for a different port and `CHROME_PATH` for a specific browser executable. See [VISUAL_VERIFICATION.md](VISUAL_VERIFICATION.md) for capture locations and the required image inspection loop. Automated checks do not replace the agent's visual and reuse review.

## Measure changes to performance

Build with the development server stopped. Serve the production build on loopback in a separate terminal:

```sh
node node_modules/vinext/dist/cli.js start --hostname 127.0.0.1 --port 5173
```

Then run `npm run performance:check`. It uses the same browser selection as visual verification, creates five fresh browser contexts with a four-times CPU slowdown, records initial JavaScript/CSS bytes and first navigation timings, and benchmarks configuration lookups over 10,000 runs and the sample chart model. Samples and medians go to ignored `outputs/performance.json`. `DASHBOARD_URL`, `DASHBOARD_PERFORMANCE_OUTPUT`, and `DASHBOARD_SOURCE` let you compare an isolated baseline with the changed build; the source path must match the served build for calculation comparisons.

Run before and after serially, with other builds and checks stopped. Keep browser, viewport, CPU slowdown and data constant. These samples diagnose regressions; they are not universal speed guarantees or a benchmark of a real remote source. Cold navigation includes lazy loading. Use the actual research dataset to investigate memory and scaling limits before adding caching, sampling or virtualization. Lint rejects warnings as well as errors; preserve that gate when extending the app.
