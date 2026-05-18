export function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// VIPOS standardizes display timestamps to Asia/Jakarta (WIB).
// Server/DB stores UTC; we render WIB across the UI for consistency with the
// merchant's working hours. WITA/WIT support is tracked under per-outlet TZ
// config (launch_readiness_roadmap.md §6.5).
const DISPLAY_TIME_ZONE = 'Asia/Jakarta';

export function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('id-ID', {
    timeZone: DISPLAY_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateString) {
  return new Date(dateString).toLocaleString('id-ID', {
    timeZone: DISPLAY_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export function formatNumber(num) {
  return new Intl.NumberFormat('id-ID').format(num);
}
