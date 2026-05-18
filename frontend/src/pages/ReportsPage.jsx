import { useState, useEffect } from 'react';
import {
  TrendingUp, DollarSign, ShoppingCart, CreditCard, Calendar,
} from 'lucide-react';
import api from '../utils/api';
import { formatCurrency } from '../utils/format';

const PERIODS = [
  { value: '7',  label: '7 Hari' },
  { value: '14', label: '14 Hari' },
  { value: '30', label: '30 Hari' },
  { value: '90', label: '3 Bulan' },
];

const PAYMENT_LABEL = {
  cash: 'Tunai',
  card: 'Kartu',
  qris: 'QRIS',
  ewallet: 'E-Wallet',
  transfer: 'Transfer',
};

export default function ReportsPage() {
  const [period, setPeriod] = useState('7');
  const [chartData, setChartData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [period]);

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
  const avgTicket = totalTx > 0 ? totalRevenue / totalTx : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Laporan Penjualan</h1>
          <p className="text-sm text-gray-400">Analisis performa bisnis Anda</p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-full p-1 overflow-x-auto scrollbar-none">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors
                ${period === p.value
                  ? 'bg-primary-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <SummaryCard
          icon={DollarSign}
          label="Total Pendapatan"
          value={formatCurrency(totalRevenue)}
          tone="emerald"
        />
        <SummaryCard
          icon={ShoppingCart}
          label="Total Transaksi"
          value={totalTx}
          tone="sky"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Rata-rata Harian"
          value={formatCurrency(avgDaily)}
          tone="violet"
        />
        <SummaryCard
          icon={CreditCard}
          label="Rata-rata / Transaksi"
          value={formatCurrency(avgTicket)}
          tone="amber"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Grafik Penjualan</h2>
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {period} hari terakhir
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary-500" />
                Pendapatan
              </span>
            </div>
          </div>
          <ReportsAreaChart data={chartData} />
        </div>

        {/* Payment Methods */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Metode Pembayaran</h2>
          {paymentMethods.length > 0 ? (
            <div className="space-y-4">
              {paymentMethods.map((m, i) => {
                const total = paymentMethods.reduce((s, p) => s + p.total, 0);
                const pct = total > 0 ? (m.total / total) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-700 capitalize">
                        {PAYMENT_LABEL[m.payment_method] || m.payment_method}
                      </span>
                      <span className="font-semibold text-gray-900">{formatCurrency(m.total)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-primary-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {m.count} transaksi · {pct.toFixed(0)}%
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
      <div className="card overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Produk Terlaris</h2>
          <p className="text-xs text-gray-400 mt-0.5">Top 10 produk berdasarkan penjualan</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 table-header w-12">#</th>
                <th className="px-4 py-3 table-header">Produk</th>
                <th className="px-4 py-3 table-header text-right">Terjual</th>
                <th className="px-4 py-3 table-header text-right">Pendapatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {topProducts.map((p, i) => (
                <tr key={i} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold
                      ${i === 0 ? 'bg-amber-100 text-amber-700'
                        : i === 1 ? 'bg-gray-100 text-gray-600'
                        : i === 2 ? 'bg-orange-100 text-orange-700'
                        : 'bg-primary-50 text-primary-600'}`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.product_name}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{p.total_sold}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {formatCurrency(p.total_revenue)}
                  </td>
                </tr>
              ))}
              {topProducts.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center py-12 text-gray-400">
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

const TONE_MAP = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  sky:     { bg: 'bg-sky-50',     text: 'text-sky-600' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600' },
};

function SummaryCard({ icon: Icon, label, value, tone }) {
  const t = TONE_MAP[tone] || TONE_MAP.emerald;
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 mb-2">{label}</p>
          <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl ${t.bg} ${t.text} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function ReportsAreaChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Belum ada data penjualan
      </div>
    );
  }

  const width = 800;
  const height = 260;
  const padding = { top: 16, right: 12, bottom: 36, left: 12 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const max = Math.max(...data.map((d) => d.total), 1);
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + innerH - (d.total / max) * innerH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${padding.top + innerH} L ${points[0].x} ${padding.top + innerH} Z`
      : '';

  // Show only ~6-8 x-axis labels max to avoid clutter
  const labelInterval = Math.max(1, Math.ceil(data.length / 7));

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64" preserveAspectRatio="none">
        <defs>
          <linearGradient id="reports-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#04C99E" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#04C99E" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={padding.left}
            x2={padding.left + innerW}
            y1={padding.top + innerH * g}
            y2={padding.top + innerH * g}
            stroke="#E5E7EB"
            strokeDasharray="3 4"
            strokeWidth="1"
          />
        ))}

        <path d={areaPath} fill="url(#reports-fill)" />
        <path
          d={linePath}
          fill="none"
          stroke="#04C99E"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3.5"
            fill="#fff"
            stroke="#04C99E"
            strokeWidth="2"
          />
        ))}
      </svg>

      <div className="flex justify-between mt-1 px-1 text-[11px] text-gray-400">
        {data.map((d, i) =>
          i % labelInterval === 0 || i === data.length - 1 ? (
            <span key={i}>
              {new Date(d.date).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
              })}
            </span>
          ) : (
            <span key={i} className="opacity-0">.</span>
          )
        )}
      </div>
    </div>
  );
}
