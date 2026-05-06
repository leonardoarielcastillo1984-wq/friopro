'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Users, MessageSquare, BarChart2, Activity } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function IndicadoresClimaPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/clima/indicadores')
      .then((d: any) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-center text-sm text-gray-400 animate-pulse">Cargando indicadores...</div>;
  if (!data) return <div className="p-6 text-center text-sm text-red-500">Error cargando indicadores</div>;

  const { indices, tendencia, sentimientos } = data;

  const KPI = ({ label, value, icon: Icon, color, suffix = '' }: any) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value ?? '—'}{suffix}</p>
    </div>
  );

  const totalSentiment = (sentimientos?.POSITIVO || 0) + (sentimientos?.NEUTRAL || 0) + (sentimientos?.NEGATIVO || 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Indicadores de Clima</h1>
        <p className="text-sm text-gray-500 mt-0.5">Métricas clave del estado organizacional</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPI label="Índice de Clima" value={indices?.clima} icon={BarChart2} color="bg-teal-500" suffix="/100" />
        <KPI label="Participación" value={indices?.participacion} icon={Users} color="bg-blue-500" suffix="%" />
        <KPI label="Engagement" value={indices?.engagement} icon={Activity} color="bg-purple-500" suffix="/100" />
        <KPI label="Respuestas totales" value={indices?.totalRespuestas} icon={TrendingUp} color="bg-emerald-500" />
        <KPI label="Sugerencias abiertas" value={indices?.sugerenciasAbiertas} icon={MessageSquare} color={indices?.sugerenciasAbiertas > 0 ? 'bg-amber-500' : 'bg-gray-400'} />
        <KPI label="Reclamos abiertos" value={indices?.reclamosAbiertos} icon={TrendingDown} color={indices?.reclamosAbiertos > 0 ? 'bg-red-500' : 'bg-gray-400'} />
      </div>

      {/* Sentiment */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribución de Sentimiento</h3>
        {totalSentiment === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Sin datos de sentimiento aún</p>
        ) : (
          <div className="space-y-3">
            {[
              { key: 'POSITIVO', label: 'Positivo', color: 'bg-emerald-400', text: 'text-emerald-700' },
              { key: 'NEUTRAL', label: 'Neutral', color: 'bg-gray-400', text: 'text-gray-600' },
              { key: 'NEGATIVO', label: 'Negativo', color: 'bg-red-400', text: 'text-red-600' },
            ].map(({ key, label, color, text }) => {
              const count = sentimientos?.[key] || 0;
              const pct = totalSentiment > 0 ? Math.round((count / totalSentiment) * 100) : 0;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-16">{label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                    <div className={`${color} h-2.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`text-xs font-medium ${text} w-10 text-right`}>{pct}%</span>
                  <span className="text-xs text-gray-400 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tendencia */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Tendencia mensual (últimos 12 meses)</h3>
        {!tendencia || tendencia.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Sin datos de tendencia aún</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-gray-500 font-medium">Mes</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Puntaje prom.</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Respuestas</th>
                  <th className="py-2 text-gray-500 font-medium text-center">Barra</th>
                </tr>
              </thead>
              <tbody>
                {tendencia.map((row: any) => (
                  <tr key={row.month} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2.5 text-gray-700 font-medium">{row.month}</td>
                    <td className="py-2.5 text-right text-teal-700 font-bold">{row.avgScore ?? '—'}</td>
                    <td className="py-2.5 text-right text-gray-500">{row.responses}</td>
                    <td className="py-2.5 px-4">
                      <div className="bg-gray-100 rounded-full h-1.5 w-full">
                        <div
                          className="bg-teal-400 h-1.5 rounded-full"
                          style={{ width: `${row.avgScore ? Math.min((row.avgScore / 5) * 100, 100) : 0}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
