import { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  QrCode,
  X,
  Check,
  Printer,
  Package,
} from 'lucide-react';
import api from '../utils/api';
import { formatCurrency } from '../utils/format';
import toast from 'react-hot-toast';

export default function CashierPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
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
    } catch (_err) {
      toast.error('Gagal memuat data');
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchCategory =
      selectedCategory === 'all' || p.category_id === parseInt(selectedCategory);
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  // Items with `monitor_stok=0` are made-to-order (cooked food, services) and
  // are always sellable regardless of the `stock` column. Only block when stock
  // tracking is on AND stock has run out.
  const isStockTracked = (product) => Number(product?.monitor_stok) > 0;
  const isOutOfStock = (product) => isStockTracked(product) && product.stock <= 0;

  const addToCart = (product) => {
    if (isOutOfStock(product)) {
      toast.error(`Stok ${product.name} habis. Tambah lewat menu Inventori \u2192 Stok Opname.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        if (existing.tracked && existing.quantity >= existing.stock) {
          toast.error(`Stok ${product.name} tidak mencukupi`);
          return prev;
        }
        return prev.map((item) =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          stock: product.stock,
          tracked: isStockTracked(product),
        },
      ];
    });
  };

  const updateQuantity = (productId, delta) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product_id !== productId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (item.tracked && newQty > item.stock) {
            toast.error('Stok tidak mencukupi');
            return item;
          }
          return { ...item, quantity: newQty };
        })
        .filter(Boolean);
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

  const quickAmounts = [50000, 100000, 150000, 200000, 500000];
  const changeAmount =
    (paymentMethod === 'cash' ? parseInt(paymentAmount) || 0 : cartTotal) - cartTotal;

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)]">
      {/* Products Section */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Cari produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
              ${selectedCategory === 'all' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
          >
            Semua
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(String(cat.id))}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
                ${selectedCategory === String(cat.id) ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map((product) => {
              const tracked = isStockTracked(product);
              const blocked = isOutOfStock(product);
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={blocked}
                  className={`card text-left hover:shadow-md hover:border-primary-200 transition-all active:scale-[0.98]
                    ${blocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="w-full aspect-square bg-gray-100 rounded-xl mb-3 flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{product.sku}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm font-bold text-primary-600">
                      {formatCurrency(product.price)}
                    </p>
                    {tracked ? (
                      <span
                        className={`text-xs ${product.stock <= 5 ? 'text-amber-500' : 'text-gray-400'}`}
                      >
                        {product.stock} stk
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Selalu tersedia</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Tidak ada produk ditemukan</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-full lg:w-96 bg-white rounded-2xl border border-gray-100 flex flex-col shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold text-gray-900">Keranjang</h2>
          </div>
          {cart.length > 0 && (
            <span className="badge bg-primary-100 text-primary-600">{cartCount} item</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Keranjang kosong</p>
              <p className="text-xs mt-1">Tap produk untuk menambahkan</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product_id}
                className="flex items-center gap-3 bg-gray-50 rounded-xl p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  <p className="text-xs text-gray-400">{formatCurrency(item.price)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.product_id, -1)}
                    className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.product_id, 1)}
                    className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => removeFromCart(item.product_id)}
                    className="w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm font-semibold text-gray-900 w-20 text-right">
                  {formatCurrency(item.price * item.quantity)}
                </p>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t border-gray-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 font-medium">Total</span>
              <span className="text-xl font-bold text-gray-900">{formatCurrency(cartTotal)}</span>
            </div>
            <button
              onClick={() => {
                setShowPayment(true);
                setPaymentAmount(String(cartTotal));
              }}
              className="btn-success w-full flex items-center justify-center gap-2 text-lg"
            >
              <CreditCard className="w-5 h-5" />
              Bayar
            </button>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Pembayaran</h2>
                <button
                  onClick={() => setShowPayment(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Payment Method */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'cash', label: 'Tunai', icon: Banknote },
                    { id: 'card', label: 'Kartu', icon: CreditCard },
                    { id: 'qris', label: 'QRIS', icon: QrCode },
                  ].map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all
                        ${paymentMethod === method.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <method.icon
                        className={`w-6 h-6 ${paymentMethod === method.id ? 'text-primary-600' : 'text-gray-400'}`}
                      />
                      <span
                        className={`text-sm font-medium ${paymentMethod === method.id ? 'text-primary-600' : 'text-gray-600'}`}
                      >
                        {method.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-500">Total Belanja</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(cartTotal)}</p>
              </div>

              {/* Payment Amount (Cash only) */}
              {paymentMethod === 'cash' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jumlah Bayar
                  </label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="input-field text-xl font-bold text-center"
                    placeholder="0"
                    autoFocus
                  />
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {quickAmounts.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setPaymentAmount(String(amount))}
                        className="py-2 px-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium"
                      >
                        {formatCurrency(amount)}
                      </button>
                    ))}
                    <button
                      onClick={() => setPaymentAmount(String(cartTotal))}
                      className="py-2 px-3 bg-primary-50 hover:bg-primary-100 rounded-xl text-sm font-medium text-primary-600"
                    >
                      Uang Pas
                    </button>
                  </div>

                  {/* Change */}
                  {changeAmount >= 0 && parseInt(paymentAmount) > 0 && (
                    <div className="mt-4 bg-emerald-50 rounded-xl p-4">
                      <p className="text-sm text-emerald-600">Kembalian</p>
                      <p className="text-xl font-bold text-emerald-700">
                        {formatCurrency(changeAmount)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handlePayment}
                disabled={
                  processing ||
                  (paymentMethod === 'cash' && (parseInt(paymentAmount) || 0) < cartTotal)
                }
                className="btn-success w-full flex items-center justify-center gap-2 text-lg mt-4"
              >
                {processing ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Proses Pembayaran
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receipt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Transaksi Berhasil!</h2>
              <p className="text-sm text-gray-400 font-mono">{receipt.invoice_number}</p>

              <div className="mt-6 text-left space-y-2">
                {receipt.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {item.product_name} x{item.quantity}
                    </span>
                    <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
                <hr className="my-3" />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(receipt.total_amount)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Bayar ({receipt.payment_method})</span>
                  <span>{formatCurrency(receipt.payment_amount)}</span>
                </div>
                <div className="flex justify-between text-sm text-emerald-600 font-medium">
                  <span>Kembalian</span>
                  <span>{formatCurrency(receipt.change_amount)}</span>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button onClick={() => setReceipt(null)} className="btn-primary flex-1">
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
