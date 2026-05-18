import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Store, Eye, EyeOff, ShieldCheck, Smartphone, BarChart3, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

const FEATURES = [
  { icon: Smartphone,  title: 'Mobile-first',  desc: 'Optimal di tablet & smartphone' },
  { icon: BarChart3,   title: 'Real-time',     desc: 'Penjualan & stok terupdate langsung' },
  { icon: ShieldCheck, title: 'Aman',          desc: 'Multi-user dengan role & izin' },
];

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Masukkan username dan password');
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
      toast.success('Login berhasil!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  const useDemoAccount = () => {
    setUsername('admin');
    setPassword('admin123');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#04C99E] via-[#03B08A] to-[#028E6F] items-center justify-center p-12">
        {/* Decorative blobs */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative text-center max-w-md">
          <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <Store className="w-11 h-11 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">VIPOS</h1>
          <p className="text-white/85 text-lg mx-auto">
            Aplikasi Kasir Modern untuk<br />Bisnis yang Lebih Maju
          </p>

          <div className="mt-10 space-y-3 text-left">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3 bg-white/10 backdrop-blur rounded-2xl px-4 py-3 border border-white/15">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-xs text-white/70">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-[#04C99E] to-[#028E6F] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary-500/30">
              <Store className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">VIPOS</h1>
            <p className="text-xs text-gray-400 mt-1">Aplikasi Kasir Modern</p>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-1">Selamat datang kembali</h2>
          <p className="text-sm text-gray-400 mb-8">Masuk untuk melanjutkan ke dashboard</p>

          <form onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field"
                  placeholder="Contoh: admin"
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-gray-700">Password</label>
                  <button
                    type="button"
                    onClick={() => toast('Hubungi admin untuk reset password', { icon: 'ℹ️' })}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    Lupa password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pr-12"
                    placeholder="Masukkan password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-[#04C99E] hover:bg-[#03B08A] active:bg-[#028E6F] text-white font-medium rounded-lg px-4 py-3 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-primary-500/30 hover:shadow-lg hover:shadow-primary-500/40"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  Masuk
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-6 flex items-center gap-3 bg-primary-50 border border-primary-100 rounded-xl px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-primary-800">Akun Demo</p>
              <p className="text-xs text-primary-700/80">
                <span className="font-mono">admin</span> / <span className="font-mono">admin123</span>
              </p>
            </div>
            <button
              type="button"
              onClick={useDemoAccount}
              className="text-xs font-semibold text-primary-700 hover:text-primary-800 px-2 py-1 rounded hover:bg-primary-100"
            >
              Pakai
            </button>
          </div>

          <p className="text-center text-gray-400 text-xs mt-8">
            &copy; {new Date().getFullYear()} VIPOS. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
