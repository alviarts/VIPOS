// VIPOS — Product recipe (BOM) editor (P1-04 Tab Resep).
//
// Each row links an ingredient (other product) with a qty per 1 unit produced.
// Used by inventory deduction at sale time (later phase).
import { Plus, Trash2 } from 'lucide-react';

export default function TabRecipe({ items = [], onChange, products = [], productId }) {
  const ingredientOptions = products.filter((p) => p.id !== productId && p.is_active);

  const update = (idx, patch) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(next);
  };

  const addRow = () => {
    onChange([...items, { ingredient_id: '', qty: 1, unit: 'pcs' }]);
  };

  const removeRow = (idx) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Resep / Bahan Baku</h3>
        <p className="text-xs text-gray-500">
          Untuk membuat 1 unit produk ini, butuh berapa banyak bahan baku? Stok bahan akan dipotong
          otomatis saat produk terjual.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-center text-sm text-gray-500">
          Belum ada bahan baku. Klik <span className="font-medium">Tambah Bahan</span> untuk mulai.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="pb-2">Bahan Baku</th>
                <th className="pb-2">Qty</th>
                <th className="pb-2">Satuan</th>
                <th className="pb-2">Catatan</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="py-2 pr-2">
                    <select
                      value={it.ingredient_id || ''}
                      onChange={(e) => update(i, { ingredient_id: parseInt(e.target.value, 10) })}
                      className="input-field w-56"
                    >
                      <option value="">— Pilih bahan —</option>
                      {ingredientOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.satuan})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={it.qty ?? 0}
                      onChange={(e) => update(i, { qty: parseFloat(e.target.value) })}
                      className="input-field w-24"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      value={it.unit || ''}
                      onChange={(e) => update(i, { unit: e.target.value })}
                      placeholder="pcs"
                      className="input-field w-24"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      value={it.notes || ''}
                      onChange={(e) => update(i, { notes: e.target.value })}
                      placeholder="Optional"
                      className="input-field w-48"
                    />
                  </td>
                  <td className="py-2 pl-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="text-gray-400 hover:text-red-600"
                      aria-label="Hapus bahan"
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
        <Plus className="h-4 w-4" /> Tambah Bahan
      </button>
    </div>
  );
}
