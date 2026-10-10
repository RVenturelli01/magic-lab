# MagicPlot examples

[manifest.json](manifest.json) indexes 108 synthetic Reacher-v5 run folders: SAC/PPO/A2C,
36 configurations and three seeds (0, 1, 2), with 18,936 observations. Configurations
combine three learning rates, two gamma values and two values of the algorithm's
specific factor (`ent_coef` or `clip_range`).

```text
magicplot/
  manifest.json
  runs/
    sac-lr0.0001-g0.95-ent_coef0.05-s0/
      config.json
      metrics.csv
    sac-lr0.0001-g0.95-ent_coef0.05-s1/
      config.json
      metrics.csv
    ...
```

Each `config.json` records the run identity, seed, status, full configuration
and code provenance. Each `metrics.csv` contains all of that run's training and
evaluation metrics, with one row per step and one column per metric. Blank cells
mean missing observations or inapplicable metrics. The manifest owns the six
metric definitions and ordered folder list; `artifacts` and `campaigns` are empty.
The server reads these sources into a validated in-memory dataset, without a
generated `dataset.json`. Seeds groups replicas with the same complete identity,
not simply the same algorithm.

[generate.mjs](generate.mjs) produces deterministic illustrative curves. No environment,
policy, training or real evaluation was executed. Missing observations and inapplicable
metrics remain absent.

```sh
node magic_lab/examples/magicplot/generate.mjs
```

This regenerates the reference manifest and run files beside its generator. Development
repository integration tests live in `tests/reacher.test.mjs`. See the
[data format](../../docs/data-contract.md), [MagicPlot design and screenshots](../../docs/design/MAGICPLOT.md)
and [examples startup instructions](../README.md).

## CSV and exports

`legacy/manifest.json` and `legacy/progress.csv` are illustrative sources for the
generic CSV reader. Original files are preserved unchanged.
[export-example.mjs](export-example.mjs) generates a saved view and publication
figure package using the synthetic dataset:

```sh
node magic_lab/examples/magicplot/export-example.mjs
```

It writes to `<host>/exports/paper-reference/`, outside the portable module.
