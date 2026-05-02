import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

export async function registerSurveyRoutes(app: FastifyInstance) {
  // GET /surveys - Listar encuestas
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;
    const query = req.query as any;
    const type = query?.type;
    const isActive = query?.isActive;
    const search = query?.search;

    const where: any = { tenantId, deletedAt: null };
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const surveys = await app.prisma.survey.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { questions: true, responses: true, customers: true } },
      },
    });

    return reply.send({ surveys });
  });

  // GET /surveys/:id - Detalle de encuesta con preguntas
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const survey = await app.prisma.survey.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { order: 'asc' } } },
        },
        _count: { select: { responses: true, customers: true } },
      },
    });

    if (!survey) return reply.code(404).send({ error: 'Survey not found' });
    return reply.send({ survey });
  });

  // POST /surveys - Crear encuesta
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;

    const schema = z.object({
      title: z.string().min(2),
      description: z.string().optional(),
      type: z.enum(['SATISFACTION', 'NPS', 'CUSTOM', 'POST_SERVICE']).default('SATISFACTION'),
      isAnonymous: z.boolean().default(false),
      allowMultipleResponses: z.boolean().default(false),
      sendEmail: z.boolean().default(false),
      emailSubject: z.string().optional(),
      emailBody: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    });

    const body = schema.parse(req.body);

    // Generate survey code: SRV-YYYY-NNN
    const year = new Date().getFullYear();
    const lastSurvey = await app.prisma.survey.findFirst({
      where: { tenantId, code: { startsWith: `SRV-${year}` } },
      orderBy: { code: 'desc' },
    });

    let sequence = 1;
    if (lastSurvey) {
      const parts = lastSurvey.code.split('-');
      sequence = parseInt(parts[2]) + 1;
    }
    const code = `SRV-${year}-${sequence.toString().padStart(3, '0')}`;

    const survey = await app.prisma.survey.create({
      data: {
        ...body,
        code,
        tenantId,
        createdById: req.auth?.userId ?? null,
      },
    });

    return reply.code(201).send({ survey });
  });

  // PATCH /surveys/:id - Actualizar encuesta
  app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const schema = z.object({
      title: z.string().min(2).optional(),
      description: z.string().optional(),
      type: z.enum(['SATISFACTION', 'NPS', 'CUSTOM', 'POST_SERVICE']).optional(),
      isActive: z.boolean().optional(),
      isAnonymous: z.boolean().optional(),
      allowMultipleResponses: z.boolean().optional(),
      sendEmail: z.boolean().optional(),
      emailSubject: z.string().optional(),
      emailBody: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    });

    const body = schema.parse(req.body);

    const survey = await app.prisma.survey.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: {
        ...body,
        updatedById: req.auth?.userId ?? null,
      },
    });

    if (survey.count === 0) return reply.code(404).send({ error: 'Survey not found' });

    const updated = await app.prisma.survey.findFirst({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { order: 'asc' } } },
        },
      },
    });
    return reply.send({ survey: updated });
  });

  // DELETE /surveys/:id - Eliminar encuesta (soft delete)
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const survey = await app.prisma.survey.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: {
        deletedAt: new Date(),
        updatedById: req.auth?.userId ?? null,
      },
    });

    if (survey.count === 0) return reply.code(404).send({ error: 'Survey not found' });
    return reply.send({ success: true, message: 'Encuesta eliminada' });
  });

  // POST /surveys/:id/questions - Agregar pregunta
  app.post('/:id/questions', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const schema = z.object({
      text: z.string().min(1),
      description: z.string().optional(),
      type: z.enum(['RATING', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TEXT', 'NPS', 'YES_NO', 'SCALE']),
      isRequired: z.boolean().default(true),
      minValue: z.number().int().optional(),
      maxValue: z.number().int().optional(),
      scaleLabels: z.object({ min: z.string(), max: z.string() }).optional(),
      order: z.number().int().default(0),
      options: z.array(z.object({
        value: z.string(),
        label: z.string(),
        order: z.number().int().optional(),
      })).optional(),
    });

    const body = schema.parse(req.body);

    // Verify survey belongs to tenant
    const survey = await app.prisma.survey.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!survey) return reply.code(404).send({ error: 'Survey not found' });

    const { options, ...questionData } = body;

    const question = await app.prisma.surveyQuestion.create({
      data: {
        ...questionData,
        surveyId: id,
        options: options ? {
          create: options.map((opt, idx) => ({
            ...opt,
            order: opt.order ?? idx,
          })),
        } : undefined,
      },
      include: {
        options: { orderBy: { order: 'asc' } },
      },
    });

    return reply.code(201).send({ question });
  });

  // PATCH /surveys/:id/questions/:questionId - Actualizar pregunta
  app.patch('/:id/questions/:questionId', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;
    const { id, questionId } = z.object({ id: z.string().uuid(), questionId: z.string().uuid() }).parse(req.params);

    const schema = z.object({
      text: z.string().min(1).optional(),
      description: z.string().optional(),
      type: z.enum(['RATING', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TEXT', 'NPS', 'YES_NO', 'SCALE']).optional(),
      isRequired: z.boolean().optional(),
      minValue: z.number().int().optional(),
      maxValue: z.number().int().optional(),
      scaleLabels: z.object({ min: z.string(), max: z.string() }).optional(),
      order: z.number().int().optional(),
    });

    const body = schema.parse(req.body);

    // Verify survey belongs to tenant
    const survey = await app.prisma.survey.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!survey) return reply.code(404).send({ error: 'Survey not found' });

    const question = await app.prisma.surveyQuestion.updateMany({
      where: { id: questionId, surveyId: id },
      data: body,
    });

    if (question.count === 0) return reply.code(404).send({ error: 'Question not found' });

    const updated = await app.prisma.surveyQuestion.findFirst({
      where: { id: questionId },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    return reply.send({ question: updated });
  });

  // DELETE /surveys/:id/questions/:questionId - Eliminar pregunta
  app.delete('/:id/questions/:questionId', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;
    const { id, questionId } = z.object({ id: z.string().uuid(), questionId: z.string().uuid() }).parse(req.params);

    // Verify survey belongs to tenant
    const survey = await app.prisma.survey.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!survey) return reply.code(404).send({ error: 'Survey not found' });

    await app.prisma.surveyQuestion.deleteMany({
      where: { id: questionId, surveyId: id },
    });

    return reply.send({ success: true, message: 'Pregunta eliminada' });
  });

  // POST /surveys/:id/questions/:questionId/options - Agregar opción
  app.post('/:id/questions/:questionId/options', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;
    const { id, questionId } = z.object({ id: z.string().uuid(), questionId: z.string().uuid() }).parse(req.params);

    const schema = z.object({
      value: z.string(),
      label: z.string(),
      order: z.number().int().optional(),
    });

    const body = schema.parse(req.body);

    // Verify survey and question belong to tenant
    const survey = await app.prisma.survey.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!survey) return reply.code(404).send({ error: 'Survey not found' });

    const question = await app.prisma.surveyQuestion.findFirst({
      where: { id: questionId, surveyId: id },
    });
    if (!question) return reply.code(404).send({ error: 'Question not found' });

    const option = await app.prisma.surveyOption.create({
      data: {
        ...body,
        questionId,
      },
    });

    return reply.code(201).send({ option });
  });

  // GET /surveys/:id/responses - Ver respuestas de encuesta
  app.get('/:id/responses', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    // Verify survey belongs to tenant
    const survey = await app.prisma.survey.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!survey) return reply.code(404).send({ error: 'Survey not found' });

    const responses = await app.prisma.surveyResponse.findMany({
      where: { surveyId: id },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        answers: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({ responses });
  });

  // POST /surveys/:id/send - Enviar encuesta a clientes
  app.post('/:id/send', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const schema = z.object({
      customerIds: z.array(z.string().uuid()),
    });

    const body = schema.parse(req.body);

    // Verify survey belongs to tenant
    const survey = await app.prisma.survey.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!survey) return reply.code(404).send({ error: 'Survey not found' });

    const results = [];
    for (const customerId of body.customerIds) {
      // Verify customer belongs to tenant
      const customer = await app.prisma.customer.findFirst({
        where: { id: customerId, tenantId, deletedAt: null },
      });
      if (!customer) continue;

      // Check if already assigned
      const existing = await app.prisma.customerSurvey.findFirst({
        where: { customerId, surveyId: id },
      });
      if (existing) continue;

      // Generate unique token
      const token = `${tenantId.slice(0, 8)}-${customerId.slice(0, 8)}-${id.slice(0, 8)}-${Date.now().toString(36)}`;

      const customerSurvey = await app.prisma.customerSurvey.create({
        data: {
          customerId,
          surveyId: id,
          token,
          sentAt: new Date(),
          status: 'SENT',
        },
      });

      results.push(customerSurvey);
    }

    return reply.send({ sent: results.length, customerSurveys: results });
  });
}
