export const BANDS = ["sd", "sd2", "sd3", "ci95", "none"];
export const bandLabel = (band) =>
  ({
    sd: "±1 sample SD",
    sd2: "±2 sample SD",
    sd3: "±3 sample SD",
    ci95: "95% CI (Student t)",
    none: "No band",
  })[band] ?? "No band";
const criticals = new Map();
// Substitute theta = atan(t/sqrt(df)) in the Student t density.
// The integral of cos^(df-1)(theta) follows an exact recurrence for integer df.
function tCDF(t, df) {
  const theta = Math.atan(t / Math.sqrt(df)),
    sin = Math.sin(theta),
    cos = Math.cos(theta);
  const integral = [theta, sin],
    normalizer = [Math.PI / 2, 1];
  let power = cos;
  for (let k = 2; k < df; k++) {
    const slot = k % 2;
    integral[slot] = (sin * power + (k - 1) * integral[slot]) / k;
    normalizer[slot] = ((k - 1) * normalizer[slot]) / k;
    power *= cos;
  }
  const slot = (df - 1) % 2;
  return 0.5 + (0.5 * integral[slot]) / normalizer[slot];
}
export function studentT95(df) {
  if (!Number.isInteger(df) || df < 1)
    throw Error("Student t requires positive integer degrees of freedom");
  if (criticals.has(df)) return criticals.get(df);
  let lo = 0,
    hi = 1;
  while (tCDF(hi, df) < 0.975) hi *= 2;
  for (let i = 0; i < 60; i++) {
    const middle = (lo + hi) / 2;
    if (tCDF(middle, df) < 0.975) lo = middle;
    else hi = middle;
  }
  const value = (lo + hi) / 2;
  criticals.set(df, value);
  return value;
}
export function bandHalfWidth(point, band) {
  if (
    band === "none" ||
    point.sd === null ||
    !Number.isFinite(point.sd) ||
    point.n < 2
  )
    return null;
  if (band === "ci95")
    return (studentT95(point.n - 1) * point.sd) / Math.sqrt(point.n);
  const multiplier = { sd: 1, sd2: 2, sd3: 3 }[band];
  if (multiplier === undefined) throw Error("Invalid uncertainty band");
  return multiplier * point.sd;
}
export function bandLimits(point, band) {
  const width = bandHalfWidth(point, band);
  return width === null
    ? null
    : { lower: point.mean - width, upper: point.mean + width };
}
