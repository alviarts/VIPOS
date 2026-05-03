// VIPOS — Hex color picker untuk kategori (P1-05).
//
// 16 preset (warna brand teal di posisi pertama, sisanya warna khas POS) plus
// input custom hex. Value: string hex `#RRGGBB` atau null.
import { Check } from 'lucide-react';

const PRESETS = [
  '#04C99E', // VIPOS teal (brand)
  '#0EA5E9', // sky
  '#3B82F6', // blue
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#EF4444', // red
  '#F97316', // orange
  '#F59E0B', // amber
  '#EAB308', // yellow
  '#84CC16', // lime
  '#22C55E', // green
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#64748B', // slate
  '#6B7280', // gray
];

const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export default function ColorPicker({ value, onChange, label = 'Warna Tombol Kasir' }) {
  const valid = !value || HEX_RE.test(value);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`h-8 w-8 rounded-lg border-2 flex items-center justify-center bg-white text-[10px] font-semibold text-gray-500 transition ${
            !value
              ? 'border-primary-500 ring-2 ring-primary-200'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          aria-label="Tanpa warna (default)"
          title="Tanpa warna"
        >
          ―
        </button>
        {PRESETS.map((hex) => {
          const active = (value || '').toLowerCase() === hex.toLowerCase();
          return (
            <button
              key={hex}
              type="button"
              onClick={() => onChange(hex)}
              className={`h-8 w-8 rounded-lg border-2 flex items-center justify-center transition ${
                active
                  ? 'border-gray-900 ring-2 ring-gray-300'
                  : 'border-transparent hover:border-gray-400'
              }`}
              style={{ backgroundColor: hex }}
              aria-label={`Pilih warna ${hex}`}
              title={hex}
            >
              {active && <Check className="h-4 w-4 text-white drop-shadow" />}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-gray-500">Custom:</span>
        <input
          type="text"
          value={value || ''}
          placeholder="#04C99E"
          onChange={(e) => {
            const v = e.target.value.trim();
            onChange(v === '' ? null : v);
          }}
          className={`input-field max-w-[140px] py-1.5 text-xs ${!valid ? 'border-red-400' : ''}`}
        />
        {value && (
          <span
            className="h-7 w-7 rounded-md border border-gray-200"
            style={{ backgroundColor: valid ? value : 'transparent' }}
          />
        )}
      </div>
      {!valid && <p className="mt-1 text-xs text-red-500">Format harus hex, contoh #04C99E</p>}
    </div>
  );
}
