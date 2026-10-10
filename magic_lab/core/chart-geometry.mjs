import { bandHalfWidth } from "./uncertainty.mjs";
import { extent } from "./extent.mjs";
export function geometry(result, view) {
  const points = result.groups.flatMap((g) => g.points);
  const W = view.viewport?.width ?? 1000,
    H = view.viewport?.height ?? 400;
  const left = view.viewport ? 66 : 85,
    right = view.viewport ? 18 : 30,
    top = view.viewport ? 15 : 30,
    bottom = view.viewport ? 48 : 62;
  let [xmin, xmax] = extent(points.map((point) => point.step));
  let [ymin, ymax] = extent(
    points.flatMap((point) => {
      const half = bandHalfWidth(point, view.band) ?? 0;
      return [point.mean - half, point.mean + half];
    }),
  );
  if (xmin === xmax) xmax = xmin + 1;
  if (ymin === ymax) {
    ymin -= 1;
    ymax += 1;
  }
  const padding = (ymax - ymin) * 0.08;
  ymin -= padding;
  ymax += padding;
  const bounds =
    view.chartRanges?.[view.plotId ?? view.metric] ?? view.plotBounds;
  if (bounds) ({ xmin, xmax, ymin, ymax } = bounds);
  return {
    W,
    H,
    left,
    right,
    top,
    bottom,
    xmin,
    xmax,
    ymin,
    ymax,
    x: (x) => left + ((x - xmin) / (xmax - xmin)) * (W - left - right),
    y: (y) => H - bottom - ((y - ymin) / (ymax - ymin)) * (H - top - bottom),
  };
}
