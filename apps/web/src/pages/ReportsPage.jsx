import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, ShoppingCart } from 'lucide-react';
import api from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';

export default function ReportsPage() {
  const [period, setPeriod] = useState('7');
  const [chartData, setChartData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [chartRes, topRes, payRes] = await Promise.all([
        api.get(`/dashboard/chart?days=${period}`),
        api.get('/dashboard/top-products?limit=10'),
        api.get('/dashboard/payment-methods'),
      ]);
      setChartData(chartRes.data);
      setTopProducts(topRes.data);
      setPaymentMethods(payRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = chartData.reduce((sum, d) => sum + d.total, 0);
  const totalTx = chartData.reduce((sum, d) => sum + d.transactions, 0);
  const avgDaily = chartData.length > 0 ? totalRevenue / chartData.length : 0;
  const maxChart = Math.max(...chartData.map((d) => d.total), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan Penjualan</h1>
          <p className="text-sm text-gray-400">Analisis performa bisnis Anda</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="input-field w-auto"
        >
          <option value="7">7 Hari Terakhir</option>
          <option value="14">14 Hari Terakhir</option>
          <option value="30">30 Hari Terakhir</option>
          <option value="90">3 Bulan Terakhir</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-sm text-gray-500">Total Pendapatan</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500">Total Transaksi</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalTx}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-gray-500">Rata-rata Harian</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(avgDaily)}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2 card">
          <h2 className="font-semibold text-gray-900 mb-4">Grafik Penjualan</h2>
          {chartData.length > 0 ? (
            <div className="flex items-end gap-1 h-64 overflow-x-auto pb-2">
              {chartData.map((d, i) => (
                <div key={i} className="flex-1 min-w-[32px] flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {formatCurrency(d.total).replace('Rp', '')}
                  </span>
                  <div
                    className="w-full bg-primary-500 rounded-t-lg min-h-[4px] transition-all hover:bg-primary-600"
                    style={{ height: `${(d.total / maxChart) * 200}px` }}
                  />
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(d.date).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              Belum ada data
            </div>
          )}
        </div>

        {/* Payment Methods */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Metode Pembayaran (Hari Ini)</h2>
          {paymentMethods.length > 0 ? (
            <div className="space-y-4">
              {paymentMethods.map((m, i) => {
                const total = paymentMethods.reduce((s, p) => s + p.total, 0);
                const pct = total > 0 ? (m.total / total) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 uppercase">{m.payment_method}</span>
                      <span className="font-medium">{formatCurrency(m.total)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {m.count} transaksi ({pct.toFixed(0)}%)
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Belum ada data hari ini</p>
          )}
        </div>
      </div>

      {/* Top Products Table */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Produk Terlaris</h2>
        <div className="overflow-x-auto -mx-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="px-4 pb-3 font-medium w-12">#</th>
                <th className="px-4 pb-3 font-medium">Produk</th>
                <th className="px-4 pb-3 font-medium text-right">Terjual</th>
                <th className="px-4 pb-3 font-medium text-right">Pendapatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {topProducts.map((p, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="w-6 h-6 bg-primary-50 rounded-full flex items-center justify-center text-xs font-bold text-primary-600">
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{p.product_name}</td>
                  <td className="px-4 py-3 text-right">{p.total_sold}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatCurrency(p.total_revenue)}
                  </td>
                </tr>
              ))}
              {topProducts.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center py-8 text-gray-400">
                    Belum ada data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
