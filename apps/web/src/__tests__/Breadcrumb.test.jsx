import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Breadcrumb from '../components/layout/Breadcrumb';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Breadcrumb />
    </MemoryRouter>
  );
}

describe('Breadcrumb', () => {
  it('renders Dashboard for /dashboard', () => {
    renderAt('/dashboard');
    const nav = screen.getByTestId('breadcrumb');
    expect(nav).toHaveTextContent('Dashboard');
  });

  it('renders 2-level path for /finance/reports', () => {
    renderAt('/finance/reports');
    const nav = screen.getByTestId('breadcrumb');
    expect(nav).toHaveTextContent('Keuangan');
    expect(nav).toHaveTextContent('Laporan Keuangan');
  });

  it('marks the last crumb as aria-current=page', () => {
    renderAt('/products');
    const current = screen.getByText('Produk');
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  it('falls back to title-cased segment for unknown slug', () => {
    renderAt('/something-new');
    const nav = screen.getByTestId('breadcrumb');
    expect(nav).toHaveTextContent('Something New');
  });
});
