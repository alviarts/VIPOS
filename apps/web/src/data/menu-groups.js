// VIPOS — Sidebar menu group definitions
//
// Mirrors the 11 (+ promo) menu groups described in
// `docs/v3/workflow/phase_1_web_dashboard.md` § P1-01 acceptance criteria,
// cross-referenced with `docs/v2/05_PERMISSIONS.md` (per-menu role matrix)
// and `docs/v2/06_FEATURE_TIERS.md` (per-feature tier gating).
//
// Each item carries:
//   - `path`      — react-router path (or `null` when the group is static)
//   - `roles`     — array of role IDs allowed to see the entry. `[]` means
//                    "everyone with a session". OWNER/ADMIN bypass this list.
//   - `minTier`   — minimum subscription tier required (LITE → PRIME_PLUS).
//                    Falsy means "available on all tiers".
//   - `disabled`  — render disabled-look entry but keep visible (for "coming
//                    soon" stubs).
//
// Icons resolved from `lucide-react`. Keep grouping order stable since we
// snapshot it in `Sidebar.test.jsx`.
import {
  BarChart3,
  CalendarRange,
  ClipboardCheck,
  Compass,
  HandCoins,
  HeartHandshake,
  HelpCircle,
  LayoutDashboard,
  LifeBuoy,
  MoreHorizontal,
  Package,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Warehouse,
  Boxes,
} from 'lucide-react';
import { ROLES, TIERS } from '../context/PermissionContext';

export const MENU_GROUPS = [
  {
    id: 'penjualan',
    label: 'Penjualan',
    icon: LayoutDashboard,
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [] },
      {
        path: '/cashier',
        label: 'Kasir',
        icon: ShoppingCart,
        roles: [ROLES.MANAGER, ROLES.KASIR, ROLES.WAITERS],
      },
      {
        path: '/products',
        label: 'Produk',
        icon: Package,
        roles: [ROLES.MANAGER, ROLES.KASIR, ROLES.STAFF],
      },
      {
        path: '/categories',
        label: 'Kategori',
        icon: Tag,
        roles: [ROLES.MANAGER, ROLES.KASIR, ROLES.STAFF],
      },
      {
        path: '/departments',
        label: 'Departemen',
        icon: Boxes,
        roles: [ROLES.MANAGER, ROLES.STAFF],
      },
      {
        path: '/inventory',
        label: 'Inventori',
        icon: Warehouse,
        roles: [ROLES.MANAGER, ROLES.WAREHOUSE, ROLES.STAFF],
      },
      {
        path: '/inventory/opname',
        label: 'Stok Opname',
        icon: ClipboardCheck,
        roles: [ROLES.MANAGER, ROLES.WAREHOUSE],
      },
      {
        path: '/transactions',
        label: 'Riwayat Transaksi',
        icon: BarChart3,
        roles: [ROLES.MANAGER, ROLES.KASIR, ROLES.STAFF],
      },
      {
        path: '/reports',
        label: 'Laporan',
        icon: TrendingUp,
        roles: [ROLES.MANAGER, ROLES.STAFF],
      },
    ],
  },
  {
    id: 'promosi',
    label: 'Promosi',
    icon: Sparkles,
    items: [
      {
        path: '/promos',
        label: 'Promo',
        icon: Sparkles,
        roles: [ROLES.MANAGER, ROLES.KASIR, ROLES.STAFF],
      },
      {
        path: '/coupons',
        label: 'Kupon',
        icon: Tag,
        roles: [ROLES.MANAGER, ROLES.STAFF],
      },
      {
        path: '/loyalty',
        label: 'Loyalty Poin',
        icon: HeartHandshake,
        roles: [ROLES.MANAGER, ROLES.STAFF],
      },
    ],
  },
  {
    id: 'order_online',
    label: 'Order Online',
    icon: ShoppingBag,
    minTier: TIERS.STARTER,
    items: [
      {
        path: '/order-online/marketplace',
        label: 'Marketplace',
        icon: ShoppingBag,
        roles: [ROLES.MANAGER, ROLES.KASIR, ROLES.STAFF],
        minTier: TIERS.ADVANCE,
      },
      {
        path: '/order-online/emenu',
        label: 'E-Menu Setting',
        icon: Sparkles,
        roles: [ROLES.MANAGER],
        minTier: TIERS.STARTER,
      },
      {
        path: '/order-online/webstore',
        label: 'Webstore',
        icon: Store,
        roles: [ROLES.MANAGER],
        minTier: TIERS.LITE,
      },
    ],
  },
  {
    id: 'appointment',
    label: 'Appointment',
    icon: CalendarRange,
    minTier: TIERS.ADVANCE,
    items: [
      {
        path: '/appointment',
        label: 'Reservasi',
        icon: CalendarRange,
        roles: [ROLES.MANAGER, ROLES.KASIR, ROLES.STAFF, ROLES.WAITERS],
        minTier: TIERS.ADVANCE,
      },
      {
        path: '/appointment/settings',
        label: 'Pengaturan Reservasi',
        icon: CalendarRange,
        roles: [ROLES.MANAGER],
        minTier: TIERS.ADVANCE,
      },
    ],
  },
  {
    id: 'karyawan',
    label: 'Karyawan',
    icon: Users,
    items: [
      { path: '/employees', label: 'Daftar Karyawan', icon: Users, roles: [ROLES.MANAGER] },
      {
        path: '/customers',
        label: 'Pelanggan',
        icon: HeartHandshake,
        roles: [ROLES.MANAGER, ROLES.KASIR, ROLES.STAFF],
      },
      {
        path: '/customer-groups',
        label: 'Grup & Tag Pelanggan',
        icon: Tag,
        roles: [ROLES.MANAGER],
      },
      {
        path: '/payroll',
        label: 'Payroll',
        icon: Wallet,
        roles: [],
        minTier: TIERS.ADVANCE,
      },
    ],
  },
  {
    id: 'keuangan',
    label: 'Keuangan',
    icon: Wallet,
    items: [
      { path: '/finance', label: 'Kas & Bank', icon: Wallet, roles: [ROLES.MANAGER] },
      {
        path: '/finance/reports',
        label: 'Laporan Keuangan',
        icon: BarChart3,
        roles: [ROLES.MANAGER],
      },
    ],
  },
  {
    id: 'pengaturan',
    label: 'Pengaturan',
    icon: Sparkles,
    items: [
      { path: '/settings', label: 'Umum', icon: Sparkles, roles: [ROLES.MANAGER] },
      { path: '/settings/outlet', label: 'Outlet', icon: Store, roles: [] },
      { path: '/settings/change-password', label: 'Ubah Password', icon: Sparkles, roles: [] },
      { path: '/settings/2fa', label: 'Two-Factor Auth', icon: Sparkles, roles: [] },
    ],
  },
  {
    id: 'lainnya',
    label: 'Lainnya',
    icon: MoreHorizontal,
    items: [
      {
        path: '/lainnya',
        label: 'Integrasi',
        icon: MoreHorizontal,
        roles: [ROLES.MANAGER],
        disabled: true,
      },
    ],
  },
  {
    id: 'bantuan',
    label: 'Bantuan',
    icon: LifeBuoy,
    items: [{ path: '/help', label: 'Pusat Bantuan', icon: HelpCircle, roles: [] }],
  },
  {
    id: 'layanan',
    label: 'LAYANAN',
    icon: HeartHandshake,
    items: [{ path: '/layanan/onboarding', label: 'Onboarding', icon: HeartHandshake, roles: [] }],
  },
  {
    id: 'inspirasi',
    label: 'INSPIRASI',
    icon: Compass,
    items: [{ path: '/inspirasi', label: 'Tips & Trik', icon: Compass, roles: [] }],
  },
  {
    id: 'capital',
    label: 'Capital',
    icon: HandCoins,
    minTier: TIERS.ADVANCE,
    items: [
      {
        path: '/capital',
        label: 'Pinjaman',
        icon: HandCoins,
        roles: [ROLES.MANAGER],
        minTier: TIERS.ADVANCE,
      },
    ],
  },
  {
    id: 'supplies',
    label: 'SUPPLIES',
    icon: Truck,
    items: [{ path: '/supplies', label: 'Marketplace Supplier', icon: Truck, roles: [] }],
  },
];

// Helper used by Sidebar + tests to filter the static menu definition by the
// current role + tier. Returns groups whose at least one item is visible, with
// the `items` array rewritten to only the visible items.
export function filterMenuGroups(groups, canAccess) {
  return groups
    .filter((group) => canAccess({ minTier: group.minTier }))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccess({ roles: item.roles, minTier: item.minTier })),
    }))
    .filter((group) => group.items.length > 0);
}
