import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Store, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

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

  return (
    <div className="min-h-screen flex">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#04C99E] to-[#028E6F] items-center justify-center p-12">
        <div className="text-center">
          <div className="w-24 h-24 bg-white/20 backdrop-blur rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Store className="w-14 h-14 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-3">VIPOS</h1>
          <p className="text-white/80 text-lg max-w-sm mx-auto">
            Aplikasi Kasir Modern untuk Bisnis yang Lebih Maju
          </p>
          <div className="mt-8 text-white/60 text-sm">
            <p>Kelola penjualan, stok, dan laporan</p>
            <p>dalam satu aplikasi yang mudah digunakan</p>
          </div>
        </div>
      </div>

      {/* Right side - login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 bg-[#04C99E] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Store className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">VIPOS</h1>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-1">Login to Dashboard</h2>
          <p className="text-sm text-gray-400 mb-8">Masukkan akun untuk melanjutkan</p>

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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pr-12"
                    placeholder="Contoh: Sandi123!"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-[#04C99E] hover:bg-[#03B08A] active:bg-[#028E6F] text-white font-medium rounded-lg px-4 py-3 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                'Login'
              )}
            </button>
          </form>

          <p className="text-center text-gray-400 text-xs mt-8">
            &copy; {new Date().getFullYear()} VIPOS. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
