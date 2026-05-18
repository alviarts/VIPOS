// VIPOS — Regression tests for the vanilla-SVG TopProductChart.
//
// Pins the visual contract of the recharts -> vanilla migration:
// - Empty data falls back to the "Belum ada produk" placeholder.
// - With data + a real container size, the chart renders an <svg>
//   with the expected ARIA label and one bar per data point.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import TopProductChart from '../components/charts/TopProductChart';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function withFakeContainerSize(width = 600, height = 256) {
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

describe('TopProductChart', () => {
  it('renders the empty-state placeholder when data is empty', () => {
    render(<TopProductChart data={[]} />);
    expect(screen.getByText(/Belum ada produk yang terjual/i)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders one bar per data point with the expected aria-label', () => {
    withFakeContainerSize();
    const data = [
      { product_name: 'Es Teh', total_sold: 50, total_revenue: 250_000 },
      { product_name: 'Kopi Susu', total_sold: 80, total_revenue: 720_000 },
      { product_name: 'Roti Bakar', total_sold: 30, total_revenue: 240_000 },
    ];
    render(<TopProductChart data={data} />);
    const svg = screen.getByRole('img', { name: /top produk berdasarkan unit terjual/i });
    expect(svg.tagName.toLowerCase()).toBe('svg');
    // Each bar is rendered as a <path> (right-rounded rect path).
    // 3 bars expected.
    expect(svg.querySelectorAll('path').length).toBe(data.length);
    // Each product name is rendered as a <text> tick label inside
    // the chart group.
    expect(svg.textContent).toContain('Es Teh');
    expect(svg.textContent).toContain('Kopi Susu');
    expect(svg.textContent).toContain('Roti Bakar');
  });

  it('truncates very long product names with an ellipsis tick label', () => {
    withFakeContainerSize();
    const data = [
      {
        product_name: 'Nasi Goreng Spesial Tambah Telur Mata Sapi',
        total_sold: 10,
        total_revenue: 250_000,
      },
    ];
    render(<TopProductChart data={data} />);
    const svg = screen.getByRole('img', { name: /top produk berdasarkan unit terjual/i });
    // Truncation kicks in at 18 chars; the rendered label ends
    // with U+2026 HORIZONTAL ELLIPSIS.
    expect(svg.textContent).toMatch(/\u2026/);
  });
});
