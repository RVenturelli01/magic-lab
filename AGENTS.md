# Repository boundaries

`magic_lab/` is the portable dashboard module: application code, generic adapters,
schemas, app tests, tooling, design documentation, screenshots and curated
reference examples in `examples/magicplot/` and `examples/magicalgo/`.
The user explicitly requested these bundled examples; they are an exception
to the host-data boundary, not a destination for real experiments.

All real experiment code, training/evaluation, raw logs, normalized host data,
configs, checkpoints, saved views and generated exports belong outside the module.
Preserve raw source logs. No real training has been executed in this repository.

In this development repository `npm start` selects the portable examples.
In a new host, `npm --prefix magic_lab start` defaults to `data/dataset.json`
and `data/algorithms.json` in that host. `OBSERVATORY_DATASET` and
`MAGICLAB_ALGORITHMS` override them relative to the host root independently of cwd.
`--examples` is an explicit opt-in; never silently fall back to synthetic data.

Read `magic_lab/AGENTS.md`, `magic_lab/docs/DESIGN.md` and the relevant guide
in `magic_lab/docs/design/` before changing the dashboard.

Validation from root: `npm run check`, `npm --prefix magic_lab test`,
`npm run check:data`, `node --test tests/*.test.mjs`, and
`npm --prefix magic_lab run package:check`.
