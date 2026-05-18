// Appointment list page (P1-13). Tab status, filter staff/tanggal, detail
// dialog dengan aksi state machine.
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Plus,
  Send,
  XCircle,
  AlarmCheck,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { EmptyState, FilterTabs, PageHeader, ConfirmationDialog } from '../../components/ui';
import AppointmentForm from '../../components/appointment/AppointmentForm';

const TABS = [
  { id: 'all', label: 'Semua' },
  { id: 'PENDING', label: 'Menunggu' },
  { id: 'CONFIRMED', label: 'Dikonfirmasi' },
  { id: 'IN_PROGRESS', label: 'Berjalan' },
  { id: 'COMPLETED', label: 'Selesai' },
  { id: 'CANCELLED', label: 'Batal' },
];

const STATUS_BADGE = {
  PENDING: 'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-rose-100 text-rose-700',
  NO_SHOW: 'bg-gray-200 text-gray-700',
};

function fmtTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status] || 'bg-gray-100 text-gray-600'}`}
    >
      {status}
    </span>
  );
}

function AppointmentDetailDialog({
  appointment,
  staff,
  resources,
  customers,
  products,
  onClose,
  onChanged,
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(null);

  if (!appointment) return null;

  async function callAction(path, body) {
    try {
      await api.post(`/appointment/${appointment.id}/${path}`, body || {});
      toast.success('OK');
      onChanged?.();
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal');
    }
  }

  if (editing) {
    return (
      <AppointmentForm
        appointment={appointment}
        staff={staff}
        resources={resources}
        customers={customers}
        products={products}
        onClose={() => setEditing(false)}
        onSaved={() => {
          onChanged?.();
          setEditing(false);
        }}
      />
    );
  }

  const canEdit = !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status);
  const canConfirm = appointment.status === 'PENDING';
  const canCheckin = appointment.status === 'CONFIRMED';
  const canComplete = appointment.status === 'IN_PROGRESS';
  const canCancel = !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold">{appointment.ref_no}</h3>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={appointment.status} />
              <span className="text-xs text-gray-500">{fmtTime(appointment.start_at)}</span>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-2 text-gray-400 hover:bg-gray-100">
            ✕
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">Customer</p>
              <p className="font-medium">{appointment.customer_name || '-'}</p>
              <p className="text-xs text-gray-500">{appointment.customer_phone || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Staff</p>
              <p className="font-medium">{appointment.staff_name || '-'}</p>
              <p className="text-xs text-gray-500">Resource: {appointment.resource_name || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Durasi</p>
              <p className="font-medium">{appointment.duration_minutes} mnt</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="font-medium">Rp{(appointment.total || 0).toLocaleString('id-ID')}</p>
              {appointment.deposit_amount > 0 && (
                <p className="text-xs text-gray-500">
                  Deposit: Rp
                  {(appointment.deposit_amount || 0).toLocaleString('id-ID')}
                </p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase text-gray-500 mb-2">Layanan</p>
            <table className="min-w-full text-sm">
              <tbody>
                {(appointment.services || []).map((s) => (
                  <tr key={s.id} className="border-b border-gray-100">
                    <td className="py-1 pr-2">
                      {s.service_name}
                      {s.duration_minutes ? ` (${s.duration_minutes} mnt)` : ''}
                    </td>
                    <td className="py-1 pr-2 text-right">
                      {s.qty}× Rp{s.price.toLocaleString('id-ID')}
                    </td>
                    <td className="py-1 text-right font-medium">
                      Rp{s.subtotal.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {appointment.notes && (
            <div>
              <p className="text-xs uppercase text-gray-500 mb-1">Catatan</p>
              <p className="text-sm">{appointment.notes}</p>
            </div>
          )}

          {appointment.cancel_reason && (
            <div className="rounded-lg bg-rose-50 p-3">
              <p className="text-xs font-medium text-rose-700">Alasan batal:</p>
              <p className="text-sm text-rose-700">{appointment.cancel_reason}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-6 py-4">
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              Edit
            </button>
          )}
          {canEdit && appointment.status !== 'IN_PROGRESS' && (
            <button
              onClick={() => callAction('send-reminder', { window: '24h' })}
              className="rounded-lg px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 inline-flex items-center gap-1"
            >
              <Send className="h-4 w-4" /> Kirim reminder
            </button>
          )}
          {canConfirm && (
            <button
              onClick={() => callAction('confirm')}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 inline-flex items-center gap-1"
            >
              <CheckCircle2 className="h-4 w-4" /> Konfirmasi
            </button>
          )}
          {canCheckin && (
            <button
              onClick={() => callAction('checkin')}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 inline-flex items-center gap-1"
            >
              <Clock className="h-4 w-4" /> Check-in
            </button>
          )}
          {canComplete && (
            <button
              onClick={() => callAction('complete')}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 inline-flex items-center gap-1"
            >
              <AlarmCheck className="h-4 w-4" /> Selesai
            </button>
          )}
          {canComplete && (
            <button
              onClick={async () => {
                try {
                  const res = await api.post(`/appointment/${appointment.id}/convert`, {});
                  toast.success('Cart prefill siap di kasir');
                  // navigate to cashier with prefill (simple session storage)
                  if (res.data?.cart_prefill) {
                    sessionStorage.setItem(
                      'appointment_cart_prefill',
                      JSON.stringify(res.data.cart_prefill)
                    );
                    window.location.href = '/cashier';
                  }
                } catch (err) {
                  toast.error(err.response?.data?.error || 'Gagal convert');
                }
              }}
              className="rounded-lg bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-700 inline-flex items-center gap-1"
            >
              <ChevronRight className="h-4 w-4" /> Selesai & Bayar
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => setConfirming('cancel')}
              className="rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1"
            >
              <XCircle className="h-4 w-4" /> Batalkan
            </button>
          )}
        </div>
      </div>

      {confirming === 'cancel' && (
        <ConfirmationDialog
          title="Batalkan appointment?"
          message="Tindakan ini tidak dapat dibatalkan."
          confirmLabel="Ya, batalkan"
          variant="danger"
          onConfirm={() => {
            setConfirming(null);
            callAction('cancel', { reason: 'Cancelled by staff' });
          }}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}

export default function AppointmentListPage() {
  const [tab, setTab] = useState('all');
  const [staffFilter, setStaffFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [loading, setLoading] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [resources, setResources] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [creating, setCreating] = useState(false);
  const [active, setActive] = useState(null);

  async function loadList() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab !== 'all') params.set('status', tab);
      if (staffFilter) params.set('staff_id', staffFilter);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', `${dateTo} 23:59:59`);
      const res = await api.get(`/appointment?${params.toString()}`);
      setAppointments(res.data || []);
    } catch {
      toast.error('Gagal memuat appointment');
    } finally {
      setLoading(false);
    }
  }

  async function loadRefs() {
    try {
      const [s, r, c, p] = await Promise.all([
        api.get('/staff'),
        api.get('/appointment-resource'),
        api.get('/customers?limit=200').catch(() => ({ data: [] })),
        api.get('/products?limit=200').catch(() => ({ data: [] })),
      ]);
      setStaff(s.data || []);
      setResources(r.data || []);
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
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, staffFilter, dateFrom, dateTo]);

  const counts = useMemo(() => {
    const all = appointments.length;
    return TABS.map((t) =>
      t.id === 'all'
        ? { ...t, count: all }
        : {
            ...t,
            count: appointments.filter((a) => a.status === t.id).length,
          }
    );
  }, [appointments]);

  return (
    <div>
      <PageHeader
        title="Daftar Appointment"
        subtitle="Pesanan reservasi customer — booking, konfirmasi, check-in, sampai bayar di kasir."
        icon={CalendarClock}
      >
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> Buat Appointment
        </button>
      </PageHeader>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-gray-500">Dari</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="block rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Sampai</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="block rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Staff</label>
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="block rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Semua staff</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <FilterTabs
        tabs={counts.map((t) => ({ id: t.id, label: `${t.label} (${t.count})` }))}
        activeId={tab}
        onChange={setTab}
      />

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Memuat…</p>
      ) : appointments.length === 0 ? (
        <EmptyState
          title="Belum ada appointment"
          description="Klik 'Buat Appointment' untuk menambah reservasi baru."
        />
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Waktu</th>
                <th className="px-4 py-2 text-left">Ref</th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left">Layanan</th>
                <th className="px-4 py-2 text-left">Staff</th>
                <th className="px-4 py-2 text-left">Resource</th>
                <th className="px-4 py-2 text-right">Durasi</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr
                  key={a.id}
                  className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                  onClick={() => setActive(a)}
                >
                  <td className="px-4 py-2 whitespace-nowrap">{fmtTime(a.start_at)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{a.ref_no}</td>
                  <td className="px-4 py-2">
                    {a.customer_name}
                    {a.customer_phone && (
                      <span className="block text-xs text-gray-500">{a.customer_phone}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {(a.services || []).map((s) => s.service_name).join(', ') || '-'}
                  </td>
                  <td className="px-4 py-2">
                    {a.staff_name ? (
                      <span
                        className="inline-block h-2 w-2 rounded-full mr-1"
                        style={{ background: a.staff_color || '#04C99E' }}
                      />
                    ) : null}
                    {a.staff_name || '-'}
                  </td>
                  <td className="px-4 py-2">{a.resource_name || '-'}</td>
                  <td className="px-4 py-2 text-right">{a.duration_minutes} mnt</td>
                  <td className="px-4 py-2 text-right">
                    Rp{(a.total || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <AppointmentForm
          staff={staff}
          resources={resources}
          customers={customers}
          products={products}
          onClose={() => setCreating(false)}
          onSaved={loadList}
        />
      )}

      {active && (
        <AppointmentDetailDialog
          appointment={active}
          staff={staff}
          resources={resources}
          customers={customers}
          products={products}
          onClose={() => setActive(null)}
          onChanged={loadList}
        />
      )}
    </div>
  );
}
