/**
 * Product Bundles Management Page
 * 
 * Manages product bundles/packages - combinations of products sold together.
 * Features:
 * - List all bundles with search and filter
 * - Create/edit/delete bundles
 * - Manage bundle items (products)
 * - Calculate bundle pricing and savings
 * - Check stock availability
 */

import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Package, DollarSign, TrendingDown, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function BundlesPage() {
  const { token } = useAuth();
  // Using toast directly
  
  const [bundles, setBundles] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingBundle, setEditingBundle] = useState(null);

  useEffect(() => {
    loadBundles();
    loadProducts();
  }, []);

  const loadBundles = async () => {
    try {
      const res = await fetch('/api/v1/bundles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setBundles(data.data);
      }
    } catch (error) {
      toast('Gagal memuat paket produk', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await fetch('/api/v1/products', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setProducts(data.data.filter(p => p.is_active === 1));
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const handleCreate = () => {
    setEditingBundle(null);
    setShowModal(true);
  };

  const handleEdit = (bundle) => {
    setEditingBundle(bundle);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Yakin ingin menghapus paket produk ini?')) return;

    try {
      const res = await fetch(`/api/v1/bundles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast('Paket produk berhasil dihapus', 'success');
        loadBundles();
      } else {
        toast(data.error || 'Gagal menghapus paket produk', 'error');
      }
    } catch (error) {
      toast('Gagal menghapus paket produk', 'error');
    }
  };

  const filteredBundles = bundles.filter((bundle) => {
    const matchesSearch =
      bundle.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bundle.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterActive === 'all' ||
      (filterActive === 'active' && bundle.is_active === 1) ||
      (filterActive === 'inactive' && bundle.is_active === 0);
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">Memuat paket produk...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paket Produk</h1>
          <p className="text-sm text-gray-500">
            Kelola paket bundling produk dengan harga khusus
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Buat Paket
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari paket produk..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          className="input-field w-48"
        >
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Tidak Aktif</option>
        </select>
      </div>

      {/* Bundle List */}
      {filteredBundles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Belum ada paket produk
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Mulai dengan membuat paket produk pertama Anda
          </p>
          <button
            onClick={handleCreate}
            className="btn-primary mt-4 inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Buat Paket
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredBundles.map((bundle) => (
            <BundleCard
              key={bundle.id}
              bundle={bundle}
              onEdit={() => handleEdit(bundle)}
              onDelete={() => handleDelete(bundle.id)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <BundleModal
          bundle={editingBundle}
          products={products}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            loadBundles();
          }}
          token={token}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function BundleCard({ bundle, onEdit, onDelete }) {
  const hasDiscount = bundle.savings > 0;
  
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{bundle.name}</h3>
          <p className="text-sm text-gray-500">SKU: {bundle.sku}</p>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            bundle.is_active === 1
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {bundle.is_active === 1 ? 'Aktif' : 'Nonaktif'}
        </span>
      </div>

      {bundle.description && (
        <p className="mb-3 text-sm text-gray-600 line-clamp-2">
          {bundle.description}
        </p>
      )}

      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Harga Paket:</span>
          <span className="font-semibold text-gray-900">
            Rp {bundle.price.toLocaleString('id-ID')}
          </span>
        </div>
        
        {hasDiscount && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Harga Normal:</span>
              <span className="text-gray-500 line-through">
                Rp {bundle.individual_price.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-600 font-medium flex items-center gap-1">
                <TrendingDown className="h-4 w-4" />
                Hemat:
              </span>
              <span className="text-green-600 font-semibold">
                Rp {bundle.savings.toLocaleString('id-ID')} ({bundle.savings_percent}%)
              </span>
            </div>
          </>
        )}
      </div>

      <div className="mb-3 flex items-center gap-4 text-sm text-gray-600 border-t border-gray-100 pt-3">
        <div className="flex items-center gap-1">
          <Package className="h-4 w-4" />
          <span>{bundle.item_count || 0} produk</span>
        </div>
      </div>

      <div className="flex gap-2 border-t border-gray-100 pt-3">
        <button
          onClick={onEdit}
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Edit className="inline h-4 w-4 mr-1" />
          Edit
        </button>
        <button
          onClick={onDelete}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          title="Hapus"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function BundleModal({ bundle, products, onClose, onSave, token, showToast }) {
  const [formData, setFormData] = useState({
    name: bundle?.name || '',
    sku: bundle?.sku || '',
    price: bundle?.price || 0,
    description: bundle?.description || '',
    is_active: bundle?.is_active === 1,
  });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (bundle?.id) {
      loadBundleDetails();
    }
  }, [bundle]);

  const loadBundleDetails = async () => {
    try {
      const res = await fetch(`/api/v1/bundles/${bundle.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setItems(data.data.bundle_items || []);
      }
    } catch (error) {
      console.error('Failed to load bundle details:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.sku) {
      toast('Nama dan SKU harus diisi', 'error');
      return;
    }

    if (items.length === 0) {
      toast('Minimal harus ada 1 produk dalam paket', 'error');
      return;
    }

    setLoading(true);

    try {
      const url = bundle?.id
        ? `/api/v1/bundles/${bundle.id}`
        : '/api/v1/bundles';
      const method = bundle?.id ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        price: parseFloat(formData.price),
      };

      // Only include items when creating
      if (!bundle?.id) {
        payload.items = items.map(item => ({
          product_id: item.product_id || item.products?.id,
          quantity: parseFloat(item.quantity),
        }));
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast(
          bundle?.id ? 'Paket berhasil diperbarui' : 'Paket berhasil dibuat',
          'success'
        );
        onSave();
      } else {
        toast(data.error || 'Gagal menyimpan paket', 'error');
      }
    } catch (error) {
      toast('Gagal menyimpan paket', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setItems([...items, { product_id: '', quantity: 1 }]);
  };

  const removeItem = async (index) => {
    const item = items[index];
    
    // If editing and item has an id, delete from server
    if (bundle?.id && item.id) {
      try {
        const res = await fetch(`/api/v1/bundles/${bundle.id}/items/${item.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!data.success) {
          toast(data.error || 'Gagal menghapus item', 'error');
          return;
        }
      } catch (error) {
        toast('Gagal menghapus item', 'error');
        return;
      }
    }
    
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const addItemToBundle = async (productId, quantity) => {
    if (!bundle?.id) return;

    try {
      const res = await fetch(`/api/v1/bundles/${bundle.id}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product_id: parseInt(productId),
          quantity: parseFloat(quantity),
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast('Item berhasil ditambahkan', 'success');
        loadBundleDetails();
      } else {
        toast(data.error || 'Gagal menambahkan item', 'error');
      }
    } catch (error) {
      toast('Gagal menambahkan item', 'error');
    }
  };

  const calculateTotals = () => {
    const individualPrice = items.reduce((sum, item) => {
      const product = products.find(p => p.id === (item.product_id || item.products?.id));
      return sum + (product ? product.price * item.quantity : 0);
    }, 0);
    
    const bundlePrice = parseFloat(formData.price) || 0;
    const savings = individualPrice - bundlePrice;
    const savingsPercent = individualPrice > 0 ? (savings / individualPrice) * 100 : 0;

    return { individualPrice, bundlePrice, savings, savingsPercent };
  };

  const totals = calculateTotals();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {bundle ? 'Edit Paket Produk' : 'Buat Paket Produk'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Informasi Dasar</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Paket *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU *
                </label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Harga Paket *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deskripsi
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input-field"
                rows={3}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                Aktif
              </label>
            </div>
          </div>

          {/* Bundle Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Produk dalam Paket</h3>
              <button
                type="button"
                onClick={addItem}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Tambah Produk
              </button>
            </div>

            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                <Package className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">
                  Belum ada produk. Klik "Tambah Produk" untuk menambahkan.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-3 items-start">
                    <div className="flex-1">
                      <select
                        value={item.product_id || item.products?.id || ''}
                        onChange={(e) => updateItem(index, 'product_id', parseInt(e.target.value))}
                        className="input-field"
                        disabled={bundle?.id && item.id}
                        required
                      >
                        <option value="">Pilih Produk</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} - Rp {product.price.toLocaleString('id-ID')}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        className="input-field"
                        placeholder="Qty"
                        disabled={bundle?.id && item.id}
                        required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="mt-2 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new item for existing bundle */}
            {bundle?.id && (
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-600 mb-3">Tambah produk baru ke paket:</p>
                <div className="flex gap-3">
                  <select
                    id="new-product"
                    className="input-field flex-1"
                  >
                    <option value="">Pilih Produk</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - Rp {product.price.toLocaleString('id-ID')}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    id="new-quantity"
                    step="0.01"
                    min="0.01"
                    defaultValue="1"
                    className="input-field w-32"
                    placeholder="Qty"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const productId = document.getElementById('new-product').value;
                      const quantity = document.getElementById('new-quantity').value;
                      if (productId && quantity) {
                        addItemToBundle(productId, quantity);
                        document.getElementById('new-product').value = '';
                        document.getElementById('new-quantity').value = '1';
                      }
                    }}
                    className="btn-primary"
                  >
                    Tambah
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Price Summary */}
          {items.length > 0 && (
            <div className="rounded-lg bg-gray-50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Harga Normal (Total):</span>
                <span className="font-medium">
                  Rp {totals.individualPrice.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Harga Paket:</span>
                <span className="font-semibold text-gray-900">
                  Rp {totals.bundlePrice.toLocaleString('id-ID')}
                </span>
              </div>
              {totals.savings > 0 && (
                <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                  <span className="text-green-600 font-medium">Hemat:</span>
                  <span className="text-green-600 font-semibold">
                    Rp {totals.savings.toLocaleString('id-ID')} ({totals.savingsPercent.toFixed(1)}%)
                  </span>
                </div>
              )}
              {totals.savings < 0 && (
                <div className="flex items-start gap-2 text-sm text-amber-600 border-t border-gray-200 pt-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Harga paket lebih mahal dari harga normal</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Menyimpan...' : bundle ? 'Perbarui' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
