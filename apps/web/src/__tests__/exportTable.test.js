// VIPOS — exportTable utility regression tests.
//
// Coverage: CSV escaping/BOM/format handling, JSON download, formatValue
// dispatch. Async exporters (exportXlsx, exportPdf) tidak ditest di sini
// karena butuh mock xlsx/jspdf yang heavy; coverage-nya ada di
// ExportButtons.test.jsx via integration-style mock.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { exportCsv, exportJson, formatValue } from '../utils/exportTable';

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
