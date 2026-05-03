// VIPOS — Online channel pricing (P1-04 Tab majoo Order).
//
// Optional markup price for online ordering (e.g. GoFood / GrabFood). Toggle
// `is_online_active` controls whether the product appears on the online menu.
import { formatCurrency } from '../../../utils/format';

export default function TabMajooOrder({ form, onChange, basePrice }) {
  const markup =
    form.price_online && basePrice
      ? Math.round((parseFloat(form.price_online) / parseFloat(basePrice) - 1) * 100)
      : 0;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">majoo Order — Channel Online</h3>
        <p className="text-xs text-gray-500">
          Atur harga produk untuk channel online (e-menu, GoFood, GrabFood). Harga ini biasanya
          punya markup dari harga jual offline untuk menutup biaya komisi platform.
        </p>
      </div>

      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!form.is_online_active}
          onChange={(e) => onChange({ is_online_active: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <span>Tampilkan produk ini di channel online</span>
      </label>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Harga Online (Rp)</label>
          <input
            type="number"
            min="0"
            step="100"
            value={form.price_online ?? ''}
            onChange={(e) => onChange({ price_online: e.target.value })}
            placeholder={basePrice ? `Default: ${formatCurrency(basePrice)}` : '0'}
            className="input-field w-full"
          />
          {markup > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              Markup +{markup}% dibanding harga offline.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Harga Offline (Acuan)</label>
          <input
            type="text"
            value={basePrice ? formatCurrency(basePrice) : '—'}
            disabled
            className="input-field w-full bg-gray-50 text-gray-500"
          />
        </div>
      </div>
    </div>
  );
}
