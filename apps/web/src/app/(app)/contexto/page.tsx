'use client';
import { useEffect, useState } from 'react';
import { Compass, Save, Sparkles, Loader2, ArrowRight, X, Target } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Context {
  id?: string;
  year: number;
  strengths?: string[];
  weaknesses?: string[];
  opportunities?: string[];
  threats?: string[];
  political?: string;
  economic?: string;
  social?: string;
  technological?: string;
  environmental?: string;
  legal?: string;
  mission?: string;
  vision?: string;
  values?: string;
  dafoFo?: string;
  dafoFa?: string;
  dafoDo?: string;
  dafoDa?: string;
}

function textareaToArray(text: string): string[] {
  return text.split('\n').map(s => s.trim()).filter(Boolean);
}

function arrayToTextarea(arr?: string[] | null): string {
  return Array.isArray(arr) ? arr.join('\n') : '';
}

export default function ContextoPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [data, setData] = useState<Context>({ year: new Date().getFullYear() });
  const [foda, setFoda] = useState({ s: '', w: '', o: '', t: '' });
  const [showSendModal, setShowSendModal] = useState(false);

  // Plan de Acción Estratégico desde DAFO
  const [showStrategicPlanModal, setShowStrategicPlanModal] = useState(false);
  const [strategicPlanForm, setStrategicPlanForm] = useState({
    quadrant: '' as 'dafoFo' | 'dafoFa' | 'dafoDo' | 'dafoDa',
    strategyText: '',
    title: '',
    description: '',
    responsible: '',
    dueDate: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  });
  const [creatingStrategicPlan, setCreatingStrategicPlan] = useState(false);

  async function suggestDafo(quadrant: 'dafoFo' | 'dafoFa' | 'dafoDo' | 'dafoDa') {
    const labels: Record<string, string> = {
      dafoFo: 'FO (Fortalezas + Oportunidades)',
      dafoFa: 'FA (Fortalezas + Amenazas)',
      dafoDo: 'DO (Debilidades + Oportunidades)',
      dafoDa: 'DA (Debilidades + Amenazas)',
    };
    setAiLoading(quadrant);
    try {
      const pestelContext = [
        data.political && `Político: ${data.political}`,
        data.economic && `Económico: ${data.economic}`,
        data.social && `Social: ${data.social}`,
        data.technological && `Tecnológico: ${data.technological}`,
        data.environmental && `Ambiental: ${data.environmental}`,
        data.legal && `Legal: ${data.legal}`,
      ].filter(Boolean).join('\n');

      const prompt = `Eres un consultor ISO experto en empresas logísticas e industriales.

ANÁLISIS FODA:
Fortalezas: ${foda.s || '(no especificadas)'}
Debilidades: ${foda.w || '(no especificadas)'}
Oportunidades: ${foda.o || '(no especificadas)'}
Amenazas: ${foda.t || '(no especificadas)'}

${pestelContext ? `CONTEXTO PESTEL (factores externos relevantes):\n${pestelContext}\n\nIMPORTANTE: Los factores Económicos y Tecnológicos tienen mayor impacto en operaciones logísticas. Considera costos, inflación, precios de combustible, disponibilidad de tecnología, automatización, y regulaciones específicas del sector.` : ''}

Sugiere 3 estrategias concretas y accionables para el cuadrante ${labels[quadrant]} de la Matriz DAFO Cruzado.
- Las estrategias deben considerar el contexto externo (PESTEL) cuando esté disponible
- Deben ser específicas para empresas logísticas/industriales (ej: optimización de rutas, gestión de inventarios, tecnología de tracking, costos operativos)
- Deben mencionar factores concretos (ej: "usando herramientas tecnológicas para reducir el impacto del aumento del combustible" en lugar de "reducir costos")
- Responde solo con las 3 estrategias numeradas, sin introducción.`;

      const res = await apiFetch<{ response?: string; text?: string; content?: string }>('/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: prompt, stream: false }),
      });
      const text = res?.response || res?.text || res?.content || '';
      if (text) setData(prev => ({ ...prev, [quadrant]: text }));
    } catch (err: any) {
      alert('Error al obtener sugerencia IA: ' + (err?.message || 'Error desconocido'));
    } finally {
      setAiLoading(null);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ item: Context | null }>(`/context/${year}`);
      const item = res?.item || { year };
      setData(item);
      setFoda({
        s: arrayToTextarea(item.strengths),
        w: arrayToTextarea(item.weaknesses),
        o: arrayToTextarea(item.opportunities),
        t: arrayToTextarea(item.threats),
      });
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [year]);

  function openStrategicPlanModal(quadrant: 'dafoFo' | 'dafoFa' | 'dafoDo' | 'dafoDa') {
    const labels: Record<string, string> = {
      dafoFo: 'FO (Fortalezas + Oportunidades)',
      dafoFa: 'FA (Fortalezas + Amenazas)',
      dafoDo: 'DO (Debilidades + Oportunidades)',
      dafoDa: 'DA (Debilidades + Amenazas)',
    };
    const strategyText = data[quadrant] || '';
    const category = quadrant.replace('dafo', '').toUpperCase();

    setStrategicPlanForm({
      quadrant,
      strategyText,
      title: `Plan Estratégico ${category} - ${year}`,
      description: `Estrategia: ${strategyText}\n\nOrigen: DAFO (${labels[quadrant]})\nAño: ${year}`,
      responsible: '',
      dueDate: '',
      priority: 'MEDIUM',
    });
    setShowStrategicPlanModal(true);
  }

  async function createStrategicPlan() {
    if (!strategicPlanForm.title || !strategicPlanForm.responsible) {
      alert('Por favor completa el título y el responsable');
      return;
    }
    setCreatingStrategicPlan(true);
    try {
      const labels: Record<string, string> = {
        dafoFo: 'FO (Fortalezas + Oportunidades)',
        dafoFa: 'FA (Fortalezas + Amenazas)',
        dafoDo: 'DO (Debilidades + Oportunidades)',
        dafoDa: 'DA (Debilidades + Amenazas)',
      };
      const category = strategicPlanForm.quadrant.replace('dafo', '').toUpperCase();

      await apiFetch('/actions', {
        method: 'POST',
        json: {
          title: strategicPlanForm.title,
          description: `${strategicPlanForm.description}\n\n--- Trazabilidad ---\nOrigen: DAFO\nCategoría: ${category} (${labels[strategicPlanForm.quadrant]})\nAño: ${year}\nResponsable: ${strategicPlanForm.responsible}`,
          type: 'IMPROVEMENT',
          priority: strategicPlanForm.priority,
          sourceType: 'MANUAL',
          dueDate: strategicPlanForm.dueDate ? `${strategicPlanForm.dueDate}T00:00:00Z` : null,
          status: 'OPEN',
        },
      });
      setShowStrategicPlanModal(false);
      alert('Plan de Acción Estratégico creado correctamente en el módulo Acciones');
    } catch (err: any) {
      alert('Error al crear el plan: ' + (err?.message || 'Error desconocido'));
    } finally {
      setCreatingStrategicPlan(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        ...data,
        strengths: textareaToArray(foda.s),
        weaknesses: textareaToArray(foda.w),
        opportunities: textareaToArray(foda.o),
        threats: textareaToArray(foda.t),
      };
      await apiFetch(`/context/${year}`, { method: 'PUT', body: JSON.stringify(payload) });
      alert('Contexto guardado');
      await load();
    } catch (err: any) {
      alert(err?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
              <Compass className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Contexto de la Organización</h1>
              <p className="text-sm text-gray-500">FODA, PESTEL, misión, visión y valores (ISO 9001/14001/45001 §4.1)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Año</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
              className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {loading ? (
          <div className="bg-white border rounded-xl p-12 text-center text-gray-500">Cargando...</div>
        ) : (
          <>
            {/* Identidad */}
            <section className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Identidad</h2>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Misión</label>
                  <textarea rows={2} value={data.mission || ''} onChange={(e) => setData({ ...data, mission: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Visión</label>
                  <textarea rows={2} value={data.vision || ''} onChange={(e) => setData({ ...data, vision: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Valores</label>
                  <textarea rows={2} value={data.values || ''} onChange={(e) => setData({ ...data, values: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
            </section>

            {/* FODA */}
            <section className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-1">Análisis FODA</h2>
              <p className="text-xs text-gray-500 mb-4">Una línea por ítem</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-green-700 mb-1">Fortalezas (internas positivas)</label>
                  <textarea rows={5} value={foda.s} onChange={(e) => setFoda({ ...foda, s: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-red-700 mb-1">Debilidades (internas negativas)</label>
                  <textarea rows={5} value={foda.w} onChange={(e) => setFoda({ ...foda, w: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-blue-700 mb-1">Oportunidades (externas positivas)</label>
                  <textarea rows={5} value={foda.o} onChange={(e) => setFoda({ ...foda, o: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-orange-700 mb-1">Amenazas (externas negativas)</label>
                  <textarea rows={5} value={foda.t} onChange={(e) => setFoda({ ...foda, t: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
            </section>

            {/* PESTEL */}
            <section className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-1">Análisis PESTEL</h2>
              <p className="text-xs text-gray-500 mb-4">Factores externos del contexto</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  ['political', 'Político'],
                  ['economic', 'Económico'],
                  ['social', 'Social'],
                  ['technological', 'Tecnológico'],
                  ['environmental', 'Ambiental'],
                  ['legal', 'Legal'],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                    <textarea
                      rows={3}
                      value={(data as any)[key] || ''}
                      onChange={(e) => setData({ ...data, [key]: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Matriz DAFO Cruzado */}
            <section className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-1">Matriz DAFO Cruzado</h2>
              <p className="text-xs text-gray-500 mb-4">
                Estrategias derivadas del análisis FODA — evidencia requerida por ISO 9001 §6.1
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  { key: 'dafoFo' as const, label: 'FO — Fortalezas + Oportunidades', sub: 'Usar fortalezas para aprovechar oportunidades', color: 'text-green-700', border: 'border-green-200 bg-green-50' },
                  { key: 'dafoFa' as const, label: 'FA — Fortalezas + Amenazas', sub: 'Usar fortalezas para neutralizar amenazas', color: 'text-blue-700', border: 'border-blue-200 bg-blue-50' },
                  { key: 'dafoDo' as const, label: 'DO — Debilidades + Oportunidades', sub: 'Superar debilidades aprovechando oportunidades', color: 'text-orange-700', border: 'border-orange-200 bg-orange-50' },
                  { key: 'dafoDa' as const, label: 'DA — Debilidades + Amenazas', sub: 'Reducir debilidades y evitar amenazas', color: 'text-red-700', border: 'border-red-200 bg-red-50' },
                ]).map(({ key, label, sub, color, border }) => (
                  <div key={key} className={`rounded-lg border p-4 ${border}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className={`text-xs font-bold ${color}`}>{label}</p>
                        <p className="text-xs text-gray-500">{sub}</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => suggestDafo(key)}
                          disabled={aiLoading === key}
                          title="Sugerencia IA"
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 shrink-0"
                        >
                          {aiLoading === key
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Sparkles className="h-3 w-3 text-purple-500" />}
                          IA
                        </button>
                        <button
                          onClick={() => openStrategicPlanModal(key)}
                          title="Generar Plan de Acción Estratégico"
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shrink-0"
                        >
                          <Target className="h-3 w-3 text-blue-500" />
                          Plan
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={5}
                      value={data[key] || ''}
                      onChange={(e) => setData(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder="Escribí las estrategias o usá el botón IA para obtener sugerencias..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Botón enviar a acciones */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-800">¿Detectaste algo que requiere tratamiento?</p>
                <p className="text-xs text-blue-600 mt-0.5">Enviá una debilidad, amenaza o estrategia directamente a Acciones CAPA para cerrar el ciclo.</p>
              </div>
              <button
                onClick={() => setShowSendModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shrink-0"
              >
                <ArrowRight className="h-4 w-4" /> Enviar a Acciones
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium"
              >
                <Save className="h-4 w-4" /> {saving ? 'Guardando...' : 'Guardar contexto'}
              </button>
            </div>

            {/* Modal enviar a acciones */}
            {showSendModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl w-full max-w-lg flex flex-col">
                  <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="w-5 h-5 text-blue-600" />
                      <h2 className="text-lg font-semibold text-gray-900">Enviar a Acciones CAPA</h2>
                    </div>
                    <button onClick={() => setShowSendModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-600">Seleccioná qué elementos del FODA querés enviar como acciones CAPA:</p>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          id="send-weaknesses"
                          checked={!!foda.w}
                          disabled={!foda.w}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm font-medium">Debilidades</span>
                      </label>
                      <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          id="send-threats"
                          checked={!!foda.t}
                          disabled={!foda.t}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm font-medium">Amenazas</span>
                      </label>
                    </div>
                    {!foda.w && !foda.t && (
                      <p className="text-xs text-orange-600">No hay debilidades ni amenazas cargadas para enviar.</p>
                    )}
                  </div>
                  <div className="p-6 border-t border-gray-200 flex gap-3">
                    <button onClick={() => setShowSendModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">Cancelar</button>
                    <button
                      disabled={!foda.w && !foda.t}
                      onClick={async () => {
                        const key = `foda-action-sent-${year}`;
                        if (localStorage.getItem(key)) {
                          alert('Ya se envió una acción CAPA para este año. Revisa el módulo Acciones.');
                          return;
                        }
                        try {
                          await apiFetch('/actions', {
                            method: 'POST',
                            json: {
                              title: `Tratamiento FODA ${year}`,
                              description: `Origen: Análisis FODA ${year}\n\n${foda.w ? `Debilidades identificadas:\n${foda.w}\n\n` : ''}${foda.t ? `Amenazas identificadas:\n${foda.t}` : ''}`,
                              type: 'IMPROVEMENT',
                              priority: 'MEDIUM',
                              sourceType: 'MANUAL',
                              status: 'OPEN',
                            },
                          });
                          localStorage.setItem(key, Date.now().toString());
                          setShowSendModal(false);
                        } catch (e: any) {
                          alert('Error: ' + e.message);
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                      Enviar a Acciones
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Plan de Acción Estratégico desde DAFO */}
            {showStrategicPlanModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl w-full max-w-lg flex flex-col">
                  <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-blue-600" />
                      <h2 className="text-lg font-semibold text-gray-900">Plan de Acción Estratégico</h2>
                    </div>
                    <button onClick={() => setShowStrategicPlanModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Título del plan *</label>
                      <input
                        value={strategicPlanForm.title}
                        onChange={e => setStrategicPlanForm({ ...strategicPlanForm, title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (estrategia)</label>
                      <textarea
                        rows={4}
                        value={strategicPlanForm.description}
                        onChange={e => setStrategicPlanForm({ ...strategicPlanForm, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Responsable *</label>
                      <input
                        type="text"
                        value={strategicPlanForm.responsible}
                        onChange={e => setStrategicPlanForm({ ...strategicPlanForm, responsible: e.target.value })}
                        placeholder="Nombre del responsable"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha objetivo</label>
                        <input
                          type="date"
                          value={strategicPlanForm.dueDate}
                          onChange={e => setStrategicPlanForm({ ...strategicPlanForm, dueDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                        <select
                          value={strategicPlanForm.priority}
                          onChange={e => setStrategicPlanForm({ ...strategicPlanForm, priority: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="LOW">Baja</option>
                          <option value="MEDIUM">Media</option>
                          <option value="HIGH">Alta</option>
                          <option value="CRITICAL">Crítica</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 border-t border-gray-200 flex gap-3">
                    <button onClick={() => setShowStrategicPlanModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">Cancelar</button>
                    <button
                      disabled={creatingStrategicPlan || !strategicPlanForm.title || !strategicPlanForm.responsible}
                      onClick={createStrategicPlan}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                      {creatingStrategicPlan ? 'Creando...' : 'Crear Plan'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
