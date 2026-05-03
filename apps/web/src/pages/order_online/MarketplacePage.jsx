// Halaman Marketplace (P1-12) — connect / disconnect / sync produk per provider.
// Mock OAuth — tinggal swap saat ada API key real.
import { useEffect, useState } from 'react';
import {
  ShoppingBag,
  Power,
  PowerOff,
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
  Settings as SettingsIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { EmptyState, PageHeader } from '../../components/ui';

const PROVIDERS = [
  {
    id: 'gofood',
    label: 'GoFood',
    desc: 'Gojek F&B marketplace',
    color: 'bg-emerald-50 ring-emerald-200',
  },
  {
    id: 'grabfood',
    label: 'GrabFood',
    desc: 'Grab F&B marketplace',
    color: 'bg-emerald-50 ring-emerald-200',
  },
  {
    id: 'shopeefood',
    label: 'ShopeeFood',
    desc: 'Shopee F&B + grocery',
    color: 'bg-orange-50 ring-orange-200',
  },
  {
    id: 'grabmart',
    label: 'GrabMart',
    desc: 'Grab grocery / retail',
    color: 'bg-emerald-50 ring-emerald-200',
  },
  {
    id: 'tokopedia',
    label: 'Tokopedia',
    desc: 'Marketplace umum',
    color: 'bg-green-50 ring-green-200',
  },
];

function ConnectDialog({ provider, onClose, onConnected }) {
  const [form, setForm] = useState({
    merchant_id: '',
    outlet_id: '',
    auto_accept: 0,
    sla_accept_minutes: 5,
    sla_ready_minutes: 15,
    mdr_percent: 20,
    price_markup_percent: 20,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.merchant_id.trim()) {
      toast.error('Merchant ID wajib diisi');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/marketplace/${provider.id}/connect`, {
        ...form,
        auto_accept: Number(form.auto_accept),
        sla_accept_minutes: Number(form.sla_accept_minutes),
        sla_ready_minutes: Number(form.sla_ready_minutes),
        mdr_percent: Number(form.mdr_percent),
        price_markup_percent: Number(form.price_markup_percent),
      });
      toast.success(`${provider.label} terhubung`);
      onConnected();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal connect');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-bold">Hubungkan {provider.label}</h3>
          <button onClick={onClose} className="rounded p-2 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-6">
          <p className="text-xs text-gray-500">
            Mock OAuth — kredensial sintetis disimpan untuk simulasi. Saat integrasi resmi tersedia,
            isi merchant_id + outlet_id sesuai onboarding marketplace.
          </p>
          <div>
            <label className="text-sm font-medium">Merchant ID</label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.merchant_id}
              onChange={(e) => setForm({ ...form, merchant_id: e.target.value })}
              placeholder="MER-12345"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Outlet ID</label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.outlet_id}
              onChange={(e) => setForm({ ...form, outlet_id: e.target.value })}
              placeholder="OUT-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">SLA Accept (menit)</label>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.sla_accept_minutes}
                onChange={(e) => setForm({ ...form, sla_accept_minutes: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">SLA Ready (menit)</label>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.sla_ready_minutes}
                onChange={(e) => setForm({ ...form, sla_ready_minutes: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">MDR (%)</label>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.mdr_percent}
                onChange={(e) => setForm({ ...form, mdr_percent: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Markup harga (%)</label>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.price_markup_percent}
                onChange={(e) => setForm({ ...form, price_markup_percent: e.target.value })}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Number(form.auto_accept) === 1}
              onChange={(e) =>
                setForm({
                  ...form,
                  auto_accept: e.target.checked ? 1 : 0,
                })
              }
            />
            Auto-accept order masuk
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Batal
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Menghubungkan…' : 'Hubungkan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductMappingDialog({ provider, onClose }) {
  const [overrides, setOverrides] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [o, p] = await Promise.all([
        api.get(`/marketplace/${provider.id}/products`),
        api.get('/products?limit=200'),
      ]);
      setOverrides(o.data || []);
      setProducts(p.data?.items || p.data || []);
    } catch {
      toast.error('Gagal memuat produk');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.id]);

  async function save() {
    try {
      await api.post(`/marketplace/${provider.id}/products`, {
        product_id: editing.product_id,
        override_name: editing.override_name || null,
        override_price: editing.override_price ? Number(editing.override_price) : null,
        is_enabled: Number(editing.is_enabled ?? 1),
      });
      toast.success('Override tersimpan');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal');
    }
  }

  async function syncNow() {
    try {
      const res = await api.post(`/marketplace/${provider.id}/sync-products`);
      toast.success(`${res.data.synced} produk ter-sync`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal sync');
    }
  }

  const overrideById = new Map(overrides.map((o) => [o.product_id, o]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold">Sync Produk — {provider.label}</h3>
            <p className="text-xs text-gray-500">
              Override harga, nama, dan visibility per produk untuk marketplace ini.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={syncNow}
              className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              <RefreshCw className="h-4 w-4" /> Sync sekarang
            </button>
            <button onClick={onClose} className="rounded p-2 text-gray-400 hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-sm text-gray-400">Memuat…</p>
          ) : products.length === 0 ? (
            <EmptyState
              title="Belum ada produk"
              description="Tambah produk dulu di halaman Produk."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl ring-1 ring-gray-100">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Produk</th>
                    <th className="px-4 py-2 text-right">Harga base</th>
                    <th className="px-4 py-2 text-right">Override harga</th>
                    <th className="px-4 py-2 text-center">Aktif</th>
                    <th className="px-4 py-2 text-center">Sync</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((p) => {
                    const ov = overrideById.get(p.id);
                    return (
                      <tr key={p.id}>
                        <td className="px-4 py-2 font-medium">{p.name}</td>
                        <td className="px-4 py-2 text-right">
                          Rp {Number(p.price).toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {ov?.override_price
                            ? `Rp ${Number(ov.override_price).toLocaleString('id-ID')}`
                            : '—'}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {ov?.is_enabled === 0 ? '✕' : '✓'}
                        </td>
                        <td className="px-4 py-2 text-center text-xs">
                          {ov?.sync_status || 'pending'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() =>
                              setEditing({
                                product_id: p.id,
                                product_name: p.name,
                                override_name: ov?.override_name || '',
                                override_price: ov?.override_price ?? '',
                                is_enabled: ov?.is_enabled ?? 1,
                              })
                            }
                            className="rounded px-2 py-1 text-xs text-primary-700 hover:bg-primary-50"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-bold">Edit override — {editing.product_name}</h3>
                <button
                  onClick={() => setEditing(null)}
                  className="rounded p-2 text-gray-400 hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3 p-6">
                <div>
                  <label className="text-sm font-medium">Override nama</label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    value={editing.override_name}
                    onChange={(e) => setEditing({ ...editing, override_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Override harga (Rp)</label>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    value={editing.override_price}
                    onChange={(e) => setEditing({ ...editing, override_price: e.target.value })}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Number(editing.is_enabled) === 1}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        is_enabled: e.target.checked ? 1 : 0,
                      })
                    }
                  />
                  Tampilkan di marketplace
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-3">
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                >
                  Batal
                </button>
                <button
                  onClick={save}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectFor, setConnectFor] = useState(null);
  const [mappingFor, setMappingFor] = useState(null);
  const [settlement, setSettlement] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        api.get('/marketplace'),
        api.get('/marketplace/settlement'),
      ]);
      setConnections(c.data || []);
      setSettlement(s.data || null);
    } catch {
      toast.error('Gagal memuat marketplace');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function disconnect(provider) {
    if (!confirm(`Disconnect ${provider}?`)) return;
    try {
      await api.post(`/marketplace/${provider}/disconnect`);
      toast.success('Disconnected');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal');
    }
  }

  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  return (
    <div>
      <PageHeader
        title="Marketplace"
        subtitle="Hubungkan ke GoFood, GrabFood, ShopeeFood, GrabMart, Tokopedia. Sync produk + auto-accept + settlement report."
        icon={ShoppingBag}
      />

      {loading ? (
        <p className="text-sm text-gray-400">Memuat…</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {PROVIDERS.map((p) => {
            const conn = byProvider.get(p.id);
            const isConnected = conn?.status === 'connected';
            return (
              <div key={p.id} className={`rounded-2xl p-4 shadow-sm ring-1 ${p.color}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{p.label}</h3>
                    <p className="text-xs text-gray-600">{p.desc}</p>
                    <div className="mt-2 flex items-center gap-1 text-xs">
                      {isConnected ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span className="text-emerald-700">Connected · {conn.merchant_id}</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-500">Belum terhubung</span>
                        </>
                      )}
                    </div>
                    {isConnected && (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <span>SLA accept: {conn.sla_accept_minutes}m</span>
                        <span>SLA ready: {conn.sla_ready_minutes}m</span>
                        <span>MDR: {conn.mdr_percent}%</span>
                        <span>Markup: {conn.price_markup_percent}%</span>
                        {conn.last_sync_at && (
                          <span className="col-span-2">
                            Last sync: {String(conn.last_sync_at).slice(0, 19)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex flex-col gap-1">
                      {isConnected ? (
                        <>
                          <button
                            onClick={() => setMappingFor(p)}
                            className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
                            title="Sync produk"
                          >
                            <SettingsIcon className="h-3 w-3" /> Produk
                          </button>
                          <button
                            onClick={() => disconnect(p.id)}
                            className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50"
                          >
                            <PowerOff className="h-3 w-3" /> Disconnect
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConnectFor(p)}
                          className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                        >
                          <Power className="h-3 w-3" /> Connect
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {settlement && settlement.rows && settlement.rows.length > 0 && (
        <div className="mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <h3 className="text-base font-bold text-gray-900">Settlement Report</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Provider</th>
                  <th className="px-4 py-2 text-right">Order Selesai</th>
                  <th className="px-4 py-2 text-right">Gross (Rp)</th>
                  <th className="px-4 py-2 text-right">MDR (Rp)</th>
                  <th className="px-4 py-2 text-right">Net (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {settlement.rows.map((r) => (
                  <tr key={r.provider}>
                    <td className="px-4 py-2 font-medium">{r.provider}</td>
                    <td className="px-4 py-2 text-right">{r.completed_orders}</td>
                    <td className="px-4 py-2 text-right">
                      {Number(r.gross_revenue).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-2 text-right text-rose-600">
                      {Number(r.mdr).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {Number(r.net_revenue).toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-bold">
                  <td className="px-4 py-2">TOTAL</td>
                  <td className="px-4 py-2"></td>
                  <td className="px-4 py-2 text-right">
                    {Number(settlement.total_gross).toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-2 text-right text-rose-600">
                    {Number(settlement.total_mdr).toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {Number(settlement.total_net).toLocaleString('id-ID')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {connectFor && (
        <ConnectDialog
          provider={connectFor}
          onClose={() => setConnectFor(null)}
          onConnected={() => {
            setConnectFor(null);
            load();
          }}
        />
      )}

      {mappingFor && (
        <ProductMappingDialog provider={mappingFor} onClose={() => setMappingFor(null)} />
      )}
    </div>
  );
}
