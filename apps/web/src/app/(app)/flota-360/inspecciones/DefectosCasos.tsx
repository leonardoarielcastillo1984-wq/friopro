'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { CheckCircle2, Ban, Wrench, Clock, ShieldCheck, X } from 'lucide-react';

const ESTADO_COLOR: Record<string, string> = {
  ABIERTO: 'bg-red-100 text-red-700',
  EN_TRATAMIENTO: 'bg-blue-100 text-blue-700',
  REPARADO_INFORMADO: 'bg-amber-100 text-amber-700',
  VERIFICADO: 'bg-violet-100 text-violet-700',
  RESUELTO: 'bg-emerald-100 text-emerald-700',
  CERRADO: 'bg-gray-100 text-gray-500',
};
const SEV_COLOR: Record<string, string> = {
  LEVE: 'bg-gray-100 text-gray-600', MODERADO: 'bg-amber-100 text-amber-700', CRITICO: 'bg-red-100 text-red-700',
};

export default function DefectosCasos() {
  const [casos, setCasos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'abiertos' | 'todos' | 'bloqueantes'>('abiertos');
  const [detalle, setDetalle] = useState<any | null>(null);
  const [notasVerif, setNotasVerif] = useState('');
  const [motivoHab, setMotivoHab] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = filtro === 'abiertos' ? '?abiertos=true' : filtro === 'bloqueantes' ? '?bloqueante=true' : '';
      const r: any = await apiFetch(`/fleet-ops/defectos${qs}`);
      setCasos(r.casos || []);
    } finally { setLoading(false); }
  }, [filtro]);

  useEffect(() => { load(); }, [load]);

  const openDetalle = async (id: string) => {
    const r: any = await apiFetch(`/fleet-ops/defectos/${id}`);
    setDetalle(r.caso);
    setNotasVerif(''); setMotivoHab('');
  };

  const accion = async (path: string, body: any = {}) => {
    setBusy(true);
    try {
      await apiFetch(path, { method: 'POST', json: body });
      setDetalle(null); load();
    } catch (e: any) { alert(e?.message || 'Error'); }
    finally { setBusy(false); }
  };

  const fmt = (d?: string | null) => d ? new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-gray-800">Casos de defecto</h2>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {([['abiertos', 'Abiertos'], ['bloqueantes', 'Bloqueantes'], ['todos', 'Todos']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFiltro(k)}
              className={`px-3 py-1 text-xs rounded-md font-medium ${filtro === k ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        : casos.length === 0
          ? <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400">Sin casos para este filtro</div>
          : (
            <div className="space-y-2">
              {casos.map((c: any) => (
                <button key={c.id} onClick={() => openDetalle(c.id)}
                  className="w-full text-left bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 flex-wrap">
                    {c.bloqueante ? <Ban className="w-4 h-4 text-red-500 shrink-0" /> : <Wrench className="w-4 h-4 text-gray-400 shrink-0" />}
                    <span className="font-medium text-sm text-gray-800">{c.itemLabel}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${SEV_COLOR[c.severidad] || SEV_COLOR.MODERADO}`}>{c.severidad}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[c.estado] || ESTADO_COLOR.ABIERTO}`}>{c.estado.replaceAll('_', ' ')}</span>
                    <span className="text-xs text-gray-500 ml-auto">{c.vehiculo?.dominio}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{c.antiguedadDias}d · {c._count?.reportes ?? c.reportesCount} reporte(s)</span>
                    <span>1ª: {fmt(c.primerReporteAt)}</span>
                    <span>últ.: {fmt(c.ultimoReporteAt)}</span>
                    {c.workOrder && <span className="text-blue-600">OT {c.workOrder.code} · {c.workOrder.status}</span>}
                    {c.restricciones?.length > 0 && <span className="text-red-600 font-medium">⛔ restricción activa</span>}
                    {c.casoPrevio && <span className="text-violet-600">posible recurrencia</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

      {/* Detalle del caso — circuito completo */}
      {detalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetalle(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white flex items-center justify-between p-5 border-b border-gray-100 z-10">
              <div>
                <h3 className="font-semibold text-gray-900">{detalle.itemLabel}</h3>
                <p className="text-xs text-gray-500">{detalle.vehiculo?.dominio} · {detalle.estado.replaceAll('_', ' ')} · {detalle.severidad}</p>
              </div>
              <button onClick={() => setDetalle(null)}><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-5">
              {/* Seguimiento */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {[['Reportes', detalle.reportesCount], ['Antigüedad', `${Math.floor((Date.now() - new Date(detalle.primerReporteAt).getTime()) / 86400000)}d`],
                  ['Primera detección', fmt(detalle.primerReporteAt)], ['Última', fmt(detalle.ultimoReporteAt)]].map(([l, v]) => (
                  <div key={l as string} className="bg-gray-50 rounded-xl p-2.5">
                    <p className="text-sm font-bold text-gray-800">{v}</p><p className="text-[10px] text-gray-500">{l}</p>
                  </div>
                ))}
              </div>

              {detalle.casoPrevio && (
                <p className="text-xs text-violet-700 bg-violet-50 rounded-lg p-2">
                  Posible recurrencia del caso anterior (resuelto {fmt(detalle.casoPrevio.resueltoAt)}) — relación indicativa, no afirma misma causa.
                </p>
              )}

              {/* OT */}
              <div className="border border-gray-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-600 mb-1">Reparación</p>
                {detalle.workOrder
                  ? <p className="text-sm text-gray-800">OT {detalle.workOrder.code} · {detalle.workOrder.status} · {detalle.workOrder.technician?.name || 'sin técnico'}{detalle.workOrder.completedAt ? ` · completada ${fmt(detalle.workOrder.completedAt)}` : ''}</p>
                  : <p className="text-xs text-gray-500">Sin OT vinculada</p>}
                {detalle.reparacionInformadaAt && <p className="text-xs text-amber-700 mt-1">Reparación informada {fmt(detalle.reparacionInformadaAt)} por {detalle.reparacionInformadaPor || '—'}</p>}
              </div>

              {/* Verificación + habilitación */}
              <div className="border border-gray-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-600 mb-1">Verificación y habilitación</p>
                {detalle.verificadoAt
                  ? <p className="text-xs text-gray-700">Verificado {fmt(detalle.verificadoAt)} por {detalle.verificadoPorNombre} — {detalle.verificacionResultado}{detalle.verificacionNotas ? ` (${detalle.verificacionNotas})` : ''}</p>
                  : <p className="text-xs text-gray-400">Sin verificar</p>}
                {detalle.habilitadoAt
                  ? <p className="text-xs text-emerald-700 mt-1"><ShieldCheck className="w-3 h-3 inline mr-1" />Habilitado {fmt(detalle.habilitadoAt)} por {detalle.habilitadoPorNombre}</p>
                  : detalle.bloqueante && <p className="text-xs text-red-600 mt-1">Bloqueante — requiere verificación + habilitación autorizada</p>}
              </div>

              {/* Restricciones */}
              {detalle.restricciones?.length > 0 && (
                <div className="border border-red-100 bg-red-50/50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-red-700 mb-1">Restricciones de servicio</p>
                  {detalle.restricciones.map((r: any) => (
                    <p key={r.id} className="text-xs text-red-700">• {r.motivo} {r.activa ? '(activa)' : `(levantada ${fmt(r.levantadaAt)} por ${r.levantadaPorNombre})`}</p>
                  ))}
                </div>
              )}

              {/* Reportes */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Reportes ({detalle.reportes?.length})</p>
                <div className="space-y-1.5">
                  {detalle.reportes?.map((r: any) => (
                    <div key={r.id} className="text-xs bg-gray-50 rounded-lg px-3 py-2">
                      <span className="font-medium">{r.inspeccion?.inspectorNombre}</span> · {fmt(r.createdAt)} — {r.descripcion}
                      {r.valorRespuesta && <span className="text-gray-400"> (respuesta: {r.valorRespuesta})</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Eventos */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Historial del caso</p>
                <div className="space-y-1">
                  {detalle.eventos?.map((e: any) => (
                    <div key={e.id} className="text-xs text-gray-600 flex gap-2">
                      <span className="text-gray-400 shrink-0 w-28">{fmt(e.createdAt)}</span>
                      <span><strong>{e.tipo}</strong> — {e.detalle}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                {!detalle.workOrderId && ['ABIERTO'].includes(detalle.estado) && (
                  <button disabled={busy} onClick={() => accion(`/fleet-ops/defectos/${detalle.id}/ot`)}
                    className="text-xs bg-blue-600 text-white px-3 py-2 rounded-lg font-medium disabled:opacity-50">Generar OT</button>
                )}
                {['REPARADO_INFORMADO', 'EN_TRATAMIENTO', 'ABIERTO'].includes(detalle.estado) && (
                  <>
                    <input value={notasVerif} onChange={e => setNotasVerif(e.target.value)} placeholder="Notas de verificación"
                      className="flex-1 min-w-[140px] text-xs border border-gray-200 rounded-lg px-2 py-2 outline-none" />
                    <button disabled={busy} onClick={() => accion(`/fleet-ops/defectos/${detalle.id}/verificar`, { resultado: 'OK', notas: notasVerif })}
                      className="text-xs bg-emerald-600 text-white px-3 py-2 rounded-lg font-medium disabled:opacity-50"><CheckCircle2 className="w-3 h-3 inline mr-1" />Verificar OK</button>
                    <button disabled={busy} onClick={() => accion(`/fleet-ops/defectos/${detalle.id}/verificar`, { resultado: 'FALLA_PERSISTE', notas: notasVerif })}
                      className="text-xs bg-amber-500 text-white px-3 py-2 rounded-lg font-medium disabled:opacity-50">Falla persiste</button>
                  </>
                )}
                {detalle.bloqueante && detalle.estado === 'VERIFICADO' && (
                  <div className="w-full flex gap-2">
                    <input value={motivoHab} onChange={e => setMotivoHab(e.target.value)} placeholder="Motivo de habilitación"
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-2 outline-none" />
                    <button disabled={busy} onClick={() => accion(`/fleet-ops/defectos/${detalle.id}/habilitar`, { motivo: motivoHab })}
                      className="text-xs bg-red-600 text-white px-3 py-2 rounded-lg font-medium disabled:opacity-50"><ShieldCheck className="w-3 h-3 inline mr-1" />Habilitar unidad</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
