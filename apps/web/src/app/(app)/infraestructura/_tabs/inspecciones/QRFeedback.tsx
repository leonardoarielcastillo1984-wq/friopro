'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus, Trash2, QrCode, ExternalLink, Printer, Star, Truck, AlertTriangle } from 'lucide-react';

export default function QRFeedback() {
  const [qrs, setQrs] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ activoNombre: '', activoCodigo: '', dominioTractor: '', maintenanceAssetId: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [q, a] = await Promise.all([
        apiFetch('/inspecciones/feedback-qrs') as any,
        apiFetch('/maintenance/assets') as any,
      ]);
      setQrs(q.qrs || []);
      setAssets(a.assets || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAssetChange = (assetId: string) => {
    const asset = assets.find((a: any) => a.id === assetId);
    setForm(f => ({
      ...f,
      maintenanceAssetId: assetId,
      activoNombre: asset ? asset.name : f.activoNombre,
      activoCodigo: asset ? (asset.code || '') : f.activoCodigo,
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await apiFetch('/inspecciones/feedback-qrs', { method: 'POST', json: {
        activoNombre: form.activoNombre,
        activoCodigo: form.activoCodigo || undefined,
        dominioTractor: form.dominioTractor || undefined,
        maintenanceAssetId: form.maintenanceAssetId || undefined,
      }});
      setShowNew(false);
      setForm({ activoNombre: '', activoCodigo: '', dominioTractor: '', maintenanceAssetId: '' });
      load();
    } catch (err: any) { alert(err?.message || 'Error generando QR'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este QR de feedback? No se pueden recuperar los datos.')) return;
    await apiFetch(`/inspecciones/feedback-qrs/${id}`, { method: 'DELETE' }); load();
  };

  const handleCartel = (qr: any) => {
    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr.publicUrl)}&bgcolor=ffffff&color=1a1a2e&qzone=2`;
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>QR Feedback - ${qr.activoNombre}</title>
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Segoe UI',sans-serif;background:linear-gradient(135deg,#0f172a 0%,#1e40af 100%);min-height:100vh;display:flex;justify-content:center;align-items:center;padding:20px;}.poster{background:white;border-radius:24px;padding:40px 36px;max-width:440px;width:100%;text-align:center;box-shadow:0 25px 50px -12px rgba(0,0,0,.5);}.badge{display:inline-flex;align-items:center;gap:6px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:5px 14px;border-radius:20px;margin-bottom:20px;letter-spacing:.5px;text-transform:uppercase;border:1px solid #fde68a;}.stars{font-size:28px;margin-bottom:8px;letter-spacing:4px;}.titulo{font-size:22px;font-weight:800;color:#1e293b;line-height:1.2;margin-bottom:4px;}.dominio{font-size:14px;font-weight:700;color:#2563eb;font-family:monospace;margin-bottom:20px;}.qr-wrap{background:#f8fafc;border-radius:20px;padding:20px;display:inline-block;border:2px solid #e2e8f0;margin-bottom:24px;}.tagline{font-size:14px;color:#475569;margin-bottom:20px;line-height:1.5;}.steps{text-align:left;background:#f0fdf4;border-radius:14px;padding:16px 18px;margin-bottom:24px;border:1px solid #bbf7d0;}.step{display:flex;align-items:center;gap:10px;margin-bottom:10px;font-size:13px;color:#166534;}.step:last-child{margin-bottom:0;}.num{background:#16a34a;color:white;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;}.footer{font-size:10px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:12px;}.print-btn{position:fixed;top:20px;right:20px;background:#2563eb;color:white;border:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;}@media print{.print-btn{display:none;}body{background:white;}.poster{box-shadow:none;max-width:100%;}}</style></head>
<body><button class="print-btn" onclick="window.print()">🖨️ Imprimir / PDF</button>
<div class="poster">
<span class="badge">⭐ QR Feedback de Entrega</span>
<div class="stars">⭐⭐⭐⭐⭐</div>
<p class="titulo">${qr.activoNombre}</p>
${qr.dominioTractor ? `<p class="dominio">Patente: ${qr.dominioTractor.toUpperCase()}</p>` : ''}
<div class="qr-wrap"><img src="${qrImgUrl}" width="240" height="240" alt="QR Feedback" style="display:block;"/></div>
<p class="tagline"><strong>¿Recibiste carga en este camión?</strong><br>Escaneá el código y contanos cómo llegó tu mercadería en 30 segundos.</p>
<div class="steps">
<div class="step"><span class="num">1</span>Abrí la cámara de tu celular</div>
<div class="step"><span class="num">2</span>Apuntá al código QR de arriba</div>
<div class="step"><span class="num">3</span>Calificá la entrega con estrellas</div>
</div>
<div class="footer"><p>LogiSmart · Sistema de gestión logística · logismart.ar</p></div>
</div></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">QR de Feedback por Unidad</h2>
          <p className="text-xs text-gray-500 mt-0.5">Generá un QR permanente por camión. El cliente lo escanea al recibir la carga y califica la entrega.</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Nuevo QR
        </button>
      </div>

      {/* Modal nuevo QR */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Nuevo QR de Feedback</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Activo de mantenimiento (vincula automáticamente)</label>
                <select value={form.maintenanceAssetId} onChange={e => handleAssetChange(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="">Sin vincular (usar dominio)</option>
                  {assets.map((a: any) => <option key={a.id} value={a.id}>{a.name}{a.code ? ` (${a.code})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nombre del vehículo *</label>
                <input required value={form.activoNombre} onChange={e => setForm(f => ({ ...f, activoNombre: e.target.value }))}
                  placeholder="Ej: IVECO TECTOR JKW097"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Código</label>
                  <input value={form.activoCodigo} onChange={e => setForm(f => ({ ...f, activoCodigo: e.target.value }))}
                    placeholder="V-JKW097"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Patente tractor</label>
                  <input value={form.dominioTractor} onChange={e => setForm(f => ({ ...f, dominioTractor: e.target.value }))}
                    placeholder="JKW097"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 font-mono" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowNew(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Generando...' : 'Generar QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista de QRs */}
      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>
      ) : qrs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <QrCode className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">No hay QR de feedback generados</p>
          <p className="text-xs text-gray-400 mt-1">Generá uno por cada camión de la flota</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {qrs.map((qr: any) => {
            const imgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qr.publicUrl)}&bgcolor=ffffff&color=1a1a2e&qzone=1`;
            return (
              <div key={qr.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-4 items-start">
                {/* QR image */}
                <div className="shrink-0 bg-gray-50 rounded-xl p-1.5 border border-gray-100">
                  <img src={imgUrl} width={80} height={80} alt="QR" className="rounded-lg" />
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <p className="text-sm font-bold text-gray-900 truncate">{qr.activoNombre}</p>
                      {qr.dominioTractor && <p className="text-xs font-mono text-blue-600 font-semibold">{qr.dominioTractor.toUpperCase()}</p>}
                      {qr.activoCodigo && <p className="text-[10px] text-gray-400">{qr.activoCodigo}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => handleCartel(qr)} title="Imprimir cartel" className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <a href={qr.publicUrl} target="_blank" rel="noreferrer" title="Ver página pública" className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button onClick={() => handleDelete(qr.id)} title="Eliminar" className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-50 space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                      <Truck className="w-3 h-3" />
                      <span>{qr.maintenanceAsset ? `Vinculado a: ${qr.maintenanceAsset.name}` : 'Sin activo vinculado'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                      <Star className="w-3 h-3" />
                      <span>Escaneos: {qr.useCount}</span>
                      {qr.lastUsedAt && <span className="ml-1">· Último: {new Date(qr.lastUsedAt).toLocaleDateString('es-AR')}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info box */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-700 space-y-1">
          <p className="font-semibold">¿Cómo funciona?</p>
          <p>1. Generás un QR por camión y lo imprimís con el botón 🖨️</p>
          <p>2. Pegás el cartel en la caja/cabina del camión (permanente)</p>
          <p>3. El cliente receptor escanea el QR, ve el último check técnico y califica la entrega</p>
          <p>4. El feedback queda asociado a esa inspección y aparece en el detalle de cada inspección</p>
        </div>
      </div>
    </div>
  );
}
