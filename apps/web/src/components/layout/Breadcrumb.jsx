// VIPOS — Auto-generated breadcrumb based on the current pathname.
//
// We don't (yet) wire react-router's `useMatches` because not all routes are
// data-routes. Instead we infer crumbs from pathname segments and look up a
// human label against the static menu definition + a small override map.
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { MENU_GROUPS } from '../../data/menu-groups';

const SLUG_LABELS = {
  '': 'Beranda',
  dashboard: 'Dashboard',
  cashier: 'Kasir',
  products: 'Produk',
  categories: 'Kategori',
  customers: 'Pelanggan',
  inventory: 'Inventori',
  finance: 'Keuangan',
  transactions: 'Riwayat Transaksi',
  reports: 'Laporan',
  settings: 'Pengaturan',
  outlet: 'Outlet',
  employees: 'Karyawan',
  payroll: 'Payroll',
  appointment: 'Reservasi',
  capital: 'Capital',
  supplies: 'Supplies',
  inspirasi: 'Inspirasi',
  layanan: 'Layanan',
  onboarding: 'Onboarding',
  help: 'Bantuan',
  marketplace: 'Marketplace',
  emenu: 'E-Menu',
  webstore: 'Webstore',
  'order-online': 'Order Online',
  lainnya: 'Lainnya',
};

function lookupLabel(segment, fullPath) {
  if (SLUG_LABELS[segment]) return SLUG_LABELS[segment];
  for (const group of MENU_GROUPS) {
    if (group.id === segment) return group.label;
    const item = group.items.find((it) => it.path === fullPath);
    if (item) return item.label;
  }
  // Fallback: title-case the slug.
  return segment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Breadcrumb() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);

  const crumbs = segments.map((seg, idx) => {
    const fullPath = '/' + segments.slice(0, idx + 1).join('/');
    return { label: lookupLabel(seg, fullPath), path: fullPath };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      data-testid="breadcrumb"
      className="hidden items-center gap-1 text-sm text-gray-500 md:flex"
    >
      <Link
        to="/dashboard"
        className="flex items-center gap-1 text-gray-500 transition-colors hover:text-primary-600"
      >
        <Home className="h-4 w-4" />
      </Link>
      {crumbs.map((c, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <span key={c.path} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-gray-300" />
            {isLast ? (
              <span className="font-medium text-gray-700" aria-current="page">
                {c.label}
              </span>
            ) : (
              <Link
                to={c.path}
                className="text-gray-500 transition-colors hover:text-primary-600"
              >
                {c.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
