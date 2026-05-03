import { useEffect, useMemo, useState } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  Trash2,
  Package,
  CheckCircle,
  Truck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader } from '../../components/ui';

const STATUS_LABEL = {
  ordered: 'Dipesan',
  confirmed: 'Dikonfirmasi',
  shipped: 'Dikirim',
  delivered: 'Diterima',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const STATUS_COLOR = {
  ordered: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-cyan-100 text-cyan-700',
  shipped: 'bg-amber-100 text-amber-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
};

function formatRupiah(n) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export default function SuppliesPage() {
  const [tab, setTab] = useState('catalog');
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState('');
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState({ items: [], total_amount: 0, item_count: 0 });
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkout, setCheckout] = useState({
    payment_method: 'bank_transfer',
    delivery_address: '',
    delivery_date: '',
  });

  useEffect(() => {
    void loadCategories();
    void loadCart();
    void loadOrders();
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [activeCat, search]);

  async function loadCategories() {
    try {
      const res = await api.get('/supplies/categories');
      setCategories(res.data);
    } catch {
      toast.error('Gagal memuat kategori');
    }
  }

  async function loadProducts() {
    try {
      const params = {};
      if (activeCat) params.category = activeCat;
      if (search) params.q = search;
      const res = await api.get('/supplies/products', { params });
      setProducts(res.data);
    } catch {
      toast.error('Gagal memuat produk');
    }
  }

  async function loadCart() {
    try {
      const res = await api.get('/supplies/cart');
      setCart(res.data);
    } catch {
      // Silent.
    }
  }

  async function loadOrders() {
    try {
      const res = await api.get('/supplies/orders');
      setOrders(res.data);
    } catch {
      // Silent.
    }
  }

  async function addToCart(product, qty) {
    try {
      const res = await api.post('/supplies/cart/add', {
        product_id: product.id,
        qty: Math.max(qty, product.moq || 1),
      });
      setCart(res.data);
      toast.success(`${product.name} ditambahkan ke keranjang`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal menambahkan ke cart');
    }
  }

  async function removeCartItem(itemId) {
    try {
      const res = await api.delete(`/supplies/cart/items/${itemId}`);
      setCart(res.data);
    } catch {
      toast.error('Gagal menghapus item');
    }
  }

  async function submitCheckout(e) {
    e.preventDefault();
    if (!checkout.delivery_address || checkout.delivery_address.length < 10) {
      toast.error('Alamat pengiriman wajib diisi (minimum 10 karakter)');
      return;
    }
    try {
      await api.post('/supplies/checkout', checkout);
      toast.success('Order berhasil dibuat');
      setCheckoutOpen(false);
      setCheckout({
        payment_method: 'bank_transfer',
        delivery_address: '',
        delivery_date: '',
      });
      void loadCart();
      void loadOrders();
      setTab('orders');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Checkout gagal');
    }
  }

  async function openOrder(id) {
    try {
      const res = await api.get(`/supplies/orders/${id}`);
      setActiveOrder(res.data);
    } catch {
      toast.error('Gagal memuat order');
    }
  }

  async function receiveOrder(id) {
    try {
      await api.post(`/supplies/orders/${id}/receive`);
      toast.success('Order diterima');
      void loadOrders();
      if (activeOrder?.id === id) void openOrder(id);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal menerima order');
    }
  }

  const cartByProduct = useMemo(() => {
    const map = new Map();
    for (const item of cart.items) map.set(item.product_id, item.qty);
    return map;
  }, [cart]);

  return (
    <div>
      <PageHeader
        title="SUPPLIES"
        subtitle="Marketplace B2B untuk kebutuhan operasional bisnis"
        icon={ShoppingBag}
      >
        <button
          onClick={() => setTab('cart')}
          className="relative inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
        >
          <ShoppingBag className="w-4 h-4" />
          Keranjang ({cart.item_count})
        </button>
      </PageHeader>

      <div className="flex gap-2 mb-4 border-b border-gray-200">
        {[
          { key: 'catalog', label: 'Katalog' },
          { key: 'cart', label: 'Keranjang' },
          { key: 'orders', label: 'Daftar Belanja' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setActiveOrder(null);
            }}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.key
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'catalog' && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari produk..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <select
              value={activeCat}
              onChange={(e) => setActiveCat(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((p) => {
              const inCart = cartByProduct.get(p.id) || 0;
              return (
                <div
                  key={p.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col"
                >
                  <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <Package className="w-12 h-12 text-gray-400" />
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <span className="text-xs text-gray-400">{p.sku}</span>
                    <h3 className="font-semibold text-gray-900 text-sm mt-1 line-clamp-2">
                      {p.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">{p.supplier_name}</p>
                    <div className="text-lg font-bold text-primary-600 mt-2">
                      {formatRupiah(p.price)}
                    </div>
                    {p.moq > 1 && <p className="text-xs text-gray-500">MOQ: {p.moq} pcs</p>}
                    {p.stock_status === 'low' && (
                      <span className="inline-block text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full mt-1 self-start">
                        Stok Rendah
                      </span>
                    )}
                    {p.stock_status === 'out_of_stock' && (
                      <span className="inline-block text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full mt-1 self-start">
                        Habis
                      </span>
                    )}
                    <button
                      onClick={() => addToCart(p, Math.max(p.moq, inCart + 1))}
                      disabled={p.stock_status === 'out_of_stock'}
                      className="mt-3 w-full px-3 py-2 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60"
                    >
                      {inCart > 0 ? `Di keranjang (${inCart})` : '+ Tambah ke Cart'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {products.length === 0 && (
            <p className="text-center text-gray-500 py-10">Tidak ada produk yang cocok.</p>
          )}
        </div>
      )}

      {tab === 'cart' && (
        <div>
          {cart.items.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
              <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Keranjang belanja Anda kosong.</p>
              <button
                onClick={() => setTab('catalog')}
                className="mt-4 px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
              >
                Belanja Sekarang
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-3">
                {cart.items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4"
                  >
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="w-8 h-8 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.product.name}</p>
                      <p className="text-xs text-gray-500">{item.product.sku}</p>
                      <p className="text-sm text-primary-600 font-semibold mt-1">
                        {formatRupiah(item.product.price)} × {item.qty}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="font-bold">{formatRupiah(item.subtotal)}</p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            addToCart(item.product, Math.max(item.qty - 1, item.product.moq))
                          }
                          disabled={item.qty <= item.product.moq}
                          className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center text-sm">{item.qty}</span>
                        <button
                          onClick={() => addToCart(item.product, item.qty + 1)}
                          className="p-1 rounded hover:bg-gray-100"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeCartItem(item.id)}
                          className="p-1 rounded hover:bg-rose-50 text-rose-500 ml-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-5 h-fit sticky top-4">
                <h3 className="text-lg font-semibold mb-3">Ringkasan</h3>
                <div className="flex justify-between text-sm mb-2">
                  <span>Subtotal ({cart.item_count} item)</span>
                  <span>{formatRupiah(cart.total_amount)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Ongkir</span>
                  <span>Hubungi supplier</span>
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatRupiah(cart.total_amount)}</span>
                </div>
                <button
                  onClick={() => setCheckoutOpen(true)}
                  className="w-full mt-4 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
                >
                  Checkout
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'orders' && !activeOrder && (
        <div>
          {orders.length === 0 ? (
            <p className="text-center text-gray-500 py-10">Belum ada pesanan.</p>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <button
                  key={o.id}
                  onClick={() => openOrder(o.id)}
                  className="block w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{o.order_no}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(o.ordered_at).toLocaleDateString('id-ID')} · {o.item_count} item
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatRupiah(o.total_amount)}</p>
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${STATUS_COLOR[o.status]}`}
                      >
                        {STATUS_LABEL[o.status] || o.status}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'orders' && activeOrder && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <button onClick={() => setActiveOrder(null)} className="text-sm text-primary-600 mb-4">
            ← Kembali ke daftar order
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <p className="font-bold text-lg">{activeOrder.order_no}</p>
              <p className="text-xs text-gray-500">
                Dipesan {new Date(activeOrder.ordered_at).toLocaleString('id-ID')}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${STATUS_COLOR[activeOrder.status]}`}
            >
              <Truck className="w-3 h-3" />
              {STATUS_LABEL[activeOrder.status] || activeOrder.status}
            </span>
          </div>

          <div className="text-sm text-gray-600 mb-4">
            <p>📍 {activeOrder.delivery_address}</p>
            {activeOrder.delivery_date && <p>🚚 {activeOrder.delivery_date}</p>}
            <p>💳 {activeOrder.payment_method}</p>
          </div>

          <table className="w-full text-sm border-t">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2">Produk</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Harga</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(activeOrder.items || []).map((it) => (
                <tr key={it.id} className="border-b last:border-0">
                  <td className="py-2">
                    <p className="font-medium">{it.product_name}</p>
                    <p className="text-xs text-gray-400">{it.sku}</p>
                  </td>
                  <td className="py-2 text-right">{it.qty}</td>
                  <td className="py-2 text-right">{formatRupiah(it.price)}</td>
                  <td className="py-2 text-right">{formatRupiah(it.subtotal)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className="py-2 text-right font-semibold">
                  Total
                </td>
                <td className="py-2 text-right font-bold">
                  {formatRupiah(activeOrder.total_amount)}
                </td>
              </tr>
            </tbody>
          </table>

          {!['delivered', 'completed', 'cancelled'].includes(activeOrder.status) && (
            <button
              onClick={() => receiveOrder(activeOrder.id)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
            >
              <CheckCircle className="w-4 h-4" /> Tandai Sudah Diterima
            </button>
          )}
        </div>
      )}

      {checkoutOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setCheckoutOpen(false)}
        >
          <form
            onSubmit={submitCheckout}
            className="bg-white rounded-xl p-6 w-full max-w-md space-y-4"
          >
            <h3 className="text-lg font-semibold">Checkout Pesanan</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Metode Pembayaran
              </label>
              <select
                value={checkout.payment_method}
                onChange={(e) => setCheckout((c) => ({ ...c, payment_method: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="bank_transfer">Transfer Bank</option>
                <option value="majoopay">Majoopay Wallet</option>
                <option value="capital_credit">Bayar dengan Capital Credit</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alamat Pengiriman
              </label>
              <textarea
                rows={3}
                value={checkout.delivery_address}
                onChange={(e) => setCheckout((c) => ({ ...c, delivery_address: e.target.value }))}
                placeholder="Jl. Merdeka No. 1, Jakarta Pusat 10110"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tanggal Pengiriman (opsional)
              </label>
              <input
                type="date"
                value={checkout.delivery_date}
                onChange={(e) => setCheckout((c) => ({ ...c, delivery_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
              >
                Konfirmasi Order
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
