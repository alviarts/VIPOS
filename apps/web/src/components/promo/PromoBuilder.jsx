// Promo builder dialog — 5-tab wizard untuk 8 jenis promo.
// Pisah dari PromosPage agar reusable + lebih mudah di-test secara isolated.
import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const PROMO_TYPES = [
  {
    value: 'PERCENT',
    label: 'Persentase',
    desc: 'Diskon X% dari subtotal cart atau produk tertentu.',
  },
  {
    value: 'NOMINAL',
    label: 'Nominal',
    desc: 'Diskon Rp X (flat) dari subtotal.',
  },
  {
    value: 'FREE_PRODUCT',
    label: 'Gratis Produk',
    desc: 'Beri produk gratis tanpa syarat tambahan.',
  },
  {
    value: 'BUY_X_GET_Y',
    label: 'BOGO',
    desc: 'Beli X qty, gratis Y qty (misal 2+1).',
  },
  {
    value: 'BUNDLE_PRICE',
    label: 'Bundle Price',
    desc: 'Harga paket khusus untuk kombinasi produk.',
  },
  {
    value: 'MIN_PURCHASE',
    label: 'Min Belanja',
    desc: 'Diskon nominal saat subtotal mencapai threshold.',
  },
  {
    value: 'STEP_DISCOUNT',
    label: 'Step Discount',
    desc: 'Tier-based: makin banyak qty/total, makin besar diskon.',
  },
  {
    value: 'MEMBER_PRICE',
    label: 'Harga Member',
    desc: 'Harga khusus untuk customer di grup tertentu.',
  },
];

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const STEPS = [
  { key: 'basic', label: 'Info' },
  { key: 'rule', label: 'Aturan' },
  { key: 'condition', label: 'Kondisi' },
  { key: 'limit', label: 'Limit' },
  { key: 'review', label: 'Review' },
];

const initForm = () => ({
  name: '',
  description: '',
  promo_type: 'PERCENT',
  discount_value: 0,
  max_discount: '',
  bundle_price: '',
  qty_required: 0,
  give_qty: 0,
  discount_target: 'WHOLE_CART',
  target_product_ids: [],
  target_category_ids: [],
  customer_group_ids: [],
  valid_from: '',
  valid_until: '',
  day_of_week_mask: 127,
  time_of_day_start: '',
  time_of_day_end: '',
  min_purchase: 0,
  max_use_per_customer: 0,
  max_total_use: 0,
  step_tiers: [],
  is_stackable: false,
  requires_coupon: false,
  is_active: true,
});

function fromPromo(promo) {
  if (!promo) return initForm();
  const isoOrEmpty = (v) => (v ? new Date(v).toISOString().slice(0, 16) : '');
  return {
    ...initForm(),
    ...promo,
    description: promo.description ?? '',
    max_discount: promo.max_discount ?? '',
    bundle_price: promo.bundle_price ?? '',
    valid_from: isoOrEmpty(promo.valid_from),
    valid_until: isoOrEmpty(promo.valid_until),
    time_of_day_start: promo.time_of_day_start ?? '',
    time_of_day_end: promo.time_of_day_end ?? '',
    is_stackable: !!promo.is_stackable,
    requires_coupon: !!promo.requires_coupon,
    is_active: promo.is_active === undefined ? true : !!promo.is_active,
  };
}

function toPayload(f) {
  const trimNum = (v, fallback = null) => {
    if (v === '' || v === null || v === undefined) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const isoOrNull = (v) => (v ? new Date(v).toISOString() : null);
  return {
    name: f.name.trim(),
    description: f.description?.trim() || null,
    promo_type: f.promo_type,
    discount_value: trimNum(f.discount_value, 0) || 0,
    max_discount: trimNum(f.max_discount, null),
    bundle_price: trimNum(f.bundle_price, null),
    qty_required: trimNum(f.qty_required, 0) || 0,
    give_qty: trimNum(f.give_qty, 0) || 0,
    discount_target: f.discount_target,
    target_product_ids: (f.target_product_ids || []).map((n) => Number(n)),
    target_category_ids: (f.target_category_ids || []).map((n) => Number(n)),
    customer_group_ids: (f.customer_group_ids || []).map((n) => Number(n)),
    valid_from: isoOrNull(f.valid_from),
    valid_until: isoOrNull(f.valid_until),
    day_of_week_mask: f.day_of_week_mask,
    time_of_day_start: f.time_of_day_start || null,
    time_of_day_end: f.time_of_day_end || null,
    min_purchase: trimNum(f.min_purchase, 0) || 0,
    max_use_per_customer: trimNum(f.max_use_per_customer, 0) || 0,
    max_total_use: trimNum(f.max_total_use, 0) || 0,
    step_tiers: f.step_tiers || [],
    is_stackable: !!f.is_stackable,
    requires_coupon: !!f.requires_coupon,
    is_active: !!f.is_active,
  };
}

function MultiSelect({ label, items, value, onChange, idKey = 'id', labelKey = 'name' }) {
  const safeValue = Array.isArray(value) ? value : [];
  const toggle = (id) => {
    if (safeValue.includes(id)) onChange(safeValue.filter((x) => x !== id));
    else onChange([...safeValue, id]);
  };
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 p-2">
        {items.length === 0 && <p className="text-xs text-gray-400">Tidak ada data tersedia.</p>}
        {items.map((it) => (
          <label key={it[idKey]} className="flex items-center gap-2 py-0.5 text-sm">
            <input
              type="checkbox"
              checked={safeValue.includes(it[idKey])}
              onChange={() => toggle(it[idKey])}
              className="h-4 w-4 rounded border-gray-300 text-primary-600"
            />
            <span>{it[labelKey]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function PromoBuilder({ promo, onClose, onSaved }) {
  const [form, setForm] = useState(() => fromPromo(promo));
  const [step, setStep] = useState(0);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customerGroups, setCustomerGroups] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/products').catch(() => ({ data: { items: [] } })),
      api.get('/categories').catch(() => ({ data: [] })),
      api.get('/customer-groups').catch(() => ({ data: [] })),
    ]).then(([p, c, cg]) => {
      setProducts(p.data?.items || p.data || []);
      setCategories(c.data || []);
      setCustomerGroups(cg.data || []);
    });
  }, []);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const toggleDay = (idx) => {
    const mask = form.day_of_week_mask ^ (1 << idx);
    update({ day_of_week_mask: mask });
  };

  const addStepTier = () =>
    update({
      step_tiers: [
        ...(form.step_tiers || []),
        { min_qty: 0, min_amount: 0, discount_percent: 0, discount_nominal: 0 },
      ],
    });
  const removeStepTier = (i) =>
    update({ step_tiers: form.step_tiers.filter((_, idx) => idx !== i) });
  const updateStepTier = (i, patch) =>
    update({
      step_tiers: form.step_tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)),
    });

  async function save() {
    if (!form.name.trim()) {
      toast.error('Nama promo wajib');
      setStep(0);
      return;
    }
    setSaving(true);
    try {
      const payload = toPayload(form);
      if (promo?.id) {
        await api.put(`/promo/${promo.id}`, payload);
        toast.success('Promo diupdate');
      } else {
        await api.post('/promo', payload);
        toast.success('Promo dibuat');
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      const msg = err.response?.data?.error || 'Gagal menyimpan promo';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const stepTitle = STEPS[step].label;
  const typeMeta = useMemo(
    () => PROMO_TYPES.find((t) => t.value === form.promo_type),
    [form.promo_type]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {promo?.id ? 'Edit Promo' : 'Buat Promo Baru'}
            </h2>
            <p className="text-sm text-gray-500">
              Step {step + 1} dari {STEPS.length} — {stepTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex border-b border-gray-200 px-6">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStep(i)}
              className={`flex-1 border-b-2 py-2 text-xs font-medium transition-colors
                ${
                  i === step
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              {i + 1}. {s.label}
            </button>
          ))}
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          {/* Step 1: basic info + type */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Nama promo <span className="text-red-500">*</span>
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={form.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="cth. Diskon Akhir Tahun 20%"
                  maxLength={120}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Deskripsi</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  rows={2}
                  value={form.description}
                  onChange={(e) => update({ description: e.target.value })}
                  placeholder="Deskripsi yang muncul di kasir/struk."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Jenis Promo</label>
                <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                  {PROMO_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => update({ promo_type: t.value })}
                      className={`rounded-lg border p-3 text-left text-xs transition
                        ${
                          form.promo_type === t.value
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                      <div className="font-semibold">{t.label}</div>
                      <div className="mt-1 text-[11px] text-gray-500">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => update({ is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600"
                  />
                  Aktif
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_stackable}
                    onChange={(e) => update({ is_stackable: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600"
                  />
                  Stackable (bisa dikombinasi)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.requires_coupon}
                    onChange={(e) => update({ requires_coupon: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600"
                  />
                  Wajib pakai kupon
                </label>
              </div>
            </div>
          )}

          {/* Step 2: rule (depend on type) */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-lg bg-primary-50 p-3 text-sm text-primary-800">
                <strong>{typeMeta?.label}:</strong> {typeMeta?.desc}
              </div>
              {(form.promo_type === 'PERCENT' ||
                form.promo_type === 'NOMINAL' ||
                form.promo_type === 'MIN_PURCHASE' ||
                form.promo_type === 'MEMBER_PRICE') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      {form.promo_type === 'PERCENT' ? 'Persentase (%)' : 'Nominal (Rp)'}
                    </label>
                    <input
                      type="number"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      value={form.discount_value}
                      onChange={(e) => update({ discount_value: e.target.value })}
                      min={0}
                      max={form.promo_type === 'PERCENT' ? 100 : undefined}
                    />
                  </div>
                  {form.promo_type === 'PERCENT' && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Maks Diskon (Rp)</label>
                      <input
                        type="number"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                        value={form.max_discount}
                        onChange={(e) => update({ max_discount: e.target.value })}
                        placeholder="kosongkan = tanpa cap"
                      />
                    </div>
                  )}
                </div>
              )}

              {(form.promo_type === 'BUY_X_GET_Y' || form.promo_type === 'FREE_PRODUCT') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Beli (qty)</label>
                    <input
                      type="number"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      value={form.qty_required}
                      onChange={(e) => update({ qty_required: e.target.value })}
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Gratis (qty)</label>
                    <input
                      type="number"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      value={form.give_qty}
                      onChange={(e) => update({ give_qty: e.target.value })}
                      min={0}
                    />
                  </div>
                </div>
              )}

              {form.promo_type === 'BUNDLE_PRICE' && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Harga Paket (Rp)</label>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    value={form.bundle_price}
                    onChange={(e) => update({ bundle_price: e.target.value })}
                    min={0}
                  />
                </div>
              )}

              {form.promo_type === 'STEP_DISCOUNT' && (
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Tier Diskon</label>
                    <button
                      type="button"
                      onClick={addStepTier}
                      className="flex items-center gap-1 rounded-lg bg-primary-600 px-2 py-1 text-xs text-white"
                    >
                      <Plus className="h-3 w-3" /> Tambah
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {(form.step_tiers || []).map((t, i) => (
                      <div key={i} className="grid grid-cols-5 gap-2">
                        <input
                          type="number"
                          placeholder="Min Qty"
                          className="rounded border border-gray-300 px-2 py-1 text-sm"
                          value={t.min_qty || 0}
                          onChange={(e) => updateStepTier(i, { min_qty: Number(e.target.value) })}
                        />
                        <input
                          type="number"
                          placeholder="Min Total"
                          className="rounded border border-gray-300 px-2 py-1 text-sm"
                          value={t.min_amount || 0}
                          onChange={(e) =>
                            updateStepTier(i, { min_amount: Number(e.target.value) })
                          }
                        />
                        <input
                          type="number"
                          placeholder="% Off"
                          className="rounded border border-gray-300 px-2 py-1 text-sm"
                          value={t.discount_percent || 0}
                          onChange={(e) =>
                            updateStepTier(i, {
                              discount_percent: Number(e.target.value),
                            })
                          }
                        />
                        <input
                          type="number"
                          placeholder="Rp Off"
                          className="rounded border border-gray-300 px-2 py-1 text-sm"
                          value={t.discount_nominal || 0}
                          onChange={(e) =>
                            updateStepTier(i, {
                              discount_nominal: Number(e.target.value),
                            })
                          }
                        />
                        <button
                          type="button"
                          onClick={() => removeStepTier(i)}
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">Target diskon</label>
                <select
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.discount_target}
                  onChange={(e) => update({ discount_target: e.target.value })}
                >
                  <option value="WHOLE_CART">Seluruh keranjang</option>
                  <option value="TARGET_PRODUCTS">Hanya produk target</option>
                  <option value="CHEAPEST_OF_TARGET">Produk termurah dari target</option>
                  <option value="MOST_EXPENSIVE_OF_TARGET">Produk termahal dari target</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 3: conditions */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Min belanja (Rp)</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={form.min_purchase}
                  onChange={(e) => update({ min_purchase: e.target.value })}
                  min={0}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Berlaku sejak</label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    value={form.valid_from}
                    onChange={(e) => update({ valid_from: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Berlaku sampai</label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    value={form.valid_until}
                    onChange={(e) => update({ valid_until: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Hari aktif</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DAY_LABELS.map((d, i) => {
                    const active = ((form.day_of_week_mask >> i) & 1) === 1;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={`rounded-lg border px-3 py-1 text-xs ${
                          active
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 text-gray-500'
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Jam mulai</label>
                  <input
                    type="time"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    value={form.time_of_day_start}
                    onChange={(e) => update({ time_of_day_start: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Jam selesai</label>
                  <input
                    type="time"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    value={form.time_of_day_end}
                    onChange={(e) => update({ time_of_day_end: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <MultiSelect
                  label="Produk target"
                  items={products}
                  value={form.target_product_ids}
                  onChange={(v) => update({ target_product_ids: v })}
                />
                <MultiSelect
                  label="Kategori target"
                  items={categories}
                  value={form.target_category_ids}
                  onChange={(v) => update({ target_category_ids: v })}
                />
                <MultiSelect
                  label="Grup customer"
                  items={customerGroups}
                  value={form.customer_group_ids}
                  onChange={(v) => update({ customer_group_ids: v })}
                />
              </div>
            </div>
          )}

          {/* Step 4: limits */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Maks pakai per customer (0 = tak terbatas)
                </label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={form.max_use_per_customer}
                  onChange={(e) => update({ max_use_per_customer: e.target.value })}
                  min={0}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Maks total pemakaian (0 = tak terbatas)
                </label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={form.max_total_use}
                  onChange={(e) => update({ max_total_use: e.target.value })}
                  min={0}
                />
              </div>
            </div>
          )}

          {/* Step 5: review */}
          {step === 4 && (
            <div className="space-y-2 rounded-lg bg-gray-50 p-4 text-sm">
              <div>
                <strong>Nama:</strong> {form.name || '(belum diisi)'}
              </div>
              <div>
                <strong>Jenis:</strong> {typeMeta?.label}
              </div>
              <div>
                <strong>Nilai:</strong>{' '}
                {form.promo_type === 'PERCENT'
                  ? `${form.discount_value}%`
                  : form.promo_type === 'BUNDLE_PRICE'
                    ? `Rp ${Number(form.bundle_price || 0).toLocaleString('id-ID')}`
                    : `Rp ${Number(form.discount_value || 0).toLocaleString('id-ID')}`}
              </div>
              <div>
                <strong>Min belanja:</strong> Rp{' '}
                {Number(form.min_purchase || 0).toLocaleString('id-ID')}
              </div>
              <div>
                <strong>Periode:</strong> {form.valid_from || '—'} s/d {form.valid_until || '—'}
              </div>
              <div>
                <strong>Wajib kupon:</strong> {form.requires_coupon ? 'Ya' : 'Tidak'}
              </div>
              <div>
                <strong>Stackable:</strong> {form.is_stackable ? 'Ya' : 'Tidak'}
              </div>
              <div>
                <strong>Aktif:</strong> {form.is_active ? 'Ya' : 'Tidak'}
              </div>
            </div>
          )}
        </div>

        {/* Footer with nav buttons */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3">
          <button
            type="button"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-40"
          >
            Kembali
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              Batal
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Lanjut
              </button>
            ) : (
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { PROMO_TYPES };
