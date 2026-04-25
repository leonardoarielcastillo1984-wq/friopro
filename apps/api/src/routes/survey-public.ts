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

    // ── Operational Intelligence: Automatic NC generation for low satisfaction ──
    if (body.isComplete && (satisfactionScore !== null && satisfactionScore !== undefined && satisfactionScore <= 3)) {
      try {
        const tenantId = customerSurvey.survey.tenantId;
        const customerId = customerSurvey.customerId;

        // Check for duplicate open NC in last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const existingNCR = await app.prisma.nonConformity.findFirst({
          where: {
            tenantId,
            status: { in: ['OPEN', 'IN_ANALYSIS'] },
            source: 'CUSTOMER_COMPLAINT',
            detectedAt: { gte: thirtyDaysAgo },
            customerLinks: {
              some: { id: customerId }
            }
          },
          orderBy: { detectedAt: 'desc' }
        });

        if (!existingNCR) {
          const year = new Date().getFullYear();
          const count = await app.prisma.nonConformity.count({
            where: { tenantId, code: { startsWith: `NCR-${year}-` } },
          });
          const code = `NCR-${year}-${String(count + 1).padStart(3, '0')}`;

          const severity = (satisfactionScore <= 2) ? 'CRITICAL' : 'MAJOR';

          await app.prisma.nonConformity.create({
            data: {
              tenantId,
              code,
              title: `Baja satisfacción del cliente - ${customerSurvey.customer.name}`,
              description: `Encuesta completada con puntuación de satisfacción ${satisfactionScore}. ${body.comments || ''}`,
              severity,
              source: 'CUSTOMER_COMPLAINT',
              status: 'OPEN',
              detectedAt: new Date(),
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
              customerLinks: {
                connect: { id: customerId }
              },
            },
          });
        }
      } catch (ncError) {
        console.error('Error creating automatic NCR:', ncError);
        // Non-blocking: don't fail the survey response if NC creation fails
      }
    }

    // ── Update Customer Satisfaction Indicator ──
    if (body.isComplete && satisfactionScore !== null && satisfactionScore !== undefined) {
      try {
        const tenantId = customerSurvey.survey.tenantId;
        const period = new Date().toISOString().slice(0, 7); // YYYY-MM

        // Find or create indicator
        let indicator = await app.prisma.indicator.findFirst({
          where: { tenantId, name: { contains: 'Satisfacción', mode: 'insensitive' }, deletedAt: null },
        });

        if (!indicator) {
          const year = new Date().getFullYear();
          const count = await app.prisma.indicator.count({
            where: { tenantId, code: { startsWith: `IND-${year}-` } },
          });
          indicator = await app.prisma.indicator.create({
            data: {
              tenantId,
              code: `IND-${year}-${String(count + 1).padStart(3, '0')}`,
              name: 'Satisfacción del Cliente',
              description: 'Indicador de satisfacción promedio de clientes basado en encuestas',
              category: 'Clientes',
              unit: 'puntos',
              frequency: 'MONTHLY',
              direction: 'HIGHER_BETTER',
              targetValue: 4,
              warningValue: 3,
              criticalValue: 2,
              ncrTriggerStreak: 2,
              isActive: true,
            },
          });
        }

        // Calculate average satisfaction for the period
        const avgResult = await app.prisma.surveyResponse.aggregate({
          where: {
            survey: { tenantId },
            isComplete: true,
            completedAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
            },
            satisfactionScore: { not: null },
          },
          _avg: { satisfactionScore: true },
        });

        const avgValue = avgResult._avg.satisfactionScore ?? satisfactionScore;

        // Upsert measurement
        await app.prisma.indicatorMeasurement.upsert({
          where: { indicatorId_period: { indicatorId: indicator.id, period } },
          update: { value: avgValue, measuredAt: new Date() },
          create: { indicatorId: indicator.id, period, value: avgValue },
        });

        // Update indicator current value and status
        const prev = indicator.currentValue;
        const trend = prev === null || prev === undefined
          ? 'STABLE'
          : avgValue > prev
            ? 'UP'
            : avgValue < prev
              ? 'DOWN'
              : 'STABLE';

        const status = avgValue >= (indicator.targetValue ?? 4) ? 'ON_TARGET'
          : avgValue >= (indicator.warningValue ?? 3) ? 'WARNING'
            : 'OFF_TARGET';

        const offTargetStreak = status === 'OFF_TARGET' ? (indicator.offTargetStreak ?? 0) + 1 : 0;

        await app.prisma.indicator.update({
          where: { id: indicator.id },
          data: {
            currentValue: avgValue,
            trend,
            status,
            offTargetStreak,
            lastMeasuredAt: new Date(),
            nextDueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      } catch (indError) {
        console.error('Error updating satisfaction indicator:', indError);
        // Non-blocking
      }
    }

    return reply.code(201).send({
      success: true,
      message: 'Response saved successfully',
      responseId: response.id,
    });
  });
}
