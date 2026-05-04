// VIPOS — Public tenant signup page (PR-2, pra-beta v0.0.1).
//
// Calls POST /api/v1/tenant/register via AuthContext.signupTenant, which
// returns access + refresh tokens. On success the caller is logged in
// immediately (no double-login round-trip).
//
// Slug is auto-derived from "Nama bisnis" but stays editable. The user
// can keep typing in the slug field to override the auto value, after
// which it stops syncing. We never block submission on a slug that fails
// the regex — the server is the source of truth and shows the canonical
// error message ("tenant_slug harus 2-40 karakter…").

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Store, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { slugify, scorePassword, SLUG_REGEX } from '../utils/signup-helpers';

export default function SignupPage() {
  const navigate = useNavigate();
  const { signupTenant } = useAuth();

  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTos, setAgreeTos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const effectiveSlug = slugTouched ? slug : slugify(businessName);
  const passwordStrength = useMemo(() => scorePassword(password), [password]);

  function setError(field, message) {
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  }
  function clearError(field) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate() {
    const errs = {};
    if (!businessName.trim()) errs.tenant_name = 'Nama bisnis wajib diisi';
    if (!effectiveSlug) {
      errs.tenant_slug = 'Slug wajib diisi';
    } else if (!SLUG_REGEX.test(effectiveSlug)) {
      errs.tenant_slug =
        'Slug 2-40 karakter, hanya a-z, 0-9, dan tanda hubung (tidak boleh diawali/diakhiri tanda hubung)';
    }
    if (!adminName.trim()) errs.admin_name = 'Nama lengkap wajib diisi';
    if (!adminUsername.trim()) {
      errs.admin_username = 'Username wajib diisi';
    } else if (adminUsername.trim().length > 60) {
      errs.admin_username = 'Username maksimal 60 karakter';
    }
    if (password.length < 6) errs.admin_password = 'Password minimal 6 karakter';
    if (adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      errs.admin_email = 'Format email tidak valid';
    }
    setFieldErrors(errs);
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!agreeTos) {
      toast.error('Setujui syarat & ketentuan dulu sebelum lanjut');
      return;
    }
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      toast.error('Periksa kembali isian Anda');
      return;
    }
    setLoading(true);
    try {
      await signupTenant({
        tenant_slug: effectiveSlug,
        tenant_name: businessName.trim(),
        admin_name: adminName.trim(),
        admin_username: adminUsername.trim(),
        admin_password: password,
        admin_email: adminEmail.trim(),
      });
      toast.success('Akun berhasil dibuat. Selamat datang di VIPOS!');
      navigate('/onboarding');
    } catch (err) {
      const message = err?.response?.data?.error || 'Gagal mendaftar. Coba lagi.';
      const status = err?.response?.status;
      if (status === 409) {
        if (/slug/i.test(message)) setError('tenant_slug', message);
        else if (/username/i.test(message)) setError('admin_username', message);
        else {
          setError('tenant_slug', message);
          setError('admin_username', message);
        }
      } else if (status === 400) {
        if (/slug/i.test(message)) setError('tenant_slug', message);
        else if (/password/i.test(message)) setError('admin_password', message);
        else if (/username/i.test(message)) setError('admin_username', message);
        else if (/tenant_name|nama/i.test(message)) setError('tenant_name', message);
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#04C99E] to-[#028E6F] items-center justify-center p-12">
        <div className="text-center">
          <div className="w-24 h-24 bg-white/20 backdrop-blur rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Store className="w-14 h-14 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-3">VIPOS</h1>
          <p className="text-white/80 text-lg max-w-sm mx-auto">
            Mulai gratis. Tanpa kartu kredit. Pakai langsung di outlet dalam 5 menit.
          </p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-md py-8">
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 bg-[#04C99E] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Store className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">VIPOS</h1>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-1">Daftar Akun Baru</h2>
          <p className="text-sm text-gray-400 mb-8">
            Isi data di bawah untuk mulai pakai VIPOS gratis (paket Lite).
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="signup-business"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Nama bisnis
                </label>
                <input
                  id="signup-business"
                  type="text"
                  value={businessName}
                  onChange={(e) => {
                    setBusinessName(e.target.value);
                    clearError('tenant_name');
                    if (!slugTouched) clearError('tenant_slug');
                  }}
                  className="input-field"
                  placeholder="Contoh: Kopi Tegal"
                  autoComplete="organization"
                  autoFocus
                  aria-invalid={Boolean(fieldErrors.tenant_name)}
                />
                {fieldErrors.tenant_name && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.tenant_name}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="signup-slug"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Slug akun{' '}
                  <span className="text-xs font-normal text-gray-400">
                    (alamat unik VIPOS Anda)
                  </span>
                </label>
                <div className="flex items-stretch rounded-lg border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-primary-500">
                  <span className="bg-gray-50 px-3 py-2 text-sm text-gray-500 border-r border-gray-300 select-none">
                    vipos.app/
                  </span>
                  <input
                    id="signup-slug"
                    type="text"
                    value={effectiveSlug}
                    onChange={(e) => {
                      const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '');
                      setSlug(v);
                      setSlugTouched(true);
                      clearError('tenant_slug');
                    }}
                    className="flex-1 px-3 py-2 text-sm focus:outline-none"
                    placeholder="kopi-tegal"
                    aria-invalid={Boolean(fieldErrors.tenant_slug)}
                  />
                </div>
                {fieldErrors.tenant_slug && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.tenant_slug}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="signup-admin-name"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Nama lengkap (admin)
                </label>
                <input
                  id="signup-admin-name"
                  type="text"
                  value={adminName}
                  onChange={(e) => {
                    setAdminName(e.target.value);
                    clearError('admin_name');
                  }}
                  className="input-field"
                  placeholder="Contoh: Budi Santoso"
                  autoComplete="name"
                  aria-invalid={Boolean(fieldErrors.admin_name)}
                />
                {fieldErrors.admin_name && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.admin_name}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="signup-email"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Email <span className="text-xs font-normal text-gray-400">(opsional)</span>
                </label>
                <input
                  id="signup-email"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => {
                    setAdminEmail(e.target.value);
                    clearError('admin_email');
                  }}
                  className="input-field"
                  placeholder="budi@kopitegal.id"
                  autoComplete="email"
                  aria-invalid={Boolean(fieldErrors.admin_email)}
                />
                {fieldErrors.admin_email && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.admin_email}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="signup-username"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Username
                </label>
                <input
                  id="signup-username"
                  type="text"
                  value={adminUsername}
                  onChange={(e) => {
                    setAdminUsername(e.target.value);
                    clearError('admin_username');
                  }}
                  className="input-field"
                  placeholder="budi.s"
                  autoComplete="username"
                  aria-invalid={Boolean(fieldErrors.admin_username)}
                />
                {fieldErrors.admin_username && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.admin_username}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="signup-password"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearError('admin_password');
                    }}
                    className="input-field pr-12"
                    placeholder="Minimal 6 karakter"
                    autoComplete="new-password"
                    aria-invalid={Boolean(fieldErrors.admin_password)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2" aria-live="polite">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`h-1 flex-1 rounded ${
                            i < passwordStrength.score
                              ? passwordStrength.score >= 3
                                ? 'bg-primary-500'
                                : 'bg-yellow-400'
                              : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Kekuatan: <span className="font-medium">{passwordStrength.label}</span>
                    </p>
                  </div>
                )}
                {fieldErrors.admin_password && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.admin_password}</p>
                )}
              </div>

              <label className="flex items-start gap-2 text-sm text-gray-600 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTos}
                  onChange={(e) => setAgreeTos(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span>
                  Saya setuju dengan{' '}
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    Syarat & Ketentuan
                  </a>{' '}
                  dan{' '}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    Kebijakan Privasi
                  </a>{' '}
                  VIPOS.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-[#04C99E] hover:bg-[#03B08A] active:bg-[#028E6F] text-white font-medium rounded-lg px-4 py-3 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                'Daftar gratis'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            Sudah punya akun?{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:underline">
              Login di sini
            </Link>
          </p>

          <p className="text-center text-gray-400 text-xs mt-8">
            &copy; {new Date().getFullYear()} VIPOS. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
