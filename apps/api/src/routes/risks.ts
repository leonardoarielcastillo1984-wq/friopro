import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import XLSX from 'xlsx';

const FEATURE_KEY = 'riesgos';

const CATEGORIES = ['Operacional', 'Legal', 'Ambiental', 'Seguridad Vial', 'Calidad', 'Financiero', 'Tecnológico', 'Otro'];

const createSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(5),
  category: z.string().min(2),
  process: z.string().optional(),
  standard: z.string().optional(),
  identificationDate: z.string().datetime().optional(),
  reviewDate: z.string().datetime().optional(),
  probability: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  inherentProbability: z.number().int().min(1).max(5).optional(),
  inherentImpact: z.number().int().min(1).max(5).optional(),
  treatmentPlan: z.string().optional(),
  controls: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  // Campos ISO específicos
  requirement: z.string().optional(),
  aspectType: z.enum(['AMBIENTAL', 'CALIDAD', 'SEGURIDAD', 'LEGAL', 'IATF', 'TECNOLOGICO', 'FINANCIERO', 'REPUTACIONAL']).optional(),
  hazard: z.string().optional(),
  environmentalAspect: z.string().optional(),
  legalRequirement: z.boolean().optional(),
  legalReference: z.string().optional(),
  riskSource: z.string().optional(),
  strategy: z.enum(['EVITAR', 'MITIGAR', 'TRANSFERIR', 'ACEPTAR']).optional(),
  responsible: z.string().optional(),
  effectiveness: z.number().int().min(0).max(100).optional(),
});

const updateSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().min(5).optional(),
  category: z.string().optional(),
  process: z.string().optional(),
  standard: z.string().optional(),
  identificationDate: z.string().datetime().optional(),
  reviewDate: z.string().datetime().optional(),
  closureDate: z.string().datetime().optional(),
  probability: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  residualProb: z.number().int().min(1).max(5).optional(),
  residualImpact: z.number().int().min(1).max(5).optional(),
  treatmentPlan: z.string().optional(),
  controls: z.string().optional(),
  status: z.enum(['IDENTIFIED', 'ASSESSED', 'MITIGATING', 'MONITORED', 'CLOSED']).optional(),
  ownerId: z.string().uuid().nullable().optional(),
  // Campos ISO específicos
  requirement: z.string().optional(),
  aspectType: z.enum(['AMBIENTAL', 'CALIDAD', 'SEGURIDAD', 'LEGAL', 'IATF', 'TECNOLOGICO', 'FINANCIERO', 'REPUTACIONAL']).optional(),
  hazard: z.string().optional(),
  environmentalAspect: z.string().optional(),
  legalRequirement: z.boolean().optional(),
  legalReference: z.string().optional(),
  riskSource: z.string().optional(),
  strategy: z.enum(['EVITAR', 'MITIGAR', 'TRANSFERIR', 'ACEPTAR']).optional(),
  responsible: z.string().optional(),
  effectiveness: z.number().int().min(0).max(100).optional(),
});

async function generateRiskCode(tx: any, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await tx.risk.count({
    where: { tenantId, code: { startsWith: `RSK-${year}-` } },
  });
  return `RSK-${year}-${String(count + 1).padStart(3, '0')}`;
}

export const riskRoutes: FastifyPluginAsync = async (app) => {
  // GET /risks — Listar riesgos
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;

    const query = z
      .object({
        status: z.string().optional(),
        category: z.string().optional(),
        process: z.string().optional(),
        q: z.string().optional(),
        aspectType: z.string().optional(),
        strategy: z.string().optional(),
        legalRequirement: z.enum(['true', 'false']).optional(),
        riskSource: z.string().optional(),
        minLevel: z.coerce.number().int().optional(),
        maxLevel: z.coerce.number().int().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      })
      .parse(req.query);

    const where: any = { tenantId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.process) where.process = query.process;
    if (query.aspectType) where.aspectType = query.aspectType;
    if (query.strategy) where.strategy = query.strategy;
    if (query.legalRequirement) where.legalRequirement = query.legalRequirement === 'true';
    if (query.riskSource) where.riskSource = query.riskSource;
    if (query.q) {
      where.OR = [
        { code: { contains: query.q, mode: 'insensitive' } },
        { title: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.minLevel !== undefined || query.maxLevel !== undefined) {
      where.riskLevel = {
        ...(query.minLevel !== undefined ? { gte: query.minLevel } : {}),
        ...(query.maxLevel !== undefined ? { lte: query.maxLevel } : {}),
      };
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    const risks = await app.runWithDbContext(req, async (tx: any) => {
      return tx.risk.findMany({
        where,
        orderBy: { riskLevel: 'desc' },
        include: {
          owner: { select: { id: true, email: true } },
        },
      });
    });

    return reply.send({ risks });
  });

  // GET /risks/stats — Estadísticas
  app.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;

    const query = z
      .object({
        status: z.string().optional(),
        category: z.string().optional(),
        process: z.string().optional(),
        aspectType: z.string().optional(),
        strategy: z.string().optional(),
        legalRequirement: z.enum(['true', 'false']).optional(),
        riskSource: z.string().optional(),
        minLevel: z.coerce.number().int().optional(),
        maxLevel: z.coerce.number().int().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      })
      .parse(req.query);

    const where: any = { tenantId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.process) where.process = query.process;
    if (query.aspectType) where.aspectType = query.aspectType;
    if (query.strategy) where.strategy = query.strategy;
    if (query.legalRequirement) where.legalRequirement = query.legalRequirement === 'true';
    if (query.riskSource) where.riskSource = query.riskSource;
    if (query.minLevel !== undefined || query.maxLevel !== undefined) {
      where.riskLevel = {
        ...(query.minLevel !== undefined ? { gte: query.minLevel } : {}),
        ...(query.maxLevel !== undefined ? { lte: query.maxLevel } : {}),
      };
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    const risks = await app.runWithDbContext(req, async (tx: any) => {
      return tx.risk.findMany({
        where,
        select: {
          riskLevel: true,
          status: true,
          category: true,
          probability: true,
          impact: true,
          createdAt: true,
          closureDate: true,
        },
      });
    });

    // Tendencias últimos 6 meses (identificados vs cerrados vs críticos)
    const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const trendsMap = new Map<string, { month: string; identified: number; closed: number; critical: number }>();
    for (let i = 0; i < 6; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      trendsMap.set(key, {
        month: monthLabels[d.getMonth()],
        identified: 0,
        closed: 0,
        critical: 0,
      });
    }

    for (const r of risks as any[]) {
      const createdAt = r.createdAt ? new Date(r.createdAt) : null;
      if (createdAt && createdAt >= start) {
        const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
        const row = trendsMap.get(key);
        if (row) {
          row.identified += 1;
          if (r.riskLevel >= 20) row.critical += 1;
        }
      }

      const closureDate = r.closureDate ? new Date(r.closureDate) : null;
      if (closureDate && closureDate >= start) {
        const key = `${closureDate.getFullYear()}-${String(closureDate.getMonth() + 1).padStart(2, '0')}`;
        const row = trendsMap.get(key);
        if (row) row.closed += 1;
      }
    }

    const stats = {
      total: risks.length,
      critical: risks.filter((r: any) => r.riskLevel >= 20).length,
      high: risks.filter((r: any) => r.riskLevel >= 12 && r.riskLevel < 20).length,
      medium: risks.filter((r: any) => r.riskLevel >= 5 && r.riskLevel < 12).length,
      low: risks.filter((r: any) => r.riskLevel < 5).length,
      byCategory: CATEGORIES.map(c => ({
        category: c,
        count: risks.filter((r: any) => r.category === c).length,
      })).filter(c => c.count > 0),
      // Datos para la matriz 5x5
      matrix: risks.map((r: any) => ({
        probability: r.probability,
        impact: r.impact,
        level: r.riskLevel,
      })),
      trends: Array.from(trendsMap.values()),
    };

    return reply.send({ stats });
  });

  // GET /risks/categories — Categorías disponibles
  app.get('/categories', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ categories: CATEGORIES });
  });

  // GET /risks/:id — Detalle
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const risk = await app.runWithDbContext(req, async (tx: any) => {
      return tx.risk.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          owner: { select: { id: true, email: true } },
          createdBy: { select: { id: true, email: true } },
        },
      });
    });

    if (!risk) return reply.code(404).send({ error: 'Risk not found' });
    return reply.send({ risk });
  });

  // POST /risks — Crear
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;

    const body = createSchema.parse(req.body);
    const riskLevel = body.probability * body.impact;

    const risk = await app.runWithDbContext(req, async (tx: any) => {
      const code = await generateRiskCode(tx, tenantId);
      return tx.risk.create({
        data: {
          tenantId,
          code,
          title: body.title,
          description: body.description,
          category: body.category,
          process: body.process,
          standard: body.standard,
          identificationDate: body.identificationDate ? new Date(body.identificationDate) : new Date(),
          reviewDate: body.reviewDate ? new Date(body.reviewDate) : null,
          probability: body.probability,
          impact: body.impact,
          riskLevel,
          inherentProbability: body.inherentProbability,
          inherentImpact: body.inherentImpact,
          treatmentPlan: body.treatmentPlan,
          controls: body.controls,
          ownerId: body.ownerId,
          createdById: req.auth?.userId ?? null,
          updatedById: req.auth?.userId ?? null,
        },
      });
    });

    return reply.code(201).send({ risk });
  });

  // POST /risks/import — Importar riesgos desde Excel (primera hoja)
  app.post('/import', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;

    const data = await (req as any).file();
    if (!data) return reply.code(400).send({ error: 'No file uploaded' });

    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];
    if (!allowedMimes.includes(data.mimetype)) {
      return reply.code(400).send({ error: 'Solo se aceptan archivos Excel (.xlsx, .xls)' });
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk);
    const fileBuffer = Buffer.concat(chunks);

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames?.[0];
    if (!firstSheetName) return reply.code(400).send({ error: 'El archivo Excel no contiene hojas' });

    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
    if (!Array.isArray(rows) || rows.length === 0) {
      return reply.code(400).send({ error: 'La primera hoja no contiene filas' });
    }

    const normalizeHeader = (h: string) =>
      String(h || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    const getVal = (row: Record<string, any>, keys: string[]) => {
      for (const k of keys) {
        for (const originalKey of Object.keys(row)) {
          if (normalizeHeader(originalKey) === k) return row[originalKey];
        }
      }
      return undefined;
    };

    const toInt = (v: any, fallback?: number) => {
      const n = Number(String(v ?? '').toString().trim());
      return Number.isFinite(n) ? Math.trunc(n) : fallback;
    };

    const toBool = (v: any) => {
      if (typeof v === 'boolean') return v;
      const s = String(v ?? '').trim().toLowerCase();
      if (['si', 'sí', 'true', '1', 'yes', 'y'].includes(s)) return true;
      if (['no', 'false', '0', 'n'].includes(s)) return false;
      return undefined;
    };

    const rowSchema = z.object({
      title: z.string().min(2),
      description: z.string().min(5),
      category: z.string().min(2).default('Operacional'),
      process: z.string().optional(),
      standard: z.string().optional(),
      probability: z.number().int().min(1).max(5),
      impact: z.number().int().min(1).max(5),
      inherentProbability: z.number().int().min(1).max(5).optional(),
      inherentImpact: z.number().int().min(1).max(5).optional(),
      treatmentPlan: z.string().optional(),
      controls: z.string().optional(),
      // ISO
      requirement: z.string().optional(),
      aspectType: z.enum(['AMBIENTAL', 'CALIDAD', 'SEGURIDAD', 'LEGAL', 'IATF', 'TECNOLOGICO', 'FINANCIERO', 'REPUTACIONAL']).optional(),
      hazard: z.string().optional(),
      environmentalAspect: z.string().optional(),
      legalRequirement: z.boolean().optional(),
      legalReference: z.string().optional(),
      riskSource: z.string().optional(),
      strategy: z.enum(['EVITAR', 'MITIGAR', 'TRANSFERIR', 'ACEPTAR']).optional(),
      responsible: z.string().optional(),
      effectiveness: z.number().int().min(0).max(100).optional(),
    });

    const results = await app.runWithDbContext(req, async (tx: any) => {
      let created = 0;
      const errors: { row: number; message: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i] ?? {};

        try {
          const rawTitle = getVal(r, ['titulo', 'title']) ?? '';
          const rawDescription = getVal(r, ['descripcion', 'description']) ?? '';
          const rawCategory = getVal(r, ['categoria', 'category']) ?? 'Operacional';

          const rawProbability = getVal(r, ['probabilidad_1_5', 'probabilidad', 'probability_1_5', 'probability']) ?? 3;
          const rawImpact = getVal(r, ['impacto_1_5', 'impacto', 'impact_1_5', 'impact']) ?? 3;

          const parsed = rowSchema.parse({
            title: String(rawTitle).trim(),
            description: String(rawDescription).trim(),
            category: String(rawCategory).trim() || 'Operacional',
            process: String(getVal(r, ['proceso', 'process']) ?? '').trim() || undefined,
            standard: String(getVal(r, ['norma', 'standard']) ?? '').trim() || undefined,
            probability: toInt(rawProbability, 3) ?? 3,
            impact: toInt(rawImpact, 3) ?? 3,
            inherentProbability: toInt(getVal(r, ['probabilidad_inherente', 'inherent_probability']), undefined),
            inherentImpact: toInt(getVal(r, ['impacto_inherente', 'inherent_impact']), undefined),
            treatmentPlan: String(getVal(r, ['plan_de_tratamiento', 'plan_de_tratamiento_mitigacion', 'treatment_plan']) ?? '').trim() || undefined,
            controls: String(getVal(r, ['controles', 'controls']) ?? '').trim() || undefined,
            // ISO
            requirement: String(getVal(r, ['requisito_normativo', 'requirement']) ?? '').trim() || undefined,
            aspectType: (String(getVal(r, ['tipo_de_aspecto', 'aspect_type']) ?? '').trim() || undefined) as any,
            hazard: String(getVal(r, ['peligro', 'hazard']) ?? '').trim() || undefined,
            environmentalAspect: String(getVal(r, ['aspecto_ambiental', 'environmental_aspect']) ?? '').trim() || undefined,
            legalRequirement: toBool(getVal(r, ['requisito_legal', 'legal_requirement'])),
            legalReference: String(getVal(r, ['referencia_legal', 'legal_reference']) ?? '').trim() || undefined,
            riskSource: String(getVal(r, ['origen_del_riesgo', 'risk_source']) ?? '').trim() || undefined,
            strategy: (String(getVal(r, ['estrategia', 'strategy']) ?? '').trim() || undefined) as any,
            responsible: String(getVal(r, ['responsable_iso', 'responsable', 'responsible']) ?? '').trim() || undefined,
            effectiveness: toInt(getVal(r, ['eficacia', 'eficacia_%', 'eficacia_de_controles', 'effectiveness']), undefined),
          });

          const code = await generateRiskCode(tx, tenantId);
          const riskLevel = parsed.probability * parsed.impact;

          await tx.risk.create({
            data: {
              tenantId,
              code,
              title: parsed.title,
              description: parsed.description,
              category: parsed.category,
              process: parsed.process,
              standard: parsed.standard,
              identificationDate: new Date(),
              reviewDate: null,
              probability: parsed.probability,
              impact: parsed.impact,
              riskLevel,
              inherentProbability: parsed.inherentProbability,
              inherentImpact: parsed.inherentImpact,
              treatmentPlan: parsed.treatmentPlan,
              controls: parsed.controls,
              requirement: parsed.requirement,
              aspectType: parsed.aspectType,
              hazard: parsed.hazard,
              environmentalAspect: parsed.environmentalAspect,
              legalRequirement: parsed.legalRequirement,
              legalReference: parsed.legalReference,
              riskSource: parsed.riskSource,
              strategy: parsed.strategy,
              responsible: parsed.responsible,
              effectiveness: parsed.effectiveness,
              createdById: req.auth?.userId ?? null,
              updatedById: req.auth?.userId ?? null,
            },
          });

          created += 1;
        } catch (e: any) {
          const msg = e?.errors?.[0]?.message || e?.message || 'Invalid row';
          errors.push({ row: i + 2, message: msg }); // +2: header is row 1
        }
      }

      return { created, failed: errors.length, errors };
    });

    return reply.code(200).send({ result: results });
  });

  // PATCH /risks/:id — Actualizar
  app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = updateSchema.parse(req.body);

    const risk = await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.risk.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!existing) return null;

      const prob = body.probability ?? existing.probability;
      const imp = body.impact ?? existing.impact;
      const riskLevel = prob * imp;

      const residualProb = body.residualProb ?? existing.residualProb;
      const residualImpact = body.residualImpact ?? existing.residualImpact;
      const residualLevel = residualProb && residualImpact ? residualProb * residualImpact : existing.residualLevel;

      // Si el estado cambia a CLOSED, establecer closureDate automáticamente
      const closureDate = body.status === 'CLOSED' && existing.status !== 'CLOSED' 
        ? new Date() 
        : body.closureDate ? new Date(body.closureDate) : existing.closureDate;

      return tx.risk.update({
        where: { id },
        data: {
          ...body,
          identificationDate: body.identificationDate ? new Date(body.identificationDate) : existing.identificationDate,
          reviewDate: body.reviewDate ? new Date(body.reviewDate) : existing.reviewDate,
          closureDate,
          probability: prob,
          impact: imp,
          riskLevel,
          residualProb,
          residualImpact,
          residualLevel,
          updatedById: req.auth?.userId ?? null,
        },
        include: {
          owner: { select: { id: true, email: true } },
          createdBy: { select: { id: true, email: true } },
        },
      });
    });

    if (!risk) return reply.code(404).send({ error: 'Risk not found' });
    return reply.send({ risk });
  });

  // DELETE /risks/:id — Soft delete
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const deleted = await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.risk.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!existing) return null;
      return tx.risk.update({
        where: { id },
        data: { deletedAt: new Date(), updatedById: req.auth?.userId ?? null },
      });
    });

    if (!deleted) return reply.code(404).send({ error: 'Risk not found' });
    return reply.send({ ok: true });
  });
};
