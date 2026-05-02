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
  // GET /trainings — Listar capacitaciones
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;
    const query = z.object({ 
      status: z.string().optional(),
      competencyId: z.string().optional(),
    }).parse(req.query);

    const trainings = await app.runWithDbContext(req, async (tx: any) => {
      return tx.sgiTraining.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(query.status ? { status: query.status } : {}),
          ...(query.competencyId ? { competencyId: query.competencyId } : {}),
        },
        include: {
          coordinator: { select: { id: true, email: true } },
          competency: { select: { id: true, name: true, category: true } },
          _count: { select: { attendees: true, satisfactionEvaluations: true, effectivenessEvaluations: true } },
          satisfactionEvaluations: { take: 1 },
          effectivenessEvaluations: { take: 1 },
        },
        orderBy: { scheduledDate: 'desc' },
      });
    });

    return reply.send({ trainings });
  });

  // GET /trainings/stats — Estadísticas ISO
  app.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;
    
    const [trainings, satisfactionAvg, effectivenessStats] = await app.runWithDbContext(req, async (tx: any) => {
      const trainings = await tx.sgiTraining.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          status: true,
          durationHours: true,
          expectedParticipants: true,
          category: true,
        },
      });

      // Satisfacción promedio
      const satisfactionData = await tx.trainingSatisfaction.groupBy({
        by: ['trainingId'],
        _avg: { overallSatisfaction: true },
      });

      // Efectividad aprobada
      const effectivenessCount = await tx.trainingEffectiveness.count({
        where: { approved: true },
      });

      return [trainings, satisfactionData, effectivenessCount];
    });

    const totalSatisfaction = satisfactionAvg.reduce((acc: number, curr: any) => acc + (curr._avg.overallSatisfaction || 0), 0);
    const avgSatisfaction = satisfactionAvg.length > 0 ? totalSatisfaction / satisfactionAvg.length : 0;

    const stats = {
      total: trainings.length,
      scheduled: trainings.filter((t: any) => t.status === 'SCHEDULED').length,
      inProgress: trainings.filter((t: any) => t.status === 'IN_PROGRESS').length,
      completed: trainings.filter((t: any) => t.status === 'COMPLETED').length,
      totalHours: trainings.filter((t: any) => t.status === 'COMPLETED').reduce((s: number, t: any) => s + (t.durationHours || 0), 0),
      totalParticipants: trainings.reduce((s: number, t: any) => s + (t.expectedParticipants || 0), 0),
      avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
      effectivenessApproved: effectivenessStats,
      categories: {} as Record<string, number>,
      isoCompliance: {
        withObjectives: 0,
        withContent: 0,
        withEvaluation: 0,
        linkedToCompetencies: 0,
      }
    };

    for (const t of trainings) {
      stats.categories[t.category] = (stats.categories[t.category] || 0) + 1;
    }

    return reply.send({ stats });
  });

  // GET /trainings/competencies — Obtener competencias disponibles
  app.get('/competencies', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;
    const competencies = await app.prisma.competency.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, category: true, description: true },
    });

    return reply.send({ competencies });
  });

  // GET /trainings/:id — Detalle completo ISO
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const training = await app.runWithDbContext(req, async (tx: any) => {
      return tx.sgiTraining.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          coordinator: { select: { id: true, email: true } },
          competency: { select: { id: true, name: true, category: true } },
          attendees: {
            include: {
              user: { select: { id: true, email: true } },
            },
          },
          satisfactionEvaluations: true,
          effectivenessEvaluations: true,
          _count: { 
            select: { 
              attendees: true, 
              satisfactionEvaluations: true, 
              effectivenessEvaluations: true 
            } 
          },
        },
      });
    });

    if (!training) return reply.code(404).send({ error: 'Recurso no encontrado' });
    return reply.send({ training });
  });

  // POST /trainings — Crear capacitación ISO completa
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

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
      // Campos ISO 9001:2015
      objectives: z.string().optional(),
      contentProgram: z.string().optional(),
      methodologyDetails: z.string().optional(),
      evaluationCriteria: z.string().optional(),
      materialUrl: z.string().optional(),
      // Vinculación con competencias
      competencyId: z.string().uuid().optional(),
      gapLevel: z.number().int().min(1).max(5).optional(),
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
          // ISO fields
          objectives: body.objectives ?? null,
          contentProgram: body.contentProgram ?? null,
          methodologyDetails: body.methodologyDetails ?? null,
          evaluationCriteria: body.evaluationCriteria ?? null,
          materialUrl: body.materialUrl ?? null,
          // Competency link
          competencyId: body.competencyId ?? null,
          gapLevel: body.gapLevel ?? null,
          status: 'SCHEDULED',
          coordinatorId: req.auth?.userId ?? null,
          createdById: req.auth?.userId ?? null,
          updatedById: req.auth?.userId ?? null,
        },
        include: {
          coordinator: { select: { id: true, email: true } },
          competency: { select: { id: true, name: true } },
          _count: { select: { attendees: true } },
        },
      });
    });

    return reply.code(201).send({ training });
  });

  // POST /trainings/:id/attendees — Registrar asistencia
  app.post('/:id/attendees', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      userIds: z.array(z.string().uuid()),
    }).parse(req.body);

    const training = await app.prisma.sgiTraining.findFirst({
      where: { id, tenantId },
    });
    if (!training) return reply.code(404).send({ error: 'Training not found' });

    const created = await app.runWithDbContext(req, async (tx: any) => {
      return tx.sgiTrainingAttendee.createMany({
        data: body.userIds.map((userId: string) => ({
          trainingId: id,
          userId,
        })),
        skipDuplicates: true,
      });
    });

    return reply.code(201).send({ added: created.count });
  });

  // PATCH /trainings/:id/attendees/:attendeeId/attendance — Marcar asistencia
  app.patch('/:id/attendees/:attendeeId/attendance', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const { id, attendeeId } = z.object({ 
      id: z.string().uuid(), 
      attendeeId: z.string().uuid() 
    }).parse(req.params);
    
    const body = z.object({
      attended: z.boolean(),
      signatureData: z.string().optional(), // Base64 de firma digital
      notes: z.string().optional(),
    }).parse(req.body);

    const attendee = await app.prisma.sgiTrainingAttendee.update({
      where: { id: attendeeId },
      data: {
        attended: body.attended,
        signatureData: body.signatureData,
        attendanceNotes: body.notes,
        attendanceMarkedAt: new Date(),
        attendanceMarkedById: req.auth?.userId ?? null,
      },
    });

    return reply.send({ attendee });
  });

  // GET /trainings/:id/attendees — Listar asistentes con info de asistencia
  app.get('/:id/attendees', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const attendees = await app.prisma.sgiTrainingAttendee.findMany({
      where: { trainingId: id },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return reply.send({ attendees });
  });

  // POST /trainings/:id/satisfaction — Evaluación de satisfacción
  app.post('/:id/satisfaction', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      contentRelevance: z.number().int().min(1).max(5).optional(),
      instructorQuality: z.number().int().min(1).max(5).optional(),
      materialsQuality: z.number().int().min(1).max(5).optional(),
      methodologyQuality: z.number().int().min(1).max(5).optional(),
      overallSatisfaction: z.number().int().min(1).max(5).optional(),
      comments: z.string().optional(),
    }).parse(req.body);

    const training = await app.prisma.sgiTraining.findFirst({
      where: { id, tenantId },
    });
    if (!training) return reply.code(404).send({ error: 'Training not found' });

    const evaluation = await app.prisma.trainingSatisfaction.create({
      data: {
        trainingId: id,
        attendeeId: req.auth?.userId ?? null,
        ...body,
      },
    });

    return reply.code(201).send({ evaluation });
  });

  // POST /trainings/:id/effectiveness — Evaluación de efectividad
  app.post('/:id/effectiveness', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      attendeeId: z.string().uuid().optional(),
      knowledgeApplication: z.number().int().min(1).max(5).optional(),
      performanceImprovement: z.number().int().min(1).max(5).optional(),
      competencyGapReduction: z.number().int().min(1).max(5).optional(),
      evidenceDescription: z.string().optional(),
      evidenceDocuments: z.array(z.string()).optional(),
      daysAfterTraining: z.number().int().min(1).max(365).optional(),
    }).parse(req.body);

    const training = await app.prisma.sgiTraining.findFirst({
      where: { id, tenantId },
    });
    if (!training) return reply.code(404).send({ error: 'Training not found' });

    const evaluation = await app.prisma.trainingEffectiveness.create({
      data: {
        trainingId: id,
        evaluatorId: req.auth?.userId ?? null,
        ...body,
        evaluationDate: new Date(),
      },
    });

    return reply.code(201).send({ evaluation });
  });

  // PATCH /trainings/:id/effectiveness/:evalId/approve — Aprobar efectividad
  app.patch('/:id/effectiveness/:evalId/approve', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const { id, evalId } = z.object({ 
      id: z.string().uuid(), 
      evalId: z.string().uuid() 
    }).parse(req.params);

    const evaluation = await app.prisma.trainingEffectiveness.update({
      where: { id: evalId },
      data: {
        approved: true,
        approvedById: req.auth?.userId ?? null,
        approvedAt: new Date(),
      },
    });

    return reply.send({ evaluation });
  });

  // GET /trainings/:id/attendance-sheet — Generar lista de asistencia
  app.get('/:id/attendance-sheet', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const training = await app.prisma.sgiTraining.findFirst({
      where: { id, tenantId },
      include: {
        attendees: {
          include: {
            user: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!training) return reply.code(404).send({ error: 'Training not found' });

    // Generar lista de asistencia en formato para impresión
    const attendanceSheet = {
      training: {
        code: training.code,
        title: training.title,
        scheduledDate: training.scheduledDate,
        durationHours: training.durationHours,
        instructor: training.instructor,
        location: training.location,
      },
      attendees: training.attendees.map((a: any) => ({
        name: a.user.email,
        signed: false,
        signatureDate: null,
      })),
      isoInfo: {
        standard: 'ISO 9001:2015 - 7.2 Competencia',
        documentType: 'Registro de Asistencia',
        version: '1.0',
      },
    };

    return reply.send({ attendanceSheet });
  });

  // GET /trainings/iso-report — Reporte de auditoría ISO
  app.get('/iso-report', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;
    const query = z.object({
      year: z.string().optional(),
      category: z.string().optional(),
    }).parse(req.query);

    const year = query.year ? parseInt(query.year) : new Date().getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const trainings = await app.prisma.sgiTraining.findMany({
      where: {
        tenantId,
        deletedAt: null,
        createdAt: { gte: startDate, lte: endDate },
        ...(query.category ? { category: query.category } : {}),
      },
      include: {
        competency: { select: { name: true } },
        attendees: { select: { id: true } },
        satisfactionEvaluations: true,
        effectivenessEvaluations: { where: { approved: true } },
      },
      orderBy: { scheduledDate: 'desc' },
    });

    const report = {
      period: { year, startDate, endDate },
      summary: {
        totalTrainings: trainings.length,
        totalAttendees: trainings.reduce((acc: number, t: any) => acc + t.attendees.length, 0),
        totalHours: trainings.reduce((acc: number, t: any) => acc + (t.durationHours || 0), 0),
        avgSatisfaction: 0,
        effectivenessRate: 0,
        complianceRate: 0,
      },
      trainings: trainings.map((t: any) => ({
        code: t.code,
        title: t.title,
        category: t.category,
        scheduledDate: t.scheduledDate,
        status: t.status,
        attendees: t.attendees.length,
        hasObjectives: !!t.objectives,
        hasContent: !!t.contentProgram,
        hasEvaluation: t.satisfactionEvaluations.length > 0,
        hasEffectiveness: t.effectivenessEvaluations.length > 0,
        linkedToCompetency: !!t.competencyId,
        competencyName: t.competency?.name,
      })),
      isoIndicators: {
        plannedVsExecuted: 0,
        satisfactionRate: 0,
        effectivenessRate: 0,
        competencyCoverage: 0,
      },
    };

    // Calcular promedios
    const allSatisfaction = trainings.flatMap((t: any) => t.satisfactionEvaluations);
    if (allSatisfaction.length > 0) {
      const avg = allSatisfaction.reduce((acc: number, s: any) => acc + (s.overallSatisfaction || 0), 0) / allSatisfaction.length;
      report.summary.avgSatisfaction = Math.round(avg * 10) / 10;
    }

    const withEffectiveness = trainings.filter((t: any) => t.effectivenessEvaluations.length > 0).length;
    report.summary.effectivenessRate = trainings.length > 0 ? Math.round((withEffectiveness / trainings.length) * 100) : 0;

    const compliant = report.trainings.filter((t: any) => t.hasObjectives && t.hasContent && t.hasEvaluation).length;
    report.summary.complianceRate = trainings.length > 0 ? Math.round((compliant / trainings.length) * 100) : 0;

    return reply.send({ report });
  });

  // POST /trainings/:id/quiz — Evaluación de aprendizaje (Quiz ISO 9001:2015)
  app.post('/:id/quiz', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      attendeeId: z.string().uuid(),
      score: z.number().int().min(0).max(100),
      answers: z.array(z.object({ questionId: z.string(), selectedAnswer: z.string(), isCorrect: z.boolean() })).optional(),
    }).parse(req.body);

    const passed = body.score >= 70; // 70% para aprobar

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
        message: passed ? 'Evaluación aprobada' : 'Debe mejorar para aprobar'
      }
    });
  });

  // GET /trainings/:id/quiz-questions — Obtener preguntas del quiz
  app.get('/:id/quiz-questions', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const training = await app.prisma.sgiTraining.findFirst({
      where: { id, tenantId: req.db.tenantId },
      select: { title: true, category: true, objectives: true, contentProgram: true },
    });

    if (!training) return reply.code(404).send({ error: 'Training not found' });

    // Preguntas genéricas basadas en la categoría de la capacitación
    const questions = [
      {
        id: 'q1',
        question: `¿Cuál es el objetivo principal de la capacitación "${training.title}"?`,
        options: [
          'Conocer los procedimientos de la empresa',
          'Desarrollar competencias específicas',
          'Cumplir con requisitos normativos',
          'Mejorar el desempeño laboral'
        ],
        correctAnswer: 1
      },
      {
        id: 'q2',
        question: '¿Qué norma ISO establece los requisitos para la competencia del personal?',
        options: ['ISO 14001', 'ISO 9001:2015', 'ISO 45001', 'ISO 27001'],
        correctAnswer: 1
      },
      {
        id: 'q3',
        question: '¿Cuándo debe evaluarse la eficacia de una capacitación según ISO 9001:2015?',
        options: ['Inmediatamente después', 'A los 30-90 días', 'Al final del año', 'No es necesario'],
        correctAnswer: 1
      },
      {
        id: 'q4',
        question: `¿Qué se debe documentar según el contenido de "${training.category}"?`,
        options: ['Solo la asistencia', 'Objetivos, contenido y evaluación', 'Nada específico', 'Solo el instructor'],
        correctAnswer: 1
      },
      {
        id: 'q5',
        question: '¿Quién es responsable de verificar la aplicación de conocimientos post-capacitación?',
        options: ['El empleado', 'RRHH o Supervisor', 'El instructor', 'Auditor externo'],
        correctAnswer: 1
      }
    ];

    return reply.send({ questions, training: { title: training.title, category: training.category } });
  });

  // POST /trainings/:id/reschedule — Reprogramar capacitación
  app.post('/:id/reschedule', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      newDate: z.string().datetime(),
      reason: z.string().min(1),
    }).parse(req.body);

    const training = await app.prisma.sgiTraining.update({
      where: { id },
      data: {
        scheduledDate: new Date(body.newDate),
        rescheduledDate: new Date(body.newDate),
        rescheduleReason: body.reason,
        rescheduledById: req.auth?.userId ?? null,
        status: 'SCHEDULED',
      },
    });

    return reply.send({ training, message: 'Capacitación reprogramada exitosamente' });
  });

  // POST /trainings/:id/cancel — Cancelar capacitación
  app.post('/:id/cancel', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      reason: z.string().min(1),
    }).parse(req.body);

    const training = await app.prisma.sgiTraining.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: body.reason,
        cancelledById: req.auth?.userId ?? null,
      },
    });

    return reply.send({ training, message: 'Capacitación cancelada exitosamente' });
  });

  // POST /trainings/:id/complete — Marcar capacitación como completada
  app.post('/:id/complete', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      completionDate: z.string().datetime().optional(),
    }).parse(req.body);

    const training = await app.prisma.sgiTraining.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedDate: body.completionDate ? new Date(body.completionDate) : new Date(),
        completedById: req.auth?.userId ?? null,
      },
    });

    return reply.send({ training, message: 'Capacitación marcada como completada' });
  });
};
