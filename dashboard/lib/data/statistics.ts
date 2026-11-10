/** Avoid argument spreading, which overflows the call stack on large studies. */
export function extent(values: readonly number[]): [number, number] {
  let min = Infinity,
    max = -Infinity;
  for (const value of values) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return [min, max];
}

export function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value / values.length, 0);
}

/** Sample deviation (n - 1); callers decide how to display a single sample. */
export function sampleDeviation(
  values: readonly number[],
  average = mean(values),
): number {
  return values.length > 1
    ? Math.sqrt(
        values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
          (values.length - 1),
      )
    : 0;
}
