import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, ShoppingCart, Package, Receipt, BarChart3,
  Settings, LogOut, Menu, X, Store, ChevronDown, Bell, Users,
  Warehouse, Tag, Wallet, PanelLeftClose, PanelLeftOpen, Search,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard',  path: '/dashboard',    icon: LayoutDashboard },
  { name: 'Kasir',      path: '/cashier',      icon: ShoppingCart },
  { name: 'Produk',     path: '/products',     icon: Package },
  { name: 'Kategori',   path: '/categories',   icon: Tag },
  { name: 'Inventori',  path: '/inventory',    icon: Warehouse },
  { name: 'Pelanggan',  path: '/customers',    icon: Users },
  { name: 'Keuangan',   path: '/finance',      icon: Wallet },
  { name: 'Transaksi',  path: '/transactions', icon: Receipt },
  { name: 'Laporan',    path: '/reports',      icon: BarChart3 },
  { name: 'Pengaturan', path: '/settings',     icon: Settings },
];

const STORAGE_KEY = 'vipos.sidebar.collapsed';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  });
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    }
  }, [collapsed]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const currentNav = navigation.find((n) => location.pathname.startsWith(n.path));
  const pageTitle = currentNav?.name || 'VIPOS';
  const PageIcon = currentNav?.icon || Store;

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          ${collapsed ? 'lg:w-20' : 'lg:w-64'} w-64
          bg-gradient-to-b from-[#04C99E] to-[#03A882]
          transform transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex flex-col shadow-xl
        `}
      >
        {/* Brand */}
        <div className={`px-4 py-4 border-b border-white/15 ${collapsed ? 'lg:px-3' : ''}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Store className="w-5 h-5 text-white" />
              </div>
              <div className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
                <h1 className="text-xl font-bold text-white tracking-wide leading-none">VIPOS</h1>
                <p className="text-[11px] text-white/70 mt-1">Point of Sale</p>
              </div>
            </div>

            {/* Mobile close */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 -mr-1 text-white/80 hover:text-white"
              aria-label="Tutup menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Outlet selector */}
          <button
            className={`mt-3 w-full flex items-center gap-2 bg-white/15 rounded-lg px-3 py-2
              hover:bg-white/20 transition-colors ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
          >
            <Store className="w-4 h-4 text-white/80 flex-shrink-0" />
            <span className={`text-sm text-white flex-1 truncate text-left ${collapsed ? 'lg:hidden' : ''}`}>
              Outlet Utama
            </span>
            <ChevronDown className={`w-4 h-4 text-white/60 flex-shrink-0 ${collapsed ? 'lg:hidden' : ''}`} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navigation.map((item) => (
            <NavLink
              key={item.path + item.name}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              title={collapsed ? item.name : undefined}
              className={({ isActive }) =>
                `relative flex items-center gap-3 rounded-lg text-sm transition-all
                ${collapsed ? 'lg:justify-center lg:px-0 lg:py-3' : 'px-4 py-2.5'}
                ${isActive
                  ? 'bg-white/25 text-white font-semibold shadow-sm'
                  : 'text-white/85 hover:bg-white/15 hover:text-white'}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="hidden lg:block absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-white" />
                  )}
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className={`flex-1 ${collapsed ? 'lg:hidden' : ''}`}>{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-white/15 p-3">
          <div className={`flex items-center gap-3 mb-2 ${collapsed ? 'lg:justify-center' : 'px-1'}`}>
            <div className="w-9 h-9 bg-white/25 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-sm">
                {user?.name?.charAt(0)?.toUpperCase()}
              </span>
            </div>
            <div className={`flex-1 min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-white/60 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title={collapsed ? 'Keluar' : undefined}
            className={`flex items-center gap-2 w-full text-sm text-white/85
              hover:bg-white/15 rounded-lg transition-colors
              ${collapsed ? 'lg:justify-center lg:px-0 lg:py-2.5' : 'px-4 py-2'}`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className={collapsed ? 'lg:hidden' : ''}>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 lg:px-6 sticky top-0 z-30">
          {/* Mobile menu */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 hover:bg-gray-100 rounded-lg text-gray-600"
            aria-label="Buka menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Desktop collapse toggle */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:flex p-2 -ml-2 hover:bg-gray-100 rounded-lg text-gray-500"
            aria-label={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
            title={collapsed ? 'Buka sidebar' : 'Ringkas sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>

          {/* Page title */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
              <PageIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-400 leading-none mb-0.5 hidden sm:block">VIPOS</p>
              <h2 className="text-sm sm:text-base font-semibold text-gray-900 truncate leading-none">
                {pageTitle}
              </h2>
            </div>
          </div>

          {/* Global search (desktop only) */}
          <div className="hidden md:flex flex-1 max-w-md mx-2">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari produk, transaksi, pelanggan..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm
                  focus:outline-none focus:bg-white focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20
                  placeholder-gray-400 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 md:hidden" />

          {/* Right cluster */}
          <div className="flex items-center gap-2">
            <button
              className="p-2 hover:bg-gray-100 rounded-lg relative text-gray-500"
              aria-label="Notifikasi"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </button>

            <div className="hidden sm:flex items-center gap-2 pl-3 ml-1 border-l border-gray-200">
              <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-xs">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div className="text-right leading-tight">
                <p className="text-sm font-medium text-gray-800">{user?.name}</p>
                <p className="text-[11px] text-gray-400 capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
