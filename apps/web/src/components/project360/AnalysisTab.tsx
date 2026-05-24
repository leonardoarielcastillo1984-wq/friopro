'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Zap, Plus, X } from 'lucide-react';

interface Props {
  projectId: string;
}

export default function AnalysisTab({ projectId }: Props) {
  const [aiAnalyses, setAiAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareWithId, setCompareWithId] = useState('');
  const [comparisonResult, setComparisonResult] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/project360/projects/${projectId}/ai-analyses`) as any;
      setAiAnalyses(res.aiAnalyses || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const handleCompare = async () => {
    if (!compareWithId || !aiAnalyses[0]) return;
    try {
      const res = await apiFetch(`/project360/projects/${projectId}/ai-analyses/compare`, {
        method: 'POST',
        json: { baseAnalysisId: aiAnalyses[0].id, compareWithId }
      }) as any;
      setComparisonResult(res.comparison);
    } catch (e: any) { alert(e.message); }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando análisis IA...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Zap className="w-5 h-5 text-purple-600" /> Análisis IA</h2>
          <p className="text-sm text-gray-500">Análisis automático de documentos y licitaciones</p>
        </div>
        {aiAnalyses.length > 1 && (
          <div className="flex items-center gap-2">
            <select value={compareWithId} onChange={e => setCompareWithId(e.target.value)} className="px-2 py-1 border rounded-lg text-sm">
              <option value="">Comparar con...</option>
              {aiAnalyses.slice(1).map(a => <option key={a.id} value={a.id}>{a.documentName}</option>)}
            </select>
            <button onClick={handleCompare} disabled={!compareWithId} className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50">Comparar</button>
          </div>
        )}
      </div>

      {aiAnalyses.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Zap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">Sin análisis IA</p>
          <p className="text-gray-400 text-sm">Creá el proyecto desde "Crear desde licitación" para generar uno.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {aiAnalyses.map((a: any) => {
            const requirements: any[] = Array.isArray(a.requirements) ? a.requirements : [];
            const risks: any[] = Array.isArray(a.risks) ? a.risks : [];
            const timeline: any[] = Array.isArray(a.timeline) ? a.timeline : [];
            const costs: any = a.costs && typeof a.costs === 'object' ? a.costs : {};
            const scores: any = a.scores && typeof a.scores === 'object' ? a.scores : {};
            const avgScore = Object.values(scores).length > 0
              ? (Object.values(scores) as number[]).reduce((s, v) => s + v, 0) / Object.values(scores).length
              : null;
            return (
              <div key={a.id} className="border border-purple-200 rounded-xl p-5 bg-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold text-purple-900">{a.documentName}</p>
                    <p className="text-xs text-gray-500">{a.analysisType} · {new Date(a.createdAt).toLocaleDateString('es-AR')}</p>
                  </div>
                  {avgScore !== null && (
                    <div className="flex flex-col items-center bg-purple-50 rounded-lg px-3 py-2">
                      <span className="text-2xl font-bold text-purple-700">{avgScore.toFixed(1)}</span>
                      <span className="text-xs text-purple-500">puntaje IA</span>
                    </div>
                  )}
                </div>
                {a.summary && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Resumen ejecutivo</p>
                    <p className="text-sm text-gray-800">{a.summary}</p>
                  </div>
                )}
                {Object.keys(scores).length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Puntajes</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(scores).map(([k, v]: [string, any]) => (
                        <div key={k} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-24 capitalize">{k}</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5"><div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${Math.min((v / 10) * 100, 100)}%` }} /></div>
                          <span className="text-xs font-bold text-purple-700 w-6">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {requirements.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Requerimientos ({requirements.length})</p>
                    <div className="space-y-2">
                      {requirements.map((r: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                          <span className={`mt-0.5 px-1.5 py-0.5 text-xs rounded font-medium shrink-0 ${r.priority === 'ALTA' ? 'bg-red-100 text-red-700' : r.priority === 'MEDIA' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{r.priority || 'N/A'}</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{r.title}</p>
                            {r.description && <p className="text-xs text-gray-600">{r.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {risks.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Riesgos ({risks.length})</p>
                    <div className="space-y-2">
                      {risks.map((r: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 p-2 bg-red-50 rounded-lg">
                          <span className={`mt-0.5 px-1.5 py-0.5 text-xs rounded font-medium ${r.severity === 'ALTO' ? 'bg-red-200 text-red-800' : r.severity === 'MEDIO' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>{r.severity || 'N/A'}</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{r.title}</p>
                            {r.description && <p className="text-xs text-gray-600">{r.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {timeline.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Cronograma</p>
                    <div className="flex gap-2 flex-wrap">
                      {timeline.map((t: any, i: number) => (
                        <div key={i} className="p-2 bg-blue-50 rounded-lg border border-blue-100 text-xs">
                          <p className="font-medium text-blue-900">{t.phase}</p>
                          <p className="text-blue-600">{t.days} días</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {costs.totalEstimated > 0 && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                    <p className="text-xs font-semibold text-green-700 uppercase mb-1">Costos estimados</p>
                    <p className="text-lg font-bold text-green-800">{costs.totalEstimated.toLocaleString('es-AR', { style: 'currency', currency: costs.currency || 'ARS', maximumFractionDigits: 0 })}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {comparisonResult && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-900">Comparación</h4>
            <button onClick={() => setComparisonResult(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap">{JSON.stringify(comparisonResult, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
