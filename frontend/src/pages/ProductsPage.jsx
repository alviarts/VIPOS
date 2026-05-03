import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Package, X } from 'lucide-react';
import api from '../utils/api';
import { formatCurrency } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState({ name: '', sku: '', price: '', stock: '', category_id: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        api.get('/products?active_only=false'),
        api.get('/categories'),
      ]);
      setProducts(prodRes.data);
      setCategories(catRes.data);
    } catch (err) {
      toast.error('Gagal memuat data');
    }
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const openForm = (product = null) => {
    if (product) {
      setEditProduct(product);
      setForm({
        name: product.name,
        sku: product.sku,
        price: String(product.price),
        stock: String(product.stock),
        category_id: product.category_id ? String(product.category_id) : '',
      });
    } else {
      setEditProduct(null);
      setForm({ name: '', sku: '', price: '', stock: '', category_id: '' });
    }
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...form,
        price: parseFloat(form.price),
        stock: parseInt(form.stock) || 0,
        category_id: form.category_id ? parseInt(form.category_id) : null,
      };

      if (editProduct) {
        await api.put(`/products/${editProduct.id}`, { ...data, is_active: editProduct.is_active });
        toast.success('Produk berhasil diupdate');
      } else {
        await api.post('/products', data);
        toast.success('Produk berhasil ditambahkan');
      }
      setShowForm(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan produk');
    }
  };

  const handleDelete = async (product) => {
    if (!confirm(`Hapus produk "${product.name}"?`)) return;
    try {
      await api.delete(`/products/${product.id}`);
      toast.success('Produk berhasil dihapus');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menghapus produk');
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produk</h1>
          <p className="text-sm text-gray-400">{products.length} produk terdaftar</p>
        </div>
        {isAdmin && (
          <button onClick={() => openForm()} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Tambah Produk
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Cari produk..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Product List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((product) => (
          <div key={product.id} className={`card ${!product.is_active ? 'opacity-50' : ''}`}>
            <div className="w-full aspect-video bg-gray-100 rounded-xl mb-3 flex items-center justify-center">
              <Package className="w-10 h-10 text-gray-300" />
            </div>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{product.name}</p>
                <p className="text-xs text-gray-400 font-mono">{product.sku}</p>
              </div>
              {!product.is_active && (
                <span className="badge bg-red-100 text-red-600 ml-2">Nonaktif</span>
              )}
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-lg font-bold text-primary-600">{formatCurrency(product.price)}</p>
              <span className={`text-sm ${product.stock <= 5 ? 'text-amber-500 font-medium' : 'text-gray-400'}`}>
                Stok: {product.stock}
              </span>
            </div>
            {product.category_name && (
              <p className="text-xs text-gray-400 mt-1">Kategori: {product.category_name}</p>
            )}
            {isAdmin && (
              <div className="flex gap-2 mt-3">
                <button onClick={() => openForm(product)} className="btn-secondary flex-1 flex items-center justify-center gap-1 py-2 text-sm">
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
                <button onClick={() => handleDelete(product)} className="btn-danger flex-1 flex items-center justify-center gap-1 py-2 text-sm">
                  <Trash2 className="w-3 h-3" /> Hapus
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Package className="w-16 h-16 mx-auto mb-3 opacity-50" />
          <p className="text-lg">Tidak ada produk</p>
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editProduct ? 'Edit Produk' : 'Tambah Produk'}
                </h2>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Produk</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input-field"
                    placeholder="Nama produk"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="input-field"
                    placeholder="Kode SKU"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Harga</label>
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      className="input-field"
                      placeholder="0"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stok</label>
                    <input
                      type="number"
                      value={form.stock}
                      onChange={(e) => setForm({ ...form, stock: e.target.value })}
                      className="input-field"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Tanpa Kategori</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn-primary w-full">
                  {editProduct ? 'Update Produk' : 'Simpan Produk'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
