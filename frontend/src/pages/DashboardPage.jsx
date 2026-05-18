import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, ShoppingCart, Package, AlertTriangle,
  ArrowUpRight, DollarSign, CreditCard, ShoppingBag,
  Receipt, Boxes,
} from 'lucide-react';
import api from '../utils/api';
import { formatCurrency, formatDateTime } from '../utils/format';

const PAY_METHOD_LABEL = {
  cash: 'Tunai',
  card: 'Kartu',
  qris: 'QRIS',
  ewallet: 'E-Wallet',
  transfer: 'Transfer',
};

const PAY_METHOD_ICON = {
  cash: DollarSign,
  card: CreditCard,
  qris: ShoppingBag,
  ewallet: CreditCard,
  transfer: CreditCard,
};

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
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard Penjualan</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Diperbarui{' '}
            {new Date().toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
            ,{' '}
            {new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1 bg-white border border-gray-200 rounded-full p-1">
            {['daily', 'weekly', 'monthly'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                  ${period === p
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {p === 'daily' ? 'Harian' : p === 'weekly' ? 'Mingguan' : 'Bulanan'}
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate('/cashier')}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <ShoppingCart className="w-4 h-4" />
            Buka Kasir
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={DollarSign}
          label="Total Penjualan"
          value={formatCurrency(stats?.today?.total || 0)}
          tone="emerald"
          hint="Hari ini"
        />
        <StatCard
          icon={Receipt}
          label="Transaksi"
          value={stats?.today?.transactions || 0}
          tone="sky"
          hint="Hari ini"
        />
        <StatCard
          icon={TrendingUp}
          label="Rata-rata / Transaksi"
          value={formatCurrency(
            stats?.today?.transactions
              ? Math.round((stats?.today?.total || 0) / stats.today.transactions)
              : 0
          )}
          tone="violet"
          hint="Hari ini"
        />
        <StatCard
          icon={Boxes}
          label="Total Produk"
          value={stats?.products || 0}
          tone="amber"
          hint={`${stats?.low_stock || 0} stok menipis`}
          warning={(stats?.low_stock || 0) > 0}
        />
      </div>

      {/* Sales Chart + Side panels */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Grafik Penjualan</h2>
              <p className="text-xs text-gray-400 mt-0.5">7 hari terakhir</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary-500" />
                Total Penjualan
              </span>
            </div>
          </div>
          <SalesAreaChart data={chartData} />
        </div>

        {/* Payment Methods */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Metode Pembayaran</h3>
            <button
              onClick={() => navigate('/reports')}
              className="text-xs text-primary-600 hover:underline flex items-center gap-1"
            >
              Lihat <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          {paymentMethods.length > 0 ? (
            <PaymentMethodList items={paymentMethods} />
          ) : (
            <EmptyMini text="Belum ada pembayaran hari ini" icon={CreditCard} />
          )}
        </div>
      </div>

      {/* Secondary row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Top products */}
        <div className="card md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Produk Terlaris</h3>
            <button
              onClick={() => navigate('/reports')}
              className="text-xs text-primary-600 hover:underline flex items-center gap-1"
            >
              Lihat Semua <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          {topProducts.length > 0 ? (
            <div className="space-y-2">
              {topProducts.slice(0, 5).map((p, i) => (
                <TopProductRow key={i} rank={i + 1} product={p} />
              ))}
            </div>
          ) : (
            <EmptyMini text="Belum ada transaksi" icon={Package} />
          )}
        </div>

        {/* Low stock */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Stok Terendah</h3>
            <button
              onClick={() => navigate('/inventory')}
              className="text-xs text-primary-600 hover:underline flex items-center gap-1"
            >
              Kelola <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-amber-700 leading-none">
                {stats?.low_stock || 0}
                <span className="text-sm text-amber-600/80 font-medium ml-1">produk</span>
              </p>
              <p className="text-xs text-amber-700/80 mt-1">Stok ≤ minimum / butuh restock</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/inventory')}
            className="btn-outline w-full mt-4 text-sm py-2"
          >
            Buka Inventori
          </button>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Transaksi Terbaru</h2>
          <button
            onClick={() => navigate('/transactions')}
            className="text-sm text-primary-600 hover:underline flex items-center gap-1"
          >
            Lihat Semua <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
        {recentTx.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 table-header">Invoice</th>
                  <th className="px-4 py-3 table-header">Kasir</th>
                  <th className="px-4 py-3 table-header text-right">Total</th>
                  <th className="px-4 py-3 table-header">Metode</th>
                  <th className="px-4 py-3 table-header">Status</th>
                  <th className="px-4 py-3 table-header text-right">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentTx.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{tx.invoice_number}</td>
                    <td className="px-4 py-3 text-gray-700">{tx.cashier_name}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 text-right">
                      {formatCurrency(tx.total_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge badge-neutral uppercase">{tx.payment_method}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${tx.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>
                        {tx.status === 'completed' ? 'Selesai' : 'Batal'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs text-right whitespace-nowrap">
                      {formatDateTime(tx.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-12">Belum ada transaksi</p>
        )}
      </div>
    </div>
  );
}

const TONE_MAP = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
  sky:     { bg: 'bg-sky-50',     text: 'text-sky-600',     ring: 'ring-sky-100' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  ring: 'ring-violet-100' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   ring: 'ring-amber-100' },
};

function StatCard({ icon: Icon, label, value, tone = 'emerald', hint, warning }) {
  const t = TONE_MAP[tone] || TONE_MAP.emerald;
  return (
    <div className="stat-card relative overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 mb-2">{label}</p>
          <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl ${t.bg} ${t.text} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {hint && (
        <p className={`text-[11px] mt-3 flex items-center gap-1 ${warning ? 'text-amber-600' : 'text-gray-400'}`}>
          {warning && <AlertTriangle className="w-3 h-3" />}
          {hint}
        </p>
      )}
    </div>
  );
}

function PaymentMethodList({ items }) {
  const total = items.reduce((s, m) => s + (m.total || 0), 0);
  return (
    <div className="space-y-3">
      {items.map((pm, i) => {
        const Icon = PAY_METHOD_ICON[pm.payment_method] || CreditCard;
        const label = PAY_METHOD_LABEL[pm.payment_method] || pm.payment_method;
        const pct = total > 0 ? ((pm.total || 0) / total) * 100 : 0;
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="flex items-center gap-2 text-gray-700">
                <Icon className="w-4 h-4 text-gray-400" />
                <span className="capitalize">{label}</span>
              </span>
              <span className="font-medium text-gray-900">{pm.count}x</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all"
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TopProductRow({ rank, product }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0
        ${rank === 1 ? 'bg-amber-100 text-amber-700'
          : rank === 2 ? 'bg-gray-100 text-gray-600'
          : rank === 3 ? 'bg-orange-100 text-orange-700'
          : 'bg-primary-50 text-primary-600'}`}>
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{product.product_name}</p>
        <p className="text-xs text-gray-400">{product.total_sold} terjual</p>
      </div>
      <p className="text-sm font-semibold text-gray-900">{formatCurrency(product.total_revenue || 0)}</p>
    </div>
  );
}

function EmptyMini({ text, icon: Icon }) {
  return (
    <div className="text-center py-8 text-gray-400">
      <div className="w-10 h-10 mx-auto rounded-xl bg-gray-50 flex items-center justify-center mb-2">
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-xs">{text}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="skeleton h-6 w-48" />
          <div className="skeleton h-3 w-32" />
        </div>
        <div className="skeleton h-9 w-32 rounded-full" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stat-card">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1">
                <div className="skeleton h-3 w-20" />
                <div className="skeleton h-5 w-24" />
              </div>
              <div className="skeleton w-10 h-10 rounded-xl" />
            </div>
            <div className="skeleton h-2 w-16 mt-3" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2 space-y-3">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-48 w-full rounded-xl" />
        </div>
        <div className="card space-y-3">
          <div className="skeleton h-4 w-28" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <div className="skeleton h-3 w-20" />
                <div className="skeleton h-3 w-10" />
              </div>
              <div className="skeleton h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SalesAreaChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Belum ada data penjualan
      </div>
    );
  }

  const width = 600;
  const height = 200;
  const padding = { top: 12, right: 12, bottom: 28, left: 12 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const max = Math.max(...data.map((d) => d.total), 1);
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + innerH - (d.total / max) * innerH,
    value: d.total,
    label: new Date(d.date).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
    }),
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${padding.top + innerH} L ${points[0].x} ${padding.top + innerH} Z`
      : '';

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#04C99E" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#04C99E" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
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

        {/* Area */}
        <path d={areaPath} fill="url(#sales-fill)" />
        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#04C99E"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="6" fill="#04C99E" opacity="0.15" />
            <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="#04C99E" strokeWidth="2" />
          </g>
        ))}
      </svg>

      {/* X-axis labels */}
      <div className="flex justify-between mt-1 px-1 text-[11px] text-gray-400">
        {data.map((d, i) => (
          <span key={i}>
            {new Date(d.date).toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'short',
            })}
          </span>
        ))}
      </div>
    </div>
  );
}
