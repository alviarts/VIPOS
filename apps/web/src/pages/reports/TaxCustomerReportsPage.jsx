// P1-17 — Tax + Customer reports.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import api from '../../utils/api';
import { formatCurrency, formatNumber } from '../../utils/format';
import ReportTemplate from '../../components/reports/ReportTemplate';
import {
  DateRangeInput,
  defaultDateRange,
  filtersToParams,
} from '../../components/reports/ReportFilterBar';

const TABS = [
  { key: 'tax', label: 'Pajak', endpoint: '/reports/tax' },
  { key: 'customer', label: 'Pelanggan', endpoint: '/reports/customer' },
];

export default function TaxCustomerReportsPage() {
  const [active, setActive] = useState('tax');
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
          <Users className="h-4 w-4" /> Pajak & Pelanggan
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

      {active === 'tax' ? (
        <ReportTemplate
          title="Laporan Pajak"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`tax-${filters.from}_${filters.to}`}
          columns={[
            { key: 'period', label: 'Periode', format: 'date' },
            { key: 'gross', label: 'Bruto', format: 'currency', align: 'right' },
            { key: 'tax_rate', label: 'Tarif', format: 'number', align: 'right' },
            { key: 'tax_amount', label: 'Pajak', format: 'currency', align: 'right' },
            { key: 'service_charge', label: 'Service', format: 'currency', align: 'right' },
            { key: 'net', label: 'Net', format: 'currency', align: 'right' },
          ]}
        />
      ) : (
        <ReportTemplate
          title="Laporan Pelanggan"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`customer-${filters.from}_${filters.to}`}
          extraToolbar={
            data?.summary && (
              <div className="text-right text-sm">
                <p className="text-xs uppercase tracking-wide text-gray-400">Pelanggan</p>
                <p>
                  Aktif{' '}
                  <span className="font-semibold">
                    {formatNumber(data.summary.active_count || 0)}
                  </span>
                </p>
                <p>
                  Spend{' '}
                  <span className="font-semibold">
                    {formatCurrency(data.summary.total_spend || 0)}
                  </span>
                </p>
              </div>
            )
          }
          columns={[
            { key: 'customer_name', label: 'Pelanggan' },
            { key: 'phone', label: 'Telp' },
            { key: 'visit_count', label: 'Visit', format: 'number', align: 'right' },
            { key: 'first_visit', label: 'Pertama', format: 'datetime' },
            { key: 'last_visit', label: 'Terakhir', format: 'datetime' },
            { key: 'total_spend', label: 'Spend', format: 'currency', align: 'right' },
          ]}
        />
      )}
    </div>
  );
}
