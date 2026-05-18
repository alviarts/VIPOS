import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, MapPin, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import {
  ConfirmationDialog,
  EmptyState,
  FilterTabs,
  PageHeader,
  Toggle,
} from '../../components/ui';
import { formatDateTime } from '../../utils/format';

const TABS = [
  { id: 'logs', label: 'Log Absensi' },
  { id: 'manual', label: 'Manual Entry' },
  { id: 'geofence', label: 'Radius Absensi' },
];

const LOG_TYPE_OPTIONS = [
  { value: '', label: 'Semua Tipe' },
  { value: 'check_in', label: 'Check-in' },
  { value: 'check_out', label: 'Check-out' },
  { value: 'break_start', label: 'Mulai Istirahat' },
  { value: 'break_end', label: 'Selesai Istirahat' },
];

const METHOD_LABEL = {
  gps: 'GPS',
  selfie: 'Selfie',
  nfc: 'NFC',
  manual: 'Manual',
  qr: 'QR',
};

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const [tab, setTab] = useState('logs');
  return (
    <div>
      <PageHeader
        title="Absensi"
        subtitle="Monitor log absensi karyawan, input manual, dan atur radius geofence per outlet"
        icon={ClipboardList}
      />
      <FilterTabs tabs={TABS} activeId={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === 'logs' && <LogsTab />}
        {tab === 'manual' && <ManualEntryTab />}
        {tab === 'geofence' && <GeofenceTab />}
      </div>
    </div>
  );
}

// ============================================================
// LOGS TAB
// ============================================================
function LogsTab() {
  const [logs, setLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({
    employee_id: '',
    log_type: '',
    from: todayISO(-7),
    to: todayISO(),
  });
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.employee_id, filters.log_type, filters.from, filters.to]);

  async function loadEmployees() {
    try {
      const { data } = await api.get('/employee');
      setEmployees(Array.isArray(data) ? data : []);
    } catch {
      // ignore: employee filter is optional
    }
  }

  async function loadLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.employee_id) params.set('employee_id', filters.employee_id);
      if (filters.log_type) params.set('log_type', filters.log_type);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      const { data } = await api.get(`/attendance?${params.toString()}`);
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Gagal memuat log absensi');
    } finally {
      setLoading(false);
    }
  }

  async function deleteLog(id) {
    try {
      await api.delete(`/attendance/${id}`);
      toast.success('Log dihapus');
      setConfirmDelete(null);
      await loadLogs();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Gagal menghapus log');
    }
  }

  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Karyawan</label>
          <select
            value={filters.employee_id}
            onChange={(e) => setFilters({ ...filters, employee_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Semua Karyawan</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipe Log</label>
          <select
            value={filters.log_type}
            onChange={(e) => setFilters({ ...filters, log_type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {LOG_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Dari</label>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Sampai</label>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200 text-sm text-gray-600">
          {loading ? 'Memuat…' : `${logs.length} log`}
        </div>
        {logs.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Tidak ada log"
            description="Belum ada log absensi pada rentang tanggal/filter ini."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Waktu</th>
                  <th className="px-4 py-3 text-left">Karyawan</th>
                  <th className="px-4 py-3 text-left">Tipe</th>
                  <th className="px-4 py-3 text-left">Metode</th>
                  <th className="px-4 py-3 text-left">Lokasi</th>
                  <th className="px-4 py-3 text-left">Catatan</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(log.logged_at)}</td>
                    <td className="px-4 py-3">{log.employee_name || `#${log.employee_id}`}</td>
                    <td className="px-4 py-3">
                      <LogTypeBadge type={log.log_type} />
                    </td>
                    <td className="px-4 py-3">{METHOD_LABEL[log.method] || log.method || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {log.latitude != null && log.longitude != null
                        ? `${log.latitude.toFixed?.(4) ?? log.latitude}, ${
                            log.longitude.toFixed?.(4) ?? log.longitude
                          }${log.is_off_site ? ' (off-site)' : ''}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{log.note || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setConfirmDelete(log)}
                        className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50"
                        aria-label="Hapus log"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmationDialog
        open={!!confirmDelete}
        title="Hapus log absensi"
        message={`Yakin hapus log ${confirmDelete?.log_type} ${
          confirmDelete?.employee_name || ''
        }?`}
        variant="danger"
        confirmLabel="Hapus"
        onConfirm={() => deleteLog(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function LogTypeBadge({ type }) {
  const map = {
    check_in: { label: 'Check-in', cls: 'bg-emerald-100 text-emerald-700' },
    check_out: { label: 'Check-out', cls: 'bg-rose-100 text-rose-700' },
    break_start: { label: 'Mulai Istirahat', cls: 'bg-amber-100 text-amber-700' },
    break_end: { label: 'Selesai Istirahat', cls: 'bg-blue-100 text-blue-700' },
  };
  const m = map[type] || { label: type, cls: 'bg-gray-100 text-gray-700' };
  return <span className={`inline-block px-2 py-0.5 rounded-md text-xs ${m.cls}`}>{m.label}</span>;
}

// ============================================================
// MANUAL ENTRY TAB
// ============================================================
function ManualEntryTab() {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({
    employee_id: '',
    log_type: 'check_in',
    logged_at: '',
    method: 'manual',
    latitude: '',
    longitude: '',
    photo_url: '',
    note: '',
    is_off_site: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/employee')
      .then(({ data }) => setEmployees(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Gagal memuat karyawan'));
  }, []);

  function reset() {
    setForm({
      employee_id: '',
      log_type: 'check_in',
      logged_at: '',
      method: 'manual',
      latitude: '',
      longitude: '',
      photo_url: '',
      note: '',
      is_off_site: false,
    });
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.employee_id) {
      toast.error('Pilih karyawan');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        employee_id: Number(form.employee_id),
        log_type: form.log_type,
        method: form.method,
        is_off_site: !!form.is_off_site,
      };
      if (form.logged_at) payload.logged_at = new Date(form.logged_at).toISOString();
      if (form.latitude !== '') payload.latitude = Number(form.latitude);
      if (form.longitude !== '') payload.longitude = Number(form.longitude);
      if (form.photo_url) payload.photo_url = form.photo_url;
      if (form.note) payload.note = form.note;
      await api.post('/attendance', payload);
      toast.success('Log absensi disimpan');
      reset();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal menyimpan log');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-3xl">
      <h2 className="text-base font-semibold text-gray-800 mb-1">Input Log Manual</h2>
      <p className="text-xs text-gray-500 mb-4">
        Manager boleh menambahkan log untuk skenario lupa check-in, off-site visit, atau WFH. Lokasi
        opsional; tandai off-site jika di luar radius.
      </p>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Karyawan *</label>
          <select
            required
            value={form.employee_id}
            onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">— Pilih karyawan —</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} {emp.position ? `· ${emp.position}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipe Log *</label>
          <select
            value={form.log_type}
            onChange={(e) => setForm({ ...form, log_type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="check_in">Check-in</option>
            <option value="check_out">Check-out</option>
            <option value="break_start">Mulai Istirahat</option>
            <option value="break_end">Selesai Istirahat</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Metode</label>
          <select
            value={form.method}
            onChange={(e) => setForm({ ...form, method: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="manual">Manual</option>
            <option value="gps">GPS</option>
            <option value="selfie">Selfie</option>
            <option value="nfc">NFC</option>
            <option value="qr">QR Code</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Waktu (kosongkan = sekarang)
          </label>
          <input
            type="datetime-local"
            value={form.logged_at}
            onChange={(e) => setForm({ ...form, logged_at: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Latitude</label>
          <input
            type="number"
            step="any"
            value={form.latitude}
            onChange={(e) => setForm({ ...form, latitude: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="-6.2"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Longitude</label>
          <input
            type="number"
            step="any"
            value={form.longitude}
            onChange={(e) => setForm({ ...form, longitude: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="106.8"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Foto URL (opsional)
          </label>
          <input
            type="text"
            value={form.photo_url}
            onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="https://…/selfie.jpg"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Catatan</label>
          <textarea
            rows={2}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            placeholder="Misal: lupa check-in pagi"
          />
        </div>
        <div className="sm:col-span-2">
          <Toggle
            checked={form.is_off_site}
            onChange={(v) => setForm({ ...form, is_off_site: v })}
            label="Tandai sebagai off-site"
            description="Aktifkan jika lokasi check-in di luar radius outlet."
          />
        </div>
        <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> {saving ? 'Menyimpan…' : 'Simpan Log'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// GEOFENCE TAB
// ============================================================
function GeofenceTab() {
  const [fences, setFences] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const initForm = useMemo(
    () => ({
      outlet_id: '',
      outlet_name: '',
      latitude: '',
      longitude: '',
      radius_m: 100,
      strict_mode: false,
    }),
    []
  );
  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const { data } = await api.get('/attendance-geofence');
      setFences(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Gagal memuat geofence');
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(initForm);
    setShowForm(true);
  }

  function openEdit(f) {
    setEditing(f);
    setForm({
      outlet_id: f.outlet_id ?? '',
      outlet_name: f.outlet_name || '',
      latitude: f.latitude ?? '',
      longitude: f.longitude ?? '',
      radius_m: f.radius_m ?? 100,
      strict_mode: !!f.strict_mode,
    });
    setShowForm(true);
  }

  async function save(e) {
    e.preventDefault();
    if (form.outlet_id === '' || form.outlet_id === null) {
      toast.error('Outlet ID wajib');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        outlet_id: Number(form.outlet_id),
        outlet_name: form.outlet_name || null,
        latitude: form.latitude !== '' ? Number(form.latitude) : null,
        longitude: form.longitude !== '' ? Number(form.longitude) : null,
        radius_m: Number(form.radius_m) || 100,
        strict_mode: !!form.strict_mode,
      };
      await api.put('/attendance-geofence', payload);
      toast.success('Geofence disimpan');
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal menyimpan geofence');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-600">{fences.length} outlet dengan geofence</div>
          <button
            onClick={openCreate}
            className="px-3 py-2 bg-primary-500 text-white rounded-lg text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Tambah Geofence
          </button>
        </div>
        {fences.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="Belum ada geofence"
            description="Tambahkan radius absensi untuk membatasi check-in pada area outlet."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Outlet</th>
                <th className="px-4 py-3 text-left">Koordinat</th>
                <th className="px-4 py-3 text-right">Radius</th>
                <th className="px-4 py-3 text-left">Mode</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {fences.map((f) => (
                <tr
                  key={f.outlet_id}
                  className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => openEdit(f)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">
                      {f.outlet_name || `Outlet #${f.outlet_id}`}
                    </div>
                    <div className="text-xs text-gray-500">ID: {f.outlet_id}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {f.latitude != null && f.longitude != null
                      ? `${f.latitude}, ${f.longitude}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">{f.radius_m} m</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-xs ${
                        f.strict_mode ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {f.strict_mode ? 'Strict' : 'Warn-only'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(f);
                      }}
                      className="px-3 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-100"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold text-gray-800">
                {editing ? 'Edit Geofence' : 'Tambah Geofence'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-md hover:bg-gray-100"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={save} className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Outlet ID *</label>
                <input
                  type="number"
                  required
                  value={form.outlet_id}
                  onChange={(e) => setForm({ ...form, outlet_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  disabled={!!editing}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nama Outlet</label>
                <input
                  type="text"
                  value={form.outlet_name}
                  onChange={(e) => setForm({ ...form, outlet_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Radius (meter) — default 100, range 50-500
                </label>
                <input
                  type="number"
                  min={50}
                  max={500}
                  value={form.radius_m}
                  onChange={(e) => setForm({ ...form, radius_m: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="col-span-2 pt-2">
                <Toggle
                  checked={!!form.strict_mode}
                  onChange={(v) => setForm({ ...form, strict_mode: v })}
                  label="Strict mode"
                  description="Tolak check-in di luar radius. Off = hanya warning."
                />
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
