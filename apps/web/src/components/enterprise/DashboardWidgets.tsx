'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserCheck, Folder, PlayCircle, AlertTriangle,
  Truck, CheckCircle, Wrench, FileX, AlertCircle, Zap,
  Shield, ShieldOff, Clipboard, ClipboardList, Clock,
  Settings, X, Plus, RefreshCw, ChevronRight
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

// ============================================================
// TIPOS
// ============================================================

interface WidgetCatalogItem {
  key: string;
  label: string;
  module: string;
  icon: string;
  color: string;
}

interface WidgetSlot {
  position: number;       // 0-3
  metricKey: string | null;
}

const DEFAULT_SLOTS: WidgetSlot[] = [
  { position: 0, metricKey: 'employees_total' },
  { position: 1, metricKey: 'projects_active' },
  { position: 2, metricKey: 'ncr_open' },
  { position: 3, metricKey: 'fleet_active' },
];

const STORAGE_KEY = 'sgi360_dashboard_widgets';

// ============================================================
// MAPA DE ICONOS
// ============================================================

const ICON_MAP: Record<string, React.ElementType> = {
  'users': Users,
  'user-check': UserCheck,
  'folder': Folder,
  'play-circle': PlayCircle,
  'alert-triangle': AlertTriangle,
  'truck': Truck,
  'check-circle': CheckCircle,
  'tool': Wrench,
  'file-x': FileX,
  'alert-circle': AlertCircle,
  'zap': Zap,
  'shield': Shield,
  'shield-off': ShieldOff,
  'clipboard': Clipboard,
  'clipboard-list': ClipboardList,
  'clock': Clock,
};

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  blue:   { bg: 'from-blue-900/40 to-blue-800/20',   border: 'border-blue-500/30',   text: 'text-blue-300',   icon: 'text-blue-400' },
  green:  { bg: 'from-green-900/40 to-green-800/20', border: 'border-green-500/30',  text: 'text-green-300',  icon: 'text-green-400' },
  purple: { bg: 'from-purple-900/40 to-purple-800/20', border: 'border-purple-500/30', text: 'text-purple-300', icon: 'text-purple-400' },
  indigo: { bg: 'from-indigo-900/40 to-indigo-800/20', border: 'border-indigo-500/30', text: 'text-indigo-300', icon: 'text-indigo-400' },
  orange: { bg: 'from-orange-900/40 to-orange-800/20', border: 'border-orange-500/30', text: 'text-orange-300', icon: 'text-orange-400' },
  cyan:   { bg: 'from-cyan-900/40 to-cyan-800/20',   border: 'border-cyan-500/30',   text: 'text-cyan-300',   icon: 'text-cyan-400' },
  yellow: { bg: 'from-yellow-900/40 to-yellow-800/20', border: 'border-yellow-500/30', text: 'text-yellow-300', icon: 'text-yellow-400' },
  red:    { bg: 'from-red-900/40 to-red-800/20',     border: 'border-red-500/30',    text: 'text-red-300',    icon: 'text-red-400' },
  teal:   { bg: 'from-teal-900/40 to-teal-800/20',   border: 'border-teal-500/30',   text: 'text-teal-300',   icon: 'text-teal-400' },
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function DashboardWidgets() {
  const [slots, setSlots] = useState<WidgetSlot[]>(DEFAULT_SLOTS);
  const [catalog, setCatalog] = useState<WidgetCatalogItem[]>([]);
  const [values, setValues] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(false);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Cargar config desde localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSlots(JSON.parse(saved));
    } catch {}
  }, []);

  // Cargar catálogo
  useEffect(() => {
    apiFetch('/command-center/widgets/catalog')
      .then((r: any) => setCatalog(r?.data || []))
      .catch(() => {});
  }, []);

  // Cargar valores reales
  const fetchValues = useCallback(async () => {
    const keys = slots.map(s => s.metricKey).filter(Boolean) as string[];
    if (keys.length === 0) return;
    setLoading(true);
    try {
      const res = await apiFetch('/command-center/widgets/data', {
        method: 'POST',
        body: JSON.stringify({ keys })
      }) as any;
      setValues(res?.data || {});
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
  }, [slots]);

  useEffect(() => { fetchValues(); }, [fetchValues]);

  // Auto-refresh cada 60s
  useEffect(() => {
    const t = setInterval(fetchValues, 60_000);
    return () => clearInterval(t);
  }, [fetchValues]);

  const saveSlots = (newSlots: WidgetSlot[]) => {
    setSlots(newSlots);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSlots));
  };

  const assignMetric = (position: number, key: string | null) => {
    const newSlots = slots.map(s => s.position === position ? { ...s, metricKey: key } : s);
    saveSlots(newSlots);
    setEditingSlot(null);
    // Refetch inmediatamente
    setTimeout(fetchValues, 100);
  };

  const getCatalogItem = (key: string | null) =>
    catalog.find(c => c.key === key) ?? null;

  return (
    <>
      {/* 4 tarjetas en línea */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {slots.map(slot => {
          const item = getCatalogItem(slot.metricKey);
          const value = slot.metricKey !== null ? values[slot.metricKey] : undefined;
          const colors = COLOR_MAP[item?.color ?? 'blue'] ?? COLOR_MAP.blue;
          const Icon = item ? (ICON_MAP[item.icon] ?? Folder) : Plus;

          return (
            <motion.div
              key={slot.position}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: slot.position * 0.05 }}
              className={`relative bg-gradient-to-br ${item ? colors.bg : 'from-gray-800/30 to-gray-900/20'} 
                border ${item ? colors.border : 'border-gray-700/40 border-dashed'} 
                rounded-xl p-4 cursor-pointer group hover:scale-[1.02] transition-transform duration-200`}
              onClick={() => setEditingSlot(slot.position)}
            >
              {/* Botón editar siempre visible en hover */}
              <button
                className="absolute top-2 right-2 p-1 rounded-lg bg-gray-800/60 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                title="Configurar"
              >
                <Settings className="w-3 h-3 text-gray-400" />
              </button>

              {item ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${colors.icon} flex-shrink-0`} />
                    <span className={`text-xs font-medium ${colors.text} truncate`}>{item.label}</span>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {loading && value === undefined
                      ? <span className="text-gray-500 text-sm animate-pulse">...</span>
                      : value === null
                        ? <span className="text-gray-500 text-sm">—</span>
                        : value?.toLocaleString('es-AR')}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{item.module}</div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-16 gap-2">
                  <Plus className="w-5 h-5 text-gray-600" />
                  <span className="text-xs text-gray-600">Agregar métrica</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Refresh manual + timestamp */}
      <div className="flex items-center gap-2 mb-3 -mt-1">
        <button
          onClick={fetchValues}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
        <span className="text-xs text-gray-600">
          · {lastRefresh.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Modal selector de métrica */}
      <AnimatePresence>
        {editingSlot !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setEditingSlot(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-semibold">Configurar tarjeta {editingSlot + 1}</h3>
                  <p className="text-gray-400 text-sm">Elegí qué dato mostrar</p>
                </div>
                <button onClick={() => setEditingSlot(null)}>
                  <X className="w-5 h-5 text-gray-500 hover:text-white" />
                </button>
              </div>

              {/* Por módulo */}
              {(() => {
                const modules = [...new Set(catalog.map(c => c.module))];
                return modules.map(mod => (
                  <div key={mod} className="mb-4">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{mod}</div>
                    <div className="space-y-1">
                      {catalog.filter(c => c.module === mod).map(item => {
                        const Icon = ICON_MAP[item.icon] ?? Folder;
                        const colors = COLOR_MAP[item.color] ?? COLOR_MAP.blue;
                        const isSelected = slots[editingSlot]?.metricKey === item.key;
                        return (
                          <button
                            key={item.key}
                            onClick={() => assignMetric(editingSlot, item.key)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-left
                              ${isSelected
                                ? `bg-gray-700/80 border border-gray-500/60`
                                : 'hover:bg-gray-800/60 border border-transparent'}`}
                          >
                            <Icon className={`w-4 h-4 ${colors.icon} flex-shrink-0`} />
                            <span className="text-sm text-gray-200 flex-1">{item.label}</span>
                            {values[item.key] !== undefined && values[item.key] !== null && (
                              <span className="text-xs text-gray-400 font-mono">
                                {(values[item.key] as number).toLocaleString('es-AR')}
                              </span>
                            )}
                            {isSelected && <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />}
                            {!isSelected && <ChevronRight className="w-3 h-3 text-gray-600 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}

              {/* Opción vaciar */}
              {slots[editingSlot]?.metricKey && (
                <button
                  onClick={() => assignMetric(editingSlot, null)}
                  className="w-full mt-2 py-2 text-xs text-gray-500 hover:text-red-400 transition-colors border border-dashed border-gray-700 rounded-lg"
                >
                  Quitar esta tarjeta
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
