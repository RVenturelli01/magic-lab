import { normalizePaper } from "./paper-style.mjs";
export const SETTING_KEYS = [
  "window",
  "incomplete",
  "alignment",
  "band",
  "minStep",
  "maxStep",
];
export function capturePreset(view, kind) {
  const p = normalizePaper(view.paper);
  if (kind === "settings")
    return {
      ...Object.fromEntries(SETTING_KEYS.map((k) => [k, view[k]])),
      visibility: Object.fromEntries(
        Object.entries(p.series).map(([id, s]) => [id, !!s.hidden]),
      ),
    };
  if (kind === "style")
    return {
      ...p,
      series: Object.fromEntries(
        Object.entries(p.series).map(([id, { hidden, ...s }]) => [id, s]),
      ),
    };
  throw Error("Invalid preset kind");
}
export function applyPreset(view, kind, value) {
  const p = normalizePaper(view.paper);
  if (kind === "settings")
    return {
      ...view,
      ...Object.fromEntries(
        SETTING_KEYS.filter((k) => Object.hasOwn(value, k)).map((k) => [
          k,
          value[k],
        ]),
      ),
      paper: normalizePaper({
        ...p,
        series: Object.fromEntries(
          [
            ...new Set([
              ...Object.keys(p.series),
              ...Object.keys(value.visibility ?? {}),
            ]),
          ].map((id) => [
            id,
            { ...p.series[id], hidden: value.visibility?.[id] ?? false },
          ]),
        ),
      }),
    };
  if (kind === "style") {
    const style = normalizePaper(value);
    return {
      ...view,
      paper: normalizePaper({
        ...style,
        series: Object.fromEntries(
          [
            ...new Set([
              ...Object.keys(style.series),
              ...Object.keys(p.series),
            ]),
          ].map((id) => [
            id,
            { ...style.series[id], hidden: p.series[id]?.hidden ?? false },
          ]),
        ),
      }),
    };
  }
  throw Error("Invalid preset kind");
}
