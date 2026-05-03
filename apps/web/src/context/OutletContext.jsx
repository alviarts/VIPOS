// VIPOS — Outlet context
//
// Holds the active outlet + the list of outlets accessible to the current
// user. Spec (P1-01) only requires mock 2 outlets so we hardcode them here
// — backend integration via `/api/outlets` lands in a later phase.
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const OutletContext = createContext(null);

const MOCK_OUTLETS = [
  { id: 'outlet-pusat', name: 'Outlet Pusat', address: 'Jakarta Selatan' },
  { id: 'outlet-cabang-1', name: 'Outlet Cabang 1', address: 'Bandung' },
];

const STORAGE_KEY = 'vipos_active_outlet_id';

function loadInitialOutlet(outlets) {
  try {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      const found = outlets.find((o) => o.id === stored);
      if (found) return found;
    }
  } catch {
    /* localStorage unavailable */
  }
  return outlets[0];
}

export function OutletProvider({ children, outlets = MOCK_OUTLETS }) {
  const [activeOutlet, setActiveOutlet] = useState(() => loadInitialOutlet(outlets));

  const switchOutlet = useCallback((outletId) => {
    const next = outlets.find((o) => o.id === outletId);
    if (!next) return;
    setActiveOutlet(next);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, next.id);
      }
    } catch {
      /* localStorage unavailable */
    }
  }, [outlets]);

  const value = useMemo(
    () => ({ outlets, activeOutlet, switchOutlet }),
    [outlets, activeOutlet, switchOutlet],
  );

  return <OutletContext.Provider value={value}>{children}</OutletContext.Provider>;
}

export function useOutlet() {
  const ctx = useContext(OutletContext);
  if (!ctx) {
    throw new Error('useOutlet must be used inside OutletProvider');
  }
  return ctx;
}

export { MOCK_OUTLETS };
