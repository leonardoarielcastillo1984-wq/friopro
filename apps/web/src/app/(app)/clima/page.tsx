'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wind, BarChart2, ClipboardList, MessageSquare, Target,
  TrendingUp, Users, BrainCircuit, ChevronRight, Plus,
  AlertTriangle, CheckCircle, Clock, ArrowUp, Bell, Zap,
  FileText, Send, Flag, Settings, Calendar, Megaphone
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface DashboardData {
  kpis: {
    totalSurveys: number;
    activeSurveys: number;
    participationRate: number;
    avgScore: number | null;
    openSuggestions: number;
    openComplaints: number;
    openActionPlans: number;
    overdueActionPlans: number;
    inProgressActionPlans: number;
    completedActionPlans: number;
    sentimentCounts: { POSITIVO: number; NEUTRAL: number; NEGATIVO: number };
    completedResponses: number;
    pendingResponses: number;
    totalRecipients: number;
    monthlyTrend: { month: string; score: number }[];
    topTopics: { topic: string; count: number; sentiment: string; criticality: string }[];
  };
  recentSurveys: any[];
}

// Ring chart SVG simple
function RingChart({ value, max = 100, color, size = 80, strokeWidth = 8 }: { value: number; max?: number; color: string; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / max, 1);
  const dash = pct * circumference;
  const cx = size / 2;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cx} r={radius} fill="none" stroke="#f0f0f0" strokeWidth={strokeWidth} />
      <circle cx={cx} cy={cx} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round" />
    </svg>
  );
}

function KpiRing({ label, value, max, color, hexColor, unit = '', sub }: { label: string; value: number; max?: number; color: string; hexColor: string; unit?: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center text-center gap-1">
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      <div className="relative">
        <RingChart value={value} max={max ?? 100} color={hexColor} size={72} strokeWidth={7} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-bold ${color}`}>{value}{unit}</span>
        </div>
      </div>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// Mini line sparkline
function Sparkline({ data, color = '#10b981' }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const w = 200; const h = 60; const pad = 8;
  const xStep = (w - pad * 2) / (data.length - 1 || 1);
  const toY = (v: number) => pad + ((max - v) / (max - min || 1)) * (h - pad * 2);
  const points = data.map((v, i) => `${pad + i * xStep},${toY(v)}`).join(' ');
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-14">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => (
        <circle key={i} cx={pad + i * xStep} cy={toY(v)} r="3" fill={color} />
      ))}
    </svg>
  );
}

const CRIT_COLORS: Record<string, string> = {
  ALTA: 'bg-red-100 text-red-700',
  MEDIA: 'bg-amber-100 text-amber-700',
  BAJA: 'bg-gray-100 text-gray-500',
};

const SENT_EMOJI: Record<string, string> = {
  POSITIVO: '😄',
  NEUTRAL: '😐',
  NEGATIVO: '😟',
};

export default function ClimaPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/clima/dashboard')
      .then((d: any) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const kpis = data?.kpis;
  const trend = kpis?.monthlyTrend ?? [];
  const trendValues = trend.map(t => t.score);
  const trendLabels = trend.map(t => t.month);
  const climaIndex = kpis?.avgScore != null ? Math.round(kpis.avgScore * 20) : 0; // 0-100
  const participacion = kpis?.participationRate ?? 0;
  const satisfaccion = kpis?.avgScore != null ? Math.round(kpis.avgScore * 20) : 0;
  const topics = kpis?.topTopics ?? [];

  return (
    <div className="p-5 max-w-[1400px] mx-auto space-y-4 bg-gray-50 min-h-screen">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow">
            <Wind className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Clima y Cultura</h1>
            <p className="text-xs text-gray-400">Escuchamos a las personas, mejoramos juntos.</p>
          </div>
        </div>
        <button onClick={() => router.push('/clima/encuestas/nueva')}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-xl shadow transition-colors">
          <Plus className="w-4 h-4" /> Nueva encuesta
        </button>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-12 gap-4">

        {/* ── LEFT col (9) ── */}
        <div className="col-span-12 lg:col-span-9 space-y-4">

          {/* Row 1: KPI rings */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {loading ? [...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-36 animate-pulse border border-gray-100" />) : (<>
              {/* Índice clima */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center text-center gap-1 col-span-1">
                <p className="text-xs font-semibold text-gray-500 mb-1">Índice de Clima</p>
                <div className="relative">
                  <RingChart value={climaIndex} max={100} color="#10b981" size={76} strokeWidth={8} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-emerald-600">{climaIndex}</span>
                    <span className="text-[10px] text-gray-400">/100</span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-600">
                  {climaIndex >= 80 ? 'Muy Bueno' : climaIndex >= 60 ? 'Bueno' : climaIndex >= 40 ? 'Regular' : 'Bajo'}
                </span>
              </div>

              {/* Participación */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center text-center gap-1">
                <p className="text-xs font-semibold text-gray-500 mb-1">Participación</p>
                <div className="relative">
                  <RingChart value={participacion} max={100} color="#3b82f6" size={76} strokeWidth={8} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-blue-600">{participacion}%</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400">{kpis?.completedResponses ?? 0} / {kpis?.totalRecipients ?? 0} resp.</p>
              </div>

              {/* Satisfacción */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center text-center gap-1">
                <p className="text-xs font-semibold text-gray-500 mb-1">Satisfacción</p>
                <div className="relative">
                  <RingChart value={satisfaccion} max={100} color="#f59e0b" size={76} strokeWidth={8} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-amber-500">{satisfaccion}%</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400">{kpis?.sentimentCounts?.POSITIVO ?? 0} positivos</p>
              </div>

              {/* Engagement (sentimiento positivo%) */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center text-center gap-1">
                <p className="text-xs font-semibold text-gray-500 mb-1">Engagement</p>
                <div className="relative">
                  {(() => {
                    const total = (kpis?.sentimentCounts?.POSITIVO ?? 0) + (kpis?.sentimentCounts?.NEUTRAL ?? 0) + (kpis?.sentimentCounts?.NEGATIVO ?? 0);
                    const eng = total > 0 ? Math.round(((kpis?.sentimentCounts?.POSITIVO ?? 0) / total) * 100) : 0;
                    return (<>
                      <RingChart value={eng} max={100} color="#8b5cf6" size={76} strokeWidth={8} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-bold text-purple-600">{eng}%</span>
                      </div>
                    </>);
                  })()}
                </div>
                <p className="text-xs text-gray-400">{kpis?.sentimentCounts?.NEGATIVO ?? 0} negativos</p>
              </div>
            </>)}
          </div>

          {/* Row 2: Evolución + Temas recurrentes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Evolución del índice */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Evolución del Índice de Clima</h3>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Últimos {trend.length} meses</span>
              </div>
              {trendValues.length > 1 ? (
                <>
                  <Sparkline data={trendValues} color="#10b981" />
                  <div className="flex justify-between mt-1">
                    {trendLabels.map((l, i) => (
                      <span key={i} className="text-[10px] text-gray-400">{l}</span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-16 flex items-center justify-center text-xs text-gray-400">Sin datos de tendencia aún</div>
              )}
            </div>

            {/* Temas más recurrentes IA */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Temas más recurrentes <span className="text-purple-500 text-xs">(IA)</span></h3>
                <button onClick={() => router.push('/clima/ia')} className="text-xs text-teal-600 hover:text-teal-800 font-medium">Ver todos</button>
              </div>
              {topics.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-4">Ejecutá un análisis IA para ver temas</div>
              ) : (
                <div className="space-y-2">
                  {topics.slice(0, 5).map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <span className="flex-1 text-sm text-gray-700 truncate">{t.topic}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${CRIT_COLORS[t.criticality] ?? 'bg-gray-100 text-gray-500'}`}>{t.criticality}</span>
                      <span className="text-xs text-gray-400">{t.count}</span>
                      <span>{SENT_EMOJI[t.sentiment] ?? '😐'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Encuestas activas + Sugerencias y Reclamos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Encuestas activas */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Encuestas activas</h3>
                <button onClick={() => router.push('/clima/encuestas')} className="text-xs text-teal-600 hover:text-teal-800 font-medium">Ver todas</button>
              </div>
              {loading ? <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
                : data?.recentSurveys?.filter((s: any) => s.isActive).length === 0
                  ? <p className="text-xs text-gray-400 text-center py-4">No hay encuestas activas</p>
                  : (
                    <div className="space-y-3">
                      {(data?.recentSurveys ?? []).filter((s: any) => s.isActive).slice(0, 3).map((s: any) => {
                        const pct = s.participationRate ?? 0;
                        return (
                          <div key={s.id} onClick={() => router.push(`/clima/encuestas/${s.id}`)}
                            className="cursor-pointer hover:bg-gray-50 rounded-xl p-2 -mx-2 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-800 truncate max-w-[140px]">{s.title}</span>
                                <span className="text-xs bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium">Activa</span>
                              </div>
                              <span className="text-xs font-bold text-teal-700">{pct}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            {s.endDate && (
                              <p className="text-[11px] text-gray-400 mt-1">Fecha límite: {new Date(s.endDate).toLocaleDateString('es-AR')}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
            </div>

            {/* Sugerencias y Reclamos */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Sugerencias y Reclamos</h3>
                <button onClick={() => router.push('/clima/sugerencias')} className="text-xs text-teal-600 hover:text-teal-800 font-medium">Ver todos</button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                  <p className="text-2xl font-bold text-red-600">{kpis?.openComplaints ?? kpis?.openSuggestions ?? 0}</p>
                  <p className="text-xs text-red-500 mt-0.5">Reclamos abiertos</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                  <p className="text-2xl font-bold text-amber-600">{kpis?.openSuggestions ?? 0}</p>
                  <p className="text-xs text-amber-500 mt-0.5">Sugerencias pendientes</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>Tiempo promedio de respuesta: <strong className="text-gray-700">—</strong></span>
              </div>
            </div>
          </div>

          {/* Row 4: Planes de acción */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Planes de acción</h3>
              <button onClick={() => router.push('/clima/planes-accion')} className="text-xs text-teal-600 hover:text-teal-800 font-medium">Ver todos</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Abiertos', value: kpis?.openActionPlans ?? 0, color: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: FileText },
                { label: 'Vencidos', value: kpis?.overdueActionPlans ?? 0, color: 'bg-red-50 border-red-200', text: 'text-red-700', icon: AlertTriangle },
                { label: 'En ejecución', value: kpis?.inProgressActionPlans ?? 0, color: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: Settings },
                { label: 'Completados', value: kpis?.completedActionPlans ?? 0, color: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: CheckCircle },
              ].map(c => (
                <div key={c.label} className={`${c.color} border rounded-xl p-3 flex items-center gap-3`}>
                  <c.icon className={`w-5 h-5 ${c.text} flex-shrink-0`} />
                  <div>
                    <p className={`text-xl font-bold ${c.text}`}>{c.value}</p>
                    <p className={`text-xs ${c.text} opacity-70`}>{c.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT col (3) ── */}
        <div className="col-span-12 lg:col-span-3 space-y-4">

          {/* Tu opinión importa */}
          <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-5 text-white shadow">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-5 h-5" />
              <h3 className="font-semibold text-sm">¡Tu opinión importa!</h3>
            </div>
            <p className="text-xs text-white/80 mb-4">Tu feedback nos ayuda a construir un mejor lugar para trabajar.</p>
            <button onClick={() => router.push('/clima/sugerencias')}
              className="w-full bg-white text-teal-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-teal-50 transition-colors shadow-sm">
              Enviar sugerencia o reclamo
            </button>
          </div>

          {/* Accesos rápidos */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Accesos rápidos</h3>
            <div className="space-y-1">
              {[
                { label: 'Nueva encuesta', icon: Plus, href: '/clima/encuestas/nueva', color: 'text-teal-600' },
                { label: 'Mis encuestas', icon: ClipboardList, href: '/clima/encuestas', color: 'text-blue-600' },
                { label: 'Comunicados', icon: Megaphone, href: '/clima/comunicados', color: 'text-indigo-600' },
                { label: 'Enviar sugerencia', icon: Send, href: '/clima/sugerencias', color: 'text-amber-600' },
                { label: 'Mis reclamos', icon: Flag, href: '/clima/sugerencias', color: 'text-red-500' },
              ].map(a => (
                <button key={a.label} onClick={() => router.push(a.href)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left transition-colors group">
                  <a.icon className={`w-4 h-4 ${a.color} flex-shrink-0`} />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">{a.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 ml-auto" />
                </button>
              ))}
            </div>
          </div>

          {/* Alertas y notificaciones */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Alertas</h3>
              <Bell className="w-4 h-4 text-gray-400" />
            </div>
            <div className="space-y-2">
              {kpis?.overdueActionPlans ? (
                <div className="flex items-start gap-2 bg-amber-50 rounded-xl px-3 py-2 border border-amber-100">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">{kpis.overdueActionPlans} planes de acción vencidos requieren atención</p>
                </div>
              ) : null}
              {kpis?.openSuggestions ? (
                <div className="flex items-start gap-2 bg-blue-50 rounded-xl px-3 py-2 border border-blue-100">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-800">{kpis.openSuggestions} sugerencias sin responder</p>
                </div>
              ) : null}
              {(kpis?.activeSurveys ?? 0) > 0 && (
                <div className="flex items-start gap-2 bg-teal-50 rounded-xl px-3 py-2 border border-teal-100">
                  <ClipboardList className="w-3.5 h-3.5 text-teal-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-teal-800">{kpis?.activeSurveys} encuesta(s) activa(s)</p>
                </div>
              )}
              {!kpis?.overdueActionPlans && !kpis?.openSuggestions && !(kpis?.activeSurveys) && (
                <p className="text-xs text-gray-400 text-center py-2">Sin alertas pendientes</p>
              )}
            </div>
          </div>

          {/* Participación por área (sentimiento) */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Sentimiento</h3>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Positivo', value: kpis?.sentimentCounts?.POSITIVO ?? 0, color: 'bg-emerald-500', total: (kpis?.sentimentCounts?.POSITIVO ?? 0) + (kpis?.sentimentCounts?.NEUTRAL ?? 0) + (kpis?.sentimentCounts?.NEGATIVO ?? 0) },
                { label: 'Neutral', value: kpis?.sentimentCounts?.NEUTRAL ?? 0, color: 'bg-gray-400', total: (kpis?.sentimentCounts?.POSITIVO ?? 0) + (kpis?.sentimentCounts?.NEUTRAL ?? 0) + (kpis?.sentimentCounts?.NEGATIVO ?? 0) },
                { label: 'Negativo', value: kpis?.sentimentCounts?.NEGATIVO ?? 0, color: 'bg-red-500', total: (kpis?.sentimentCounts?.POSITIVO ?? 0) + (kpis?.sentimentCounts?.NEUTRAL ?? 0) + (kpis?.sentimentCounts?.NEGATIVO ?? 0) },
              ].map(s => {
                const pct = s.total > 0 ? Math.round((s.value / s.total) * 100) : 0;
                return (
                  <div key={s.label}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{s.label}</span>
                      <span className="font-medium">{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className={`${s.color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
