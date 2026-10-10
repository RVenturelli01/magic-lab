export function zoomBounds(bounds, factor, x = 0.5, y = 0.5, axis = "xy") {
  const sx = bounds.xmax - bounds.xmin,
    sy = bounds.ymax - bounds.ymin,
    ax = bounds.xmin + sx * x,
    ay = bounds.ymin + sy * y;
  return {
    xmin: axis === "y" ? bounds.xmin : ax - sx * factor * x,
    xmax: axis === "y" ? bounds.xmax : ax + sx * factor * (1 - x),
    ymin: axis === "x" ? bounds.ymin : ay - sy * factor * y,
    ymax: axis === "x" ? bounds.ymax : ay + sy * factor * (1 - y),
  };
}
export function panBounds(bounds, dx, dy) {
  const sx = bounds.xmax - bounds.xmin,
    sy = bounds.ymax - bounds.ymin;
  return {
    xmin: bounds.xmin - dx * sx,
    xmax: bounds.xmax - dx * sx,
    ymin: bounds.ymin + dy * sy,
    ymax: bounds.ymax + dy * sy,
  };
}
