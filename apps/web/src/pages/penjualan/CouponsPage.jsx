// Coupon management — list, single create, bulk generate, batch overview.
import { useEffect, useState } from 'react';
import { Copy, Download, Plus, Tag, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { ConfirmationDialog, EmptyState, FilterTabs, PageHeader } from '../../components/ui';

const TABS = [
  { id: 'list', label: 'Semua Kupon' },
  { id: 'batches', label: 'Batch' },
];

function downloadCsv(filename, rows) {
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function SingleCouponDialog({ promos, onClose, onSaved }) {
  const [form, setForm] = useState({
    promo_id: promos[0]?.id || '',
    code: '',
    max_uses: 1,
    valid_until: '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.code.trim()) {
      toast.error('Kode kupon wajib');
      return;
    }
    if (!form.promo_id) {
      toast.error('Pilih promo terlebih dahulu');
      return;
    }
    setSaving(true);
    try {
      await api.post('/coupon', {
        promo_id: Number(form.promo_id),
        code: form.code.trim().toUpperCase(),
        max_uses: Number(form.max_uses) || 1,
        valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
        is_active: true,
      });
      toast.success('Kupon dibuat');
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal membuat kupon');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-bold">Buat Kupon</h3>
          <button onClick={onClose} className="rounded p-2 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-6">
          <div>
            <label className="text-sm font-medium">Promo terkait</label>
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.promo_id}
              onChange={(e) => setForm({ ...form, promo_id: e.target.value })}
            >
              <option value="">Pilih promo</option>
              {promos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Kode kupon</label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 uppercase"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="cth. WELCOME25"
              maxLength={64}
            />
            <p className="mt-1 text-xs text-gray-500">Huruf, angka, _ dan - saja.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Maks pemakaian</label>
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Berlaku sampai</label>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.valid_until}
                onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
              />
            </div>
          </div>
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
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkCouponDialog({ promos, onClose, onSaved }) {
  const [form, setForm] = useState({
    promo_id: promos[0]?.id || '',
    count: 100,
    prefix: '',
    code_length: 8,
    max_uses: 1,
    valid_until: '',
  });
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState(null);

  async function save() {
    if (!form.promo_id) {
      toast.error('Pilih promo dulu');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/coupon/bulk', {
        promo_id: Number(form.promo_id),
        count: Number(form.count),
        prefix: form.prefix.trim().toUpperCase(),
        code_length: Number(form.code_length),
        max_uses: Number(form.max_uses) || 1,
        valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
      });
      setGenerated(res.data);
      toast.success(`${res.data.count} kupon dibuat`);
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal generate kupon');
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    if (!generated) return;
    const rows = [['code', 'batch_id'], ...generated.codes.map((c) => [c, generated.batch_id])];
    downloadCsv(`coupons-${generated.batch_id}.csv`, rows);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-bold">Bulk Generate Kupon</h3>
          <button onClick={onClose} className="rounded p-2 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!generated ? (
          <div className="space-y-3 p-6">
            <div>
              <label className="text-sm font-medium">Promo terkait</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.promo_id}
                onChange={(e) => setForm({ ...form, promo_id: e.target.value })}
              >
                <option value="">Pilih promo</option>
                {promos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Jumlah kode</label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={form.count}
                  onChange={(e) => setForm({ ...form, count: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Panjang kode</label>
                <input
                  type="number"
                  min={4}
                  max={32}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={form.code_length}
                  onChange={(e) => setForm({ ...form, code_length: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Prefix (opsional)</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 uppercase"
                  value={form.prefix}
                  onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })}
                  placeholder="cth. JAN-"
                  maxLength={16}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Maks pemakaian / kode</label>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Berlaku sampai</label>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.valid_until}
                onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3 p-6">
            <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              Berhasil generate <strong>{generated.count}</strong> kupon —{' '}
              <code className="rounded bg-white px-1">{generated.batch_id}</code>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 p-2 font-mono text-xs">
              {generated.codes.map((c) => (
                <div
                  key={c}
                  className="flex items-center justify-between border-b border-gray-100 py-0.5"
                >
                  <span>{c}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(c)}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100"
                    title="Copy"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-3">
          {!generated ? (
            <>
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
                {saving ? 'Generating…' : 'Generate'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={exportCsv}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
              <button
                onClick={onClose}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"
              >
                Selesai
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CouponsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('list');
  const [list, setList] = useState({ items: [], total: 0 });
  const [batches, setBatches] = useState([]);
  const [promos, setPromos] = useState([]);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [showSingle, setShowSingle] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterActive) params.set('is_active', filterActive);
      const [listRes, batchRes, promoRes] = await Promise.all([
        api.get(`/coupon?${params.toString()}`),
        api.get('/coupon/batches'),
        api.get('/promo?is_active=1'),
      ]);
      setList(listRes.data);
      setBatches(batchRes.data);
      setPromos(promoRes.data);
    } catch (_err) {
      toast.error('Gagal memuat data kupon');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterActive]);

  async function deleteCoupon(id) {
    try {
      await api.delete(`/coupon/${id}`);
      toast.success('Kupon dihapus');
      load();
    } catch (_err) {
      toast.error('Gagal hapus kupon');
    } finally {
      setConfirmDelete(null);
    }
  }

  async function deactivateBatch(batchId) {
    try {
      const res = await api.delete(`/coupon/batch/${batchId}`);
      toast.success(`${res.data.updated} kupon dinonaktifkan`);
      load();
    } catch (_err) {
      toast.error('Gagal deactivate batch');
    } finally {
      setConfirmBatchDelete(null);
    }
  }

  function exportCurrentList() {
    const rows = [
      ['code', 'promo', 'used', 'max_uses', 'is_active'],
      ...list.items.map((c) => [
        c.code,
        c.promo_name || '',
        c.used_count,
        c.max_uses,
        c.is_active ? 1 : 0,
      ]),
    ];
    downloadCsv(`coupons-export-${Date.now()}.csv`, rows);
  }

  return (
    <div>
      <PageHeader
        title="Kupon"
        subtitle="Kelola kode kupon (single & bulk) yang trigger promo saat redeem."
        icon={Tag}
      >
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => setShowSingle(true)}
              className="flex items-center gap-2 rounded-lg border border-primary-600 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50"
            >
              <Plus className="h-4 w-4" /> Buat Kupon
            </button>
            <button
              type="button"
              onClick={() => setShowBulk(true)}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" /> Bulk Generate
            </button>
          </>
        )}
      </PageHeader>

      <FilterTabs tabs={TABS} activeId={tab} onChange={setTab} />

      {tab === 'list' && (
        <div className="mt-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Cari kode kupon…"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm uppercase"
              value={search}
              onChange={(e) => setSearch(e.target.value.toUpperCase())}
            />
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">Semua status</option>
              <option value="1">Aktif</option>
              <option value="0">Nonaktif</option>
            </select>
            <button
              type="button"
              onClick={exportCurrentList}
              className="ml-auto flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Kode</th>
                  <th className="px-4 py-3 text-left">Promo</th>
                  <th className="px-4 py-3 text-left">Pakai</th>
                  <th className="px-4 py-3 text-left">Berlaku</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      Memuat…
                    </td>
                  </tr>
                ) : list.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8">
                      <EmptyState
                        title="Belum ada kupon"
                        description="Buat kupon single atau bulk generate untuk dipakai pelanggan."
                      />
                    </td>
                  </tr>
                ) : (
                  list.items.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono">{c.code}</td>
                      <td className="px-4 py-3">{c.promo_name || '—'}</td>
                      <td className="px-4 py-3">
                        {c.used_count}/{c.max_uses}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {c.valid_until ? new Date(c.valid_until).toLocaleString('id-ID') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            c.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {c.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(c)}
                            className="rounded p-1 text-red-600 hover:bg-red-50"
                            aria-label="Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Total: {list.total} kupon (showing {list.items.length})
          </p>
        </div>
      )}

      {tab === 'batches' && (
        <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Batch ID</th>
                <th className="px-4 py-3 text-left">Promo</th>
                <th className="px-4 py-3 text-left">Generated</th>
                <th className="px-4 py-3 text-left">Used</th>
                <th className="px-4 py-3 text-left">Sisa</th>
                <th className="px-4 py-3 text-left">Dibuat</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8">
                    <EmptyState title="Belum ada batch" description="Generate batch kupon dulu." />
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.batch_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{b.batch_id}</td>
                    <td className="px-4 py-3">{b.promo_name || '—'}</td>
                    <td className="px-4 py-3">{b.generated}</td>
                    <td className="px-4 py-3">{b.used}</td>
                    <td className="px-4 py-3">{b.remaining}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(b.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setConfirmBatchDelete(b)}
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          Nonaktifkan
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showSingle && (
        <SingleCouponDialog promos={promos} onClose={() => setShowSingle(false)} onSaved={load} />
      )}
      {showBulk && (
        <BulkCouponDialog promos={promos} onClose={() => setShowBulk(false)} onSaved={load} />
      )}
      <ConfirmationDialog
        open={!!confirmDelete}
        title="Hapus kupon?"
        message={confirmDelete ? `Kupon "${confirmDelete.code}" akan dihapus permanen.` : ''}
        confirmLabel="Hapus"
        variant="danger"
        onConfirm={() => confirmDelete && deleteCoupon(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />
      <ConfirmationDialog
        open={!!confirmBatchDelete}
        title="Nonaktifkan batch?"
        message={
          confirmBatchDelete
            ? `Semua kupon di batch ${confirmBatchDelete.batch_id} akan di-set inactive (tidak dihapus).`
            : ''
        }
        confirmLabel="Nonaktifkan"
        variant="danger"
        onConfirm={() => confirmBatchDelete && deactivateBatch(confirmBatchDelete.batch_id)}
        onCancel={() => setConfirmBatchDelete(null)}
      />
    </div>
  );
}
