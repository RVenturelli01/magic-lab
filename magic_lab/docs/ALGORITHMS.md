# Algorithm document contract

This guide owns MagicAlgo's input format, loading and implementation contracts.
For features, notation, writing style, visual layout and interaction requirements,
use [MagicAlgo design](design/MAGICALGO.md). For complete and minimal authoring
references, use [examples/magicalgo](../examples/magicalgo/README.md).

## Loading

The default file is `<host>/data/algorithms.json`. `MAGICLAB_ALGORITHMS` overrides
it; relative paths resolve against the host root independently of shell cwd.
`GET /api/algorithms` validates and returns the document independently of MagicPlot
data. `createServer({repoRoot, algorithmsPath})` supports explicit configuration.
Bundled references require the mode documented in [examples](../examples/README.md).

## Version 2 format

Validation is implemented in `core/algorithms.mjs`.

| Field                  | Contract                                                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`              | Must be `2`                                                                                                                                                                      |
| `name`, `hypothetical` | Nonempty catalogue name and boolean provenance flag                                                                                                                              |
| `root`                 | Initial module ID; must reference a ready module when the catalogue is nonempty                                                                                                  |
| `algorithms`           | Array of modules with unique IDs and positive integer numbers                                                                                                                    |
| `symbols`              | Optional glossary entries with unique `id`, unique nonempty `tex` and nonempty `description`; IDs start with a lowercase letter followed by lowercase letters, digits or hyphens |
| `pendingAlgorithms`    | Optional entries with unique nonempty `id` and `title`; IDs cannot overlap ready modules                                                                                         |

Each ready module contains `id`, `number`, `title`, `input`, `output`, `body`
and a string-array `notes`. Input/output and instruction content are nonempty
arrays of single-key tokens: `{text}`, `{math}` (LaTeX), `{keyword}` or `{call}`
(a module ID). Token values are nonempty strings.

Body nodes are:

- `{kind: "line", content}` for tokenized instructions.
- `{kind: "comment", text}` for comments.
- `{kind: "equation", math}` for LaTeX equations.
- `{kind: "block", header, body}` for nested instruction blocks.

An optional nonempty `note` on a line, equation or block supplies a contextual
explanation. Placement and wording follow the [writing guide](design/MAGICALGO.md#writing-style).
Calls must reference ready modules. Validation rejects cycles, duplicate IDs/numbers,
invalid tokens and block nesting deeper than 12. An empty module array is supported.
Pending entries have no body and do not participate in the graph.

## Derived graph and navigation state

`core/algorithm-graph.mjs` derives a DAG directly from call tokens, deduplicates
edges and assigns levels below callers. Main algorithms are modules with no
incoming call edges. Selecting a module derives a shortest path from the active
main algorithm; graph membership includes its reachable modules. Caller metadata
can include other main algorithms sharing a module. There is no separate dependency
catalogue or automatic source discovery.

`web/application/algorithms.mjs` owns fetching, the current path, parent reading
positions and disposal. `web/ui/algorithms.mjs` receives a document, explicit path
and math renderer. It escapes source text and renders one module at a time.
This application does not change MagicPlot's portable view or use a global store.

## Browser controllers

- `web/algorithm-graph-view.mjs`: one coordinate transform for nodes/edges, cursor-anchored zoom, per-main camera state, ResizeObserver-based Fit and focus-driven visibility. Suppress navigation after dragging and restore the camera on cancellation.
- `web/algorithm-split.mjs`: transient CSS previews and committed graph width bounded to 20-55%; cancellation restores the prior width.
- `web/algorithm-help.mjs`: one transient or pinned tooltip with managed listeners.

Dispose handlers, observers, timers and pointer capture when leaving or remounting.
Late responses must not update a disposed application. Public controls and keyboard
behavior are specified in [MagicAlgo design](design/MAGICALGO.md).

## Math and asset boundaries

`web/math.mjs` configures local KaTeX with HTML and accessible MathML, strict
parsing, bounded expansion/size and trusted commands disabled. It validates the
original input before adding narrowly permitted symbol data attributes. Symbol
scanning preserves command names and literal text. Equations use inline containers
with `\displaystyle`; visual alignment belongs to the design guide.

KaTeX JavaScript, CSS and fonts are served through a narrow static allowlist.
No CDN is required. The viewer displays authored descriptions; it neither executes
algorithms nor verifies their correspondence to host code. Host verification is
part of [adaptation](ADAPTATION.md#4-author-host-algorithms).
For automated and browser checks, follow [verification.md](verification.md).
