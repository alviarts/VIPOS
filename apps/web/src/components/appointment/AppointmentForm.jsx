// Reusable appointment form (P1-13). Dipakai di list page (modal create/edit)
// dan calendar page (klik slot kosong → prefill).
import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

function emptyService() {
  return {
    product_id: null,
    service_name: '',
    qty: 1,
    price: 0,
    duration_minutes: 30,
  };
}

function isoToLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localToIso(local) {
  if (!local) return null;
  return new Date(local).toISOString();
}

export default function AppointmentForm({
  appointment,
  initialStartAt,
  staff = [],
  resources = [],
  customers = [],
  products = [],
  onClose,
  onSaved,
}) {
  const isEdit = !!appointment;
  const [form, setForm] = useState(() => ({
    customer_id: appointment?.customer_id ?? null,
    customer_name: appointment?.customer_name ?? '',
    customer_phone: appointment?.customer_phone ?? '',
    staff_id: appointment?.staff_id ?? null,
    resource_id: appointment?.resource_id ?? null,
    start_at:
      isoToLocal(appointment?.start_at) || (initialStartAt ? isoToLocal(initialStartAt) : ''),
    duration_minutes: appointment?.duration_minutes ?? 0,
    notes: appointment?.notes ?? '',
    deposit_amount: appointment?.deposit_amount ?? 0,
    services:
      appointment?.services?.length > 0
        ? appointment.services.map((s) => ({
            product_id: s.product_id ?? null,
            service_name: s.service_name,
            qty: s.qty,
            price: s.price,
            duration_minutes: s.duration_minutes ?? 30,
          }))
        : [emptyService()],
  }));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialStartAt && !appointment) {
      setForm((f) => ({ ...f, start_at: isoToLocal(initialStartAt) }));
    }
  }, [initialStartAt, appointment]);

  const totals = useMemo(() => {
    let total = 0;
    let duration = 0;
    for (const s of form.services) {
      const qty = Number(s.qty) || 1;
      total += (Number(s.price) || 0) * qty;
      duration += (Number(s.duration_minutes) || 0) * qty;
    }
    return { total, duration };
  }, [form.services]);

  const effectiveDuration =
    Number(form.duration_minutes) > 0 ? Number(form.duration_minutes) : totals.duration || 30;

  function addService() {
    setForm({ ...form, services: [...form.services, emptyService()] });
  }
  function removeService(idx) {
    const services = [...form.services];
    services.splice(idx, 1);
    setForm({
      ...form,
      services: services.length ? services : [emptyService()],
    });
  }
  function updateService(idx, k, v) {
    const services = [...form.services];
    services[idx] = { ...services[idx], [k]: v };
    setForm({ ...form, services });
  }
  function pickProduct(idx, productId) {
    const product = products.find((p) => String(p.id) === String(productId));
    if (!product) {
      updateService(idx, 'product_id', null);
      return;
    }
    const services = [...form.services];
    services[idx] = {
      ...services[idx],
      product_id: product.id,
      service_name: product.nama || services[idx].service_name,
      price: product.harga ?? services[idx].price,
    };
    setForm({ ...form, services });
  }

  async function save() {
    if (!form.customer_name.trim()) {
      toast.error('Nama customer wajib');
      return;
    }
    if (!form.start_at) {
      toast.error('Waktu mulai wajib');
      return;
    }
    if (!form.services.length || !form.services[0].service_name) {
      toast.error('Minimal 1 layanan');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        customer_id: form.customer_id || null,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone || null,
        staff_id: form.staff_id || null,
        resource_id: form.resource_id || null,
        start_at: localToIso(form.start_at),
        duration_minutes: Number(form.duration_minutes) || totals.duration || 30,
        notes: form.notes || null,
        deposit_amount: Number(form.deposit_amount) || 0,
        services: form.services
          .filter((s) => s.service_name.trim())
          .map((s) => ({
            product_id: s.product_id || null,
            service_name: s.service_name.trim(),
            qty: Number(s.qty) || 1,
            price: Number(s.price) || 0,
            duration_minutes: Number(s.duration_minutes) || 0,
          })),
      };
      if (isEdit) {
        await api.put(`/appointment/${appointment.id}`, payload);
        toast.success('Appointment diupdate');
      } else {
        await api.post('/appointment', payload);
        toast.success('Appointment dibuat');
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-bold">{isEdit ? 'Edit Appointment' : 'Buat Appointment'}</h3>
          <button onClick={onClose} className="rounded p-2 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Customer</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.customer_id || ''}
                onChange={(e) => {
                  const id = e.target.value || null;
                  const c = customers.find((x) => String(x.id) === String(id));
                  setForm({
                    ...form,
                    customer_id: id ? Number(id) : null,
                    customer_name: c?.name || form.customer_name,
                    customer_phone: c?.phone || form.customer_phone,
                  });
                }}
              >
                <option value="">— Walk-in —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Nama (jika walk-in)</label>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                placeholder="Nama pelanggan"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Telepon</label>
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.customer_phone || ''}
              onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
              placeholder="0812..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Mulai</label>
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.start_at}
                onChange={(e) => setForm({ ...form, start_at: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Durasi (menit) — auto: {totals.duration || 30}
              </label>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.duration_minutes || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    duration_minutes: Number(e.target.value) || 0,
                  })
                }
                placeholder={String(totals.duration || 30)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Staff</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.staff_id || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    staff_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">— Belum ditentukan —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Ruangan / Resource</label>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.resource_id || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    resource_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">— —</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Layanan</label>
              <button
                onClick={addService}
                className="flex items-center gap-1 text-xs text-primary-600 hover:underline"
              >
                <Plus className="h-3 w-3" /> Tambah
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {form.services.map((s, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 rounded-lg ring-1 ring-gray-100 p-2"
                >
                  {products.length > 0 && (
                    <select
                      className="col-span-3 rounded-lg border border-gray-300 px-2 py-1 text-xs"
                      value={s.product_id || ''}
                      onChange={(e) => pickProduct(idx, e.target.value)}
                    >
                      <option value="">Manual</option>
                      {products.slice(0, 100).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nama}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    type="text"
                    className={`${products.length > 0 ? 'col-span-4' : 'col-span-6'} rounded-lg border border-gray-300 px-2 py-1 text-sm`}
                    placeholder="Nama layanan"
                    value={s.service_name}
                    onChange={(e) => updateService(idx, 'service_name', e.target.value)}
                  />
                  <input
                    type="number"
                    className="col-span-1 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                    placeholder="Qty"
                    value={s.qty}
                    onChange={(e) => updateService(idx, 'qty', Number(e.target.value) || 1)}
                  />
                  <input
                    type="number"
                    className="col-span-2 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                    placeholder="Harga"
                    value={s.price}
                    onChange={(e) => updateService(idx, 'price', Number(e.target.value) || 0)}
                  />
                  <input
                    type="number"
                    className="col-span-1 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                    placeholder="mnt"
                    value={s.duration_minutes}
                    onChange={(e) =>
                      updateService(idx, 'duration_minutes', Number(e.target.value) || 0)
                    }
                  />
                  <button
                    onClick={() => removeService(idx)}
                    className="col-span-1 rounded-lg text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="mx-auto h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Deposit (Rp)</label>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.deposit_amount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    deposit_amount: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="flex items-end">
              <p className="text-sm text-gray-500">
                Estimasi durasi: <strong>{effectiveDuration} mnt</strong> · Total:{' '}
                <strong>Rp{totals.total.toLocaleString('id-ID')}</strong>
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Catatan</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes untuk staff"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Batal
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : isEdit ? 'Update' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
