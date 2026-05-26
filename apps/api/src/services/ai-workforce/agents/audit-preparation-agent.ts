import { PrismaClient } from '@prisma/client';
import { BaseAgent } from './base-agent.js';
import type { AIWorkforce, AgentTask } from '../index.js';

export class AIAuditPreparationAgent extends BaseAgent {
  public readonly name = 'AI Audit Preparation';
  public readonly capabilities = [
    'readiness_assessment',
    'evidence_gathering',
    'gap_identification',
    'checklist_generation',
    'documentation_review',
  ];

  constructor(db: PrismaClient, workforce: AIWorkforce) {
    super(db, workforce);
  }

  async execute(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'WEEKLY_READINESS':
        return await this.assessReadiness(task.tenantId);
      case 'PREPARE_AUDIT':
        return await this.prepareAudit(task.tenantId, task.payload);
      case 'GENERATE_CHECKLIST':
        return await this.generateChecklist(task.tenantId, task.payload);
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  private async assessReadiness(tenantId: string): Promise<any> {
    const db = this.db as any;

    // Gather data for readiness assessment
    const [
      upcomingAudits,
      openNCRs,
      openCAPAs,
      documents,
      recentAudits,
    ] = await Promise.all([
      db.audit?.findMany?.({
        where: {
          tenantId,
          plannedDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 86400000) },
          status: { in: ['PLANNED', 'SCHEDULED'] },
        },
      }) || [],
      (db.nonConformityReport || db.ncr)?.findMany?.({
        where: { tenantId, status: { not: 'CLOSED' } },
      }) || [],
      (db.capa || db.correctiveAction)?.findMany?.({
        where: { tenantId, status: { not: 'CLOSED' } },
      }) || [],
      db.document?.findMany?.({
        where: { tenantId, status: 'ACTIVE' },
        take: 100,
      }) || [],
      db.audit?.findMany?.({
        where: { tenantId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        take: 5,
      }) || [],
    ]);

    const readiness: any = {
      overall: 'NEEDS_ATTENTION',
      factors: {
        openNCRs: { count: openNCRs.length, impact: openNCRs.length > 5 ? 'NEGATIVE' : 'NEUTRAL' },
        openCAPAs: { count: openCAPAs.length, impact: openCAPAs.length > 3 ? 'NEGATIVE' : 'NEUTRAL' },
        documentCompleteness: { score: 0.85, status: 'ACCEPTABLE' },
        previousAuditFindings: recentAudits.length > 0 ? 'CLOSED' : 'N/A',
      },
      upcomingAudits: upcomingAudits.map((a: any) => ({
        id: a.id,
        type: a.type,
        date: a.plannedDate,
        readiness: a.type === 'EXTERNAL' && openNCRs.length > 5 ? 'AT_RISK' : 'ACCEPTABLE',
      })),
      recommendations: [],
    };

    // Generate recommendations
    if (openNCRs.length > 5) {
      readiness.recommendations.push({
        priority: 'HIGH',
        action: 'ACCELERAR_CIERRE_NCRS',
        message: `${openNCRs.length} NCRs abiertas pueden afectar auditoría externa`,
      });
    }

    if (upcomingAudits.some((a: any) => a.type === 'CERTIFICATION' || a.type === 'EXTERNAL')) {
      readiness.recommendations.push({
        priority: 'CRITICAL',
        action: 'FULL_READINESS_REVIEW',
        message: 'Auditoría externa/certificación requiere revisión completa de evidencias',
      });
    }

    // Notify if external audit coming
    const externalAudits = upcomingAudits.filter((a: any) => 
      a.type === 'EXTERNAL' || a.type === 'CERTIFICATION'
    );
    
    if (externalAudits.length > 0) {
      await this.createNotification(
        tenantId,
        'Preparación de Auditoría Requerida',
        `${externalAudits.length} auditoría(s) externa(s) próxima(s). Estado de preparación: ${readiness.overall}`,
        'HIGH'
      );
    }

    return readiness;
  }

  private async prepareAudit(tenantId: string, payload: any): Promise<any> {
    const { auditId } = payload;
    
    // Generate preparation package
    return {
      auditId,
      preparationPackage: {
        requiredDocuments: [],
        evidenceToGather: [],
        interviewsToSchedule: [],
        checklists: [],
      },
      generatedAt: new Date(),
    };
  }

  private async generateChecklist(tenantId: string, payload: any): Promise<any> {
    const { auditType, standard } = payload;
    
    // Generate ISO-specific checklist
    const checklist = {
      auditType,
      standard,
      items: this.generateISOChecklistItems(standard),
      generatedAt: new Date(),
    };

    return checklist;
  }

  private generateISOChecklistItems(standard: string): any[] {
    const baseItems = [
      { clause: '4.1', topic: 'Entorno de la organización', evidence: 'Contextos, interesados' },
      { clause: '4.2', topic: 'Partes interesadas', evidence: 'Matriz de partes interesadas' },
      { clause: '4.3', topic: 'Alcance del SGC', evidence: 'Declaración de alcance' },
      { clause: '4.4', topic: 'SGC y procesos', evidence: 'Mapa de procesos' },
      { clause: '5.1', topic: 'Liderazgo y compromiso', evidence: 'Evidencias de liderazgo' },
      { clause: '5.2', topic: 'Política de calidad', evidence: 'Política comunicada' },
      { clause: '5.3', topic: 'Roles y responsabilidades', evidence: 'Organigrama, funciones' },
      { clause: '6.1', topic: 'Riesgos y oportunidades', evidence: 'Análisis de riesgos' },
      { clause: '6.2', topic: 'Objetivos de calidad', evidence: 'Objetivos SMART' },
      { clause: '7.1', topic: 'Recursos', evidence: 'Presupuestos, asignaciones' },
      { clause: '7.2', topic: 'Competencia', evidence: 'Matriz de competencias' },
      { clause: '7.5', topic: 'Información documentada', evidence: 'Documentos controlados' },
      { clause: '8.1', topic: 'Operación planificada', evidence: 'Procedimientos' },
      { clause: '8.2', topic: 'Requisitos del cliente', evidence: 'Contratos, pedidos' },
      { clause: '8.3', topic: 'Diseño y desarrollo', evidence: 'Evidencias de diseño' },
      { clause: '8.4', topic: 'Control de procesos externos', evidence: 'Evaluación de proveedores' },
      { clause: '8.5', topic: 'Producción y servicio', evidence: 'Evidencias de control' },
      { clause: '8.6', topic: 'Liberación del producto', evidence: 'Inspecciones finales' },
      { clause: '8.7', topic: 'NC y acciones correctivas', evidence: 'NCRs, CAPAs' },
      { clause: '9.1', topic: 'Seguimiento y medición', evidence: 'Indicadores, auditorías' },
      { clause: '9.2', topic: 'Auditoría interna', evidence: 'Programa de auditorías' },
      { clause: '9.3', topic: 'Revisión por la dirección', evidence: 'Actas de revisión' },
      { clause: '10.1', topic: 'Mejora continua', evidence: 'Evidencias de mejora' },
    ];

    return baseItems;
  }
}
