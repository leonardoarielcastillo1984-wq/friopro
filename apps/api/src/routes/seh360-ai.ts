import { FastifyInstance } from 'fastify';
import { createGroqOnlyLLMProvider } from '../services/llm/factory.js';

const tid = (req: any) => req.sehAuth?.tenantId;

/**
 * Análisis IA para SEH360 (solo resume/sugiere, no modifica datos).
 * POST /seh360/ai/risk-analysis  → análisis de la matriz de riesgos del cliente
 * POST /seh360/ai/action-suggest → sugiere acciones para un riesgo/incidente puntual
 * POST /seh360/ai/legal-digest   → resumen de matriz legal + brechas
 */
export const registerSeh360AIRoutes = async (app: FastifyInstance) => {

  const llmFor = (req: any) => {
    const t = tid(req)!;
    return createGroqOnlyLLMProvider((req as any).tenant, (app as any).prisma, t, req.sehAuth?.userId ?? null, 'seh360');
  };

  app.post('/seh360/ai/risk-analysis', async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const { clientId } = (req.body as any) || {};
    if (!clientId) return reply.code(400).send({ error: 'clientId requerido' });
    const prisma = (app as any).prisma;

    const [client, risks, incidents, plans] = await Promise.all([
      prisma.sehClient.findFirst({ where: { id: clientId, tenantId: t }, select: { name: true, activity: true } }),
      prisma.sehRisk.findMany({ where: { tenantId: t, clientId, deletedAt: null }, orderBy: { riskLevel: 'desc' }, take: 50 }),
      prisma.sehIncident.findMany({ where: { tenantId: t, clientId, deletedAt: null, status: { not: 'CLOSED' } }, take: 20 }),
      prisma.sehActionPlan.findMany({ where: { tenantId: t, clientId, deletedAt: null, status: { in: ['PENDING', 'IN_PROGRESS'] } }, take: 30 }),
    ]);
    if (!client) return reply.code(404).send({ error: 'Cliente no encontrado' });
    if (!risks.length) return reply.send({ analysis: 'El cliente no tiene riesgos cargados en su matriz.' });

    const context = {
      empresa: client.name, actividad: client.activity,
      riesgos: risks.map((r: any) => ({ titulo: r.title, actividad: r.activity, nivel: r.riskLevel, residual: r.residualLevel, control: r.controlMeasure })),
      incidentesAbiertos: incidents.map((i: any) => ({ titulo: i.title, severidad: i.severity, lesionados: i.injuredCount })),
      planesPendientes: plans.map((p: any) => ({ titulo: p.title, vence: p.dueDate })),
    };
    const prompt = `Sos profesional de Seguridad e Higiene (SyH). Analizá la matriz de esta empresa y respondé en español, breve y accionable.\n\n` +
      `Datos: ${JSON.stringify(context)}\n\n` +
      `Devolvé en secciones cortas: 1) Riesgos prioritarios (top 3 con justificación), 2) Brechas de control detectadas, ` +
      `3) Controles recomendados según jerarquía (eliminación→EPP), 4) Alertas sobre incidentes abiertos, 5) Planes de acción sugeridos. ` +
      `No inventes normas específicas ni datos fuera del contexto.`;
    try {
      const res = await llmFor(req).chat([{ role: 'user', content: prompt }], 1500);
      return reply.send({ analysis: res?.text || 'Sin respuesta del modelo' });
    } catch (e: any) {
      return reply.code(500).send({ error: 'No se pudo generar el análisis con IA', details: e?.message });
    }
  });

  app.post('/seh360/ai/action-suggest', async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const { title, context } = (req.body as any) || {};
    if (!title) return reply.code(400).send({ error: 'title requerido' });

    const prompt = `Sos profesional de SyH. Para el hallazgo "${title}" sugerí un plan de acción en español.\n\n` +
      `Contexto adicional: ${JSON.stringify(context || {})}\n\n` +
      `Devolvé: 1) Contención inmediata, 2) Acción correctiva, 3) Acción preventiva, 4) Responsable típico, 5) Plazo sugerido. Breve y accionable.`;
    try {
      const res = await llmFor(req).chat([{ role: 'user', content: prompt }], 1000);
      return reply.send({ suggestion: res?.text || 'Sin respuesta del modelo' });
    } catch (e: any) {
      return reply.code(500).send({ error: 'No se pudo generar la sugerencia', details: e?.message });
    }
  });

  app.post('/seh360/ai/legal-digest', async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const { clientId } = (req.body as any) || {};
    const prisma = (app as any).prisma;
    const where: any = { tenantId: t, deletedAt: null };
    if (clientId) where.clientId = clientId;

    const [client, reqs] = await Promise.all([
      clientId ? prisma.sehClient.findFirst({ where: { id: clientId, tenantId: t }, select: { name: true, activity: true } }) : null,
      prisma.sehLegalRequirement.findMany({ where, take: 80 }),
    ]);
    if (!reqs.length) return reply.send({ digest: 'No hay requisitos legales cargados para analizar.' });

    const context = {
      empresa: client?.name, actividad: client?.activity,
      requisitos: reqs.map((r: any) => ({ norma: r.normative, estado: r.status, criticidad: r.criticality, proxRev: r.nextReview })),
    };
    const prompt = `Sos profesional de SyH. Resumí el estado legal de esta empresa en español.\n\n` +
      `Datos: ${JSON.stringify(context)}\n\n` +
      `Devolvé: 1) Diagnóstico general de cumplimiento, 2) Brechas críticas, 3) Prioridades de revisión, 4) Próximos pasos. ` +
      `No inventes normas; trabajá solo con las listadas.`;
    try {
      const res = await llmFor(req).chat([{ role: 'user', content: prompt }], 1200);
      return reply.send({ digest: res?.text || 'Sin respuesta del modelo' });
    } catch (e: any) {
      return reply.code(500).send({ error: 'No se pudo generar el resumen', details: e?.message });
    }
  });
};
