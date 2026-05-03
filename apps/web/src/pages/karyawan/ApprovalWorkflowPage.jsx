import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ClipboardCheck, Edit2, GripVertical, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import {
  ConfirmationDialog,
  EmptyState,
  FilterTabs,
  PageHeader,
  Toggle,
} from '../../components/ui';
import { formatCurrency } from '../../utils/format';

const DOMAINS = [
  { id: 'purchase', label: 'Pembelian' },
  { id: 'finance', label: 'Keuangan' },
  { id: 'leave', label: 'Cuti' },
  { id: 'overtime', label: 'Lembur' },
  { id: 'attendance_correction', label: 'Koreksi Absensi' },
  { id: 'other', label: 'Lainnya' },
];

const ROLE_OPTIONS = [
  { value: '', label: '— Tidak diisi —' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Kasir' },
  { value: 'staff', label: 'Staff' },
  { value: 'waiters', label: 'Waiter' },
];

function newStep(order) {
  return { order, approver_role: '', approver_employee_id: '', label: '' };
}

export default function ApprovalWorkflowPage() {
  const [tab, setTab] = useState('purchase');
  const tabs = useMemo(() => DOMAINS.map((d) => ({ id: d.id, label: d.label })), []);
  return (
    <div>
      <PageHeader
        title="Approval Workflow"
        subtitle="Setup chain persetujuan multi-step untuk pembelian, keuangan, cuti, dan lembur — Prime+ feature"
        icon={ClipboardCheck}
      />
      <FilterTabs tabs={tabs} activeId={tab} onChange={setTab} />
      <div className="mt-4">
        <DomainPanel domain={tab} />
      </div>
    </div>
  );
}

function DomainPanel({ domain }) {
  const [chains, setChains] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm(domain));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  async function loadAll() {
    setLoading(true);
    try {
      const [chainRes, empRes] = await Promise.all([
        api.get(`/approval-chain?domain=${domain}`),
        api.get('/employee'),
      ]);
      setChains(Array.isArray(chainRes.data) ? chainRes.data : []);
      setEmployees(Array.isArray(empRes.data) ? empRes.data : []);
    } catch {
      toast.error('Gagal memuat approval chain');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(domain));
    setShowForm(true);
  }

  function openEdit(c) {
    setEditing(c);
    setForm({
      domain: c.domain,
      name: c.name,
      threshold_amount: c.threshold_amount ?? 0,
      is_active: c.is_active ?? 1,
      steps:
        Array.isArray(c.steps) && c.steps.length
          ? c.steps.map((s, i) => ({
              order: s.order ?? i + 1,
              approver_role: s.approver_role || '',
              approver_employee_id: s.approver_employee_id ?? '',
              label: s.label || '',
            }))
          : [newStep(1)],
    });
    setShowForm(true);
  }

  function updateStep(idx, patch) {
    setForm((f) => {
      const steps = [...f.steps];
      steps[idx] = { ...steps[idx], ...patch };
      return { ...f, steps };
    });
  }

  function addStep() {
    setForm((f) => ({ ...f, steps: [...f.steps, newStep(f.steps.length + 1)] }));
  }

  function removeStep(idx) {
    setForm((f) => {
      if (f.steps.length <= 1) return f;
      const steps = f.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 }));
      return { ...f, steps };
    });
  }

  function moveStep(idx, dir) {
    setForm((f) => {
      const target = idx + dir;
      if (target < 0 || target >= f.steps.length) return f;
      const steps = [...f.steps];
      [steps[idx], steps[target]] = [steps[target], steps[idx]];
      return { ...f, steps: steps.map((s, i) => ({ ...s, order: i + 1 })) };
    });
  }

  async function save(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Nama chain wajib');
      return;
    }
    if (!form.steps.length) {
      toast.error('Minimal 1 step approval');
      return;
    }
    for (const s of form.steps) {
      if (!s.approver_role && !s.approver_employee_id) {
        toast.error('Setiap step harus punya approver role atau employee');
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        domain: form.domain,
        name: form.name,
        threshold_amount: Number(form.threshold_amount) || 0,
        is_active: form.is_active ? 1 : 0,
        steps: form.steps.map((s, i) => ({
          order: i + 1,
          approver_role: s.approver_role || undefined,
          approver_employee_id: s.approver_employee_id ? Number(s.approver_employee_id) : undefined,
          label: s.label || undefined,
        })),
      };
      if (editing) {
        await api.put(`/approval-chain/${editing.id}`, payload);
      } else {
        await api.post('/approval-chain', payload);
      }
      toast.success('Chain disimpan');
      setShowForm(false);
      await loadAll();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal menyimpan chain');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    try {
      await api.delete(`/approval-chain/${id}`);
      toast.success('Chain dihapus');
      setConfirmDelete(null);
      await loadAll();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal menghapus chain');
    }
  }

  const empById = useMemo(() => {
    const m = {};
    for (const e of employees) m[e.id] = e;
    return m;
  }, [employees]);

  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {loading ? 'Memuat…' : `${chains.length} chain untuk domain ${labelFor(domain)}`}
          </div>
          <button
            onClick={openCreate}
            className="px-3 py-2 bg-primary-500 text-white rounded-lg text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Tambah Chain
          </button>
        </div>
        {chains.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Belum ada approval chain"
            description="Definisikan chain step untuk dokumen yang membutuhkan persetujuan."
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {chains.map((c) => (
              <ChainCard
                key={c.id}
                chain={c}
                empById={empById}
                onEdit={() => openEdit(c)}
                onDelete={() => setConfirmDelete(c)}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <ChainFormDialog
          form={form}
          editing={editing}
          employees={employees}
          saving={saving}
          onChange={setForm}
          onAddStep={addStep}
          onRemoveStep={removeStep}
          onUpdateStep={updateStep}
          onMoveStep={moveStep}
          onSubmit={save}
          onClose={() => setShowForm(false)}
        />
      )}

      <ConfirmationDialog
        open={!!confirmDelete}
        title="Hapus approval chain"
        message={`Yakin hapus chain "${confirmDelete?.name}"?`}
        variant="danger"
        confirmLabel="Hapus"
        onConfirm={() => remove(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function emptyForm(domain) {
  return {
    domain,
    name: '',
    threshold_amount: 0,
    is_active: 1,
    steps: [newStep(1)],
  };
}

function labelFor(domain) {
  return DOMAINS.find((d) => d.id === domain)?.label || domain;
}

function ChainCard({ chain, empById, onEdit, onDelete }) {
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-800">{chain.name}</h3>
            <span
              className={`inline-block px-2 py-0.5 rounded-md text-xs ${
                chain.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {chain.is_active ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Threshold:{' '}
            {chain.threshold_amount > 0
              ? `≥ ${formatCurrency(chain.threshold_amount)}`
              : 'Semua nominal'}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100"
            aria-label="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50"
            aria-label="Hapus"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(chain.steps || []).map((s, i) => {
          const target = s.approver_employee_id
            ? empById[s.approver_employee_id]?.name || `#${s.approver_employee_id}`
            : roleLabel(s.approver_role);
          return (
            <div key={i} className="flex items-center">
              <div className="px-3 py-1.5 bg-primary-50 border border-primary-200 rounded-lg text-xs">
                <div className="font-medium text-primary-700">Step {s.order ?? i + 1}</div>
                <div className="text-gray-700">{target || '—'}</div>
                {s.label && <div className="text-[10px] text-gray-500">{s.label}</div>}
              </div>
              {i < chain.steps.length - 1 && (
                <ArrowDown className="w-4 h-4 text-gray-400 mx-1 rotate-[-90deg]" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function roleLabel(role) {
  const opt = ROLE_OPTIONS.find((o) => o.value === role);
  return opt ? opt.label : role || '—';
}

function ChainFormDialog({
  form,
  editing,
  employees,
  saving,
  onChange,
  onAddStep,
  onRemoveStep,
  onUpdateStep,
  onMoveStep,
  onSubmit,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
          <h3 className="text-base font-semibold text-gray-800">
            {editing ? 'Edit Approval Chain' : 'Tambah Approval Chain'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Domain</label>
              <select
                value={form.domain}
                onChange={(e) => onChange({ ...form, domain: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {DOMAINS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nama Chain *</label>
              <input
                required
                value={form.name}
                onChange={(e) => onChange({ ...form, name: e.target.value })}
                placeholder="Misal: PO > 5 juta"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Threshold (IDR, 0 = semua)
              </label>
              <input
                type="number"
                min={0}
                value={form.threshold_amount}
                onChange={(e) => onChange({ ...form, threshold_amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex items-end">
              <Toggle
                checked={!!form.is_active}
                onChange={(v) => onChange({ ...form, is_active: v ? 1 : 0 })}
                label="Aktif"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-semibold text-gray-700">Steps Approval</h4>
              <button
                type="button"
                onClick={onAddStep}
                className="px-2.5 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Tambah Step
              </button>
            </div>
            <div className="space-y-2">
              {form.steps.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50"
                >
                  <div className="flex flex-col items-center pt-1">
                    <button
                      type="button"
                      onClick={() => onMoveStep(i, -1)}
                      disabled={i === 0}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      aria-label="Naik"
                    >
                      ▲
                    </button>
                    <span className="text-xs text-gray-500 my-0.5">
                      <GripVertical className="w-3 h-3" />
                    </span>
                    <button
                      type="button"
                      onClick={() => onMoveStep(i, 1)}
                      disabled={i === form.steps.length - 1}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      aria-label="Turun"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase text-gray-500 mb-0.5">
                        Step {i + 1} — Role
                      </label>
                      <select
                        value={s.approver_role || ''}
                        onChange={(e) => onUpdateStep(i, { approver_role: e.target.value })}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white"
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-gray-500 mb-0.5">
                        atau Karyawan
                      </label>
                      <select
                        value={s.approver_employee_id || ''}
                        onChange={(e) => onUpdateStep(i, { approver_employee_id: e.target.value })}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white"
                      >
                        <option value="">— Tidak diisi —</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-gray-500 mb-0.5">
                        Label
                      </label>
                      <input
                        value={s.label || ''}
                        onChange={(e) => onUpdateStep(i, { label: e.target.value })}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white"
                        placeholder="e.g. Validasi"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveStep(i)}
                    disabled={form.steps.length <= 1}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md disabled:opacity-30"
                    aria-label="Hapus step"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Tiap step harus punya minimal salah satu antara role atau karyawan spesifik.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
