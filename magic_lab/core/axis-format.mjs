/** Display-only tick labels, shared by Plotly and LaTeX. */
const plain = (value) =>
  new Intl.NumberFormat("en-US", {
    useGrouping: false,
    maximumSignificantDigits: 12,
  }).format(value);
export function axisTicks(min, max, interval, format = "auto", exponent = 3) {
  if (format === "auto") return null;
  const raw = (max - min) / 5,
    magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    interval ?? [1, 2, 5, 10].find((n) => n * magnitude >= raw) * magnitude;
  const start = Math.ceil(min / step),
    end = Math.floor(max / step);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start > 200)
    throw Error("Tick interval produces more than 200 labels");
  const values = [],
    labels = [];
  for (let index = start; index <= end; index++) {
    const value = Number((index * step).toPrecision(12));
    values.push(value);
    if (format === "power") labels.push(plain(value / 10 ** exponent));
    else if (format === "compact") {
      const prefix = [
        [1e9, "G"],
        [1e6, "M"],
        [1e3, "k"],
      ].find(([scale]) => Math.abs(value) >= scale);
      labels.push(prefix ? plain(value / prefix[0]) + prefix[1] : plain(value));
    } else labels.push(plain(value));
  }
  return { values, labels, exponent: format === "power" ? exponent : null };
}
