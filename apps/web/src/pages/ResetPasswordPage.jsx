import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error('Token reset tidak ditemukan di URL');
      return;
    }
    if (password.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }
    if (password !== confirm) {
      toast.error('Konfirmasi password tidak cocok');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, new_password: password });
      toast.success('Password berhasil di-reset, silakan login');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reset gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#04C99E]">
            <Store className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Reset password</h1>
          <p className="mt-1 text-sm text-gray-500">Buat password baru untuk akun kamu.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700">Password baru</label>
          <div className="relative mt-1.5">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field pr-12"
              placeholder="Minimal 6 karakter"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="toggle visibility"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <label className="mt-4 block text-sm font-medium text-gray-700">Konfirmasi password</label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input-field mt-1.5"
            placeholder="Ulangi password baru"
          />

          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full rounded-lg bg-[#04C99E] px-4 py-3 font-medium text-white hover:bg-[#03B08A] disabled:opacity-50"
          >
            {loading ? 'Menyimpan…' : 'Simpan password baru'}
          </button>
          <Link
            to="/login"
            className="mt-3 block text-center text-sm text-gray-500 hover:text-gray-700"
          >
            ← Kembali ke login
          </Link>
        </form>
      </div>
    </div>
  );
}
