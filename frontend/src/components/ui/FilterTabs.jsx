/**
 * Majoo-style horizontal filter tabs:
 *   [ Semua | Tampil di Menu | Tidak Tampil di Menu ]
 *
 * Active tab gets teal underline + dark text. Inactive: gray text, no underline.
 */
export default function FilterTabs({ tabs = [], activeId, onChange }) {
  return (
    <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
      {tabs.map((t) => {
        const active = t.id === activeId;
        return (
          <button
            key={t.id}
            onClick={() => onChange?.(t.id)}
            className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors
              ${active ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className="flex items-center gap-2">
              {t.label}
              {typeof t.count === 'number' && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {t.count}
                </span>
              )}
            </span>
            {active && (
              <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-primary-500 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
