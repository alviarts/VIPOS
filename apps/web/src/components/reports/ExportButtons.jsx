// P1-17 — Export buttons (CSV / xlsx / PDF / JSON).
//
// Pakai sebagai child di ReportTemplate. Memanggil util di
// `apps/web/src/utils/exportTable.js`. Bisa di-disable kalau rows kosong.
//
// exceljs + jspdf (~390 kB) + jspdf-autotable adalah lazy chunks
// (lihat exportTable.js). Default-nya, chunk baru di-fetch saat user
// klik 'Export Excel' / 'Export PDF', yang artinya ada delay perceptible
// di first-click. Untuk masking delay tersebut, kita prefetch chunk-nya
// sekali user buka dropdown — itu adalah signal yang sangat kuat user
// akan klik salah satu format dalam waktu dekat. Prefetch idempotent:
// `import()` cache-nya di module map, jadi panggilan berikutnya gratis.
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, FileSpreadsheet, FileText, Code2, ChevronDown, Loader2 } from 'lucide-react';
import { exportCsv, exportXlsx, exportPdf, exportJson } from '../../utils/exportTable';

// Fire-and-forget prefetch utama. Errors di-swallow karena prefetch
// adalah pure optimization — kalau gagal, real export click akan retry
// dan surface error ke user via toast.
function prefetchExportChunks(formats) {
  if (formats.includes('xlsx')) {
    import('exceljs').catch(() => {});
  }
  if (formats.includes('pdf')) {
    import('jspdf').catch(() => {});
    import('jspdf-autotable').catch(() => {});
  }
}

export default function ExportButtons({
  filename,
  title,
  subtitle,
  columns,
  rows,
  disabled = false,
  formats = ['csv', 'xlsx', 'pdf', 'json'],
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const prefetched = useRef(false);
  const safeRows = Array.isArray(rows) ? rows : [];
  const isDisabled = disabled || safeRows.length === 0 || busy;

  // Prefetch heavy export chunks on first dropdown open. Idempotent via
  // the `prefetched` ref — `import()` is also internally cached, but
  // gating with the ref avoids re-walking the formats array each time
  // the dropdown re-opens.
  useEffect(() => {
    if (open && !prefetched.current) {
      prefetched.current = true;
      prefetchExportChunks(formats);
    }
  }, [open, formats]);

  const handleExport = async (fmt) => {
    setOpen(false);
    const opts = { filename, title, subtitle, columns, rows: safeRows };
    try {
      if (fmt === 'csv') exportCsv(opts);
      else if (fmt === 'json') exportJson(opts);
      else if (fmt === 'xlsx') {
        setBusy(true);
        await exportXlsx(opts);
      } else if (fmt === 'pdf') {
        setBusy(true);
        await exportPdf(opts);
      }
    } catch (err) {
      // Dynamic import (exceljs / jspdf chunk) bisa gagal karena network /
      // browser cache miss. Surface ke user supaya tidak silent.
      console.error('Export gagal:', err);
      toast.error(`Export ${fmt.toUpperCase()} gagal: ${err?.message || 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isDisabled}
        className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="report-export-trigger"
        aria-busy={busy}
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Memuat…
          </>
        ) : (
          <>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>
      {open && !isDisabled && (
        <div
          className="absolute right-0 z-20 mt-2 w-44 rounded-md border border-gray-200 bg-white shadow-lg ring-1 ring-black/5"
          role="menu"
        >
          <ul className="py-1 text-sm">
            {formats.includes('csv') && (
              <li>
                <button
                  type="button"
                  onClick={() => handleExport('csv')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
                >
                  <FileText className="h-4 w-4 text-gray-500" /> Export CSV
                </button>
              </li>
            )}
            {formats.includes('xlsx') && (
              <li>
                <button
                  type="button"
                  onClick={() => handleExport('xlsx')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export Excel
                </button>
              </li>
            )}
            {formats.includes('pdf') && (
              <li>
                <button
                  type="button"
                  onClick={() => handleExport('pdf')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
                >
                  <FileText className="h-4 w-4 text-red-600" /> Export PDF
                </button>
              </li>
            )}
            {formats.includes('json') && (
              <li>
                <button
                  type="button"
                  onClick={() => handleExport('json')}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
                >
                  <Code2 className="h-4 w-4 text-gray-500" /> Export JSON
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
