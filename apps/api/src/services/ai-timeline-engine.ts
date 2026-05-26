/**
 * AI TIMELINE ENGINE
 * SGI360 Command Center - Feed Operativo Unificado
 * 
 * Agrega eventos reales de todos los módulos en un timeline unificado:
 * - NCRs, CAPAs, Riesgos
 * - Proyectos, hitos
 * - Flota, mantenimientos
 * - Auditorías, hallazgos
 * - Documentos, calibraciones
 * - Empleados, capacitaciones
 */

import { PrismaClient } from '@prisma/client';

export interface TimelineEvent {
  id: string;
  type: 'ncr' | 'capa' | 'risk' | 'project' | 'fleet' | 'audit' | 'document' | 'calibration' | 'hr' | 'training' | 'inspection' | 'system';
  action: 'created' | 'updated' | 'closed' | 'completed' | 'escalated' | 'approved' | 'rejected' | 'assigned' | 'overdue' | 'alert';
  title: string;
  description: string;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  entityId?: string;
  entityName?: string;
  module: string;
  icon: string;
  color: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class AITimelineEngine {
  private db: any;

  constructor(prisma: PrismaClient) {
    this.db = prisma as any;
  }

  /**
   * Obtiene el timeline unificado de un tenant
   */
  async getTimeline(tenantId: string, options?: { limit?: number; offset?: number; modules?: string[]; since?: Date }): Promise<{ events: TimelineEvent[]; total: number }> {
    const limit = options?.limit || 50;
    const since = options?.since || new Date(Date.now() - 30 * 86400000); // últimos 30 días por defecto
    const moduleFilter = options?.modules;

    const allEvents: TimelineEvent[] = [];

    const fetchers: Array<() => Promise<TimelineEvent[]>> = [
      () => this.getNCREvents(tenantId, since),
      () => this.getCAPAEvents(tenantId, since),
      () => this.getRiskEvents(tenantId, since),
      () => this.getProjectEvents(tenantId, since),
      () => this.getFleetEvents(tenantId, since),
      () => this.getAuditEvents(tenantId, since),
      () => this.getDocumentEvents(tenantId, since),
      () => this.getHREvents(tenantId, since),
      () => this.getInspectionEvents(tenantId, since),
    ];

    const results = await Promise.allSettled(fetchers.map(f => f()));

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allEvents.push(...result.value);
      }
    }

    // Filtrar por módulo si se especifica
    let filtered = moduleFilter
      ? allEvents.filter(e => moduleFilter.includes(e.module))
      : allEvents;

    // Ordenar por timestamp descendente
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = filtered.length;
    const offset = options?.offset || 0;
    const paginated = filtered.slice(offset, offset + limit);

    return { events: paginated, total };
  }

  // ── NCRs ────────────────────────────────────────────────────
  private async getNCREvents(tenantId: string, since: Date): Promise<TimelineEvent[]> {
    try {
      const ncrs = await this.db.nonConformity?.findMany({
        where: { tenantId, updatedAt: { gte: since }, deletedAt: null },
        select: { id: true, code: true, title: true, status: true, severity: true, createdAt: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      });
      if (!ncrs) return [];

      return ncrs.map((ncr: any) => ({
        id: `ncr-${ncr.id}`,
        type: 'ncr' as const,
        action: ncr.status === 'CLOSED' ? 'closed' as const : ncr.createdAt.getTime() === ncr.updatedAt.getTime() ? 'created' as const : 'updated' as const,
        title: `NCR ${ncr.code || ''}: ${ncr.title || 'Sin título'}`.trim(),
        description: ncr.status === 'CLOSED' ? 'No conformidad cerrada' : `Estado: ${ncr.status} | Severidad: ${ncr.severity || 'N/A'}`,
        severity: ncr.severity === 'CRITICAL' ? 'critical' as const : ncr.severity === 'HIGH' ? 'high' as const : 'medium' as const,
        entityId: ncr.id,
        entityName: ncr.code || ncr.title,
        module: 'Calidad',
        icon: 'alert-circle',
        color: ncr.severity === 'CRITICAL' ? 'red' : ncr.severity === 'HIGH' ? 'orange' : 'yellow',
        timestamp: ncr.updatedAt,
      }));
    } catch { return []; }
  }

  // ── CAPAs ───────────────────────────────────────────────────
  private async getCAPAEvents(tenantId: string, since: Date): Promise<TimelineEvent[]> {
    try {
      const capas = await this.db.correctiveAction?.findMany({
        where: { tenantId, updatedAt: { gte: since } },
        select: { id: true, code: true, title: true, status: true, type: true, createdAt: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 15,
      });
      if (!capas) return [];

      return capas.map((capa: any) => ({
        id: `capa-${capa.id}`,
        type: 'capa' as const,
        action: capa.status === 'CLOSED' ? 'completed' as const : capa.createdAt.getTime() === capa.updatedAt.getTime() ? 'created' as const : 'updated' as const,
        title: `CAPA ${capa.code || ''}: ${capa.title || 'Sin título'}`.trim(),
        description: `Tipo: ${capa.type || 'N/A'} | Estado: ${capa.status}`,
        severity: 'medium' as const,
        entityId: capa.id,
        entityName: capa.code || capa.title,
        module: 'Calidad',
        icon: 'check-circle',
        color: capa.status === 'CLOSED' ? 'green' : 'blue',
        timestamp: capa.updatedAt,
      }));
    } catch { return []; }
  }

  // ── Riesgos ─────────────────────────────────────────────────
  private async getRiskEvents(tenantId: string, since: Date): Promise<TimelineEvent[]> {
    try {
      const risks = await this.db.risk?.findMany({
        where: { tenantId, updatedAt: { gte: since } },
        select: { id: true, name: true, level: true, status: true, category: true, createdAt: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 15,
      });
      if (!risks) return [];

      return risks.map((risk: any) => ({
        id: `risk-${risk.id}`,
        type: 'risk' as const,
        action: risk.status === 'MITIGATED' ? 'completed' as const : risk.createdAt.getTime() === risk.updatedAt.getTime() ? 'created' as const : 'updated' as const,
        title: `Riesgo: ${risk.name || 'Sin nombre'}`,
        description: `Nivel: ${risk.level} | Categoría: ${risk.category || 'General'} | Estado: ${risk.status}`,
        severity: risk.level === 'CRITICAL' ? 'critical' as const : risk.level === 'HIGH' ? 'high' as const : 'medium' as const,
        entityId: risk.id,
        entityName: risk.name,
        module: 'Riesgos',
        icon: 'shield',
        color: risk.level === 'CRITICAL' ? 'red' : risk.level === 'HIGH' ? 'orange' : 'yellow',
        timestamp: risk.updatedAt,
      }));
    } catch { return []; }
  }

  // ── Proyectos ───────────────────────────────────────────────
  private async getProjectEvents(tenantId: string, since: Date): Promise<TimelineEvent[]> {
    try {
      const projects = await this.db.project360?.findMany({
        where: { tenantId, updatedAt: { gte: since }, deletedAt: null },
        select: { id: true, name: true, code: true, status: true, progress: true, createdAt: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 15,
      });
      if (!projects) return [];

      return projects.map((p: any) => ({
        id: `project-${p.id}`,
        type: 'project' as const,
        action: p.status === 'COMPLETED' ? 'completed' as const : p.status === 'AT_RISK' ? 'escalated' as const : p.createdAt.getTime() === p.updatedAt.getTime() ? 'created' as const : 'updated' as const,
        title: `Proyecto ${p.code || ''}: ${p.name || 'Sin nombre'}`.trim(),
        description: `Estado: ${p.status} | Avance: ${p.progress || 0}%`,
        severity: p.status === 'AT_RISK' ? 'high' as const : p.status === 'DELAYED' ? 'high' as const : 'info' as const,
        entityId: p.id,
        entityName: p.name,
        module: 'Proyectos',
        icon: 'folder',
        color: p.status === 'COMPLETED' ? 'green' : p.status === 'AT_RISK' ? 'orange' : 'blue',
        timestamp: p.updatedAt,
      }));
    } catch { return []; }
  }

  // ── Flota ───────────────────────────────────────────────────
  private async getFleetEvents(tenantId: string, since: Date): Promise<TimelineEvent[]> {
    try {
      const events: TimelineEvent[] = [];

      const vehicles = await this.db.vehiculo?.findMany({
        where: { tenantId, updatedAt: { gte: since } },
        select: { id: true, dominio: true, marca: true, modelo: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      });

      if (vehicles) {
        for (const v of vehicles) {
          events.push({
            id: `vehicle-${v.id}`,
            type: 'fleet',
            action: v.status === 'EN_TALLER' ? 'alert' : 'updated',
            title: `Vehículo ${v.dominio}: ${v.marca} ${v.modelo}`,
            description: `Estado: ${v.status}`,
            severity: v.status === 'EN_TALLER' ? 'medium' : 'info',
            entityId: v.id,
            entityName: v.dominio,
            module: 'Flota',
            icon: 'truck',
            color: v.status === 'ACTIVO' ? 'green' : v.status === 'EN_TALLER' ? 'yellow' : 'gray',
            timestamp: v.updatedAt,
          });
        }
      }

      return events;
    } catch { return []; }
  }

  // ── Auditorías ──────────────────────────────────────────────
  private async getAuditEvents(tenantId: string, since: Date): Promise<TimelineEvent[]> {
    try {
      const audits = await this.db.auditRun?.findMany({
        where: { tenantId, updatedAt: { gte: since } },
        select: { id: true, title: true, status: true, createdAt: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      });
      if (!audits) return [];

      return audits.map((a: any) => ({
        id: `audit-${a.id}`,
        type: 'audit' as const,
        action: a.status === 'COMPLETED' ? 'completed' as const : a.createdAt.getTime() === a.updatedAt.getTime() ? 'created' as const : 'updated' as const,
        title: `Auditoría: ${a.title || 'Sin título'}`,
        description: `Estado: ${a.status}`,
        severity: 'info' as const,
        entityId: a.id,
        entityName: a.title,
        module: 'Auditorías',
        icon: 'clipboard',
        color: a.status === 'COMPLETED' ? 'green' : 'blue',
        timestamp: a.updatedAt,
      }));
    } catch { return []; }
  }

  // ── Documentos ──────────────────────────────────────────────
  private async getDocumentEvents(tenantId: string, since: Date): Promise<TimelineEvent[]> {
    try {
      const docs = await this.db.document?.findMany({
        where: { tenantId, updatedAt: { gte: since } },
        select: { id: true, title: true, status: true, version: true, createdAt: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      });
      if (!docs) return [];

      return docs.map((d: any) => ({
        id: `doc-${d.id}`,
        type: 'document' as const,
        action: d.status === 'APPROVED' ? 'approved' as const : d.status === 'PENDING_REVIEW' ? 'assigned' as const : 'updated' as const,
        title: `Documento: ${d.title || 'Sin título'}`,
        description: `Versión: ${d.version || 1} | Estado: ${d.status}`,
        severity: d.status === 'EXPIRED' ? 'medium' as const : 'info' as const,
        entityId: d.id,
        entityName: d.title,
        module: 'Documentos',
        icon: 'file-text',
        color: d.status === 'APPROVED' ? 'green' : d.status === 'PENDING_REVIEW' ? 'yellow' : 'blue',
        timestamp: d.updatedAt,
      }));
    } catch { return []; }
  }

  // ── RRHH ────────────────────────────────────────────────────
  private async getHREvents(tenantId: string, since: Date): Promise<TimelineEvent[]> {
    try {
      const events: TimelineEvent[] = [];

      // Trainings
      const trainings = await this.db.training?.findMany({
        where: { tenantId, updatedAt: { gte: since } },
        select: { id: true, title: true, status: true, createdAt: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      });

      if (trainings) {
        for (const t of trainings) {
          events.push({
            id: `training-${t.id}`,
            type: 'training',
            action: t.status === 'COMPLETED' ? 'completed' : t.createdAt.getTime() === t.updatedAt.getTime() ? 'created' : 'updated',
            title: `Capacitación: ${t.title || 'Sin título'}`,
            description: `Estado: ${t.status}`,
            severity: 'info',
            entityId: t.id,
            entityName: t.title,
            module: 'RRHH',
            icon: 'users',
            color: t.status === 'COMPLETED' ? 'green' : 'blue',
            timestamp: t.updatedAt,
          });
        }
      }

      return events;
    } catch { return []; }
  }

  // ── Inspecciones ────────────────────────────────────────────
  private async getInspectionEvents(tenantId: string, since: Date): Promise<TimelineEvent[]> {
    try {
      const inspections = await this.db.inspeccion?.findMany({
        where: { tenantId, createdAt: { gte: since } },
        select: { id: true, inspectorName: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      if (!inspections) return [];

      return inspections.map((i: any) => ({
        id: `inspection-${i.id}`,
        type: 'inspection' as const,
        action: i.status === 'COMPLETED' ? 'completed' as const : 'created' as const,
        title: `Inspección realizada`,
        description: `Inspector: ${i.inspectorName || 'Anónimo'} | Estado: ${i.status}`,
        severity: 'info' as const,
        entityId: i.id,
        module: 'Inspecciones',
        icon: 'search',
        color: 'teal',
        timestamp: i.createdAt,
      }));
    } catch { return []; }
  }
}

export default AITimelineEngine;
