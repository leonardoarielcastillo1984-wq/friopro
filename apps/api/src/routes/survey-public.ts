import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

export default async function surveyPublicRoutes(app: FastifyInstance) {
  // GET /survey/:token - Obtener encuesta por token (público, no requiere auth)
  app.get('/:token', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = z.object({ token: z.string() }).parse(req.params);

    // Use a transaction without tenant context for public access
    const customerSurvey = await app.prisma.customerSurvey.findFirst({
      where: { token },
      include: {
        customer: {
          select: {
            name: true,
            email: true,
          },
        },
        survey: {
          include: {
            questions: {
              where: { deletedAt: null },
              orderBy: { order: 'asc' },
              include: {
                options: {
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!customerSurvey) {
      return reply.code(404).send({ error: 'Survey not found' });
    }

    if (customerSurvey.status === 'COMPLETED') {
      return reply.code(400).send({ error: 'Survey already completed' });
    }

    // Return only necessary data
    return reply.send({
      id: customerSurvey.id,
      token: customerSurvey.token,
      status: customerSurvey.status,
      customer: customerSurvey.customer,
      survey: {
        id: customerSurvey.survey.id,
        title: customerSurvey.survey.title,
        description: customerSurvey.survey.description,
        type: customerSurvey.survey.type,
        questions: customerSurvey.survey.questions,
      },
    });
  });

  // POST /survey/:token/respond - Guardar respuestas (público)
  app.post('/:token/respond', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = z.object({ token: z.string() }).parse(req.params);

    const schema = z.object({
      answers: z.record(z.any()),
      isComplete: z.boolean().default(true),
      respondentName: z.string().optional(),
      respondentEmail: z.string().email().optional(),
      respondentPhone: z.string().optional(),
      comments: z.string().optional(),
    });

    const body = schema.parse(req.body);

    // Get customer survey
    const customerSurvey = await app.prisma.customerSurvey.findFirst({
      where: { token },
      include: {
        survey: {
          include: {
            questions: true,
          },
        },
        customer: true,
      },
    });

    if (!customerSurvey) {
      return reply.code(404).send({ error: 'Survey not found' });
    }

    if (customerSurvey.status === 'COMPLETED') {
      return reply.code(400).send({ error: 'Survey already completed' });
    }

    // Calculate scores
    let npsScore: number | null = null;
    let satisfactionScore: number | null = null;
    const answersData: any[] = [];

    for (const [questionId, value] of Object.entries(body.answers)) {
      const question = customerSurvey.survey.questions.find(q => q.id === questionId);
      if (!question) continue;

      const answer: any = {
        questionId,
        questionText: question.text,
      };

      if (question.type === 'NPS') {
        npsScore = Number(value);
        answer.numericValue = Number(value);
      } else if (question.type === 'RATING') {
        answer.numericValue = Number(value);
      } else if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
        answer.value = String(value);
      } else if (question.type === 'YES_NO') {
        answer.value = String(value);
      } else {
        answer.textValue = String(value);
      }

      answersData.push(answer);
    }

    // Calculate satisfaction score from rating questions
    const ratingAnswers = answersData.filter(a => a.numericValue !== undefined && a.numericValue !== null);
    if (ratingAnswers.length > 0) {
      const sum = ratingAnswers.reduce((acc, a) => acc + (a.numericValue || 0), 0);
      satisfactionScore = sum / ratingAnswers.length;
    }

    // Create survey response
    const response = await app.prisma.surveyResponse.create({
      data: {
        surveyId: customerSurvey.surveyId,
        customerId: customerSurvey.customerId,
        answers: {
          create: answersData,
        },
        npsScore,
        satisfactionScore,
        comments: body.comments,
        isComplete: body.isComplete,
        completedAt: body.isComplete ? new Date() : null,
        respondentName: body.respondentName,
        respondentEmail: body.respondentEmail,
        respondentPhone: body.respondentPhone,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || null,
      },
    });

    // Update customer survey status
    await app.prisma.customerSurvey.update({
      where: { id: customerSurvey.id },
      data: {
        status: body.isComplete ? 'COMPLETED' : 'PENDING',
        completedAt: body.isComplete ? new Date() : null,
      },
    });

    return reply.code(201).send({
      success: true,
      message: 'Response saved successfully',
      responseId: response.id,
    });
  });
}
