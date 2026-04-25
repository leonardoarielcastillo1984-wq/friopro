import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

export async function registerCustomerRoutes(app: FastifyInstance) {
  // GET /customers - Listar clientes
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const query = req.query as any;
    const status = query?.status;
    const type = query?.type;
    const search = query?.search;

    const where: any = { tenantId, deletedAt: null };
    if (status) where.status = status;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const customers = await app.runWithDbContext(req, async (tx: any) => {
      const customersData = await tx.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { surveys: true } },
        },
      });

      const customerIds = customersData.map((c: any) => c.id);
      if (customerIds.length === 0) return customersData;

      // Get average satisfaction per customer
      const avgScores = await tx.surveyResponse.groupBy({
        by: ['customerId'],
        where: {
          customerId: { in: customerIds },
          isComplete: true,
          satisfactionScore: { not: null },
        },
        _avg: { satisfactionScore: true },
      });

      // Get last survey response date per customer
      const lastResponses = await tx.surveyResponse.findMany({
        where: {
          customerId: { in: customerIds },
          isComplete: true,
          completedAt: { not: null },
        },
        orderBy: { completedAt: 'desc' },
        distinct: ['customerId'],
        select: { customerId: true, completedAt: true, satisfactionScore: true },
      });

      // Get open NC count per customer
      const ncCounts = await tx.nonConformity.groupBy({
        by: ['customerLinks'],
        where: {
          tenantId,
          status: { in: ['OPEN', 'IN_ANALYSIS', 'ACTION_PLANNED', 'IN_PROGRESS'] },
          customerLinks: { some: { id: { in: customerIds } } },
        },
        _count: { id: true },
      });
      // Note: Prisma groupBy with relation might not work directly, we'll skip for now

      const avgMap = new Map<string, number | null>(
        avgScores.map((a: any) => [a.customerId, a._avg.satisfactionScore as number | null])
      );
      const lastMap = new Map<string, any>(
        lastResponses.map((r: any) => [r.customerId, r as any])
      );

      return customersData.map((c: any) => {
        const avg = avgMap.get(c.id) ?? null;
        const last = lastMap.get(c.id) as any;
        let riskLevel: string | null = null;
        if (avg !== null && typeof avg === 'number') {
          if (avg >= 4) riskLevel = 'LOW';
          else if (avg >= 3) riskLevel = 'MEDIUM';
          else riskLevel = 'HIGH';
        }
        return {
          ...c,
          avgSatisfaction: avg,
          riskLevel,
          lastSurveyDate: last?.completedAt ?? null,
          lastSatisfactionScore: last?.satisfactionScore ?? null,
        };
      });
    });

    return reply.send({ customers });
  });

  // GET /customers/:id - Detalle de cliente
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      console.log('GET /customers/:id - params:', req.params);
      console.log('GET /customers/:id - tenantId:', req.db?.tenantId);
      
      if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

      const tenantId = req.db.tenantId;
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      
      console.log('GET /customers/:id - parsed id:', id);

      const customer = await app.runWithDbContext(req, async (tx: any) => {
        return await tx.customer.findFirst({
          where: { id, tenantId, deletedAt: null },
          include: {
            surveys: {
              include: {
                survey: {
                  select: {
                    id: true,
                    title: true,
                    isActive: true,
                    createdAt: true,
                  },
                },
              },
            },
            ncrLinks: {
              where: { deletedAt: null },
              select: {
                id: true,
                code: true,
                title: true,
                status: true,
                severity: true,
              },
            },
            documents: {
              where: { deletedAt: null },
              select: {
                id: true,
                title: true,
                type: true,
                status: true,
                createdAt: true,
                filePath: true,
              },
            },
          },
        });
      });

      console.log('GET /customers/:id - customer found:', !!customer);
      if (!customer) return reply.code(404).send({ error: 'Customer not found' });
      return reply.send({ customer });
    } catch (error: any) {
      console.error('GET /customers/:id - Error:', {
        message: error?.message || error,
        stack: error?.stack,
        code: error?.code,
        params: req.params,
        tenantId: req.db?.tenantId
      });
      return reply.code(500).send({ 
        error: 'Error getting customer', 
        message: error?.message || 'Unknown error'
      });
    }
  });

  // POST /customers - Crear cliente
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

      const tenantId = req.db.tenantId;

      const schema = z.object({
        name: z.string().min(2),
        legalName: z.string().optional().nullable(),
        taxId: z.string().optional().nullable(),
        email: z.string().email().optional().or(z.literal('')).transform(v => v === '' ? null : v),
        phone: z.string().optional().nullable(),
        mobile: z.string().optional().nullable(),
        website: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        city: z.string().optional().nullable(),
        state: z.string().optional().nullable(),
        country: z.string().optional().nullable(),
        zipCode: z.string().optional().nullable(),
        contactName: z.string().optional().nullable(),
        contactEmail: z.string().email().optional().or(z.literal('')).transform(v => v === '' ? null : v),
        contactPhone: z.string().optional().nullable(),
        contactPosition: z.string().optional().nullable(),
        type: z.enum(['CLIENT', 'SUPPLIER', 'PARTNER', 'PROSPECT']).default('CLIENT'),
        status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
        category: z.string().optional().nullable(),
        industry: z.string().optional().nullable(),
        employeesCount: z.union([z.number().int(), z.string().transform((v) => v === '' ? undefined : parseInt(v)), z.undefined()]).optional(),
        annualRevenue: z.union([z.number(), z.string().transform((v) => v === '' ? undefined : parseFloat(v)), z.undefined()]).optional(),
        notes: z.string().optional().nullable(),
      });

      const body = schema.parse(req.body);

      // Generate customer code: CLI-YYYY-NNN
      const year = new Date().getFullYear();
      const lastCustomer = await app.runWithDbContext(req, async (tx: any) => {
        return await tx.customer.findFirst({
          where: { tenantId, code: { startsWith: `CLI-${year}` } },
          orderBy: { code: 'desc' },
        });
      });

      let sequence = 1;
      if (lastCustomer) {
        const parts = lastCustomer.code.split('-');
        sequence = parseInt(parts[2]) + 1;
      }
      const code = `CLI-${year}-${sequence.toString().padStart(3, '0')}`;

      const customer = await app.runWithDbContext(req, async (tx: any) => {
        return await tx.customer.create({
          data: {
            ...body,
            code,
            tenantId,
            createdById: req.auth?.userId ?? null,
          },
        });
      });

      return reply.code(201).send({ customer });
    } catch (error: any) {
      console.error('Error creating customer:', {
        message: error?.message || error,
        stack: error?.stack,
        code: error?.code,
        body: req.body,
        tenantId: req.db?.tenantId
      });
      return reply.code(500).send({ 
        error: 'Error creating customer', 
        message: error?.message || 'Unknown error',
        code: error?.code 
      });
    }
  });

  // PATCH /customers/:id - Actualizar cliente
  app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      console.log('PATCH /customers/:id - body:', req.body);
      
      if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

      const tenantId = req.db.tenantId;
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

      const schema = z.object({
        name: z.string().min(2).optional(),
        legalName: z.string().optional().nullable(),
        taxId: z.string().optional().nullable(),
        email: z.string().email().optional().nullable().or(z.literal('')).transform(v => v === '' ? null : v),
        phone: z.string().optional().nullable(),
        mobile: z.string().optional().nullable(),
        website: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        city: z.string().optional().nullable(),
        state: z.string().optional().nullable(),
        country: z.string().optional().nullable(),
        zipCode: z.string().optional().nullable(),
        contactName: z.string().optional().nullable(),
        contactEmail: z.string().email().optional().nullable().or(z.literal('')).transform(v => v === '' ? null : v),
        contactPhone: z.string().optional().nullable(),
        contactPosition: z.string().optional().nullable(),
        type: z.enum(['CLIENT', 'SUPPLIER', 'PARTNER', 'PROSPECT']).optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
        category: z.string().optional().nullable(),
        industry: z.string().optional().nullable(),
        employeesCount: z.union([z.number().int(), z.string().transform((v) => v === '' ? undefined : parseInt(v)), z.null(), z.undefined()]).optional(),
        annualRevenue: z.union([z.number(), z.string().transform((v) => v === '' ? undefined : parseFloat(v)), z.null(), z.undefined()]).optional(),
        notes: z.string().optional().nullable(),
      });

      const body = schema.parse(req.body);
      console.log('PATCH /customers/:id - parsed body:', body);

      // Filter out fields that shouldn't be updated
      const { 
        name, legalName, taxId, email, phone, mobile, website, address, city, state, country, zipCode,
        contactName, contactEmail, contactPhone, contactPosition, type, status, category, industry,
        employeesCount, annualRevenue, notes
      } = body;
      
      const updateData: any = {
        name, legalName, taxId, email, phone, mobile, website, address, city, state, country, zipCode,
        contactName, contactEmail, contactPhone, contactPosition, type, status, category, industry,
        employeesCount, annualRevenue, notes
      };
      
      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });
      
      console.log('PATCH /customers/:id - updateData:', updateData);

      const customer = await app.runWithDbContext(req, async (tx: any) => {
        return await tx.customer.updateMany({
          where: { id, tenantId, deletedAt: null },
          data: {
            ...updateData,
            updatedById: req.auth?.userId ?? null,
          },
        });
      });

      if (customer.count === 0) return reply.code(404).send({ error: 'Customer not found' });

      const updated = await app.runWithDbContext(req, async (tx: any) => {
        return await tx.customer.findFirst({ 
          where: { id },
          include: {
            surveys: {
              include: {
                survey: {
                  select: {
                    id: true,
                    title: true,
                    isActive: true,
                    createdAt: true,
                  },
                },
              },
            },
            ncrLinks: {
              where: { deletedAt: null },
              select: {
                id: true,
                code: true,
                title: true,
                status: true,
                severity: true,
              },
            },
            documents: {
              where: { deletedAt: null },
              select: {
                id: true,
                title: true,
                type: true,
                status: true,
                createdAt: true,
                filePath: true,
              },
            },
          },
        });
      });
      return reply.send({ customer: updated });
    } catch (error: any) {
      console.error('PATCH /customers/:id - Error:', {
        message: error?.message || error,
        stack: error?.stack,
        code: error?.code,
        body: req.body,
        params: req.params
      });
      return reply.code(400).send({ 
        error: 'Error updating customer', 
        message: error?.message || 'Unknown error'
      });
    }
  });

  // DELETE /customers/:id - Eliminar cliente (soft delete)
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const customer = await app.runWithDbContext(req, async (tx: any) => {
      return await tx.customer.updateMany({
        where: { id, tenantId, deletedAt: null },
        data: {
          deletedAt: new Date(),
          updatedById: req.auth?.userId ?? null,
        },
      });
    });

    if (customer.count === 0) return reply.code(404).send({ error: 'Customer not found' });
    return reply.send({ success: true, message: 'Cliente eliminado' });
  });

  // GET /customers/:id/surveys - Encuestas del cliente
  app.get('/:id/surveys', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const surveys = await app.runWithDbContext(req, async (tx: any) => {
      return await tx.customerSurvey.findMany({
        where: { customerId: id, customer: { tenantId } },
        include: {
          survey: {
            select: {
              id: true,
              code: true,
              title: true,
              description: true,
              type: true,
              isActive: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    return reply.send({ surveys });
  });

  // POST /customers/:id/surveys - Asignar encuesta a cliente
  app.post('/:id/surveys', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const schema = z.object({
      surveyId: z.string().uuid(),
    });

    const body = schema.parse(req.body);

    // Verify customer belongs to tenant
    const customer = await app.runWithDbContext(req, async (tx: any) => {
      return await tx.customer.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
    });
    if (!customer) return reply.code(404).send({ error: 'Customer not found' });

    // Verify survey belongs to tenant
    const survey = await app.runWithDbContext(req, async (tx: any) => {
      return await tx.survey.findFirst({
        where: { id: body.surveyId, tenantId, deletedAt: null },
      });
    });
    if (!survey) return reply.code(404).send({ error: 'Survey not found' });

    // Check if already assigned
    const existing = await app.runWithDbContext(req, async (tx: any) => {
      return await tx.customerSurvey.findFirst({
        where: { customerId: id, surveyId: body.surveyId },
      });
    });
    if (existing) return reply.code(400).send({ error: 'Survey already assigned to customer' });

    // Generate unique token
    const token = `${tenantId.slice(0, 8)}-${id.slice(0, 8)}-${body.surveyId.slice(0, 8)}-${Date.now().toString(36)}`;

    const customerSurvey = await app.runWithDbContext(req, async (tx: any) => {
      return await tx.customerSurvey.create({
        data: {
          customerId: id,
          surveyId: body.surveyId,
          token,
        },
      });
    });

    return reply.code(201).send({ customerSurvey });
  });

  // POST /customers/:id/surveys/:surveyId/send - Enviar encuesta por email
  app.post('/:id/surveys/:surveyId/send', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      console.log('📧 SEND EMAIL ENDPOINT - Starting...');
      
      if (!req.db?.tenantId) {
        console.log('❌ Missing tenant context');
        return reply.code(400).send({ error: 'Tenant context required' });
      }

      const tenantId = req.db.tenantId;
      const { id, surveyId } = z.object({ 
        id: z.string().uuid(),
        surveyId: z.string().uuid()
      }).parse(req.params);

      console.log('📧 Customer ID:', id);
      console.log('📧 Survey ID:', surveyId);

      // Get customer survey with token
      const customerSurvey = await app.runWithDbContext(req, async (tx: any) => {
        return await tx.customerSurvey.findFirst({
          where: { customerId: id, surveyId },
          include: {
            customer: true,
            survey: true,
          },
        });
      });

      if (!customerSurvey) {
        console.log('❌ CustomerSurvey not found');
        return reply.code(404).send({ error: 'Survey not assigned to customer' });
      }

      console.log('📧 CustomerSurvey found:', customerSurvey.id);
      console.log('📧 Customer email:', customerSurvey.customer.email);

      // Generate survey link
      const surveyUrl = `${process.env.WEB_URL || 'http://localhost:3000'}/survey/${customerSurvey.token}`;
      console.log('📧 Survey URL:', surveyUrl);

      // Import email service
      const { sendEmail } = await import('../services/email.js');
      console.log('📧 Email service imported');

      // Send email
      let result;
      try {
        result = await sendEmail({
          to: customerSurvey.customer.email,
          subject: customerSurvey.survey.emailSubject || `Encuesta: ${customerSurvey.survey.title}`,
          html: `
            <h2>${customerSurvey.survey.title}</h2>
            <p>${customerSurvey.survey.emailBody || 'Por favor, completa esta encuesta.'}</p>
            <p><a href="${surveyUrl}" style="padding: 10px 20px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px;">Completar Encuesta</a></p>
            <p>O copia este enlace: ${surveyUrl}</p>
            <br>
            <p style="color: #666; font-size: 12px;">Este enlace es único para ti. No lo compartas.</p>
          `,
        });
        console.log('📧 Email result:', result);
      } catch (emailError: any) {
        console.error('❌ Email sending error:', emailError);
        return reply.code(500).send({ 
          error: 'Failed to send email', 
          details: emailError?.message || 'Unknown email error'
        });
      }

      if (!result.success) {
        console.error('❌ Email failed:', result.error);
        return reply.code(500).send({ error: 'Failed to send email', details: result.error });
      }

      // Update status to SENT
      await app.runWithDbContext(req, async (tx: any) => {
        return await tx.customerSurvey.update({
          where: { id: customerSurvey.id },
          data: { status: 'SENT', sentAt: new Date() },
        });
      });

      console.log('✅ Email sent successfully');
      return reply.send({ 
        success: true, 
        message: 'Email sent successfully',
        surveyUrl
      });
    } catch (error: any) {
      console.error('❌ UNEXPECTED ERROR:', error);
      return reply.code(500).send({ 
        error: 'Unexpected error', 
        details: error?.message || 'Unknown error'
      });
    }
  });

  // GET /customers/stats - Customer statistics dashboard
  app.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;

    const stats = await app.runWithDbContext(req, async (tx: any) => {
      const total = await tx.customer.count({ where: { tenantId, deletedAt: null } });
      const active = await tx.customer.count({ where: { tenantId, deletedAt: null, status: 'ACTIVE' } });

      // Get average satisfaction across all responses
      const avgSatisfaction = await tx.surveyResponse.aggregate({
        where: { survey: { tenantId }, isComplete: true, satisfactionScore: { not: null } },
        _avg: { satisfactionScore: true },
      });

      // Count customers without surveys in 90 days
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const customersWithRecentSurvey = await tx.customerSurvey.findMany({
        where: { customer: { tenantId, deletedAt: null }, completedAt: { gte: ninetyDaysAgo } },
        distinct: ['customerId'],
        select: { customerId: true },
      });
      const recentIds = new Set(customersWithRecentSurvey.map((c: any) => c.customerId));
      const withoutSurvey = total - recentIds.size;

      // Count high risk customers (avg < 3)
      const allResponses = await tx.surveyResponse.groupBy({
        by: ['customerId'],
        where: { survey: { tenantId }, isComplete: true, satisfactionScore: { not: null } },
        _avg: { satisfactionScore: true },
      });
      const highRiskCount = allResponses.filter((r: any) => r._avg.satisfactionScore !== null && r._avg.satisfactionScore < 3).length;

      return {
        total,
        active,
        avgSatisfaction: avgSatisfaction._avg.satisfactionScore ?? null,
        highRiskCount,
        withoutSurvey,
      };
    });

    return reply.send({ stats });
  });

  // GET /customers/:id/satisfaction-history - Historial de satisfacción
  app.get('/:id/satisfaction-history', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const history = await app.runWithDbContext(req, async (tx: any) => {
      const responses = await tx.surveyResponse.findMany({
        where: { customerId: id, isComplete: true, satisfactionScore: { not: null }, survey: { tenantId } },
        orderBy: { completedAt: 'asc' },
        select: {
          id: true,
          satisfactionScore: true,
          npsScore: true,
          completedAt: true,
          comments: true,
          survey: { select: { title: true } },
        },
      });

      const plans = await tx.customerImprovementPlan.findMany({
        where: { customerId: id, tenantId },
        orderBy: { createdAt: 'desc' },
      });

      const ncrs = await tx.nonConformity.findMany({
        where: {
          tenantId,
          customerLinks: { some: { id } },
          status: { in: ['OPEN', 'IN_ANALYSIS', 'ACTION_PLANNED', 'IN_PROGRESS'] },
        },
        select: { id: true, code: true, title: true, status: true, severity: true, detectedAt: true },
      });

      return { responses, plans, ncrs };
    });

    return reply.send(history);
  });

  // POST /customers/:id/improvement-plans - Crear plan de mejora
  app.post('/:id/improvement-plans', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const schema = z.object({
      title: z.string().min(2),
      description: z.string().optional().nullable(),
      actions: z.string().optional().nullable(),
      responsible: z.string().optional().nullable(),
      dueDate: z.string().optional().nullable(),
    });

    const body = schema.parse(req.body);

    const customer = await app.runWithDbContext(req, async (tx: any) => {
      return await tx.customer.findFirst({ where: { id, tenantId, deletedAt: null } });
    });
    if (!customer) return reply.code(404).send({ error: 'Customer not found' });

    const plan = await app.runWithDbContext(req, async (tx: any) => {
      return await tx.customerImprovementPlan.create({
        data: {
          tenantId,
          customerId: id,
          title: body.title,
          description: body.description || null,
          actions: body.actions || null,
          responsible: body.responsible || null,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
        },
      });
    });

    return reply.code(201).send({ plan });
  });

  // GET /customers/:id/improvement-plans - Listar planes de mejora
  app.get('/:id/improvement-plans', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const plans = await app.runWithDbContext(req, async (tx: any) => {
      return await tx.customerImprovementPlan.findMany({
        where: { customerId: id, tenantId },
        orderBy: { createdAt: 'desc' },
      });
    });

    return reply.send({ plans });
  });

  // PATCH /customers/improvement-plans/:planId - Actualizar plan de mejora
  app.patch('/improvement-plans/:planId', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { planId } = z.object({ planId: z.string().uuid() }).parse(req.params);

    const schema = z.object({
      title: z.string().min(2).optional(),
      description: z.string().optional().nullable(),
      actions: z.string().optional().nullable(),
      responsible: z.string().optional().nullable(),
      dueDate: z.string().optional().nullable(),
      status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
    });

    const body = schema.parse(req.body);
    const updateData: any = { ...body };
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    Object.keys(updateData).forEach((key: string) => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    const plan = await app.runWithDbContext(req, async (tx: any) => {
      return await tx.customerImprovementPlan.updateMany({
        where: { id: planId, tenantId },
        data: updateData,
      });
    });

    if (plan.count === 0) return reply.code(404).send({ error: 'Plan not found' });
    const updated = await app.runWithDbContext(req, async (tx: any) => {
      return await tx.customerImprovementPlan.findFirst({ where: { id: planId, tenantId } });
    });
    return reply.send({ plan: updated });
  });

  // POST /customers/:id/actions - Crear acción manual (NC / CAPA / Plan)
  app.post('/:id/actions', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const schema = z.object({
      type: z.enum(['NC', 'CAPA', 'PLAN']),
      title: z.string().min(2),
      description: z.string().optional().nullable(),
      severity: z.enum(['CRITICAL', 'MAJOR', 'MINOR', 'OBSERVATION']).optional(),
      dueDate: z.string().optional().nullable(),
    });

    const body = schema.parse(req.body);

    const customer = await app.runWithDbContext(req, async (tx: any) => {
      return await tx.customer.findFirst({ where: { id, tenantId, deletedAt: null } });
    });
    if (!customer) return reply.code(404).send({ error: 'Customer not found' });

    if (body.type === 'PLAN') {
      const plan = await app.runWithDbContext(req, async (tx: any) => {
        return await tx.customerImprovementPlan.create({
          data: {
            tenantId,
            customerId: id,
            title: body.title,
            description: body.description || null,
            dueDate: body.dueDate ? new Date(body.dueDate) : null,
          },
        });
      });
      return reply.code(201).send({ success: true, type: 'PLAN', plan });
    }

    // NC or CAPA
    const year = new Date().getFullYear();
    const count = await app.runWithDbContext(req, async (tx: any) => {
      return await tx.nonConformity.count({ where: { tenantId, code: { startsWith: `NCR-${year}-` } } });
    });
    const code = `NCR-${year}-${String(count + 1).padStart(3, '0')}`;

    const ncr = await app.runWithDbContext(req, async (tx: any) => {
      return await tx.nonConformity.create({
        data: {
          tenantId,
          code,
          title: body.title,
          description: body.description || `Acción ${body.type} generada manualmente para cliente ${customer.name}`,
          severity: body.severity || 'MAJOR',
          source: body.type === 'CAPA' ? 'PROCESS_DEVIATION' : 'CUSTOMER_COMPLAINT',
          status: 'OPEN',
          detectedAt: new Date(),
          dueDate: body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          customerLinks: { connect: { id } },
        },
      });
    });

    return reply.code(201).send({ success: true, type: body.type, ncr });
  });

  // POST /customers/analyze - AI Analysis of customer trends
  app.post('/analyze', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;

    const analysis = await app.runWithDbContext(req, async (tx: any) => {
      // Get recent responses
      const responses = await tx.surveyResponse.findMany({
        where: { survey: { tenantId }, isComplete: true, satisfactionScore: { not: null } },
        orderBy: { completedAt: 'desc' },
        take: 100,
        include: { customer: { select: { id: true, name: true } } },
      });

      const customersWithAvg = await tx.surveyResponse.groupBy({
        by: ['customerId'],
        where: { survey: { tenantId }, isComplete: true, satisfactionScore: { not: null } },
        _avg: { satisfactionScore: true },
        _count: { id: true },
      });

      const highRiskCustomers = customersWithAvg
        .filter((c: any) => c._avg.satisfactionScore !== null && c._avg.satisfactionScore < 3)
        .sort((a: any, b: any) => (a._avg.satisfactionScore ?? 0) - (b._avg.satisfactionScore ?? 0))
        .slice(0, 5);

      const noSurvey90Days = await tx.customer.findMany({
        where: {
          tenantId,
          deletedAt: null,
          surveys: { none: { completedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } } },
        },
        select: { id: true, name: true },
        take: 10,
      });

      const recommendations = [];
      if (highRiskCustomers.length > 0) {
        recommendations.push(`${highRiskCustomers.length} clientes con satisfacción crítica (<3). Se recomienda generar planes de mejora inmediatos.`);
      }
      if (noSurvey90Days.length > 0) {
        recommendations.push(`${noSurvey90Days.length} clientes sin encuestas recientes (>90 días). Se recomienda enviar encuestas de seguimiento.`);
      }

      const overallAvg = customersWithAvg.length > 0
        ? customersWithAvg.reduce((acc: number, c: any) => acc + (c._avg.satisfactionScore ?? 0), 0) / customersWithAvg.length
        : null;

      if (overallAvg !== null && overallAvg < 3.5) {
        recommendations.push(`Satisfacción promedio general baja (${overallAvg.toFixed(1)}). Evaluar procesos críticos y capacitación del personal.`);
      }

      return {
        overallAvg,
        totalResponses: responses.length,
        highRiskCount: highRiskCustomers.length,
        highRiskCustomers: highRiskCustomers.map((c: any) => ({ customerId: c.customerId, avgScore: c._avg.satisfactionScore, count: c._count.id })),
        noSurvey90Days: noSurvey90Days.map((c: any) => ({ id: c.id, name: c.name })),
        recommendations,
      };
    });

    return reply.send({ analysis });
  });
}
