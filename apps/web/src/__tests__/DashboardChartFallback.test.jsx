// VIPOS — DashboardPage `ChartFallback` Suspense regression.
//
// PR #124 split `recharts` out of `DashboardPage` via `React.lazy`. PR #129
// replaced the flat fallback with the `ChartFallback` bar-skeleton (role=
// "status", animate-pulse). PR #126 added a useEffect prefetch so the
// fallback window is short on warm caches. This test pins the cold-cache
// behaviour: while the lazy chart chunks are still in-flight, both chart
// cards render their `ChartFallback` with the correct aria-label and the
// `role="status"` semantics for screen readers.
//
// Strategy: the chart modules are mocked with never-resolving promises
// (`new Promise(() => {})`), so the page is held in its suspended state
// while the test inspects the DOM. The matching post-resolution path
// (charts mount, fallbacks tear down) is already covered by
// `DashboardPage.test.jsx`, which mocks the chart modules synchronously.
//
// Independent of the page's prefetch useEffect: even though
// `DashboardPage` kicks `import('../components/charts/...')` at mount,
// the underlying module promises here never resolve, so the prefetch
// does not race the test.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const apiGetMock = vi.fn();

vi.mock('../utils/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
  },
}));

vi.mock('../context/OutletContext', () => ({
  useOutlet: () => ({
    outlets: [{ id: 1, name: 'Outlet Pusat' }],
    activeOutlet: { id: 1, name: 'Outlet Pusat' },
    switchOutlet: vi.fn(),
  }),
}));

// Never-resolving module promises pin the lazy boundaries in their
// pending state for the lifetime of the test.
vi.mock('../components/charts/RevenueChart', () => new Promise(() => {}));
vi.mock('../components/charts/TopProductChart', () => new Promise(() => {}));

import DashboardPage from '../pages/DashboardPage';

const SUMMARY = {
  revenue: 1_500_000,
  transactions: 12,
  avg_ticket: 125_000,
  items_sold: 34,
  today: { revenue: 250_000, transactions: 3 },
  products: 87,
  range: { start: '2026-04-05', end: '2026-05-04' },
  low_stock: 0,
};

describe('DashboardPage chart Suspense fallback', () => {
  beforeEach(() => {
    apiGetMock.mockImplementation((url) => {
      if (url === '/dashboard/summary') return Promise.resolve({ data: SUMMARY });
      if (url === '/dashboard/sales-trend') return Promise.resolve({ data: [] });
      if (url === '/dashboard/top-products') return Promise.resolve({ data: [] });
      if (url === '/dashboard/payment-methods') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: null });
    });
  });

  afterEach(() => {
    apiGetMock.mockReset();
  });

  it('renders both ChartFallback role="status" placeholders while the lazy chart chunks are loading', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    // Wait for the dashboard data fetches to complete and the page to
    // exit `<DashboardSkeleton />`. Once the heading is in the DOM, the
    // two Suspense boundaries are mounted with their fallbacks (chart
    // chunks still pending — we never resolved the mock promises).
    await waitFor(() => expect(screen.getByText('Dashboard Penjualan')).toBeInTheDocument());

    // Sanity: the two non-chart cards (KPI grid summary + 'Metode
    // Pembayaran' list) rendered with real data, so we know the page
    // body — not just the skeleton — is on screen.
    expect(screen.getByText('Tren Pendapatan')).toBeInTheDocument();
    expect(screen.getByText('Top 10 Produk')).toBeInTheDocument();
    expect(screen.getByText('Metode Pembayaran')).toBeInTheDocument();

    // Both ChartFallback role="status" elements are rendered inside the
    // chart cards. The aria-label distinguishes them for assistive tech.
    expect(screen.getByLabelText('Memuat tren pendapatan')).toBeInTheDocument();
    expect(screen.getByLabelText('Memuat top produk')).toBeInTheDocument();

    const statuses = screen.getAllByRole('status');
    // Exactly two — the 'Metode Pembayaran' card is a list, not a
    // chart, so it doesn't get a Suspense fallback. If a future change
    // adds another lazy chart card, update this expectation.
    expect(statuses).toHaveLength(2);

    // The visually hidden "Memuat grafik…" copy is announced by SR.
    statuses.forEach((node) => {
      expect(node.textContent).toContain('Memuat grafik');
    });
  });
});
