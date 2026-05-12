'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { AlertTriangle, X, CheckCircle2, RefreshCw, ChevronDown, Wrench, ExternalLink } from 'lucide-react';

const SEV_COLOR: Record<string, string> = { LEVE: 'bg-yellow-100 text-yellow-700 border-yellow-200', MODERADO: 'bg-orange-100 text-orange-700 border-orange-200', CRITICO: 'bg-red-100 text-red-700 border-red-200' };
const ESTADO_COLOR: Record<string, string> = { ABIERTO: 'bg-red-100 text-red-700', EN_PROCESO: 'bg-amber-100 text-amber-700', RESUELTO: 'bg-emerald-100 text-emerald-700', CERRADO: 'bg-gray-100 text-gray-500' };

interface ModalState {
  id: string;
  descripcion: string;
  itemLabel?: string;
  severidad: string;
  estado: string;
  accion: string;
  responsable: string;
  inspeccion?: any;
  activoNombre?: string;
  otCreada?: string;
}

interface OTForm {
  assetId: string;
  assetName: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  scheduledDate: string;
  technicianId: string;
}

export default function InspeccionesHallazgos() {
  const [hallazgos, setHallazgos] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [filter, setFilter] = useState({ estado: '', severidad: '' });
  const [updating, setUpdating] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [showEmpList, setShowEmpList] = useState(false);
  const [showOTModal, setShowOTModal] = useState(false);
  const [assets, setAssets] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [otForm, setOTForm] = useState<OTForm>({ assetId: '', assetName: '', title: '', description: '', type: 'CORRECTIVE', priority: 'HIGH', scheduledDate: '', technicianId: '' });
  const [savingOT, setSavingOT] = useState(false);
  const [assetSearch, setAssetSearch] = useState('');
  const [showAssetList, setShowAssetList] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.estado) params.set('estado', filter.estado);
      if (filter.severidad) params.set('severidad', filter.severidad);
      const [r, e, a, t] = await Promise.all([
        apiFetch(`/inspecciones/hallazgos?${params.toString()}`) as any,
        apiFetch('/hr/employees?limit=200') as any,
        apiFetch('/maintenance/assets') as any,
        apiFetch('/maintenance/technicians') as any,
      ]);
      setHallazgos(r.hallazgos || []);
      setEmpleados(e.employees || e.data || []);
      setAssets(a.assets || []);
      setTechnicians(t.technicians || []);
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const openModal = (h: any) => {
    setModal({
      id: h.id,
      descripcion: h.descripcion,
      itemLabel: h.itemLabel,
      severidad: h.severidad,
      estado: h.estado,
      accion: h.accion || '',
      responsable: h.responsable || '',
      inspeccion: h.inspeccion,
      activoNombre: h.inspeccion?.activoNombre,
      otCreada: h.otId || undefined,
    });
    setEmpSearch(h.responsable || '');
    setShowEmpList(false);
  };

  const openOTModal = () => {
    if (!modal) return;
    const matchedAsset = assets.find((a: any) =>
      a.name?.toLowerCase().includes((modal.activoNombre || '').toLowerCase()) ||
      (modal.activoNombre || '').toLowerCase().includes(a.name?.toLowerCase())
    );
    const fechaHoy = new Date();
    fechaHoy.setDate(fechaHoy.getDate() + 1);
    const scheduledDate = fechaHoy.toISOString().slice(0, 16);
    setOTForm({
      assetId: matchedAsset?.id || '',
      assetName: matchedAsset?.name || modal.activoNombre || '',
      title: `Corrección: ${modal.descripcion}`.slice(0, 100),
      description: `Hallazgo detectado en inspección.\nItem: ${modal.itemLabel || ''}\nActivo: ${modal.activoNombre || ''}\n\nDescripción: ${modal.descripcion}`,
      type: 'CORRECTIVE',
      priority: modal.severidad === 'CRITICO' ? 'CRITICAL' : modal.severidad === 'MODERADO' ? 'HIGH' : 'MEDIUM',
      scheduledDate,
      technicianId: '',
    });
    setAssetSearch(matchedAsset?.name || modal.activoNombre || '');
    setShowAssetList(false);
    setShowOTModal(true);
  };

  const handleCreateOT = async () => {
    if (!otForm.assetId) { alert('Seleccioná un activo/equipo de la lista'); return; }
    if (!otForm.scheduledDate) { alert('Ingresá una fecha programada'); return; }
    setSavingOT(true);
    try {
      const r: any = await apiFetch('/maintenance/work-orders', {
        method: 'POST',
        json: {
          title: otForm.title,
          description: otForm.description,
          type: otForm.type,
          priority: otForm.priority,
          assetId: otForm.assetId,
          technicianId: otForm.technicianId || undefined,
          scheduledDate: new Date(otForm.scheduledDate).toISOString(),
          estimatedDuration: 60,
          laborCost: 0,
          partsCost: 0,
        },
      });
      setShowOTModal(false);
      setModal(null);
      alert(`✅ Orden de trabajo ${r.workOrder?.code || ''} creada correctamente`);
      load();
    } catch (err: any) {
      alert('Error al crear OT: ' + (err?.message || 'intente nuevamente'));
    } finally { setSavingOT(false); }
  };

  const filteredAssets = assets.filter((a: any) =>
    assetSearch.length === 0 || a.name?.toLowerCase().includes(assetSearch.toLowerCase())
  ).slice(0, 8);

  const handleUpdate = async () => {
    if (!modal) return;
    setUpdating(true);
    try {
      await apiFetch(`/inspecciones/hallazgos/${modal.id}`, {
        method: 'PATCH',
        json: {
          estado: modal.estado,
          accion: modal.accion || undefined,
          responsable: modal.responsable || undefined,
        },
      });
      setModal(null);
      load();
    } catch (err: any) {
      alert('Error al guardar: ' + (err?.message || 'intente nuevamente'));
    } finally { setUpdating(false); }
  };

  const filteredEmps = empleados.filter((e: any) => {
    const name = `${e.firstName || ''} ${e.lastName || ''}`.toLowerCase();
    return empSearch.length === 0 || name.includes(empSearch.toLowerCase());
  }).slice(0, 8);

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
                  onClick={() => openModal(h)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 line-clamp-2">{h.descripcion}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-gray-500">
                        {h.itemLabel && <span className="text-gray-400">📋 {h.itemLabel}</span>}
                        <span>Activo: {h.inspeccion?.activoNombre}</span>
                        <span>{new Date(h.createdAt).toLocaleDateString('es-AR')}</span>
                        {h.responsable && <span className="text-blue-600">👤 {h.responsable}</span>}
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

      {/* Modal gestionar hallazgo */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Gestionar hallazgo</h3>
              <button onClick={() => setModal(null)}><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-800">{modal.descripcion}</p>
                {modal.itemLabel && <p className="text-xs text-gray-500 mt-1">Item: {modal.itemLabel}</p>}
                {modal.inspeccion?.activoNombre && <p className="text-xs text-gray-500 mt-0.5">Activo: {modal.inspeccion.activoNombre}</p>}
              </div>

              <div className="flex gap-2 flex-wrap">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${SEV_COLOR[modal.severidad]?.split(' ').slice(0, 2).join(' ') || ''}`}>{modal.severidad}</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_COLOR[modal.estado] || ''}`}>{modal.estado}</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Acción tomada</label>
                <textarea
                  value={modal.accion}
                  onChange={e => setModal(p => p ? { ...p, accion: e.target.value } : p)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none resize-none h-20"
                  placeholder="Describí la acción tomada..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Responsable</label>
                  <div className="relative">
                    <input
                      value={empSearch}
                      onChange={e => { setEmpSearch(e.target.value); setModal(p => p ? { ...p, responsable: e.target.value } : p); setShowEmpList(true); }}
                      onFocus={() => setShowEmpList(true)}
                      onBlur={() => setTimeout(() => setShowEmpList(false), 150)}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none pr-7"
                      placeholder="Buscar o escribir..."
                    />
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-2.5 pointer-events-none" />
                    {showEmpList && filteredEmps.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                        {filteredEmps.map((e: any) => {
                          const name = `${e.firstName || ''} ${e.lastName || ''}`.trim();
                          return (
                            <button key={e.id} type="button"
                              onMouseDown={() => { setEmpSearch(name); setModal(p => p ? { ...p, responsable: name } : p); setShowEmpList(false); }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700">
                              {name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Estado</label>
                  <select
                    value={modal.estado}
                    onChange={e => setModal(p => p ? { ...p, estado: e.target.value } : p)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none bg-white">
                    {['ABIERTO', 'EN_PROCESO', 'RESUELTO', 'CERRADO'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Botón generar OT */}
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-blue-800">¿Requiere intervención técnica?</p>
                  <p className="text-xs text-blue-600 mt-0.5">Generá una Orden de Trabajo directamente desde este hallazgo</p>
                </div>
                <button onClick={openOTModal}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                  <Wrench className="w-3.5 h-3.5" />Generar OT
                </button>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setModal(null)} className="flex-1 text-sm border border-gray-200 py-2.5 rounded-xl hover:bg-gray-50">Cancelar</button>
                <button onClick={handleUpdate} disabled={updating}
                  className="flex-1 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-60">
                  {updating ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear OT */}
      {showOTModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between p-5 border-b border-gray-100 z-10">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Wrench className="w-4 h-4 text-blue-600" />Nueva Orden de Trabajo</h3>
                <p className="text-xs text-gray-500 mt-0.5">Generada desde hallazgo de inspección</p>
              </div>
              <button onClick={() => setShowOTModal(false)}><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Título *</label>
                <input value={otForm.title} onChange={e => setOTForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Descripción</label>
                <textarea value={otForm.description} onChange={e => setOTForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none resize-none h-24" />
              </div>

              {/* Activo con autocomplete */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Activo / Equipo *</label>
                <div className="relative">
                  <input value={assetSearch}
                    onChange={e => { setAssetSearch(e.target.value); setOTForm(p => ({ ...p, assetId: '', assetName: e.target.value })); setShowAssetList(true); }}
                    onFocus={() => setShowAssetList(true)}
                    onBlur={() => setTimeout(() => setShowAssetList(false), 150)}
                    className={`w-full text-sm border rounded-xl px-3 py-2.5 outline-none pr-7 ${otForm.assetId ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200'}`}
                    placeholder="Buscar activo registrado en Mantenimiento..." />
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-3 pointer-events-none" />
                  {showAssetList && filteredAssets.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
                      {filteredAssets.map((a: any) => (
                        <button key={a.id} type="button"
                          onMouseDown={() => { setAssetSearch(a.name); setOTForm(p => ({ ...p, assetId: a.id, assetName: a.name })); setShowAssetList(false); }}
                          className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0">
                          <p className="text-sm font-medium text-gray-800">{a.name}</p>
                          <p className="text-xs text-gray-400">{a.code} · {a.category} · {a.location}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {assets.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">⚠️ No hay activos registrados en Mantenimiento. Creá uno primero desde la pestaña Mantenimiento → Activos.</p>
                  )}
                  {!otForm.assetId && assetSearch && assets.length > 0 && (
                    <p className="text-xs text-amber-600 mt-1">Seleccioná un activo de la lista para continuar</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo</label>
                  <select value={otForm.type} onChange={e => setOTForm(p => ({ ...p, type: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none bg-white">
                    <option value="CORRECTIVE">Correctivo</option>
                    <option value="PREVENTIVE">Preventivo</option>
                    <option value="EMERGENCY">Emergencia</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Prioridad</label>
                  <select value={otForm.priority} onChange={e => setOTForm(p => ({ ...p, priority: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none bg-white">
                    <option value="LOW">Baja</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                    <option value="CRITICAL">Crítica</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha programada *</label>
                  <input type="datetime-local" value={otForm.scheduledDate} onChange={e => setOTForm(p => ({ ...p, scheduledDate: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Técnico asignado</label>
                  <select value={otForm.technicianId} onChange={e => setOTForm(p => ({ ...p, technicianId: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none bg-white">
                    <option value="">Sin asignar</option>
                    {technicians.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowOTModal(false)} className="flex-1 text-sm border border-gray-200 py-2.5 rounded-xl hover:bg-gray-50">Cancelar</button>
                <button onClick={handleCreateOT} disabled={savingOT || !otForm.assetId}
                  className="flex-1 bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Wrench className="w-3.5 h-3.5" />{savingOT ? 'Creando...' : 'Crear Orden de Trabajo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
