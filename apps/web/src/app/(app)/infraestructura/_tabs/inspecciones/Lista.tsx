'use client';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { ClipboardCheck, Eye, X, AlertCircle, Wrench } from 'lucide-react';
import InspeccionPDFButton from '@/components/inspecciones/InspeccionPDF';
import { useAuth } from '@/lib/auth-context';

const ESTADO_COLOR: Record<string, string> = { COMPLETA: 'bg-emerald-100 text-emerald-700', CON_HALLAZGOS: 'bg-amber-100 text-amber-700', CRITICA: 'bg-red-100 text-red-700', INCOMPLETA: 'bg-gray-100 text-gray-500' };
const SEV_COLOR: Record<string, string> = { LEVE: 'bg-yellow-100 text-yellow-700', MODERADO: 'bg-orange-100 text-orange-700', CRITICO: 'bg-red-100 text-red-700' };

export default function InspeccionesLista() {
  const { tenant } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    (apiFetch('/inspecciones/') as any)
      .then((r: any) => { setData(r.inspecciones || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const loadDetail = async (id: string) => {
    const r: any = await apiFetch(`/inspecciones/${id}`);
    setSelected(r.inspeccion);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Inspecciones realizadas</h2>
        <span className="text-xs text-gray-400">{data.length} registros</span>
      </div>

      {loading
        ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        : data.length === 0
          ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
              <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">Sin inspecciones aún</p>
              <p className="text-xs text-gray-400 mt-1">Compartí un QR para recibir la primera inspección</p>
            </div>
          )
          : (
            <div className="space-y-2">
              {data.map((ins: any) => (
                <div key={ins.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => loadDetail(ins.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm text-gray-800 truncate">{ins.activoNombre}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[ins.estado] || 'bg-gray-100 text-gray-500'}`}>{ins.estado}</span>
                      {ins.qr?.plantilla?.nombre && <span className="text-xs text-gray-400 hidden sm:block">{ins.qr.plantilla.nombre}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                      <span>{ins.inspectorNombre}</span>
                      {ins.puntaje !== null && <span className="font-medium text-gray-600">{ins.puntaje}%</span>}
                      {ins._count?.hallazgos > 0 && <span className="text-amber-600">{ins._count.hallazgos} hallazgo(s)</span>}
                      <span>{new Date(ins.createdAt).toLocaleDateString('es-AR')}</span>
                    </div>
                  </div>
                  <Eye className="w-4 h-4 text-gray-300 shrink-0" />
                </div>
              ))}
            </div>
          )}

      {/* Modal detalle */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900">{selected.activoNombre}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Inspector: {selected.inspectorNombre} · {new Date(selected.createdAt).toLocaleDateString('es-AR')}</p>
                {selected.qr?.maintenanceAsset && (
                  <a
                    href="/mantenimiento"
                    className="inline-flex items-center gap-1 mt-1.5 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-0.5 rounded-full transition-colors"
                    title="Ver activo en Mantenimiento"
                  >
                    <Wrench className="w-3 h-3" />
                    {selected.qr.maintenanceAsset.name}{selected.qr.maintenanceAsset.code ? ` — ${selected.qr.maintenanceAsset.code}` : ''}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_COLOR[selected.estado] || ''}`}>{selected.estado}</span>
                <InspeccionPDFButton inspeccion={selected} empresa={tenant?.name} />
                <button onClick={() => setSelected(null)}><X className="w-4 h-4 text-gray-500" /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {selected.puntaje !== null && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1"><span className="text-gray-600">Puntaje</span><span className="font-bold">{selected.puntaje}%</span></div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className={`h-2 rounded-full ${selected.puntaje >= 80 ? 'bg-emerald-500' : selected.puntaje >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${selected.puntaje}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{selected.itemsOk}/{selected.itemsTotal} OK</span>
                </div>
              )}
              {selected.hallazgos?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 mb-2">Hallazgos detectados ({selected.hallazgos.length})</h4>
                  <div className="space-y-2">
                    {selected.hallazgos.map((h: any) => (
                      <div key={h.id} className="flex items-start gap-2 p-2.5 bg-red-50 rounded-lg border border-red-100">
                        <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-800">{h.descripcion}</p>
                          {h.itemLabel && <p className="text-xs text-gray-500 mt-0.5">Item: {h.itemLabel}</p>}
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SEV_COLOR[h.severidad] || ''}`}>{h.severidad}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selected.notas && <p className="text-xs text-gray-600 p-3 bg-gray-50 rounded-xl italic">{selected.notas}</p>}
              {selected.respuestas?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 mb-2">Detalle de respuestas</h4>
                  <div className="space-y-1.5">
                    {selected.respuestas.map((r: any) => (
                      <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${r.esOk === true ? 'bg-emerald-100 text-emerald-700' : r.esOk === false ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                          {r.esOk === true ? '✓' : r.esOk === false ? '✗' : '·'}
                        </span>
                        <span className="text-xs text-gray-700 flex-1">{r.item?.label}</span>
                        {r.observacion && <span className="text-xs text-gray-400 italic truncate max-w-[120px]">{r.observacion}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
