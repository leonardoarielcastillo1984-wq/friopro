'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Wrench, RefreshCw, X, CheckCircle2 } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  ON_HOLD: 'bg-orange-100 text-orange-700',
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En ejecución', COMPLETED: 'Completada',
  CANCELLED: 'Cancelada', ON_HOLD: 'En espera',
};
const PRIORITY_COLOR: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600', MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700', CRITICAL: 'bg-red-100 text-red-700',
};
const PRIORITY_LABEL: Record<string, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica' };

export default function InspeccionesOTs() {
  const [ots, setOts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      const r: any = await apiFetch(`/inspecciones/ot?${params.toString()}`);
      setOts(r.ots || []);
    } finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleUpdateStatus = async () => {
    if (!selected || !newStatus) return;
    setUpdating(true);
    try {
      await apiFetch(`/inspecciones/ot/${selected.id}`, { method: 'PATCH', json: { status: newStatus } });
      setSelected(null);
      load();
    } catch (err: any) {
      alert('Error: ' + (err?.message || 'intente nuevamente'));
    } finally { setUpdating(false); }
  };

  const pendientes = ots.filter(o => o.status === 'PENDING').length;
  const enEjecucion = ots.filter(o => o.status === 'IN_PROGRESS').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-blue-600" />Órdenes de Trabajo — Inspecciones
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{pendientes} pendientes · {enEjecucion} en ejecución · Total: {ots.length}</p>
        </div>
        <button onClick={load} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 outline-none bg-white">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading
        ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        : ots.length === 0
          ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
              <CheckCircle2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">Sin órdenes de trabajo generadas</p>
              <p className="text-xs text-gray-400 mt-1">Las OTs aparecen cuando generás una desde un hallazgo de inspección</p>
            </div>
          )
          : (
            <div className="space-y-2">
              {ots.map((ot: any) => (
                <div key={ot.id} onClick={() => { setSelected(ot); setNewStatus(ot.status); }}
                  className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-sm transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{ot.code}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[ot.priority] || ''}`}>{PRIORITY_LABEL[ot.priority] || ot.priority}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-800 line-clamp-1">{ot.title}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
                        {ot.activoNombreLibre && <span>🔧 {ot.activoNombreLibre}</span>}
                        {ot.scheduledDate && <span>📅 {new Date(ot.scheduledDate).toLocaleDateString('es-AR')}</span>}
                        <span className="text-gray-400">{new Date(ot.createdAt).toLocaleDateString('es-AR')}</span>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${STATUS_COLOR[ot.status] || ''}`}>{STATUS_LABEL[ot.status] || ot.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900">{selected.code}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Orden de Trabajo — Inspección</p>
              </div>
              <button onClick={() => setSelected(null)}><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                <p className="text-sm font-medium text-gray-800">{selected.title}</p>
                {selected.description && <p className="text-xs text-gray-500 whitespace-pre-line">{selected.description}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-gray-400">Activo</span><p className="font-medium text-gray-700 mt-0.5">{selected.activoNombreLibre || '—'}</p></div>
                <div><span className="text-gray-400">Prioridad</span><p className="font-medium text-gray-700 mt-0.5">{PRIORITY_LABEL[selected.priority] || selected.priority}</p></div>
                <div><span className="text-gray-400">Tipo</span><p className="font-medium text-gray-700 mt-0.5">{selected.type}</p></div>
                <div><span className="text-gray-400">Fecha programada</span><p className="font-medium text-gray-700 mt-0.5">{selected.scheduledDate ? new Date(selected.scheduledDate).toLocaleDateString('es-AR') : '—'}</p></div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Cambiar estado</label>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none bg-white">
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSelected(null)} className="flex-1 text-sm border border-gray-200 py-2.5 rounded-xl hover:bg-gray-50">Cerrar</button>
                <button onClick={handleUpdateStatus} disabled={updating || newStatus === selected.status}
                  className="flex-1 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50">
                  {updating ? 'Guardando...' : 'Guardar estado'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
