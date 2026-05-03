// majoo Order — storefront e-menu config (P1-12).
// Branding, domain, payment methods, jam buka, delivery zones, ongkir.
import { useEffect, useState } from 'react';
import { Globe, Save, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/ui';

const DAYS = [
  { id: 'mon', label: 'Senin' },
  { id: 'tue', label: 'Selasa' },
  { id: 'wed', label: 'Rabu' },
  { id: 'thu', label: 'Kamis' },
  { id: 'fri', label: 'Jumat' },
  { id: 'sat', label: 'Sabtu' },
  { id: 'sun', label: 'Minggu' },
];

const DEFAULT_PAYMENTS = [
  { id: 'cash', name: 'Tunai (COD)', enabled: true },
  { id: 'qris', name: 'QRIS', enabled: true },
  { id: 'transfer', name: 'Transfer Bank', enabled: true },
  { id: 'gopay', name: 'GoPay', enabled: false },
  { id: 'ovo', name: 'OVO', enabled: false },
  { id: 'dana', name: 'DANA', enabled: false },
];

function defaultHours() {
  return DAYS.map((d) => ({
    day: d.id,
    open: '09:00',
    close: '21:00',
    is_closed: false,
  }));
}

export default function MajooOrderPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/storefront-settings');
      const s = res.data || {};
      setSettings({
        ...s,
        operating_hours: s.operating_hours || defaultHours(),
        payment_methods: s.payment_methods || DEFAULT_PAYMENTS,
        delivery_zones: s.delivery_zones || [],
        is_active: s.is_active ?? 1,
        supports_dine_in: s.supports_dine_in ?? 1,
        supports_takeaway: s.supports_takeaway ?? 1,
        supports_delivery: s.supports_delivery ?? 1,
      });
    } catch {
      toast.error('Gagal memuat config storefront');
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
      await api.put('/storefront-settings', settings);
      toast.success('Config storefront tersimpan');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  function patch(updates) {
    setSettings({ ...settings, ...updates });
  }

  function addZone() {
    patch({
      delivery_zones: [
        ...(settings.delivery_zones || []),
        { name: '', fee: 0, min_order: 0, radius_km: 0 },
      ],
    });
  }

  function updateZone(idx, k, v) {
    const zones = [...settings.delivery_zones];
    zones[idx] = { ...zones[idx], [k]: v };
    patch({ delivery_zones: zones });
  }

  function removeZone(idx) {
    const zones = [...settings.delivery_zones];
    zones.splice(idx, 1);
    patch({ delivery_zones: zones });
  }

  function updateHour(idx, k, v) {
    const hours = [...settings.operating_hours];
    hours[idx] = { ...hours[idx], [k]: v };
    patch({ operating_hours: hours });
  }

  function togglePayment(idx) {
    const pm = [...settings.payment_methods];
    pm[idx] = { ...pm[idx], enabled: !pm[idx].enabled };
    patch({ payment_methods: pm });
  }

  if (loading || !settings) {
    return (
      <div>
        <PageHeader title="majoo Order" icon={Globe} />
        <p className="text-sm text-gray-400">Memuat…</p>
      </div>
    );
  }

  const previewUrl = settings.custom_domain
    ? `https://${settings.custom_domain}`
    : settings.slug
      ? `${window.location.origin}/store/${settings.slug}`
      : '';

  return (
    <div>
      <PageHeader
        title="majoo Order"
        subtitle="Storefront e-menu — domain custom, branding, jam buka, payment & delivery."
        icon={Globe}
      >
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

      <div className="space-y-4">
        <Section title="Domain & status">
          <Field
            label="Slug"
            value={settings.slug || ''}
            onChange={(v) => patch({ slug: v })}
            placeholder="toko-saya"
            disabled={!isAdmin}
          />
          <Field
            label="Custom domain"
            value={settings.custom_domain || ''}
            onChange={(v) => patch({ custom_domain: v })}
            placeholder="toko.com"
            disabled={!isAdmin}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Number(settings.is_active) === 1}
              onChange={(e) => patch({ is_active: e.target.checked ? 1 : 0 })}
              disabled={!isAdmin}
            />
            Storefront aktif (dapat diakses publik)
          </label>
          {previewUrl && (
            <p className="text-xs text-gray-500">
              Preview URL:{' '}
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary-600 underline"
              >
                {previewUrl}
              </a>
            </p>
          )}
        </Section>

        <Section title="Branding">
          <Field
            label="Nama Brand"
            value={settings.brand_name || ''}
            onChange={(v) => patch({ brand_name: v })}
            disabled={!isAdmin}
          />
          <Field
            label="Tagline"
            value={settings.tagline || ''}
            onChange={(v) => patch({ tagline: v })}
            disabled={!isAdmin}
          />
          <Field
            label="Logo URL"
            value={settings.logo_url || ''}
            onChange={(v) => patch({ logo_url: v })}
            placeholder="https://…"
            disabled={!isAdmin}
          />
          <Field
            label="Cover URL"
            value={settings.cover_image_url || ''}
            onChange={(v) => patch({ cover_image_url: v })}
            placeholder="https://…"
            disabled={!isAdmin}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">Primary color</label>
              <input
                type="color"
                value={settings.primary_color || '#04C99E'}
                onChange={(e) => patch({ primary_color: e.target.value })}
                disabled={!isAdmin}
                className="mt-1 h-9 w-full rounded-lg border border-gray-300"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Theme</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={settings.theme || 'light'}
                onChange={(e) => patch({ theme: e.target.value })}
                disabled={!isAdmin}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto</option>
              </select>
            </div>
          </div>
        </Section>

        <Section title="Channel">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Number(settings.supports_dine_in) === 1}
                onChange={(e) => patch({ supports_dine_in: e.target.checked ? 1 : 0 })}
                disabled={!isAdmin}
              />
              Dine-in
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Number(settings.supports_takeaway) === 1}
                onChange={(e) => patch({ supports_takeaway: e.target.checked ? 1 : 0 })}
                disabled={!isAdmin}
              />
              Takeaway
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Number(settings.supports_delivery) === 1}
                onChange={(e) => patch({ supports_delivery: e.target.checked ? 1 : 0 })}
                disabled={!isAdmin}
              />
              Delivery
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <NumberField
              label="Min order (Rp)"
              value={settings.min_order_amount || 0}
              onChange={(v) => patch({ min_order_amount: v })}
              disabled={!isAdmin}
            />
            <NumberField
              label="Service charge (%)"
              value={settings.service_charge_percent || 0}
              onChange={(v) => patch({ service_charge_percent: v })}
              disabled={!isAdmin}
            />
            <NumberField
              label="Tax (%)"
              value={settings.tax_percent || 0}
              onChange={(v) => patch({ tax_percent: v })}
              disabled={!isAdmin}
            />
          </div>
        </Section>

        <Section title="Jam Buka">
          <table className="min-w-full text-sm">
            <tbody>
              {settings.operating_hours.map((h, idx) => (
                <tr key={h.day}>
                  <td className="py-1 pr-3 font-medium">
                    {DAYS.find((d) => d.id === h.day)?.label || h.day}
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="time"
                      value={h.open}
                      onChange={(e) => updateHour(idx, 'open', e.target.value)}
                      disabled={!isAdmin || h.is_closed}
                      className="rounded-lg border border-gray-300 px-2 py-1"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="time"
                      value={h.close}
                      onChange={(e) => updateHour(idx, 'close', e.target.value)}
                      disabled={!isAdmin || h.is_closed}
                      className="rounded-lg border border-gray-300 px-2 py-1"
                    />
                  </td>
                  <td className="py-1">
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={h.is_closed}
                        onChange={(e) => updateHour(idx, 'is_closed', e.target.checked)}
                        disabled={!isAdmin}
                      />
                      Tutup
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Metode Pembayaran">
          <div className="grid grid-cols-2 gap-2">
            {settings.payment_methods.map((pm, idx) => (
              <label
                key={pm.id}
                className="flex items-center gap-2 rounded-lg ring-1 ring-gray-100 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={!!pm.enabled}
                  onChange={() => togglePayment(idx)}
                  disabled={!isAdmin}
                />
                {pm.name}
              </label>
            ))}
          </div>
        </Section>

        <Section title="Delivery Zones & Ongkir">
          {settings.delivery_zones.length === 0 && (
            <p className="text-sm text-gray-400">Belum ada zona.</p>
          )}
          <div className="space-y-2">
            {settings.delivery_zones.map((z, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 rounded-lg ring-1 ring-gray-100 p-2 text-sm"
              >
                <input
                  type="text"
                  className="col-span-4 rounded-lg border border-gray-300 px-2 py-1"
                  placeholder="Nama zona"
                  value={z.name}
                  onChange={(e) => updateZone(idx, 'name', e.target.value)}
                  disabled={!isAdmin}
                />
                <input
                  type="number"
                  className="col-span-3 rounded-lg border border-gray-300 px-2 py-1"
                  placeholder="Ongkir"
                  value={z.fee}
                  onChange={(e) => updateZone(idx, 'fee', Number(e.target.value))}
                  disabled={!isAdmin}
                />
                <input
                  type="number"
                  className="col-span-3 rounded-lg border border-gray-300 px-2 py-1"
                  placeholder="Min order"
                  value={z.min_order}
                  onChange={(e) => updateZone(idx, 'min_order', Number(e.target.value))}
                  disabled={!isAdmin}
                />
                <input
                  type="number"
                  className="col-span-1 rounded-lg border border-gray-300 px-2 py-1"
                  placeholder="km"
                  value={z.radius_km}
                  onChange={(e) => updateZone(idx, 'radius_km', Number(e.target.value))}
                  disabled={!isAdmin}
                />
                <button
                  onClick={() => removeZone(idx)}
                  disabled={!isAdmin}
                  className="col-span-1 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  <Trash2 className="mx-auto h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {isAdmin && (
            <button
              onClick={addZone}
              className="mt-2 flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" /> Tambah zona
            </button>
          )}
        </Section>

        <Section title="Kontak & SEO">
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Telepon"
              value={settings.contact_phone || ''}
              onChange={(v) => patch({ contact_phone: v })}
              disabled={!isAdmin}
            />
            <Field
              label="WhatsApp"
              value={settings.contact_whatsapp || ''}
              onChange={(v) => patch({ contact_whatsapp: v })}
              disabled={!isAdmin}
            />
            <Field
              label="Email"
              value={settings.contact_email || ''}
              onChange={(v) => patch({ contact_email: v })}
              disabled={!isAdmin}
            />
            <Field
              label="Instagram"
              value={settings.contact_instagram || ''}
              onChange={(v) => patch({ contact_instagram: v })}
              disabled={!isAdmin}
            />
            <Field
              label="SEO Title"
              value={settings.seo_title || ''}
              onChange={(v) => patch({ seo_title: v })}
              disabled={!isAdmin}
            />
            <Field
              label="GA / FB Pixel ID"
              value={settings.ga_id || ''}
              onChange={(v) => patch({ ga_id: v })}
              disabled={!isAdmin}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">{title}</h3>
      <div className="space-y-3">{children}</div>
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

function NumberField({ label, value, onChange, disabled }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        type="number"
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
      />
    </div>
  );
}
