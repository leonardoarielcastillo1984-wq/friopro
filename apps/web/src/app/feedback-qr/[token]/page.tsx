'use client';
import { useState, useEffect } from 'react';
import { Star, CheckCircle, AlertTriangle, Truck, Calendar, ClipboardCheck, User, ShieldCheck, Clock, FileDown } from 'lucide-react';

function generarPDF(insp: any, empresa: string) {
  if (!insp) return;
  const fecha = new Date(insp.createdAt);
  const items = insp.qr?.plantilla?.items || insp.respuestas?.map((r: any) => r.item) || [];
  const respMap: Record<string, any> = {};
  for (const r of insp.respuestas || []) respMap[r.itemId] = r;
  const secciones = [...new Set(items.map((i: any) => i?.seccion || 'General'))] as string[];
  const primaryColor = '#2563eb';
  let itemNum = 1;
  const seccionesHtml = secciones.map(sec => {
    const secItems = items.filter((i: any) => (i?.seccion || 'General') === sec);
    const rows = secItems.map((item: any) => {
      if (!item) return '';
      const resp = respMap[item.id];
      const ok = resp?.esOk === true;
      const ng = resp?.esOk === false;
      const obs = resp?.observacion || '';
      return `<tr style="${ng ? 'background:#fff1f2;' : ''}">
        <td style="text-align:center;color:#64748b;font-size:11px;">${itemNum++}</td>
        <td style="font-size:12px;">${item.label}</td>
        <td style="text-align:center;font-size:16px;color:#16a34a;font-weight:bold;">${ok ? '✓' : ''}</td>
        <td style="text-align:center;font-size:14px;color:#dc2626;font-weight:bold;">${ng ? 'NOK' : ''}</td>
        <td style="font-size:11px;color:#475569;">${obs}</td>
      </tr>`;
    }).join('');
    return `<tr><td colspan="5" style="background:${primaryColor};color:#fff;font-weight:bold;font-size:11px;padding:6px 8px;">${sec.toUpperCase()}</td></tr>${rows}`;
  }).join('');
  const diagramaFotos: any[] = insp.qr?.plantilla?.diagramaFotos ?? [];
  const fotosConUrl = diagramaFotos.filter((f: any) => f.url);
  const celdaFoto = (foto: any, globalOffset: number) => `
    <td style="padding:4px;vertical-align:top;width:50%;">
      <div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
        <div style="background:#1e293b;color:#fff;font-size:9px;font-weight:700;padding:3px 8px;">${foto.titulo || ''}</div>
        <div style="position:relative;line-height:0;">
          <img src="${foto.url}" style="width:100%;display:block;height:auto;max-height:220px;object-fit:contain;background:#f8fafc;" />
          <svg style="position:absolute;top:0;left:0;width:100%;height:100%;" viewBox="0 0 100 100" preserveAspectRatio="none">
            ${(foto.puntos || []).map((p: any, pi: number) => `
              <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="${primaryColor}" stroke="white" stroke-width="1.5"/>
              <text x="${p.x}" y="${p.y + 1.5}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="4.5" font-weight="bold" font-family="Arial">${globalOffset + pi + 1}</text>
            `).join('')}
          </svg>
        </div>
      </div>
    </td>`;
  let offset = 0;
  const dRows: string[] = [];
  for (let i = 0; i < fotosConUrl.length; i += 2) {
    const f1 = fotosConUrl[i]; const f2 = fotosConUrl[i + 1];
    const o1 = offset; offset += (f1?.puntos?.length || 0);
    const o2 = offset; offset += (f2?.puntos?.length || 0);
    dRows.push(`<tr>${celdaFoto(f1, o1)}${f2 ? celdaFoto(f2, o2) : '<td></td>'}</tr>`);
  }
  const allPuntos = fotosConUrl.flatMap((f: any) => (f.puntos || []).map((p: any) => ({ label: p.label })));
  const leyendaHtml = allPuntos.length > 0 ? `
    <table style="width:100%;border-collapse:collapse;margin-top:6px;">
      <tr>${allPuntos.map((p: any, i: number) => `
        <td style="padding:2px 8px 2px 0;font-size:9px;color:#475569;white-space:nowrap;width:${Math.floor(100/Math.min(allPuntos.length,4))}%;">
          <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${primaryColor};color:#fff;text-align:center;line-height:14px;font-size:7px;font-weight:bold;margin-right:4px;">${i+1}</span>${p.label}
        </td>`).join('')}
      </tr>
    </table>` : '';
  const diagramaHtml = fotosConUrl.length > 0 ? `
    <div style="margin-bottom:16px;page-break-inside:avoid;">
      <div style="font-weight:bold;font-size:11px;color:#475569;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">Diagrama de control del activo</div>
      <table style="width:100%;border-collapse:collapse;">${dRows.join('')}</table>
      ${leyendaHtml}
    </div>` : '';

  const hallazgosHtml = insp.hallazgos?.length > 0 ? `
    <div style="margin-top:16px;"><div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;">
      <div style="font-weight:bold;font-size:12px;color:#dc2626;margin-bottom:8px;">⚠ HALLAZGOS DETECTADOS (${insp.hallazgos.length})</div>
      ${insp.hallazgos.map((h: any) => `<div style="display:flex;gap:8px;margin-bottom:4px;"><span style="font-size:11px;flex:1;">${h.descripcion}</span><span style="font-size:10px;color:#dc2626;background:#fee2e2;padding:1px 6px;border-radius:4px;">${h.severidad}</span></div>`).join('')}
    </div></div>` : '';
  const puntajeColor = (insp.puntaje ?? 100) >= 80 ? '#16a34a' : (insp.puntaje ?? 100) >= 60 ? '#d97706' : '#dc2626';
  const notasRaw: string = insp.notas || '';
  const parse = (key: string) => { const m = notasRaw.match(new RegExp(`${key}:\\s*([^|]+)`)); return m ? m[1].trim() : ''; };
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Inspección — ${insp.activoNombre}</title>
<style>
  @page { size:A4; margin:15mm 12mm; } *{box-sizing:border-box;font-family:Arial,sans-serif;}
  body{margin:0;padding:0;font-size:12px;color:#1e293b;}
  .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid ${primaryColor};padding-bottom:10px;margin-bottom:12px;}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;margin-bottom:14px;background:#f8fafc;border-radius:6px;padding:10px 14px;}
  .meta-row{display:flex;gap:8px;}.meta-label{font-weight:bold;font-size:11px;color:#475569;white-space:nowrap;min-width:130px;}.meta-value{font-size:11px;color:#1e293b;}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;}th,td{padding:5px 8px;border-bottom:1px solid #e2e8f0;}
  th{background:${primaryColor};color:#fff;font-size:11px;text-align:center;}th:nth-child(2){text-align:left;}
  .puntaje{display:flex;align-items:center;gap:12px;padding:8px 14px;background:#f1f5f9;border-radius:6px;margin-bottom:14px;}
  .firma{margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:30px;}
  .firma-box{border-top:1px solid #94a3b8;padding-top:4px;text-align:center;font-size:10px;color:#64748b;}
  .footer{margin-top:16px;text-align:center;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:6px;}
  @media print{button{display:none;}}
</style></head><body>
<div class="header">
  <div><div style="font-size:17px;font-weight:900;color:${primaryColor};">${empresa.toUpperCase()} — REGISTRO DE INSPECCIÓN</div>
  <div style="font-size:9px;color:#94a3b8;">MR-CHK-01 · ${insp.qr?.plantilla?.nombre || 'Checklist'} · ${fecha.toLocaleDateString('es-AR')} ${fecha.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</div></div>
</div>
<div class="meta-grid">
  <div class="meta-row"><span class="meta-label">ACTIVO / UNIDAD:</span><span class="meta-value">${insp.activoNombre||'—'}</span></div>
  <div class="meta-row"><span class="meta-label">NOMBRE Y APELLIDO:</span><span class="meta-value">${insp.inspectorNombre||'—'}</span></div>
  <div class="meta-row"><span class="meta-label">DOMINIO TRACTOR:</span><span class="meta-value" style="font-weight:bold;">${parse('Dominio tractor')||insp.dominioTractor||'—'}</span></div>
  <div class="meta-row"><span class="meta-label">DOMINIO SEMI:</span><span class="meta-value" style="font-weight:bold;">${parse('Dominio semi')||insp.dominioSemi||'—'}</span></div>
  <div class="meta-row"><span class="meta-label">RUTA:</span><span class="meta-value" style="font-weight:bold;">${parse('Ruta')||'—'}</span></div>
  <div class="meta-row"><span class="meta-label">FECHA Y HORA:</span><span class="meta-value">${fecha.toLocaleDateString('es-AR')} ${fecha.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</span></div>
</div>
${insp.puntaje !== null ? `<div class="puntaje"><span style="font-size:28px;font-weight:900;color:${puntajeColor};">${insp.puntaje}%</span><div style="flex:1;background:#e2e8f0;height:10px;border-radius:5px;overflow:hidden;"><div style="height:10px;background:${puntajeColor};width:${insp.puntaje}%;border-radius:5px;"></div></div><span style="font-size:11px;color:#475569;">${insp.itemsOk}/${insp.itemsTotal} ítems OK</span></div>` : ''}
${diagramaHtml}
<table><thead><tr><th style="width:32px;">#</th><th>ÍTEM DE CONTROL</th><th style="width:48px;">OK</th><th style="width:48px;">NOK</th><th style="width:200px;">OBSERVACIONES</th></tr></thead>
<tbody>${seccionesHtml}</tbody></table>
${hallazgosHtml}
<div class="firma">
  <div class="firma-box">Firma del Inspector<br><br><br>${insp.inspectorNombre||''}</div>
  <div class="firma-box">Firma del Supervisor<br><br><br>&nbsp;</div>
</div>
<div class="footer">Generado por ${empresa} · www.logismart.ar · ${new Date().toLocaleDateString('es-AR')}</div>
</body></html>`;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  const imgs = win.document.images;
  if (imgs.length === 0) {
    setTimeout(() => win.print(), 300);
  } else {
    let loaded = 0;
    const tryPrint = () => { loaded++; if (loaded >= imgs.length) win.print(); };
    const fallback = setTimeout(() => win.print(), 4000);
    Array.from(imgs).forEach(img => {
      if (img.complete) { tryPrint(); }
      else { img.onload = tryPrint; img.onerror = tryPrint; }
    });
    win.onafterprint = () => clearTimeout(fallback);
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

const PROBLEMAS = [
  { value: 'GOLPE_CAJA', label: '🔨 Golpe / daño en caja o carrocería' },
  { value: 'PRECINTO_ROTO', label: '🔓 Precinto roto o violado' },
  { value: 'FALTANTE', label: '📦 Faltante de mercadería' },
  { value: 'HUMEDAD', label: '💧 Humedad / mojado' },
  { value: 'TEMPERATURA', label: '🌡️ Falla de temperatura / cadena de frío' },
  { value: 'OTRO', label: '⚠️ Otro problema' },
];

const ESTADO_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  COMPLETA: { label: 'Aprobado ✓', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  CON_HALLAZGOS: { label: 'Con observaciones', color: 'text-amber-700', bg: 'bg-amber-100' },
  CRITICA: { label: 'Crítico', color: 'text-red-700', bg: 'bg-red-100' },
  INCOMPLETA: { label: 'Incompleto', color: 'text-gray-600', bg: 'bg-gray-100' },
};

export default function FeedbackQRPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [qrData, setQrData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [discrepancia, setDiscrepancia] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [yaCalificado, setYaCalificado] = useState(false);

  const [form, setForm] = useState({
    receptorNombre: '',
    receptorEmpresa: '',
    calificacion: 0,
    comentario: '',
    problemaDetectado: '',
  });

  useEffect(() => {
    fetch(`${API_BASE}/inspecciones/feedback-qr/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setQrData(d);
        if (d.ultimaInspeccion?.feedback) setYaCalificado(true);
        setLoading(false);
      })
      .catch(() => { setError('No se pudo cargar la información'); setLoading(false); });
  }, [token]);

  const handleSubmit = async () => {
    if (form.calificacion === 0 || !qrData?.ultimaInspeccion) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/inspecciones/feedback-qr/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspeccionId: qrData.ultimaInspeccion.id,
          receptorNombre: form.receptorNombre || undefined,
          receptorEmpresa: form.receptorEmpresa || undefined,
          calificacion: form.calificacion,
          comentario: form.comentario || undefined,
          problemaDetectado: form.problemaDetectado || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEnviado(true);
        setDiscrepancia(data.discrepanciaDetectada);
      } else {
        if (res.status === 409) { setYaCalificado(true); }
        else alert(data.error || 'Error al enviar');
      }
    } catch { alert('Error de conexión'); }
    finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
        <p className="text-gray-700 font-semibold">{error}</p>
        <p className="text-sm text-gray-400 mt-1">El QR puede ser inválido o estar desactivado</p>
      </div>
    </div>
  );

  if (enviado) return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-9 h-9 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">¡Gracias por tu calificación!</h2>
        <p className="text-sm text-gray-500 mb-4">Tu feedback fue registrado y ya está disponible para el equipo logístico.</p>
        {discrepancia && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left mb-4">
            <p className="text-xs font-semibold text-amber-700 mb-1">⚠️ Discrepancia registrada</p>
            <p className="text-xs text-amber-600">El problema reportado no figuraba en la inspección del conductor. El supervisor fue notificado automáticamente.</p>
          </div>
        )}
        <div className="flex justify-center gap-0.5">
          {[1,2,3,4,5].map(s => (
            <Star key={s} className={`w-7 h-7 ${s <= form.calificacion ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />
          ))}
        </div>
      </div>
    </div>
  );

  const { qr, ultimaInspeccion } = qrData;
  const insp = ultimaInspeccion;
  const estado = insp ? ESTADO_LABEL[insp.estado] : null;
  const horasDesde = insp ? Math.round((Date.now() - new Date(insp.createdAt).getTime()) / 3600000) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-md mx-auto px-4 py-8 space-y-4">

        {/* Header empresa */}
        <div className="text-center">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
            <ClipboardCheck className="w-8 h-8 text-white" />
          </div>
          {qr.empresa && <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">{qr.empresa}</p>}
          <h1 className="text-lg font-bold text-gray-900 mt-1">Calificá tu entrega</h1>
          <p className="text-xs text-gray-400">Escaneaste el QR de verificación del transporte</p>
        </div>

        {/* Card del vehículo */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
              <Truck className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900">{qr.activoNombre}</p>
              {qr.dominioTractor && <p className="text-xs font-mono text-gray-500">{qr.dominioTractor}</p>}
            </div>
          </div>

          {/* Última inspección */}
          {insp ? (
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-600">Última inspección técnica</p>
                {estado && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${estado.bg} ${estado.color}`}>
                    {estado.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(insp.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(insp.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {insp.inspectorNombre && (
                <p className="text-xs text-gray-500 flex items-center gap-1"><User className="w-3 h-3" />{insp.inspectorNombre}</p>
              )}
              {insp.puntaje !== null && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${insp.puntaje >= 80 ? 'bg-emerald-500' : insp.puntaje >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${insp.puntaje}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-600">{insp.puntaje}%</span>
                </div>
              )}
              {horasDesde !== null && horasDesde < 48 && (
                <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Check realizado hace {horasDesde < 1 ? 'menos de 1 hora' : `${horasDesde}h`}
                </p>
              )}
              <button
                onClick={() => generarPDF(insp, qr.empresa || 'SGI 360')}
                className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors">
                <FileDown className="w-3.5 h-3.5" /> Ver checklist técnico (PDF)
              </button>
            </div>
          ) : (
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-xs text-amber-700 font-medium">No se encontró inspección registrada para esta unidad.</p>
              <p className="text-[10px] text-amber-500 mt-0.5">Igualmente podés dejar tu calificación.</p>
            </div>
          )}
        </div>

        {/* Ya calificado */}
        {yaCalificado ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700">Esta inspección ya fue calificada</p>
            <p className="text-xs text-gray-400 mt-1">Cuando haya una nueva inspección, podrás calificar nuevamente</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">

            {/* Estrellas */}
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700 mb-3">¿Cómo llegó tu carga?</p>
              <div className="flex justify-center gap-2">
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => setForm(f => ({ ...f, calificacion: s }))} className="transition-transform active:scale-90">
                    <Star className={`w-11 h-11 transition-colors ${s <= form.calificacion ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200 hover:text-amber-300 hover:fill-amber-300'}`} />
                  </button>
                ))}
              </div>
              {form.calificacion > 0 && (
                <p className="text-sm font-medium mt-2 text-gray-600">
                  {form.calificacion === 5 ? '🎉 ¡Excelente!' : form.calificacion === 4 ? '😊 Muy bien' : form.calificacion === 3 ? '😐 Regular' : form.calificacion === 2 ? '😟 Mal' : '😠 Muy mal'}
                </p>
              )}
            </div>

            {/* Problema */}
            {form.calificacion > 0 && form.calificacion <= 3 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">¿Qué problema encontraste?</p>
                <div className="space-y-1.5">
                  {PROBLEMAS.map(p => (
                    <button key={p.value}
                      onClick={() => setForm(f => ({ ...f, problemaDetectado: f.problemaDetectado === p.value ? '' : p.value }))}
                      className={`w-full text-left text-xs px-3 py-2.5 rounded-xl border transition-colors ${form.problemaDetectado === p.value ? 'bg-red-50 border-red-300 text-red-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Comentario */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Comentario (opcional)</p>
              <textarea value={form.comentario} onChange={e => setForm(f => ({ ...f, comentario: e.target.value }))}
                placeholder="Contanos más sobre tu experiencia..."
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
            </div>

            {/* Datos */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600">Tus datos (opcional)</p>
              <input value={form.receptorNombre} onChange={e => setForm(f => ({ ...f, receptorNombre: e.target.value }))}
                placeholder="Tu nombre"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20" />
              <input value={form.receptorEmpresa} onChange={e => setForm(f => ({ ...f, receptorEmpresa: e.target.value }))}
                placeholder="Empresa / razón social"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>

            <button onClick={handleSubmit} disabled={form.calificacion === 0 || submitting || !insp}
              className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
              {submitting ? 'Enviando...' : 'Enviar calificación'}
            </button>
            {!insp && <p className="text-center text-xs text-amber-500">No hay inspección registrada para calificar aún</p>}
          </div>
        )}

        <div className="text-center pb-6 pt-2">
          <p className="text-xs text-gray-400">Sistema de gestión logística</p>
          <a href="https://www.logismart.ar" target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-500 hover:underline">www.logismart.ar</a>
        </div>
      </div>
    </div>
  );
}
