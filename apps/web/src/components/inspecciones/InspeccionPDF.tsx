'use client';
import { useRef } from 'react';
import { FileDown } from 'lucide-react';

interface Props {
  inspeccion: any;
  empresa?: string;
  logoUrl?: string | null;
  primaryColor?: string;
}

export default function InspeccionPDFButton({ inspeccion, empresa = 'SGI 360', logoUrl, primaryColor = '#2563eb' }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!inspeccion) return;
    const fecha = new Date(inspeccion.createdAt);
    const items = inspeccion.qr?.plantilla?.items || [];
    const respMap: Record<string, any> = {};
    for (const r of inspeccion.respuestas || []) respMap[r.itemId] = r;
    const secciones = [...new Set(items.map((i: any) => i.seccion || 'General'))] as string[];

    let itemNum = 1;
    const seccionesHtml = secciones.map(sec => {
      const secItems = items.filter((i: any) => (i.seccion || 'General') === sec);
      const rows = secItems.map((item: any) => {
        const resp = respMap[item.id];
        const ok = resp?.esOk === true;
        const ng = resp?.esOk === false;
        const obs = resp?.observacion || '';
        const rowStyle = ng ? 'background:#fff1f2;' : '';
        return `<tr style="${rowStyle}">
          <td style="text-align:center;color:#64748b;font-size:11px;">${itemNum++}</td>
          <td style="font-size:12px;">${item.label}</td>
          <td style="text-align:center;font-size:16px;color:#16a34a;font-weight:bold;">${ok ? '✓' : ''}</td>
          <td style="text-align:center;font-size:16px;color:#dc2626;font-weight:bold;">${ng ? '✗' : ''}</td>
          <td style="font-size:11px;color:#475569;">${obs}</td>
        </tr>`;
      }).join('');
      return `<tr>
          <td colspan="5" style="background:${primaryColor};color:#fff;font-weight:bold;font-size:11px;padding:6px 8px;letter-spacing:.05em;">${sec.toUpperCase()}</td>
        </tr>${rows}`;
    }).join('');

    const hallazgosHtml = inspeccion.hallazgos?.length > 0 ? `
      <div style="margin-top:16px;">
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;">
          <div style="font-weight:bold;font-size:12px;color:#dc2626;margin-bottom:8px;">⚠ HALLAZGOS DETECTADOS (${inspeccion.hallazgos.length})</div>
          ${inspeccion.hallazgos.map((h: any) => `
            <div style="display:flex;gap:8px;margin-bottom:4px;align-items:flex-start;">
              <span style="font-size:11px;flex:1;">${h.descripcion}</span>
              <span style="font-size:10px;color:#dc2626;background:#fee2e2;padding:1px 6px;border-radius:4px;white-space:nowrap;">${h.severidad}</span>
            </div>`).join('')}
        </div>
      </div>` : '';

    const puntajeColor = inspeccion.puntaje >= 80 ? '#16a34a' : inspeccion.puntaje >= 60 ? '#d97706' : '#dc2626';

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" style="height:48px;object-fit:contain;" alt="${empresa}" />`
      : `<div style="font-size:20px;font-weight:900;color:${primaryColor};">${empresa}</div>`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Inspección — ${inspeccion.activoNombre}</title>
<style>
  @page { size: A4; margin: 15mm 12mm; }
  * { box-sizing: border-box; font-family: Arial, sans-serif; }
  body { margin: 0; padding: 0; font-size: 12px; color: #1e293b; }
  .header { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid ${primaryColor}; padding-bottom:10px; margin-bottom:12px; }
  .header-title { font-size:17px; font-weight:900; color:${primaryColor}; }
  .header-code { font-size:9px; color:#94a3b8; margin-top:2px; }
  .meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 20px; margin-bottom:14px; background:#f8fafc; border-radius:6px; padding:10px 14px; }
  .meta-row { display:flex; gap:8px; }
  .meta-label { font-weight:bold; font-size:11px; color:#475569; white-space:nowrap; min-width:130px; }
  .meta-value { font-size:11px; color:#1e293b; }
  table { width:100%; border-collapse:collapse; margin-bottom:16px; }
  th, td { padding:5px 8px; border-bottom:1px solid #e2e8f0; }
  th { background:${primaryColor}; color:#fff; font-size:11px; text-align:center; }
  th:nth-child(2) { text-align:left; }
  .puntaje { display:flex; align-items:center; gap:12px; padding:8px 14px; background:#f1f5f9; border-radius:6px; margin-bottom:14px; }
  .puntaje-num { font-size:28px; font-weight:900; color:${puntajeColor}; }
  .bar-bg { flex:1; background:#e2e8f0; height:10px; border-radius:5px; overflow:hidden; }
  .bar-fill { height:10px; border-radius:5px; background:${puntajeColor}; width:${inspeccion.puntaje}%; }
  .firma { margin-top:20px; display:grid; grid-template-columns:1fr 1fr; gap:30px; }
  .firma-box { border-top:1px solid #94a3b8; padding-top:4px; text-align:center; font-size:10px; color:#64748b; }
  .footer { margin-top:16px; text-align:center; font-size:9px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:6px; }
  @media print { button { display:none; } }
</style>
</head><body>
<div class="header">
  <div>
    <div class="header-title">${empresa.toUpperCase()} — REGISTRO DE INSPECCIÓN</div>
    <div class="header-code">MR-CHK-01 · ${inspeccion.qr?.plantilla?.nombre || 'Checklist'} · ${fecha.toLocaleDateString('es-AR')} ${fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
  </div>
  ${logoHtml}
</div>

<div class="meta-grid">
  <div class="meta-row"><span class="meta-label">ACTIVO / UNIDAD:</span><span class="meta-value">${inspeccion.activoNombre || '—'}</span></div>
  <div class="meta-row"><span class="meta-label">NOMBRE Y APELLIDO:</span><span class="meta-value">${inspeccion.inspectorNombre || '—'}</span></div>
  <div class="meta-row"><span class="meta-label">SECTOR / LUGAR:</span><span class="meta-value">${inspeccion.sector || inspeccion.qr?.sector || '—'}</span></div>
  <div class="meta-row"><span class="meta-label">FECHA Y HORA:</span><span class="meta-value">${fecha.toLocaleDateString('es-AR')} ${fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span></div>
  <div class="meta-row"><span class="meta-label">CÓDIGO ACTIVO:</span><span class="meta-value">${inspeccion.activoCodigo || '—'}</span></div>
  <div class="meta-row"><span class="meta-label">CONTROL REALIZADO POR:</span><span class="meta-value">${inspeccion.inspectorNombre || '—'}</span></div>
</div>

${inspeccion.puntaje !== null ? `<div class="puntaje">
  <span class="puntaje-num">${inspeccion.puntaje}%</span>
  <div style="flex:1;"><div class="bar-bg"><div class="bar-fill"></div></div></div>
  <span style="font-size:11px;color:#475569;">${inspeccion.itemsOk}/${inspeccion.itemsTotal} ítems OK</span>
</div>` : ''}

<table>
  <thead><tr>
    <th style="width:32px;">#</th>
    <th>ÍTEM DE CONTROL</th>
    <th style="width:48px;">OK</th>
    <th style="width:48px;">NG</th>
    <th style="width:200px;">OBSERVACIONES</th>
  </tr></thead>
  <tbody>${seccionesHtml}</tbody>
</table>

${hallazgosHtml}

${inspeccion.notas ? `<div style="margin-top:12px;padding:8px 12px;background:#f8fafc;border-radius:6px;font-size:11px;color:#475569;"><b>Observaciones generales:</b> ${inspeccion.notas}</div>` : ''}

<div class="firma">
  <div class="firma-box">Firma del Inspector<br><br><br>${inspeccion.inspectorNombre || ''}</div>
  <div class="firma-box">Firma del Supervisor<br><br><br>&nbsp;</div>
</div>

<div class="footer">Generado por ${empresa} · www.logismart.ar · ${new Date().toLocaleDateString('es-AR')}</div>
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  return (
    <button
      onClick={handlePrint}
      title="Exportar PDF"
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
    >
      <FileDown className="w-3.5 h-3.5" />PDF
    </button>
  );
}
