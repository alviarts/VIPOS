import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

function lineSubtotal(qty, unit_price, discount_percent) {
  const q = Number(qty) || 0;
  const u = Number(unit_price) || 0;
  const d = Number(discount_percent) || 0;
  const gross = q * u;
  return Math.round((gross - (gross * d) / 100) * 100) / 100;
}

function formatRp(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

const initItem = () => ({
  product_id: null,
  product_name: '',
  qty: 1,
  unit_price: 0,
  discount_percent: 0,
});

const initForm = (overrides = {}) => ({
  customer_id: null,
  customer_name: '',
  date: new Date().toISOString().slice(0, 10),
  due_or_until: '',
  status: '',
  tax_percent: 11,
  discount_amount: 0,
  notes: '',
  terms: '',
  down_payment: 0,
  carrier: '',
  driver: '',
  expected_arrival: '',
  signature_url: '',
  items: [initItem()],
  ...overrides,
});

/**
 * Reusable form builder for the 4 main B2B documents (Quotation, SO, DO, Invoice).
 * Receipt has its own simpler dialog inline in ReceiptsPage.
 */
export default function B2BDocumentBuilder({
  open,
  kind, // 'quotation' | 'sales-order' | 'delivery-order' | 'invoice'
  initial,
  onClose,
  onSaved,
  prefilledFromSO = null,
}) {
  const [form, setForm] = useState(initForm());
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [salesOrders, setSalesOrders] = useState([]);

  const isDelivery = kind === 'delivery-order';
  const isInvoice = kind === 'invoice';

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        ...initForm(),
        customer_id: initial.customer_id ?? null,
        customer_name: initial.customer_name || '',
        date:
          initial.quote_date ||
          initial.order_date ||
          initial.delivery_date ||
          initial.invoice_date ||
          new Date().toISOString().slice(0, 10),
        due_or_until: initial.valid_until || initial.expected_delivery || initial.due_date || '',
        status: initial.status || '',
        tax_percent: initial.tax_percent ?? 11,
        discount_amount: initial.discount_amount ?? 0,
        notes: initial.notes || '',
        terms: initial.terms || '',
        down_payment: initial.down_payment ?? 0,
        carrier: initial.carrier || '',
        driver: initial.driver || '',
        expected_arrival: initial.expected_arrival || '',
        signature_url: initial.signature_url || '',
        sales_order_id: initial.sales_order_id ?? null,
        items: (initial.items || []).map((it) => ({
          id: it.id,
          sales_order_item_id: it.sales_order_item_id,
          product_id: it.product_id,
          product_name: it.product_name,
          qty: it.qty,
          unit_price: it.unit_price ?? 0,
          discount_percent: it.discount_percent ?? 0,
        })),
      });
    } else if (prefilledFromSO) {
      setForm({
        ...initForm(),
        customer_id: prefilledFromSO.customer_id ?? null,
        customer_name: prefilledFromSO.customer_name || '',
        sales_order_id: prefilledFromSO.id,
        items: (prefilledFromSO.items || []).map((it) => ({
          sales_order_item_id: it.id,
          product_id: it.product_id,
          product_name: it.product_name,
          qty: isDelivery
            ? Math.max(Number(it.qty) - Number(it.qty_delivered || 0), 0)
            : isInvoice
              ? Math.max(Number(it.qty) - Number(it.qty_invoiced || 0), 0)
              : it.qty,
          unit_price: it.unit_price ?? 0,
          discount_percent: it.discount_percent ?? 0,
        })),
        tax_percent: prefilledFromSO.tax_percent ?? 11,
      });
    } else {
      setForm(initForm());
    }
    api
      .get('/customers?limit=200')
      .then((r) => setCustomers(r.data?.items || r.data || []))
      .catch(() => {});
    api
      .get('/products?limit=500')
      .then((r) => setProducts(r.data?.products || r.data || []))
      .catch(() => {});
    if (kind === 'delivery-order' || kind === 'invoice') {
      api
        .get('/sales-order')
        .then((r) => setSalesOrders(r.data || []))
        .catch(() => {});
    }
  }, [open, initial, prefilledFromSO, kind, isDelivery, isInvoice]);

  const totals = useMemo(() => {
    const subtotal = form.items.reduce(
      (acc, it) => acc + lineSubtotal(it.qty, it.unit_price, it.discount_percent),
      0
    );
    const afterDiscount = Math.max(subtotal - (Number(form.discount_amount) || 0), 0);
    const tax = (afterDiscount * (Number(form.tax_percent) || 0)) / 100;
    return {
      subtotal,
      tax,
      total: afterDiscount + tax,
    };
  }, [form.items, form.tax_percent, form.discount_amount]);

  function update(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }
  function setItem(idx, patch) {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  }
  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, initItem()] }));
  }
  function removeItem(idx) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }
  function pickProduct(idx, pid) {
    const p = products.find((x) => x.id === Number(pid));
    if (!p) return;
    setItem(idx, { product_id: p.id, product_name: p.name, unit_price: p.price });
  }
  function pickCustomer(cid) {
    const c = customers.find((x) => x.id === Number(cid));
    if (!c) return update({ customer_id: null });
    update({ customer_id: c.id, customer_name: c.name });
  }
  function pickSO(soid) {
    const so = salesOrders.find((x) => x.id === Number(soid));
    if (!so) return;
    api.get(`/sales-order/${soid}`).then((r) => {
      const detail = r.data;
      setForm({
        ...initForm(),
        sales_order_id: detail.id,
        customer_id: detail.customer_id,
        customer_name: detail.customer_name,
        date: form.date,
        tax_percent: detail.tax_percent ?? 11,
        items: (detail.items || []).map((it) => ({
          sales_order_item_id: it.id,
          product_id: it.product_id,
          product_name: it.product_name,
          qty: isDelivery
            ? Math.max(Number(it.qty) - Number(it.qty_delivered || 0), 0)
            : isInvoice
              ? Math.max(Number(it.qty) - Number(it.qty_invoiced || 0), 0)
              : it.qty,
          unit_price: it.unit_price ?? 0,
          discount_percent: it.discount_percent ?? 0,
        })),
      });
    });
  }

  async function save() {
    if (!isDelivery && !form.customer_name?.trim()) {
      toast.error('Nama customer wajib diisi');
      return;
    }
    if (!form.items.length || form.items.some((it) => !it.product_name || !it.qty)) {
      toast.error('Minimal 1 item dengan nama + qty');
      return;
    }
    setSaving(true);
    try {
      const cleanedItems = form.items.map((it) => ({
        sales_order_item_id: it.sales_order_item_id ?? null,
        product_id: it.product_id ?? null,
        product_name: it.product_name,
        qty: Number(it.qty),
        unit_price: Number(it.unit_price) || 0,
        discount_percent: Number(it.discount_percent) || 0,
      }));
      let payload;
      if (kind === 'quotation') {
        payload = {
          customer_id: form.customer_id ?? null,
          customer_name: form.customer_name.trim(),
          quote_date: form.date,
          valid_until: form.due_or_until || null,
          status: form.status || undefined,
          tax_percent: Number(form.tax_percent) || 0,
          discount_amount: Number(form.discount_amount) || 0,
          notes: form.notes?.trim() || null,
          terms: form.terms?.trim() || null,
          items: cleanedItems,
        };
      } else if (kind === 'sales-order') {
        payload = {
          customer_id: form.customer_id ?? null,
          customer_name: form.customer_name.trim(),
          order_date: form.date,
          expected_delivery: form.due_or_until || null,
          status: form.status || undefined,
          tax_percent: Number(form.tax_percent) || 0,
          discount_amount: Number(form.discount_amount) || 0,
          notes: form.notes?.trim() || null,
          items: cleanedItems,
        };
      } else if (kind === 'delivery-order') {
        if (!form.sales_order_id) {
          toast.error('Pilih sales order dulu');
          setSaving(false);
          return;
        }
        payload = {
          sales_order_id: Number(form.sales_order_id),
          delivery_date: form.date,
          expected_arrival: form.expected_arrival || null,
          carrier: form.carrier || null,
          driver: form.driver || null,
          status: form.status || undefined,
          notes: form.notes?.trim() || null,
          signature_url: form.signature_url || null,
          items: cleanedItems.map((it) => ({
            sales_order_item_id: it.sales_order_item_id ?? null,
            product_id: it.product_id ?? null,
            product_name: it.product_name,
            qty: it.qty,
          })),
        };
      } else if (kind === 'invoice') {
        payload = {
          sales_order_id: form.sales_order_id ?? null,
          customer_id: form.customer_id ?? null,
          customer_name: form.customer_name.trim(),
          invoice_date: form.date,
          due_date: form.due_or_until || null,
          status: form.status || undefined,
          tax_percent: Number(form.tax_percent) || 0,
          discount_amount: Number(form.discount_amount) || 0,
          down_payment: Number(form.down_payment) || 0,
          notes: form.notes?.trim() || null,
          items: cleanedItems,
        };
      }
      const url = `/${kind}`;
      if (initial?.id) {
        await api.put(`${url}/${initial.id}`, payload);
        toast.success('Tersimpan');
      } else {
        await api.post(url, payload);
        toast.success('Tersimpan');
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const titles = {
    quotation: initial ? 'Edit Penawaran' : 'Buat Penawaran',
    'sales-order': initial ? 'Edit Sales Order' : 'Buat Sales Order',
    'delivery-order': initial ? 'Edit Pengiriman' : 'Buat Pengiriman',
    invoice: initial ? 'Edit Invoice' : 'Buat Invoice',
  };

  const dueLabel = {
    quotation: 'Berlaku hingga',
    'sales-order': 'Tgl. ekspektasi kirim',
    'delivery-order': '—',
    invoice: 'Jatuh tempo',
  }[kind];

  const statusOptions = {
    quotation: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
    'sales-order': ['NEW', 'PARTIAL', 'FULFILLED', 'CANCELLED'],
    'delivery-order': ['PREPARING', 'IN_TRANSIT', 'DELIVERED', 'RETURNED'],
    invoice: ['ISSUED', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID'],
  }[kind];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold">{titles[kind]}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {(kind === 'delivery-order' || kind === 'invoice') && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Sales Order {kind === 'delivery-order' ? '*' : '(opsional)'}
              </label>
              <select
                value={form.sales_order_id ?? ''}
                onChange={(e) => pickSO(e.target.value)}
                className="input w-full"
                disabled={!!initial}
              >
                <option value="">— pilih SO —</option>
                {salesOrders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.number} · {s.customer_name} · {formatRp(s.total)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Customer *</label>
              <select
                value={form.customer_id ?? ''}
                onChange={(e) => pickCustomer(e.target.value)}
                className="input w-full"
                disabled={isDelivery}
              >
                <option value="">— pilih atau ketik manual —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={form.customer_name}
                onChange={(e) => update({ customer_name: e.target.value })}
                className="input w-full mt-1"
                placeholder="Nama customer (atau pilih dari list)"
                disabled={isDelivery}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tanggal *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => update({ date: e.target.value })}
                  className="input w-full"
                />
              </div>
              {kind !== 'delivery-order' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{dueLabel}</label>
                  <input
                    type="date"
                    value={form.due_or_until}
                    onChange={(e) => update({ due_or_until: e.target.value })}
                    className="input w-full"
                  />
                </div>
              )}
            </div>
          </div>

          {kind === 'delivery-order' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Estimasi tiba</label>
                <input
                  type="date"
                  value={form.expected_arrival}
                  onChange={(e) => update({ expected_arrival: e.target.value })}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Carrier</label>
                <input
                  type="text"
                  value={form.carrier}
                  onChange={(e) => update({ carrier: e.target.value })}
                  className="input w-full"
                  placeholder="JNE, sicepat, internal"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Driver</label>
                <input
                  type="text"
                  value={form.driver}
                  onChange={(e) => update({ driver: e.target.value })}
                  className="input w-full"
                />
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-700">Items</div>
              <button onClick={addItem} className="btn-secondary text-xs flex items-center gap-1">
                <Plus className="w-3 h-3" /> Tambah Item
              </button>
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="px-2 py-2 text-left">Produk</th>
                    <th className="px-2 py-2 text-right w-20">Qty</th>
                    {!isDelivery && <th className="px-2 py-2 text-right w-32">Harga Satuan</th>}
                    {!isDelivery && <th className="px-2 py-2 text-right w-20">Disc %</th>}
                    {!isDelivery && <th className="px-2 py-2 text-right w-32">Subtotal</th>}
                    <th className="px-2 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, idx) => (
                    <tr key={idx} className="border-t border-gray-100">
                      <td className="px-2 py-1">
                        <select
                          value={it.product_id ?? ''}
                          onChange={(e) => pickProduct(idx, e.target.value)}
                          className="input w-full text-xs mb-1"
                        >
                          <option value="">— pilih produk —</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({formatRp(p.price)})
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={it.product_name}
                          onChange={(e) => setItem(idx, { product_name: e.target.value })}
                          placeholder="Nama produk (manual)"
                          className="input w-full text-xs"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.qty}
                          onChange={(e) => setItem(idx, { qty: e.target.value })}
                          className="input w-full text-right text-xs"
                        />
                      </td>
                      {!isDelivery && (
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            min="0"
                            value={it.unit_price}
                            onChange={(e) => setItem(idx, { unit_price: e.target.value })}
                            className="input w-full text-right text-xs"
                          />
                        </td>
                      )}
                      {!isDelivery && (
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={it.discount_percent}
                            onChange={(e) => setItem(idx, { discount_percent: e.target.value })}
                            className="input w-full text-right text-xs"
                          />
                        </td>
                      )}
                      {!isDelivery && (
                        <td className="px-2 py-1 text-right text-xs text-gray-600">
                          {formatRp(lineSubtotal(it.qty, it.unit_price, it.discount_percent))}
                        </td>
                      )}
                      <td className="px-2 py-1 text-right">
                        <button
                          onClick={() => removeItem(idx)}
                          disabled={form.items.length <= 1}
                          className="p-1 text-red-500 hover:bg-red-50 rounded disabled:opacity-30"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {!isDelivery && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Diskon (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={form.discount_amount}
                  onChange={(e) => update({ discount_amount: e.target.value })}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Pajak %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.tax_percent}
                  onChange={(e) => update({ tax_percent: e.target.value })}
                  className="input w-full"
                />
              </div>
              {kind === 'invoice' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">DP / Down Payment</label>
                  <input
                    type="number"
                    min="0"
                    value={form.down_payment}
                    onChange={(e) => update({ down_payment: e.target.value })}
                    className="input w-full"
                  />
                </div>
              )}
            </div>
          )}

          {!isDelivery && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatRp(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Diskon</span>
                <span>- {formatRp(form.discount_amount || 0)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Pajak ({form.tax_percent || 0}%)</span>
                <span>{formatRp(totals.tax)}</span>
              </div>
              <div className="border-t border-gray-300 mt-2 pt-2 flex justify-between font-bold text-base">
                <span>Total</span>
                <span>{formatRp(totals.total)}</span>
              </div>
              {kind === 'invoice' && Number(form.down_payment) > 0 && (
                <>
                  <div className="flex justify-between text-gray-600">
                    <span>DP</span>
                    <span>- {formatRp(form.down_payment)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-primary-700">
                    <span>Outstanding</span>
                    <span>{formatRp(totals.total - Number(form.down_payment))}</span>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {!!statusOptions && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => update({ status: e.target.value })}
                  className="input w-full"
                >
                  <option value="">(default)</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Catatan</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => update({ notes: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>

          {kind === 'quotation' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Terms & Conditions</label>
              <textarea
                value={form.terms}
                onChange={(e) => update({ terms: e.target.value })}
                rows={3}
                className="input w-full"
              />
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="btn-secondary">
            Batal
          </button>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
