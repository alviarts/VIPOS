import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPwd.length < 6) {
      toast.error('Password baru minimal 6 karakter');
      return;
    }
    if (newPwd !== confirm) {
      toast.error('Konfirmasi password tidak cocok');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        current_password: current,
        new_password: newPwd,
      });
      toast.success('Password berhasil diubah');
      setCurrent('');
      setNewPwd('');
      setConfirm('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal mengubah password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Ubah password</h1>
            <p className="text-sm text-gray-500">
              Untuk keamanan, masukkan password lama sebelum mengganti.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Password lama</label>
            <div className="relative mt-1.5">
              <input
                type={show ? 'text' : 'password'}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="input-field pr-12"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="toggle visibility"
              >
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password baru</label>
            <input
              type={show ? 'text' : 'password'}
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className="input-field mt-1.5"
              placeholder="Minimal 6 karakter"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Konfirmasi password baru
            </label>
            <input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input-field mt-1.5"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 font-medium text-gray-600 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-[#04C99E] px-4 py-2.5 font-medium text-white hover:bg-[#03B08A] disabled:opacity-50"
            >
              {loading ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
