/**
 * Export Service — Generate Excel & CSV files from platform data
 *
 * Supports:
 *   - No Conformidades (NCR)
 *   - Riesgos (Risks)
 *   - Indicadores (KPIs)
 *   - Documentos
 *   - Hallazgos de IA (AI Findings)
 *
 * Uses: SheetJS (xlsx library) for Excel generation
 */

import XLSX from 'xlsx';
import { Prisma } from '@prisma/client';

export interface ExportOptions {
  format?: 'xlsx' | 'csv';
  filename?: string;
  includeMetadata?: boolean;
  where?: any;
}

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

// ──────────────────────────────────────────────────────────────
// Helper: Create workbook with metadata sheet
// ──────────────────────────────────────────────────────────────

function createWorkbook(sheetName: string, data: any[][], options: ExportOptions = {}) {
  const workbook = XLSX.utils.book_new();

  // Data sheet
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Metadata sheet (optional)
  if (options.includeMetadata !== false) {
    const metadataSheet = XLSX.utils.aoa_to_sheet([
      ['Exported from SGI 360'],
      ['Date', new Date().toLocaleString('es-AR')],
      ['Timezone', 'UTC-3 (Argentina)'],
      ['Data Type', sheetName],
    ]);
    XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Info');
  }

  return workbook;
}

function workbookToBuffer(workbook: XLSX.WorkBook, format: 'xlsx' | 'csv'): Buffer {
  return Buffer.from(
    XLSX.write(workbook, {
      bookType: format === 'csv' ? 'csv' : 'xlsx',
      type: 'array',
    })
  );
}

// ──────────────────────────────────────────────────────────────
// Export: No Conformidades (NCR)
// ──────────────────────────────────────────────────────────────

export async function exportNCRs(
  prisma: Prisma.TransactionClient | any,
  tenantId: string,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const ncrs = await prisma.nonConformity.findMany({
    where: { tenantId, deletedAt: null },
    include: {
      assignedTo: { select: { email: true } },
      createdBy: { select: { email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Headers
  const headers = [
    'Código',
    'Título',
    'Descripción',
    'Severidad',
    'Fuente',
    'Estado',
    'Norma',
    'Cláusula',
    'Causa Raíz',
    'Acción Correctiva',
    'Acción Preventiva',
    'Detectado',
    'Vencimiento',
    'Cerrado',
    'Asignado a',
    'Efectivo',
  ];

  // Data rows
  const rows = ncrs.map((ncr: any) => [
    ncr.code,
    ncr.title,
    ncr.description,
    ncr.severity,
    ncr.source,
    ncr.status,
    ncr.standard || '',
    ncr.clause || '',
    ncr.rootCause || '',
    ncr.correctiveAction || '',
    ncr.preventiveAction || '',
    ncr.detectedAt?.toLocaleString('es-AR') || '',
    ncr.dueDate?.toLocaleString('es-AR') || '',
    ncr.closedAt?.toLocaleString('es-AR') || '',
    ncr.assignedTo?.email || '',
    ncr.isEffective ? 'Sí' : ncr.isEffective === false ? 'No' : '',
  ]);

  const data = [headers, ...rows];
  const fmt = options.format || 'xlsx';
  const workbook = createWorkbook('No Conformidades', data, options);
  const buffer = workbookToBuffer(workbook, fmt);
  const filename = options.filename || `NCR_Export_${new Date().toISOString().slice(0, 10)}.${fmt}`;

  return { buffer, filename, mimeType: fmt === 'csv' ? 'text/csv' : 'application/vnd.ms-excel' };
}

// ──────────────────────────────────────────────────────────────
// Export: Riesgos (Risks)
// ──────────────────────────────────────────────────────────────

export async function exportRisks(
  prisma: Prisma.TransactionClient | any,
  tenantId: string,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const baseWhere: any = { tenantId, deletedAt: null };
  const where = options.where ? { ...baseWhere, ...(options.where || {}) } : baseWhere;

  const risks = await prisma.risk.findMany({
    where,
    include: {
      owner: { select: { email: true } },
      createdBy: { select: { email: true } },
    },
    orderBy: { riskLevel: 'desc' },
  });

  // Headers
  const headers = [
    'Código',
    'Título',
    'Descripción',
    'Categoría',
    'Proceso',
    'Norma',
    'Requisito Normativo',
    'Tipo de Aspecto',
    'Peligro',
    'Aspecto Ambiental',
    'Requisito Legal',
    'Referencia Legal',
    'Origen del Riesgo',
    'Estrategia',
    'Responsable (ISO)',
    'Eficacia (%)',
    'Probabilidad (1-5)',
    'Impacto (1-5)',
    'Nivel de Riesgo',
    'Prob. Residual',
    'Imp. Residual',
    'Nivel Residual',
    'Controles',
    'Plan de Tratamiento',
    'Estado',
    'Owner (usuario)',
    'Creado por',
    'Fecha Identificación',
    'Fecha Revisión',
    'Fecha Cierre',
    'Creado',
    'Actualizado',
  ];

  // Data rows
  const rows = risks.map((risk: any) => [
    risk.code,
    risk.title,
    risk.description,
    risk.category,
    risk.process || '',
    risk.standard || '',
    (risk as any).requirement || '',
    (risk as any).aspectType || '',
    (risk as any).hazard || '',
    (risk as any).environmentalAspect || '',
    (risk as any).legalRequirement === true ? 'Sí' : (risk as any).legalRequirement === false ? 'No' : '',
    (risk as any).legalReference || '',
    (risk as any).riskSource || '',
    (risk as any).strategy || '',
    (risk as any).responsible || '',
    (risk as any).effectiveness ?? '',
    risk.probability,
    risk.impact,
    risk.riskLevel,
    risk.residualProb || '',
    risk.residualImpact || '',
    risk.residualLevel || '',
    risk.controls || '',
    risk.treatmentPlan || '',
    risk.status,
    risk.owner?.email || '',
    risk.createdBy?.email || '',
    risk.identificationDate?.toLocaleString('es-AR') || '',
    risk.reviewDate?.toLocaleString('es-AR') || '',
    risk.closureDate?.toLocaleString('es-AR') || '',
    risk.createdAt?.toLocaleString('es-AR') || '',
    risk.updatedAt?.toLocaleString('es-AR') || '',
  ]);

  const data = [headers, ...rows];
  const fmt = options.format || 'xlsx';
  const workbook = createWorkbook('Riesgos', data, options);
  const buffer = workbookToBuffer(workbook, fmt);
  const filename = options.filename || `Riesgos_Export_${new Date().toISOString().slice(0, 10)}.${fmt}`;

  return { buffer, filename, mimeType: fmt === 'csv' ? 'text/csv' : 'application/vnd.ms-excel' };
}

// ──────────────────────────────────────────────────────────────
// Export: Indicadores (KPIs)
// ──────────────────────────────────────────────────────────────

export async function exportIndicators(
  prisma: Prisma.TransactionClient | any,
  tenantId: string,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const indicators = await prisma.indicator.findMany({
    where: { tenantId, deletedAt: null },
    include: {
      owner: { select: { email: true } },
      measurements: {
        orderBy: { measuredAt: 'desc' },
        take: 6, // Last 6 measurements
      },
    },
    orderBy: { code: 'asc' },
  });

  // Headers
  const headers = [
    'Código',
    'Nombre',
    'Descripción',
    'Categoría',
    'Proceso',
    'Norma',
    'Valor Actual',
    'Valor Target',
    'Mínimo',
    'Máximo',
    'Unidad',
    'Frecuencia',
    'Tendencia',
    'Activo',
    'Responsable',
    'Mediciones Recientes',
  ];

  // Data rows
  const rows = indicators.map((ind: any) => [
    ind.code,
    ind.name,
    ind.description || '',
    ind.category,
    ind.process || '',
    ind.standard || '',
    ind.currentValue || '',
    ind.targetValue || '',
    ind.minValue || '',
    ind.maxValue || '',
    ind.unit,
    ind.frequency,
    ind.trend,
    ind.isActive ? 'Sí' : 'No',
    ind.owner?.email || '',
    ind.measurements.map((m: any) => `${m.value} (${m.period})`).join('; '),
  ]);

  const data = [headers, ...rows];
  const fmt = options.format || 'xlsx';
  const workbook = createWorkbook('Indicadores', data, options);
  const buffer = workbookToBuffer(workbook, fmt);
  const filename = options.filename || `Indicadores_Export_${new Date().toISOString().slice(0, 10)}.${fmt}`;

  return { buffer, filename, mimeType: fmt === 'csv' ? 'text/csv' : 'application/vnd.ms-excel' };
}

// ──────────────────────────────────────────────────────────────
// Export: Documentos
// ──────────────────────────────────────────────────────────────

export async function exportDocuments(
  prisma: Prisma.TransactionClient | any,
  tenantId: string,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const documents = await prisma.document.findMany({
    where: { tenantId, deletedAt: null },
    include: {
      createdBy: { select: { email: true } },
      clauseMappings: {
        include: {
          clause: { select: { clauseNumber: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Headers
  const headers = [
    'ID',
    'Título',
    'Tipo',
    'Estado',
    'Versión',
    'Cláusulas Mapeadas',
    'Tamaño (bytes)',
    'Archivo',
    'Creado por',
    'Fecha Creación',
  ];

  // Data rows
  const rows = documents.map((doc: any) => [
    doc.id,
    doc.title,
    doc.type,
    doc.status,
    doc.version,
    doc.clauseMappings.map((m: any) => m.clause.clauseNumber).join(', '),
    doc.filePath ? '(archivo)' : '(contenido)',
    doc.filePath || '',
    doc.createdBy?.email || '',
    doc.createdAt.toLocaleString('es-AR'),
  ]);

  const data = [headers, ...rows];
  const fmt = options.format || 'xlsx';
  const workbook = createWorkbook('Documentos', data, options);
  const buffer = workbookToBuffer(workbook, fmt);
  const filename = options.filename || `Documentos_Export_${new Date().toISOString().slice(0, 10)}.${fmt}`;

  return { buffer, filename, mimeType: fmt === 'csv' ? 'text/csv' : 'application/vnd.ms-excel' };
}

// ──────────────────────────────────────────────────────────────
// Export: Hallazgos IA (AI Findings)
// ──────────────────────────────────────────────────────────────

export async function exportFindings(
  prisma: Prisma.TransactionClient | any,
  tenantId: string,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const findings = await prisma.aiFinding.findMany({
    where: { tenantId, deletedAt: null },
    include: {
      document: { select: { title: true } },
      normative: { select: { name: true, code: true } },
      auditRun: { select: { type: true } },
    },
    orderBy: { severity: 'asc' },
  });

  // Headers
  const headers = [
    'ID',
    'Severidad',
    'Norma',
    'Cláusula',
    'Título',
    'Descripción',
    'Documento',
    'Tipo Auditoría',
    'Evidencia',
    'Confianza',
    'Estado',
    'Acciones Sugeridas',
    'Fecha Creación',
  ];

  // Data rows
  const rows = findings.map((f: any) => [
    f.id,
    f.severity,
    f.normative?.code || f.standard || '',
    f.clause,
    f.title,
    f.description,
    f.document?.title || '',
    f.auditType || '',
    f.evidence || '',
    f.confidence ? Math.round(f.confidence * 100) + '%' : '',
    f.status,
    Array.isArray(f.suggestedActions) ? (f.suggestedActions as string[]).join('; ') : '',
    f.createdAt.toLocaleString('es-AR'),
  ]);

  const data = [headers, ...rows];
  const fmt = options.format || 'xlsx';
  const workbook = createWorkbook('Hallazgos IA', data, options);
  const buffer = workbookToBuffer(workbook, fmt);
  const filename = options.filename || `Hallazgos_Export_${new Date().toISOString().slice(0, 10)}.${fmt}`;

  return { buffer, filename, mimeType: fmt === 'csv' ? 'text/csv' : 'application/vnd.ms-excel' };
}

// ──────────────────────────────────────────────────────────────
// Combined: Full Tenant Report
// ──────────────────────────────────────────────────────────────

export async function exportTenantReport(
  prisma: Prisma.TransactionClient | any,
  tenantId: string,
  options: ExportOptions = {}
): Promise<ExportResult> {
  // Fetch all data
  const [ncrs, risks, indicators, documents, findings] = await Promise.all([
    prisma.nonConformity.findMany({
      where: { tenantId, deletedAt: null },
      include: { assignedTo: { select: { email: true } } },
      take: 100,
    }),
    prisma.risk.findMany({
      where: { tenantId, deletedAt: null },
      take: 100,
    }),
    prisma.indicator.findMany({
      where: { tenantId, deletedAt: null },
      take: 50,
    }),
    prisma.document.findMany({
      where: { tenantId, deletedAt: null },
      take: 100,
    }),
    prisma.aiFinding.findMany({
      where: { tenantId, deletedAt: null },
      take: 100,
    }),
  ]);

  const workbook = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summary = [
    ['Reporte del Tenant — SGI 360'],
    ['Fecha de Exportación', new Date().toLocaleString('es-AR')],
    [''],
    ['Resumen de Datos'],
    ['No Conformidades', ncrs.length],
    ['Riesgos', risks.length],
    ['Indicadores', indicators.length],
    ['Documentos', documents.length],
    ['Hallazgos IA', findings.length],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

  // Sheet 2: NCRs
  if (ncrs.length > 0) {
    const ncrHeaders = ['Código', 'Título', 'Severidad', 'Estado', 'Vencimiento', 'Asignado a'];
    const ncrRows = ncrs.map((n: any) => [n.code, n.title, n.severity, n.status, n.dueDate?.toLocaleDateString('es-AR') || '', n.assignedTo?.email || '']);
    const ncrSheet = XLSX.utils.aoa_to_sheet([ncrHeaders, ...ncrRows]);
    XLSX.utils.book_append_sheet(workbook, ncrSheet, 'NCRs');
  }

  // Sheet 3: Riesgos
  if (risks.length > 0) {
    const riskHeaders = ['Código', 'Título', 'Categoría', 'Probabilidad', 'Impacto', 'Nivel', 'Estado'];
    const riskRows = risks.map((r: any) => [r.code, r.title, r.category, r.probability, r.impact, r.riskLevel, r.status]);
    const riskSheet = XLSX.utils.aoa_to_sheet([riskHeaders, ...riskRows]);
    XLSX.utils.book_append_sheet(workbook, riskSheet, 'Riesgos');
  }

  // Sheet 4: Indicadores
  if (indicators.length > 0) {
    const indHeaders = ['Código', 'Nombre', 'Valor Actual', 'Target', 'Tendencia', 'Estado'];
    const indRows = indicators.map((i: any) => [i.code, i.name, i.currentValue || '', i.targetValue || '', i.trend, i.isActive ? 'Activo' : 'Inactivo']);
    const indSheet = XLSX.utils.aoa_to_sheet([indHeaders, ...indRows]);
    XLSX.utils.book_append_sheet(workbook, indSheet, 'Indicadores');
  }

  // Sheet 5: Hallazgos
  if (findings.length > 0) {
    const findHeaders = ['Severidad', 'Cláusula', 'Título', 'Confianza', 'Estado'];
    const findRows = findings.map((f: any) => [f.severity, f.clause, f.title, f.confidence ? Math.round(f.confidence * 100) + '%' : '', f.status]);
    const findSheet = XLSX.utils.aoa_to_sheet([findHeaders, ...findRows]);
    XLSX.utils.book_append_sheet(workbook, findSheet, 'Hallazgos');
  }

  const fmt = options.format || 'xlsx';
  const buffer = workbookToBuffer(workbook, fmt);
  const filename = options.filename || `Reporte_Tenant_${new Date().toISOString().slice(0, 10)}.${fmt}`;

  return { buffer, filename, mimeType: fmt === 'csv' ? 'text/csv' : 'application/vnd.ms-excel' };
}
