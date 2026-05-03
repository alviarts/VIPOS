// P1-17 — Adjustment reports: void, refund, promo, loyalty, coupon.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import api from '../../utils/api';
import ReportTemplate from '../../components/reports/ReportTemplate';
import {
  DateRangeInput,
  defaultDateRange,
  filtersToParams,
} from '../../components/reports/ReportFilterBar';

const TABS = [
  { key: 'void', label: 'Void', endpoint: '/reports/void' },
  { key: 'refund', label: 'Refund', endpoint: '/reports/refund' },
  { key: 'promo', label: 'Promo', endpoint: '/reports/promo' },
  { key: 'loyalty', label: 'Loyalty', endpoint: '/reports/loyalty' },
  { key: 'coupon', label: 'Kupon', endpoint: '/reports/coupon' },
];

export default function AdjustmentReportsPage() {
  const [active, setActive] = useState('void');
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

  const columnsByTab = {
    void: [
      { key: 'invoice_number', label: 'Invoice' },
      { key: 'created_at', label: 'Waktu', format: 'datetime' },
      { key: 'cashier_name', label: 'Kasir' },
      { key: 'reason', label: 'Alasan' },
      { key: 'total_amount', label: 'Nilai', format: 'currency', align: 'right' },
    ],
    refund: [
      { key: 'invoice_number', label: 'Invoice' },
      { key: 'created_at', label: 'Waktu', format: 'datetime' },
      { key: 'cashier_name', label: 'Kasir' },
      { key: 'reason', label: 'Alasan' },
      { key: 'total_amount', label: 'Nilai', format: 'currency', align: 'right' },
    ],
    promo: [
      { key: 'name', label: 'Promo' },
      { key: 'promo_type', label: 'Tipe' },
      { key: 'discount_value', label: 'Nilai', format: 'number', align: 'right' },
      { key: 'valid_from', label: 'Berlaku dari', format: 'date' },
      { key: 'valid_until', label: 'Berlaku sampai', format: 'date' },
      { key: 'usage_count', label: 'Pemakaian', format: 'number', align: 'right' },
      { key: 'is_active', label: 'Aktif' },
    ],
    loyalty: [
      { key: 'created_at', label: 'Waktu', format: 'datetime' },
      { key: 'customer_name', label: 'Pelanggan' },
      { key: 'type', label: 'Jenis' },
      { key: 'points', label: 'Poin', format: 'number', align: 'right' },
      { key: 'transaction_id', label: 'Tx Ref' },
    ],
    coupon: [
      { key: 'code', label: 'Kode' },
      { key: 'promo_name', label: 'Promo' },
      { key: 'used_count', label: 'Pemakaian', format: 'number', align: 'right' },
      { key: 'max_uses', label: 'Batas', format: 'number', align: 'right' },
      { key: 'redeemed_amount', label: 'Diskon', format: 'currency', align: 'right' },
      { key: 'valid_until', label: 'Kadaluarsa', format: 'date' },
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
          <Sparkles className="h-4 w-4" /> Penyesuaian
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
        columns={columnsByTab[active] || []}
      />
    </div>
  );
}
