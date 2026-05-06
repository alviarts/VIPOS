// Payment Settings — receipt template, service charge, multi-tax, payment methods, UoM.
// 4 sub-tab: Receipt, Tax, Methods, UoM.
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import api from '../../utils/api';
import { ConfirmationDialog, EmptyState, PageHeader } from '../../components/ui';

const TABS = [
  { key: 'receipt', label: 'Struk & Service Charge' },
  { key: 'tax', label: 'Pajak' },
  { key: 'methods', label: 'Metode Pembayaran' },
  { key: 'uom', label: 'Satuan (UoM)' },
];

export default function PaymentSettingsPage() {
  const [tab, setTab] = useState('receipt');
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan Pembayaran"
        subtitle="Konfigurasi struk, pajak (multi), service charge, metode pembayaran non-cash, dan satuan."
      />
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.key
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'receipt' && <ReceiptTab />}
      {tab === 'tax' && <TaxTab />}
      {tab === 'methods' && <MethodsTab />}
      {tab === 'uom' && <UomTab />}
    </div>
  );
}

function ReceiptTab() {
  const [form, setForm] = useState({
    header_line1: '',
    header_line2: '',
    footer: 'Terima kasih atas kunjungan Anda.',
    show_logo: false,
    show_qr_eod: false,
    service_charge_percent: 0,
    rounding: 'none',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const r = await api.get('/setting?category=receipt');
    const map = {};
    for (const s of r.data || []) map[s.key] = s.value;
    setForm({ ...form, ...map });
  }

  async function save() {
    setSaving(true);
    try {
      const ops = Object.entries(form).map(([key, value]) =>
        api.put('/setting', { category: 'receipt', key, value })
      );
      await Promise.all(ops);
      toast.success('Pengaturan disimpan');
    } catch (_err) {
      toast.error('Gagal');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold">Header & Footer Struk</h3>
        <div className="space-y-3">
          <Field label="Baris 1 (Nama Toko)">
            <input
              value={form.header_line1}
              onChange={(e) => setForm({ ...form, header_line1: e.target.value })}
              className="input-field"
            />
          </Field>
          <Field label="Baris 2 (Alamat)">
            <input
              value={form.header_line2}
              onChange={(e) => setForm({ ...form, header_line2: e.target.value })}
              className="input-field"
            />
          </Field>
          <Field label="Footer">
            <textarea
              rows={2}
              value={form.footer}
              onChange={(e) => setForm({ ...form, footer: e.target.value })}
              className="input-field"
            />
          </Field>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.show_logo}
                onChange={(e) => setForm({ ...form, show_logo: e.target.checked })}
              />
              Tampilkan logo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.show_qr_eod}
                onChange={(e) => setForm({ ...form, show_qr_eod: e.target.checked })}
              />
              QR end-of-day
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold">Service Charge & Pembulatan</h3>
        <div className="space-y-3">
          <Field label="Service Charge (%)">
            <input
              type="number"
              step="0.01"
              value={form.service_charge_percent}
              onChange={(e) => setForm({ ...form, service_charge_percent: Number(e.target.value) })}
              className="input-field"
            />
          </Field>
          <Field label="Pembulatan">
            <select
              value={form.rounding}
              onChange={(e) => setForm({ ...form, rounding: e.target.value })}
              className="input-field"
            >
              <option value="none">Tidak ada</option>
              <option value="100">Ke 100 terdekat</option>
              <option value="500">Ke 500 terdekat</option>
              <option value="1000">Ke 1000 terdekat</option>
            </select>
          </Field>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : 'Simpan Pengaturan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TaxTab() {
  return (
    <CrudTable
      endpoint="/tax-rate"
      columns={[
        { key: 'code', label: 'Kode' },
        { key: 'name', label: 'Nama' },
        { key: 'rate', label: 'Rate (%)', render: (r) => `${r.rate}%` },
        {
          key: 'is_inclusive',
          label: 'Inclusive',
          render: (r) => (r.is_inclusive ? 'Ya' : 'Tidak'),
        },
      ]}
      formFields={[
        { key: 'code', label: 'Kode' },
        { key: 'name', label: 'Nama Pajak', required: true },
        { key: 'rate', label: 'Rate (%)', type: 'number', step: '0.01' },
        { key: 'is_inclusive', label: 'Inclusive', type: 'checkbox' },
      ]}
      title="Daftar Pajak"
      defaultForm={{ code: '', name: '', rate: 0, is_inclusive: false, is_active: true }}
    />
  );
}

function MethodsTab() {
  return (
    <CrudTable
      endpoint="/payment-method"
      columns={[
        { key: 'code', label: 'Kode' },
        { key: 'name', label: 'Nama' },
        { key: 'type', label: 'Tipe' },
        { key: 'fee_percent', label: 'Fee %', render: (r) => `${r.fee_percent || 0}%` },
        { key: 'fee_flat', label: 'Fee Flat' },
      ]}
      formFields={[
        { key: 'code', label: 'Kode' },
        { key: 'name', label: 'Nama Metode', required: true },
        {
          key: 'type',
          label: 'Tipe',
          required: true,
          type: 'select',
          options: ['cash', 'debit', 'credit', 'qris', 'ewallet', 'transfer', 'voucher', 'other'],
        },
        { key: 'provider', label: 'Provider (BCA/Mandiri/...)' },
        { key: 'fee_percent', label: 'Fee (%)', type: 'number', step: '0.01' },
        { key: 'fee_flat', label: 'Fee Flat (Rp)', type: 'number' },
        { key: 'sort_order', label: 'Urutan', type: 'number' },
      ]}
      title="Metode Pembayaran"
      defaultForm={{
        code: '',
        name: '',
        type: 'cash',
        provider: '',
        fee_percent: 0,
        fee_flat: 0,
        sort_order: 0,
        is_active: true,
      }}
    />
  );
}

function UomTab() {
  return (
    <CrudTable
      endpoint="/uom"
      columns={[
        { key: 'code', label: 'Kode' },
        { key: 'name', label: 'Nama' },
        { key: 'symbol', label: 'Simbol' },
        { key: 'conversion_factor', label: 'Faktor' },
      ]}
      formFields={[
        { key: 'code', label: 'Kode' },
        { key: 'name', label: 'Nama Satuan', required: true },
        { key: 'symbol', label: 'Simbol' },
        { key: 'conversion_factor', label: 'Faktor Konversi', type: 'number', step: '0.0001' },
      ]}
      title="Satuan (UoM)"
      defaultForm={{ code: '', name: '', symbol: '', conversion_factor: 1, is_active: true }}
    />
  );
}

// Generic CRUD table component for tax/methods/uom.
function CrudTable({ endpoint, columns, formFields, title, defaultForm }) {
  const [rows, setRows] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const r = await api.get(endpoint);
    setRows(r.data || []);
  }

  function openCreate() {
    setEditing(null);
    setForm(defaultForm);
    setShowForm(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({ ...defaultForm, ...row, is_active: !!row.is_active });
    setShowForm(true);
  }

  async function submit(e) {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`${endpoint}/${editing.id}`, form);
      } else {
        await api.post(endpoint, form);
      }
      toast.success('Disimpan');
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal');
    }
  }

  async function del() {
    try {
      await api.delete(`${endpoint}/${confirmDel.id}`);
      toast.success('Dihapus');
      setConfirmDel(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> Tambah
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <EmptyState title="Belum ada data" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="px-4 py-3 text-left">
                    {c.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-center">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3 text-sm">
                      {c.render ? c.render(r) : r[c.key] || '-'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                        r.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {r.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(r)}
                      className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDel(r)}
                      className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold">
                {editing ? 'Edit' : 'Tambah'} {title}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-3 px-5 py-4">
              {formFields.map((f) => (
                <Field key={f.key} label={f.label} required={f.required}>
                  {f.type === 'select' ? (
                    <select
                      required={f.required}
                      value={form[f.key] || ''}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className="input-field"
                    >
                      {f.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      checked={!!form[f.key]}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })}
                    />
                  ) : (
                    <input
                      type={f.type || 'text'}
                      step={f.step}
                      required={f.required}
                      value={form[f.key] ?? ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value,
                        })
                      }
                      className="input-field"
                    />
                  )}
                </Field>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Aktif
              </label>
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={!!confirmDel}
        title="Hapus item?"
        confirmLabel="Hapus"
        onCancel={() => setConfirmDel(null)}
        onConfirm={del}
      />
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
