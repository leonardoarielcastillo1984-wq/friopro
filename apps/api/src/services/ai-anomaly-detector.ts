/**
 * AI ANOMALY DETECTOR - Autonomous Intelligence
 * SGI360 Enterprise COS
 * 
 * Proactive AI that detects:
 * - KPI anomalies and threshold breaches
 * - Trend reversals
 * - Overdue items accumulating
 * - Capacity/resource strain
 * - Correlation-based predictions
 */

import { PrismaClient } from '@prisma/client';
import { EnterpriseEventEngine, eventEngine } from './ai-event-engine.js';

export interface Anomaly {
  id: string;
  type: 'threshold_breach' | 'trend_reversal' | 'accumulation' | 'capacity_strain' | 'prediction';
  module: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  currentValue: number;
  expectedValue?: number;
  threshold?: number;
  trend?: 'increasing' | 'decreasing' | 'stable';
  recommendation: string;
  confidence: number;
  detectedAt: Date;
  metadata?: Record<string, any>;
}

export class AnomalyDetector {
  private db: any;

  constructor(prisma: PrismaClient) {
    this.db = prisma as any;
  }

  /**
   * Run full anomaly detection scan for a tenant
   */
  async detectAnomalies(tenantId: string): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    try {
      const [ncr, fleet, projects, capas, inspections] = await Promise.allSettled([
        this.checkNCRAnomalies(tenantId),
        this.checkFleetAnomalies(tenantId),
        this.checkProjectAnomalies(tenantId),
        this.checkCAPAAnomalies(tenantId),
        this.checkInspectionAnomalies(tenantId),
      ]);

      if (ncr.status === 'fulfilled') anomalies.push(...ncr.value);
      if (fleet.status === 'fulfilled') anomalies.push(...fleet.value);
      if (projects.status === 'fulfilled') anomalies.push(...projects.value);
      if (capas.status === 'fulfilled') anomalies.push(...capas.value);
      if (inspections.status === 'fulfilled') anomalies.push(...inspections.value);

      // Publish critical anomalies as events
      for (const anomaly of anomalies.filter(a => a.severity === 'critical' || a.severity === 'high')) {
        await eventEngine.publish({
          type: 'AI_ANOMALY_DETECTED',
          tenantId,
          module: anomaly.module,
          severity: anomaly.severity,
          title: anomaly.title,
          description: anomaly.description,
          metadata: { anomalyId: anomaly.id, confidence: anomaly.confidence },
          timestamp: new Date()
        });
      }

    } catch (err) {
      console.error('[AnomalyDetector] Error:', err);
    }

    return anomalies.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    });
  }

  private async checkNCRAnomalies(tenantId: string): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    const ncrModel = this.db.nonConformityReport || this.db.ncr || this.db.nonConformity;
    if (!ncrModel) return anomalies;

    try {
      const ncrs = await ncrModel.findMany({
        where: { tenantId },
        select: { status: true, severity: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 200
      });

      const openNcrs = ncrs.filter((n: any) => n.status !== 'CLOSED');
      const last30 = ncrs.filter((n: any) => new Date(n.createdAt) > new Date(Date.now() - 30 * 86400000));
      const prev30 = ncrs.filter((n: any) => {
        const d = new Date(n.createdAt);
        return d > new Date(Date.now() - 60 * 86400000) && d <= new Date(Date.now() - 30 * 86400000);
      });

      // Accumulation check
      if (openNcrs.length > 10) {
        anomalies.push({
          id: `ncr-accum-${Date.now()}`,
          type: 'accumulation',
          module: 'quality',
          severity: openNcrs.length > 20 ? 'critical' : 'high',
          title: 'Acumulación de NCRs abiertas',
          description: `${openNcrs.length} NCRs sin cerrar. Riesgo de saturación del sistema de calidad.`,
          currentValue: openNcrs.length,
          threshold: 10,
          recommendation: 'Convocar comité de calidad urgente. Priorizar cierre por severidad.',
          confidence: 0.95,
          detectedAt: new Date()
        });
      }

      // Trend check
      if (last30.length > prev30.length * 1.5 && prev30.length > 0) {
        const increase = ((last30.length - prev30.length) / prev30.length * 100).toFixed(0);
        anomalies.push({
          id: `ncr-trend-${Date.now()}`,
          type: 'trend_reversal',
          module: 'quality',
          severity: 'high',
          title: 'Aumento significativo de NCRs',
          description: `NCRs aumentaron ${increase}% vs período anterior (${last30.length} vs ${prev30.length}).`,
          currentValue: last30.length,
          expectedValue: prev30.length,
          trend: 'increasing',
          recommendation: 'Investigar causa raíz del aumento. Revisar procesos con más incidencia.',
          confidence: 0.85,
          detectedAt: new Date()
        });
      }
    } catch {}

    return anomalies;
  }

  private async checkFleetAnomalies(tenantId: string): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    try {
      const vehicles = await this.db.vehiculo?.findMany({
        where: { tenantId },
        select: { status: true }
      }) || [];

      if (vehicles.length === 0) return anomalies;

      const inTaller = vehicles.filter((v: any) => v.status === 'EN_TALLER').length;
      const rate = inTaller / vehicles.length;

      if (rate > 0.15) {
        anomalies.push({
          id: `fleet-avail-${Date.now()}`,
          type: 'threshold_breach',
          module: 'fleet',
          severity: rate > 0.25 ? 'critical' : 'high',
          title: 'Disponibilidad de flota por debajo del umbral',
          description: `${(rate * 100).toFixed(1)}% de la flota en taller (${inTaller} de ${vehicles.length}). Umbral aceptable: 15%.`,
          currentValue: rate * 100,
          threshold: 15,
          recommendation: 'Revisar capacidad del taller. Evaluar si hay fallas sistémicas. Considerar tercerización de mantenimiento.',
          confidence: 0.9,
          detectedAt: new Date()
        });
      }
    } catch {}

    return anomalies;
  }

  private async checkProjectAnomalies(tenantId: string): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    try {
      const projects = await this.db.project360?.findMany({
        where: { tenantId, deletedAt: null, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        select: { name: true, progress: true, budget: true, actualCost: true, endDate: true, status: true }
      }) || [];

      for (const p of projects) {
        // Budget overrun
        if (p.budget > 0 && p.actualCost > p.budget * 1.1) {
          const overrun = ((p.actualCost - p.budget) / p.budget * 100).toFixed(0);
          anomalies.push({
            id: `proj-budget-${Date.now()}-${p.name}`,
            type: 'threshold_breach',
            module: 'projects',
            severity: parseFloat(overrun) > 30 ? 'critical' : 'high',
            title: `Sobrecosto en proyecto "${p.name}"`,
            description: `Presupuesto excedido en ${overrun}% ($${p.actualCost.toLocaleString()} vs $${p.budget.toLocaleString()}).`,
            currentValue: p.actualCost,
            expectedValue: p.budget,
            threshold: p.budget * 1.1,
            recommendation: 'Revisar compromisos de gasto. Evaluar alcance. Escalar a sponsor.',
            confidence: 0.95,
            detectedAt: new Date()
          });
        }

        // Overdue
        if (p.endDate && new Date(p.endDate) < new Date() && (p.progress || 0) < 100) {
          anomalies.push({
            id: `proj-overdue-${Date.now()}-${p.name}`,
            type: 'threshold_breach',
            module: 'projects',
            severity: 'high',
            title: `Proyecto "${p.name}" vencido`,
            description: `Fecha fin superada con ${p.progress || 0}% de avance. Requiere reprogramación.`,
            currentValue: p.progress || 0,
            expectedValue: 100,
            recommendation: 'Reprogramar fecha de entrega. Identificar bloqueos. Reforzar recursos.',
            confidence: 0.9,
            detectedAt: new Date()
          });
        }
      }
    } catch {}

    return anomalies;
  }

  private async checkCAPAAnomalies(tenantId: string): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    try {
      const capaModel = this.db.capa || this.db.correctiveAction;
      if (!capaModel) return anomalies;

      const capas = await capaModel.findMany({
        where: { tenantId, status: { not: 'CLOSED' } },
        select: { title: true, dueDate: true, status: true, createdAt: true }
      });

      const overdue = capas.filter((c: any) => c.dueDate && new Date(c.dueDate) < new Date());

      if (overdue.length > 3) {
        anomalies.push({
          id: `capa-overdue-${Date.now()}`,
          type: 'accumulation',
          module: 'quality',
          severity: overdue.length > 5 ? 'critical' : 'high',
          title: 'CAPAs vencidas acumulándose',
          description: `${overdue.length} acciones correctivas vencidas sin cerrar. Riesgo de reincidencia.`,
          currentValue: overdue.length,
          threshold: 3,
          recommendation: 'Activar escalamiento. Reasignar responsables. Evaluar efectividad del sistema CAPA.',
          confidence: 0.9,
          detectedAt: new Date()
        });
      }
    } catch {}

    return anomalies;
  }

  private async checkInspectionAnomalies(tenantId: string): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    try {
      const hallazgos = await this.db.$queryRaw`
        SELECT h.severidad, h.estado
        FROM inspeccion_hallazgos h
        JOIN inspecciones i ON i.id = h."inspeccionId"
        WHERE i."tenantId" = ${tenantId}::uuid AND h.estado = 'ABIERTO'
      ` as any[];

      if (hallazgos && hallazgos.length > 8) {
        const critical = hallazgos.filter((h: any) => h.severidad === 'CRITICO' || h.severidad === 'ALTO');
        anomalies.push({
          id: `insp-accum-${Date.now()}`,
          type: 'accumulation',
          module: 'inspections',
          severity: critical.length > 3 ? 'high' : 'medium',
          title: 'Hallazgos de inspección sin resolver',
          description: `${hallazgos.length} hallazgos abiertos (${critical.length} severos). Requiere plan de acción.`,
          currentValue: hallazgos.length,
          threshold: 8,
          recommendation: 'Asignar responsables a hallazgos críticos. Crear tickets de mantenimiento. Programar re-inspección.',
          confidence: 0.85,
          detectedAt: new Date()
        });
      }
    } catch {}

    return anomalies;
  }
}

export default AnomalyDetector;
