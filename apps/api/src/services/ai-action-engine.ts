/**
 * AI ACTION ENGINE
 * SGI360 Command Center - Ejecución de acciones sugeridas por IA
 * 
 * Permite que la IA ejecute acciones reales en el sistema:
 * - Crear proyectos
 * - Generar NCR/CAPAs
 * - Crear tareas
 * - Enviar notificaciones
 * - Generar reportes
 */

import { PrismaClient } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { AIActionType } from './ai-orchestrator';

interface AIActionRequest {
  type: AIActionType;
  description: string;
  module: string;
  entityId?: string;
  payload: any;
  tenantId: string;
  userId: string;
}

interface AIActionResult {
  success: boolean;
  entityId?: string;
  message: string;
  data?: any;
  error?: string;
}

export class AIActionEngine {
  private prisma: PrismaClient;
  private app: FastifyInstance;

  constructor(prisma: PrismaClient, app: FastifyInstance) {
    this.prisma = prisma;
    this.app = app;
  }

  /**
   * Ejecuta una acción solicitada por la IA
   */
  async executeAction(request: AIActionRequest): Promise<AIActionResult> {
    try {
      // Registrar acción en BD
      const actionRecord = await this.prisma.aIAction.create({
        data: {
          tenantId: request.tenantId,
          userId: request.userId,
          type: request.type,
          description: request.description,
          module: request.module,
          entityId: request.entityId,
          payload: request.payload,
          status: 'EXECUTING',
          executedAt: new Date()
        }
      });

      let result: AIActionResult;

      // Ejecutar acción según tipo
      switch (request.type) {
        case 'CREATE_PROJECT':
          result = await this.createProject(request);
          break;
        
        case 'CREATE_NCR':
          result = await this.createNCR(request);
          break;
        
        case 'CREATE_CAPA':
          result = await this.createCAPA(request);
          break;
        
        case 'CREATE_TASK':
          result = await this.createTask(request);
          break;
        
        case 'GENERATE_REPORT':
          result = await this.generateReport(request);
          break;
        
        case 'SEND_NOTIFICATION':
          result = await this.sendNotification(request);
          break;
        
        case 'SCHEDULE_EVENT':
          result = await this.scheduleEvent(request);
          break;
        
        case 'UPDATE_ENTITY':
          result = await this.updateEntity(request);
          break;
        
        case 'ANALYZE_DATA':
          result = await this.analyzeData(request);
          break;

        case 'CREATE_AUDIT':
          result = await this.createAudit(request);
          break;

        case 'CREATE_RISK':
          result = await this.createRisk(request);
          break;

        case 'CREATE_MAINTENANCE_TICKET':
          result = await this.createMaintenanceTicket(request);
          break;

        case 'SCHEDULE_TRAINING':
          result = await this.scheduleTraining(request);
          break;
        
        default:
          result = {
            success: false,
            message: `Tipo de acción no soportado: ${request.type}`,
            error: 'UNSUPPORTED_ACTION_TYPE'
          };
      }

      // Actualizar registro con resultado
      await this.prisma.aIAction.update({
        where: { id: actionRecord.id },
        data: {
          status: result.success ? 'COMPLETED' : 'FAILED',
          result: result,
          errorMessage: result.error,
          completedAt: new Date()
        }
      });

      return result;

    } catch (error: any) {
      console.error('[AI Action Engine] Error:', error);
      return {
        success: false,
        message: 'Error al ejecutar la acción',
        error: error.message
      };
    }
  }

  /**
   * Crear un proyecto desde IA
   */
  private async createProject(request: AIActionRequest): Promise<AIActionResult> {
    try {
      const project360Model = (this.prisma as any).project360;
      if (!project360Model) {
        return { success: false, message: 'Módulo Project360 no disponible' };
      }

      const payload = request.payload;
      const project = await project360Model.create({
        data: {
          tenantId: request.tenantId,
          name: payload.name || 'Proyecto generado por IA',
          description: payload.description || request.description,
          type: payload.type || 'IMPROVEMENT',
          priority: payload.priority || 'MEDIUM',
          status: 'PLANNING',
          startDate: payload.startDate ? new Date(payload.startDate) : new Date(),
          endDate: payload.endDate ? new Date(payload.endDate) : null,
          budget: payload.budget || 0,
          actualCost: 0,
          progress: 0,
          ownerId: request.userId,
          createdById: request.userId,
          // Metadata IA
          metadata: {
            aiGenerated: true,
            aiRequest: request.description,
            aiConfidence: payload.confidence || 0.8
          }
        }
      });

      // Enviar notificación
      await this.sendSystemNotification(
        request.tenantId,
        request.userId,
        'Proyecto Creado',
        `La IA ha creado el proyecto "${project.name}" basado en tu solicitud.`,
        { entityId: project.id, entityType: 'project' }
      );

      return {
        success: true,
        entityId: project.id,
        message: `Proyecto "${project.name}" creado exitosamente`,
        data: project
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Error al crear proyecto',
        error: error.message
      };
    }
  }

  /**
   * Crear una NCR (No Conformity Report)
   */
  private async createNCR(request: AIActionRequest): Promise<AIActionResult> {
    try {
      const payload = request.payload;
      
      const ncr = await this.prisma.nonConformity.create({
        data: {
          tenantId: request.tenantId,
          code: await this.generateNCRCode(request.tenantId),
          title: payload.title || 'NCR generada por IA',
          description: payload.description || request.description,
          severity: payload.severity || 'MEDIUM',
          source: 'INTERNAL_AUDIT',
          status: 'OPEN',
          detectedAt: new Date(),
          createdById: request.userId,
          // Metadata IA
          aiFindingId: payload.aiFindingId || null,
          process: payload.process || null,
          stakeholderId: payload.stakeholderId || null
        }
      });

      // Asignar si hay responsable
      if (payload.assignedToId) {
        await this.prisma.nonConformity.update({
          where: { id: ncr.id },
          data: { assignedToId: payload.assignedToId }
        });
      }

      await this.sendSystemNotification(
        request.tenantId,
        payload.assignedToId || request.userId,
        'NCR Creada',
        `La IA ha generado la NCR "${ncr.code}: ${ncr.title}"`,
        { entityId: ncr.id, entityType: 'ncr' }
      );

      return {
        success: true,
        entityId: ncr.id,
        message: `NCR "${ncr.code}" creada exitosamente`,
        data: ncr
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Error al crear NCR',
        error: error.message
      };
    }
  }

  /**
   * Crear una CAPA (Corrective/Preventive Action)
   */
  private async createCAPA(request: AIActionRequest): Promise<AIActionResult> {
    try {
      const capaModel = (this.prisma as any).capa;
      if (!capaModel) {
        return { success: false, message: 'Módulo CAPA no disponible' };
      }

      const payload = request.payload;
      
      const capa = await capaModel.create({
        data: {
          tenantId: request.tenantId,
          title: payload.title || 'CAPA generada por IA',
          description: payload.description || request.description,
          type: payload.type || 'CORRECTIVE',
          priority: payload.priority || 'MEDIUM',
          status: 'OPEN',
          dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
          sourceId: payload.sourceId || null,
          sourceType: payload.sourceType || 'NCR',
          assignedToId: payload.assignedToId || request.userId,
          createdById: request.userId,
          // Metadata IA
          metadata: {
            aiGenerated: true,
            aiRequest: request.description
          }
        }
      });

      await this.sendSystemNotification(
        request.tenantId,
        payload.assignedToId || request.userId,
        'CAPA Creada',
        `La IA ha creado la CAPA "${capa.title}"`,
        { entityId: capa.id, entityType: 'capa' }
      );

      return {
        success: true,
        entityId: capa.id,
        message: `CAPA "${capa.title}" creada exitosamente`,
        data: capa
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Error al crear CAPA',
        error: error.message
      };
    }
  }

  /**
   * Crear una tarea
   */
  private async createTask(request: AIActionRequest): Promise<AIActionResult> {
    try {
      const taskModel = (this.prisma as any).task;
      if (!taskModel) {
        return { success: false, message: 'Módulo de Tareas no disponible' };
      }

      const payload = request.payload;
      
      const task = await taskModel.create({
        data: {
          tenantId: request.tenantId,
          title: payload.title || request.description,
          description: payload.description || '',
          status: 'TODO',
          priority: payload.priority || 'MEDIUM',
          assignedToId: payload.assignedToId || request.userId,
          createdById: request.userId,
          dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
          projectId: payload.projectId || null,
          // Metadata IA
          metadata: {
            aiGenerated: true,
            aiRequest: request.description
          }
        }
      });

      await this.sendSystemNotification(
        request.tenantId,
        payload.assignedToId || request.userId,
        'Tarea Creada',
        `La IA ha creado la tarea "${task.title}"`,
        { entityId: task.id, entityType: 'task' }
      );

      return {
        success: true,
        entityId: task.id,
        message: `Tarea "${task.title}" creada exitosamente`,
        data: task
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Error al crear tarea',
        error: error.message
      };
    }
  }

  /**
   * Generar un reporte
   */
  private async generateReport(request: AIActionRequest): Promise<AIActionResult> {
    try {
      const payload = request.payload;
      
      // Crear registro del reporte
      const report = await this.prisma.document.create({
        data: {
          tenantId: request.tenantId,
          title: payload.title || 'Reporte generado por IA',
          description: request.description,
          type: 'REPORT',
          status: 'DRAFT',
          createdById: request.userId,
          metadata: {
            aiGenerated: true,
            reportType: payload.reportType || 'GENERAL',
            filters: payload.filters || {},
            aiRequest: request.description
          }
        }
      });

      // TODO: Generar contenido del reporte con IA
      // Por ahora, crear estructura básica
      
      return {
        success: true,
        entityId: report.id,
        message: `Reporte "${report.title}" creado exitosamente`,
        data: report
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Error al generar reporte',
        error: error.message
      };
    }
  }

  /**
   * Enviar notificación
   */
  private async sendNotification(request: AIActionRequest): Promise<AIActionResult> {
    try {
      const payload = request.payload;
      
      await this.sendSystemNotification(
        request.tenantId,
        payload.recipientId || request.userId,
        payload.title || 'Notificación IA',
        payload.message || request.description,
        payload.metadata || {}
      );

      return {
        success: true,
        message: 'Notificación enviada exitosamente'
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Error al enviar notificación',
        error: error.message
      };
    }
  }

  /**
   * Programar evento
   */
  private async scheduleEvent(request: AIActionRequest): Promise<AIActionResult> {
    try {
      const payload = request.payload;
      
      const event = await this.prisma.calendarEvent?.create?.({
        data: {
          tenantId: request.tenantId,
          title: payload.title || request.description,
          description: payload.description || '',
          startTime: payload.startTime ? new Date(payload.startTime) : new Date(),
          endTime: payload.endTime ? new Date(payload.endTime) : null,
          attendees: payload.attendees || [request.userId],
          createdById: request.userId,
          metadata: {
            aiGenerated: true,
            aiRequest: request.description
          }
        }
      });

      return {
        success: true,
        entityId: event?.id,
        message: `Evento "${payload.title}" programado exitosamente`,
        data: event
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Error al programar evento',
        error: error.message
      };
    }
  }

  /**
   * Actualizar entidad existente
   */
  private async updateEntity(request: AIActionRequest): Promise<AIActionResult> {
    try {
      const payload = request.payload;
      
      if (!request.entityId) {
        return { success: false, message: 'EntityId requerido para actualizar' };
      }

      // Actualizar según módulo
      let updatedEntity;
      switch (request.module) {
        case 'project360':
          updatedEntity = await (this.prisma as any).project360?.update?.({
            where: { id: request.entityId },
            data: payload.updates
          });
          break;
        
        case 'ncr':
          updatedEntity = await this.prisma.nonConformity.update({
            where: { id: request.entityId },
            data: payload.updates
          });
          break;
        
        default:
          return { success: false, message: `Módulo no soportado para actualización: ${request.module}` };
      }

      return {
        success: true,
        entityId: request.entityId,
        message: 'Entidad actualizada exitosamente',
        data: updatedEntity
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Error al actualizar entidad',
        error: error.message
      };
    }
  }

  /**
   * Analizar datos (simulado)
   */
  private async analyzeData(request: AIActionRequest): Promise<AIActionResult> {
    try {
      const payload = request.payload;
      
      // Simular análisis de datos
      const analysis = {
        analyzedAt: new Date(),
        dataSource: payload.dataSource,
        insights: [
          'Patrón detectado: tendencia al alza en costos',
          'Recomendación: revisar presupuestos',
          'Alerta: posible desviación en Q3'
        ],
        confidence: 0.85
      };

      return {
        success: true,
        message: 'Análisis de datos completado',
        data: analysis
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Error al analizar datos',
        error: error.message
      };
    }
  }

  /**
   * Crear una auditoría desde IA
   */
  private async createAudit(request: AIActionRequest): Promise<AIActionResult> {
    try {
      const db = this.prisma as any;
      const auditModel = db.audit;
      if (!auditModel) return { success: false, message: 'Módulo Auditorías no disponible' };

      const payload = request.payload;
      const audit = await auditModel.create({
        data: {
          tenantId: request.tenantId,
          title: payload.title || 'Auditoría generada por IA',
          description: payload.description || request.description,
          type: payload.type || 'INTERNAL',
          status: 'PLANNED',
          scope: payload.scope || 'General',
          plannedDate: payload.date ? new Date(payload.date) : new Date(Date.now() + 7 * 86400000),
          createdById: request.userId,
          metadata: { aiGenerated: true, aiRequest: request.description }
        }
      });

      await this.sendSystemNotification(request.tenantId, request.userId, 'Auditoría Programada', `La IA ha programado la auditoría "${audit.title}".`, { entityId: audit.id, entityType: 'audit' });
      return { success: true, entityId: audit.id, message: `Auditoría "${audit.title}" programada exitosamente`, data: audit };
    } catch (error: any) {
      return { success: false, message: 'Error al crear auditoría', error: error.message };
    }
  }

  /**
   * Crear un riesgo desde IA
   */
  private async createRisk(request: AIActionRequest): Promise<AIActionResult> {
    try {
      const db = this.prisma as any;
      const riskModel = db.risk;
      if (!riskModel) return { success: false, message: 'Módulo Riesgos no disponible' };

      const payload = request.payload;
      const risk = await riskModel.create({
        data: {
          tenantId: request.tenantId,
          title: payload.title || 'Riesgo detectado por IA',
          description: payload.description || request.description,
          category: payload.category || 'OPERATIONAL',
          level: payload.level || 'MEDIUM',
          probability: payload.probability || 3,
          impact: payload.impact || 3,
          status: 'IDENTIFIED',
          owner: request.userId,
          mitigationPlan: payload.mitigation || '',
          metadata: { aiGenerated: true, aiRequest: request.description }
        }
      });

      await this.sendSystemNotification(request.tenantId, request.userId, 'Riesgo Identificado', `La IA ha identificado el riesgo "${risk.title}".`, { entityId: risk.id, entityType: 'risk' });
      return { success: true, entityId: risk.id, message: `Riesgo "${risk.title}" registrado exitosamente`, data: risk };
    } catch (error: any) {
      return { success: false, message: 'Error al crear riesgo', error: error.message };
    }
  }

  /**
   * Crear ticket de mantenimiento desde IA
   */
  private async createMaintenanceTicket(request: AIActionRequest): Promise<AIActionResult> {
    try {
      const db = this.prisma as any;
      const payload = request.payload;

      // Try to create via maintenance model or as a task
      const taskModel = db.task || db.maintenanceOrder;
      if (!taskModel) return { success: false, message: 'Módulo Mantenimiento no disponible' };

      const ticket = await taskModel.create({
        data: {
          tenantId: request.tenantId,
          title: payload.title || 'Ticket de mantenimiento (IA)',
          description: payload.description || request.description,
          type: payload.type || 'CORRECTIVE',
          priority: payload.priority || 'MEDIUM',
          status: 'PENDING',
          createdById: request.userId,
          assignedTo: payload.assignedTo || null,
          vehicleId: payload.vehicleId || null,
          metadata: { aiGenerated: true, aiRequest: request.description }
        }
      });

      return { success: true, entityId: ticket.id, message: `Ticket de mantenimiento "${ticket.title}" creado`, data: ticket };
    } catch (error: any) {
      return { success: false, message: 'Error al crear ticket de mantenimiento', error: error.message };
    }
  }

  /**
   * Programar capacitación desde IA
   */
  private async scheduleTraining(request: AIActionRequest): Promise<AIActionResult> {
    try {
      const db = this.prisma as any;
      const trainingModel = db.training;
      if (!trainingModel) return { success: false, message: 'Módulo Capacitaciones no disponible' };

      const payload = request.payload;
      const training = await trainingModel.create({
        data: {
          tenantId: request.tenantId,
          title: payload.title || 'Capacitación sugerida por IA',
          description: payload.description || request.description,
          type: payload.type || 'INTERNAL',
          status: 'PLANNED',
          startDate: payload.date ? new Date(payload.date) : new Date(Date.now() + 14 * 86400000),
          createdById: request.userId,
          metadata: { aiGenerated: true, aiRequest: request.description }
        }
      });

      return { success: true, entityId: training.id, message: `Capacitación "${training.title}" programada`, data: training };
    } catch (error: any) {
      return { success: false, message: 'Error al programar capacitación', error: error.message };
    }
  }

  /**
   * Generar código único para NCR
   */
  private async generateNCRCode(tenantId: string): Promise<string> {
    const count = await this.prisma.nonConformity.count({
      where: { tenantId }
    });
    
    const year = new Date().getFullYear();
    return `NCR-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  /**
   * Enviar notificación del sistema
   */
  private async sendSystemNotification(
    tenantId: string,
    userId: string,
    title: string,
    message: string,
    metadata?: any
  ): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          tenantId,
          userId,
          type: 'SYSTEM_ALERT',
          title,
          message,
          metadata: metadata || {},
          isRead: false
        }
      });
    } catch (error) {
      console.error('[AI Action Engine] Error sending notification:', error);
    }
  }

  /**
   * Obtener historial de acciones ejecutadas
   */
  async getActionHistory(tenantId: string, limit: number = 50): Promise<any[]> {
    return this.prisma.aIAction.findMany({
      where: { tenantId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  /**
   * Obtener estadísticas de acciones
   */
  async getActionStats(tenantId: string): Promise<any> {
    const stats = await this.prisma.aIAction.groupBy({
      by: ['type', 'status'],
      where: { tenantId },
      _count: true
    });

    return {
      total: stats.reduce((sum, s) => sum + s._count, 0),
      completed: stats.filter(s => s.status === 'COMPLETED').reduce((sum, s) => sum + s._count, 0),
      failed: stats.filter(s => s.status === 'FAILED').reduce((sum, s) => sum + s._count, 0),
      byType: stats.reduce((acc, s) => {
        acc[s.type] = (acc[s.type] || 0) + s._count;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}

export default AIActionEngine;
