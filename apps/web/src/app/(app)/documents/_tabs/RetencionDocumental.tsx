'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Archive, Plus, Save, X, Trash2, Clock, Shield,
} from 'lucide-react';

interface RetentionRule {
  id: string;
  name: string;
  description?: string;
  documentType?: string;
  module?: string;
  retentionYears: number;
  medium: string;
  observations?: string;
  active: boolean;
  createdAt: string;
}

const EMPTY: Partial<RetentionRule> = {
  name: '', description: '', documentType: '', module: '',
  retentionYears: 5, medium: 'DIGITAL', observations: '',
};

export default function RetencionDocumental() {
  const [rules, setRules] = useState<RetentionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<RetentionRule> | null>(null);
  const [isNew, setIsNew] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<RetentionRule[]>('/doc-export/retention-rules');
      setRules(data);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing?.name) return;
    try {
      if (isNew) {
        await apiFetch('/doc-export/retention-rules', { method: 'POST', json: editing });
        setSuccess('Regla creada');
      } else {
        await apiFetch(`/doc-export/retention-rules/${editing.id}`, { method: 'PUT', json: editing });
        setSuccess('Regla actualizada');
      }
      setEditing(null); setIsNew(false); load();
    } catch (e: any) { setError(e.message); }
  }

  async function remove(id: string) {
    if (!confirm('¿Desactivar esta regla?')) return;
    try {
      await apiFetch(`/doc-export/retention-rules/${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) { setError(e.message); }
  }

  if (loading) return <div className="p-8 text-center text-neutral-400">Cargando...</div>;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">{success}</div>}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-800">Reglas de Retención Documental</h2>
        <button onClick={() => { setEditing({ ...EMPTY }); setIsNew(true); }} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Nueva Regla
        </button>
      </div>

      {editing && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-neutral-800">{isNew ? 'Nueva Regla' : 'Editar Regla'}</h3>
            <button onClick={() => { setEditing(null); setIsNew(false); }} className="text-neutral-400 hover:text-neutral-600"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Nombre *</label>
              <input value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Años de retención *</label>
              <input type="number" value={editing.retentionYears || 5} onChange={e => setEditing({ ...editing, retentionYears: parseInt(e.target.value) })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Tipo documental</label>
              <input value={editing.documentType || ''} onChange={e => setEditing({ ...editing, documentType: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" placeholder="Ej: PROCEDURE, RECORD..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Módulo</label>
              <input value={editing.module || ''} onChange={e => setEditing({ ...editing, module: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Medio</label>
              <select value={editing.medium || 'DIGITAL'} onChange={e => setEditing({ ...editing, medium: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm">
                <option value="DIGITAL">Digital</option>
                <option value="PHYSICAL">Físico</option>
                <option value="HYBRID">Híbrido</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-neutral-600 mb-1">Descripción</label>
              <input value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-neutral-600 mb-1">Observaciones</label>
              <textarea value={editing.observations || ''} onChange={e => setEditing({ ...editing, observations: e.target.value })} rows={2} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setEditing(null); setIsNew(false); }} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm">Cancelar</button>
            <button onClick={save} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white"><Save className="h-4 w-4" /> Guardar</button>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {rules.map(r => (
          <div key={r.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-brand-600" />
                <h3 className="font-semibold text-sm text-neutral-800">{r.name}</h3>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(r); setIsNew(false); }} className="text-neutral-400 hover:text-brand-600 text-xs">Editar</button>
                <button onClick={() => remove(r.id)} className="text-neutral-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            {r.description && <p className="mt-1 text-xs text-neutral-500">{r.description}</p>}
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {r.documentType && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-600">{r.documentType}</span>}
              {r.module && <span className="rounded bg-purple-50 px-1.5 py-0.5 text-purple-600">{r.module}</span>}
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-600"><Clock className="h-3 w-3 inline" /> {r.retentionYears} años</span>
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600">{r.medium}</span>
            </div>
          </div>
        ))}
        {rules.length === 0 && !editing && (
          <div className="col-span-full text-center py-12 text-neutral-400">
            <Archive className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No hay reglas de retención configuradas.</p>
          </div>
        )}
      </div>
    </div>
  );
}
