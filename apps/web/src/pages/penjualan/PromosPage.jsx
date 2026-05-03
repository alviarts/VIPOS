// Promo list + builder. Mendukung 8 jenis promo dengan filter status & jenis.
import { useEffect, useMemo, useState } from 'react';
import { Edit2, Plus, Sparkles, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { ConfirmationDialog, EmptyState, FilterTabs, PageHeader } from '../../components/ui';
import PromoBuilder, { PROMO_TYPES } from '../../components/promo/PromoBuilder';

const STATUS_TABS = [
  { id: 'all', label: 'Semua' },
  { id: 'active', label: 'Aktif' },
  { id: 'inactive', label: 'Nonaktif' },
];

function badgeColor(type) {
  const map = {
    PERCENT: 'bg-emerald-50 text-emerald-700',
    NOMINAL: 'bg-blue-50 text-blue-700',
    FREE_PRODUCT: 'bg-pink-50 text-pink-700',
    BUY_X_GET_Y: 'bg-purple-50 text-purple-700',
    BUNDLE_PRICE: 'bg-orange-50 text-orange-700',
    MIN_PURCHASE: 'bg-cyan-50 text-cyan-700',
    STEP_DISCOUNT: 'bg-yellow-50 text-yellow-700',
    MEMBER_PRICE: 'bg-indigo-50 text-indigo-700',
  };
  return map[type] || 'bg-gray-100 text-gray-700';
}

function formatValue(p) {
  if (p.promo_type === 'PERCENT') {
    return `${p.discount_value}%${
      p.max_discount ? ` (max Rp ${Number(p.max_discount).toLocaleString('id-ID')})` : ''
    }`;
  }
  if (p.promo_type === 'BUNDLE_PRICE') {
    return `Paket Rp ${Number(p.bundle_price || 0).toLocaleString('id-ID')}`;
  }
  if (p.promo_type === 'BUY_X_GET_Y') {
    return `Beli ${p.qty_required}, gratis ${p.give_qty}`;
  }
  if (p.promo_type === 'STEP_DISCOUNT') {
    return `${(p.step_tiers || []).length} tier`;
  }
  return `Rp ${Number(p.discount_value || 0).toLocaleString('id-ID')}`;
}

export default function PromosPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [promos, setPromos] = useState([]);
  const [statusTab, setStatusTab] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/promo');
      setPromos(res.data);
    } catch (err) {
      toast.error('Gagal memuat promo');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return promos.filter((p) => {
      if (statusTab === 'active' && !p.is_active) return false;
      if (statusTab === 'inactive' && p.is_active) return false;
      if (typeFilter !== 'all' && p.promo_type !== typeFilter) return false;
      if (
        search &&
        !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !(p.description || '').toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [promos, statusTab, typeFilter, search]);

  function startCreate() {
    setEditingPromo(null);
    setShowBuilder(true);
  }
  function startEdit(promo) {
    setEditingPromo(promo);
    setShowBuilder(true);
  }
  function closeBuilder() {
    setShowBuilder(false);
    setEditingPromo(null);
  }
  async function deletePromo(id) {
    try {
      await api.delete(`/promo/${id}`);
      toast.success('Promo dihapus');
      load();
    } catch (err) {
      toast.error('Gagal hapus promo');
    } finally {
      setConfirmDelete(null);
    }
  }
  async function toggleActive(promo) {
    try {
      await api.put(`/promo/${promo.id}`, { is_active: !promo.is_active });
      load();
    } catch (err) {
      toast.error('Gagal update status');
    }
  }

  return (
    <div>
      <PageHeader
        title="Promo"
        subtitle="Kelola 8 jenis promo: persentase, nominal, BOGO, bundle, dan lain-lain."
        icon={Sparkles}
      >
        {isAdmin && (
          <button
            type="button"
            onClick={startCreate}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> Buat Promo
          </button>
        )}
      </PageHeader>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FilterTabs tabs={STATUS_TABS} activeId={statusTab} onChange={setStatusTab} />
        <select
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">Semua jenis</option>
          {PROMO_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Cari promo…"
          className="ml-auto rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Nama</th>
              <th className="px-4 py-3 text-left">Jenis</th>
              <th className="px-4 py-3 text-left">Nilai</th>
              <th className="px-4 py-3 text-left">Min belanja</th>
              <th className="px-4 py-3 text-left">Kupon</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Memuat…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8">
                  <EmptyState
                    title="Belum ada promo"
                    description={
                      promos.length === 0
                        ? 'Buat promo pertama untuk menarik pelanggan.'
                        : 'Tidak ada promo yang cocok dengan filter.'
                    }
                  />
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{p.name}</div>
                    {p.description && <div className="text-xs text-gray-500">{p.description}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor(
                        p.promo_type
                      )}`}
                    >
                      {PROMO_TYPES.find((t) => t.value === p.promo_type)?.label || p.promo_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{formatValue(p)}</td>
                  <td className="px-4 py-3 text-gray-700">
                    Rp {Number(p.min_purchase || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {p.coupon_count ?? 0}
                    {p.requires_coupon && (
                      <span className="ml-1 rounded bg-yellow-100 px-1 py-0.5 text-[10px] text-yellow-700">
                        wajib
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => isAdmin && toggleActive(p)}
                      disabled={!isAdmin}
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      } ${isAdmin ? 'cursor-pointer hover:opacity-80' : ''}`}
                    >
                      {p.is_active ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isAdmin && (
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          className="rounded p-1 text-gray-600 hover:bg-gray-100"
                          aria-label="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(p)}
                          className="rounded p-1 text-red-600 hover:bg-red-50"
                          aria-label="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showBuilder && (
        <PromoBuilder promo={editingPromo} onClose={closeBuilder} onSaved={() => load()} />
      )}
      <ConfirmationDialog
        open={!!confirmDelete}
        title="Hapus promo?"
        message={
          confirmDelete
            ? `Promo "${confirmDelete.name}" akan dihapus permanen beserta semua kupon terkait.`
            : ''
        }
        confirmLabel="Hapus"
        variant="danger"
        onConfirm={() => confirmDelete && deletePromo(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
