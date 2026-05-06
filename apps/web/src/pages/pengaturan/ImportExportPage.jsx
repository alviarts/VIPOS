// Import/Export — bulk operation per entity (CSV).
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Upload } from 'lucide-react';
import api from '../../utils/api';
import { PageHeader } from '../../components/ui';

const ENTITY_LABEL = {
  products: 'Produk',
  customers: 'Pelanggan',
  employees: 'Karyawan',
  gl_accounts: 'Daftar Akun (CoA)',
  gl_vendors: 'Vendor',
};

export default function ImportExportPage() {
  const [entities, setEntities] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const [importEntity, setImportEntity] = useState('');

  useEffect(() => {
    api
      .get('/import-export/entities')
      .then((r) => setEntities(r.data || []))
      .catch(() => {});
  }, []);

  async function handleExport(entity) {
    setBusy(true);
    try {
      const res = await api.get(`/import-export/export/${entity}?format=csv`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entity}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${ENTITY_LABEL[entity] || entity} di-export`);
    } catch (_err) {
      toast.error('Gagal export');
    } finally {
      setBusy(false);
    }
  }

  function pickImportFile(entity) {
    setImportEntity(entity);
    fileRef.current?.click();
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file || !importEntity) return;
    setBusy(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast.error('File CSV kosong');
        return;
      }
      const r = await api.post(`/import-export/import/${importEntity}`, { rows });
      setImportResult({ entity: importEntity, ...r.data });
      toast.success(`${r.data.inserted} baris diimport, ${r.data.errors?.length || 0} error`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal import');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import / Export Data"
        subtitle="Bulk operation per entitas. Format CSV. Pastikan struktur kolom sesuai database."
      />

      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        onChange={handleImportFile}
        className="hidden"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {entities.map((e) => (
          <div key={e.entity} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-gray-500">{e.entity}</p>
                <h3 className="text-base font-semibold">{ENTITY_LABEL[e.entity] || e.entity}</h3>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport(e.entity)}
                disabled={busy}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-100 disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
              <button
                onClick={() => pickImportFile(e.entity)}
                disabled={busy}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" /> Import CSV
              </button>
            </div>
          </div>
        ))}
      </div>

      {importResult && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold">
            Hasil Import — {ENTITY_LABEL[importResult.entity] || importResult.entity}
          </h3>
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-green-600">{importResult.inserted}</span> baris
            sukses diimport.
          </p>
          {importResult.errors && importResult.errors.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold text-red-700">
                {importResult.errors.length} error:
              </p>
              <div className="max-h-48 overflow-auto rounded border border-red-100 bg-red-50 p-2 text-xs">
                {importResult.errors.slice(0, 20).map((er, i) => (
                  <div key={i} className="mb-1 font-mono text-[11px]">
                    {er.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-800">
        <p className="font-semibold">Tips:</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          <li>Lakukan Export dulu untuk melihat struktur kolom yang dibutuhkan.</li>
          <li>Edit CSV di Excel/Sheets, lalu Import balik.</li>
          <li>
            Kolom <code className="rounded bg-white px-1">id</code> diabaikan saat import.
          </li>
        </ul>
      </div>
    </div>
  );
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] === '' ? null : cells[i];
    });
    return obj;
  });
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
