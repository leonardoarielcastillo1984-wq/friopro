'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { FileText, Loader2, Download } from 'lucide-react';

interface TenantReportButtonProps {
  tenantId: string;
  tenantName: string;
}

export default function TenantReportButton({ tenantId, tenantName }: TenantReportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function generateReport() {
    setLoading(true);
    try {
      const report = await apiFetch(`/super-admin/tenants/${tenantId}/full-report`);
      
      // Generar TXT formateado
      const txt = formatReportAsTxt(report, tenantName);
      
      // Descargar
      const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-${tenantName.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={generateReport}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
      title="Descargar reporte completo del tenant"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      {loading ? 'Generando...' : 'Reporte'}
    </button>
  );
}

function formatReportAsTxt(report: any, tenantName: string): string {
  const d = new Date();
  const fecha = d.toLocaleString('es-AR', { dateStyle: 'full', timeStyle: 'short' });
  
  let txt = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    REPORTE DE TENANT - SGI 360                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Generado: ${fecha.padEnd(67)}║
╚══════════════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════════════════
  1. RESUMEN DEL TENANT
═══════════════════════════════════════════════════════════════════════════════

  Nombre:        ${report.tenant.name}
  ID:            ${report.tenant.id}
  Slug:          ${report.tenant.slug}
  Estado:        ${report.tenant.status}
  Creado:        ${new Date(report.tenant.createdAt).toLocaleDateString('es-AR')}
  Miembros:      ${report.tenant.memberCount}

  ── Suscripción ─────────────────────────────────────────────────────────────
  Plan:          ${report.tenant.plan}
  Tier:          ${report.tenant.planTier}
  Estado:        ${report.tenant.subscriptionStatus}
  Inicio:        ${report.tenant.subscriptionStarted ? new Date(report.tenant.subscriptionStarted).toLocaleDateString('es-AR') : 'N/A'}
  Vencimiento:   ${report.tenant.subscriptionEnds ? new Date(report.tenant.subscriptionEnds).toLocaleDateString('es-AR') : 'N/A'}


═══════════════════════════════════════════════════════════════════════════════
  2. ESTADÍSTICAS DE ENTIDADES
═══════════════════════════════════════════════════════════════════════════════

  Total de entidades: ${report.statistics.totalEntities}

  ┌─────────────────────────────┬──────────┐
  │ Módulo                      │ Cantidad │
  ├─────────────────────────────┼──────────┤
  │ Usuarios                    │ ${String(report.statistics.users).padEnd(8)} │
  │ Empleados                   │ ${String(report.statistics.employees).padEnd(8)} │
  │ Documentos                  │ ${String(report.statistics.documents).padEnd(8)} │
  │ No Conformidades            │ ${String(report.statistics.nonConformities).padEnd(8)} │
  │ Riesgos                     │ ${String(report.statistics.risks).padEnd(8)} │
  │ Indicadores                 │ ${String(report.statistics.indicators).padEnd(8)} │
  │ Auditorías                  │ ${String(report.statistics.audits).padEnd(8)} │
  │ Capacitaciones              │ ${String(report.statistics.trainings).padEnd(8)} │
  │ Incidentes                  │ ${String(report.statistics.incidents).padEnd(8)} │
  │ Simulacros                  │ ${String(report.statistics.drills).padEnd(8)} │
  │ Reuniones                   │ ${String(report.statistics.meetings).padEnd(8)} │
  │ Objetivos                   │ ${String(report.statistics.objectives).padEnd(8)} │
  │ Partes Interesadas          │ ${String(report.statistics.stakeholders).padEnd(8)} │
  │ Proveedores                 │ ${String(report.statistics.suppliers).padEnd(8)} │
  │ Clientes                    │ ${String(report.statistics.customers).padEnd(8)} │
  │ Proyectos                   │ ${String(report.statistics.projects).padEnd(8)} │
  └─────────────────────────────┴──────────┘


═══════════════════════════════════════════════════════════════════════════════
  3. ACTIVIDAD RECIENTE POR MÓDULO (últimos 30 días)
═══════════════════════════════════════════════════════════════════════════════

`;

  if (report.recentActivity && report.recentActivity.length > 0) {
    report.recentActivity.forEach((a: any) => {
      txt += `  • ${a.module.padEnd(25)} ${String(a.events).padStart(5)} eventos\n`;
    });
  } else {
    txt += '  Sin actividad reciente\n';
  }

  txt += `

═══════════════════════════════════════════════════════════════════════════════
  4. CREACIONES POR MES (último año)
═══════════════════════════════════════════════════════════════════════════════

`;

  if (report.monthlyCreations && report.monthlyCreations.length > 0) {
    report.monthlyCreations.forEach((m: any) => {
      txt += `  • ${m.action.padEnd(40)} ${String(m.count).padStart(5)}\n`;
    });
  } else {
    txt += '  Sin creaciones registradas\n';
  }

  txt += `

═══════════════════════════════════════════════════════════════════════════════
  5. PAGOS RECIENTES
═══════════════════════════════════════════════════════════════════════════════

`;

  if (report.payments && report.payments.length > 0) {
    txt += '  ID                           │ Monto      │ Estado      │ Fecha\n';
    txt += '  ─────────────────────────────────────────────────────────────────\n';
    report.payments.forEach((p: any) => {
      const monto = `$${p.amount} ${p.currency}`;
      txt += `  ${p.id.slice(0, 26).padEnd(28)} │ ${monto.padEnd(10)} │ ${p.status.padEnd(11)} │ ${new Date(p.date).toLocaleDateString('es-AR')}\n`;
    });
  } else {
    txt += '  Sin pagos registrados\n';
  }

  txt += `

═══════════════════════════════════════════════════════════════════════════════
  6. LOGINS RECIENTES
═══════════════════════════════════════════════════════════════════════════════

`;

  if (report.recentLogins && report.recentLogins.length > 0) {
    txt += '  Acción              │ Usuario              │ Fecha                │ IP\n';
    txt += '  ─────────────────────────────────────────────────────────────────────\n';
    report.recentLogins.slice(0, 30).forEach((l: any) => {
      txt += `  ${l.action.padEnd(19)} │ ${(l.userId || 'N/A').slice(0, 20).padEnd(20)} │ ${new Date(l.date).toLocaleString('es-AR').padEnd(20)} │ ${l.ip || 'N/A'}\n`;
    });
  } else {
    txt += '  Sin logins registrados\n';
  }

  txt += `

═══════════════════════════════════════════════════════════════════════════════
  7. EVENTOS DE SEGURIDAD / ALERTAS
═══════════════════════════════════════════════════════════════════════════════

`;

  if (report.securityEvents && report.securityEvents.length > 0) {
    txt += '  ⚠️  EVENTOS DETECTADOS:\n\n';
    txt += '  Acción                      │ Usuario              │ Fecha                │ IP\n';
    txt += '  ─────────────────────────────────────────────────────────────────────\n';
    report.securityEvents.forEach((s: any) => {
      txt += `  ${s.action.padEnd(27)} │ ${(s.userId || 'N/A').slice(0, 20).padEnd(20)} │ ${new Date(s.date).toLocaleString('es-AR').padEnd(20)} │ ${s.ip || 'N/A'}\n`;
    });
  } else {
    txt += '  ✅ Sin eventos de seguridad detectados\n';
  }

  txt += `

═══════════════════════════════════════════════════════════════════════════════
  8. HISTORIAL COMPLETO DE AUDITORÍA (últimos 200 eventos)
═══════════════════════════════════════════════════════════════════════════════

`;

  if (report.auditHistory && report.auditHistory.length > 0) {
    txt += '  Fecha                │ Acción                    │ Entidad         │ Actor\n';
    txt += '  ──────────────────────────────────────────────────────────────────────\n';
    report.auditHistory.forEach((h: any) => {
      const fecha = new Date(h.date).toLocaleString('es-AR');
      txt += `  ${fecha.padEnd(20)} │ ${h.action.padEnd(25)} │ ${(h.entityType || 'N/A').padEnd(15)} │ ${(h.actorUserId || 'Sistema').slice(0, 20)}\n`;
    });
  } else {
    txt += '  Sin eventos de auditoría\n';
  }

  txt += `

═══════════════════════════════════════════════════════════════════════════════
  FIN DEL REPORTE
═══════════════════════════════════════════════════════════════════════════════

Generado por SGI 360 - SuperAdmin Dashboard
  `;

  return txt;
}
