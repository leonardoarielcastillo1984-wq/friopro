import { isSuperAdmin, getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createLoggingLLMProvider } from '../services/llm/factory.js';

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
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

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

    await logHistory(prisma, project.id, tenantId, 'CREATED', `Proyecto "${project.name}" creado`, req.db.userId, req.db.userName);
    return reply.code(201).send({ project });
  });

  // GET /project360/:id — alias sin /projects/ para compatibilidad
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    if (['projects', 'stats', 'notifications', 'tasks', 'attachments', 'reminders'].includes(id)) {
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
    const llm = createLoggingLLMProvider(tenant, prisma, tenantId, req.db.userId || null, 'project360-ai-analysis');

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
    "clarity": 0,
    "feasibility": 0,
    "profitability": 0,
    "riskLevel": 0
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
          costs: parsed.costs || null,
          scores: parsed.scores || null,
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
    const llm = createLoggingLLMProvider(tenant, prisma, tenantId, req.db.userId || null, 'project360-ai-comparison');

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

  // GET /project360/notifications (stub — usa sistema global)
  app.get('/notifications', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ notifications: [] });
  });
}
