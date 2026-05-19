'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus, Trash2, X, QrCode, ExternalLink, Printer, Link2, Link2Off, Pencil } from 'lucide-react';

export default function InspeccionesQRs() {
  const [qrs, setQrs] = useState<any[]>([]);
  const [plantillas, setPlantillas] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ plantillaId: '', activoNombre: '', activoCodigo: '', ubicacion: '', sector: '', titulo: '', pie: '', maintenanceAssetId: '' });
  const [saving, setSaving] = useState(false);
  const [editingQR, setEditingQR] = useState<any>(null);
  const [editForm, setEditForm] = useState({ maintenanceAssetId: '', activoNombre: '', activoCodigo: '' });
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [q, p, a] = await Promise.all([apiFetch('/inspecciones/qrs') as any, apiFetch('/inspecciones/plantillas') as any, apiFetch('/maintenance/assets') as any]);
      setQrs(q.qrs || []); setPlantillas(p.plantillas || []); setAssets(a.assets || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiFetch('/inspecciones/qrs', { method: 'POST', json: form });
      setShowNew(false);
      setForm({ plantillaId: '', activoNombre: '', activoCodigo: '', ubicacion: '', sector: '', titulo: '', pie: '', maintenanceAssetId: '' });
      load();
    } catch (err: any) { alert(err?.message || 'Error generando QR'); }
    finally { setSaving(false); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setEditSaving(true);
    try {
      await apiFetch(`/inspecciones/qrs/${editingQR.id}`, { method: 'PUT', json: {
        maintenanceAssetId: editForm.maintenanceAssetId || null,
        activoNombre: editForm.activoNombre,
        activoCodigo: editForm.activoCodigo,
      }});
      setEditingQR(null); load();
    } catch (err: any) { alert(err?.message || 'Error guardando'); }
    finally { setEditSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Desactivar este QR? Las inspecciones previas no se eliminarán.')) return;
    await apiFetch(`/inspecciones/qrs/${id}`, { method: 'DELETE' }); load();
  };

  const handleCartel = (qr: any) => {
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qr.publicUrl)}&bgcolor=ffffff&color=1a1a2e&qzone=2`;
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cartel QR - ${qr.activoNombre}</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Segoe UI',sans-serif;background:linear-gradient(135deg,#1e3a5f 0%,#2d6a9f 100%);min-height:100vh;display:flex;justify-content:center;align-items:center;padding:20px;}.poster{background:white;border-radius:24px;padding:40px 36px;max-width:460px;width:100%;text-align:center;box-shadow:0 25px 50px -12px rgba(0,0,0,.4);}.badge{display:inline-block;background:#eff6ff;color:#2563eb;font-size:11px;font-weight:600;padding:4px 14px;border-radius:20px;margin-bottom:16px;letter-spacing:.5px;text-transform:uppercase;}.titulo{font-size:24px;font-weight:800;color:#1e293b;line-height:1.2;margin-bottom:6px;}.codigo{font-size:13px;color:#64748b;margin-bottom:6px;}.sector{font-size:12px;color:#2563eb;margin-bottom:24px;}.qr-wrap{background:#f8fafc;border-radius:20px;padding:20px;display:inline-block;border:2px solid #e2e8f0;margin-bottom:24px;}.steps{text-align:left;background:#f8fafc;border-radius:14px;padding:18px 20px;margin-bottom:24px;}.step{display:flex;align-items:center;gap:12px;margin-bottom:12px;font-size:13px;color:#374151;}.step:last-child{margin-bottom:0;}.num{background:#2563eb;color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;}.footer{font-size:11px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:14px;}.print-btn{position:fixed;top:20px;right:20px;background:#2563eb;color:white;border:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(37,99,235,.3);}@media print{.print-btn{display:none;}body{background:white;min-height:auto;}.poster{box-shadow:none;max-width:100%;}}</style></head>
<body><button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
<div class="poster">
<span class="badge">Inspección QR</span>
<p class="titulo">${qr.activoNombre}</p>
${qr.activoCodigo ? `<p class="codigo">Código: ${qr.activoCodigo}</p>` : ''}
${qr.sector ? `<p class="sector">📍 ${qr.sector}</p>` : ''}
<div class="qr-wrap"><img src="${qrImgUrl}" width="220" height="220" alt="QR" style="display:block;"/></div>
<div class="steps">
<div class="step"><span class="num">1</span>Abrí la cámara de tu celular</div>
<div class="step"><span class="num">2</span>Apuntá al código QR de arriba</div>
<div class="step"><span class="num">3</span>Completá el checklist de inspección</div>
<div class="step"><span class="num">4</span>Firmá y enviá el formulario</div>
</div>
<div class="footer"><p>${qr.pie || 'Sistema de Inspecciones Inteligentes · SGI360'}</p></div>
</div></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  const CAT_BG: Record<string, string> = { CAMION: 'bg-blue-500', AUTOELEVADOR: 'bg-amber-500', MAQUINARIA: 'bg-purple-500', SEGURIDAD: 'bg-red-500', INFRAESTRUCTURA: 'bg-emerald-500', ELECTRICO: 'bg-orange-500', GENERAL: 'bg-gray-400' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-gray-800">QR Operativos</h2>
        <button onClick={() => setShowNew(true)} disabled={plantillas.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
          <Plus className="w-3.5 h-3.5" />Generar QR
        </button>
      </div>

      {plantillas.length === 0 && !loading && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
          ⚠️ Primero creá al menos una plantilla en la pestaña <strong>Plantillas</strong> para poder generar QRs.
        </div>
      )}

      {loading
        ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        : qrs.length === 0
          ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
              <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">Sin QRs generados aún</p>
              <p className="text-xs text-gray-400 mt-1">Generá un QR para cada activo que querés inspeccionar</p>
            </div>
          )
          : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {qrs.map((qr: any) => {
                const cat = qr.plantilla?.categoria || 'GENERAL';
                const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qr.publicUrl)}&bgcolor=ffffff&color=1a1a2e&qzone=1`;
                return (
                  <div key={qr.id} className="bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3 mb-3">
                      <img src={qrImgUrl} width={64} height={64} alt="QR" className="rounded-lg border border-gray-100 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-800 truncate">{qr.activoNombre}</p>
                        {qr.activoCodigo && <p className="text-xs text-gray-400">{qr.activoCodigo}</p>}
                        {qr.sector && <p className="text-xs text-blue-500 mt-0.5">📍 {qr.sector}</p>}
                        <p className="text-xs text-gray-400 mt-1">{qr.plantilla?.nombre}</p>
                        {qr.maintenanceAssetId
                          ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium mt-0.5"><Link2 className="w-3 h-3" />Activo vinculado</span>
                          : <span className="inline-flex items-center gap-1 text-xs text-gray-300 mt-0.5"><Link2Off className="w-3 h-3" />Sin vincular</span>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                      <span>{qr._count?.inspecciones || 0} inspecciones</span>
                      {qr.lastUsedAt && <span>Último: {new Date(qr.lastUsedAt).toLocaleDateString('es-AR')}</span>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleCartel(qr)} className="flex-1 flex items-center justify-center gap-1 text-xs border border-gray-200 py-1.5 rounded-lg hover:bg-gray-50">
                        <Printer className="w-3 h-3" />Cartel
                      </button>
                      <a href={qr.publicUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-xs border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button onClick={() => { setEditingQR(qr); setEditForm({ maintenanceAssetId: qr.maintenanceAssetId || '', activoNombre: qr.activoNombre, activoCodigo: qr.activoCodigo || '' }); }} className="flex items-center justify-center text-xs border border-blue-100 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-400 hover:text-blue-600" title="Editar vinculación">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDelete(qr.id)} className="flex items-center justify-center text-xs border border-red-100 px-2.5 py-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

      {/* Modal editar QR */}
      {editingQR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Editar QR — {editingQR.activoNombre}</h3>
              <button onClick={() => setEditingQR(null)}><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <form onSubmit={handleEdit} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Nombre del activo</label>
                  <input value={editForm.activoNombre} onChange={e => setEditForm(p => ({ ...p, activoNombre: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Código</label>
                  <input value={editForm.activoCodigo} onChange={e => setEditForm(p => ({ ...p, activoCodigo: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none" />
                </div>
              </div>
              <div className="border border-emerald-100 bg-emerald-50 rounded-xl p-3">
                <label className="block text-xs font-semibold text-emerald-700 mb-1.5">🔗 Activo de Mantenimiento vinculado</label>
                <select value={editForm.maintenanceAssetId} onChange={e => {
                  const sel = assets.find((a: any) => a.id === e.target.value);
                  setEditForm(p => ({ ...p, maintenanceAssetId: e.target.value, activoNombre: sel ? sel.name : p.activoNombre, activoCodigo: sel ? (sel.code || p.activoCodigo) : p.activoCodigo }));
                }} className="w-full text-sm border border-emerald-200 rounded-xl px-3 py-2.5 outline-none bg-white">
                  <option value="">Sin vincular</option>
                  {assets.map((a: any) => <option key={a.id} value={a.id}>{a.name} — {a.code}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingQR(null)} className="flex-1 text-sm border border-gray-200 py-2.5 rounded-xl hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={editSaving} className="flex-1 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-60">
                  {editSaving ? 'Guardando...' : '💾 Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal nuevo QR */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Generar QR operativo</h3>
              <button onClick={() => setShowNew(false)}><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Plantilla *</label>
                <select required value={form.plantillaId} onChange={e => setForm(p => ({ ...p, plantillaId: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none bg-white">
                  <option value="">Seleccioná una plantilla...</option>
                  {plantillas.map((p: any) => <option key={p.id} value={p.id}>{p.nombre} ({p.categoria})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Nombre del activo *</label>
                  <input required value={form.activoNombre} onChange={e => setForm(p => ({ ...p, activoNombre: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none" placeholder="Ej: Camión 25" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Código (opcional)</label>
                  <input value={form.activoCodigo} onChange={e => setForm(p => ({ ...p, activoCodigo: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none" placeholder="Ej: CAM-025" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Sector</label>
                  <input value={form.sector} onChange={e => setForm(p => ({ ...p, sector: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none" placeholder="Ej: Depósito 1" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Ubicación</label>
                  <input value={form.ubicacion} onChange={e => setForm(p => ({ ...p, ubicacion: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none" placeholder="Ej: Planta Norte" />
                </div>
              </div>
              {/* Vincular a activo de mantenimiento */}
              <div className="border border-emerald-100 bg-emerald-50 rounded-xl p-3">
                <label className="block text-xs font-semibold text-emerald-700 mb-1.5">🔗 Vincular a Activo/Equipo de Mantenimiento</label>
                <p className="text-xs text-emerald-600 mb-2">Si vinculás este QR a un activo, cada hallazgo generará una OT automáticamente y quedará en la hoja de vida del equipo.</p>
                <select value={form.maintenanceAssetId} onChange={e => {
                  const sel = assets.find((a: any) => a.id === e.target.value);
                  setForm(p => ({
                    ...p,
                    maintenanceAssetId: e.target.value,
                    activoNombre: sel ? sel.name : p.activoNombre,
                    activoCodigo: sel ? (sel.code || p.activoCodigo) : p.activoCodigo,
                  }));
                }}
                  className="w-full text-sm border border-emerald-200 rounded-xl px-3 py-2.5 outline-none bg-white">
                  <option value="">Sin vincular (opcional)</option>
                  {assets.map((a: any) => <option key={a.id} value={a.id}>{a.name} — {a.code}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Título del cartel (opcional)</label>
                <input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none" placeholder="Escanea para inspeccionar este activo" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowNew(false)} className="flex-1 text-sm border border-gray-200 py-2.5 rounded-xl hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-60">
                  {saving ? 'Generando...' : '✅ Generar QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
