export const canonical = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
export const valueKey = (value) =>
  canonical(value === undefined ? { missing: true } : { value });
export const valueLabel = (value) =>
  value === undefined
    ? "(missing)"
    : value === null
      ? "null"
      : typeof value === "string"
        ? value
        : canonical(value);
const escapePart = (part) => part.replaceAll("~", "~0").replaceAll("/", "~1");
export function fieldValue(run, field) {
  let value = run;
  for (const part of field
    .slice(1)
    .split("/")
    .map((p) => p.replaceAll("~1", "/").replaceAll("~0", "~"))) {
    if (!value || typeof value !== "object" || !Object.hasOwn(value, part))
      return undefined;
    value = value[part];
  }
  return value;
}
export function fieldLabel(field) {
  if (field === "/code/commit") return "Code version";
  const parts = field
    .slice(1)
    .split("/")
    .map((p) => p.replaceAll("~1", "/").replaceAll("~0", "~"));
  if (parts[0] === "config" && parts.length > 1)
    return parts.slice(1).join(" · ");
  const labels = {
    id: "Run",
    name: "Run name",
    algorithm: "Algorithm",
    environment: "Environment",
    status: "Status",
    seed: "Seed",
    config: "Config",
    code: "Code",
  };
  return parts
    .map((part, i) => (i === 0 ? labels[part] || part : part))
    .join(" · ");
}
export function fieldOptions(runs, field) {
  const values = new Map();
  for (const run of runs) {
    const value = fieldValue(run, field);
    const key = valueKey(value);
    values.set(key, {
      key,
      label: valueLabel(value),
      value,
    });
  }
  const options = [...values.values()],
    counts = new Map();
  for (const option of options)
    counts.set(option.label, (counts.get(option.label) || 0) + 1);
  for (const option of options)
    if (counts.get(option.label) > 1)
      option.label +=
        " · " +
        (option.value === null
          ? "null"
          : Array.isArray(option.value)
            ? "array"
            : typeof option.value);
  return options.sort((a, b) => {
    if (a.value === undefined) return 1;
    if (b.value === undefined) return -1;
    if (typeof a.value === "number" && typeof b.value === "number")
      return a.value - b.value;
    return a.label.localeCompare(b.label, undefined, { numeric: true });
  });
}
export function filterFields(runs) {
  const fields = new Set([
    "/id",
    "/algorithm",
    "/environment",
    "/status",
    "/seed",
    "/code/commit",
  ]);
  const walk = (value, parts) => {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length
    ) {
      for (const [key, child] of Object.entries(value))
        walk(child, [...parts, key]);
    } else fields.add("/" + parts.map(escapePart).join("/"));
  };
  for (const run of runs)
    for (const [key, value] of Object.entries(run)) walk(value, [key]);
  return [...fields].map((field) => ({
    field,
    label: fieldLabel(field),
    options: fieldOptions(runs, field),
  }));
}
// Useful experiment controls; variable config/provenance fields exclude bookkeeping.
export function ablationFilterFields(runs, fields = filterFields(runs)) {
  return fields.filter(
    ({ field, options }) =>
      [
        "/seed",
        "/status",
        "/algorithm",
        "/environment",
        "/code/commit",
      ].includes(field) ||
      (options.length > 1 &&
        (field.startsWith("/config/") || field.startsWith("/code/"))),
  );
}
export function normalizeFilters(filters, runs = []) {
  if (!Array.isArray(filters)) throw Error("Invalid filters");
  return filters.map((rule) => {
    if (
      !rule ||
      typeof rule.field !== "string" ||
      !rule.field.startsWith("/") ||
      /~(?![01])/u.test(rule.field) ||
      !Array.isArray(rule.values) ||
      rule.values.some((v) => typeof v !== "string")
    )
      throw Error("Invalid filter rule");
    if (
      rule.operator !== undefined &&
      !["is", "is not", "in", "not in"].includes(rule.operator)
    )
      throw Error("Invalid legacy filter operator");
    let values = [...new Set(rule.values)];
    if (
      (rule.operator === "is" || rule.operator === "is not") &&
      values.length > 1
    )
      throw Error("Invalid legacy single-value filter");
    for (const key of values) {
      let parsed;
      try {
        parsed = JSON.parse(key);
      } catch {
        throw Error("Invalid filter value");
      }
      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed) ||
        Object.keys(parsed).length !== 1 ||
        !(parsed.missing === true || Object.hasOwn(parsed, "value")) ||
        canonical(parsed) !== key
      )
        throw Error("Invalid filter value");
    }
    if (
      (rule.operator === "is not" || rule.operator === "not in") &&
      values.length
    ) {
      values = fieldOptions(runs, rule.field)
        .map((option) => option.key)
        .filter((key) => !values.includes(key));
      if (!values.length) values = [valueKey({ legacyNoMatch: true })];
    }
    return { field: rule.field, values };
  });
}
export function matchesFilters(run, filters) {
  return filters.every(
    (rule) =>
      !rule.values.length ||
      rule.values.includes(valueKey(fieldValue(run, rule.field))),
  );
}
export function legacyFilters(view, runs) {
  const rules = [];
  for (const field of ["algorithm", "environment", "status"])
    if (view[field] && view[field] !== "all")
      rules.push({ field: "/" + field, values: [valueKey(view[field])] });
  if (view.search) {
    const ids = runs
      .filter((r) =>
        [
          r.id,
          r.algorithm,
          r.environment,
          r.seed,
          r.code.commit,
          JSON.stringify(r.config),
        ]
          .join(" ")
          .toLowerCase()
          .includes(view.search.toLowerCase()),
      )
      .map((r) => valueKey(r.id));
    // No legacy search hits must keep an empty result, rather than create an inactive draft.
    rules.push({
      field: "/id",
      operator: "in",
      values: ids.length ? ids : [valueKey({ legacySearchNoMatch: true })],
    });
  }
  return rules;
}
