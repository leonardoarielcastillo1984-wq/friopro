/**
 * AI TOOLS ENGINE
 * SGI360 Command Center — Motor de acciones ejecutables por IA
 *
 * La IA puede detectar intenciones de acción y ejecutarlas:
 * - Crear proyectos, tareas, CAPAs, NCRs, minutas, reuniones
 * - Generar reportes, simulaciones, documentos
 * - Consultar indicadores de múltiples módulos
 *
 * Seguridad: aislamiento de tenant, validación de permisos, auditoría completa
 */

import { PrismaClient } from '@prisma/client';
import { FastifyInstance } from 'fastify';

export interface AITool {
  name: string;
  description: string;
  module: string;
  requiredRole: string[];
  parameters: Record<string, { type: string; required: boolean; description: string }>;
}

export interface AIToolResult {
  success: boolean;
  tool: string;
  entityId?: string;
  entityType?: string;
  message: string;
  data?: any;
  url?: string;
}

// Herramientas disponibles registradas
const REGISTERED_TOOLS: AITool[] = [
  {
    name: 'create_project',
    description: 'Crear un nuevo proyecto en Project360',
    module: 'project360',
    requiredRole: ['TENANT_ADMIN', 'MANAGER', 'USER'],
    parameters: {
      name: { type: 'string', required: true, description: 'Nombre del proyecto' },
      client: { type: 'string', required: false, description: 'Cliente o empresa' },
      description: { type: 'string', required: false, description: 'Descripción del proyecto' },
      budget: { type: 'number', required: false, description: 'Presupuesto estimado' },
    }
  },
  {
    name: 'create_ncr',
    description: 'Abrir una No Conformidad (NCR)',
    module: 'quality',
    requiredRole: ['TENANT_ADMIN', 'MANAGER', 'USER'],
    parameters: {
      title: { type: 'string', required: true, description: 'Título de la NCR' },
      description: { type: 'string', required: false, description: 'Descripción del problema' },
      severity: { type: 'string', required: false, description: 'Severidad: LOW, MEDIUM, HIGH, CRITICAL' },
    }
  },
  {
    name: 'create_capa',
    description: 'Crear una Acción Correctiva/Preventiva (CAPA)',
    module: 'quality',
    requiredRole: ['TENANT_ADMIN', 'MANAGER', 'USER'],
    parameters: {
      title: { type: 'string', required: true, description: 'Título de la CAPA' },
      rootCause: { type: 'string', required: false, description: 'Causa raíz identificada' },
      action: { type: 'string', required: false, description: 'Acción correctiva propuesta' },
    }
  },
  {
    name: 'get_projects_summary',
    description: 'Obtener resumen completo de todos los proyectos del tenant',
    module: 'project360',
    requiredRole: ['TENANT_ADMIN', 'MANAGER', 'USER'],
    parameters: {}
  },
  {
    name: 'get_quality_summary',
    description: 'Obtener resumen de NCRs, CAPAs y estado de calidad',
    module: 'quality',
    requiredRole: ['TENANT_ADMIN', 'MANAGER', 'USER'],
    parameters: {}
  },
  {
    name: 'get_hr_summary',
    description: 'Obtener resumen de empleados, capacitaciones y competencias',
    module: 'hr',
    requiredRole: ['TENANT_ADMIN', 'MANAGER'],
    parameters: {}
  },
  {
    name: 'get_fleet_summary',
    description: 'Obtener resumen de flota de vehículos y mantenimientos',
    module: 'fleet',
    requiredRole: ['TENANT_ADMIN', 'MANAGER', 'USER'],
    parameters: {}
  },
];

export class AIToolsEngine {
  private prisma: PrismaClient;
  private db: any;
  private app?: FastifyInstance;

  constructor(prisma: PrismaClient, app?: FastifyInstance) {
    this.prisma = prisma;
    this.db = prisma as any;
    this.app = app;
  }

  /**
   * Detecta si una query contiene intención de ejecutar una acción
   */
  detectToolIntent(query: string): { tool: string; params: Record<string, any> } | null {
    const q = query.toLowerCase();

    // Crear proyecto
    if ((q.includes('crear') || q.includes('creame') || q.includes('nuevo')) && q.includes('proyecto')) {
      const nameMatch = query.match(/proyecto[s]?\s+(?:para|de|llamado)?\s*["']?([A-Za-zÀ-ÿ0-9\s]+)["']?/i);
      return {
        tool: 'create_project',
        params: { name: nameMatch?.[1]?.trim() || 'Nuevo Proyecto' }
      };
    }

    // Crear NCR
    if ((q.includes('crear') || q.includes('abrir') || q.includes('registrar')) && (q.includes('ncr') || q.includes('no conformidad') || q.includes('inconformidad'))) {
      const titleMatch = query.match(/(?:ncr|no conformidad)\s+(?:por|sobre|de)?\s*["']?([^"']+)["']?/i);
      return {
        tool: 'create_ncr',
        params: { title: titleMatch?.[1]?.trim() || 'Nueva No Conformidad' }
      };
    }

    // Crear CAPA
    if ((q.includes('crear') || q.includes('generar') || q.includes('abrir')) && q.includes('capa')) {
      const titleMatch = query.match(/capa\s+(?:por|sobre|para)?\s*["']?([^"']+)["']?/i);
      return {
        tool: 'create_capa',
        params: { title: titleMatch?.[1]?.trim() || 'Nueva CAPA' }
      };
    }

    // Consultar proyectos
    if ((q.includes('cómo') || q.includes('como') || q.includes('estado') || q.includes('mostrar') || q.includes('ver')) && q.includes('proyectos')) {
      return { tool: 'get_projects_summary', params: {} };
    }

    // Consultar calidad
    if ((q.includes('ncr') || q.includes('capa') || q.includes('calidad') || q.includes('no conformidad')) &&
        (q.includes('cómo') || q.includes('como') || q.includes('estado') || q.includes('cuántas') || q.includes('cuantas'))) {
      return { tool: 'get_quality_summary', params: {} };
    }

    return null;
  }

  /**
   * Ejecuta una herramienta IA con los parámetros dados
   */
  async executeTool(
    toolName: string,
    params: Record<string, any>,
    tenantId: string,
    userId: string,
    userRole: string
  ): Promise<AIToolResult> {
    const tool = REGISTERED_TOOLS.find(t => t.name === toolName);
    if (!tool) {
      return { success: false, tool: toolName, message: `Herramienta '${toolName}' no encontrada.` };
    }

    // Validar permisos (case-insensitive)
    const normalizedRole = String(userRole).toUpperCase();
    const hasPermission = tool.requiredRole.some(r => r.toUpperCase() === normalizedRole)
      || normalizedRole === 'TENANT_ADMIN'
      || normalizedRole === 'SUPER_ADMIN';
    if (!hasPermission) {
      return { success: false, tool: toolName, message: `Sin permisos para ejecutar '${toolName}'.` };
    }

    // Auditar la acción
    await this.auditAction(tenantId, userId, toolName, params);

    try {
      switch (toolName) {
        case 'create_project':
          return await this.createProject(tenantId, userId, params);
        case 'create_ncr':
          return await this.createNCR(tenantId, userId, params);
        case 'create_capa':
          return await this.createCAPA(tenantId, userId, params);
        case 'get_projects_summary':
          return await this.getProjectsSummary(tenantId);
        case 'get_quality_summary':
          return await this.getQualitySummary(tenantId);
        case 'get_hr_summary':
          return await this.getHRSummary(tenantId);
        case 'get_fleet_summary':
          return await this.getFleetSummary(tenantId);
        default:
          return { success: false, tool: toolName, message: 'Herramienta no implementada.' };
      }
    } catch (error: any) {
      console.error(`[AI Tools Engine] Error executing ${toolName}:`, error);
      return { success: false, tool: toolName, message: `Error al ejecutar: ${error.message}` };
    }
  }

  private async createProject(tenantId: string, userId: string, params: any): Promise<AIToolResult> {
    const project = await this.db.project360?.create({
      data: {
        tenantId,
        name: params.name || 'Nuevo Proyecto',
        client: params.client || null,
        description: params.description || null,
        status: 'PLANNING',
        progress: 0,
        budget: params.budget ? parseFloat(params.budget) : null,
        createdById: userId,
      }
    });

    if (!project) return { success: false, tool: 'create_project', message: 'No se pudo crear el proyecto. Módulo Project360 no disponible.' };

    return {
      success: true,
      tool: 'create_project',
      entityId: project.id,
      entityType: 'project360',
      message: `✅ Proyecto **"${project.name}"** creado exitosamente.`,
      data: { id: project.id, name: project.name, status: project.status },
      url: `/project360/${project.id}`
    };
  }

  private async createNCR(tenantId: string, userId: string, params: any): Promise<AIToolResult> {
    const ncrModel = this.db.nonConformityReport || this.db.ncr || this.db.nonConformity;
    if (!ncrModel) return { success: false, tool: 'create_ncr', message: 'Módulo de NCR no disponible.' };

    const ncr = await ncrModel.create({
      data: {
        tenantId,
        title: params.title,
        description: params.description || null,
        severity: params.severity || 'MEDIUM',
        status: 'OPEN',
        reportedById: userId,
      }
    });

    return {
      success: true,
      tool: 'create_ncr',
      entityId: ncr.id,
      entityType: 'ncr',
      message: `✅ NCR **"${ncr.title}"** abierta exitosamente.`,
      data: { id: ncr.id, title: ncr.title, status: ncr.status },
    };
  }

  private async createCAPA(tenantId: string, userId: string, params: any): Promise<AIToolResult> {
    const capaModel = this.db.capa || this.db.correctiveAction;
    if (!capaModel) return { success: false, tool: 'create_capa', message: 'Módulo de CAPA no disponible.' };

    const capa = await capaModel.create({
      data: {
        tenantId,
        title: params.title,
        rootCause: params.rootCause || null,
        description: params.action || null,
        status: 'OPEN',
        createdById: userId,
      }
    });

    return {
      success: true,
      tool: 'create_capa',
      entityId: capa.id,
      entityType: 'capa',
      message: `✅ CAPA **"${capa.title}"** creada exitosamente.`,
      data: { id: capa.id, title: capa.title, status: capa.status },
    };
  }

  private async getProjectsSummary(tenantId: string): Promise<AIToolResult> {
    const projects = await this.db.project360?.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: { id: true, name: true, status: true, progress: true, client: true, budget: true, riskLevel: true }
    }) || [];

    if (projects.length === 0) {
      return { success: true, tool: 'get_projects_summary', message: 'Sin datos disponibles — no hay proyectos cargados.', data: [] };
    }

    const active = projects.filter((p: any) => p.status === 'ACTIVE').length;
    const atRisk = projects.filter((p: any) => p.riskLevel === 'HIGH' || p.status === 'AT_RISK').length;
    const planning = projects.filter((p: any) => p.status === 'PLANNING').length;
    const completed = projects.filter((p: any) => p.status === 'COMPLETED').length;

    const summary = `📊 **Resumen de Proyectos** (${projects.length} total)\n` +
      `- Activos: ${active} | En planificación: ${planning} | Completados: ${completed}\n` +
      (atRisk > 0 ? `- ⚠️ En riesgo: ${atRisk}\n` : '') +
      `\n**Proyectos recientes:**\n` +
      projects.slice(0, 5).map((p: any) =>
        `- ${p.name} (${p.status}, ${p.progress}%${p.client ? ` — ${p.client}` : ''})`
      ).join('\n');

    return { success: true, tool: 'get_projects_summary', message: summary, data: projects };
  }

  private async getQualitySummary(tenantId: string): Promise<AIToolResult> {
    const ncrModel = this.db.nonConformityReport || this.db.ncr || this.db.nonConformity;
    const capaModel = this.db.capa || this.db.correctiveAction;

    const [ncrs, capas] = await Promise.all([
      ncrModel ? ncrModel.findMany({ where: { tenantId }, select: { status: true, severity: true } }) : [],
      capaModel ? capaModel.findMany({ where: { tenantId }, select: { status: true } }) : [],
    ]);

    const openNCRs = ncrs.filter((n: any) => n.status !== 'CLOSED').length;
    const criticalNCRs = ncrs.filter((n: any) => n.severity === 'CRITICAL' || n.severity === 'HIGH').length;
    const openCAPAs = capas.filter((c: any) => c.status !== 'CLOSED' && c.status !== 'COMPLETED').length;

    if (ncrs.length === 0 && capas.length === 0) {
      return { success: true, tool: 'get_quality_summary', message: 'Sin datos disponibles — no hay registros de calidad cargados.', data: {} };
    }

    const summary = `🔍 **Estado de Calidad**\n` +
      `- NCRs abiertas: ${openNCRs} de ${ncrs.length} total` +
      (criticalNCRs > 0 ? ` (⚠️ ${criticalNCRs} críticas/altas)` : '') + `\n` +
      `- CAPAs pendientes: ${openCAPAs} de ${capas.length} total`;

    return { success: true, tool: 'get_quality_summary', message: summary, data: { ncrs: ncrs.length, openNCRs, capas: capas.length, openCAPAs } };
  }

  private async getHRSummary(tenantId: string): Promise<AIToolResult> {
    const employees = await this.db.employee?.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, status: true, department: true }
    }) || [];

    if (employees.length === 0) {
      return { success: true, tool: 'get_hr_summary', message: 'Sin datos disponibles — no hay empleados cargados.', data: {} };
    }

    const active = employees.filter((e: any) => e.status === 'ACTIVE').length;
    const summary = `👥 **Recursos Humanos**\n- Empleados activos: ${active} de ${employees.length} total`;
    return { success: true, tool: 'get_hr_summary', message: summary, data: { total: employees.length, active } };
  }

  private async getFleetSummary(tenantId: string): Promise<AIToolResult> {
    const vehicles = await this.db.vehiculo?.findMany({
      where: { tenantId },
      select: { id: true, estado: true, tipo: true, dominio: true }
    }) || [];

    if (vehicles.length === 0) {
      return { success: true, tool: 'get_fleet_summary', message: 'Sin datos disponibles — no hay vehículos cargados.', data: {} };
    }

    const active = vehicles.filter((v: any) => v.estado === 'ACTIVO' || v.estado === 'OPERATIVO').length;
    const summary = `🚛 **Flota de Vehículos**\n- Total: ${vehicles.length} | Operativos: ${active}`;
    return { success: true, tool: 'get_fleet_summary', message: summary, data: { total: vehicles.length, active } };
  }

  /**
   * Registra la acción en ai_actions para auditoría
   */
  private async auditAction(tenantId: string, userId: string, toolName: string, params: any): Promise<void> {
    try {
      await this.db.aIAction?.create({
        data: {
          tenantId,
          userId,
          type: 'CREATE_ENTITY',
          description: `IA ejecutó herramienta: ${toolName}`,
          module: REGISTERED_TOOLS.find(t => t.name === toolName)?.module || 'unknown',
          payload: params,
          status: 'COMPLETED',
          executedAt: new Date(),
          completedAt: new Date(),
        }
      });
    } catch {
      // Auditoría no crítica
    }
  }

  /**
   * Lista las herramientas disponibles para el rol dado
   */
  getAvailableTools(userRole: string): AITool[] {
    return REGISTERED_TOOLS.filter(t =>
      t.requiredRole.includes(userRole) || userRole === 'TENANT_ADMIN'
    );
  }
}
