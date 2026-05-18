import { useState } from 'react';
import { Check } from 'lucide-react';

const PRESETS = [
  '#04C99E',
  '#0EA5E9',
  '#6366F1',
  '#A855F7',
  '#EC4899',
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#84CC16',
  '#22C55E',
  '#10B981',
  '#14B8A6',
  '#06B6D4',
  '#3B82F6',
  '#8B5CF6',
  '#64748B',
];

const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export default function ColorPicker({ value, onChange }) {
  const [custom, setCustom] = useState(value && !PRESETS.includes(value) ? value : '');

  const handleCustom = (val) => {
    setCustom(val);
    if (!val) {
      onChange(null);
    } else if (HEX_RE.test(val)) {
      onChange(val);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => {
            setCustom('');
            onChange(null);
          }}
          className={`w-8 h-8 rounded-md border-2 flex items-center justify-center text-[10px] text-gray-400 ${
            !value ? 'border-gray-900' : 'border-gray-200 hover:border-gray-400'
          }`}
          aria-label="Tidak ada warna"
          title="Tanpa warna"
        >
          ∅
        </button>
        {PRESETS.map((hex) => (
          <button
            type="button"
            key={hex}
            onClick={() => {
              setCustom('');
              onChange(hex);
            }}
            className={`w-8 h-8 rounded-md border-2 flex items-center justify-center ${
              value === hex ? 'border-gray-900' : 'border-transparent'
            }`}
            style={{ backgroundColor: hex }}
            aria-label={`Pilih warna ${hex}`}
            title={hex}
          >
            {value === hex && <Check className="w-4 h-4 text-white" />}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => handleCustom(e.target.value)}
          placeholder="#RRGGBB"
          className="input-field text-sm w-32 font-mono"
          maxLength={7}
        />
        <span className="text-xs text-gray-500">Atau warna kustom</span>
      </div>
    </div>
  );
}
