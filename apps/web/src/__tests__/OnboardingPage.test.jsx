// VIPOS — OnboardingPage unit tests (PR-3, pra-beta v0.0.1).
//
// Mocks utils/api so we can drive the wizard end-to-end without a real
// backend. Asserts: hydrate templates from GET, preset card click flow
// (-> seed-template -> complete -> redirect), skip flow (-> complete only,
// no seed), error toast on seed failure, stepper highlighting.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Budi Santoso', role: 'admin' } }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args) => toastSuccessMock(...args),
    error: (...args) => toastErrorMock(...args),
  },
}));

vi.mock('../utils/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
    post: (...args) => apiPostMock(...args),
  },
}));

import OnboardingPage from '../pages/OnboardingPage';

const sampleTemplates = [
  {
    id: 'fnb',
    name: 'Food & Beverage',
    tagline: 'Cocok untuk warung makan, kafe, kedai kopi, food court',
    category_count: 4,
    product_count: 8,
    preview_products: [
      { name: 'Nasi Goreng Spesial', price: 18000, category: 'Makanan' },
      { name: 'Mie Ayam Bakso', price: 15000, category: 'Makanan' },
      { name: 'Es Teh Manis', price: 5000, category: 'Minuman' },
    ],
  },
  {
    id: 'retail',
    name: 'Retail / Toko Sembako',
    tagline: 'Cocok untuk toko kelontong',
    category_count: 4,
    product_count: 8,
    preview_products: [
      { name: 'Beras Premium 5kg', price: 75000, category: 'Sembako' },
      { name: 'Minyak Goreng 1 Liter', price: 18000, category: 'Sembako' },
      { name: 'Indomie Goreng', price: 3500, category: 'Snack & Makanan Ringan' },
    ],
  },
  {
    id: 'salon',
    name: 'Salon / Spa / Beauty',
    tagline: 'Cocok untuk salon kecantikan',
    category_count: 4,
    product_count: 8,
    preview_products: [
      { name: 'Facial Basic 60 menit', price: 75000, category: 'Treatment Wajah' },
      { name: 'Cuci + Blow', price: 50000, category: 'Treatment Rambut' },
      { name: 'Pijat Refleksi 60 menit', price: 100000, category: 'Treatment Body' },
    ],
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <OnboardingPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  navigateMock.mockReset();
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
  apiGetMock.mockReset();
  apiPostMock.mockReset();
  apiGetMock.mockResolvedValue({ data: { templates: sampleTemplates } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OnboardingPage — step 1 (welcome / preset cards)', () => {
  it('hydrates the 3 preset cards from GET /tenant/onboarding/templates', async () => {
    renderPage();
    expect(apiGetMock).toHaveBeenCalledWith('/tenant/onboarding/templates');
    expect(await screen.findByTestId('onboarding-template-fnb')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-template-retail')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-template-salon')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-skip')).toBeInTheDocument();
    // Greets the user by first name
    expect(screen.getByText(/Halo Budi/i)).toBeInTheDocument();
  });

  it('renders preview product list inside each preset card', async () => {
    renderPage();
    const fnb = await screen.findByTestId('onboarding-template-fnb');
    expect(fnb.textContent).toMatch(/Nasi Goreng Spesial/);
    expect(fnb.textContent).toMatch(/Mie Ayam Bakso/);
    expect(fnb.textContent).toMatch(/Mulai dengan 8 produk/);
  });

  it('keeps the skip button reachable even when the templates fetch fails', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('500'));
    renderPage();
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
    // No template cards, but skip button still present.
    await waitFor(() =>
      expect(screen.queryByTestId('onboarding-template-fnb')).not.toBeInTheDocument()
    );
    expect(screen.getByTestId('onboarding-skip')).toBeInTheDocument();
  });
});

describe('OnboardingPage — preset flow', () => {
  it('selecting a preset → confirm → applies seed + completes + redirects', async () => {
    apiPostMock
      .mockResolvedValueOnce({
        data: {
          template: 'fnb',
          categories: { added: 4, skipped: 0 },
          products: { added: 8, skipped: 0 },
        },
      })
      .mockResolvedValueOnce({ data: { id: 1 } });

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('onboarding-template-fnb'));
    expect(screen.getByTestId('onboarding-step-confirm')).toBeInTheDocument();
    expect(screen.getByText(/Pakai preset Food & Beverage/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('onboarding-confirm'));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenNthCalledWith(1, '/tenant/onboarding/seed-template', {
        template: 'fnb',
      })
    );
    await waitFor(() =>
      expect(apiPostMock).toHaveBeenNthCalledWith(2, '/tenant/onboarding/complete', {})
    );

    expect(await screen.findByTestId('onboarding-step-done')).toBeInTheDocument();
    expect(screen.getByText(/4 kategori dan 8 produk contoh/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('onboarding-finish'));
    expect(navigateMock).toHaveBeenCalledWith('/dashboard');
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it('toasts an error when seed-template fails and stays on confirm step', async () => {
    apiPostMock.mockRejectedValueOnce({
      response: { status: 500, data: { error: 'storage error' } },
    });

    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByTestId('onboarding-template-retail'));
    fireEvent.click(screen.getByTestId('onboarding-confirm'));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    expect(screen.getByTestId('onboarding-step-confirm')).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});

describe('OnboardingPage — skip flow', () => {
  it('skip → confirm → only calls /onboarding/complete (no seed) → redirects', async () => {
    apiPostMock.mockResolvedValueOnce({ data: { id: 1 } });

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('onboarding-skip'));
    expect(screen.getByTestId('onboarding-step-confirm')).toBeInTheDocument();
    expect(screen.getByText(/Mulai dengan akun kosong/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('onboarding-confirm'));

    await waitFor(() => expect(apiPostMock).toHaveBeenCalledTimes(1));
    expect(apiPostMock).toHaveBeenCalledWith('/tenant/onboarding/complete', {});

    expect(await screen.findByTestId('onboarding-step-done')).toBeInTheDocument();
    expect(screen.getByText(/sudah aktif/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('onboarding-finish'));
    expect(navigateMock).toHaveBeenCalledWith('/dashboard');
  });

  it('back button on confirm returns to step 1 (no API call)', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByTestId('onboarding-template-salon'));
    expect(screen.getByTestId('onboarding-step-confirm')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('onboarding-back'));
    expect(screen.getByTestId('onboarding-step-welcome')).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();
  });
});

describe('OnboardingPage — stepper', () => {
  it('highlights step 1 initially, advances to 2 on preset pick, 3 on confirm', async () => {
    apiPostMock
      .mockResolvedValueOnce({
        data: {
          template: 'fnb',
          categories: { added: 4, skipped: 0 },
          products: { added: 8, skipped: 0 },
        },
      })
      .mockResolvedValueOnce({ data: {} });

    const user = userEvent.setup();
    renderPage();

    const pill1 = await screen.findByTestId('onboarding-step-pill-1');
    expect(pill1.className).toMatch(/bg-primary-600/);

    await user.click(screen.getByTestId('onboarding-template-fnb'));
    const pill2 = screen.getByTestId('onboarding-step-pill-2');
    expect(pill2.className).toMatch(/bg-primary-600/);

    fireEvent.click(screen.getByTestId('onboarding-confirm'));
    const pill3 = await screen.findByTestId('onboarding-step-pill-3');
    expect(pill3.className).toMatch(/bg-primary-600/);
  });
});
