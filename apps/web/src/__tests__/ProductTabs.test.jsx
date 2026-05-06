// VIPOS — P1-04 product wizard tab smoke tests.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TabVariant from '../components/products/tabs/TabVariant';
import TabRecipe from '../components/products/tabs/TabRecipe';
import TabMajooOrder from '../components/products/tabs/TabMajooOrder';

describe('TabVariant', () => {
  it('shows empty state when no variants', () => {
    render(<TabVariant variants={[]} onChange={() => {}} />);
    expect(screen.getByText(/Belum ada varian/)).toBeInTheDocument();
  });

  it('appends a row when "Tambah Varian" clicked', () => {
    const onChange = vi.fn();
    render(<TabVariant variants={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Tambah Varian/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].length).toBe(1);
    expect(onChange.mock.calls[0][0][0].group_name).toBe('Ukuran');
  });

  it('renders existing variants', () => {
    render(
      <TabVariant
        variants={[{ group_name: 'Warna', option_label: 'Merah', price_modifier: 0 }]}
        onChange={() => {}}
      />
    );
    expect(screen.getByDisplayValue('Warna')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Merah')).toBeInTheDocument();
  });
});

describe('TabRecipe', () => {
  it('shows empty state when no items', () => {
    render(<TabRecipe items={[]} onChange={() => {}} products={[]} />);
    expect(screen.getByText(/Belum ada bahan baku/)).toBeInTheDocument();
  });

  it('lists ingredient options excluding self', () => {
    const products = [
      { id: 1, name: 'Kopi', is_active: 1, satuan: 'pcs' },
      { id: 2, name: 'Susu', is_active: 1, satuan: 'ml' },
    ];
    const onChange = vi.fn();
    render(
      <TabRecipe
        items={[{ ingredient_id: '', qty: 1, unit: 'ml' }]}
        onChange={onChange}
        products={products}
        productId={1}
      />
    );
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Kopi/ })).toBeNull();
    expect(screen.getByRole('option', { name: /Susu/ })).toBeInTheDocument();
  });
});

describe('TabMajooOrder', () => {
  it('renders the markup hint when price_online > base price', () => {
    render(
      <TabMajooOrder
        form={{ price_online: 12000, is_online_active: true }}
        onChange={() => {}}
        basePrice="10000"
      />
    );
    expect(screen.getByText(/Markup \+20%/)).toBeInTheDocument();
  });

  it('toggles is_online_active', () => {
    const onChange = vi.fn();
    render(
      <TabMajooOrder
        form={{ price_online: '', is_online_active: false }}
        onChange={onChange}
        basePrice={1000}
      />
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith({ is_online_active: true });
  });
});
