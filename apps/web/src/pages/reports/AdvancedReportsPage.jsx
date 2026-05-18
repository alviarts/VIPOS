// Advanced Reports Page - 10 additional reports for 100% completion
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import api from '../../utils/api';
import { formatCurrency, formatNumber } from '../../utils/format';
import ReportTemplate from '../../components/reports/ReportTemplate';
import {
  DateRangeInput,
  defaultDateRange,
  filtersToParams,
} from '../../components/reports/ReportFilterBar';

const TABS = [
  { key: 'product-performance', label: 'Performa Produk', endpoint: '/reports/product-performance' },
  { key: 'customer-lifetime-value', label: 'Customer LTV', endpoint: '/reports/customer-lifetime-value' },
  { key: 'staff-performance', label: 'Performa Staff', endpoint: '/reports/staff-performance' },
  { key: 'payment-method-analysis', label: 'Analisis Metode Bayar', endpoint: '/reports/payment-method-analysis' },
  { key: 'hourly-sales', label: 'Penjualan per Jam', endpoint: '/reports/hourly-sales' },
  { key: 'category-performance', label: 'Performa Kategori', endpoint: '/reports/category-performance' },
  { key: 'discount-usage', label: 'Penggunaan Diskon', endpoint: '/reports/discount-usage' },
  { key: 'tax-report', label: 'Laporan Pajak', endpoint: '/reports/tax-report' },
  { key: 'profit-margin', label: 'Margin Keuntungan', endpoint: '/reports/profit-margin' },
  { key: 'inventory-turnover', label: 'Perputaran Inventori', endpoint: '/reports/inventory-turnover' },
];

export default function AdvancedReportsPage() {
  const [activeTab, setActiveTab] = useState('product-performance');
  const [filters, setFilters] = useState(defaultDateRange());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

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
    <DateRangeInput
      from={filters.from}
      to={filters.to}
      onChange={(v) => setFilters((f) => ({ ...f, ...v }))}
    />
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
          <BarChart3 className="h-4 w-4" /> Laporan Lanjutan
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

      {activeTab === 'product-performance' && (
        <ReportTemplate
          title="Performa Produk"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`product-performance-${filters.from}_${filters.to}`}
          columns={[
            { key: 'product_name', label: 'Produk' },
            { key: 'sku', label: 'SKU' },
            { key: 'category_name', label: 'Kategori' },
            { key: 'total_qty_sold', label: 'Qty Terjual', format: 'number', align: 'right' },
            { key: 'total_revenue', label: 'Total Revenue', format: 'currency', align: 'right' },
            { key: 'avg_price', label: 'Harga Rata-rata', format: 'currency', align: 'right' },
            { key: 'transaction_count', label: 'Transaksi', format: 'number', align: 'right' },
            { key: 'gross_profit', label: 'Laba Kotor', format: 'currency', align: 'right' },
          ]}
        />
      )}

      {activeTab === 'customer-lifetime-value' && (
        <ReportTemplate
          title="Customer Lifetime Value"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`customer-ltv-${filters.from}_${filters.to}`}
          columns={[
            { key: 'customer_name', label: 'Pelanggan' },
            { key: 'phone', label: 'Telepon' },
            { key: 'email', label: 'Email' },
            { key: 'total_transactions', label: 'Total Transaksi', format: 'number', align: 'right' },
            { key: 'lifetime_value', label: 'Lifetime Value', format: 'currency', align: 'right' },
            { key: 'avg_transaction_value', label: 'Rata-rata Transaksi', format: 'currency', align: 'right' },
            { key: 'first_purchase', label: 'Pembelian Pertama', format: 'date' },
            { key: 'last_purchase', label: 'Pembelian Terakhir', format: 'date' },
            { key: 'loyalty_points', label: 'Poin Loyalty', format: 'number', align: 'right' },
          ]}
        />
      )}

      {activeTab === 'staff-performance' && (
        <ReportTemplate
          title="Performa Staff"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`staff-performance-${filters.from}_${filters.to}`}
          columns={[
            { key: 'staff_name', label: 'Nama Staff' },
            { key: 'email', label: 'Email' },
            { key: 'total_transactions', label: 'Total Transaksi', format: 'number', align: 'right' },
            { key: 'total_sales', label: 'Total Penjualan', format: 'currency', align: 'right' },
            { key: 'avg_transaction_value', label: 'Rata-rata Transaksi', format: 'currency', align: 'right' },
            { key: 'total_items_sold', label: 'Total Item Terjual', format: 'number', align: 'right' },
            { key: 'days_worked', label: 'Hari Kerja', format: 'number', align: 'right' },
          ]}
        />
      )}

      {activeTab === 'payment-method-analysis' && (
        <ReportTemplate
          title="Analisis Metode Bayar"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`payment-method-analysis-${filters.from}_${filters.to}`}
          columns={[
            { key: 'payment_method', label: 'Metode Bayar' },
            { key: 'transaction_count', label: 'Jumlah Transaksi', format: 'number', align: 'right' },
            { key: 'total_amount', label: 'Total', format: 'currency', align: 'right' },
            { key: 'avg_transaction_value', label: 'Rata-rata', format: 'currency', align: 'right' },
            { key: 'percentage', label: 'Persentase', format: 'percent', align: 'right' },
          ]}
        />
      )}

      {activeTab === 'hourly-sales' && (
        <ReportTemplate
          title="Penjualan per Jam"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`hourly-sales-${filters.from}_${filters.to}`}
          columns={[
            { key: 'hour', label: 'Jam', format: 'number', align: 'center' },
            { key: 'transaction_count', label: 'Jumlah Transaksi', format: 'number', align: 'right' },
            { key: 'total_sales', label: 'Total Penjualan', format: 'currency', align: 'right' },
            { key: 'avg_transaction_value', label: 'Rata-rata', format: 'currency', align: 'right' },
            { key: 'total_items_sold', label: 'Total Item', format: 'number', align: 'right' },
          ]}
        />
      )}

      {activeTab === 'category-performance' && (
        <ReportTemplate
          title="Performa Kategori"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`category-performance-${filters.from}_${filters.to}`}
          columns={[
            { key: 'category_name', label: 'Kategori' },
            { key: 'product_count', label: 'Jumlah Produk', format: 'number', align: 'right' },
            { key: 'total_qty_sold', label: 'Qty Terjual', format: 'number', align: 'right' },
            { key: 'total_revenue', label: 'Total Revenue', format: 'currency', align: 'right' },
            { key: 'avg_price', label: 'Harga Rata-rata', format: 'currency', align: 'right' },
            { key: 'transaction_count', label: 'Transaksi', format: 'number', align: 'right' },
            { key: 'gross_profit', label: 'Laba Kotor', format: 'currency', align: 'right' },
          ]}
        />
      )}

      {activeTab === 'discount-usage' && (
        <ReportTemplate
          title="Penggunaan Diskon"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`discount-usage-${filters.from}_${filters.to}`}
          columns={[
            { key: 'date', label: 'Tanggal', format: 'date' },
            { key: 'transaction_count', label: 'Transaksi', format: 'number', align: 'right' },
            { key: 'total_discount', label: 'Total Diskon', format: 'currency', align: 'right' },
            { key: 'avg_discount', label: 'Rata-rata Diskon', format: 'currency', align: 'right' },
            { key: 'total_sales', label: 'Total Penjualan', format: 'currency', align: 'right' },
            { key: 'discount_percentage', label: '% Diskon', format: 'percent', align: 'right' },
          ]}
        />
      )}

      {activeTab === 'tax-report' && (
        <ReportTemplate
          title="Laporan Pajak"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`tax-report-${filters.from}_${filters.to}`}
          columns={[
            { key: 'date', label: 'Tanggal', format: 'date' },
            { key: 'transaction_count', label: 'Transaksi', format: 'number', align: 'right' },
            { key: 'subtotal', label: 'Subtotal', format: 'currency', align: 'right' },
            { key: 'total_tax', label: 'Total Pajak', format: 'currency', align: 'right' },
            { key: 'total_with_tax', label: 'Total + Pajak', format: 'currency', align: 'right' },
            { key: 'avg_tax_per_transaction', label: 'Rata-rata Pajak', format: 'currency', align: 'right' },
          ]}
        />
      )}

      {activeTab === 'profit-margin' && (
        <ReportTemplate
          title="Margin Keuntungan"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`profit-margin-${filters.from}_${filters.to}`}
          columns={[
            { key: 'product_name', label: 'Produk' },
            { key: 'sku', label: 'SKU' },
            { key: 'category_name', label: 'Kategori' },
            { key: 'total_qty_sold', label: 'Qty Terjual', format: 'number', align: 'right' },
            { key: 'total_revenue', label: 'Revenue', format: 'currency', align: 'right' },
            { key: 'total_cost', label: 'Total Cost', format: 'currency', align: 'right' },
            { key: 'gross_profit', label: 'Laba Kotor', format: 'currency', align: 'right' },
            { key: 'profit_margin_percentage', label: 'Margin %', format: 'percent', align: 'right' },
          ]}
        />
      )}

      {activeTab === 'inventory-turnover' && (
        <ReportTemplate
          title="Perputaran Inventori"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`inventory-turnover-${filters.from}_${filters.to}`}
          columns={[
            { key: 'product_name', label: 'Produk' },
            { key: 'sku', label: 'SKU' },
            { key: 'category_name', label: 'Kategori' },
            { key: 'current_stock', label: 'Stok Saat Ini', format: 'number', align: 'right' },
            { key: 'qty_sold', label: 'Qty Terjual', format: 'number', align: 'right' },
            { key: 'avg_inventory', label: 'Rata-rata Inventori', format: 'number', align: 'right' },
            { key: 'turnover_ratio', label: 'Rasio Perputaran', format: 'number', align: 'right' },
            { key: 'days_to_sell', label: 'Hari untuk Jual', format: 'number', align: 'right' },
          ]}
        />
      )}
    </div>
  );
}
