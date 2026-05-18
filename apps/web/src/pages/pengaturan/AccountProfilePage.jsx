// Account Profile — current user profile, photo, change password, 2FA shortcut.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Lock, ShieldCheck } from 'lucide-react';
import api from '../../utils/api';
import { PageHeader } from '../../components/ui';
import { formatDate } from '../../utils/format';
import { usePermission } from '../../context/PermissionContext';

export default function AccountProfilePage() {
  const { canSeeHidden } = usePermission();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', photo_url: '' });
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const r = await api.get('/account-profile');
    setProfile(r.data);
    setForm({
      name: r.data.name || '',
      email: r.data.email || '',
      phone: r.data.phone || '',
      photo_url: r.data.photo_url || '',
    });
  }

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/account-profile', form);
      toast.success('Profil disimpan');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pwd.new_password !== pwd.confirm) {
      toast.error('Password baru dan konfirmasi tidak sama');
      return;
    }
    try {
      await api.post('/account-profile/change-password', {
        current_password: pwd.current_password,
        new_password: pwd.new_password,
      });
      toast.success('Password berhasil diganti');
      setPwd({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal ganti password');
    }
  }

  if (!profile) return <div className="p-6 text-sm text-gray-400">Memuat…</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Akun & Profil" subtitle="Kelola informasi akun, password, dan 2FA." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold">Informasi Akun</h2>
          <form onSubmit={saveProfile} className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-2xl font-semibold text-gray-500">
                {form.photo_url ? (
                  <img src={form.photo_url} alt="profile" className="h-full w-full object-cover" />
                ) : (
                  (profile.name || 'U').slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="flex-1">
                <Field label="URL Foto Profil">
                  <input
                    value={form.photo_url}
                    onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                    placeholder="https://..."
                    className="input-field"
                  />
                </Field>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Username">
                <input value={profile.username} readOnly className="input-field bg-gray-50" />
              </Field>
              <Field label="Role">
                <input value={profile.role} readOnly className="input-field bg-gray-50" />
              </Field>
            </div>
            <Field label="Nama Lengkap">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input-field"
                />
              </Field>
              <Field label="No. HP">
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="input-field"
                />
              </Field>
            </div>
            <div className="text-xs text-gray-500">
              Login terakhir: {profile.last_login_at ? formatDate(profile.last_login_at) : '-'}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </form>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Lock className="h-4 w-4 text-primary-600" /> Ganti Password
            </h2>
            <form onSubmit={changePassword} className="space-y-2">
              <input
                type="password"
                placeholder="Password lama"
                value={pwd.current_password}
                onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })}
                required
                className="input-field"
              />
              <input
                type="password"
                placeholder="Password baru (min 6 karakter)"
                value={pwd.new_password}
                onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })}
                required
                minLength={6}
                className="input-field"
              />
              <input
                type="password"
                placeholder="Konfirmasi password baru"
                value={pwd.confirm}
                onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                required
                minLength={6}
                className="input-field"
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-primary-600 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                Ganti Password
              </button>
            </form>
          </div>

          {canSeeHidden && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary-600" /> Two-Factor Authentication
              </h2>
              <p className="mb-3 text-xs text-gray-500">
                {profile.totp_enabled
                  ? '2FA aktif — login butuh kode autentikator.'
                  : '2FA belum aktif. Aktifkan untuk keamanan ekstra.'}
              </p>
              <Link
                to="/setup-2fa"
                className="inline-block rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100"
              >
                {profile.totp_enabled ? 'Kelola 2FA' : 'Setup 2FA'}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
