# MagicAlgo examples

[algorithms.json](algorithms.json) is the complete catalogue displayed in the
development repository. [ppo-document.mjs](ppo-document.mjs) defines PPO,
on-policy collection, optimization and GAE; it imports DQN modules and symbols
from [dqn-document.mjs](dqn-document.mjs). The catalogue has seven modules;
SAC and TD3 are illustrative entries awaiting extraction.

```sh
node magic_lab/examples/magicalgo/ppo-document.mjs
```

This regenerates the JSON beside its sources. These are hypothetical mathematical
documents, not training implementations. See [examples mode](../README.md) to
open the catalogue and [MagicAlgo design and screenshots](../../docs/design/MAGICALGO.md)
for presentation guidance.

## Minimal authoring examples

[algorithm-documents.mjs](algorithm-documents.mjs) contains code examples of the
viewer's version 2 document contract. They describe algorithms for display; they
do not implement or execute optimization, training or evaluation. They require
no host data and are included in distributed copies as dashboard documentation.

| Factory                  | What to reuse                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `singleModuleExample()`  | A minimal gradient-descent document: symbolic inputs/outputs, a loop, a formula, glossary and a step note.                |
| `sharedModulesExample()` | Two main algorithms, nested epoch/batch loops, a shared update module, clickable calls, comments and a pending algorithm. |

Use the first example for an independent procedure. Use the second to understand
how call tokens produce navigation and the graph, including a dependency with
multiple callers. IDs referenced by `call` must match module IDs. Calls express
document navigation; the surrounding math describes arguments and assignments.
Titles, descriptions and algorithm content use English.

## Open an example

From the host root, write the chosen description **outside** `magic_lab/`:

```sh
node --input-type=module -e "import { mkdir, writeFile } from 'node:fs/promises'; import { sharedModulesExample } from './magic_lab/examples/magicalgo/algorithm-documents.mjs'; import { validateAlgorithms } from './magic_lab/core/algorithms.mjs'; await mkdir('examples/magicalgo', { recursive: true }); await writeFile('examples/magicalgo/viewer-example.json', JSON.stringify(validateAlgorithms(sharedModulesExample()), null, 2));"
```

In PowerShell, start a server using that host document:

```powershell
$env:MAGICLAB_ALGORITHMS = 'examples/magicalgo/viewer-example.json'
npm --prefix magic_lab start
```

Open `http://127.0.0.1:4173/#magicalgo`. Stop an existing server before starting
another on the same port. Remove the override with
`Remove-Item Env:MAGICLAB_ALGORITHMS` when finished.

For another host, copy and customize the factory into a host-owned script; keep
the generated JSON, real algorithms and integration tests in that host. Replace
the illustrative formulas, glossary and notes with verified descriptions of the
actual implementation. Do not infer that these examples validate host code or
establish convergence. See [ALGORITHMS.md](../../docs/ALGORITHMS.md) for the full contract
and [MagicAlgo design](../../docs/design/MAGICALGO.md) for presentation rules.
