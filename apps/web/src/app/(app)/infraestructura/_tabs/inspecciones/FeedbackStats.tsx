'use client';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Star, TrendingUp, Award, ThumbsUp, ShieldAlert, ExternalLink } from 'lucide-react';

const PROBLEMA_LABEL: Record<string, string> = {
  GOLPE_CAJA: 'Golpe / daño en caja', PRECINTO_ROTO: 'Precinto roto',
  FALTANTE: 'Faltante de mercadería', HUMEDAD: 'Humedad / mojado',
  TEMPERATURA: 'Falla de temperatura', OTRO: 'Otro problema',
};

function Stars({ val }: { val: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(val) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />
      ))}
    </span>
  );
}

function KPI({ label, value, sub, icon: Icon, color }: any) {
  return (
    <div className={`rounded-2xl p-4 bg-gradient-to-br ${color} text-white`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium opacity-80">{label}</p>
        <div className="bg-white/20 rounded-lg p-1.5"><Icon className="w-4 h-4" /></div>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
    </div>
  );
}

export default function FeedbackStats() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (apiFetch('/inspecciones/feedback-stats') as any)
      .then((r: any) => { setData(r); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  if (!data || data.total === 0) return (
    <div className="text-center py-16">
      <Star className="w-12 h-12 text-gray-200 mx-auto mb-3" />
      <p className="text-sm text-gray-500 font-medium">Sin evaluaciones de clientes aún</p>
      <p className="text-xs text-gray-400 mt-1">Los clientes que escaneen el QR Feedback verán esta información aquí.</p>
    </div>
  );

  const { total, promedio, nivelServicio, nps, tasaDiscrepancia } = data;
  const rankingActivos: any[] = data.rankingActivos || [];
  const tendenciaSemanal: any[] = data.tendenciaSemanal || [];
  const problemasFrecuentes: any[] = data.problemasFrecuentes || [];
  const maxBar = tendenciaSemanal.length > 0 ? Math.max(...tendenciaSemanal.map((t: any) => t.total), 1) : 1;

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Promedio general" value={`${promedio}★`} sub={`${total} evaluaciones · 90 días`} icon={Star}
          color="from-amber-500 to-orange-500" />
        <KPI label="Nivel de servicio" value={`${nivelServicio}%`} sub="% con calificación ≥ 4★"
          icon={ThumbsUp} color={nivelServicio >= 80 ? 'from-emerald-500 to-emerald-600' : nivelServicio >= 60 ? 'from-amber-500 to-amber-600' : 'from-red-500 to-red-600'} />
        <KPI label="NPS del servicio" value={nps > 0 ? `+${nps}` : `${nps}`} sub="Promotores menos detractores"
          icon={TrendingUp} color={nps >= 50 ? 'from-blue-500 to-blue-600' : nps >= 0 ? 'from-indigo-500 to-indigo-600' : 'from-red-500 to-red-600'} />
        <KPI label="Tasa discrepancias" value={`${tasaDiscrepancia}%`} sub="Problemas no marcados en check"
          icon={ShieldAlert} color={tasaDiscrepancia === 0 ? 'from-slate-500 to-slate-600' : tasaDiscrepancia > 20 ? 'from-red-500 to-red-600' : 'from-amber-500 to-amber-600'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Ranking activos */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-800">Ranking de unidades</h3>
          </div>
          {rankingActivos.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Sin datos suficientes</p>
          ) : (
            <div className="space-y-2">
              {rankingActivos.slice(0, 8).map((a: any, i: number) => (
                <div key={a.dominio} className="flex items-center gap-3">
                  <span className={`text-xs font-bold w-5 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-700' : 'text-gray-400'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{a.dominio}</p>
                    <p className="text-[10px] text-gray-400 truncate">{a.nombre}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Stars val={a.promedio} />
                    <span className="text-xs font-bold text-gray-700">{a.promedio}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 w-10 text-right">{a.count} eval.</span>
                  {a.reclamos > 0 && (
                    <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">{a.reclamos} NCR</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tendencia semanal */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-800">Tendencia semanal</h3>
          </div>
          {tendenciaSemanal.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Sin datos suficientes</p>
          ) : (
            <div className="flex items-end gap-1.5 h-32">
              {tendenciaSemanal.map((t: any) => {
                const h = Math.max((t.total / maxBar) * 100, 6);
                const color = t.promedio >= 4 ? 'bg-emerald-400' : t.promedio >= 3 ? 'bg-amber-400' : 'bg-red-400';
                const label = new Date(t.semana).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
                return (
                  <div key={t.semana} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="relative w-full flex justify-center">
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-7 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                        {t.promedio}★ · {t.total} eval.
                      </div>
                      <div className={`w-full rounded-t-lg ${color} transition-all`} style={{ height: `${h}%` }} />
                    </div>
                    <span className="text-[8px] text-gray-400 text-center leading-tight">{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Problemas frecuentes */}
      {problemasFrecuentes.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-gray-800">Problemas más reportados por clientes</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {problemasFrecuentes.map((p: any) => {
              const max = problemasFrecuentes[0].count;
              const pct = Math.round(p.count / max * 100);
              return (
                <div key={p.tipo} className="bg-red-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-medium text-red-800 truncate">{PROBLEMA_LABEL[p.tipo] || p.tipo}</p>
                    <span className="text-xs font-bold text-red-600 shrink-0 ml-1">{p.count}x</span>
                  </div>
                  <div className="bg-red-200 rounded-full h-1.5">
                    <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Worst performers */}
      {rankingActivos.length > 3 && (
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-gray-800">Unidades con peor calificación</h3>
            <span className="text-[10px] text-gray-400 ml-auto">Requieren atención</span>
          </div>
          <div className="space-y-2">
            {[...rankingActivos].reverse().slice(0, 3).map((a: any) => (
              <div key={a.dominio} className="flex items-center gap-3 bg-red-50 rounded-xl p-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800">{a.dominio}</p>
                  <p className="text-[10px] text-gray-400">{a.nombre} · {a.count} evaluaciones</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Stars val={a.promedio} />
                  <span className="text-xs font-bold text-red-600">{a.promedio}</span>
                </div>
                {a.reclamos === 0 && (
                  <a href="/no-conformidades" className="text-[10px] text-blue-600 flex items-center gap-0.5 hover:underline whitespace-nowrap">
                    <ExternalLink className="w-2.5 h-2.5" /> Crear NCR
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
