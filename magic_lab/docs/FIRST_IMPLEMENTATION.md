# First implementation and adaptation conversation

This guide owns the coding agent's initial conversation when implementing
MagicLab for a host repository or adapting it to new experiment data. Follow it
alongside [ADAPTATION.md](ADAPTATION.md), before implementing the user's filter
and plot choices. This conversation takes place in the coding agent's chat;
it does not require an integrated chat feature in the dashboard.

## Prepare a small proposal

Read the host instructions and inspect representative configurations and logs
without running training. Use available source fields and metrics to tailor the
two base lists below. Keep source names and units identifiable. Mark unavailable
or uncertain items explicitly; examples are suggestions, not mandatory fields.
If no logs are available yet, present the lists as provisional candidates and
ask which sources will provide the chosen fields and metrics. Never invent data
or silently use bundled synthetic examples as host results.

Recommend a small first version: a few classification fields and one or two
curves with the existing training-step axis. Explain that the choices are for
the first implementation, are not definitive and can be changed or extended later.

## Ask the two required questions

Present both base lists in the user's language. For each list, explicitly ask
the user to confirm it or suggest additions, removals or replacements. Existing
choices supplied in the conversation count as answers; do not ask again for
information the user has already provided.

### 1. Filters for classifying runs

Ask: "Which filters would you like to use to classify and compare your runs?
Here is a small base list; you can confirm it or modify it."

Suggested base list, restricted to fields supported by the host:

- Algorithm or method.
- Task, environment or dataset.
- Experiment name or variant.
- Seed.
- One relevant hyperparameter, such as learning rate, if useful.

Distinguish the available filter catalogue from filters displayed in Runs.
For the first implementation, all filters start hidden; the user adds them
one at a time through Add Filter. Confirming a base list does not automatically
display its filters or apply filtering constraints. Follow the existing typed
metadata and selection contracts when implementing these choices.

### 2. Curves available for plot selection

Ask: "Which curves would you like to have available in the plot selector?
Here is a small base list; you can confirm it or modify it."

Suggested base list, using the host's actual metric names:

- Primary performance metric against training step: for example, evaluation
  return, success rate or accuracy, depending on the experiment.
- Training loss against training step, if logged and meaningful.
- One optional diagnostic against training step, such as validation loss or
  entropy, only when relevant and available.

Recommend starting with the first one or two curves. Clarify which curves should
be available for selection and which, if any, should be displayed initially.
Ask about ambiguous metric meanings, units or evaluation protocols before
mapping them. Do not infer new statistics, pooling rules or unsupported axes
from a metric name or an image; follow [STATISTICS.md](STATISTICS.md) and
[MagicPlot design](design/MAGICPLOT.md).

## Optional visual references

The agent may invite the user to attach images of plots or tables they want
to reproduce. Attachments are optional, not a prerequisite for a simple first
version. Ask which elements matter, such as curves, axes, grouping, table columns
or layout. Translate the reference into a concrete proposal backed by available
data. Identify missing data or features before promising reproduction.
An attachment does not automatically authorize restyling the shared frame;
follow [DESIGN.md](DESIGN.md) and the explicitly requested scope.

## Resolve and record the first scope

Collect the user's answers to both questions before implementing the dependent
filter or plot choices. While waiting, continue independent inspection and
baseline validation. Silence is not confirmation. If the user requests changes,
incorporate them and clarify only unresolved details. A confirmed list or explicit
delegation is sufficient; do not add another approval round.

Record the agreed first scope in host documentation outside `magic_lab/`:
available classification fields and their source mappings, an initially empty
displayed-filter list, available curves and initially displayed curves, metric
units, optional plot/table references, and deferred requests or missing sources.
Keep these choices provisional and retain raw logs. Continue the technical
integration and verification workflow in [ADAPTATION.md](ADAPTATION.md).
