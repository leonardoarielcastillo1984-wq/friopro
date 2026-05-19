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
          <td style="text-align:center;font-size:14px;color:#dc2626;font-weight:bold;">${ng ? 'NOK' : ''}</td>
          <td style="font-size:11px;color:#475569;">${obs}</td>
        </tr>`;
      }).join('');
      return `<tr>
          <td colspan="5" style="background:${primaryColor};color:#fff;font-weight:bold;font-size:11px;padding:6px 8px;letter-spacing:.05em;">${sec.toUpperCase()}</td>
        </tr>${rows}`;
    }).join('');

    const diagramaFotos: any[] = inspeccion.qr?.plantilla?.diagramaFotos ?? [];
    const fotosConUrl = diagramaFotos.filter((f: any) => f.url);

    // Genera celdas de la tabla con imagen + puntos SVG superpuestos (compatible con print)
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
    const rows: string[] = [];
    for (let i = 0; i < fotosConUrl.length; i += 2) {
      const f1 = fotosConUrl[i];
      const f2 = fotosConUrl[i + 1];
      const o1 = offset; offset += (f1?.puntos?.length || 0);
      const o2 = offset; offset += (f2?.puntos?.length || 0);
      rows.push(`<tr>${celdaFoto(f1, o1)}${f2 ? celdaFoto(f2, o2) : '<td></td>'}</tr>`);
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
        <table style="width:100%;border-collapse:collapse;">${rows.join('')}</table>
        ${leyendaHtml}
      </div>` : '';

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

${diagramaHtml}

<table>
  <thead><tr>
    <th style="width:32px;">#</th>
    <th>ÍTEM DE CONTROL</th>
    <th style="width:48px;">OK</th>
    <th style="width:48px;">NOK</th>
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
    // Esperar a que todas las imágenes carguen antes de imprimir
    const imgs = win.document.images;
    if (imgs.length === 0) {
      setTimeout(() => win.print(), 300);
    } else {
      let loaded = 0;
      const tryPrint = () => { loaded++; if (loaded >= imgs.length) win.print(); };
      const fallback = setTimeout(() => win.print(), 3000);
      Array.from(imgs).forEach(img => {
        if (img.complete) { tryPrint(); }
        else { img.onload = tryPrint; img.onerror = tryPrint; }
      });
      win.onafterprint = () => clearTimeout(fallback);
    }
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
