import { isSuperAdmin, getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createGroqOnlyLLMProvider } from '../services/llm/factory.js';
import { sendEmail, notificationEmail } from '../services/email.js';

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
  budget: z.number().optional(),
  budgetCurrency: z.string().default('ARS').optional(),
  licitationMode: z.string().optional(),
  templateId: z.string().uuid().optional(),
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

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En Ejecución',
  AT_RISK: 'En Riesgo',
  COMPLETED: 'Completado',
  OVERDUE: 'Vencido',
  CANCELLED: 'Cancelado',
  ON_HOLD: 'En Pausa',
};
function translateStatus(s: string): string { return STATUS_LABELS[s] ?? s; }

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
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { status, priority, origin } = req.query as any;

    const where: any = { tenantId, deletedAt: null };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (origin) where.origin = origin;

    const raw = await prisma.project360.findMany({
      where,
      include: {
        tasks: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
        budgetItems: { orderBy: { createdAt: 'asc' } },
        milestones: { orderBy: { order: 'asc' } },
        aiAnalyses: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
    });
    const projects = await enrichProjects(prisma, raw);
    return reply.send({ projects });
  });

  // POST /project360/projects
  app.post('/projects', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      console.log('[POST /projects] Body:', JSON.stringify(body, null, 2));

      const data = createProjectSchema.parse(body);

      const year = new Date().getFullYear();
      const count = await prisma.project360.count({ where: { tenantId, createdAt: { gte: new Date(`${year}-01-01`) } } });
      const code = `PROJ-${year}-${String(count + 1).padStart(3, '0')}`;

      const project = await prisma.project360.create({
        data: {
          tenantId, code, ...data,
          responsibleId: data.responsibleId,
          targetDate: new Date(data.targetDate),
          createdById: (req as any).db?.userId || null,
          tags: data.tags,
        },
        include: { tasks: true },
      });

      // Si viene templateId, copiar tareas, budget items y milestones predefinidos
      if (data.templateId) {
        const template = await prisma.project360Template.findFirst({ where: { id: data.templateId, tenantId } });
        if (template) {
          const defaultTasks = (template.defaultTasks as any[]) || [];
          const defaultBudgetItems = (template.defaultBudgetItems as any[]) || [];
          const defaultMilestones = (template.defaultMilestones as any[]) || [];

          if (defaultTasks.length > 0) {
            await prisma.project360Task.createMany({
              data: defaultTasks.map((t: any, i: number) => ({
                tenantId, projectId: project.id,
                title: t.title, description: t.description || null,
                responsibleId: t.responsibleId || null, status: 'PENDING',
                priority: t.priority || 'MEDIUM', order: i,
                dueDate: t.dueDate ? new Date(t.dueDate) : null,
              })),
            });
          }
          if (defaultBudgetItems.length > 0) {
            await prisma.project360BudgetItem.createMany({
              data: defaultBudgetItems.map((b: any) => ({
                tenantId, projectId: project.id,
                name: b.name, category: b.category || 'MATERIAL',
                estimated: b.estimated || 0, actual: 0,
                currency: b.currency || 'ARS', notes: b.notes || null,
              })),
            });
          }
          if (defaultMilestones.length > 0) {
            await prisma.project360Milestone.createMany({
              data: defaultMilestones.map((m: any, i: number) => ({
                tenantId, projectId: project.id,
                name: m.name, description: m.description || null,
                targetDate: m.targetDate ? new Date(m.targetDate) : new Date(data.targetDate),
                order: i, status: 'PENDING',
              })),
            });
          }
        }
      }

      const userId = (req as any).db?.userId;
      const userName = (req as any).db?.userName;
      await logHistory(prisma, project.id, tenantId, 'CREATED', `Proyecto "${project.name}" creado`, userId, userName);
      return reply.code(201).send({ project });
    } catch (err: any) {
      console.error('[POST /projects] Error:', err);
      return reply.code(500).send({ error: 'Error creando proyecto: ' + (err.message || err) });
    }
  });

  // GET /project360/members — listar empleados activos del tenant para seleccionar aprobadores
  app.get('/members', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      // Traer todos los empleados activos del tenant
      const employees = await prisma.employee.findMany({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, firstName: true, lastName: true, email: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
      });

      const users = employees.map((e: any) => ({
        id: e.id,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email
      }));

      return reply.send({ users });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // GET /project360/:id — alias sin /projects/ para compatibilidad
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    if (['projects', 'stats', 'notifications', 'tasks', 'attachments', 'reminders', 'members', 'aprobaciones'].includes(id)) {
      return reply.code(404).send({ error: 'Not found' });
    }
    const project = await prisma.project360.findFirst({
      where: { id, tenantId: req.db.tenantId, deletedAt: null },
      include: { tasks: { where: { deletedAt: null }, orderBy: { order: 'asc' }, include: { comments: { orderBy: { createdAt: 'desc' } } } }, attachments: { orderBy: { createdAt: 'desc' } }, reminders: { orderBy: { reminderDate: 'asc' } } },
    });
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    const [enriched] = await enrichProjects(prisma, [project]);
    return reply.send({ project: enriched });
  });

  // GET /project360/projects/:id
  app.get('/projects/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
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
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
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
      await logHistory(prisma, id, req.db.tenantId, 'STATUS_CHANGE', `Estado: ${translateStatus(existing.status)} → ${translateStatus(data.status)}`, req.db.userId, req.db.userName);
    }
    if (data.progress !== undefined && data.progress !== existing.progress) {
      await logHistory(prisma, id, req.db.tenantId, 'PROGRESS_UPDATE', `Progreso: ${data.progress}%`, req.db.userId, req.db.userName);
    }
    const [enriched] = await enrichProjects(prisma, [project]);
    return reply.send({ project: enriched });
  });

  // DELETE /project360/projects/:id
  app.delete('/projects/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };

    const existing = await prisma.project360.findFirst({ where: { id, tenantId: req.db.tenantId, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: 'Project not found' });

    await prisma.project360.update({ where: { id }, data: { deletedAt: new Date() } });
    return reply.send({ message: 'Project deleted successfully' });
  });

  // GET /project360/stats
  app.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
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

  // POST /project360/projects/:id/tasks — crear tarea individual
  app.post('/projects/:id/tasks', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { title, description, priority, status, dueDate, responsibleId } = body;
      if (!title) return reply.code(400).send({ error: 'Se requiere título' });

      const count = await prisma.project360Task.count({ where: { projectId: id, tenantId } });
      const task = await prisma.project360Task.create({
        data: {
          tenantId, projectId: id,
          title, description: description || null,
          priority: priority || 'MEDIUM',
          status: status || 'PENDING',
          order: count,
          dueDate: dueDate ? new Date(dueDate) : null,
          responsibleId: responsibleId || null,
        },
      });
      return reply.code(201).send({ task });
    } catch (err: any) {
      console.error('[POST /projects/:id/tasks] Error:', err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // POST /project360/tasks/:taskId/comments
  app.post('/tasks/:taskId/comments', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
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
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { taskId } = req.params as { taskId: string };
    const comments = await prisma.project360Comment.findMany({
      where: { taskId, tenantId: req.db.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ comments });
  });

  // PUT /project360/tasks/:taskId/reorder
  // Reordenar tarea vía drag & drop
  app.put('/tasks/:taskId/reorder', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { taskId } = req.params as { taskId: string };
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { targetTaskId } = body;

      const dragged = await prisma.project360Task.findFirst({ where: { id: taskId, tenantId } });
      const target = await prisma.project360Task.findFirst({ where: { id: targetTaskId, tenantId } });
      if (!dragged || !target) return reply.code(404).send({ error: 'Task not found' });

      // Intercambiar orden entre las dos tareas
      const tempOrder = dragged.order || 0;
      await prisma.project360Task.update({ where: { id: taskId }, data: { order: target.order || 0 } });
      await prisma.project360Task.update({ where: { id: targetTaskId }, data: { order: tempOrder } });

      return reply.send({ success: true, message: 'Tareas reordenadas' });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // POST /project360/projects/:id/attachments
  app.post('/projects/:id/attachments', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
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
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const attachments = await prisma.project360Attachment.findMany({ where: { projectId: id, tenantId: req.db.tenantId }, orderBy: { createdAt: 'desc' } });
    return reply.send({ attachments });
  });

  // DELETE /project360/attachments/:attachmentId
  app.delete('/attachments/:attachmentId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { attachmentId } = req.params as { attachmentId: string };
    const att = await prisma.project360Attachment.findFirst({ where: { id: attachmentId, tenantId: req.db.tenantId } });
    if (!att) return reply.code(404).send({ error: 'Attachment not found' });
    await prisma.project360Attachment.delete({ where: { id: attachmentId } });
    await logHistory(prisma, att.projectId, req.db.tenantId, 'ATTACHMENT_REMOVED', `Archivo "${att.name}" eliminado`, req.db.userId, req.db.userName);
    return reply.send({ message: 'Attachment deleted' });
  });

  // GET /project360/projects/:id/history
  app.get('/projects/:id/history', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const history = await prisma.project360History.findMany({ where: { projectId: id, tenantId: req.db.tenantId }, orderBy: { createdAt: 'desc' }, take: 50 });
    return reply.send({ history });
  });

  // POST /project360/projects/:id/reminders
  app.post('/projects/:id/reminders', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
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
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const reminders = await prisma.project360Reminder.findMany({ where: { projectId: id, tenantId: req.db.tenantId }, orderBy: { reminderDate: 'asc' } });
    return reply.send({ reminders });
  });

  // POST /project360/reminders/:reminderId/complete
  app.post('/reminders/:reminderId/complete', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { reminderId } = req.params as { reminderId: string };
    const reminder = await prisma.project360Reminder.findFirst({ where: { id: reminderId, tenantId: req.db.tenantId } });
    if (!reminder) return reply.code(404).send({ error: 'Reminder not found' });
    const updated = await prisma.project360Reminder.update({ where: { id: reminderId }, data: { isCompleted: true, completedAt: new Date() } });
    return reply.send({ reminder: updated });
  });

  // DELETE /project360/reminders/:reminderId
  app.delete('/reminders/:reminderId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { reminderId } = req.params as { reminderId: string };
    const reminder = await prisma.project360Reminder.findFirst({ where: { id: reminderId, tenantId: req.db.tenantId } });
    if (!reminder) return reply.code(404).send({ error: 'Reminder not found' });
    await prisma.project360Reminder.delete({ where: { id: reminderId } });
    return reply.send({ message: 'Reminder deleted' });
  });

  // ═══════════════════════════════════════════════════════════════
  // PROJECT360 PRO — Templates, Budget, Milestones, AI Analysis
  // ═══════════════════════════════════════════════════════════════

  // ── TEMPLATES ──
  app.get('/templates', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const templates = await prisma.project360Template.findMany({ where: { tenantId, isActive: true }, orderBy: { category: 'asc', name: 'asc' } });
    return reply.send({ templates });
  });

  app.post('/templates', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const template = await prisma.project360Template.create({
      data: { tenantId, name: body.name, description: body.description, category: body.category || 'GENERAL', defaultTasks: body.defaultTasks || [], defaultBudgetItems: body.defaultBudgetItems || [], defaultMilestones: body.defaultMilestones || [] },
    });
    return reply.code(201).send({ template });
  });

  app.put('/templates/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const template = await prisma.project360Template.updateMany({
      where: { id, tenantId },
      data: { name: body.name, description: body.description, category: body.category, defaultTasks: body.defaultTasks, defaultBudgetItems: body.defaultBudgetItems, defaultMilestones: body.defaultMilestones, isActive: body.isActive },
    });
    return reply.send({ template });
  });

  app.delete('/templates/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    await prisma.project360Template.updateMany({ where: { id, tenantId }, data: { isActive: false } });
    return reply.send({ message: 'Template desactivado' });
  });

  // ── BUDGET ITEMS ──
  app.get('/projects/:id/budget-items', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const items = await prisma.project360BudgetItem.findMany({ where: { projectId: id, tenantId: req.db.tenantId }, orderBy: { createdAt: 'asc' } });
    return reply.send({ budgetItems: items });
  });

  app.post('/projects/:id/budget-items', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const item = await prisma.project360BudgetItem.create({
      data: { tenantId, projectId: id, name: body.name, category: body.category || 'MATERIAL', estimated: body.estimated || 0, actual: body.actual || 0, currency: body.currency || 'ARS', isExpense: body.isExpense || false, notes: body.notes },
    });
    // Actualizar actualCost del proyecto si es un gasto
    if (body.isExpense && body.actual > 0) {
      const project = await prisma.project360.findFirst({ where: { id, tenantId }, include: { budgetItems: true } });
      if (project) {
        const totalActual = project.budgetItems.reduce((s: number, b: any) => s + (b.actual || 0), 0);
        await prisma.project360.update({ where: { id }, data: { actualCost: totalActual } });
      }
    }
    return reply.code(201).send({ budgetItem: item });
  });

  app.put('/budget-items/:itemId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { itemId } = req.params as { itemId: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const item = await prisma.project360BudgetItem.updateMany({
      where: { id: itemId, tenantId },
      data: { name: body.name, category: body.category, estimated: body.estimated, actual: body.actual, currency: body.currency, isExpense: body.isExpense, notes: body.notes },
    });
    return reply.send({ budgetItem: item });
  });

  app.delete('/budget-items/:itemId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { itemId } = req.params as { itemId: string };
    await prisma.project360BudgetItem.deleteMany({ where: { id: itemId, tenantId } });
    return reply.send({ message: 'Budget item eliminado' });
  });

  // ── MILESTONES ──
  app.get('/projects/:id/milestones', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const milestones = await prisma.project360Milestone.findMany({ where: { projectId: id, tenantId: req.db.tenantId }, orderBy: { order: 'asc' } });
    return reply.send({ milestones });
  });

  app.post('/projects/:id/milestones', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const milestone = await prisma.project360Milestone.create({
      data: { tenantId, projectId: id, name: body.name, description: body.description, targetDate: new Date(body.targetDate), order: body.order || 0 },
    });
    return reply.code(201).send({ milestone });
  });

  app.put('/milestones/:milestoneId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { milestoneId } = req.params as { milestoneId: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const data: any = { name: body.name, description: body.description, status: body.status, order: body.order };
    if (body.targetDate) data.targetDate = new Date(body.targetDate);
    if (body.status === 'COMPLETED') data.completedAt = new Date();
    const milestone = await prisma.project360Milestone.updateMany({ where: { id: milestoneId, tenantId }, data });
    return reply.send({ milestone });
  });

  app.delete('/milestones/:milestoneId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { milestoneId } = req.params as { milestoneId: string };
    await prisma.project360Milestone.deleteMany({ where: { id: milestoneId, tenantId } });
    return reply.send({ message: 'Milestone eliminado' });
  });

  // ── AI ANALYSIS ──
  app.post('/projects/:id/ai-analyses', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const { documentText, documentName, documentUrl, analysisType } = body;

    if (!documentText || documentText.length < 50) {
      return reply.code(400).send({ error: 'Se requiere texto del documento (mínimo 50 caracteres)' });
    }

    // Obtener config LLM del tenant
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { llmProvider: true, llmApiKey: true, llmModel: true, llmBaseUrl: true } });
    const userId = (req as any).db?.userId || null;
    let llm;
    try {
      llm = createGroqOnlyLLMProvider(tenant, prisma, tenantId, userId, 'project360-ai-analysis');
    } catch (err: any) {
      console.error('[AI Analysis] Error creating LLM provider:', err);
      return reply.code(500).send({ error: 'Error configurando proveedor IA: ' + err.message });
    }

    const prompt = `Analizá el siguiente documento de tipo "${analysisType || 'LICITACION'}" y respondé ÚNICAMENTE en formato JSON con esta estructura exacta:
{
  "summary": "resumen ejecutivo del documento...",
  "requirements": [
    { "title": "Requerimiento 1", "description": "...", "priority": "ALTA|MEDIA|BAJA", "estimatedCost": 0 }
  ],
  "risks": [
    { "title": "Riesgo 1", "severity": "ALTO|MEDIO|BAJO", "description": "..." }
  ],
  "timeline": [
    { "phase": "Fase 1", "days": 30, "description": "..." }
  ],
  "costs": {
    "totalEstimated": 0,
    "currency": "ARS",
    "breakdown": [
      { "category": "MATERIAL", "amount": 0 }
    ]
  },
  "scores": {
    "clarity": 1-10,
    "feasibility": 1-10,
    "profitability": 1-10,
    "riskLevel": 1-10
  }
}

DOCUMENTO:
${documentText.slice(0, 12000)}
${documentText.length > 12000 ? '\n[Documento truncado por longitud]' : ''}`;

    try {
      const response = await llm.chat([{ role: 'user', content: prompt }], 3000);
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      let parsed: any = {};
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch { /* noop */ }
      }

      const analysis = await prisma.project360AIAnalysis.create({
        data: {
          tenantId, projectId: id,
          documentName: documentName || 'Documento sin nombre',
          documentUrl: documentUrl || '',
          analysisType: analysisType || 'LICITACION',
          summary: parsed.summary || response.text.slice(0, 500),
          requirements: parsed.requirements || [],
          risks: parsed.risks || [],
          timeline: parsed.timeline || [],
          costs: parsed.costs || {},
          scores: parsed.scores || {},
          rawResponse: response.text,
        },
      });

      // Actualizar el proyecto con el análisis
      await prisma.project360.update({ where: { id }, data: { aiAnalysisId: analysis.id } });

      return reply.code(201).send({ analysis });
    } catch (err: any) {
      console.error('[AI Analysis] Error:', err);
      return reply.code(500).send({ error: 'Error al analizar con IA: ' + err.message });
    }
  });

  app.get('/projects/:id/ai-analyses', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const analyses = await prisma.project360AIAnalysis.findMany({ where: { projectId: id, tenantId: req.db.tenantId }, orderBy: { createdAt: 'desc' } });
    return reply.send({ aiAnalyses: analyses });
  });

  app.get('/ai-analyses/:analysisId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { analysisId } = req.params as { analysisId: string };
    const analysis = await prisma.project360AIAnalysis.findFirst({ where: { id: analysisId, tenantId: req.db.tenantId } });
    if (!analysis) return reply.code(404).send({ error: 'Analysis not found' });
    return reply.send({ analysis });
  });

  // ── COMPARADOR DE LICITACIONES ──
  app.post('/ai-analyses/:analysisId/compare', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { analysisId } = req.params as { analysisId: string };
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
    const { compareWithId } = body;

    const [a1, a2] = await Promise.all([
      prisma.project360AIAnalysis.findFirst({ where: { id: analysisId, tenantId: req.db.tenantId } }),
      prisma.project360AIAnalysis.findFirst({ where: { id: compareWithId, tenantId: req.db.tenantId } }),
    ]);
    if (!a1 || !a2) return reply.code(404).send({ error: 'Uno o ambos análisis no fueron encontrados' });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { llmProvider: true, llmApiKey: true, llmModel: true, llmBaseUrl: true } });
    const llm = createGroqOnlyLLMProvider(tenant, prisma, tenantId, req.db.userId || null, 'project360-ai-comparison');

    const prompt = `Compará dos licitaciones/pliegos y respondé ÚNICAMENTE en formato JSON con esta estructura:
{
  "winner": "Licitación A|Licitación B|Empate",
  "summary": "resumen de la comparación...",
  "comparison": [
    { "criteria": "Costo", "a": "...", "b": "...", "winner": "A|B|Empate" }
  ],
  "scores": {
    "a": { "clarity": 0, "feasibility": 0, "profitability": 0, "riskLevel": 0 },
    "b": { "clarity": 0, "feasibility": 0, "profitability": 0, "riskLevel": 0 }
  }
}

LICITACION A (${a1.documentName}):
Resumen: ${a1.summary || ''}
Requerimientos: ${JSON.stringify(a1.requirements || [])}
Riesgos: ${JSON.stringify(a1.risks || [])}
Costos: ${JSON.stringify(a1.costs || {})}
Scores: ${JSON.stringify(a1.scores || {})}

LICITACION B (${a2.documentName}):
Resumen: ${a2.summary || ''}
Requerimientos: ${JSON.stringify(a2.requirements || [])}
Riesgos: ${JSON.stringify(a2.risks || [])}
Costos: ${JSON.stringify(a2.costs || {})}
Scores: ${JSON.stringify(a2.scores || {})}`;

    try {
      const response = await llm.chat([{ role: 'user', content: prompt }], 3000);
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      let parsed: any = {};
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch { /* noop */ }
      }

      // Actualizar referencia cruzada
      await prisma.project360AIAnalysis.update({ where: { id: analysisId }, data: { comparedWith: compareWithId } });

      return reply.send({ comparison: parsed, analysisA: a1, analysisB: a2 });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Error al comparar: ' + err.message });
    }
  });

  // POST /project360/extract-text — extraer texto de PDF/DOCX para análisis de licitación
  app.post('/extract-text', async (req: FastifyRequest, reply: FastifyReply) => {
    const prisma = (app as any).prisma;
    const tenantId = getEffectiveTenantId(req, prisma);
    const parts = req.parts();
    let fileBuffer: Buffer | null = null;
    let filename = '';
    let mimetype = '';

    for await (const part of parts) {
      if (part.type === 'file') {
        fileBuffer = await part.toBuffer();
        filename = part.filename;
        mimetype = part.mimetype;
      }
    }

    if (!fileBuffer) {
      return reply.code(400).send({ error: 'No se recibió archivo' });
    }

    try {
      const { extractTextFromDocument } = await import('../services/textExtractor.js');
      const text = await extractTextFromDocument(fileBuffer, mimetype, filename);
      return reply.send({ text, filename, length: text.length });
    } catch (err: any) {
      return reply.code(400).send({ error: 'No se pudo extraer texto: ' + err.message });
    }
  });

  // GET /project360/notifications (stub — usa sistema global)
  app.get('/notifications', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ notifications: [] });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GESTIÓN DE APROBACIONES POR ETAPA DEL NEGOCIO (Workflow de Licitaciones)
  // ═══════════════════════════════════════════════════════════════════════════

  // ETAPAS válidas en orden de progresión
  const ETAPAS_NEGOCIO = [
    'LICITACION_BORRADOR',
    'DIMENSIONADO',
    'COTIZADO',
    'APROBADO_PARA_PRESENTAR',
    'ADJUDICADO',
    'EN_EJECUCION',
    'CERRADO'
  ];

  // GET /project360/projects/:id/aprobaciones — listar aprobaciones del proyecto
  app.get('/projects/:id/aprobaciones', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };

      const aprobaciones = await prisma.project360Aprobacion.findMany({
        where: { projectId: id, tenantId },
        include: { aprobador: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { solicitadoEn: 'desc' }
      });

      return reply.send({ aprobaciones });
    } catch (err: any) {
      console.error('[GET /aprobaciones] Error:', err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // POST /project360/projects/:id/aprobaciones — solicitar aprobación para avanzar etapa
  app.post('/projects/:id/aprobaciones', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { etapa, aprobadorId: employeeId, comentarios } = body;

      if (!etapa || !ETAPAS_NEGOCIO.includes(etapa)) {
        return reply.code(400).send({ error: 'Etapa inválida. Etapas válidas: ' + ETAPAS_NEGOCIO.join(', ') });
      }
      if (!employeeId) {
        return reply.code(400).send({ error: 'Se requiere aprobadorId' });
      }

      const userId = (req as any).db?.userId;

      // Buscar el empleado seleccionado
      const empleado = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { firstName: true, lastName: true, email: true }
      });
      if (!empleado) return reply.code(400).send({ error: 'Empleado no encontrado' });

      // Buscar PlatformUser por email (puede no existir)
      const platformUser = empleado.email ? await prisma.platformUser.findFirst({
        where: { email: empleado.email, deletedAt: null },
        select: { id: true }
      }) : null;

      const aprobadorPlatformId = platformUser?.id || null;
      const aprobadorNombre = `${empleado.firstName} ${empleado.lastName}`;

      // Crear o actualizar la solicitud de aprobación
      const aprobacion = await prisma.project360Aprobacion.upsert({
        where: { projectId_etapa: { projectId: id, etapa } },
        create: {
          projectId: id, tenantId, etapa,
          aprobadorId: aprobadorPlatformId,
          aprobadorEmail: empleado.email || null,
          aprobadorNombre,
          comentarios: comentarios || null,
          solicitadoPorId: userId || null,
          estado: 'PENDIENTE'
        },
        update: {
          aprobadorId: aprobadorPlatformId,
          aprobadorEmail: empleado.email || null,
          aprobadorNombre,
          comentarios: comentarios || null,
          solicitadoPorId: userId || null,
          estado: 'PENDIENTE',
          solicitadoEn: new Date(),
          aprobadoEn: null
        },
        include: { aprobador: { select: { id: true, firstName: true, lastName: true, email: true } } }
      });

      // Registrar en historial
      await logHistory(prisma, id, tenantId, 'APROBACION_SOLICITADA', `Solicitud de aprobación para etapa: ${etapa}`, userId, null);

      // Obtener datos del proyecto para notificaciones
      const proyecto = await prisma.project360.findUnique({ 
        where: { id }, 
        select: { name: true, code: true } 
      });

      // 🔔 Notificación in-app solo si tiene PlatformUser
      if (aprobadorPlatformId) {
        try {
          await prisma.notification.create({
            data: {
              tenantId,
              userId: aprobadorPlatformId,
              type: 'APROBACION_PROYECTO',
              title: `Aprobación pendiente: ${proyecto?.name || 'Proyecto'}`,
              message: `Te solicitan aprobar la etapa "${etapa}" del proyecto ${proyecto?.code || ''}. ${comentarios ? `Comentarios: ${comentarios}` : ''}`,
              link: `/project360/${id}`,
              entityType: 'project360',
              entityId: id,
            }
          });
        } catch (notifyErr) {
          console.error('[POST /aprobaciones] Error notificación in-app:', notifyErr);
        }
      }

      // 📧 Enviar email al aprobador si tiene email registrado
      if (empleado.email) {
        try {
          const emailPayload = notificationEmail({
            userEmail: empleado.email,
            title: `⏳ Aprobación requerida: ${proyecto?.name || 'Proyecto'}`,
            message: `Hola ${empleado.firstName || ''},<br><br>Te solicitan aprobar la etapa <strong>"${etapa}"</strong> del proyecto <strong>${proyecto?.code || ''}</strong>.<br><br>${comentarios ? `Comentarios del solicitante: <em>${comentarios}</em><br><br>` : ''}Hacé clic en el botón para revisar y aprobar:`,
            actionUrl: `${process.env.APP_URL || 'https://logismart.ar'}/project360/${id}`,
            type: 'warning'
          });
          await sendEmail(emailPayload);
        } catch (emailErr) {
          console.error('[POST /aprobaciones] Error enviando email:', emailErr);
        }
      }

      return reply.code(201).send({ aprobacion, mensaje: `Solicitud de aprobación para ${etapa} enviada a ${aprobacion.aprobador?.firstName || ''} ${aprobacion.aprobador?.lastName || ''}` });
    } catch (err: any) {
      console.error('[POST /aprobaciones] Error:', err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // POST /project360/aprobaciones/:id/aprobar — aprobar solicitud
  app.post('/aprobaciones/:id/aprobar', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { comentarios } = body;

      const aprobacion = await prisma.project360Aprobacion.findFirst({
        where: { id, tenantId },
        include: { project: true }
      });
      if (!aprobacion) return reply.code(404).send({ error: 'Solicitud de aprobación no encontrada' });
      if (aprobacion.estado !== 'PENDIENTE') {
        return reply.code(400).send({ error: `La solicitud ya fue ${aprobacion.estado.toLowerCase()}` });
      }

      const userId = (req as any).db?.userId;

      // Actualizar aprobación
      const aprobacionActualizada = await prisma.project360Aprobacion.update({
        where: { id },
        data: { estado: 'APROBADO', aprobadoEn: new Date(), comentarios: comentarios || aprobacion.comentarios },
        include: { aprobador: { select: { id: true, firstName: true, lastName: true } } }
      });

      // Registrar en historial
      await logHistory(prisma, aprobacion.projectId, tenantId, 'ETAPA_APROBADA', `Etapa ${aprobacion.etapa} aprobada`, userId, null);

      // 🔔 Notificar al solicitante que fue aprobado
      if (aprobacion.solicitadoPorId) {
        try {
          await prisma.notification.create({
            data: {
              tenantId,
              userId: aprobacion.solicitadoPorId,
              type: 'APROBACION_PROYECTO',
              title: `✅ Etapa aprobada: ${aprobacion.project?.name || 'Proyecto'}`,
              message: `La etapa "${aprobacion.etapa}" fue aprobada. ${comentarios ? `Comentarios: ${comentarios}` : ''}`,
              link: `/project360/${aprobacion.projectId}`,
              entityType: 'project360',
              entityId: aprobacion.projectId,
            }
          });

          // 📧 Enviar email al solicitante
          const solicitante = await prisma.platformUser.findUnique({
            where: { id: aprobacion.solicitadoPorId },
            select: { email: true, firstName: true }
          });

          if (solicitante?.email) {
            const emailPayload = notificationEmail({
              userEmail: solicitante.email,
              title: `✅ Etapa aprobada: ${aprobacion.project?.name || 'Proyecto'}`,
              message: `Hola ${solicitante.firstName || ''},<br><br>La etapa <strong>"${aprobacion.etapa}"</strong> del proyecto <strong>${aprobacion.project?.name || ''}</strong> fue <strong style="color: #16a34a;">APROBADA</strong>.<br><br>${comentarios ? `Comentarios del aprobador: <em>${comentarios}</em><br><br>` : ''}Ya podés continuar con el proyecto.`,
              actionUrl: `${process.env.APP_URL || 'https://logismart.ar'}/project360/${aprobacion.projectId}`,
              type: 'success'
            });
            await sendEmail(emailPayload);
          }
        } catch (notifyErr) {
          console.error('[POST /aprobar] Error notificando al solicitante:', notifyErr);
        }
      }

      return reply.send({ aprobacion: aprobacionActualizada, mensaje: `Etapa ${aprobacion.etapa} aprobada exitosamente` });
    } catch (err: any) {
      console.error('[POST /aprobar] Error:', err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // POST /project360/aprobaciones/:id/rechazar — rechazar solicitud
  app.post('/aprobaciones/:id/rechazar', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { comentarios } = body;

      const aprobacion = await prisma.project360Aprobacion.findFirst({
        where: { id, tenantId },
        include: { project: true }
      });
      if (!aprobacion) return reply.code(404).send({ error: 'Solicitud de aprobación no encontrada' });
      if (aprobacion.estado !== 'PENDIENTE') {
        return reply.code(400).send({ error: `La solicitud ya fue ${aprobacion.estado.toLowerCase()}` });
      }

      const userId = (req as any).db?.userId;

      // Actualizar aprobación
      const aprobacionActualizada = await prisma.project360Aprobacion.update({
        where: { id },
        data: { estado: 'RECHAZADO', aprobadoEn: new Date(), comentarios: comentarios || aprobacion.comentarios },
        include: { aprobador: { select: { id: true, firstName: true, lastName: true } } }
      });

      // Registrar en historial
      await logHistory(prisma, aprobacion.projectId, tenantId, 'ETAPA_RECHAZADA', `Etapa ${aprobacion.etapa} rechazada`, userId, null);

      // 🔔 Notificar al solicitante que fue rechazado
      if (aprobacion.solicitadoPorId) {
        try {
          await prisma.notification.create({
            data: {
              tenantId,
              userId: aprobacion.solicitadoPorId,
              type: 'APROBACION_PROYECTO',
              title: `❌ Etapa rechazada: ${aprobacion.project?.name || 'Proyecto'}`,
              message: `La etapa "${aprobacion.etapa}" fue rechazada. ${comentarios ? `Motivo: ${comentarios}` : ''}`,
              link: `/project360/${aprobacion.projectId}`,
              entityType: 'project360',
              entityId: aprobacion.projectId,
            }
          });

          // 📧 Enviar email al solicitante
          const solicitante = await prisma.platformUser.findUnique({
            where: { id: aprobacion.solicitadoPorId },
            select: { email: true, firstName: true }
          });

          if (solicitante?.email) {
            const emailPayload = notificationEmail({
              userEmail: solicitante.email,
              title: `❌ Etapa rechazada: ${aprobacion.project?.name || 'Proyecto'}`,
              message: `Hola ${solicitante.firstName || ''},<br><br>La etapa <strong>"${aprobacion.etapa}"</strong> del proyecto <strong>${aprobacion.project?.name || ''}</strong> fue <strong style="color: #dc2626;">RECHAZADA</strong>.<br><br>${comentarios ? `Motivo del rechazo: <em>${comentarios}</em><br><br>` : ''}Por favor revisá los comentarios y solicitá una nueva aprobación cuando esté listo.`,
              actionUrl: `${process.env.APP_URL || 'https://logismart.ar'}/project360/${aprobacion.projectId}`,
              type: 'error'
            });
            await sendEmail(emailPayload);
          }
        } catch (notifyErr) {
          console.error('[POST /rechazar] Error notificando al solicitante:', notifyErr);
        }
      }

      return reply.send({ aprobacion: aprobacionActualizada, mensaje: `Etapa ${aprobacion.etapa} rechazada` });
    } catch (err: any) {
      console.error('[POST /rechazar] Error:', err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // POST /project360/projects/:id/avanzar-etapa — avanzar a siguiente etapa (con validación)
  app.post('/projects/:id/avanzar-etapa', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { etapaDestino } = body;

      if (!etapaDestino || !ETAPAS_NEGOCIO.includes(etapaDestino)) {
        return reply.code(400).send({ error: 'Etapa destino inválida. Etapas: ' + ETAPAS_NEGOCIO.join(', ') });
      }

      const proyecto = await prisma.project360.findFirst({ where: { id, tenantId } });
      if (!proyecto) return reply.code(404).send({ error: 'Proyecto no encontrado' });

      const etapaActual = proyecto.etapaAprobacion || 'LICITACION_BORRADOR';
      const idxActual = ETAPAS_NEGOCIO.indexOf(etapaActual);
      const idxDestino = ETAPAS_NEGOCIO.indexOf(etapaDestino);

      if (idxDestino <= idxActual) {
        return reply.code(400).send({ error: `No se puede retroceder o mantener la misma etapa. Etapa actual: ${etapaActual}` });
      }

      // Verificar que todas las etapas intermedias estén aprobadas
      for (let i = idxActual; i < idxDestino; i++) {
        const etapaAValidar = ETAPAS_NEGOCIO[i];
        // La primera etapa (LICITACION_BORRADOR) no requiere aprobación previa
        if (etapaAValidar === 'LICITACION_BORRADOR') continue;

        const aprobacion = await prisma.project360Aprobacion.findFirst({
          where: { projectId: id, tenantId, etapa: etapaAValidar }
        });

        if (!aprobacion || aprobacion.estado !== 'APROBADO') {
          return reply.code(400).send({
            error: `No se puede avanzar. La etapa ${etapaAValidar} requiere aprobación.`,
            etapaBloqueante: etapaAValidar,
            estadoActual: aprobacion?.estado || 'NO_SOLICITADA'
          });
        }
      }

      const userId = (req as any).db?.userId;

      // Actualizar etapa del proyecto
      const proyectoActualizado = await prisma.project360.update({
        where: { id },
        data: { etapaAprobacion: etapaDestino }
      });

      // Registrar en historial
      await logHistory(prisma, id, tenantId, 'ETAPA_AVANZADA', `Proyecto avanzado de ${etapaActual} a ${etapaDestino}`, userId, null);

      return reply.send({
        proyecto: proyectoActualizado,
        mensaje: `Proyecto avanzado exitosamente a etapa: ${etapaDestino}`,
        etapaAnterior: etapaActual,
        etapaNueva: etapaDestino
      });
    } catch (err: any) {
      console.error('[POST /avanzar-etapa] Error:', err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT360 ENTERPRISE — FASE 1: BUSINESS CASE
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /project360/projects/:id/business-case
  app.get('/projects/:id/business-case', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };

      const bc = await prisma.project360BusinessCase.findUnique({ where: { projectId: id } });
      if (!bc) return reply.send({ businessCase: null });
      if (bc.tenantId !== tenantId) return reply.code(403).send({ error: 'No autorizado' });
      return reply.send({ businessCase: bc });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // POST/PUT /project360/projects/:id/business-case
  app.post('/projects/:id/business-case', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const userId = (req as any).db?.userId;

      const proyecto = await prisma.project360.findFirst({ where: { id, tenantId } });
      if (!proyecto) return reply.code(404).send({ error: 'Proyecto no encontrado' });

      // Extraer campos numéricos
      const {
        estimatedRevenue, directCosts, indirectCosts,
        minimumAcceptedMargin, currency,
        financialRisk, operationalRisk, commercialRisk, strategicRisk, successProbability,
        estimatedHours, estimatedKm, estimatedFuel, requiredVehicles, requiredEmployees, requiredSupervisors,
        clientStrategicLevel, businessScore, competitiveDifficulty, marketOpportunity,
        executiveSummary, recommendation,
        estimatedCashflow
      } = body;

      // Cálculos automáticos
      const revenue = Number(estimatedRevenue) || 0;
      const dCosts = Number(directCosts) || 0;
      const iCosts = Number(indirectCosts) || 0;
      const totalCosts = dCosts + iCosts;
      const grossMarginVal = revenue > 0 ? ((revenue - totalCosts) / revenue) * 100 : 0;
      const netMarginVal = revenue > 0 ? ((revenue - totalCosts - (iCosts * 0.3)) / revenue) * 100 : 0;
      const financialMarginVal = revenue > 0 ? ((revenue - totalCosts) / revenue) * 100 : 0;
      const roiVal = totalCosts > 0 ? ((revenue - totalCosts) / totalCosts) * 100 : 0;
      const payback = roiVal > 0 ? (totalCosts / (revenue / 12)) : null;

      // Scores individuales
      const finScore = Math.max(0, Math.min(100, grossMarginVal + (roiVal / 2)));
      const opScore = Math.max(0, Math.min(100, 100 - (Number(operationalRisk) || 0)));
      const comScore = Math.max(0, Math.min(100, (Number(marketOpportunity) || 50) - (Number(commercialRisk) || 0) / 2));
      const stratScore = Math.max(0, Math.min(100, (Number(clientStrategicLevel) === 3 ? 90 : Number(clientStrategicLevel) === 2 ? 60 : 30)));
      const riskScore = Math.max(0, Math.min(100,
        (Number(financialRisk) || 0) * 0.3 +
        (Number(operationalRisk) || 0) * 0.3 +
        (Number(commercialRisk) || 0) * 0.2 +
        (Number(strategicRisk) || 0) * 0.2
      ));
      const capacityScore = Math.max(0, Math.min(100, (Number(requiredEmployees) || 0) > 0 ? 70 : 50));
      const overallScore = (finScore + opScore + comScore + stratScore + (100 - riskScore) + capacityScore) / 6;

      // Semáforo
      const minMargin = Number(minimumAcceptedMargin) || 10;
      let viabilityStatus = 'AMARILLO';
      let recommendationAuto = 'REVISAR';
      if (grossMarginVal >= minMargin && riskScore < 50 && overallScore >= 70) {
        viabilityStatus = 'VERDE';
        recommendationAuto = 'RECOMENDABLE';
      } else if (grossMarginVal < minMargin || riskScore > 70 || overallScore < 40) {
        viabilityStatus = 'ROJO';
        recommendationAuto = 'NO_RECOMENDABLE';
      }
      if (riskScore > 60 && overallScore >= 50) {
        recommendationAuto = 'ALTO_RIESGO';
      }

      const data = {
        tenantId, projectId: id,
        estimatedRevenue: revenue || null,
        directCosts: dCosts || null,
        indirectCosts: iCosts || null,
        financialMargin: financialMarginVal || null,
        grossMargin: grossMarginVal || null,
        netMargin: netMarginVal || null,
        roi: roiVal || null,
        paybackMonths: payback || null,
        minimumAcceptedMargin: minMargin || null,
        currency: currency || 'ARS',
        estimatedCashflow: estimatedCashflow || null,
        financialRisk: financialRisk ? Number(financialRisk) : null,
        operationalRisk: operationalRisk ? Number(operationalRisk) : null,
        commercialRisk: commercialRisk ? Number(commercialRisk) : null,
        strategicRisk: strategicRisk ? Number(strategicRisk) : null,
        successProbability: successProbability ? Number(successProbability) : null,
        estimatedHours: estimatedHours ? Number(estimatedHours) : null,
        estimatedKm: estimatedKm ? Number(estimatedKm) : null,
        estimatedFuel: estimatedFuel ? Number(estimatedFuel) : null,
        requiredVehicles: requiredVehicles ? Number(requiredVehicles) : null,
        requiredEmployees: requiredEmployees ? Number(requiredEmployees) : null,
        requiredSupervisors: requiredSupervisors ? Number(requiredSupervisors) : null,
        clientStrategicLevel: clientStrategicLevel || null,
        businessScore: businessScore ? Number(businessScore) : null,
        competitiveDifficulty: competitiveDifficulty ? Number(competitiveDifficulty) : null,
        marketOpportunity: marketOpportunity ? Number(marketOpportunity) : null,
        viabilityStatus,
        executiveSummary: executiveSummary || null,
        recommendation: recommendation || recommendationAuto,
        financialScore: finScore,
        operationalScore: opScore,
        commercialScore: comScore,
        strategicScore: stratScore,
        contractualScore: null,
        riskScore,
        capacityScore,
        overallScore,
        createdById: userId || null,
        updatedById: userId || null,
      };

      const bc = await prisma.project360BusinessCase.upsert({
        where: { projectId: id },
        create: data as any,
        update: { ...data, updatedById: userId || null } as any,
      });

      await logHistory(prisma, id, tenantId, 'BUSINESS_CASE_UPDATED', `Business Case actualizado. Score: ${Math.round(overallScore)} | Viabilidad: ${viabilityStatus}`, userId, null);
      return reply.send({ businessCase: bc });
    } catch (err: any) {
      console.error('[POST /business-case] Error:', err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT360 ENTERPRISE — FASE 2: SIMULACIÓN FINANCIERA
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /project360/projects/:id/simulations
  app.get('/projects/:id/simulations', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const sims = await prisma.project360Simulation.findMany({
        where: { projectId: id, tenantId },
        orderBy: { createdAt: 'desc' }
      });
      return reply.send({ simulations: sims });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // POST /project360/projects/:id/simulations
  app.post('/projects/:id/simulations', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const userId = (req as any).db?.userId;

      // Buscar baseline
      const baseline = await prisma.project360Simulation.findFirst({
        where: { projectId: id, tenantId, isBaseline: true }
      });

      const {
        name, scenarioType, fuelPrice, exchangeRate, inflationRate, salaryIncrease,
        employeeCount, vehicleCount, indirectCosts: simIndirectCosts, financingRate,
        tripCount, operationalVolume
      } = body;

      // Obtener business case como base
      const bc = await prisma.project360BusinessCase.findUnique({ where: { projectId: id } });
      const baseRevenue = bc?.estimatedRevenue || 0;
      const baseDirectCosts = bc?.directCosts || 0;
      const baseIndirectCosts = bc?.indirectCosts || 0;

      // Cálculos de simulación
      const fuelMultiplier = fuelPrice ? fuelPrice / 1000 : 1; // normalizar
      const exchangeMultiplier = exchangeRate ? exchangeRate / 1000 : 1;
      const inflationMultiplier = inflationRate ? 1 + (inflationRate / 100) : 1;
      const salaryMultiplier = salaryIncrease ? 1 + (salaryIncrease / 100) : 1;

      const projectedCost = (baseDirectCosts * fuelMultiplier * exchangeMultiplier * inflationMultiplier * salaryMultiplier)
        + (baseIndirectCosts * (simIndirectCosts ? simIndirectCosts / baseIndirectCosts : 1))
        + ((employeeCount || 0) * 50000 * 12)
        + ((vehicleCount || 0) * 20000 * 12);

      const projectedRevenue = baseRevenue * (tripCount ? tripCount / 100 : 1) * (operationalVolume || 1);
      const projectedProfit = projectedRevenue - projectedCost;
      const projectedMargin = projectedRevenue > 0 ? (projectedProfit / projectedRevenue) * 100 : 0;
      const projectedRoi = projectedCost > 0 ? (projectedProfit / projectedCost) * 100 : 0;
      const projectedPayback = projectedRoi > 0 ? projectedCost / (projectedProfit / 12) : null;

      // Cashflow mensual simulado (12 meses)
      const monthlyRevenue = projectedRevenue / 12;
      const monthlyCost = projectedCost / 12;
      const projectedCashflow = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        revenue: monthlyRevenue,
        expenses: monthlyCost,
        accumulated: (monthlyRevenue - monthlyCost) * (i + 1)
      }));

      // Desviación vs baseline
      const baseMargin = baseline?.projectedMargin || bc?.grossMargin || 0;
      const baseRoi = baseline?.projectedRoi || bc?.roi || 0;
      const marginDeviation = projectedMargin - baseMargin;
      const roiDeviation = projectedRoi - baseRoi;

      // Nivel de riesgo
      let riskLevel = 'MEDIO';
      if (projectedMargin < 5 || projectedRoi < 0) riskLevel = 'CRITICO';
      else if (projectedMargin < 10 || projectedRoi < 10) riskLevel = 'ALTO';
      else if (projectedMargin > 20 && projectedRoi > 30) riskLevel = 'BAJO';

      const sim = await prisma.project360Simulation.create({
        data: {
          tenantId, projectId: id,
          name: name || `Simulación ${scenarioType || 'CUSTOM'}`,
          scenarioType: scenarioType || 'CUSTOM',
          fuelPrice: fuelPrice ? Number(fuelPrice) : null,
          exchangeRate: exchangeRate ? Number(exchangeRate) : null,
          inflationRate: inflationRate ? Number(inflationRate) : null,
          salaryIncrease: salaryIncrease ? Number(salaryIncrease) : null,
          employeeCount: employeeCount ? Number(employeeCount) : null,
          vehicleCount: vehicleCount ? Number(vehicleCount) : null,
          indirectCosts: simIndirectCosts ? Number(simIndirectCosts) : null,
          financingRate: financingRate ? Number(financingRate) : null,
          tripCount: tripCount ? Number(tripCount) : null,
          operationalVolume: operationalVolume ? Number(operationalVolume) : null,
          projectedMargin,
          projectedRoi,
          projectedCashflow,
          projectedProfit,
          projectedRevenue,
          projectedCost,
          projectedPayback,
          projectedBreakEven: projectedRoi > 0 ? projectedCost / (projectedProfit / 12) : null,
          marginDeviation,
          roiDeviation,
          riskLevel,
          isBaseline: body.isBaseline || false,
          notes: body.notes || null,
          createdById: userId || null,
        } as any
      });

      return reply.code(201).send({ simulation: sim });
    } catch (err: any) {
      console.error('[POST /simulations] Error:', err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT360 ENTERPRISE — FASE 6: CASHFLOW
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /project360/projects/:id/cashflow
  app.get('/projects/:id/cashflow', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const items = await prisma.project360Cashflow.findMany({
        where: { projectId: id, tenantId },
        orderBy: [{ year: 'asc' }, { month: 'asc' }]
      });
      return reply.send({ cashflows: items });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // POST /project360/projects/:id/cashflow
  app.post('/projects/:id/cashflow', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;

      const item = await prisma.project360Cashflow.create({
        data: {
          tenantId, projectId: id,
          month: Number(body.month),
          year: Number(body.year),
          periodLabel: body.periodLabel || `${body.month}/${body.year}`,
          projectedRevenue: body.projectedRevenue ? Number(body.projectedRevenue) : null,
          actualRevenue: body.actualRevenue ? Number(body.actualRevenue) : null,
          billingMilestone: body.billingMilestone || null,
          projectedExpenses: body.projectedExpenses ? Number(body.projectedExpenses) : null,
          actualExpenses: body.actualExpenses ? Number(body.actualExpenses) : null,
          tiedCapital: body.tiedCapital ? Number(body.tiedCapital) : null,
          notes: body.notes || null,
        } as any
      });
      return reply.code(201).send({ cashflow: item });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // PUT /project360/cashflow/:cashflowId
  app.put('/cashflow/:cashflowId', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { cashflowId } = req.params as { cashflowId: string };
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;

      const existing = await prisma.project360Cashflow.findFirst({ where: { id: cashflowId, tenantId } });
      if (!existing) return reply.code(404).send({ error: 'No encontrado' });

      const data: any = {};
      if (body.actualRevenue !== undefined) data.actualRevenue = Number(body.actualRevenue);
      if (body.actualExpenses !== undefined) data.actualExpenses = Number(body.actualExpenses);
      if (body.actualCollectionDate) data.actualCollectionDate = new Date(body.actualCollectionDate);
      if (body.actualPaymentDate) data.actualPaymentDate = new Date(body.actualPaymentDate);
      if (body.tiedCapital !== undefined) data.tiedCapital = Number(body.tiedCapital);
      if (body.notes) data.notes = body.notes;

      // Recalcular acumulados y desviaciones
      const projectedRevenue = data.actualRevenue !== undefined ? data.actualRevenue : existing.actualRevenue || existing.projectedRevenue || 0;
      const projectedExpenses = data.actualExpenses !== undefined ? data.actualExpenses : existing.actualExpenses || existing.projectedExpenses || 0;
      data.revenueDeviation = projectedRevenue - (existing.projectedRevenue || 0);
      data.expenseDeviation = projectedExpenses - (existing.projectedExpenses || 0);

      const updated = await prisma.project360Cashflow.update({
        where: { id: cashflowId },
        data
      });
      return reply.send({ cashflow: updated });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT360 ENTERPRISE — FASE 7: PIPELINE COMERCIAL
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /project360/projects/:id/pipeline
  app.get('/projects/:id/pipeline', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const stages = await prisma.project360Pipeline.findMany({
        where: { projectId: id, tenantId },
        orderBy: { stageOrder: 'asc' }
      });
      return reply.send({ pipeline: stages });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // POST /project360/projects/:id/pipeline
  app.post('/projects/:id/pipeline', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const userId = (req as any).db?.userId;

      const PIPELINE_STAGES = ['LEAD', 'OPORTUNIDAD', 'ANALISIS', 'VISITA_TECNICA', 'PROPUESTA', 'NEGOCIACION', 'ADJUDICADO', 'PERDIDO'];
      const stageIndex = PIPELINE_STAGES.indexOf(body.stage);

      const pipelineValue = body.pipelineValue ? Number(body.pipelineValue) : null;
      const probability = body.probability ? Number(body.probability) : null;
      const weightedValue = pipelineValue && probability ? pipelineValue * (probability / 100) : null;

      const stage = await prisma.project360Pipeline.create({
        data: {
          tenantId, projectId: id,
          stage: body.stage,
          stageOrder: stageIndex >= 0 ? stageIndex : 0,
          probability,
          expectedValue: body.expectedValue ? Number(body.expectedValue) : null,
          expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
          competitors: body.competitors || null,
          ourAdvantage: body.ourAdvantage || null,
          ourWeakness: body.ourWeakness || null,
          visitsCount: body.visitsCount ? Number(body.visitsCount) : 0,
          meetingsCount: body.meetingsCount ? Number(body.meetingsCount) : 0,
          lastContactDate: body.lastContactDate ? new Date(body.lastContactDate) : null,
          contactIds: body.contactIds || null,
          clientId: body.clientId || null,
          relatedMinutaIds: body.relatedMinutaIds || null,
          relatedEmailIds: body.relatedEmailIds || null,
          relatedQuoteIds: body.relatedQuoteIds || null,
          decisionReason: body.decisionReason || null,
          decisionDate: body.decisionDate ? new Date(body.decisionDate) : null,
          pipelineValue,
          weightedValue,
          notes: body.notes || null,
          createdById: userId || null,
        } as any
      });
      return reply.code(201).send({ pipeline: stage });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // PUT /project360/pipeline/:id
  // Actualizar etapa de pipeline con datos CRM
  app.put('/pipeline/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;

      const existing = await prisma.project360Pipeline.findFirst({ where: { id, tenantId } });
      if (!existing) return reply.code(404).send({ error: 'No encontrado' });

      const data: any = {};
      if (body.stage !== undefined) {
        data.stage = body.stage;
        const PIPELINE_STAGES = ['LEAD', 'OPORTUNIDAD', 'ANALISIS', 'VISITA_TECNICA', 'PROPUESTA', 'NEGOCIACION', 'ADJUDICADO', 'PERDIDO'];
        data.stageOrder = PIPELINE_STAGES.indexOf(body.stage);
      }
      if (body.probability !== undefined) data.probability = Number(body.probability);
      if (body.expectedValue !== undefined) data.expectedValue = Number(body.expectedValue);
      if (body.expectedCloseDate !== undefined) data.expectedCloseDate = body.expectedCloseDate ? new Date(body.expectedCloseDate) : null;
      if (body.competitors !== undefined) data.competitors = body.competitors;
      if (body.ourAdvantage !== undefined) data.ourAdvantage = body.ourAdvantage;
      if (body.ourWeakness !== undefined) data.ourWeakness = body.ourWeakness;
      if (body.visitsCount !== undefined) data.visitsCount = Number(body.visitsCount);
      if (body.meetingsCount !== undefined) data.meetingsCount = Number(body.meetingsCount);
      if (body.lastContactDate !== undefined) data.lastContactDate = body.lastContactDate ? new Date(body.lastContactDate) : null;
      if (body.contactIds !== undefined) data.contactIds = body.contactIds;
      if (body.clientId !== undefined) data.clientId = body.clientId;
      if (body.relatedMinutaIds !== undefined) data.relatedMinutaIds = body.relatedMinutaIds;
      if (body.relatedEmailIds !== undefined) data.relatedEmailIds = body.relatedEmailIds;
      if (body.relatedQuoteIds !== undefined) data.relatedQuoteIds = body.relatedQuoteIds;
      if (body.decisionReason !== undefined) data.decisionReason = body.decisionReason;
      if (body.decisionDate !== undefined) data.decisionDate = body.decisionDate ? new Date(body.decisionDate) : null;
      if (body.notes !== undefined) data.notes = body.notes;

      if (data.expectedValue && data.probability) {
        data.weightedValue = data.expectedValue * (data.probability / 100);
      }

      const updated = await prisma.project360Pipeline.update({
        where: { id },
        data
      });
      return reply.send({ pipeline: updated });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT360 ENTERPRISE — FASE 9: PROPUESTAS
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /project360/projects/:id/proposals
  app.get('/projects/:id/proposals', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const proposals = await prisma.project360Proposal.findMany({
        where: { projectId: id, tenantId },
        orderBy: { createdAt: 'desc' }
      });
      return reply.send({ proposals });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // POST /project360/projects/:id/proposals
  app.post('/projects/:id/proposals', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const userId = (req as any).db?.userId;

      const proposal = await prisma.project360Proposal.create({
        data: {
          tenantId, projectId: id,
          technicalProposal: body.technicalProposal || null,
          operationalScope: body.operationalScope || null,
          schedule: body.schedule || null,
          resourceMatrix: body.resourceMatrix || null,
          exclusions: body.exclusions || null,
          risks: body.risks || null,
          executiveSummary: body.executiveSummary || null,
          managementSummary: body.managementSummary || null,
          ganttData: body.ganttData || null,
          preliminaryBudget: body.preliminaryBudget || null,
          pliegoText: body.pliegoText || null,
          requirementsText: body.requirementsText || null,
          scopeText: body.scopeText || null,
          costsText: body.costsText || null,
          status: body.status || 'DRAFT',
          version: body.version || 1,
          createdById: userId || null,
        } as any
      });
      return reply.code(201).send({ proposal });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT360 ENTERPRISE — FASE 12: CONTRATOS
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /project360/projects/:id/contracts
  app.get('/projects/:id/contracts', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const contracts = await prisma.project360Contract.findMany({
        where: { projectId: id, tenantId },
        orderBy: { createdAt: 'desc' }
      });
      return reply.send({ contracts });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // PUT /project360/contracts/:id
  app.put('/contracts/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      
      const existing = await prisma.project360Contract.findFirst({ where: { id, tenantId } });
      if (!existing) return reply.code(404).send({ error: 'No encontrado' });
      
      const updated = await prisma.project360Contract.update({
        where: { id },
        data: {
          contractNumber: body.contractNumber !== undefined ? body.contractNumber : undefined,
          contractType: body.contractType !== undefined ? body.contractType : undefined,
          startDate: body.startDate !== undefined ? (body.startDate ? new Date(body.startDate) : null) : undefined,
          endDate: body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : undefined,
          totalValue: body.totalValue !== undefined ? Number(body.totalValue) : undefined,
          probability: body.probability !== undefined ? Number(body.probability) : undefined,
          status: body.status !== undefined ? body.status : undefined,
          notes: body.notes !== undefined ? body.notes : undefined,
        } as any
      });
      return reply.send({ contract: updated });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // DELETE /project360/contracts/:id
  app.delete('/contracts/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      await prisma.project360Contract.deleteMany({ where: { id, tenantId } });
      return reply.send({ deleted: true });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // POST /project360/projects/:id/contracts
  app.post('/projects/:id/contracts', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const userId = (req as any).db?.userId;

      const contract = await prisma.project360Contract.create({
        data: {
          tenantId, projectId: id,
          contractNumber: body.contractNumber || null,
          contractType: body.contractType || null,
          startDate: body.startDate ? new Date(body.startDate) : null,
          endDate: body.endDate ? new Date(body.endDate) : null,
          renewalDate: body.renewalDate ? new Date(body.renewalDate) : null,
          durationMonths: body.durationMonths ? Number(body.durationMonths) : null,
          slaDescription: body.slaDescription || null,
          slaMetrics: body.slaMetrics || null,
          penaltyClauses: body.penaltyClauses || null,
          penaltyAmount: body.penaltyAmount ? Number(body.penaltyAmount) : null,
          guarantees: body.guarantees || null,
          insurances: body.insurances || null,
          expirationAlertDays: body.expirationAlertDays ? Number(body.expirationAlertDays) : 30,
          criticalClauses: body.criticalClauses || null,
          iaRiskAlert: body.iaRiskAlert || null,
          contractDocumentUrl: body.contractDocumentUrl || null,
          amendments: body.amendments || null,
          notes: body.notes || null,
          createdById: userId || null,
        } as any
      });
      return reply.code(201).send({ contract });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // GET /project360/contracts/:id/alerts
  // Alertas dinámicas de vencimiento, SLA, garantías, seguros
  app.get('/contracts/:id/alerts', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };

      const contract = await prisma.project360Contract.findFirst({
        where: { id, tenantId }
      }) as any;
      if (!contract) return reply.code(404).send({ error: 'No encontrado' });

      const alerts: Array<{type: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; message: string; daysUntil?: number}> = [];
      const now = new Date();

      // 1. Alerta de vencimiento
      if (contract.endDate) {
        const end = new Date(contract.endDate);
        const diffMs = end.getTime() - now.getTime();
        const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const alertDays = contract.expirationAlertDays || 30;

        if (daysUntil < 0) {
          alerts.push({ type: 'VENCIMIENTO', severity: 'CRITICAL', message: `Contrato vencido hace ${Math.abs(daysUntil)} días`, daysUntil });
        } else if (daysUntil <= alertDays) {
          alerts.push({ type: 'VENCIMIENTO', severity: daysUntil <= 7 ? 'CRITICAL' : 'HIGH', message: `Contrato vence en ${daysUntil} días`, daysUntil });
        }
      }

      // 2. Alerta de renovación
      if (contract.renewalDate) {
        const renewal = new Date(contract.renewalDate);
        const diffMs = renewal.getTime() - now.getTime();
        const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (daysUntil <= 14 && daysUntil >= 0) {
          alerts.push({ type: 'RENOVACION', severity: 'HIGH', message: `Renovación en ${daysUntil} días`, daysUntil });
        }
      }

      // 3. Alertas de garantías próximas a vencer
      if (contract.guarantees && Array.isArray(contract.guarantees)) {
        contract.guarantees.forEach((g: any) => {
          if (g.expiration) {
            const exp = new Date(g.expiration);
            const daysUntil = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntil <= 30 && daysUntil >= 0) {
              alerts.push({ type: 'GARANTIA', severity: daysUntil <= 7 ? 'CRITICAL' : 'HIGH', message: `Garantía "${g.type || ''}" vence en ${daysUntil} días`, daysUntil });
            } else if (daysUntil < 0) {
              alerts.push({ type: 'GARANTIA', severity: 'CRITICAL', message: `Garantía "${g.type || ''}" vencida hace ${Math.abs(daysUntil)} días`, daysUntil });
            }
          }
        });
      }

      // 4. Alertas de seguros próximos a vencer
      if (contract.insurances && Array.isArray(contract.insurances)) {
        contract.insurances.forEach((i: any) => {
          if (i.expiration) {
            const exp = new Date(i.expiration);
            const daysUntil = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntil <= 30 && daysUntil >= 0) {
              alerts.push({ type: 'SEGURO', severity: daysUntil <= 7 ? 'CRITICAL' : 'HIGH', message: `Seguro "${i.type || ''}" vence en ${daysUntil} días`, daysUntil });
            } else if (daysUntil < 0) {
              alerts.push({ type: 'SEGURO', severity: 'CRITICAL', message: `Seguro "${i.type || ''}" vencido hace ${Math.abs(daysUntil)} días`, daysUntil });
            }
          }
        });
      }

      // 5. Alerta IA de cláusulas críticas
      if (contract.iaRiskAlert) {
        alerts.push({ type: 'IA_RIESGO', severity: 'HIGH', message: contract.iaRiskAlert });
      }

      // 6. Alerta de multas acumuladas
      if (contract.totalFines && contract.totalFines > 0) {
        alerts.push({ type: 'MULTA', severity: 'MEDIUM', message: `Multas acumuladas: $${contract.totalFines.toLocaleString('es-AR')}` });
      }

      // 7. Alerta SLA no definido
      if (!contract.slaDescription && !contract.slaMetrics) {
        alerts.push({ type: 'SLA', severity: 'MEDIUM', message: 'No se ha definido SLA para este contrato' });
      }

      // 8. Alerta de penalidades no definidas
      if (!contract.penaltyClauses && !contract.penaltyAmount) {
        alerts.push({ type: 'PENALIDAD', severity: 'LOW', message: 'No se han definido cláusulas de penalidad' });
      }

      return reply.send({
        contractId: id,
        alerts,
        alertCount: alerts.length,
        criticalCount: alerts.filter((a: any) => a.severity === 'CRITICAL').length,
        highCount: alerts.filter((a: any) => a.severity === 'HIGH').length,
        generatedAt: now.toISOString()
      });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT360 ENTERPRISE — FASE 13: LESSONS LEARNED
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /project360/projects/:id/lessons-learned
  app.get('/projects/:id/lessons-learned', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const lessons = await prisma.project360LessonLearned.findMany({
        where: { projectId: id, tenantId },
        orderBy: { createdAt: 'desc' }
      });
      return reply.send({ lessonsLearned: lessons });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // POST /project360/projects/:id/lessons-learned
  app.post('/projects/:id/lessons-learned', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const userId = (req as any).db?.userId;

      const lesson = await prisma.project360LessonLearned.create({
        data: {
          tenantId, projectId: id,
          category: body.category || 'RECOMENDACION',
          title: body.title,
          description: body.description,
          impact: body.impact || null,
          solution: body.solution || null,
          recommendations: body.recommendations || null,
          plannedCost: body.plannedCost ? Number(body.plannedCost) : null,
          actualCost: body.actualCost ? Number(body.actualCost) : null,
          plannedTime: body.plannedTime ? Number(body.plannedTime) : null,
          actualTime: body.actualTime ? Number(body.actualTime) : null,
          costDeviation: body.actualCost && body.plannedCost ? Number(body.actualCost) - Number(body.plannedCost) : null,
          timeDeviation: body.actualTime && body.plannedTime ? Number(body.actualTime) - Number(body.plannedTime) : null,
          tags: body.tags || [],
          similarProjects: body.similarProjects || null,
          iaSummary: body.iaSummary || null,
          reusable: body.reusable || false,
          createdById: userId || null,
        } as any
      });
      return reply.code(201).send({ lessonLearned: lesson });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT360 ENTERPRISE — FASE 4: DIMENSIONAMIENTO OPERATIVO
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /project360/projects/:id/operational-sizing
  app.get('/projects/:id/operational-sizing', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const sizing = await prisma.project360OperationalSizing.findFirst({
        where: { projectId: id, tenantId },
        orderBy: { createdAt: 'desc' }
      });
      return reply.send({ operationalSizing: sizing });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // POST /project360/projects/:id/operational-sizing
  app.post('/projects/:id/operational-sizing', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const userId = (req as any).db?.userId;

      const {
        km, trips, pallets, tons, frequency, slaHours, shifts,
        operatingHours, units, operationType, minStaff, geographicCoverage
      } = body;

      // Cálculos automáticos de dimensionamiento
      const kmVal = Number(km) || 0;
      const tripsVal = Number(trips) || 0;
      const tonsVal = Number(tons) || 0;
      const shiftsVal = Number(shifts) || 1;
      const slaVal = Number(slaHours) || 8;
      const minStaffVal = Number(minStaff) || 0;

      // Fórmulas de dimensionamiento
      const driversNeeded = Math.ceil((tripsVal * shiftsVal) / (slaVal / 8));
      const trucksNeeded = Math.ceil(tripsVal / (shiftsVal * 2)); // 2 viajes por camión por turno
      const supervisorsNeeded = Math.ceil(driversNeeded / 10);
      const administrativeNeeded = Math.ceil(driversNeeded / 15);
      const fuelNeeded = kmVal * 0.35; // 0.35 litros por km (promedio)
      const manHoursNeeded = tripsVal * slaVal;
      const utilizationRate = trucksNeeded > 0 ? (tripsVal / (trucksNeeded * shiftsVal * 2)) * 100 : 0;
      const availabilityRequired = 95; // estándar
      const operationalCapacity = trucksNeeded * tonsVal * tripsVal;

      // Consultar flota (simulado — en producción consultaría tabla de vehículos)
      const fleetAlert = trucksNeeded > 5 ? 'Verificar disponibilidad de unidades en Flota360' : null;

      const sizing = await prisma.project360OperationalSizing.create({
        data: {
          tenantId, projectId: id,
          km: kmVal || null,
          trips: tripsVal || null,
          pallets: pallets ? Number(pallets) : null,
          tons: tonsVal || null,
          frequency: frequency || null,
          slaHours: slaVal || null,
          shifts: shiftsVal || null,
          operatingHours: operatingHours || null,
          units: units || null,
          operationType: operationType || null,
          minStaff: minStaffVal || null,
          geographicCoverage: geographicCoverage || null,
          driversNeeded: driversNeeded || null,
          trucksNeeded: trucksNeeded || null,
          supervisorsNeeded: supervisorsNeeded || null,
          administrativeNeeded: administrativeNeeded || null,
          fuelNeeded: fuelNeeded || null,
          manHoursNeeded: manHoursNeeded || null,
          utilizationRate: utilizationRate || null,
          availabilityRequired: availabilityRequired || null,
          operationalCapacity: operationalCapacity || null,
          fleetAlert: fleetAlert || null,
          createdById: userId || null,
        } as any
      });
      return reply.code(201).send({ operationalSizing: sizing });
    } catch (err: any) {
      console.error('[POST /operational-sizing] Error:', err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT360 ENTERPRISE — PMO DASHBOARD (Fase 5)
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /project360/pmo-dashboard
  app.get('/pmo-dashboard', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const projects = await prisma.project360.findMany({
        where: { tenantId, deletedAt: null },
        include: {
          businessCase: true,
          pipelineStages: { orderBy: { stageOrder: 'desc' }, take: 1 },
          aprobaciones: { where: { estado: 'APROBADO' } },
          budgetItems: true,
        }
      });

      const totalProjects = projects.length;
      const activeProjects = projects.filter(p => p.status === 'IN_PROGRESS').length;
      const completedProjects = projects.filter(p => p.status === 'COMPLETED').length;
      const criticalProjects = projects.filter(p => p.priority === 'CRITICAL').length;

      // Revenue proyectado
      const projectedRevenue = projects.reduce((sum, p) => sum + (p.businessCase?.estimatedRevenue || 0), 0);
      const projectedCosts = projects.reduce((sum, p) => sum + (p.businessCase?.directCosts || 0) + (p.businessCase?.indirectCosts || 0), 0);

      // Margen promedio
      const margins = projects.map(p => p.businessCase?.grossMargin || 0).filter(m => m !== 0);
      const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;

      // ROI promedio
      const rois = projects.map(p => p.businessCase?.roi || 0).filter(r => r !== 0);
      const avgRoi = rois.length > 0 ? rois.reduce((a, b) => a + b, 0) / rois.length : 0;

      // Pipeline value
      const pipelineValue = projects.reduce((sum, p) => sum + (p.pipelineStages[0]?.pipelineValue || 0), 0);
      const weightedPipeline = projects.reduce((sum, p) => sum + (p.pipelineStages[0]?.weightedValue || 0), 0);

      // Adjudicaciones
      const adjudicados = projects.filter(p => p.etapaAprobacion === 'ADJUDICADO').length;
      const enEjecucion = projects.filter(p => p.etapaAprobacion === 'EN_EJECUCION').length;

      // Proyectos en riesgo (score < 50 o viabilidad ROJO)
      const enRiesgo = projects.filter(p =>
        (p.businessCase?.viabilityStatus === 'ROJO') ||
        (p.overallRiskScore && p.overallRiskScore > 70)
      ).length;

      // Ranking por rentabilidad
      const ranking = projects
        .filter(p => p.businessCase)
        .sort((a, b) => (b.businessCase!.grossMargin || 0) - (a.businessCase!.grossMargin || 0))
        .slice(0, 10)
        .map(p => ({
          id: p.id,
          name: p.name,
          code: p.code,
          margin: p.businessCase?.grossMargin || 0,
          roi: p.businessCase?.roi || 0,
          viabilityStatus: p.businessCase?.viabilityStatus || 'AMARILLO',
          etapa: p.etapaAprobacion || 'LICITACION_BORRADOR'
        }));

      return reply.send({
        kpi: {
          totalProjects,
          activeProjects,
          completedProjects,
          criticalProjects,
          projectedRevenue,
          projectedCosts,
          avgMargin: Math.round(avgMargin * 100) / 100,
          avgRoi: Math.round(avgRoi * 100) / 100,
          pipelineValue,
          weightedPipeline,
          adjudicados,
          enEjecucion,
          enRiesgo,
        },
        ranking,
        projects: projects.map(p => ({
          id: p.id,
          name: p.name,
          code: p.code,
          status: p.status,
          etapa: p.etapaAprobacion,
          margin: p.businessCase?.grossMargin || 0,
          roi: p.businessCase?.roi || 0,
          viabilityStatus: p.businessCase?.viabilityStatus || 'AMARILLO',
          riskScore: p.overallRiskScore || 0,
          probabilityOfWinning: p.probabilityOfWinning || 0,
        }))
      });
    } catch (err: any) {
      console.error('[GET /pmo-dashboard] Error:', err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT360 ENTERPRISE — IA PREDICTIVA (Fase 3)
  // ═══════════════════════════════════════════════════════════════════════════

  // POST /project360/projects/:id/ia-predictiva
  app.post('/projects/:id/ia-predictiva', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const userId = (req as any).db?.userId;

      const project = await prisma.project360.findFirst({
        where: { id, tenantId },
        include: {
          businessCase: true,
          budgetItems: true,
          aiAnalyses: { orderBy: { createdAt: 'desc' }, take: 1 },
          aprobaciones: true,
        }
      });
      if (!project) return reply.code(404).send({ error: 'Proyecto no encontrado' });

      // Obtener config LLM
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { llmProvider: true, llmApiKey: true, llmModel: true, llmBaseUrl: true }
      });

      let llm;
      try {
        llm = createGroqOnlyLLMProvider(tenant, prisma, tenantId, userId || null, 'project360-predictive-ia');
      } catch (err: any) {
        return reply.code(500).send({ error: 'Error configurando proveedor IA: ' + err.message });
      }

      const budgetTotal = project.budgetItems.reduce((s: number, b: any) => s + (b.estimated || 0), 0);
      const actualTotal = project.budgetItems.reduce((s: number, b: any) => s + (b.actual || 0), 0);

      const prompt = `Analizá el siguiente proyecto de licitación/operación y respondé ÚNICAMENTE en formato JSON con esta estructura exacta:
{
  "probabilityOfWinning": 0-100,
  "probabilityOfDelay": 0-100,
  "probabilityOfCostDeviation": 0-100,
  "probabilityOfOperationalFailure": 0-100,
  "projectComplexityScore": 0-100,
  "clientRiskScore": 0-100,
  "supplierRiskScore": 0-100,
  "timelineConfidenceScore": 0-100,
  "overallRiskScore": 0-100,
  "viabilityScore": 0-100,
  "financialScore": 0-100,
  "operationalScore": 0-100,
  "strategicScore": 0-100,
  "commercialScore": 0-100,
  "contractualScore": 0-100,
  "summary": "resumen ejecutivo de riesgos y oportunidades...",
  "recommendations": ["recomendación 1", "recomendación 2", ...],
  "alerts": ["alerta 1", "alerta 2", ...],
  "riskAreas": ["área de riesgo 1", "área de riesgo 2", ...]
}

DATOS DEL PROYECTO:
- Nombre: ${project.name}
- Código: ${project.code}
- Etapa: ${project.etapaAprobacion || 'LICITACION_BORRADOR'}
- Presupuesto: ${project.budget || 0} ${project.budgetCurrency || 'ARS'}
- Costo real acumulado: ${actualTotal}
- Ítems presupuestados: ${project.budgetItems.length}
- Business Case score: ${project.businessCase?.overallScore || 'N/A'}
- Margen bruto: ${project.businessCase?.grossMargin || 'N/A'}%
- ROI: ${project.businessCase?.roi || 'N/A'}%
- Riesgo financiero: ${project.businessCase?.financialRisk || 'N/A'}
- Riesgo operativo: ${project.businessCase?.operationalRisk || 'N/A'}
- Riesgo comercial: ${project.businessCase?.commercialRisk || 'N/A'}
- Riesgo estratégico: ${project.businessCase?.strategicRisk || 'N/A'}

ANÁLISIS IA PREVIO:
${project.aiAnalyses[0]?.summary || 'Sin análisis previo'}

REQUERIMIENTOS PREVIOS:
${JSON.stringify(project.aiAnalyses[0]?.requirements || []).slice(0, 2000)}

RIESGOS PREVIOS:
${JSON.stringify(project.aiAnalyses[0]?.risks || []).slice(0, 2000)}`;

      const response = await llm.chat([{ role: 'user', content: prompt }], 3000);
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      let parsed: any = {};
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch { /* noop */ }
      }

      // Guardar resultados en el proyecto
      await prisma.project360.update({
        where: { id },
        data: {
          probabilityOfWinning: parsed.probabilityOfWinning || null,
          probabilityOfDelay: parsed.probabilityOfDelay || null,
          probabilityOfCostDeviation: parsed.probabilityOfCostDeviation || null,
          probabilityOfOperationalFailure: parsed.probabilityOfOperationalFailure || null,
          projectComplexityScore: parsed.projectComplexityScore || null,
          clientRiskScore: parsed.clientRiskScore || null,
          supplierRiskScore: parsed.supplierRiskScore || null,
          timelineConfidenceScore: parsed.timelineConfidenceScore || null,
          overallRiskScore: parsed.overallRiskScore || null,
          viabilityScore: parsed.viabilityScore || null,
          financialScore: parsed.financialScore || null,
          operationalScore: parsed.operationalScore || null,
          strategicScore: parsed.strategicScore || null,
          commercialScore: parsed.commercialScore || null,
          contractualScore: parsed.contractualScore || null,
          iaPredictiveSummary: parsed.summary || response.text.slice(0, 1000),
          iaRecommendations: parsed.recommendations || parsed.alerts || [],
          iaLastAnalyzedAt: new Date(),
        }
      });

      return reply.send({
        iaAnalysis: parsed,
        summary: parsed.summary || response.text.slice(0, 500),
        recommendations: parsed.recommendations || [],
        alerts: parsed.alerts || []
      });
    } catch (err: any) {
      console.error('[POST /ia-predictiva] Error:', err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT360 ENTERPRISE — EXPORTACIONES
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /project360/proposals/:id/export?format=pdf|word|excel|ppt
  app.get('/proposals/:id/export', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };
      const format = (req.query as any)?.format || 'pdf';

      const proposal = await prisma.project360Proposal.findFirst({
        where: { id, tenantId },
        include: { project: true }
      }) as any;
      
      if (!proposal) return reply.code(404).send({ error: 'Propuesta no encontrada' });

      const project = proposal.project;

      // Generar contenido HTML para exportación
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${proposal.title || 'Propuesta Técnica'} - ${project?.name || 'Proyecto'}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #1e40af; margin: 0; font-size: 28px; }
    .header .subtitle { color: #6b7280; font-size: 14px; margin-top: 8px; }
    .section { margin-bottom: 25px; }
    .section h2 { color: #1e40af; border-left: 4px solid #2563eb; padding-left: 12px; font-size: 18px; margin-bottom: 12px; }
    .section p { margin: 0; color: #4b5563; text-align: justify; }
    .meta { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .meta-item { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .meta-item:last-child { margin-bottom: 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-green { background: #d1fae5; color: #065f46; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
    th { background: #f9fafb; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${proposal.title || 'Propuesta Técnica'}</h1>
    <div class="subtitle">Proyecto: ${project?.name || 'N/A'} | Código: ${project?.code || 'N/A'}</div>
    <div class="subtitle">Generada: ${proposal.generatedAt ? new Date(proposal.generatedAt).toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR')}</div>
  </div>

  <div class="meta">
    <div class="meta-item"><span>Estado:</span> <span class="badge badge-blue">${proposal.status || 'BORRADOR'}</span></div>
    <div class="meta-item"><span>Versión:</span> <span>${proposal.version || 1}</span></div>
    <div class="meta-item"><span>Costo Estimado:</span> <span>${proposal.costEstimate ? proposal.costEstimate.toLocaleString('es-AR') : 'N/A'} ARS</span></div>
    <div class="meta-item"><span>Margen Estimado:</span> <span>${proposal.marginEstimate ? proposal.marginEstimate + '%' : 'N/A'}</span></div>
  </div>

  ${proposal.executiveSummary ? `
  <div class="section">
    <h2>Resumen Ejecutivo</h2>
    <p>${proposal.executiveSummary}</p>
  </div>` : ''}

  ${proposal.technicalProposal ? `
  <div class="section">
    <h2>Propuesta Técnica</h2>
    <p>${proposal.technicalProposal}</p>
  </div>` : ''}

  ${proposal.operationalScope ? `
  <div class="section">
    <h2>Alcance Operativo</h2>
    <p>${proposal.operationalScope}</p>
  </div>` : ''}

  ${proposal.schedule ? `
  <div class="section">
    <h2>Cronograma</h2>
    <p>${proposal.schedule}</p>
  </div>` : ''}

  ${proposal.risks ? `
  <div class="section">
    <h2>Análisis de Riesgos</h2>
    <p>${proposal.risks}</p>
  </div>` : ''}

  ${proposal.exclusions ? `
  <div class="section">
    <h2>Exclusiones</h2>
    <p>${proposal.exclusions}</p>
  </div>` : ''}

  <div class="footer">
    <p>Generado por SGI360 - Project360 Enterprise</p>
    <p>© ${new Date().getFullYear()} - Propuesta confidencial</p>
  </div>
</body>
</html>`;

      // Por ahora retornamos el HTML + una URL simulada de descarga
      // En producción se usaría puppeteer para PDF o librerías específicas para cada formato
      const filename = `propuesta-${proposal.id.slice(0, 8)}.${format === 'pdf' ? 'pdf' : format === 'word' ? 'docx' : format === 'excel' ? 'xlsx' : 'pptx'}`;
      
      return reply.send({
        downloadUrl: `/api/project360/proposals/${id}/export-download?format=${format}`,
        filename,
        format,
        htmlContent: format === 'pdf' || format === 'word' ? htmlContent : null,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('[GET /proposals/:id/export] Error:', err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT360 ENTERPRISE — FASE 8: MOTOR RELACIONAL
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /project360/projects/:id/relational-check
  // Detecta automáticamente faltantes de recursos, incompatibilidades, riesgos
  app.get('/projects/:id/relational-check', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = req.params as { id: string };

      // Cargar proyecto con todas sus relaciones
      const project = await prisma.project360.findUnique({
        where: { id },
        include: {
          operationalSizings: { orderBy: { createdAt: 'desc' }, take: 1 },
          businessCase: true,
          simulations: { orderBy: { createdAt: 'desc' }, take: 1 },
          tasks: { include: { assignee: true } },
          budgetItems: true,
          contracts: true,
        }
      }) as any;

      if (!project) return reply.code(404).send({ error: 'Proyecto no encontrado' });

      const alerts: Array<{type: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; message: string; details: any; action: string}> = [];
      const recommendations: string[] = [];
      const missingResources: any[] = [];
      const incompatibilities: any[] = [];
      const capacityGaps: any[] = [];

      // 1. Verificar dimensionamiento operativo vs recursos disponibles
      const sizing = project.operationalSizings?.[0];
      if (sizing) {
        // Simular consulta a Flota360 (en producción sería una llamada real al módulo)
        // Por ahora detectamos basado en el sizing
        if (sizing.trucksNeeded && sizing.trucksNeeded > 5) {
          alerts.push({
            type: 'FLOTA',
            severity: 'HIGH',
            message: `Se requieren ${sizing.trucksNeeded} camiones - Verificar disponibilidad en Flota360`,
            details: { required: sizing.trucksNeeded, available: null, gap: null },
            action: 'Consultar disponibilidad de vehículos'
          });
        }
        if (sizing.driversNeeded && sizing.driversNeeded > 3) {
          alerts.push({
            type: 'RRHH',
            severity: 'MEDIUM',
            message: `Se requieren ${sizing.driversNeeded} choferes habilitados`,
            details: { required: sizing.driversNeeded, competencyRequired: 'Licencia de conducir clase F' },
            action: 'Verificar disponibilidad de choferes en RRHH'
          });
        }
        if (sizing.supervisorsNeeded && sizing.supervisorsNeeded > 0) {
          alerts.push({
            type: 'RRHH',
            severity: 'LOW',
            message: `Se requieren ${sizing.supervisorsNeeded} supervisores operativos`,
            details: { required: sizing.supervisorsNeeded },
            action: 'Asignar supervisores con experiencia en operaciones similares'
          });
        }
      } else {
        alerts.push({
          type: 'DIMENSIONAMIENTO',
          severity: 'HIGH',
          message: 'No existe dimensionamiento operativo para este proyecto',
          details: null,
          action: 'Completar el dimensionamiento operativo'
        });
      }

      // 2. Verificar Business Case
      if (!project.businessCase) {
        alerts.push({
          type: 'VIABILIDAD',
          severity: 'HIGH',
          message: 'No existe Business Case - No se ha validado la viabilidad del proyecto',
          details: null,
          action: 'Completar el Business Case antes de avanzar'
        });
      } else {
        const bc = project.businessCase;
        if (bc.grossMargin !== null && bc.grossMargin < 10) {
          alerts.push({
            type: 'FINANCIERO',
            severity: 'HIGH',
            message: `Margen bruto muy bajo: ${bc.grossMargin}% - Mínimo recomendado: 15%`,
            details: { current: bc.grossMargin, recommended: 15, gap: 15 - bc.grossMargin },
            action: 'Revisar precios o reducir costos operativos'
          });
        }
        if (bc.roi !== null && bc.roi < 20) {
          alerts.push({
            type: 'FINANCIERO',
            severity: 'MEDIUM',
            message: `ROI bajo: ${bc.roi}% - ROI objetivo mínimo: 25%`,
            details: { current: bc.roi, target: 25 },
            action: 'Considerar renegociación de términos o descartar proyecto'
          });
        }
      }

      // 3. Verificar presupuesto
      const totalBudget = project.budget || 0;
      const totalCost = project.budgetItems?.reduce((sum: number, item: any) => sum + (item.costoTotal || 0), 0) || 0;
      if (totalCost > totalBudget * 0.9) {
        alerts.push({
          type: 'PRESUPUESTO',
          severity: 'HIGH',
          message: `Costos estimados (${totalCost.toLocaleString()}) consumen >90% del presupuesto (${totalBudget.toLocaleString()})`,
          details: { budget: totalBudget, estimated: totalCost, variance: totalCost - totalBudget },
          action: 'Revisar presupuesto o buscar reducción de costos'
        });
      }

      // 4. Verificar contratos y riesgos legales
      if (project.contracts?.length === 0 && project.etapaAprobacion === 'ADJUDICADO') {
        alerts.push({
          type: 'LEGAL',
          severity: 'HIGH',
          message: 'Proyecto adjudicado sin contrato firmado',
          details: null,
          action: 'Urgente: Formalizar contrato con cliente'
        });
      }

      // 5. Verificar tareas asignadas
      const unassignedTasks = project.tasks?.filter((t: any) => !t.assignee && t.status !== 'COMPLETED');
      if (unassignedTasks?.length > 0) {
        alerts.push({
          type: 'ASIGNACION',
          severity: 'MEDIUM',
          message: `${unassignedTasks.length} tareas pendientes sin asignar`,
          details: { count: unassignedTasks.length, tasks: unassignedTasks.map((t: any) => t.title) },
          action: 'Asignar responsables a las tareas pendientes'
        });
      }

      // 6. Verificar simulación financiera reciente
      if (!project.simulations?.length) {
        alerts.push({
          type: 'SIMULACION',
          severity: 'MEDIUM',
          message: 'No se han realizado simulaciones financieras',
          details: null,
          action: 'Ejecutar simulación de escenarios (optimista/probable/pesimista)'
        });
      }

      // Generar recomendaciones basadas en alertas
      if (alerts.filter((a: any) => a.severity === 'HIGH').length > 0) {
        recommendations.push('Resolver alertas de alta prioridad antes de avanzar la etapa del proyecto');
      }
      if (alerts.some((a: any) => a.type === 'RRHH')) {
        recommendations.push('Coordinar con RRHH para reserva de personal con anticipación');
      }
      if (alerts.some((a: any) => a.type === 'FLOTA')) {
        recommendations.push('Verificar disponibilidad de vehículos en Flota360 y programar mantenimientos preventivos');
      }
      if (!recommendations.length) {
        recommendations.push('Proyecto listo para avanzar - No se detectaron bloqueos significativos');
      }

      return reply.send({
        projectId: id,
        checkedAt: new Date().toISOString(),
        summary: {
          totalAlerts: alerts.length,
          highSeverity: alerts.filter((a: any) => a.severity === 'HIGH').length,
          mediumSeverity: alerts.filter((a: any) => a.severity === 'MEDIUM').length,
          lowSeverity: alerts.filter((a: any) => a.severity === 'LOW').length,
          canProceed: !alerts.some((a: any) => a.severity === 'HIGH'),
        },
        alerts,
        missingResources,
        incompatibilities,
        capacityGaps,
        recommendations,
        relatedModules: ['RRHH', 'Flota360', 'Presupuesto', 'Contratos', 'Compliance']
      });
    } catch (err: any) {
      console.error('[GET /relational-check] Error:', err);
      return reply.code(500).send({ error: err.message });
    }
  });
}
