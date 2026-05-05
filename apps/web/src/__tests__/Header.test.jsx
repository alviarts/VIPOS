import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { createContext, useContext } from 'react';
import Header from '../components/layout/Header';
import { PermissionProvider, ROLES, TIERS } from '../context/PermissionContext';

const TestAuthCtx = createContext(null);
function AuthShim({ value, children }) {
  return <TestAuthCtx.Provider value={value}>{children}</TestAuthCtx.Provider>;
}

const mockNavigate = vi.fn();

vi.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => useContext(TestAuthCtx),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Stub OutletSwitcher to avoid pulling in API/network calls during render.
vi.mock('../components/layout/OutletSwitcher', () => ({
  default: () => null,
}));

// Stub Breadcrumb to avoid unrelated dependency surface.
vi.mock('../components/layout/Breadcrumb', () => ({
  default: () => null,
}));

function renderHeader({ logout = vi.fn() } = {}) {
  const auth = {
    user: { name: 'Sri Wahyuni', role: ROLES.OWNER, subscription: { tier: TIERS.PRIME } },
    token: 'tok',
    loading: false,
    login: vi.fn(),
    logout,
  };
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AuthShim value={auth}>
        <PermissionProvider mockTier={TIERS.PRIME}>
          <Header />
        </PermissionProvider>
      </AuthShim>
    </MemoryRouter>
  );
}

describe('Header — logout confirmation (F7)', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('opens konfirmasi dialog when clicking Keluar (does not logout immediately)', async () => {
    const user = userEvent.setup();
    const logout = vi.fn();
    renderHeader({ logout });

    // Open profile dropdown
    await user.click(screen.getByRole('button', { expanded: false }));

    // Click "Keluar" inside dropdown
    await user.click(screen.getByRole('menuitem', { name: /keluar/i }));

    // Konfirmasi dialog visible — no logout yet
    expect(screen.getByText('Keluar dari VIPOS?')).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('cancels logout when clicking Batal', async () => {
    const user = userEvent.setup();
    const logout = vi.fn();
    renderHeader({ logout });

    await user.click(screen.getByRole('button', { expanded: false }));
    await user.click(screen.getByRole('menuitem', { name: /keluar/i }));

    await user.click(screen.getByRole('button', { name: /batal/i }));

    expect(screen.queryByText('Keluar dari VIPOS?')).not.toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('logs out and navigates to /login when confirming Ya, Keluar', async () => {
    const user = userEvent.setup();
    const logout = vi.fn();
    renderHeader({ logout });

    await user.click(screen.getByRole('button', { expanded: false }));
    await user.click(screen.getByRole('menuitem', { name: /keluar/i }));

    await user.click(screen.getByRole('button', { name: /ya, keluar/i }));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
