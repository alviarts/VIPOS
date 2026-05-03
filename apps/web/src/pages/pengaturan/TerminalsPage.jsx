// Terminals — list device hardware (cashier/printer/soundbox/EDC/kitchen).
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Edit2, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import api from '../../utils/api';
import { ConfirmationDialog, EmptyState, PageHeader } from '../../components/ui';
import { formatDate } from '../../utils/format';

const TYPE_LABEL = {
  cashier: 'Kasir',
  printer: 'Printer',
  soundbox: 'Soundbox',
  edc: 'EDC',
  kitchen_display: 'Kitchen Display',
  tablet: 'Tablet',
  other: 'Lainnya',
};

const initForm = () => ({
  code: '',
  name: '',
  type: 'cashier',
  outlet_id: '',
  model: '',
  serial_no: '',
  ip_address: '',
  mac_address: '',
  is_active: true,
});

export default function TerminalsPage() {
  const [rows, setRows] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initForm());
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [t, o] = await Promise.all([api.get('/terminal'), api.get('/outlet')]);
    setRows(t.data || []);
    setOutlets(o.data || []);
  }

  function openCreate() {
    setEditing(null);
    setForm(initForm());
    setShowForm(true);
  }

  function openEdit(t) {
    setEditing(t);
    setForm({ ...initForm(), ...t, is_active: !!t.is_active, outlet_id: t.outlet_id || '' });
    setShowForm(true);
  }

  async function submit(e) {
    e.preventDefault();
    try {
      const payload = { ...form, outlet_id: form.outlet_id || null };
      if (editing) {
        await api.put(`/terminal/${editing.id}`, payload);
      } else {
        await api.post('/terminal', payload);
      }
      toast.success('Tersimpan');
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal');
    }
  }

  async function heartbeat(id) {
    try {
      await api.post(`/terminal/${id}/heartbeat`);
      toast.success('Heartbeat tercatat');
      load();
    } catch (err) {
      toast.error('Gagal');
    }
  }

  async function del() {
    try {
      await api.delete(`/terminal/${confirmDel.id}`);
      setConfirmDel(null);
      load();
    } catch (err) {
      toast.error('Gagal');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Terminal & Perangkat"
        subtitle="Daftar device kasir, printer, soundbox, EDC, dan tablet."
      >
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> Tambah Device
        </button>
      </PageHeader>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <EmptyState
            title="Belum ada device"
            description="Tambah terminal/printer/soundbox pertama."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Kode</th>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Tipe</th>
                <th className="px-4 py-3 text-left">Outlet</th>
                <th className="px-4 py-3 text-left">IP</th>
                <th className="px-4 py-3 text-left">Last Seen</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{t.code}</td>
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs">
                      {TYPE_LABEL[t.type] || t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{t.outlet_name || '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {t.ip_address || '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {t.last_seen_at ? formatDate(t.last_seen_at) : 'Belum aktif'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                        t.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {t.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => heartbeat(t.id)}
                        className="rounded p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                        title="Test heartbeat"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEdit(t)}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDel(t)}
                        className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold">{editing ? 'Edit' : 'Tambah'} Device</h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-3 px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kode (auto jika kosong)">
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="input-field"
                  />
                </Field>
                <Field label="Tipe" required>
                  <select
                    required
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="input-field"
                  >
                    {Object.entries(TYPE_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Nama Device" required>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-field"
                />
              </Field>
              <Field label="Outlet">
                <select
                  value={form.outlet_id}
                  onChange={(e) => setForm({ ...form, outlet_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">— Pilih Outlet —</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Model">
                  <input
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    className="input-field"
                  />
                </Field>
                <Field label="Serial No.">
                  <input
                    value={form.serial_no}
                    onChange={(e) => setForm({ ...form, serial_no: e.target.value })}
                    className="input-field"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="IP Address">
                  <input
                    value={form.ip_address}
                    onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
                    placeholder="192.168.1.10"
                    className="input-field"
                  />
                </Field>
                <Field label="MAC Address">
                  <input
                    value={form.mac_address}
                    onChange={(e) => setForm({ ...form, mac_address: e.target.value })}
                    placeholder="00:1A:2B:3C:4D:5E"
                    className="input-field"
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
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
        title="Hapus device?"
        message={`Device ${confirmDel?.name} akan dihapus.`}
        confirmLabel="Hapus"
        variant="danger"
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
