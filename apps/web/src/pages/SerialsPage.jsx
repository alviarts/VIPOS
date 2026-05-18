import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Hash,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Upload,
} from 'lucide-react';
import api from '../utils/api';
import { formatDate } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  ConfirmationDialog,
  EmptyState,
  Pagination,
  FilterTabs,
  PageHeader,
} from '../components/ui';

export default function SerialsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [serials, setSerials] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const [showForm, setShowForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [editSerial, setEditSerial] = useState(null);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [serialRes, prodRes] = await Promise.all([
        api.get('/serials'),
        api.get('/products?active_only=false'),
      ]);
      setSerials(serialRes.data);
      setProducts(prodRes.data);
    } catch (_err) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const filtered = serials.filter((s) => {
    if (filter !== 'all' && s.status !== filter) return false;
    if (productFilter && String(s.product_id) !== productFilter) return false;
    const q = search.toLowerCase();
    if (
      q &&
      !(
        (s.serial_number || '').toLowerCase().includes(q) ||
        (s.product_name || '').toLowerCase().includes(q) ||
        (s.sku || '').toLowerCase().includes(q)
      )
    )
      return false;
    return true;
  });

  const counts = {
    all: serials.length,
    available: serials.filter((s) => s.status === 'available').length,
    sold: serials.filter((s) => s.status === 'sold').length,
    returned: serials.filter((s) => s.status === 'returned').length,
    defective: serials.filter((s) => s.status === 'defective').length,
  };

  const total = filtered.length;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleSave = async (data) => {
    try {
      if (editSerial) {
        await api.put(`/serials/${editSerial.id}`, data);
        toast.success('Serial berhasil diperbarui');
      } else {
        await api.post('/serials', data);
        toast.success('Serial berhasil ditambahkan');
      }
      setShowForm(false);
      setEditSerial(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan serial');
    }
  };

  const handleBulkSave = async (data) => {
    try {
      const result = await api.post('/serials/bulk', data);
      toast.success(`${result.data.created} serial berhasil ditambahkan`);
      if (result.data.errors && result.data.errors.length > 0) {
        toast.error(`${result.data.errors.length} serial gagal ditambahkan`);
      }
      setShowBulkForm(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan serial');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/serials/${confirmDelete.id}`);
      toast.success('Serial berhasil dihapus');
      setConfirmDelete(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menghapus serial');
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      available: (
        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
          Tersedia
        </span>
      ),
      sold: (
        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
          Terjual
        </span>
      ),
      returned: (
        <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
          Dikembalikan
        </span>
      ),
      defective: (
        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
          Rusak
        </span>
      ),
    };
    return badges[status] || status;
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
        title="Serial Number Tracking"
        description="Kelola nomor seri produk"
        action={
          isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowBulkForm(true)}
                className="btn-secondary"
              >
                <Upload className="w-4 h-4" />
                Bulk Import
              </button>
              <button
                onClick={() => {
                  setEditSerial(null);
                  setShowForm(true);
                }}
                className="btn-primary"
              >
                <Plus className="w-4 h-4" />
                Tambah Serial
              </button>
            </div>
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
                placeholder="Cari serial number, produk, SKU..."
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
              { id: 'available', label: 'Tersedia', count: counts.available },
              { id: 'sold', label: 'Terjual', count: counts.sold },
              { id: 'returned', label: 'Dikembalikan', count: counts.returned },
              { id: 'defective', label: 'Rusak', count: counts.defective },
            ]}
            active={filter}
            onChange={setFilter}
          />
        </div>

        {paged.length === 0 ? (
          <EmptyState
            icon={Hash}
            title="Belum ada serial number"
            description={
              search || productFilter
                ? 'Tidak ada serial yang sesuai dengan filter'
                : 'Mulai tambahkan serial number untuk tracking produk'
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Serial Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Produk
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tanggal Terjual
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Invoice
                    </th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Aksi
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paged.map((serial) => (
                    <tr key={serial.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-mono font-medium text-gray-900">
                          {serial.serial_number}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{serial.product_name}</div>
                        <div className="text-sm text-gray-500">{serial.sku}</div>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(serial.status)}</td>
                      <td className="px-4 py-3">
                        {serial.sold_date ? formatDate(serial.sold_date) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {serial.transaction_invoice ? (
                          <span className="text-sm text-gray-900">{serial.transaction_invoice}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditSerial(serial);
                                setShowForm(true);
                              }}
                              className="p-1 text-gray-600 hover:text-primary-600"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(serial)}
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
        <SerialForm
          serial={editSerial}
          products={products}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditSerial(null);
          }}
        />
      )}

      {showBulkForm && (
        <BulkSerialForm
          products={products}
          onSave={handleBulkSave}
          onCancel={() => setShowBulkForm(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmationDialog
          title="Hapus Serial"
          message={`Yakin ingin menghapus serial ${confirmDelete.serial_number}?`}
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

function SerialForm({ serial, products, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    product_id: serial?.product_id || '',
    serial_number: serial?.serial_number || '',
    status: serial?.status || 'available',
    notes: serial?.notes || '',
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
            {serial ? 'Edit Serial' : 'Tambah Serial Baru'}
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
              disabled={!!serial}
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
              Serial Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.serial_number}
              onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
              className="input w-full font-mono"
              required
              disabled={!!serial}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="input w-full"
              required
            >
              <option value="available">Tersedia</option>
              <option value="sold">Terjual</option>
              <option value="returned">Dikembalikan</option>
              <option value="defective">Rusak</option>
            </select>
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

function BulkSerialForm({ products, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    product_id: '',
    serial_numbers: '',
    status: 'available',
    notes: '',
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const serialArray = formData.serial_numbers
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      
      if (serialArray.length === 0) {
        toast.error('Masukkan minimal 1 serial number');
        setSaving(false);
        return;
      }

      await onSave({
        product_id: formData.product_id,
        serial_numbers: serialArray,
        status: formData.status,
        notes: formData.notes,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Bulk Import Serial Numbers</h2>
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
              Serial Numbers <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.serial_numbers}
              onChange={(e) => setFormData({ ...formData, serial_numbers: e.target.value })}
              className="input w-full font-mono"
              rows={10}
              placeholder="Masukkan serial numbers, satu per baris&#10;SN001&#10;SN002&#10;SN003"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Masukkan satu serial number per baris
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="input w-full"
              required
            >
              <option value="available">Tersedia</option>
              <option value="sold">Terjual</option>
              <option value="returned">Dikembalikan</option>
              <option value="defective">Rusak</option>
            </select>
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
              {saving ? 'Menyimpan...' : 'Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
