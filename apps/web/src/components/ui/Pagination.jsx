import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Majoo-style pagination:
 *   Tampilkan: [10 ▼]   Ditampilkan 1 - 10 dari N data   < 1 2 3 >
 */
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function Pagination({
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const goTo = (p) => {
    const next = Math.max(1, Math.min(totalPages, p));
    if (next !== page) onPageChange?.(next);
  };

  const visiblePages = buildPageRange(page, totalPages);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-white rounded-b-xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>Tampilkan:</span>
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange?.(parseInt(e.target.value, 10));
            onPageChange?.(1);
          }}
          className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="hidden sm:inline">
          Ditampilkan {start} - {end} dari {total} data
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Previous"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {visiblePages.map((p, idx) =>
          p === '...' ? (
            <span key={`gap-${idx}`} className="px-2 text-gray-400 text-sm">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => goTo(p)}
              className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium ${
                p === page ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Next"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function buildPageRange(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const range = [1];
  if (current > 3) range.push('...');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    range.push(p);
  }
  if (current < total - 2) range.push('...');
  range.push(total);
  return range;
}
