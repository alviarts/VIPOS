// VIPOS — Collapsible role/tier-aware sidebar.
//
// Two display modes:
//   - expanded (default, w-64) → group label + per-item label visible
//   - collapsed (w-16, "icon-only" rail) → group icon only, items shown in a
//     popover when user clicks a group icon
//
// Mobile (< 768px): sidebar disappears off-screen and surfaces as a drawer
// triggered by the `Header` hamburger button (controlled via `mobileOpen`).
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  Store,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../context/PermissionContext';
import { filterMenuGroups, MENU_GROUPS } from '../../data/menu-groups';

function isGroupActive(group, pathname) {
  return group.items.some((item) => item.path && pathname.startsWith(item.path));
}

export default function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }) {
  const { user } = useAuth();
  const { canAccess, role, tier } = usePermission();
  const location = useLocation();

  const groups = filterMenuGroups(MENU_GROUPS, canAccess);

  const initialExpanded = {};
  groups.forEach((g) => {
    initialExpanded[g.id] = isGroupActive(g, location.pathname);
  });
  const [expandedGroups, setExpandedGroups] = useState(initialExpanded);

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        data-testid="vipos-sidebar"
        data-collapsed={collapsed ? 'true' : 'false'}
        className={`
          fixed md:static inset-y-0 left-0 z-50 flex flex-col
          bg-gradient-to-b from-[#04C99E] to-[#03A882] text-white shadow-xl
          transform transition-all duration-300 ease-in-out
          ${collapsed ? 'md:w-16' : 'md:w-64'}
          ${mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 w-64'}
        `}
      >
        {/* Brand + collapse toggle */}
        <div className="flex items-center justify-between border-b border-white/20 px-3 py-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/20">
              <Store className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="text-base font-bold tracking-wide">VIPOS</h1>
                <p className="text-[11px] text-white/70">Owner Dashboard</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded p-1 text-white/80 hover:bg-white/15 md:hidden"
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="hidden rounded p-1 text-white/80 hover:bg-white/15 md:inline-flex"
            aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Groups list */}
        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Menu utama">
          {groups.map((group) => {
            const Icon = group.icon;
            const open = !collapsed && expandedGroups[group.id];
            const active = isGroupActive(group, location.pathname);

            return (
              <div key={group.id} className="mb-1">
                <button
                  type="button"
                  onClick={() => (collapsed ? onToggleCollapsed?.() : toggleGroup(group.id))}
                  data-testid={`group-${group.id}`}
                  aria-expanded={open}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors
                    ${active ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'}`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate text-xs uppercase tracking-wider opacity-90">
                        {group.label}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
                      />
                    </>
                  )}
                </button>

                {open && (
                  <ul className="mt-0.5 ml-2 space-y-0.5 border-l border-white/10 pl-2">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const content = (
                        <>
                          <ItemIcon className="h-4 w-4 flex-shrink-0" />
                          <span className="flex-1 truncate">{item.label}</span>
                        </>
                      );
                      if (item.disabled || !item.path) {
                        return (
                          <li key={item.label}>
                            <span className="flex cursor-not-allowed items-center gap-2 rounded px-3 py-1.5 text-sm text-white/40">
                              {content}
                            </span>
                          </li>
                        );
                      }
                      return (
                        <li key={item.path}>
                          <NavLink
                            to={item.path}
                            onClick={onCloseMobile}
                            className={({ isActive }) =>
                              `flex items-center gap-2 rounded px-3 py-1.5 text-sm transition-colors
                              ${isActive ? 'bg-white/25 font-medium' : 'text-white/85 hover:bg-white/15'}`
                            }
                          >
                            {content}
                          </NavLink>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer — user + role/tier badge */}
        <div className="border-t border-white/20 p-3 text-xs">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
                  {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user?.name ?? 'User'}</p>
                  <p className="truncate text-[11px] uppercase opacity-70">
                    {role} · {tier.replace('_', ' ')}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="flex w-full items-center justify-center rounded p-1 text-white/80 hover:bg-white/15"
              aria-label="Perluas sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
