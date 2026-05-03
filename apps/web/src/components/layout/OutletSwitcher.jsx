// VIPOS — Outlet switcher dropdown.
//
// Header-mounted dropdown that lets the active user switch between outlets
// they belong to. Currently mocked to 2 outlets via `OutletContext`.
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Store } from 'lucide-react';
import { useOutlet } from '../../context/OutletContext';

export default function OutletSwitcher() {
  const { outlets, activeOutlet, switchOutlet } = useOutlet();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!activeOutlet) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="outlet-switcher-button"
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:border-primary-500"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Store className="h-4 w-4 text-primary-500" />
        <span className="max-w-[140px] truncate">{activeOutlet.name}</span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          data-testid="outlet-switcher-list"
          className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-lg border border-gray-100 bg-white py-1 shadow-lg"
        >
          {outlets.map((outlet) => {
            const isActive = outlet.id === activeOutlet.id;
            return (
              <li key={outlet.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    switchOutlet(outlet.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-primary-50
                    ${isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-700'}`}
                >
                  <Store className="h-4 w-4 flex-shrink-0 text-primary-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{outlet.name}</p>
                    {outlet.address && (
                      <p className="truncate text-xs text-gray-500">{outlet.address}</p>
                    )}
                  </div>
                  {isActive && <Check className="h-4 w-4 text-primary-600" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
