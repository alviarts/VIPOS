// Consumer App config (P1-12) — white-label app branding + bundle ID + status.
// Build & publish ke Play Store / App Store dilakukan off-platform; halaman ini
// hanya menyimpan metadata + status pipeline.
import { useEffect, useState } from 'react';
import { Smartphone, Save, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/ui';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  { value: 'submitted', label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
  { value: 'review', label: 'Under Review', color: 'bg-amber-100 text-amber-700' },
  { value: 'published', label: 'Published', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'rejected', label: 'Rejected', color: 'bg-rose-100 text-rose-700' },
];

export default function ConsumerAppPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/consumer-app-config');
      setConfig(res.data);
    } catch {
      toast.error('Gagal memuat config');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.put('/consumer-app-config', config);
      toast.success('Config tersimpan');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal');
    } finally {
      setSaving(false);
    }
  }

  function patch(updates) {
    setConfig({ ...config, ...updates });
  }

  if (loading || !config) {
    return (
      <div>
        <PageHeader title="Consumer App" icon={Smartphone} />
        <p className="text-sm text-gray-400">Memuat…</p>
      </div>
    );
  }

  const statusOpt = STATUS_OPTIONS.find((s) => s.value === config.status);

  return (
    <div>
      <PageHeader
        title="Consumer App"
        subtitle="White-label customer app (Android + iOS) — branding, bundle ID, dan tracking publikasi."
        icon={Smartphone}
      >
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
            statusOpt?.color || 'bg-gray-100 text-gray-700'
          }`}
        >
          {statusOpt?.label || config.status}
        </span>
        {isAdmin && (
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">
            Branding
          </h3>
          <div className="space-y-3">
            <Field
              label="Nama App"
              value={config.app_name || ''}
              onChange={(v) => patch({ app_name: v })}
              disabled={!isAdmin}
            />
            <Field
              label="Icon URL (1024×1024)"
              value={config.app_icon_url || ''}
              onChange={(v) => patch({ app_icon_url: v })}
              disabled={!isAdmin}
              placeholder="https://…"
            />
            <Field
              label="Splash screen URL"
              value={config.splash_image_url || ''}
              onChange={(v) => patch({ splash_image_url: v })}
              disabled={!isAdmin}
              placeholder="https://…"
            />
            <div>
              <label className="text-sm font-medium">Primary color</label>
              <input
                type="color"
                value={config.primary_color || '#04C99E'}
                onChange={(e) => patch({ primary_color: e.target.value })}
                disabled={!isAdmin}
                className="mt-1 h-9 w-full rounded-lg border border-gray-300"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">
            Bundle / Package ID
          </h3>
          <div className="space-y-3">
            <Field
              label="Android (applicationId)"
              value={config.bundle_id_android || ''}
              onChange={(v) => patch({ bundle_id_android: v })}
              disabled={!isAdmin}
              placeholder="com.tokoanda.app"
            />
            <Field
              label="iOS (bundleId)"
              value={config.bundle_id_ios || ''}
              onChange={(v) => patch({ bundle_id_ios: v })}
              disabled={!isAdmin}
              placeholder="com.tokoanda.app"
            />
            <div>
              <label className="text-sm font-medium">Status publikasi</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
                value={config.status}
                onChange={(e) => patch({ status: e.target.value })}
                disabled={!isAdmin}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Play Store URL"
              value={config.play_store_url || ''}
              onChange={(v) => patch({ play_store_url: v })}
              disabled={!isAdmin}
              placeholder="https://play.google.com/store/apps/details?id=…"
            />
            <Field
              label="App Store URL"
              value={config.app_store_url || ''}
              onChange={(v) => patch({ app_store_url: v })}
              disabled={!isAdmin}
              placeholder="https://apps.apple.com/app/id…"
            />
          </div>
          {(config.play_store_url || config.app_store_url) && (
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {config.play_store_url && (
                <a
                  href={config.play_store_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                >
                  Play Store <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {config.app_store_url && (
                <a
                  href={config.app_store_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100"
                >
                  App Store <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
        <p className="text-sm text-amber-800">
          <strong>Catatan:</strong> halaman ini hanya menyimpan metadata. Build binary (APK / IPA),
          upload ke Play Console / App Store Connect, dan review pipeline dilakukan off-platform
          oleh tim aplikasi. Saat status berubah ke &quot;Published&quot;, isi URL store di kedua
          field di atas.
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, disabled }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        type="text"
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}
