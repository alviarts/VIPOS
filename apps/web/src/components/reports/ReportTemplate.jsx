// P1-17 — Reusable report layout: filter bar + table + export.
//
// Props:
//   - title, subtitle: header text
//   - columns: [{ key, label, format?, align?, render? }] — describes table cols
//   - rows: data array
//   - filters: react node rendered di filter strip (caller controls state)
//   - extraToolbar: optional react node di kanan filter (e.g. KPI cards)
//   - footer: optional react node di bawah table
//   - loading: bool
//   - emptyMessage: string
//   - exportFilename: base filename (tanpa ext)
//   - hideExport: bool
//   - groupBySupport: bool — kalau true tambahin select group_by ke filter UI
//
// Format hooks accepted di columns:
//   'currency' | 'number' | 'date' | 'datetime' | undefined
import ExportButtons from './ExportButtons';
import { formatValue } from '../../utils/exportTable';

export default function ReportTemplate({
  title,
  subtitle,
  filters,
  extraToolbar,
  columns = [],
  rows = [],
  loading = false,
  emptyMessage = 'Belum ada data untuk filter ini.',
  exportFilename,
  hideExport = false,
  exportFormats,
  footer,
  children,
}) {
  const safeRows = Array.isArray(rows) ? rows : [];

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        {!hideExport && (
          <ExportButtons
            filename={exportFilename || (title || 'laporan').toLowerCase().replace(/\s+/g, '-')}
            title={title}
            subtitle={subtitle}
            columns={columns}
            rows={safeRows}
            formats={exportFormats}
          />
        )}
      </header>

      {(filters || extraToolbar) && (
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap items-end gap-3">{filters}</div>
            {extraToolbar && <div className="flex items-center gap-3">{extraToolbar}</div>}
          </div>
        </div>
      )}

      {children}

      {columns.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className={`px-4 py-2.5 text-${c.align || 'left'} font-semibold uppercase tracking-wider text-gray-500 text-xs`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                      <div className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                        Memuat...
                      </div>
                    </td>
                  </tr>
                ) : safeRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-8 text-center text-sm text-gray-400"
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  safeRows.map((row, idx) => (
                    <tr key={row.id ?? idx} className="hover:bg-primary-50/40">
                      {columns.map((c) => (
                        <td
                          key={c.key}
                          className={`px-4 py-2 text-${c.align || 'left'} text-gray-700 align-top`}
                        >
                          {c.render ? c.render(row[c.key], row) : formatValue(row[c.key], c.format)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {footer && (
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-sm text-gray-600">
              {footer}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
