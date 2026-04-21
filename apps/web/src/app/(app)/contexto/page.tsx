'use client';
import { useEffect, useState } from 'react';
import { Compass, Save, Sparkles, Loader2 } from 'lucide-react';
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

  async function suggestDafo(quadrant: 'dafoFo' | 'dafoFa' | 'dafoDo' | 'dafoDa') {
    const labels: Record<string, string> = {
      dafoFo: 'FO (Fortalezas + Oportunidades)',
      dafoFa: 'FA (Fortalezas + Amenazas)',
      dafoDo: 'DO (Debilidades + Oportunidades)',
      dafoDa: 'DA (Debilidades + Amenazas)',
    };
    setAiLoading(quadrant);
    try {
      const prompt = `Eres un consultor ISO experto. Dado este análisis FODA:
Fortalezas: ${foda.s || '(no especificadas)'}
Debilidades: ${foda.w || '(no especificadas)'}
Oportunidades: ${foda.o || '(no especificadas)'}
Amenazas: ${foda.t || '(no especificadas)'}

Sugiere 3 estrategias concretas para el cuadrante ${labels[quadrant]} de la Matriz DAFO Cruzado.
Responde solo con las 3 estrategias numeradas, sin introducción. Sé específico y accionable.`;

      const res = await apiFetch<{ response?: string; text?: string; content?: string }>('/ai/chat', {
        method: 'POST',
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
                      <button
                        onClick={() => suggestDafo(key)}
                        disabled={aiLoading === key}
                        title="Sugerencia IA"
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 shrink-0 ml-2"
                      >
                        {aiLoading === key
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Sparkles className="h-3 w-3 text-purple-500" />}
                        IA
                      </button>
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

            <div className="flex justify-end">
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium"
              >
                <Save className="h-4 w-4" /> {saving ? 'Guardando...' : 'Guardar contexto'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
