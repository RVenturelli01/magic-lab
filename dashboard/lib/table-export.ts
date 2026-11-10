import { downloadBlob } from "./download";

export type TableFormat = "csv" | "tsv" | "json" | "png";

function exportTablePng(
  title: string,
  headers: string[],
  rows: string[][],
  filename: string,
) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PNG export is unavailable in this browser.");
  context.font = "14px Arial, sans-serif";
  const columns = headers.map((header, index) =>
    Math.min(
      480,
      Math.max(
        120,
        context.measureText(header).width + 32,
        rows.reduce(
          (maximum, row) =>
            Math.max(maximum, context.measureText(row[index] ?? "").width + 32),
          0,
        ),
      ),
    ),
  );
  const width = Math.max(
    360,
    columns.reduce((sum, column) => sum + column, 0) + 32,
  );
  const height = 92 + (rows.length + 1) * 40 + 16;
  const scale = Math.min(2, 16384 / width, 16384 / height);
  if (scale < 1)
    throw new Error("This table is too large to export as one PNG.");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  context.scale(scale, scale);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#25334a";
  context.font = "bold 20px Arial, sans-serif";
  context.fillText(title, 16, 38, width - 32);
  context.font = "14px Arial, sans-serif";
  const drawCell = (
    value: string,
    x: number,
    y: number,
    columnWidth: number,
  ) => {
    context.save();
    context.beginPath();
    context.rect(x + 12, y, columnWidth - 24, 40);
    context.clip();
    context.fillText(value, x + 12, y + 26);
    context.restore();
  };
  [headers, ...rows].forEach((row, rowIndex) => {
    const y = 76 + rowIndex * 40;
    context.fillStyle =
      rowIndex === 0 ? "#eef2f7" : rowIndex % 2 === 0 ? "#f8fafc" : "#ffffff";
    context.fillRect(16, y, width - 32, 40);
    context.fillStyle = "#dce2ea";
    context.fillRect(16, y + 39, width - 32, 1);
    context.fillStyle = "#25334a";
    context.font =
      rowIndex === 0 ? "bold 14px Arial, sans-serif" : "14px Arial, sans-serif";
    let x = 16;
    columns.forEach((columnWidth, index) => {
      drawCell(row[index] ?? "", x, y, columnWidth);
      x += columnWidth;
    });
  });
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `${filename}.png`;
  link.click();
}

export function exportTable(
  title: string,
  headers: string[],
  rows: string[][],
  format: TableFormat,
) {
  const filename = title.trim().replace(/[^a-z0-9-_]+/gi, "-") || "table";
  if (format === "png") {
    exportTablePng(title, headers, rows, filename);
    return;
  }
  const quote = (cell: string) => {
    const safe = /^[=+@\-\t\r]/.test(cell) ? `'${cell}` : cell;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const content =
    format === "json"
      ? JSON.stringify({ title, columns: headers, rows }, null, 2)
      : [headers, ...rows]
          .map((row) => row.map(quote).join(format === "csv" ? "," : "\t"))
          .join("\r\n");
  const type =
    format === "json"
      ? "application/json"
      : format === "csv"
        ? "text/csv"
        : "text/tab-separated-values";
  downloadBlob(
    new Blob([format === "json" ? "" : "\ufeff", content], {
      type: `${type};charset=utf-8`,
    }),
    `${filename}.${format}`,
  );
}
