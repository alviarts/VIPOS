import { createElement, isValidElement } from 'react';

/**
 * Empty state with Majoo-style SVG illustration (clipboard + magnifying glass, teal).
 * Used on empty list pages.
 *
 * The `icon` prop accepts either:
 *   - a React component reference (e.g. a lucide-react icon `HelpCircle`,
 *     which is internally a `forwardRef` object), or
 *   - a pre-rendered JSX element (e.g. `<TrendingUp className="w-5 h-5" />`).
 *
 * Rendering a `forwardRef` object directly as a JSX child is a runtime error
 * ("Objects are not valid as a React child (found: object with keys
 * {$$typeof, render, displayName})"), so we normalize both forms here.
 */
export default function EmptyState({
  title = 'Data tidak tersedia',
  description = 'Belum ada data yang dapat ditampilkan di halaman ini',
  icon,
  action,
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="mb-4">{renderIcon(icon)}</div>
      <h3 className="text-base font-semibold text-gray-700 mb-1">{title}</h3>
      <p className="text-sm text-gray-400 max-w-sm">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function renderIcon(icon) {
  if (icon == null) return <DefaultIllustration />;
  if (isValidElement(icon)) return icon;
  if (typeof icon === 'function' || typeof icon === 'object') {
    return createElement(icon, { className: 'w-12 h-12 text-gray-400' });
  }
  return <DefaultIllustration />;
}

function DefaultIllustration() {
  return (
    <svg
      width="160"
      height="160"
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Clipboard */}
      <rect
        x="34"
        y="32"
        width="84"
        height="100"
        rx="8"
        fill="#ECFDF5"
        stroke="#04C99E"
        strokeWidth="2"
      />
      <rect
        x="58"
        y="22"
        width="36"
        height="20"
        rx="4"
        fill="#FFFFFF"
        stroke="#04C99E"
        strokeWidth="2"
      />
      <rect x="68" y="28" width="16" height="8" rx="2" fill="#04C99E" />

      {/* Lines (representing data) */}
      <rect x="46" y="58" width="44" height="6" rx="3" fill="#A7F3D0" />
      <rect x="46" y="72" width="60" height="6" rx="3" fill="#D1FAE5" />
      <rect x="46" y="86" width="36" height="6" rx="3" fill="#D1FAE5" />

      {/* Magnifying glass */}
      <circle cx="100" cy="108" r="20" fill="#FFFFFF" stroke="#04C99E" strokeWidth="2.5" />
      <circle cx="100" cy="108" r="12" fill="#ECFDF5" />
      <line
        x1="115"
        y1="123"
        x2="130"
        y2="138"
        stroke="#04C99E"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
