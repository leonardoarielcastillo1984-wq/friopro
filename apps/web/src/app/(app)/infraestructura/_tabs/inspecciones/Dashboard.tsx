'use client';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { ClipboardCheck, AlertTriangle, TrendingUp, Activity, Flame, BarChart3 } from 'lucide-react';

export default function InspeccionesDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (apiFetch('/inspecciones/dashboard') as any)
      .then((r: any) => { setData(r); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!data || !data.kpis) return <p className="text-sm text-gray-500 text-center py-12">Sin datos. Creá una plantilla y generá un QR para comenzar.</p>;

  const { kpis, tendencia, hallazgosPorTipo, topActivos } = data;

  return (
    <div className="space-y-5">
      {/* KPI row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Hoy', value: kpis.totalHoy, icon: ClipboardCheck, color: 'from-blue-500 to-blue-600' },
          { label: 'Este mes', value: kpis.totalMes, icon: Activity, color: 'from-indigo-500 to-indigo-600' },
          { label: 'Hallazgos abiertos', value: kpis.hallazgosAbiertos, icon: AlertTriangle, color: 'from-amber-500 to-amber-600' },
          { label: 'Críticos', value: kpis.hallazgosCriticos, icon: Flame, color: 'from-red-500 to-red-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`bg-gradient-to-br ${color} rounded-2xl p-4 text-white`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium opacity-80">{label}</p>
              <div className="bg-white/20 rounded-lg p-1.5"><Icon className="w-4 h-4" /></div>
            </div>
            <p className="text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Con hallazgos', value: kpis.conHallazgos, cls: 'border-amber-200 bg-amber-50 text-amber-700' },
          { label: 'Críticas', value: kpis.criticas, cls: 'border-red-200 bg-red-50 text-red-700' },
          { label: 'Plantillas activas', value: kpis.totalPlantillas, cls: 'border-blue-200 bg-blue-50 text-blue-700' },
          { label: 'QR activos', value: kpis.totalQRs, cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
        ].map(({ label, value, cls }) => (
          <div key={label} className={`border ${cls} rounded-xl p-4 text-center`}>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Cumplimiento */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 text-sm">Cumplimiento del mes</h3>
          <span className={`text-lg font-bold ${kpis.cumplimiento >= 80 ? 'text-emerald-600' : kpis.cumplimiento >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{kpis.cumplimiento}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div className={`h-3 rounded-full transition-all ${kpis.cumplimiento >= 80 ? 'bg-emerald-500' : kpis.cumplimiento >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${kpis.cumplimiento}%` }} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Tendencia */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-500" />Tendencia 12 meses</h3>
          <div className="flex items-end gap-1 h-24">
            {(tendencia || []).map((m: any, i: number) => {
              const max = Math.max(...(tendencia || []).map((x: any) => x.total), 1);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-blue-500 rounded-sm" style={{ height: `${(m.total / max) * 100}%`, minHeight: m.total > 0 ? '4px' : '0' }} title={`${m.mes}: ${m.total}`} />
                  <span className="text-gray-400 hidden md:block" style={{ fontSize: '9px' }}>{m.mes?.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top activos */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-amber-500" />Top activos con hallazgos</h3>
          {(topActivos || []).length === 0
            ? <p className="text-sm text-gray-400 text-center py-4">Sin hallazgos aún</p>
            : (
              <div className="space-y-2">
                {(topActivos || []).map((a: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="font-medium text-gray-700 truncate">{a.activo}</span>
                        <span className="text-amber-600 font-bold">{a.hallazgos}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 bg-amber-400 rounded-full" style={{ width: `${Math.min((a.hallazgos / (topActivos[0]?.hallazgos || 1)) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      {(hallazgosPorTipo || []).length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-3">Hallazgos por tipo</h3>
          <div className="flex flex-wrap gap-2">
            {hallazgosPorTipo.map((h: any) => (
              <span key={h.tipo} className="px-3 py-1.5 bg-gray-100 rounded-full text-xs font-medium text-gray-700">
                {h.tipo} · <span className="font-bold">{h.total}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
