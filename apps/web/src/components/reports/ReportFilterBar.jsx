// P1-17 — Standard filter bar inputs untuk dipakai bersama ReportTemplate.
//
// Standar filter (per docs/v2/16_REPORTS_CATALOG.md §1.1):
//   - Date range (from / to)
//   - Outlet (multi-select; saat ini single karena VIPOS belum multi-outlet)
//   - Cashier
//   - Payment method
//   - Group by (day/week/month) — opsional
//
// Caller pegang state filter object + setter; comp ini cuma tampilan inputs.
// Default range last-30-days dipasang oleh caller.
import { Calendar } from 'lucide-react';

export function DateRangeInput({ from, to, onChange, label = 'Periode' }) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="date"
            value={from || ''}
            onChange={(e) => onChange({ from: e.target.value, to })}
            className="rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </div>
        <span className="text-xs text-gray-400">→</span>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="date"
            value={to || ''}
            onChange={(e) => onChange({ from, to: e.target.value })}
            className="rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </div>
      </div>
    </div>
  );
}

export function SelectInput({ label, value, onChange, options, allLabel = 'Semua' }) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || '')}
        className="mt-1 rounded-md border border-gray-300 bg-white py-1.5 pl-2 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
      >
        <option value="">{allLabel}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function GroupBySelect({ value, onChange }) {
  return (
    <SelectInput
      label="Group by"
      value={value}
      onChange={onChange}
      allLabel="Default"
      options={[
        { value: 'day', label: 'Per Hari' },
        { value: 'week', label: 'Per Minggu' },
        { value: 'month', label: 'Per Bulan' },
      ]}
    />
  );
}

// Helper: ubah filter state ke querystring untuk axios `params`. Drop empty.
export function filtersToParams(filters) {
  const out = {};
  for (const [k, v] of Object.entries(filters || {})) {
    if (v === '' || v === null || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

// Default filter state — last 30 days.
export function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}
