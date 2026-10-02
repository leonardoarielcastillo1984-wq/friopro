'use client';
import { useState } from 'react';
import { X, Plus, Pencil, Trash2, Loader2, Boxes } from 'lucide-react';

// ── Tipos ────────────────────────────────────────────────────────────────────
export type OutsourcedProcess = {
  id: string;
  name: string;
  supplier?: string | null;
  scope?: string | null;
  control?: string | null;
  order?: number;
};

export type OutsourcedDraft = {
  name: string;
  supplier: string;
  scope: string;
  control: string;
};

const EMPTY_DRAFT: OutsourcedDraft = { name: '', supplier: '', scope: '', control: '' };

// Modal "Procesos externalizados": sección configurable del Mapa General que
// reemplaza la caja fija "si aplican". Permite declarar qué se externaliza,
// el proveedor y el control ejercido (IATF 16949 §8.4).
export default function ExternalizadosModal({
  items,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  items: OutsourcedProcess[];
  saving?: boolean;
  onSave: (draft: OutsourcedDraft, id?: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<OutsourcedDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  function startEdit(it: OutsourcedProcess) {
    setEditingId(it.id);
    setDraft({
      name: it.name,
      supplier: it.supplier ?? '',
      scope: it.scope ?? '',
      control: it.control ?? '',
    });
    setError('');
  }

  function resetForm() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError('');
  }

  async function submit() {
    if (!draft.name.trim()) { setError('El nombre del proceso externalizado es obligatorio.'); return; }
    setError('');
    try {
      await onSave(draft, editingId ?? undefined);
      resetForm();
    } catch {
      setError('No se pudo guardar el proceso externalizado.');
    }
  }

  const inputCls = 'w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white';
  const labelCls = 'block text-xs font-medium text-neutral-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div>
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <Boxes className="h-4 w-4 text-neutral-500" /> Procesos externalizados
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Declará los procesos ejecutados por terceros, el proveedor y el control ejercido. Se muestran en la franja Soporte del Mapa General.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100"><X className="h-5 w-5 text-neutral-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Formulario alta/edición */}
          <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 p-4 space-y-3">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
              {editingId ? 'Editar proceso externalizado' : 'Nuevo proceso externalizado'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Proceso *</label>
                <input
                  value={draft.name}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  placeholder="Ej: Tratamiento térmico, Galvanizado, Transporte"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Proveedor</label>
                <input
                  value={draft.supplier}
                  onChange={e => setDraft(d => ({ ...d, supplier: e.target.value }))}
                  placeholder="Ej: Proveedor S.A."
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Qué se externaliza (alcance)</label>
              <input
                value={draft.scope}
                onChange={e => setDraft(d => ({ ...d, scope: e.target.value }))}
                placeholder="Ej: Tratamiento superficial de conjuntos de ruedas"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Control ejercido</label>
              <input
                value={draft.control}
                onChange={e => setDraft(d => ({ ...d, control: e.target.value }))}
                placeholder="Ej: Evaluación anual, inspección de recepción, indicadores de desempeño"
                className={inputCls}
              />
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
                {editingId ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </div>

          {/* Lista */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
              Externalizados definidos ({items.length})
            </p>
            {items.length === 0 ? (
              <p className="text-xs text-neutral-400 italic">
                Sin procesos externalizados. Si ningún proceso se terceriza, la sección solo muestra la referencia normativa.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {items.map(it => (
                  <li key={it.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${editingId === it.id ? 'border-indigo-300 bg-indigo-50/50' : 'border-neutral-200 bg-white'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-neutral-800 truncate">{it.name}</p>
                      <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                        {[it.supplier && `Proveedor: ${it.supplier}`, it.scope, it.control && `Control: ${it.control}`]
                          .filter(Boolean).join(' · ') || <span className="italic text-neutral-400">sin detalle</span>}
                      </p>
                    </div>
                    <button onClick={() => startEdit(it)} title="Editar" className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-indigo-600">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm('¿Eliminar este proceso externalizado?')) onDelete(it.id); }}
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

        <div className="flex justify-end px-6 py-3 border-t border-neutral-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
