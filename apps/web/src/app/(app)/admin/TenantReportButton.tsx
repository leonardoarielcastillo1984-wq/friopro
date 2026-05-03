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
      const report = await apiFetch(`/super-admin/tenants/${tenantId}/full-report`) as any;
      
      if (!report || report.error) {
        throw new Error(report?.error || 'Respuesta vacía del servidor');
      }
      if (!report.tenant) {
        throw new Error('Estructura de reporte inválida: falta tenant. Respuesta: ' + JSON.stringify(report).slice(0, 200));
      }
      
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
    } catch (error: any) {
      console.error('Error generating report:', error);
      alert('Error al generar el reporte: ' + (error?.message || String(error)));
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

  ── Almacenamiento ──────────────────────────────────────────────────────────
  Usado:         ${report.storageUsage ? (report.storageUsage.usedGB >= 1 ? `${report.storageUsage.usedGB} GB` : `${report.storageUsage.usedMB} MB`) : 'N/A'}
  Límite:        ${report.storageUsage ? `${report.storageUsage.limitGB} GB` : 'N/A'}
  Ocupación:     ${report.storageUsage ? `${report.storageUsage.percentage}%` : 'N/A'}


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

  // 9. TRAZABILIDAD DE DOCUMENTOS
  txt += `

═══════════════════════════════════════════════════════════════════════════════
  9. TRAZABILIDAD DE DOCUMENTOS (últimos 30 días)
═══════════════════════════════════════════════════════════════════════════════

`;

  if (report.documentTraceability) {
    const dt = report.documentTraceability;
    txt += `  Documentos eliminados: ${dt.deletedDocuments?.length || 0}\n`;
    if (dt.deletedDocuments?.length > 0) {
      txt += '  Fecha                │ ID Documento              │ Actor\n';
      txt += '  ─────────────────────────────────────────────────────────────\n';
      dt.deletedDocuments.forEach((d: any) => {
        txt += `  ${new Date(d.date).toLocaleString('es-AR').padEnd(20)} │ ${(d.entityId || 'N/A').padEnd(25)} │ ${(d.actorUserId || 'Sistema').slice(0, 20)}\n`;
      });
    }
    txt += `\n  Documentos modificados: ${dt.modifiedDocuments?.length || 0}\n`;
    if (dt.modifiedDocuments?.length > 0) {
      txt += '  Fecha                │ ID Documento              │ Actor\n';
      txt += '  ─────────────────────────────────────────────────────────────\n';
      dt.modifiedDocuments.forEach((d: any) => {
        txt += `  ${new Date(d.date).toLocaleString('es-AR').padEnd(20)} │ ${(d.entityId || 'N/A').padEnd(25)} │ ${(d.actorUserId || 'Sistema').slice(0, 20)}\n`;
      });
    }
    txt += `\n  Versiones creadas: ${dt.createdVersions?.length || 0}\n`;
    if (dt.createdVersions?.length > 0) {
      txt += '  Fecha                │ Documento                 │ Versión\n';
      txt += '  ─────────────────────────────────────────────────────────────\n';
      dt.createdVersions.forEach((v: any) => {
        txt += `  ${new Date(v.date).toLocaleString('es-AR').padEnd(20)} │ ${(v.documentId || 'N/A').padEnd(25)} │ ${v.version || '-'}\n`;
      });
    }
    txt += `\n  Cambios de estado: ${dt.statusChanges?.length || 0}\n`;
    if (dt.statusChanges?.length > 0) {
      txt += '  Fecha                │ Acción                    │ Documento\n';
      txt += '  ─────────────────────────────────────────────────────────────\n';
      dt.statusChanges.forEach((s: any) => {
        txt += `  ${new Date(s.date).toLocaleString('es-AR').padEnd(20)} │ ${(s.action || 'N/A').padEnd(25)} │ ${(s.entityId || 'N/A').slice(0, 20)}\n`;
      });
    }
    txt += `\n  Descargas: ${dt.documentDownloads?.length || 0}\n`;
    if (dt.documentDownloads?.length > 0) {
      txt += '  Fecha                │ Documento                 │ Usuario\n';
      txt += '  ─────────────────────────────────────────────────────────────\n';
      dt.documentDownloads.forEach((d: any) => {
        txt += `  ${new Date(d.date).toLocaleString('es-AR').padEnd(20)} │ ${(d.entityId || 'N/A').padEnd(25)} │ ${(d.actorUserId || 'Anónimo').slice(0, 20)}\n`;
      });
    }
  } else {
    txt += '  Sin datos de trazabilidad de documentos\n';
  }

  // 10. SEGURIDAD Y ACCESOS
  txt += `

═══════════════════════════════════════════════════════════════════════════════
  10. SEGURIDAD Y ACCESOS
═══════════════════════════════════════════════════════════════════════════════

`;

  if (report.securityAccess) {
    const sa = report.securityAccess;
    txt += `  Cambios de permisos: ${sa.permissionChanges?.length || 0}\n`;
    if (sa.permissionChanges?.length > 0) {
      txt += '  Fecha                │ Entidad      │ Acción                    \n';
      txt += '  ─────────────────────────────────────────────────────────────\n';
      sa.permissionChanges.forEach((p: any) => {
        txt += `  ${new Date(p.date).toLocaleString('es-AR').padEnd(20)} │ ${(p.entityType || 'N/A').padEnd(12)} │ ${(p.action || 'N/A').padEnd(25)}\n`;
      });
    }
    txt += `\n  Usuarios creados: ${sa.userCreations?.length || 0}\n`;
    if (sa.userCreations?.length > 0) {
      txt += '  Fecha                │ Tipo         │ ID                        \n';
      txt += '  ─────────────────────────────────────────────────────────────\n';
      sa.userCreations.forEach((u: any) => {
        txt += `  ${new Date(u.date).toLocaleString('es-AR').padEnd(20)} │ ${(u.entityType || 'N/A').padEnd(12)} │ ${(u.entityId || 'N/A').padEnd(25)}\n`;
      });
    }
    txt += `\n  Usuarios eliminados: ${sa.userDeletions?.length || 0}\n`;
    if (sa.userDeletions?.length > 0) {
      txt += '  Fecha                │ Tipo         │ ID                        \n';
      txt += '  ─────────────────────────────────────────────────────────────\n';
      sa.userDeletions.forEach((u: any) => {
        txt += `  ${new Date(u.date).toLocaleString('es-AR').padEnd(20)} │ ${(u.entityType || 'N/A').padEnd(12)} │ ${(u.entityId || 'N/A').padEnd(25)}\n`;
      });
    }
    txt += `\n  Cambios de rol: ${sa.roleChanges?.length || 0}\n`;
    if (sa.roleChanges?.length > 0) {
      txt += '  Fecha                │ Entidad      │ Acción                    \n';
      txt += '  ─────────────────────────────────────────────────────────────\n';
      sa.roleChanges.forEach((r: any) => {
        txt += `  ${new Date(r.date).toLocaleString('es-AR').padEnd(20)} │ ${(r.entityType || 'N/A').padEnd(12)} │ ${(r.action || 'N/A').padEnd(25)}\n`;
      });
    }
  } else {
    txt += '  Sin datos de seguridad y accesos\n';
  }

  // 11. EVENTOS CRÍTICOS DEL SISTEMA
  txt += `

═══════════════════════════════════════════════════════════════════════════════
  11. EVENTOS CRÍTICOS DEL SISTEMA
═══════════════════════════════════════════════════════════════════════════════

`;

  if (report.criticalEvents) {
    const ce = report.criticalEvents;
    txt += `  Eliminaciones masivas: ${ce.bulkDeletions?.length || 0}\n`;
    if (ce.bulkDeletions?.length > 0) {
      txt += '  Fecha                │ Entidad      │ Actor\n';
      txt += '  ─────────────────────────────────────────────────────────────\n';
      ce.bulkDeletions.forEach((b: any) => {
        txt += `  ${new Date(b.date).toLocaleString('es-AR').padEnd(20)} │ ${(b.entityType || 'N/A').padEnd(12)} │ ${(b.actorUserId || 'Sistema').slice(0, 20)}\n`;
      });
    }
    txt += `\n  Exportaciones: ${ce.dataExports?.length || 0}\n`;
    if (ce.dataExports?.length > 0) {
      txt += '  Fecha                │ Entidad      │ Acción                    │ Actor\n';
      txt += '  ─────────────────────────────────────────────────────────────────\n';
      ce.dataExports.forEach((e: any) => {
        txt += `  ${new Date(e.date).toLocaleString('es-AR').padEnd(20)} │ ${(e.entityType || 'N/A').padEnd(12)} │ ${(e.action || 'N/A').padEnd(25)} │ ${(e.actorUserId || 'Sistema').slice(0, 20)}\n`;
      });
    }
    txt += `\n  Descargas sensibles: ${ce.sensitiveDownloads?.length || 0}\n`;
    if (ce.sensitiveDownloads?.length > 0) {
      txt += '  Fecha                │ Tipo         │ Documento/Entidad\n';
      txt += '  ─────────────────────────────────────────────────────────────\n';
      ce.sensitiveDownloads.forEach((s: any) => {
        txt += `  ${new Date(s.date).toLocaleString('es-AR').padEnd(20)} │ ${(s.entityType || 'N/A').padEnd(12)} │ ${(s.entityId || 'N/A').padEnd(25)}\n`;
      });
    }
    txt += `\n  Cambios de configuración tenant: ${ce.tenantConfigChanges?.length || 0}\n`;
    if (ce.tenantConfigChanges?.length > 0) {
      txt += '  Fecha                │ ID Tenant    │ Actor\n';
      txt += '  ─────────────────────────────────────────────────────────────\n';
      ce.tenantConfigChanges.forEach((t: any) => {
        txt += `  ${new Date(t.date).toLocaleString('es-AR').padEnd(20)} │ ${(t.entityId || 'N/A').padEnd(12)} │ ${(t.actorUserId || 'Sistema').slice(0, 20)}\n`;
      });
    }
    txt += `\n  Intentos de acceso a licencias: ${ce.licenseAccessAttempts?.length || 0}\n`;
    if (ce.licenseAccessAttempts?.length > 0) {
      txt += '  Fecha                │ Módulo            │ Ruta                      │ Intentos\n';
      txt += '  ──────────────────────────────────────────────────────────────────────────\n';
      ce.licenseAccessAttempts.forEach((a: any) => {
        txt += `  ${new Date(a.date).toLocaleString('es-AR').padEnd(20)} │ ${(a.module || 'N/A').padEnd(17)} │ ${(a.path || 'N/A').padEnd(25)} │ ${a.count || 1}\n`;
      });
    }
  } else {
    txt += '  Sin eventos críticos registrados\n';
  }

  // 12. USO DEL SISTEMA (ANALÍTICA)
  txt += `

═══════════════════════════════════════════════════════════════════════════════
  12. USO DEL SISTEMA (ANALÍTICA)
═══════════════════════════════════════════════════════════════════════════════

`;

  if (report.systemUsage) {
    const su = report.systemUsage;
    txt += `  Usuarios activos (últimos 30 días): ${su.activeUsersLast30d || 0}\n`;
    txt += `  Usuarios inactivos: ${su.inactiveUsers || 0}\n\n`;

    txt += '  Ranking de uso por módulo (eventos):\n';
    txt += '  Módulo                    │ Eventos\n';
    txt += '  ─────────────────────────────────────\n';
    if (su.moduleUsageRanking?.length > 0) {
      su.moduleUsageRanking.forEach((m: any) => {
        txt += `  ${(m.module || 'N/A').padEnd(25)} │ ${m.events || 0}\n`;
      });
    } else {
      txt += '  Sin datos de uso\n';
    }

    if (su.unusedModules?.length > 0) {
      txt += `\n  Módulos sin uso detectado: ${su.unusedModules.length}\n`;
      txt += '  ' + su.unusedModules.join(', ') + '\n';
    }
  } else {
    txt += '  Sin datos de uso del sistema\n';
  }

  // 13. USO DE IA
  txt += `

═══════════════════════════════════════════════════════════════════════════════
  13. USO DE IA
═══════════════════════════════════════════════════════════════════════════════

`;

  if (report.aiUsage) {
    const ai = report.aiUsage;

    txt += `  ── Uso General del Sistema de IA ───────────────────────────────────────────\n`;
    if (ai.generalUsage) {
      const g = ai.generalUsage;
      txt += `  Interacciones totales:        ${g.totalInteractions || 0}\n`;
      txt += `  Tokens consumidos (total):    ${(g.totalTokens || 0).toLocaleString('es-AR')}\n`;
      txt += `  Interacciones (30 días):      ${g.interactionsLast30d || 0}\n`;
      txt += `  Tokens (últimos 30 días):     ${(g.tokensLast30d || 0).toLocaleString('es-AR')}\n\n`;

      if (g.byModule?.length > 0) {
        txt += '  Uso por módulo:\n';
        txt += '  Módulo                     │ Interacciones │ Tokens\n';
        txt += '  ────────────────────────────────────────────────────────\n';
        g.byModule.forEach((m: any) => {
          txt += `  ${(m.module || 'N/A').padEnd(26)} │ ${String(m.interactions || 0).padEnd(13)} │ ${(m.tokens || 0).toLocaleString('es-AR')}\n`;
        });
        txt += '\n';
      } else {
        txt += '  Sin interacciones de IA registradas en el sistema\n\n';
      }
    } else {
      txt += '  Sin datos de uso general (módulo nuevo — los datos se acumulan desde ahora)\n\n';
    }

    txt += `  ── Análisis IA Documento vs Norma (hallazgos últimos 30 días) ──────────────\n`;
    txt += `  Hallazgos generados: ${ai.totalAiFindingsLast30d || 0}\n\n`;

    if (ai.aiUsageByType?.length > 0) {
      txt += '  Tipo de auditoría              │ Hallazgos\n';
      txt += '  ────────────────────────────────────────\n';
      ai.aiUsageByType.forEach((t: any) => {
        txt += `  ${(t.type || 'N/A').padEnd(30)} │ ${t.count || 0}\n`;
      });
    }
  } else {
    txt += '  Sin datos de uso de IA\n';
  }

  // 14. ELIMINACIÓN DE REGISTROS
  txt += `

═══════════════════════════════════════════════════════════════════════════════
  14. ELIMINACIÓN DE REGISTROS (últimos 12 meses)
═══════════════════════════════════════════════════════════════════════════════

`;

  if (report.recordDeletions) {
    const rd = report.recordDeletions;
    txt += '  Eliminaciones por tipo de entidad:\n';
    txt += '  Entidad                   │ Cantidad\n';
    txt += '  ─────────────────────────────────────\n';
    if (rd.deletionsByEntity?.length > 0) {
      rd.deletionsByEntity.forEach((d: any) => {
        txt += `  ${(d.entityType || 'N/A').padEnd(25)} │ ${d.count || 0}\n`;
      });
    } else {
      txt += '  Sin eliminaciones registradas\n';
    }

    txt += `\n  Eliminaciones recientes: ${rd.recentDeletions?.length || 0}\n`;
    if (rd.recentDeletions?.length > 0) {
      txt += '  Fecha                │ Entidad      │ ID                        │ Actor\n';
      txt += '  ─────────────────────────────────────────────────────────────────────\n';
      rd.recentDeletions.forEach((r: any) => {
        txt += `  ${new Date(r.date).toLocaleString('es-AR').padEnd(20)} │ ${(r.entityType || 'N/A').padEnd(12)} │ ${(r.entityId || 'N/A').padEnd(25)} │ ${(r.actorUserId || 'Sistema').slice(0, 20)}\n`;
      });
    }
  } else {
    txt += '  Sin datos de eliminaciones\n';
  }

  txt += `

═══════════════════════════════════════════════════════════════════════════════
  FIN DEL REPORTE
═══════════════════════════════════════════════════════════════════════════════

Generado por SGI 360 - SuperAdmin Dashboard
  `;

  return txt;
}
