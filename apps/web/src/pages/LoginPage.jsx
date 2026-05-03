import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Store, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('credentials'); // 'credentials' | 'totp'
  const [loginToken, setLoginToken] = useState('');
  const [code, setCode] = useState('');
  const { login, verifyLogin2FA } = useAuth();
  const navigate = useNavigate();

  const handleCredentials = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Masukkan username dan password');
      return;
    }
    setLoading(true);
    try {
      const result = await login(username, password, { rememberMe });
      if (result.requires_2fa) {
        setLoginToken(result.login_token);
        setStage('totp');
        toast('Masukkan kode 2FA dari authenticator app');
      } else {
        toast.success('Login berhasil!');
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleTotp = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      toast.error('Kode harus 6 digit angka');
      return;
    }
    setLoading(true);
    try {
      await verifyLogin2FA(loginToken, code, { rememberMe });
      toast.success('Login berhasil!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Kode 2FA salah');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#04C99E] to-[#028E6F] items-center justify-center p-12">
        <div className="text-center">
          <div className="w-24 h-24 bg-white/20 backdrop-blur rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Store className="w-14 h-14 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-3">VIPOS</h1>
          <p className="text-white/80 text-lg max-w-sm mx-auto">
            Aplikasi Kasir Modern untuk Bisnis yang Lebih Maju
          </p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 bg-[#04C99E] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Store className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">VIPOS</h1>
          </div>

          {stage === 'credentials' ? (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Login to Dashboard</h2>
              <p className="text-sm text-gray-400 mb-8">Masukkan akun untuk melanjutkan</p>

              <form onSubmit={handleCredentials}>
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
                      <label className="block text-sm font-medium text-gray-700">Password</label>
                      <Link to="/forgot-password" className="text-xs font-medium text-primary-600 hover:underline">
                        Lupa password?
                      </Link>
                    </div>
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

                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    Ingat saya selama 30 hari
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
                    'Login'
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-6 h-6 text-primary-600" />
                <h2 className="text-2xl font-bold text-gray-900">Verifikasi 2FA</h2>
              </div>
              <p className="text-sm text-gray-500 mb-8">
                Buka authenticator app dan masukkan kode 6 digit untuk akun ini.
              </p>

              <form onSubmit={handleTotp}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Kode 2FA</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="input-field text-center text-2xl tracking-[0.5em] font-mono"
                    placeholder="000000"
                    autoFocus
                  />
                </div>

                <div className="flex items-center gap-2 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setStage('credentials');
                      setCode('');
                      setLoginToken('');
                    }}
                    className="flex-1 border border-gray-200 text-gray-600 font-medium rounded-lg px-4 py-3 hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-[#04C99E] hover:bg-[#03B08A] text-white font-medium rounded-lg px-4 py-3 disabled:opacity-50"
                  >
                    {loading ? 'Memverifikasi…' : 'Verifikasi'}
                  </button>
                </div>
              </form>
            </>
          )}

          <p className="text-center text-gray-400 text-xs mt-8">
            &copy; {new Date().getFullYear()} VIPOS. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
