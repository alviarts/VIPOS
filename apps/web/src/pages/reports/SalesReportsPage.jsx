// P1-17 — Sales reports (tabbed): summary, detail, daily, outlet, category,
// department, product, cashier, payment-method.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import api from '../../utils/api';
import { formatCurrency, formatNumber } from '../../utils/format';
import ReportTemplate from '../../components/reports/ReportTemplate';
import {
  DateRangeInput,
  SelectInput,
  defaultDateRange,
  filtersToParams,
} from '../../components/reports/ReportFilterBar';

const TABS = [
  { key: 'summary', label: 'Ringkasan', endpoint: '/reports/sales-summary' },
  { key: 'detail', label: 'Detail Transaksi', endpoint: '/reports/sales-detail' },
  { key: 'daily', label: 'Harian', endpoint: '/reports/sales-daily' },
  { key: 'outlet', label: 'Per Outlet', endpoint: '/reports/sales-by-outlet' },
  { key: 'category', label: 'Per Kategori', endpoint: '/reports/sales-by-category' },
  { key: 'department', label: 'Per Departemen', endpoint: '/reports/sales-by-department' },
  { key: 'product', label: 'Per Produk', endpoint: '/reports/sales-by-product' },
  { key: 'cashier', label: 'Per Kasir', endpoint: '/reports/sales-by-cashier' },
  { key: 'payment', label: 'Per Metode Bayar', endpoint: '/reports/sales-by-payment-method' },
];

const PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Tunai' },
  { value: 'card', label: 'Kartu' },
  { value: 'qris', label: 'QRIS' },
];

export default function SalesReportsPage() {
  const [activeTab, setActiveTab] = useState('summary');
  const [filters, setFilters] = useState({
    ...defaultDateRange(),
    payment_method: '',
    cashier_id: '',
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cashiers, setCashiers] = useState([]);

  useEffect(() => {
    api
      .get('/employee')
      .then((res) => setCashiers(Array.isArray(res.data) ? res.data : []))
      .catch(() => setCashiers([]));
  }, []);

  const tab = useMemo(() => TABS.find((t) => t.key === activeTab), [activeTab]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(tab.endpoint, { params: filtersToParams(filters) })
      .then((res) => {
        if (!cancelled) setData(res.data || null);
      })
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tab, filters]);

  const filterUI = (
    <>
      <DateRangeInput
        from={filters.from}
        to={filters.to}
        onChange={(v) => setFilters((f) => ({ ...f, ...v }))}
      />
      <SelectInput
        label="Metode Bayar"
        value={filters.payment_method}
        onChange={(v) => setFilters((f) => ({ ...f, payment_method: v }))}
        options={PAYMENT_OPTIONS}
      />
      <SelectInput
        label="Kasir"
        value={filters.cashier_id}
        onChange={(v) => setFilters((f) => ({ ...f, cashier_id: v }))}
        options={cashiers.map((c) => ({ value: c.user_id || c.id, label: c.name }))}
      />
    </>
  );

  const subtitle = `${filters.from} → ${filters.to}`;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <Link
          to="/reports"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Hub Laporan
        </Link>
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <TrendingUp className="h-4 w-4" /> Penjualan
        </div>
      </header>

      <div className="-mx-4 overflow-x-auto px-4">
        <nav className="flex w-max gap-1 border-b border-gray-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'summary' ? (
        <SalesSummaryTab
          loading={loading}
          data={data}
          filters={filters}
          filterUI={filterUI}
          subtitle={subtitle}
        />
      ) : activeTab === 'detail' ? (
        <ReportTemplate
          title="Detail Transaksi"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`sales-detail-${filters.from}_${filters.to}`}
          columns={[
            { key: 'invoice_number', label: 'No. Invoice' },
            { key: 'created_at', label: 'Waktu', format: 'datetime' },
            { key: 'cashier_name', label: 'Kasir' },
            { key: 'customer_name', label: 'Pelanggan' },
            { key: 'item_count', label: 'Qty', format: 'number', align: 'right' },
            { key: 'payment_method', label: 'Bayar' },
            { key: 'status', label: 'Status' },
            { key: 'total_amount', label: 'Total', format: 'currency', align: 'right' },
          ]}
        />
      ) : activeTab === 'daily' ? (
        <ReportTemplate
          title="Penjualan Harian"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`sales-daily-${filters.from}_${filters.to}`}
          columns={[
            { key: 'date', label: 'Tanggal', format: 'date' },
            { key: 'transactions', label: 'Transaksi', format: 'number', align: 'right' },
            { key: 'items', label: 'Item Terjual', format: 'number', align: 'right' },
            { key: 'revenue', label: 'Pendapatan', format: 'currency', align: 'right' },
          ]}
        />
      ) : activeTab === 'outlet' ? (
        <ReportTemplate
          title="Penjualan per Outlet"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`sales-by-outlet-${filters.from}_${filters.to}`}
          columns={[
            { key: 'outlet_name', label: 'Outlet' },
            { key: 'transactions', label: 'Transaksi', format: 'number', align: 'right' },
            { key: 'items', label: 'Item', format: 'number', align: 'right' },
            { key: 'avg_ticket', label: 'AOV', format: 'currency', align: 'right' },
            { key: 'revenue', label: 'Pendapatan', format: 'currency', align: 'right' },
          ]}
        />
      ) : activeTab === 'category' ? (
        <ReportTemplate
          title="Penjualan per Kategori"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`sales-by-category-${filters.from}_${filters.to}`}
          columns={[
            { key: 'category_name', label: 'Kategori' },
            { key: 'qty', label: 'Qty Terjual', format: 'number', align: 'right' },
            { key: 'revenue', label: 'Pendapatan', format: 'currency', align: 'right' },
          ]}
        />
      ) : activeTab === 'department' ? (
        <ReportTemplate
          title="Penjualan per Departemen"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`sales-by-department-${filters.from}_${filters.to}`}
          columns={[
            { key: 'department_name', label: 'Departemen' },
            { key: 'qty', label: 'Qty Terjual', format: 'number', align: 'right' },
            { key: 'revenue', label: 'Pendapatan', format: 'currency', align: 'right' },
          ]}
        />
      ) : activeTab === 'product' ? (
        <ReportTemplate
          title="Penjualan per Produk"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`sales-by-product-${filters.from}_${filters.to}`}
          columns={[
            { key: 'product_name', label: 'Produk' },
            { key: 'qty', label: 'Qty', format: 'number', align: 'right' },
            { key: 'revenue', label: 'Pendapatan', format: 'currency', align: 'right' },
            { key: 'margin', label: 'Margin', format: 'currency', align: 'right' },
          ]}
        />
      ) : activeTab === 'cashier' ? (
        <ReportTemplate
          title="Penjualan per Kasir"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`sales-by-cashier-${filters.from}_${filters.to}`}
          columns={[
            { key: 'cashier_name', label: 'Kasir' },
            { key: 'transactions', label: 'Transaksi', format: 'number', align: 'right' },
            { key: 'avg_ticket', label: 'AOV', format: 'currency', align: 'right' },
            { key: 'revenue', label: 'Pendapatan', format: 'currency', align: 'right' },
          ]}
        />
      ) : activeTab === 'payment' ? (
        <ReportTemplate
          title="Penjualan per Metode Bayar"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`sales-by-payment-${filters.from}_${filters.to}`}
          columns={[
            { key: 'method', label: 'Metode' },
            { key: 'transactions', label: 'Transaksi', format: 'number', align: 'right' },
            { key: 'gross_amount', label: 'Bruto', format: 'currency', align: 'right' },
            { key: 'mdr_pct', label: 'MDR %', format: 'number', align: 'right' },
            { key: 'mdr_amount', label: 'MDR', format: 'currency', align: 'right' },
            { key: 'net_amount', label: 'Net', format: 'currency', align: 'right' },
          ]}
        />
      ) : null}
    </div>
  );
}

function SalesSummaryTab({ loading, data, filterUI, subtitle }) {
  const kpi = data?.kpi || {
    gross_revenue: 0,
    transaction_count: 0,
    avg_ticket: 0,
    item_count: 0,
    unique_customers: 0,
    voided_count: 0,
    voided_value: 0,
  };

  const dailyRows = data?.daily_trend || [];
  const topProducts = data?.top_products || [];
  const paymentRows = data?.payment_breakdown || [];

  return (
    <ReportTemplate
      title="Ringkasan Penjualan"
      subtitle={subtitle}
      filters={filterUI}
      loading={loading}
      hideExport
      columns={[]}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Pendapatan" value={formatCurrency(kpi.gross_revenue)} />
        <KpiCard label="Transaksi" value={formatNumber(kpi.transaction_count)} />
        <KpiCard label="AOV" value={formatCurrency(kpi.avg_ticket)} />
        <KpiCard label="Item Terjual" value={formatNumber(kpi.item_count)} />
        <KpiCard label="Pelanggan Unik" value={formatNumber(kpi.unique_customers)} />
        <KpiCard
          label="Void"
          value={formatNumber(kpi.voided_count)}
          hint={formatCurrency(kpi.voided_value)}
        />
        <KpiCard label="Pajak" value={formatCurrency(kpi.tax || 0)} />
        <KpiCard label="Diskon" value={formatCurrency(kpi.discount || 0)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700">Trend Harian</h3>
          {dailyRows.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400">Belum ada data periode ini.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {dailyRows.slice(-10).map((d) => (
                <li
                  key={d.date}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5"
                >
                  <span>{d.date}</span>
                  <span className="text-gray-500">{formatNumber(d.transactions)} tx</span>
                  <span className="font-semibold">{formatCurrency(d.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700">Top Produk</h3>
          {topProducts.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400">Belum ada data.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100 text-sm">
              {topProducts.map((p, idx) => (
                <li
                  key={`${p.product_id || idx}`}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <span className="truncate">{p.product_name}</span>
                  <span className="text-xs text-gray-500">{formatNumber(p.qty)}x</span>
                  <span className="font-medium">{formatCurrency(p.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700">Pecah per Metode Bayar</h3>
          {paymentRows.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400">Belum ada data.</p>
          ) : (
            <table className="mt-3 min-w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-2 text-left">Metode</th>
                  <th className="py-2 text-right">Transaksi</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {paymentRows.map((row) => (
                  <tr key={row.method} className="border-t border-gray-100">
                    <td className="py-2">{row.method}</td>
                    <td className="py-2 text-right">{formatNumber(row.count)}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </ReportTemplate>
  );
}

function KpiCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
