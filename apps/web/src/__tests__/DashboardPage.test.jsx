// VIPOS — DashboardPage regression tests (PR-9 fix for F1 friction).
//
// Verifies that the dashboard fires its 4 data fetches on mount with a
// sensible default date range, instead of getting stuck in skeleton state
// waiting for the user to interact with DateRangePicker.

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

// recharts uses ResponsiveContainer which needs ResizeObserver in jsdom.
vi.mock('../components/charts/RevenueChart', () => ({
  default: () => <div data-testid="revenue-chart" />,
}));
vi.mock('../components/charts/TopProductChart', () => ({
  default: () => <div data-testid="top-product-chart" />,
}));

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

describe('DashboardPage', () => {
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

  it('fires all 4 dashboard fetches on mount with a default 30-day range', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/dashboard/summary', expect.any(Object));
      expect(apiGetMock).toHaveBeenCalledWith('/dashboard/sales-trend', expect.any(Object));
      expect(apiGetMock).toHaveBeenCalledWith('/dashboard/top-products', expect.any(Object));
      expect(apiGetMock).toHaveBeenCalledWith('/dashboard/payment-methods');
    });

    const summaryCall = apiGetMock.mock.calls.find(([url]) => url === '/dashboard/summary');
    const params = summaryCall[1].params;
    expect(params.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.start <= params.end).toBe(true);
  });

  it('exits skeleton state and renders dashboard heading after data loads', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dashboard Penjualan')).toBeInTheDocument();
    });
  });
});
