import type { PrismaClient } from '@prisma/client';

export interface ToolContext {
  prisma: PrismaClient;
  tenantId: string;
  userId?: string;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  summary?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// ──────────────────────────────────────────────────────────────
// Herramientas disponibles para el asistente IA
// ──────────────────────────────────────────────────────────────

export const availableTools: ToolDefinition[] = [
  {
    name: 'query_normativos',
    description: 'Consulta las normativas cargadas en el sistema. Útil para responder preguntas como "¿Qué normas tengo cargadas?", "¿Cuántas cláusulas tiene la norma ISO 9001?"',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['ACTIVE', 'DRAFT', 'ARCHIVED'],
          description: 'Filtrar por estado de la normativa',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados (default: 10)',
        },
      },
    },
  },
  {
    name: 'query_nc',
    description: 'Consulta no conformidades del sistema. Útil para "¿Cuántas NC abiertas hay?", "NC por norma ISO 9001"',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['OPEN', 'IN_ANALYSIS', 'ACTION_PLANNED', 'IN_PROGRESS', 'VERIFICATION', 'CLOSED'],
          description: 'Estado de la no conformidad',
        },
        standard: {
          type: 'string',
          description: 'Norma relacionada (ej: ISO9001)',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados',
        },
      },
    },
  },
  {
    name: 'query_documents',
    description: 'Consulta documentos del sistema. Útil para "¿Qué documentos están vigentes?", "Documentos por tipo"',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['DRAFT', 'EFFECTIVE', 'OBSOLETE'],
          description: 'Estado del documento',
        },
        type: {
          type: 'string',
          description: 'Tipo de documento',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados',
        },
      },
    },
  },
  {
    name: 'query_indicators',
    description: 'Consulta indicadores/KPIs. Útil para "¿Cómo va el indicador de satisfacción del cliente?", "KPIs del área de calidad"',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Nombre o parte del nombre del indicador',
        },
        frequency: {
          type: 'string',
          enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'],
          description: 'Frecuencia de medición',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados',
        },
      },
    },
  },
  {
    name: 'query_audits',
    description: 'Consulta auditorías. Útil para "¿Cuándo es la próxima auditoría?", "Auditorías del mes"',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['DRAFT', 'PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
          description: 'Estado de la auditoría',
        },
        type: {
          type: 'string',
          enum: ['INTERNAL', 'EXTERNAL', 'SUPPLIER', 'CERTIFICATION', 'SURVEILLANCE'],
          description: 'Tipo de auditoría',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados',
        },
      },
    },
  },
  {
    name: 'query_compliance',
    description: 'Obtiene resumen de cumplimiento normativo. Útil para "¿Cómo va el cumplimiento de ISO 9001?", "Porcentaje de cumplimiento general"',
    parameters: {
      type: 'object',
      properties: {
        normativeId: {
          type: 'string',
          description: 'ID específico de normativa (opcional)',
        },
      },
    },
  },
];

// ──────────────────────────────────────────────────────────────
// Ejecutores de herramientas
// ──────────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  args: Record<string, any>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'query_normativos':
        return await queryNormativos(args, ctx);
      case 'query_nc':
        return await queryNC(args, ctx);
      case 'query_documents':
        return await queryDocuments(args, ctx);
      case 'query_indicators':
        return await queryIndicators(args, ctx);
      case 'query_audits':
        return await queryAudits(args, ctx);
      case 'query_compliance':
        return await queryCompliance(args, ctx);
      default:
        return { success: false, error: `Herramienta '${name}' no disponible` };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error ejecutando herramienta' };
  }
}

async function queryNormativos(args: any, ctx: ToolContext): Promise<ToolResult> {
  const where: any = { tenantId: ctx.tenantId, deletedAt: null };
  if (args.status) where.status = args.status;

  const normativos = await ctx.prisma.normativeStandard.findMany({
    where,
    take: args.limit || 10,
    select: {
      id: true,
      name: true,
      code: true,
      version: true,
      status: true,
      _count: { select: { clauses: { where: { deletedAt: null } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const summary = normativos.length === 0
    ? 'No hay normativas cargadas.'
    : `Encontradas ${normativos.length} normativas: ${normativos.map((n: any) => `${n.code} (${n._count.clauses} cláusulas)`).join(', ')}`;

  return {
    success: true,
    data: normativos.map((n: any) => ({
      name: n.name,
      code: n.code,
      version: n.version,
      status: n.status,
      clauseCount: n._count.clauses,
    })),
    summary,
  };
}

async function queryNC(args: any, ctx: ToolContext): Promise<ToolResult> {
  const where: any = { tenantId: ctx.tenantId, deletedAt: null };
  if (args.status) where.status = args.status;
  if (args.standard) where.standard = { contains: args.standard, mode: 'insensitive' };

  const [count, ncs] = await Promise.all([
    ctx.prisma.nonConformity.count({ where }),
    ctx.prisma.nonConformity.findMany({
      where,
      take: args.limit || 5,
      select: { id: true, code: true, title: true, status: true, standard: true, detectedAt: true },
      orderBy: { detectedAt: 'desc' },
    }),
  ]);

  const byStatus = await ctx.prisma.nonConformity.groupBy({
    by: ['status'],
    where: { tenantId: ctx.tenantId, deletedAt: null },
    _count: { id: true },
  });

  const summary = count === 0
    ? 'No hay no conformidades registradas.'
    : `Total NC: ${count}. Por estado: ${byStatus.map((s: any) => `${s.status}: ${s._count.id}`).join(', ')}`;

  return {
    success: true,
    data: { total: count, byStatus, recent: ncs },
    summary,
  };
}

async function queryDocuments(args: any, ctx: ToolContext): Promise<ToolResult> {
  const where: any = { tenantId: ctx.tenantId, deletedAt: null };
  if (args.status) where.status = args.status;
  if (args.type) where.type = { contains: args.type, mode: 'insensitive' };

  const [count, documents] = await Promise.all([
    ctx.prisma.document.count({ where }),
    ctx.prisma.document.findMany({
      where,
      take: args.limit || 5,
      select: { id: true, title: true, status: true, type: true, version: true, nextReviewDate: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const pendingReview = await ctx.prisma.document.count({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      nextReviewDate: { lt: new Date() },
    },
  });

  const summary = count === 0
    ? 'No hay documentos registrados.'
    : `Total documentos: ${count}. Pendientes de revisión: ${pendingReview}.`;

  return {
    success: true,
    data: { total: count, pendingReview, recent: documents },
    summary,
  };
}

async function queryIndicators(args: any, ctx: ToolContext): Promise<ToolResult> {
  const where: any = { tenantId: ctx.tenantId, deletedAt: null };
  if (args.name) where.name = { contains: args.name, mode: 'insensitive' };
  if (args.frequency) where.frequency = args.frequency;

  const [count, indicators] = await Promise.all([
    ctx.prisma.indicator.count({ where }),
    ctx.prisma.indicator.findMany({
      where,
      take: args.limit || 5,
      select: { id: true, name: true, targetValue: true, currentValue: true, frequency: true, status: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const summary = count === 0
    ? 'No hay indicadores registrados.'
    : `Total indicadores: ${count}. Recientes: ${indicators.map((i: any) => i.name).join(', ')}`;

  return {
    success: true,
    data: { total: count, indicators },
    summary,
  };
}

async function queryAudits(args: any, ctx: ToolContext): Promise<ToolResult> {
  const where: any = { tenantId: ctx.tenantId, deletedAt: null };
  if (args.status) where.status = args.status;
  if (args.type) where.type = args.type;

  const now = new Date();
  const upcoming = await ctx.prisma.audit.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      plannedStartDate: { gte: now },
    },
    take: 5,
    orderBy: { plannedStartDate: 'asc' },
    select: { id: true, code: true, title: true, plannedStartDate: true, status: true, type: true },
  });

  const [count, audits] = await Promise.all([
    ctx.prisma.audit.count({ where }),
    ctx.prisma.audit.findMany({
      where,
      take: args.limit || 5,
      orderBy: { plannedStartDate: 'desc' },
      select: { id: true, code: true, title: true, status: true, type: true, plannedStartDate: true },
    }),
  ]);

  const summary = count === 0
    ? 'No hay auditorías registradas.'
    : `Total auditorías: ${count}. Próximas: ${upcoming.length}.`;

  return {
    success: true,
    data: { total: count, upcoming, recent: audits },
    summary,
  };
}

async function queryCompliance(args: any, ctx: ToolContext): Promise<ToolResult> {
  const normatives = await ctx.prisma.normativeStandard.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      status: { not: 'ARCHIVED' },
    },
    select: { id: true, name: true, code: true },
  });

  const results = await Promise.all(
    normatives.map(async (n: any) => {
      const clauseCount = await ctx.prisma.normativeClause.count({
        where: { normativeId: n.id, deletedAt: null },
      });
      const mappingCount = await ctx.prisma.documentClauseMapping.count({
        where: {
          clause: { normativeId: n.id },
          deletedAt: null,
        },
      });
      return {
        name: n.name,
        code: n.code,
        clauseCount,
        mappingCount,
        coverage: clauseCount > 0 ? Math.round((mappingCount / clauseCount) * 100) : 0,
      };
    })
  );

  const avgCoverage = results.length > 0
    ? Math.round(results.reduce((sum: number, r: any) => sum + r.coverage, 0) / results.length)
    : 0;

  const summary = results.length === 0
    ? 'No hay normativas para evaluar cumplimiento.'
    : `Cumplimiento general: ${avgCoverage}%. Normativas: ${results.map((r: any) => `${r.code}: ${r.coverage}%`).join(', ')}`;

  return {
    success: true,
    data: { overall: avgCoverage, byNormative: results },
    summary,
  };
}
