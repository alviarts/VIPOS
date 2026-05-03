import { useEffect, useMemo, useState } from 'react';
import { Check, Lock, X, ChevronDown } from 'lucide-react';
import { Toggle } from './ui';

/**
 * Multi-tab wizard form for product CRUD, modeled on Majoo's "Tambahkan Produk".
 * 5 tabs: Informasi Produk | Varian | Ekstra | Resep | majoo Order.
 *
 * Only the Informasi tab is fully functional in VIPOS (others are placeholders that
 * mirror Majoo's "Prime only" / locked-feature behavior).
 *
 * Props:
 *   open, onClose, onSubmit(payload), initialData (for edit), categories
 */
const TABS = [
  { id: 'info', label: 'Informasi Produk' },
  { id: 'varian', label: 'Varian', locked: true, lockReason: 'Fitur paket Prime' },
  { id: 'ekstra', label: 'Ekstra' },
  { id: 'resep', label: 'Resep', locked: true, lockReason: 'Fitur paket Advance / Prime' },
  { id: 'order', label: 'majoo Order', locked: true, lockReason: 'Memerlukan integrasi outlet' },
];

const DEFAULT_FORM = {
  name: '',
  description: '',
  category_id: '',
  sku: '',
  barcode: '',
  satuan: 'pcs',
  price: '',
  harga_modal: '',
  harga_beli: '',
  stock: '0',
  stok_minimum: '0',
  is_tampil_di_menu: true,
  is_favorit: false,
  monitor_stok: false,
  has_ekstra: false,
};

export default function ProductWizardForm({
  open,
  onClose,
  onSubmit,
  initialData = null,
  categories = [],
}) {
  const isEdit = Boolean(initialData);
  const [tab, setTab] = useState('info');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab('info');
    if (initialData) {
      setForm({
        name: initialData.name || '',
        description: initialData.description || '',
        category_id: initialData.category_id ? String(initialData.category_id) : '',
        sku: initialData.sku || '',
        barcode: initialData.barcode || '',
        satuan: initialData.satuan || 'pcs',
        price: initialData.price ? String(initialData.price) : '',
        harga_modal: initialData.harga_modal ? String(initialData.harga_modal) : '',
        harga_beli: initialData.harga_beli ? String(initialData.harga_beli) : '',
        stock: String(initialData.stock ?? 0),
        stok_minimum: String(initialData.stok_minimum ?? 0),
        is_tampil_di_menu: !!initialData.is_tampil_di_menu,
        is_favorit: !!initialData.is_favorit,
        monitor_stok: !!initialData.monitor_stok,
        has_ekstra: false,
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setErrors({});
  }, [open, initialData]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const tabComplete = useMemo(
    () => ({
      info:
        form.name.trim().length > 0 &&
        form.sku.trim().length > 0 &&
        form.category_id !== '' &&
        String(form.price).trim().length > 0,
      ekstra: true,
    }),
    [form]
  );

  if (!open) return null;

  const visibleTabs = TABS;

  const validateInfo = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Nama Produk wajib diisi';
    if (!form.sku.trim()) errs.sku = 'SKU wajib diisi';
    if (!form.category_id) errs.category_id = 'Kategori wajib dipilih';
    if (!String(form.price).trim()) errs.price = 'Harga Jual wajib diisi';
    else if (!Number.isFinite(parseFloat(form.price)) || parseFloat(form.price) < 0)
      errs.price = 'Harga Jual harus berupa angka >= 0';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goNext = () => {
    if (tab === 'info') {
      if (!validateInfo()) return;
    }
    const idx = visibleTabs.findIndex((t) => t.id === tab);
    let nextIdx = idx + 1;
    while (nextIdx < visibleTabs.length && visibleTabs[nextIdx].locked) nextIdx += 1;
    if (nextIdx >= visibleTabs.length) {
      handleSave();
    } else {
      setTab(visibleTabs[nextIdx].id);
    }
  };

  const goBack = () => {
    const idx = visibleTabs.findIndex((t) => t.id === tab);
    let prevIdx = idx - 1;
    while (prevIdx >= 0 && visibleTabs[prevIdx].locked) prevIdx -= 1;
    if (prevIdx >= 0) setTab(visibleTabs[prevIdx].id);
  };

  const handleSave = async () => {
    if (!validateInfo()) {
      setTab('info');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category_id: form.category_id ? parseInt(form.category_id, 10) : null,
        sku: form.sku.trim(),
        barcode: form.barcode.trim() || null,
        satuan: form.satuan.trim() || 'pcs',
        price: parseFloat(form.price) || 0,
        harga_modal: parseFloat(form.harga_modal) || 0,
        harga_beli: parseFloat(form.harga_beli) || 0,
        stock: parseInt(form.stock, 10) || 0,
        stok_minimum: parseInt(form.stok_minimum, 10) || 0,
        is_tampil_di_menu: form.is_tampil_di_menu ? 1 : 0,
        is_favorit: form.is_favorit ? 1 : 0,
        monitor_stok: form.monitor_stok ? 1 : 0,
      };
      await onSubmit?.(payload);
    } finally {
      setSaving(false);
    }
  };

  const lastTabIdx = (() => {
    for (let i = visibleTabs.length - 1; i >= 0; i--) {
      if (!visibleTabs[i].locked) return i;
    }
    return 0;
  })();
  const isLast = visibleTabs.findIndex((t) => t.id === tab) === lastTabIdx;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 truncate">
            {isEdit ? 'Ubah Produk' : 'Tambahkan Produk'}
          </h2>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm text-gray-400">
          <span>VIPOS</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-6 border-b border-gray-200 bg-white overflow-x-auto">
        <div className="flex">
          {visibleTabs.map((t) => {
            const active = t.id === tab;
            const complete = tabComplete[t.id];
            return (
              <button
                key={t.id}
                onClick={() => !t.locked && setTab(t.id)}
                disabled={t.locked}
                className={`relative px-4 py-3 text-sm whitespace-nowrap transition-colors flex items-center gap-2
                  ${active ? 'text-primary-600 font-semibold' : 'text-gray-500 hover:text-gray-700'}
                  ${t.locked ? 'opacity-60 cursor-not-allowed' : ''}`}
                title={t.locked ? t.lockReason : ''}
              >
                {complete && !active && <Check className="w-4 h-4 text-primary-500" />}
                {t.locked && <Lock className="w-3.5 h-3.5" />}
                <span>{t.label}</span>
                {active && (
                  <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-primary-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
          {tab === 'info' && (
            <InfoTab form={form} set={set} errors={errors} categories={categories} />
          )}
          {tab === 'varian' && (
            <LockedTab title="Varian" reason="Fitur ini tersedia di paket Prime." />
          )}
          {tab === 'ekstra' && <EkstraTab form={form} set={set} />}
          {tab === 'resep' && (
            <LockedTab title="Resep" reason="Fitur ini tersedia di paket Advance / Prime." />
          )}
          {tab === 'order' && (
            <LockedTab
              title="majoo Order"
              reason="Perlu mengajukan integrasi outlet terlebih dahulu."
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-4 sm:px-6 py-3 bg-white flex items-center justify-between">
        <button
          onClick={onClose}
          className="text-primary-600 hover:bg-primary-50 px-3 py-2 rounded-lg text-sm font-medium"
        >
          Batal
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={goBack}
            disabled={tab === 'info'}
            className="text-gray-500 hover:bg-gray-100 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Kembali
          </button>
          {!isLast && (
            <button
              onClick={goNext}
              className="text-primary-600 hover:bg-primary-50 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Selanjutnya
            </button>
          )}
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, error, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function Section({ title, description, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function InfoTab({ form, set, errors, categories }) {
  return (
    <>
      <Section title="Informasi Produk" description="Data umum produk yang akan tampil di kasir">
        <Field label="Nama Produk" required error={errors.name}>
          <textarea
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Contoh: Nasi Goreng Spesial"
            maxLength={255}
            rows={2}
            className="input-field resize-none"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{form.name.length}/255</p>
        </Field>

        <Field label="Deskripsi Produk" hint="Opsional. Contoh: yang best seller">
          <textarea
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="Tambahkan deskripsi produk..."
            rows={2}
            className="input-field resize-none"
          />
        </Field>

        <Field label="Kategori Produk" required error={errors.category_id}>
          <div className="relative">
            <select
              value={form.category_id}
              onChange={(e) => set({ category_id: e.target.value })}
              className="input-field appearance-none pr-10"
            >
              <option value="">Pilih kategori...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
          </div>
        </Field>

        <div className="pt-2 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-3">Opsi Lanjutan</p>
          <div className="space-y-3">
            <Toggle
              checked={form.is_tampil_di_menu}
              onChange={(v) => set({ is_tampil_di_menu: v })}
              label="Tampil di Menu"
              description="Produk ditampilkan di aplikasi kasir VIPOS"
            />
            <Toggle
              checked={form.is_favorit}
              onChange={(v) => set({ is_favorit: v })}
              label="Produk Favorit"
              description="Tampilkan di shortcut produk favorit kasir"
            />
            <Toggle
              checked={form.monitor_stok}
              onChange={(v) => set({ monitor_stok: v })}
              label="Monitor Persediaan"
              description="Aktifkan untuk peringatan saat stok di bawah minimum"
            />
            {form.monitor_stok && (
              <Field label="Stok Minimum Produk">
                <input
                  type="number"
                  min="0"
                  value={form.stok_minimum}
                  onChange={(e) => set({ stok_minimum: e.target.value })}
                  className="input-field"
                />
              </Field>
            )}
          </div>
        </div>
      </Section>

      <Section title="Harga dan Satuan" description="Detail harga dan unit penjualan">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Satuan">
            <input
              type="text"
              value={form.satuan}
              onChange={(e) => set({ satuan: e.target.value })}
              placeholder="pcs / porsi / gelas"
              className="input-field"
            />
          </Field>
          <Field label="SKU" required error={errors.sku}>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => set({ sku: e.target.value })}
              placeholder="Contoh: S001"
              className="input-field"
            />
          </Field>
          <Field label="Barcode">
            <input
              type="text"
              value={form.barcode}
              onChange={(e) => set({ barcode: e.target.value })}
              placeholder="Opsional"
              className="input-field"
            />
          </Field>
          <Field label="Stok Awal">
            <input
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => set({ stock: e.target.value })}
              className="input-field"
            />
          </Field>
          <Field label="Harga Jual" required error={errors.price}>
            <CurrencyInput value={form.price} onChange={(v) => set({ price: v })} />
          </Field>
          <Field label="Harga Modal" hint="HPP / cost price">
            <CurrencyInput value={form.harga_modal} onChange={(v) => set({ harga_modal: v })} />
          </Field>
          <Field label="Harga Beli">
            <CurrencyInput value={form.harga_beli} onChange={(v) => set({ harga_beli: v })} />
          </Field>
        </div>
      </Section>
    </>
  );
}

function EkstraTab({ form, set }) {
  return (
    <Section
      title="Ekstra"
      description="Tambahkan ekstra (saus, topping, dll) yang bisa dipilih kasir saat checkout"
    >
      <Toggle
        checked={form.has_ekstra}
        onChange={(v) => set({ has_ekstra: v })}
        label="Produk Memiliki Ekstra"
        description="Aktifkan untuk menampilkan opsi ekstra di kasir"
      />
      {form.has_ekstra && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-500">
            Pengaturan ekstra detail akan tersedia setelah produk disimpan.
          </p>
        </div>
      )}
    </Section>
  );
}

function LockedTab({ title, reason }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-3">
        <Lock className="w-5 h-5 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-md mx-auto">{reason}</p>
    </div>
  );
}

function CurrencyInput({ value, onChange, placeholder = '0' }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">Rp</span>
      <input
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="input-field pl-9"
      />
    </div>
  );
}
