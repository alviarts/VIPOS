// VIPOS — Tabular export helpers (P1-17 Reports).
//
// Supports CSV (built-in), Excel xlsx (exceljs), dan PDF (jsPDF + autoTable).
// Bertekstur "rows of {key→value}" + "columns metadata" (key, label, format).
// Format hook: 'currency' | 'number' | 'date' | 'datetime' | passthrough.
//
// exceljs + jspdf + jspdf-autotable di-load via dynamic import supaya
// bundle awal Reports tidak nyangkut lib export yang berat. Lib baru ditarik
// pertama kali user klik tombol Export Excel/PDF.
//
// exceljs replaces SheetJS (xlsx@0.18.5) which had unfixable high-severity
// CVEs (GHSA-4r6h-8v6p-xvw6 Prototype Pollution + GHSA-5pgg-2g8v-p4x9 ReDoS).
// SheetJS moved newer versions off the npm registry, so xlsx@<0.20.2 had no
// upgrade path on npm. exceljs has a similar Workbook API + writeBuffer()
// that we wrap in a Blob for browser download.

import { formatCurrency, formatDate, formatDateTime, formatNumber } from './format';

function formatCell(value, type) {
  if (value === null || value === undefined) return '';
  switch (type) {
    case 'currency':
      return formatCurrency(Number(value) || 0);
    case 'number':
      return formatNumber(Number(value) || 0);
    case 'date':
      return formatDate(value);
    case 'datetime':
      return formatDateTime(value);
    default:
      return String(value);
  }
}

function rawCell(value, type) {
  if (value === null || value === undefined) return '';
  if (type === 'number' || type === 'currency') return Number(value) || 0;
  return value;
}

function escapeCsv(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCsv({ filename, columns, rows }) {
  const header = columns.map((c) => escapeCsv(c.label)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escapeCsv(rawCell(row[c.key], c.format))).join(','))
    .join('\n');
  const csv = `${header}\n${body}\n`;
  // Prepend UTF-8 BOM so Excel opens files correctly with Indonesian chars.
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

export async function exportXlsx({ filename, columns, rows, sheetName = 'Report' }) {
  // exceljs ships both an ESM and CJS entry; some bundlers expose the
  // Workbook class on the module's `default` export, others promote it
  // to a named symbol. Normalize to the namespace that owns `Workbook`
  // either way.
  const mod = await import('exceljs');
  const ExcelJS = mod.Workbook ? mod : (mod.default ?? mod);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  // Header row
  sheet.addRow(columns.map((c) => c.label));
  // Body rows
  for (const row of rows) {
    sheet.addRow(columns.map((c) => rawCell(row[c.key], c.format)));
  }

  // Auto-width per column — parity with the prior SheetJS `!cols` setting.
  // exceljs columns are 1-indexed via getColumn(idx).
  columns.forEach((c, i) => {
    const cellWidths = rows.map((row) => String(rawCell(row[c.key], c.format)).length);
    const max = Math.max(c.label.length, ...cellWidths, 8);
    sheet.getColumn(i + 1).width = Math.min(max + 2, 40);
  });

  // writeBuffer() returns Promise<Buffer> in node and Promise<ArrayBuffer>
  // in the browser; both wrap fine in a Blob.
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export async function exportPdf({
  filename,
  title,
  subtitle,
  columns,
  rows,
  orientation = 'landscape',
}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
  doc.setFontSize(14);
  doc.text(title || 'Laporan', 40, 40);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(subtitle, 40, 56);
    doc.setTextColor(0);
  }
  autoTable(doc, {
    startY: subtitle ? 70 : 56,
    head: [columns.map((c) => c.label)],
    body: rows.map((row) => columns.map((c) => formatCell(row[c.key], c.format))),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [4, 201, 158], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 250, 248] },
    margin: { left: 40, right: 40 },
  });
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export function exportJson({ filename, rows }) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  downloadBlob(blob, filename.endsWith('.json') ? filename : `${filename}.json`);
}

export function formatValue(value, type) {
  return formatCell(value, type);
}
