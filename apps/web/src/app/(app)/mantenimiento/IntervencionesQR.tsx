'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import {
  QrCode, Plus, Trash2, Printer, ExternalLink, Copy, Check,
  Wrench, History, ListChecks, Tag, X, Pencil
} from 'lucide-react';

const CATEGORIAS = ['MOTOR', 'FRENOS', 'NEUMATICOS', 'SUSPENSION', 'TRANSMISION', 'FLUIDOS', 'ELECTRICO', 'CARROCERIA', 'GENERAL'];
const CAT_LABEL: Record<string, string> = {
  MOTOR: 'Motor', FRENOS: 'Frenos', NEUMATICOS: 'Neumáticos', SUSPENSION: 'Suspensión',
  TRANSMISION: 'Transmisión', FLUIDOS: 'Fluidos', ELECTRICO: 'Eléctrico', CARROCERIA: 'Carrocería', GENERAL: 'General',
};

export default function IntervencionesQR({ assets }: { assets: any[] }) {
  const [sub, setSub] = useState<'qrs' | 'catalogo' | 'historial'>('qrs');
  const [qrs, setQrs] = useState<any[]>([]);
  const [tipos, setTipos] = useState<any[]>([]);
  const [intervenciones, setIntervenciones] = useState<any[]>([]);
  const [planes, setPlanes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewQR, setShowNewQR] = useState(false);
  const [showNewTipo, setShowNewTipo] = useState(false);
  const [copied, setCopied] = useState('');
  const [saving, setSaving] = useState(false);
  const [qrForm, setQrForm] = useState({ maintenanceAssetId: '', titulo: '', instrucciones: '' });
  const [tipoForm, setTipoForm] = useState({ name: '', category: 'GENERAL', defaultKmInterval: '', defaultDaysInterval: '', description: '' });
  const [editInt, setEditInt] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<{ tipoIds: Set<string>; descripcion: string; odometro: string; performedAt: string; performedByName: string; performedByEmail: string; performedByPhone: string; planId: string }>({
    tipoIds: new Set(), descripcion: '', odometro: '', performedAt: '', performedByName: '', performedByEmail: '', performedByPhone: '', planId: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [q, t, i, p] = await Promise.all([
        apiFetch('/maintenance-interventions/qrs') as any,
        apiFetch('/maintenance-interventions/types') as any,
        apiFetch('/maintenance-interventions?limit=50') as any,
        apiFetch('/maintenance/plans') as any,
      ]);
      setQrs(q.qrs || []);
      setTipos(t.types || []);
      setIntervenciones(i.intervenciones || []);
      setPlanes(p.plans || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const crearQR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrForm.maintenanceAssetId) { alert('Seleccioná un activo'); return; }
    setSaving(true);
    try {
      await apiFetch('/maintenance-interventions/qrs', { method: 'POST', json: qrForm });
      setShowNewQR(false);
      setQrForm({ maintenanceAssetId: '', titulo: '', instrucciones: '' });
      load();
    } catch (err: any) { alert(err?.message || 'Error generando QR'); }
    finally { setSaving(false); }
  };

  const eliminarQR = async (id: string) => {
    if (!confirm('¿Desactivar este QR? Las intervenciones registradas no se eliminan.')) return;
    await apiFetch(`/maintenance-interventions/qrs/${id}`, { method: 'DELETE' });
    load();
  };

  const crearTipo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/maintenance-interventions/types', {
        method: 'POST',
        json: {
          name: tipoForm.name,
          category: tipoForm.category,
          description: tipoForm.description || undefined,
          defaultKmInterval: tipoForm.defaultKmInterval ? parseInt(tipoForm.defaultKmInterval) : null,
          defaultDaysInterval: tipoForm.defaultDaysInterval ? parseInt(tipoForm.defaultDaysInterval) : null,
        },
      });
      setShowNewTipo(false);
      setTipoForm({ name: '', category: 'GENERAL', defaultKmInterval: '', defaultDaysInterval: '', description: '' });
      load();
    } catch (err: any) { alert(err?.message || 'Error creando tarea'); }
    finally { setSaving(false); }
  };

  const eliminarTipo = async (id: string) => {
    if (!confirm('¿Quitar esta tarea del catálogo?')) return;
    await apiFetch(`/maintenance-interventions/types/${id}`, { method: 'DELETE' });
    load();
  };

  const abrirEdicion = (i: any) => {
    const tipoIds = new Set(
      tipos.filter((t: any) => (i.tiposLabel || []).includes(t.name)).map((t: any) => t.id)
    );
    setEditForm({
      tipoIds,
      descripcion: i.descripcion || '',
      odometro: i.odometro != null ? String(i.odometro) : '',
      performedAt: new Date(i.performedAt).toISOString().slice(0, 10),
      performedByName: i.performedByName || '',
      performedByEmail: i.performedByEmail || '',
      performedByPhone: i.performedByPhone || '',
      planId: i.planId || '',
    });
    setEditInt(i);
  };

  const toggleEditTipo = (id: string) => {
    setEditForm(prev => {
      const next = new Set(prev.tipoIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, tipoIds: next };
    });
  };

  const guardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInt) return;
    if (editForm.tipoIds.size === 0) { alert('Seleccioná al menos una tarea'); return; }
    setSaving(true);
    try {
      await apiFetch(`/maintenance-interventions/${editInt.id}`, {
        method: 'PUT',
        json: {
          tipoIds: Array.from(editForm.tipoIds),
          descripcion: editForm.descripcion || null,
          odometro: editForm.odometro ? parseFloat(editForm.odometro) : null,
          performedAt: editForm.performedAt ? new Date(editForm.performedAt + 'T12:00:00').toISOString() : undefined,
          performedByName: editForm.performedByName,
          performedByEmail: editForm.performedByEmail || null,
          performedByPhone: editForm.performedByPhone || null,
          planId: editForm.planId || null,
        },
      });
      setEditInt(null);
      load();
    } catch (err: any) { alert(err?.message || 'Error guardando cambios'); }
    finally { setSaving(false); }
  };

  const eliminarIntervencion = async (id: string) => {
    if (!confirm('¿Eliminar esta intervención del historial? Esta acción no se puede deshacer.')) return;
    try {
      await apiFetch(`/maintenance-interventions/${id}`, { method: 'DELETE' });
      load();
    } catch (err: any) { alert(err?.message || 'Error eliminando intervención'); }
  };

  const copiarLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleCartel = (qr: any) => {
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qr.publicUrl)}&bgcolor=ffffff&color=1a1a2e&qzone=2`;
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cartel QR - ${qr.activoNombre}</title>
<style>
body{font-family:-apple-system,'Segoe UI',sans-serif;display:flex;justify-content:center;padding:20px;background:#f5f5f5}
.poster{background:#fff;border:2px solid #1a1a2e;border-radius:16px;padding:32px;max-width:420px;text-align:center}
.badge{display:inline-block;background:#2563eb;color:#fff;font-size:12px;font-weight:700;padding:4px 14px;border-radius:999px;margin-bottom:12px}
.titulo{font-size:24px;font-weight:700;margin:0 0 4px}
.codigo{color:#6b7280;font-size:14px;margin:0 0 16px}
.qr-wrap{display:flex;justify-content:center;margin:16px 0}
.steps{text-align:left;margin:16px 0;font-size:13px;color:#374151}
.step{display:flex;align-items:center;gap:10px;padding:6px 0}
.num{background:#2563eb;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
.footer{border-top:1px solid #e5e7eb;padding-top:12px;font-size:11px;color:#9ca3af}
.print-btn{position:fixed;top:12px;right:12px;background:#2563eb;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px}
@media print{.print-btn{display:none}body{background:#fff}}
</style></head>
<body><button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
<div class="poster">
<span class="badge">Registro de Intervención</span>
<p class="titulo">${qr.activoNombre}</p>
${qr.activoCodigo ? `<p class="codigo">Código: ${qr.activoCodigo}</p>` : ''}
<div class="qr-wrap"><img src="${qrImgUrl}" width="220" height="220" alt="QR" style="display:block;"/></div>
<div class="steps">
<div class="step"><span class="num">1</span>Abrí la cámara de tu celular</div>
<div class="step"><span class="num">2</span>Apuntá al código QR de arriba</div>
<div class="step"><span class="num">3</span>Marcá las tareas realizadas</div>
<div class="step"><span class="num">4</span>Confirmá y queda registrado en la ficha</div>
</div>
<div class="footer"><p>${qr.instrucciones || 'Bitácora de mantenimiento · SGI360'}</p></div>
</div></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const tiposPorCat = tipos.reduce((acc: Record<string, any[]>, t: any) => {
    (acc[t.category] = acc[t.category] || []).push(t);
    return acc;
  }, {});

  const assetsSinQR = assets.filter(a => !qrs.some(q => q.maintenanceAssetId === a.id));

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 pb-2">
        {([
          { id: 'qrs', label: 'QRs por Activo', icon: <QrCode className="w-3.5 h-3.5" /> },
          { id: 'catalogo', label: `Catálogo de Tareas (${tipos.length})`, icon: <ListChecks className="w-3.5 h-3.5" /> },
          { id: 'historial', label: `Historial (${intervenciones.length})`, icon: <History className="w-3.5 h-3.5" /> },
        ] as any[]).map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${sub === t.id ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <>
          {/* ══ QRs ══ */}
          {sub === 'qrs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-gray-500">Generá un QR por activo. Al escanearlo, el técnico registra la intervención realizada y se actualiza la ficha automáticamente.</p>
                <button onClick={() => setShowNewQR(true)} disabled={assets.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40">
                  <Plus className="w-3.5 h-3.5" />Generar QR
                </button>
              </div>

              {qrs.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
                  <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-500">Sin QRs de intervención generados</p>
                  <p className="text-xs text-gray-400 mt-1">Generá un QR para cada activo y pegalo en el equipo</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {qrs.map((qr: any) => {
                    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qr.publicUrl)}&bgcolor=ffffff&color=1a1a2e&qzone=1`;
                    return (
                      <div key={qr.id} className="bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-3 mb-3">
                          <img src={qrImgUrl} width={64} height={64} alt="QR" className="rounded-lg border border-gray-100 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-800 truncate">{qr.activoNombre}</p>
                            {qr.activoCodigo && <p className="text-xs text-gray-400">{qr.activoCodigo}</p>}
                            {qr.maintenanceAsset?.currentOdometer != null && (
                              <p className="text-xs text-gray-400 mt-0.5">{Number(qr.maintenanceAsset.currentOdometer).toLocaleString('es-AR')} km</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                          <span>{qr._count?.intervenciones || 0} intervenciones</span>
                          {qr.lastUsedAt && <span>Último: {new Date(qr.lastUsedAt).toLocaleDateString('es-AR')}</span>}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleCartel(qr)} className="flex-1 flex items-center justify-center gap-1 text-xs border border-gray-200 py-1.5 rounded-lg hover:bg-gray-50">
                            <Printer className="w-3 h-3" />Cartel
                          </button>
                          <button onClick={() => copiarLink(qr.publicUrl, qr.id)} className="flex-1 flex items-center justify-center gap-1 text-xs border border-gray-200 py-1.5 rounded-lg hover:bg-gray-50">
                            {copied === qr.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}Link
                          </button>
                          <a href={qr.publicUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center px-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <button onClick={() => eliminarQR(qr.id)} className="flex items-center justify-center px-2 text-xs border border-red-100 text-red-500 rounded-lg hover:bg-red-50">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ CATÁLOGO ══ */}
          {sub === 'catalogo' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-gray-500">Tareas típicas que el técnico puede marcar al escanear el QR. Los intervalos sugeridos se muestran como referencia.</p>
                <button onClick={() => setShowNewTipo(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
                  <Plus className="w-3.5 h-3.5" />Nueva tarea
                </button>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(tiposPorCat).map(([cat, items]) => (
                  <div key={cat} className="bg-white border border-gray-100 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Tag className="w-3.5 h-3.5 text-blue-500" />
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">{CAT_LABEL[cat] || cat}</h4>
                      <span className="text-xs text-gray-400 ml-auto">{(items as any[]).length}</span>
                    </div>
                    <div className="space-y-1.5">
                      {(items as any[]).map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between gap-2 group">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{t.name}</p>
                            {(t.defaultKmInterval || t.defaultDaysInterval) && (
                              <p className="text-[10px] text-gray-400">
                                {t.defaultKmInterval ? `cada ${t.defaultKmInterval.toLocaleString('es-AR')} km` : ''}
                                {t.defaultKmInterval && t.defaultDaysInterval ? ' · ' : ''}
                                {t.defaultDaysInterval ? `cada ${t.defaultDaysInterval} días` : ''}
                              </p>
                            )}
                          </div>
                          <button onClick={() => eliminarTipo(t.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ HISTORIAL ══ */}
          {sub === 'historial' && (
            <div className="space-y-3">
              {intervenciones.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
                  <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-500">Sin intervenciones registradas</p>
                  <p className="text-xs text-gray-400 mt-1">Las intervenciones registradas vía QR aparecerán acá</p>
                </div>
              ) : (
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium">Fecha</th>
                        <th className="text-left px-4 py-2.5 font-medium">Activo</th>
                        <th className="text-left px-4 py-2.5 font-medium">Tareas</th>
                        <th className="text-left px-4 py-2.5 font-medium">Realizada por</th>
                        <th className="text-right px-4 py-2.5 font-medium">Odómetro</th>
                        <th className="text-center px-4 py-2.5 font-medium">Preventivo</th>
                        <th className="text-right px-4 py-2.5 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {intervenciones.map((i: any) => (
                        <tr key={i.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{new Date(i.performedAt).toLocaleDateString('es-AR')}</td>
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-gray-800">{i.maintenanceAsset?.name}</p>
                            {i.maintenanceAsset?.code && <p className="text-xs text-gray-400">{i.maintenanceAsset.code}</p>}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600">
                            {(i.tiposLabel || []).join(', ')}
                            {i.descripcion && <p className="text-xs text-gray-400 truncate max-w-[240px]">{i.descripcion}</p>}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600">{i.performedByName}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{i.odometro ? `${Number(i.odometro).toLocaleString('es-AR')} km` : '—'}</td>
                          <td className="px-4 py-2.5 text-center">
                            {i.cumplioPreventivo
                              ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><Check className="w-3 h-3" />{i.plan?.title || 'Sí'}</span>
                              : <span className="text-xs text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => abrirEdicion(i)} title="Editar" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => eliminarIntervencion(i.id)} title="Eliminar" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal: Nuevo QR */}
      {showNewQR && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowNewQR(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Generar QR de Intervención</h3>
            <form onSubmit={crearQR} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Activo *</label>
                <select required value={qrForm.maintenanceAssetId} onChange={e => setQrForm({ ...qrForm, maintenanceAssetId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Seleccionar activo…</option>
                  {assetsSinQR.map(a => <option key={a.id} value={a.id}>{a.name}{a.code ? ` (${a.code})` : ''}</option>)}
                  {assetsSinQR.length === 0 && assets.map(a => <option key={a.id} value={a.id}>{a.name}{a.code ? ` (${a.code})` : ''} — ya tiene QR</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Título del cartel (opcional)</label>
                <input value={qrForm.titulo} onChange={e => setQrForm({ ...qrForm, titulo: e.target.value })}
                  placeholder="Registro de intervención" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Instrucciones (opcional)</label>
                <input value={qrForm.instrucciones} onChange={e => setQrForm({ ...qrForm, instrucciones: e.target.value })}
                  placeholder="Ej: Completar después de cada service" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowNewQR(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Generando…' : 'Generar QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nueva tarea */}
      {showNewTipo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowNewTipo(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Nueva tarea del catálogo</h3>
            <form onSubmit={crearTipo} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nombre *</label>
                <input required value={tipoForm.name} onChange={e => setTipoForm({ ...tipoForm, name: e.target.value })}
                  placeholder="Ej: Cambio de bujías" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Categoría</label>
                <select value={tipoForm.category} onChange={e => setTipoForm({ ...tipoForm, category: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Intervalo km (ref.)</label>
                  <input type="number" min="0" value={tipoForm.defaultKmInterval} onChange={e => setTipoForm({ ...tipoForm, defaultKmInterval: e.target.value })}
                    placeholder="10000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Intervalo días (ref.)</label>
                  <input type="number" min="0" value={tipoForm.defaultDaysInterval} onChange={e => setTipoForm({ ...tipoForm, defaultDaysInterval: e.target.value })}
                    placeholder="365" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Descripción (opcional)</label>
                <input value={tipoForm.description} onChange={e => setTipoForm({ ...tipoForm, description: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowNewTipo(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Guardando…' : 'Crear tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar intervención */}
      {editInt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setEditInt(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Editar intervención</h3>
            <p className="text-xs text-gray-400 mb-4">{editInt.maintenanceAsset?.name}{editInt.maintenanceAsset?.code ? ` · ${editInt.maintenanceAsset.code}` : ''}</p>
            <form onSubmit={guardarEdicion} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Tareas realizadas *</label>
                {Object.entries(tiposPorCat).map(([cat, items]) => (
                  <div key={cat} className="mb-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{CAT_LABEL[cat] || cat}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(items as any[]).map((t: any) => {
                        const sel = editForm.tipoIds.has(t.id);
                        return (
                          <button key={t.id} type="button" onClick={() => toggleEditTipo(t.id)}
                            className={`px-2.5 py-1 rounded-full text-xs border ${sel ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'}`}>
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Fecha</label>
                  <input type="date" value={editForm.performedAt} onChange={e => setEditForm({ ...editForm, performedAt: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Odómetro (km)</label>
                  <input type="number" min="0" value={editForm.odometro} onChange={e => setEditForm({ ...editForm, odometro: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Realizada por *</label>
                <input required value={editForm.performedByName} onChange={e => setEditForm({ ...editForm, performedByName: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Email (opcional)</label>
                  <input type="email" value={editForm.performedByEmail} onChange={e => setEditForm({ ...editForm, performedByEmail: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Teléfono (opcional)</label>
                  <input value={editForm.performedByPhone} onChange={e => setEditForm({ ...editForm, performedByPhone: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Observaciones</label>
                <textarea value={editForm.descripcion} onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[60px] resize-vertical" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">¿Cumplió un preventivo planificado?</label>
                <select value={editForm.planId} onChange={e => setEditForm({ ...editForm, planId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">No aplica</option>
                  {planes.filter((p: any) => p.assetId === editInt.maintenanceAssetId).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.title}{p.code ? ` (${p.code})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditInt(null)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
