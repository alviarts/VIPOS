import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard,
  Banknote, QrCode, X, Check, Package, ArrowLeft, ScanLine,
} from 'lucide-react';
import api from '../utils/api';
import { formatCurrency } from '../utils/format';
import toast from 'react-hot-toast';

// Subtle color palette for product avatars (consistent per product id)
const AVATAR_COLORS = [
  'bg-rose-100 text-rose-600',
  'bg-amber-100 text-amber-600',
  'bg-emerald-100 text-emerald-600',
  'bg-sky-100 text-sky-600',
  'bg-violet-100 text-violet-600',
  'bg-pink-100 text-pink-600',
  'bg-teal-100 text-teal-600',
  'bg-indigo-100 text-indigo-600',
];

const avatarColor = (id) => AVATAR_COLORS[Math.abs(Number(id) || 0) % AVATAR_COLORS.length];
const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase() || '?';

export default function CashierPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [showCartMobile, setShowCartMobile] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        api.get('/products?active_only=true'),
        api.get('/categories'),
      ]);
      setProducts(prodRes.data);
      setCategories(catRes.data);
    } catch (err) {
      toast.error('Gagal memuat data');
    }
  };

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchCategory =
        selectedCategory === 'all' || p.category_id === parseInt(selectedCategory);
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q);
      return matchCategory && matchSearch;
    });
  }, [products, selectedCategory, search]);

  const addToCart = (product) => {
    if (product.stock <= 0) {
      toast.error('Stok habis!');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error(`Stok ${product.name} tidak mencukupi`);
          return prev;
        }
        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        stock: product.stock,
      }];
    });
  };

  const updateQuantity = (productId, delta) => {
    setCart((prev) => {
      return prev.map((item) => {
        if (item.product_id !== productId) return item;
        const newQty = item.quantity + delta;
        if (newQty <= 0) return null;
        if (newQty > item.stock) {
          toast.error('Stok tidak mencukupi');
          return item;
        }
        return { ...item, quantity: newQty };
      }).filter(Boolean);
    });
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handlePayment = async () => {
    const amount = paymentMethod === 'cash' ? parseInt(paymentAmount) || 0 : cartTotal;

    if (amount < cartTotal) {
      toast.error('Pembayaran kurang!');
      return;
    }

    setProcessing(true);
    try {
      const res = await api.post('/transactions', {
        items: cart.map((item) => ({
          product_id: item.product_id,
          price: item.price,
          quantity: item.quantity,
        })),
        payment_amount: amount,
        payment_method: paymentMethod,
      });

      setReceipt(res.data);
      setCart([]);
      setShowPayment(false);
      setPaymentAmount('');
      loadData();
      toast.success('Transaksi berhasil!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Transaksi gagal');
    } finally {
      setProcessing(false);
    }
  };

  const quickAmounts = [20000, 50000, 100000, 200000, 500000];
  const paidAmount = paymentMethod === 'cash' ? parseInt(paymentAmount) || 0 : cartTotal;
  const changeAmount = paidAmount - cartTotal;
  const payDisabled =
    processing || cart.length === 0 || (paymentMethod === 'cash' && paidAmount < cartTotal);

  const openPayment = () => {
    if (cart.length === 0) return;
    setShowCartMobile(false);
    setShowPayment(true);
    setPaymentMethod('cash');
    setPaymentAmount('');
  };

  return (
    <div className="lg:h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4">
      {/* Products Section */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Cari nama produk, SKU, atau scan barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <button
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-sm"
            title="Scan barcode"
          >
            <ScanLine className="w-4 h-4" />
            Scan
          </button>
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`chip ${selectedCategory === 'all' ? 'chip-active' : ''} whitespace-nowrap`}
          >
            Semua
            <span className={`ml-1 text-[10px] ${selectedCategory === 'all' ? 'text-white/80' : 'text-gray-400'}`}>
              {products.length}
            </span>
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.category_id === cat.id).length;
            const active = selectedCategory === String(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(String(cat.id))}
                className={`chip ${active ? 'chip-active' : ''} whitespace-nowrap`}
              >
                {cat.name}
                <span className={`ml-1 text-[10px] ${active ? 'text-white/80' : 'text-gray-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Product Grid */}
        <div className="flex-1 lg:overflow-y-auto pb-24 lg:pb-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map((product) => {
              const inCart = cart.find((c) => c.product_id === product.id);
              const lowStock = product.stock > 0 && product.stock <= 5;
              const outOfStock = product.stock <= 0;
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={outOfStock}
                  className={`group relative bg-white rounded-2xl border p-3 text-left shadow-card transition-all
                    ${outOfStock
                      ? 'opacity-60 cursor-not-allowed border-gray-100'
                      : 'border-gray-100 hover:border-primary-300 hover:shadow-card-md active:scale-[0.98]'}`}
                >
                  {inCart && (
                    <span className="absolute top-2 right-2 z-10 min-w-[22px] h-[22px] rounded-full bg-primary-500 text-white text-[11px] font-semibold flex items-center justify-center px-1.5 shadow">
                      {inCart.quantity}
                    </span>
                  )}
                  <div className={`relative w-full aspect-square rounded-xl mb-3 flex items-center justify-center font-bold text-xl ${avatarColor(product.id)}`}>
                    {initials(product.name)}
                    {outOfStock && (
                      <span className="absolute inset-0 rounded-xl bg-black/40 text-white text-xs font-semibold flex items-center justify-center">
                        Habis
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug min-h-[2.5rem]">
                    {product.name}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5 font-mono truncate">{product.sku}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm font-bold text-primary-600">{formatCurrency(product.price)}</p>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full
                      ${outOfStock
                        ? 'bg-rose-50 text-rose-600'
                        : lowStock
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-gray-50 text-gray-500'}`}>
                      {product.stock} stk
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {filteredProducts.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Tidak ada produk ditemukan</p>
              <p className="text-xs mt-1">Coba kata kunci atau kategori lain</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart Section - Desktop */}
      <aside className="hidden lg:flex w-96 bg-white rounded-2xl border border-gray-100 flex-col shadow-card">
        <CartPanel
          cart={cart}
          cartTotal={cartTotal}
          cartCount={cartCount}
          updateQuantity={updateQuantity}
          removeFromCart={removeFromCart}
          onPay={openPayment}
        />
      </aside>

      {/* Mobile floating cart button */}
      {cart.length > 0 && !showCartMobile && (
        <button
          onClick={() => setShowCartMobile(true)}
          className="lg:hidden fixed bottom-4 left-4 right-4 z-30 bg-primary-500 hover:bg-primary-600 text-white rounded-2xl shadow-xl shadow-primary-500/30 px-5 py-3 flex items-center justify-between"
        >
          <span className="flex items-center gap-3">
            <span className="relative">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white text-primary-600 text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            </span>
            <span className="font-semibold">Lihat Keranjang</span>
          </span>
          <span className="font-bold">{formatCurrency(cartTotal)}</span>
        </button>
      )}

      {/* Mobile cart drawer */}
      {showCartMobile && (
        <div className="lg:hidden fixed inset-0 z-40 flex items-end bg-black/50 animate-fade-in">
          <div className="bg-white w-full max-h-[88vh] rounded-t-3xl flex flex-col animate-slide-up">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <button
                onClick={() => setShowCartMobile(false)}
                className="p-1 -ml-1 text-gray-500 hover:bg-gray-100 rounded-lg"
                aria-label="Tutup"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="font-semibold text-gray-900">Keranjang</h2>
              <span className="badge badge-info ml-auto">{cartCount} item</span>
            </div>
            <CartPanel
              cart={cart}
              cartTotal={cartTotal}
              cartCount={cartCount}
              updateQuantity={updateQuantity}
              removeFromCart={removeFromCart}
              onPay={openPayment}
              hideHeader
            />
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[95vh] overflow-y-auto animate-slide-up">
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Pembayaran</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{cartCount} item dalam keranjang</p>
                </div>
                <button
                  onClick={() => setShowPayment(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl"
                  aria-label="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Total */}
              <div className="rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white p-5 mb-5 shadow-lg shadow-primary-500/20">
                <p className="text-xs text-white/80 uppercase tracking-wider">Total Belanja</p>
                <p className="text-3xl font-bold mt-1">{formatCurrency(cartTotal)}</p>
              </div>

              {/* Payment Method */}
              <label className="block text-sm font-medium text-gray-700 mb-2">Metode Pembayaran</label>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {[
                  { id: 'cash', label: 'Tunai', icon: Banknote },
                  { id: 'card', label: 'Kartu', icon: CreditCard },
                  { id: 'qris', label: 'QRIS', icon: QrCode },
                ].map((method) => {
                  const active = paymentMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all
                        ${active
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <method.icon className={`w-5 h-5 ${active ? 'text-primary-600' : 'text-gray-400'}`} />
                      <span className={`text-sm font-medium ${active ? 'text-primary-700' : 'text-gray-600'}`}>
                        {method.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Payment Amount (Cash only) */}
              {paymentMethod === 'cash' && (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jumlah Diterima
                  </label>
                  <div className="relative mb-3">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                      Rp
                    </span>
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="input-field pl-10 text-xl font-bold text-right"
                      placeholder="0"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {quickAmounts.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setPaymentAmount(String(amount))}
                        className="py-2 px-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs sm:text-sm font-medium text-gray-700 border border-transparent hover:border-gray-200"
                      >
                        {formatCurrency(amount).replace('Rp', '').trim()}
                      </button>
                    ))}
                    <button
                      onClick={() => setPaymentAmount(String(cartTotal))}
                      className="py-2 px-2 bg-primary-50 hover:bg-primary-100 rounded-lg text-xs sm:text-sm font-semibold text-primary-600 border border-primary-100"
                    >
                      Uang Pas
                    </button>
                  </div>

                  {/* Change */}
                  <div className={`rounded-xl p-4 mb-2 ${
                    changeAmount >= 0 && paidAmount > 0
                      ? 'bg-emerald-50 border border-emerald-100'
                      : paidAmount === 0
                      ? 'bg-gray-50 border border-gray-100'
                      : 'bg-rose-50 border border-rose-100'
                  }`}>
                    <p className={`text-xs ${
                      changeAmount >= 0 && paidAmount > 0
                        ? 'text-emerald-700'
                        : paidAmount === 0
                        ? 'text-gray-500'
                        : 'text-rose-700'
                    }`}>
                      {paidAmount === 0
                        ? 'Masukkan jumlah pembayaran'
                        : changeAmount >= 0
                        ? 'Kembalian'
                        : 'Pembayaran kurang'}
                    </p>
                    <p className={`text-2xl font-bold ${
                      changeAmount >= 0 && paidAmount > 0
                        ? 'text-emerald-700'
                        : paidAmount === 0
                        ? 'text-gray-400'
                        : 'text-rose-700'
                    }`}>
                      {paidAmount === 0
                        ? formatCurrency(0)
                        : formatCurrency(Math.abs(changeAmount))}
                    </p>
                  </div>
                </>
              )}

              {paymentMethod !== 'cash' && (
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 mb-2 text-center">
                  <p className="text-xs text-gray-500 mb-1">
                    {paymentMethod === 'card' ? 'Mesin EDC' : 'Tampilkan QR ke pelanggan'}
                  </p>
                  <p className="text-sm font-medium text-gray-800">
                    Konfirmasi pembayaran lalu tekan tombol di bawah
                  </p>
                </div>
              )}

              <button
                onClick={handlePayment}
                disabled={payDisabled}
                className="btn-success w-full flex items-center justify-center gap-2 text-base mt-4 py-3"
              >
                {processing ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Selesaikan Pembayaran
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receipt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm max-h-[95vh] overflow-y-auto animate-slide-up">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Transaksi Berhasil</h2>
              <p className="text-xs text-gray-400 font-mono">{receipt.invoice_number}</p>

              <div className="my-5 border-t border-dashed border-gray-200" />

              <div className="text-left space-y-1.5">
                {receipt.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600 truncate pr-2">
                      {item.product_name} <span className="text-gray-400">x{item.quantity}</span>
                    </span>
                    <span className="font-medium text-gray-800 whitespace-nowrap">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="my-5 border-t border-dashed border-gray-200" />

              <div className="space-y-2 text-left">
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(receipt.total_amount)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span className="capitalize">
                    Bayar ({PAYMENT_LABEL[receipt.payment_method] || receipt.payment_method})
                  </span>
                  <span>{formatCurrency(receipt.payment_amount)}</span>
                </div>
                <div className="flex justify-between text-sm text-emerald-600 font-medium">
                  <span>Kembalian</span>
                  <span>{formatCurrency(receipt.change_amount)}</span>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => window.print()}
                  className="btn-secondary flex-1 text-sm"
                >
                  Cetak
                </button>
                <button
                  onClick={() => setReceipt(null)}
                  className="btn-primary flex-1 text-sm"
                >
                  Transaksi Baru
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const PAYMENT_LABEL = {
  cash: 'Tunai',
  card: 'Kartu',
  qris: 'QRIS',
  ewallet: 'E-Wallet',
  transfer: 'Transfer',
};

function CartPanel({
  cart, cartTotal, cartCount, updateQuantity, removeFromCart, onPay, hideHeader,
}) {
  return (
    <>
      {!hideHeader && (
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold text-gray-900">Keranjang</h2>
          </div>
          {cart.length > 0 && (
            <span className="badge bg-primary-100 text-primary-700">{cartCount} item</span>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {cart.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 mx-auto mb-3 flex items-center justify-center">
              <ShoppingCart className="w-7 h-7 opacity-60" />
            </div>
            <p className="text-sm font-medium">Keranjang masih kosong</p>
            <p className="text-xs mt-1">Pilih produk untuk memulai transaksi</p>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.product_id}
              className="flex items-start gap-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl p-3"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarColor(item.product_id)}`}>
                {initials(item.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                <p className="text-xs text-gray-400">{formatCurrency(item.price)}</p>

                <div className="flex items-center gap-1.5 mt-2">
                  <button
                    onClick={() => updateQuantity(item.product_id, -1)}
                    className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600"
                    aria-label="Kurangi"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="min-w-[28px] text-center text-sm font-semibold text-gray-800">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.product_id, 1)}
                    className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600"
                    aria-label="Tambah"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeFromCart(item.product_id)}
                    className="ml-auto w-7 h-7 rounded-lg text-rose-500 hover:bg-rose-50 flex items-center justify-center"
                    aria-label="Hapus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                {formatCurrency(item.price * item.quantity)}
              </p>
            </div>
          ))
        )}
      </div>

      {cart.length > 0 && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Subtotal ({cartCount} item)</span>
              <span>{formatCurrency(cartTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700 font-medium">Total</span>
              <span className="text-2xl font-bold text-gray-900">{formatCurrency(cartTotal)}</span>
            </div>
          </div>
          <button
            onClick={onPay}
            className="btn-success w-full flex items-center justify-center gap-2 text-base py-3"
          >
            <CreditCard className="w-5 h-5" />
            Bayar Sekarang
          </button>
        </div>
      )}
    </>
  );
}
