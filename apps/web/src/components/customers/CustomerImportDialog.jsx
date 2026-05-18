import { useMemo, useState } from 'react';
import { X, FileUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const FIELDS = [
  { key: 'name', label: 'Nama (wajib)' },
  { key: 'phone', label: 'Telepon' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Alamat' },
  { key: 'gender', label: 'Jenis Kelamin (L / P)' },
  { key: 'birth_date', label: 'Tanggal Lahir (YYYY-MM-DD)' },
  { key: 'group_name', label: 'Nama Grup' },
  { key: 'notes', label: 'Catatan' },
];

// Minimal RFC4180-aware CSV parser. Returns rows of cells.
function parseCsv(text) {
  const out = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out.filter((r) => r.some((c) => c && c.trim() !== ''));
}

export default function CustomerImportDialog({ onClose, onDone }) {
  const [rows, setRows] = useState(null); // [[...], ...]
  const [headerRow, setHeaderRow] = useState([]);
  const [mapping, setMapping] = useState({}); // { name: colIndex, phone: colIndex }
  const [hasHeader, setHasHeader] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const previewRows = useMemo(() => {
    if (!rows) return [];
    const start = hasHeader ? 1 : 0;
    return rows.slice(start, start + 5);
  }, [rows, hasHeader]);

  const dataRowCount = useMemo(() => {
    if (!rows) return 0;
    return Math.max(0, rows.length - (hasHeader ? 1 : 0));
  }, [rows, hasHeader]);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File terlalu besar (max 5 MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      let text = String(ev.target.result || '');
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      const parsed = parseCsv(text);
      if (!parsed.length) {
        toast.error('CSV kosong');
        return;
      }
      setRows(parsed);
      const header = parsed[0] || [];
      setHeaderRow(header);
      // Auto-map by header name (case-insensitive).
      const auto = {};
      header.forEach((h, idx) => {
        const k = String(h).trim().toLowerCase().replace(/\s+/g, '_');
        const match = FIELDS.find((f) => f.key === k || f.key === k.replace(/^id_/, ''));
        if (match) auto[match.key] = idx;
      });
      setMapping(auto);
      setResult(null);
    };
    reader.readAsText(file, 'utf-8');
  }

  function buildPayload() {
    const start = hasHeader ? 1 : 0;
    return rows.slice(start).map((r) => {
      const obj = {};
      for (const f of FIELDS) {
        const idx = mapping[f.key];
        if (idx !== undefined && idx !== '' && idx !== null) {
          const val = r[idx];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            obj[f.key] = String(val).trim();
          }
        }
      }
      return obj;
    });
  }

  async function handleImport() {
    if (mapping.name === undefined) {
      toast.error('Mapping kolom Nama wajib');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { rows: buildPayload() };
      const res = await api.post('/customers/import', payload);
      setResult(res.data);
      toast.success(
        `Selesai: +${res.data.inserted} baru, ${res.data.updated} diupdate, ${res.data.skipped} dilewati`
      );
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal impor');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">Impor Pelanggan dari CSV</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">1. Pilih file CSV</h3>
            <p className="text-xs text-gray-500">
              Format yang disarankan: kolom{' '}
              <code>name, phone, email, address, gender, birth_date, group_name, notes</code>.
              Pencocokan menggunakan kolom <strong>phone</strong> &mdash; data yang sudah ada akan
              diupdate.
            </p>
            <label className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-sm text-gray-700">
              <FileUp className="w-4 h-4" />
              <span>Pilih file CSV...</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            </label>
            {rows && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={hasHeader}
                  onChange={(e) => setHasHeader(e.target.checked)}
                />
                Baris pertama adalah header
              </label>
            )}
            {rows && <p className="text-xs text-gray-500">{dataRowCount} baris data terdeteksi.</p>}
          </div>

          {rows && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-3">2. Mapping kolom</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {f.label}
                    </label>
                    <select
                      value={mapping[f.key] ?? ''}
                      onChange={(e) =>
                        setMapping((m) => ({
                          ...m,
                          [f.key]: e.target.value === '' ? undefined : Number(e.target.value),
                        }))
                      }
                      className="input-field"
                    >
                      <option value="">- Tidak dipakai -</option>
                      {(hasHeader ? headerRow : rows[0] || []).map((h, idx) => (
                        <option key={idx} value={idx}>
                          {hasHeader ? `${h || `Kolom ${idx + 1}`}` : `Kolom ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {previewRows.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 overflow-x-auto">
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                3. Preview 5 baris pertama
              </h3>
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    {FIELDS.map((f) => (
                      <th key={f.key} className="px-2 py-1.5 text-left text-gray-500">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      {FIELDS.map((f) => (
                        <td key={f.key} className="px-2 py-1.5 text-gray-700">
                          {mapping[f.key] !== undefined ? r[mapping[f.key]] || '-' : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Selesai impor: <strong>{result.inserted}</strong> baru,{' '}
                <strong>{result.updated}</strong> diupdate, <strong>{result.skipped}</strong>{' '}
                dilewati.
              </div>
              {result.errors?.length > 0 && (
                <div className="text-xs text-red-600 space-y-1">
                  <div className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {result.errors.length} baris error
                  </div>
                  <ul className="list-disc list-inside">
                    {result.errors.slice(0, 10).map((e) => (
                      <li key={e.row}>
                        Baris {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 px-4 sm:px-6 py-3 bg-white flex items-center justify-between">
        <button
          onClick={onClose}
          className="text-primary-600 hover:bg-primary-50 px-3 py-2 rounded-lg text-sm font-medium"
        >
          {result ? 'Tutup' : 'Batal'}
        </button>
        {!result && (
          <button
            onClick={handleImport}
            disabled={!rows || submitting}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {submitting ? 'Mengimpor...' : 'Mulai Impor'}
          </button>
        )}
        {result && (
          <button onClick={onDone} className="btn-primary text-sm">
            Selesai
          </button>
        )}
      </div>
    </div>
  );
}
