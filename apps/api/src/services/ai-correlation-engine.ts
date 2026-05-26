/**
 * CROSS-MODULE CORRELATION ENGINE
 * SGI360 Enterprise COS - Inteligencia relacional
 * 
 * Detecta correlaciones entre módulos:
 * - Mantenimiento → Flota → Entregas → NCR → Satisfacción
 * - RRHH → Desempeño → Calidad
 * - Auditorías → Riesgos → CAPAs
 */

import { PrismaClient } from '@prisma/client';

export interface Correlation {
  id: string;
  source: { module: string; entity: string; entityId?: string };
  target: { module: string; entity: string; entityId?: string };
  type: 'causes' | 'impacts' | 'correlates' | 'precedes' | 'depends_on';
  strength: number; // 0-1
  evidence: string[];
  detectedAt: Date;
}

export interface CorrelationInsight {
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  correlations: Correlation[];
  recommendation: string;
  confidence: number;
  dataSources: string[];
}

export class CorrelationEngine {
  private db: any;

  constructor(prisma: PrismaClient) {
    this.db = prisma as any;
  }

  /**
   * Detecta correlaciones cross-module para un tenant
   */
  async detectCorrelations(tenantId: string): Promise<CorrelationInsight[]> {
    const insights: CorrelationInsight[] = [];

    try {
      // 1. Fleet maintenance → Availability impact
      const fleetCorrelation = await this.analyzeFleetMaintenance(tenantId);
      if (fleetCorrelation) insights.push(fleetCorrelation);

      // 2. NCR trends → Quality risk
      const qualityCorrelation = await this.analyzeQualityTrends(tenantId);
      if (qualityCorrelation) insights.push(qualityCorrelation);

      // 3. Inspection findings → Fleet/Maintenance needs
      const inspectionCorrelation = await this.analyzeInspectionImpact(tenantId);
      if (inspectionCorrelation) insights.push(inspectionCorrelation);

      // 4. Project delays → Resource impact
      const projectCorrelation = await this.analyzeProjectRisks(tenantId);
      if (projectCorrelation) insights.push(projectCorrelation);

      // 5. HR gaps → Operational impact
      const hrCorrelation = await this.analyzeHRImpact(tenantId);
      if (hrCorrelation) insights.push(hrCorrelation);

    } catch (err) {
      console.error('[CorrelationEngine] Error detecting correlations:', err);
    }

    return insights.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private async analyzeFleetMaintenance(tenantId: string): Promise<CorrelationInsight | null> {
    try {
      const vehicles = await this.db.vehiculo?.findMany({
        where: { tenantId },
        select: { id: true, status: true, tipo: true, marca: true, modelo: true, dominio: true }
      }) || [];

      if (vehicles.length === 0) return null;

      const inTaller = vehicles.filter((v: any) => v.status === 'EN_TALLER');
      const total = vehicles.length;
      const unavailableRate = inTaller.length / total;

      // Check inspection findings for fleet
      let openFindings = 0;
      try {
        const result = await this.db.$queryRaw`
          SELECT COUNT(*) as count FROM inspeccion_hallazgos h
          JOIN inspecciones i ON i.id = h."inspeccionId"
          WHERE i."tenantId" = ${tenantId}::uuid AND h.estado = 'ABIERTO'
        `;
        openFindings = parseInt((result as any)[0]?.count || '0');
      } catch {}

      if (unavailableRate > 0.1 || openFindings > 3) {
        return {
          title: 'Mantenimiento impacta disponibilidad de flota',
          description: `${inTaller.length} vehículos en taller (${(unavailableRate * 100).toFixed(1)}% indisponible). ${openFindings} hallazgos de inspección abiertos que requieren atención.`,
          severity: unavailableRate > 0.2 ? 'high' : 'medium',
          correlations: [{
            id: `fleet-maint-${Date.now()}`,
            source: { module: 'maintenance', entity: 'mantenimientos_pendientes' },
            target: { module: 'fleet', entity: 'disponibilidad_flota' },
            type: 'impacts',
            strength: Math.min(unavailableRate * 3, 1),
            evidence: [`${inTaller.length} vehículos en taller`, `${openFindings} hallazgos abiertos`],
            detectedAt: new Date()
          }],
          recommendation: `Priorizar resolución de hallazgos de inspección y programar mantenimientos preventivos para reducir el ${(unavailableRate * 100).toFixed(0)}% de indisponibilidad.`,
          confidence: 0.85,
          dataSources: ['Flota360', 'Inspecciones']
        };
      }
    } catch {}
    return null;
  }

  private async analyzeQualityTrends(tenantId: string): Promise<CorrelationInsight | null> {
    try {
      const ncrModel = this.db.nonConformityReport || this.db.ncr || this.db.nonConformity;
      if (!ncrModel) return null;

      const ncrs = await ncrModel.findMany({
        where: { tenantId },
        select: { status: true, severity: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 100
      });

      if (ncrs.length < 3) return null;

      const openNcrs = ncrs.filter((n: any) => n.status !== 'CLOSED');
      const criticalNcrs = ncrs.filter((n: any) => n.severity === 'CRITICAL' || n.severity === 'HIGH');
      
      // Check CAPAs
      const capaModel = this.db.capa || this.db.correctiveAction;
      let overdueCapas = 0;
      if (capaModel) {
        const capas = await capaModel.findMany({
          where: { tenantId, status: { not: 'CLOSED' } },
          select: { dueDate: true, status: true }
        });
        overdueCapas = capas.filter((c: any) => c.dueDate && new Date(c.dueDate) < new Date()).length;
      }

      if (openNcrs.length > 5 || criticalNcrs.length > 2 || overdueCapas > 2) {
        return {
          title: 'Tendencia de calidad requiere atención',
          description: `${openNcrs.length} NCRs abiertas (${criticalNcrs.length} críticas/altas). ${overdueCapas} CAPAs vencidas sin cerrar. La acumulación indica riesgo sistémico.`,
          severity: criticalNcrs.length > 3 || overdueCapas > 3 ? 'critical' : 'high',
          correlations: [{
            id: `quality-trend-${Date.now()}`,
            source: { module: 'quality', entity: 'ncr_acumuladas' },
            target: { module: 'risk', entity: 'riesgo_operacional' },
            type: 'causes',
            strength: Math.min((openNcrs.length + overdueCapas) / 15, 1),
            evidence: [`${openNcrs.length} NCRs abiertas`, `${criticalNcrs.length} severidad alta/crítica`, `${overdueCapas} CAPAs vencidas`],
            detectedAt: new Date()
          }],
          recommendation: `Convocar revisión de gestión. Priorizar cierre de ${overdueCapas} CAPAs vencidas. Considerar auditoría interna focalizada en áreas con más NCRs.`,
          confidence: 0.9,
          dataSources: ['NCR', 'CAPA', 'Riesgos']
        };
      }
    } catch {}
    return null;
  }

  private async analyzeInspectionImpact(tenantId: string): Promise<CorrelationInsight | null> {
    try {
      const hallazgos = await this.db.$queryRaw`
        SELECT h.severidad, h."itemLabel", i."activoNombre"
        FROM inspeccion_hallazgos h
        JOIN inspecciones i ON i.id = h."inspeccionId"
        WHERE i."tenantId" = ${tenantId}::uuid AND h.estado = 'ABIERTO'
        ORDER BY h."createdAt" DESC LIMIT 50
      ` as any[];

      if (!hallazgos || hallazgos.length < 3) return null;

      const critical = hallazgos.filter((h: any) => h.severidad === 'CRITICO' || h.severidad === 'ALTO');
      const affectedAssets = [...new Set(hallazgos.map((h: any) => h.activoNombre).filter(Boolean))];

      if (critical.length > 0 || hallazgos.length > 5) {
        return {
          title: 'Hallazgos de inspección afectan activos operativos',
          description: `${hallazgos.length} hallazgos abiertos (${critical.length} críticos/altos) afectando ${affectedAssets.length} activos: ${affectedAssets.slice(0, 3).join(', ')}`,
          severity: critical.length > 2 ? 'high' : 'medium',
          correlations: [{
            id: `insp-impact-${Date.now()}`,
            source: { module: 'inspections', entity: 'hallazgos_abiertos' },
            target: { module: 'fleet', entity: 'activos_afectados' },
            type: 'impacts',
            strength: Math.min(hallazgos.length / 10, 1),
            evidence: hallazgos.slice(0, 5).map((h: any) => `${h.itemLabel || 'Hallazgo'} - ${h.activoNombre || 'Sin activo'}`),
            detectedAt: new Date()
          }],
          recommendation: `Resolver ${critical.length} hallazgos críticos prioritariamente. Programar mantenimiento correctivo para: ${affectedAssets.slice(0, 3).join(', ')}.`,
          confidence: 0.85,
          dataSources: ['Inspecciones', 'Flota360']
        };
      }
    } catch {}
    return null;
  }

  private async analyzeProjectRisks(tenantId: string): Promise<CorrelationInsight | null> {
    try {
      const projects = await this.db.project360?.findMany({
        where: { tenantId, deletedAt: null, status: { not: 'COMPLETED' } },
        select: { name: true, progress: true, status: true, budget: true, actualCost: true, endDate: true }
      }) || [];

      if (projects.length === 0) return null;

      const atRisk = projects.filter((p: any) => {
        const overBudget = p.actualCost > p.budget && p.budget > 0;
        const overdue = p.endDate && new Date(p.endDate) < new Date();
        return overBudget || overdue || p.status === 'AT_RISK';
      });

      if (atRisk.length > 0) {
        return {
          title: 'Proyectos en riesgo impactan operaciones',
          description: `${atRisk.length} proyecto(s) en riesgo: ${atRisk.map((p: any) => p.name).join(', ')}. Desviaciones de presupuesto o cronograma detectadas.`,
          severity: atRisk.length > 2 ? 'high' : 'medium',
          correlations: [{
            id: `proj-risk-${Date.now()}`,
            source: { module: 'projects', entity: 'proyectos_en_riesgo' },
            target: { module: 'operations', entity: 'impacto_operativo' },
            type: 'impacts',
            strength: Math.min(atRisk.length / 5, 1),
            evidence: atRisk.map((p: any) => `${p.name}: ${p.progress || 0}% avance`),
            detectedAt: new Date()
          }],
          recommendation: `Revisar cronogramas y presupuestos. Reasignar recursos si es necesario. Escalar a dirección si hay proyectos con desviación > 20%.`,
          confidence: 0.8,
          dataSources: ['Project360']
        };
      }
    } catch {}
    return null;
  }

  private async analyzeHRImpact(tenantId: string): Promise<CorrelationInsight | null> {
    try {
      const employees = await this.db.employee?.findMany({
        where: { tenantId, deletedAt: null },
        select: { status: true, department: true }
      }) || [];

      if (employees.length === 0) return null;

      const inactive = employees.filter((e: any) => e.status === 'INACTIVO' || e.status === 'BAJA');
      const inactiveRate = inactive.length / employees.length;

      // Check training gaps
      let trainingGaps = 0;
      try {
        const competencies = await this.db.employeeCompetency?.findMany({
          where: { employee: { tenantId } },
          select: { currentLevel: true, requiredLevel: true }
        }) || [];
        trainingGaps = competencies.filter((c: any) => (c.currentLevel || 0) < (c.requiredLevel || 0)).length;
      } catch {}

      if (inactiveRate > 0.05 || trainingGaps > 5) {
        return {
          title: 'Brechas de RRHH impactan capacidad operativa',
          description: `${inactive.length} empleados inactivos/baja (${(inactiveRate * 100).toFixed(1)}%). ${trainingGaps} brechas de competencia detectadas.`,
          severity: trainingGaps > 10 || inactiveRate > 0.1 ? 'high' : 'medium',
          correlations: [{
            id: `hr-impact-${Date.now()}`,
            source: { module: 'hr', entity: 'brechas_competencia' },
            target: { module: 'operations', entity: 'capacidad_operativa' },
            type: 'impacts',
            strength: Math.min((trainingGaps / 20) + inactiveRate, 1),
            evidence: [`${inactive.length} empleados inactivos`, `${trainingGaps} gaps de competencia`],
            detectedAt: new Date()
          }],
          recommendation: `Priorizar ${Math.min(trainingGaps, 5)} capacitaciones críticas. Evaluar plan de reposición para áreas afectadas.`,
          confidence: 0.75,
          dataSources: ['RRHH', 'Matriz de Polivalencia']
        };
      }
    } catch {}
    return null;
  }
}

export default CorrelationEngine;
