// P1-17 — Scheduled Reports (Prime+ tier).
//
// Tier-gated: kalau bukan Prime/Prime+, tampilin upgrade prompt.
// CRUD via /api/reports/schedule (list, create, update, delete).
// Trigger manual run via POST /api/reports/schedule/:id/run (stub).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Crown, Plus, Play, Trash2, AlertCircle } from 'lucide-react';
import api from '../../utils/api';
import { formatDateTime } from '../../utils/format';
import { usePermission, TIERS } from '../../context/PermissionContext';

const FREQ_OPTIONS = [
  { value: 'daily', label: 'Harian' },
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
];

const FORMAT_OPTIONS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'xlsx', label: 'Excel' },
  { value: 'csv', label: 'CSV' },
];

export default function ScheduledReportsPage() {
  const { hasTier } = usePermission();
  const isPrime = hasTier(TIERS.PRIME);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    if (!isPrime) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([api.get('/reports/schedule'), api.get('/reports/catalog')])
      .then(([res, cat]) => {
        if (!cancelled) {
          setItems(Array.isArray(res.data) ? res.data : []);
          setCatalog(Array.isArray(cat.data) ? cat.data : []);
        }
      })
      .catch((e) => !cancelled && setError(e?.message || 'Gagal memuat'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isPrime]);

  const handleCreate = async (form) => {
    setError(null);
    try {
      const res = await api.post('/reports/schedule', form);
      setItems((prev) => [res.data, ...prev]);
      setShowForm(false);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Gagal simpan');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus jadwal ini?')) return;
    try {
      await api.delete(`/reports/schedule/${id}`);
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (e) {
      setError(e?.response?.data?.error || 'Gagal hapus');
    }
  };

  const handleRun = async (id) => {
    try {
      await api.post(`/reports/schedule/${id}/run`);
      const res = await api.get('/reports/schedule');
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Gagal trigger');
    }
  };

  if (!isPrime) {
    return (
      <div className="space-y-4">
        <header className="flex items-center justify-between">
          <Link
            to="/reports"
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" /> Hub Laporan
          </Link>
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <CalendarClock className="h-4 w-4" /> Jadwal Laporan
          </div>
        </header>
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-6 text-center">
          <Crown className="mx-auto h-10 w-10 text-amber-500" />
          <h2 className="mt-3 text-xl font-bold text-gray-900">Fitur Prime+</h2>
          <p className="mt-1 text-sm text-gray-600">
            Jadwal laporan otomatis (harian / mingguan / bulanan) + auto email ke pemilik dan tim
            hanya tersedia di paket Prime atau Prime+.
          </p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
          >
            Upgrade Subscription
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <Link
          to="/reports"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Hub Laporan
        </Link>
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <CalendarClock className="h-4 w-4" /> Jadwal Laporan
        </div>
      </header>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Jadwal Laporan Otomatis</h1>
          <p className="text-sm text-gray-500">
            Atur laporan kirim otomatis ke email tim setiap periode.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> Jadwal Baru
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {showForm && (
        <ScheduleForm
          catalog={catalog}
          onCancel={() => setShowForm(false)}
          onSubmit={handleCreate}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left">Nama</th>
              <th className="px-4 py-2 text-left">Laporan</th>
              <th className="px-4 py-2 text-left">Frekuensi</th>
              <th className="px-4 py-2 text-left">Format</th>
              <th className="px-4 py-2 text-left">Recipients</th>
              <th className="px-4 py-2 text-left">Last Run</th>
              <th className="px-4 py-2 text-left">Aktif</th>
              <th className="px-4 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-gray-400">
                  Memuat…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-gray-400">
                  Belum ada jadwal.
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-2 font-medium">{it.name}</td>
                  <td className="px-4 py-2">{it.report_key}</td>
                  <td className="px-4 py-2">{it.frequency}</td>
                  <td className="px-4 py-2 uppercase">{it.format}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{it.recipients || '—'}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {it.last_run_at ? formatDateTime(it.last_run_at) : '—'}
                  </td>
                  <td className="px-4 py-2">{it.is_active ? 'Ya' : 'Tidak'}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleRun(it.id)}
                        className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                        title="Run sekarang"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(it.id)}
                        className="rounded p-1 text-red-600 hover:bg-red-50"
                        title="Hapus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScheduleForm({ catalog, onCancel, onSubmit }) {
  const [form, setForm] = useState({
    report_key: 'sales-summary',
    name: '',
    frequency: 'daily',
    recipients: '',
    format: 'pdf',
    params_json: null,
  });

  const reports = catalog.flatMap((g) =>
    (g.reports || []).map((r) => ({ key: r.key, label: `${g.label} — ${r.label}` }))
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      name: form.name || `Schedule ${form.report_key}`,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-gray-500">Nama</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            placeholder="e.g. Ringkasan Harian Outlet Utama"
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Laporan
          </label>
          <select
            value={form.report_key}
            onChange={(e) => setForm((f) => ({ ...f, report_key: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          >
            {reports.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Frekuensi
          </label>
          <select
            value={form.frequency}
            onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          >
            {FREQ_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Format
          </label>
          <select
            value={form.format}
            onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          >
            {FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Recipients (email, pisah dengan koma)
          </label>
          <input
            type="text"
            value={form.recipients}
            onChange={(e) => setForm((f) => ({ ...f, recipients: e.target.value }))}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            placeholder="owner@example.com, manager@example.com"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Batal
        </button>
        <button
          type="submit"
          className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          Simpan Jadwal
        </button>
      </div>
    </form>
  );
}
