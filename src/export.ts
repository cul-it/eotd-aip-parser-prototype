import type { DisplayRow, ParsedItem } from "./types";

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function toCsv(rows: DisplayRow[]): string {
  const header = "Field,Value,Source";
  const csvRows = rows.map(
    (r) =>
      `${escapeCsvField(r.name)},${escapeCsvField(r.value)},${escapeCsvField(r.source)}`
  );
  return [header, ...csvRows].join("\n");
}

export function toJson(item: ParsedItem): string {
  return JSON.stringify(item, null, 2);
}
