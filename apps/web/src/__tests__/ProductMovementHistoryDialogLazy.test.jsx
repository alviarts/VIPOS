// VIPOS — `InventoryPage` -> `ProductMovementHistoryDialog` lazy-load
// contract.
//
// PR #140 wrapped `ProductMovementHistoryDialog` in `React.lazy()` —
// most inventory visits don't open the per-product history view, so
// keeping it out of the eager InventoryPage chunk saves bandwidth.
// The dialog mounts only when `{historyProduct && <Suspense ...>}`
// flips on (the History icon button on each movement row).
//
// This test pins the lazy-load contract end-to-end:
//   1. InventoryPage mounts; the history dialog is not in the DOM
//      (lazy chunk hasn't been requested yet).
//   2. Clicking the History icon button on a movement row triggers
//      the dynamic `import(...)` and resolves it through the test's
//      real (unmocked) module graph.
//   3. The dialog header 'Riwayat Stok' shows up after the chunk
//      resolves, and the product name from the row appears in the
//      subtitle.
//   4. Clicking the close (X) button removes the dialog from the DOM.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

import InventoryPage from '../pages/InventoryPage';

const MOVEMENT = {
  id: 1,
  product_id: 42,
  product_name: 'Kopi Susu Gula Aren',
  product_sku: 'KSG-01',
  tipe: 'stok_in',
  qty: 10,
  stok_sebelum: 5,
  stok_sesudah: 15,
  tanggal: '2026-05-01',
  keterangan: 'Restock harian',
  user_name: 'Kasir Pagi',
};

describe('InventoryPage -> ProductMovementHistoryDialog lazy boundary', () => {
  beforeEach(() => {
    apiGetMock.mockImplementation((url) => {
      if (url.startsWith('/inventory/movements?')) {
        return Promise.resolve({ data: [MOVEMENT] });
      }
      if (url.startsWith('/inventory/movements/')) {
        // The lazy dialog itself fetches per-product history once it
        // mounts. Empty list keeps the dialog body in its 'no data'
        // empty-state copy so the test doesn't depend on row schema.
        return Promise.resolve({ data: [] });
      }
      if (url === '/products?active_only=true') {
        return Promise.resolve({
          data: [{ id: 42, name: 'Kopi Susu Gula Aren', active: true }],
        });
      }
      if (url === '/inventory/summary') {
        return Promise.resolve({ data: { total_products: 1 } });
      }
      return Promise.resolve({ data: [] });
    });
  });

  afterEach(() => {
    apiGetMock.mockReset();
  });

  it('mounts the lazy ProductMovementHistoryDialog on History click and unmounts on close', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <InventoryPage />
      </MemoryRouter>
    );

    // Wait for the page header so we know the page rendered (master-
    // data fetches resolved).
    await waitFor(() => expect(screen.getByText('Inventori')).toBeInTheDocument());

    // Sanity: the seeded movement row is on screen.
    expect(screen.getByText('Kopi Susu Gula Aren')).toBeInTheDocument();

    // Precondition: dialog is NOT in the DOM yet — the lazy chunk
    // hasn't been requested because `historyProduct` is still null.
    expect(screen.queryByRole('heading', { name: 'Riwayat Stok' })).not.toBeInTheDocument();

    // Trigger the lazy boundary by clicking the History icon button.
    // It uses `title="Lihat riwayat per produk"` which RTL exposes via
    // accessible name.
    const historyButton = screen.getByRole('button', {
      name: /Lihat riwayat per produk/i,
    });
    await user.click(historyButton);

    // Dynamic import resolves, Suspense swaps from `fallback={null}`
    // to the real dialog. Assert the dialog header is present.
    const dialogHeading = await screen.findByRole('heading', {
      level: 3,
      name: 'Riwayat Stok',
    });
    expect(dialogHeading).toBeInTheDocument();

    // The product subtitle (name + sku) shows below the heading.
    const dialogPanel = dialogHeading.closest('div')?.parentElement;
    expect(dialogPanel).not.toBeNull();
    expect(within(dialogPanel).getByText('Kopi Susu Gula Aren')).toBeInTheDocument();
    expect(within(dialogPanel).getByText(/\(KSG-01\)/)).toBeInTheDocument();

    // Body shows the empty-state copy because the per-product fetch
    // returned `[]`. This also confirms the dialog's own
    // `useEffect(() => { api.get('/inventory/movements/<id>') ... })`
    // ran end-to-end, not just the static shell.
    await waitFor(() =>
      expect(screen.getByText('Belum ada pergerakan stok untuk produk ini.')).toBeInTheDocument()
    );

    // Click the close (X) button — first button inside the dialog
    // header bar, located by traversing from the heading.
    const headerBar = dialogHeading.closest('div')?.parentElement;
    const closeButton = headerBar?.querySelector('button');
    expect(closeButton).not.toBeNull();
    await user.click(closeButton);

    // After close, the dialog content is gone again.
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Riwayat Stok' })).not.toBeInTheDocument()
    );
  });
});
