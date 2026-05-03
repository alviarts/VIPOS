// VIPOS — Product variant editor (P1-04 Tab Varian).
//
// Variants are option groups (e.g. group_name="Ukuran") with multiple option
// labels each carrying a price modifier. This editor lets users add/edit/delete
// rows freely. The wizard's parent owns the variants state.
import { Plus, Trash2 } from 'lucide-react';

export default function TabVariant({ variants = [], onChange }) {
  const update = (idx, patch) => {
    const next = variants.map((v, i) => (i === idx ? { ...v, ...patch } : v));
    onChange(next);
  };

  const addRow = () => {
    onChange([
      ...variants,
      { group_name: 'Ukuran', option_label: '', price_modifier: 0, stock: 0, is_default: false },
    ]);
  };

  const removeRow = (idx) => {
    onChange(variants.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Varian Produk</h3>
        <p className="text-xs text-gray-500">
          Buat opsi seperti ukuran (Reguler, Large, Jumbo) atau warna. Harga modifier akan
          ditambahkan ke harga jual saat varian ini dipilih di kasir.
        </p>
      </div>

      {variants.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-center text-sm text-gray-500">
          Belum ada varian. Klik <span className="font-medium">Tambah Varian</span> untuk mulai.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="pb-2">Group</th>
                <th className="pb-2">Opsi</th>
                <th className="pb-2">Modifier (Rp)</th>
                <th className="pb-2">Stok</th>
                <th className="pb-2">Default</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="py-2 pr-2">
                    <input
                      value={v.group_name || ''}
                      onChange={(e) => update(i, { group_name: e.target.value })}
                      placeholder="Ukuran"
                      className="input-field w-32"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      value={v.option_label || ''}
                      onChange={(e) => update(i, { option_label: e.target.value })}
                      placeholder="Reguler"
                      className="input-field w-32"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      value={v.price_modifier ?? 0}
                      onChange={(e) => update(i, { price_modifier: parseFloat(e.target.value) || 0 })}
                      className="input-field w-28"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      value={v.stock ?? 0}
                      onChange={(e) => update(i, { stock: parseInt(e.target.value, 10) || 0 })}
                      className="input-field w-20"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="checkbox"
                      checked={!!v.is_default}
                      onChange={(e) => update(i, { is_default: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                  <td className="py-2 pl-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="text-gray-400 hover:text-red-600"
                      aria-label="Hapus baris"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
      >
        <Plus className="h-4 w-4" /> Tambah Varian
      </button>
    </div>
  );
}
