import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { createLLMProvider } from '../services/llm/factory.js';
import {
  computeGrrCrossed, computeGrrAnova, computeGrrNested, computeBias, computeLinearity, computeStability,
  computeAttributeAgreement, computeSpc, computeActionPriority,
  APQP_PHASES, PPAP_ELEMENTS,
} from '../domain/coreToolsCalc.js';

type IdParams = { Params: { id: string } };

async function requireTenant(req: FastifyRequest, app: FastifyInstance): Promise<string> {
  const t = await getEffectiveTenantId(req, app.prisma);
  if (!t) { const e: any = new Error('Se requiere tenant'); e.statusCode = 400; throw e; }
  return t;
}

async function nextCode(tx: any, model: string, prefix: string, tenantId: string) {
  const count = await tx[model].count({ where: { tenantId } });
  return `${prefix}-${String(count + 1).padStart(3, '0')}`;
}

async function llmInterpret(req: FastifyRequest, prompt: string): Promise<string> {
  const llm = createLLMProvider((req as any).tenant);
  const res = await llm.chat([{ role: 'user', content: prompt }], 1200);
  return res.text || '';
}

// Crea un Plan de Acción real (módulo action-plans) desde una herramienta Core Tools
async function createLinkedActionPlan(app: FastifyInstance, req: FastifyRequest, data: {
  tenantId: string; findingDescription?: string | null; plannedAction?: string | null;
  area?: string | null; process?: string | null; severity?: string | null; ncrId?: string | null;
}) {
  const seqResult: any = await app.prisma.$queryRaw`SELECT nextval('action_plan_seq')::int as seq`;
  const seqNum = Array.isArray(seqResult) ? seqResult[0]?.seq : null;
  return app.prisma.actionPlan.create({
    data: {
      tenantId: data.tenantId,
      sequenceNumber: seqNum ?? undefined,
      origin: 'OTHER',
      type: 'CORRECTIVE',
      status: 'OPEN',
      findingDescription: data.findingDescription ?? null,
      plannedAction: data.plannedAction ?? null,
      area: data.area ?? null,
      process: data.process ?? null,
      severity: data.severity ?? null,
      ncrId: data.ncrId ?? null,
      createdById: (req as any).auth?.userId ?? null,
      updatedById: (req as any).auth?.userId ?? null,
    },
  });
}

export async function coreToolsRoutes(app: FastifyInstance) {
  // ════════════════════════════════ MSA ════════════════════════════════
  app.get('/msa', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const items = await app.prisma.msaStudy.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, code: true, name: true, studyType: true, equipmentName: true, status: true, results: true, createdAt: true },
    });
    return reply.send({ items });
  });

  app.post('/msa', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const body = z.object({
      name: z.string().min(1),
      studyType: z.enum(['GRR_CROSS', 'GRR_NESTED', 'BIAS', 'LINEARITY', 'STABILITY', 'ATTRIBUTE']).default('GRR_CROSS'),
      equipmentId: z.string().uuid().optional().nullable(),
      equipmentName: z.string().optional().nullable(),
      characteristic: z.string().optional().nullable(),
      partsCount: z.number().int().min(1).default(10),
      operatorsCount: z.number().int().min(1).default(3),
      trialsCount: z.number().int().min(1).default(3),
      tolerance: z.number().optional().nullable(),
    }).parse(req.body);
    const code = await nextCode(app.prisma, 'msaStudy', 'MSA', tenantId);
    const item = await app.prisma.msaStudy.create({
      data: { ...body, tenantId, code, createdById: (req as any).auth?.userId ?? null },
    });
    return reply.code(201).send({ item });
  });

  app.get('/msa/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const item = await app.prisma.msaStudy.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
    if (!item) return reply.code(404).send({ error: 'No encontrado' });
    return reply.send({ item });
  });

  app.put('/msa/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const body = z.object({
      name: z.string().optional(), equipmentName: z.string().optional().nullable(),
      characteristic: z.string().optional().nullable(), tolerance: z.number().optional().nullable(),
      partsCount: z.number().int().optional(), operatorsCount: z.number().int().optional(), trialsCount: z.number().int().optional(),
      readings: z.any().optional(), referenceValues: z.any().optional(),
      status: z.string().optional(), conclusion: z.string().optional().nullable(),
    }).parse(req.body);
    const item = await app.prisma.msaStudy.update({ where: { id: req.params.id }, data: body });
    return reply.send({ item });
  });

  app.delete('/msa/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    await app.prisma.msaStudy.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    return reply.send({ ok: true });
  });

  // Recalcular resultados del estudio
  app.post('/msa/:id/calculate', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const study = await app.prisma.msaStudy.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
    if (!study) return reply.code(404).send({ error: 'No encontrado' });

    let results: any;
    switch (study.studyType) {
      case 'GRR_CROSS': {
        const ar = computeGrrCrossed((study.readings as any[]) || [], study.tolerance);
        if (ar.error) { results = ar; break; }
        const anova = computeGrrAnova((study.readings as any[]) || [], study.tolerance);
        results = { ...ar, anova: anova.error ? null : anova };
        break;
      }
      case 'GRR_NESTED':
        results = computeGrrNested((study.readings as any[]) || [], study.tolerance);
        break;
      case 'BIAS':
        results = computeBias((study.referenceValues as any[]) || [], study.tolerance);
        break;
      case 'LINEARITY':
        results = computeLinearity((study.referenceValues as any[]) || [], study.tolerance);
        break;
      case 'STABILITY':
        results = computeStability((study.referenceValues as any[]) || []);
        break;
      case 'ATTRIBUTE':
        results = computeAttributeAgreement((study.readings as any[]) || []);
        break;
      default:
        results = { error: 'Tipo de estudio no soportado' };
    }
    if (results.error) return reply.code(400).send(results);
    const item = await app.prisma.msaStudy.update({
      where: { id: study.id },
      data: { results, status: 'COMPLETED' },
    });
    return reply.send({ item });
  });

  // Interpretación IA del estudio MSA
  app.post('/msa/:id/ai-interpret', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const study = await app.prisma.msaStudy.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
    if (!study?.results) return reply.code(400).send({ error: 'El estudio no tiene resultados calculados' });
    const prompt = `Sos un experto en MSA (AIAG MSA-4) e IATF 16949. Interpretá los resultados de este estudio de sistema de medición en español formal (Argentina), en 1 párrafo ejecutivo + 3 recomendaciones concretas.

Estudio: ${study.name} (${study.studyType})
Equipo: ${study.equipmentName || 'N/D'} — Característica: ${study.characteristic || 'N/D'}
Resultados: ${JSON.stringify(study.results)}

Respondé solo el texto, sin encabezados markdown.`;
    try {
      const text = await llmInterpret(req, prompt);
      await app.prisma.msaStudy.update({ where: { id: study.id }, data: { aiInterpretation: text } });
      return reply.send({ interpretation: text });
    } catch (e: any) {
      return reply.code(502).send({ error: e?.message || 'Error de IA' });
    }
  });

  // ════════════════════════════════ SPC ════════════════════════════════
  app.get('/spc', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const items = await app.prisma.spcChart.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, code: true, name: true, chartType: true, characteristic: true, process: true, capability: true, alarms: true, status: true, createdAt: true },
    });
    return reply.send({ items });
  });

  app.post('/spc', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const body = z.object({
      name: z.string().min(1),
      process: z.string().optional().nullable(),
      characteristic: z.string().min(1),
      unit: z.string().optional().nullable(),
      chartType: z.enum(['XBAR_R', 'XBAR_S', 'I_MR', 'P', 'NP', 'C', 'U']).default('XBAR_R'),
      subgroupSize: z.number().int().min(1).max(25).default(5),
      usl: z.number().optional().nullable(),
      lsl: z.number().optional().nullable(),
      target: z.number().optional().nullable(),
    }).parse(req.body);
    const code = await nextCode(app.prisma, 'spcChart', 'SPC', tenantId);
    const item = await app.prisma.spcChart.create({ data: { ...body, tenantId, code } });
    return reply.code(201).send({ item });
  });

  app.get('/spc/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const item = await app.prisma.spcChart.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
    if (!item) return reply.code(404).send({ error: 'No encontrado' });
    return reply.send({ item });
  });

  app.put('/spc/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const body = z.object({
      name: z.string().optional(), process: z.string().optional().nullable(),
      characteristic: z.string().optional(), unit: z.string().optional().nullable(),
      usl: z.number().optional().nullable(), lsl: z.number().optional().nullable(), target: z.number().optional().nullable(),
      subgroups: z.any().optional(), status: z.string().optional(),
    }).parse(req.body);
    const item = await app.prisma.spcChart.update({ where: { id: req.params.id }, data: body });
    return reply.send({ item });
  });

  app.delete('/spc/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    await app.prisma.spcChart.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    return reply.send({ ok: true });
  });

  app.post('/spc/:id/calculate', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const chart = await app.prisma.spcChart.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
    if (!chart) return reply.code(404).send({ error: 'No encontrado' });
    const res = computeSpc(chart.chartType, chart.subgroups, { usl: chart.usl, lsl: chart.lsl, subgroupSize: chart.subgroupSize });
    if (res.error) return reply.code(400).send(res);
    const item = await app.prisma.spcChart.update({
      where: { id: chart.id },
      data: { limits: res.limits, capability: res.capability, alarms: res.alarms },
    });
    return reply.send({ item, points: res.points, spreadPoints: res.spreadPoints });
  });

  app.post('/spc/:id/ai-interpret', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const chart = await app.prisma.spcChart.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
    if (!chart?.limits) return reply.code(400).send({ error: 'La carta no tiene límites calculados' });
    const prompt = `Sos un experto en SPC (AIAG SPC-2) e IATF 16949. Interpretá esta carta de control en español formal (Argentina): 1 párrafo ejecutivo + 3 recomendaciones.

Carta: ${chart.name} (${chart.chartType}) — Característica: ${chart.characteristic}
Límites: ${JSON.stringify(chart.limits)}
Capabilidad: ${JSON.stringify(chart.capability)}
Alarmas Western Electric: ${JSON.stringify(chart.alarms)}

Respondé solo el texto, sin encabezados markdown.`;
    try {
      const text = await llmInterpret(req, prompt);
      await app.prisma.spcChart.update({ where: { id: chart.id }, data: { aiInterpretation: text } });
      return reply.send({ interpretation: text });
    } catch (e: any) {
      return reply.code(502).send({ error: e?.message || 'Error de IA' });
    }
  });

  // ════════════════════════════════ FMEA ════════════════════════════════
  app.get('/fmea', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const items = await app.prisma.fmeaStudy.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ items });
  });

  app.post('/fmea', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const body = z.object({
      name: z.string().min(1),
      type: z.enum(['DFMEA', 'PFMEA']).default('PFMEA'),
      process: z.string().optional().nullable(),
      product: z.string().optional().nullable(),
      team: z.string().optional().nullable(),
    }).parse(req.body);
    const code = await nextCode(app.prisma, 'fmeaStudy', 'FMEA', tenantId);
    const item = await app.prisma.fmeaStudy.create({ data: { ...body, tenantId, code, items: [] } });
    return reply.code(201).send({ item });
  });

  app.get('/fmea/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const item = await app.prisma.fmeaStudy.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
    if (!item) return reply.code(404).send({ error: 'No encontrado' });
    return reply.send({ item });
  });

  app.put('/fmea/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const body = z.object({
      name: z.string().optional(), process: z.string().optional().nullable(),
      product: z.string().optional().nullable(), team: z.string().optional().nullable(),
      status: z.string().optional(), items: z.any().optional(),
    }).parse(req.body);
    // Recalcular AP de cada item si vienen items (+ AP2 post-optimización)
    if (Array.isArray(body.items)) {
      body.items = body.items.map((it: any) => ({
        ...it,
        ap: it.s && it.o && it.d ? computeActionPriority(Number(it.s), Number(it.o), Number(it.d)) : null,
        ap2: it.s2 && it.o2 && it.d2 ? computeActionPriority(Number(it.s2), Number(it.o2), Number(it.d2)) : null,
      }));
    }
    const item = await app.prisma.fmeaStudy.update({ where: { id: req.params.id }, data: body });
    return reply.send({ item });
  });

  app.delete('/fmea/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    await app.prisma.fmeaStudy.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    return reply.send({ ok: true });
  });

  // IA: sugerir modos de falla para un paso de proceso
  app.post('/fmea/:id/ai-suggest', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const fmea = await app.prisma.fmeaStudy.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
    if (!fmea) return reply.code(404).send({ error: 'No encontrado' });
    const { step, function: fn } = (req.body as any) || {};
    const prompt = `Sos un experto en FMEA AIAG-VDA e IATF 16949. Para este ${fmea.type} sugerí 3 modos de falla con su efecto, causa y controles.

FMEA: ${fmea.name} — Proceso: ${fmea.process || 'N/D'} — Producto: ${fmea.product || 'N/D'}
Paso de proceso: ${step || 'N/D'}
Función: ${fn || 'N/D'}

Respondé SOLO un JSON array con 3 objetos: [{"failureMode":"...","effect":"...","cause":"...","s":N,"o":N,"d":N,"prevention":"...","detection":"..."}] con s/o/d del 1 al 10. Sin texto adicional.`;
    try {
      const text = await llmInterpret(req, prompt);
      const match = text.match(/\[[\s\S]*\]/);
      const suggestions = match ? JSON.parse(match[0]) : [];
      return reply.send({ suggestions });
    } catch (e: any) {
      return reply.code(502).send({ error: e?.message || 'Error de IA' });
    }
  });

  // ════════════════════════════ PLAN DE CONTROL ════════════════════════════
  app.get('/control-plans', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const items = await app.prisma.controlPlan.findMany({ where: { tenantId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
    return reply.send({ items });
  });

  app.post('/control-plans', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const body = z.object({
      name: z.string().min(1),
      phase: z.enum(['PROTOTYPE', 'PRELAUNCH', 'PRODUCTION']).default('PRODUCTION'),
      partNumber: z.string().optional().nullable(),
      process: z.string().optional().nullable(),
      fmeaId: z.string().uuid().optional().nullable(),
    }).parse(req.body);
    const code = await nextCode(app.prisma, 'controlPlan', 'CP', tenantId);

    // Si hay FMEA vinculado, pre-cargar items desde sus características
    let items: any[] = [];
    if (body.fmeaId) {
      const fmea = await app.prisma.fmeaStudy.findFirst({ where: { id: body.fmeaId, tenantId } });
      if (fmea?.items && Array.isArray(fmea.items)) {
        items = (fmea.items as any[]).map((it: any, i: number) => ({
          id: `cp-${i + 1}`,
          step: it.step || '',
          characteristic: it.failureMode || it.function || '',
          spec: '', method: it.detection || '', sampleSize: '', frequency: '',
          controlMethod: it.prevention || '', reactionPlan: '', special: it.s >= 9,
        }));
      }
    }
    const item = await app.prisma.controlPlan.create({ data: { ...body, tenantId, code, items } });
    return reply.code(201).send({ item });
  });

  app.get('/control-plans/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const item = await app.prisma.controlPlan.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
    if (!item) return reply.code(404).send({ error: 'No encontrado' });
    return reply.send({ item });
  });

  app.put('/control-plans/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const body = z.object({
      name: z.string().optional(), phase: z.string().optional(), partNumber: z.string().optional().nullable(),
      process: z.string().optional().nullable(), status: z.string().optional(), items: z.any().optional(),
    }).parse(req.body);
    const item = await app.prisma.controlPlan.update({ where: { id: req.params.id }, data: body });
    return reply.send({ item });
  });

  app.delete('/control-plans/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    await app.prisma.controlPlan.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    return reply.send({ ok: true });
  });

  // IA: revisar cobertura del plan de control (métodos, planes de reacción, características especiales)
  app.post('/control-plans/:id/ai-review', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const plan = await app.prisma.controlPlan.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
    if (!plan) return reply.code(404).send({ error: 'No encontrado' });
    const items = (plan.items as any[]) || [];
    const summary = items.map((it, i) =>
      `${i + 1}. Paso: ${it.step || 'N/D'} | Característica: ${it.characteristic || 'N/D'} | Spec: ${it.spec || 'N/D'} | Método control: ${it.controlMethod || 'FALTA'} | Plan de reacción: ${it.reactionPlan || 'FALTA'} | Especial: ${it.special ? 'SÍ' : 'no'}`
    ).join('\n');
    const prompt = `Sos un experto IATF 16949 en Planes de Control (AIAG PPAP/CP). Revisá el siguiente plan de control "${plan.name}" (fase ${plan.phase}, proceso ${plan.process || 'N/D'}) y:
(a) señalá qué filas tienen método de control o plan de reacción faltante o débil,
(b) para las características especiales, verificá si el método de control es robusto (SPC, poka-yoke) o insuficiente (solo inspección visual),
(c) sugerí mejoras concretas de frecuencia/método de muestreo.

Items:
${summary}

Respondé en español formal, sin encabezados markdown, en párrafos cortos.`;
    try {
      const text = await llmInterpret(req, prompt);
      await app.prisma.controlPlan.update({ where: { id: plan.id }, data: { aiNotes: text } });
      return reply.send({ notes: text });
    } catch (e: any) {
      return reply.code(502).send({ error: e?.message || 'Error de IA' });
    }
  });

  // ════════════════════════════════ APQP ════════════════════════════════
  app.get('/apqp', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const items = await app.prisma.apqpProject.findMany({ where: { tenantId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
    return reply.send({ items });
  });

  app.post('/apqp', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const body = z.object({
      name: z.string().min(1),
      customer: z.string().optional().nullable(),
      partNumber: z.string().optional().nullable(),
      startDate: z.string().optional().nullable(),
      dueDate: z.string().optional().nullable(),
    }).parse(req.body);
    const code = await nextCode(app.prisma, 'apqpProject', 'APQP', tenantId);
    const phases = APQP_PHASES.map((p) => ({
      ...p,
      deliverables: p.deliverables.map((d) => ({ name: d, status: 'PENDING', dueDate: null, responsible: null })),
    }));
    const item = await app.prisma.apqpProject.create({
      data: {
        ...body, tenantId, code, phases,
        startDate: body.startDate ? new Date(body.startDate) : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
    });
    return reply.code(201).send({ item });
  });

  app.get('/apqp/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const item = await app.prisma.apqpProject.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
    if (!item) return reply.code(404).send({ error: 'No encontrado' });
    return reply.send({ item });
  });

  app.put('/apqp/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const body = z.object({
      name: z.string().optional(), customer: z.string().optional().nullable(), partNumber: z.string().optional().nullable(),
      currentPhase: z.number().int().min(1).max(5).optional(), status: z.string().optional(), phases: z.any().optional(),
    }).parse(req.body);
    const item = await app.prisma.apqpProject.update({ where: { id: req.params.id }, data: body });
    return reply.send({ item });
  });

  app.delete('/apqp/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    await app.prisma.apqpProject.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    return reply.send({ ok: true });
  });

  // IA: revisar avance del proyecto y riesgos de cronograma
  app.post('/apqp/:id/ai-review', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const project = await app.prisma.apqpProject.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
    if (!project) return reply.code(404).send({ error: 'No encontrado' });
    const phases = (project.phases as any[]) || [];
    const now = new Date();
    const summary = phases.map((p) => {
      const delivs = (p.deliverables || []).map((d: any) => {
        const overdue = d.dueDate && d.status !== 'DONE' && new Date(d.dueDate) < now;
        return `${d.name} [${d.status}]${d.dueDate ? ` vence ${d.dueDate}` : ''}${overdue ? ' ¡VENCIDO!' : ''}`;
      }).join('; ');
      return `Fase ${p.phase} - ${p.name}: ${delivs}`;
    }).join('\n');
    const prompt = `Sos un experto AIAG-APQP / IATF 16949. Analizá el proyecto "${project.name}" (cliente ${project.customer || 'N/D'}, pieza ${project.partNumber || 'N/D'}, fase actual ${project.currentPhase}/5) y:
(a) identificá entregables vencidos o en riesgo de retraso,
(b) evaluá si el proyecto puede avanzar de fase con seguridad,
(c) sugerí acciones concretas para destrabar los entregables pendientes.

Entregables por fase:
${summary}

Respondé en español formal, sin encabezados markdown, en párrafos cortos.`;
    try {
      const text = await llmInterpret(req, prompt);
      await app.prisma.apqpProject.update({ where: { id: project.id }, data: { aiNotes: text } });
      return reply.send({ notes: text });
    } catch (e: any) {
      return reply.code(502).send({ error: e?.message || 'Error de IA' });
    }
  });

  // ════════════════════════════════ PPAP ════════════════════════════════
  app.get('/ppap', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const items = await app.prisma.ppapSubmission.findMany({ where: { tenantId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
    return reply.send({ items });
  });

  app.post('/ppap', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const body = z.object({
      partNumber: z.string().min(1),
      partName: z.string().optional().nullable(),
      customer: z.string().optional().nullable(),
      level: z.number().int().min(1).max(5).default(3),
      apqpId: z.string().uuid().optional().nullable(),
    }).parse(req.body);
    const code = await nextCode(app.prisma, 'ppapSubmission', 'PPAP', tenantId);
    const elements = PPAP_ELEMENTS.map((name, i) => ({ n: i + 1, name, status: 'PENDING', notes: null }));
    const item = await app.prisma.ppapSubmission.create({ data: { ...body, tenantId, code, elements } });
    return reply.code(201).send({ item });
  });

  app.get('/ppap/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const item = await app.prisma.ppapSubmission.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
    if (!item) return reply.code(404).send({ error: 'No encontrado' });
    return reply.send({ item });
  });

  app.put('/ppap/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const body = z.object({
      partNumber: z.string().optional(), partName: z.string().optional().nullable(),
      customer: z.string().optional().nullable(), level: z.number().int().optional(),
      status: z.string().optional(), elements: z.any().optional(),
    }).parse(req.body);
    const data: any = { ...body };
    if (body.status === 'SUBMITTED') data.submittedAt = new Date();
    if (body.status === 'APPROVED') data.approvedAt = new Date();
    const item = await app.prisma.ppapSubmission.update({ where: { id: req.params.id }, data });
    return reply.send({ item });
  });

  app.delete('/ppap/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    await app.prisma.ppapSubmission.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    return reply.send({ ok: true });
  });

  // IA: revisar completitud del expediente PPAP y preparación para el PSW
  app.post('/ppap/:id/ai-review', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const sub = await app.prisma.ppapSubmission.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
    if (!sub) return reply.code(404).send({ error: 'No encontrado' });
    const elements = (sub.elements as any[]) || [];
    const pending = elements.filter((e) => e.status === 'PENDING').map((e) => e.name);
    const ready = elements.filter((e) => e.status === 'READY' || e.status === 'APPROVED').length;
    const summary = elements.map((e) => `${e.n}. ${e.name} [${e.status}]${e.note ? ` — ${e.note}` : ''}`).join('\n');
    const prompt = `Sos un experto AIAG-PPAP / IATF 16949. Revisá el expediente PPAP de la pieza "${sub.partNumber}" (${sub.partName || 'N/D'}, cliente ${sub.customer || 'N/D'}, nivel ${sub.level}) y:
(a) indicá qué elementos críticos siguen pendientes (${pending.join(', ') || 'ninguno'}),
(b) evaluá si el expediente está en condiciones de firmar el PSW (Part Submission Warrant),
(c) sugerí el orden de prioridad para cerrar los elementos faltantes.

Estado de elementos (${ready}/${elements.length} listos o aprobados):
${summary}

Respondé en español formal, sin encabezados markdown, en párrafos cortos.`;
    try {
      const text = await llmInterpret(req, prompt);
      await app.prisma.ppapSubmission.update({ where: { id: sub.id }, data: { aiNotes: text } });
      return reply.send({ notes: text });
    } catch (e: any) {
      return reply.code(502).send({ error: e?.message || 'Error de IA' });
    }
  });

  // Adjunta datos reales de NCR y Plan de Acción vinculados a un/varios 8D
  async function attachLinks(app: FastifyInstance, tenantId: string, reports: any[]) {
    const ncrIds = [...new Set(reports.map((r) => r.ncrId).filter(Boolean))];
    const apIds = [...new Set(reports.map((r) => r.actionPlanId).filter(Boolean))];
    const [ncrs, aps] = await Promise.all([
      ncrIds.length ? app.prisma.nonConformity.findMany({ where: { id: { in: ncrIds }, tenantId }, select: { id: true, code: true, title: true, severity: true, status: true } }) : [],
      apIds.length ? app.prisma.actionPlan.findMany({ where: { id: { in: apIds }, tenantId }, select: { id: true, code: true, status: true, effectiveness: true } }) : [],
    ]);
    const ncrMap = new Map(ncrs.map((n: any) => [n.id, n]));
    const apMap = new Map(aps.map((a: any) => [a.id, a]));
    return reports.map((r) => ({ ...r, ncr: r.ncrId ? ncrMap.get(r.ncrId) || null : null, actionPlan: r.actionPlanId ? apMap.get(r.actionPlanId) || null : null }));
  }

  // ════════════════════════════════ 8D ════════════════════════════════
  app.get('/eight-d', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const items = await app.prisma.eightDReport.findMany({ where: { tenantId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
    return reply.send({ items: await attachLinks(app, tenantId, items) });
  });

  app.post('/eight-d', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const body = z.object({
      title: z.string().min(1),
      ncrId: z.string().uuid().optional().nullable(),
    }).parse(req.body);
    const code = await nextCode(app.prisma, 'eightDReport', '8D', tenantId);
    const disciplines = {
      d1: { team: '' }, d2: { description: '' }, d3: { containment: '' },
      d4: { rootCause: '', why5: ['', '', '', '', ''] }, d5: { actions: '' },
      d6: { validation: '' }, d7: { systemic: '' }, d8: { recognition: '' },
    };
    const item = await app.prisma.eightDReport.create({ data: { ...body, tenantId, code, disciplines } });
    return reply.code(201).send({ item });
  });

  app.get('/eight-d/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const item = await app.prisma.eightDReport.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
    if (!item) return reply.code(404).send({ error: 'No encontrado' });
    const [enriched] = await attachLinks(app, tenantId, [item]);
    return reply.send({ item: enriched });
  });

  app.put('/eight-d/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const body = z.object({
      title: z.string().optional(), status: z.string().optional(), disciplines: z.any().optional(),
      ncrId: z.string().uuid().optional().nullable(),
    }).parse(req.body);
    const data: any = { ...body };
    if (body.status === 'CLOSED') data.closedAt = new Date();
    const item = await app.prisma.eightDReport.update({ where: { id: req.params.id }, data });
    return reply.send({ item });
  });

  // Crea (o retorna) un Plan de Acción real vinculado a este 8D
  app.post('/eight-d/:id/create-action-plan', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const report = await app.prisma.eightDReport.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
    if (!report) return reply.code(404).send({ error: 'No encontrado' });
    if (report.actionPlanId) {
      const existing = await app.prisma.actionPlan.findFirst({ where: { id: report.actionPlanId, tenantId } });
      if (existing) return reply.send({ actionPlan: existing, alreadyExisted: true });
    }
    const d = (report.disciplines as any) || {};
    const plan = await createLinkedActionPlan(app, req, {
      tenantId,
      findingDescription: `[8D ${report.code}] ${report.title}${d.d2?.description ? ` — ${d.d2.description}` : ''}`,
      plannedAction: d.d5?.actions || d.d3?.containment || null,
      ncrId: report.ncrId || null,
    });
    await app.prisma.eightDReport.update({ where: { id: report.id }, data: { actionPlanId: plan.id } });
    return reply.code(201).send({ actionPlan: plan });
  });

  app.delete('/eight-d/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    await app.prisma.eightDReport.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    return reply.send({ ok: true });
  });

  // IA: sugerir análisis de causa raíz (5 por qués) desde la descripción D2
  app.post('/eight-d/:id/ai-analyze', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const report = await app.prisma.eightDReport.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
    if (!report) return reply.code(404).send({ error: 'No encontrado' });
    const d = (report.disciplines as any) || {};
    const prompt = `Sos un experto en metodología 8D e IATF 16949. Analizá este reporte y sugerí: (a) una cadena de 5 porqués para llegar a la causa raíz, (b) acciones correctivas permanentes, (c) acciones sistémicas de prevención.

Problema: ${report.title}
Descripción (D2): ${d.d2?.description || 'N/D'}
Contención (D3): ${d.d3?.containment || 'N/D'}

Respondé en español formal, estructurado con las 3 secciones, sin encabezados markdown.`;
    try {
      const text = await llmInterpret(req, prompt);
      await app.prisma.eightDReport.update({ where: { id: report.id }, data: { aiAnalysis: text } });
      return reply.send({ analysis: text });
    } catch (e: any) {
      return reply.code(502).send({ error: e?.message || 'Error de IA' });
    }
  });

  // ════════════════════════════════ LPA ════════════════════════════════
  app.get('/lpa/plans', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const items = await app.prisma.lpaPlan.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { executions: { orderBy: { executedAt: 'desc' }, take: 5 } },
    });
    return reply.send({ items });
  });

  app.post('/lpa/plans', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const body = z.object({
      name: z.string().min(1),
      area: z.string().optional().nullable(),
      layer: z.enum(['OPERATOR', 'SUPERVISOR', 'MANAGER', 'EXEC']).optional().nullable(),
      frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).default('WEEKLY'),
      checklist: z.array(z.object({ question: z.string(), category: z.string().optional() })).default([]),
    }).parse(req.body);
    const item = await app.prisma.lpaPlan.create({ data: { ...body, tenantId } });
    return reply.code(201).send({ item });
  });

  app.put('/lpa/plans/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const body = z.object({
      name: z.string().optional(), area: z.string().optional().nullable(),
      layer: z.string().optional().nullable(),
      frequency: z.string().optional(), checklist: z.any().optional(), active: z.boolean().optional(),
    }).parse(req.body);
    const item = await app.prisma.lpaPlan.update({ where: { id: req.params.id }, data: body });
    return reply.send({ item });
  });

  app.delete('/lpa/plans/:id', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    await app.prisma.lpaPlan.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    return reply.send({ ok: true });
  });

  app.post('/lpa/plans/:id/execute', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const plan = await app.prisma.lpaPlan.findFirst({ where: { id: req.params.id, tenantId, deletedAt: null } });
    if (!plan) return reply.code(404).send({ error: 'Plan no encontrado' });
    const body = z.object({
      auditorName: z.string().optional().nullable(),
      responses: z.array(z.object({
        question: z.string(),
        result: z.enum(['OK', 'NOK', 'NA']),
        comment: z.string().optional().nullable(),
      })),
    }).parse(req.body);
    const answered = body.responses.filter((r) => r.result !== 'NA');
    const ok = answered.filter((r) => r.result === 'OK').length;
    const score = answered.length > 0 ? Math.round((ok / answered.length) * 100) : null;
    const findings = body.responses.filter((r) => r.result === 'NOK');
    const item = await app.prisma.lpaExecution.create({
      data: { tenantId, planId: plan.id, auditorName: body.auditorName, responses: body.responses, score, findings },
    });
    return reply.code(201).send({ item });
  });

  app.get('/lpa/executions', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const items = await app.prisma.lpaExecution.findMany({
      where: { tenantId },
      orderBy: { executedAt: 'desc' },
      take: 50,
      include: { plan: { select: { name: true, area: true } } },
    });
    return reply.send({ items });
  });

  // IA: analizar tendencia de scores y hallazgos recurrentes del plan
  app.post('/lpa/plans/:id/ai-review', async (req: FastifyRequest<IdParams>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const plan = await app.prisma.lpaPlan.findFirst({
      where: { id: req.params.id, tenantId, deletedAt: null },
      include: { executions: { orderBy: { executedAt: 'desc' }, take: 15 } },
    });
    if (!plan) return reply.code(404).send({ error: 'No encontrado' });
    const execs = plan.executions || [];
    const scores = execs.map((e) => e.score).filter((s) => s != null);
    const allFindings = execs.flatMap((e: any) => (e.findings || []).map((f: any) => f.question));
    const freq: Record<string, number> = {};
    for (const q of allFindings) freq[q] = (freq[q] || 0) + 1;
    const recurring = Object.entries(freq).filter(([, c]) => c > 1).map(([q, c]) => `"${q}" (${c} veces)`).join(', ');
    const prompt = `Sos un experto en LPA (Layered Process Audits) e IATF 16949. Analizá el plan "${plan.name}" (área ${plan.area || 'N/D'}, capa ${plan.layer || 'N/D'}, frecuencia ${plan.frequency}) con ${execs.length} ejecuciones recientes y scores: ${scores.join(', ') || 'sin datos'}.

Hallazgos recurrentes (NOK repetidos): ${recurring || 'ninguno detectado'}.

Analizá: (a) la tendencia del score (mejora/empeora/estable), (b) si hay hallazgos sistémicos que requieran una acción correctiva de raíz en vez de corrección puntual, (c) sugerí 2-3 acciones concretas de mejora del proceso auditado.

Respondé en español formal, sin encabezados markdown, en párrafos cortos.`;
    try {
      const text = await llmInterpret(req, prompt);
      await app.prisma.lpaPlan.update({ where: { id: plan.id }, data: { aiNotes: text } });
      return reply.send({ notes: text });
    } catch (e: any) {
      return reply.code(502).send({ error: e?.message || 'Error de IA' });
    }
  });

  // Crea un Plan de Acción real a partir de un hallazgo NOK de una ejecución LPA
  app.post('/lpa/executions/:id/findings/:index/create-action-plan', async (req: FastifyRequest<{ Params: { id: string; index: string } }>, reply: FastifyReply) => {
    const tenantId = await requireTenant(req, app);
    const exec = await app.prisma.lpaExecution.findFirst({
      where: { id: req.params.id, tenantId },
      include: { plan: { select: { name: true, area: true } } },
    });
    if (!exec) return reply.code(404).send({ error: 'Ejecución no encontrada' });
    const idx = Number(req.params.index);
    const findings = (exec.findings as any[]) || [];
    const finding = findings[idx];
    if (!finding) return reply.code(404).send({ error: 'Hallazgo no encontrado' });
    if (finding.actionPlanId) {
      const existing = await app.prisma.actionPlan.findFirst({ where: { id: finding.actionPlanId, tenantId } });
      if (existing) return reply.send({ actionPlan: existing, alreadyExisted: true });
    }
    const plan = await createLinkedActionPlan(app, req, {
      tenantId,
      findingDescription: `[LPA ${exec.plan?.name || ''}] ${finding.question}${finding.comment ? ` — ${finding.comment}` : ''}`,
      area: exec.plan?.area || null,
    });
    findings[idx] = { ...finding, actionPlanId: plan.id };
    await app.prisma.lpaExecution.update({ where: { id: exec.id }, data: { findings } });
    return reply.code(201).send({ actionPlan: plan });
  });
}
