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
      return await tx.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { surveys: true } },
        },
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
}
