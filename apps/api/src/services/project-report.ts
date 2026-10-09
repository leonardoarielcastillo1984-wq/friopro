/**
 * Informe ejecutivo de Proyecto — genera el bodyHtml para renderPdf.
 * Solo incluye secciones con datos; pensado para presentación a dirección.
 */

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En curso', COMPLETED: 'Completado',
  ON_HOLD: 'En pausa', CANCELLED: 'Cancelado', ARCHIVED: 'Archivado',
  DONE: 'Completado', BLOCKED: 'Bloqueado',
};

const TASK_STATUS: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En curso', COMPLETED: 'Completada',
  DONE: 'Completada', BLOCKED: 'Bloqueada', ON_HOLD: 'En pausa', CANCELLED: 'Cancelada',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#64748b', MEDIUM: '#2563eb', HIGH: '#d97706', CRITICAL: '#dc2626',
};

const STAGE_LABELS: Record<string, string> = {
  LICITACION_BORRADOR: 'Licitación (borrador)', DIMENSIONADO: 'Dimensionado',
  COTIZADO: 'Cotizado', APROBADO_PARA_PRESENTAR: 'Aprobado para presentar',
  ADJUDICADO: 'Adjudicado', EN_EJECUCION: 'En ejecución', CERRADO: 'Cerrado',
};

const APPROVAL_STATUS: Record<string, string> = {
  PENDIENTE: 'Pendiente', APROBADO: 'Aprobado', RECHAZADO: 'Rechazado',
};

const BUDGET_CAT: Record<string, string> = {
  MATERIAL: 'Material', MANO_OBRA: 'Mano de obra', SERVICIO: 'Servicio',
  HERRAMIENTA: 'Herramienta', VIAJE: 'Viaje', SUBCONTRATO: 'Subcontrato',
  TECNOLOGIA: 'Tecnología', OTRO: 'Otro',
};

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtMoney(n: number | null | undefined, currency = 'ARS'): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

function fmtSize(bytes: number | null | undefined): string {
  if (!bytes) return '—';
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function chip(label: string, color: string): string {
  return `<span style="font-size:9px;font-weight:bold;color:${color};border:1px solid ${color};padding:1px 7px;border-radius:8px;white-space:nowrap;">${label}</span>`;
}

function section(title: string, body: string, opts?: { breakBefore?: boolean }): string {
  return `<div class="${opts?.breakBefore ? 'page-break' : ''}" style="margin-bottom:18px;">
    <h2 style="border-bottom:2px solid #cbd5e1;padding-bottom:4px;">${title}</h2>
    ${body}
  </div>`;
}

function nameOf(map: Map<string, string>, id: string | null | undefined): string {
  if (!id) return '—';
  return map.get(id) || '—';
}

export interface ProjectReportContext {
  /** id de usuario/empleado → nombre visible */
  names: Map<string, string>;
}

export function buildProjectReportHtml(project: any, ctx: ProjectReportContext): string {
  const { names } = ctx;
  const sections: string[] = [];

  const tasks: any[] = (project.tasks || []).filter((t: any) => !t.deletedAt);
  const milestones: any[] = project.milestones || [];
  const budgetItems: any[] = project.budgetItems || [];
  const approvals: any[] = project.aprobaciones || [];
  const attachments: any[] = project.attachments || [];
  const reminders: any[] = (project.reminders || []).filter((r: any) => !r.isCompleted);
  const history: any[] = project.history || [];
  const analyses: any[] = project.aiAnalyses || [];

  const completedTasks = tasks.filter(t => t.status === 'COMPLETED' || t.status === 'DONE').length;
  const doneMilestones = milestones.filter(m => m.status === 'COMPLETED' || m.completedAt).length;
  const totalEstimated = budgetItems.reduce((s, i) => s + (i.costoTotalEstimado ?? i.estimated ?? 0), 0);
  const totalActual = budgetItems.reduce((s, i) => s + (i.costoTotalReal ?? i.actual ?? 0), 0);
  const responsible = nameOf(names, project.responsibleId);
  const statusLabel = STATUS_LABELS[project.status] || project.status || '—';
  const priorityLabel = PRIORITY_LABELS[project.priority] || project.priority || '—';
  const tags: string[] = Array.isArray(project.tags) ? project.tags.map(String) : [];

  // ── 1. Resumen ejecutivo ──────────────────────────────────────
  const kpis: string = [
    `<strong>Estado:</strong> ${chip(statusLabel, '#2563eb')}`,
    `<strong>Prioridad:</strong> ${chip(priorityLabel, PRIORITY_COLORS[project.priority] || '#64748b')}`,
    `<strong>Avance:</strong> ${project.progress ?? 0}%`,
    `<strong>Tareas:</strong> ${completedTasks}/${tasks.length} completadas`,
    `<strong>Hitos:</strong> ${doneMilestones}/${milestones.length} cumplidos`,
    project.budget ? `<strong>Presupuesto:</strong> ${fmtMoney(project.budget, project.budgetCurrency)}` : '',
    `<strong>Período:</strong> ${fmtDate(project.startDate)} → ${fmtDate(project.targetDate)}`,
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');

  sections.push(section('Resumen ejecutivo', `
    <div class="info-box" style="font-size:10.5px;line-height:2;">${kpis}</div>
    ${project.iaPredictiveSummary ? `<p style="font-size:10.5px;margin-top:6px;"><strong>Análisis IA:</strong> ${esc(project.iaPredictiveSummary)}</p>` : ''}
  `));

  // ── 2. Información general ────────────────────────────────────
  const infoRows: [string, string][] = [
    ['Código', `<span style="font-family:monospace;font-weight:bold;">${esc(project.code)}</span>`],
    ['Nombre', esc(project.name)],
    ['Responsable', esc(responsible)],
    ['Origen', esc(project.originModule || project.origin || '—')],
    ['Etapa', esc(STAGE_LABELS[project.etapaAprobacion] || project.etapaAprobacion || '—')],
    ['Fecha de inicio', fmtDate(project.startDate)],
    ['Fecha objetivo', fmtDate(project.targetDate)],
    ['Creación', fmtDate(project.createdAt)],
  ];
  if (project.budget) infoRows.push(['Presupuesto', fmtMoney(project.budget, project.budgetCurrency)]);
  if (project.actualCost) infoRows.push(['Costo real acumulado', fmtMoney(project.actualCost, project.budgetCurrency)]);
  if (project.indicatorId && project.targetValue) infoRows.push(['Indicador asociado', `Meta: ${project.targetValue}`]);
  if (tags.length) infoRows.push(['Etiquetas', tags.map(t => esc(t)).join(', ')]);

  sections.push(section('Información general', `
    <table class="meta-table">${infoRows.map(([k, v]) => `<tr><th style="width:32%">${k}</th><td>${v}</td></tr>`).join('')}</table>
    ${project.description ? `<p style="font-size:10.5px;margin-top:8px;"><strong>Descripción:</strong><br/>${esc(project.description).replace(/\n/g, '<br/>')}</p>` : ''}
  `));

  // ── 3. Indicadores predictivos IA (si hay scores) ─────────────
  const scoreFields: [string, number | null | undefined][] = [
    ['Probabilidad de adjudicación', project.probabilityOfWinning],
    ['Riesgo global', project.overallRiskScore],
    ['Probabilidad de atraso', project.probabilityOfDelay],
    ['Probabilidad de sobrecosto', project.probabilityOfCostDeviation],
    ['Score de viabilidad', project.viabilityScore],
    ['Score financiero', project.financialScore],
    ['Score operativo', project.operationalScore],
    ['Score estratégico', project.strategicScore],
    ['Score comercial', project.commercialScore],
    ['Confianza en cronograma', project.timelineConfidenceScore],
  ];
  const scores = scoreFields.filter(([, v]) => v !== null && v !== undefined);
  if (scores.length) {
    sections.push(section('Indicadores predictivos (IA)', `
      <table>
        <thead><tr><th>Indicador</th><th style="width:20%">Valor</th><th style="width:45%">Nivel</th></tr></thead>
        <tbody>${scores.map(([label, v]) => {
          const n = Math.round(Number(v));
          const color = n >= 70 ? '#dc2626' : n >= 40 ? '#d97706' : '#16a34a';
          const isPositive = /adjudicación|viabilidad|financiero|operativo|estratégico|comercial|confianza/.test(label);
          const c = isPositive ? (n >= 70 ? '#16a34a' : n >= 40 ? '#d97706' : '#dc2626') : color;
          return `<tr><td>${label}</td><td style="font-weight:bold;">${n}/100</td>
            <td><div style="background:#e2e8f0;border-radius:4px;height:10px;width:100%;">
              <div style="background:${c};height:10px;border-radius:4px;width:${Math.min(100, n)}%;"></div></div></td></tr>`;
        }).join('')}</tbody>
      </table>`));
  }

  // ── 4. Hitos ──────────────────────────────────────────────────
  if (milestones.length) {
    const sorted = [...milestones].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
    sections.push(section('Hitos del proyecto', `
      <table>
        <thead><tr><th>Hito</th><th style="width:15%">Fecha objetivo</th><th style="width:14%">Estado</th><th style="width:16%">Completado</th></tr></thead>
        <tbody>${sorted.map(m => {
          const done = m.status === 'COMPLETED' || m.completedAt;
          return `<tr>
            <td><strong>${esc(m.name)}</strong>${m.description ? `<br/><span style="font-size:9.5px;color:#64748b;">${esc(m.description)}</span>` : ''}</td>
            <td>${fmtDate(m.targetDate)}</td>
            <td>${done ? chip('Cumplido', '#16a34a') : chip('Pendiente', '#d97706')}</td>
            <td>${fmtDate(m.completedAt)}</td></tr>`;
        }).join('')}</tbody>
      </table>`));
  }

  // ── 5. Plan de tareas ─────────────────────────────────────────
  if (tasks.length) {
    const sorted = [...tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    sections.push(section(`Plan de tareas (${completedTasks}/${tasks.length} completadas)`, `
      <table>
        <thead><tr>
          <th>Tarea</th><th style="width:15%">Responsable</th><th style="width:12%">Estado</th>
          <th style="width:10%">Prioridad</th><th style="width:12%">Vencimiento</th><th style="width:9%">Avance</th>
        </tr></thead>
        <tbody>${sorted.map(t => {
          const done = t.status === 'COMPLETED' || t.status === 'DONE';
          const prog = done ? 100 : Math.round(t.progress ?? 0);
          return `<tr>
            <td>${t.parentId ? '<span style="color:#94a3b8;">↳ </span>' : ''}<strong>${esc(t.title)}</strong>
              ${t.description ? `<br/><span style="font-size:9.5px;color:#64748b;">${esc(t.description)}</span>` : ''}</td>
            <td>${esc(t.responsibleName || nameOf(names, t.responsibleId))}</td>
            <td>${chip(TASK_STATUS[t.status] || t.status || '—', done ? '#16a34a' : '#d97706')}</td>
            <td>${esc(PRIORITY_LABELS[t.priority] || '—')}</td>
            <td>${fmtDate(t.dueDate)}</td>
            <td>${prog}%</td></tr>`;
        }).join('')}</tbody>
      </table>`, { breakBefore: tasks.length > 8 }));
  }

  // ── 6. Presupuesto ────────────────────────────────────────────
  if (budgetItems.length) {
    const cur = project.budgetCurrency || 'ARS';
    sections.push(section('Presupuesto del proyecto', `
      <table>
        <thead><tr>
          <th>Ítem</th><th style="width:13%">Categoría</th><th style="width:9%">Cant.</th>
          <th style="width:12%">Estimado</th><th style="width:12%">Real</th><th style="width:15%">Proveedor</th>
        </tr></thead>
        <tbody>${budgetItems.map(i => `<tr>
          <td><strong>${esc(i.nombre || i.name)}</strong>
            ${i.descripcion || i.notes ? `<br/><span style="font-size:9.5px;color:#64748b;">${esc(i.descripcion || i.notes)}</span>` : ''}</td>
          <td>${esc(BUDGET_CAT[i.categoria || i.category] || i.categoria || i.category || '—')}</td>
          <td>${i.cantidad ?? '—'}${i.unidadMedida ? ` ${esc(i.unidadMedida)}` : ''}</td>
          <td>${fmtMoney(i.costoTotalEstimado ?? i.estimated ?? null, i.moneda || i.currency || cur)}</td>
          <td>${fmtMoney(i.costoTotalReal ?? i.actual ?? null, i.moneda || i.currency || cur)}</td>
          <td>${esc(i.proveedorNombre || '—')}</td></tr>`).join('')}
        <tr style="background:#f1f5f9;font-weight:bold;">
          <td colspan="3">TOTAL</td>
          <td>${fmtMoney(totalEstimated, cur)}</td><td>${fmtMoney(totalActual, cur)}</td><td></td>
        </tr></tbody>
      </table>
      ${project.budget ? `<p style="font-size:10px;margin-top:6px;color:#475569;">
        Presupuesto aprobado: <strong>${fmtMoney(project.budget, cur)}</strong> ·
        Estimado por ítems: <strong>${fmtMoney(totalEstimated, cur)}</strong> ·
        Ejecutado: <strong>${fmtMoney(totalActual, cur)}</strong>
        ${totalActual > 0 && project.budget > 0 ? ` (${Math.round((totalActual / project.budget) * 100)}% del presupuesto)` : ''}</p>` : ''}`,
      { breakBefore: budgetItems.length > 8 }));
  }

  // ── 7. Aprobaciones ───────────────────────────────────────────
  if (approvals.length) {
    const sorted = [...approvals].sort((a, b) => new Date(a.solicitadoEn).getTime() - new Date(b.solicitadoEn).getTime());
    sections.push(section('Flujo de aprobaciones', `
      <table>
        <thead><tr><th>Etapa</th><th style="width:15%">Estado</th><th style="width:25%">Aprobador</th><th style="width:14%">Solicitado</th><th style="width:14%">Resuelto</th></tr></thead>
        <tbody>${sorted.map(a => `<tr>
          <td>${esc(STAGE_LABELS[a.etapa] || a.etapa)}</td>
          <td>${chip(APPROVAL_STATUS[a.estado] || a.estado || '—', a.estado === 'APROBADO' ? '#16a34a' : a.estado === 'RECHAZADO' ? '#dc2626' : '#d97706')}</td>
          <td>${esc(a.aprobadorNombre || a.aprobadorEmail || '—')}</td>
          <td>${fmtDate(a.solicitadoEn)}</td>
          <td>${fmtDate(a.aprobadoEn)}</td></tr>`).join('')}</tbody>
      </table>`));
  }

  // ── 8. Análisis IA (licitación/pliego) ────────────────────────
  if (analyses.length) {
    sections.push(section('Análisis de documentos (IA)', analyses.slice(0, 3).map(a => `
      <div class="info-box" style="margin-bottom:8px;">
        <div style="font-size:10px;color:#64748b;"><strong>${esc(a.documentName)}</strong> · ${esc(a.analysisType)} · ${fmtDate(a.createdAt)}</div>
        ${a.summary ? `<div style="font-size:10.5px;margin-top:4px;">${esc(a.summary).replace(/\n/g, '<br/>')}</div>` : ''}
      </div>`).join('')));
  }

  // ── 9. Recordatorios pendientes ───────────────────────────────
  if (reminders.length) {
    sections.push(section('Recordatorios pendientes', `
      <ul style="font-size:10.5px;padding-left:18px;">${reminders.map(r =>
        `<li style="margin-bottom:4px;"><strong>${fmtDate(r.reminderDate)}</strong> — ${esc(r.title)}${r.description ? `: ${esc(r.description)}` : ''}</li>`).join('')}
      </ul>`));
  }

  // ── 10. Adjuntos ──────────────────────────────────────────────
  if (attachments.length) {
    sections.push(section('Documentos adjuntos', `
      <table>
        <thead><tr><th>Archivo</th><th style="width:12%">Tamaño</th><th style="width:16%">Fecha</th></tr></thead>
        <tbody>${attachments.map(a => `<tr><td>${esc(a.name)}</td><td>${fmtSize(a.size)}</td><td>${fmtDate(a.createdAt)}</td></tr>`).join('')}</tbody>
      </table>`));
  }

  // ── 11. Historial reciente ────────────────────────────────────
  if (history.length) {
    sections.push(section('Historial reciente', `
      <table>
        <thead><tr><th style="width:16%">Fecha</th><th>Acción</th><th style="width:20%">Usuario</th></tr></thead>
        <tbody>${history.slice(0, 15).map(h => `<tr>
          <td>${fmtDate(h.createdAt)}</td>
          <td>${esc(h.details || h.action)}</td>
          <td>${esc(h.userName || nameOf(names, h.userId))}</td></tr>`).join('')}</tbody>
      </table>`));
  }

  return sections.join('\n');
}
