// VIPOS — SignupPage unit tests (PR-2, pra-beta v0.0.1).
//
// We swap useAuth + useNavigate via vi.mock so we can assert the payload that
// SignupPage sends to AuthContext.signupTenant and the post-success
// navigation, without touching the real axios client or BrowserRouter.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SignupPage from '../pages/SignupPage';
import { slugify, scorePassword } from '../utils/signup-helpers';

const navigateMock = vi.fn();
const signupMock = vi.fn();
const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ signupTenant: signupMock }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: (...args) => toastErrorMock(...args),
    success: (...args) => toastSuccessMock(...args),
  },
}));

function renderSignup() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <SignupPage />
    </MemoryRouter>
  );
}

async function fillValidForm(user, overrides = {}) {
  const data = {
    business: 'Kopi Tegal',
    name: 'Budi Santoso',
    email: 'budi@kopitegal.id',
    username: 'budi',
    password: 'Sandi123!',
    ...overrides,
  };
  await user.type(screen.getByLabelText(/nama bisnis/i), data.business);
  await user.type(screen.getByLabelText(/nama lengkap/i), data.name);
  if (data.email) {
    await user.type(screen.getByLabelText(/^email/i), data.email);
  }
  await user.type(screen.getByLabelText(/^username$/i), data.username);
  await user.type(screen.getByLabelText(/^password$/i), data.password);
  await user.click(screen.getByRole('checkbox', { name: /syarat/i }));
}

describe('SignupPage helpers', () => {
  it('slugify lowercases, strips diacritics, and collapses non-alnum', () => {
    expect(slugify('Kopi Tegal')).toBe('kopi-tegal');
    expect(slugify('  Bakso Pak  Joko!! ')).toBe('bakso-pak-joko');
    expect(slugify('Café Niño')).toBe('cafe-nino');
    expect(slugify('a')).toBe('a');
    expect(slugify('')).toBe('');
    expect(slugify(null)).toBe('');
  });

  it('slugify caps slug at 40 chars', () => {
    const long = 'a'.repeat(80);
    expect(slugify(long).length).toBe(40);
  });

  it('scorePassword returns Lemah/Cukup/Kuat/Sangat kuat tiers', () => {
    expect(scorePassword('').score).toBe(0);
    expect(scorePassword('abc').label).toBe('Lemah');
    expect(scorePassword('abcdef').label).toBe('Lemah');
    expect(scorePassword('Sandi123').label).toMatch(/Kuat|Sangat kuat/);
    expect(scorePassword('Sandi123!').label).toBe('Sangat kuat');
  });
});

describe('SignupPage flow', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    signupMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  it('renders all required fields + ToS gate + submit button', () => {
    renderSignup();
    expect(screen.getByLabelText(/nama bisnis/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/slug akun/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nama lengkap/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^username$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /syarat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /daftar gratis/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /login di sini/i })).toBeInTheDocument();
  });

  it('auto-derives slug from business name until the user edits the slug field', async () => {
    const user = userEvent.setup();
    renderSignup();
    const business = screen.getByLabelText(/nama bisnis/i);
    const slug = screen.getByLabelText(/slug akun/i);
    await user.type(business, 'Kopi Tegal');
    expect(slug).toHaveValue('kopi-tegal');
    await user.clear(slug);
    await user.type(slug, 'cafe-tegal');
    expect(slug).toHaveValue('cafe-tegal');
    await user.type(business, ' Cabang 1');
    expect(slug).toHaveValue('cafe-tegal');
  });

  it('happy path: posts to signupTenant with correct payload, then navigates to /dashboard', async () => {
    signupMock.mockResolvedValueOnce({
      user: { id: 1, username: 'budi' },
      tenant: { id: 1, slug: 'kopi-tegal' },
    });
    const user = userEvent.setup();
    renderSignup();
    await fillValidForm(user);
    fireEvent.click(screen.getByRole('button', { name: /daftar gratis/i }));

    await waitFor(() => expect(signupMock).toHaveBeenCalledOnce());
    expect(signupMock).toHaveBeenCalledWith({
      tenant_slug: 'kopi-tegal',
      tenant_name: 'Kopi Tegal',
      admin_name: 'Budi Santoso',
      admin_username: 'budi',
      admin_password: 'Sandi123!',
      admin_email: 'budi@kopitegal.id',
    });
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard'));
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it('blocks submit when ToS unchecked', async () => {
    const user = userEvent.setup();
    renderSignup();
    await user.type(screen.getByLabelText(/nama bisnis/i), 'Kopi Tegal');
    await user.type(screen.getByLabelText(/nama lengkap/i), 'Budi');
    await user.type(screen.getByLabelText(/^username$/i), 'budi');
    await user.type(screen.getByLabelText(/^password$/i), 'Sandi123!');
    fireEvent.click(screen.getByRole('button', { name: /daftar gratis/i }));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    expect(signupMock).not.toHaveBeenCalled();
  });

  it('rejects password shorter than 6 characters before hitting the API', async () => {
    const user = userEvent.setup();
    renderSignup();
    await fillValidForm(user, { password: 'abc' });
    fireEvent.click(screen.getByRole('button', { name: /daftar gratis/i }));
    await waitFor(() =>
      expect(screen.getByText(/password minimal 6 karakter/i)).toBeInTheDocument()
    );
    expect(signupMock).not.toHaveBeenCalled();
  });

  it('surfaces 409 slug-taken from server as inline error on the slug field', async () => {
    signupMock.mockRejectedValueOnce({
      response: { status: 409, data: { error: 'tenant_slug sudah digunakan' } },
    });
    const user = userEvent.setup();
    renderSignup();
    await fillValidForm(user);
    fireEvent.click(screen.getByRole('button', { name: /daftar gratis/i }));

    await waitFor(() =>
      expect(screen.getByText(/tenant_slug sudah digunakan/i)).toBeInTheDocument()
    );
    expect(navigateMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalled();
  });

  it('surfaces 409 username-taken from server as inline error on the username field', async () => {
    signupMock.mockRejectedValueOnce({
      response: { status: 409, data: { error: 'admin_username sudah digunakan' } },
    });
    const user = userEvent.setup();
    renderSignup();
    await fillValidForm(user);
    fireEvent.click(screen.getByRole('button', { name: /daftar gratis/i }));

    await waitFor(() =>
      expect(screen.getByText(/admin_username sudah digunakan/i)).toBeInTheDocument()
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('rejects malformed slug client-side without hitting the API', async () => {
    const user = userEvent.setup();
    renderSignup();
    await user.type(screen.getByLabelText(/nama bisnis/i), 'Kopi Tegal');
    const slug = screen.getByLabelText(/slug akun/i);
    await user.clear(slug);
    // Type a hyphen + then more text — useEvent triggers input event for each char,
    // and the leading hyphen is allowed by the input filter but should fail server-style validation.
    await user.type(slug, '-bad');
    await user.type(screen.getByLabelText(/nama lengkap/i), 'Budi');
    await user.type(screen.getByLabelText(/^username$/i), 'budi');
    await user.type(screen.getByLabelText(/^password$/i), 'Sandi123!');
    await user.click(screen.getByRole('checkbox', { name: /syarat/i }));
    fireEvent.click(screen.getByRole('button', { name: /daftar gratis/i }));

    await waitFor(() => expect(screen.getByText(/Slug 2-40 karakter/i)).toBeInTheDocument());
    expect(signupMock).not.toHaveBeenCalled();
  });
});
