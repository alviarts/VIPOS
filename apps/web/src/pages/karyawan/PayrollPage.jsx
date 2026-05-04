import { useEffect, useState } from 'react';
import { Calculator, Download, Edit2, Plus, Trash2, Wallet, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { ConfirmationDialog, EmptyState, FilterTabs, PageHeader } from '../../components/ui';
import { formatCurrency } from '../../utils/format';

const TABS = [
  { id: 'runs', label: 'Run Payroll' },
  { id: 'structures', label: 'Struktur Gaji' },
  { id: 'settings', label: 'Pengaturan' },
];

export default function PayrollPage() {
  const [tab, setTab] = useState('runs');
  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle="Setup struktur gaji, run payroll bulanan, generate payslip & bank file"
        icon={Wallet}
      />
      <FilterTabs tabs={TABS} activeId={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === 'runs' && <RunsTab />}
        {tab === 'structures' && <StructuresTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}

// ============== RUNS ==============
function RunsTab() {
  const [runs, setRuns] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    period_start: '',
    period_end: '',
    payment_date: '',
    notes: '',
  });
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const { data } = await api.get('/payroll-run');
      setRuns(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Gagal memuat run payroll');
    }
  }

  async function create() {
    if (!form.period_start || !form.period_end) {
      toast.error('Periode wajib');
      return;
    }
    try {
      await api.post('/payroll-run', form);
      toast.success('Run dibuat');
      setShowForm(false);
      setForm({ period_start: '', period_end: '', payment_date: '', notes: '' });
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Gagal');
    }
  }

  async function openDetail(run) {
    try {
      const { data } = await api.get(`/payroll-run/${run.id}`);
      setDetail(data);
    } catch {
      toast.error('Gagal memuat detail');
    }
  }

  async function action(verb) {
    if (!detail) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/payroll-run/${detail.id}/${verb}`);
      setDetail(data);
      await load();
      toast.success('Sukses');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Gagal');
    } finally {
      setBusy(false);
    }
  }

  function downloadBankFile() {
    if (!detail) return;
    const url = `${import.meta.env.BASE_URL}api/v1/payroll-run/${detail.id}/bank-file`;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div className="text-sm text-gray-600">{runs.length} run</div>
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-2 bg-primary-500 text-white rounded-lg text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Buat Run Baru
        </button>
      </div>
      {runs.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Belum ada run payroll"
          description="Buat run untuk periode tertentu, lalu jalankan kalkulasi."
        />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Ref</th>
              <th className="px-4 py-3 text-left">Periode</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Karyawan</th>
              <th className="px-4 py-3 text-right">Gross</th>
              <th className="px-4 py-3 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr
                key={r.id}
                className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                onClick={() => openDetail(r)}
              >
                <td className="px-4 py-3 font-mono text-xs">{r.ref_no}</td>
                <td className="px-4 py-3">
                  {r.period_start} → {r.period_end}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 text-right">{r.employee_count || 0}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(r.total_gross)}</td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatCurrency(r.total_net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <Modal title="Buat Run Payroll" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <Field label="Periode Mulai *">
              <input
                type="date"
                value={form.period_start}
                onChange={(e) => setForm({ ...form, period_start: e.target.value })}
                className="input-field"
              />
            </Field>
            <Field label="Periode Akhir *">
              <input
                type="date"
                value={form.period_end}
                onChange={(e) => setForm({ ...form, period_end: e.target.value })}
                className="input-field"
              />
            </Field>
            <Field label="Tgl Bayar">
              <input
                type="date"
                value={form.payment_date}
                onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                className="input-field"
              />
            </Field>
            <Field label="Catatan">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="input-field"
                rows="2"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
            >
              Batal
            </button>
            <button
              onClick={create}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm"
            >
              Buat
            </button>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal title={`Run ${detail.ref_no}`} onClose={() => setDetail(null)} wide>
          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <Info label="Periode" value={`${detail.period_start} → ${detail.period_end}`} />
            <Info label="Tgl Bayar" value={detail.payment_date || '-'} />
            <Info label="Status">
              <StatusBadge status={detail.status} />
            </Info>
            <Info label="Karyawan" value={detail.employee_count || 0} />
            <Info label="Total Gross" value={formatCurrency(detail.total_gross)} />
            <Info label="Total Net" value={formatCurrency(detail.total_net)} bold />
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {detail.status === 'DRAFT' && (
              <button
                disabled={busy}
                onClick={() => action('calculate')}
                className="px-3 py-2 bg-primary-500 text-white rounded-lg text-sm flex items-center gap-1"
              >
                <Calculator className="w-4 h-4" /> Hitung
              </button>
            )}
            {detail.status === 'CALCULATED' && (
              <>
                <button
                  disabled={busy}
                  onClick={() => action('calculate')}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  Hitung Ulang
                </button>
                <button
                  disabled={busy}
                  onClick={() => action('approve')}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm"
                >
                  Approve
                </button>
              </>
            )}
            {detail.status === 'APPROVED' && (
              <button
                disabled={busy}
                onClick={() => action('paid')}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm"
              >
                Tandai Paid
              </button>
            )}
            {(detail.status === 'APPROVED' || detail.status === 'PAID') && (
              <button
                onClick={downloadBankFile}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex items-center gap-1"
              >
                <Download className="w-4 h-4" /> Bank File CSV
              </button>
            )}
          </div>
          {(detail.payslips || []).length > 0 && (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Karyawan</th>
                    <th className="px-3 py-2 text-right">Pokok</th>
                    <th className="px-3 py-2 text-right">Tunjangan</th>
                    <th className="px-3 py-2 text-right">BPJS</th>
                    <th className="px-3 py-2 text-right">PPh21</th>
                    <th className="px-3 py-2 text-right">Potongan</th>
                    <th className="px-3 py-2 text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.payslips.map((p) => (
                    <tr key={p.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">
                        {p.employee_name}{' '}
                        <span className="text-gray-400 ml-1">{p.employee_no}</span>
                      </td>
                      <td className="px-3 py-2 text-right">{formatCurrency(p.basic_salary)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(p.total_allowances)}</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(
                          (p.bpjs_kesehatan || 0) + (p.bpjs_jht || 0) + (p.bpjs_jp || 0)
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{formatCurrency(p.pph21)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(p.total_deductions)}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {formatCurrency(p.net_salary)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    DRAFT: 'bg-gray-100 text-gray-700',
    CALCULATED: 'bg-blue-100 text-blue-700',
    APPROVED: 'bg-yellow-100 text-yellow-700',
    PAID: 'bg-green-100 text-green-700',
    VOIDED: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${map[status] || 'bg-gray-100'}`}>
      {status}
    </span>
  );
}

// ============== STRUCTURES ==============
function StructuresTab() {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    basic_salary: 0,
    allowances: [],
    deductions: [],
    overtime_rate: 0,
    include_bpjs: 1,
    include_pph21: 1,
    is_active: 1,
  });
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const { data } = await api.get('/payroll-structure');
      setItems(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Gagal memuat');
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({
      name: '',
      description: '',
      basic_salary: 0,
      allowances: [],
      deductions: [],
      overtime_rate: 0,
      include_bpjs: 1,
      include_pph21: 1,
      is_active: 1,
    });
    setShowForm(true);
  }

  function openEdit(s) {
    setEditing(s);
    setForm({ ...s, allowances: s.allowances || [], deductions: s.deductions || [] });
    setShowForm(true);
  }

  async function save() {
    if (!form.name) {
      toast.error('Nama wajib');
      return;
    }
    try {
      const payload = {
        ...form,
        basic_salary: Number(form.basic_salary),
        overtime_rate: Number(form.overtime_rate),
      };
      if (editing) await api.put(`/payroll-structure/${editing.id}`, payload);
      else await api.post('/payroll-structure', payload);
      toast.success('Tersimpan');
      setShowForm(false);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Gagal');
    }
  }

  async function doDelete() {
    try {
      await api.delete(`/payroll-structure/${confirmDelete.id}`);
      setConfirmDelete(null);
      await load();
    } catch {
      toast.error('Gagal');
    }
  }

  function addItem(key) {
    setForm((f) => ({ ...f, [key]: [...f[key], { key: '', label: '', amount: 0 }] }));
  }
  function setItem(key, idx, patch) {
    setForm((f) => ({
      ...f,
      [key]: f[key].map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  }
  function rmItem(key, idx) {
    setForm((f) => ({ ...f, [key]: f[key].filter((_, i) => i !== idx) }));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div className="text-sm text-gray-600">{items.length} struktur</div>
        <button
          onClick={openCreate}
          className="px-3 py-2 bg-primary-500 text-white rounded-lg text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Tambah Struktur
        </button>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Belum ada struktur gaji"
          description="Buat template struktur gaji yang bisa dipakai untuk banyak karyawan."
        />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Nama</th>
              <th className="px-4 py-3 text-right">Pokok</th>
              <th className="px-4 py-3 text-left">Tunjangan</th>
              <th className="px-4 py-3 text-left">Potongan</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(s.basic_salary)}</td>
                <td className="px-4 py-3 text-xs">
                  {(s.allowances || []).map((a) => a.label || a.key).join(', ') || '-'}
                </td>
                <td className="px-4 py-3 text-xs">
                  {(s.deductions || []).map((d) => d.label || d.key).join(', ') || '-'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openEdit(s)}
                    className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(s)}
                    className="p-1.5 hover:bg-red-50 rounded-md text-red-600 ml-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <Modal
          title={editing ? 'Edit Struktur' : 'Tambah Struktur'}
          onClose={() => setShowForm(false)}
          wide
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nama *">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
              />
            </Field>
            <Field label="Gaji Pokok *">
              <input
                type="number"
                value={form.basic_salary}
                onChange={(e) => setForm({ ...form, basic_salary: e.target.value })}
                className="input-field"
              />
            </Field>
            <Field label="Lembur (per jam)">
              <input
                type="number"
                value={form.overtime_rate}
                onChange={(e) => setForm({ ...form, overtime_rate: e.target.value })}
                className="input-field"
              />
            </Field>
            <Field label="Deskripsi">
              <input
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input-field"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.include_bpjs}
                onChange={(e) => setForm({ ...form, include_bpjs: e.target.checked ? 1 : 0 })}
              />{' '}
              Include BPJS
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.include_pph21}
                onChange={(e) => setForm({ ...form, include_pph21: e.target.checked ? 1 : 0 })}
              />{' '}
              Include PPh21
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <ItemList
              title="Tunjangan"
              items={form.allowances}
              onAdd={() => addItem('allowances')}
              onChange={(i, p) => setItem('allowances', i, p)}
              onRemove={(i) => rmItem('allowances', i)}
            />
            <ItemList
              title="Potongan Tetap"
              items={form.deductions}
              onAdd={() => addItem('deductions')}
              onChange={(i, p) => setItem('deductions', i, p)}
              onRemove={(i) => rmItem('deductions', i)}
            />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
            >
              Batal
            </button>
            <button
              onClick={save}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm"
            >
              Simpan
            </button>
          </div>
        </Modal>
      )}

      <ConfirmationDialog
        open={!!confirmDelete}
        title="Hapus struktur?"
        description={`Struktur ${confirmDelete?.name} akan dihapus.`}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function ItemList({ title, items, onAdd, onChange, onRemove }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold">{title}</h4>
        <button
          onClick={onAdd}
          className="text-xs px-2 py-1 bg-primary-50 text-primary-700 rounded-md flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Tambah
        </button>
      </div>
      <div className="space-y-2">
        {items.length === 0 && <div className="text-xs text-gray-500">Kosong.</div>}
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-1">
            <input
              className="input-field col-span-3"
              placeholder="key"
              value={it.key || ''}
              onChange={(e) => onChange(i, { key: e.target.value })}
            />
            <input
              className="input-field col-span-5"
              placeholder="label"
              value={it.label || ''}
              onChange={(e) => onChange(i, { label: e.target.value })}
            />
            <input
              className="input-field col-span-3"
              type="number"
              placeholder="amount"
              value={it.amount || 0}
              onChange={(e) => onChange(i, { amount: Number(e.target.value) })}
            />
            <button
              onClick={() => onRemove(i)}
              className="col-span-1 text-red-600 flex items-center justify-center"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== SETTINGS ==============
function SettingsTab() {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);
  async function load() {
    try {
      const { data } = await api.get('/payroll-settings');
      setS(data);
    } catch {
      toast.error('Gagal memuat');
    }
  }
  async function save() {
    setSaving(true);
    try {
      await api.put('/payroll-settings', s);
      toast.success('Tersimpan');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Gagal');
    } finally {
      setSaving(false);
    }
  }

  if (!s) return <div className="p-4 text-sm text-gray-500">Memuat…</div>;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
      <h3 className="font-semibold mb-4">Pengaturan Payroll Global</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Periode">
          <select
            value={s.period}
            onChange={(e) => setS({ ...s, period: e.target.value })}
            className="input-field"
          >
            <option value="monthly">Bulanan</option>
            <option value="biweekly">Dua Mingguan</option>
            <option value="weekly">Mingguan</option>
          </select>
        </Field>
        <Field label="Cut-off Day">
          <input
            type="number"
            value={s.cutoff_day}
            onChange={(e) => setS({ ...s, cutoff_day: Number(e.target.value) })}
            className="input-field"
          />
        </Field>
        <Field label="Tgl Bayar">
          <input
            type="number"
            value={s.payment_day}
            onChange={(e) => setS({ ...s, payment_day: Number(e.target.value) })}
            className="input-field"
          />
        </Field>
        <Field label="Jam Kerja / Bulan">
          <input
            type="number"
            value={s.working_hours_per_month}
            onChange={(e) => setS({ ...s, working_hours_per_month: Number(e.target.value) })}
            className="input-field"
          />
        </Field>
        <Field label="Multiplier Lembur">
          <input
            type="number"
            step="0.1"
            value={s.overtime_multiplier}
            onChange={(e) => setS({ ...s, overtime_multiplier: Number(e.target.value) })}
            className="input-field"
          />
        </Field>
        <Field label="Metode Pajak">
          <select
            value={s.tax_method}
            onChange={(e) => setS({ ...s, tax_method: e.target.value })}
            className="input-field"
          >
            <option value="gross">Gross (5% flat MVP)</option>
            <option value="nett">Nett</option>
            <option value="progressive">Progressive (5/15/25/30/35%)</option>
            <option value="gross-up">Gross-up</option>
          </select>
        </Field>
        <Field label="BPJS Kesehatan (% gaji)">
          <input
            type="number"
            step="0.1"
            value={s.bpjs_kesehatan_employee}
            onChange={(e) => setS({ ...s, bpjs_kesehatan_employee: Number(e.target.value) })}
            className="input-field"
          />
        </Field>
        <Field label="BPJS JHT (% gaji)">
          <input
            type="number"
            step="0.1"
            value={s.bpjs_jht_employee}
            onChange={(e) => setS({ ...s, bpjs_jht_employee: Number(e.target.value) })}
            className="input-field"
          />
        </Field>
        <Field label="BPJS JP (% gaji)">
          <input
            type="number"
            step="0.1"
            value={s.bpjs_jp_employee}
            onChange={(e) => setS({ ...s, bpjs_jp_employee: Number(e.target.value) })}
            className="input-field"
          />
        </Field>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm"
        >
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  );
}

// ============== Helpers ==============
function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      {children}
    </label>
  );
}
function Info({ label, value, bold, children }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={bold ? 'font-bold' : 'font-medium'}>{children || value || '-'}</div>
    </div>
  );
}
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        className={`bg-white rounded-xl w-full ${wide ? 'max-w-4xl' : 'max-w-md'} max-h-[90vh] flex flex-col`}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
