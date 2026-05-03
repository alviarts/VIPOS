import { Star } from 'lucide-react';
import { useState } from 'react';

/**
 * Majoo-style page header with title, optional info, optional star/favorite,
 * and right-aligned action buttons (children).
 */
export default function PageHeader({ title, subtitle, icon: Icon, favorable = true, children }) {
  const [favorited, setFavorited] = useState(false);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {favorable && (
              <button
                onClick={() => setFavorited((f) => !f)}
                className="p-1 rounded-md hover:bg-gray-100"
                aria-label="Tandai favorit"
              >
                <Star
                  className={`w-5 h-5 ${
                    favorited ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                  }`}
                />
              </button>
            )}
          </div>
          {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
