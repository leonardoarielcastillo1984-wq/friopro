// Helpers de exportación e informe para Partes Interesadas (PDF / Excel / CSV).
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export const CRIT_LABEL: Record<number, string> = { 5: 'Muy Alta', 4: 'Alta', 3: 'Media', 2: 'Baja', 1: 'Muy Baja' };
export const STATUS_LABEL: Record<string, string> = { COMPLIES: 'Cumple', PARTIAL: 'Parcial', NON_COMPLIANT: 'No cumple', PENDING: 'Pendiente' };
export const QUAD_LABEL: Record<string, string> = { MANAGE: 'Gestionar de cerca', SATISFY: 'Mantener satisfecho', INFORM: 'Mantener informado', MONITOR: 'Monitorear' };

export function criticalityStars(n?: number | null): string {
  const v = Math.max(0, Math.min(5, n || 0));
  return '★'.repeat(v) + '☆'.repeat(5 - v);
}

export function quadrantOf(inf?: number | null, int?: number | null): 'MANAGE' | 'SATISFY' | 'INFORM' | 'MONITOR' {
  const hiInf = (inf ?? 3) >= 4; const hiInt = (int ?? 3) >= 4;
  if (hiInf && hiInt) return 'MANAGE';
  if (hiInf && !hiInt) return 'SATISFY';
  if (!hiInf && hiInt) return 'INFORM';
  return 'MONITOR';
}

const d = (v?: string | null) => (v ? new Date(v).toLocaleDateString('es-AR') : '—');

function rowsFrom(evals: any[]) {
  return evals.map((e) => {
    const s = e.stakeholder || {};
    return {
      Nombre: s.name || '',
      Tipo: s.type === 'INTERNAL' ? 'Interna' : 'Externa',
      Categoría: s.category || '',
      Estado: STATUS_LABEL[e.complianceStatus] || 'Pendiente',
      'Nivel %': typeof e.complianceLevel === 'number' ? e.complianceLevel : '',
      Criticidad: CRIT_LABEL[e.criticality] || '',
      Influencia: e.influence ?? '',
      Interés: e.interest ?? '',
      Clasificación: QUAD_LABEL[quadrantOf(e.influence, e.interest)],
      'Próx. evaluación': d(e.nextEvaluationDate),
      'Requiere acción': e.requiresAction ? 'Sí' : 'No',
      Responsable: e.followUpResponsible || '',
    };
  });
}

export function exportCSV(evals: any[], cycleName: string) {
  const rows = rowsFrom(evals);
  if (!rows.length) { alert('No hay datos para exportar'); return; }
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map((r: any) => headers.map((h) => esc(r[h])).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `partes_interesadas_${cycleName.replace(/\s+/g, '_')}.csv`);
}

export function exportExcel(evals: any[], cycleName: string) {
  const rows = rowsFrom(evals);
  if (!rows.length) { alert('No hay datos para exportar'); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Partes Interesadas');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `partes_interesadas_${cycleName.replace(/\s+/g, '_')}.xlsx`);
}

interface ReportData {
  cycle: { name: string; year: number; status: string; responsible?: string | null };
  evals: any[];
  summary: { total: number; complies: number; partial: number; nonCompliant: number; pending: number; openActions: number; overdue: number; avgLevel: number };
  matrix: Record<string, any[]>;
}

export function generatePDF({ cycle, evals, summary, matrix }: ReportData) {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString('es-AR');

  // Encabezado corporativo
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, W, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text('Informe de Partes Interesadas', 14, 12);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(`Sistema de Gestión Integrado (SGI)  •  ${cycle.name} (${cycle.year})`, 14, 19);
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(9);
  doc.text(`Fecha de emisión: ${today}`, 14, 34);
  doc.text(`Estado del ciclo: ${cycle.status === 'ACTIVE' ? 'Vigente' : cycle.status === 'CLOSED' ? 'Cerrado' : 'Borrador'}`, 14, 39);
  if (cycle.responsible) doc.text(`Responsable del ciclo: ${cycle.responsible}`, 14, 44);

  // Resumen ejecutivo (métricas)
  let y = cycle.responsible ? 52 : 48;
  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text('Resumen Ejecutivo', 14, y); y += 4;
  doc.setFont('helvetica', 'normal');
  autoTable(doc as any, {
    startY: y,
    head: [['Total', 'Cumplen', 'Parciales', 'No cumplen', 'Pendientes', 'Acc. abiertas', 'Vencidas', 'Nivel prom.']],
    body: [[summary.total, summary.complies, summary.partial, summary.nonCompliant, summary.pending, summary.openActions, summary.overdue, `${summary.avgLevel}%`]],
    theme: 'grid', headStyles: { fillColor: [37, 99, 235], fontSize: 8 }, bodyStyles: { fontSize: 9, halign: 'center' },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Gráfico de cumplimiento (barras simples)
  const dist = [
    { l: 'Cumplen', v: summary.complies, c: [34, 197, 94] as [number, number, number] },
    { l: 'Parciales', v: summary.partial, c: [234, 179, 8] },
    { l: 'No cumplen', v: summary.nonCompliant, c: [239, 68, 68] },
    { l: 'Pendientes', v: summary.pending, c: [156, 163, 175] },
  ];
  const maxV = Math.max(1, ...dist.map((x) => x.v));
  doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Gráfico de Cumplimiento', 14, y); y += 6;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  dist.forEach((x) => {
    doc.text(`${x.l} (${x.v})`, 14, y + 3);
    doc.setFillColor(x.c[0], x.c[1], x.c[2]);
    const bw = (x.v / maxV) * 110;
    doc.rect(55, y, bw, 4, 'F');
    y += 7;
  });
  y += 4;

  // Matriz Poder / Interés
  doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Matriz Poder / Interés', 14, y); y += 4;
  autoTable(doc as any, {
    startY: y,
    head: [['Cuadrante', 'Partes interesadas']],
    body: (['MANAGE', 'SATISFY', 'INFORM', 'MONITOR'] as const).map((q) => [QUAD_LABEL[q], (matrix[q] || []).map((e: any) => e.stakeholder?.name).join(', ') || '—']),
    theme: 'grid', headStyles: { fillColor: [37, 99, 235], fontSize: 8 }, bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' } }, margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Tabla completa
  doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text('Detalle de Partes Interesadas', 14, y); y += 2;
  autoTable(doc as any, {
    startY: y + 2,
    head: [['Nombre', 'Estado', 'Nivel', 'Criticidad', 'Inf.', 'Int.', 'Próx. eval', 'Acción']],
    body: evals.map((e: any) => [
      e.stakeholder?.name || '', STATUS_LABEL[e.complianceStatus] || 'Pendiente',
      typeof e.complianceLevel === 'number' ? `${e.complianceLevel}%` : '—',
      CRIT_LABEL[e.criticality] || '—', e.influence ?? '—', e.interest ?? '—',
      d(e.nextEvaluationDate), e.requiresAction ? 'Sí' : 'No',
    ]),
    theme: 'striped', headStyles: { fillColor: [37, 99, 235], fontSize: 8 }, bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });

  // Listas de foco (parciales / no conformes / acciones abiertas)
  const partials = evals.filter((e: any) => e.complianceStatus === 'PARTIAL');
  const noncomp = evals.filter((e: any) => e.complianceStatus === 'NON_COMPLIANT');
  const openAct = evals.filter((e: any) => e.requiresAction && !e.actionItemId);
  const listBlock = (title: string, arr: any[]) => {
    let yy = (doc as any).lastAutoTable.finalY + 8;
    if (yy > 260) { doc.addPage(); yy = 20; }
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text(title, 14, yy);
    autoTable(doc as any, {
      startY: yy + 2, head: [['Parte', 'Estado', 'Nivel']],
      body: arr.length ? arr.map((e: any) => [e.stakeholder?.name || '', STATUS_LABEL[e.complianceStatus] || 'Pendiente', typeof e.complianceLevel === 'number' ? `${e.complianceLevel}%` : '—']) : [['—', '—', '—']],
      theme: 'grid', headStyles: { fillColor: [100, 116, 139], fontSize: 8 }, bodyStyles: { fontSize: 8 }, margin: { left: 14, right: 14 },
    });
  };
  listBlock('Partes en estado Parcial', partials);
  listBlock('Partes No Conformes', noncomp);
  listBlock('Acciones abiertas (pendientes de CAPA)', openAct);

  // Pie de página
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text(`SGI360 — Informe de Partes Interesadas — ${cycle.name}`, 14, doc.internal.pageSize.getHeight() - 8);
    doc.text(`Página ${i}/${pages}`, W - 30, doc.internal.pageSize.getHeight() - 8);
  }

  doc.save(`informe_partes_interesadas_${cycle.name.replace(/\s+/g, '_')}.pdf`);
}
