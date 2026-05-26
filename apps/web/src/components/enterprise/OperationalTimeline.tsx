'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api';
import {
  Clock, RefreshCw, Loader2, Filter,
  AlertCircle, CheckCircle, ArrowUpCircle, FileText,
  Shield, Truck, Users, Target, ClipboardList, Search as SearchIcon,
  FolderOpen, Activity
} from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: string;
  action: string;
  title: string;
  description: string;
  severity?: string;
  entityName?: string;
  module: string;
  icon: string;
  color: string;
  timestamp: string;
}

const moduleIcons: Record<string, any> = {
  Calidad: AlertCircle,
  Riesgos: Shield,
  Flota: Truck,
  Proyectos: Target,
  RRHH: Users,
  Auditorías: ClipboardList,
  Documentos: FileText,
  Inspecciones: SearchIcon,
};

const moduleColors: Record<string, string> = {
  Calidad: 'text-red-400',
  Riesgos: 'text-orange-400',
  Flota: 'text-cyan-400',
  Proyectos: 'text-blue-400',
  RRHH: 'text-purple-400',
  Auditorías: 'text-teal-400',
  Documentos: 'text-green-400',
  Inspecciones: 'text-indigo-400',
};

const actionBadges: Record<string, { label: string; color: string }> = {
  created: { label: 'Creado', color: 'bg-blue-500/20 text-blue-300' },
  updated: { label: 'Actualizado', color: 'bg-gray-500/20 text-gray-300' },
  closed: { label: 'Cerrado', color: 'bg-green-500/20 text-green-300' },
  completed: { label: 'Completado', color: 'bg-green-500/20 text-green-300' },
  escalated: { label: 'Escalado', color: 'bg-red-500/20 text-red-300' },
  approved: { label: 'Aprobado', color: 'bg-green-500/20 text-green-300' },
  assigned: { label: 'Asignado', color: 'bg-purple-500/20 text-purple-300' },
  overdue: { label: 'Vencido', color: 'bg-red-500/20 text-red-300' },
  alert: { label: 'Alerta', color: 'bg-orange-500/20 text-orange-300' },
};

export default function OperationalTimeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);
  const [limit, setLimit] = useState(30);

  useEffect(() => {
    loadTimeline();
  }, [moduleFilter]);

  const loadTimeline = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (moduleFilter) params.set('modules', moduleFilter);
      const res = await apiFetch(`/command-center/timeline?${params}`) as any;
      setEvents(res?.data?.events || []);
      setTotal(res?.data?.total || 0);
    } catch (err) {
      console.error('Error loading timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `Hace ${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  };

  // Get unique modules
  const availableModules = [...new Set(events.map(e => e.module))];

  return (
    <div className="bg-gray-900/40 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-500/10 rounded-lg">
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Timeline Operativo</h3>
            <p className="text-[10px] text-gray-500">{total} eventos recientes</p>
          </div>
        </div>
        <button
          onClick={loadTimeline}
          disabled={loading}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Module Filters */}
      {availableModules.length > 1 && (
        <div className="px-4 py-2 flex gap-1.5 flex-wrap border-b border-gray-700/30">
          <button
            onClick={() => setModuleFilter(null)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              !moduleFilter ? 'bg-blue-500/20 text-blue-300' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Todos
          </button>
          {availableModules.map(mod => {
            const ModIcon = moduleIcons[mod] || FolderOpen;
            return (
              <button
                key={mod}
                onClick={() => setModuleFilter(moduleFilter === mod ? null : mod)}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-colors flex items-center gap-1 ${
                  moduleFilter === mod ? 'bg-gray-700/50 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <ModIcon className="w-2.5 h-2.5" />
                {mod}
              </button>
            );
          })}
        </div>
      )}

      {/* Timeline */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Sin eventos recientes</p>
          </div>
        ) : (
          <div className="relative px-4 py-2">
            {/* Vertical line */}
            <div className="absolute left-[29px] top-0 bottom-0 w-px bg-gray-700/50" />

            {events.map((event, idx) => {
              const ModIcon = moduleIcons[event.module] || FolderOpen;
              const modColor = moduleColors[event.module] || 'text-gray-400';
              const badge = actionBadges[event.action] || actionBadges.updated;

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="relative flex items-start gap-3 pb-4 group"
                >
                  {/* Dot */}
                  <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center bg-gray-900 border border-gray-700 group-hover:border-gray-500 transition-colors`}>
                    <ModIcon className={`w-3 h-3 ${modColor}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 -mt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-medium text-gray-200 truncate">{event.title}</p>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 truncate">{event.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-2.5 h-2.5 text-gray-600" />
                      <span className="text-[10px] text-gray-600">{formatTime(event.timestamp)}</span>
                      <span className={`text-[10px] ${modColor}`}>{event.module}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Load more */}
      {events.length < total && (
        <div className="px-4 py-2 border-t border-gray-700/30">
          <button
            onClick={() => { setLimit(prev => prev + 30); setTimeout(loadTimeline, 0); }}
            className="w-full text-center text-[10px] text-purple-400 hover:text-purple-300 py-1"
          >
            Ver más ({total - events.length} restantes)
          </button>
        </div>
      )}
    </div>
  );
}
