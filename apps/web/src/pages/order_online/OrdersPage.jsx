// Halaman Pesanan Online (P1-12) — queue dengan tab status (NEW / PREPARING /
// READY / COMPLETED / CANCELLED) + dialog detail dengan aksi accept / reject /
// ready / complete / cancel.
import { useEffect, useMemo, useState } from 'react';
import {
  ShoppingBag,
  Phone,
  MapPin,
  Clock,
  ChefHat,
  Check,
  X,
  Truck,
  Store,
  RefreshCcw,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { EmptyState, FilterTabs, PageHeader } from '../../components/ui';

const STATUS_TABS = [
  { id: 'NEW', label: 'Baru' },
  { id: 'PREPARING', label: 'Diproses' },
  { id: 'READY', label: 'Siap' },
  { id: 'COMPLETED', label: 'Selesai' },
  { id: 'CANCELLED', label: 'Dibatalkan' },
];

const CHANNEL_LABELS = {
  emenu: 'E-Menu',
  consumer_app: 'Consumer App',
  gofood: 'GoFood',
  grabfood: 'GrabFood',
  shopeefood: 'ShopeeFood',
  grabmart: 'GrabMart',
  tokopedia: 'Tokopedia',
};

const CHANNEL_COLORS = {
  emenu: 'bg-primary-100 text-primary-700',
  consumer_app: 'bg-purple-100 text-purple-700',
  gofood: 'bg-emerald-100 text-emerald-700',
  grabfood: 'bg-emerald-100 text-emerald-700',
  shopeefood: 'bg-orange-100 text-orange-700',
  grabmart: 'bg-emerald-100 text-emerald-700',
  tokopedia: 'bg-green-100 text-green-700',
};

function timeAgo(iso) {
  if (!iso) return '';
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}d lalu`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m lalu`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}j lalu`;
  return `${Math.floor(sec / 86400)}h lalu`;
}

function ChannelBadge({ channel }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        CHANNEL_COLORS[channel] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {CHANNEL_LABELS[channel] || channel}
    </span>
  );
}

function OrderTypeIcon({ type }) {
  if (type === 'delivery') return <Truck className="h-3 w-3" aria-label="Delivery" />;
  if (type === 'takeaway') return <ShoppingBag className="h-3 w-3" aria-label="Takeaway" />;
  return <Store className="h-3 w-3" aria-label="Dine-in" />;
}

function OrderCard({ order, onClick }) {
  const elapsed = (Date.now() - new Date(order.created_at).getTime()) / 1000 / 60;
  const slaPct = order.sla_minutes ? Math.min(100, (elapsed / order.sla_minutes) * 100) : 0;
  const slaWarn = order.status === 'NEW' && slaPct >= 50;
  const slaCritical = order.status === 'NEW' && slaPct >= 80;

  return (
    <button
      type="button"
      onClick={() => onClick(order)}
      className={`w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 transition hover:shadow-md ${
        slaCritical ? 'ring-rose-300' : slaWarn ? 'ring-amber-300' : 'ring-gray-100'
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs">
            <ChannelBadge channel={order.channel} />
            <span className="text-gray-500">#{order.ref_no}</span>
          </div>
          <h4 className="mt-1 text-sm font-semibold text-gray-900">
            {order.customer_name || 'Walk-in'}
          </h4>
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
            <OrderTypeIcon type={order.order_type} />
            <span>{order.order_type}</span>
            <span>•</span>
            <span>{order.item_count || 0} items</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-gray-900">
            Rp {Number(order.total).toLocaleString('id-ID')}
          </p>
          <p className="mt-1 flex items-center justify-end gap-1 text-xs text-gray-400">
            <Clock className="h-3 w-3" />
            {timeAgo(order.created_at)}
          </p>
        </div>
      </div>
    </button>
  );
}

function OrderDetailDialog({ order, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/online-order/${order.id}`);
      setDetail(res.data);
    } catch {
      toast.error('Gagal memuat detail order');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  async function transition(action, body) {
    setActing(true);
    try {
      const res = await api.post(`/online-order/${order.id}/${action}`, body);
      setDetail(res.data);
      toast.success('Status order ter-update');
      onChanged?.();
      if (action === 'reject' || action === 'cancel') onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal update status');
    } finally {
      setActing(false);
    }
  }

  const o = detail || order;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <ChannelBadge channel={o.channel} />
              <span className="text-xs text-gray-500">#{o.ref_no}</span>
            </div>
            <h3 className="mt-1 text-lg font-bold">{o.customer_name || 'Walk-in'}</h3>
            <p className="text-sm text-gray-500">
              {o.order_type} · {timeAgo(o.created_at)}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-2 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-6">
          {loading ? (
            <p className="text-sm text-gray-400">Memuat…</p>
          ) : (
            <>
              {(o.customer_phone || o.customer_address) && (
                <div className="rounded-xl bg-gray-50 p-3 text-sm">
                  {o.customer_phone && (
                    <p className="flex items-center gap-2 text-gray-700">
                      <Phone className="h-4 w-4" /> {o.customer_phone}
                    </p>
                  )}
                  {o.customer_address && (
                    <p className="mt-1 flex items-start gap-2 text-gray-700">
                      <MapPin className="mt-0.5 h-4 w-4" /> {o.customer_address}
                    </p>
                  )}
                </div>
              )}

              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">Item</p>
                <div className="space-y-1 rounded-xl ring-1 ring-gray-100">
                  {(o.items || []).map((it) => (
                    <div
                      key={it.id}
                      className="flex items-start justify-between border-b border-gray-100 px-3 py-2 last:border-b-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{it.product_name}</p>
                        {it.modifiers && <p className="text-xs text-gray-500">{it.modifiers}</p>}
                        {it.notes && (
                          <p className="text-xs italic text-gray-500">Catatan: {it.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm">
                          {it.qty} × Rp {Number(it.price).toLocaleString('id-ID')}
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          Rp {Number(it.subtotal).toLocaleString('id-ID')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <Row label="Subtotal" value={o.subtotal} />
                {o.delivery_fee > 0 && <Row label="Ongkir" value={o.delivery_fee} />}
                {o.service_charge > 0 && <Row label="Service charge" value={o.service_charge} />}
                {o.tax > 0 && <Row label="Pajak" value={o.tax} />}
                {o.discount > 0 && <Row label="Diskon" value={-o.discount} highlight />}
                <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
                  <span>Total</span>
                  <span>Rp {Number(o.total).toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 p-3 text-sm">
                <p>
                  <span className="text-gray-500">Pembayaran:</span> {o.payment_method || '—'}{' '}
                  <span className="ml-1 rounded bg-white px-1.5 py-0.5 text-xs ring-1 ring-gray-200">
                    {o.payment_status}
                  </span>
                </p>
                {o.notes && (
                  <p className="mt-1 text-gray-700">
                    <span className="text-gray-500">Catatan:</span> {o.notes}
                  </p>
                )}
                {o.reject_reason && (
                  <p className="mt-1 flex items-center gap-1 text-rose-700">
                    <AlertTriangle className="h-4 w-4" /> Ditolak: {o.reject_reason}
                  </p>
                )}
                {o.cancel_reason && (
                  <p className="mt-1 flex items-center gap-1 text-rose-700">
                    <AlertTriangle className="h-4 w-4" /> Dibatalkan: {o.cancel_reason}
                  </p>
                )}
              </div>

              {showReject && (
                <div className="rounded-xl bg-rose-50 p-3">
                  <label className="text-sm font-medium text-rose-700">Alasan penolakan</label>
                  <input
                    autoFocus
                    type="text"
                    className="mt-1 w-full rounded-lg border border-rose-300 px-3 py-2 text-sm"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Stok habis / restoran tutup / lainnya"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      onClick={() => setShowReject(false)}
                      className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-white"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() =>
                        rejectReason.trim() && transition('reject', { reason: rejectReason })
                      }
                      disabled={!rejectReason.trim() || acting}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      Tolak
                    </button>
                  </div>
                </div>
              )}

              {showCancel && (
                <div className="rounded-xl bg-amber-50 p-3">
                  <label className="text-sm font-medium text-amber-800">Alasan pembatalan</label>
                  <input
                    autoFocus
                    type="text"
                    className="mt-1 w-full rounded-lg border border-amber-300 px-3 py-2 text-sm"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      onClick={() => setShowCancel(false)}
                      className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-white"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() =>
                        cancelReason.trim() && transition('cancel', { reason: cancelReason })
                      }
                      disabled={!cancelReason.trim() || acting}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      Batalkan
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Tutup
          </button>
          {o.status === 'NEW' && (
            <>
              <button
                disabled={acting}
                onClick={() => setShowReject(true)}
                className="flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                <X className="h-4 w-4" /> Tolak
              </button>
              <button
                disabled={acting}
                onClick={() => transition('accept')}
                className="flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> Terima
              </button>
            </>
          )}
          {o.status === 'PREPARING' && (
            <>
              <button
                disabled={acting}
                onClick={() => setShowCancel(true)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Batalkan
              </button>
              <button
                disabled={acting}
                onClick={() => transition('ready')}
                className="flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                <ChefHat className="h-4 w-4" /> Tandai Siap
              </button>
            </>
          )}
          {o.status === 'READY' && (
            <button
              disabled={acting}
              onClick={() => transition('complete')}
              className="flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> Selesaikan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }) {
  return (
    <div className="flex justify-between text-gray-600">
      <span>{label}</span>
      <span className={highlight ? 'text-rose-600' : 'text-gray-900'}>
        Rp {Number(value).toLocaleString('id-ID')}
      </span>
    </div>
  );
}

export default function OrdersPage() {
  const [tab, setTab] = useState('NEW');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [channel, setChannel] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: tab, limit: '50' });
      if (channel) params.append('channel', channel);
      const res = await api.get(`/online-order?${params.toString()}`);
      setOrders(res.data.items || []);
    } catch {
      toast.error('Gagal memuat queue');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, channel]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, tab, channel]);

  const counts = useMemo(() => {
    const m = {};
    for (const t of STATUS_TABS) m[t.id] = 0;
    return m;
    // not real-time; tab labels show static counts via subsequent hits if needed
  }, []);

  return (
    <div>
      <PageHeader
        title="Pesanan Online"
        subtitle="Queue real-time semua pesanan dari E-Menu, Consumer App, dan marketplace."
        icon={ShoppingBag}
      >
        <button
          onClick={load}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <RefreshCcw className="h-4 w-4" /> Refresh
        </button>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto refresh 10s
        </label>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterTabs
          tabs={STATUS_TABS.map((t) => ({
            ...t,
            label: counts[t.id] ? `${t.label} (${counts[t.id]})` : t.label,
          }))}
          activeId={tab}
          onChange={setTab}
        />
        <select
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
        >
          <option value="">Semua channel</option>
          {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {loading && orders.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">Memuat queue…</p>
      ) : orders.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Tidak ada pesanan"
            description={`Belum ada order dengan status ${tab}.`}
          />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} onClick={setActive} />
          ))}
        </div>
      )}

      {active && (
        <OrderDetailDialog order={active} onClose={() => setActive(null)} onChanged={load} />
      )}
    </div>
  );
}
