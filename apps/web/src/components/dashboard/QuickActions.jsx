// VIPOS — Dashboard quick action tiles.
import { Link } from 'react-router-dom';
import { ShoppingCart, PackagePlus, BarChart3, Users } from 'lucide-react';

const TILES = [
  {
    to: '/cashier',
    label: 'Kasir Baru',
    desc: 'Buka POS untuk transaksi',
    icon: ShoppingCart,
    color: 'bg-primary-50 text-primary-600',
  },
  {
    to: '/products',
    label: 'Tambah Produk',
    desc: 'Daftar produk baru',
    icon: PackagePlus,
    color: 'bg-amber-50 text-amber-600',
  },
  {
    to: '/reports',
    label: 'Lihat Laporan',
    desc: 'Analitik penjualan',
    icon: BarChart3,
    color: 'bg-sky-50 text-sky-600',
  },
  {
    to: '/customers',
    label: 'Pelanggan',
    desc: 'Kelola data pelanggan',
    icon: Users,
    color: 'bg-violet-50 text-violet-600',
  },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {TILES.map((t) => {
        const Icon = t.icon;
        return (
          <Link
            key={t.to}
            to={t.to}
            className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 hover:border-primary-200 hover:shadow-sm transition"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${t.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900 group-hover:text-primary-700">
                {t.label}
              </p>
              <p className="truncate text-xs text-gray-500">{t.desc}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
