// VIPOS — Single-icon uploader untuk kategori (P1-05).
//
// Upload 1 file ke /api/uploads/category-icons (max 1 MB), simpan URL relatif.
// Frontend resolve URL dengan base API minus suffix `/api`.
import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import api, { getAccessToken } from '../../utils/api';

function resolveUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const base = api.defaults.baseURL.replace(/\/api\/?$/, '');
  return `${base}${url}`;
}

export default function IconUploader({ value, onChange, label = 'Ikon kategori' }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const token = getAccessToken();
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch(`${api.defaults.baseURL}/uploads/category-icons`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Upload gagal (${res.status})`);
      }
      const data = await res.json();
      onChange(data.url);
    } catch (e) {
      setError(e.message || 'Upload gagal');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
          {value ? (
            <>
              <img src={resolveUrl(value)} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(null)}
                className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white hover:bg-red-600"
                aria-label="Hapus ikon"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <ImagePlus className="h-5 w-5 text-gray-300" />
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="btn-outline text-xs flex items-center gap-1.5 px-3 py-1.5"
        >
          {uploading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Mengupload...
            </>
          ) : (
            <>
              <ImagePlus className="h-3.5 w-3.5" /> {value ? 'Ganti Ikon' : 'Pilih Ikon'}
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <p className="mt-1 text-[11px] text-gray-400">Format PNG/JPG/SVG. Maksimal 1 MB. Optional.</p>
    </div>
  );
}
