// Appointment calendar (P1-13). Day / week / month view dengan drag-to-
// reschedule (HTML5 native drag) di day view.
import { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader } from '../../components/ui';
import AppointmentForm from '../../components/appointment/AppointmentForm';

const MODES = [
  { id: 'day', label: 'Hari' },
  { id: 'week', label: 'Minggu' },
  { id: 'month', label: 'Bulan' },
];

const WEEK_DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 08:00–21:00

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeek(d) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function startOfMonth(d) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}
function fmtIso(d) {
  return startOfDay(d).toISOString().slice(0, 10);
}
function fmtMonth(d) {
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

export default function CalendarPage() {
  const [mode, setMode] = useState('day');
  const [cursor, setCursor] = useState(() => new Date());
  const [data, setData] = useState({
    appointments: [],
    staff: [],
    resources: [],
  });
  const [loading, setLoading] = useState(false);
  const [staffFilter, setStaffFilter] = useState('');
  const [creatingAt, setCreatingAt] = useState(null);
  const [editing, setEditing] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  const range = useMemo(() => {
    if (mode === 'day') return { from: cursor, to: cursor };
    if (mode === 'week') {
      const start = startOfWeek(cursor);
      return { from: start, to: addDays(start, 6) };
    }
    const start = startOfMonth(cursor);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    return { from: start, to: end };
  }, [mode, cursor]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('from', fmtIso(range.from));
      params.set('to', fmtIso(range.to));
      if (staffFilter) params.set('staff_id', staffFilter);
      const res = await api.get(`/calendar?${params.toString()}`);
      setData(res.data || { appointments: [], staff: [], resources: [] });
    } catch {
      toast.error('Gagal memuat kalender');
    } finally {
      setLoading(false);
    }
  }

  async function loadRefs() {
    try {
      const [c, p] = await Promise.all([
        api.get('/customers?limit=200').catch(() => ({ data: [] })),
        api.get('/products?limit=200').catch(() => ({ data: [] })),
      ]);
      setCustomers(Array.isArray(c.data) ? c.data : c.data?.items || []);
      setProducts(Array.isArray(p.data) ? p.data : p.data?.items || []);
    } catch {
      // non-fatal
    }
  }

  useEffect(() => {
    loadRefs();
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cursor, staffFilter]);

  function shift(direction) {
    if (mode === 'day') setCursor(addDays(cursor, direction));
    else if (mode === 'week') setCursor(addDays(cursor, direction * 7));
    else {
      const x = new Date(cursor);
      x.setMonth(x.getMonth() + direction);
      setCursor(x);
    }
  }

  async function handleDrop(appointment, newStartAt) {
    try {
      await api.post(`/appointment/${appointment.id}/reschedule`, {
        start_at: newStartAt.toISOString(),
        duration_minutes: appointment.duration_minutes,
      });
      toast.success('Jadwal diubah');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal reschedule');
    }
  }

  return (
    <div>
      <PageHeader
        title="Kalender Appointment"
        subtitle="Day / week / month view. Drag appointment di day view untuk reschedule."
        icon={Calendar}
      >
        <div className="flex items-center gap-1 rounded-lg ring-1 ring-gray-200 p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${
                mode === m.id ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setCursor(new Date())}
          className="rounded-lg px-3 py-2 text-sm text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
        >
          Hari ini
        </button>
        <select
          value={staffFilter}
          onChange={(e) => setStaffFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Semua staff</option>
          {data.staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => setCreatingAt(new Date())}
          className="flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> Tambah
        </button>
      </PageHeader>

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="rounded-lg p-2 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h3 className="text-base font-semibold">
            {mode === 'day' &&
              cursor.toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            {mode === 'week' &&
              `${range.from.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – ${range.to.toLocaleDateString(
                'id-ID',
                { day: 'numeric', month: 'short', year: 'numeric' }
              )}`}
            {mode === 'month' && fmtMonth(cursor)}
          </h3>
          <button onClick={() => shift(1)} className="rounded-lg p-2 hover:bg-gray-100">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        {loading && <span className="text-xs text-gray-500">Memuat…</span>}
      </div>

      {mode === 'day' && (
        <DayView
          date={cursor}
          appointments={data.appointments}
          onSlotClick={(date) => setCreatingAt(date)}
          onAppointmentClick={(a) => setEditing(a)}
          onDrop={handleDrop}
        />
      )}
      {mode === 'week' && (
        <WeekView
          start={range.from}
          appointments={data.appointments}
          onDayClick={(d) => {
            setMode('day');
            setCursor(d);
          }}
        />
      )}
      {mode === 'month' && (
        <MonthView
          start={range.from}
          appointments={data.appointments}
          onDayClick={(d) => {
            setMode('day');
            setCursor(d);
          }}
        />
      )}

      {creatingAt && (
        <AppointmentForm
          initialStartAt={creatingAt.toISOString()}
          staff={data.staff}
          resources={data.resources}
          customers={customers}
          products={products}
          onClose={() => setCreatingAt(null)}
          onSaved={load}
        />
      )}

      {editing && (
        <AppointmentForm
          appointment={editing}
          staff={data.staff}
          resources={data.resources}
          customers={customers}
          products={products}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function DayView({ date, appointments, onSlotClick, onAppointmentClick, onDrop }) {
  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1);
  const dayAppts = appointments.filter((a) => {
    const t = new Date(a.start_at).getTime();
    return t >= dayStart.getTime() && t < dayEnd.getTime();
  });

  function slotFor(hour) {
    const slot = new Date(dayStart);
    slot.setHours(hour, 0, 0, 0);
    return slot;
  }

  function appointmentsAt(hour) {
    const slotStart = slotFor(hour);
    const slotEnd = new Date(slotStart);
    slotEnd.setHours(hour + 1, 0, 0, 0);
    return dayAppts.filter((a) => {
      const t = new Date(a.start_at);
      return t >= slotStart && t < slotEnd;
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
      <table className="min-w-full text-sm">
        <tbody>
          {HOURS.map((hour) => {
            const slot = slotFor(hour);
            const here = appointmentsAt(hour);
            return (
              <tr
                key={hour}
                className="border-b border-gray-100"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/plain');
                  const a = dayAppts.find((x) => String(x.id) === id);
                  if (a) onDrop?.(a, slot);
                }}
              >
                <td className="w-20 px-3 py-2 text-xs font-medium text-gray-500 align-top">
                  {String(hour).padStart(2, '0')}:00
                </td>
                <td
                  className="px-3 py-2 cursor-pointer hover:bg-primary-50/30"
                  onClick={() => here.length === 0 && onSlotClick?.(slot)}
                >
                  {here.length === 0 ? (
                    <span className="text-xs text-gray-300">— tap untuk buat —</span>
                  ) : (
                    <div className="space-y-1">
                      {here.map((a) => (
                        <div
                          key={a.id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/plain', String(a.id))}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAppointmentClick?.(a);
                          }}
                          className="cursor-grab rounded-lg border-l-4 bg-primary-50 px-3 py-2 hover:bg-primary-100"
                          style={{
                            borderLeftColor: a.staff_color || '#04C99E',
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {new Date(a.start_at).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              {a.customer_name}
                            </span>
                            <span className="text-xs text-gray-500">{a.staff_name || ''}</span>
                          </div>
                          <div className="text-xs text-gray-600">
                            {a.service_summary || a.ref_no}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WeekView({ start, appointments, onDayClick }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const byDay = days.map((d) => ({
    date: d,
    appts: appointments.filter((a) => {
      const t = new Date(a.start_at);
      return t.toDateString() === d.toDateString();
    }),
  }));
  return (
    <div className="grid grid-cols-7 gap-2">
      {byDay.map(({ date, appts }) => (
        <div
          key={date.toISOString()}
          onClick={() => onDayClick?.(date)}
          className="cursor-pointer rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-100 hover:ring-primary-300"
        >
          <div className="mb-2">
            <p className="text-xs uppercase text-gray-500">{WEEK_DAYS[date.getDay()]}</p>
            <p className="text-base font-semibold">{date.getDate()}</p>
          </div>
          <div className="space-y-1">
            {appts.slice(0, 4).map((a) => (
              <div
                key={a.id}
                className="truncate rounded-md px-1.5 py-0.5 text-xs"
                style={{
                  background: `${a.staff_color || '#04C99E'}22`,
                  borderLeft: `3px solid ${a.staff_color || '#04C99E'}`,
                }}
              >
                {new Date(a.start_at).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                {a.customer_name}
              </div>
            ))}
            {appts.length > 4 && (
              <p className="text-xs text-gray-400">+{appts.length - 4} lainnya</p>
            )}
            {appts.length === 0 && <p className="text-xs text-gray-300">—</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function MonthView({ start, appointments, onDayClick }) {
  const firstDay = startOfMonth(start);
  const lastDay = new Date(firstDay);
  lastDay.setMonth(lastDay.getMonth() + 1);
  lastDay.setDate(0);
  const cells = [];
  for (let i = 0; i < firstDay.getDay(); i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(firstDay);
    date.setDate(d);
    cells.push(date);
  }
  return (
    <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-gray-100">
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs uppercase text-gray-500">
        {WEEK_DAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, idx) => {
          if (!date) return <div key={idx} className="aspect-square" />;
          const appts = appointments.filter(
            (a) => new Date(a.start_at).toDateString() === date.toDateString()
          );
          return (
            <button
              key={date.toISOString()}
              onClick={() => onDayClick?.(date)}
              className="aspect-square rounded-lg p-1 text-left ring-1 ring-gray-100 hover:bg-primary-50/30"
            >
              <p className="text-xs font-semibold">{date.getDate()}</p>
              {appts.length > 0 && (
                <p className="mt-1 text-[10px] text-primary-700">{appts.length} appointment</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
