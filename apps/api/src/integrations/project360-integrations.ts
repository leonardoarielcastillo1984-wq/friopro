// Integraciones de PROJECT360 con módulos existentes de SGI360

import { FastifyInstance } from 'fastify';

export class Project360Integrations {
  constructor(private app: FastifyInstance) {}

  // Hook para auditorías - generar proyectos automáticamente
  async registerAuditHooks() {
    // Cuando se crea un hallazgo de auditoría
    this.app.addHook('onRequest', async (request, reply) => {
      if (request.url?.includes('/auditorias/findings') && request.method === 'POST') {
        // Procesar después de crear el hallazgo
        setTimeout(async () => {
          const body = request.body as any;
          if (body.severity && body.auditId) {
            await this.app.project360AutoGeneration.handleAuditFinding(
              body.auditId,
              body.id,
              body.severity
            );
          }
        }, 100);
      }
    });
  }

  // Hook para incidentes
  async registerIncidentHooks() {
    this.app.addHook('onRequest', async (request, reply) => {
      if (request.url?.includes('/incidents') && request.method === 'POST') {
        setTimeout(async () => {
          const body = request.body as any;
          if (body.id && body.severity) {
            await this.app.project360AutoGeneration.handleIncident(body.id);
          }
        }, 100);
      }
    });
  }

  // Hook para simulacros
  async registerDrillHooks() {
    this.app.addHook('onRequest', async (request, reply) => {
      if (request.url?.includes('/simulacros/deviations') && request.method === 'POST') {
        setTimeout(async () => {
          const body = request.body as any;
          if (body.drillId && body.id && body.severity) {
            await this.app.project360AutoGeneration.handleDrillDeviation(
              body.drillId,
              body.id
            );
          }
        }, 100);
      }
    });
  }

  // Hook para mantenimiento
  async registerMaintenanceHooks() {
    this.app.addHook('onRequest', async (request, reply) => {
      if (request.url?.includes('/mantenimiento/work-orders') && request.method === 'POST') {
        setTimeout(async () => {
          const body = request.body as any;
          if (body.id && (body.priority === 'CRITICAL' || body.type === 'EMERGENCY')) {
            await this.app.project360AutoGeneration.handleMaintenanceIssue(body.id);
          }
        }, 100);
      }
    });
  }

  // Hook para riesgos
  async registerRiskHooks() {
    this.app.addHook('onRequest', async (request, reply) => {
      if (request.url?.includes('/riesgos') && request.method === 'POST') {
        setTimeout(async () => {
          const body = request.body as any;
          if (body.id && body.status === 'CRITICAL') {
            await this.app.project360AutoGeneration.handleCriticalRisk(body.id);
          }
        }, 100);
      }
    });
  }

  // Integración con indicadores - impacto en KPIs
  async updateIndicatorImpact(projectId: string, indicatorId: string, newValue: number) {
    try {
      // Actualizar valor actual del indicador
      await this.app.prisma.actionProject.update({
        where: { id: projectId },
        data: { currentValue: newValue }
      });

      // Recalcular impacto en el indicador principal
      const indicator = await this.app.prisma.indicator.findUnique({
        where: { id: indicatorId }
      });

      if (indicator) {
        // Aquí iría la lógica para actualizar el valor del indicador principal
        // basado en los valores de los proyectos asociados
        console.log(`📊 Actualizando impacto en indicador ${indicator.name}: ${newValue}`);
      }
    } catch (error) {
      console.error('Error actualizando impacto en indicador:', error);
    }
  }

  // Integración con RRHH - asignación automática de responsables
  async autoAssignResponsible(projectId: string, area: string, requiredSkills: string[]) {
    try {
      // Buscar usuarios con las habilidades requeridas
      const candidates = await this.app.prisma.platformUser.findMany({
        where: {
          tenantId: (await this.app.prisma.actionProject.findUnique({
            where: { id: projectId },
            select: { tenantId: true }
          }))?.tenantId,
          // Aquí iría la lógica para buscar por habilidades y área
        }
      });

      if (candidates.length > 0) {
        // Seleccionar el mejor candidato (menos carga de trabajo, mayor experiencia, etc.)
        const bestCandidate = candidates[0]; // Simplificado

        await this.app.prisma.actionProject.update({
          where: { id: projectId },
          data: { responsibleId: bestCandidate.id }
        });

        console.log(`👤 Asignado automáticamente responsable: ${bestCandidate.firstName} ${bestCandidate.lastName}`);
      }
    } catch (error) {
      console.error('Error asignando responsable automáticamente:', error);
    }
  }

  // Integración con informe a dirección
  async generateExecutiveReport(tenantId: string) {
    try {
      const projects = await this.app.prisma.actionProject.findMany({
        where: { tenantId },
        include: {
          responsible: {
            select: { id: true, firstName: true, lastName: true }
          },
          indicator: {
            select: { id: true, name: true, unit: string }
          }
        }
      });

      const report = {
        summary: {
          totalProjects: projects.length,
          activeProjects: projects.filter(p => ['PENDING', 'IN_PROGRESS', 'AT_RISK'].includes(p.status)).length,
          completedProjects: projects.filter(p => p.status === 'COMPLETED').length,
          overdueProjects: projects.filter(p => {
            const dueDate = new Date(p.targetDate);
            return dueDate < new Date() && p.status !== 'COMPLETED';
          }).length,
          avgProgress: projects.reduce((sum, p) => sum + p.progress, 0) / projects.length
        },
        byStatus: projects.reduce((acc, project) => {
          acc[project.status] = (acc[project.status] || 0) + 1;
          return acc;
        }, {}),
        byOrigin: projects.reduce((acc, project) => {
          acc[project.origin] = (acc[project.origin] || 0) + 1;
          return acc;
        }, {}),
        byPriority: projects.reduce((acc, project) => {
          acc[project.priority] = (acc[project.priority] || 0) + 1;
          return acc;
        }, {}),
        criticalProjects: projects.filter(p => p.priority === 'CRITICAL'),
        overdueProjects: projects.filter(p => {
          const dueDate = new Date(p.targetDate);
          return dueDate < new Date() && p.status !== 'COMPLETED';
        }),
        topAreas: this.calculateTopAreas(projects),
        recommendations: this.generateRecommendations(projects)
      };

      return report;
    } catch (error) {
      console.error('Error generando informe ejecutivo:', error);
      throw error;
    }
  }

  // Helper functions
  private calculateTopAreas(projects: any[]) {
    // Agrupar proyectos por área y calcular estadísticas
    const areas = projects.reduce((acc, project) => {
      const area = project.metadata?.area || 'General';
      if (!acc[area]) {
        acc[area] = { total: 0, completed: 0, overdue: 0, critical: 0 };
      }
      acc[area].total++;
      if (project.status === 'COMPLETED') acc[area].completed++;
      if (new Date(project.targetDate) < new Date() && project.status !== 'COMPLETED') acc[area].overdue++;
      if (project.priority === 'CRITICAL') acc[area].critical++;
      return acc;
    }, {});

    return Object.entries(areas)
      .map(([area, stats]: [string, any]) => ({
        area,
        ...stats,
        completionRate: (stats.completed / stats.total) * 100,
        overdueRate: (stats.overdue / stats.total) * 100
      }))
      .sort((a, b) => b.overdueRate - a.overdueRate)
      .slice(0, 5);
  }

  private generateRecommendations(projects: any[]) {
    const recommendations = [];

    // Proyectos vencidos
    const overdueCount = projects.filter(p => {
      const dueDate = new Date(p.targetDate);
      return dueDate < new Date() && p.status !== 'COMPLETED';
    }).length;

    if (overdueCount > 0) {
      recommendations.push({
        type: 'CRITICAL',
        title: 'Proyectos Vencidos',
        description: `${overdueCount} proyectos están vencidos. Se requiere acción inmediata para priorizar y reasignar recursos.`,
        action: 'Revisar calendario y reasignar recursos'
      });
    }

    // Proyectos críticos
    const criticalCount = projects.filter(p => p.priority === 'CRITICAL' && p.status !== 'COMPLETED').length;

    if (criticalCount > 0) {
      recommendations.push({
        type: 'HIGH',
        title: 'Proyectos Críticos',
        description: `${criticalCount} proyectos requieren atención crítica. Estos proyectos impactan directamente en la seguridad y cumplimiento normativo.`,
        action: 'Priorizar recursos y seguimiento diario'
      });
    }

    // Baja tasa de completación
    const activeProjects = projects.filter(p => ['PENDING', 'IN_PROGRESS', 'AT_RISK'].includes(p.status));
    const avgProgress = activeProjects.reduce((sum, p) => sum + p.progress, 0) / activeProjects.length;

    if (avgProgress < 50) {
      recommendations.push({
        type: 'MEDIUM',
        title: 'Baja Tasa de Avance',
        description: `El avance promedio de proyectos activos es del ${avgProgress.toFixed(1)}%. Se requiere revisión de obstáculos y recursos.`,
        action: 'Realizar reuniones de seguimiento y eliminar bloqueos'
      });
    }

    return recommendations;
  }
}
