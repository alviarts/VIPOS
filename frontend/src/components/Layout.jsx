import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, ShoppingCart, Package, Receipt, BarChart3,
  Settings, LogOut, Menu, X, Store, ChevronDown, Bell, Users,
  Warehouse
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Kasir', path: '/cashier', icon: ShoppingCart },
  { name: 'Produk', path: '/products', icon: Package },
  { name: 'Inventori', path: '/products', icon: Warehouse, disabled: true },
  { name: 'Transaksi', path: '/transactions', icon: Receipt },
  { name: 'Laporan', path: '/reports', icon: BarChart3 },
  { name: 'Pelanggan', path: '/settings', icon: Users, disabled: true },
  { name: 'Pengaturan', path: '/settings', icon: Settings },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Majoo style teal */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-[#04C99E] to-[#03A882]
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col shadow-xl
      `}>
        {/* Logo & Outlet */}
        <div className="px-4 py-4 border-b border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-wide">VIPOS</h1>
                <p className="text-xs text-white/70">Point of Sale</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1">
              <X className="w-5 h-5 text-white/80" />
            </button>
          </div>
          {/* Outlet selector */}
          <div className="mt-3 flex items-center gap-2 bg-white/15 rounded-lg px-3 py-2 cursor-pointer hover:bg-white/20 transition-colors">
            <Store className="w-4 h-4 text-white/80" />
            <span className="text-sm text-white flex-1 truncate">Outlet Utama</span>
            <ChevronDown className="w-4 h-4 text-white/60" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navigation.filter(item => !item.disabled).map((item) => (
            <NavLink
              key={item.path + item.name}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all
                ${isActive 
                  ? 'bg-white/25 text-white font-semibold shadow-sm' 
                  : 'text-white/85 hover:bg-white/15 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1">{item.name}</span>
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-white/20 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-white/25 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {user?.name?.charAt(0)?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-white/60 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-white/80 hover:bg-white/15 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar - Majoo style */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 lg:px-6 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 hover:bg-gray-100 rounded-lg"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          
          {/* Top tabs - Majoo style */}
          <div className="hidden md:flex items-center gap-1">
            <NavLink to="/dashboard" className={({ isActive }) =>
              `px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${isActive ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`
            }>Penjualan</NavLink>
            <NavLink to="/cashier" className={({ isActive }) =>
              `px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${isActive ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`
            }>Kasir</NavLink>
            <NavLink to="/products" className={({ isActive }) =>
              `px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${isActive ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`
            }>Produk</NavLink>
            <NavLink to="/settings" className={({ isActive }) =>
              `px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${isActive ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`
            }>Pengaturan</NavLink>
          </div>

          <div className="flex-1" />
          
          {/* Notifications & user */}
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-gray-100 rounded-lg relative">
              <Bell className="w-5 h-5 text-gray-500" />
            </button>
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-gray-200">
              <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-xs">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700">{user?.name}</p>
                <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
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
