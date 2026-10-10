# MagicTuner design

Read the [shared design](../DESIGN.md) first. MagicTuner currently has only a
placeholder route, not an implemented tuning workspace.

## Main implemented features

- A launcher entry marked Planned, with a short intended-purpose description.
- A direct `#magictuner` route with an explicit unimplemented-workspace message.
- Return navigation to MagicLab and the shared theme selector.

Parameter optimization, trial scheduling, search configuration and result analysis
are not implemented. Do not describe them as available features.

## Visual style

Inherit the [shared frame and empty states](../DESIGN.md#shared-frame-and-home). There is no approved full tuning UI or dedicated screenshot. The
placeholder must not become a reference for a future tuning design. Document
new tuning functionality and its visual references when it is implemented.

## Writing style

Apply the [shared writing rules](../DESIGN.md#writing-style) and clearly identify
the planned state. Describe intended
purpose as a plan, not as a working capability. The empty message should say that
the workspace is not implemented and offer a return action. Avoid invented
optimization results, progress reports or claims of automatic experiment execution.

## Examples

There is no MagicTuner example dataset. The existing
[portable examples](../../examples/README.md) belong to MagicPlot and MagicAlgo
and do not demonstrate tuning functionality.
