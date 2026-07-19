'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  X, ArrowRight, ArrowLeft, Check, Loader2, Sparkles, Layers,
  Target, Cog, Users, FileText, BarChart3, Shield, ClipboardCheck, CheckCircle2,
} from 'lucide-react';

interface Norm { code: string; label: string; description: string; }
interface Industry { code: string; label: string; }
interface TemplateIndicator { name: string; unit?: string; frequency?: string; }
interface Template {
  id: string;
  norm: string;
  industry: string;
  name: string;
  layer: 'STRATEGIC' | 'OPERATIONAL' | 'SUPPORT';
  description?: string;
  objective?: string;
  indicators?: TemplateIndicator[];
  risks?: string[];
  documents?: string[];
  order: number;
}
interface Summary {
  processes: number;
  indicators: number;
  risks: number;
  documents: number;
  estimatedDays: number;
  estimatedLabel: string;
}

const LAYER_META: Record<string, { label: string; color: string; icon: any }> = {
  STRATEGIC: { label: 'Estratégicos', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Target },
  OPERATIONAL: { label: 'Operativos', color: 'text-green-600 bg-green-50 border-green-200', icon: Cog },
  SUPPORT: { label: 'Soporte', color: 'text-orange-600 bg-orange-50 border-orange-200', icon: Users },
};

const STEPS = ['Norma', 'Organización', 'Procesos', 'Resumen'];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
  existingMaps: { id: string; name: string }[];
  preselectedMapId?: string | null;
}

export default function ProcessTemplateWizard({ isOpen, onClose, onImported, existingMaps, preselectedMapId }: Props) {
  const [step, setStep] = useState(0);
  const [norms, setNorms] = useState<Norm[]>([]);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [norm, setNorm] = useState<string>('');
  const [industry, setIndustry] = useState<string>('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingTpl, setLoadingTpl] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  // Destino: nuevo mapa o existente
  const [targetMode, setTargetMode] = useState<'new' | 'existing'>('new');
  const [mapName, setMapName] = useState('');
  const [mapId, setMapId] = useState<string>(preselectedMapId || '');

  // Reset al abrir
  useEffect(() => {
    if (isOpen) {
      setStep(0); setNorm(''); setIndustry(''); setTemplates([]);
      setSelectedNames(new Set()); setSummary(null); setError('');
      setTargetMode(preselectedMapId ? 'existing' : 'new');
      setMapId(preselectedMapId || '');
      setMapName('');
    }
  }, [isOpen, preselectedMapId]);

  // Cargar metadatos
  useEffect(() => {
    if (!isOpen) return;
    apiFetch<{ norms: Norm[] }>('/process-templates/norms').then(r => setNorms(r?.norms || [])).catch(() => {});
    apiFetch<{ industries: Industry[] }>('/process-templates/industries').then(r => setIndustries(r?.industries || [])).catch(() => {});
  }, [isOpen]);

  // Cargar plantillas al entrar al paso 3
  async function loadTemplates() {
    setLoadingTpl(true); setError('');
    try {
      const res = await apiFetch<{ templates: Template[]; summary: Summary }>(`/process-templates?norm=${encodeURIComponent(norm)}&industry=${encodeURIComponent(industry)}`);
      const tpls = res?.templates || [];
      setTemplates(tpls);
      setSelectedNames(new Set(tpls.map(t => t.name)));
    } catch {
      setError('No se pudieron cargar las plantillas');
    } finally {
      setLoadingTpl(false);
    }
  }

  // Recalcular resumen segun seleccion (paso 4)
  function computeSummary(): Summary {
    const chosen = templates.filter(t => selectedNames.has(t.name));
    const indicators = chosen.reduce((s, t) => s + (t.indicators?.length || 0), 0);
    const risks = chosen.reduce((s, t) => s + (t.risks?.length || 0), 0);
    const documents = chosen.reduce((s, t) => s + (t.documents?.length || 0), 0);
    const days = chosen.length * 3;
    return {
      processes: chosen.length, indicators, risks, documents,
      estimatedDays: days,
      estimatedLabel: days >= 30 ? `${Math.round(days / 30 * 10) / 10} meses` : `${days} días`,
    };
  }

  async function next() {
    setError('');
    if (step === 0) { if (!norm) { setError('Seleccioná una norma'); return; } setStep(1); return; }
    if (step === 1) { if (!industry) { setError('Seleccioná un tipo de organización'); return; } await loadTemplates(); setStep(2); return; }
    if (step === 2) {
      if (selectedNames.size === 0) { setError('Seleccioná al menos un proceso'); return; }
      setSummary(computeSummary());
      if (targetMode === 'new' && !mapName) {
        const normLabel = norms.find(n => n.code === norm)?.label || norm;
        setMapName(`Mapa ${normLabel}`);
      }
      setStep(3); return;
    }
  }
  function back() { setError(''); if (step > 0) setStep(step - 1); }

  function toggle(name: string) {
    setSelectedNames(prev => {
      const s = new Set(prev);
      if (s.has(name)) s.delete(name); else s.add(name);
      return s;
    });
  }

  async function doImport() {
    setImporting(true); setError('');
    try {
      const payload: any = {
        norm, industry,
        processNames: Array.from(selectedNames),
      };
      if (targetMode === 'existing' && mapId) payload.mapId = mapId;
      else payload.mapName = mapName || undefined;
      await apiFetch('/process-templates/import', { method: 'POST', json: payload });
      onImported();
      onClose();
    } catch (e: any) {
      setError('Error al importar: ' + (e?.message || ''));
    } finally {
      setImporting(false);
    }
  }

  if (!isOpen) return null;

  const grouped = (['STRATEGIC', 'OPERATIONAL', 'SUPPORT'] as const).map(layer => ({
    layer, items: templates.filter(t => t.layer === layer),
  })).filter(g => g.items.length > 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header + progreso */}
        <div className="px-6 pt-5 pb-4 border-b border-neutral-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-500">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900">Crear desde plantilla</h3>
                <p className="text-xs text-neutral-500">Generá un mapa de procesos completo según la norma</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100"><X className="h-5 w-5 text-neutral-400" /></button>
          </div>
          {/* Barra de pasos */}
          <div className="flex items-center gap-2">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
                <div className={`flex items-center gap-2 ${i <= step ? 'text-brand-600' : 'text-neutral-400'}`}>
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-300' : 'bg-neutral-100 text-neutral-400'}`}>
                    {i < step ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className="text-xs font-medium hidden sm:block">{label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 rounded transition-all ${i < step ? 'bg-brand-500' : 'bg-neutral-200'}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Paso 1: Norma */}
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-neutral-600 mb-2">Seleccioná la norma que querés implementar:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {norms.map(n => (
                  <button key={n.code} onClick={() => setNorm(n.code)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${norm === n.code ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-100' : 'border-neutral-200 hover:border-brand-300 hover:bg-neutral-50'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-900">{n.label}</span>
                      {norm === n.code && <CheckCircle2 className="h-5 w-5 text-brand-600" />}
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">{n.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Paso 2: Industria */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-neutral-600 mb-2">¿Qué tipo de organización es?</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {industries.map(ind => (
                  <button key={ind.code} onClick={() => setIndustry(ind.code)}
                    className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${industry === ind.code ? 'border-brand-400 bg-brand-50 text-brand-700 ring-2 ring-brand-100' : 'border-neutral-200 text-neutral-700 hover:border-brand-300 hover:bg-neutral-50'}`}>
                    {ind.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-neutral-400 mt-2">Si tu industria no está o no tiene plantilla específica, se usará el catálogo genérico de la norma.</p>
            </div>
          )}

          {/* Paso 3: Procesos */}
          {step === 2 && (
            <div className="space-y-4">
              {loadingTpl ? (
                <div className="flex items-center gap-2 py-10 text-neutral-400 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Cargando procesos sugeridos...</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-10 text-neutral-400">
                  <Layers className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No hay plantillas para esta combinación.</p>
                  <p className="text-xs mt-1">Probá con otra industria o norma.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-neutral-600">Desmarcá los procesos que no apliquen a tu organización:</p>
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => setSelectedNames(new Set(templates.map(t => t.name)))} className="text-brand-600 hover:underline">Todos</button>
                      <span className="text-neutral-300">|</span>
                      <button onClick={() => setSelectedNames(new Set())} className="text-neutral-500 hover:underline">Ninguno</button>
                    </div>
                  </div>
                  {grouped.map(g => {
                    const meta = LAYER_META[g.layer];
                    const LIcon = meta.icon;
                    return (
                      <div key={g.layer}>
                        <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border mb-2 ${meta.color}`}>
                          <LIcon className="h-3.5 w-3.5" /> {meta.label}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {g.items.map(t => {
                            const checked = selectedNames.has(t.name);
                            return (
                              <button key={t.id} onClick={() => toggle(t.name)}
                                className={`text-left p-3 rounded-lg border transition-all flex items-start gap-2.5 ${checked ? 'border-brand-300 bg-brand-50/50' : 'border-neutral-200 hover:bg-neutral-50 opacity-70'}`}>
                                <div className={`mt-0.5 h-4 w-4 rounded flex items-center justify-center flex-shrink-0 border ${checked ? 'bg-brand-600 border-brand-600' : 'border-neutral-300 bg-white'}`}>
                                  {checked && <Check className="h-3 w-3 text-white" />}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-neutral-800 truncate">{t.name}</p>
                                  {t.description && <p className="text-[11px] text-neutral-500 line-clamp-2">{t.description}</p>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* Paso 4: Resumen */}
          {step === 3 && summary && (
            <div className="space-y-5">
              <p className="text-sm text-neutral-600">Revisá el resumen antes de importar:</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Procesos', value: summary.processes, icon: Layers, color: 'text-brand-600 bg-brand-50' },
                  { label: 'Indicadores', value: summary.indicators, icon: BarChart3, color: 'text-blue-600 bg-blue-50' },
                  { label: 'Riesgos', value: summary.risks, icon: Shield, color: 'text-orange-600 bg-orange-50' },
                  { label: 'Documentos', value: summary.documents, icon: FileText, color: 'text-green-600 bg-green-50' },
                ].map(c => {
                  const CIcon = c.icon;
                  return (
                    <div key={c.label} className="rounded-xl border border-neutral-200 p-3 text-center">
                      <div className={`inline-flex p-2 rounded-lg mb-1.5 ${c.color}`}><CIcon className="h-4 w-4" /></div>
                      <p className="text-2xl font-bold text-neutral-900">{c.value}</p>
                      <p className="text-[11px] text-neutral-500">{c.label}</p>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 text-sm bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-indigo-700">
                <ClipboardCheck className="h-4 w-4" />
                <span>Tiempo estimado de implementación: <strong>{summary.estimatedLabel}</strong></span>
              </div>

              {/* Destino */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">Destino</p>
                <div className="flex gap-2">
                  <button onClick={() => setTargetMode('new')} className={`flex-1 p-2.5 rounded-lg border text-sm font-medium transition-all ${targetMode === 'new' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}>Crear mapa nuevo</button>
                  <button onClick={() => setTargetMode('existing')} disabled={existingMaps.length === 0} className={`flex-1 p-2.5 rounded-lg border text-sm font-medium transition-all disabled:opacity-40 ${targetMode === 'existing' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}>Agregar a mapa existente</button>
                </div>
                {targetMode === 'new' ? (
                  <input value={mapName} onChange={e => setMapName(e.target.value)} placeholder="Nombre del nuevo mapa" className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                ) : (
                  <select value={mapId} onChange={e => setMapId(e.target.value)} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="">Seleccioná un mapa...</option>
                    {existingMaps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}
                <p className="text-[11px] text-neutral-400">Los procesos con el mismo nombre que ya existan en el mapa no se duplican.</p>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between">
          <button onClick={step === 0 ? onClose : back} className="flex items-center gap-1.5 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 rounded-lg border border-neutral-200">
            {step === 0 ? 'Cancelar' : <><ArrowLeft className="h-4 w-4" /> Atrás</>}
          </button>
          {step < 3 ? (
            <button onClick={next} disabled={loadingTpl} className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50">
              Siguiente <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={doImport} disabled={importing || (targetMode === 'existing' && !mapId) || (targetMode === 'new' && !mapName)} className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
              {importing ? <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</> : <><Check className="h-4 w-4" /> Importar {summary?.processes} procesos</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
