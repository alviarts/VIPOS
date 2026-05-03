// P1-17 — Reports Hub.
//
// Landing page `/reports` yang menampilkan semua report yang tersedia,
// dikelompokkan per kategori (Penjualan, Kas & Shift, Penyesuaian, Pajak,
// Inventori, Karyawan, Keuangan, Marketing). Setiap card link ke halaman
// kategori di mana user bisa pilih sub-report dari tab.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Wallet,
  Sparkles,
  Building2,
  Boxes,
  Users,
  Calculator,
  Megaphone,
  CalendarClock,
  Crown,
  ArrowRight,
} from 'lucide-react';
import api from '../../utils/api';
import { usePermission } from '../../context/PermissionContext';

const GROUP_META = {
  sales: {
    icon: TrendingUp,
    color: 'from-emerald-500 to-teal-600',
    href: '/reports/sales',
  },
  'cash-shift': {
    icon: Wallet,
    color: 'from-amber-500 to-orange-600',
    href: '/reports/cash-shift',
  },
  adjustments: {
    icon: Sparkles,
    color: 'from-fuchsia-500 to-pink-600',
    href: '/reports/adjustments',
  },
  'tax-customer': {
    icon: Users,
    color: 'from-blue-500 to-indigo-600',
    href: '/reports/tax-customer',
  },
  inventory: {
    icon: Boxes,
    color: 'from-cyan-500 to-sky-600',
    href: '/reports/inventory',
  },
  employee: {
    icon: Building2,
    color: 'from-violet-500 to-purple-600',
    href: '/reports/employee',
  },
  financial: {
    icon: Calculator,
    color: 'from-rose-500 to-red-600',
    href: '/finance/reports',
  },
  marketing: {
    icon: Megaphone,
    color: 'from-yellow-500 to-amber-600',
    href: '/reports/marketing',
  },
};

export default function ReportsHub() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const { tier, hasTier } = usePermission();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get('/reports/catalog')
      .then((res) => {
        if (!cancelled) setGroups(res.data || []);
      })
      .catch(() => setGroups([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const totalReports = groups.reduce((acc, g) => acc + (g.reports?.length || 0), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan</h1>
          <p className="text-sm text-gray-500">
            {totalReports} laporan tersedia. Filter standar (periode, outlet, kasir, kategori) +
            export CSV / Excel / PDF.
          </p>
        </div>
        <Link
          to="/reports/scheduled"
          className="inline-flex items-center gap-2 rounded-lg border border-primary-500 bg-white px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50"
        >
          <CalendarClock className="h-4 w-4" /> Jadwal Laporan
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
            <Crown className="h-3 w-3" /> Prime+
          </span>
        </Link>
      </header>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white p-12 text-gray-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {groups.map((group) => {
            const meta = GROUP_META[group.group] || GROUP_META.sales;
            const Icon = meta.icon;
            return (
              <Link
                key={group.group}
                to={meta.href}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className={`flex items-center gap-3 bg-gradient-to-r ${meta.color} px-4 py-3 text-white`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-semibold tracking-wide">{group.label}</span>
                  <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium">
                    {group.reports?.length || 0}
                  </span>
                </div>
                <ul className="flex-1 divide-y divide-gray-100 bg-white text-sm text-gray-700">
                  {(group.reports || []).slice(0, 6).map((r) => {
                    const tierLocked =
                      r.tier &&
                      !hasTier(
                        r.tier === 'prime'
                          ? 'prime'
                          : r.tier === 'starter'
                            ? 'starter'
                            : r.tier === 'advance'
                              ? 'advance'
                              : null
                      );
                    return (
                      <li key={r.key} className="flex items-center justify-between gap-2 px-4 py-2">
                        <span className="truncate">{r.label}</span>
                        {tierLocked ? (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            <Crown className="inline h-3 w-3" />
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                  {(group.reports?.length || 0) > 6 && (
                    <li className="px-4 py-2 text-xs italic text-gray-400">
                      + {group.reports.length - 6} laporan lainnya
                    </li>
                  )}
                </ul>
                <div className="flex items-center justify-end gap-1 border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs font-medium text-primary-700 group-hover:text-primary-900">
                  Buka <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-primary-50 to-emerald-50 p-4 text-sm text-gray-700">
        <p className="font-semibold text-gray-900">Tier saat ini: {tier}</p>
        <p className="mt-1 text-gray-600">
          Beberapa laporan (kupon, marketing campaign, scheduled email) butuh tier Prime atau lebih
          tinggi. Upgrade subscription untuk mengaktifkan.
        </p>
      </div>
    </div>
  );
}
