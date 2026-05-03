// VIPOS — Tabular export helpers (P1-17 Reports).
//
// Supports CSV (built-in), Excel xlsx (SheetJS), dan PDF (jsPDF + autoTable).
// Bertekstur "rows of {key→value}" + "columns metadata" (key, label, format).
// Format hook: 'currency' | 'number' | 'date' | 'datetime' | passthrough.

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

export function exportXlsx({ filename, columns, rows, sheetName = 'Report' }) {
  const aoa = [
    columns.map((c) => c.label),
    ...rows.map((row) => columns.map((c) => rawCell(row[c.key], c.format))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Auto-width: pakai length konten terpanjang per kolom.
  ws['!cols'] = columns.map((c) => {
    const cellWidths = rows.map((row) => String(rawCell(row[c.key], c.format)).length);
    const max = Math.max(c.label.length, ...cellWidths, 8);
    return { wch: Math.min(max + 2, 40) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function exportPdf({ filename, title, subtitle, columns, rows, orientation = 'landscape' }) {
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
