import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

export async function registerSupplierRoutes(app: FastifyInstance) {
  // GET /suppliers - Enhanced list with computed scores and status
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;

    const suppliers = await app.runWithDbContext(req, async (tx: any) => {
      const suppliersData = await tx.supplier.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { evaluations: true } },
        },
      });

      const supplierIds = suppliersData.map((s: any) => s.id);
      if (supplierIds.length === 0) return suppliersData;

      // Get latest evaluation per supplier
      const latestEvals = await tx.supplierEvaluation.findMany({
        where: {
          supplierId: { in: supplierIds },
        },
        orderBy: { date: 'desc' },
        distinct: ['supplierId'],
        select: {
          supplierId: true,
          overallScore: true,
          date: true,
          result: true,
        },
      });

      // Get open NC count linked to suppliers via description/title (fallback)
      let ncCountsMap = new Map<string, number>();
      try {
        const ncList = await tx.nonConformity.findMany({
          where: {
            tenantId,
            status: { in: ['OPEN', 'IN_ANALYSIS', 'ACTION_PLANNED', 'IN_PROGRESS'] },
            source: 'SUPPLIER_ISSUE',
          },
          select: { id: true, description: true, title: true },
        });
        for (const supplier of suppliersData) {
          const count = ncList.filter((nc: any) =>
            (nc.title?.includes(supplier.name) || nc.description?.includes(supplier.name))
          ).length;
          ncCountsMap.set(supplier.id, count);
        }
      } catch (e) {
        console.warn('Failed to count NCs for suppliers:', e);
      }

      const latestMap = new Map<string, any>(
        latestEvals.map((e: any) => [e.supplierId, e])
      );

      return suppliersData.map((s: any) => {
        const latest = latestMap.get(s.id);
        const avgScore = latest?.overallScore ?? s.evaluationScore ?? null;
        let computedStatus = s.status;
        if (avgScore !== null && avgScore !== undefined) {
          if (avgScore >= 4) computedStatus = 'APPROVED';
          else if (avgScore >= 3) computedStatus = 'CONDITIONAL';
          else computedStatus = 'REJECTED';
        }
        return {
          ...s,
          avgScore,
          computedStatus,
          lastEvaluationDate: latest?.date ?? s.lastEvaluationDate ?? null,
          openNcCount: ncCountsMap.get(s.id) ?? 0,
        };
      });
    });

    return reply.send({ suppliers });
  });

  // GET /suppliers/stats
  app.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;

    const stats = await app.runWithDbContext(req, async (tx: any) => {
      const total = await tx.supplier.count({ where: { tenantId, deletedAt: null } });
      const critical = await tx.supplier.count({
        where: { tenantId, deletedAt: null, status: 'REJECTED' },
      });
      const withoutEval90 = await tx.supplier.count({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { lastEvaluationDate: null },
            { lastEvaluationDate: { lt: new Date(Date.now() - 90 * 24 * 3600 * 1000) } },
          ],
        },
      });

      const latestEvals = await tx.supplierEvaluation.findMany({
        where: { tenantId },
        orderBy: { date: 'desc' },
        distinct: ['supplierId'],
        select: { overallScore: true },
      });
      const avgOverall = latestEvals.length
        ? latestEvals.reduce((acc: number, e: any) => acc + (e.overallScore || 0), 0) / latestEvals.length
        : null;

      return { total, critical, withoutEval90, avgOverall: avgOverall ? parseFloat(avgOverall.toFixed(1)) : null };
    });

    return reply.send({ stats });
  });

  // GET /suppliers/:id - Enhanced detail with evaluations
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const supplier = await app.runWithDbContext(req, async (tx: any) => {
      const data = await tx.supplier.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          evaluations: { orderBy: { date: 'desc' } },
        },
      });
      if (!data) return null;

      const latest = data.evaluations?.[0];
      const avgScore = latest?.overallScore ?? data.evaluationScore ?? null;
      let computedStatus = data.status;
      if (avgScore !== null && avgScore !== undefined) {
        if (avgScore >= 4) computedStatus = 'APPROVED';
        else if (avgScore >= 3) computedStatus = 'CONDITIONAL';
        else computedStatus = 'REJECTED';
      }

      return {
        ...data,
        avgScore,
        computedStatus,
        lastEvaluationDate: latest?.date ?? data.lastEvaluationDate ?? null,
      };
    });

    if (!supplier) return reply.code(404).send({ error: 'Not found' });
    return reply.send({ supplier });
  });

  // POST /suppliers/:id/evaluations
  app.post('/:id/evaluations', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const rawBody = req.body;
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody ?? {}) as any;

    const evaluation = await app.runWithDbContext(req, async (tx: any) => {
      const supplier = await tx.supplier.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!supplier) throw new Error('Supplier not found');

      const qualityScore = Number(body.qualityScore ?? 0);
      const deliveryScore = Number(body.deliveryScore ?? 0);
      const priceScore = Number(body.priceScore ?? 0);
      const serviceScore = Number(body.serviceScore ?? 0);
      const documentationScore = Number(body.documentationScore ?? 0);
      const overallScore = parseFloat(
        ((qualityScore + deliveryScore + priceScore + serviceScore + documentationScore) / 5).toFixed(1)
      );

      let result = 'REJECTED';
      if (overallScore >= 4) result = 'APPROVED';
      else if (overallScore >= 3) result = 'CONDITIONAL';

      const created = await tx.supplierEvaluation.create({
        data: {
          tenantId,
          supplierId: id,
          date: body.date ? new Date(body.date) : new Date(),
          period: body.period || null,
          qualityScore,
          deliveryScore,
          priceScore,
          serviceScore,
          documentationScore,
          overallScore,
          result,
          comments: body.comments || null,
          evaluatedById: req.auth?.userId ?? null,
        },
      });

      // Update supplier status & score
      await tx.supplier.update({
        where: { id },
        data: {
          evaluationScore: overallScore,
          status: result === 'APPROVED' ? 'APPROVED' : result === 'CONDITIONAL' ? 'CONDITIONAL' : 'REJECTED',
          lastEvaluationDate: new Date(),
          nextEvaluationDate: new Date(Date.now() + 90 * 24 * 3600 * 1000),
        },
      });

      // Auto-generate NC if score < 3
      if (overallScore < 3) {
        try {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
          const existingNcs = await tx.nonConformity.findMany({
            where: {
              tenantId,
              source: 'SUPPLIER_ISSUE',
              status: { in: ['OPEN', 'IN_ANALYSIS', 'ACTION_PLANNED', 'IN_PROGRESS'] },
              detectedAt: { gte: thirtyDaysAgo },
              OR: [
                { title: { contains: supplier.name, mode: 'insensitive' } },
                { description: { contains: supplier.name, mode: 'insensitive' } },
              ],
            },
            select: { id: true },
          });

          if (existingNcs.length === 0) {
            const year = new Date().getFullYear();
            const count = await tx.nonConformity.count({
              where: { tenantId, code: { startsWith: `NCR-${year}-` } },
            });
            const code = `NCR-${year}-${String(count + 1).padStart(3, '0')}`;

            await tx.nonConformity.create({
              data: {
                tenantId,
                code,
                title: `Bajo desempeño proveedor: ${supplier.name}`,
                description: `Proveedor con bajo desempeño detectado (score: ${overallScore}). Evaluación automática generada por sistema.`,
                severity: overallScore < 2.5 ? 'CRITICAL' : 'MAJOR',
                source: 'SUPPLIER_ISSUE',
                status: 'OPEN',
                detectedAt: new Date(),
                dueDate: new Date(Date.now() + 15 * 24 * 3600 * 1000),
              },
            });
          }
        } catch (ncErr) {
          console.warn('Failed to auto-generate NC for supplier:', (ncErr as Error).message);
        }
      }

      return created;
    });

    return reply.code(201).send({ evaluation });
  });

  // GET /suppliers/:id/evaluations
  app.get('/:id/evaluations', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const evaluations = await app.runWithDbContext(req, async (tx: any) => {
      return tx.supplierEvaluation.findMany({
        where: { supplierId: id, tenantId },
        orderBy: { date: 'desc' },
      });
    });

    return reply.send({ evaluations });
  });

  // POST /suppliers/analyze - AI analysis (rule-based, no LLM)
  app.post('/analyze', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;

    const analysis = await app.runWithDbContext(req, async (tx: any) => {
      const suppliers = await tx.supplier.findMany({
        where: { tenantId, deletedAt: null },
        include: { evaluations: { orderBy: { date: 'desc' }, take: 3 } },
      });

      const recommendations: string[] = [];
      const highRisk: any[] = [];
      const withoutEval: any[] = [];
      const avgScores: number[] = [];

      for (const s of suppliers) {
        const latest = s.evaluations?.[0];
        const score = latest?.overallScore ?? s.evaluationScore ?? null;
        if (score !== null) avgScores.push(score);

        if (score !== null && score < 3) {
          highRisk.push({ id: s.id, name: s.name, score, count: s.evaluations.length });
          recommendations.push(`Proveedor "${s.name}" presenta bajo desempeño (score: ${score.toFixed(1)}). Se recomienda auditoría o reemplazo.`);
        }
        const lastEvalDate = latest?.date ?? s.lastEvaluationDate;
        if (!lastEvalDate || new Date(lastEvalDate).getTime() < Date.now() - 90 * 24 * 3600 * 1000) {
          withoutEval.push({ id: s.id, name: s.name });
        }
        if (s.evaluations.length >= 2) {
          const scores = s.evaluations.map((e: any) => e.overallScore);
          if (scores[0] < scores[scores.length - 1]) {
            recommendations.push(`Proveedor "${s.name}" muestra tendencia negativa en evaluaciones recientes.`);
          }
        }
      }

      const overallAvg = avgScores.length
        ? parseFloat((avgScores.reduce((a, b) => a + b, 0) / avgScores.length).toFixed(1))
        : null;

      return {
        overallAvg,
        highRiskCount: highRisk.length,
        highRiskSuppliers: highRisk,
        withoutEvalCount: withoutEval.length,
        withoutEvalSuppliers: withoutEval.slice(0, 10),
        totalSuppliers: suppliers.length,
        recommendations: [...new Set(recommendations)],
      };
    });

    return reply.send({ analysis });
  });

  // POST /suppliers/:id/actions - Manual NC/CAPA/Plan
  app.post('/:id/actions', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const rawBody = req.body;
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody ?? {}) as any;

    const result = await app.runWithDbContext(req, async (tx: any) => {
      const supplier = await tx.supplier.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!supplier) throw new Error('Supplier not found');

      if (body.type === 'NC') {
        const year = new Date().getFullYear();
        const count = await tx.nonConformity.count({
          where: { tenantId, code: { startsWith: `NCR-${year}-` } },
        });
        const code = `NCR-${year}-${String(count + 1).padStart(3, '0')}`;
        const nc = await tx.nonConformity.create({
          data: {
            tenantId,
            code,
            title: body.title || `NC - Proveedor: ${supplier.name}`,
            description: body.description || `Origen: Proveedor ${supplier.name}`,
            severity: body.severity || 'MAJOR',
            source: 'SUPPLIER_ISSUE',
            status: 'OPEN',
            detectedAt: new Date(),
            dueDate: new Date(Date.now() + 15 * 24 * 3600 * 1000),
          },
        });
        return { type: 'NC', nc };
      }

      if (body.type === 'PLAN') {
        // Reuse CustomerImprovementPlan as generic improvement plan
        const plan = await tx.customerImprovementPlan.create({
          data: {
            tenantId,
            customerId: null,
            title: body.title || `Plan de Mejora - ${supplier.name}`,
            description: body.description || `Plan de mejora para proveedor ${supplier.name}`,
            status: 'OPEN',
            dueDate: body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 30 * 24 * 3600 * 1000),
            createdById: req.auth?.userId ?? null,
          },
        });
        return { type: 'PLAN', plan };
      }

      return { type: body.type || 'UNKNOWN' };
    });

    return reply.send({ result });
  });

  // POST /suppliers - Create
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;
    const rawBody = req.body;
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody ?? {}) as any;

    const supplier = await app.runWithDbContext(req, async (tx: any) => {
      const year = new Date().getFullYear();
      const count = await tx.supplier.count({
        where: { tenantId, code: { startsWith: `PROV-${year}-` } },
      });
      const code = body.code || `PROV-${year}-${String(count + 1).padStart(3, '0')}`;
      return tx.supplier.create({
        data: {
          tenantId,
          code,
          name: body.name,
          legalName: body.legalName || null,
          taxId: body.taxId || null,
          email: body.email || null,
          phone: body.phone || null,
          address: body.address || null,
          category: body.category || null,
          contactName: body.contactName || null,
          contactPosition: body.contactPosition || null,
          status: body.status || 'PENDING',
          providerType: body.providerType || null,
          isCritical: body.isCritical ?? false,
          notes: body.notes || null,
        },
      });
    });

    return reply.code(201).send({ supplier });
  });

  // PATCH /suppliers/:id - Update
  app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const rawBody = req.body;
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody ?? {}) as any;

    const supplier = await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.supplier.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!existing) return reply.code(404).send({ error: 'Not found' });
      return tx.supplier.update({
        where: { id },
        data: {
          name: body.name ?? existing.name,
          legalName: body.legalName !== undefined ? body.legalName : existing.legalName,
          taxId: body.taxId !== undefined ? body.taxId : existing.taxId,
          email: body.email !== undefined ? body.email : existing.email,
          phone: body.phone !== undefined ? body.phone : existing.phone,
          address: body.address !== undefined ? body.address : existing.address,
          category: body.category !== undefined ? body.category : existing.category,
          contactName: body.contactName !== undefined ? body.contactName : existing.contactName,
          contactPosition: body.contactPosition !== undefined ? body.contactPosition : existing.contactPosition,
          status: body.status ?? existing.status,
          providerType: body.providerType !== undefined ? body.providerType : existing.providerType,
          isCritical: body.isCritical ?? existing.isCritical,
          notes: body.notes !== undefined ? body.notes : existing.notes,
        },
      });
    });

    return reply.send({ supplier });
  });

  // DELETE /suppliers/:id - Soft delete
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.supplier.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!existing) return reply.code(404).send({ error: 'Not found' });
      return tx.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
    });

    return reply.send({ success: true });
  });
}
