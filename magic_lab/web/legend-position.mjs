// Use the centre of the dragged legend, regardless of its current anchors.
export function snapLegendPosition(legend, size) {
  const x =
    legend.x +
    (({ left: 0.5, center: 0, right: -0.5 }[legend.xanchor] ?? 0) *
      (legend._width ?? 0)) /
      size.w;
  const y =
    legend.y +
    (({ top: -0.5, middle: 0, bottom: 0.5 }[legend.yanchor] ?? 0) *
      (legend._height ?? 0)) /
      size.h;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x > 1) return "outside right";
  return (y >= 0.5 ? "upper" : "lower") + " " + (x >= 0.5 ? "right" : "left");
}
