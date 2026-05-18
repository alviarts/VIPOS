// VIPOS — `CustomersPage` -> `CustomerImportDialog` lazy-load contract.
//
// PR #139 wrapped `CustomerImportDialog` (298-line bulk-import dialog)
// in `React.lazy()` because it's a rare admin-only surface that
// shouldn't ship in the initial CustomersPage bundle. The dialog mounts
// only when `{showImport && <Suspense ...><CustomerImportDialog ... />}`
// flips on (the 'Impor' button in the page header).
//
// This test pins the lazy-load contract end-to-end:
//   1. CustomersPage mounts; the import dialog is *not* in the DOM
//      (lazy chunk hasn't been requested yet).
//   2. Clicking the 'Impor' button triggers the dynamic `import(...)`
//      and resolves it through the test's real (unmocked) module
//      graph.
//   3. The dialog header 'Impor Pelanggan dari CSV' shows up after
//      the chunk resolves.
//   4. Clicking the dialog's close (X) button removes it from the DOM.
//
// We deliberately do *not* mock `CustomerImportDialog` — the whole
// point of the test is to verify the `React.lazy()` boundary actually
// resolves the real module. We do mock `../utils/api` (so no network),
// `../context/AuthContext` (admin role gates the 'Impor' button), and
// `react-hot-toast` (toast.error fires on the master-data 404 paths
// otherwise; no DOM impact, but trims noise).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const apiGetMock = vi.fn();

vi.mock('../utils/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  getAccessToken: () => 'test-token',
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Admin', role: 'admin' },
  }),
}));

vi.mock('react-hot-toast', () => {
  const fn = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  });
  return { __esModule: true, default: fn, toast: fn };
});

import CustomersPage from '../pages/CustomersPage';

describe('CustomersPage -> CustomerImportDialog lazy boundary', () => {
  beforeEach(() => {
    apiGetMock.mockImplementation((url) => {
      if (url.startsWith('/customers?')) return Promise.resolve({ data: [] });
      if (url === '/customer-groups') return Promise.resolve({ data: [] });
      if (url === '/customer-tags') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
  });

  afterEach(() => {
    apiGetMock.mockReset();
  });

  it('mounts the lazy CustomerImportDialog on Impor click and unmounts on close', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CustomersPage />
      </MemoryRouter>
    );

    // Wait for the page header so we know the page rendered (master-
    // data fetches resolved).
    await waitFor(() => expect(screen.getByText('Daftar Pelanggan')).toBeInTheDocument());

    // Precondition: dialog is NOT in the DOM yet — the lazy chunk
    // hasn't been requested because `showImport` is still false.
    expect(screen.queryByText('Impor Pelanggan dari CSV')).not.toBeInTheDocument();

    // Trigger the lazy boundary by clicking the 'Impor' button.
    await user.click(screen.getByRole('button', { name: /^Impor$/i }));

    // The dynamic import resolves, Suspense boundary swaps from its
    // `fallback={null}` to the real dialog. The dialog renders a
    // full-screen white panel with the heading 'Impor Pelanggan dari
    // CSV' as the H2.
    const dialogHeading = await screen.findByRole('heading', {
      level: 2,
      name: 'Impor Pelanggan dari CSV',
    });
    expect(dialogHeading).toBeInTheDocument();

    // The dialog body shows the upload prompt (smoke-check that the
    // real module mounted, not just a placeholder).
    expect(screen.getByText('Pilih file CSV...')).toBeInTheDocument();

    // Click the close (X) button — it's the first button inside the
    // dialog header. We locate it by traversing from the heading; this
    // avoids coupling to lucide-react's icon `aria-hidden` markup.
    const headerBar = dialogHeading.closest('div')?.parentElement;
    expect(headerBar).not.toBeNull();
    const closeButton = headerBar?.querySelector('button');
    expect(closeButton).not.toBeNull();
    await user.click(closeButton);

    // After close, the dialog content is gone again.
    await waitFor(() =>
      expect(screen.queryByText('Impor Pelanggan dari CSV')).not.toBeInTheDocument()
    );
  });
});
