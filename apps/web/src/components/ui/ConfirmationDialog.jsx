import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * Pre-save / pre-delete confirmation dialog.
 * Mirrors Majoo: title, body text, "Batal" + colored confirm button.
 */
export default function ConfirmationDialog({
  open,
  title = 'Konfirmasi',
  message,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'primary', // 'primary' (teal) or 'danger' (red)
  onConfirm,
  onCancel,
  loading = false,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmClass =
    variant === 'danger'
      ? 'btn-danger'
      : 'btn-primary';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                variant === 'danger' ? 'bg-red-50 text-red-600' : 'bg-primary-50 text-primary-600'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 text-sm text-gray-700 whitespace-pre-line">{message}</div>
        <div className="flex justify-end gap-2 px-6 pb-5">
          <button onClick={onCancel} disabled={loading} className="btn-secondary text-sm">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={loading} className={`${confirmClass} text-sm`}>
            {loading ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
