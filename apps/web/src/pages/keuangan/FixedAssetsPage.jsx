// Aset Tetap — list aset, form create, run penyusutan bulanan, disposal aset.
import { useEffect, useState } from 'react';
import { Edit2, Plus, Receipt, Trash2, X, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { ConfirmationDialog, EmptyState, PageHeader } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/format';

const today = () => new Date().toISOString().slice(0, 10);

const initForm = () => ({
  code: '',
  name: '',
  category: '',
  acquisition_date: today(),
  cost: 0,
  useful_life_years: 5,
  salvage_value: 0,
  depreciation_method: 'straight_line',
  location: '',
  vendor_id: '',
  asset_account_id: '',
  accum_dep_account_id: '',
  dep_expense_account_id: '',
  payment_account_id: '',
  description: '',
});

export default function FixedAssetsPage() {
  const [rows, setRows] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initForm());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showDepreciate, setShowDepreciate] = useState(false);
  const [depForm, setDepForm] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });
  const [showDispose, setShowDispose] = useState(null);
  const [disposeForm, setDisposeForm] = useState({
    disposal_date: today(),
    disposal_type: 'sold',
    proceeds: 0,
    proceeds_account_id: '',
    buyer: '',
    description: '',
  });

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [r, a, v] = await Promise.all([
      api.get('/fixed-asset'),
      api.get('/account?is_active=1'),
      api.get('/vendor').catch(() => ({ data: [] })),
    ]);
    setRows(Array.isArray(r.data) ? r.data : []);
    setAccounts(Array.isArray(a.data) ? a.data : []);
    setVendors(Array.isArray(v.data) ? v.data : []);
  }

  const assetAccounts = accounts.filter(
    (a) => a.type === 'ASET' && a.subtype && a.subtype.toLowerCase().includes('aset tetap')
  );
  const accumDepAccounts = accounts.filter(
    (a) => a.type === 'ASET' && a.subtype && a.subtype.toLowerCase().includes('akumulasi')
  );
  const depExpAccounts = accounts.filter(
    (a) => a.type === 'BEBAN' && a.name.toLowerCase().includes('penyusutan')
  );
  const cashAccounts = accounts.filter((a) => a.type === 'ASET' && a.subtype === 'Kas & Bank');

  function openCreate() {
    setEditing(null);
    setForm(initForm());
    setShowForm(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      category: row.category || '',
      acquisition_date: row.acquisition_date,
      cost: row.cost,
      useful_life_years: row.useful_life_years,
      salvage_value: row.salvage_value || 0,
      depreciation_method: row.depreciation_method || 'straight_line',
      location: row.location || '',
      vendor_id: row.vendor_id || '',
      asset_account_id: row.asset_account_id || '',
      accum_dep_account_id: row.accum_dep_account_id || '',
      dep_expense_account_id: row.dep_expense_account_id || '',
      payment_account_id: '',
      description: row.description || '',
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        cost: Number(form.cost),
        useful_life_years: Number(form.useful_life_years),
        salvage_value: Number(form.salvage_value) || 0,
        vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
        asset_account_id: Number(form.asset_account_id),
        accum_dep_account_id: Number(form.accum_dep_account_id),
        dep_expense_account_id: Number(form.dep_expense_account_id),
        payment_account_id: form.payment_account_id ? Number(form.payment_account_id) : null,
        category: form.category || null,
        location: form.location || null,
        description: form.description || null,
      };
      if (editing) {
        await api.put(`/fixed-asset/${editing.id}`, payload);
        toast.success('Aset diperbarui');
      } else {
        await api.post('/fixed-asset', payload);
        toast.success('Aset tersimpan + jurnal akuisisi di-post');
      }
      setShowForm(false);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan');
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/fixed-asset/${confirmDelete.id}`);
      toast.success('Aset dihapus');
      setConfirmDelete(null);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Tidak bisa dihapus');
    }
  }

  async function runDepreciation() {
    try {
      const { data } = await api.post('/fixed-asset/depreciate', {
        year: Number(depForm.year),
        month: Number(depForm.month),
      });
      toast.success(
        `${data.count} aset disusutkan untuk ${data.year}-${String(data.month).padStart(2, '0')}`
      );
      setShowDepreciate(false);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menjalankan penyusutan');
    }
  }

  async function submitDispose(e) {
    e.preventDefault();
    try {
      const payload = {
        ...disposeForm,
        proceeds: Number(disposeForm.proceeds) || 0,
        proceeds_account_id: disposeForm.proceeds_account_id
          ? Number(disposeForm.proceeds_account_id)
          : null,
        buyer: disposeForm.buyer || null,
        description: disposeForm.description || null,
      };
      await api.post(`/fixed-asset/${showDispose.id}/dispose`, payload);
      toast.success('Aset disposed');
      setShowDispose(null);
      setDisposeForm({
        disposal_date: today(),
        disposal_type: 'sold',
        proceeds: 0,
        proceeds_account_id: '',
        buyer: '',
        description: '',
      });
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal disposal');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aset Tetap"
        description="Kelola aset tetap (kendaraan, peralatan, bangunan). Auto-jurnal akuisisi + run penyusutan bulanan + disposal."
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setShowDepreciate(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-100"
            >
              <Zap className="h-4 w-4" /> Run Penyusutan
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" /> Aset Baru
            </button>
          </div>
        }
      />

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <EmptyState title="Belum ada aset tetap" description="Tambahkan aset baru." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Kode</th>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Tanggal Akuisisi</th>
                <th className="px-4 py-3 text-right">Harga Perolehan</th>
                <th className="px-4 py-3 text-right">Akm. Penyusutan</th>
                <th className="px-4 py-3 text-right">Nilai Buku</th>
                <th className="px-4 py-3 text-center">Umur (thn)</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((a) => {
                const nbv = Number(a.cost) - Number(a.accumulated_depreciation || 0);
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{a.code}</td>
                    <td className="px-4 py-3 font-medium">
                      {a.name}
                      {a.category && <div className="text-xs text-gray-500">{a.category}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs">{formatDate(a.acquisition_date)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(a.cost)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {formatCurrency(a.accumulated_depreciation || 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(nbv)}</td>
                    <td className="px-4 py-3 text-center">{a.useful_life_years}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                          a.status === 'active'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {a.status === 'active' && (
                          <button
                            onClick={() => setShowDispose(a)}
                            className="rounded p-1.5 text-gray-500 hover:bg-orange-50 hover:text-orange-600"
                            title="Disposal"
                          >
                            <Receipt className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(a)}
                          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(a)}
                          className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold">
                {editing ? 'Edit Aset Tetap' : 'Aset Tetap Baru'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kode" required>
                  <input
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="input-field"
                    placeholder="cth: AST-001"
                  />
                </Field>
                <Field label="Kategori">
                  <input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="input-field"
                    placeholder="Peralatan / Kendaraan / Bangunan"
                  />
                </Field>
              </div>
              <Field label="Nama Aset" required>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-field"
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Tanggal Akuisisi" required>
                  <input
                    type="date"
                    required
                    value={form.acquisition_date}
                    onChange={(e) => setForm({ ...form, acquisition_date: e.target.value })}
                    className="input-field"
                  />
                </Field>
                <Field label="Harga Perolehan" required>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.cost}
                    onChange={(e) => setForm({ ...form, cost: e.target.value })}
                    className="input-field"
                  />
                </Field>
                <Field label="Nilai Sisa">
                  <input
                    type="number"
                    min={0}
                    value={form.salvage_value}
                    onChange={(e) => setForm({ ...form, salvage_value: e.target.value })}
                    className="input-field"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Umur Manfaat (tahun)" required>
                  <input
                    type="number"
                    min={1}
                    required
                    value={form.useful_life_years}
                    onChange={(e) => setForm({ ...form, useful_life_years: e.target.value })}
                    className="input-field"
                  />
                </Field>
                <Field label="Metode Penyusutan">
                  <select
                    value={form.depreciation_method}
                    onChange={(e) => setForm({ ...form, depreciation_method: e.target.value })}
                    className="input-field"
                  >
                    <option value="straight_line">Garis Lurus</option>
                    <option value="declining_balance">Saldo Menurun</option>
                    <option value="none">Tidak Disusutkan</option>
                  </select>
                </Field>
                <Field label="Lokasi">
                  <input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="input-field"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Vendor">
                  <select
                    value={form.vendor_id}
                    onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">— Tidak ada —</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code} — {v.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {!editing && (
                  <Field label="Bayar dari Akun">
                    <select
                      value={form.payment_account_id}
                      onChange={(e) => setForm({ ...form, payment_account_id: e.target.value })}
                      className="input-field"
                    >
                      <option value="">— (kreditkan ke utang) —</option>
                      {cashAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
              <Field label="Akun Aset (Dr)" required>
                <select
                  required
                  value={form.asset_account_id}
                  onChange={(e) => setForm({ ...form, asset_account_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">— Pilih —</option>
                  {(assetAccounts.length
                    ? assetAccounts
                    : accounts.filter((a) => a.type === 'ASET')
                  ).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Akun Akumulasi Penyusutan (Cr)" required>
                <select
                  required
                  value={form.accum_dep_account_id}
                  onChange={(e) => setForm({ ...form, accum_dep_account_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">— Pilih —</option>
                  {(accumDepAccounts.length
                    ? accumDepAccounts
                    : accounts.filter((a) => a.type === 'ASET')
                  ).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Akun Beban Penyusutan (Dr)" required>
                <select
                  required
                  value={form.dep_expense_account_id}
                  onChange={(e) => setForm({ ...form, dep_expense_account_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">— Pilih —</option>
                  {(depExpAccounts.length
                    ? depExpAccounts
                    : accounts.filter((a) => a.type === 'BEBAN')
                  ).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </Field>
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

      {showDepreciate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold">Run Penyusutan</h2>
              <button
                onClick={() => setShowDepreciate(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <p className="text-xs text-gray-500">
                Hitung penyusutan bulanan untuk semua aset aktif. Idempotent — periode sama tidak
                akan double-post.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tahun" required>
                  <input
                    type="number"
                    min={2020}
                    max={2100}
                    value={depForm.year}
                    onChange={(e) => setDepForm({ ...depForm, year: e.target.value })}
                    className="input-field"
                  />
                </Field>
                <Field label="Bulan" required>
                  <select
                    value={depForm.month}
                    onChange={(e) => setDepForm({ ...depForm, month: e.target.value })}
                    className="input-field"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {String(m).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowDepreciate(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={runDepreciation}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                >
                  Jalankan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDispose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold">Pelepasan Aset</h2>
              <button
                onClick={() => setShowDispose(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submitDispose} className="space-y-3 px-5 py-4">
              <div className="rounded bg-gray-50 px-3 py-2 text-xs">
                <p className="font-semibold">{showDispose.name}</p>
                <p className="text-gray-500">{showDispose.code}</p>
                <p className="mt-1">
                  NBV:{' '}
                  {formatCurrency(
                    Number(showDispose.cost) - Number(showDispose.accumulated_depreciation || 0)
                  )}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tanggal" required>
                  <input
                    type="date"
                    required
                    value={disposeForm.disposal_date}
                    onChange={(e) =>
                      setDisposeForm({ ...disposeForm, disposal_date: e.target.value })
                    }
                    className="input-field"
                  />
                </Field>
                <Field label="Tipe" required>
                  <select
                    value={disposeForm.disposal_type}
                    onChange={(e) =>
                      setDisposeForm({ ...disposeForm, disposal_type: e.target.value })
                    }
                    className="input-field"
                  >
                    <option value="sold">Dijual</option>
                    <option value="scrapped">Dibuang</option>
                    <option value="lost">Hilang</option>
                    <option value="donated">Donasi</option>
                  </select>
                </Field>
              </div>
              {disposeForm.disposal_type === 'sold' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Hasil Penjualan" required>
                      <input
                        type="number"
                        min={0}
                        required
                        value={disposeForm.proceeds}
                        onChange={(e) =>
                          setDisposeForm({ ...disposeForm, proceeds: e.target.value })
                        }
                        className="input-field"
                      />
                    </Field>
                    <Field label="Pembeli">
                      <input
                        value={disposeForm.buyer}
                        onChange={(e) => setDisposeForm({ ...disposeForm, buyer: e.target.value })}
                        className="input-field"
                      />
                    </Field>
                  </div>
                  <Field label="Akun Penerimaan" required>
                    <select
                      required
                      value={disposeForm.proceeds_account_id}
                      onChange={(e) =>
                        setDisposeForm({
                          ...disposeForm,
                          proceeds_account_id: e.target.value,
                        })
                      }
                      className="input-field"
                    >
                      <option value="">— Pilih akun —</option>
                      {cashAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
              <Field label="Keterangan">
                <textarea
                  rows={2}
                  value={disposeForm.description}
                  onChange={(e) => setDisposeForm({ ...disposeForm, description: e.target.value })}
                  className="input-field"
                />
              </Field>
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowDispose(null)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                >
                  Posting Disposal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={!!confirmDelete}
        title="Hapus aset?"
        description={`Aset ${confirmDelete?.code} ${confirmDelete?.name} akan dihapus. Aset yang sudah di-jurnal tidak bisa dihapus.`}
        confirmLabel="Hapus"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
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
