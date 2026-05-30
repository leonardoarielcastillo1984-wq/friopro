import { FastifyInstance } from 'fastify';
import { sendWelcomeTenantEmail, sendWelcomeUserEmail } from '../services/email-service';
import { z } from 'zod';

const U = (...args: any[]) => z.string().uuid(...args);
const str = z.string;

const tid = (req: any) => req.sehAuth?.tenantId;
const uid = (req: any) => req.sehAuth?.userId;
const txRun = (app: FastifyInstance, req: any, cb: (tx: any) => Promise<any>) => { const prisma = (app as any).prisma ?? (req as any).prisma; return cb(prisma); };

const ClientS = z.object({ name: str().min(2), logoUrl: str().optional(), cuit: str().optional(), art: str().optional(), activity: str().optional(), province: str().optional(), address: str().optional(), phone: str().optional(), email: str().email().optional().or(z.literal('')), responsible: str().optional() });
const SiteS = z.object({ clientId: U(), name: str().min(2), address: str().optional(), city: str().optional(), province: str().optional() });
const RiskS = z.object({ clientId: U(), code: str().min(2), title: str().min(2), description: str().optional(), activity: str().optional(), task: str().optional(), probability: z.number().int().min(1).max(5), consequence: z.number().int().min(1).max(5), controlMeasure: str().optional(), controlType: str().optional(), residualProb: z.number().int().min(1).max(5).optional(), residualCons: z.number().int().min(1).max(5).optional() });
const InspS = z.object({ clientId: U(), code: str().min(2), title: str().min(2), type: z.enum(['GENERAL','SPECIFIC','REACTIVE','ROUTINE']), siteId: U().optional(), inspector: str().optional(), plannedDate: str().datetime().optional() });
const IncS = z.object({ clientId: U(), code: str().min(2), title: str().min(2), description: str().optional(), severity: z.enum(['LEVE','MODERADO','GRAVE','CRITICO','FATAL']), siteId: U().optional(), area: str().optional(), date: str().datetime().optional(), injuredCount: z.number().int().min(0).default(0), daysLost: z.number().int().min(0).default(0) });
const EmpS = z.object({ clientId: U(), firstName: str().min(1), lastName: str().min(1), dni: str().min(5), cuil: str().optional(), email: str().email().optional().or(z.literal('')), phone: str().optional(), position: str().optional(), hireDate: str().datetime().optional() });
const EppS = z.object({ clientId: U(), employeeId: U().optional(), name: str().min(1), type: str().min(1), brand: str().optional(), size: str().optional(), expiryDate: str().datetime().optional() });
const AuditS = z.object({ clientId: U(), code: str().min(2), title: str().min(2), description: str().optional(), type: str().optional(), auditor: str().optional(), plannedDate: str().datetime().optional() });
const IndS = z.object({ clientId: U().optional(), code: str().min(2), name: str().min(2), description: str().optional(), category: str().min(1), unit: str().min(1), frequency: z.enum(['DAILY','WEEKLY','MONTHLY','QUARTERLY','YEARLY']), targetValue: z.number().optional(), minValue: z.number().optional(), maxValue: z.number().optional() });
const MeasS = z.object({ indicatorId: U(), value: z.number(), period: str().min(1), notes: str().optional() });
const LegS = z.object({ clientId: U().optional(), jurisdiction: str().optional(), normative: str().min(1), article: str().optional(), description: str().min(1), activity: str().optional(), riskType: str().optional(), frequency: str().optional(), criticality: str().optional(), evidenceRequired: str().optional(), organism: str().optional(), appliesRequired: str().optional(), enforcingAuthority: str().optional(), notes: str().optional(), responsible: str().optional(), status: str().optional(), verificationNotes: str().optional(), isLibrary: z.boolean().optional(), provinceTag: str().optional(), activityTag: str().optional(), librarySource: str().optional() });
const PlanS = z.object({ clientId: U(), title: str().min(2), description: str().optional(), sourceType: str().min(1), sourceId: U().optional(), containment: str().optional(), corrective: str().optional(), preventive: str().optional(), responsible: str().optional(), dueDate: str().datetime().optional(), priority: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM') });
const TrainS = z.object({ clientId: U(), code: str().min(2), title: str().min(2), description: str().optional(), category: str().min(1), modality: z.enum(['PRESENCIAL','VIRTUAL','MIXTA','E_LEARNING']), instructor: str().optional(), durationHours: z.number().positive(), scheduledDate: str().datetime().optional() });
const DocS = z.object({ clientId: U().optional(), title: str().min(2), type: str().min(1), fileUrl: str().optional(), filePath: str().optional() });
const AlertS = z.object({ clientId: U().optional(), title: str().min(1), message: str().min(1), type: str().min(1), severity: str().default('MEDIUM'), entityType: str().optional(), entityId: U().optional() });
const RepS = z.object({ clientId: U().optional(), title: str().min(2), type: str().min(1), periodStart: str().datetime().optional(), periodEnd: str().datetime().optional(), summary: str().optional(), content: z.any().optional() });

const schemas: Record<string, z.ZodObject<any>> = {
  clients: ClientS, sites: SiteS, risks: RiskS, inspections: InspS, incidents: IncS,
  employees: EmpS, epps: EppS, audits: AuditS, indicators: IndS, measurements: MeasS,
  'legal-requirements': LegS, 'action-plans': PlanS, trainings: TrainS, documents: DocS,
  alerts: AlertS, reports: RepS,
  drills: z.object({ clientId: z.string().uuid().optional(), name: z.string().min(1), type: z.string().min(1), status: z.string().default('PLANNED'), description: z.string().optional() }),
  visits: z.object({ clientId: z.string().uuid().optional(), visitDate: z.string().optional(), inspector: z.string().optional(), type: z.string().optional(), notes: z.string().optional() }),
  'work-permits': z.object({ clientId: z.string().uuid().optional(), title: z.string().min(1), type: z.string().min(1), status: z.string().default('PENDING'), startDate: z.string().optional(), endDate: z.string().optional() }),
};

const modelMap: Record<string, string> = {
  clients: 'sehClient', sites: 'sehSite', risks: 'sehRisk', inspections: 'sehInspection',
  incidents: 'sehIncident', employees: 'sehEmployee', epps: 'sehEpp', audits: 'sehAudit',
  indicators: 'sehIndicator', measurements: 'sehIndicatorMeasurement',
  'legal-requirements': 'sehLegalRequirement', 'action-plans': 'sehActionPlan',
  trainings: 'sehTraining', documents: 'sehDocument', alerts: 'sehAlert', reports: 'sehReport',
  drills: 'sehDrill', visits: 'sehVisit', 'work-permits': 'sehWorkPermit',
};

const dateFields = ['plannedDate','dueDate','hireDate','expiryDate','scheduledDate','date','periodStart','periodEnd'];

export async function registerSeh360Routes(app: FastifyInstance) {
  const p = '/seh360';

  // SuperAdmin guard — allows admin@seh360.com or SUPERADMIN/ADMIN role
  async function requireSehSuperAdmin(req: any, reply: any): Promise<boolean> {
    if (!req.sehAuth) { reply.code(401).send({ error: 'No autorizado' }); return false; }
    const email = req.sehAuth.email;
    const role = req.sehAuth.role;
    if (email === 'admin@seh360.com' || role === 'SUPERADMIN' || role === 'ADMIN') return true;
    reply.code(403).send({ error: 'Se requiere rol de SuperAdmin' });
    return false;
  }

  // Dashboard
  app.get(`${p}/dashboard`, async (req, reply) => {
    const t = tid(req); if (!t) return reply.code(401).send({ error: 'No autorizado - Tenant required' });
    const d = await txRun(app, req, (tx: any) => Promise.all([
      tx.sehClient.count({ where: { tenantId: t, deletedAt: null } }),
      tx.sehClient.count({ where: { tenantId: t, status: 'CRITICAL', deletedAt: null } }),
      tx.sehInspection.count({ where: { tenantId: t, status: { in: ['PLANNED','IN_PROGRESS'] }, deletedAt: null } }),
      tx.sehIncident.count({ where: { tenantId: t, status: { not: 'CLOSED' }, deletedAt: null } }),
      tx.sehActionPlan.count({ where: { tenantId: t, status: { in: ['PENDING','IN_PROGRESS'] }, deletedAt: null } }),
      tx.sehActionPlan.count({ where: { tenantId: t, status: { in: ['PENDING','IN_PROGRESS'] }, dueDate: { lt: new Date() }, deletedAt: null } }),
      tx.sehAudit.count({ where: { tenantId: t, deletedAt: null } }),
      tx.sehAudit.count({ where: { tenantId: t, status: { in: ['PLANNED','IN_PROGRESS'] }, deletedAt: null } }),
      tx.sehClient.findMany({ where: { tenantId: t, deletedAt: null }, orderBy: { updatedAt: 'desc' }, take: 50, select: { id: true, name: true, logoUrl: true, status: true, complianceScore: true, alertCount: true, updatedAt: true, cuit: true, activity: true, province: true } }),
      tx.sehAlert.findMany({ where: { tenantId: t, isRead: false }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]));
    return reply.send({ dashboard: { totalClients: d[0], criticalClients: d[1], pendingInspections: d[2], openIncidents: d[3], openActionPlans: d[4], overdueActionPlans: d[5], totalAudits: d[6], pendingAudits: d[7], clients: d[8], alerts: d[9] } });
  });

  // Generic CRUD generator
  const noSoftDelete = new Set(['alerts','measurements']);
  const makeCrud = (name: string, path: string) => {
    const model = modelMap[name];
    const schema = schemas[name];
    const qClient = (req: any) => req.query?.clientId ? { clientId: req.query.clientId } : {};

    app.get(`${p}/${path}`, async (req: any, reply) => {
      if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
      const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
      const softDel = !noSoftDelete.has(name); const where: any = { tenantId: t, ...(softDel ? { deletedAt: null } : {}), ...qClient(req) };
      const r = await txRun(app, req, (tx: any) => tx[model].findMany({ where, orderBy: { createdAt: 'desc' } }));
      return reply.send({ [name]: r });
    });

    if (schema) {
      app.post(`${p}/${path}`, async (req: any, reply) => {
        if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
        const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
        const v = schema.safeParse(req.body);
        if (!v.success) return reply.code(400).send({ error: 'Validation', details: v.error.errors });
        const data: any = { tenantId: t, createdById: uid(req), ...v.data };
        dateFields.forEach((k) => { if (data[k]) data[k] = new Date(data[k]); });
        if (name === 'risks') { data.riskLevel = data.probability * data.consequence; data.residualLevel = (data.residualProb && data.residualCons) ? data.residualProb * data.residualCons : null; }
        const r = await txRun(app, req, (tx: any) => tx[model].create({ data }));
        return reply.code(201).send({ [name.replace(/-./g, (m: string) => m[1].toUpperCase())]: r });
      });
    }

    app.get(`${p}/${path}/:id`, async (req: any, reply) => {
      if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
      const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
      const r = await txRun(app, req, (tx: any) => tx[model].findFirst({ where: { id: req.params.id, tenantId: t, ...(softDel ? { deletedAt: null } : {}) } }));
      if (!r) return reply.code(404).send({ error: 'Not found' });
      return reply.send({ [name.replace(/-./g, (m: string) => m[1].toUpperCase())]: r });
    });

    app.patch(`${p}/${path}/:id`, async (req: any, reply) => {
      if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
      const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
      const r = await txRun(app, req, (tx: any) => tx[model].updateMany({ where: { id: req.params.id, tenantId: t }, data: { ...req.body, updatedAt: new Date() } }));
      return reply.send({ updated: r.count });
    });

    app.delete(`${p}/${path}/:id`, async (req: any, reply) => {
      if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
      const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
      await txRun(app, req, (tx: any) => tx[model].updateMany({ where: { id: req.params.id, tenantId: t }, data: softDel ? { deletedAt: new Date() } : {} }));
      return reply.send({ deleted: true });
    });
  };

  ['risks','inspections','incidents','employees','epps','audits','indicators','legal-requirements','action-plans','trainings','documents','alerts','reports','drills','visits','work-permits'].forEach((n) => makeCrud(n, n));

  // Clients manual CRUD
  app.get(`${p}/clients`, async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const qClient = req.query?.clientId ? { clientId: req.query.clientId } : {};
    const r = await txRun(app, req, (tx: any) => tx.sehClient.findMany({ where: { tenantId: t, deletedAt: null, ...qClient }, orderBy: { createdAt: 'desc' } }));
    return reply.send({ clients: r });
  });

  app.post(`${p}/clients`, async (req: any, reply) => {
    try {
      console.log('[DEBUG SEH360] POST /clients auth:', { hasSehAuth: !!req.sehAuth, sehAuthUserId: req.sehAuth?.userId, tenantId: req.sehAuth?.tenantId, authorization: req.headers.authorization ? 'present' : 'missing' });
      if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
      if (!await requireActivePlan(req, reply)) return;
      const t = tid(req);
      if (!t) return reply.code(401).send({ error: 'No autorizado - Tenant required' });
      const v = ClientS.safeParse(req.body);
      if (!v.success) return reply.code(400).send({ error: 'Datos inválidos', issues: v.error.errors });
      const userId = uid(req);
      if (!userId) return reply.code(401).send({ error: 'No autorizado - User required' });
      // Check client limit from seh_tenant_plans
      try {
        const planRows: any[] = await (app as any).prisma.$queryRawUnsafe(
          `SELECT "maxClients" FROM seh_tenant_plans WHERE "tenantId" = $1::uuid LIMIT 1`, t
        );
        const maxClients = planRows[0]?.maxClients ?? 10;
        const currentCount = await txRun(app, req, (tx: any) => tx.sehClient.count({ where: { tenantId: t, deletedAt: null } }));
        if (currentCount >= maxClients) {
          return reply.code(403).send({
            error: 'Límite de clientes alcanzado',
            code: 'CLIENT_LIMIT_REACHED',
            currentCount,
            maxClients,
            message: `Tu plan permite hasta ${maxClients} clientes. Para agregar más, comprá clientes adicionales por USD 9 c/u.`,
          });
        }
      } catch (limitErr: any) {
        // If limit check fails, allow creation (fail open)
        console.error('[SEH360] client limit check failed:', limitErr.message);
      }
      const data: any = { tenantId: t, createdById: userId, ...v.data };
      const client = await txRun(app, req, (tx: any) => tx.sehClient.create({ data }));
      return reply.code(201).send(client);
    } catch (err: any) {
      console.error('[SEH360 POST /clients ERROR]', err);
      return reply.code(500).send({ error: err.message || 'Error interno', details: err.stack?.substring(0, 500) });
    }
  });

  app.patch(`${p}/clients/:id`, async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const r = await txRun(app, req, (tx: any) => tx.sehClient.updateMany({ where: { id: req.params.id, tenantId: t }, data: { ...req.body, updatedAt: new Date() } }));
    return reply.send({ updated: r.count });
  });



  // ── LICENSE GUARD ─────────────────────────────────────────────────────────
  async function requireActivePlan(req: any, reply: any): Promise<boolean> {
    const t = tid(req);
    if (!t) return true; // No tenant = skip (handled elsewhere)
    try {
      const rows: any[] = await (app as any).prisma.$queryRawUnsafe(
        `SELECT status, "planEndsAt", "trialEndsAt" FROM seh_tenant_plans WHERE "tenantId" = $1::uuid LIMIT 1`, t
      );
      const plan = rows[0];
      if (!plan) return true; // No plan row yet = allow (new tenant)
      if (plan.status === 'ACTIVE') return true; // Active subscription
      // TRIAL: check if still within trial period
      const now = new Date();
      const trialEnd = plan.trialEndsAt ? new Date(plan.trialEndsAt) : null;
      if (trialEnd && now < trialEnd) return true; // Trial still valid
      // Grace period: 2 days after trial/plan expiry
      const expiry = trialEnd || (plan.planEndsAt ? new Date(plan.planEndsAt) : null);
      if (expiry) {
        const graceDays = (now.getTime() - expiry.getTime()) / (1000 * 60 * 60 * 24);
        if (graceDays <= 2) return true;
      }
      reply.code(402).send({ error: 'Plan vencido. Renová tu suscripción en Configuración → Facturación.', code: 'PLAN_EXPIRED' });
      return false;
    } catch { return true; } // On DB error, allow (fail open)
  }

  // POST /seh360/clients/:clientId/logo
  app.post(`${p}/clients/:clientId/logo`, async (req: any, reply: any) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req);
    if (!t) return reply.code(400).send({ error: 'Tenant required' });
    try {
      const data = await req.file();
      if (!data) return reply.code(400).send({ error: 'No file uploaded' });
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      if (buffer.length > 2 * 1024 * 1024) return reply.code(413).send({ error: 'Imagen demasiado grande (max 2MB)' });
      const mime = data.mimetype || 'image/png';
      const logoUrl = `data:${mime};base64,${buffer.toString('base64')}`;
      await (app as any).prisma.sehClient.updateMany({
        where: { id: req.params.clientId, tenantId: t },
        data: { logoUrl, updatedAt: new Date() },
      });
      return reply.send({ logoUrl });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Error al subir imagen', details: err.message });
    }
  });

  // ── CLIENT USER ACCESS ─────────────────────────────────────────────────────

  // GET /seh360/clients/:clientId/users — list users with access to this client
  app.get(`${p}/clients/:clientId/users`, async (req: any, reply: any) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const { clientId } = req.params as any;
    try {
      const users: any[] = await (app as any).prisma.$queryRawUnsafe(`
        SELECT cu.id as "linkId", cu."userId", cu.role, cu."isPrimary",
               u.email, u."firstName", u."lastName", u."isActive", u."createdAt"
        FROM seh_client_users cu
        JOIN seh_users u ON u.id = cu."userId"
        WHERE cu."clientId" = $1::uuid AND cu."tenantId" = $2::uuid AND u."deletedAt" IS NULL
        ORDER BY cu."isPrimary" DESC, u.email ASC
      `, clientId, t);
      return reply.send({ users });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // POST /seh360/clients/:clientId/users — create a new user and link to client
  app.post(`${p}/clients/:clientId/users`, async (req: any, reply: any) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const { clientId } = req.params as any;
    const { email, password, firstName, lastName, role = 'VIEWER', isPrimary = false } = (req.body as any) || {};
    if (!email || !password) return reply.code(400).send({ error: 'Email y contraseña requeridos' });
    if (password.length < 6) return reply.code(400).send({ error: 'La contraseña debe tener al menos 6 caracteres' });
    try {
      const argon2 = await import('argon2');
      const passwordHash = await argon2.hash(password);
      // Check if user with this email already exists in tenant
      const existing: any[] = await (app as any).prisma.$queryRawUnsafe(
        `SELECT id FROM seh_users WHERE email = $1 AND "tenantId" = $2::uuid AND "deletedAt" IS NULL LIMIT 1`, email, t
      );
      let userId: string;
      if (existing.length > 0) {
        userId = existing[0].id;
      } else {
        const newUser: any[] = await (app as any).prisma.$queryRawUnsafe(`
          INSERT INTO seh_users (id, "tenantId", email, "passwordHash", "firstName", "lastName", role, "isActive", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5, 'VIEWER', true, NOW(), NOW())
          RETURNING id
        `, t, email, passwordHash, firstName || email.split('@')[0], lastName || '');
        userId = newUser[0].id;
      }
      // Link user to client
      await (app as any).prisma.$executeRawUnsafe(`
        INSERT INTO seh_client_users (id, "tenantId", "clientId", "userId", role, "isPrimary", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4, $5, NOW(), NOW())
        ON CONFLICT ("clientId", "userId") DO UPDATE SET role = $4, "isPrimary" = $5, "updatedAt" = NOW()
      `, t, clientId, userId, role, isPrimary);
      // Send welcome email to client user (non-blocking)
      (async () => {
        try {
          const clientRows: any[] = await (app as any).prisma.$queryRawUnsafe(
            `SELECT name FROM seh_clients WHERE id = $1::uuid LIMIT 1`, clientId
          );
          const clientName = clientRows[0]?.name || clientId;
          await sendWelcomeUserEmail({ to: email, firstName: firstName || email.split('@')[0], companyName: clientName, password, isClientUser: true, clientName });
        } catch {}
      })();
      return reply.code(201).send({ success: true, userId });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // DELETE /seh360/clients/:clientId/users/:userId — remove user access from client
  app.delete(`${p}/clients/:clientId/users/:userId`, async (req: any, reply: any) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const { clientId, userId } = req.params as any;
    try {
      await (app as any).prisma.$executeRawUnsafe(
        `DELETE FROM seh_client_users WHERE "clientId" = $1::uuid AND "userId" = $2::uuid AND "tenantId" = $3::uuid`,
        clientId, userId, t
      );
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  app.delete(`${p}/clients/:id`, async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    await txRun(app, req, (tx: any) => tx.sehClient.updateMany({ where: { id: req.params.id, tenantId: t }, data: { deletedAt: new Date() } }));
    return reply.send({ deleted: true });
  });

  // Client detail with relations
  app.get(`${p}/clients/:id`, async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const r = await txRun(app, req, (tx: any) => tx.sehClient.findFirst({
      where: { id: req.params.id, tenantId: t, deletedAt: null },
      include: {
        SehSite: { where: { deletedAt: null } },
        SehRisk: { where: { deletedAt: null }, take: 5 },
        SehInspection: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 5 },
        SehIncident: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 5 },
        SehEmployee: { where: { deletedAt: null }, take: 5 },
        SehAudit: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 5 },
      }
    }));
    if (!r) return reply.code(404).send({ error: 'Not found' });
    const { SehSite, SehRisk, SehInspection, SehIncident, SehEmployee, SehAudit, ...rest } = r as any;
    return reply.send({ client: { ...rest, sites: SehSite ?? [], risks: SehRisk ?? [], inspections: SehInspection ?? [], incidents: SehIncident ?? [], employees: SehEmployee ?? [], audits: SehAudit ?? [] } });
  });

  // Sites sub-route
  app.get(`${p}/clients/:id/sites`, async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const r = await txRun(app, req, (tx: any) => tx.sehSite.findMany({ where: { clientId: req.params.id, tenantId: t, deletedAt: null } }));
    return reply.send({ sites: r });
  });

  app.post(`${p}/sites`, async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const v = schemas.sites.safeParse(req.body);
    if (!v.success) return reply.code(400).send({ error: 'Validation', details: v.error.errors });
    const r = await txRun(app, req, (tx: any) => tx.sehSite.create({ data: { tenantId: t, ...v.data } }));
    return reply.code(201).send({ site: r });
  });

  // Measurements sub-route
  app.get(`${p}/indicators/:id/measurements`, async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const r = await txRun(app, req, (tx: any) => tx.sehIndicatorMeasurement.findMany({ where: { indicatorId: req.params.id }, orderBy: { measuredAt: 'desc' } }));
    return reply.send({ measurements: r });
  });

  app.post(`${p}/measurements`, async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const v = schemas.measurements.safeParse(req.body);
    if (!v.success) return reply.code(400).send({ error: 'Validation', details: v.error.errors });
    const r = await txRun(app, req, (tx: any) => tx.sehIndicatorMeasurement.create({ data: v.data }));
    return reply.code(201).send({ measurement: r });
  });

  // ── ALERTS: Auto-generate based on expiring/overdue items ──
  app.post(`${p}/alerts/auto-generate`, async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    try {
      const now = new Date();
      const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const created: string[] = [];

      // EPPs próximos a vencer
      const expEpps = await (app as any).prisma.sehEpp.findMany({
        where: { tenantId: t, deletedAt: null, expiryDate: { not: null, lte: in30 } }, take: 20,
      }).catch(() => []);
      for (const epp of expEpps) {
        const existing = await (app as any).prisma.sehAlert.findFirst({
          where: { tenantId: t, entityType: 'EPP', entityId: epp.id, isRead: false }
        }).catch(() => null);
        if (!existing) {
          await (app as any).prisma.sehAlert.create({
            data: { tenantId: t, clientId: epp.clientId, type: 'VENCIMIENTO', severity: 'HIGH',
              title: `EPP próximo a vencer: ${epp.name}`,
              message: `El EPP "${epp.name}" vence el ${epp.expiryDate?.toLocaleDateString('es-AR') || '-'}`,
              entityType: 'EPP', entityId: epp.id },
          }).catch(() => null);
          created.push(`EPP:${epp.id}`);
        }
      }

      // Capacitaciones próximas
      const expTrainings = await (app as any).prisma.sehTraining.findMany({
        where: { tenantId: t, deletedAt: null, scheduledAt: { not: null, gte: now, lte: in30 } }, take: 20,
      }).catch(() => []);
      for (const tr of expTrainings) {
        const existing = await (app as any).prisma.sehAlert.findFirst({
          where: { tenantId: t, entityType: 'TRAINING', entityId: tr.id, isRead: false }
        }).catch(() => null);
        if (!existing) {
          await (app as any).prisma.sehAlert.create({
            data: { tenantId: t, clientId: tr.clientId, type: 'AUDITORIA', severity: 'MEDIUM',
              title: `Capacitación programada: ${tr.title || 'Sin título'}`,
              message: `Capacitación el ${tr.scheduledAt?.toLocaleDateString('es-AR') || '-'}`,
              entityType: 'TRAINING', entityId: tr.id },
          }).catch(() => null);
          created.push(`Training:${tr.id}`);
        }
      }

      return reply.send({ ok: true, generated: created.length, items: created });
    } catch (err: any) {
      app.log.error('[SEH360] auto-generate-alerts error:', String(err));
      return reply.code(500).send({ error: 'Error generando alertas' });
    }
  });


  // ── CONFIGURACIÓN DE MEMBRETE PDF ──
  app.get(`${p}/membrete-config`, async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });

    try {
      let settings = await txRun(app, req, (tx: any) => tx.companySettings.findFirst({
        where: { tenantId: t }
      }));

      if (!settings) {
        return reply.send({
          config: {
            title: '',
            subtitle: '',
            footer: '',
            showDate: true,
            showPageNumber: true
          }
        });
      }

      return reply.send({
        config: {
          title: settings.headerText || '',
          subtitle: settings.companyName || '',
          footer: settings.footerText || '',
          logoUrl: settings.logoUrl || null,
          showDate: true,
          showPageNumber: true
        }
      });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to get membrete config', details: err.message });
    }
  });




  // GET /seh360/license-status — returns plan status from seh_tenant_plans
  app.get(`${p}/license-status`, async (req: any, reply: any) => {
    const t = tid(req);
    app.log.info({ t, sehAuth: req.sehAuth }, '[LICENSE-STATUS] tid resolved');
    if (!t) return reply.send({ status: 'TRIAL', isDemo: true, daysRemaining: 0, licenseStatus: 'TRIAL' });
    try {
      const plan: any = await (app as any).prisma.$queryRawUnsafe(
        `SELECT status, "planTier", "planEndsAt", "trialEndsAt", "maxClients" FROM seh_tenant_plans WHERE "tenantId" = $1::uuid LIMIT 1`,
        t
      ).then((rows: any[]) => rows[0] || null);

      app.log.info({ plan, t }, '[LICENSE-STATUS] plan result');
      if (!plan || plan.status === 'CANCELED') {
        return reply.send({ status: 'TRIAL', isDemo: true, hasSubscription: false, daysRemaining: 0, licenseStatus: 'TRIAL' });
      }

      const now = new Date();
      const endsAt = plan.status === 'TRIAL' ? (plan.trialEndsAt ? new Date(plan.trialEndsAt) : null)
                                               : (plan.planEndsAt ? new Date(plan.planEndsAt) : null);
      let daysRemaining = 30;
      let isExpired = false;
      let isInGracePeriod = false;
      let graceDaysRemaining = 0;
      if (endsAt) {
        const diff = endsAt.getTime() - now.getTime();
        daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
        if (daysRemaining < 0) {
          isInGracePeriod = Math.abs(daysRemaining) <= 5;
          graceDaysRemaining = isInGracePeriod ? 5 - Math.abs(daysRemaining) : 0;
          isExpired = !isInGracePeriod;
        }
      }

      // Get current client count
      let currentClientCount = 0;
      try {
        const countRows: any[] = await (app as any).prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::int as cnt FROM seh_clients WHERE "tenantId" = $1::uuid AND "deletedAt" IS NULL`, t
        );
        currentClientCount = Number(countRows[0]?.cnt ?? 0);
      } catch {}
      const maxClients = Number(plan.maxClients ?? 10);
      return reply.send({
        hasSubscription: plan.status === 'ACTIVE',
        status: plan.status,
        planTier: plan.planTier,
        isDemo: plan.status === 'TRIAL',
        isExpired,
        isInGracePeriod,
        daysRemaining: Math.max(0, daysRemaining),
        graceDaysRemaining,
        licenseStatus: plan.status === 'ACTIVE' ? 'ACTIVE' : 'TRIAL',
        endsAt: endsAt?.toISOString() || null,
        maxClients,
        currentClientCount,
        clientsRemaining: Math.max(0, maxClients - currentClientCount),
      });
    } catch (err: any) {
      app.log.error({ err: err.message }, '[LICENSE-STATUS] DB error');
      return reply.send({ status: 'TRIAL', isDemo: true, daysRemaining: 0, licenseStatus: 'TRIAL' });
    }
  });



  // POST /seh360/billing/addon-client — purchase extra client slots (+$9 USD each)
  app.post(`${p}/billing/addon-client`, async (req: any, reply: any) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req);
    if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const { quantity = 1 } = (req.body as any) || {};
    const qty = Math.max(1, Math.min(50, parseInt(quantity) || 1));
    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!mpToken) return reply.code(500).send({ error: 'MercadoPago no configurado' });
    const PRICE_PER_CLIENT_USD = 9; // USD 9 por cliente adicional
    const webBase = process.env.APP_URL || 'https://test.logismart.ar';
    const preference = {
      items: [{ title: `SEH360 Clientes Adicionales (x${qty})`, quantity: qty, unit_price: PRICE_PER_CLIENT_USD, currency_id: 'USD' }],
      external_reference: `${t}_ADDON_CLIENTS_${qty}`,
      notification_url: `${webBase}/api/seh360/webhooks/mercadopago`,
      back_urls: {
        success: `${webBase}/seh360/configuracion?addon=success`,
        failure: `${webBase}/seh360/configuracion?addon=failed`,
        pending: `${webBase}/seh360/configuracion?addon=pending`,
      },
      auto_return: 'approved',
    };
    try {
      const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: { Authorization: `Bearer ${mpToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(preference),
      });
      const data = await mpRes.json();
      if (!mpRes.ok) return reply.code(mpRes.status).send({ error: data.message || 'Error MP', details: data });
      return reply.send({ id: data.id, init_point: data.init_point, sandbox_init_point: data.sandbox_init_point, quantity: qty });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Error creando preferencia', details: err.message });
    }
  });

  // POST /seh360/billing/checkout — create MercadoPago preference for plan purchase
  app.post(`${p}/billing/checkout`, async (req: any, reply: any) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req);
    if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const { planTier = 'BASIC', period = 'monthly' } = (req.body as any) || {};
    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!mpToken) return reply.code(500).send({ error: 'MercadoPago no configurado' });

    // Pricing: $99 base + $9 per extra client (matches frontend logic)
    const { extraClients = 0 } = (req.body as any) || {};
    const BASE_PRICE_USD = 99;
    const EXTRA_CLIENT_USD = 9;
    const priceUSD = BASE_PRICE_USD + (Math.max(0, Number(extraClients) || 0) * EXTRA_CLIENT_USD);

    // Fetch official USD/ARS rate (dólar oficial BCRA) and convert to ARS
    let priceARS = priceUSD * 1200; // fallback: conservative estimate
    try {
      const fxRes = await fetch('https://dolarapi.com/v1/dolares/oficial', { signal: AbortSignal.timeout(4000) });
      if (fxRes.ok) {
        const fxData = await fxRes.json();
        const rate = Number(fxData.venta) || Number(fxData.compra) || 0;
        if (rate > 100) priceARS = Math.round(priceUSD * rate);
      }
    } catch {}

    const webBase = process.env.APP_URL || 'https://test.logismart.ar';
    const preference = {
      items: [{ title: `SEH360 Plan ${planTier}`, quantity: 1, unit_price: priceARS, currency_id: 'ARS' }],
      external_reference: `${t}_${planTier}_${period}`,
      notification_url: `${webBase}/api/seh360/webhooks/mercadopago`,
      back_urls: {
        success: `${webBase}/seh360/configuracion?payment=success`,
        failure: `${webBase}/seh360/configuracion?payment=failed`,
        pending: `${webBase}/seh360/configuracion?payment=pending`,
      },
      auto_return: 'approved',
    };
    try {
      const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: { Authorization: `Bearer ${mpToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(preference),
      });
      const data = await mpRes.json();
      if (!mpRes.ok) return reply.code(mpRes.status).send({ error: data.message || 'Error MP', details: data });
      return reply.send({ id: data.id, init_point: data.init_point, sandbox_init_point: data.sandbox_init_point, priceARS, priceUSD });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Error creando preferencia', details: err.message });
    }
  });

  // POST /seh360/company-logo — upload consultora/company logo
  app.post(`${p}/company-logo`, async (req: any, reply: any) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req);
    if (!t) return reply.code(400).send({ error: 'Tenant required' });
    try {
      const data = await req.file();
      if (!data) return reply.code(400).send({ error: 'No file uploaded' });
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      if (buffer.length > 2 * 1024 * 1024) return reply.code(413).send({ error: 'Imagen demasiado grande (max 2MB)' });
      const mime = data.mimetype || 'image/png';
      const logoUrl = `data:${mime};base64,${buffer.toString('base64')}`;
      const existing = await (app as any).prisma.companySettings.findFirst({ where: { tenantId: t } });
      if (existing) {
        await (app as any).prisma.companySettings.update({ where: { id: existing.id }, data: { logoUrl, updatedAt: new Date(), updatedById: uid(req) || t } });
      } else {
        await (app as any).prisma.companySettings.create({ data: { tenantId: t, logoUrl, companyName: 'SEH360', updatedAt: new Date(), updatedById: uid(req) || t } });
      }
      return reply.send({ logoUrl });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Error al subir logo', details: err.message });
    }
  });
  // Ensure seh_tenant_plans table exists
  async function ensureTenantPlansTable() {
    try {
      await (app as any).prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS seh_tenant_plans (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "tenantId" UUID NOT NULL UNIQUE,
          "planTier" VARCHAR(50) DEFAULT 'TRIAL',
          status VARCHAR(50) DEFAULT 'TRIAL',
          "trialEndsAt" TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '3 days'),
          "planEndsAt" TIMESTAMPTZ,
          "mercadoPagoId" VARCHAR(255),
          "mercadoPagoRef" VARCHAR(255),
          "createdAt" TIMESTAMPTZ DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    } catch {}
    // Ensure optional columns exist
    try {
      await (app as any).prisma.$executeRawUnsafe(`ALTER TABLE seh_tenant_plans ADD COLUMN IF NOT EXISTS "maxClients" INTEGER DEFAULT 10`);
    } catch {}
    try {
      await (app as any).prisma.$executeRawUnsafe(`ALTER TABLE seh_tenant_plans ADD COLUMN IF NOT EXISTS "mercadoPagoId" VARCHAR(255)`);
    } catch {}
    try {
      await (app as any).prisma.$executeRawUnsafe(`ALTER TABLE seh_tenant_plans ADD COLUMN IF NOT EXISTS "mercadoPagoRef" VARCHAR(255)`);
    } catch {}
  }
  ensureTenantPlansTable();

  // GET /seh360/admin/tenants
  app.get(`${p}/admin/tenants`, async (req: any, reply: any) => {
    if (!await requireSehSuperAdmin(req, reply)) return;
    try {
      // Use raw SQL to avoid Prisma enum issues with SUPERADMIN role
      const adminUsers: any[] = await (app as any).prisma.$queryRawUnsafe(
        `SELECT id, "tenantId", email, "firstName", "lastName", role
         FROM seh_users
         WHERE role IN ('ADMIN','SUPERADMIN') AND "deletedAt" IS NULL AND "isActive" = true
         ORDER BY "createdAt" ASC`
      );

      // Group by tenantId
      const tenantMap: Record<string, any> = {};
      for (const u of adminUsers) {
        const tid = u.tenantId;
        if (!tenantMap[tid]) tenantMap[tid] = { id: tid, users: [] };
        tenantMap[tid].users.push({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role });
      }

      // Get company names via raw SQL
      const tenantIds = Object.keys(tenantMap);
      if (tenantIds.length > 0) {
        const companySettings: any[] = await (app as any).prisma.$queryRawUnsafe(
          `SELECT "tenantId"::text, "companyName", "logoUrl" FROM company_settings WHERE "tenantId"::text = ANY($1)`,
          tenantIds
        ).catch(() => []);
        for (const cs of companySettings) {
          if (tenantMap[cs.tenantId]) {
            tenantMap[cs.tenantId].name = cs.companyName;
            tenantMap[cs.tenantId].logoUrl = cs.logoUrl;
          }
        }

        // Get subscription plans
        const plans: any[] = await (app as any).prisma.$queryRawUnsafe(
          `SELECT "tenantId"::text, status, "planTier", "planEndsAt", "trialEndsAt", "maxClients", "mercadoPagoRef", "updatedAt"
           FROM seh_tenant_plans WHERE "tenantId"::text = ANY($1)`,
          tenantIds
        ).catch(() => []);
        for (const plan of plans) {
          if (tenantMap[plan.tenantId]) tenantMap[plan.tenantId].subscription = plan;
        }

        // Get client counts per tenant
        const clientCounts: any[] = await (app as any).prisma.$queryRawUnsafe(
          `SELECT "tenantId"::text as tid, COUNT(*)::int as cnt FROM seh_clients WHERE "tenantId"::text = ANY($1) AND "deletedAt" IS NULL GROUP BY "tenantId"`,
          tenantIds
        ).catch(() => []);
        for (const cc of clientCounts) {
          if (tenantMap[cc.tid]) tenantMap[cc.tid].clientCount = Number(cc.cnt);
        }
      }

      const tenants = Object.values(tenantMap).map((t: any) => ({
        ...t,
        slug: t.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || t.id.slice(0, 8),
        name: t.name || t.users[0]?.email?.split('@')[1] || `Tenant ${t.id.slice(0,8)}`,
        subscription: t.subscription || { planTier: 'TRIAL', status: 'TRIAL', trialEndsAt: null },
        clientCount: t.clientCount || 0,
      }));

      return reply.send({ tenants });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Error loading tenants', details: err.message });
    }
  });

  // POST /seh360/admin/tenants/:tenantId/toggle-subscription
  app.post(`${p}/admin/tenants/:tenantId/toggle-subscription`, async (req: any, reply: any) => {
    if (!await requireSehSuperAdmin(req, reply)) return;
    const { tenantId } = req.params as any;
    const { status, planTier, trialEndsAt, planEndsAt } = req.body as any;
    try {
      await ensureTenantPlansTable();
      await (app as any).prisma.$executeRawUnsafe(`
        INSERT INTO seh_tenant_plans ("tenantId", status, "planTier", "trialEndsAt", "planEndsAt", "updatedAt")
        VALUES ($1::uuid, $2, $3, $4::timestamptz, $5::timestamptz, NOW())
        ON CONFLICT ("tenantId") DO UPDATE SET
          status = EXCLUDED.status,
          "planTier" = EXCLUDED."planTier",
          "trialEndsAt" = COALESCE(EXCLUDED."trialEndsAt", seh_tenant_plans."trialEndsAt"),
          "planEndsAt" = COALESCE(EXCLUDED."planEndsAt", seh_tenant_plans."planEndsAt"),
          "updatedAt" = NOW()
      `, tenantId, status || 'ACTIVE', planTier || 'BASIC',
         trialEndsAt || null, planEndsAt || null);
      return reply.send({ ok: true });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Error updating subscription', details: err.message });
    }
  });

  // PUT /seh360/admin/tenants/:tenantId/plan
  app.put(`${p}/admin/tenants/:tenantId/plan`, async (req: any, reply: any) => {
    if (!await requireSehSuperAdmin(req, reply)) return;
    const { tenantId } = req.params as any;
    const { planTier, status, trialEndsAt, planEndsAt } = req.body as any;
    try {
      await ensureTenantPlansTable();
      await (app as any).prisma.$executeRawUnsafe(`
        INSERT INTO seh_tenant_plans ("tenantId", status, "planTier", "trialEndsAt", "planEndsAt", "updatedAt")
        VALUES ($1::uuid, $2, $3, $4::timestamptz, $5::timestamptz, NOW())
        ON CONFLICT ("tenantId") DO UPDATE SET
          status = EXCLUDED.status,
          "planTier" = EXCLUDED."planTier",
          "trialEndsAt" = COALESCE(EXCLUDED."trialEndsAt", seh_tenant_plans."trialEndsAt"),
          "planEndsAt" = COALESCE(EXCLUDED."planEndsAt", seh_tenant_plans."planEndsAt"),
          "updatedAt" = NOW()
      `, tenantId, status || 'ACTIVE', planTier || 'BASIC',
         trialEndsAt || null, planEndsAt || null);
      return reply.send({ ok: true });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Error updating plan', details: err.message });
    }
  });

  // GET /seh360/admin/mercadopago-status
  app.get(`${p}/admin/mercadopago-status`, async (req: any, reply: any) => {
    if (!await requireSehSuperAdmin(req, reply)) return;
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const publicKey = process.env.MERCADOPAGO_PUBLIC_KEY;
    let mpConnected = false;
    let mpError = '';
    if (token) {
      try {
        const res = await fetch('https://api.mercadopago.com/v1/account/bank_report/config', {
          headers: { Authorization: `Bearer ${token}` }
        });
        mpConnected = res.status !== 401;
      } catch (e: any) { mpError = e.message; }
    }
    return reply.send({
      configured: !!token,
      connected: mpConnected,
      hasPublicKey: !!publicKey,
      error: mpError || null,
    });
  });

  // POST /seh360/admin/tenants/:tenantId/god-mode
  app.post(`${p}/admin/tenants/:tenantId/god-mode`, async (req: any, reply: any) => {
    if (!await requireSehSuperAdmin(req, reply)) return;
    const { tenantId } = req.params as any;
    try {
      const adminUserRows: any[] = await (app as any).prisma.$queryRawUnsafe(
        `SELECT id, email, "firstName", "lastName", role, "tenantId" FROM seh_users WHERE "tenantId" = $1::uuid AND role IN ('ADMIN','SUPERADMIN') AND "isActive" = true AND "deletedAt" IS NULL LIMIT 1`,
        tenantId
      ).catch(() => []);
      const adminUser = adminUserRows[0] || null;
      if (!adminUser) return reply.code(404).send({ error: 'Admin user not found for tenant' });
      const token = (app as any).sehSignToken({ userId: adminUser.id, tenantId, email: adminUser.email, role: adminUser.role });
      return reply.send({ token, user: { id: adminUser.id, email: adminUser.email, firstName: adminUser.firstName, lastName: adminUser.lastName, role: adminUser.role, tenantId } });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Error in god mode', details: err.message });
    }
  });

  // POST /seh360/admin/tenants/:tenantId/users/:userId/reset-password
  app.post(`${p}/admin/tenants/:tenantId/users/:userId/reset-password`, async (req: any, reply: any) => {
    if (!await requireSehSuperAdmin(req, reply)) return;
    const { userId } = req.params as any;
    const { newPassword } = req.body as any;
    if (!newPassword || newPassword.length < 6) return reply.code(400).send({ error: 'Password must be at least 6 characters' });
    try {
      const argon2 = await import('argon2');
      const hash = await argon2.hash(newPassword);
      await (app as any).prisma.sehUser.update({ where: { id: userId }, data: { passwordHash: hash } });
      return reply.send({ ok: true });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Error resetting password', details: err.message });
    }
  });

  // POST /seh360/admin/tenants (create new tenant + admin user)
  app.post(`${p}/admin/tenants`, async (req: any, reply: any) => {
    if (!await requireSehSuperAdmin(req, reply)) return;
    const { name, email, password, firstName, lastName } = req.body as any;
    if (!email || !password || !name) return reply.code(400).send({ error: 'name, email, password required' });
    try {
      const argon2 = await import('argon2');
      const passwordHash = await argon2.hash(password);
      const newTenantId = require('crypto').randomUUID();
      const user = await (app as any).prisma.sehUser.create({
        data: { tenantId: newTenantId, email, passwordHash, firstName: firstName || name, lastName: lastName || '', role: 'ADMIN', isActive: true },
      });
      // Create default company settings
      await (app as any).prisma.companySettings.create({
        data: { tenantId: newTenantId, companyName: name, updatedAt: new Date(), updatedById: user.id },
      }).catch(() => {});
      // Send welcome email (non-blocking)
      sendWelcomeTenantEmail({ to: email, firstName: firstName || name, companyName: name, password }).catch(() => {});
      return reply.send({ ok: true, tenantId: newTenantId, userId: user.id });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Error creating tenant', details: err.message });
    }
  });

  // ── MERCADOPAGO WEBHOOK ──────────────────────────────────────────────────────

  // ── PAYMENTS / COBROS ──────────────────────────────────────────────────────

  // Ensure seh_payments table exists (auto-migration)
  async function ensurePaymentsTable() {
    try {
      await (app as any).prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS seh_payments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "tenantId" UUID NOT NULL,
          amount NUMERIC(12,2) NOT NULL DEFAULT 0,
          currency VARCHAR(10) DEFAULT 'ARS',
          "paymentDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "planTier" VARCHAR(50) DEFAULT 'BASIC',
          description VARCHAR(255),
          "providerRef" VARCHAR(255),
          "providerId" VARCHAR(255),
          status VARCHAR(50) DEFAULT 'APPROVED',
          "invoiceBase64" TEXT,
          "invoiceFilename" VARCHAR(255),
          "invoiceMime" VARCHAR(100),
          "createdAt" TIMESTAMPTZ DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    } catch {}
  }
  ensurePaymentsTable();

  // GET /seh360/admin/payments — all payments across tenants (superadmin only)
  app.get(`${p}/admin/payments`, async (req: any, reply: any) => {
    if (!await requireSehSuperAdmin(req, reply)) return;
    try {
      await ensurePaymentsTable();
      const payments: any[] = await (app as any).prisma.$queryRawUnsafe(`
        SELECT DISTINCT ON (sp.id) sp.*, su.email as "adminEmail", su."firstName", su."lastName"
        FROM seh_payments sp
        LEFT JOIN seh_users su ON su."tenantId" = sp."tenantId" AND su.role IN ('ADMIN','SUPERADMIN') AND su."isActive" = true AND su."deletedAt" IS NULL AND su.email != 'admin@seh360.com'
        ORDER BY sp.id, sp."paymentDate" DESC
        LIMIT 200
      `);
      // Get company names
      const tenantIds = [...new Set(payments.map((p: any) => p.tenantId.toString()))];
      let companyMap: Record<string, string> = {};
      if (tenantIds.length > 0) {
        const companies: any[] = await (app as any).prisma.$queryRawUnsafe(
          `SELECT "tenantId"::text, "companyName" FROM company_settings WHERE "tenantId"::text = ANY($1)`,
          tenantIds
        ).catch(() => []);
        for (const c of companies) companyMap[c.tenantId] = c.companyName;
      }
      const result = payments.map((p: any) => ({
        id: p.id,
        tenantId: p.tenantId,
        amount: Number(p.amount),
        currency: p.currency,
        paymentDate: p.paymentDate,
        createdAt: p.createdAt || p.paymentDate,
        planTier: p.planTier,
        description: p.description,
        providerRef: p.providerRef,
        providerId: p.providerId,
        status: p.status,
        hasInvoice: !!p.invoiceBase64,
        invoiceFilename: p.invoiceFilename,
        invoiceMime: p.invoiceMime,
        invoice: p.invoiceBase64 ? {
          invoiceNumber: p.invoiceFilename || 'Factura',
          pdfUrl: `/seh360/admin/payments/${p.id}/invoice`,
        } : null,
        tenant: {
          name: companyMap[p.tenantId?.toString()] || p.adminEmail?.split('@')[1] || 'Tenant',
          email: p.adminEmail,
          adminName: p.firstName ? `${p.firstName} ${p.lastName}` : p.adminEmail,
        },
      }));
      return reply.send({ success: true, payments: result });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // POST /seh360/admin/payments/:id/invoice — upload PDF invoice (superadmin)
  app.post(`${p}/admin/payments/:id/invoice`, async (req: any, reply: any) => {
    if (!await requireSehSuperAdmin(req, reply)) return;
    const { id } = req.params as any;
    try {
      const data = await req.file();
      if (!data) return reply.code(400).send({ error: 'No file uploaded' });
      if (data.mimetype !== 'application/pdf') return reply.code(400).send({ error: 'Solo se aceptan archivos PDF' });
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      if (buffer.length > 10 * 1024 * 1024) return reply.code(413).send({ error: 'PDF demasiado grande (max 10MB)' });
      const base64 = buffer.toString('base64');
      await (app as any).prisma.$executeRawUnsafe(
        `UPDATE seh_payments SET "invoiceBase64" = $1, "invoiceFilename" = $2, "invoiceMime" = 'application/pdf', "updatedAt" = NOW() WHERE id = $3::uuid`,
        base64, data.filename || 'factura.pdf', id
      );
      return reply.send({ success: true, message: 'Factura adjuntada correctamente' });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // PATCH /seh360/admin/payments/:id — edit payment (amount, date, description, currency)
  app.patch(`${p}/admin/payments/:id`, async (req: any, reply: any) => {
    if (!await requireSehSuperAdmin(req, reply)) return;
    const { id } = req.params as any;
    const { amount, currency, paymentDate, description, planTier, providerRef } = (req.body as any) || {};
    try {
      const fields: string[] = [];
      const vals: any[] = [];
      let idx = 1;
      if (amount !== undefined)      { fields.push(`amount = $${idx++}`);        vals.push(Number(amount)); }
      if (currency !== undefined)    { fields.push(`currency = $${idx++}`);      vals.push(currency); }
      if (paymentDate !== undefined) { fields.push(`"paymentDate" = $${idx++}::timestamptz`); vals.push(paymentDate); }
      if (description !== undefined) { fields.push(`description = $${idx++}`);   vals.push(description); }
      if (planTier !== undefined)    { fields.push(`"planTier" = $${idx++}`);     vals.push(planTier); }
      if (providerRef !== undefined) { fields.push(`"providerRef" = $${idx++}`); vals.push(providerRef); }
      if (!fields.length) return reply.code(400).send({ error: 'No fields to update' });
      fields.push(`"updatedAt" = NOW()`);
      vals.push(id);
      await (app as any).prisma.$executeRawUnsafe(
        `UPDATE seh_payments SET ${fields.join(', ')} WHERE id = $${idx}::uuid`, ...vals
      );
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // DELETE /seh360/admin/payments/:id — delete payment record
  app.delete(`${p}/admin/payments/:id`, async (req: any, reply: any) => {
    if (!await requireSehSuperAdmin(req, reply)) return;
    const { id } = req.params as any;
    try {
      await (app as any).prisma.$executeRawUnsafe(`DELETE FROM seh_payments WHERE id = $1::uuid`, id);
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // GET /seh360/admin/payments/:id/invoice — download/view invoice (superadmin or tenant owner)
  app.get(`${p}/admin/payments/:id/invoice`, async (req: any, reply: any) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const { id } = req.params as any;
    try {
      const rows: any[] = await (app as any).prisma.$queryRawUnsafe(
        `SELECT "invoiceBase64", "invoiceFilename", "tenantId" FROM seh_payments WHERE id = $1::uuid LIMIT 1`, id
      );
      const payment = rows[0];
      if (!payment || !payment.invoiceBase64) return reply.code(404).send({ error: 'Factura no encontrada' });
      // Allow superadmin or the tenant owner
      const isAdmin = req.sehAuth.email === 'admin@seh360.com' || req.sehAuth.role === 'SUPERADMIN';
      const isOwner = req.sehAuth.tenantId === payment.tenantId?.toString();
      if (!isAdmin && !isOwner) return reply.code(403).send({ error: 'No autorizado' });
      const buffer = Buffer.from(payment.invoiceBase64, 'base64');
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `inline; filename="${payment.invoiceFilename || 'factura.pdf'}"`);
      return reply.send(buffer);
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // GET /seh360/billing/payments — tenant's own payment history
  app.get(`${p}/billing/payments`, async (req: any, reply: any) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req);
    if (!t) return reply.code(400).send({ error: 'Tenant required' });
    try {
      await ensurePaymentsTable();
      const payments: any[] = await (app as any).prisma.$queryRawUnsafe(
        `SELECT id, amount, currency, "paymentDate", "planTier", description, "providerRef", status,
                "invoiceFilename", "invoiceMime", ("invoiceBase64" IS NOT NULL) as "hasInvoice", "createdAt"
         FROM seh_payments WHERE "tenantId" = $1::uuid ORDER BY "paymentDate" DESC`, t
      );
      const result = payments.map((p: any) => ({
        id: p.id,
        amount: Number(p.amount),
        currency: p.currency,
        paymentDate: p.paymentDate,
        createdAt: p.createdAt || p.paymentDate,
        planTier: p.planTier,
        description: p.description,
        providerRef: p.providerRef,
        status: p.status,
        hasInvoice: !!p.hasInvoice,
        invoiceFilename: p.invoiceFilename,
        invoice: p.hasInvoice ? {
          invoiceNumber: p.invoiceFilename || 'Factura',
          pdfUrl: `/seh360/admin/payments/${p.id}/invoice`,
        } : null,
      }));
      return reply.send({ success: true, payments: result });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // POST /seh360/webhooks/mercadopago
  app.post(`${p}/webhooks/mercadopago`, { config: { rawBody: true } } as any, async (req: any, reply: any) => {
    try {
      const body = req.body as any;
      const query = (req.query as any) || {};
      // MP sends webhooks in multiple formats:
      // New format:  body = { action, data: { id } }
      // IPN format:  query = { id, topic:'payment' }
      // IPN format2: query = { 'data.id', type:'payment' }
      let paymentId = body?.data?.id
        || (query?.type === 'payment' ? query?.['data.id'] : null)
        || (query?.topic === 'payment' ? query?.id : null)
        || body?.id;

      // If it's a merchant_order notification, fetch order to get payment ID
      if (!paymentId && (query?.topic === 'merchant_order' || body?.topic === 'merchant_order')) {
        const orderId = query?.id || body?.id;
        if (orderId) {
          const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
          try {
            const orderRes = await fetch(`https://api.mercadopago.com/merchant_orders/${orderId}`, {
              headers: { Authorization: `Bearer ${mpToken}` }
            });
            const order = await orderRes.json();
            const approved = (order.payments || []).find((p: any) => p.status === 'approved');
            if (approved) paymentId = approved.id;
          } catch {}
        }
      }

      if (!paymentId) return reply.send({ ok: true });

      const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (!mpToken) return reply.send({ ok: true });

      // Fetch payment details from MP
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${mpToken}` }
      });
      const payment = await mpRes.json();

      if (payment.status !== 'approved') return reply.send({ ok: true });

      // Extract tenantId from external_reference
      // Formats: tenantId_planTier_period  OR  tenantId_ADDON_CLIENTS_qty
      const ref = payment.external_reference || '';
      const parts = ref.split('_');
      const tenantId = parts[0];

      if (!tenantId || tenantId.length < 32) return reply.send({ ok: true });

      await ensureTenantPlansTable();

      // Check if this is an addon-client payment
      if (parts[1] === 'ADDON' && parts[2] === 'CLIENTS') {
        const qty = parseInt(parts[3]) || 1;
        await (app as any).prisma.$executeRawUnsafe(`
          INSERT INTO seh_tenant_plans ("tenantId", status, "planTier", "maxClients", "updatedAt")
          VALUES ($1::uuid, 'ACTIVE', 'BASIC', $2, NOW())
          ON CONFLICT ("tenantId") DO UPDATE SET
            "maxClients" = COALESCE(seh_tenant_plans."maxClients", 10) + $2,
            "updatedAt" = NOW()
        `, tenantId, qty);
        console.log(`[SEH360 MP Webhook] Added ${qty} client slots for tenant ${tenantId}, payment ${paymentId}`);
        return reply.send({ ok: true });
      }

      // Otherwise activate plan subscription
      const planTier = parts[1] || 'BASIC';
      const planEndsAt = new Date();
      planEndsAt.setMonth(planEndsAt.getMonth() + 1);

      await (app as any).prisma.$executeRawUnsafe(`
        INSERT INTO seh_tenant_plans ("tenantId", status, "planTier", "planEndsAt", "mercadoPagoId", "mercadoPagoRef", "updatedAt")
        VALUES ($1::uuid, 'ACTIVE', $2, $3::timestamptz, $4, $5, NOW())
        ON CONFLICT ("tenantId") DO UPDATE SET
          status = 'ACTIVE',
          "planTier" = EXCLUDED."planTier",
          "planEndsAt" = EXCLUDED."planEndsAt",
          "mercadoPagoId" = EXCLUDED."mercadoPagoId",
          "mercadoPagoRef" = EXCLUDED."mercadoPagoRef",
          "updatedAt" = NOW()
      `, tenantId, planTier, planEndsAt.toISOString(), String(paymentId), ref);

      // Record payment in seh_payments
      try {
        const mpAmount = Number(payment.transaction_amount) || 0;
        const mpCurrency = payment.currency_id || 'ARS'; // MP Argentina always returns ARS
        await (app as any).prisma.$executeRawUnsafe(`
          INSERT INTO seh_payments ("tenantId", amount, currency, "paymentDate", "planTier", description, "providerRef", "providerId", status)
          VALUES ($1::uuid, $2, $3, NOW(), $4, $5, $6, $7, 'APPROVED')
          ON CONFLICT DO NOTHING
        `, tenantId, mpAmount, mpCurrency, planTier, `Plan ${planTier} SEH360 - 1 mes`, ref, String(paymentId));
      } catch {}
      console.log(`[SEH360 MP Webhook] Activated plan ${planTier} for tenant ${tenantId}, payment ${paymentId}`);
      return reply.send({ ok: true });
    } catch (err: any) {
      console.error('[SEH360 MP Webhook] Error:', err.message);
      return reply.send({ ok: true }); // Always 200 to MP
    }
  });

  // GET /seh360/admin/subscription-status (check current tenant's subscription)
  app.get(`${p}/admin/subscription-status`, async (req: any, reply: any) => {
    const t = tid(req);
    if (!t) return reply.code(401).send({ error: 'No autorizado' });
    try {
      await ensureTenantPlansTable();
      const rows = await (app as any).prisma.$queryRawUnsafe(
        `SELECT * FROM seh_tenant_plans WHERE "tenantId" = $1::uuid`,
        t
      ).catch(() => []);
      const plan = (rows as any[])[0] || { planTier: 'TRIAL', status: 'TRIAL', trialEndsAt: null };
      const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
      return reply.send({
        subscription: plan,
        mercadopago: { configured: !!mpToken, publicKey: process.env.MERCADOPAGO_PUBLIC_KEY || null },
      });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

}
