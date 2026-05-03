import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  RefreshCw,
  Download,
  Upload,
  Star,
  ChevronDown,
  MoreVertical,
} from 'lucide-react';
import api from '../utils/api';
import { formatCurrency } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import ProductWizardForm from '../components/ProductWizardForm';
import {
  ConfirmationDialog,
  EmptyState,
  Pagination,
  FilterTabs,
  PageHeader,
} from '../components/ui';

const FILTERS = [
  { id: 'all', label: 'Semua' },
  { id: 'shown', label: 'Tampil di Menu' },
  { id: 'hidden', label: 'Tidak Tampil di Menu' },
];

export default function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        api.get('/products?active_only=false'),
        api.get('/categories'),
      ]);
      setProducts(prodRes.data);
      setCategories(catRes.data);
    } catch (err) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (filter === 'shown' && !p.is_tampil_di_menu) return false;
      if (filter === 'hidden' && p.is_tampil_di_menu) return false;
      if (categoryFilter && String(p.category_id) !== categoryFilter) return false;
      const q = search.toLowerCase();
      if (
        q &&
        !(
          (p.name || '').toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q) ||
          (p.barcode || '').toLowerCase().includes(q)
        )
      )
        return false;
      return true;
    });
  }, [products, search, filter, categoryFilter]);

  const counts = useMemo(
    () => ({
      all: products.length,
      shown: products.filter((p) => p.is_tampil_di_menu).length,
      hidden: products.filter((p) => !p.is_tampil_di_menu).length,
    }),
    [products]
  );

  const total = filtered.length;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, filter, categoryFilter]);

  const openForm = async (product = null) => {
    if (product) {
      // Re-fetch the product to load variants + recipe_items + image_urls.
      try {
        const res = await api.get(`/products/${product.id}`);
        setEditProduct(res.data);
      } catch {
        setEditProduct(product);
      }
    } else {
      setEditProduct(null);
    }
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditProduct(null);
    setConfirmCancel(false);
  };

  const handleSubmit = async (payload) => {
    try {
      let saved;
      if (editProduct) {
        const res = await api.put(`/products/${editProduct.id}`, {
          ...payload,
          is_active: editProduct.is_active,
        });
        saved = res.data;
        toast.success('Produk berhasil diupdate');
      } else {
        const res = await api.post('/products', payload);
        saved = res.data;
        toast.success('Produk berhasil ditambahkan');
      }
      // Return the saved product so the wizard can sync variants + recipe.
      // We refresh the list AFTER the wizard completes its sync to avoid races.
      Promise.resolve().then(() => loadData());
      closeForm();
      return saved;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan produk');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/products/${confirmDelete.id}`);
      toast.success('Produk berhasil dihapus');
      setConfirmDelete(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menghapus produk');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Daftar Produk"
        subtitle={`${products.length} produk terdaftar`}
        icon={Package}
      >
        <button
          onClick={loadData}
          className="text-gray-500 hover:bg-gray-100 p-2 rounded-lg"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          onClick={() => toast('Fitur Impor Data segera hadir', { icon: 'ℹ️' })}
          className="flex items-center gap-1.5 text-gray-600 hover:bg-gray-100 px-3 py-2 rounded-lg text-sm"
        >
          <Upload className="w-4 h-4" /> Impor
        </button>
        <button
          onClick={() => toast('Fitur Ekspor Data segera hadir', { icon: 'ℹ️' })}
          className="flex items-center gap-1.5 text-gray-600 hover:bg-gray-100 px-3 py-2 rounded-lg text-sm"
        >
          <Download className="w-4 h-4" /> Ekspor
        </button>
        {isAdmin && (
          <button
            onClick={() => openForm()}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Tambah Produk
          </button>
        )}
      </PageHeader>

      {/* Search + category filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama, SKU, atau barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <div className="relative sm:w-56">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input-field appearance-none pr-9"
          >
            <option value="">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
        </div>
      </div>

      {/* Filter tabs */}
      <FilterTabs
        tabs={[
          { id: 'all', label: 'Semua', count: counts.all },
          { id: 'shown', label: 'Tampil di Menu', count: counts.shown },
          { id: 'hidden', label: 'Tidak Tampil di Menu', count: counts.hidden },
        ]}
        activeId={filter}
        onChange={setFilter}
      />

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header w-10 px-4 py-3 text-left">
                  <input type="checkbox" disabled className="rounded border-gray-300" />
                </th>
                <th className="table-header px-4 py-3 text-left">Nama Produk</th>
                <th className="table-header px-4 py-3 text-left">SKU</th>
                <th className="table-header px-4 py-3 text-left">Kategori</th>
                <th className="table-header px-4 py-3 text-right">Harga Modal</th>
                <th className="table-header px-4 py-3 text-right">Harga Beli</th>
                <th className="table-header px-4 py-3 text-right">Harga Jual</th>
                <th className="table-header px-4 py-3 text-right">Stok</th>
                <th className="table-header px-4 py-3 text-center">Status</th>
                {isAdmin && <th className="table-header px-4 py-3 w-20 text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {paged.map((product) => (
                <tr
                  key={product.id}
                  className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 ${
                    !product.is_active ? 'opacity-60' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <input type="checkbox" disabled className="rounded border-gray-300" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {product.is_favorit ? (
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                      ) : null}
                      <span className="font-medium text-gray-900">{product.name}</span>
                    </div>
                    {product.satuan && (
                      <p className="text-xs text-gray-400">per {product.satuan}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{product.sku}</td>
                  <td className="px-4 py-3 text-gray-600">{product.category_name || '-'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatCurrency(product.harga_modal || 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatCurrency(product.harga_beli || 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-primary-700">
                    {formatCurrency(product.price || 0)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={
                        product.monitor_stok && product.stock <= product.stok_minimum
                          ? 'text-amber-600 font-medium'
                          : 'text-gray-700'
                      }
                    >
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {product.is_tampil_di_menu ? (
                      <span className="badge badge-success">Tampil</span>
                    ) : (
                      <span className="badge bg-gray-100 text-gray-500">Tidak Tampil</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => openForm(product)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                          aria-label="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(product)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                          aria-label="Hapus"
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

        {paged.length === 0 && !loading && (
          <EmptyState
            title="Data tidak tersedia"
            description="Belum ada produk yang sesuai dengan filter pencarian Anda."
            action={
              isAdmin && (
                <button
                  onClick={() => openForm()}
                  className="btn-primary text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Tambah Produk
                </button>
              )
            }
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

      {/* Wizard form */}
      <ProductWizardForm
        open={showForm}
        onClose={() => {
          if (editProduct) closeForm();
          else setConfirmCancel(true);
        }}
        initialData={editProduct}
        categories={categories}
        catalog={products}
        onSubmit={handleSubmit}
      />

      {/* Confirm cancel (only for new product flow) */}
      <ConfirmationDialog
        open={confirmCancel}
        title="Membatalkan Tambah Produk"
        message="Membatalkan akan menghapus seluruh data yang telah diinput dan tidak dapat dibatalkan. Lanjutkan?"
        confirmLabel="Ya, Lanjutkan"
        cancelLabel="Kembali"
        variant="danger"
        onCancel={() => setConfirmCancel(false)}
        onConfirm={closeForm}
      />

      {/* Confirm delete */}
      <ConfirmationDialog
        open={!!confirmDelete}
        title="Hapus Produk"
        message={
          confirmDelete
            ? `Produk "${confirmDelete.name}" akan dihapus dari daftar produk. Lanjutkan?`
            : ''
        }
        confirmLabel="Ya, Hapus"
        variant="danger"
        loading={deleting}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
