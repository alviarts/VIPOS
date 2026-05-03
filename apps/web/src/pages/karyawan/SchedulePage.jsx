import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CalendarRange,
  Check,
  Clock,
  Edit2,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import {
  ConfirmationDialog,
  EmptyState,
  FilterTabs,
  PageHeader,
  Toggle,
} from '../../components/ui';

const TABS = [
  { id: 'shifts', label: 'Daftar Shift' },
  { id: 'calendar', label: 'Jadwal Kerja' },
  { id: 'swap', label: 'Tukar Shift' },
];

const SHIFT_COLORS = ['#04C99E', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#0ea5e9'];

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // ISO week, Mon-Sun
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtDayLabel(date) {
  return date.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' });
}

export default function SchedulePage() {
  const [tab, setTab] = useState('shifts');
  return (
    <div>
      <PageHeader
        title="Jadwal Kerja"
        subtitle="Master shift, calendar grid assignment per karyawan, dan workflow tukar shift"
        icon={CalendarRange}
      />
      <FilterTabs tabs={TABS} activeId={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === 'shifts' && <ShiftsTab />}
        {tab === 'calendar' && <CalendarTab />}
        {tab === 'swap' && <SwapTab />}
      </div>
    </div>
  );
}

// ============================================================
// SHIFTS TAB
// ============================================================
function ShiftsTab() {
  const [shifts, setShifts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const initForm = useMemo(
    () => ({
      name: '',
      start_time: '08:00',
      end_time: '16:00',
      break_minutes: 60,
      color: SHIFT_COLORS[0],
      is_active: 1,
    }),
    []
  );
  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const { data } = await api.get('/shift');
      setShifts(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Gagal memuat shift');
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(initForm);
    setShowForm(true);
  }

  function openEdit(s) {
    setEditing(s);
    setForm({
      name: s.name,
      start_time: s.start_time,
      end_time: s.end_time,
      break_minutes: s.break_minutes ?? 0,
      color: s.color || SHIFT_COLORS[0],
      is_active: s.is_active ?? 1,
    });
    setShowForm(true);
  }

  async function save(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Nama shift wajib');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, break_minutes: Number(form.break_minutes) || 0 };
      if (editing) {
        await api.put(`/shift/${editing.id}`, payload);
      } else {
        await api.post('/shift', payload);
      }
      toast.success('Shift disimpan');
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal menyimpan shift');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    try {
      await api.delete(`/shift/${id}`);
      toast.success('Shift dihapus');
      setConfirmDelete(null);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal menghapus shift');
    }
  }

  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-600">{shifts.length} shift</div>
          <button
            onClick={openCreate}
            className="px-3 py-2 bg-primary-500 text-white rounded-lg text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Tambah Shift
          </button>
        </div>
        {shifts.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Belum ada shift"
            description="Definisikan shift template (Pagi/Sore/Malam) dulu sebelum assign jadwal."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Mulai</th>
                <th className="px-4 py-3 text-left">Selesai</th>
                <th className="px-4 py-3 text-right">Istirahat</th>
                <th className="px-4 py-3 text-left">Warna</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                  <td className="px-4 py-3">{s.start_time}</td>
                  <td className="px-4 py-3">{s.end_time}</td>
                  <td className="px-4 py-3 text-right">{s.break_minutes || 0} m</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block w-4 h-4 rounded"
                      style={{ backgroundColor: s.color || '#04C99E' }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-xs ${
                        s.is_active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {s.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <button
                      onClick={() => openEdit(s)}
                      className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100"
                      aria-label="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(s)}
                      className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50"
                      aria-label="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
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
                {editing ? 'Edit Shift' : 'Tambah Shift'}
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
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nama Shift *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Pagi / Sore / Malam"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mulai *</label>
                <input
                  type="time"
                  required
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Selesai *</label>
                <input
                  type="time"
                  required
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Istirahat (menit)
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.break_minutes}
                  onChange={(e) => setForm({ ...form, break_minutes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Warna</label>
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {SHIFT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-7 h-7 rounded-full border-2 ${
                        form.color === c ? 'border-gray-800' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Warna ${c}`}
                    />
                  ))}
                </div>
              </div>
              <div className="col-span-2 pt-2">
                <Toggle
                  checked={!!form.is_active}
                  onChange={(v) => setForm({ ...form, is_active: v ? 1 : 0 })}
                  label="Aktif"
                  description="Shift bisa di-assign saat aktif."
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

      <ConfirmationDialog
        open={!!confirmDelete}
        title="Hapus shift"
        message={`Yakin hapus shift "${confirmDelete?.name}"? Assignment terkait juga akan terhapus.`}
        variant="danger"
        confirmLabel="Hapus"
        onConfirm={() => remove(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

// ============================================================
// CALENDAR TAB
// ============================================================
function CalendarTab() {
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [assignments, setAssignments] = useState({});
  const [pending, setPending] = useState({});
  const [saving, setSaving] = useState(false);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  async function load() {
    try {
      const [empRes, shiftRes, assignRes] = await Promise.all([
        api.get('/employee'),
        api.get('/shift'),
        api.get(`/schedule?from=${isoDate(weekStart)}&to=${isoDate(addDays(weekStart, 6))}`),
      ]);
      setEmployees(Array.isArray(empRes.data) ? empRes.data : []);
      setShifts(Array.isArray(shiftRes.data) ? shiftRes.data : []);
      const map = {};
      for (const a of assignRes.data || []) {
        map[`${a.employee_id}:${a.schedule_date}`] = a;
      }
      setAssignments(map);
      setPending({});
    } catch {
      toast.error('Gagal memuat jadwal');
    }
  }

  function setCell(empId, date, shiftId) {
    const key = `${empId}:${isoDate(date)}`;
    setPending((p) => {
      const next = { ...p };
      const isOff = shiftId === 'OFF';
      const sId = shiftId === 'OFF' || shiftId === '' ? null : Number(shiftId);
      next[key] = {
        employee_id: empId,
        shift_id: sId,
        schedule_date: isoDate(date),
        is_off: isOff,
      };
      return next;
    });
  }

  function getCellValue(empId, date) {
    const key = `${empId}:${isoDate(date)}`;
    if (key in pending) {
      const p = pending[key];
      if (p.is_off) return 'OFF';
      return p.shift_id ? String(p.shift_id) : '';
    }
    const a = assignments[key];
    if (!a) return '';
    if (a.is_off) return 'OFF';
    return a.shift_id ? String(a.shift_id) : '';
  }

  async function saveAll() {
    const list = Object.values(pending);
    if (list.length === 0) {
      toast('Tidak ada perubahan');
      return;
    }
    setSaving(true);
    try {
      await api.post('/schedule/assign', { assignments: list });
      toast.success(`${list.length} assignment disimpan`);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal menyimpan jadwal');
    } finally {
      setSaving(false);
    }
  }

  const dirtyCount = Object.keys(pending).length;

  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((d) => addDays(d, -7))}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ← Minggu Lalu
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Hari Ini
          </button>
          <button
            onClick={() => setWeekStart((d) => addDays(d, 7))}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Minggu Depan →
          </button>
          <div className="text-sm text-gray-600 ml-3">
            {fmtDayLabel(days[0])} – {fmtDayLabel(days[6])}
          </div>
        </div>
        <button
          onClick={saveAll}
          disabled={saving || dirtyCount === 0}
          className="px-3 py-2 bg-primary-500 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> Simpan Perubahan {dirtyCount > 0 ? `(${dirtyCount})` : ''}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {employees.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="Belum ada karyawan"
            description="Tambahkan karyawan dulu di tab Daftar Karyawan."
          />
        ) : shifts.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Belum ada shift"
            description="Definisikan shift template di tab Daftar Shift dulu."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-3 text-left sticky left-0 bg-gray-50 min-w-[160px]">
                  Karyawan
                </th>
                {days.map((d) => (
                  <th key={isoDate(d)} className="px-3 py-3 text-center min-w-[110px]">
                    {fmtDayLabel(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 sticky left-0 bg-white font-medium text-gray-800">
                    <div className="text-sm">{emp.name}</div>
                    <div className="text-xs text-gray-500">{emp.position || emp.role}</div>
                  </td>
                  {days.map((d) => {
                    const key = `${emp.id}:${isoDate(d)}`;
                    const dirty = key in pending;
                    const val = getCellValue(emp.id, d);
                    const shift = shifts.find((s) => String(s.id) === val);
                    return (
                      <td key={isoDate(d)} className="px-2 py-2 align-top">
                        <select
                          value={val}
                          onChange={(e) => setCell(emp.id, d, e.target.value)}
                          className={`w-full px-2 py-1.5 text-xs border rounded-md ${
                            dirty ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'
                          }`}
                          style={
                            shift
                              ? {
                                  borderLeftWidth: '3px',
                                  borderLeftColor: shift.color || '#04C99E',
                                }
                              : undefined
                          }
                        >
                          <option value="">— Belum diatur —</option>
                          <option value="OFF">Libur</option>
                          {shifts
                            .filter((s) => s.is_active)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.start_time}-{s.end_time})
                              </option>
                            ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SWAP TAB
// ============================================================
function SwapTab() {
  const [swaps, setSwaps] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/schedule-swap');
      setSwaps(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Gagal memuat permintaan tukar shift');
    } finally {
      setLoading(false);
    }
  }

  async function decide(id, action) {
    try {
      await api.post(`/schedule-swap/${id}/${action}`, { decision_note: '' });
      toast.success(action === 'approve' ? 'Disetujui' : 'Ditolak');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal');
    }
  }

  const grouped = useMemo(() => {
    const out = { PENDING: [], APPROVED: [], REJECTED: [], CANCELLED: [] };
    for (const s of swaps) {
      const k = s.status || 'PENDING';
      if (out[k]) out[k].push(s);
      else out.PENDING.push(s);
    }
    return out;
  }, [swaps]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        {loading ? 'Memuat…' : `${swaps.length} permintaan tukar shift`}
      </div>
      {swaps.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            icon={ArrowLeftRight}
            title="Belum ada permintaan swap"
            description="Karyawan dapat mengajukan tukar shift via aplikasi mobile (Phase 3+)."
          />
        </div>
      ) : (
        <>
          <SwapSection
            title="Menunggu Persetujuan"
            items={grouped.PENDING}
            onDecide={decide}
            actionable
          />
          <SwapSection title="Disetujui" items={grouped.APPROVED} onDecide={decide} />
          <SwapSection
            title="Ditolak / Batal"
            items={[...grouped.REJECTED, ...grouped.CANCELLED]}
            onDecide={decide}
          />
        </>
      )}
    </div>
  );
}

function SwapSection({ title, items, onDecide, actionable = false }) {
  if (items.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 text-sm font-semibold text-gray-700">
        {title} ({items.length})
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-2 text-left">Pengaju</th>
            <th className="px-4 py-2 text-left">Tukar Dengan</th>
            <th className="px-4 py-2 text-left">Alasan</th>
            <th className="px-4 py-2 text-left">Status</th>
            {actionable && <th className="px-4 py-2 text-right">Aksi</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-2">
                <div className="font-medium text-gray-800">
                  {s.requester_name || `#${s.requester_id}`}
                </div>
                <div className="text-xs text-gray-500">Assign #{s.requester_assignment_id}</div>
              </td>
              <td className="px-4 py-2">
                <div className="font-medium text-gray-800">
                  {s.partner_name || `#${s.partner_id}`}
                </div>
                <div className="text-xs text-gray-500">Assign #{s.partner_assignment_id}</div>
              </td>
              <td className="px-4 py-2 text-xs text-gray-600">{s.reason || '—'}</td>
              <td className="px-4 py-2">
                <SwapStatusBadge status={s.status} />
              </td>
              {actionable && (
                <td className="px-4 py-2 text-right space-x-1">
                  <button
                    onClick={() => onDecide(s.id, 'approve')}
                    className="px-3 py-1 text-xs bg-emerald-500 text-white rounded-md flex items-center gap-1 inline-flex"
                  >
                    <Check className="w-3 h-3" /> Setujui
                  </button>
                  <button
                    onClick={() => onDecide(s.id, 'reject')}
                    className="px-3 py-1 text-xs border border-rose-300 text-rose-600 rounded-md flex items-center gap-1 inline-flex"
                  >
                    <X className="w-3 h-3" /> Tolak
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SwapStatusBadge({ status }) {
  const map = {
    PENDING: { label: 'Menunggu', cls: 'bg-amber-100 text-amber-700' },
    APPROVED: { label: 'Disetujui', cls: 'bg-emerald-100 text-emerald-700' },
    REJECTED: { label: 'Ditolak', cls: 'bg-rose-100 text-rose-700' },
    CANCELLED: { label: 'Dibatalkan', cls: 'bg-gray-100 text-gray-600' },
  };
  const m = map[status] || { label: status, cls: 'bg-gray-100 text-gray-700' };
  return <span className={`inline-block px-2 py-0.5 rounded-md text-xs ${m.cls}`}>{m.label}</span>;
}
