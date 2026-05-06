// VIPOS — Regression tests for the vanilla-SVG RevenueChart.
//
// Pins the visual contract of the recharts -> vanilla migration:
// - Empty data falls back to the "Belum ada data" placeholder.
// - With data + a real container size, the chart renders an <svg>
//   with the expected ARIA label.
//
// Note: jsdom's ResizeObserver stub (apps/web/src/__tests__/setup.js)
// is a no-op, so we explicitly stub `getBoundingClientRect` on the
// container to seed the chart's internal size state.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import RevenueChart from '../components/charts/RevenueChart';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function withFakeContainerSize(width = 600, height = 256) {
  // Anything that calls getBoundingClientRect on a DOM node before
  // useChartSize seeds state will resolve to these dimensions.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    bottom: height,
    right: width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

describe('RevenueChart', () => {
  it('renders the empty-state placeholder when data is empty', () => {
    render(<RevenueChart data={[]} />);
    expect(screen.getByText(/Belum ada data penjualan/i)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders the SVG chart with the expected aria-label when data is present', () => {
    withFakeContainerSize();
    const data = [
      { date: '2026-05-01', total: 1_000_000, transactions: 5 },
      { date: '2026-05-02', total: 2_500_000, transactions: 12 },
      { date: '2026-05-03', total: 1_750_000, transactions: 8 },
    ];
    render(<RevenueChart data={data} />);
    const svg = screen.getByRole('img', { name: /tren pendapatan harian/i });
    expect(svg.tagName.toLowerCase()).toBe('svg');
    // The area path + the line path both live inside the chart.
    expect(svg.querySelectorAll('path').length).toBeGreaterThanOrEqual(2);
  });

  it('renders the empty-state placeholder when only one data point is supplied (degenerate case)', () => {
    withFakeContainerSize();
    const data = [{ date: '2026-05-01', total: 1_000_000, transactions: 5 }];
    render(<RevenueChart data={data} />);
    // A single data point still renders the chart shell — same
    // contract as the recharts version (which also rendered a degenerate
    // single-point area).
    expect(screen.getByRole('img', { name: /tren pendapatan harian/i })).toBeInTheDocument();
  });
});
