'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus, X, Loader2, Trash2, Building2, GitBranch, Pencil, Check } from 'lucide-react';

export type CentroCosto = {
  id: string; nombre: string; tipo: 'UNIDAD_NEGOCIO' | 'CENTRO_COSTO';
  parentId: string | null; activo: boolean; notas: string | null;
};

const vacio = { nombre: '', tipo: 'CENTRO_COSTO', parentId: '', notas: '', activo: true };

export default function CentrosCosto({ centros, canEdit, reload }: { centros: CentroCosto[]; canEdit: boolean; reload: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<typeof vacio>(vacio);

  const guardar = async () => {
    setError(null);
    if (!form.nombre.trim()) return setError('El nombre es obligatorio');
    if (editId && form.parentId === editId) return setError('Un centro no puede depender de sí mismo');
    setSaving(true);
    try {
      const json = { nombre: form.nombre.trim(), tipo: form.tipo, parentId: form.parentId || null, notas: form.notas || null, activo: form.activo };
      await apiFetch(editId ? `/finanzas/centros-costo/${editId}` : '/finanzas/centros-costo', { method: editId ? 'PATCH' : 'POST', json });
      setForm(vacio); setShowForm(false); setEditId(null); reload();
    } catch (e: any) { setError(e?.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const editar = (c: CentroCosto) => {
    setEditId(c.id); setShowForm(false);
    setForm({ nombre: c.nombre, tipo: c.tipo, parentId: c.parentId || '', notas: c.notas || '', activo: c.activo });
  };

  const eliminar = async (c: CentroCosto) => {
    const hijos = centros.some(x => x.parentId === c.id);
    if (!window.confirm(`¿Eliminar "${c.nombre}"${hijos ? ' y sus centros hijos' : ''}? Las facturas y gastos asignados quedan sin centro.`)) return;
    await apiFetch(`/finanzas/centros-costo/${c.id}`, { method: 'DELETE' });
    reload();
  };

  const inputCls = 'w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none';
  const labelCls = 'block text-[11px] font-medium uppercase tracking-wide text-neutral-500 mb-1';
  const unidades = centros.filter(c => c.tipo === 'UNIDAD_NEGOCIO');

  const campos = (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <div><label className={labelCls}>Nombre *</label><input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className={inputCls} placeholder="Ej. Operación Stellantis" /></div>
      <div><label className={labelCls}>Tipo</label>
        <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className={inputCls}>
          <option value="CENTRO_COSTO">Centro de costo</option><option value="UNIDAD_NEGOCIO">Unidad de negocio</option>
        </select></div>
      <div><label className={labelCls}>Pertenece a</label>
        <select value={form.parentId} onChange={e => setForm({ ...form, parentId: e.target.value })} className={inputCls}>
          <option value="">—</option>{unidades.filter(u => u.id !== editId).map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select></div>
      <div><label className={labelCls}>Notas</label><input value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} className={inputCls} /></div>
      <div className="flex items-end pb-2">
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input type="checkbox" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} className="rounded" /> Activo
        </label>
      </div>
    </div>
  );

  const renderCentro = (c: CentroCosto, depth: number): any => {
    const hijos = centros.filter(x => x.parentId === c.id);
    return (
      <div key={c.id}>
        {editId === c.id ? (
          <div className="border-b border-neutral-100 bg-blue-50/30 p-4">
            {campos}
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => { setEditId(null); setForm(vacio); }} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100"><X size={14} /> Cancelar</button>
              <button onClick={guardar} disabled={saving} className="flex items-center gap-1 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar
              </button>
            </div>
          </div>
        ) : (
          <div className={`flex items-center gap-3 border-b border-neutral-100 px-4 py-2.5 ${!c.activo ? 'opacity-50' : ''}`} style={{ paddingLeft: 16 + depth * 24 }}>
            {c.tipo === 'UNIDAD_NEGOCIO' ? <Building2 size={15} className="text-blue-600" /> : <GitBranch size={14} className="text-neutral-400" />}
            <span className="text-sm font-medium text-neutral-900">{c.nombre}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.tipo === 'UNIDAD_NEGOCIO' ? 'bg-blue-50 text-blue-700' : 'bg-neutral-100 text-neutral-500'}`}>
              {c.tipo === 'UNIDAD_NEGOCIO' ? 'Unidad de negocio' : 'Centro de costo'}
            </span>
            {!c.activo && <span className="text-[10px] text-neutral-400">inactivo</span>}
            {c.notas && <span className="text-xs text-neutral-400">{c.notas}</span>}
            {canEdit && (
              <div className="ml-auto flex gap-1">
                <button onClick={() => editar(c)} className="p-1 text-neutral-400 hover:text-blue-600" title="Editar"><Pencil size={14} /></button>
                <button onClick={() => eliminar(c)} className="p-1 text-neutral-300 hover:text-red-500" title="Eliminar"><Trash2 size={14} /></button>
              </div>
            )}
          </div>
        )}
        {hijos.map(h => renderCentro(h, depth + 1))}
      </div>
    );
  };

  const raices = centros.filter(c => !c.parentId || !centros.some(p => p.id === c.parentId));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-neutral-400">
          Unidades de negocio y centros de costo para ver el resultado por operación (ej. "Chile" → "Operación Stellantis").
          Filtrá el dashboard por unidad desde el selector de arriba.
        </p>
        {canEdit && (
          <button onClick={() => { setShowForm(true); setEditId(null); setForm(vacio); }} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
            <Plus size={15} /> Nuevo
          </button>
        )}
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {showForm && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">Nuevo centro</span>
            <button onClick={() => setShowForm(false)} className="text-neutral-400 hover:text-neutral-600"><X size={16} /></button>
          </div>
          {campos}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-100">Cancelar</button>
            <button onClick={guardar} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {saving && <Loader2 size={14} className="animate-spin" />} Guardar
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {raices.map(c => renderCentro(c, 0))}
        {centros.length === 0 && <div className="px-4 py-10 text-center text-neutral-400">Sin centros de costo. Creá la primera unidad de negocio.</div>}
      </div>
    </div>
  );
}
