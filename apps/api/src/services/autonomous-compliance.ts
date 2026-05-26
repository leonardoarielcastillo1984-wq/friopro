/**
 * AUTONOMOUS COMPLIANCE ENGINE
 * FASE 8 — AI-Native Organization
 * 
 * Motor autónomo normativo que:
 * - Detecta cambios normativos
 * - Mapea impacto
 * - Sugiere actualizaciones
 * - Genera gaps
 * - Recomienda acciones
 * 
 * NORMAS: ISO 9001, 14001, 45001, 39001, IATF 16949
 */

import { PrismaClient } from '@prisma/client';

// ============================================================
// TYPES
// ============================================================

export type StandardCode = 'ISO_9001' | 'ISO_14001' | 'ISO_45001' | 'ISO_39001' | 'IATF_16949';

export interface ComplianceRequirement {
  id: string;
  standard: StandardCode;
  clause: string;
  title: string;
  description: string;
  mandatory: boolean;
  evidenceRequired: string[];
  applicable: boolean;
  tenantId: string;
}

export interface ComplianceGap {
  id: string;
  requirementId: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  currentState: string;
  requiredState: string;
  evidenceGap: string[];
  recommendation: string;
  autoAction?: string;
  deadline?: Date;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  tenantId: string;
}

export interface ComplianceScore {
  standard: StandardCode;
  score: number; // 0-100
  requirements: {
    total: number;
    compliant: number;
    nonCompliant: number;
    notApplicable: number;
  };
  gaps: ComplianceGap[];
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  lastAssessment: Date;
}

export interface RegulatoryUpdate {
  id: string;
  standard: StandardCode;
  changeType: 'AMENDMENT' | 'NEW_CLAUSE' | 'WITHDRAWAL' | 'INTERPRETATION';
  description: string;
  effectiveDate: Date;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  requiresAction: boolean;
  suggestedActions: string[];
  acknowledged: boolean;
}

// ============================================================
// BUILT-IN COMPLIANCE FRAMEWORKS
// ============================================================

const ISO_9001_REQUIREMENTS: Omit<ComplianceRequirement, 'id' | 'applicable' | 'tenantId'>[] = [
  { standard: 'ISO_9001', clause: '4.1', title: 'Entorno de la organización', description: 'Determinar factores internos y externos', mandatory: true, evidenceRequired: ['Análisis de contexto', 'Partes interesadas'] },
  { standard: 'ISO_9001', clause: '4.2', title: 'Partes interesadas', description: 'Identificar partes interesadas y sus requisitos', mandatory: true, evidenceRequired: ['Matriz de partes interesadas'] },
  { standard: 'ISO_9001', clause: '4.3', title: 'Alcance del SGC', description: 'Determinar límites y aplicabilidad', mandatory: true, evidenceRequired: ['Declaración de alcance'] },
  { standard: 'ISO_9001', clause: '4.4', title: 'SGC y procesos', description: 'Establecer, implementar, mantener y mejorar procesos', mandatory: true, evidenceRequired: ['Mapa de procesos', 'Procedimientos'] },
  { standard: 'ISO_9001', clause: '5.1', title: 'Liderazgo y compromiso', description: 'Demostrar liderazgo y compromiso', mandatory: true, evidenceRequired: ['Evidencias de liderazgo'] },
  { standard: 'ISO_9001', clause: '5.2', title: 'Política de calidad', description: 'Establecer, implementar y mantener política', mandatory: true, evidenceRequired: ['Política documentada', 'Evidencias de comunicación'] },
  { standard: 'ISO_9001', clause: '5.3', title: 'Roles y responsabilidades', description: 'Asegurar asignación de responsabilidades', mandatory: true, evidenceRequired: ['Organigrama', 'Descripciones de cargo'] },
  { standard: 'ISO_9001', clause: '6.1', title: 'Riesgos y oportunidades', description: 'Planificar acciones para riesgos y oportunidades', mandatory: true, evidenceRequired: ['Análisis de riesgos', 'Planes de acción'] },
  { standard: 'ISO_9001', clause: '6.2', title: 'Objetivos de calidad', description: 'Establecer objetivos en todas las funciones', mandatory: true, evidenceRequired: ['Objetivos SMART', 'Indicadores'] },
  { standard: 'ISO_9001', clause: '6.3', title: 'Cambios planificados', description: 'Implementar cambios de forma planificada', mandatory: true, evidenceRequired: ['Registros de cambios'] },
  { standard: 'ISO_9001', clause: '7.1', title: 'Recursos', description: 'Determinar y proporcionar recursos', mandatory: true, evidenceRequired: ['Presupuestos', 'Asignaciones'] },
  { standard: 'ISO_9001', clause: '7.2', title: 'Competencia', description: 'Asegurar competencia del personal', mandatory: true, evidenceRequired: ['Matriz de competencias', 'Capacitaciones'] },
  { standard: 'ISO_9001', clause: '7.3', title: 'Toma de conciencia', description: 'Conciencia de política, objetivos y contribuciones', mandatory: true, evidenceRequired: ['Evidencias de comunicación'] },
  { standard: 'ISO_9001', clause: '7.4', title: 'Comunicación', description: 'Determinar comunicaciones internas y externas', mandatory: true, evidenceRequired: ['Plan de comunicación'] },
  { standard: 'ISO_9001', clause: '7.5', title: 'Información documentada', description: 'Controlar información documentada requerida', mandatory: true, evidenceRequired: ['Listado maestro', 'Documentos controlados'] },
  { standard: 'ISO_9001', clause: '8.1', title: 'Operación planificada', description: 'Planificar, implementar y controlar procesos', mandatory: true, evidenceRequired: ['Procedimientos operativos'] },
  { standard: 'ISO_9001', clause: '8.2', title: 'Requisitos de productos y servicios', description: 'Determinar y revisar requisitos', mandatory: true, evidenceRequired: ['Contratos', 'Pedidos'] },
  { standard: 'ISO_9001', clause: '8.3', title: 'Diseño y desarrollo', description: 'Controlar diseño y desarrollo', mandatory: false, evidenceRequired: ['Evidencias de diseño'] },
  { standard: 'ISO_9001', clause: '8.4', title: 'Control de procesos externos', description: 'Controlar producción y provisión externa', mandatory: true, evidenceRequired: ['Evaluación de proveedores', 'Órdenes de compra'] },
  { standard: 'ISO_9001', clause: '8.5', title: 'Producción y provisión de servicio', description: 'Controlar producción bajo condiciones controladas', mandatory: true, evidenceRequired: ['Evidencias de control'] },
  { standard: 'ISO_9001', clause: '8.6', title: 'Liberación de productos', description: 'Implementar actividades de monitoreo y medición', mandatory: true, evidenceRequired: ['Inspecciones', 'Certificados'] },
  { standard: 'ISO_9001', clause: '8.7', title: 'NC y acciones correctivas', description: 'Controlar NC y aplicar acciones correctivas', mandatory: true, evidenceRequired: ['NCRs', 'CAPAs'] },
  { standard: 'ISO_9001', clause: '9.1', title: 'Seguimiento, medición, análisis', description: 'Evaluar desempeño del SGC', mandatory: true, evidenceRequired: ['Indicadores', 'Análisis'] },
  { standard: 'ISO_9001', clause: '9.2', title: 'Auditoría interna', description: 'Realizar auditorías internas a intervalos planificados', mandatory: true, evidenceRequired: ['Programa de auditorías', 'Informes'] },
  { standard: 'ISO_9001', clause: '9.3', title: 'Revisión por la dirección', description: 'Revisar SGC a intervalos planificados', mandatory: true, evidenceRequired: ['Actas de revisión'] },
  { standard: 'ISO_9001', clause: '10.1', title: 'Mejora continua', description: 'Mejorar el SGC de forma continua', mandatory: true, evidenceRequired: ['Evidencias de mejora'] },
  { standard: 'ISO_9001', clause: '10.2', title: 'NC y acciones correctivas', description: 'Reaccionar ante NCs y evaluar acciones', mandatory: true, evidenceRequired: ['NCRs', 'Acciones correctivas'] },
  { standard: 'ISO_9001', clause: '10.3', title: 'Mejora continua', description: 'Mejorar continuamente la adecuación, adecuación y eficacia', mandatory: true, evidenceRequired: ['Proyectos de mejora'] },
];

// ============================================================
// AUTONOMOUS COMPLIANCE ENGINE
// ============================================================

export class AutonomousComplianceEngine {
  private db: any;

  constructor(prisma: PrismaClient) {
    this.db = prisma as any;
  }

  /**
   * Initialize compliance framework for tenant
   */
  async initializeFramework(tenantId: string, standards: StandardCode[] = ['ISO_9001']): Promise<void> {
    // Seed requirements for selected standards
    for (const standard of standards) {
      const requirements = this.getStandardRequirements(standard);
      
      for (const req of requirements) {
        const existing = await this.db.complianceRequirement?.findFirst?.({
          where: { tenantId, standard: req.standard, clause: req.clause },
        });

        if (!existing) {
          await this.db.complianceRequirement?.create?.({
            data: {
              ...req,
              id: `req_${tenantId}_${req.standard}_${req.clause}`,
              applicable: true,
              tenantId,
            },
          });
        }
      }
    }
  }

  /**
   * Assess compliance for tenant
   */
  async assessCompliance(tenantId: string, standard: StandardCode = 'ISO_9001'): Promise<ComplianceScore> {
    const db = this.db;

    // Get requirements
    const requirements = await db.complianceRequirement?.findMany?.({
      where: { tenantId, standard, applicable: true },
    }) || [];

    // If no requirements in DB, use built-in
    const reqsToCheck = requirements.length > 0 
      ? requirements 
      : this.getStandardRequirements(standard).map(r => ({ ...r, id: `req_${tenantId}_${r.standard}_${r.clause}` }));

    // Check compliance for each requirement
    const gaps: ComplianceGap[] = [];
    let compliant = 0;
    let nonCompliant = 0;

    for (const req of reqsToCheck) {
      const status = await this.checkRequirementCompliance(tenantId, req);
      
      if (status.compliant) {
        compliant++;
      } else {
        nonCompliant++;
        gaps.push({
          id: `gap_${req.id}_${Date.now()}`,
          requirementId: req.id,
          severity: req.mandatory ? 'HIGH' : 'MEDIUM',
          description: `No cumple con requisito ${req.clause}: ${req.title}`,
          currentState: status.currentState,
          requiredState: req.description,
          evidenceGap: status.missingEvidence,
          recommendation: status.recommendation,
          autoAction: req.mandatory ? 'PRIORITIZE' : undefined,
          status: 'OPEN',
          tenantId,
        });
      }
    }

    // Calculate score
    const totalApplicable = compliant + nonCompliant;
    const score = totalApplicable > 0 ? (compliant / totalApplicable) * 100 : 100;

    return {
      standard,
      score,
      requirements: {
        total: reqsToCheck.length,
        compliant,
        nonCompliant,
        notApplicable: reqsToCheck.length - totalApplicable,
      },
      gaps,
      trend: 'STABLE', // Would compare with previous assessments
      lastAssessment: new Date(),
    };
  }

  /**
   * Check compliance for specific requirement
   */
  private async checkRequirementCompliance(tenantId: string, req: any): Promise<any> {
    const db = this.db;
    const missingEvidence: string[] = [];
    let currentState = '';
    let recommendation = '';

    switch (req.clause) {
      case '4.1':
      case '4.2':
        const contextDoc = await db.document?.findFirst?.({
          where: { tenantId, type: 'CONTEXT_ANALYSIS' },
        });
        if (!contextDoc) {
          missingEvidence.push('Análisis de contexto');
          currentState = 'Sin documentar';
          recommendation = 'Crear documento de análisis de contexto y partes interesadas';
        } else {
          currentState = 'Documentado';
        }
        break;

      case '4.3':
        const scopeDoc = await db.document?.findFirst?.({
          where: { tenantId, type: 'SCOPE' },
        });
        if (!scopeDoc) {
          missingEvidence.push('Declaración de alcance');
          currentState = 'Sin definir';
          recommendation = 'Definir y documentar alcance del SGC';
        } else {
          currentState = 'Definido';
        }
        break;

      case '5.2':
        const policy = await db.document?.findFirst?.({
          where: { tenantId, type: 'QUALITY_POLICY' },
        });
        if (!policy) {
          missingEvidence.push('Política de calidad');
          currentState = 'Sin política';
          recommendation = 'Establecer y comunicar política de calidad';
        } else {
          currentState = 'Política establecida';
        }
        break;

      case '6.1':
        const riskAssessment = await db.risk?.count?.({ where: { tenantId } }) || 0;
        if (riskAssessment < 3) {
          missingEvidence.push('Análisis de riesgos suficiente');
          currentState = `${riskAssessment} riesgos identificados`;
          recommendation = 'Ampliar identificación de riesgos y oportunidades';
        } else {
          currentState = 'Análisis de riesgos realizado';
        }
        break;

      case '6.2':
        const objectives = await db.objective?.count?.({ where: { tenantId } }) || 0;
        if (objectives < 3) {
          missingEvidence.push('Objetivos de calidad en funciones clave');
          currentState = `${objectives} objetivos definidos`;
          recommendation = 'Definir objetivos en todas las funciones relevantes';
        } else {
          currentState = 'Objetivos establecidos';
        }
        break;

      case '8.7':
      case '10.2':
        const ncrs = await (db.nonConformityReport || db.ncr)?.count?.({ 
          where: { tenantId, status: { not: 'CLOSED' } } 
        }) || 0;
        const capas = await (db.capa || db.correctiveAction)?.count?.({ 
          where: { tenantId, status: { not: 'CLOSED' } } 
        }) || 0;
        currentState = `${ncrs} NCRs abiertas, ${capas} CAPAs abiertas`;
        if (ncrs > 0 && capas === 0) {
          missingEvidence.push('CAPAs para NCRs abiertas');
          recommendation = 'Generar CAPAs para NCRs sin tratamiento';
        }
        break;

      case '9.2':
        const audits = await db.audit?.count?.({ 
          where: { tenantId, status: 'COMPLETED' } 
        }) || 0;
        if (audits < 1) {
          missingEvidence.push('Programa de auditorías internas');
          currentState = 'Sin auditorías completadas';
          recommendation = 'Establecer programa de auditorías internas';
        } else {
          currentState = `${audits} auditorías completadas`;
        }
        break;

      case '9.3':
        const reviews = await db.managementReview?.count?.({ 
          where: { tenantId } 
        }) || 0;
        if (reviews < 1) {
          missingEvidence.push('Revisión por la dirección');
          currentState = 'Sin revisiones documentadas';
          recommendation = 'Realizar y documentar revisión por la dirección';
        } else {
          currentState = `${reviews} revisiones realizadas`;
        }
        break;

      default:
        currentState = 'Requiere verificación manual';
        recommendation = `Verificar cumplimiento de cláusula ${req.clause}`;
    }

    return {
      compliant: missingEvidence.length === 0,
      currentState,
      missingEvidence,
      recommendation,
    };
  }

  /**
   * Get compliance gaps for tenant
   */
  async getGaps(tenantId: string, filters?: { standard?: StandardCode; severity?: string; status?: string }): Promise<ComplianceGap[]> {
    const where: any = { tenantId };
    if (filters?.standard) where.standard = filters.standard;
    if (filters?.severity) where.severity = filters.severity;
    if (filters?.status) where.status = filters.status;

    return await this.db.complianceGap?.findMany?.({ where, orderBy: { severity: 'asc' } }) || [];
  }

  /**
   * Generate compliance report
   */
  async generateReport(tenantId: string): Promise<any> {
    const standards: StandardCode[] = ['ISO_9001']; // Could be extended
    const scores: ComplianceScore[] = [];

    for (const standard of standards) {
      scores.push(await this.assessCompliance(tenantId, standard));
    }

    return {
      generatedAt: new Date(),
      overallScore: scores.reduce((sum, s) => sum + s.score, 0) / scores.length,
      byStandard: scores,
      totalGaps: scores.reduce((sum, s) => sum + s.gaps.length, 0),
      criticalActions: scores.flatMap(s => s.gaps.filter(g => g.severity === 'CRITICAL')),
    };
  }

  /**
   * Auto-fix gaps where possible
   */
  async autoFixGaps(tenantId: string): Promise<{ fixed: number; manual: number; errors: string[] }> {
    const gaps = await this.getGaps(tenantId, { status: 'OPEN' });
    const result = { fixed: 0, manual: 0, errors: [] as string[] };

    for (const gap of gaps) {
      try {
        if (gap.autoAction === 'PRIORITIZE') {
          // Create high-priority task
          await this.db.task?.create?.({
            data: {
              tenantId,
              title: `Cerrar gap de compliance: ${gap.description.slice(0, 50)}...`,
              description: gap.recommendation,
              priority: 'HIGH',
              status: 'PENDING',
              metadata: { gapId: gap.id, autoGenerated: true },
            },
          });
          result.fixed++;
        } else {
          result.manual++;
        }
      } catch (err: any) {
        result.errors.push(`Gap ${gap.id}: ${err.message}`);
      }
    }

    return result;
  }

  /**
   * Check for regulatory updates (mock - would integrate with regulatory feeds)
   */
  async checkRegulatoryUpdates(): Promise<RegulatoryUpdate[]> {
    // In production, this would fetch from regulatory APIs
    return [];
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private getStandardRequirements(standard: StandardCode): any[] {
    switch (standard) {
      case 'ISO_9001':
        return ISO_9001_REQUIREMENTS;
      default:
        return [];
    }
  }
}

// Singleton instance
export let autonomousComplianceEngine: AutonomousComplianceEngine;

export function initializeAutonomousComplianceEngine(prisma: PrismaClient): AutonomousComplianceEngine {
  if (!autonomousComplianceEngine) {
    autonomousComplianceEngine = new AutonomousComplianceEngine(prisma);
  }
  return autonomousComplianceEngine;
}
