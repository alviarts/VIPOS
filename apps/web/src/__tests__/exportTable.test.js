// VIPOS — exportTable utility regression tests.
//
// Coverage: CSV escaping/BOM/format handling, JSON download, formatValue
// dispatch, plus a real exceljs round-trip for exportXlsx (load back the
// generated buffer and assert sheet/row/cell shape). exportPdf tidak
// ditest di sini karena butuh mock jspdf yang heavy; coverage-nya ada di
// ExportButtons.test.jsx via integration-style mock.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { exportCsv, exportJson, exportXlsx, formatValue } from '../utils/exportTable';

// Capture downloadBlob calls by stubbing URL.createObjectURL +
// HTMLAnchorElement.click. We don't actually need the file to land
// on disk — we just want to inspect the Blob content + filename.

function setupBlobCapture() {
  const captured = {
    blob: null,
    parts: null,
    type: null,
    url: null,
    filename: null,
    clickCount: 0,
  };

  const origCreate = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  const OrigBlob = window.Blob;

  // jsdom's Blob doesn't implement async .text() in some versions, so wrap
  // it with a sync `.parts` accessor that joins the original BlobPart array
  // back to a string. We still keep the real Blob for type/size assertions.
  class CapturingBlob extends OrigBlob {
    constructor(parts, options) {
      super(parts, options);
      this._parts = parts;
      this._opts = options;
    }
  }
  window.Blob = CapturingBlob;

  URL.createObjectURL = vi.fn((blob) => {
    captured.blob = blob;
    captured.parts = blob?._parts ?? null;
    captured.type = blob?.type ?? null;
    captured.url = `blob:mock:${blob?.size ?? 0}`;
    return captured.url;
  });
  URL.revokeObjectURL = vi.fn();

  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    captured.filename = this.download;
    captured.clickCount += 1;
  });

  return {
    captured,
    cleanup: () => {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
      window.Blob = OrigBlob;
      clickSpy.mockRestore();
    },
  };
}

function blobText(captured) {
  // Join all string-like parts (jsdom passes through raw strings).
  return (captured.parts ?? []).map((p) => (typeof p === 'string' ? p : '')).join('');
}

const columns = [
  { key: 'name', label: 'Nama' },
  { key: 'price', label: 'Harga', format: 'currency' },
  { key: 'qty', label: 'Qty', format: 'number' },
  { key: 'created_at', label: 'Dibuat', format: 'date' },
];

const rows = [
  {
    name: 'Kopi Susu, "Klasik"',
    price: 25000,
    qty: 10,
    created_at: '2025-12-01T10:00:00Z',
  },
  {
    name: 'Es Teh\nManis',
    price: 8000,
    qty: 5,
    created_at: '2025-12-02T11:30:00Z',
  },
];

describe('exportCsv', () => {
  let blob;
  beforeEach(() => {
    blob = setupBlobCapture();
  });
  afterEach(() => {
    blob.cleanup();
  });

  it('writes UTF-8 BOM + header row + body rows', () => {
    exportCsv({ filename: 'laporan.csv', columns, rows });
    expect(blob.captured.clickCount).toBe(1);
    expect(blob.captured.filename).toBe('laporan.csv');
    const text = blobText(blob.captured);
    // \ufeff = UTF-8 BOM.
    expect(text.startsWith('\ufeff')).toBe(true);
    expect(text).toContain('Nama,Harga,Qty,Dibuat');
  });

  it('appends .csv extension if filename lacks it', () => {
    exportCsv({ filename: 'laporan', columns, rows });
    expect(blob.captured.filename).toBe('laporan.csv');
  });

  it('quotes fields containing comma or double-quote and escapes inner quotes', () => {
    exportCsv({ filename: 'q.csv', columns, rows });
    const text = blobText(blob.captured);
    // 'Kopi Susu, "Klasik"' should become "Kopi Susu, ""Klasik"""
    expect(text).toContain('"Kopi Susu, ""Klasik"""');
  });

  it('quotes fields containing newline so CSV stays single-row-per-record', () => {
    exportCsv({ filename: 'q.csv', columns, rows });
    const text = blobText(blob.captured);
    // 'Es Teh\nManis' should be wrapped in double-quotes.
    expect(text).toContain('"Es Teh\nManis"');
  });

  it('emits raw numeric values for currency / number columns (no Rp prefix or thousands sep)', () => {
    exportCsv({ filename: 'q.csv', columns, rows });
    const text = blobText(blob.captured);
    // Both `25000` and `10` should appear unformatted in CSV cells.
    expect(text).toMatch(/[,\n]25000[,\n]/);
    expect(text).toMatch(/[,\n]10[,\n]/);
    // Should NOT have currency formatting.
    expect(text).not.toContain('Rp');
  });

  it('emits empty string for null/undefined cells', () => {
    const sparseRows = [{ name: 'Item', price: null, qty: undefined, created_at: '' }];
    exportCsv({ filename: 'q.csv', columns, rows: sparseRows });
    const text = blobText(blob.captured);
    // Body line should be: Item,,,
    expect(text).toContain('Item,,,');
  });

  it('serves blob with text/csv;charset=utf-8 content-type', () => {
    exportCsv({ filename: 'q.csv', columns, rows });
    expect(blob.captured.type).toMatch(/text\/csv/);
    expect(blob.captured.type).toMatch(/utf-8/);
  });
});

describe('exportJson', () => {
  let blob;
  beforeEach(() => {
    blob = setupBlobCapture();
  });
  afterEach(() => {
    blob.cleanup();
  });

  it('writes pretty-printed JSON with .json extension', () => {
    exportJson({ filename: 'data', rows });
    expect(blob.captured.filename).toBe('data.json');
    const text = blobText(blob.captured);
    const parsed = JSON.parse(text);
    expect(parsed).toEqual(rows);
    // Pretty-printed (indented). `JSON.stringify(rows, null, 2)` indents
    // the array item by 2 spaces and the object key by another 2 = 4.
    expect(text).toMatch(/\n {4}"name"/);
  });

  it('preserves explicit .json extension', () => {
    exportJson({ filename: 'data.json', rows });
    expect(blob.captured.filename).toBe('data.json');
  });

  it('serves blob with application/json content-type', () => {
    exportJson({ filename: 'd', rows });
    expect(blob.captured.type).toMatch(/application\/json/);
  });
});

describe('exportXlsx (exceljs round-trip)', () => {
  let blob;
  beforeEach(() => {
    blob = setupBlobCapture();
  });
  afterEach(() => {
    blob.cleanup();
  });

  // Helper: extract the binary part the SUT passed to `new Blob([...])`.
  // setupBlobCapture's CapturingBlob preserves the raw `parts` array.
  // exceljs's writeBuffer() returns either Buffer (node) or ArrayBuffer
  // (browser). Both are valid first args to `Blob()` and both are valid
  // `xlsx.load()` inputs for exceljs's reader.
  function getXlsxBuffer(captured) {
    return captured.parts?.[0];
  }

  it('appends .xlsx extension if filename lacks it', async () => {
    await exportXlsx({ filename: 'rep', columns, rows, sheetName: 'S' });
    expect(blob.captured.filename).toBe('rep.xlsx');
  });

  it('preserves explicit .xlsx extension', async () => {
    await exportXlsx({ filename: 'rep.xlsx', columns, rows, sheetName: 'S' });
    expect(blob.captured.filename).toBe('rep.xlsx');
  });

  it('serves blob with spreadsheetml content-type', async () => {
    await exportXlsx({ filename: 'rep.xlsx', columns, rows, sheetName: 'S' });
    expect(blob.captured.type).toMatch(/spreadsheetml/);
  });

  it('writes a parseable xlsx with header row + body rows + sheet name', async () => {
    await exportXlsx({ filename: 'rep.xlsx', columns, rows, sheetName: 'Penjualan' });
    const buf = getXlsxBuffer(blob.captured);
    expect(buf).toBeTruthy();

    // Load the buffer back through exceljs to confirm the bytes are a
    // valid xlsx archive with the structure we expect. This is the
    // strongest regression guarantee we can give for the migration.
    const mod = await import('exceljs');
    const ExcelJS = mod.Workbook ? mod : (mod.default ?? mod);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const sheet = wb.getWorksheet('Penjualan');
    expect(sheet).toBeDefined();

    // Row 1: column labels.
    expect(sheet.getRow(1).getCell(1).value).toBe('Nama');
    expect(sheet.getRow(1).getCell(2).value).toBe('Harga');
    expect(sheet.getRow(1).getCell(3).value).toBe('Qty');

    // Row 2: first data row. `rawCell` returns Number(...) for currency
    // and number columns; date columns pass through (string ISO).
    expect(sheet.getRow(2).getCell(1).value).toBe('Kopi Susu, "Klasik"');
    expect(sheet.getRow(2).getCell(2).value).toBe(25000);
    expect(sheet.getRow(2).getCell(3).value).toBe(10);

    // Row 3: second data row.
    expect(sheet.getRow(3).getCell(1).value).toBe('Es Teh\nManis');
    expect(sheet.getRow(3).getCell(2).value).toBe(8000);
    expect(sheet.getRow(3).getCell(3).value).toBe(5);
  });

  it('sets per-column auto-width with the same heuristic as the prior SheetJS path', async () => {
    await exportXlsx({ filename: 'rep.xlsx', columns, rows, sheetName: 'S' });
    const buf = getXlsxBuffer(blob.captured);
    const mod = await import('exceljs');
    const ExcelJS = mod.Workbook ? mod : (mod.default ?? mod);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const sheet = wb.getWorksheet('S');

    // Heuristic mirrors exportXlsx: max(label.length, longest cell, 8) + 2,
    // capped at 40. For the 'Nama' column, longest cell is
    // 'Kopi Susu, "Klasik"' (19 chars) → width = min(19+2, 40) = 21.
    expect(sheet.getColumn(1).width).toBe(21);
    // 'Harga' column: longest raw cell is 25000 (5 chars). label is 5
    // chars. min length floor is 8 → width = 8+2 = 10.
    expect(sheet.getColumn(2).width).toBe(10);
  });

  it('handles empty rows array (header-only sheet)', async () => {
    await exportXlsx({ filename: 'empty.xlsx', columns, rows: [], sheetName: 'Empty' });
    const buf = getXlsxBuffer(blob.captured);
    const mod = await import('exceljs');
    const ExcelJS = mod.Workbook ? mod : (mod.default ?? mod);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const sheet = wb.getWorksheet('Empty');
    expect(sheet.getRow(1).getCell(1).value).toBe('Nama');
    // No data rows beyond header.
    expect(sheet.actualRowCount).toBe(1);
  });

  it('emits empty-string cells for null / undefined values', async () => {
    const sparseRows = [{ name: 'Item', price: null, qty: undefined, created_at: '' }];
    await exportXlsx({ filename: 'sparse.xlsx', columns, rows: sparseRows, sheetName: 'S' });
    const buf = getXlsxBuffer(blob.captured);
    const mod = await import('exceljs');
    const ExcelJS = mod.Workbook ? mod : (mod.default ?? mod);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const sheet = wb.getWorksheet('S');
    // exceljs reads empty-string cells back as null when the cell is
    // truly blank in the file. Both '' (the SUT writes) and null (what
    // exceljs returns for blank cells) are acceptable here.
    const c2 = sheet.getRow(2).getCell(2).value;
    const c3 = sheet.getRow(2).getCell(3).value;
    expect(c2 === '' || c2 === null).toBe(true);
    expect(c3 === '' || c3 === null).toBe(true);
  });
});

describe('formatValue', () => {
  it('formats currency to localized rupiah string', () => {
    const out = formatValue(25000, 'currency');
    expect(out).toMatch(/Rp/);
    expect(out).toMatch(/25\.000|25,000/);
  });

  it('formats numbers with thousands separator', () => {
    const out = formatValue(1234567, 'number');
    expect(out).toMatch(/1[,.]234[,.]567/);
  });

  it('formats date types', () => {
    const out = formatValue('2025-12-01T10:00:00Z', 'date');
    expect(out).toBeTruthy();
    expect(typeof out).toBe('string');
  });

  it('returns String(value) for unknown types', () => {
    expect(formatValue('hello', undefined)).toBe('hello');
    expect(formatValue(42, 'mystery')).toBe('42');
  });

  it('returns empty string for null / undefined', () => {
    expect(formatValue(null, 'currency')).toBe('');
    expect(formatValue(undefined, 'number')).toBe('');
  });
});
