// P1-17 — Marketing campaign report.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Megaphone } from 'lucide-react';
import api from '../../utils/api';
import ReportTemplate from '../../components/reports/ReportTemplate';
import {
  DateRangeInput,
  defaultDateRange,
  filtersToParams,
} from '../../components/reports/ReportFilterBar';

export default function MarketingReportsPage() {
  const [filters, setFilters] = useState(defaultDateRange());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get('/reports/marketing-campaign', { params: filtersToParams(filters) })
      .then((res) => !cancelled && setData(res.data || null))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const filterUI = (
    <DateRangeInput
      from={filters.from}
      to={filters.to}
      onChange={(v) => setFilters((f) => ({ ...f, ...v }))}
    />
  );

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
          <Megaphone className="h-4 w-4" /> Marketing
        </div>
      </header>

      <ReportTemplate
        title="Laporan Marketing Campaign"
        subtitle={`${filters.from} → ${filters.to}`}
        filters={filterUI}
        loading={loading}
        rows={data?.rows || []}
        exportFilename={`marketing-${filters.from}_${filters.to}`}
        columns={[
          { key: 'name', label: 'Campaign' },
          { key: 'channel', label: 'Channel' },
          { key: 'sent_count', label: 'Sent', format: 'number', align: 'right' },
          { key: 'open_count', label: 'Open', format: 'number', align: 'right' },
          { key: 'click_count', label: 'Click', format: 'number', align: 'right' },
          { key: 'redeemed_count', label: 'Redeemed', format: 'number', align: 'right' },
          { key: 'created_at', label: 'Dibuat', format: 'date' },
        ]}
      />
    </div>
  );
}
