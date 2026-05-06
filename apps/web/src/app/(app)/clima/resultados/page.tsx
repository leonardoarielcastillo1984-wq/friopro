'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart2, ChevronRight, TrendingUp, Users, CheckCircle, Star } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const CATEGORY_LABELS: Record<string, string> = {
  CLIMA_LABORAL: 'Clima Laboral',
  SATISFACCION: 'Satisfacción',
  LIDERAZGO: 'Liderazgo',
  BIENESTAR: 'Bienestar',
  BURNOUT: 'Burnout',
  ONBOARDING: 'Onboarding',
  RIESGOS_PSICOSOCIALES: 'Riesgos Psicosociales',
  COMUNICACION_INTERNA: 'Comunicación',
  PERSONALIZADA: 'Personalizada',
};

const CATEGORY_COLORS: Record<string, string> = {
  CLIMA_LABORAL: 'from-blue-400 to-blue-600',
  SATISFACCION: 'from-purple-400 to-purple-600',
  LIDERAZGO: 'from-amber-400 to-orange-500',
  BIENESTAR: 'from-emerald-400 to-emerald-600',
  BURNOUT: 'from-red-400 to-red-600',
  default: 'from-gray-400 to-gray-600',
};

function ScoreBar({ value, max = 5 }: { value: number | null; max?: number }) {
  if (value == null) return <span className="text-xs text-gray-400">Sin datos</span>;
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-bold ${pct >= 70 ? 'text-emerald-700' : pct >= 50 ? 'text-amber-700' : 'text-red-600'}`}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export default function ResultadosClimaPage() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');

  useEffect(() => {
    apiFetch('/clima/encuestas')
      .then((d: any) => setSurveys(d.surveys || []))
      .catch(() => setSurveys([]))
      .finally(() => setLoading(false));
  }, []);

  const categories = Array.from(new Set(surveys.map(s => s.category)));
  const filtered = filterCategory ? surveys.filter(s => s.category === filterCategory) : surveys;
  const withResponses = filtered.filter(s => (s.completedCount ?? 0) > 0);
  const withoutResponses = filtered.filter(s => (s.completedCount ?? 0) === 0);

  const avgGlobal = withResponses.length > 0
    ? withResponses.reduce((sum, s) => sum + (s.avgScore || 0), 0) / withResponses.length
    : null;

  const totalParticipacion = filtered.reduce((sum, s) => sum + (s.participationRate || 0), 0);
  const avgParticipacion = filtered.length > 0 ? Math.round(totalParticipacion / filtered.length) : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Resultados Consolidados</h1>
          <p className="text-sm text-gray-500 mt-0.5">Comparativa entre todas las encuestas</p>
        </div>
        <button
          onClick={() => router.push('/clima/encuestas/nueva')}
          className="text-sm text-teal-600 hover:text-teal-800 border border-teal-200 hover:border-teal-400 px-3 py-2 rounded-xl transition-colors"
        >
          + Nueva encuesta
        </button>
      </div>

      {/* Resumen global */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-bold text-teal-700">{avgGlobal != null ? avgGlobal.toFixed(1) : '—'}</p>
          <p className="text-xs text-gray-500 mt-1">Puntaje promedio global</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-bold text-blue-700">{avgParticipacion}%</p>
          <p className="text-xs text-gray-500 mt-1">Participación promedio</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-bold text-purple-700">{filtered.length}</p>
          <p className="text-xs text-gray-500 mt-1">Encuestas totales</p>
        </div>
      </div>

      {/* Filtro por categoría */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCategory('')}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${!filterCategory ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            Todas
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${filterCategory === cat ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white rounded-2xl border animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <BarChart2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay encuestas para mostrar</p>
        </div>
      ) : (
        <>
          {/* Con respuestas */}
          {withResponses.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-600">Con respuestas ({withResponses.length})</h2>
              {withResponses.map(s => {
                const gradColor = CATEGORY_COLORS[s.category] || CATEGORY_COLORS.default;
                return (
                  <div
                    key={s.id}
                    onClick={() => router.push(`/clima/encuestas/${s.id}`)}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer p-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradColor} flex items-center justify-center flex-shrink-0`}>
                        <BarChart2 className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">{s.title}</span>
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            {CATEGORY_LABELS[s.category] || s.category}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {s.isActive ? 'Activa' : 'Cerrada'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Users className="w-3.5 h-3.5 text-gray-400" />
                            <span>{s.completedCount ?? 0}/{s.totalRecipients ?? s._count?.recipients ?? 0} resp.</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{s.participationRate ?? 0}% participación</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Star className="w-3.5 h-3.5 text-amber-400" />
                            <span>{s._count?.questions ?? 0} preguntas</span>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-gray-400 mb-1">Puntaje promedio</p>
                          <ScoreBar value={s.avgScore} />
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 mt-1 flex-shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sin respuestas */}
          {withoutResponses.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-400">Sin respuestas aún ({withoutResponses.length})</h2>
              {withoutResponses.map(s => (
                <div
                  key={s.id}
                  onClick={() => router.push(`/clima/encuestas/${s.id}`)}
                  className="bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-sm transition-all cursor-pointer p-4 flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <BarChart2 className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-600">{s.title}</p>
                    <p className="text-xs text-gray-400">{CATEGORY_LABELS[s.category] || s.category} · {s.totalRecipients ?? s._count?.recipients ?? 0} destinatarios</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
