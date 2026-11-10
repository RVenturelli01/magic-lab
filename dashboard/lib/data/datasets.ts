export type DatasetCell = string | number | boolean | null;
export type Dataset = {
  id: string;
  name: string;
  format: "CSV" | "JSON";
  importedAt: string;
  isSample?: boolean;
  columns: string[];
  rows: DatasetCell[][];
};

export const datasetByteLimit = 20 * 1024 * 1024;

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const pushCell = () => {
    row.push(cell);
    cell = "";
    closed = false;
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += char;
    } else if (char === ",") pushCell();
    else if (char === "\n" || char === "\r") {
      pushCell();
      rows.push(row);
      row = [];
      if (char === "\r" && text[i + 1] === "\n") i++;
    } else if (char === '"' && !cell && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new Error("Invalid CSV quoting.");
      cell += char;
    }
  }
  if (quoted) throw new Error("Unclosed CSV quoted field.");
  if (cell || row.length || closed) {
    pushCell();
    rows.push(row);
  }
  return rows;
}

export function parseDataset(name: string, text: string): Dataset {
  text = text.replace(/^\uFEFF/, "");
  let columns: string[], rows: DatasetCell[][];
  const format = /\.csv$/i.test(name)
    ? "CSV"
    : /\.json$/i.test(name)
      ? "JSON"
      : null;
  if (!format) throw new Error("Choose a CSV or JSON file.");
  if (format === "CSV") {
    const parsed = csvRows(text);
    columns = parsed.shift() ?? [];
    rows = parsed.map((row, index) => {
      if (row.length !== columns.length)
        throw new Error(
          `CSV record ${index + 2} has ${row.length} fields; expected ${columns.length}.`,
        );
      // Preserve source text, including identifiers with leading zeros.
      return row.map((value) => (value === "" ? null : value));
    });
  } else {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed) || !parsed.length)
      throw new Error("JSON must contain a nonempty array of objects.");
    const records = parsed as Record<string, unknown>[];
    if (
      records.some(
        (record) =>
          !record || typeof record !== "object" || Array.isArray(record),
      )
    )
      throw new Error("Each JSON row must be an object.");
    columns = [...new Set(records.flatMap(Object.keys))];
    rows = records.map((record) =>
      columns.map((key) => {
        const value = Object.hasOwn(record, key) ? record[key] : null;
        if (
          value === null ||
          typeof value === "string" ||
          typeof value === "boolean" ||
          (typeof value === "number" && Number.isFinite(value))
        )
          return value;
        throw new Error(
          `Column “${key}” contains a nested or unsupported value. Use scalar values or null.`,
        );
      }),
    );
  }
  if (
    !columns.length ||
    columns.some((column) => !column.trim()) ||
    new Set(columns).size !== columns.length
  )
    throw new Error("Column names must be nonempty and unique.");
  return {
    id: crypto.randomUUID(),
    name,
    format,
    importedAt: new Date().toISOString(),
    columns,
    rows,
  };
}

export function profileDataset(dataset: Dataset) {
  return dataset.columns.map((name, index) => {
    const values = dataset.rows
      .map((row) => row[index])
      .filter((value) => value !== null && value !== "");
    const numeric =
      values.length > 0 &&
      values.every(
        (value) =>
          typeof value !== "boolean" &&
          (typeof value === "number" ||
            (typeof value === "string" &&
              value.trim() !== "" &&
              Number.isFinite(Number(value)))),
      );
    let min = Infinity,
      max = -Infinity,
      mean = 0;
    if (numeric)
      for (const value of values) {
        const number = Number(value);
        min = Math.min(min, number);
        max = Math.max(max, number);
        mean += number / values.length;
      }
    return {
      name,
      type: numeric
        ? "Numeric"
        : !values.length
          ? "Empty"
          : values.every((value) => typeof value === "boolean")
            ? "Boolean"
            : "Text / mixed",
      missing: dataset.rows.length - values.length,
      unique: new Set(values).size,
      min: numeric ? min : null,
      max: numeric ? max : null,
      mean: numeric ? mean : null,
    };
  });
}
