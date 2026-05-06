// VIPOS — `<ProtectedRoute>` auth-guard contract.
//
// `ProtectedRoute` is the single component every authenticated route
// in `App.jsx` is wrapped in. Its job is small but security-critical:
//
//   - While auth state is still loading       → render `<Spinner />`
//   - Once loading=false and user is present  → render children
//   - Once loading=false and user is null     → redirect to `/login`
//
// A regression here would either (a) leak protected pages to unauth
// users, or (b) bounce authenticated users to /login on every refresh.
// Both are P0-class bugs, so this test pins the behaviour explicitly.
//
// Strategy:
//   1. Mock `../context/AuthContext` so we can drive the three states
//      independently without standing up `<AuthProvider>` + an actual
//      `/auth/me` API mock.
//   2. Render `<ProtectedRoute>{guarded}</ProtectedRoute>` inside a
//      `MemoryRouter` with a `/login` sentinel route, then assert the
//      visible DOM matches the expected branch.
//
// Because `App.jsx` lazy-imports nearly every page module at the top,
// importing `ProtectedRoute` directly from `App.jsx` would pull all
// those `import()` factories into the test graph. Mocking
// `react-router-dom`'s `Navigate` to render a sentinel is enough to
// avoid that without rendering all the lazy children.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const useAuthMock = vi.fn();

vi.mock('./context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

import { ProtectedRoute } from '../App';

function renderGuarded({ initialPath = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div data-testid="guarded-content">SECRET</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div data-testid="login-page">LOGIN</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('<ProtectedRoute>', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the spinner while auth state is still loading', () => {
    useAuthMock.mockReturnValue({ user: null, loading: true });
    const { container } = renderGuarded();

    // Spinner is the bordered <div class="animate-spin ..."> wrapped in
    // a flex container. We assert on the spinner's class fingerprint so
    // a refactor that drops the spinner is caught.
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();

    // Neither branch should leak yet.
    expect(screen.queryByTestId('guarded-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('redirects to /login when auth resolved with no user', () => {
    useAuthMock.mockReturnValue({ user: null, loading: false });
    renderGuarded();

    // <Navigate to="/login" /> performs a router redirect; the
    // `/login` route's element should be rendered, the guarded
    // children should not.
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('guarded-content')).not.toBeInTheDocument();
  });

  it('renders the guarded children when auth resolved with a user', () => {
    useAuthMock.mockReturnValue({
      user: { id: 1, name: 'Cashier', role: 'cashier' },
      loading: false,
    });
    renderGuarded();

    expect(screen.getByTestId('guarded-content')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('does not redirect during the loading-then-authenticated transition', () => {
    // Realistic refresh-while-logged-in flow:
    // (1) initial render: loading=true → spinner
    // (2) AuthProvider resolves: loading=false, user=present → children
    // The second render must NOT briefly show the /login redirect.
    useAuthMock.mockReturnValue({ user: null, loading: true });
    const { rerender, container } = renderGuarded();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();

    useAuthMock.mockReturnValue({
      user: { id: 1, name: 'Owner', role: 'owner' },
      loading: false,
    });
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div data-testid="guarded-content">SECRET</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div data-testid="login-page">LOGIN</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('guarded-content')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });
});
