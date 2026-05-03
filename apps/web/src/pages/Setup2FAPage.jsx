import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Setup2FAPage() {
  const { user } = useAuth();
  const [setupData, setSetupData] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [enabled, setEnabled] = useState(Boolean(user?.totp_enabled));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then((res) => {
      setEnabled(Boolean(res.data.user?.totp_enabled));
    }).catch(() => { /* ignored — useAuth handles it */ });
  }, []);

  useEffect(() => {
    if (setupData?.otpauth_url) {
      QRCode.toDataURL(setupData.otpauth_url).then(setQrDataUrl).catch(() => {
        setQrDataUrl('');
      });
    }
  }, [setupData]);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const res = await api.post('/auth/2fa/setup');
      setSetupData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal generate secret');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      toast.error('Kode harus 6 digit angka');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/2fa/verify', { code });
      toast.success('2FA berhasil diaktifkan');
      setEnabled(true);
      setSetupData(null);
      setCode('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verifikasi gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e) => {
    e.preventDefault();
    if (!password) {
      toast.error('Masukkan password kamu');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/2fa/disable', { password });
      toast.success('2FA dinonaktifkan');
      setEnabled(false);
      setPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal nonaktifkan 2FA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
            {enabled ? <ShieldCheck className="h-6 w-6" /> : <ShieldOff className="h-6 w-6" />}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Two-factor authentication</h1>
            <p className="text-sm text-gray-500">
              {enabled
                ? '2FA aktif. Kamu akan diminta kode 6 digit setiap login.'
                : 'Tambahkan lapisan keamanan ekstra dengan TOTP authenticator.'}
            </p>
          </div>
        </div>

        {enabled ? (
          <form onSubmit={handleDisable} className="space-y-4">
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Untuk menonaktifkan 2FA, masukkan password kamu sebagai konfirmasi.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field mt-1.5"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-red-500 px-4 py-2.5 font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              {loading ? 'Memproses…' : 'Nonaktifkan 2FA'}
            </button>
          </form>
        ) : !setupData ? (
          <button
            type="button"
            onClick={handleSetup}
            disabled={loading}
            className="w-full rounded-lg bg-[#04C99E] px-4 py-2.5 font-medium text-white hover:bg-[#03B08A] disabled:opacity-50"
          >
            {loading ? 'Memuat…' : 'Mulai setup 2FA'}
          </button>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <ol className="space-y-3 text-sm text-gray-600">
              <li>
                <span className="font-medium text-gray-900">1.</span> Buka authenticator app (Google Authenticator, Authy, 1Password, dll).
              </li>
              <li>
                <span className="font-medium text-gray-900">2.</span> Scan QR code di bawah, atau masukkan secret manual.
              </li>
              <li>
                <span className="font-medium text-gray-900">3.</span> Masukkan 6 digit kode dari app untuk verifikasi.
              </li>
            </ol>

            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-gray-200 p-4">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR code 2FA" className="h-40 w-40" />
              ) : (
                <div className="h-40 w-40 animate-pulse rounded bg-gray-100" />
              )}
              <code className="select-all rounded bg-gray-100 px-2 py-1 text-xs">
                {setupData.secret}
              </code>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Kode verifikasi</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="input-field mt-1.5 text-center text-2xl tracking-[0.5em] font-mono"
                placeholder="000000"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#04C99E] px-4 py-2.5 font-medium text-white hover:bg-[#03B08A] disabled:opacity-50"
            >
              {loading ? 'Memverifikasi…' : 'Aktifkan 2FA'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
