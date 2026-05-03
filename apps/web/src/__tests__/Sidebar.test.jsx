import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import { AuthContext } from '../context/AuthContext';
import { PermissionProvider, ROLES, TIERS } from '../context/PermissionContext';

// AuthContext doesn't export the raw context, but useAuth wraps useContext(AuthContext).
// We expose the context through the module re-importing pattern.
vi.mock('../context/AuthContext', async () => {
  const actual = await vi.importActual('../context/AuthContext');
  return actual;
});

function renderSidebar({ role = ROLES.OWNER, tier = TIERS.PRIME, ...props } = {}) {
  const fakeUser = { name: 'Tes Pengguna', role, subscription: { tier } };
  const auth = {
    user: fakeUser,
    token: 'tok',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  };
  // Use the bare useAuth -> useContext path by injecting our own context value
  // via a thin wrapper. We rely on the AuthProvider re-exporting AuthContext.
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AuthShim value={auth}>
        <PermissionProvider mockTier={tier}>
          <Sidebar collapsed={false} mobileOpen={false} {...props} />
        </PermissionProvider>
      </AuthShim>
    </MemoryRouter>
  );
}

// Shim: build a tiny provider that mirrors AuthProvider's useContext contract.
import { createContext, useContext } from 'react';
const TestAuthCtx = createContext(null);
function AuthShim({ value, children }) {
  return <TestAuthCtx.Provider value={value}>{children}</TestAuthCtx.Provider>;
}

// Override the real `useAuth` to read from our shim. We do this once per file
// — Vitest module mock above keeps the real PermissionContext module intact.
vi.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => useContext(TestAuthCtx),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders 13 menu groups for OWNER on PRIME tier', () => {
    renderSidebar({ role: ROLES.OWNER, tier: TIERS.PRIME });
    // Each group renders a button with data-testid="group-{id}".
    const groupButtons = document.querySelectorAll('[data-testid^="group-"]');
    expect(groupButtons.length).toBe(13);
  });

  it('hides finance group entirely for KASIR role', () => {
    renderSidebar({ role: ROLES.KASIR, tier: TIERS.PRIME });
    expect(document.querySelector('[data-testid="group-keuangan"]')).toBeNull();
  });

  it('hides Capital + Appointment groups on LITE tier', () => {
    renderSidebar({ role: ROLES.OWNER, tier: TIERS.LITE });
    expect(document.querySelector('[data-testid="group-capital"]')).toBeNull();
    expect(document.querySelector('[data-testid="group-appointment"]')).toBeNull();
  });

  it('expands a group on click and reveals its items', async () => {
    const user = userEvent.setup();
    renderSidebar({ role: ROLES.OWNER, tier: TIERS.PRIME });

    const groupBtn = screen.getByTestId('group-keuangan');
    expect(groupBtn).toHaveAttribute('aria-expanded', 'false');

    await user.click(groupBtn);
    expect(groupBtn).toHaveAttribute('aria-expanded', 'true');

    const groupContainer = groupBtn.parentElement;
    expect(within(groupContainer).getByText('Kas & Bank')).toBeInTheDocument();
  });

  it('renders collapsed mode without expanding any group', () => {
    renderSidebar({ role: ROLES.OWNER, tier: TIERS.PRIME, collapsed: true });
    const sidebar = screen.getByTestId('vipos-sidebar');
    expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    // No item label "Kas & Bank" should be visible (groups are collapsed).
    expect(screen.queryByText('Kas & Bank')).toBeNull();
  });
});
