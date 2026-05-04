// VIPOS — Layout shell.
//
// Composes Sidebar + Header + page outlet for all authenticated routes.
// Stateful: sidebar collapsed (desktop) + sidebar drawer open (mobile).
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ErrorBoundary from '../ErrorBoundary';

const COLLAPSED_KEY = 'vipos_sidebar_collapsed';

function readInitialCollapsed() {
  try {
    return typeof window !== 'undefined'
      ? window.localStorage.getItem(COLLAPSED_KEY) === '1'
      : false;
  } catch {
    return false;
  }
}

export default function AppShell({ notificationCount = 3 }) {
  const [collapsed, setCollapsed] = useState(readInitialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const handleToggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
        }
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={handleToggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onOpenMobileSidebar={() => setMobileOpen(true)}
          notificationCount={notificationCount}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <ErrorBoundary key={location.pathname} scope="route">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
