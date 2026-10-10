/** Stable plot identities; legacy plots keep their metric ID. */
export function plotId(x, y) {
  return x ? "plot:" + JSON.stringify([x, y]) : y;
}
export function plotAxes(view, id) {
  return view.plotAxes?.[id] ?? { x: "", y: id };
}
export function plotMetric(dataset, view, id) {
  const axes = plotAxes(view, id),
    y = dataset.metrics.find((m) => m.id === axes.y),
    x = dataset.metrics.find((m) => m.id === axes.x);
  if (!y || (axes.x && !x)) return null;
  return x
    ? {
        ...y,
        id,
        xUnit: x.label + " (" + x.unit + ")",
        sourceMetric: y.id,
        xMetric: x.id,
      }
    : y;
}
