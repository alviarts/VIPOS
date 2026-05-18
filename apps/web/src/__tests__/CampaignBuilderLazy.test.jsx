// VIPOS — `MarketingPage` -> `CampaignBuilder` lazy-load contract.
//
// PR #140 wrapped `CampaignBuilder` (5-step wizard, ~30 kB pre-gzip)
// in `React.lazy()` because most marketing visits don't open the
// builder — they're checking campaigns / templates / credit balances.
// The wizard mounts only when `{showBuilder && <Suspense ...>}` flips
// on (the 'Buat Campaign' button on the page header, gated by
// admin role + campaigns tab).
//
// This test pins the lazy-load contract end-to-end:
//   1. MarketingPage mounts; the builder is not in the DOM (lazy chunk
//      hasn't been requested yet).
//   2. Clicking 'Buat Campaign' triggers the dynamic `import(...)`
//      and resolves it through the test's real (unmocked) module
//      graph.
//   3. The dialog header 'Buat Campaign Marketing' shows up after the
//      chunk resolves, with the step indicator on step 1 of 5.
//   4. Clicking the close (X) button removes the dialog from the DOM.

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

import MarketingPage from '../pages/penjualan/MarketingPage';

describe('MarketingPage -> CampaignBuilder lazy boundary', () => {
  beforeEach(() => {
    apiGetMock.mockImplementation((url) => {
      if (url.startsWith('/marketing/campaign?')) {
        return Promise.resolve({ data: { items: [] } });
      }
      if (url === '/marketing/template') return Promise.resolve({ data: [] });
      if (url === '/marketing/credit/balance') {
        return Promise.resolve({
          data: { whatsapp: 100000, sms: 50000, email: 25000, instagram: 0 },
        });
      }
      if (url.startsWith('/marketing/credit/ledger')) {
        return Promise.resolve({ data: { items: [] } });
      }
      if (url === '/customer-groups') return Promise.resolve({ data: [] });
      if (url === '/customer-tags') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
  });

  afterEach(() => {
    apiGetMock.mockReset();
  });

  it('mounts the lazy CampaignBuilder on Buat Campaign click and unmounts on close', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <MarketingPage />
      </MemoryRouter>
    );

    // Wait for the page header so we know the page rendered (master-
    // data fetches resolved).
    await waitFor(() => expect(screen.getByText('Marketing')).toBeInTheDocument());

    // Precondition: builder is NOT in the DOM yet — the lazy chunk
    // hasn't been requested because `showBuilder === false`.
    expect(
      screen.queryByRole('heading', { name: 'Buat Campaign Marketing' })
    ).not.toBeInTheDocument();

    // Trigger the lazy boundary by clicking the 'Buat Campaign' header
    // button (gated by admin role + campaigns tab; both default).
    await user.click(screen.getByRole('button', { name: /^Buat Campaign$/i }));

    // Dynamic import resolves, Suspense swaps from `fallback={null}`
    // to the real wizard. Assert the dialog header is present.
    const dialogHeading = await screen.findByRole('heading', {
      level: 3,
      name: 'Buat Campaign Marketing',
    });
    expect(dialogHeading).toBeInTheDocument();

    // The step indicator confirms the wizard initial state ('Step 1
    // dari 5 — Channel'). This also confirms the real module mounted
    // with its STEP_TITLES intact rather than a placeholder shell.
    const stepIndicator = dialogHeading.parentElement?.querySelector('p');
    expect(stepIndicator).not.toBeNull();
    expect(stepIndicator?.textContent).toContain('Step 1 dari 5');
    expect(stepIndicator?.textContent).toContain('Channel');

    // The wizard's first step renders the four channel cards. Verify
    // at least the WhatsApp + Email options are mounted (rendered by
    // real CHANNEL_DEFS), not a static placeholder.
    expect(screen.getByText('WhatsApp Blast')).toBeInTheDocument();
    expect(screen.getByText('Email Blast')).toBeInTheDocument();

    // Click the close (X) button — exposed via `aria-label="Tutup"`
    // by the wizard, so we can target it directly without DOM
    // traversal hacks.
    const closeButton = screen.getByRole('button', { name: 'Tutup' });
    await user.click(closeButton);

    // After close, the dialog is gone again.
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Buat Campaign Marketing' })
      ).not.toBeInTheDocument()
    );
  });
});
