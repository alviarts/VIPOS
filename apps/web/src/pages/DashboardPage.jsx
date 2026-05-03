import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, ShoppingCart, Package, AlertTriangle,
  ArrowUpRight, DollarSign, BarChart3, CreditCard,
  ShoppingBag, Star, Users
} from 'lucide-react';
import api from '../utils/api';
import { formatCurrency, formatDateTime } from '../utils/format';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [recentTx, setRecentTx] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('daily');
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, chartRes, topRes, recentRes, pmRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/chart?days=7'),
        api.get('/dashboard/top-products?limit=5'),
        api.get('/dashboard/recent'),
        api.get('/dashboard/payment-methods'),
      ]);
      setStats(statsRes.data);
      setChartData(chartRes.data);
      setTopProducts(topRes.data);
      setRecentTx(recentRes.data);
      setPaymentMethods(pmRes.data);
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  const maxChart = Math.max(...chartData.map(d => d.total), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Dashboard Penjualan
            <Star className="w-4 h-4 text-gray-300 cursor-pointer hover:text-yellow-400" />
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Diperbarui {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}, {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button onClick={() => navigate('/cashier')} className="btn-primary flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" />
          <span className="hidden sm:inline">Buka Kasir</span>
        </button>
      </div>

      {/* Period selector - Majoo style */}
      <div className="flex items-center gap-2">
        {['daily', 'weekly', 'monthly'].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
              ${period === p ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {p === 'daily' ? 'Harian' : p === 'weekly' ? 'Mingguan' : 'Bulan'}
          </button>
        ))}
      </div>

      {/* Stats row - Majoo style */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 divide-x-0 md:divide-x divide-gray-100">
          <div>
            <p className="text-xs text-gray-400 mb-1">Total Penjualan</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(stats?.today?.total || 0)}</p>
          </div>
          <div className="md:pl-4">
            <p className="text-xs text-gray-400 mb-1">Penjualan Terbayar</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(stats?.today?.total || 0)}</p>
          </div>
          <div className="md:pl-4">
            <p className="text-xs text-gray-400 mb-1">Transaksi</p>
            <p className="text-lg font-bold text-gray-900">{stats?.today?.transactions || 0}</p>
          </div>
          <div className="md:pl-4">
            <p className="text-xs text-gray-400 mb-1">Penjualan/Transaksi</p>
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(stats?.today?.transactions ? Math.round((stats?.today?.total || 0) / stats.today.transactions) : 0)}
            </p>
          </div>
          <div className="md:pl-4">
            <p className="text-xs text-gray-400 mb-1">Produk Terjual</p>
            <p className="text-lg font-bold text-gray-900">{stats?.products || 0}</p>
          </div>
          <div className="md:pl-4">
            <p className="text-xs text-gray-400 mb-1">Produk/Transaksi</p>
            <p className="text-lg font-bold text-gray-900">0</p>
          </div>
        </div>
      </div>

      {/* Sales Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">
            Penjualan {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-300" /> Periode Sebelumnya</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-primary-500" /> Total Penjualan</span>
          </div>
        </div>
        {chartData.length > 0 ? (
          <div className="flex items-end gap-2 h-48">
            {chartData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-500 font-medium">
                  {formatCurrency(d.total).replace('Rp', '').trim()}
                </span>
                <div
                  className="w-full bg-primary-500 rounded-t-md min-h-[4px] transition-all"
                  style={{ height: `${(d.total / maxChart) * 160}px` }}
                />
                <span className="text-xs text-gray-400">
                  {new Date(d.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            Belum ada data penjualan
          </div>
        )}
      </div>

      {/* Analysis cards - Majoo style 4-column grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metode Pembayaran */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3">Metode Pembayaran</h3>
          {paymentMethods.length > 0 ? (
            <div className="space-y-2">
              {paymentMethods.map((pm, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 uppercase">{pm.payment_method}</span>
                  <span className="font-medium">{pm.count}x</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">Belum Ada Pembayaran</p>
          )}
          <button className="text-sm text-primary-600 hover:underline flex items-center gap-1 mt-3">
            Lihat Semua <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {/* Produk Terlaris */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3">Produk Terlaris</h3>
          {topProducts.length > 0 ? (
            <div className="space-y-2">
              {topProducts.slice(0, 4).map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-5 h-5 bg-primary-50 rounded-full flex items-center justify-center text-xs font-bold text-primary-600">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-gray-700 truncate">{p.product_name}</span>
                  <span className="text-gray-400 text-xs">{p.total_sold}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">Belum Ada Transaksi</p>
          )}
          <button className="text-sm text-primary-600 hover:underline flex items-center gap-1 mt-3">
            Lihat Semua <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {/* Penjualan per Kategori */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3">Penjualan per Kategori</h3>
          <p className="text-sm text-gray-400 text-center py-4">Belum Ada Transaksi</p>
          <button className="text-sm text-primary-600 hover:underline flex items-center gap-1 mt-3">
            Lihat Semua <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {/* Stok Terendah */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3">Stok Terendah</h3>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-2xl font-bold text-gray-900">{stats?.low_stock || 0}</span>
            <span className="text-sm text-gray-400">produk</span>
          </div>
          <p className="text-xs text-gray-400">Produk dengan stok ≤ 5</p>
          <button className="text-sm text-primary-600 hover:underline flex items-center gap-1 mt-3">
            Lihat Semua <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Transaksi Terbaru</h2>
          <button onClick={() => navigate('/transactions')} className="text-sm text-primary-600 hover:underline flex items-center gap-1">
            Lihat Semua <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
        {recentTx.length > 0 ? (
          <div className="overflow-x-auto -mx-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="px-4 pb-3 table-header">Invoice</th>
                  <th className="px-4 pb-3 table-header">Kasir</th>
                  <th className="px-4 pb-3 table-header">Total</th>
                  <th className="px-4 pb-3 table-header">Metode</th>
                  <th className="px-4 pb-3 table-header">Status</th>
                  <th className="px-4 pb-3 table-header">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentTx.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{tx.invoice_number}</td>
                    <td className="px-4 py-3">{tx.cashier_name}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(tx.total_amount)}</td>
                    <td className="px-4 py-3">
                      <span className="badge bg-gray-100 text-gray-600 uppercase">{tx.payment_method}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${tx.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>
                        {tx.status === 'completed' ? 'Selesai' : 'Batal'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDateTime(tx.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">Belum ada transaksi</p>
        )}
      </div>
    </div>
  );
}
