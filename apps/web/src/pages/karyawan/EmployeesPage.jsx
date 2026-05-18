import { useEffect, useMemo, useState } from 'react';
import { Edit2, Plus, Search, Trash2, Users, FileText, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { ConfirmationDialog, EmptyState, FilterTabs, PageHeader } from '../../components/ui';

const STATUS_TABS = [
  { id: 'all', label: 'Semua' },
  { id: 'active', label: 'Aktif' },
  { id: 'on_leave', label: 'Cuti' },
  { id: 'resigned', label: 'Resigned' },
];

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Kasir' },
  { value: 'staff', label: 'Staff' },
  { value: 'waiters', label: 'Waiter' },
];

const EMP_TYPES = [
  { value: 'permanent', label: 'Tetap' },
  { value: 'contract', label: 'Kontrak' },
  { value: 'intern', label: 'Magang' },
  { value: 'freelance', label: 'Freelance' },
];

const initForm = () => ({
  name: '',
  nik_ktp: '',
  npwp: '',
  birth_date: '',
  birth_place: '',
  gender: '',
  marital_status: '',
  religion: '',
  blood_type: '',
  nationality: 'Indonesia',
  phone: '',
  email: '',
  address: '',
  address_ktp: '',
  emergency_contact_name: '',
  emergency_contact_relation: '',
  emergency_contact_phone: '',
  department_id: '',
  position: '',
  employee_type: 'permanent',
  date_joined: '',
  date_resigned: '',
  role: 'cashier',
  payroll_structure_id: '',
  bank_name: '',
  bank_account_no: '',
  bank_account_name: '',
  base_salary: 0,
  pin_code: '',
  status: 'active',
  photo_url: '',
});

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [structures, setStructures] = useState([]);
  const [statusTab, setStatusTab] = useState('all');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initForm());
  const [activeTab, setActiveTab] = useState('personal');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [detail, setDetail] = useState(null);
  const [docFile, setDocFile] = useState({ doc_type: '', file_url: '', file_name: '' });

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadAll() reads statusTab + search directly; effect intentionally re-runs only on those
  }, [statusTab, search]);

  async function loadAll() {
    await Promise.all([loadEmployees(), loadDepartments(), loadStructures()]);
  }

  async function loadEmployees() {
    try {
      const params = new URLSearchParams();
      if (statusTab !== 'all') params.set('status', statusTab);
      if (search) params.set('search', search);
      const { data } = await api.get(`/employee?${params.toString()}`);
      setEmployees(Array.isArray(data) ? data : []);
    } catch (_err) {
      toast.error('Gagal memuat karyawan');
    }
  }

  async function loadDepartments() {
    try {
      const { data } = await api.get('/departments');
      setDepartments(Array.isArray(data) ? data : []);
    } catch {
      setDepartments([]);
    }
  }

  async function loadStructures() {
    try {
      const { data } = await api.get('/payroll-structure');
      setStructures(Array.isArray(data) ? data : []);
    } catch {
      setStructures([]);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(initForm());
    setActiveTab('personal');
    setShowForm(true);
  }

  function openEdit(emp) {
    setEditing(emp);
    setForm({
      ...initForm(),
      ...emp,
      department_id: emp.department_id || '',
      payroll_structure_id: emp.payroll_structure_id || '',
    });
    setActiveTab('personal');
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name) {
      toast.error('Nama karyawan wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        department_id: form.department_id ? Number(form.department_id) : null,
        payroll_structure_id: form.payroll_structure_id ? Number(form.payroll_structure_id) : null,
        base_salary: Number(form.base_salary) || 0,
      };
      if (editing) {
        await api.put(`/employee/${editing.id}`, payload);
        toast.success('Karyawan diperbarui');
      } else {
        await api.post('/employee', payload);
        toast.success('Karyawan ditambahkan');
      }
      setShowForm(false);
      await loadEmployees();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await api.delete(`/employee/${confirmDelete.id}`);
      toast.success('Karyawan ditandai resigned');
      setConfirmDelete(null);
      await loadEmployees();
    } catch {
      toast.error('Gagal menghapus');
    }
  }

  async function openDetail(emp) {
    try {
      const { data } = await api.get(`/employee/${emp.id}`);
      setDetail(data);
      setDocFile({ doc_type: '', file_url: '', file_name: '' });
    } catch {
      toast.error('Gagal memuat detail');
    }
  }

  async function addDocument() {
    if (!detail) return;
    if (!docFile.doc_type || !docFile.file_url) {
      toast.error('Doc type & URL wajib');
      return;
    }
    try {
      await api.post(`/employee/${detail.id}/document`, docFile);
      toast.success('Dokumen ditambahkan');
      const { data } = await api.get(`/employee/${detail.id}`);
      setDetail(data);
      setDocFile({ doc_type: '', file_url: '', file_name: '' });
    } catch {
      toast.error('Gagal upload dokumen');
    }
  }

  async function deleteDocument(docId) {
    if (!detail) return;
    try {
      await api.delete(`/employee/${detail.id}/document/${docId}`);
      const { data } = await api.get(`/employee/${detail.id}`);
      setDetail(data);
    } catch {
      toast.error('Gagal hapus dokumen');
    }
  }

  const filtered = useMemo(() => employees, [employees]);

  function setF(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div>
      <PageHeader
        title="Daftar Karyawan"
        subtitle="Kelola data karyawan, dokumen & employment"
        icon={Users}
      >
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg flex items-center gap-2 hover:bg-primary-600"
        >
          <Plus className="w-4 h-4" /> Tambah Karyawan
        </button>
      </PageHeader>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <FilterTabs tabs={STATUS_TABS} activeId={statusTab} onChange={setStatusTab} />
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / posisi / phone"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Belum ada karyawan"
            description="Tambahkan karyawan pertama untuk mulai mengelola payroll & absensi."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">No</th>
                  <th className="px-4 py-3 text-left">Nama</th>
                  <th className="px-4 py-3 text-left">Posisi</th>
                  <th className="px-4 py-3 text-left">Departemen</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Tipe</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => openDetail(e)}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{e.employee_no}</td>
                    <td className="px-4 py-3 font-medium">{e.name}</td>
                    <td className="px-4 py-3">{e.position || '-'}</td>
                    <td className="px-4 py-3">{e.department_name || '-'}</td>
                    <td className="px-4 py-3">{e.phone || '-'}</td>
                    <td className="px-4 py-3">
                      {EMP_TYPES.find((t) => t.value === e.employee_type)?.label || e.employee_type}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          e.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : e.status === 'on_leave'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(ev) => ev.stopPropagation()}>
                      <button
                        onClick={() => openEdit(e)}
                        className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {e.status !== 'resigned' && (
                        <button
                          onClick={() => setConfirmDelete(e)}
                          className="p-1.5 hover:bg-red-50 rounded-md text-red-600 ml-1"
                          title="Resign"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE/EDIT FORM DIALOG */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editing ? 'Edit Karyawan' : 'Tambah Karyawan'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 hover:bg-gray-100 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 pt-4 border-b border-gray-200">
              <div className="flex gap-1">
                {[
                  { id: 'personal', label: 'Personal' },
                  { id: 'contact', label: 'Kontak' },
                  { id: 'employment', label: 'Employment' },
                  { id: 'bank', label: 'Bank & Payroll' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                      activeTab === t.id
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-3">
              {activeTab === 'personal' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nama Lengkap *">
                    <input
                      value={form.name}
                      onChange={(e) => setF('name', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                  <Field label="Foto URL">
                    <input
                      value={form.photo_url}
                      onChange={(e) => setF('photo_url', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                  <Field label="No KTP">
                    <input
                      value={form.nik_ktp}
                      onChange={(e) => setF('nik_ktp', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                  <Field label="NPWP">
                    <input
                      value={form.npwp}
                      onChange={(e) => setF('npwp', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                  <Field label="Tgl Lahir">
                    <input
                      type="date"
                      value={form.birth_date || ''}
                      onChange={(e) => setF('birth_date', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                  <Field label="Tempat Lahir">
                    <input
                      value={form.birth_place}
                      onChange={(e) => setF('birth_place', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                  <Field label="Gender">
                    <select
                      value={form.gender}
                      onChange={(e) => setF('gender', e.target.value)}
                      className="input-field"
                    >
                      <option value="">-</option>
                      <option value="M">Pria</option>
                      <option value="F">Wanita</option>
                    </select>
                  </Field>
                  <Field label="Status Pernikahan">
                    <input
                      value={form.marital_status}
                      onChange={(e) => setF('marital_status', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                  <Field label="Agama">
                    <input
                      value={form.religion}
                      onChange={(e) => setF('religion', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                  <Field label="Gol. Darah">
                    <input
                      value={form.blood_type}
                      onChange={(e) => setF('blood_type', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                </div>
              )}
              {activeTab === 'contact' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone">
                    <input
                      value={form.phone}
                      onChange={(e) => setF('phone', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      value={form.email}
                      onChange={(e) => setF('email', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                  <Field label="Alamat Domisili" className="col-span-2">
                    <textarea
                      value={form.address}
                      onChange={(e) => setF('address', e.target.value)}
                      className="input-field"
                      rows="2"
                    />
                  </Field>
                  <Field label="Alamat KTP" className="col-span-2">
                    <textarea
                      value={form.address_ktp}
                      onChange={(e) => setF('address_ktp', e.target.value)}
                      className="input-field"
                      rows="2"
                    />
                  </Field>
                  <Field label="Kontak Darurat - Nama">
                    <input
                      value={form.emergency_contact_name}
                      onChange={(e) => setF('emergency_contact_name', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                  <Field label="Kontak Darurat - Hubungan">
                    <input
                      value={form.emergency_contact_relation}
                      onChange={(e) => setF('emergency_contact_relation', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                  <Field label="Kontak Darurat - Phone">
                    <input
                      value={form.emergency_contact_phone}
                      onChange={(e) => setF('emergency_contact_phone', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                </div>
              )}
              {activeTab === 'employment' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Departemen">
                    <select
                      value={form.department_id}
                      onChange={(e) => setF('department_id', e.target.value)}
                      className="input-field"
                    >
                      <option value="">- pilih -</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Posisi">
                    <input
                      value={form.position}
                      onChange={(e) => setF('position', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                  <Field label="Tipe Karyawan">
                    <select
                      value={form.employee_type}
                      onChange={(e) => setF('employee_type', e.target.value)}
                      className="input-field"
                    >
                      {EMP_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Role / Hak Akses">
                    <select
                      value={form.role}
                      onChange={(e) => setF('role', e.target.value)}
                      className="input-field"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Tgl Bergabung">
                    <input
                      type="date"
                      value={form.date_joined || ''}
                      onChange={(e) => setF('date_joined', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                  <Field label="Tgl Resign">
                    <input
                      type="date"
                      value={form.date_resigned || ''}
                      onChange={(e) => setF('date_resigned', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                  <Field label="Status">
                    <select
                      value={form.status}
                      onChange={(e) => setF('status', e.target.value)}
                      className="input-field"
                    >
                      <option value="active">Aktif</option>
                      <option value="on_leave">Cuti</option>
                      <option value="resigned">Resigned</option>
                    </select>
                  </Field>
                  <Field label="PIN POS">
                    <input
                      value={form.pin_code}
                      onChange={(e) => setF('pin_code', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                </div>
              )}
              {activeTab === 'bank' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Struktur Payroll">
                    <select
                      value={form.payroll_structure_id}
                      onChange={(e) => setF('payroll_structure_id', e.target.value)}
                      className="input-field"
                    >
                      <option value="">- pilih -</option>
                      {structures.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Gaji Pokok (Override)">
                    <input
                      type="number"
                      value={form.base_salary || 0}
                      onChange={(e) => setF('base_salary', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                  <Field label="Nama Bank">
                    <input
                      value={form.bank_name}
                      onChange={(e) => setF('bank_name', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                  <Field label="No Rek">
                    <input
                      value={form.bank_account_no}
                      onChange={(e) => setF('bank_account_no', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                  <Field label="A/n Rekening" className="col-span-2">
                    <input
                      value={form.bank_account_name}
                      onChange={(e) => setF('bank_account_name', e.target.value)}
                      className="input-field"
                    />
                  </Field>
                </div>
              )}
            </div>
            <div className="px-6 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL DIALOG */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {detail.name}{' '}
                <span className="font-mono text-xs text-gray-500 ml-2">{detail.employee_no}</span>
              </h2>
              <button onClick={() => setDetail(null)} className="p-1 hover:bg-gray-100 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="KTP" value={detail.nik_ktp} />
                <Info label="NPWP" value={detail.npwp} />
                <Info label="Phone" value={detail.phone} />
                <Info label="Email" value={detail.email} />
                <Info label="Posisi" value={detail.position} />
                <Info label="Departemen" value={detail.department_name} />
                <Info label="Role" value={detail.role} />
                <Info label="Tipe" value={detail.employee_type} />
                <Info label="Tgl Bergabung" value={detail.date_joined} />
                <Info label="Status" value={detail.status} />
                <Info
                  label="Bank"
                  value={
                    detail.bank_name && detail.bank_account_no
                      ? `${detail.bank_name} ${detail.bank_account_no}`
                      : null
                  }
                />
                <Info label="Struktur Payroll" value={detail.payroll_structure_name} />
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Dokumen
                </h3>
                <div className="space-y-1 mb-3">
                  {(detail.documents || []).length === 0 && (
                    <div className="text-xs text-gray-500">Belum ada dokumen.</div>
                  )}
                  {(detail.documents || []).map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md text-sm"
                    >
                      <span>
                        <span className="font-medium">{d.doc_type}</span> ·{' '}
                        {d.file_name || d.file_url}
                      </span>
                      <button
                        onClick={() => deleteDocument(d.id)}
                        className="text-red-600 hover:bg-red-50 p-1 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    placeholder="Tipe (ktp, npwp, ...)"
                    value={docFile.doc_type}
                    onChange={(e) => setDocFile({ ...docFile, doc_type: e.target.value })}
                    className="input-field"
                  />
                  <input
                    placeholder="URL file"
                    value={docFile.file_url}
                    onChange={(e) => setDocFile({ ...docFile, file_url: e.target.value })}
                    className="input-field"
                  />
                  <button
                    onClick={addDocument}
                    className="px-3 py-2 bg-primary-500 text-white rounded-lg text-sm flex items-center gap-1 justify-center"
                  >
                    <Plus className="w-4 h-4" /> Tambah
                  </button>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  openEdit(detail);
                  setDetail(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
              >
                Edit
              </button>
              <button
                onClick={() => setDetail(null)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={!!confirmDelete}
        title="Tandai resigned?"
        description={`${confirmDelete?.name} akan ditandai sebagai resigned. Data tidak akan dihapus permanen.`}
        confirmLabel="Tandai Resigned"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      {children}
    </label>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-medium">{value || '-'}</div>
    </div>
  );
}
