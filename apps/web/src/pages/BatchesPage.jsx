import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  AlertTriangle,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import api from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  ConfirmationDialog,
  EmptyState,
  Pagination,
  FilterTabs,
  PageHeader,
} from '../components/ui';

export default function BatchesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const [showForm, setShowForm] = useState(false);
  const [editBatch, setEditBatch] = useState(null);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [batchRes, prodRes] = await Promise.all([
        api.get('/batches'),
        api.get('/products?active_only=false'),
      ]);
      setBatches(batchRes.data);
      setProducts(prodRes.data);
    } catch (_err) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const filtered = batches.filter((b) => {
    if (filter === 'expiring') {
      const expiryDate = new Date(b.expiry_date);
      const daysUntilExpiry = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
      if (!b.expiry_date || daysUntilExpiry > 30) return false;
    }
    if (filter === 'expired') {
      if (!b.expiry_date || new Date(b.expiry_date) >= new Date()) return false;
    }
    if (productFilter && String(b.product_id) !== productFilter) return false;
    const q = search.toLowerCase();
    if (
      q &&
      !(
        (b.batch_number || '').toLowerCase().includes(q) ||
        (b.product_name || '').toLowerCase().includes(q) ||
        (b.sku || '').toLowerCase().includes(q)
      )
    )
      return false;
    return true;
  });

  const counts = {
    all: batches.length,
    expiring: batches.filter((b) => {
      if (!b.expiry_date) return false;
      const expiryDate = new Date(b.expiry_date);
      const daysUntilExpiry = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
    }).length,
    expired: batches.filter((b) => b.expiry_date && new Date(b.expiry_date) < new Date()).length,
  };

  const total = filtered.length;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleSave = async (data) => {
    try {
      if (editBatch) {
        await api.put(`/batches/${editBatch.id}`, data);
        toast.success('Batch berhasil diperbarui');
      } else {
        await api.post('/batches', data);
        toast.success('Batch berhasil ditambahkan');
      }
      setShowForm(false);
      setEditBatch(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan batch');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/batches/${confirmDelete.id}`);
      toast.success('Batch berhasil dihapus');
      setConfirmDelete(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menghapus batch');
    } finally {
      setDeleting(false);
    }
  };

  const getDaysUntilExpiry = (expiryDate) => {
    if (!expiryDate) return null;
    const days = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getExpiryBadge = (expiryDate) => {
    const days = getDaysUntilExpiry(expiryDate);
    if (days === null) return null;
    
    if (days < 0) {
      return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">Kadaluarsa</span>;
    } else if (days <= 7) {
      return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">{days} hari lagi</span>;
    } else if (days <= 30) {
      return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">{days} hari lagi</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">{days} hari lagi</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch / Lot Tracking"
        description="Kelola batch dan tanggal kadaluarsa produk"
        action={
          isAdmin && (
            <button
              onClick={() => {
                setEditBatch(null);
                setShowForm(true);
              }}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              Tambah Batch
            </button>
          )
        }
      />

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Cari batch, produk, SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10 w-full"
              />
            </div>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="input w-full sm:w-64"
            >
              <option value="">Semua Produk</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button onClick={loadData} className="btn-secondary">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          <FilterTabs
            tabs={[
              { id: 'all', label: 'Semua', count: counts.all },
              { id: 'expiring', label: 'Akan Kadaluarsa', count: counts.expiring },
              { id: 'expired', label: 'Kadaluarsa', count: counts.expired },
            ]}
            active={filter}
            onChange={setFilter}
          />
        </div>

        {paged.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Belum ada batch"
            description={
              search || productFilter
                ? 'Tidak ada batch yang sesuai dengan filter'
                : 'Mulai tambahkan batch untuk tracking produk'
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Batch Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Produk
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tanggal Terima
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tanggal Kadaluarsa
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Aksi
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paged.map((batch) => (
                    <tr key={batch.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{batch.batch_number}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{batch.product_name}</div>
                        <div className="text-sm text-gray-500">{batch.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium">{batch.quantity}</span>
                      </td>
                      <td className="px-4 py-3">
                        {batch.received_date ? formatDate(batch.received_date) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {batch.expiry_date ? formatDate(batch.expiry_date) : '-'}
                      </td>
                      <td className="px-4 py-3">{getExpiryBadge(batch.expiry_date)}</td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditBatch(batch);
                                setShowForm(true);
                              }}
                              className="p-1 text-gray-600 hover:text-primary-600"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(batch)}
                              className="p-1 text-gray-600 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>

      {showForm && (
        <BatchForm
          batch={editBatch}
          products={products}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditBatch(null);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmationDialog
          title="Hapus Batch"
          message={`Yakin ingin menghapus batch ${confirmDelete.batch_number}?`}
          confirmLabel="Hapus"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
          loading={deleting}
          variant="danger"
        />
      )}
    </div>
  );
}

function BatchForm({ batch, products, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    product_id: batch?.product_id || '',
    batch_number: batch?.batch_number || '',
    quantity: batch?.quantity || '',
    expiry_date: batch?.expiry_date || '',
    received_date: batch?.received_date || '',
    notes: batch?.notes || '',
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">
            {batch ? 'Edit Batch' : 'Tambah Batch Baru'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Produk <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.product_id}
              onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
              className="input w-full"
              required
              disabled={!!batch}
            >
              <option value="">Pilih Produk</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Batch Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.batch_number}
              onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
              className="input w-full"
              required
              disabled={!!batch}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="input w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tanggal Terima
            </label>
            <input
              type="date"
              value={formData.received_date}
              onChange={(e) => setFormData({ ...formData, received_date: e.target.value })}
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tanggal Kadaluarsa
            </label>
            <input
              type="date"
              value={formData.expiry_date}
              onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Catatan
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input w-full"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary flex-1"
              disabled={saving}
            >
              Batal
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
