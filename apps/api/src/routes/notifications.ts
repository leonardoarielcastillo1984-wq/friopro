import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

const FEATURE_KEY = 'notificaciones';

export const notificacionesRoutes: FastifyPluginAsync = async (app) => {
  // GET /notificaciones — Listar notificaciones
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    // app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    const tenantId = req.db.tenantId;
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(500).optional().default(100),
      })
      .parse(req.query);

    const { notifications, unreadCount } = await app.runWithDbContext(req, async (tx: any) => {
      const [notifications, unreadCount] = await Promise.all([
        tx.notification.findMany({
          where: { tenantId, userId: req.auth!.userId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: query.limit,
        }),
        tx.notification.count({
          where: { tenantId, userId: req.auth!.userId, deletedAt: null, isRead: false },
        }),
      ]);

      return { notifications, unreadCount };
    });

    return reply.send({ notifications, unreadCount });
  });

  // POST /notificaciones/mark-read — Marcar como leídas
  app.post('/mark-read', async (req: FastifyRequest, reply: FastifyReply) => {
    // app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    const tenantId = req.db.tenantId;
    const body = z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(req.body);

    await app.runWithDbContext(req, async (tx: any) => {
      await tx.notification.updateMany({
        where: {
          tenantId,
          userId: req.auth!.userId,
          id: { in: body.ids },
          deletedAt: null,
        },
        data: { isRead: true, readAt: new Date() },
      });
    });

    return reply.send({ ok: true });
  });

  // POST /notificaciones/mark-all-read — Marcar todas como leídas
  app.post('/mark-all-read', async (req: FastifyRequest, reply: FastifyReply) => {
    // app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    const tenantId = req.db.tenantId;

    await app.runWithDbContext(req, async (tx: any) => {
      await tx.notification.updateMany({
        where: { tenantId, userId: req.auth!.userId, deletedAt: null, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
    });

    return reply.send({ ok: true });
  });

  // GET /notificaciones/generate - Generate personalized notifications
  app.get('/generate', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    const tenantId = req.db.tenantId;
    const userId = req.auth.userId;
    const generated: string[] = [];

    await app.runWithDbContext(req, async (tx: any) => {
      // 1. Upcoming trainings for user
      const trainings = await tx.sgiTraining.findMany({
        where: {
          tenantId,
          scheduledDate: { gte: new Date() },
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
          attendees: { some: { userId } },
        },
      });

      for (const t of trainings) {
        const exists = await tx.notification.findFirst({
          where: { userId, type: 'TRAINING', entityId: t.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        });
        if (!exists) {
          await tx.notification.create({
            data: {
              tenantId, userId, type: 'TRAINING',
              title: `Capacitación: ${t.title}`,
              message: `Programada para ${t.scheduledDate?.toLocaleDateString('es-AR')}`,
              link: `/capacitaciones/${t.id}`,
              entityType: 'training', entityId: t.id,
            },
          });
          generated.push(`Training: ${t.title}`);
        }
      }

      // 2. Documents pending review in user's department
      const userWithDept = await tx.platformUser.findFirst({
        where: { id: userId },
        include: { employee: { select: { departmentId: true } } },
      });

      if (userWithDept?.employee?.departmentId) {
        const docs = await tx.document.findMany({
          where: {
            tenantId,
            status: 'PENDING_REVIEW',
            departmentId: userWithDept.employee.departmentId,
          },
        });

        for (const d of docs) {
          const exists = await tx.notification.findFirst({
            where: { userId, type: 'DOCUMENT', entityId: d.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          });
          if (!exists) {
            await tx.notification.create({
              data: {
                tenantId, userId, type: 'DOCUMENT',
                title: `Documento pendiente`,
                message: `"${d.title}" requiere revisión`,
                link: `/documentos/${d.id}`,
                entityType: 'document', entityId: d.id,
              },
            });
            generated.push(`Document: ${d.title}`);
          }
        }
      }

      // 3. NCRs assigned to user
      const ncrs = await tx.nonConformity.findMany({
        where: { tenantId, status: { in: ['OPEN', 'IN_PROGRESS'] }, assignedToId: userId },
      });

      for (const n of ncrs) {
        const exists = await tx.notification.findFirst({
          where: { userId, type: 'NCR', entityId: n.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        });
        if (!exists) {
          await tx.notification.create({
            data: {
              tenantId, userId, type: 'NCR',
              title: `No Conformidad: ${n.code}`,
              message: n.title,
              link: `/no-conformidades/${n.id}`,
              entityType: 'ncr', entityId: n.id,
            },
          });
          generated.push(`NCR: ${n.code}`);
        }
      }
    });

    return reply.send({ generated, count: generated.length });
  });
};
