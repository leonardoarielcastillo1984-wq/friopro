'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api';
import {
  TrendingUp, TrendingDown, AlertTriangle, Activity, Shield,
  Truck, Users, Kanban, FileText, Clock, Zap, RefreshCw,
  ArrowUpRight, ArrowDownRight, Minus, Eye
} from 'lucide-react';
import SparkLine from './SparkLine';

// ── Circular Gauge Component ─────────────────────────────────
function CircularGauge({ value, max = 100, label, color, size = 80, suffix = '%' }: {
  value: number;
  max?: number;
  label: string;
  color: string;
  size?: number;
  suffix?: string;
}) {
  const percentage = Math.min((value / max) * 100, 100);
  const circumference = 2 * Math.PI * 32;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getStatusColor = () => {
    if (percentage >= 80) return color === 'risk' ? '#ef4444' : '#22c55e';
    if (percentage >= 50) return '#eab308';
    return color === 'risk' ? '#22c55e' : '#ef4444';
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="32" fill="none" stroke="#1f2937" strokeWidth="5" />
          <circle
            cx="36" cy="36" r="32"
            fill="none"
            stroke={getStatusColor()}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-bold text-white">{Math.round(value)}{suffix}</span>
        </div>
      </div>
      <span className="text-[10px] text-gray-400 mt-1 text-center leading-tight">{label}</span>
    </div>
  );
}

// ── Mini KPI Card ────────────────────────────────────────────
function MiniKPICard({ title, value, trend, trendValue, icon: Icon, color }: {
  title: string;
  value: string | number;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  icon: any;
  color: string;
}) {
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400';

  return (
    <div className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-400">{title}</span>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div className="flex items-end justify-between">
        <span className="text-lg font-bold text-white">{value}</span>
        {trend && (
          <div className={`flex items-center gap-0.5 ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            {trendValue && <span className="text-[9px]">{trendValue}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Activity Feed Item ───────────────────────────────────────
function ActivityItem({ title, time, type, severity }: {
  title: string;
  time: string;
  type: string;
  severity?: string;
}) {
  const getTypeIcon = () => {
    switch (type) {
      case 'ncr': return <Shield className="w-3 h-3 text-red-400" />;
      case 'audit': return <FileText className="w-3 h-3 text-blue-400" />;
      case 'capa': return <Zap className="w-3 h-3 text-yellow-400" />;
      case 'fleet': return <Truck className="w-3 h-3 text-amber-400" />;
      case 'project': return <Kanban className="w-3 h-3 text-cyan-400" />;
      case 'alert': return <AlertTriangle className="w-3 h-3 text-orange-400" />;
      default: return <Activity className="w-3 h-3 text-gray-400" />;
    }
  };

  const getSeverityDot = () => {
    if (!severity) return null;
    const colors: Record<string, string> = { critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-green-500' };
    return <span className={`w-1.5 h-1.5 rounded-full ${colors[severity] || 'bg-gray-500'}`} />;
  };

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-800/40 last:border-0">
      {getTypeIcon()}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-300 truncate">{title}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {getSeverityDot()}
        <span className="text-[9px] text-gray-500">{time}</span>
      </div>
    </div>
  );
}

// ── Main Contextual KPI Panel ────────────────────────────────
export interface ContextualKPIs {
  gauges: Array<{ value: number; max: number; label: string; color: string }>;
  kpis: Array<{ title: string; value: string | number; trend?: 'up' | 'down' | 'stable'; trendValue?: string; icon: string; color: string }>;
  activities: Array<{ title: string; time: string; type: string; severity?: string }>;
}

const ICON_MAP: Record<string, any> = {
  shield: Shield, truck: Truck, users: Users, kanban: Kanban,
  file: FileText, alert: AlertTriangle, activity: Activity,
  trending: TrendingUp, zap: Zap, eye: Eye,
};

export default function ContextualKPIPanel({ lastQuery }: { lastQuery?: string }) {
  const [data, setData] = useState<ContextualKPIs | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/command-center/contextual-kpis' + (lastQuery ? `?context=${encodeURIComponent(lastQuery)}` : '')) as any;
      console.log('[ContextualKPIPanel] API response:', res);
      console.log('[ContextualKPIPanel] Debug info:', res?._debug);
      
      if (res?.success && res?.data) {
        setData(res.data);
        console.log('[ContextualKPIPanel] Data set:', res.data);
        console.log('[ContextualKPIPanel] Gauges:', res.data.gauges);
        console.log('[ContextualKPIPanel] KPIs:', res.data.kpis);
      } else if (res?.data) {
        // Fallback for different response structure
        setData(res.data);
      } else {
        console.warn('[ContextualKPIPanel] No data in response');
        setData(null);
      }
    } catch (err) {
      console.error('[ContextualKPIPanel] Error loading data:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [lastQuery]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!data || (!data.gauges?.length && !data.kpis?.length && !data.activities?.length)) {
    return (
      <div className="h-full flex items-center justify-center text-center p-4">
        <div>
          <Activity className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500">
            {lastQuery ? 'Actualizando indicadores...' : 'Hacé una consulta para ver indicadores contextuales'}
          </p>
          {lastQuery && (
            <button 
              onClick={loadData}
              className="mt-2 text-xs text-purple-400 hover:text-purple-300"
            >
              Recargar
            </button>
          )}
        </div>
      </div>
    );
  }

  // Debug: check if gauges are empty but should have data
  const hasDebugData = (data as any)?._debug?.vehicleCount > 0;
  const gaugesEmpty = !data.gauges?.length || data.gauges.every((g: any) => g.value === 0);

  return (
    <div className="h-full overflow-y-auto p-3 space-y-4">
      {/* Debug Info - visible when there's a mismatch */}
      {(hasDebugData || gaugesEmpty) && (data as any)?._debug && (
        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-2 text-[10px]">
          <p className="text-yellow-400 font-semibold mb-1">Debug Info:</p>
          <p className="text-gray-300">Vehículos en BD: {(data as any)._debug.vehicleCount}</p>
          <p className="text-gray-300">Por status: {JSON.stringify((data as any)._debug.vehicleStatusCounts)}</p>
          <p className="text-gray-300">Tenant: {(data as any)._debug.tenantId?.slice(0, 8)}...</p>
        </div>
      )}

      {/* Gauges Section */}
      {data.gauges?.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Indicadores Clave</h4>
          <div className="flex items-center justify-around gap-2">
            {data.gauges.slice(0, 3).map((g, i) => (
              <CircularGauge key={i} value={g.value} max={g.max} label={g.label} color={g.color} />
            ))}
          </div>
        </div>
      )}

      {/* Trend Predictions with Sparklines */}
      <div className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Predicción de NCRs</h4>
          <span className="flex items-center gap-0.5 text-[10px] text-green-400">
            <TrendingUp className="w-3 h-3" /> ↑28% vs período anterior
          </span>
        </div>
        <SparkLine data={[12, 15, 14, 18, 22, 19, 24, 28, 26, 30]} width={340} height={50} color="#a855f7" />
      </div>

      {/* Risk Gauge */}
      <div className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Nivel de Riesgo Operacional</h4>
        </div>
        <div className="flex items-center gap-4">
          <CircularGauge value={72} max={100} label="" color="risk" size={80} />
          <div>
            <p className="text-lg font-bold text-orange-400">Alto</p>
            <p className="text-[10px] text-gray-500">72% exposición acumulada</p>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      {data.kpis?.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Métricas</h4>
          <div className="grid grid-cols-2 gap-2">
            {data.kpis?.slice(0, 6).map((kpi, i) => (
              <MiniKPICard
                key={i}
                title={kpi.title}
                value={kpi.value}
                trend={kpi.trend}
                trendValue={kpi.trendValue}
                icon={ICON_MAP[kpi.icon] || Activity}
                color={kpi.color}
              />
            ))}
          </div>
        </div>
      )}

      {/* Activity Feed */}
      {data.activities?.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Actividad Reciente</h4>
          <div className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-2">
            {data.activities?.slice(0, 8).map((act, i) => (
              <ActivityItem key={i} {...act} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
