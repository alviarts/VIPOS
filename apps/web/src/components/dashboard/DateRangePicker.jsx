// VIPOS — Lightweight date range selector for dashboard.
//
// Supports preset chips (Today / 7d / 30d / MTD) plus manual start/end date
// inputs. Emits {start, end} (ISO yyyy-MM-dd) on every change.
import { useEffect, useState } from 'react';
import { format, startOfMonth, subDays } from 'date-fns';

const PRESETS = [
  { id: 'today', label: 'Hari ini', delta: 0 },
  { id: '7d', label: '7 hari', delta: 6 },
  { id: '30d', label: '30 hari', delta: 29 },
  { id: 'mtd', label: 'Bulan ini', kind: 'mtd' },
];

function isoDate(d) {
  return format(d, 'yyyy-MM-dd');
}

export default function DateRangePicker({ value, onChange }) {
  const today = new Date();
  const [activePreset, setActivePreset] = useState('30d');

  useEffect(() => {
    if (!value?.start || !value?.end) {
      const start = isoDate(subDays(today, 29));
      const end = isoDate(today);
      onChange({ start, end });
      setActivePreset('30d');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = (preset) => {
    let start, end;
    end = isoDate(today);
    if (preset.kind === 'mtd') {
      start = isoDate(startOfMonth(today));
    } else {
      start = isoDate(subDays(today, preset.delta));
    }
    setActivePreset(preset.id);
    onChange({ start, end });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-gray-100 p-1">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => apply(p)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activePreset === p.id
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-600 hover:bg-white/60'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <input
          type="date"
          value={value?.start || ''}
          max={value?.end || isoDate(today)}
          onChange={(e) => {
            setActivePreset('custom');
            onChange({ start: e.target.value, end: value?.end || isoDate(today) });
          }}
          className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs focus:border-primary-400 focus:outline-none"
        />
        <span>—</span>
        <input
          type="date"
          value={value?.end || ''}
          max={isoDate(today)}
          onChange={(e) => {
            setActivePreset('custom');
            onChange({ start: value?.start || isoDate(subDays(today, 29)), end: e.target.value });
          }}
          className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs focus:border-primary-400 focus:outline-none"
        />
      </div>
    </div>
  );
}
