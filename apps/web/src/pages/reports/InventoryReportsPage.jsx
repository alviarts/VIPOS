// P1-17 — Inventory reports: stock, movement, turnover, value.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Boxes } from 'lucide-react';
import api from '../../utils/api';
import { formatCurrency } from '../../utils/format';
import ReportTemplate from '../../components/reports/ReportTemplate';
import {
  DateRangeInput,
  defaultDateRange,
  filtersToParams,
} from '../../components/reports/ReportFilterBar';

const TABS = [
  { key: 'inventory-stock', label: 'Stok', endpoint: '/reports/inventory-stock' },
  { key: 'inventory-movement', label: 'Mutasi', endpoint: '/reports/inventory-movement' },
  { key: 'inventory-turnover', label: 'Turnover', endpoint: '/reports/inventory-turnover' },
  { key: 'inventory-value', label: 'Nilai', endpoint: '/reports/inventory-value' },
];

export default function InventoryReportsPage() {
  const [active, setActive] = useState('inventory-stock');
  const [filters, setFilters] = useState(defaultDateRange());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const tab = TABS.find((t) => t.key === active);
    api
      .get(tab.endpoint, { params: filtersToParams(filters) })
      .then((res) => !cancelled && setData(res.data || null))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [active, filters]);

  const filterUI = (
    <DateRangeInput
      from={filters.from}
      to={filters.to}
      onChange={(v) => setFilters((f) => ({ ...f, ...v }))}
    />
  );
  const subtitle = `${filters.from} → ${filters.to}`;

  const columns = {
    'inventory-stock': [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Produk' },
      { key: 'category_name', label: 'Kategori' },
      { key: 'stock', label: 'Stok', format: 'number', align: 'right' },
      { key: 'low_stock_threshold', label: 'Min', format: 'number', align: 'right' },
      { key: 'is_low', label: 'Status' },
      { key: 'price', label: 'Harga', format: 'currency', align: 'right' },
    ],
    'inventory-movement': [
      { key: 'created_at', label: 'Waktu', format: 'datetime' },
      { key: 'product_name', label: 'Produk' },
      { key: 'movement_type', label: 'Tipe' },
      { key: 'qty', label: 'Qty', format: 'number', align: 'right' },
      { key: 'reference', label: 'Ref' },
      { key: 'notes', label: 'Keterangan' },
    ],
    'inventory-turnover': [
      { key: 'product_name', label: 'Produk' },
      { key: 'sold_qty', label: 'Terjual', format: 'number', align: 'right' },
      { key: 'avg_stock', label: 'Stok Rata2', format: 'number', align: 'right' },
      { key: 'turnover_ratio', label: 'Turnover', format: 'number', align: 'right' },
    ],
    'inventory-value': [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Produk' },
      { key: 'stock', label: 'Stok', format: 'number', align: 'right' },
      { key: 'cost_price', label: 'HPP', format: 'currency', align: 'right' },
      { key: 'value', label: 'Nilai', format: 'currency', align: 'right' },
    ],
  };

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
          <Boxes className="h-4 w-4" /> Inventori
        </div>
      </header>

      <nav className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active === t.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <ReportTemplate
        title={`Laporan ${TABS.find((t) => t.key === active).label}`}
        subtitle={subtitle}
        filters={filterUI}
        loading={loading}
        rows={data?.rows || []}
        exportFilename={`${active}-${filters.from}_${filters.to}`}
        extraToolbar={
          active === 'inventory-value' &&
          data?.totals && (
            <div className="text-right text-sm">
              <p className="text-xs uppercase tracking-wide text-gray-400">Total Nilai</p>
              <p className="font-semibold">{formatCurrency(data.totals.total_value || 0)}</p>
            </div>
          )
        }
        columns={columns[active]}
      />
    </div>
  );
}
