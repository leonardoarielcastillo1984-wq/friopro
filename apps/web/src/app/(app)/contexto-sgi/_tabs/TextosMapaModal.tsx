'use client';
import { useEffect, useState } from 'react';
import { X, Loader2, RotateCcw, Type } from 'lucide-react';
import { DEFAULT_LABELS, LABEL_FIELDS, type MapLabels } from './mapaGeneralLabels';

// Modal "Textos del mapa": edita todas las etiquetas del diagrama del Mapa
// General (bandas, conectores, cajas de extremo, externalizados, leyenda).
// Los cambios se guardan por tenant en company_settings.mapaGeneralLabels;
// dejar un campo vacío restaura el texto por defecto.
export default function TextosMapaModal({
  labels,
  saving,
  onSave,
  onClose,
}: {
  labels: MapLabels;
  saving: boolean;
  onSave: (next: MapLabels) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<MapLabels>({});

  // Inicializa el formulario con los overrides actuales (los defaults van de placeholder).
  useEffect(() => { setForm({ ...labels }); }, [labels]);

  const set = (key: string, value: string) => setForm(p => ({ ...p, [key]: value }));

  const sections = [...new Set(LABEL_FIELDS.map(f => f.section))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-indigo-600" aria-hidden />
            <h3 className="font-semibold text-neutral-900">Textos del mapa general</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="p-1 rounded-lg hover:bg-neutral-100">
            <X className="h-5 w-5 text-neutral-400" />
          </button>
        </div>

        <p className="px-5 pt-3 text-[11px] text-neutral-500 leading-relaxed">
          Editá cualquier texto del diagrama. El texto por defecto se muestra de referencia;
          dejá el campo vacío para restaurarlo.
        </p>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-5">
          {sections.map(section => (
            <div key={section}>
              <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-2 border-b border-neutral-100 pb-1">{section}</p>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
                {LABEL_FIELDS.filter(f => f.section === section).map(f => (
                  <div key={f.key} className={f.multiline ? 'sm:col-span-2' : ''}>
                    <label className="block text-xs font-medium text-neutral-600 mb-0.5">{f.label}</label>
                    {f.multiline ? (
                      <textarea
                        value={form[f.key] ?? ''}
                        onChange={e => set(f.key, e.target.value)}
                        placeholder={DEFAULT_LABELS[f.key]}
                        rows={2}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-neutral-300"
                      />
                    ) : (
                      <input
                        value={form[f.key] ?? ''}
                        onChange={e => set(f.key, e.target.value)}
                        placeholder={DEFAULT_LABELS[f.key]}
                        className="w-full border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-neutral-300"
                      />
                    )}
                    {f.hint && <p className="text-[10px] text-neutral-400 mt-0.5">{f.hint}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-neutral-100">
          <button
            type="button"
            onClick={() => setForm({})}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50 rounded-lg"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Restaurar todos los textos por defecto
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 rounded-lg border border-neutral-200">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onSave(form)}
              disabled={saving}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Guardar textos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
