import { X } from 'lucide-react';

export default function CustomerFormPage({
  editCust,
  form,
  setForm,
  errors,
  groups,
  tags,
  onCancel,
  onSave,
}) {
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleTag = (id) => {
    setForm((f) => {
      const has = f.tag_ids.includes(id);
      return { ...f, tag_ids: has ? f.tag_ids.filter((x) => x !== id) : [...f.tag_ids, id] };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">
            {editCust ? 'Ubah Pelanggan' : 'Tambah Pelanggan'}
          </h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Informasi Pelanggan</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nama<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  className="input-field"
                  placeholder="Nama lengkap"
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Kode Pelanggan
                </label>
                <input
                  type="text"
                  value={form.kode}
                  onChange={(e) => set({ kode: e.target.value })}
                  className="input-field"
                  placeholder="Otomatis (PLG0001)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Telepon</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  className="input-field"
                  placeholder="08xxxxxxxxxx"
                />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set({ email: e.target.value })}
                  className="input-field"
                  placeholder="email@contoh.com"
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Jenis Kelamin
                </label>
                <select
                  value={form.gender}
                  onChange={(e) => set({ gender: e.target.value })}
                  className="input-field"
                >
                  <option value="">-</option>
                  <option value="L">Pria</option>
                  <option value="P">Wanita</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tanggal Lahir
                </label>
                <input
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => set({ birth_date: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Alamat</label>
                <textarea
                  value={form.address}
                  onChange={(e) => set({ address: e.target.value })}
                  rows={2}
                  className="input-field resize-none"
                  placeholder="Alamat lengkap"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Provinsi</label>
                <input
                  type="text"
                  value={form.province}
                  onChange={(e) => set({ province: e.target.value })}
                  className="input-field"
                  placeholder="Jawa Barat"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Kota</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => set({ city: e.target.value })}
                  className="input-field"
                  placeholder="Bandung"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Kecamatan</label>
                <input
                  type="text"
                  value={form.district}
                  onChange={(e) => set({ district: e.target.value })}
                  className="input-field"
                  placeholder="Cibadak"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">NPWP</label>
                <input
                  type="text"
                  value={form.npwp}
                  onChange={(e) => set({ npwp: e.target.value })}
                  className="input-field"
                  placeholder="00.000.000.0-000.000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">No. KTP</label>
                <input
                  type="text"
                  value={form.id_card_no}
                  onChange={(e) => set({ id_card_no: e.target.value })}
                  className="input-field"
                  placeholder="3201xxxxxxxxxxxx"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Klasifikasi</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Grup</label>
                <select
                  value={form.customer_group_id}
                  onChange={(e) => set({ customer_group_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">- Tanpa grup -</option>
                  {(groups || []).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                      {g.discount_percent > 0 ? ` (diskon ${g.discount_percent}%)` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tag</label>
                <div className="flex flex-wrap gap-2">
                  {(tags || []).length === 0 && (
                    <p className="text-xs text-gray-400">
                      Belum ada tag. Buat di halaman Kelola Grup &amp; Tag.
                    </p>
                  )}
                  {(tags || []).map((t) => {
                    const active = form.tag_ids.includes(t.id);
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => toggleTag(t.id)}
                        className={`px-2.5 py-1 text-xs rounded-full border transition ${
                          active
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                        style={
                          active
                            ? {
                                borderColor: t.color || undefined,
                                backgroundColor: (t.color || '') + '22' || undefined,
                                color: t.color || undefined,
                              }
                            : undefined
                        }
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Loyalti & Deposit</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Poin</label>
                <input
                  type="number"
                  min="0"
                  value={form.points}
                  onChange={(e) => set({ points: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Saldo Deposit
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={form.deposit}
                    onChange={(e) => set({ deposit: e.target.value })}
                    className="input-field pl-9"
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Catatan</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                  rows={2}
                  className="input-field resize-none"
                  placeholder="Catatan internal mengenai pelanggan"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 px-4 sm:px-6 py-3 bg-white flex items-center justify-between">
        <button
          onClick={onCancel}
          className="text-primary-600 hover:bg-primary-50 px-3 py-2 rounded-lg text-sm font-medium"
        >
          Batal
        </button>
        <button onClick={onSave} className="btn-primary text-sm">
          Simpan
        </button>
      </div>
    </div>
  );
}
