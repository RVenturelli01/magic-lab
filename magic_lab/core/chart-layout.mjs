export function moveChart(charts, source, target) {
  const from = charts.indexOf(source),
    to = charts.indexOf(target);
  if (from < 0 || to < 0 || from === to) return [...charts];
  const next = [...charts];
  next.splice(from, 1);
  next.splice(to, 0, source);
  return next;
}
export function resizeCharts(start, dx, dy, maxWidth = 2400) {
  return {
    width: Math.round(
      Math.max(
        320,
        Math.min(Math.max(320, Math.min(2400, maxWidth)), start.width + dx),
      ),
    ),
    height: Math.round(Math.max(280, Math.min(1200, start.height + dy))),
  };
}
