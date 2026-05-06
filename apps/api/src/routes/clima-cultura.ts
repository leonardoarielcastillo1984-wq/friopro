import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { sendEmail, notificationEmail } from '../services/email.js';
import { createLLMProvider } from '../services/llm/factory.js';

function generateToken(): string {
  return randomBytes(24).toString('hex');
}

const PLANTILLAS: Record<string, { title: string; description: string; questions: any[] }> = {
  CLIMA_LABORAL: {
    title: 'Clima Organizacional',
    description: 'Medición general del clima laboral en la organización',
    questions: [
      { text: '¿Cómo valorás el ambiente de trabajo en tu área?', type: 'RATING_5', isRequired: true },
      { text: '¿Te sentís valorado/a por tu equipo y superiores?', type: 'RATING_5', isRequired: true },
      { text: '¿Tenés los recursos necesarios para realizar tu trabajo?', type: 'YES_NO', isRequired: true },
      { text: '¿Cómo evaluás la comunicación dentro de tu equipo?', type: 'RATING_5', isRequired: true },
      { text: '¿Qué aspecto del clima laboral considerás que debería mejorar?', type: 'TEXT', isRequired: false },
    ],
  },
  SATISFACCION: {
    title: 'Satisfacción del Empleado',
    description: 'Encuesta de satisfacción general del personal',
    questions: [
      { text: '¿Qué tan satisfecho/a estás con tu trabajo actual?', type: 'RATING_10', isRequired: true },
      { text: '¿Recomendarías esta empresa como lugar para trabajar?', type: 'RATING_10', isRequired: true },
      { text: '¿Cómo evaluás el equilibrio entre tu vida laboral y personal?', type: 'RATING_5', isRequired: true },
      { text: '¿Estás satisfecho/a con tu remuneración y beneficios?', type: 'RATING_5', isRequired: true },
      { text: '¿Qué mejorarías de tu experiencia laboral?', type: 'TEXT', isRequired: false },
    ],
  },
  LIDERAZGO: {
    title: 'Percepción de Liderazgo',
    description: 'Evaluación del estilo y efectividad del liderazgo',
    questions: [
      { text: '¿Tu jefe/a comunica claramente los objetivos y expectativas?', type: 'RATING_5', isRequired: true },
      { text: '¿Recibís feedback constructivo de forma regular?', type: 'RATING_5', isRequired: true },
      { text: '¿Tu jefe/a reconoce y valora tu trabajo?', type: 'RATING_5', isRequired: true },
      { text: '¿Sentís que podés hablar abiertamente con tu jefe/a?', type: 'YES_NO', isRequired: true },
      { text: '¿Qué aspecto del liderazgo te gustaría que mejore?', type: 'TEXT', isRequired: false },
    ],
  },
  BIENESTAR: {
    title: 'Bienestar y Salud Laboral',
    description: 'Evaluación del bienestar físico y emocional en el trabajo',
    questions: [
      { text: '¿Cómo calificás tu nivel de bienestar general en el trabajo?', type: 'RATING_5', isRequired: true },
      { text: '¿Sentís que la carga de trabajo es razonable?', type: 'RATING_5', isRequired: true },
      { text: '¿Experimentás niveles altos de estrés laboral?', type: 'YES_NO', isRequired: true },
      { text: '¿La empresa se preocupa por tu salud y bienestar?', type: 'RATING_5', isRequired: true },
      { text: '¿Qué acciones de bienestar te gustaría que implemente la empresa?', type: 'TEXT', isRequired: false },
    ],
  },
  BURNOUT: {
    title: 'Riesgo de Burnout',
    description: 'Detección temprana de agotamiento profesional',
    questions: [
      { text: '¿Con qué frecuencia te sentís agotado/a al terminar tu jornada?', type: 'RATING_5', isRequired: true },
      { text: '¿Sentís que tu trabajo tiene sentido y propósito?', type: 'RATING_5', isRequired: true },
      { text: '¿Podés desconectarte del trabajo fuera del horario laboral?', type: 'YES_NO', isRequired: true },
      { text: '¿Sentís que tus tareas son excesivas para una persona?', type: 'RATING_5', isRequired: true },
      { text: '¿Qué factores contribuyen más a tu nivel de estrés?', type: 'TEXT', isRequired: false },
    ],
  },
};

export async function climaCulturaRoutes(app: FastifyInstance) {

  // ─── DASHBOARD ──────────────────────────────────────────────────────────────

  app.get('/dashboard', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { tenantId } = req.db;

    const [
      totalSurveys,
      activeSurveys,
      totalRecipients,
      completedRecipients,
      pendingRecipients,
      recentResponses,
      openSuggestions,
      openActionPlans,
      overdueActionPlans,
    ] = await Promise.all([
      app.prisma.climaSurvey.count({ where: { tenantId, deletedAt: null } }),
      app.prisma.climaSurvey.count({ where: { tenantId, isActive: true, deletedAt: null } }),
      app.prisma.climaRecipient.count({ where: { survey: { tenantId } } }),
      app.prisma.climaRecipient.count({ where: { survey: { tenantId }, status: 'COMPLETED' } }),
      app.prisma.climaRecipient.count({ where: { survey: { tenantId }, status: { in: ['PENDING', 'SENT'] } } }),
      app.prisma.climaResponse.findMany({
        where: { survey: { tenantId }, isComplete: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { overallScore: true, aiSentiment: true, createdAt: true, surveyId: true },
      }),
      app.prisma.climaSuggestion.count({ where: { tenantId, status: { in: ['ABIERTO', 'EN_PROCESO'] }, deletedAt: null } }),
      app.prisma.climaActionPlan.count({ where: { tenantId, status: { in: ['ABIERTO', 'EN_PROCESO'] }, deletedAt: null } }),
      app.prisma.climaActionPlan.count({
        where: { tenantId, status: { in: ['ABIERTO', 'EN_PROCESO'] }, dueDate: { lt: new Date() }, deletedAt: null },
      }),
    ]);

    const participationRate = totalRecipients > 0 ? Math.round((completedRecipients / totalRecipients) * 100) : 0;

    const scores = recentResponses.filter(r => r.overallScore !== null).map(r => r.overallScore as number);
    const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;

    const sentimentCounts = { POSITIVO: 0, NEUTRAL: 0, NEGATIVO: 0 };
    recentResponses.forEach(r => {
      if (r.aiSentiment && r.aiSentiment in sentimentCounts) {
        sentimentCounts[r.aiSentiment as keyof typeof sentimentCounts]++;
      }
    });

    const surveysWithStats = await app.prisma.climaSurvey.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, title: true, category: true, isActive: true, startDate: true, endDate: true,
        _count: { select: { recipients: true } },
      },
    });

    return reply.send({
      kpis: {
        totalSurveys,
        activeSurveys,
        participationRate,
        avgScore,
        openSuggestions,
        openActionPlans,
        overdueActionPlans,
        sentimentCounts,
        completedResponses: completedRecipients,
        pendingResponses: pendingRecipients,
      },
      recentSurveys: surveysWithStats,
    });
  });

  // ─── ENCUESTAS CRUD ──────────────────────────────────────────────────────────

  app.get('/encuestas', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { tenantId } = req.db;
    const q = req.query as any;

    const where: any = { tenantId, deletedAt: null };
    if (q.category) where.category = q.category;
    if (q.isActive !== undefined) where.isActive = q.isActive === 'true';
    if (q.search) where.title = { contains: q.search, mode: 'insensitive' };

    const surveys = await app.prisma.climaSurvey.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { questions: true, recipients: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    const surveysWithStats = await Promise.all(surveys.map(async (s) => {
      const [completed, total] = await Promise.all([
        app.prisma.climaRecipient.count({ where: { surveyId: s.id, status: 'COMPLETED' } }),
        app.prisma.climaRecipient.count({ where: { surveyId: s.id } }),
      ]);
      return { ...s, completedCount: completed, totalRecipients: total, participationRate: total > 0 ? Math.round((completed / total) * 100) : 0 };
    }));

    return reply.send({ surveys: surveysWithStats });
  });

  app.get('/encuestas/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { tenantId } = req.db;
    const { id } = req.params as any;

    const survey = await app.prisma.climaSurvey.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        questions: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { order: 'asc' } } },
        },
        _count: { select: { recipients: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!survey) return reply.code(404).send({ error: 'Encuesta no encontrada' });

    const [completed, avgScore] = await Promise.all([
      app.prisma.climaRecipient.count({ where: { surveyId: id, status: 'COMPLETED' } }),
      app.prisma.climaResponse.aggregate({
        where: { surveyId: id, isComplete: true },
        _avg: { overallScore: true },
      }),
    ]);

    return reply.send({ survey: { ...survey, completedCount: completed, avgScore: avgScore._avg.overallScore } });
  });

  app.post('/encuestas', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { tenantId } = req.db;

    const schema = z.object({
      title: z.string().min(2),
      description: z.string().optional(),
      category: z.string().default('CLIMA_LABORAL'),
      isAnonymous: z.boolean().default(true),
      isRequired: z.boolean().default(false),
      periodicidad: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      targetSectors: z.array(z.string()).optional(),
      targetEmployees: z.array(z.string()).optional(),
      estimatedMinutes: z.number().int().default(5),
      questions: z.array(z.object({
        text: z.string().min(1),
        description: z.string().optional(),
        type: z.string(),
        isRequired: z.boolean().default(true),
        minValue: z.number().optional(),
        maxValue: z.number().optional(),
        scaleLabels: z.any().optional(),
        order: z.number().int().optional(),
        options: z.array(z.object({ value: z.string(), label: z.string(), order: z.number().optional() })).optional(),
      })).optional(),
      useTemplate: z.string().optional(),
    });

    const body = schema.parse(req.body);

    const year = new Date().getFullYear();
    const count = await app.prisma.climaSurvey.count({ where: { tenantId } });
    const code = `CLM-${year}-${String(count + 1).padStart(3, '0')}`;

    let questions = body.questions || [];
    if (body.useTemplate && PLANTILLAS[body.useTemplate]) {
      questions = PLANTILLAS[body.useTemplate].questions;
    }

    const survey = await app.prisma.climaSurvey.create({
      data: {
        tenantId,
        code,
        title: body.title,
        description: body.description,
        category: body.category,
        isAnonymous: body.isAnonymous,
        isRequired: body.isRequired,
        periodicidad: body.periodicidad,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        targetSectors: body.targetSectors ?? null,
        targetEmployees: body.targetEmployees ?? null,
        estimatedMinutes: body.estimatedMinutes,
        createdById: req.auth?.userId ?? null,
        questions: {
          create: questions.map((q, idx) => ({
            text: q.text,
            description: q.description,
            type: q.type,
            isRequired: q.isRequired,
            minValue: q.minValue,
            maxValue: q.maxValue,
            scaleLabels: q.scaleLabels,
            order: q.order ?? idx,
            options: q.options ? { create: q.options.map((o, i) => ({ value: o.value, label: o.label, order: o.order ?? i })) } : undefined,
          })),
        },
      },
      include: { questions: { include: { options: true } } },
    });

    return reply.code(201).send({ survey });
  });

  app.patch('/encuestas/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { tenantId } = req.db;
    const { id } = req.params as any;

    const schema = z.object({
      title: z.string().min(2).optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      isAnonymous: z.boolean().optional(),
      isRequired: z.boolean().optional(),
      isActive: z.boolean().optional(),
      periodicidad: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      estimatedMinutes: z.number().int().optional(),
    });

    const body = schema.parse(req.body);

    await app.prisma.climaSurvey.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { ...body, startDate: body.startDate ? new Date(body.startDate) : undefined, endDate: body.endDate ? new Date(body.endDate) : undefined, updatedById: req.auth?.userId ?? null },
    });

    const updated = await app.prisma.climaSurvey.findFirst({ where: { id }, include: { questions: { include: { options: true } } } });
    return reply.send({ survey: updated });
  });

  app.delete('/encuestas/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { tenantId } = req.db;
    const { id } = req.params as any;

    await app.prisma.climaSurvey.updateMany({ where: { id, tenantId, deletedAt: null }, data: { deletedAt: new Date(), isActive: false } });
    return reply.send({ success: true });
  });

  // ─── PREGUNTAS ───────────────────────────────────────────────────────────────

  app.post('/encuestas/:id/preguntas', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { tenantId } = req.db;
    const { id } = req.params as any;

    const survey = await app.prisma.climaSurvey.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!survey) return reply.code(404).send({ error: 'Encuesta no encontrada' });

    const schema = z.object({
      text: z.string().min(1),
      description: z.string().optional(),
      type: z.string(),
      isRequired: z.boolean().default(true),
      minValue: z.number().optional(),
      maxValue: z.number().optional(),
      scaleLabels: z.any().optional(),
      order: z.number().int().optional(),
      options: z.array(z.object({ value: z.string(), label: z.string(), order: z.number().optional() })).optional(),
    });

    const body = schema.parse(req.body);
    const count = await app.prisma.climaQuestion.count({ where: { surveyId: id, deletedAt: null } });

    const question = await app.prisma.climaQuestion.create({
      data: {
        surveyId: id, text: body.text, description: body.description, type: body.type,
        isRequired: body.isRequired, minValue: body.minValue, maxValue: body.maxValue,
        scaleLabels: body.scaleLabels, order: body.order ?? count,
        options: body.options ? { create: body.options.map((o, i) => ({ value: o.value, label: o.label, order: o.order ?? i })) } : undefined,
      },
      include: { options: { orderBy: { order: 'asc' } } },
    });

    return reply.code(201).send({ question });
  });

  app.delete('/encuestas/:id/preguntas/:qid', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { id, qid } = req.params as any;

    await app.prisma.climaQuestion.updateMany({ where: { id: qid, surveyId: id }, data: { deletedAt: new Date() } });
    return reply.send({ success: true });
  });

  // ─── ENVÍO A DESTINATARIOS ───────────────────────────────────────────────────

  app.post('/encuestas/:id/enviar', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { tenantId } = req.db;
    const { id } = req.params as any;

    const survey = await app.prisma.climaSurvey.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { questions: { where: { deletedAt: null } } },
    });
    if (!survey) return reply.code(404).send({ error: 'Encuesta no encontrada' });

    const schema = z.object({
      employeeIds: z.array(z.string().uuid()).optional(),
      allEmployees: z.boolean().default(false),
      sectorIds: z.array(z.string().uuid()).optional(),
      method: z.enum(['EMAIL', 'INTERNAL', 'WHATSAPP']).default('EMAIL'),
    });

    const body = schema.parse(req.body);
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    let employees: any[] = [];
    if (body.allEmployees) {
      employees = await app.prisma.employee.findMany({
        where: { tenantId, status: 'ACTIVE', ...(body.sectorIds?.length ? { departmentId: { in: body.sectorIds } } : {}) },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      });
    } else if (body.employeeIds?.length) {
      employees = await app.prisma.employee.findMany({
        where: { id: { in: body.employeeIds }, tenantId },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      });
    }

    const results = [];
    for (const emp of employees) {
      const existing = await app.prisma.climaRecipient.findFirst({ where: { surveyId: id, employeeId: emp.id } });
      if (existing) continue;

      const token = generateToken();
      const recipient = await app.prisma.climaRecipient.create({
        data: {
          surveyId: id, employeeId: emp.id, email: emp.email, phone: emp.phone,
          name: `${emp.firstName} ${emp.lastName}`, token, status: 'SENT',
          sentAt: new Date(), sentMethod: body.method,
        },
      });

      if (body.method === 'EMAIL' && emp.email) {
        try {
          const surveyUrl = `${appUrl}/clima/responder/${token}`;
          const emailPayload = notificationEmail({
            userEmail: emp.email,
            title: `Encuesta: ${survey.title}`,
            message: `Hola ${emp.firstName}, tenés una encuesta pendiente de completar.\n\n` +
              `<strong>Encuesta:</strong> ${survey.title}\n` +
              `<strong>Tiempo estimado:</strong> ${survey.estimatedMinutes} minutos\n` +
              (survey.endDate ? `<strong>Fecha límite:</strong> ${new Date(survey.endDate).toLocaleDateString('es-AR')}\n` : '') +
              `\n${survey.isAnonymous ? 'Esta encuesta es anónima.' : ''}`,
            actionLabel: 'Completar encuesta',
            actionUrl: surveyUrl,
            type: 'info',
          });
          await sendEmail(emailPayload);
        } catch (e) {
          app.log.error(`[CLIMA] Error enviando email a ${emp.email}: ${e}`);
        }
      }

      results.push(recipient);
    }

    return reply.send({ sent: results.length, recipients: results });
  });

  // ─── RESULTADOS Y RESPUESTAS ─────────────────────────────────────────────────

  app.get('/encuestas/:id/resultados', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { tenantId } = req.db;
    const { id } = req.params as any;

    const survey = await app.prisma.climaSurvey.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { questions: { where: { deletedAt: null }, orderBy: { order: 'asc' }, include: { options: true } } },
    });
    if (!survey) return reply.code(404).send({ error: 'Encuesta no encontrada' });

    const responses = await app.prisma.climaResponse.findMany({
      where: { surveyId: id, isComplete: true },
      include: { answers: true },
    });

    const [totalRecipients, completed] = await Promise.all([
      app.prisma.climaRecipient.count({ where: { surveyId: id } }),
      app.prisma.climaRecipient.count({ where: { surveyId: id, status: 'COMPLETED' } }),
    ]);

    const questionStats = survey.questions.map((q) => {
      const answers = responses.flatMap(r => r.answers.filter(a => a.questionId === q.id));
      const numericAnswers = answers.filter(a => a.numericValue !== null).map(a => a.numericValue as number);
      const avg = numericAnswers.length > 0 ? numericAnswers.reduce((a, b) => a + b, 0) / numericAnswers.length : null;
      const textAnswers = answers.filter(a => a.textValue).map(a => survey.isAnonymous ? a.textValue : a.textValue);
      const optionCounts: Record<string, number> = {};
      answers.forEach(a => { if (a.value) optionCounts[a.value] = (optionCounts[a.value] || 0) + 1; });

      return {
        questionId: q.id, questionText: q.text, type: q.type,
        totalAnswers: answers.length,
        avgScore: avg ? Math.round(avg * 10) / 10 : null,
        textAnswers: survey.isAnonymous ? textAnswers : textAnswers,
        optionCounts,
        distribution: numericAnswers.reduce((acc: Record<number, number>, v) => { acc[Math.round(v)] = (acc[Math.round(v)] || 0) + 1; return acc; }, {}),
      };
    });

    const allScores = responses.filter(r => r.overallScore).map(r => r.overallScore as number);
    const overallAvg = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;

    const sentiments = { POSITIVO: 0, NEUTRAL: 0, NEGATIVO: 0 };
    responses.forEach(r => { if (r.aiSentiment && r.aiSentiment in sentiments) sentiments[r.aiSentiment as keyof typeof sentiments]++; });

    return reply.send({
      survey: { id: survey.id, title: survey.title, category: survey.category, isAnonymous: survey.isAnonymous },
      participacion: { total: totalRecipients, completed, pending: totalRecipients - completed, rate: totalRecipients > 0 ? Math.round((completed / totalRecipients) * 100) : 0 },
      overallAvg: overallAvg ? Math.round(overallAvg * 10) / 10 : null,
      sentiments,
      questionStats,
      totalResponses: responses.length,
    });
  });

  app.get('/encuestas/:id/participacion', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { tenantId } = req.db;
    const { id } = req.params as any;

    const survey = await app.prisma.climaSurvey.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!survey) return reply.code(404).send({ error: 'Encuesta no encontrada' });

    const recipients = await app.prisma.climaRecipient.findMany({
      where: { surveyId: id },
      include: survey.isAnonymous ? {} : { employee: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return reply.send({ recipients: recipients.map(r => ({
      id: r.id, status: r.status, sentAt: r.sentAt, completedAt: r.completedAt, sentMethod: r.sentMethod,
      name: survey.isAnonymous ? 'Anónimo' : (r.name || 'Sin nombre'),
    }))});
  });

  // ─── ANÁLISIS IA ─────────────────────────────────────────────────────────────

  app.post('/encuestas/:id/analisis-ia', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { tenantId } = req.db;
    const { id } = req.params as any;

    const survey = await app.prisma.climaSurvey.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { questions: { where: { deletedAt: null } } },
    });
    if (!survey) return reply.code(404).send({ error: 'Encuesta no encontrada' });

    const responses = await app.prisma.climaResponse.findMany({
      where: { surveyId: id, isComplete: true },
      include: { answers: true },
      take: 100,
    });

    if (responses.length === 0) return reply.code(400).send({ error: 'No hay respuestas para analizar' });

    const textAnswers = responses.flatMap(r => r.answers.filter(a => a.textValue).map(a => a.textValue as string));
    const numericAnswers = responses.flatMap(r => r.answers.filter(a => a.numericValue !== null).map(a => a.numericValue as number));
    const avgScore = numericAnswers.length > 0 ? numericAnswers.reduce((a, b) => a + b, 0) / numericAnswers.length : null;

    const llm = createLLMProvider();
    const prompt = `Analizás respuestas de una encuesta interna de "${survey.title}" (categoría: ${survey.category}).

DATOS:
- Total respuestas: ${responses.length}
- Puntaje promedio: ${avgScore ? avgScore.toFixed(1) : 'N/A'} / ${survey.category.includes('10') ? '10' : '5'}
- Respuestas abiertas (${textAnswers.length}):
${textAnswers.slice(0, 30).map((t, i) => `${i + 1}. "${t}"`).join('\n')}

Respondé en JSON con esta estructura exacta:
{
  "resumen": "2-3 oraciones describiendo el estado general",
  "sentimiento": "POSITIVO|NEUTRAL|NEGATIVO",
  "indiceMedicion": <número 0-100>,
  "fortalezas": ["fortaleza1", "fortaleza2", "fortaleza3"],
  "problemasDetectados": ["problema1", "problema2"],
  "temasRecurrentes": [{"tema": "string", "menciones": <número>, "sentimiento": "POSITIVO|NEUTRAL|NEGATIVO", "criticidad": "BAJA|MEDIA|ALTA"}],
  "recomendaciones": ["recomendacion1", "recomendacion2", "recomendacion3"],
  "alertas": ["alerta1"] 
}`;

    try {
      const aiResponse = await llm.chat([{ role: 'user', content: prompt }]);
      const aiText = aiResponse.text;
      let analysis: any = {};
      try {
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) analysis = JSON.parse(jsonMatch[0]);
      } catch { analysis = { resumen: aiText, sentimiento: 'NEUTRAL', indiceMedicion: 50 }; }

      return reply.send({ analysis, totalResponses: responses.length, avgScore });
    } catch (e) {
      return reply.code(500).send({ error: 'Error en análisis IA', detail: String(e) });
    }
  });

  // ─── INDICADORES ─────────────────────────────────────────────────────────────

  app.get('/indicadores', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { tenantId } = req.db;

    const [allResponses, allSurveys, suggestions] = await Promise.all([
      app.prisma.climaResponse.findMany({
        where: { survey: { tenantId }, isComplete: true },
        select: { overallScore: true, aiSentiment: true, createdAt: true },
      }),
      app.prisma.climaSurvey.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, title: true, category: true, createdAt: true },
      }),
      app.prisma.climaSuggestion.findMany({
        where: { tenantId, deletedAt: null },
        select: { type: true, priority: true, status: true, createdAt: true },
      }),
    ]);

    const scores = allResponses.filter(r => r.overallScore !== null).map(r => r.overallScore as number);
    const indiceClima = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length / 5) * 100) : null;

    const totalRecipients = await app.prisma.climaRecipient.count({ where: { survey: { tenantId } } });
    const completedRecipients = await app.prisma.climaRecipient.count({ where: { survey: { tenantId }, status: 'COMPLETED' } });
    const participacion = totalRecipients > 0 ? Math.round((completedRecipients / totalRecipients) * 100) : 0;

    const sentimientoCounts = { POSITIVO: 0, NEUTRAL: 0, NEGATIVO: 0 };
    allResponses.forEach(r => { if (r.aiSentiment && r.aiSentiment in sentimientoCounts) sentimientoCounts[r.aiSentiment as keyof typeof sentimientoCounts]++; });
    const totalSentiment = Object.values(sentimientoCounts).reduce((a, b) => a + b, 0);
    const indiceEngagement = totalSentiment > 0 ? Math.round(((sentimientoCounts.POSITIVO * 100 + sentimientoCounts.NEUTRAL * 50) / totalSentiment)) : null;

    const monthly: Record<string, { count: number; sum: number }> = {};
    allResponses.forEach(r => {
      const month = r.createdAt.toISOString().slice(0, 7);
      if (!monthly[month]) monthly[month] = { count: 0, sum: 0 };
      monthly[month].count++;
      if (r.overallScore) monthly[month].sum += r.overallScore;
    });

    const tendencia = Object.entries(monthly).sort().slice(-12).map(([month, data]) => ({
      month,
      avgScore: data.count > 0 ? Math.round((data.sum / data.count) * 10) / 10 : null,
      responses: data.count,
    }));

    return reply.send({
      indices: {
        clima: indiceClima,
        participacion,
        engagement: indiceEngagement,
        totalRespuestas: allResponses.length,
        totalEncuestas: allSurveys.length,
        sugerenciasAbiertas: suggestions.filter(s => s.status === 'ABIERTO').length,
        reclamosAbiertos: suggestions.filter(s => s.type === 'RECLAMO' && s.status === 'ABIERTO').length,
      },
      tendencia,
      sentimientos: sentimientoCounts,
    });
  });

  // ─── SUGERENCIAS Y RECLAMOS ───────────────────────────────────────────────────

  app.get('/sugerencias', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { tenantId } = req.db;
    const q = req.query as any;

    const where: any = { tenantId, deletedAt: null };
    if (q.type) where.type = q.type;
    if (q.status) where.status = q.status;
    if (q.priority) where.priority = q.priority;
    if (q.search) where.OR = [{ title: { contains: q.search, mode: 'insensitive' } }, { content: { contains: q.search, mode: 'insensitive' } }];

    const suggestions = await app.prisma.climaSuggestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        respondedBy: { select: { firstName: true, lastName: true } },
        actionPlan: { select: { id: true, title: true, status: true } },
      },
    });

    return reply.send({ suggestions: suggestions.map(s => ({
      ...s,
      employeeName: s.isAnonymous ? 'Anónimo' : (s.employee ? `${s.employee.firstName} ${s.employee.lastName}` : 'Externo'),
    }))});
  });

  app.post('/sugerencias', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { tenantId } = req.db;

    const schema = z.object({
      type: z.enum(['SUGERENCIA', 'RECLAMO', 'INQUIETUD', 'MEJORA', 'COMENTARIO', 'ALERTA']).default('SUGERENCIA'),
      category: z.string().optional(),
      priority: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).default('MEDIA'),
      title: z.string().min(3),
      content: z.string().min(10),
      isAnonymous: z.boolean().default(false),
      employeeId: z.string().uuid().optional(),
      sectorId: z.string().uuid().optional(),
    });

    const body = schema.parse(req.body);

    const suggestion = await app.prisma.climaSuggestion.create({
      data: {
        tenantId, ...body,
        employeeId: body.isAnonymous ? null : (body.employeeId ?? null),
        createdById: req.auth?.userId ?? null,
      },
    });

    return reply.code(201).send({ suggestion });
  });

  app.patch('/sugerencias/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { tenantId } = req.db;
    const { id } = req.params as any;

    const schema = z.object({
      status: z.enum(['ABIERTO', 'EN_PROCESO', 'RESUELTO', 'CERRADO']).optional(),
      response: z.string().optional(),
      priority: z.string().optional(),
    });

    const body = schema.parse(req.body);
    const updateData: any = { ...body, updatedAt: new Date() };
    if (body.response || body.status === 'RESUELTO') {
      updateData.respondedById = req.auth?.userId ?? null;
      updateData.respondedAt = new Date();
    }

    await app.prisma.climaSuggestion.updateMany({ where: { id, tenantId, deletedAt: null }, data: updateData });
    const updated = await app.prisma.climaSuggestion.findFirst({ where: { id } });
    return reply.send({ suggestion: updated });
  });

  app.delete('/sugerencias/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { tenantId } = req.db;
    const { id } = req.params as any;

    await app.prisma.climaSuggestion.updateMany({ where: { id, tenantId, deletedAt: null }, data: { deletedAt: new Date() } });
    return reply.send({ success: true });
  });

  // ─── PLANES DE ACCIÓN ────────────────────────────────────────────────────────

  app.get('/planes-accion', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { tenantId } = req.db;
    const q = req.query as any;

    const where: any = { tenantId, deletedAt: null };
    if (q.status) where.status = q.status;
    if (q.criticality) where.criticality = q.criticality;

    const plans = await app.prisma.climaActionPlan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        responsible: { select: { firstName: true, lastName: true } },
        survey: { select: { id: true, title: true } },
        suggestion: { select: { id: true, title: true, type: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    return reply.send({ plans });
  });

  app.post('/planes-accion', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { tenantId } = req.db;

    const schema = z.object({
      title: z.string().min(3),
      description: z.string().optional(),
      origin: z.enum(['ENCUESTA', 'SUGERENCIA', 'RECLAMO', 'IA', 'MANUAL']).default('MANUAL'),
      criticality: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).default('MEDIA'),
      responsibleId: z.string().uuid().optional(),
      dueDate: z.string().optional(),
      actions: z.array(z.object({ texto: z.string(), estado: z.string().default('PENDIENTE') })).optional(),
      evidenceNotes: z.string().optional(),
      surveyId: z.string().uuid().optional(),
      suggestionId: z.string().uuid().optional(),
      createNcr: z.boolean().default(false),
    });

    const body = schema.parse(req.body);

    const plan = await app.prisma.climaActionPlan.create({
      data: {
        tenantId, title: body.title, description: body.description, origin: body.origin,
        criticality: body.criticality, responsibleId: body.responsibleId ?? null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        actions: body.actions ?? null, evidenceNotes: body.evidenceNotes,
        surveyId: body.surveyId ?? null, suggestionId: body.suggestionId ?? null,
        createdById: req.auth?.userId ?? null,
      },
    });

    if (body.createNcr) {
      try {
        const year = new Date().getFullYear();
        const count = await app.prisma.nonConformity.count({ where: { tenantId, code: { startsWith: `NCR-${year}-` } } });
        const code = `NCR-${year}-${String(count + 1).padStart(3, '0')}`;
        const ncr = await app.prisma.nonConformity.create({
          data: {
            tenantId, code, title: body.title,
            description: `Originado desde Clima y Cultura: ${body.description || body.title}`,
            severity: body.criticality === 'CRITICA' ? 'CRITICAL' : body.criticality === 'ALTA' ? 'MAJOR' : 'MINOR',
            source: 'INTERNAL_AUDIT', status: 'OPEN', detectedAt: new Date(),
            dueDate: body.dueDate ? new Date(body.dueDate) : null,
          },
        });
        await app.prisma.climaActionPlan.update({ where: { id: plan.id }, data: { ncrId: ncr.id } });
        return reply.code(201).send({ plan: { ...plan, ncrId: ncr.id }, ncr });
      } catch (e) {
        app.log.error(`[CLIMA] Error creando NCR: ${e}`);
      }
    }

    return reply.code(201).send({ plan });
  });

  app.patch('/planes-accion/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { tenantId } = req.db;
    const { id } = req.params as any;

    const schema = z.object({
      title: z.string().min(3).optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      criticality: z.string().optional(),
      responsibleId: z.string().uuid().optional(),
      dueDate: z.string().optional(),
      actions: z.any().optional(),
      evidenceNotes: z.string().optional(),
    });

    const body = schema.parse(req.body);
    const updateData: any = { ...body, updatedAt: new Date() };
    if (body.dueDate) updateData.dueDate = new Date(body.dueDate);
    if (body.status === 'COMPLETADO') updateData.completedAt = new Date();

    await app.prisma.climaActionPlan.updateMany({ where: { id, tenantId, deletedAt: null }, data: updateData });
    const updated = await app.prisma.climaActionPlan.findFirst({ where: { id }, include: { responsible: { select: { firstName: true, lastName: true } } } });
    return reply.send({ plan: updated });
  });

  // ─── EXPORTACIÓN CSV ─────────────────────────────────────────────────────────

  app.get('/encuestas/:id/exportar-csv', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const { tenantId } = req.db;
    const { id } = req.params as any;

    const survey = await app.prisma.climaSurvey.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { questions: { where: { deletedAt: null }, orderBy: { order: 'asc' } } },
    });
    if (!survey) return reply.code(404).send({ error: 'Encuesta no encontrada' });

    const responses = await app.prisma.climaResponse.findMany({
      where: { surveyId: id, isComplete: true },
      include: { answers: true, recipient: { select: { name: true, sentAt: true } } },
      orderBy: { completedAt: 'asc' },
    });

    const headers = [
      'Fecha',
      survey.isAnonymous ? 'Respondente' : 'Nombre',
      'Puntaje Global',
      'Sentimiento',
      ...survey.questions.map((q: any) => `"${q.text.replace(/"/g, '""')}"`),
      'Comentarios',
    ];

    const rows = responses.map(r => {
      const questionAnswers = survey.questions.map((q: any) => {
        const ans = r.answers.find((a: any) => a.questionId === q.id);
        if (!ans) return '';
        if (ans.numericValue != null) return String(ans.numericValue);
        if (ans.textValue) return `"${String(ans.textValue).replace(/"/g, '""')}"`;
        if (ans.value) return ans.value;
        if (ans.selectedOptions) return (ans.selectedOptions as string[]).join('|');
        return '';
      });

      return [
        r.completedAt ? new Date(r.completedAt).toLocaleDateString('es-AR') : '',
        survey.isAnonymous ? 'Anónimo' : (r.recipient?.name || 'N/A'),
        r.overallScore != null ? r.overallScore.toFixed(1) : '',
        r.aiSentiment || '',
        ...questionAnswers,
        r.comments ? `"${r.comments.replace(/"/g, '""')}"` : '',
      ];
    });

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const filename = `clima_${survey.code}_${new Date().toISOString().slice(0, 10)}.csv`;

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send('\uFEFF' + csv); // BOM para Excel
  });

  // ─── PLANTILLAS ──────────────────────────────────────────────────────────────

  app.get('/plantillas', async (_req: FastifyRequest, reply: FastifyReply) => {
    const templates = Object.entries(PLANTILLAS).map(([key, val]) => ({
      key, title: val.title, description: val.description, questionsCount: val.questions.length,
    }));
    return reply.send({ templates });
  });

  // ─── RESPUESTA PÚBLICA (autenticado - empleado interno) ──────────────────────

  app.get('/responder/:token', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;

    const recipient = await app.prisma.climaRecipient.findFirst({
      where: { token },
      include: {
        survey: {
          include: {
            questions: { where: { deletedAt: null }, orderBy: { order: 'asc' }, include: { options: { orderBy: { order: 'asc' } } } },
          },
        },
      },
    });

    if (!recipient) return reply.code(404).send({ error: 'Encuesta no encontrada o token inválido' });
    if (recipient.status === 'COMPLETED') return reply.code(400).send({ error: 'Esta encuesta ya fue completada' });

    const survey = recipient.survey;
    if (survey.endDate && new Date(survey.endDate) < new Date()) {
      return reply.code(400).send({ error: 'Esta encuesta ya venció' });
    }

    if (recipient.status !== 'COMPLETED') {
      await app.prisma.climaRecipient.update({ where: { id: recipient.id }, data: { status: 'OPENED', openedAt: recipient.openedAt ?? new Date() } });
    }

    return reply.send({
      token: recipient.token,
      status: recipient.status,
      survey: {
        id: survey.id, title: survey.title, description: survey.description,
        category: survey.category, isAnonymous: survey.isAnonymous,
        estimatedMinutes: survey.estimatedMinutes, endDate: survey.endDate,
        questions: survey.questions,
      },
      recipientName: survey.isAnonymous ? null : recipient.name,
    });
  });

  app.post('/responder/:token', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;

    const schema = z.object({
      answers: z.record(z.any()),
      comments: z.string().optional(),
    });

    const body = schema.parse(req.body);

    const recipient = await app.prisma.climaRecipient.findFirst({
      where: { token },
      include: { survey: { include: { questions: { where: { deletedAt: null } } } } },
    });

    if (!recipient) return reply.code(404).send({ error: 'Token inválido' });
    if (recipient.status === 'COMPLETED') return reply.code(400).send({ error: 'Ya completaste esta encuesta' });

    const answersData: any[] = [];
    const numericValues: number[] = [];

    for (const [questionId, value] of Object.entries(body.answers)) {
      const question = recipient.survey.questions.find(q => q.id === questionId);
      if (!question) continue;

      const answer: any = { questionId, questionText: question.text };

      if (['RATING_5', 'RATING_10', 'STARS'].includes(question.type)) {
        answer.numericValue = Number(value);
        numericValues.push(Number(value));
      } else if (question.type === 'YES_NO') {
        answer.value = String(value);
        answer.numericValue = value === 'SI' || value === 'true' ? 1 : 0;
        numericValues.push(answer.numericValue);
      } else if (question.type === 'SINGLE_CHOICE') {
        answer.value = String(value);
      } else if (question.type === 'MULTIPLE_CHOICE') {
        answer.selectedOptions = Array.isArray(value) ? value : [value];
      } else if (question.type === 'EMOJI') {
        answer.numericValue = Number(value);
        numericValues.push(Number(value));
      } else {
        answer.textValue = String(value);
      }

      answersData.push(answer);
    }

    const overallScore = numericValues.length > 0 ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length : null;

    const response = await app.prisma.climaResponse.create({
      data: {
        recipientId: recipient.id,
        surveyId: recipient.surveyId,
        overallScore,
        comments: body.comments,
        isComplete: true,
        completedAt: new Date(),
        ipAddress: req.ip,
        answers: { create: answersData },
      },
    });

    await app.prisma.climaRecipient.update({
      where: { id: recipient.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    // Análisis IA de sentimiento en background
    const textAnswers = answersData.filter(a => a.textValue).map(a => a.textValue as string);
    if (textAnswers.length > 0) {
      (async () => {
        try {
          const llm = createLLMProvider();
          const sentimentResp = await llm.chat([{
            role: 'user',
            content: `Analizá el sentimiento de estas respuestas a una encuesta laboral y respondé SOLO con una palabra: POSITIVO, NEUTRAL, o NEGATIVO.\n\nRespuestas: ${textAnswers.join('. ')}`,
          }]);
          const sentiment = sentimentResp.text.toUpperCase();
          const s = sentiment.includes('POSITIVO') ? 'POSITIVO' : sentiment.includes('NEGATIVO') ? 'NEGATIVO' : 'NEUTRAL';
          await app.prisma.climaResponse.update({ where: { id: response.id }, data: { aiSentiment: s } });
        } catch {}
      })();
    }

    return reply.code(201).send({ success: true, message: '¡Gracias por completar la encuesta!' });
  });
}
