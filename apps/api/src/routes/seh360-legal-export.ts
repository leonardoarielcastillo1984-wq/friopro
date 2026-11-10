import { FastifyInstance } from 'fastify';
import XLSX from 'xlsx';

const tid = (req: any) => req.sehAuth?.tenantId;

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente', COMPLIANT: 'Cumple', PARTIAL: 'Parcial',
  NON_COMPLIANT: 'No cumple', NOT_APPLICABLE: 'No aplica',
};

/**
 * Export de la matriz legal SEH a XLSX.
 * GET /seh360/legal-export?clientId= → descarga 'matriz-legal-<cliente>.xlsx'
 * Hojas: Requisitos | Resumen por estado | Resumen por normativa
 */
export const registerSeh360LegalExportRoutes = async (app: FastifyInstance) => {

  app.get('/seh360/legal-export', async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const prisma = (app as any).prisma;
    const { clientId } = req.query as any;
    const where: any = { tenantId: t, deletedAt: null };
    if (clientId) where.clientId = clientId;

    const [items, client] = await Promise.all([
      prisma.sehLegalRequirement.findMany({ where, orderBy: [{ normative: 'asc' }, { createdAt: 'asc' }] }),
      clientId ? prisma.sehClient.findFirst({ where: { id: clientId, tenantId: t }, select: { name: true } }) : null,
    ]);
    if (!items.length) return reply.code(404).send({ error: 'No hay requisitos legales para exportar' });

    const fmt = (d: any) => d ? new Date(d).toLocaleDateString('es-AR') : '';

    // Hoja 1: detalle
    const detail = items.map((i: any) => ({
      'Norma': i.normative,
      'Artículo': i.article || '',
      'Requisito': i.description,
      'Jurisdicción': i.jurisdiction || '',
      'Autoridad fiscalizadora': i.enforcingAuthority || '',
      'Actividad': i.activity || '',
      'Criticidad': i.criticality || '',
      'Estado': STATUS_LABELS[i.status] || i.status,
      'Cumplimiento %': i.complianceScore ?? '',
      'Evidencia requerida': i.evidenceRequired || '',
      'Responsable': i.responsible || '',
      'Última revisión': fmt(i.lastReview),
      'Próxima revisión': fmt(i.nextReview),
      'Notas': i.notes || '',
    }));

    // Hoja 2: resumen por estado
    const byStatus: Record<string, number> = {};
    for (const i of items) byStatus[i.status] = (byStatus[i.status] || 0) + 1;
    const statusRows = Object.entries(byStatus).map(([s, n]) => ({
      'Estado': STATUS_LABELS[s] || s, 'Cantidad': n,
      '% del total': Math.round((n / items.length) * 100) + '%',
    }));

    // Hoja 3: resumen por normativa
    const groups: Record<string, { total: number; ok: number }> = {};
    for (const i of items) {
      if (!groups[i.normative]) groups[i.normative] = { total: 0, ok: 0 };
      groups[i.normative].total++;
      if (i.status === 'COMPLIANT') groups[i.normative].ok++;
    }
    const normRows = Object.entries(groups).map(([norm, g]) => ({
      'Norma': norm, 'Requisitos': g.total, 'Cumple': g.ok,
      '% cumplimiento': Math.round((g.ok / g.total) * 100) + '%',
    }));

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(detail);
    ws1['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 60 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Requisitos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(statusRows), 'Por estado');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(normRows), 'Por normativa');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const name = (client?.name || 'matriz-legal').replace(/[^a-z0-9áéíóúñü-]/gi, '-').toLowerCase();
    reply.header('Content-Disposition', `attachment; filename="matriz-legal-${name}.xlsx"`);
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return reply.send(buf);
  });
};
