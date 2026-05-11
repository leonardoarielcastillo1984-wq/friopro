'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { AlertTriangle, X, CheckCircle2, RefreshCw } from 'lucide-react';

const SEV_COLOR: Record<string, string> = { LEVE: 'bg-yellow-100 text-yellow-700 border-yellow-200', MODERADO: 'bg-orange-100 text-orange-700 border-orange-200', CRITICO: 'bg-red-100 text-red-700 border-red-200' };
const ESTADO_COLOR: Record<string, string> = { ABIERTO: 'bg-red-100 text-red-700', EN_PROCESO: 'bg-amber-100 text-amber-700', RESUELTO: 'bg-emerald-100 text-emerald-700', CERRADO: 'bg-gray-100 text-gray-500' };

export default function InspeccionesHallazgos() {
  const [hallazgos, setHallazgos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [filter, setFilter] = useState({ estado: '', severidad: '' });
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.estado) params.set('estado', filter.estado);
      if (filter.severidad) params.set('severidad', filter.severidad);
      const r: any = await apiFetch(`/inspecciones/hallazgos?${params.toString()}`);
      setHallazgos(r.hallazgos || []);
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = async (id: string, data: any) => {
    setUpdating(true);
    try {
      await apiFetch(`/inspecciones/hallazgos/${id}`, { method: 'PATCH', json: data });
      setSelected((prev: any) => prev ? { ...prev, ...data } : prev);
      load();
    } finally { setUpdating(false); }
  };

  const criticos = hallazgos.filter(h => h.severidad === 'CRITICO' && h.estado === 'ABIERTO').length;
  const abiertos = hallazgos.filter(h => h.estado === 'ABIERTO').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-gray-800">Hallazgos de Inspección</h2>
          <p className="text-xs text-gray-500 mt-0.5">{abiertos} abiertos · {criticos} críticos sin resolver</p>
        </div>
        <button onClick={load} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw className="w-3.5 h-3.5 text-gray-400" /></button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <select value={filter.estado} onChange={e => setFilter(p => ({ ...p, estado: e.target.value }))}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 outline-none bg-white">
          <option value="">Todos los estados</option>
          {['ABIERTO', 'EN_PROCESO', 'RESUELTO', 'CERRADO'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filter.severidad} onChange={e => setFilter(p => ({ ...p, severidad: e.target.value }))}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 outline-none bg-white">
          <option value="">Todas las severidades</option>
          {['LEVE', 'MODERADO', 'CRITICO'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading
        ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        : hallazgos.length === 0
          ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
              <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">Sin hallazgos registrados</p>
              <p className="text-xs text-gray-400 mt-1">Los hallazgos aparecen cuando una inspección detecta una no-conformidad</p>
            </div>
          )
          : (
            <div className="space-y-2">
              {hallazgos.map((h: any) => (
                <div key={h.id} className={`bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow cursor-pointer ${SEV_COLOR[h.severidad] || 'border-gray-100'}`}
                  onClick={() => setSelected(h)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 line-clamp-2">{h.descripcion}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-gray-500">
                        {h.itemLabel && <span className="text-gray-400">📋 {h.itemLabel}</span>}
                        <span>Activo: {h.inspeccion?.activoNombre}</span>
                        <span>{new Date(h.createdAt).toLocaleDateString('es-AR')}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEV_COLOR[h.severidad]?.split(' ').slice(0, 2).join(' ') || ''}`}>{h.severidad}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[h.estado] || ''}`}>{h.estado}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

      {/* Modal detalle hallazgo */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Gestionar hallazgo</h3>
              <button onClick={() => setSelected(null)}><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-800">{selected.descripcion}</p>
                {selected.itemLabel && <p className="text-xs text-gray-500 mt-1">Item: {selected.itemLabel}</p>}
                {selected.inspeccion?.activoNombre && <p className="text-xs text-gray-500 mt-0.5">Activo: {selected.inspeccion.activoNombre}</p>}
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${SEV_COLOR[selected.severidad]?.split(' ').slice(0, 2).join(' ') || ''}`}>{selected.severidad}</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_COLOR[selected.estado] || ''}`}>{selected.estado}</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Acción tomada</label>
                <textarea defaultValue={selected.accion || ''} onBlur={e => setSelected((p: any) => ({ ...p, accion: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none resize-none h-20" placeholder="Describí la acción tomada..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Responsable</label>
                  <input defaultValue={selected.responsable || ''} onBlur={e => setSelected((p: any) => ({ ...p, responsable: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none" placeholder="Nombre" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Estado</label>
                  <select value={selected.estado} onChange={e => setSelected((p: any) => ({ ...p, estado: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none bg-white">
                    {['ABIERTO', 'EN_PROCESO', 'RESUELTO', 'CERRADO'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSelected(null)} className="flex-1 text-sm border border-gray-200 py-2.5 rounded-xl hover:bg-gray-50">Cancelar</button>
                <button disabled={updating}
                  onClick={() => handleUpdate(selected.id, { estado: selected.estado, accion: selected.accion, responsable: selected.responsable })}
                  className="flex-1 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-60">
                  {updating ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
