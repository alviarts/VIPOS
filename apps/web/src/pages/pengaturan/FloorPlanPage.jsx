// Floor plan editor — drag-and-drop table layout per outlet.
// Lite implementation: click "Add Table", drag to position, klik Save.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import api from '../../utils/api';

export default function FloorPlanPage() {
  const { id } = useParams();
  const [plan, setPlan] = useState({
    name: 'Lantai 1',
    width: 1000,
    height: 700,
    tables: [],
  });
  const [outlet, setOutlet] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const dragRef = useRef(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    const [o, p] = await Promise.all([
      api.get(`/outlet/${id}`),
      api.get(`/outlet/${id}/floor-plan`),
    ]);
    setOutlet(o.data);
    setPlan({
      name: p.data.name || 'Lantai 1',
      width: p.data.width || 1000,
      height: p.data.height || 700,
      tables: Array.isArray(p.data.tables) ? p.data.tables : [],
    });
  }

  function addTable() {
    const id = `t-${Date.now()}`;
    const next = {
      id,
      label: `M${plan.tables.length + 1}`,
      x: 50,
      y: 50,
      w: 80,
      h: 80,
      capacity: 4,
      shape: 'square',
    };
    setPlan({ ...plan, tables: [...plan.tables, next] });
    setSelectedId(id);
  }

  function deleteTable(tid) {
    setPlan({ ...plan, tables: plan.tables.filter((t) => t.id !== tid) });
    if (selectedId === tid) setSelectedId(null);
  }

  function updateTable(tid, patch) {
    setPlan({
      ...plan,
      tables: plan.tables.map((t) => (t.id === tid ? { ...t, ...patch } : t)),
    });
  }

  function onTableMouseDown(e, t) {
    e.preventDefault();
    setSelectedId(t.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const tx = t.x;
    const ty = t.y;
    dragRef.current = { tid: t.id, startX, startY, tx, ty };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    setPlan((prev) => ({
      ...prev,
      tables: prev.tables.map((t) =>
        t.id === d.tid ? { ...t, x: Math.max(0, d.tx + dx), y: Math.max(0, d.ty + dy) } : t
      ),
    }));
  }

  function onMouseUp() {
    dragRef.current = null;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  async function save() {
    setSaving(true);
    try {
      await api.put(`/outlet/${id}/floor-plan`, plan);
      toast.success('Floor plan disimpan');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal');
    } finally {
      setSaving(false);
    }
  }

  const selected = useMemo(() => plan.tables.find((t) => t.id === selectedId), [plan, selectedId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/settings/outlets"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600"
          >
            <ArrowLeft className="h-4 w-4" /> Outlet
          </Link>
          <h1 className="text-xl font-semibold">Floor Plan — {outlet?.name || ''}</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={addTable}
            className="inline-flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-semibold text-primary-700 hover:bg-primary-100"
          >
            <Plus className="h-4 w-4" /> Tambah Meja
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div
          className="relative col-span-3 overflow-auto rounded-xl border-2 border-dashed border-gray-200 bg-gray-50"
          style={{ height: 700 }}
        >
          <div className="relative bg-white" style={{ width: plan.width, height: plan.height }}>
            {plan.tables.map((t) => (
              <div
                key={t.id}
                onMouseDown={(e) => onTableMouseDown(e, t)}
                className={`absolute flex cursor-move flex-col items-center justify-center rounded-lg border-2 text-xs font-semibold shadow ${
                  selectedId === t.id
                    ? 'border-primary-500 bg-primary-100 text-primary-900'
                    : 'border-gray-300 bg-white text-gray-700'
                } ${t.shape === 'round' ? 'rounded-full' : ''}`}
                style={{ left: t.x, top: t.y, width: t.w, height: t.h }}
              >
                <span>{t.label}</span>
                <span className="text-[10px] text-gray-400">{t.capacity || 4}p</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Properti Meja</h3>
          {!selected ? (
            <p className="text-xs text-gray-400">Pilih atau tambahkan meja untuk mengedit.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <Field label="Label">
                <input
                  value={selected.label}
                  onChange={(e) => updateTable(selected.id, { label: e.target.value })}
                  className="input-field"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="X">
                  <input
                    type="number"
                    value={selected.x}
                    onChange={(e) => updateTable(selected.id, { x: Number(e.target.value) })}
                    className="input-field"
                  />
                </Field>
                <Field label="Y">
                  <input
                    type="number"
                    value={selected.y}
                    onChange={(e) => updateTable(selected.id, { y: Number(e.target.value) })}
                    className="input-field"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Lebar">
                  <input
                    type="number"
                    value={selected.w}
                    onChange={(e) => updateTable(selected.id, { w: Number(e.target.value) })}
                    className="input-field"
                  />
                </Field>
                <Field label="Tinggi">
                  <input
                    type="number"
                    value={selected.h}
                    onChange={(e) => updateTable(selected.id, { h: Number(e.target.value) })}
                    className="input-field"
                  />
                </Field>
              </div>
              <Field label="Bentuk">
                <select
                  value={selected.shape || 'square'}
                  onChange={(e) => updateTable(selected.id, { shape: e.target.value })}
                  className="input-field"
                >
                  <option value="square">Persegi</option>
                  <option value="round">Bulat</option>
                </select>
              </Field>
              <Field label="Kapasitas">
                <input
                  type="number"
                  value={selected.capacity || 4}
                  onChange={(e) => updateTable(selected.id, { capacity: Number(e.target.value) })}
                  className="input-field"
                />
              </Field>
              <button
                onClick={() => deleteTable(selected.id)}
                className="inline-flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" /> Hapus Meja
              </button>
            </div>
          )}

          <div className="border-t border-gray-100 pt-3">
            <h4 className="mb-2 text-xs font-semibold text-gray-700">Kanvas</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Field label="Lebar">
                <input
                  type="number"
                  value={plan.width}
                  onChange={(e) => setPlan({ ...plan, width: Number(e.target.value) })}
                  className="input-field"
                />
              </Field>
              <Field label="Tinggi">
                <input
                  type="number"
                  value={plan.height}
                  onChange={(e) => setPlan({ ...plan, height: Number(e.target.value) })}
                  className="input-field"
                />
              </Field>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
