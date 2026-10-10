# MagicLab

A local research workspace designed to be copied into another repository and adapted by a coding agent. MagicLab opens a tool launcher: MagicPlot contains the implemented dashboard; MagicAlgo provides an authored algorithm viewer; MagicTuner is a placeholder. In MagicPlot, Runs, Charts, Ablations and Tables share one selection and portable view model. Plotly is served locally; no account, remote service or training process is required.

MagicPlot's **View** selector switches interactive charts to actual LaTeX previews or compiled LaTeX PDFs. Settings, Style and Export work in either mode. LaTeX preview requires local pdflatex; source export does not. Setup and behavior: [Export previews](docs/PREVIEW.md).

## Install in your repository

MagicAlgo reads an authored, modular algorithm document from the independent host `data/algorithms.json`, or the path in `MAGICLAB_ALGORITHMS`. It starts at the highest-level module and reveals details through clickable calls. The host's hypothetical PPO example links to data collection and optimization, with GAE nested under collection. Formulas use local KaTeX. See [the document contract](docs/ALGORITHMS.md); automatic code extraction is not implemented.

Copy this directory to `<your-repo>/magic_lab/`. Copy source, tests, documentation and the lockfile; exclude `node_modules/`, caches, logs and generated archives. Keep datasets, raw logs, experiment scripts, checkpoints and figure downloads in the host repository.

```sh
npm --prefix magic_lab ci
npm --prefix magic_lab run check
npm --prefix magic_lab test
```

Produce `<your-repo>/data/dataset.json` using the [data contract](docs/data-contract.md), then:

```sh
npm --prefix magic_lab run check:data
npm --prefix magic_lab start
```

Open http://127.0.0.1:4173. `PORT` changes the port. `OBSERVATORY_DATASET` chooses another dataset; relative paths resolve against the **parent of this module**, independently of the shell directory. Portable reference examples are bundled in [examples/](examples/README.md) and are selected only with `--examples`; missing host data never silently falls back to them. The server binds to loopback and exposes dashboard assets and `/api/dataset`, not host logs/artifacts.

MagicPlot also reads a [run collection directory](docs/data-contract.md#run-folders)
directly: one `config.json` and `metrics.csv` per run, plus a collection manifest.
Set `OBSERVATORY_DATASET` to the directory and use Reload after logs change.
The [bundled MagicPlot examples](examples/magicplot/README.md) use this layout.

The generic CSV reader accepts a source directory containing `manifest.json`:

```sh
node magic_lab/adapters/csv.mjs logs data/dataset.json
```

Repository-specific adapters belong in the host. Use **Reload** at the top right of any MagicPlot screen after replacing the dataset; refresh the browser after changing source code.

## Adapt with an agent

Start with [AGENTS.md](AGENTS.md). Give the agent a concrete workflow and representative small source logs. A useful first instruction is:

> Read magic_lab/AGENTS.md, docs/ADAPTATION.md and docs/FIRST_IMPLEMENTATION.md. Inspect this repository's logging conventions. Propose small base lists of classification filters and selectable plot curves, and ask me to confirm or modify them for a provisional first version. Implement an adapter outside magic_lab/ that preserves source logs and writes data/dataset.json. Document unknown provenance and verify representative raw values. Then adapt the agreed dashboard features using docs/EXTENDING.md.

| Document                                             | Purpose                                                 |
| ---------------------------------------------------- | ------------------------------------------------------- |
| [Architecture](docs/ARCHITECTURE.md)                 | Module ownership, dependency direction and data flow    |
| [Adaptation](docs/ADAPTATION.md)                     | Install in another repo and map its logs                |
| [First implementation](docs/FIRST_IMPLEMENTATION.md) | Initial conversation and provisional filter/plot scope  |
| [Extensions](docs/EXTENDING.md)                      | Where and how to change features                        |
| [Data contract](docs/data-contract.md)               | Dataset, CSV, view and reproduction formats             |
| [Statistics](docs/STATISTICS.md)                     | Grouping, missing data and uncertainty invariants       |
| [Design](docs/DESIGN.md)                             | Visual rules and original references                    |
| [MagicPlot design](docs/design/MAGICPLOT.md)         | Tool rules, embedded screenshots and run examples       |
| [MagicAlgo design](docs/design/MAGICALGO.md)         | Tool rules, embedded screenshots and algorithm examples |
| [MagicTuner design](docs/design/MAGICTUNER.md)       | Placeholder scope, visual rules and writing style       |
| [Portable examples](examples/README.md)              | Portable code examples for authored viewer documents    |
| [Verification](docs/verification.md)                 | Automated checks and manual validation                  |

## Workspace behavior

Runs owns filters and the catalogue. Options use OR within a field and AND across fields. Filtering discards selected runs outside the visible set; widening filters does not reselect them. Group by selects independent runs, strict seed replicas, or deliberately pooled typed field values.

Charts chooses ordered metrics; Ablations partitions one metric into a row/column matrix with shared scales; Tables compares last visible seed summaries with step, sample SD and actual n. Missing observations stay absent. Settings and Style control statistics and publication appearance. Browser-local sessions restore selection, filter order, navigation, dimensions, ranges and expanded groups. Storage failures are visible.

The Export menu downloads SVG, PNG, PDF, CSV or standalone LaTeX as combined or separate files. Image generation uses the same current analysis and style; numeric downloads retain unscaled source values. Charts and Ablations use local Plotly, including image exports. Standalone LaTeX and CSV downloads do not require a compiler. Tables uses the table renderer. Portable reproduction bundles are available through `reporting/export-pack.mjs`; see the data contract.

## Development and distribution

Node >=22. Native ESM, no build step. Plotly is the runtime dependency; pinned Prettier is a development dependency for readable source and automated architecture parsing.

```sh
npm run format       # canonical formatting
npm run check        # syntax, imports/exports, boundaries, formatting; no host data needed
npm test             # portable numerical and application tests
npm run check:data   # strict host dataset validation
npm run package:check
```

`npm run package -- <path-outside-magic_lab>/magic-lab-starter.zip` produces a source archive using the package allowlist. It includes the lockfile, agent guides and tests. After extraction, name the directory `magic_lab` and run `npm ci`. Development installs need dev dependencies; runtime-only installs can use `npm ci --omit=dev` but cannot run formatting/code checks.

The workflow in `.github/workflows/test.yml` works when the module is a standalone repository. An embedded host should run the prefixed commands from its own CI; its integration tests and dataset checks remain separate.

The dashboard keeps the dataset and derived analyses in memory. It is a starter for bounded local comparisons, with no authentication, live log tailing, training launcher or multi-user backend. [MIT](LICENSE).
