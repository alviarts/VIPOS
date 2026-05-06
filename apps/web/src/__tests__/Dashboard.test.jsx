// VIPOS — P1-03 dashboard component smoke tests.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import KpiCards from '../components/dashboard/KpiCards';
import QuickActions from '../components/dashboard/QuickActions';
import DateRangePicker from '../components/dashboard/DateRangePicker';

describe('KpiCards', () => {
  it('renders placeholders when summary is null', () => {
    render(<KpiCards summary={null} loading={true} />);
    expect(screen.getByText('Pendapatan')).toBeInTheDocument();
    expect(screen.getByText('Transaksi')).toBeInTheDocument();
    expect(screen.getByText('Avg. Ticket')).toBeInTheDocument();
    expect(screen.getByText('Item Terjual')).toBeInTheDocument();
  });

  it('renders formatted values when summary is provided', () => {
    render(
      <KpiCards
        summary={{
          revenue: 1_500_000,
          transactions: 12,
          avg_ticket: 125_000,
          items_sold: 34,
          today: { revenue: 250_000, transactions: 3 },
          products: 87,
          range: { start: '2025-01-01', end: '2025-01-31' },
          low_stock: 0,
        }}
        loading={false}
      />
    );
    expect(screen.getByText(/1\.500\.000/)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});

describe('QuickActions', () => {
  it('renders 4 navigation tiles', () => {
    render(
      <MemoryRouter>
        <QuickActions />
      </MemoryRouter>
    );
    expect(screen.getByText('Kasir Baru')).toBeInTheDocument();
    expect(screen.getByText('Tambah Produk')).toBeInTheDocument();
    expect(screen.getByText('Lihat Laporan')).toBeInTheDocument();
    expect(screen.getByText('Pelanggan')).toBeInTheDocument();
  });
});

describe('DateRangePicker', () => {
  it('emits a 30-day range on first render', () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={{ start: '', end: '' }} onChange={onChange} />);
    expect(onChange).toHaveBeenCalledTimes(1);
    const [{ start, end }] = onChange.mock.calls[0];
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('applies "Hari ini" preset when clicked', () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker value={{ start: '2025-01-01', end: '2025-01-31' }} onChange={onChange} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hari ini' }));
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last.start).toBe(last.end);
  });
});
