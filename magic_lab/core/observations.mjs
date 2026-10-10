/** Build once per computation, never cache mutable datasets across calls. */
export function indexObservations(points) {
  const metrics = new Map();
  for (const point of points) {
    if (!metrics.has(point.metricId)) metrics.set(point.metricId, new Map());
    const runs = metrics.get(point.metricId);
    if (!runs.has(point.runId)) runs.set(point.runId, []);
    runs.get(point.runId).push(point);
  }
  for (const runs of metrics.values()) {
    for (const series of runs.values()) series.sort((a, b) => a.step - b.step);
  }
  return metrics;
}

export function runObservations(index, metricId, runId) {
  return index.get(metricId)?.get(runId) ?? [];
}
