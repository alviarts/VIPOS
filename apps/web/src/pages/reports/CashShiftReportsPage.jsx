// P1-17 — Cash & Shift reports.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Wallet } from 'lucide-react';
import api from '../../utils/api';
import { formatCurrency } from '../../utils/format';
import ReportTemplate from '../../components/reports/ReportTemplate';
import {
  DateRangeInput,
  defaultDateRange,
  filtersToParams,
} from '../../components/reports/ReportFilterBar';

const TABS = [
  { key: 'cash-drawer', label: 'Kas Kasir', endpoint: '/reports/cash-drawer' },
  { key: 'shift-close', label: 'Tutup Kasir', endpoint: '/reports/shift-close' },
];

export default function CashShiftReportsPage() {
  const [active, setActive] = useState('cash-drawer');
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
          <Wallet className="h-4 w-4" /> Kas & Shift
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

      {active === 'cash-drawer' ? (
        <ReportTemplate
          title="Kas Kasir (Drawer Movement)"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`cash-drawer-${filters.from}_${filters.to}`}
          extraToolbar={
            data?.totals && (
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-gray-400">Total</p>
                <p className="text-sm">
                  Masuk{' '}
                  <span className="font-semibold text-emerald-600">
                    {formatCurrency(data.totals.income)}
                  </span>
                </p>
                <p className="text-sm">
                  Keluar{' '}
                  <span className="font-semibold text-red-600">
                    {formatCurrency(data.totals.expense)}
                  </span>
                </p>
              </div>
            )
          }
          columns={[
            { key: 'tanggal', label: 'Tanggal', format: 'date' },
            { key: 'tipe', label: 'Tipe' },
            { key: 'kategori', label: 'Kategori' },
            { key: 'account_nama', label: 'Akun' },
            { key: 'cashier_name', label: 'Kasir' },
            { key: 'reference', label: 'Ref' },
            { key: 'keterangan', label: 'Keterangan' },
            { key: 'jumlah', label: 'Jumlah', format: 'currency', align: 'right' },
          ]}
        />
      ) : (
        <ReportTemplate
          title="Tutup Kasir (Shift Close)"
          subtitle={subtitle}
          filters={filterUI}
          loading={loading}
          rows={data?.rows || []}
          exportFilename={`shift-close-${filters.from}_${filters.to}`}
          columns={[
            { key: 'shift_date', label: 'Tanggal', format: 'date' },
            { key: 'cashier_name', label: 'Kasir' },
            { key: 'open_time', label: 'Mulai', format: 'datetime' },
            { key: 'close_time', label: 'Selesai', format: 'datetime' },
            { key: 'transactions', label: 'Tx', format: 'number', align: 'right' },
            { key: 'cash_revenue', label: 'Tunai', format: 'currency', align: 'right' },
            { key: 'card_revenue', label: 'Kartu', format: 'currency', align: 'right' },
            { key: 'qris_revenue', label: 'QRIS', format: 'currency', align: 'right' },
            { key: 'revenue', label: 'Total', format: 'currency', align: 'right' },
          ]}
        />
      )}
    </div>
  );
}
