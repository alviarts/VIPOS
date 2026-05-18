// VIPOS — Product image uploader (max 4 images, drag-to-reorder).
//
// Uploads each file to /api/uploads/products and stores the returned URL in
// the value array. Supports HTML5 drag-and-drop reordering (no extra deps).
import { useRef, useState } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import api from '../../utils/api';
import { getAccessToken } from '../../utils/api';

const MAX_IMAGES = 4;

function resolveUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  // Backend returns "/uploads/..."; combine with base URL minus trailing /api.
  const base = api.defaults.baseURL.replace(/\/api.*$/, '');
  return `${base}${url}`;
}

export default function ImageUploader({ value = [], onChange, max = MAX_IMAGES }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [error, setError] = useState(null);

  const handleFiles = async (files) => {
    if (!files?.length) return;
    setError(null);
    const slots = max - value.length;
    if (slots <= 0) {
      setError(`Maksimum ${max} foto`);
      return;
    }
    const list = Array.from(files).slice(0, slots);
    setUploading(true);
    try {
      const tokens = getAccessToken();
      const uploaded = [];
      for (const file of list) {
        const fd = new FormData();
        fd.append('image', file);
        const res = await fetch(`${api.defaults.baseURL}/uploads/products`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokens}` },
          body: fd,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Upload gagal (${res.status})`);
        }
        const data = await res.json();
        uploaded.push(data.url);
      }
      onChange([...value, ...uploaded]);
    } catch (e) {
      setError(e.message || 'Upload gagal');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeAt = (idx) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const reorder = (from, to) => {
    if (from === to) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {value.map((url, i) => (
          <div
            key={`${url}-${i}`}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) reorder(dragIndex, i);
              setDragIndex(null);
            }}
            className="relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 cursor-move"
            title="Drag untuk ubah urutan"
          >
            <img src={resolveUrl(url)} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white hover:bg-red-600"
              aria-label="Hapus foto"
            >
              <X className="h-3 w-3" />
            </button>
            {i === 0 && (
              <span className="absolute bottom-1 left-1 rounded bg-primary-600 px-1 text-[10px] font-semibold text-white">
                UTAMA
              </span>
            )}
          </div>
        ))}

        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-24 w-24 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-500 hover:border-primary-400 hover:text-primary-600"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <ImagePlus className="mb-1 h-5 w-5" />
                <span>Tambah Foto</span>
              </>
            )}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <p className="mt-2 text-xs text-gray-400">
        Maksimum {max} foto. Drag untuk ubah urutan; foto pertama jadi utama.
      </p>
    </div>
  );
}
