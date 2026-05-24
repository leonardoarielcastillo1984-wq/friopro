/**
 * Export utilities for Project360 Enterprise
 * Generates real downloadable files: PDF (via print), Word (.doc), Excel (.csv)
 */

export interface ExportableProposal {
  title?: string | null;
  status?: string | null;
  version?: number | null;
  costEstimate?: number | null;
  marginEstimate?: number | null;
  executiveSummary?: string | null;
  technicalProposal?: string | null;
  operationalScope?: string | null;
  timeline?: string | null;
  risks?: string | null;
  exclusions?: string | null;
  resourceMatrix?: any;
  preliminaryBudget?: any;
  generatedAt?: string | null;
}

export interface ExportableContract {
  contractNumber?: string | null;
  contractType?: string | null;
  status?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  totalValue?: number | null;
  probability?: number | null;
  notes?: string | null;
  sla?: string | null;
  penalties?: string | null;
}

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return 'N/A';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('es-AR');
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return 'N/A';
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── PDF EXPORT (via print dialog) ─────────────────────────────────
export function exportToPDF(data: ExportableProposal | ExportableContract, type: 'proposal' | 'contract', projectName?: string) {
  const isProposal = type === 'proposal';
  const p = data as ExportableProposal;
  const c = data as ExportableContract;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${isProposal ? (p.title || 'Propuesta') : ('Contrato ' + (c.contractNumber || ''))}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 760px; margin: 0 auto; padding: 30px; }
    .header { text-align: center; border-bottom: 4px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #1e40af; margin: 0; font-size: 26px; }
    .header .subtitle { color: #6b7280; font-size: 13px; margin-top: 6px; }
    .meta { background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .meta-item { display: flex; justify-content: space-between; font-size: 13px; }
    .meta-item span:first-child { color: #64748b; }
    .meta-item span:last-child { font-weight: 600; color: #1e293b; }
    .section { margin-bottom: 22px; page-break-inside: avoid; }
    .section h2 { color: #1e40af; border-left: 4px solid #2563eb; padding-left: 12px; font-size: 16px; margin-bottom: 10px; margin-top: 0; }
    .section p, .section div { margin: 0; color: #374151; text-align: justify; font-size: 13px; white-space: pre-wrap; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-green { background: #d1fae5; color: #065f46; }
    .badge-amber { background: #fef3c7; color: #92400e; }
    .badge-red { background: #fee2e2; color: #991b1b; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    .print-btn { display: block; margin: 0 auto 20px; padding: 10px 24px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; }
    .print-btn:hover { background: #1d4ed8; }
    @media print { .print-btn { display: none; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ Guardar como PDF</button>
  <div class="header">
    <h1>${isProposal ? escapeHtml(p.title || 'Propuesta Técnica') : 'Contrato: ' + escapeHtml(c.contractNumber || 'N/A')}</h1>
    <div class="subtitle">${projectName ? 'Proyecto: ' + escapeHtml(projectName) : 'SGI360 - Project360 Enterprise'}</div>
    <div class="subtitle">Generado: ${new Date().toLocaleDateString('es-AR')}</div>
  </div>

  <div class="meta">
    <div class="meta-grid">
      ${isProposal ? `
      <div class="meta-item"><span>Estado:</span> <span class="badge badge-blue">${escapeHtml(p.status || 'BORRADOR')}</span></div>
      <div class="meta-item"><span>Versión:</span> <span>${p.version || 1}</span></div>
      <div class="meta-item"><span>Costo Estimado:</span> <span>$${formatCurrency(p.costEstimate)} ARS</span></div>
      <div class="meta-item"><span>Margen Estimado:</span> <span>${p.marginEstimate != null ? p.marginEstimate + '%' : 'N/A'}</span></div>
      ` : `
      <div class="meta-item"><span>Estado:</span> <span class="badge badge-blue">${escapeHtml(c.status || 'BORRADOR')}</span></div>
      <div class="meta-item"><span>Tipo:</span> <span>${escapeHtml(c.contractType || 'N/A')}</span></div>
      <div class="meta-item"><span>Inicio:</span> <span>${formatDate(c.startDate)}</span></div>
      <div class="meta-item"><span>Fin:</span> <span>${formatDate(c.endDate)}</span></div>
      <div class="meta-item"><span>Valor Total:</span> <span>$${formatCurrency(c.totalValue)} ARS</span></div>
      <div class="meta-item"><span>Probabilidad:</span> <span>${c.probability != null ? c.probability + '%' : 'N/A'}</span></div>
      `}
    </div>
  </div>

  ${isProposal && p.executiveSummary ? `
  <div class="section">
    <h2>Resumen Ejecutivo</h2>
    <p>${escapeHtml(p.executiveSummary)}</p>
  </div>` : ''}

  ${isProposal && p.technicalProposal ? `
  <div class="section">
    <h2>Propuesta Técnica</h2>
    <p>${escapeHtml(p.technicalProposal)}</p>
  </div>` : ''}

  ${isProposal && p.operationalScope ? `
  <div class="section">
    <h2>Alcance Operativo</h2>
    <p>${escapeHtml(p.operationalScope)}</p>
  </div>` : ''}

  ${isProposal && p.timeline ? `
  <div class="section">
    <h2>Cronograma</h2>
    <p>${escapeHtml(p.timeline)}</p>
  </div>` : ''}

  ${isProposal && p.risks ? `
  <div class="section">
    <h2>Análisis de Riesgos</h2>
    <p>${escapeHtml(p.risks)}</p>
  </div>` : ''}

  ${isProposal && p.exclusions ? `
  <div class="section">
    <h2>Exclusiones</h2>
    <p>${escapeHtml(p.exclusions)}</p>
  </div>` : ''}

  ${!isProposal && c.sla ? `
  <div class="section">
    <h2>SLA - Acuerdos de Nivel de Servicio</h2>
    <p>${escapeHtml(c.sla)}</p>
  </div>` : ''}

  ${!isProposal && c.penalties ? `
  <div class="section">
    <h2>Penalidades y Cláusulas</h2>
    <p>${escapeHtml(c.penalties)}</p>
  </div>` : ''}

  ${!isProposal && c.notes ? `
  <div class="section">
    <h2>Notas</h2>
    <p>${escapeHtml(c.notes)}</p>
  </div>` : ''}

  <div class="footer">
    <p><strong>SGI360 - Project360 Enterprise</strong></p>
    <p>Documento confidencial • © ${new Date().getFullYear()}</p>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'width=900,height=700');
  if (!win) {
    // fallback: descarga directa
    const a = document.createElement('a');
    a.href = url;
    a.download = `${isProposal ? 'propuesta' : 'contrato'}-${Date.now()}.html`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// ─── WORD EXPORT (.doc via HTML MIME) ─────────────────────────────
export function exportToWord(data: ExportableProposal | ExportableContract, type: 'proposal' | 'contract', projectName?: string) {
  const isProposal = type === 'proposal';
  const p = data as ExportableProposal;
  const c = data as ExportableContract;

  const html = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${isProposal ? (p.title || 'Propuesta') : ('Contrato ' + (c.contractNumber || ''))}</title>
  <style>
    body { font-family: 'Calibri', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1f2937; }
    h1 { font-size: 20pt; color: #1e40af; text-align: center; border-bottom: 3pt solid #2563eb; padding-bottom: 12pt; }
    h2 { font-size: 14pt; color: #1e40af; border-left: 3pt solid #2563eb; padding-left: 8pt; margin-top: 18pt; }
    .meta { background: #f8fafc; padding: 12pt; border: 1pt solid #e2e8f0; margin-bottom: 14pt; }
    .meta-item { margin-bottom: 4pt; }
    .label { color: #64748b; }
    .value { font-weight: bold; }
    .footer { margin-top: 30pt; text-align: center; font-size: 9pt; color: #94a3b8; border-top: 1pt solid #e2e8f0; padding-top: 10pt; }
    p { text-align: justify; }
  </style>
</head>
<body>
  <h1>${isProposal ? escapeHtml(p.title || 'Propuesta Técnica') : 'Contrato: ' + escapeHtml(c.contractNumber || 'N/A')}</h1>
  <p style="text-align:center;color:#6b7280;font-size:10pt;">
    ${projectName ? 'Proyecto: ' + escapeHtml(projectName) + ' • ' : ''}Generado: ${new Date().toLocaleDateString('es-AR')}
  </p>

  <div class="meta">
    ${isProposal ? `
    <div class="meta-item"><span class="label">Estado:</span> <span class="value">${escapeHtml(p.status || 'BORRADOR')}</span></div>
    <div class="meta-item"><span class="label">Versión:</span> <span class="value">${p.version || 1}</span></div>
    <div class="meta-item"><span class="label">Costo Estimado:</span> <span class="value">$${formatCurrency(p.costEstimate)} ARS</span></div>
    <div class="meta-item"><span class="label">Margen Estimado:</span> <span class="value">${p.marginEstimate != null ? p.marginEstimate + '%' : 'N/A'}</span></div>
    ` : `
    <div class="meta-item"><span class="label">Estado:</span> <span class="value">${escapeHtml(c.status || 'BORRADOR')}</span></div>
    <div class="meta-item"><span class="label">Tipo:</span> <span class="value">${escapeHtml(c.contractType || 'N/A')}</span></div>
    <div class="meta-item"><span class="label">Inicio:</span> <span class="value">${formatDate(c.startDate)}</span></div>
    <div class="meta-item"><span class="label">Fin:</span> <span class="value">${formatDate(c.endDate)}</span></div>
    <div class="meta-item"><span class="label">Valor Total:</span> <span class="value">$${formatCurrency(c.totalValue)} ARS</span></div>
    `}
  </div>

  ${isProposal && p.executiveSummary ? `<h2>Resumen Ejecutivo</h2><p>${escapeHtml(p.executiveSummary)}</p>` : ''}
  ${isProposal && p.technicalProposal ? `<h2>Propuesta Técnica</h2><p>${escapeHtml(p.technicalProposal)}</p>` : ''}
  ${isProposal && p.operationalScope ? `<h2>Alcance Operativo</h2><p>${escapeHtml(p.operationalScope)}</p>` : ''}
  ${isProposal && p.timeline ? `<h2>Cronograma</h2><p>${escapeHtml(p.timeline)}</p>` : ''}
  ${isProposal && p.risks ? `<h2>Análisis de Riesgos</h2><p>${escapeHtml(p.risks)}</p>` : ''}
  ${isProposal && p.exclusions ? `<h2>Exclusiones</h2><p>${escapeHtml(p.exclusions)}</p>` : ''}
  ${!isProposal && c.sla ? `<h2>SLA</h2><p>${escapeHtml(c.sla)}</p>` : ''}
  ${!isProposal && c.penalties ? `<h2>Penalidades</h2><p>${escapeHtml(c.penalties)}</p>` : ''}
  ${!isProposal && c.notes ? `<h2>Notas</h2><p>${escapeHtml(c.notes)}</p>` : ''}

  <div class="footer">
    <p><strong>SGI360 - Project360 Enterprise</strong></p>
    <p>Documento confidencial • © ${new Date().getFullYear()}</p>
  </div>
</body>
</html>`;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${isProposal ? 'propuesta' : 'contrato'}-${Date.now()}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ─── EXCEL EXPORT (.csv with BOM) ───────────────────────────────────
export function exportToExcel(data: ExportableProposal | ExportableContract, type: 'proposal' | 'contract') {
  const isProposal = type === 'proposal';
  const p = data as ExportableProposal;
  const c = data as ExportableContract;

  let csv = '';
  if (isProposal) {
    csv = '\ufeffCampo,Valor\n';
    csv += `Título,"${(p.title || '').replace(/"/g, '""')}"\n`;
    csv += `Estado,"${(p.status || '').replace(/"/g, '""')}"\n`;
    csv += `Versión,${p.version || 1}\n`;
    csv += `Costo Estimado,$${formatCurrency(p.costEstimate)}\n`;
    csv += `Margen Estimado,${p.marginEstimate != null ? p.marginEstimate + '%' : 'N/A'}\n`;
    csv += `Resumen Ejecutivo,"${(p.executiveSummary || '').replace(/"/g, '""')}"\n`;
    csv += `Propuesta Técnica,"${(p.technicalProposal || '').replace(/"/g, '""')}"\n`;
    csv += `Alcance Operativo,"${(p.operationalScope || '').replace(/"/g, '""')}"\n`;
    csv += `Cronograma,"${(p.timeline || '').replace(/"/g, '""')}"\n`;
    csv += `Riesgos,"${(p.risks || '').replace(/"/g, '""')}"\n`;
    csv += `Exclusiones,"${(p.exclusions || '').replace(/"/g, '""')}"\n`;
    csv += `Generado,${p.generatedAt ? new Date(p.generatedAt).toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR')}\n`;
  } else {
    csv = '\ufeffCampo,Valor\n';
    csv += `Número,"${(c.contractNumber || '').replace(/"/g, '""')}"\n`;
    csv += `Tipo,"${(c.contractType || '').replace(/"/g, '""')}"\n`;
    csv += `Estado,"${(c.status || '').replace(/"/g, '""')}"\n`;
    csv += `Inicio,${formatDate(c.startDate)}\n`;
    csv += `Fin,${formatDate(c.endDate)}\n`;
    csv += `Valor Total,$${formatCurrency(c.totalValue)}\n`;
    csv += `Probabilidad,${c.probability != null ? c.probability + '%' : 'N/A'}\n`;
    csv += `SLA,"${(c.sla || '').replace(/"/g, '""')}"\n`;
    csv += `Penalidades,"${(c.penalties || '').replace(/"/g, '""')}"\n`;
    csv += `Notas,"${(c.notes || '').replace(/"/g, '""')}"\n`;
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${isProposal ? 'propuesta' : 'contrato'}-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
