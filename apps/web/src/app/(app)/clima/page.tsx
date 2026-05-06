'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wind, BarChart2, ClipboardList, MessageSquare, Target,
  TrendingUp, Users, BrainCircuit, ChevronRight, Plus,
  AlertTriangle, CheckCircle, Clock, ArrowUp, ArrowDown, Minus
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface DashboardData {
  kpis: {
    totalSurveys: number;
    activeSurveys: number;
    participationRate: number;
    avgScore: number | null;
    openSuggestions: number;
    openActionPlans: number;
    overdueActionPlans: number;
    sentimentCounts: { POSITIVO: number; NEUTRAL: number; NEGATIVO: number };
    completedResponses: number;
    pendingResponses: number;
  };
  recentSurveys: any[];
}

const modules = [
  { label: 'Encuestas', description: 'Crear y gestionar encuestas internas', icon: ClipboardList, href: '/clima/encuestas', color: 'from-blue-500 to-blue-700' },
  { label: 'Resultados', description: 'Análisis de respuestas por encuesta', icon: BarChart2, href: '/clima/resultados', color: 'from-purple-500 to-purple-700' },
  { label: 'Indicadores', description: 'KPIs y tendencias del clima', icon: TrendingUp, href: '/clima/indicadores', color: 'from-emerald-500 to-emerald-700' },
  { label: 'IA y Tendencias', description: 'Análisis inteligente de temas recurrentes', icon: BrainCircuit, href: '/clima/ia', color: 'from-amber-500 to-orange-600' },
  { label: 'Sugerencias', description: 'Buzón de sugerencias y reclamos', icon: MessageSquare, href: '/clima/sugerencias', color: 'from-rose-500 to-red-600' },
  { label: 'Planes de Acción', description: 'Acciones correctivas vinculadas', icon: Target, href: '/clima/planes-accion', color: 'from-cyan-500 to-cyan-700' },
];

function SentimentBadge({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className={`flex flex-col items-center p-3 rounded-xl ${color}`}>
      <span className="text-2xl font-bold text-white">{count}</span>
      <span className="text-xs text-white/80 mt-0.5">{label}</span>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color, subtitle }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function ClimaPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/clima/dashboard')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const kpis = data?.kpis;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow">
              <Wind className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Clima y Cultura</h1>
              <p className="text-sm text-gray-500">Módulo Premium · Medición Organizacional Inteligente</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push('/clima/encuestas/nueva')}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva encuesta
        </button>
      </div>

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Encuestas activas" value={kpis?.activeSurveys ?? 0} icon={ClipboardList} color="bg-blue-500" />
          <KpiCard label="Participación" value={kpis?.participationRate != null ? `${kpis.participationRate}%` : '0%'} icon={Users} color="bg-teal-500" subtitle={`${kpis?.completedResponses ?? 0} completadas`} />
          <KpiCard label="Puntaje promedio" value={kpis?.avgScore ?? '—'} icon={TrendingUp} color="bg-purple-500" subtitle="Últimas respuestas" />
          <KpiCard label="Sugerencias abiertas" value={kpis?.openSuggestions ?? 0} icon={MessageSquare} color={kpis?.openSuggestions ? 'bg-amber-500' : 'bg-gray-400'} subtitle={`${kpis?.openActionPlans ?? 0} planes activos`} />
        </div>
      )}

      {/* Sentiment */}
      {kpis && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Sentimiento general (últimas 20 respuestas)</h3>
          <div className="flex gap-3">
            <SentimentBadge count={kpis.sentimentCounts.POSITIVO} label="Positivo" color="bg-emerald-500" />
            <SentimentBadge count={kpis.sentimentCounts.NEUTRAL} label="Neutral" color="bg-gray-400" />
            <SentimentBadge count={kpis.sentimentCounts.NEGATIVO} label="Negativo" color="bg-red-500" />
          </div>
          {kpis.overdueActionPlans > 0 && (
            <div className="mt-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-2.5 border border-amber-200">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span><strong>{kpis.overdueActionPlans}</strong> plan(es) de acción vencido(s) requieren atención</span>
            </div>
          )}
        </div>
      )}

      {/* Módulos Grid */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-4">Módulos del sistema</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.href}
                onClick={() => router.push(m.href)}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all text-left p-5 flex items-center gap-4"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{m.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{m.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Encuestas recientes */}
      {data?.recentSurveys && data.recentSurveys.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Encuestas recientes</h3>
            <button onClick={() => router.push('/clima/encuestas')} className="text-xs text-teal-600 hover:text-teal-800 font-medium">Ver todas</button>
          </div>
          <div className="space-y-2">
            {data.recentSurveys.map((s: any) => (
              <div key={s.id} onClick={() => router.push(`/clima/encuestas/${s.id}`)}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${s.isActive ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                  <span className="text-sm font-medium text-gray-800 group-hover:text-teal-700">{s.title}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{s.category?.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{s._count?.recipients ?? 0} destinatarios</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
