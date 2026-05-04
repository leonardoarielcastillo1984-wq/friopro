'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  FileText, BookOpen, AlertTriangle, Shield, TrendingUp, Users,
  GraduationCap, Activity, Target, RefreshCw,
  CheckSquare, HardHat, Leaf, Siren, Truck, Ruler,
  UsersRound, CalendarDays, Clock, ChevronRight,
} from 'lucide-react';

interface DashboardResponse {
  dashboard: {
    documents: { total: number; effective: number; draft: number };
    normatives: { total: number };
    ncrs: { total: number; open: number; inProgress: number; closed: number; overdue: number; critical: number };
    risks: { total: number; critical: number; high: number; medium: number; low: number };
    trainings: { total: number; completed: number };
    departments: number;
    indicators: { total: number };
    actions: { open: number; overdue: number };
    objectives: { total: number; onTrack: number };
    hazards: { total: number; critical: number };
    aspects: { total: number; significant: number };
    incidents: { thisMonth: number };
    suppliers: { approved: number; pending: number };
    calibrations: { dueSoon: number };
    stakeholders: { total: number };
    findings: { total: number; open: number };
  };
}

type D = DashboardResponse['dashboard'];

const EMPTY: D = {
  documents: { total: 0, effective: 0, draft: 0 },
  normatives: { total: 0 },
  ncrs: { total: 0, open: 0, inProgress: 0, closed: 0, overdue: 0, critical: 0 },
  risks: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
  trainings: { total: 0, completed: 0 },
  departments: 0,
  indicators: { total: 0 },
  actions: { open: 0, overdue: 0 },
  objectives: { total: 0, onTrack: 0 },
  hazards: { total: 0, critical: 0 },
  aspects: { total: 0, significant: 0 },
  incidents: { thisMonth: 0 },
  suppliers: { approved: 0, pending: 0 },
  calibrations: { dueSoon: 0 },
  stakeholders: { total: 0 },
  findings: { total: 0, open: 0 },
};

const safeNum = (val: any, d = 0) => { const n = Number(val); return isNaN(n) ? d : n; };

function StatCard({
  icon: Icon, label, value, sub, subAlert, href, color,
}: {
  icon: React.ElementType; label: string; value: number | string;
  sub?: string; subAlert?: boolean; href: string; color: string;
}) {
  return (
    <Link href={href} className="group bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-blue-300 transition-all flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors mt-1" />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900 leading-none">{value}</div>
        <div className="text-sm font-medium text-gray-600 mt-1">{label}</div>
        {sub && (
          <div className={`text-xs mt-1 font-medium ${subAlert ? 'text-red-600' : 'text-gray-400'}`}>{sub}</div>
        )}
      </div>
    </Link>
  );
}

function DistBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-600 flex-1 min-w-0">{label}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs font-semibold text-slate-900">{value}</span>
          <span className="text-slate-400 font-normal text-xs">({Math.round(pct)}%)</span>
        </div>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div className={`${color} rounded-full h-2 transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<D>(EMPTY);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<DashboardResponse>('/dashboard');
      const d = res?.dashboard;
      if (!d) { setData(EMPTY); return; }
      setData({
        documents: { total: safeNum(d.documents?.total), effective: safeNum(d.documents?.effective), draft: safeNum(d.documents?.draft) },
        normatives: { total: safeNum(d.normatives?.total) },
        ncrs: { total: safeNum(d.ncrs?.total), open: safeNum(d.ncrs?.open), inProgress: safeNum(d.ncrs?.inProgress), closed: safeNum(d.ncrs?.closed), overdue: safeNum(d.ncrs?.overdue), critical: safeNum(d.ncrs?.critical) },
        risks: { total: safeNum(d.risks?.total), critical: safeNum(d.risks?.critical), high: safeNum(d.risks?.high), medium: safeNum(d.risks?.medium), low: safeNum(d.risks?.low) },
        trainings: { total: safeNum(d.trainings?.total), completed: safeNum(d.trainings?.completed) },
        departments: safeNum(d.departments),
        indicators: { total: safeNum(d.indicators?.total) },
        actions: { open: safeNum(d.actions?.open), overdue: safeNum(d.actions?.overdue) },
        objectives: { total: safeNum(d.objectives?.total), onTrack: safeNum(d.objectives?.onTrack) },
        hazards: { total: safeNum(d.hazards?.total), critical: safeNum(d.hazards?.critical) },
        aspects: { total: safeNum(d.aspects?.total), significant: safeNum(d.aspects?.significant) },
        incidents: { thisMonth: safeNum(d.incidents?.thisMonth) },
        suppliers: { approved: safeNum(d.suppliers?.approved), pending: safeNum(d.suppliers?.pending) },
        calibrations: { dueSoon: safeNum(d.calibrations?.dueSoon) },
        stakeholders: { total: safeNum(d.stakeholders?.total) },
        findings: { total: safeNum(d.findings?.total), open: safeNum(d.findings?.open) },
      });
    } catch {
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

  const alerts: { msg: string; href: string; level: 'red' | 'yellow' }[] = [];
  if (data.actions.overdue > 0)
    alerts.push({ msg: `${data.actions.overdue} acción${data.actions.overdue > 1 ? 'es' : ''} CAPA vencida${data.actions.overdue > 1 ? 's' : ''}`, href: '/acciones', level: 'red' });
  if (data.ncrs.open > 0)
    alerts.push({ msg: `${data.ncrs.open} no conformidad${data.ncrs.open > 1 ? 'es' : ''} abierta${data.ncrs.open > 1 ? 's' : ''}`, href: '/no-conformidades', level: 'red' });
  if (data.hazards.critical > 0)
    alerts.push({ msg: `${data.hazards.critical} peligro${data.hazards.critical > 1 ? 's' : ''} SST de nivel crítico / alto`, href: '/iperc', level: 'yellow' });
  if (data.calibrations.dueSoon > 0)
    alerts.push({ msg: `${data.calibrations.dueSoon} equipo${data.calibrations.dueSoon > 1 ? 's' : ''} a calibrar en 30 días`, href: '/calibraciones', level: 'yellow' });
  if (data.suppliers.pending > 0)
    alerts.push({ msg: `${data.suppliers.pending} proveedor${data.suppliers.pending > 1 ? 'es' : ''} pendiente${data.suppliers.pending > 1 ? 's' : ''} de aprobación`, href: '/proveedores', level: 'yellow' });


  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{greeting} — SGI 360</h1>
              <p className="text-sm text-gray-500">Panel ejecutivo · {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
          <button onClick={load} disabled={loading} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Alertas críticas */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <Link key={i} href={a.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all hover:opacity-90 ${a.level === 'red' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                <Clock className="h-4 w-4 flex-shrink-0" />
                {a.msg}
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Link>
            ))}
          </div>
        )}

        {/* Distribuciones: Riesgos y NC */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4 text-sm">Distribución de Riesgos</h2>
            <div className="space-y-3">
              <DistBar label="Crítico (20-25)" value={data.risks.critical} total={data.risks.total} color="bg-red-500" />
              <DistBar label="Alto (12-19)" value={data.risks.high} total={data.risks.total} color="bg-orange-500" />
              <DistBar label="Medio (5-11)" value={data.risks.medium} total={data.risks.total} color="bg-yellow-500" />
              <DistBar label="Bajo (1-4)" value={data.risks.low} total={data.risks.total} color="bg-green-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4 text-sm">Estado de No Conformidades</h2>
            <div className="space-y-3">
              <DistBar label="Abiertas" value={data.ncrs.open} total={data.ncrs.total} color="bg-red-500" />
              <DistBar label="En Proceso" value={data.ncrs.inProgress} total={data.ncrs.total} color="bg-yellow-500" />
              <DistBar label="Cerradas" value={data.ncrs.closed} total={data.ncrs.total} color="bg-green-500" />
            </div>
            {data.ncrs.critical > 0 && (
              <div className="mt-4 bg-red-50 rounded-lg p-3 text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                {data.ncrs.critical} NCR(s) crítica(s) requieren atención inmediata
              </div>
            )}
          </div>
        </div>

        {/* Sección: Base del sistema */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Base del sistema</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={FileText} label="Documentos" value={data.documents.total}
              sub={`${data.documents.effective} vigentes`} href="/documents" color="bg-blue-100 text-blue-600" />
            <StatCard icon={BookOpen} label="Normativos" value={data.normatives.total}
              href="/normativos" color="bg-indigo-100 text-indigo-600" />
            <StatCard icon={Users} label="Empleados" value={data.departments}
              sub="departamentos" href="/rrhh" color="bg-violet-100 text-violet-600" />
            <StatCard icon={GraduationCap} label="Capacitaciones" value={data.trainings.total}
              sub={`${data.trainings.completed} completadas`} href="/capacitaciones" color="bg-cyan-100 text-cyan-600" />
            <StatCard icon={UsersRound} label="Partes interesadas" value={data.stakeholders.total}
              href="/partes-interesadas" color="bg-teal-100 text-teal-600" />
            <StatCard icon={Target} label="Objetivos SGI" value={data.objectives.total}
              sub={`${data.objectives.onTrack} en curso`} href="/objetivos" color="bg-emerald-100 text-emerald-600" />
          </div>
        </div>

        {/* Sección: Riesgos y seguridad */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Riesgos, SST y ambiente</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatCard icon={Shield} label="Riesgos" value={data.risks.total}
              href="/riesgos" color="bg-orange-100 text-orange-600" />
            <StatCard icon={HardHat} label="Peligros SST" value={data.hazards.total}
              sub={data.hazards.critical > 0 ? `${data.hazards.critical} críticos/altos` : undefined}
              subAlert={data.hazards.critical > 0}
              href="/iperc" color="bg-yellow-100 text-yellow-600" />
            <StatCard icon={Leaf} label="Aspectos amb." value={data.aspects.total}
              sub={`${data.aspects.significant} significativos`} href="/ambientales" color="bg-green-100 text-green-600" />
            <StatCard icon={Siren} label="Incidentes (mes)" value={data.incidents.thisMonth}
              href="/incidentes" color="bg-red-100 text-red-600" />
          </div>
        </div>

        {/* Sección: Control y mejora */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Control y mejora continua</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatCard icon={AlertTriangle} label="No Conformidades" value={data.ncrs.total}
              sub={data.ncrs.open > 0 ? `${data.ncrs.open} abiertas` : `${data.ncrs.closed} cerradas`}
              subAlert={data.ncrs.open > 0}
              href="/no-conformidades" color="bg-red-100 text-red-600" />
            <StatCard icon={CheckSquare} label="Acciones CAPA" value={data.actions.open}
              sub={data.actions.overdue > 0 ? `${data.actions.overdue} vencidas` : 'abiertas'}
              subAlert={data.actions.overdue > 0}
              href="/acciones" color="bg-blue-100 text-blue-600" />
            <StatCard icon={TrendingUp} label="Indicadores" value={data.indicators.total}
              href="/indicadores" color="bg-purple-100 text-purple-600" />
            <StatCard icon={CalendarDays} label="Ver calendario" value="→"
              sub="vencimientos próximos" href="/calendario" color="bg-slate-100 text-slate-600" />
          </div>
        </div>

        {/* Sección: Operaciones */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Operaciones</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatCard icon={Truck} label="Proveedores" value={data.suppliers.approved + data.suppliers.pending}
              sub={data.suppliers.pending > 0 ? `${data.suppliers.pending} pendientes` : `${data.suppliers.approved} aprobados`}
              subAlert={data.suppliers.pending > 0}
              href="/proveedores" color="bg-amber-100 text-amber-600" />
            <StatCard icon={Ruler} label="Equipos / calibr." value={data.calibrations.dueSoon}
              sub="vencen en 30 días"
              subAlert={data.calibrations.dueSoon > 0}
              href="/calibraciones" color="bg-pink-100 text-pink-600" />
          </div>
        </div>

      </div>
    </div>
  );
}
