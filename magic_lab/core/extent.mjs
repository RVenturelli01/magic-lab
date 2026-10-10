/** Linear scan without spreading observations into the JS argument stack. */
export function extent(values, fallback = [0, 1]) {
  let min = Infinity,
    max = -Infinity;
  for (const value of values) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return min === Infinity ? [...fallback] : [min, max];
}
