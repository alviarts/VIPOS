import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, Warehouse, X, ArrowUpCircle, ArrowDownCircle, ClipboardCheck,
  Box, AlertTriangle,
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate, formatNumber } from '../utils/format';
import {
  ConfirmationDialog, EmptyState, Pagination, FilterTabs, PageHeader,
} from '../components/ui';

const TIPE_LABEL = {
  stok_in: 'Stok Masuk',
  stok_out: 'Stok Keluar',
  opname: 'Opname',
};

const TIPE_TABS = [
  { id: 'all', label: 'Semua' },
  { id: 'stok_in', label: 'Stok Masuk' },
  { id: 'stok_out', label: 'Stok Keluar' },
  { id: 'opname', label: 'Opname' },
];

export default function InventoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [tipeFilter, setTipeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initForm());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [movRes, prodRes, sumRes] = await Promise.all([
        api.get('/inventory/movements?limit=500'),
        api.get('/products?active_only=true'),
        api.get('/inventory/summary'),
      ]);
      setMovements(movRes.data);
      setProducts(prodRes.data);
      setSummary(sumRes.data);
    } catch (err) {
      toast.error('Gagal memuat inventori');
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return movements.filter((m) => {
      if (tipeFilter !== 'all' && m.tipe !== tipeFilter) return false;
      if (q) {
        return [m.product_name, m.product_sku, m.keterangan]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(q));
      }
      return true;
    });
  }, [movements, tipeFilter, search]);

  const counts = useMemo(() => ({
    all: movements.length,
    stok_in: movements.filter((m) => m.tipe === 'stok_in').length,
    stok_out: movements.filter((m) => m.tipe === 'stok_out').length,
    opname: movements.filter((m) => m.tipe === 'opname').length,
  }), [movements]);

  const total = filtered.length;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [tipeFilter, search]);

  const openForm = (tipe) => {
    setForm({ ...initForm(), tipe });
    setErrors({});
    setShowForm(true);
  };

  const validate = () => {
    const errs = {};
    if (!form.product_id) errs.product_id = 'Produk wajib dipilih';
    if (!form.qty || parseInt(form.qty, 10) <= 0)
      errs.qty = 'Jumlah harus lebih dari 0';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    setConfirmSave(true);
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    try {
      await api.post('/inventory/movements', {
        product_id: parseInt(form.product_id, 10),
        tipe: form.tipe,
        qty: parseInt(form.qty, 10),
        tanggal: form.tanggal,
        keterangan: form.keterangan.trim() || null,
      });
      toast.success(`${TIPE_LABEL[form.tipe]} berhasil dicatat`);
      setConfirmSave(false);
      setShowForm(false);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Inventori" subtitle="Kelola pergerakan stok produk" icon={Warehouse}>
        {isAdmin && (
          <>
            <button
              onClick={() => openForm('stok_in')}
              className="flex items-center gap-1.5 text-emerald-600 hover:bg-emerald-50 px-3 py-2 rounded-lg text-sm font-medium border border-emerald-200"
            >
              <ArrowUpCircle className="w-4 h-4" /> Stok Masuk
            </button>
            <button
              onClick={() => openForm('stok_out')}
              className="flex items-center gap-1.5 text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-lg text-sm font-medium border border-rose-200"
            >
              <ArrowDownCircle className="w-4 h-4" /> Stok Keluar
            </button>
            <button
              onClick={() => openForm('opname')}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <ClipboardCheck className="w-4 h-4" /> Opname Stok
            </button>
          </>
        )}
      </PageHeader>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard
            icon={<Box className="w-5 h-5 text-primary-600" />}
            label="Total Produk Aktif"
            value={formatNumber(summary.total_products)}
          />
          <SummaryCard
            icon={<Warehouse className="w-5 h-5 text-blue-600" />}
            label="Total Stok"
            value={formatNumber(summary.total_stock)}
          />
          <SummaryCard
            icon={<Box className="w-5 h-5 text-emerald-600" />}
            label="Nilai Stok (Modal)"
            value={formatCurrency(summary.total_value_modal || 0)}
          />
          <SummaryCard
            icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
            label="Stok Menipis"
            value={formatNumber(summary.low_stock_count || 0)}
            highlight={summary.low_stock_count > 0}
          />
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Cari produk atau keterangan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-9"
        />
      </div>

      {/* Filter tabs */}
      <FilterTabs
        tabs={TIPE_TABS.map((t) => ({ ...t, count: counts[t.id] }))}
        activeId={tipeFilter}
        onChange={setTipeFilter}
      />

      {/* Movements table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header px-4 py-3 text-left">Tanggal</th>
                <th className="table-header px-4 py-3 text-left">Produk</th>
                <th className="table-header px-4 py-3 text-center">Tipe</th>
                <th className="table-header px-4 py-3 text-right">Qty</th>
                <th className="table-header px-4 py-3 text-right">Stok Sebelum</th>
                <th className="table-header px-4 py-3 text-right">Stok Sesudah</th>
                <th className="table-header px-4 py-3 text-left">Keterangan</th>
                <th className="table-header px-4 py-3 text-left">User</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((m) => (
                <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{formatDate(m.tanggal)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{m.product_name}</p>
                    <p className="text-xs text-gray-400 font-mono">{m.product_sku}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <TipeBadge tipe={m.tipe} />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {m.tipe === 'stok_in' ? '+' : m.tipe === 'stok_out' ? '-' : ''}
                    {formatNumber(m.qty)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{formatNumber(m.stok_sebelum)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{formatNumber(m.stok_sesudah)}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={m.keterangan || ''}>
                    {m.keterangan || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{m.user_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paged.length === 0 && (
          <EmptyState
            description="Belum ada pergerakan stok yang tercatat."
            action={isAdmin && (
              <button onClick={() => openForm('stok_in')} className="btn-primary text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" /> Catat Stok Masuk
              </button>
            )}
          />
        )}

        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {showForm && (
        <MovementFormPage
          form={form}
          setForm={setForm}
          products={products}
          errors={errors}
          onCancel={() => setShowForm(false)}
          onSave={handleSave}
        />
      )}

      <ConfirmationDialog
        open={confirmSave}
        title={`Simpan ${TIPE_LABEL[form.tipe] || ''}`}
        message={buildConfirmMessage(form, products)}
        confirmLabel="Ya, Lanjutkan"
        loading={saving}
        onCancel={() => setConfirmSave(false)}
        onConfirm={handleConfirmSave}
      />
    </div>
  );
}

function SummaryCard({ icon, label, value, highlight }) {
  return (
    <div className={`bg-white rounded-xl border p-4 flex items-center gap-3 ${
      highlight ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200'
    }`}>
      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className="text-lg font-bold text-gray-900 truncate">{value}</p>
      </div>
    </div>
  );
}

function TipeBadge({ tipe }) {
  const map = {
    stok_in: { label: 'Stok Masuk', cls: 'bg-emerald-100 text-emerald-700' },
    stok_out: { label: 'Stok Keluar', cls: 'bg-rose-100 text-rose-700' },
    opname: { label: 'Opname', cls: 'bg-blue-100 text-blue-700' },
  };
  const t = map[tipe] || { label: tipe, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`badge ${t.cls}`}>{t.label}</span>;
}

function initForm() {
  return {
    product_id: '',
    tipe: 'stok_in',
    qty: '',
    tanggal: new Date().toISOString().slice(0, 10),
    keterangan: '',
  };
}

function buildConfirmMessage(form, products) {
  const product = products.find((p) => String(p.id) === String(form.product_id));
  const productName = product?.name || '-';
  const qty = parseInt(form.qty, 10) || 0;
  if (form.tipe === 'opname') {
    return `Stok produk "${productName}" akan disesuaikan menjadi ${qty}. Lanjutkan?`;
  }
  return `${TIPE_LABEL[form.tipe]} sebesar ${qty} unit untuk produk "${productName}" akan dicatat. Lanjutkan?`;
}

function MovementFormPage({ form, setForm, products, errors, onCancel, onSave }) {
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const product = products.find((p) => String(p.id) === String(form.product_id));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">
            Catat {TIPE_LABEL[form.tipe]}
          </h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-2xl mx-auto p-4 sm:p-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Tipe
              </label>
              <select
                value={form.tipe}
                onChange={(e) => set({ tipe: e.target.value })}
                className="input-field"
              >
                <option value="stok_in">Stok Masuk (Pembelian / Penerimaan)</option>
                <option value="stok_out">Stok Keluar (Pemakaian / Rusak)</option>
                <option value="opname">Opname (Sesuaikan stok aktual)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Produk<span className="text-red-500 ml-0.5">*</span>
              </label>
              <select
                value={form.product_id}
                onChange={(e) => set({ product_id: e.target.value })}
                className="input-field"
              >
                <option value="">Pilih produk...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) — stok: {p.stock}
                  </option>
                ))}
              </select>
              {errors.product_id && <p className="text-xs text-red-500 mt-1">{errors.product_id}</p>}
              {product && (
                <p className="text-xs text-gray-500 mt-1">
                  Stok saat ini: <strong>{product.stock}</strong> {product.satuan || ''}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {form.tipe === 'opname' ? 'Stok Aktual' : 'Jumlah'}
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.qty}
                  onChange={(e) => set({ qty: e.target.value })}
                  className="input-field"
                  placeholder="0"
                />
                {errors.qty && <p className="text-xs text-red-500 mt-1">{errors.qty}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal</label>
                <input
                  type="date"
                  value={form.tanggal}
                  onChange={(e) => set({ tanggal: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Keterangan</label>
              <textarea
                value={form.keterangan}
                onChange={(e) => set({ keterangan: e.target.value })}
                rows={2}
                className="input-field resize-none"
                placeholder="Contoh: Pembelian dari supplier ABC"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 px-4 sm:px-6 py-3 bg-white flex items-center justify-between">
        <button
          onClick={onCancel}
          className="text-primary-600 hover:bg-primary-50 px-3 py-2 rounded-lg text-sm font-medium"
        >
          Batal
        </button>
        <button onClick={onSave} className="btn-primary text-sm">
          Simpan
        </button>
      </div>
    </div>
  );
}
