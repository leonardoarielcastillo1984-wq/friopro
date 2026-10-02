'use client';
import { useMemo, useState } from 'react';
import {
  X, Plus, Pencil, Trash2, ArrowRight, ArrowLeftRight, MapPin, Loader2, Network,
} from 'lucide-react';

// ── Tipos ────────────────────────────────────────────────────────────────────
export type GenProcessRef = { id: string; name: string; parentId?: string | null; sites?: string[] };

export type Interaction = {
  id: string;
  fromId: string;
  toId: string;
  label?: string | null;
  fromSite?: string | null;
  toSite?: string | null;
  notes?: string | null;
};

export type InteractionDraft = {
  fromId: string;
  toId: string;
  label: string;
  fromSite: string;
  toSite: string;
  notes: string;
};

type MapRef = { id: string; name: string; processes: GenProcessRef[] };

const EMPTY_DRAFT: InteractionDraft = { fromId: '', toId: '', label: '', fromSite: '', toSite: '', notes: '' };

// Modal "Interacciones entre procesos" (amplía el viejo "Vínculos entre áreas").
// Lista y permite crear/editar las interacciones etiquetadas que alimentan las
// flechas del Mapa General: origen → destino, qué se transfiere y sedes.
export default function InteraccionesModal({
  maps,
  interactions,
  saving,
  onSave,
  onDelete,
  onClose,
  onOpenDiagram,
}: {
  maps: MapRef[];
  interactions: Interaction[];
  saving?: boolean;
  onSave: (draft: InteractionDraft, id?: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onClose: () => void;
  onOpenDiagram?: () => void;
}) {
  const [draft, setDraft] = useState<InteractionDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Índice proceso → mapa (para mostrar "Mapa › Proceso" y resolver sedes).
  const procIndex = useMemo(() => {
    const idx = new Map<string, { p: GenProcessRef; map: MapRef }>();
    maps.forEach(m => m.processes.forEach(p => idx.set(p.id, { p, map: m })));
    return idx;
  }, [maps]);

  // Opciones del selector: macroprocesos primero (las interacciones del mapa
  // general se definen entre macroprocesos), agrupados por mapa.
  const procOptions = useMemo(() => {
    return maps.map(m => ({
      map: m,
      procs: m.processes.filter(p => !p.parentId).sort((a, b) => a.name.localeCompare(b.name)),
    })).filter(g => g.procs.length > 0);
  }, [maps]);

  // Sedes conocidas (unión de sedes de todos los procesos) para autocompletar.
  const siteOptions = useMemo(() => {
    const s = new Set<string>();
    maps.forEach(m => m.processes.forEach(p => (p.sites || []).forEach(x => x && s.add(x))));
    [draft.fromSite, draft.toSite].forEach(x => x && s.add(x));
    interactions.forEach(i => { if (i.fromSite) s.add(i.fromSite); if (i.toSite) s.add(i.toSite); });
    return Array.from(s).sort();
  }, [maps, interactions, draft.fromSite, draft.toSite]);

  const procLabel = (id: string) => {
    const e = procIndex.get(id);
    return e ? `${e.map.name} › ${e.p.name}` : 'Proceso eliminado';
  };

  function startEdit(it: Interaction) {
    setEditingId(it.id);
    setDraft({
      fromId: it.fromId,
      toId: it.toId,
      label: it.label ?? '',
      fromSite: it.fromSite ?? '',
      toSite: it.toSite ?? '',
      notes: it.notes ?? '',
    });
    setError('');
  }

  function resetForm() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError('');
  }

  async function submit() {
    if (!draft.fromId || !draft.toId) { setError('Elegí el proceso origen y el destino.'); return; }
    if (draft.fromId === draft.toId) { setError('El origen y el destino no pueden ser el mismo proceso.'); return; }
    setError('');
    try {
      await onSave(draft, editingId ?? undefined);
      resetForm();
    } catch {
      setError('No se pudo guardar la interacción.');
    }
  }

  const inputCls = 'w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white';
  const labelCls = 'block text-xs font-medium text-neutral-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div>
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-indigo-500" /> Interacciones entre procesos
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Definí origen, destino, qué se transfiere y entre qué sedes. Se dibujan como flechas etiquetadas en el Mapa General.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100"><X className="h-5 w-5 text-neutral-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Formulario alta/edición */}
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-4 space-y-3">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
              {editingId ? 'Editar interacción' : 'Nueva interacción'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-end">
              <div>
                <label className={labelCls}>Proceso origen *</label>
                <select value={draft.fromId} onChange={e => setDraft(d => ({ ...d, fromId: e.target.value }))} className={inputCls}>
                  <option value="">Seleccionar…</option>
                  {procOptions.map(g => (
                    <optgroup key={g.map.id} label={g.map.name}>
                      {g.procs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <ArrowRight className="h-4 w-4 text-neutral-400 mx-auto mb-2.5 hidden sm:block" aria-hidden />
              <div>
                <label className={labelCls}>Proceso destino *</label>
                <select value={draft.toId} onChange={e => setDraft(d => ({ ...d, toId: e.target.value }))} className={inputCls}>
                  <option value="">Seleccionar…</option>
                  {procOptions.map(g => (
                    <optgroup key={g.map.id} label={g.map.name}>
                      {g.procs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Qué se transfiere (etiqueta de la flecha)</label>
              <input
                value={draft.label}
                onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
                placeholder="Ej: Piezas mecanizadas, Orden de producción, Especificaciones…"
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className={labelCls}><MapPin className="inline h-3 w-3 mr-1 -mt-0.5" />Sede origen</label>
                <input
                  value={draft.fromSite}
                  onChange={e => setDraft(d => ({ ...d, fromSite: e.target.value }))}
                  placeholder="Ej: Planta Córdoba"
                  list="interaction-sites"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}><MapPin className="inline h-3 w-3 mr-1 -mt-0.5" />Sede destino</label>
                <input
                  value={draft.toSite}
                  onChange={e => setDraft(d => ({ ...d, toSite: e.target.value }))}
                  placeholder="Ej: Casa Central"
                  list="interaction-sites"
                  className={inputCls}
                />
              </div>
            </div>
            <datalist id="interaction-sites">
              {siteOptions.map(s => <option key={s} value={s} />)}
            </datalist>
            <div>
              <label className={labelCls}>Notas (opcional)</label>
              <input value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} placeholder="Condiciones, frecuencia, medio…" className={inputCls} />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex justify-end gap-2">
              {editingId && (
                <button onClick={resetForm} className="px-3 py-1.5 text-xs text-neutral-600 border border-neutral-200 rounded-lg hover:bg-white">
                  Cancelar edición
                </button>
              )}
              <button
                onClick={submit}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {editingId ? 'Guardar cambios' : 'Agregar interacción'}
              </button>
            </div>
          </div>

          {/* Lista de interacciones */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
              Interacciones definidas ({interactions.length})
            </p>
            {interactions.length === 0 ? (
              <p className="text-xs text-neutral-400 italic">Sin interacciones definidas. Agregá la primera desde el formulario.</p>
            ) : (
              <ul className="space-y-1.5">
                {interactions.map(it => (
                  <li key={it.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${editingId === it.id ? 'border-indigo-300 bg-indigo-50/50' : 'border-neutral-200 bg-white'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-neutral-800 truncate">
                        <span className="font-medium">{procLabel(it.fromId)}</span>
                        <ArrowRight className="inline h-3 w-3 mx-1 text-neutral-400 -mt-0.5" aria-hidden />
                        <span className="font-medium">{procLabel(it.toId)}</span>
                      </p>
                      <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                        {it.label || <span className="italic text-neutral-400">sin etiqueta</span>}
                        {(it.fromSite || it.toSite) && (
                          <span className="text-neutral-400">
                            {' '}· {it.fromSite || '—'} → {it.toSite || '—'}
                          </span>
                        )}
                      </p>
                    </div>
                    <button onClick={() => startEdit(it)} title="Editar" className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-indigo-600">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm('¿Eliminar esta interacción?')) onDelete(it.id); }}
                      title="Eliminar"
                      className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-neutral-100">
          {onOpenDiagram ? (
            <button onClick={onOpenDiagram} className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              <Network className="h-3.5 w-3.5" /> Ver diagrama de áreas (exportable)
            </button>
          ) : <span />}
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
