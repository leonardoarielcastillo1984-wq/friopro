'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { DashboardData } from '@/lib/types';
import {
  FileText, BookOpen, AlertTriangle, Shield, TrendingUp, Users,
  GraduationCap, BarChart3, Activity, Target, Clock,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw
} from 'lucide-react';
import TrendChart from '@/components/TrendChart';
import PeriodComparison from '@/components/PeriodComparison';
import SmartAlerts from '@/components/SmartAlerts';

interface DashboardStats {
  documents: number;
  normatives: number;
  ncrs: number;
  risks: number;
  indicators: number;
  trainings: number;
}

interface DashboardResponse {
  dashboard: {
    documents: { total: number; effective: number; draft: number };
    normatives: { total: number; ready: number };
    ncrs: { total: number; open: number; closed: number };
    risks: { total: number };
    findings: { total: number };
    trainings: { total: number; completed: number };
    departments: number;
  };
}

const DEFAULT_STATS: DashboardStats = {
  documents: 0,
  normatives: 0,
  ncrs: 0,
  risks: 0,
  indicators: 0,
  trainings: 0,
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await apiFetch<DashboardResponse>('/dashboard');
        // Transform the data to match the expected interface
        const transformedStats: DashboardStats = {
          documents: data.dashboard.documents.total,
          normatives: data.dashboard.normatives.total,
          ncrs: data.dashboard.ncrs.total,
          risks: data.dashboard.risks.total,
          indicators: data.dashboard.findings.total,
          trainings: data.dashboard.trainings.total,
        };
        setStats(transformedStats);
      } catch (err: any) {
        setStats(DEFAULT_STATS);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/4 mb-2"></div>
            <div className="h-3 bg-slate-200 rounded w-1/3"></div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{greeting}</h1>
          <p className="text-slate-500 mt-1">Resumen ejecutivo de tu sistema de gestión integrado</p>
        </div>
        <div className="flex items-center gap-3 px-5 py-3 rounded-xl border bg-blue-50 border-blue-200">
          <Activity className="h-5 w-5 text-blue-600" />
          <div>
            <div className="text-2xl font-bold text-blue-600">SGI 360</div>
            <div className="text-xs text-slate-500">Panel Principal</div>
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      {!loading && (
        <div className="space-y-6">
          {/* Trend Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TrendChart
              data={[
                { date: 'Ene', value: 85, target: 90 },
                { date: 'Feb', value: 88, target: 90 },
                { date: 'Mar', value: 92, target: 90 },
                { date: 'Abr', value: 87, target: 90 },
                { date: 'May', value: 91, target: 90 },
                { date: 'Jun', value: 94, target: 90 },
              ]}
              title="Evolución de Indicadores"
              type="line"
              showTarget={true}
              formatValue={(value) => `${value.toFixed(0)}%`}
            />
            
            <TrendChart
              data={[
                { date: 'Ene', value: 12, comparison: 15 },
                { date: 'Feb', value: 8, comparison: 10 },
                { date: 'Mar', value: 6, comparison: 8 },
                { date: 'Abr', value: 4, comparison: 7 },
                { date: 'May', value: 3, comparison: 5 },
                { date: 'Jun', value: 2, comparison: 4 },
              ]}
              title="No Conformidades Abiertas"
              type="area"
              showComparison={true}
              formatValue={(value) => value.toString()}
            />
          </div>

          {/* Period Comparison */}
          <PeriodComparison
            data={[
              {
                label: 'Indicadores',
                current: 94,
                previous: 87,
                target: 95,
                unit: '%'
              },
              {
                label: 'No Conformidades',
                current: 2,
                previous: 4,
                target: 1,
                unit: ''
              },
              {
                label: 'Capacitaciones',
                current: 18,
                previous: 15,
                target: 20,
                unit: ''
              },
              {
                label: 'Auditorías',
                current: 8,
                previous: 6,
                target: 10,
                unit: ''
              }
            ]}
            currentPeriod="Junio 2026"
            previousPeriod="Mayo 2026"
            showTarget={true}
          />

          {/* Smart Alerts */}
          <SmartAlerts
            alerts={[
              {
                id: '1',
                ruleId: 'ncr-high',
                ruleName: 'NCRs Críticas Abiertas',
                message: 'Hay 2 NCRs de severidad crítica abiertas por más de 7 días',
                severity: 'high',
                metric: 'NCRs',
                currentValue: 2,
                threshold: 1,
                category: 'quality',
                timestamp: new Date().toISOString(),
                acknowledged: false,
                resolved: false,
                actionRequired: true,
                suggestedActions: ['Revisar asignación de recursos', 'Priorizar acciones correctivas']
              },
              {
                id: '2',
                ruleId: 'indicator-below',
                ruleName: 'Indicador por debajo del objetivo',
                message: 'El indicador de satisfacción del cliente está 5% por debajo del objetivo',
                severity: 'medium',
                metric: 'Satisfacción Cliente',
                currentValue: 85,
                threshold: 90,
                category: 'customer',
                timestamp: new Date().toISOString(),
                acknowledged: false,
                resolved: false,
                actionRequired: true,
                suggestedActions: ['Analizar causas raíz', 'Implementar plan de mejora']
              }
            ]}
            rules={[
              {
                id: 'ncr-high',
                name: 'NCRs Críticas Abiertas',
                description: 'Alerta cuando hay NCRs críticas abiertas por más de 7 días',
                type: 'threshold',
                metric: 'NCRs',
                condition: 'above',
                threshold: 1,
                severity: 'high',
                enabled: true,
                category: 'quality'
              },
              {
                id: 'indicator-below',
                name: 'Indicador por debajo del objetivo',
                description: 'Alerta cuando un indicador está por debajo del objetivo',
                type: 'threshold',
                metric: 'Indicadores',
                condition: 'below',
                threshold: 90,
                severity: 'medium',
                enabled: true,
                category: 'customer'
              }
            ]}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Documentos</p>
              <p className="text-2xl font-bold text-slate-900">{stats?.documents || 0}</p>
              <p className="text-xs text-slate-500 mt-1">Gestión documental</p>
            </div>
            <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
              📄
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Normativos</p>
              <p className="text-2xl font-bold text-slate-900">{stats?.normatives || 0}</p>
              <p className="text-xs text-slate-500 mt-1">Normas y regulaciones</p>
            </div>
            <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
              📋
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">No Conformidades</p>
              <p className="text-2xl font-bold text-slate-900">{stats?.ncrs || 0}</p>
              <p className="text-xs text-slate-500 mt-1">Acciones correctivas</p>
            </div>
            <div className="h-8 w-8 bg-red-100 rounded-lg flex items-center justify-center">
              ⚠️
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Riesgos</p>
              <p className="text-2xl font-bold text-slate-900">{stats?.risks || 0}</p>
              <p className="text-xs text-slate-500 mt-1">Gestión de riesgos</p>
            </div>
            <div className="h-8 w-8 bg-orange-100 rounded-lg flex items-center justify-center">
              🔥
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Indicadores</p>
              <p className="text-2xl font-bold text-slate-900">{stats?.indicators || 0}</p>
              <p className="text-xs text-slate-500 mt-1">KPIs y métricas</p>
            </div>
            <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center">
              📊
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Capacitaciones</p>
              <p className="text-2xl font-bold text-slate-900">{stats?.trainings || 0}</p>
              <p className="text-xs text-slate-500 mt-1">Formación y entrenamiento</p>
            </div>
            <div className="h-8 w-8 bg-cyan-100 rounded-lg flex items-center justify-center">
              �
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Bienvenido a SGI 360</h2>
        <div className="text-slate-600">
          <p className="mb-4">
            Tu sistema de gestión integrado está funcionando correctamente. 
            Comienza agregando documentos, normativos y configurando tus departamentos.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/documents" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              📄 Ver Documentos
            </Link>
            <Link href="/normativos" className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              📋 Ver Normativos
            </Link>
            <Link href="/configuracion" className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              ⚙️ Configuración
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
