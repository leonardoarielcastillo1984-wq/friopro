'use client';
import { useState, useMemo, type ReactNode } from 'react';
import { ShieldAlert, Target, Activity, FolderKanban, X, Loader2, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { EmployeeCombobox } from '@/components/ui/EmployeeCombobox';

export interface GeneratorsData {
  year: number;
  foda: { s: string; w: string; o: string; t: string };
  dafo: { fo?: string; fa?: string; do?: string; da?: string };
  pestel: { political?: string; economic?: string; social?: string; technological?: string; environmental?: string; legal?: string };
}

const RISK_CATEGORIES = ['Operacional', 'Legal', 'Ambiental', 'Seguridad Vial', 'Calidad', 'Financiero', 'Tecnológico', 'Otro'];
const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm';

function lines(text?: string): string[] {
  return (text || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

type ModalType = null | 'risk' | 'objective' | 'kpi' | 'project';

export default function StrategicGenerators({ year, foda, dafo, pestel }: GeneratorsData) {
  const [modal, setModal] = useState<ModalType>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  // Fuentes de origen
  const riskSources = useMemo(() => {
    const out: { label: string; value: string }[] = [];
    lines(foda.t).forEach((x) => out.push({ label: `Amenaza: ${x}`, value: x }));
    lines(foda.w).forEach((x) => out.push({ label: `Debilidad: ${x}`, value: x }));
    const pe: [string, string | undefined][] = [
      ['Político', pestel.political], ['Económico', pestel.economic], ['Social', pestel.social],
      ['Tecnológico', pestel.technological], ['Ambiental', pestel.environmental], ['Legal', pestel.legal],
    ];
    pe.forEach(([lbl, val]) => lines(val).forEach((x) => out.push({ label: `PESTEL ${lbl}: ${x}`, value: x })));
    return out;
  }, [foda, pestel]);

  const dafoSources = useMemo(() => {
    const out: { label: string; value: string }[] = [];
    const map: [string, string | undefined][] = [
      ['FO', dafo.fo], ['DO', dafo.do], ['FA', dafo.fa], ['DA', dafo.da],
    ];
    map.forEach(([lbl, val]) => lines(val).forEach((x) => out.push({ label: `${lbl}: ${x}`, value: x })));
    return out;
  }, [dafo]);

  // ── Formularios ──
  const [risk, setRisk] = useState({ source: '', title: '', description: '', category: 'Operacional', probability: 3, impact: 3 });
  const [obj, setObj] = useState({ source: '', title: '', target: '', type: 'STRATEGIC', responsibleId: '' });
  const [kpi, setKpi] = useState({ source: '', name: '', category: 'Estratégico', unit: '%', frequency: 'MONTHLY', targetValue: '', direction: 'HIGHER_BETTER' });
  const [proj, setProj] = useState({ source: '', name: '', description: '', responsibleId: '', targetDate: '', priority: 'MEDIUM' });

  const trace = (tipo: string) => `\n\n--- Trazabilidad ---\nOrigen: Contexto del SGI (FODA/PESTEL/DAFO)\nTipo: ${tipo}\nAño: ${year}`;

  const openRisk = () => { setRisk({ source: riskSources[0]?.value || '', title: riskSources[0]?.value || '', description: '', category: 'Operacional', probability: 3, impact: 3 }); setModal('risk'); };
  const openObj = () => { setObj({ source: dafoSources[0]?.value || '', title: '', target: '', type: 'STRATEGIC', responsibleId: '' }); setModal('objective'); };
  const openKpi = () => { setKpi({ source: dafoSources[0]?.value || '', name: '', category: 'Estratégico', unit: '%', frequency: 'MONTHLY', targetValue: '', direction: 'HIGHER_BETTER' }); setModal('kpi'); };
  const openProj = () => { setProj({ source: dafoSources[0]?.value || '', name: '', description: '', responsibleId: '', targetDate: '', priority: 'MEDIUM' }); setModal('project'); };

  const close = () => { setModal(null); setDone(null); };

  async function saveRisk() {
    if (!risk.title.trim()) return alert('Ingresá un título');
    setSaving(true);
    try {
      await apiFetch('/risks', { method: 'POST', json: {
        title: risk.title.trim(),
        description: (risk.description.trim() || risk.title.trim()) + trace(risk.source ? `Elemento: ${risk.source}` : 'Manual'),
        category: risk.category,
        probability: Number(risk.probability), impact: Number(risk.impact),
        riskSource: 'Contexto del SGI',
      }});
      setDone('Riesgo creado en el módulo Riesgos');
    } catch (e: any) { alert('Error: ' + (e?.message || 'no se pudo crear el riesgo')); }
    finally { setSaving(false); }
  }

  async function saveObjective() {
    if (!obj.title.trim() || !obj.target.trim()) return alert('Completá título y meta');
    setSaving(true);
    try {
      const code = `OBJ-${year}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      await apiFetch('/objectives', { method: 'POST', json: {
        code, title: obj.title.trim(), year, target: obj.target.trim(),
        type: obj.type, status: 'PLANNED',
        responsibleId: obj.responsibleId || undefined,
        description: `Estrategia DAFO: ${obj.source}`,
        notes: `Origen: Contexto del SGI ${year} (DAFO)`,
      }});
      setDone('Objetivo estratégico creado en el módulo Objetivos');
    } catch (e: any) { alert('Error: ' + (e?.message || 'no se pudo crear el objetivo')); }
    finally { setSaving(false); }
  }

  async function saveKpi() {
    if (!kpi.name.trim()) return alert('Ingresá el nombre del indicador');
    setSaving(true);
    try {
      await apiFetch('/indicators', { method: 'POST', json: {
        name: kpi.name.trim(),
        description: `Indicador derivado del Contexto del SGI ${year}${kpi.source ? ` — Estrategia: ${kpi.source}` : ''}`,
        category: kpi.category || 'Estratégico',
        unit: kpi.unit || '%',
        frequency: kpi.frequency,
        direction: kpi.direction,
        targetValue: kpi.targetValue ? Number(kpi.targetValue) : undefined,
      }});
      setDone('KPI creado en el módulo Indicadores');
    } catch (e: any) { alert('Error: ' + (e?.message || 'no se pudo crear el indicador')); }
    finally { setSaving(false); }
  }

  async function saveProject() {
    if (!proj.name.trim()) return alert('Ingresá el nombre del proyecto');
    if (!proj.responsibleId) return alert('Seleccioná un responsable');
    if (!proj.targetDate) return alert('Ingresá una fecha objetivo');
    setSaving(true);
    try {
      await apiFetch('/project360-v1/projects', { method: 'POST', json: {
        name: proj.name.trim(),
        description: (proj.description.trim() || `Proyecto estratégico derivado del Contexto del SGI ${year}`) + `\n\nEstrategia asociada: ${proj.source}`,
        origin: 'Contexto del SGI',
        originModule: 'CONTEXTO_SGI',
        responsibleId: proj.responsibleId,
        targetDate: `${proj.targetDate}T00:00:00Z`,
        priority: proj.priority,
        tags: ['contexto-sgi', `año-${year}`],
      }});
      setDone('Proyecto creado en Project360');
    } catch (e: any) { alert('Error: ' + (e?.message || 'no se pudo crear el proyecto')); }
    finally { setSaving(false); }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <FolderKanban className="h-5 w-5 text-blue-600" />
        <h2 className="text-lg font-semibold">Generadores Estratégicos</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4">Convertí el análisis del contexto en Riesgos, Objetivos, Indicadores y Proyectos, manteniendo la trazabilidad de origen.</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GenButton onClick={openRisk} icon={<ShieldAlert className="h-5 w-5" />} title="Crear Riesgo" sub="Amenazas / Debilidades / PESTEL" color="text-rose-600 border-rose-200 hover:bg-rose-50" />
        <GenButton onClick={openObj} icon={<Target className="h-5 w-5" />} title="Crear Objetivo" sub="Estrategias DAFO (FO/DO/FA/DA)" color="text-indigo-600 border-indigo-200 hover:bg-indigo-50" />
        <GenButton onClick={openKpi} icon={<Activity className="h-5 w-5" />} title="Crear KPI" sub="Indicador asociado a estrategia" color="text-cyan-600 border-cyan-200 hover:bg-cyan-50" />
        <GenButton onClick={openProj} icon={<FolderKanban className="h-5 w-5" />} title="Crear Proyecto" sub="Integra con Project360" color="text-blue-600 border-blue-200 hover:bg-blue-50" />
      </div>

      {/* ── Modales ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">
                {modal === 'risk' && 'Crear Riesgo'}
                {modal === 'objective' && 'Crear Objetivo'}
                {modal === 'kpi' && 'Crear KPI'}
                {modal === 'project' && 'Crear Proyecto'}
              </h2>
              <button onClick={close} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            {done ? (
              <div className="p-8 flex flex-col items-center text-center gap-3">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <p className="text-sm text-gray-700">{done}</p>
                <button onClick={close} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Cerrar</button>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {modal === 'risk' && (
                  <>
                    <Field label="Elemento de origen">
                      <select value={risk.source} onChange={(e) => setRisk({ ...risk, source: e.target.value, title: e.target.value })} className={inp}>
                        <option value="">— Manual —</option>
                        {riskSources.map((s, i) => <option key={i} value={s.value}>{s.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Título *"><input value={risk.title} onChange={(e) => setRisk({ ...risk, title: e.target.value })} className={inp} /></Field>
                    <Field label="Descripción"><textarea rows={3} value={risk.description} onChange={(e) => setRisk({ ...risk, description: e.target.value })} className={inp} /></Field>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Categoría"><select value={risk.category} onChange={(e) => setRisk({ ...risk, category: e.target.value })} className={inp}>{RISK_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
                      <Field label="Probab. (1-5)"><input type="number" min={1} max={5} value={risk.probability} onChange={(e) => setRisk({ ...risk, probability: Number(e.target.value) })} className={inp} /></Field>
                      <Field label="Impacto (1-5)"><input type="number" min={1} max={5} value={risk.impact} onChange={(e) => setRisk({ ...risk, impact: Number(e.target.value) })} className={inp} /></Field>
                    </div>
                    <SaveBar onSave={saveRisk} saving={saving} onCancel={close} />
                  </>
                )}

                {modal === 'objective' && (
                  <>
                    <Field label="Estrategia de origen (DAFO)">
                      <select value={obj.source} onChange={(e) => setObj({ ...obj, source: e.target.value })} className={inp}>
                        <option value="">— Manual —</option>
                        {dafoSources.map((s, i) => <option key={i} value={s.value}>{s.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Título del objetivo *"><input value={obj.title} onChange={(e) => setObj({ ...obj, title: e.target.value })} className={inp} /></Field>
                    <Field label="Meta *"><input value={obj.target} onChange={(e) => setObj({ ...obj, target: e.target.value })} placeholder="Ej: Reducir 20% los reclamos" className={inp} /></Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Tipo"><select value={obj.type} onChange={(e) => setObj({ ...obj, type: e.target.value })} className={inp}><option value="STRATEGIC">Estratégico</option><option value="OPERATIONAL">Operacional</option></select></Field>
                      <Field label="Responsable"><EmployeeCombobox value={obj.responsibleId} onChange={(id) => setObj({ ...obj, responsibleId: id })} placeholder="Opcional..." allowFreeText /></Field>
                    </div>
                    <SaveBar onSave={saveObjective} saving={saving} onCancel={close} />
                  </>
                )}

                {modal === 'kpi' && (
                  <>
                    <Field label="Estrategia de origen (opcional)">
                      <select value={kpi.source} onChange={(e) => setKpi({ ...kpi, source: e.target.value })} className={inp}>
                        <option value="">— Ninguna —</option>
                        {dafoSources.map((s, i) => <option key={i} value={s.value}>{s.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Nombre del indicador *"><input value={kpi.name} onChange={(e) => setKpi({ ...kpi, name: e.target.value })} placeholder="Ej: % de documentos automatizados" className={inp} /></Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Categoría"><input value={kpi.category} onChange={(e) => setKpi({ ...kpi, category: e.target.value })} className={inp} /></Field>
                      <Field label="Unidad"><input value={kpi.unit} onChange={(e) => setKpi({ ...kpi, unit: e.target.value })} className={inp} /></Field>
                      <Field label="Frecuencia"><select value={kpi.frequency} onChange={(e) => setKpi({ ...kpi, frequency: e.target.value })} className={inp}><option value="DAILY">Diaria</option><option value="WEEKLY">Semanal</option><option value="MONTHLY">Mensual</option><option value="QUARTERLY">Trimestral</option><option value="YEARLY">Anual</option></select></Field>
                      <Field label="Meta (valor)"><input type="number" value={kpi.targetValue} onChange={(e) => setKpi({ ...kpi, targetValue: e.target.value })} className={inp} /></Field>
                      <Field label="Dirección"><select value={kpi.direction} onChange={(e) => setKpi({ ...kpi, direction: e.target.value })} className={inp}><option value="HIGHER_BETTER">Mayor es mejor</option><option value="LOWER_BETTER">Menor es mejor</option></select></Field>
                    </div>
                    <SaveBar onSave={saveKpi} saving={saving} onCancel={close} />
                  </>
                )}

                {modal === 'project' && (
                  <>
                    <Field label="Estrategia asociada (opcional)">
                      <select value={proj.source} onChange={(e) => setProj({ ...proj, source: e.target.value })} className={inp}>
                        <option value="">— Ninguna —</option>
                        {dafoSources.map((s, i) => <option key={i} value={s.value}>{s.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Nombre del proyecto *"><input value={proj.name} onChange={(e) => setProj({ ...proj, name: e.target.value })} className={inp} /></Field>
                    <Field label="Descripción"><textarea rows={2} value={proj.description} onChange={(e) => setProj({ ...proj, description: e.target.value })} className={inp} /></Field>
                    <Field label="Responsable *"><EmployeeCombobox value={proj.responsibleId} onChange={(id) => setProj({ ...proj, responsibleId: id })} placeholder="Buscar responsable..." /></Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Fecha objetivo *"><input type="date" value={proj.targetDate} onChange={(e) => setProj({ ...proj, targetDate: e.target.value })} className={inp} /></Field>
                      <Field label="Prioridad"><select value={proj.priority} onChange={(e) => setProj({ ...proj, priority: e.target.value })} className={inp}><option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option></select></Field>
                    </div>
                    <SaveBar onSave={saveProject} saving={saving} onCancel={close} />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function GenButton({ onClick, icon, title, sub, color }: { onClick: () => void; icon: ReactNode; title: string; sub: string; color: string }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-start gap-1 p-4 border rounded-xl text-left transition ${color}`}>
      <div className="flex items-center gap-2 font-semibold text-sm">{icon}{title}</div>
      <span className="text-[11px] text-gray-500">{sub}</span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function SaveBar({ onSave, saving, onCancel }: { onSave: () => void; saving: boolean; onCancel: () => void }) {
  return (
    <div className="pt-4 border-t border-gray-100 flex gap-3">
      <button onClick={onCancel} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
      <button onClick={onSave} disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />} Crear
      </button>
    </div>
  );
}
