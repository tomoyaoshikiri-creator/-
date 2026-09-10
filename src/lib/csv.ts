function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Excelでの文字化けを避けるため先頭にUTF-8 BOMを付与する。
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
