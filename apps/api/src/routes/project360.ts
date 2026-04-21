import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  origin: z.string(),
  originModule: z.string().default('PROJECT360'),
  originEntityId: z.string().optional(),
  responsibleId: z.string().uuid(),
  targetDate: z.string().datetime(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  indicatorId: z.string().uuid().optional(),
  targetValue: z.number().optional(),
  tags: z.array(z.string()).default([]),
});

async function enrichProjects(prisma: any, projects: any[]) {
  const ids = [...new Set(projects.map(p => p.responsibleId).filter(Boolean))];
  if (ids.length === 0) return projects;
  const users = await prisma.platformUser.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } });
  const userMap = Object.fromEntries(users.map((u: any) => [u.id, u]));
  return projects.map(p => ({
    ...p,
    responsible: userMap[p.responsibleId] ? { id: userMap[p.responsibleId].id, name: userMap[p.responsibleId].email, email: userMap[p.responsibleId].email } : { id: p.responsibleId, name: 'Usuario', email: '' },
  }));
}

async function logHistory(prisma: any, projectId: string, tenantId: string, action: string, details: string, userId?: string, userName?: string) {
  try {
    await prisma.project360History.create({
      data: { projectId, tenantId, action, details, userId: userId || null, userName: userName || null },
    });
  } catch { /* no bloquear */ }
}

export default async function project360Routes(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // GET /project360/projects
  app.get('/projects', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db.tenantId;
    const { status, priority, origin } = req.query as any;

    const where: any = { tenantId, deletedAt: null };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (origin) where.origin = origin;

    const raw = await prisma.project360.findMany({
      where,
      include: { tasks: { where: { deletedAt: null }, orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    const projects = await enrichProjects(prisma, raw);
    return reply.send({ projects });
  });

  // POST /project360/projects
  app.post('/projects', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db.tenantId;

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const data = createProjectSchema.parse(body);

    const year = new Date().getFullYear();
    const count = await prisma.project360.count({ where: { tenantId, createdAt: { gte: new Date(`${year}-01-01`) } } });
    const code = `PROJ-${year}-${String(count + 1).padStart(3, '0')}`;

    const project = await prisma.project360.create({
      data: {
        tenantId, code, ...data,
        responsibleId: data.responsibleId,
        targetDate: new Date(data.targetDate),
        createdById: req.db.userId || null,
        tags: data.tags,
      },
      include: { tasks: true },
    });

    await logHistory(prisma, project.id, tenantId, 'CREATED', `Proyecto "${project.name}" creado`, req.db.userId, req.db.userName);
    return reply.code(201).send({ project });
  });

  // GET /project360/projects/:id
  app.get('/projects/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };

    const project = await prisma.project360.findFirst({
      where: { id, tenantId: req.db.tenantId, deletedAt: null },
      include: { tasks: { where: { deletedAt: null }, orderBy: { order: 'asc' }, include: { comments: { orderBy: { createdAt: 'desc' } } } }, attachments: { orderBy: { createdAt: 'desc' } }, reminders: { orderBy: { reminderDate: 'asc' } } },
    });
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    const [enriched] = await enrichProjects(prisma, [project]);
    return reply.send({ project: enriched });
  });

  // PUT /project360/projects/:id
  app.put('/projects/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const { id: _id, tenantId: _tid, createdAt: _ca, deletedAt: _da, tasks: _tasks, ...data } = body;

    const existing = await prisma.project360.findFirst({ where: { id, tenantId: req.db.tenantId, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: 'Project not found' });

    const project = await prisma.project360.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
      include: { tasks: { where: { deletedAt: null }, orderBy: { order: 'asc' } } },
    });

    if (data.status && data.status !== existing.status) {
      await logHistory(prisma, id, req.db.tenantId, 'STATUS_CHANGE', `Estado: ${existing.status} → ${data.status}`, req.db.userId, req.db.userName);
    }
    if (data.progress !== undefined && data.progress !== existing.progress) {
      await logHistory(prisma, id, req.db.tenantId, 'PROGRESS_UPDATE', `Progreso: ${data.progress}%`, req.db.userId, req.db.userName);
    }
    return reply.send({ project });
  });

  // DELETE /project360/projects/:id
  app.delete('/projects/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };

    const existing = await prisma.project360.findFirst({ where: { id, tenantId: req.db.tenantId, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: 'Project not found' });

    await prisma.project360.update({ where: { id }, data: { deletedAt: new Date() } });
    return reply.send({ message: 'Project deleted successfully' });
  });

  // GET /project360/stats
  app.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db.tenantId;
    const where = { tenantId, deletedAt: null };

    const [total, active, completed, overdue, critical] = await Promise.all([
      prisma.project360.count({ where }),
      prisma.project360.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      prisma.project360.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.project360.count({ where: { ...where, status: 'OVERDUE' } }),
      prisma.project360.count({ where: { ...where, priority: 'CRITICAL' } }),
    ]);

    const all = await prisma.project360.findMany({ where, select: { progress: true } });
    const avgProgress = all.length > 0 ? all.reduce((s: number, p: any) => s + p.progress, 0) / all.length : 0;

    return reply.send({ stats: { totalProjects: total, activeProjects: active, completedProjects: completed, overdueProjects: overdue, criticalProjects: critical, avgProgress } });
  });

  // POST /project360/tasks/:taskId/comments
  app.post('/tasks/:taskId/comments', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { taskId } = req.params as { taskId: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const { text } = body;
    if (!text?.trim()) return reply.code(400).send({ error: 'Comment text is required' });

    const task = await prisma.project360Task.findFirst({ where: { id: taskId, tenantId: req.db.tenantId, deletedAt: null } });
    if (!task) return reply.code(404).send({ error: 'Task not found' });

    const comment = await prisma.project360Comment.create({
      data: { taskId, tenantId: req.db.tenantId, text: text.trim(), authorId: req.db.userId || null, authorName: req.db.userName || null },
    });
    return reply.code(201).send({ comment });
  });

  // GET /project360/tasks/:taskId/comments
  app.get('/tasks/:taskId/comments', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { taskId } = req.params as { taskId: string };
    const comments = await prisma.project360Comment.findMany({
      where: { taskId, tenantId: req.db.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ comments });
  });

  // POST /project360/projects/:id/attachments
  app.post('/projects/:id/attachments', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const { name, url, size, type, taskId } = body;
    if (!name || !url) return reply.code(400).send({ error: 'Name and URL are required' });

    const attachment = await prisma.project360Attachment.create({
      data: { projectId: id, tenantId: req.db.tenantId, name, url, size: size || 0, type: type || 'application/octet-stream', taskId: taskId || null, uploadedById: req.db.userId || null },
    });
    await logHistory(prisma, id, req.db.tenantId, 'ATTACHMENT_ADDED', `Archivo "${name}" agregado`, req.db.userId, req.db.userName);
    return reply.code(201).send({ attachment });
  });

  // GET /project360/projects/:id/attachments
  app.get('/projects/:id/attachments', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    const attachments = await prisma.project360Attachment.findMany({ where: { projectId: id, tenantId: req.db.tenantId }, orderBy: { createdAt: 'desc' } });
    return reply.send({ attachments });
  });

  // DELETE /project360/attachments/:attachmentId
  app.delete('/attachments/:attachmentId', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { attachmentId } = req.params as { attachmentId: string };
    const att = await prisma.project360Attachment.findFirst({ where: { id: attachmentId, tenantId: req.db.tenantId } });
    if (!att) return reply.code(404).send({ error: 'Attachment not found' });
    await prisma.project360Attachment.delete({ where: { id: attachmentId } });
    await logHistory(prisma, att.projectId, req.db.tenantId, 'ATTACHMENT_REMOVED', `Archivo "${att.name}" eliminado`, req.db.userId, req.db.userName);
    return reply.send({ message: 'Attachment deleted' });
  });

  // GET /project360/projects/:id/history
  app.get('/projects/:id/history', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    const history = await prisma.project360History.findMany({ where: { projectId: id, tenantId: req.db.tenantId }, orderBy: { createdAt: 'desc' }, take: 50 });
    return reply.send({ history });
  });

  // POST /project360/projects/:id/reminders
  app.post('/projects/:id/reminders', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const { title, reminderDate, description } = body;
    if (!title || !reminderDate) return reply.code(400).send({ error: 'Title and reminderDate are required' });

    const reminder = await prisma.project360Reminder.create({
      data: { projectId: id, tenantId: req.db.tenantId, title, description: description || null, reminderDate: new Date(reminderDate), userId: req.db.userId || null },
    });
    return reply.code(201).send({ reminder });
  });

  // GET /project360/projects/:id/reminders
  app.get('/projects/:id/reminders', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    const reminders = await prisma.project360Reminder.findMany({ where: { projectId: id, tenantId: req.db.tenantId }, orderBy: { reminderDate: 'asc' } });
    return reply.send({ reminders });
  });

  // POST /project360/reminders/:reminderId/complete
  app.post('/reminders/:reminderId/complete', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { reminderId } = req.params as { reminderId: string };
    const reminder = await prisma.project360Reminder.findFirst({ where: { id: reminderId, tenantId: req.db.tenantId } });
    if (!reminder) return reply.code(404).send({ error: 'Reminder not found' });
    const updated = await prisma.project360Reminder.update({ where: { id: reminderId }, data: { isCompleted: true, completedAt: new Date() } });
    return reply.send({ reminder: updated });
  });

  // DELETE /project360/reminders/:reminderId
  app.delete('/reminders/:reminderId', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { reminderId } = req.params as { reminderId: string };
    const reminder = await prisma.project360Reminder.findFirst({ where: { id: reminderId, tenantId: req.db.tenantId } });
    if (!reminder) return reply.code(404).send({ error: 'Reminder not found' });
    await prisma.project360Reminder.delete({ where: { id: reminderId } });
    return reply.send({ message: 'Reminder deleted' });
  });

  // GET /project360/notifications (stub — usa sistema global)
  app.get('/notifications', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ notifications: [] });
  });
}
