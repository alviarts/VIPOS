// VIPOS — Penjualan / Dashboard page.
//
// Pulls aggregate KPI data from /dashboard/summary, the daily revenue series
// from /dashboard/sales-trend, and the top product list from /dashboard/top-
// products. Date range driven by `DateRangePicker`. Outlet selector reads from
// `OutletContext` (hidden when only one outlet is available).
import { lazy, Suspense, useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import { Star } from 'lucide-react';
import api from '../utils/api';
import { formatCurrency } from '../utils/format';
import { useOutlet } from '../context/OutletContext';
import DateRangePicker from '../components/dashboard/DateRangePicker';
import KpiCards from '../components/dashboard/KpiCards';
import QuickActions from '../components/dashboard/QuickActions';
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton';

// recharts adalah dependency terbesar di route /dashboard. Lazy-import-kan
// supaya page shell + KPI + QuickActions render duluan, lalu chart muncul
// setelah recharts chunk landed.
const RevenueChart = lazy(() => import('../components/charts/RevenueChart'));
const TopProductChart = lazy(() => import('../components/charts/TopProductChart'));

function ChartFallback({ label }) {
  // Skeleton mirip layout grafik final: garis Y-axis di kiri, "bar" varying
  // height di sebelahnya. animate-pulse untuk shimmer subtle.
  // Visible window biasanya pendek karena DashboardPage prefetch chart chunks
  // di mount (lihat useEffect prefetch). Ini belt-and-suspenders supaya saat
  // chunk belum cached (cold load / network lambat), placeholder masih
  // visually grounded ke layout chart akhir.
  const bars = [55, 75, 40, 90, 60, 80, 35, 70, 50, 85, 45, 65];
  return (
    <div
      role="status"
      aria-label={label}
      className="flex h-48 w-full animate-pulse items-end gap-1 rounded-md bg-gray-50 px-3 pt-3 pb-1"
    >
      <div className="h-full w-px bg-gray-200" aria-hidden="true" />
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm bg-gray-200"
          style={{ height: `${h}%` }}
          aria-hidden="true"
        />
      ))}
      <span className="sr-only">Memuat grafik…</span>
    </div>
  );
}

function defaultRange() {
  const today = new Date();
  return {
    start: format(subDays(today, 29), 'yyyy-MM-dd'),
    end: format(today, 'yyyy-MM-dd'),
  };
}

export default function DashboardPage() {
  const { outlets, activeOutlet, switchOutlet } = useOutlet();
  const [range, setRange] = useState(defaultRange);
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Mulai unduh chunk recharts paralel dengan API fetches. Modul
    // dynamic-import di-cache oleh bundler, jadi React.lazy di atas pakai
    // promise yang sama saat render — Suspense fallback nyaris tidak
    // kelihatan di koneksi normal.
    import('../components/charts/RevenueChart');
    import('../components/charts/TopProductChart');
  }, []);

  useEffect(() => {
    if (!range.start || !range.end) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/dashboard/summary', { params: range }),
      api.get('/dashboard/sales-trend', { params: range }),
      api.get('/dashboard/top-products', { params: { limit: 10 } }),
      api.get('/dashboard/payment-methods'),
    ])
      .then(([sumRes, trendRes, topRes, pmRes]) => {
        if (cancelled) return;
        setSummary(sumRes.data);
        setTrend(trendRes.data);
        setTopProducts(topRes.data);
        setPaymentMethods(pmRes.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error || 'Gagal memuat dashboard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  if (loading && !summary) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            Dashboard Penjualan
            <Star className="h-4 w-4 text-gray-300 hover:text-yellow-400 cursor-pointer" />
          </h1>
          <p className="mt-0.5 text-xs text-gray-400">
            Outlet aktif: <span className="font-medium text-gray-600">{activeOutlet?.name}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {outlets?.length > 1 && (
            <select
              value={activeOutlet?.id || ''}
              onChange={(e) => switchOutlet(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-primary-400 focus:outline-none"
            >
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <KpiCards summary={summary} loading={loading} />

      <QuickActions />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Tren Pendapatan</h2>
            <span className="text-xs text-gray-400">
              {summary?.range?.start} → {summary?.range?.end}
            </span>
          </div>
          <Suspense fallback={<ChartFallback label="Memuat tren pendapatan" />}>
            <RevenueChart data={trend} />
          </Suspense>
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold text-gray-900">Metode Pembayaran</h2>
          {paymentMethods.length ? (
            <ul className="space-y-3">
              {paymentMethods.map((pm) => (
                <li key={pm.payment_method} className="flex items-center justify-between text-sm">
                  <span className="uppercase text-gray-600">{pm.payment_method}</span>
                  <span className="font-medium text-gray-900">{formatCurrency(pm.total)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">Belum ada pembayaran hari ini.</p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Top 10 Produk</h2>
          <span className="text-xs text-gray-400">Berdasarkan unit terjual</span>
        </div>
        <Suspense fallback={<ChartFallback label="Memuat top produk" />}>
          <TopProductChart data={topProducts} />
        </Suspense>
      </div>
    </div>
  );
}
