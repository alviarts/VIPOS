import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, Plus, Trash2, CheckCircle, Search } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { formatDate, formatDateTime, formatNumber } from '../utils/format';
import { ConfirmationDialog, EmptyState, PageHeader, FilterTabs } from '../components/ui';

const STATUS_LABEL = {
  draft: { label: 'Draft', cls: 'bg-amber-100 text-amber-700' },
  final: { label: 'Final', cls: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Dibatalkan', cls: 'bg-gray-100 text-gray-600' },
};

export default function StockOpnamePage() {
  const { id } = useParams();
  if (id) return <OpnameDetail id={id} />;
  return <OpnameList />;
}

function OpnameList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();

  const [opnames, setOpnames] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await api.get('/stock-opname');
      setOpnames(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal memuat opname');
    }
  }

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return opnames;
    return opnames.filter((o) => o.status === statusFilter);
  }, [opnames, statusFilter]);

  const counts = useMemo(
    () => ({
      all: opnames.length,
      draft: opnames.filter((o) => o.status === 'draft').length,
      final: opnames.filter((o) => o.status === 'final').length,
    }),
    [opnames]
  );

  async function handleCreate() {
    if (!isAdmin) return;
    setCreating(true);
    try {
      const res = await api.post('/stock-opname', {});
      toast.success(`Draft opname ${res.data.kode} dibuat`);
      navigate(`/inventory/opname/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal membuat opname');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stok Opname"
        subtitle="Hitung fisik vs sistem dan posting selisih"
        icon={ClipboardCheck}
      >
        <Link
          to="/inventory"
          className="text-gray-600 hover:bg-gray-100 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Link>
        {isAdmin && (
          <button
            onClick={handleCreate}
            disabled={creating}
            className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Mulai Opname Baru
          </button>
        )}
      </PageHeader>

      <FilterTabs
        tabs={[
          { id: 'all', label: 'Semua', count: counts.all },
          { id: 'draft', label: 'Draft', count: counts.draft },
          { id: 'final', label: 'Final', count: counts.final },
        ]}
        activeId={statusFilter}
        onChange={setStatusFilter}
      />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-header px-4 py-3 text-left">Kode</th>
              <th className="table-header px-4 py-3 text-left">Tanggal</th>
              <th className="table-header px-4 py-3 text-center">Status</th>
              <th className="table-header px-4 py-3 text-right">Jumlah Item</th>
              <th className="table-header px-4 py-3 text-right">Sudah Dihitung</th>
              <th className="table-header px-4 py-3 text-right">Selisih</th>
              <th className="table-header px-4 py-3 text-left">Dibuat oleh</th>
              <th className="table-header px-4 py-3 text-center w-24">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => {
              const s = STATUS_LABEL[o.status] || { label: o.status, cls: '' };
              return (
                <tr key={o.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-900">{o.kode}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(o.tanggal)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`badge text-[11px] ${s.cls}`}>{s.label}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatNumber(o.item_count || 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatNumber(o.counted_count || 0)} / {formatNumber(o.item_count || 0)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {o.variance_count > 0 ? (
                      <span className="text-amber-700 font-medium">
                        {formatNumber(o.variance_count)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{o.created_by_name || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      to={`/inventory/opname/${o.id}`}
                      className="text-primary-600 hover:underline text-xs"
                    >
                      Buka
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <EmptyState
            icon={ClipboardCheck}
            description="Belum ada opname yang dibuat."
            action={
              isAdmin && (
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" /> Mulai Opname Baru
                </button>
              )
            }
          />
        )}
      </div>
    </div>
  );
}

function OpnameDetail({ id }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();

  const [opname, setOpname] = useState(null);
  const [edits, setEdits] = useState({});
  const [search, setSearch] = useState('');
  const [showVarianceOnly, setShowVarianceOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    try {
      const res = await api.get(`/stock-opname/${id}`);
      setOpname(res.data);
      const initial = {};
      for (const it of res.data.items || []) {
        initial[it.product_id] = {
          qty_fisik: it.qty_fisik == null ? '' : String(it.qty_fisik),
          catatan: it.catatan || '',
        };
      }
      setEdits(initial);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal memuat detail');
    }
  }

  const items = opname?.items || [];
  const filtered = useMemoFilter(items, edits, search, showVarianceOnly);

  if (!opname) {
    return <p className="text-sm text-gray-500 p-4">Memuat...</p>;
  }

  const isDraft = opname.status === 'draft';

  function setEdit(productId, patch) {
    setEdits((prev) => ({
      ...prev,
      [productId]: { ...(prev[productId] || {}), ...patch },
    }));
  }

  async function handleSave() {
    if (!isDraft || !isAdmin) return;
    setSaving(true);
    try {
      const dirty = items
        .filter((it) => {
          const e = edits[it.product_id];
          if (!e) return false;
          const newVal = e.qty_fisik === '' ? null : parseInt(e.qty_fisik, 10);
          return newVal !== it.qty_fisik || (e.catatan || '') !== (it.catatan || '');
        })
        .map((it) => ({
          product_id: it.product_id,
          qty_fisik:
            edits[it.product_id].qty_fisik === ''
              ? null
              : parseInt(edits[it.product_id].qty_fisik, 10),
          catatan: edits[it.product_id].catatan || null,
        }));

      const res = await api.put(`/stock-opname/${id}`, {
        items: dirty,
      });
      setOpname(res.data);
      toast.success(`${dirty.length} item disimpan`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalize() {
    setSaving(true);
    try {
      const res = await api.post(`/stock-opname/${id}/finalize`, { confirm: true });
      setOpname(res.data);
      setConfirmFinalize(false);
      toast.success(`Opname ${res.data.kode} difinalisasi`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal finalize');
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    setSaving(true);
    try {
      await api.delete(`/stock-opname/${id}`);
      setConfirmCancel(false);
      toast.success('Opname dihapus');
      navigate('/inventory/opname');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal hapus');
    } finally {
      setSaving(false);
    }
  }

  const status = STATUS_LABEL[opname.status] || { label: opname.status, cls: '' };

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Opname ${opname.kode}`}
        subtitle={
          <span className="flex items-center gap-2">
            <span className={`badge text-[11px] ${status.cls}`}>{status.label}</span>
            <span className="text-gray-500">{formatDate(opname.tanggal)}</span>
            {opname.finalized_at && (
              <span className="text-xs text-gray-400">
                · Final {formatDateTime(opname.finalized_at)} oleh {opname.finalized_by_name || '-'}
              </span>
            )}
          </span>
        }
        icon={ClipboardCheck}
      >
        <Link
          to="/inventory/opname"
          className="text-gray-600 hover:bg-gray-100 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Link>
        {isDraft && isAdmin && (
          <>
            <button
              onClick={() => setConfirmCancel(true)}
              className="text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 border border-rose-200"
            >
              <Trash2 className="w-4 h-4" /> Hapus Draft
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-primary-600 hover:bg-primary-50 px-3 py-2 rounded-lg text-sm font-medium border border-primary-200 disabled:opacity-50"
            >
              Simpan Hitung
            </button>
            <button
              onClick={() => setConfirmFinalize(true)}
              disabled={saving}
              className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" /> Finalize Opname
            </button>
          </>
        )}
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Item" value={formatNumber(opname.item_count || 0)} />
        <StatCard
          label="Sudah Dihitung"
          value={`${formatNumber(opname.counted_count || 0)} / ${formatNumber(opname.item_count || 0)}`}
        />
        <StatCard
          label="Item dengan Selisih"
          value={formatNumber(opname.variance_count || 0)}
          highlight={opname.variance_count > 0}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 select-none">
            <input
              type="checkbox"
              checked={showVarianceOnly}
              onChange={(e) => setShowVarianceOnly(e.target.checked)}
              className="rounded"
            />
            Hanya yang ada selisih
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header px-4 py-3 text-left">Produk</th>
                <th className="table-header px-4 py-3 text-right">Stok Sistem</th>
                <th className="table-header px-4 py-3 text-right w-32">Hitung Fisik</th>
                <th className="table-header px-4 py-3 text-right">Selisih</th>
                <th className="table-header px-4 py-3 text-left">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => {
                const e = edits[it.product_id] || { qty_fisik: '', catatan: '' };
                const fisikNum = e.qty_fisik === '' ? null : parseInt(e.qty_fisik, 10);
                const selisih =
                  fisikNum == null || Number.isNaN(fisikNum) ? null : fisikNum - it.qty_sistem;
                return (
                  <tr key={it.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{it.product_name}</p>
                      <p className="text-xs text-gray-400 font-mono">{it.product_sku}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatNumber(it.qty_sistem)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isDraft && isAdmin ? (
                        <input
                          type="number"
                          min="0"
                          value={e.qty_fisik}
                          onChange={(ev) => setEdit(it.product_id, { qty_fisik: ev.target.value })}
                          className="input-field text-right py-1.5 px-2"
                          placeholder="—"
                        />
                      ) : (
                        <span className="text-gray-700">
                          {it.qty_fisik == null ? '—' : formatNumber(it.qty_fisik)}
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        selisih == null
                          ? 'text-gray-400'
                          : selisih === 0
                            ? 'text-gray-500'
                            : selisih > 0
                              ? 'text-emerald-600'
                              : 'text-rose-600'
                      }`}
                    >
                      {selisih == null
                        ? '—'
                        : selisih > 0
                          ? `+${formatNumber(selisih)}`
                          : formatNumber(selisih)}
                    </td>
                    <td className="px-4 py-3">
                      {isDraft && isAdmin ? (
                        <input
                          type="text"
                          value={e.catatan}
                          onChange={(ev) => setEdit(it.product_id, { catatan: ev.target.value })}
                          className="input-field py-1.5 px-2"
                          placeholder="Opsional..."
                        />
                      ) : (
                        <span className="text-gray-600">{it.catatan || '-'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 p-6 text-center">
              Tidak ada item yang cocok dengan filter.
            </p>
          )}
        </div>
      </div>

      <ConfirmationDialog
        open={confirmFinalize}
        title="Finalize Opname?"
        message={`Akan diposting ${opname.variance_count || 0} pergerakan stok untuk item-item yang ada selisih. Setelah final, opname tidak bisa diubah lagi. Lanjutkan?`}
        confirmLabel="Ya, Finalize"
        loading={saving}
        onCancel={() => setConfirmFinalize(false)}
        onConfirm={handleFinalize}
      />

      <ConfirmationDialog
        open={confirmCancel}
        title="Hapus Draft Opname?"
        message="Draft akan dihapus permanen. Stok belum di-update karena belum di-finalize."
        confirmLabel="Ya, Hapus"
        loading={saving}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={handleCancel}
      />
    </div>
  );
}

function useMemoFilter(items, edits, search, showVarianceOnly) {
  return useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((it) => {
      if (q) {
        const hay = `${it.product_name || ''} ${it.product_sku || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (showVarianceOnly) {
        const e = edits[it.product_id];
        const fisik = e && e.qty_fisik !== '' ? parseInt(e.qty_fisik, 10) : it.qty_fisik;
        if (fisik == null || Number.isNaN(fisik)) return false;
        if (fisik === it.qty_sistem) return false;
      }
      return true;
    });
  }, [items, edits, search, showVarianceOnly]);
}

function StatCard({ label, value, highlight }) {
  return (
    <div
      className={`bg-white rounded-xl border p-4 ${
        highlight ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200'
      }`}
    >
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}
