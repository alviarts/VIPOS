import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Store } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function ForgotPasswordPage() {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devLink, setDevLink] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!emailOrUsername) return;
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', {
        email_or_username: emailOrUsername,
      });
      setSubmitted(true);
      if (res.data?.dev_reset_link) {
        setDevLink(res.data.dev_reset_link);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal mengirim link');
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
          <h1 className="text-xl font-bold text-gray-900">Lupa password?</h1>
          <p className="mt-1 text-sm text-gray-500">
            Masukkan email atau username, kami akan kirim link reset password.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-lg border border-primary-100 bg-primary-50 p-4 text-sm text-primary-800">
            <p className="font-medium">Link sudah dikirim.</p>
            <p className="mt-1">
              Cek inbox email kamu. Link berlaku 24 jam. Kalau tidak ada, hubungi admin.
            </p>
            {devLink && (
              <div className="mt-3 break-all rounded bg-white p-2 text-xs text-gray-600">
                <span className="font-medium">[Dev only]</span> {devLink}
              </div>
            )}
            <Link
              to="/login"
              className="mt-3 inline-block text-sm font-medium text-primary-700 hover:underline"
            >
              ← Kembali ke login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-gray-700">Email atau username</label>
            <input
              type="text"
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              className="input-field mt-1.5"
              placeholder="admin@vipos.id"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading}
              className="mt-5 w-full rounded-lg bg-[#04C99E] px-4 py-3 font-medium text-white hover:bg-[#03B08A] disabled:opacity-50"
            >
              {loading ? 'Mengirim…' : 'Kirim link reset'}
            </button>
            <Link
              to="/login"
              className="mt-3 block text-center text-sm text-gray-500 hover:text-gray-700"
            >
              ← Kembali ke login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
