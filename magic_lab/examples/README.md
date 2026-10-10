# Portable MagicLab examples

These folders travel with the dashboard so coding agents can consult complete
content alongside the [design guides](../docs/DESIGN.md).

| Folder                           | Content                                                        | Design guide                             |
| -------------------------------- | -------------------------------------------------------------- | ---------------------------------------- |
| [magicplot](magicplot/README.md) | 108 synthetic run folders, manifest, generator and CSV sources | [MagicPlot](../docs/design/MAGICPLOT.md) |
| [magicalgo](magicalgo/README.md) | Mathematical PPO/DQN documents, JSON and authoring sources     | [MagicAlgo](../docs/design/MAGICALGO.md) |

No training was executed. These are illustrative references, not experimental
results or verified translations of actual implementations. They are the explicit
exception to the host-data boundary; real host experiments and exports stay outside
`magic_lab/`.

## Open the references

From the host root, after `npm --prefix magic_lab ci`:

```sh
npm --prefix magic_lab start -- --examples
```

Open http://127.0.0.1:4173 and select MagicPlot or MagicAlgo. `OBSERVATORY_DATASET`
and `MAGICLAB_ALGORITHMS` take precedence even in examples mode. Startup neither
copies nor generates data.

To regenerate both references with canonical formatting:

```sh
npm --prefix magic_lab run examples:generate
```

## Adapt to another repository

Follow [ADAPTATION.md](../docs/ADAPTATION.md): prepare normalized data and actual
algorithm documents in the host, then start without `--examples`. Defaults are
`data/dataset.json` and `data/algorithms.json`, or explicit environment overrides.
There is no automatic fallback to examples. Consult these references without
replacing them with real experiments or inferring scientific validity from curves.
