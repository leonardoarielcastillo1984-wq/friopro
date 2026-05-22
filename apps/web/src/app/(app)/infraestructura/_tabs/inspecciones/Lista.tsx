'use client';
import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { ClipboardCheck, Eye, X, AlertCircle, Wrench, Search, Trash2, ChevronRight, Calendar, User, TrendingUp, Star, ExternalLink, FilePlus } from 'lucide-react';
import InspeccionPDFButton from '@/components/inspecciones/InspeccionPDF';
import { useAuth } from '@/lib/auth-context';

const ESTADO_COLOR: Record<string, string> = { COMPLETA: 'bg-emerald-100 text-emerald-700', CON_HALLAZGOS: 'bg-amber-100 text-amber-700', CRITICA: 'bg-red-100 text-red-700', INCOMPLETA: 'bg-gray-100 text-gray-500' };
const ESTADO_LABEL: Record<string, string> = { COMPLETA: 'Completa', CON_HALLAZGOS: 'Con hallazgos', CRITICA: 'Crítica', INCOMPLETA: 'Incompleta' };
const SEV_COLOR: Record<string, string> = { LEVE: 'bg-yellow-100 text-yellow-700', MODERADO: 'bg-orange-100 text-orange-700', CRITICO: 'bg-red-100 text-red-700' };

export default function InspeccionesLista() {
  const { tenant } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [selectedAssetKey, setSelectedAssetKey] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [ncrCreating, setNcrCreating] = useState(false);

  useEffect(() => {
    (apiFetch('/inspecciones/') as any)
      .then((r: any) => { setData(r.inspecciones || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const assetGroups = useMemo(() => {
    const groups: Record<string, { key: string; nombre: string; codigo?: string; inspecciones: any[] }> = {};
    for (const ins of data) {
      const key = ins.activoCodigo || ins.activoNombre;
      if (!groups[key]) groups[key] = { key, nombre: ins.activoNombre, codigo: ins.activoCodigo, inspecciones: [] };
      groups[key].inspecciones.push(ins);
    }
    for (const g of Object.values(groups)) {
      g.inspecciones.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return Object.values(groups).sort((a, b) =>
      new Date(b.inspecciones[0].createdAt).getTime() - new Date(a.inspecciones[0].createdAt).getTime()
    );
  }, [data]);

  const filteredGroups = useMemo(() => {
    if (!filterSearch.trim()) return assetGroups;
    const q = filterSearch.toLowerCase();
    return assetGroups.filter(g =>
      g.nombre.toLowerCase().includes(q) ||
      g.codigo?.toLowerCase().includes(q) ||
      g.inspecciones.some(i => i.inspectorNombre?.toLowerCase().includes(q))
    );
  }, [assetGroups, filterSearch]);

  const selectedGroup = useMemo(() =>
    selectedAssetKey ? assetGroups.find(g => g.key === selectedAssetKey) ?? null : null,
    [assetGroups, selectedAssetKey]
  );

  const loadDetail = async (id: string) => {
    const r: any = await apiFetch(`/inspecciones/${id}`);
    setSelected(r.inspeccion);
  };

  const deleteInspeccion = async (id: string) => {
    if (!confirm('¿Eliminar esta inspección? Se borrarán también sus hallazgos y respuestas.')) return;
    try {
      await apiFetch(`/inspecciones/${id}`, { method: 'DELETE' });
      setData(prev => prev.filter(i => i.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (e: any) {
      alert(e?.message || 'No se pudo eliminar la inspección.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-gray-800">Historial por unidad</h2>
        <span className="text-xs text-gray-400">{assetGroups.length} unidades · {data.length} inspecciones</span>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
          placeholder="Buscar unidad, patente, inspector..."
          className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
          <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">{data.length === 0 ? 'Sin inspecciones aún' : 'Sin resultados'}</p>
          <p className="text-xs text-gray-400 mt-1">{data.length === 0 ? 'Compartí un QR para recibir la primera inspección' : 'Probá cambiando la búsqueda'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredGroups.map(group => {
            const ultima = group.inspecciones[0];
            const totalHallazgos = group.inspecciones.reduce((s, i) => s + (i._count?.hallazgos || 0), 0);
            const conPuntaje = group.inspecciones.filter(i => i.puntaje !== null);
            const avgPuntaje = conPuntaje.length > 0
              ? Math.round(conPuntaje.reduce((s, i) => s + i.puntaje, 0) / conPuntaje.length)
              : null;
            const tieneProblemas = group.inspecciones.some(i => i.estado === 'CRITICA' || i.estado === 'CON_HALLAZGOS');
            const esCritica = group.inspecciones.some(i => i.estado === 'CRITICA');
            return (
              <div key={group.key} onClick={() => setSelectedAssetKey(group.key)}
                className={`bg-white border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all group ${esCritica ? 'border-red-200 bg-red-50/30' : tieneProblemas ? 'border-amber-200' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-gray-900">{group.nombre}</span>
                      {group.codigo && <span className="text-xs text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{group.codigo}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_COLOR[ultima.estado] || 'bg-gray-100 text-gray-500'}`}>
                        Última: {ESTADO_LABEL[ultima.estado] || ultima.estado}
                      </span>
                      {totalHallazgos > 0 && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">⚠ {totalHallazgos} hallazgo(s)</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 shrink-0 mt-1 transition-colors" />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-sm font-bold text-gray-900">{group.inspecciones.length}</p>
                    <p className="text-[10px] text-gray-400">Inspecc.</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className={`text-sm font-bold ${avgPuntaje === null ? 'text-gray-400' : avgPuntaje >= 80 ? 'text-emerald-600' : avgPuntaje >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {avgPuntaje !== null ? `${avgPuntaje}%` : '—'}
                    </p>
                    <p className="text-[10px] text-gray-400">Promedio</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-[11px] font-semibold text-gray-700">
                      {new Date(ultima.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                    </p>
                    <p className="text-[10px] text-gray-400">Última</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <User className="w-3 h-3 shrink-0" />
                  <span className="truncate">{ultima.inspectorNombre}</span>
                  <span className="ml-auto text-[10px]">{new Date(ultima.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {(() => {
                  const feedbacks = group.inspecciones.filter((i: any) => i.feedback);
                  if (feedbacks.length === 0) return null;
                  const avg = Math.round(feedbacks.reduce((s: number, i: any) => s + i.feedback.calificacion, 0) / feedbacks.length * 10) / 10;
                  const hasDisc = feedbacks.some((i: any) => i.feedback.discrepanciaDetectada);
                  return (
                    <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-gray-50">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-xs font-semibold text-amber-600">{avg}</span>
                      <span className="text-[10px] text-gray-400">{feedbacks.length} evaluac.</span>
                      {hasDisc && <span className="ml-auto text-[10px] font-medium text-red-500">⚠ discrepancia</span>}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Panel lateral: historial de la unidad seleccionada */}
      {selectedGroup && (
        <div className="fixed inset-0 bg-black/40 z-40 flex justify-end" onClick={() => setSelectedAssetKey(null)}>
          <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="font-bold text-gray-900">{selectedGroup.nombre}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{selectedGroup.inspecciones.length} inspecciones registradas</p>
              </div>
              <button onClick={() => setSelectedAssetKey(null)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {/* Mini stats del vehículo */}
            {(() => {
              const conPuntaje = selectedGroup.inspecciones.filter(i => i.puntaje !== null);
              const avg = conPuntaje.length > 0 ? Math.round(conPuntaje.reduce((s, i) => s + i.puntaje, 0) / conPuntaje.length) : null;
              const criticas = selectedGroup.inspecciones.filter(i => i.estado === 'CRITICA').length;
              const hallazgos = selectedGroup.inspecciones.reduce((s, i) => s + (i._count?.hallazgos || 0), 0);
              return (
                <div className="grid grid-cols-3 gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="text-center">
                    <p className={`text-lg font-bold ${avg === null ? 'text-gray-400' : avg >= 80 ? 'text-emerald-600' : avg >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{avg !== null ? `${avg}%` : '—'}</p>
                    <p className="text-[10px] text-gray-400">Prom. cumplim.</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-lg font-bold ${criticas > 0 ? 'text-red-600' : 'text-gray-300'}`}>{criticas}</p>
                    <p className="text-[10px] text-gray-400">Críticas</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-lg font-bold ${hallazgos > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{hallazgos}</p>
                    <p className="text-[10px] text-gray-400">Hallazgos</p>
                  </div>
                </div>
              );
            })()}

            <div className="flex-1 p-4 space-y-2 overflow-y-auto">
              {selectedGroup.inspecciones.map((ins: any) => {
                const fecha = new Date(ins.createdAt);
                return (
                  <div key={ins.id} className="border border-gray-100 rounded-xl p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => loadDetail(ins.id)}>
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ESTADO_COLOR[ins.estado] || 'bg-gray-100 text-gray-500'}`}>
                            {ESTADO_LABEL[ins.estado] || ins.estado}
                          </span>
                          {ins.puntaje !== null && (
                            <span className={`text-xs font-bold ${ins.puntaje >= 80 ? 'text-emerald-600' : ins.puntaje >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                              {ins.puntaje}%
                            </span>
                          )}
                          {ins._count?.hallazgos > 0 && (
                            <span className="text-[10px] text-red-500 font-medium">⚠ {ins._count.hallazgos} hallazgo(s)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                          <span className="flex items-center gap-1 font-medium text-gray-700">
                            <Calendar className="w-3 h-3" />
                            {fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            <span className="text-gray-400">{fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                          <User className="w-3 h-3" />
                          <span>{ins.inspectorNombre}</span>
                          {ins.qr?.plantilla?.nombre && <span className="ml-2 text-gray-300">· {ins.qr.plantilla.nombre}</span>}
                          {ins.feedback && (
                            <span className="flex items-center gap-0.5 mt-0.5">
                              {[1,2,3,4,5].map(s => <Star key={s} className={`w-2.5 h-2.5 ${s <= ins.feedback.calificacion ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />)}
                              {ins.feedback.discrepanciaDetectada && <span className="ml-1 text-[9px] font-semibold text-red-500">⚠ DISC.</span>}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => loadDetail(ins.id)} className="p-1 text-gray-300 hover:text-blue-500 rounded" title="Ver detalle"><Eye className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteInspeccion(ins.id)} className="p-1 text-gray-300 hover:text-red-500 rounded" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle inspección */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900">{selected.activoNombre}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Inspector: {selected.inspectorNombre} · {new Date(selected.createdAt).toLocaleDateString('es-AR')} {new Date(selected.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                {selected.feedbackToken && (
                  <a href={`/feedback/${selected.feedbackToken}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-0.5 rounded-full transition-colors">
                    <ExternalLink className="w-2.5 h-2.5" /> Link de feedback para el cliente
                  </a>
                )}
                {selected.qr?.maintenanceAsset && (
                  <a href="/mantenimiento" className="inline-flex items-center gap-1 mt-1.5 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-0.5 rounded-full transition-colors">
                    <Wrench className="w-3 h-3" />
                    {selected.qr.maintenanceAsset.name}{selected.qr.maintenanceAsset.code ? ` — ${selected.qr.maintenanceAsset.code}` : ''}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_COLOR[selected.estado] || ''}`}>{ESTADO_LABEL[selected.estado] || selected.estado}</span>
                <InspeccionPDFButton inspeccion={selected} empresa={tenant?.name} />
                <button onClick={() => deleteInspeccion(selected.id)} className="p-1 text-gray-400 hover:text-red-500" title="Eliminar inspección"><Trash2 className="w-4 h-4" /></button>
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
              {selected.notas && <p className="text-xs text-gray-600 p-3 bg-gray-50 rounded-xl italic">{selected.notas}</p>}
              {selected.feedback && (
                <div className={`p-3 rounded-xl border ${selected.feedback.discrepanciaDetectada ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-100'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-xs font-semibold text-gray-700">Feedback del cliente receptor</h4>
                    {selected.feedback.discrepanciaDetectada && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">⚠ DISCREPANCIA</span>
                    )}
                  </div>
                  <div className="flex gap-0.5 mb-1">
                    {[1,2,3,4,5].map(s => <Star key={s} className={`w-4 h-4 ${s <= selected.feedback.calificacion ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />)}
                    <span className="ml-1 text-xs font-bold text-gray-700">{selected.feedback.calificacion}/5</span>
                  </div>
                  {selected.feedback.receptorNombre && <p className="text-xs text-gray-600"><span className="font-medium">Receptor:</span> {selected.feedback.receptorNombre}{selected.feedback.receptorEmpresa ? ` · ${selected.feedback.receptorEmpresa}` : ''}</p>}
                  {selected.feedback.problemaDetectado && <p className="text-xs text-red-600 font-medium mt-0.5">Problema: {selected.feedback.problemaDetectado.replace(/_/g, ' ')}</p>}
                  {selected.feedback.comentario && <p className="text-xs text-gray-600 mt-1 italic">"{selected.feedback.comentario}"</p>}
                  <p className="text-[10px] text-gray-400 mt-1">{new Date(selected.feedback.createdAt).toLocaleDateString('es-AR')} {new Date(selected.feedback.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                  {selected.feedback.ncrId ? (
                    <a href="/no-conformidades" className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-colors">
                      <FilePlus className="w-3 h-3" /> Ver NCR vinculada →
                    </a>
                  ) : (
                    <button
                      onClick={async () => {
                        setNcrCreating(true);
                        try {
                          const res = await (apiFetch(`/inspecciones/feedback/${selected.feedback.id}/ncr`, { method: 'POST' }) as any);
                          setSelected((prev: any) => ({ ...prev, feedback: { ...prev.feedback, ncrId: res.ncr?.id } }));
                        } catch {}
                        setNcrCreating(false);
                      }}
                      disabled={ncrCreating}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 px-2.5 py-1.5 rounded-lg transition-colors">
                      <FilePlus className="w-3 h-3" />
                      {ncrCreating ? 'Creando…' : 'Crear reclamo NCR'}
                    </button>
                  )}
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
