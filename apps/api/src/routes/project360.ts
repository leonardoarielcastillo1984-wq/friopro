import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

// In-memory storage for projects (temporary until database model is created)
const projectsStore: any[] = [];

// In-memory storage for task comments
const taskCommentsStore: any[] = [];

// In-memory storage for activity history
const activityHistoryStore: any[] = [];

// In-memory storage for attachments
const attachmentsStore: any[] = [];

// In-memory storage for notifications
const notificationsStore: any[] = [];

// In-memory storage for reminders
const remindersStore: any[] = [];

// Helper function to log activity
function logActivity(projectId: string, action: string, details: string, userId: string = 'system') {
  const entry = {
    id: `hist-${Date.now()}`,
    projectId,
    action,
    details,
    userId,
    userName: 'Usuario', // En producción vendría del perfil
    createdAt: new Date().toISOString()
  };
  activityHistoryStore.push(entry);
  return entry;
}

// Schema de validación simplificado
const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  origin: z.enum(['AUDIT_FINDING', 'NON_CONFORMITY', 'INCIDENT', 'DRILL_DEVIATION', 'MAINTENANCE_ISSUE', 'RISK_DETECTED', 'MANAGEMENT_OBJECTIVE', 'MANUAL']),
  originModule: z.string().default('PROJECT360'),
  originEntityId: z.string().optional(),
  responsibleId: z.string(),
  targetDate: z.string().datetime(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  indicatorId: z.string().optional(),
  targetValue: z.number().optional(),
  tags: z.array(z.string()).default([])
});

// Routes para PROJECT360
export default async function project360Routes(app: FastifyInstance) {
  
  // GET /project360/projects - Listar proyectos
  app.get('/projects', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    try {
      const { status, responsible, origin, priority, search } = request.query as any;
      
      let filteredProjects = projectsStore.filter(p => p.tenantId === request.db?.tenantId);
      
      if (status) filteredProjects = filteredProjects.filter(p => p.status === status);
      if (responsible) filteredProjects = filteredProjects.filter(p => p.responsibleId === responsible);
      if (origin) filteredProjects = filteredProjects.filter(p => p.origin === origin);
      if (priority) filteredProjects = filteredProjects.filter(p => p.priority === priority);

      return reply.send({ projects: filteredProjects });
    } catch (error) {
      console.error('Error loading projects:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /project360/projects - Crear proyecto
  app.post('/projects', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    try {
      const validatedData = createProjectSchema.parse(request.body);
      
      // Generar código automático
      const year = new Date().getFullYear();
      const projectCount = projectsStore.filter(p => p.tenantId === request.db?.tenantId).length;
      const code = `PROJ-${year}-${String(projectCount + 1).padStart(3, '0')}`;

      // Crear proyecto en memoria
      const project = {
        id: `proj-${Date.now()}`,
        code,
        ...validatedData,
        tenantId: request.db.tenantId,
        createdBy: request.db.userId || 'unknown',
        startDate: new Date(),
        targetDate: new Date(validatedData.targetDate),
        status: 'PENDING',
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        responsible: {
          id: validatedData.responsibleId,
          name: request.db.userName || 'Usuario',
          email: request.db.userEmail || 'email@example.com'
        },
        _count: { tasks: 0 }
      };

      // Guardar en memoria
      projectsStore.push(project);

      return reply.code(201).send({ project });
    } catch (error: any) {
      console.error('Error creating project:', error);
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: error.errors });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // GET /project360/projects/:id - Obtener proyecto por ID
  app.get('/projects/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { id } = request.params as { id: string };
    
    const project = projectsStore.find(
      p => p.id === id && p.tenantId === request.db?.tenantId
    );
    
    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    return reply.send({ project });
  });

  // PUT /project360/projects/:id - Actualizar proyecto
  app.put('/projects/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { id } = request.params as { id: string };
    const updateData = request.body as any;
    
    const projectIndex = projectsStore.findIndex(
      p => p.id === id && p.tenantId === request.db?.tenantId
    );
    
    if (projectIndex === -1) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    // Update project
    const oldProject = { ...projectsStore[projectIndex] };
    projectsStore[projectIndex] = {
      ...projectsStore[projectIndex],
      ...updateData,
      updatedAt: new Date()
    };

    // Log activity
    if (updateData.name && updateData.name !== oldProject.name) {
      logActivity(id, 'UPDATE', `Nombre cambiado de "${oldProject.name}" a "${updateData.name}"`, request.db.userId);
    }
    if (updateData.status && updateData.status !== oldProject.status) {
      logActivity(id, 'STATUS_CHANGE', `Estado cambiado de "${oldProject.status}" a "${updateData.status}"`, request.db.userId);
      
      // Notify if project is completed
      if (updateData.status === 'COMPLETED') {
        createNotification(
          oldProject.responsibleId || request.db.userId,
          request.db.tenantId,
          'PROJECT_COMPLETED',
          'Proyecto Completado',
          `El proyecto "${updateData.name || oldProject.name}" ha sido completado`,
          id
        );
      }
    }
    if (updateData.progress !== undefined && updateData.progress !== oldProject.progress) {
      logActivity(id, 'PROGRESS_UPDATE', `Progreso actualizado a ${updateData.progress}%`, request.db.userId);
    }

    return reply.send({ project: projectsStore[projectIndex] });
  });

  // DELETE /project360/projects/:id - Eliminar proyecto
  app.delete('/projects/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { id } = request.params as { id: string };
    
    const projectIndex = projectsStore.findIndex(
      p => p.id === id && p.tenantId === request.db?.tenantId
    );
    
    if (projectIndex === -1) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    const project = projectsStore[projectIndex];
    projectsStore.splice(projectIndex, 1);
    
    // Log activity
    logActivity(id, 'PROJECT_DELETED', `Proyecto "${project.name}" eliminado`, request.db.userId);

    return reply.send({ message: 'Project deleted successfully' });
  });

  // GET /project360/stats - Estadísticas
  app.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const tenantProjects = projectsStore.filter(p => p.tenantId === request.db?.tenantId);
    
    const stats = {
      totalProjects: tenantProjects.length,
      activeProjects: tenantProjects.filter(p => p.status === 'IN_PROGRESS').length,
      overdueProjects: tenantProjects.filter(p => p.status === 'OVERDUE').length,
      completedProjects: tenantProjects.filter(p => p.status === 'COMPLETED').length,
      projectsByStatus: {},
      projectsByOrigin: {},
      avgProgress: tenantProjects.length > 0 
        ? tenantProjects.reduce((sum, p) => sum + (p.progress || 0), 0) / tenantProjects.length 
        : 0,
      criticalProjects: tenantProjects.filter(p => p.priority === 'CRITICAL').length,
      onTimeCompletionRate: 0
    };

    return reply.send({ stats });
  });

  // POST /project360/tasks/:taskId/comments - Agregar comentario a tarea
  app.post('/tasks/:taskId/comments', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { taskId } = request.params as { taskId: string };
    const { text } = request.body as { text: string };
    
    if (!text || !text.trim()) {
      return reply.code(400).send({ error: 'Comment text is required' });
    }

    const comment = {
      id: `comment-${Date.now()}`,
      taskId,
      text: text.trim(),
      author: request.db.userId || 'unknown',
      authorName: 'Usuario', // En producción vendría del perfil
      createdAt: new Date().toISOString()
    };

    taskCommentsStore.push(comment);

    // Create notification for task comment
    const taskProject = projectsStore.find(p => p.tasks?.some((t: any) => t.id === taskId));
    if (taskProject) {
      const task = taskProject.tasks.find((t: any) => t.id === taskId);
      if (task && task.responsible && task.responsible !== request.db.userId) {
        createNotification(
          task.responsible,
          request.db.tenantId,
          'TASK_COMMENT',
          'Nuevo comentario en tarea',
          `Se agregó un comentario en "${task.title}"`,
          taskProject.id,
          taskId
        );
      }
    }

    return reply.code(201).send({ comment });
  });

  // GET /project360/tasks/:taskId/comments - Listar comentarios de tarea
  app.get('/tasks/:taskId/comments', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { taskId } = request.params as { taskId: string };
    
    const comments = taskCommentsStore
      .filter(c => c.taskId === taskId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return reply.send({ comments });
  });

  // POST /project360/projects/:id/attachments - Agregar archivo al proyecto
  app.post('/projects/:id/attachments', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { id } = request.params as { id: string };
    const { name, url, size, type, taskId } = request.body as any;
    
    if (!name || !url) {
      return reply.code(400).send({ error: 'Name and URL are required' });
    }

    const attachment = {
      id: `attach-${Date.now()}`,
      projectId: id,
      taskId: taskId || null,
      name,
      url,
      size: size || 0,
      type: type || 'application/octet-stream',
      uploadedBy: request.db.userId || 'unknown',
      uploadedByName: 'Usuario',
      createdAt: new Date().toISOString()
    };

    attachmentsStore.push(attachment);
    
    // Log activity
    logActivity(id, 'ATTACHMENT_ADDED', `Archivo "${name}" agregado`, request.db.userId);

    return reply.code(201).send({ attachment });
  });

  // GET /project360/projects/:id/attachments - Listar archivos del proyecto
  app.get('/projects/:id/attachments', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { id } = request.params as { id: string };
    
    const attachments = attachmentsStore
      .filter(a => a.projectId === id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return reply.send({ attachments });
  });

  // DELETE /project360/attachments/:attachmentId - Eliminar archivo
  app.delete('/attachments/:attachmentId', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { attachmentId } = request.params as { attachmentId: string };
    
    const index = attachmentsStore.findIndex(a => a.id === attachmentId);
    if (index === -1) {
      return reply.code(404).send({ error: 'Attachment not found' });
    }

    const attachment = attachmentsStore[index];
    attachmentsStore.splice(index, 1);
    
    // Log activity
    logActivity(attachment.projectId, 'ATTACHMENT_REMOVED', `Archivo "${attachment.name}" eliminado`, request.db.userId);

    return reply.send({ message: 'Attachment deleted' });
  });

  // GET /project360/projects/:id/history - Historial de actividad
  app.get('/projects/:id/history', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { id } = request.params as { id: string };
    
    const history = activityHistoryStore
      .filter(h => h.projectId === id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);

    return reply.send({ history });
  });

  // GET /project360/notifications - Listar notificaciones del usuario
  app.get('/notifications', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const userId = request.db.userId || 'unknown';
    
    const notifications = notificationsStore
      .filter(n => n.userId === userId && n.tenantId === request.db?.tenantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);

    return reply.send({ notifications });
  });

  // POST /project360/notifications/:id/read - Marcar notificación como leída
  app.post('/notifications/:id/read', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { id } = request.params as { id: string };
    const userId = request.db.userId || 'unknown';
    
    const notification = notificationsStore.find(
      n => n.id === id && n.userId === userId && n.tenantId === request.db?.tenantId
    );
    
    if (!notification) {
      return reply.code(404).send({ error: 'Notification not found' });
    }

    notification.read = true;
    notification.readAt = new Date().toISOString();

    return reply.send({ notification });
  });

  // DELETE /project360/notifications/:id - Eliminar notificación
  app.delete('/notifications/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { id } = request.params as { id: string };
    const userId = request.db.userId || 'unknown';
    
    const index = notificationsStore.findIndex(
      n => n.id === id && n.userId === userId && n.tenantId === request.db?.tenantId
    );
    
    if (index === -1) {
      return reply.code(404).send({ error: 'Notification not found' });
    }

    notificationsStore.splice(index, 1);

    return reply.send({ message: 'Notification deleted' });
  });

  // POST /project360/projects/:id/reminders - Crear recordatorio
  app.post('/projects/:id/reminders', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { id } = request.params as { id: string };
    const { title, reminderDate, description } = request.body as any;
    
    if (!title || !reminderDate) {
      return reply.code(400).send({ error: 'Title and reminderDate are required' });
    }

    const reminder = {
      id: `reminder-${Date.now()}`,
      projectId: id,
      title,
      description: description || '',
      reminderDate,
      userId: request.db.userId || 'unknown',
      isCompleted: false,
      createdAt: new Date().toISOString()
    };

    remindersStore.push(reminder);
    
    // Log activity
    logActivity(id, 'REMINDER_CREATED', `Recordatorio "${title}" creado para ${new Date(reminderDate).toLocaleDateString()}`, request.db.userId);

    return reply.code(201).send({ reminder });
  });

  // GET /project360/projects/:id/reminders - Listar recordatorios
  app.get('/projects/:id/reminders', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { id } = request.params as { id: string };
    
    const reminders = remindersStore
      .filter(r => r.projectId === id)
      .sort((a, b) => new Date(a.reminderDate).getTime() - new Date(b.reminderDate).getTime());

    return reply.send({ reminders });
  });

  // POST /project360/reminders/:reminderId/complete - Completar recordatorio
  app.post('/reminders/:reminderId/complete', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { reminderId } = request.params as { reminderId: string };
    
    const reminder = remindersStore.find(r => r.id === reminderId);
    if (!reminder) {
      return reply.code(404).send({ error: 'Reminder not found' });
    }

    reminder.isCompleted = true;
    reminder.completedAt = new Date().toISOString();

    // Log activity
    logActivity(reminder.projectId, 'REMINDER_COMPLETED', `Recordatorio "${reminder.title}" completado`, request.db.userId);

    return reply.send({ reminder });
  });

  // DELETE /project360/reminders/:reminderId - Eliminar recordatorio
  app.delete('/reminders/:reminderId', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const { reminderId } = request.params as { reminderId: string };
    
    const index = remindersStore.findIndex(r => r.id === reminderId);
    if (index === -1) {
      return reply.code(404).send({ error: 'Reminder not found' });
    }

    const reminder = remindersStore[index];
    remindersStore.splice(index, 1);

    // Log activity
    logActivity(reminder.projectId, 'REMINDER_DELETED', `Recordatorio "${reminder.title}" eliminado`, request.db.userId);

    return reply.send({ message: 'Reminder deleted' });
  });
}

// Helper function to create notifications
function createNotification(userId: string, tenantId: string, type: string, title: string, message: string, projectId?: string, taskId?: string) {
  const notification = {
    id: `notif-${Date.now()}`,
    userId,
    tenantId,
    type,
    title,
    message,
    projectId,
    taskId,
    read: false,
    createdAt: new Date().toISOString()
  };
  notificationsStore.push(notification);
  return notification;
}
