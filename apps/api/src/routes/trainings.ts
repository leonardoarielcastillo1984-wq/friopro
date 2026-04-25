import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

const FEATURE_KEY = 'capacitaciones';

async function generateTrainingCode(tx: any, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await tx.sgiTraining.count({
    where: { tenantId, code: { startsWith: `TRN-${year}-` } },
  });
  return `TRN-${year}-${String(count + 1).padStart(3, '0')}`;
}

export const capacitacionesRoutes: FastifyPluginAsync = async (app) => {
  // GET /capacitaciones — Listar capacitaciones
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    // app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const query = z.object({ status: z.string().optional() }).parse(req.query);

    const trainings = await app.runWithDbContext(req, async (tx: any) => {
      return tx.sgiTraining.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(query.status ? { status: query.status } : {}),
        },
        include: {
          coordinator: { select: { id: true, email: true } },
          _count: { select: { attendees: true } },
        },
        orderBy: { scheduledDate: 'desc' },
      });
    });

    return reply.send({ trainings });
  });

  // GET /capacitaciones/stats — Estadísticas
  app.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    // app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const trainings = await app.runWithDbContext(req, async (tx: any) => {
      return tx.sgiTraining.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          status: true,
          durationHours: true,
          expectedParticipants: true,
          category: true,
        },
      });
    });

    const stats = {
      total: trainings.length,
      scheduled: trainings.filter((t: any) => t.status === 'SCHEDULED').length,
      inProgress: trainings.filter((t: any) => t.status === 'IN_PROGRESS').length,
      completed: trainings.filter((t: any) => t.status === 'COMPLETED').length,
      totalHours: trainings.filter((t: any) => t.status === 'COMPLETED').reduce((s: number, t: any) => s + (t.durationHours || 0), 0),
      totalParticipants: trainings.reduce((s: number, t: any) => s + (t.expectedParticipants || 0), 0),
      categories: {} as Record<string, number>,
    };

    for (const t of trainings) {
      stats.categories[t.category] = (stats.categories[t.category] || 0) + 1;
    }

    return reply.send({ stats });
  });

  // GET /trainings/:id/quiz-questions — Obtener preguntas del quiz
  app.get('/:id/quiz-questions', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const training = await app.prisma.sgiTraining.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { title: true, category: true, objectives: true, contentProgram: true },
    });

    if (!training) return reply.code(404).send({ error: 'Training not found' });

    const questions = [
      {
        id: 'q1',
        question: `¿Cuál es el objetivo principal de la capacitación "${training.title}"?`,
        options: [
          'Conocer los procedimientos de la empresa',
          'Desarrollar competencias específicas',
          'Cumplir con requisitos normativos',
          'Mejorar el desempeño laboral',
        ],
        correctAnswer: 1,
      },
      {
        id: 'q2',
        question: '¿Qué norma ISO establece los requisitos para la competencia del personal?',
        options: ['ISO 14001', 'ISO 9001:2015', 'ISO 45001', 'ISO 27001'],
        correctAnswer: 1,
      },
      {
        id: 'q3',
        question: '¿Cuándo debe evaluarse la eficacia de una capacitación según ISO 9001:2015?',
        options: ['Inmediatamente después', 'A los 30-90 días', 'Al final del año', 'No es necesario'],
        correctAnswer: 1,
      },
      {
        id: 'q4',
        question: `¿Qué se debe documentar según el contenido de "${training.category}"?`,
        options: ['Solo la asistencia', 'Objetivos, contenido y evaluación', 'Nada específico', 'Solo el instructor'],
        correctAnswer: 1,
      },
      {
        id: 'q5',
        question: '¿Quién es responsable de verificar la aplicación de conocimientos post-capacitación?',
        options: ['El empleado', 'RRHH o Supervisor', 'El instructor', 'Auditor externo'],
        correctAnswer: 1,
      },
    ];

    return reply.send({ questions, training: { title: training.title, category: training.category } });
  });

  // POST /trainings/:id/quiz — Evaluación de aprendizaje
  app.post('/:id/quiz', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z
      .object({
        attendeeId: z.string().uuid(),
        score: z.number().int().min(0).max(100),
        answers: z
          .array(
            z.object({ questionId: z.string(), selectedAnswer: z.string(), isCorrect: z.boolean() })
          )
          .optional(),
      })
      .parse(req.body);

    const passed = body.score >= 70;

    const attendee = await app.prisma.sgiTrainingAttendee.update({
      where: { id: body.attendeeId },
      data: {
        quizScore: body.score,
        quizPassed: passed,
        quizCompletedAt: new Date(),
      },
    });

    return reply.send({
      attendee,
      result: {
        score: body.score,
        passed,
        minScore: 70,
        message: passed ? 'Evaluación aprobada' : 'Debe mejorar para aprobar',
      },
    });
  });

  // GET /trainings/:id — Detalle
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    // app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    try {
      const training = await app.runWithDbContext(req, async (tx: any) => {
        return tx.sgiTraining.findFirst({
          where: { id, tenantId, deletedAt: null },
          include: {
            coordinator: { select: { id: true, email: true } },
            attendees: {
              include: {
                user: { select: { id: true, email: true } },
              },
            },
            _count: { select: { attendees: true } },
          },
        });
      });

      if (!training) return reply.code(404).send({ error: 'Resource not found' });
      const employeeIds: string[] = Array.from(
        new Set(
          (training.attendees || [])
            .map((a: any) => a.employeeId)
            .filter((eid: any): eid is string => typeof eid === 'string' && eid.length > 0)
        )
      );

      const employeesById = employeeIds.length
        ? new Map(
            (
              await app.prisma.employee.findMany({
                where: {
                  tenantId,
                  deletedAt: null,
                  id: { in: employeeIds },
                },
                select: { id: true, firstName: true, lastName: true, email: true },
              })
            ).map((e) => [e.id, e])
          )
        : new Map();

      const enriched = {
        ...training,
        attendees: (training.attendees || []).map((a: any) => ({
          ...a,
          employee: a.employeeId ? employeesById.get(a.employeeId) ?? null : null,
        })),
      };

      return reply.send({ training: enriched });
    } catch (error: any) {
      console.error('Error fetching training:', error);
      return reply.code(500).send({ error: 'Failed to fetch training', message: error.message });
    }
  });

  // POST /capacitaciones — Crear capacitación
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    // app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const schema = z.object({
      title: z.string().min(2),
      description: z.string().optional(),
      category: z.string().min(2),
      modality: z.enum(['PRESENCIAL', 'VIRTUAL', 'MIXTA', 'E_LEARNING']),
      instructor: z.string().optional(),
      location: z.string().optional(),
      durationHours: z.number().min(0.25),
      scheduledDate: z.string().datetime().optional(),
      expectedParticipants: z.number().int().min(0).optional(),
      standard: z.string().optional(),
    });

    const body = schema.parse(req.body);

    const training = await app.runWithDbContext(req, async (tx: any) => {
      const code = await generateTrainingCode(tx, tenantId);
      return tx.sgiTraining.create({
        data: {
          tenantId,
          code,
          title: body.title,
          description: body.description ?? null,
          category: body.category,
          modality: body.modality,
          instructor: body.instructor ?? null,
          location: body.location ?? null,
          durationHours: body.durationHours,
          scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : null,
          expectedParticipants: body.expectedParticipants ?? 0,
          standard: body.standard ?? null,
          status: 'SCHEDULED',
          coordinatorId: req.auth?.userId ?? null,
          createdById: req.auth?.userId ?? null,
          updatedById: req.auth?.userId ?? null,
        },
        include: {
          coordinator: { select: { id: true, email: true } },
          _count: { select: { attendees: true } },
        },
      });
    });

    return reply.code(201).send({ training });
  });

  // GET /trainings/competencies — Listar competencias para vincular con capacitaciones
  app.get('/competencies', async (req: FastifyRequest, reply: FastifyReply) => {
    const competencies = await app.runWithDbContext(req, async (tx: any) => {
      return tx.competency.findMany({
        orderBy: { name: 'asc' },
      });
    });

    return reply.send({ competencies });
  });

  // POST /trainings/:id/attendees — Agregar asistentes
  app.post('/:id/attendees', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      employeeIds: z.array(z.string().uuid()),
    }).parse(req.body);

    const training = await app.prisma.sgiTraining.findFirst({
      where: { id, tenantId },
    });
    if (!training) return reply.code(404).send({ error: 'Training not found' });

    // Verify employees exist in this tenant
    const existingEmployees = await app.prisma.employee.findMany({
      where: { id: { in: body.employeeIds }, tenantId },
      select: { id: true },
    });
    const existingEmployeeIds = new Set(existingEmployees.map(e => e.id));

    // Insert attendees one by one
    let added = 0;
    for (const employeeId of body.employeeIds) {
      if (!existingEmployeeIds.has(employeeId)) continue;
      try {
        await app.prisma.sgiTrainingAttendee.create({
          data: { trainingId: id, employeeId },
        });
        added++;
      } catch (e: any) {
        if (e.code !== 'P2002') throw e; // Skip duplicates
      }
    }

    return reply.code(201).send({ added });
  });

  // GET /trainings/:id/attendees — Listar asistentes
  app.get('/:id/attendees', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const attendees = await app.prisma.sgiTrainingAttendee.findMany({
      where: { trainingId: id },
      include: {
        user: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return reply.send({ attendees });
  });

  // DELETE /trainings/:id/attendees/:attendeeId — Quitar asistente
  app.delete('/:id/attendees/:attendeeId', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const params = z
      .object({
        id: z.string().uuid(),
        attendeeId: z.string().uuid(),
      })
      .parse(req.params);

    const attendee = await app.prisma.sgiTrainingAttendee.findFirst({
      where: {
        id: params.attendeeId,
        trainingId: params.id,
        training: {
          tenantId,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (!attendee) return reply.code(404).send({ error: 'Attendee not found' });

    await app.prisma.sgiTrainingAttendee.delete({
      where: { id: attendee.id },
    });

    return reply.code(204).send();
  });

  // PATCH /trainings/:id/attendees/:attendeeId/attendance — Marcar asistencia
  app.patch('/:id/attendees/:attendeeId/attendance', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const params = z
      .object({
        id: z.string().uuid(),
        attendeeId: z.string().uuid(),
      })
      .parse(req.params);

    const body = z
      .object({
        attended: z.boolean(),
      })
      .parse(req.body);

    const attendee = await app.prisma.sgiTrainingAttendee.findFirst({
      where: {
        id: params.attendeeId,
        trainingId: params.id,
        training: {
          tenantId,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (!attendee) return reply.code(404).send({ error: 'Attendee not found' });

    await app.prisma.sgiTrainingAttendee.update({
      where: { id: attendee.id },
      data: {
        attended: body.attended,
        attendanceMarkedAt: new Date(),
        attendanceMarkedById: req.auth?.userId ?? null,
      },
    });

    return reply.code(204).send();
  });

  // PATCH /trainings/:id — Actualizar capacitación
  app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const schema = z.object({
      title: z.string().min(2).optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      modality: z.enum(['PRESENCIAL', 'VIRTUAL', 'MIXTA', 'E_LEARNING']).optional(),
      instructor: z.string().optional(),
      location: z.string().optional(),
      durationHours: z.number().min(0.25).optional(),
      scheduledDate: z.string().datetime().optional(),
      expectedParticipants: z.number().int().min(0).optional(),
      standard: z.string().optional(),
      status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
    });

    const body = schema.parse(req.body);

    const training = await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.sgiTraining.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!existing) return null;

      const data: any = {};
      if (body.title !== undefined) data.title = body.title;
      if (body.description !== undefined) data.description = body.description;
      if (body.category !== undefined) data.category = body.category;
      if (body.modality !== undefined) data.modality = body.modality;
      if (body.instructor !== undefined) data.instructor = body.instructor;
      if (body.location !== undefined) data.location = body.location;
      if (body.durationHours !== undefined) data.durationHours = body.durationHours;
      if (body.scheduledDate !== undefined) data.scheduledDate = new Date(body.scheduledDate);
      if (body.expectedParticipants !== undefined) data.expectedParticipants = body.expectedParticipants;
      if (body.standard !== undefined) data.standard = body.standard;
      if (body.status !== undefined) {
        data.status = body.status;
        if (body.status === 'COMPLETED') {
          data.completedDate = new Date();
        }
      }
      data.updatedById = req.auth?.userId ?? null;

      return tx.sgiTraining.update({
        where: { id },
        data,
        include: {
          coordinator: { select: { id: true, email: true } },
          _count: { select: { attendees: true } },
        },
      });
    });

    if (!training) return reply.code(404).send({ error: 'Training not found' });
    return reply.send({ training });
  });

  // DELETE /trainings/:id — Eliminar capacitación (soft delete)
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const result = await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.sgiTraining.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!existing) return { kind: 'not_found' as const };

      await tx.sgiTraining.update({
        where: { id },
        data: { deletedAt: new Date(), updatedById: req.auth?.userId ?? null },
      });
      return { kind: 'ok' as const };
    });

    if (result.kind === 'not_found') return reply.code(404).send({ error: 'Training not found' });
    return reply.send({ success: true, message: 'Capacitación eliminada' });
  });

  // POST /trainings/:id/reschedule — Reprogramar capacitación
  app.post('/:id/reschedule', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      newDate: z.string(), // Accept datetime-local format
      reason: z.string().min(1),
    }).parse(req.body);

    const training = await app.prisma.sgiTraining.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!training) return reply.code(404).send({ error: 'Training not found' });

    const updated = await app.prisma.sgiTraining.update({
      where: { id },
      data: {
        scheduledDate: new Date(body.newDate),
        rescheduledDate: new Date(body.newDate),
        rescheduleReason: body.reason,
        rescheduledById: req.auth?.userId ?? null,
        status: 'SCHEDULED',
      },
    });

    return reply.send({ training: updated, message: 'Capacitación reprogramada exitosamente' });
  });

  // POST /trainings/:id/complete — Marcar capacitación como completada
  app.post('/:id/complete', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      completionDate: z.string().datetime().optional(),
    }).parse(req.body);

    const training = await app.prisma.sgiTraining.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!training) return reply.code(404).send({ error: 'Training not found' });

    const updated = await app.prisma.sgiTraining.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedDate: body.completionDate ? new Date(body.completionDate) : new Date(),
        completedById: req.auth?.userId ?? null,
      },
    });

    return reply.send({ training: updated, message: 'Capacitación completada exitosamente' });
  });

  // POST /trainings/:id/cancel — Cancelar capacitación
  app.post('/:id/cancel', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      reason: z.string().min(1),
    }).parse(req.body);

    const training = await app.prisma.sgiTraining.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!training) return reply.code(404).send({ error: 'Training not found' });

    const updated = await app.prisma.sgiTraining.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: body.reason,
        cancelledById: req.auth?.userId ?? null,
      },
    });

    return reply.send({ training: updated, message: 'Capacitación cancelada exitosamente' });
  });

  // POST /trainings/:id/satisfaction — Evaluación de satisfacción
  app.post('/:id/satisfaction', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      contentRelevance: z.number().int().min(0).max(5).optional(),
      instructorQuality: z.number().int().min(0).max(5).optional(),
      materialsQuality: z.number().int().min(0).max(5).optional(),
      methodologyQuality: z.number().int().min(0).max(5).optional(),
      overallSatisfaction: z.number().int().min(0).max(5),
      comments: z.string().optional(),
    }).parse(req.body);

    const training = await app.prisma.sgiTraining.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!training) return reply.code(404).send({ error: 'Training not found' });

    const evaluation = await app.prisma.trainingSatisfaction.create({
      data: {
        trainingId: id,
        contentRelevance: body.contentRelevance ?? null,
        instructorQuality: body.instructorQuality ?? null,
        materialsQuality: body.materialsQuality ?? null,
        methodologyQuality: body.methodologyQuality ?? null,
        overallSatisfaction: body.overallSatisfaction,
        comments: body.comments ?? null,
      },
    });

    return reply.send({ evaluation, message: 'Evaluación de satisfacción registrada' });
  });
};
