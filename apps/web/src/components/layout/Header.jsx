// VIPOS — Top header (search, outlet switcher, profile, notification badge).
//
// Designed to slot above the route outlet inside `AppShell`. Keeps a simple
// search box (purely cosmetic until wired in P1-04+). The notification badge
// number is mocked here; consumed in `AppShell` from a future
// `NotificationContext`.
import { Bell, LogOut, Menu, Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../context/PermissionContext';
import OutletSwitcher from './OutletSwitcher';
import Breadcrumb from './Breadcrumb';

export default function Header({ onOpenMobileSidebar, notificationCount = 0 }) {
  const { user, logout } = useAuth();
  const { role, tier } = usePermission();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="z-30 flex flex-col gap-2 border-b border-gray-200 bg-white px-4 py-3 shadow-sm md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="-ml-2 rounded p-2 text-gray-600 hover:bg-gray-100 md:hidden"
          aria-label="Buka menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search */}
        <div className="relative hidden flex-1 max-w-md sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Cari produk, transaksi, pelanggan…"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-9 pr-3 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-primary-500 focus:bg-white focus:ring-1 focus:ring-primary-500"
            aria-label="Cari"
          />
        </div>

        <div className="flex flex-1 items-center justify-end gap-2">
          <OutletSwitcher />

          <button
            type="button"
            data-testid="notification-bell"
            className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label={
              notificationCount > 0
                ? `${notificationCount} notifikasi belum dibaca`
                : 'Notifikasi'
            }
          >
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <span
                data-testid="notification-badge"
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
              >
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </button>

          {/* Profile */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 hover:bg-gray-100"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-xs font-semibold text-white">
                {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-gray-700">{user?.name ?? 'User'}</p>
                <p className="text-[11px] uppercase text-gray-400">
                  {role} · {tier.replace('_', ' ')}
                </p>
              </div>
            </button>

            {profileOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-lg border border-gray-100 bg-white py-1 shadow-lg"
              >
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate('/settings');
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Pengaturan
                </button>
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    handleLogout();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Breadcrumb />
    </header>
  );
}
