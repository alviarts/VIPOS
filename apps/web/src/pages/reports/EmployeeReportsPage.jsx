// P1-17 — Employee reports: attendance, shift, commission.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2 } from 'lucide-react';
import api from '../../utils/api';
import ReportTemplate from '../../components/reports/ReportTemplate';
import {
  DateRangeInput,
  defaultDateRange,
  filtersToParams,
} from '../../components/reports/ReportFilterBar';

const TABS = [
  { key: 'employee-attendance', label: 'Absensi', endpoint: '/reports/employee-attendance' },
  { key: 'employee-shift', label: 'Shift', endpoint: '/reports/employee-shift' },
  { key: 'employee-commission', label: 'Komisi', endpoint: '/reports/employee-commission' },
];

export default function EmployeeReportsPage() {
  const [active, setActive] = useState('employee-attendance');
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
    'employee-attendance': [
      { key: 'date', label: 'Tanggal', format: 'date' },
      { key: 'employee_name', label: 'Karyawan' },
      { key: 'position', label: 'Jabatan' },
      { key: 'first_check_in', label: 'Mulai', format: 'datetime' },
      { key: 'last_check_out', label: 'Selesai', format: 'datetime' },
      { key: 'check_in_count', label: 'Check-in', format: 'number', align: 'right' },
      { key: 'check_out_count', label: 'Check-out', format: 'number', align: 'right' },
      { key: 'off_site_count', label: 'Off-site', format: 'number', align: 'right' },
    ],
    'employee-shift': [
      { key: 'schedule_date', label: 'Tanggal', format: 'date' },
      { key: 'employee_name', label: 'Karyawan' },
      { key: 'position', label: 'Jabatan' },
      { key: 'shift_name', label: 'Shift' },
      { key: 'start_time', label: 'Mulai' },
      { key: 'end_time', label: 'Selesai' },
      { key: 'is_off', label: 'Libur' },
    ],
    'employee-commission': [
      { key: 'period_key', label: 'Periode' },
      { key: 'employee_name', label: 'Karyawan' },
      { key: 'group_name', label: 'Group' },
      { key: 'group_type', label: 'Tipe' },
      { key: 'amount_basis', label: 'Basis' },
      { key: 'basis_qty', label: 'Qty', format: 'number', align: 'right' },
      { key: 'tier_percentage', label: '%', format: 'number', align: 'right' },
      { key: 'computed_amount', label: 'Komisi', format: 'currency', align: 'right' },
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
          <Building2 className="h-4 w-4" /> Karyawan
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
        columns={columns[active]}
      />
    </div>
  );
}
