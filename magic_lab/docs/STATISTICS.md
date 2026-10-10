# Statistical invariants

This guide owns numerical semantics and pooling assumptions; record/filter encoding
is specified in [data-contract.md](data-contract.md). These rules are part of the application contract. Changing one requires an explicit product decision, updated documentation and independent expected numerical tests.

## Selection and grouping

Analysis uses the [typed filter contract](data-contract.md#view-v4) and intersects
selected IDs with filtered runs. The application permanently removes hidden selections when filters change/restore/import; expanding filters does not silently bring them back.

Incomplete is every status other than completed. The default excludes those runs; include uses only observed data. Missing metrics yield absent/empty series, never zeros.

`run-identity.mjs` defines strict canonical algorithm/environment/full-config/full-code identity and duplicate-seed validation. The Seeds catalogue/mean mode additionally includes the original experiment name through `run-grouping.mjs`. Equal seeds alone never define a group. Different protocols, configurations and code do not pool in Seeds.

Explicit field grouping intentionally pools selected eligible runs with the same typed field value, allowing other factors to vary. Missing and null are different. Mixed metadata retains all configurations/code versions; no first-member representative. n counts contributing run observations, not distinct seed labels. Independent observations are an assumption; repeated/common-random-number seeds may violate it.

## Observations and smoothing

Training and evaluation have distinct metric definitions. Axes have explicit units and compatible meaning. Every run/metric/step observation is unique. Adapters resolve duplicate source events explicitly.

Smoothing is an equally weighted trailing average of observations within each run, with a shortened initial window. It is not EMA or time weighting. Smooth first, aggregate second, clip the numeric step range last. Input points are not mutated; no interpolation, forward fill or extrapolation is performed.

At each exact step, center is arithmetic mean and dispersion is sample SD with denominator n−1. With n=1, SD/uncertainty are undefined (null in computations, empty in numeric exports), not zero.

Common steps is the exact intersection within each group, including runs with no selected metric. Available seeds is the union with actual per-step n; incomplete tails can be singletons. Runs have equal weight regardless of evaluation episode counts. Connecting lines are visual guides.

## Bands and summaries

`uncertainty.mjs` is the single source for sd, sd2, sd3, ci95 and none. Multipliers 1/2/3 apply to sample SD. Pointwise 95% mean CI is `mean ± t(0.975,n−1) × SD / sqrt(n)`, assuming independent observations and the normal mean model. It is not a simultaneous confidence band. Singleton tails have no band.

Tables use each group's last visible aggregate step and expose mean, SD, n and actual endpoint. Endpoints may differ across groups/metrics. An explicitly fixed min/max step gives a matched endpoint; never silently align summary values. Zoom affects visual domains, not numeric observations. Physical display divisors affect labels/coordinates only.

Plots, shared Ablation scales, portable SVG/PDF, CSV bounds and reproduction settings must agree on uncertainty. Hidden paper series are omitted from publication figures but remain in the reproduction dataset. Every active mode exports its actual grid/table/metric selection.

## Metric against metric plots

X and Y observations are smoothed independently per run, then joined at exactly matching original training steps. Missing pairs are omitted without interpolation. Grouped plots aggregate both coordinates over the same paired runs at each original step, respecting the selected alignment and incomplete-run policy. The plotted X is the mean X value; uncertainty remains vertical and describes Y only. Lines connect points in original training-step order, so a non-monotonic X metric may turn back. Settings step bounds still refer to original training steps. CSV retains those steps alongside x_metric, x_value and y_metric.
