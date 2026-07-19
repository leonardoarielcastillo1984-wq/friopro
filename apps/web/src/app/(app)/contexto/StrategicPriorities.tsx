'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Star, Save, Loader2, ListChecks, Pencil, Trash2, Check, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type Quadrant = 'strengths' | 'weaknesses' | 'opportunities' | 'threats';
type PriorityMap = Record<Quadrant, Record<string, number>>;
type FodaKey = 's' | 'w' | 'o' | 't';

const PRIORITY_LABEL: Record<number, string> = { 5: 'Muy Alta', 4: 'Alta', 3: 'Media', 2: 'Baja', 1: 'Muy Baja' };

const QUAD_META: { key: Quadrant; label: string; color: string; border: string }[] = [
  { key: 'strengths', label: 'Fortalezas', color: 'text-green-700', border: 'border-green-100' },
  { key: 'weaknesses', label: 'Debilidades', color: 'text-red-700', border: 'border-red-100' },
  { key: 'opportunities', label: 'Oportunidades', color: 'text-blue-700', border: 'border-blue-100' },
  { key: 'threats', label: 'Amenazas', color: 'text-orange-700', border: 'border-orange-100' },
];

function lines(text?: string): string[] {
  return (text || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => onChange(value === n ? 0 : n)} className="p-0.5">
          <Star className={`h-3.5 w-3.5 ${active >= n ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
        </button>
      ))}
      <span className="text-[10px] ml-1 w-14 shrink-0 text-gray-400">{active ? PRIORITY_LABEL[active] : '—'}</span>
    </div>
  );
}

interface Props {
  year: number;
  foda: { s: string; w: string; o: string; t: string };
  onFodaChange?: (q: FodaKey, text: string) => void;
  onSaved?: () => void;
}

export default function StrategicPriorities({ year, foda, onFodaChange, onSaved }: Props) {
  const [prio, setPrio] = useState<PriorityMap>({ strengths: {}, weaknesses: {}, opportunities: {}, threats: {} });
  const [localItems, setLocalItems] = useState<Record<Quadrant, string[]>>({
    strengths: [], weaknesses: [], opportunities: [], threats: [],
  });
  const [editing, setEditing] = useState<{ q: Quadrant; idx: number; val: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasItemChanges, setHasItemChanges] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Inicializar/sincronizar localItems desde prop foda
  useEffect(() => {
    setLocalItems({
      strengths: lines(foda.s),
      weaknesses: lines(foda.w),
      opportunities: lines(foda.o),
      threats: lines(foda.t),
    });
  }, [foda.s, foda.w, foda.o, foda.t]);

  // Foco automático al activar edición
  useEffect(() => {
    if (editing) setTimeout(() => editInputRef.current?.focus(), 0);
  }, [editing]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ item: { fodaPriorities?: PriorityMap } | null }>(`/context/${year}`);
      const fp = res?.item?.fodaPriorities;
      if (fp && typeof fp === 'object') {
        setPrio({ strengths: fp.strengths || {}, weaknesses: fp.weaknesses || {}, opportunities: fp.opportunities || {}, threats: fp.threats || {} });
      }
    } catch { /* silencioso */ } finally { setLoading(false); }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const setStar = (q: Quadrant, item: string, v: number) => {
    setPrio((prev) => {
      const next = { ...prev, [q]: { ...prev[q] } };
      if (v === 0) delete next[q][item]; else next[q][item] = v;
      return next;
    });
    setSaved(false);
  };

  // ── Eliminar ítem ──
  const deleteItem = (q: Quadrant, idx: number) => {
    const item = localItems[q][idx];
    setLocalItems((prev) => ({ ...prev, [q]: prev[q].filter((_, i) => i !== idx) }));
    setPrio((prev) => {
      const next = { ...prev, [q]: { ...prev[q] } };
      delete next[q][item];
      return next;
    });
    setHasItemChanges(true);
    setSaved(false);
  };

  // ── Iniciar edición inline ──
  const startEdit = (q: Quadrant, idx: number) => {
    setEditing({ q, idx, val: localItems[q][idx] });
  };

  // ── Confirmar edición ──
  const confirmEdit = () => {
    if (!editing) return;
    const { q, idx, val } = editing;
    const trimmed = val.trim();
    if (!trimmed) { cancelEdit(); return; }
    const oldText = localItems[q][idx];
    if (trimmed === oldText) { setEditing(null); return; }
    setLocalItems((prev) => {
      const arr = [...prev[q]];
      arr[idx] = trimmed;
      return { ...prev, [q]: arr };
    });
    // Migrar prioridad del texto viejo al nuevo
    setPrio((prev) => {
      const next = { ...prev, [q]: { ...prev[q] } };
      if (next[q][oldText] !== undefined) {
        next[q][trimmed] = next[q][oldText];
        delete next[q][oldText];
      }
      return next;
    });
    setEditing(null);
    setHasItemChanges(true);
    setSaved(false);
  };

  const cancelEdit = () => setEditing(null);

  // ── Guardar (prioridades + ítems si cambiaron) ──
  const save = async () => {
    setSaving(true);
    try {
      // 1. Guardar prioridades
      await apiFetch(`/context/${year}/priorities`, { method: 'PUT', json: { fodaPriorities: prio } });

      // 2. Si hubo cambios en ítems, persistir FODA actualizado
      if (hasItemChanges) {
        await apiFetch(`/context/${year}`, {
          method: 'PUT',
          json: {
            strengths: localItems.strengths,
            weaknesses: localItems.weaknesses,
            opportunities: localItems.opportunities,
            threats: localItems.threats,
          },
        });
        // Notificar al padre para sincronizar textareas
        onFodaChange?.('s', localItems.strengths.join('\n'));
        onFodaChange?.('w', localItems.weaknesses.join('\n'));
        onFodaChange?.('o', localItems.opportunities.join('\n'));
        onFodaChange?.('t', localItems.threats.join('\n'));
        setHasItemChanges(false);
      }
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      alert('Error al guardar: ' + (e?.message || 'desconocido'));
    } finally { setSaving(false); }
  };

  const totalItems = Object.values(localItems).reduce((a, b) => a + b.length, 0);

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Prioridad Estratégica</h2>
          {hasItemChanges && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Cambios sin guardar</span>}
        </div>
        <button onClick={save} disabled={saving || loading || totalItems === 0} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saved ? 'Guardado ✓' : 'Guardar'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-4">Asigná prioridad (estrellas), editá o eliminá cada ítem del FODA. Los cambios se persisten al guardar.</p>

      {loading ? (
        <div className="text-sm text-gray-400 py-4">Cargando...</div>
      ) : totalItems === 0 ? (
        <div className="text-sm text-gray-400 py-4">Cargá ítems en el FODA para priorizarlos.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
          {QUAD_META.map(({ key, label, color }) => (
            <div key={key}>
              <p className={`text-xs font-semibold mb-2 ${color}`}>{label} <span className="font-normal text-gray-400">({localItems[key].length})</span></p>
              {localItems[key].length === 0 ? (
                <p className="text-xs text-gray-400 italic">Sin ítems</p>
              ) : (
                <ul className="space-y-0.5">
                  {localItems[key].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 py-1 border-b border-gray-50 group">
                      {editing?.q === key && editing.idx === i ? (
                        // ── Modo edición ──
                        <>
                          <input
                            ref={editInputRef}
                            value={editing.val}
                            onChange={(e) => setEditing({ ...editing, val: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') cancelEdit(); }}
                            className="flex-1 text-sm px-2 py-0.5 border border-blue-400 rounded focus:outline-none"
                          />
                          <button onClick={confirmEdit} title="Confirmar" className="p-1 text-green-600 hover:bg-green-50 rounded">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={cancelEdit} title="Cancelar" className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        // ── Modo normal ──
                        <>
                          <span className="text-sm text-gray-700 flex-1 min-w-0 truncate" title={item}>{item}</span>
                          <StarPicker value={prio[key][item] || 0} onChange={(v) => setStar(key, item, v)} />
                          <button onClick={() => startEdit(key, i)} title="Editar" className="p-1 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteItem(key, i)} title="Eliminar" className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
