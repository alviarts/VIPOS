// Print Settings — PDF receipt template + label print + kitchen ticket.
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader } from '../../components/ui';

export default function PrintSettingsPage() {
  const [form, setForm] = useState({
    paper_size: '80mm',
    template: 'classic',
    show_outlet_logo: true,
    show_cashier_name: true,
    show_qr_invoice: false,
    kitchen_ticket_enabled: true,
    kitchen_printer_id: '',
    label_paper: '50x30',
    receipt_footer: 'Terima kasih.',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/setting?category=print').then((r) => {
      const map = {};
      for (const s of r.data || []) map[s.key] = s.value;
      setForm((f) => ({ ...f, ...map }));
    });
  }, []);

  async function save() {
    setSaving(true);
    try {
      const ops = Object.entries(form).map(([key, value]) =>
        api.put('/setting', { category: 'print', key, value })
      );
      await Promise.all(ops);
      toast.success('Disimpan');
    } catch (_err) {
      toast.error('Gagal');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan Cetak"
        subtitle="Template struk PDF, ticket dapur, dan label produk."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold">Struk Penjualan</h3>
          <div className="space-y-3">
            <Field label="Ukuran Kertas">
              <select
                value={form.paper_size}
                onChange={(e) => setForm({ ...form, paper_size: e.target.value })}
                className="input-field"
              >
                <option value="58mm">58mm (mini)</option>
                <option value="80mm">80mm (standar)</option>
                <option value="A5">A5</option>
                <option value="A4">A4</option>
              </select>
            </Field>
            <Field label="Template">
              <select
                value={form.template}
                onChange={(e) => setForm({ ...form, template: e.target.value })}
                className="input-field"
              >
                <option value="classic">Classic (struktur dasar)</option>
                <option value="detailed">Detailed (rincian pajak)</option>
                <option value="minimal">Minimal (compact)</option>
              </select>
            </Field>
            <Field label="Footer Struk">
              <textarea
                rows={2}
                value={form.receipt_footer}
                onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })}
                className="input-field"
              />
            </Field>
            <div className="grid grid-cols-1 gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.show_outlet_logo}
                  onChange={(e) => setForm({ ...form, show_outlet_logo: e.target.checked })}
                />
                Tampilkan logo outlet
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.show_cashier_name}
                  onChange={(e) => setForm({ ...form, show_cashier_name: e.target.checked })}
                />
                Tampilkan nama kasir
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.show_qr_invoice}
                  onChange={(e) => setForm({ ...form, show_qr_invoice: e.target.checked })}
                />
                Tampilkan QR Code invoice
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold">Ticket Dapur</h3>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.kitchen_ticket_enabled}
                onChange={(e) => setForm({ ...form, kitchen_ticket_enabled: e.target.checked })}
              />
              Aktifkan ticket dapur
            </label>
            <div className="mt-3">
              <Field label="Printer Dapur (ID Terminal)">
                <input
                  value={form.kitchen_printer_id}
                  onChange={(e) => setForm({ ...form, kitchen_printer_id: e.target.value })}
                  placeholder="TRM-0002"
                  className="input-field"
                />
              </Field>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold">Label Produk</h3>
            <Field label="Ukuran Kertas Label">
              <select
                value={form.label_paper}
                onChange={(e) => setForm({ ...form, label_paper: e.target.value })}
                className="input-field"
              >
                <option value="50x30">50x30 mm</option>
                <option value="40x20">40x20 mm</option>
                <option value="30x20">30x20 mm</option>
              </select>
            </Field>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : 'Simpan Pengaturan Cetak'}
          </button>
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
