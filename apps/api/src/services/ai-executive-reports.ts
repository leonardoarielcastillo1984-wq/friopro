/**
 * EXECUTIVE AI REPORTS
 * SGI360 Enterprise COS - Auto-generated executive reports
 * 
 * Genera reportes ejecutivos en Markdown con:
 * - Resumen ejecutivo
 * - KPIs por módulo
 * - Anomalías detectadas
 * - Correlaciones cross-module
 * - Recomendaciones priorizadas
 * - Tendencias y predicciones
 */

import { PrismaClient } from '@prisma/client';
import { CorrelationEngine } from './ai-correlation-engine.js';
import { AnomalyDetector } from './ai-anomaly-detector.js';

export interface ExecutiveReport {
  id: string;
  title: string;
  generatedAt: Date;
  period: string;
  format: 'markdown' | 'html';
  content: string;
  sections: ReportSection[];
  metadata: {
    tenantId: string;
    modules: string[];
    anomaliesCount: number;
    correlationsCount: number;
    generationTimeMs: number;
  };
}

export interface ReportSection {
  title: string;
  content: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  module?: string;
}

export class ExecutiveReportGenerator {
  private db: any;
  private correlationEngine: CorrelationEngine;
  private anomalyDetector: AnomalyDetector;

  constructor(prisma: PrismaClient) {
    this.db = prisma as any;
    this.correlationEngine = new CorrelationEngine(prisma);
    this.anomalyDetector = new AnomalyDetector(prisma);
  }

  /**
   * Generate a full executive report for a tenant
   */
  async generateReport(tenantId: string, options?: { period?: string; modules?: string[] }): Promise<ExecutiveReport> {
    const startTime = Date.now();
    const period = options?.period || 'Últimos 30 días';
    const sections: ReportSection[] = [];

    // Gather all data in parallel
    const [anomalies, correlations, fleetData, qualityData, projectData, hrData, inspectionData] = await Promise.allSettled([
      this.anomalyDetector.detectAnomalies(tenantId),
      this.correlationEngine.detectCorrelations(tenantId),
      this.getFleetKPIs(tenantId),
      this.getQualityKPIs(tenantId),
      this.getProjectKPIs(tenantId),
      this.getHRKPIs(tenantId),
      this.getInspectionKPIs(tenantId),
    ]);

    const anomalyList = anomalies.status === 'fulfilled' ? anomalies.value : [];
    const correlationList = correlations.status === 'fulfilled' ? correlations.value : [];
    const fleet = fleetData.status === 'fulfilled' ? fleetData.value : null;
    const quality = qualityData.status === 'fulfilled' ? qualityData.value : null;
    const projects = projectData.status === 'fulfilled' ? projectData.value : null;
    const hr = hrData.status === 'fulfilled' ? hrData.value : null;
    const inspections = inspectionData.status === 'fulfilled' ? inspectionData.value : null;

    // 1. Executive Summary
    sections.push({
      title: 'Resumen Ejecutivo',
      content: this.buildExecutiveSummary(anomalyList, correlationList, fleet, quality, projects),
      priority: 'high',
    });

    // 2. Critical Alerts
    if (anomalyList.length > 0) {
      sections.push({
        title: 'Alertas y Anomalías',
        content: this.buildAnomalySection(anomalyList),
        priority: anomalyList.some(a => a.severity === 'critical') ? 'critical' : 'high',
        module: 'cross-module',
      });
    }

    // 3. Fleet KPIs
    if (fleet) {
      sections.push({
        title: 'Flota y Transporte',
        content: this.buildFleetSection(fleet),
        priority: fleet.unavailableRate > 0.15 ? 'high' : 'medium',
        module: 'fleet',
      });
    }

    // 4. Quality KPIs
    if (quality) {
      sections.push({
        title: 'Calidad (NCR/CAPA)',
        content: this.buildQualitySection(quality),
        priority: quality.openNCRs > 10 || quality.overdueCapas > 3 ? 'high' : 'medium',
        module: 'quality',
      });
    }

    // 5. Projects
    if (projects) {
      sections.push({
        title: 'Proyectos',
        content: this.buildProjectSection(projects),
        priority: projects.atRisk > 0 ? 'high' : 'medium',
        module: 'projects',
      });
    }

    // 6. HR
    if (hr) {
      sections.push({
        title: 'Recursos Humanos',
        content: this.buildHRSection(hr),
        priority: hr.trainingGaps > 10 ? 'high' : 'medium',
        module: 'hr',
      });
    }

    // 7. Inspections
    if (inspections) {
      sections.push({
        title: 'Inspecciones',
        content: this.buildInspectionSection(inspections),
        priority: inspections.openFindings > 5 ? 'high' : 'medium',
        module: 'inspections',
      });
    }

    // 8. Correlations
    if (correlationList.length > 0) {
      sections.push({
        title: 'Correlaciones Cross-Module',
        content: this.buildCorrelationSection(correlationList),
        priority: correlationList.some(c => c.severity === 'critical' || c.severity === 'high') ? 'high' : 'medium',
        module: 'cross-module',
      });
    }

    // 9. Recommendations
    sections.push({
      title: 'Recomendaciones',
      content: this.buildRecommendations(anomalyList, correlationList, fleet, quality, projects),
      priority: 'high',
    });

    // Build full markdown
    const content = this.compileMarkdown(sections, period);
    const generationTime = Date.now() - startTime;

    return {
      id: `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: `Reporte Ejecutivo — ${period}`,
      generatedAt: new Date(),
      period,
      format: 'markdown',
      content,
      sections,
      metadata: {
        tenantId,
        modules: ['fleet', 'quality', 'projects', 'hr', 'inspections'].filter(m => {
          if (m === 'fleet') return !!fleet;
          if (m === 'quality') return !!quality;
          if (m === 'projects') return !!projects;
          if (m === 'hr') return !!hr;
          if (m === 'inspections') return !!inspections;
          return false;
        }),
        anomaliesCount: anomalyList.length,
        correlationsCount: correlationList.length,
        generationTimeMs: generationTime,
      },
    };
  }

  // ── Data Gatherers ─────────────────────────────────────────

  private async getFleetKPIs(tenantId: string) {
    const vehicles = await this.db.vehiculo?.findMany({
      where: { tenantId },
      select: { status: true, tipo: true }
    }) || [];

    if (vehicles.length === 0) return null;

    const total = vehicles.length;
    const operative = vehicles.filter((v: any) => v.status === 'OPERATIVO').length;
    const inTaller = vehicles.filter((v: any) => v.status === 'EN_TALLER').length;
    const unavailableRate = inTaller / total;

    const byType: Record<string, number> = {};
    vehicles.forEach((v: any) => { byType[v.tipo || 'Otro'] = (byType[v.tipo || 'Otro'] || 0) + 1; });

    return { total, operative, inTaller, unavailableRate, byType };
  }

  private async getQualityKPIs(tenantId: string) {
    const ncrModel = this.db.nonConformityReport || this.db.ncr || this.db.nonConformity;
    if (!ncrModel) return null;

    const ncrs = await ncrModel.findMany({
      where: { tenantId },
      select: { status: true, severity: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const openNCRs = ncrs.filter((n: any) => n.status !== 'CLOSED').length;
    const criticalNCRs = ncrs.filter((n: any) => n.severity === 'CRITICAL' || n.severity === 'HIGH').length;
    const totalNCRs = ncrs.length;

    let overdueCapas = 0;
    let totalCapas = 0;
    const capaModel = this.db.capa || this.db.correctiveAction;
    if (capaModel) {
      const capas = await capaModel.findMany({
        where: { tenantId, status: { not: 'CLOSED' } },
        select: { dueDate: true, status: true }
      });
      totalCapas = capas.length;
      overdueCapas = capas.filter((c: any) => c.dueDate && new Date(c.dueDate) < new Date()).length;
    }

    return { totalNCRs, openNCRs, criticalNCRs, totalCapas, overdueCapas };
  }

  private async getProjectKPIs(tenantId: string) {
    const projects = await this.db.project360?.findMany({
      where: { tenantId, deletedAt: null },
      select: { name: true, status: true, progress: true, budget: true, actualCost: true, endDate: true }
    }) || [];

    if (projects.length === 0) return null;

    const active = projects.filter((p: any) => !['COMPLETED', 'CANCELLED'].includes(p.status)).length;
    const completed = projects.filter((p: any) => p.status === 'COMPLETED').length;
    const atRisk = projects.filter((p: any) => {
      const overBudget = p.actualCost > p.budget && p.budget > 0;
      const overdue = p.endDate && new Date(p.endDate) < new Date() && p.status !== 'COMPLETED';
      return overBudget || overdue || p.status === 'AT_RISK';
    }).length;

    const avgProgress = projects.reduce((sum: number, p: any) => sum + (p.progress || 0), 0) / projects.length;

    return { total: projects.length, active, completed, atRisk, avgProgress: Math.round(avgProgress) };
  }

  private async getHRKPIs(tenantId: string) {
    const employees = await this.db.employee?.findMany({
      where: { tenantId, deletedAt: null },
      select: { status: true, department: true }
    }) || [];

    if (employees.length === 0) return null;

    const active = employees.filter((e: any) => e.status === 'ACTIVO').length;
    const inactive = employees.filter((e: any) => e.status === 'INACTIVO' || e.status === 'BAJA').length;

    let trainingGaps = 0;
    try {
      const competencies = await this.db.employeeCompetency?.findMany({
        where: { employee: { tenantId } },
        select: { currentLevel: true, requiredLevel: true }
      }) || [];
      trainingGaps = competencies.filter((c: any) => (c.currentLevel || 0) < (c.requiredLevel || 0)).length;
    } catch {}

    const depts: Record<string, number> = {};
    employees.forEach((e: any) => { depts[e.department || 'General'] = (depts[e.department || 'General'] || 0) + 1; });

    return { total: employees.length, active, inactive, trainingGaps, departments: depts };
  }

  private async getInspectionKPIs(tenantId: string) {
    try {
      const hallazgos = await this.db.$queryRaw`
        SELECT h.severidad, h.estado
        FROM inspeccion_hallazgos h
        JOIN inspecciones i ON i.id = h."inspeccionId"
        WHERE i."tenantId" = ${tenantId}::uuid
      ` as any[];

      if (!hallazgos || hallazgos.length === 0) return null;

      const openFindings = hallazgos.filter((h: any) => h.estado === 'ABIERTO').length;
      const criticalFindings = hallazgos.filter((h: any) => (h.severidad === 'CRITICO' || h.severidad === 'ALTO') && h.estado === 'ABIERTO').length;
      const total = hallazgos.length;
      const closed = hallazgos.filter((h: any) => h.estado === 'CERRADO').length;

      return { total, openFindings, criticalFindings, closed, closureRate: total > 0 ? Math.round((closed / total) * 100) : 0 };
    } catch {
      return null;
    }
  }

  // ── Section Builders ───────────────────────────────────────

  private buildExecutiveSummary(anomalies: any[], correlations: any[], fleet: any, quality: any, projects: any): string {
    const lines: string[] = [];

    const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
    const highCount = anomalies.filter(a => a.severity === 'high').length;

    if (criticalCount > 0) {
      lines.push(`⚠️ **${criticalCount} anomalía(s) crítica(s)** requieren atención inmediata.`);
    }
    if (highCount > 0) {
      lines.push(`🔶 **${highCount} anomalía(s) de alta prioridad** detectadas.`);
    }
    if (correlations.length > 0) {
      lines.push(`🔗 Se identificaron **${correlations.length} correlaciones** entre módulos que afectan la operación.`);
    }

    if (fleet) {
      lines.push(`🚛 Flota: **${fleet.operative}/${fleet.total}** vehículos operativos (${Math.round((1 - fleet.unavailableRate) * 100)}% disponibilidad).`);
    }
    if (quality) {
      lines.push(`📋 Calidad: **${quality.openNCRs}** NCRs abiertas, **${quality.overdueCapas}** CAPAs vencidas.`);
    }
    if (projects) {
      lines.push(`📊 Proyectos: **${projects.active}** activos, **${projects.atRisk}** en riesgo, progreso promedio **${projects.avgProgress}%**.`);
    }

    if (lines.length === 0) {
      lines.push('✅ Operaciones dentro de parámetros normales. Sin alertas críticas.');
    }

    return lines.join('\n\n');
  }

  private buildAnomalySection(anomalies: any[]): string {
    const lines: string[] = [];
    const sorted = anomalies.sort((a: any, b: any) => {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity] || 3) - (order[b.severity] || 3);
    });

    for (const a of sorted.slice(0, 8)) {
      const icon = a.severity === 'critical' ? '🔴' : a.severity === 'high' ? '🟠' : '🟡';
      lines.push(`${icon} **${a.title}** (${a.module})\n   ${a.description}\n   _Recomendación: ${a.recommendation}_`);
    }

    return lines.join('\n\n');
  }

  private buildFleetSection(fleet: any): string {
    const lines: string[] = [];
    lines.push(`| Indicador | Valor |`);
    lines.push(`|-----------|-------|`);
    lines.push(`| Total vehículos | ${fleet.total} |`);
    lines.push(`| Operativos | ${fleet.operative} (${Math.round((fleet.operative / fleet.total) * 100)}%) |`);
    lines.push(`| En taller | ${fleet.inTaller} |`);
    lines.push(`| Disponibilidad | ${Math.round((1 - fleet.unavailableRate) * 100)}% |`);

    if (fleet.unavailableRate > 0.15) {
      lines.push(`\n⚠️ Disponibilidad por debajo del umbral aceptable (85%).`);
    }

    return lines.join('\n');
  }

  private buildQualitySection(quality: any): string {
    const lines: string[] = [];
    lines.push(`| Indicador | Valor |`);
    lines.push(`|-----------|-------|`);
    lines.push(`| NCRs totales | ${quality.totalNCRs} |`);
    lines.push(`| NCRs abiertas | ${quality.openNCRs} |`);
    lines.push(`| NCRs críticas/altas | ${quality.criticalNCRs} |`);
    lines.push(`| CAPAs abiertas | ${quality.totalCapas} |`);
    lines.push(`| CAPAs vencidas | ${quality.overdueCapas} |`);

    if (quality.overdueCapas > 0) {
      lines.push(`\n⚠️ **${quality.overdueCapas} CAPAs vencidas** requieren escalamiento.`);
    }

    return lines.join('\n');
  }

  private buildProjectSection(projects: any): string {
    const lines: string[] = [];
    lines.push(`| Indicador | Valor |`);
    lines.push(`|-----------|-------|`);
    lines.push(`| Total proyectos | ${projects.total} |`);
    lines.push(`| Activos | ${projects.active} |`);
    lines.push(`| Completados | ${projects.completed} |`);
    lines.push(`| En riesgo | ${projects.atRisk} |`);
    lines.push(`| Progreso promedio | ${projects.avgProgress}% |`);

    if (projects.atRisk > 0) {
      lines.push(`\n⚠️ **${projects.atRisk} proyecto(s)** con desvío de presupuesto o cronograma.`);
    }

    return lines.join('\n');
  }

  private buildHRSection(hr: any): string {
    const lines: string[] = [];
    lines.push(`| Indicador | Valor |`);
    lines.push(`|-----------|-------|`);
    lines.push(`| Dotación total | ${hr.total} |`);
    lines.push(`| Activos | ${hr.active} |`);
    lines.push(`| Inactivos/Baja | ${hr.inactive} |`);
    lines.push(`| Brechas de competencia | ${hr.trainingGaps} |`);

    if (hr.trainingGaps > 5) {
      lines.push(`\n⚠️ **${hr.trainingGaps} brechas** de competencia requieren plan de capacitación.`);
    }

    return lines.join('\n');
  }

  private buildInspectionSection(inspections: any): string {
    const lines: string[] = [];
    lines.push(`| Indicador | Valor |`);
    lines.push(`|-----------|-------|`);
    lines.push(`| Hallazgos totales | ${inspections.total} |`);
    lines.push(`| Hallazgos abiertos | ${inspections.openFindings} |`);
    lines.push(`| Críticos/Altos abiertos | ${inspections.criticalFindings} |`);
    lines.push(`| Tasa de cierre | ${inspections.closureRate}% |`);

    if (inspections.criticalFindings > 0) {
      lines.push(`\n⚠️ **${inspections.criticalFindings} hallazgos críticos** abiertos requieren acción inmediata.`);
    }

    return lines.join('\n');
  }

  private buildCorrelationSection(correlations: any[]): string {
    const lines: string[] = [];
    for (const c of correlations.slice(0, 5)) {
      const icon = c.severity === 'critical' ? '🔴' : c.severity === 'high' ? '🟠' : '🔵';
      lines.push(`${icon} **${c.title}**\n   ${c.description}\n   Fuentes: ${c.dataSources.join(', ')}`);
    }
    return lines.join('\n\n');
  }

  private buildRecommendations(anomalies: any[], correlations: any[], fleet: any, quality: any, projects: any): string {
    const recs: string[] = [];
    let priority = 1;

    // Critical anomalies
    const criticals = anomalies.filter(a => a.severity === 'critical');
    for (const c of criticals.slice(0, 3)) {
      recs.push(`${priority}. 🔴 **[URGENTE]** ${c.recommendation}`);
      priority++;
    }

    // High anomalies
    const highs = anomalies.filter(a => a.severity === 'high');
    for (const h of highs.slice(0, 3)) {
      recs.push(`${priority}. 🟠 **[ALTA]** ${h.recommendation}`);
      priority++;
    }

    // Correlation-based
    for (const c of correlations.filter(c => c.severity === 'high' || c.severity === 'critical').slice(0, 2)) {
      recs.push(`${priority}. 🔗 **[SISTÉMICO]** ${c.recommendation}`);
      priority++;
    }

    // Quality-specific
    if (quality && quality.overdueCapas > 2) {
      recs.push(`${priority}. 📋 Escalar las ${quality.overdueCapas} CAPAs vencidas a la dirección de calidad.`);
      priority++;
    }

    // Fleet-specific
    if (fleet && fleet.unavailableRate > 0.15) {
      recs.push(`${priority}. 🚛 Evaluar capacidad del taller y priorizar reparaciones de flota.`);
      priority++;
    }

    // Projects-specific
    if (projects && projects.atRisk > 0) {
      recs.push(`${priority}. 📊 Revisión de cronograma de los ${projects.atRisk} proyectos en riesgo.`);
      priority++;
    }

    if (recs.length === 0) {
      recs.push('1. ✅ Mantener monitoreo regular. Sin acciones urgentes requeridas.');
    }

    return recs.join('\n\n');
  }

  // ── Markdown Compiler ──────────────────────────────────────

  private compileMarkdown(sections: ReportSection[], period: string): string {
    const now = new Date();
    let md = `# 📊 Reporte Ejecutivo SGI360\n\n`;
    md += `**Período:** ${period}\n`;
    md += `**Generado:** ${now.toLocaleDateString('es-AR')} ${now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}\n`;
    md += `**Motor:** SGI360 AI Executive Intelligence\n\n`;
    md += `---\n\n`;

    for (const section of sections) {
      md += `## ${section.title}\n\n`;
      md += `${section.content}\n\n`;
    }

    md += `---\n\n`;
    md += `_Este reporte fue generado automáticamente por SGI360 AI. Los datos reflejan el estado del sistema al momento de la generación._\n`;

    return md;
  }
}

export default ExecutiveReportGenerator;
