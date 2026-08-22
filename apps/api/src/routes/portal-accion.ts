import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import {
  generatePortalToken,
  hashToken,
  getTokenPrefix,
  createSession,
  isSessionValid,
  isAccessValid,
  FIELDS_REQUIRING_APPROVAL,
  FIELDS_DIRECT_EDIT,
  ALL_EDITABLE_FIELDS,
} from '../services/portal-token.js';
import {
  sendEmail,
  portalInvitationEmail,
  portalDraftSubmittedEmail,
  portalDraftResultEmail,
  portalRevokedEmail,
  portalNcrSubmittedEmail,
  portalNcrReviewResultEmail,
  portalNcrInternalNotificationEmail,
} from '../services/email.js';
import { getStorage } from '../services/storage.js';

const USER_SELECT = { id: true, email: true, firstName: true, lastName: true };

function planInclude() {
  return {
    ncr: { select: { id: true, code: true, title: true, severity: true, status: true } },
    executor: { select: USER_SELECT },
    supervisor: { select: USER_SELECT },
    effectivenessChecker: { select: USER_SELECT },
    closedBy: { select: USER_SELECT },
    approvedCloseBy: { select: USER_SELECT },
    codeAssignedBy: { select: USER_SELECT },
    createdBy: { select: USER_SELECT },
    _count: { select: { attachments: true, logs: true } },
  };
}

async function addLog(
  tx: any,
  actionPlanId: string,
  userId: string | null | undefined,
  action: string,
  field?: string | null,
  oldValue?: string | null,
  newValue?: string | null,
  note?: string | null,
) {
  await tx.actionPlanLog.create({
    data: { actionPlanId, userId: userId ?? null, action, field: field ?? null, oldValue: oldValue ?? null, newValue: newValue ?? null, note: note ?? null },
  });
}

async function addPortalLog(
  prisma: any,
  accessTokenId: string,
  action: string,
  actionPlanId?: string,
  field?: string,
  oldValue?: string,
  newValue?: string,
  ip?: string,
  ua?: string,
) {
  await prisma.portalAccessLog.create({
    data: {
      accessTokenId,
      action,
      actionPlanId: actionPlanId ?? null,
      field: field ?? null,
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
      ipAddress: ip ?? null,
      userAgent: ua ?? null,
    },
  });
}

async function verifyToken(prisma: any, token: string) {
  const tokenHash = hashToken(token);
  const access = await prisma.portalAccessToken.findFirst({
    where: { tokenHash },
    include: { tenant: { select: { id: true, name: true } } },
  });
  if (!access) return null;
  const check = isAccessValid(access);
  if (!check.valid) return { access, error: check.reason };
  return { access, error: null };
}

async function getCompanyBranding(prisma: any, tenantId: string) {
  const settings = await prisma.companySettings.findUnique({
    where: { tenantId },
    select: { logoUrl: true, primaryColor: true },
  }).catch(() => null);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
  return {
    name: tenant?.name ?? 'Empresa',
    logoUrl: settings?.logoUrl ?? null,
    primaryColor: settings?.primaryColor ?? '#2563eb',
  };
}

export const portalAccionRoutes: FastifyPluginAsync = async (app) => {
  // ════════════════════════════════════════════════════════════════════
  // RUTAS PÚBLICAS (sin auth — validadas por token hasheado)
  // ════════════════════════════════════════════════════════════════════

  // ── GET /portal-accion/public/:token — validar token y cargar planes ──
  app.get('/public/:token', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;
    const result = await verifyToken(app.prisma, token);
    if (!result) return reply.code(404).send({ error: 'Token no encontrado' });
    if (result.error) return reply.code(403).send({ error: result.error });

    const access = result.access;
    const prisma = app.prisma;

    // Update access metadata
    await prisma.portalAccessToken.update({
      where: { id: access.id },
      data: {
        lastAccessAt: new Date(),
        accessCount: { increment: 1 },
      },
    });

    // Build filter for plans
    const where: any = { tenantId: access.tenantId };
    if (access.area) where.area = access.area;
    if (access.process) where.process = access.process;
    if (access.executorId) where.executorId = access.executorId;

    const [plans, branding] = await Promise.all([
      prisma.actionPlan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: planInclude(),
      }),
      getCompanyBranding(prisma, access.tenantId),
    ]);

    await addPortalLog(prisma, access.id, 'LOGIN', undefined, undefined, undefined, undefined, req.ip, req.headers['user-agent']);

    return reply.send({
      access: {
        id: access.id,
        recipientName: access.recipientName,
        recipientEmail: access.recipientEmail,
        sector: access.sector,
        area: access.area,
        process: access.process,
        canEdit: access.canEdit,
        canAttachEvidence: access.canAttachEvidence,
        canDownloadPdf: access.canDownloadPdf,
        canChangeStatus: access.canChangeStatus,
        canEditFields: access.canEditFields,
        expiresAt: access.expiresAt,
      },
      branding,
      plans: plans.map((p: any) => ({
        ...p,
        attachments: undefined,
        logs: undefined,
      })),
    });
  });

  // ── POST /portal-accion/public/:token/session — iniciar sesión ──
  app.post('/public/:token/session', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;
    const result = await verifyToken(app.prisma, token);
    if (!result) return reply.code(404).send({ error: 'Token no encontrado' });
    if (result.error) return reply.code(403).send({ error: result.error });

    const session = createSession();
    await app.prisma.portalAccessToken.update({
      where: { id: result.access.id },
      data: {
        sessionToken: session.sessionToken,
        sessionExpiresAt: session.sessionExpiresAt,
      },
    });

    return reply.send({ sessionToken: session.sessionToken, expiresAt: session.sessionExpiresAt });
  });

  // ── POST /portal-accion/public/:token/heartbeat — mantener sesión ──
  app.post('/public/:token/heartbeat', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;
    const result = await verifyToken(app.prisma, token);
    if (!result) return reply.code(404).send({ error: 'Token no encontrado' });
    if (result.error) return reply.code(403).send({ error: result.error });

    const newExpiry = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await app.prisma.portalAccessToken.update({
      where: { id: result.access.id },
      data: { sessionExpiresAt: newExpiry },
    });

    return reply.send({ ok: true, expiresAt: newExpiry });
  });

  // ── GET /portal-accion/public/:token/plans/:planId — detalle de un plan ──
  app.get('/public/:token/plans/:planId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token, planId } = req.params as any;
    const result = await verifyToken(app.prisma, token);
    if (!result) return reply.code(404).send({ error: 'Token no encontrado' });
    if (result.error) return reply.code(403).send({ error: result.error });

    const access = result.access;
    const where: any = { id: planId, tenantId: access.tenantId };
    if (access.area) where.area = access.area;
    if (access.executorId) where.executorId = access.executorId;

    const plan = await app.prisma.actionPlan.findFirst({
      where,
      include: {
        ...planInclude(),
        attachments: { orderBy: { createdAt: 'desc' } },
        logs: { orderBy: { createdAt: 'desc' }, take: 20, include: { user: { select: USER_SELECT } } },
      },
    });

    if (!plan) return reply.code(404).send({ error: 'Plan no encontrado' });

    // Get pending drafts for this plan by this access
    const drafts = await app.prisma.portalDraftSnapshot.findMany({
      where: { accessTokenId: access.id, actionPlanId: planId, status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'] } },
      orderBy: { createdAt: 'desc' },
    });

    await addPortalLog(app.prisma, access.id, 'VIEW', planId, undefined, undefined, undefined, req.ip, req.headers['user-agent']);

    return reply.send({ plan, drafts });
  });

  // ── PATCH /portal-accion/public/:token/plans/:planId — editar plan ──
  app.patch('/public/:token/plans/:planId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token, planId } = req.params as any;
    const result = await verifyToken(app.prisma, token);
    if (!result) return reply.code(404).send({ error: 'Token no encontrado' });
    if (result.error) return reply.code(403).send({ error: result.error });

    const access = result.access;
    if (!access.canEdit) return reply.code(403).send({ error: 'No tiene permiso de edición' });

    const body = req.body as any;
    if (!body || typeof body !== 'object') return reply.code(400).send({ error: 'Body requerido' });

    // Validate fields
    const allowedFields = access.canEditFields.length > 0 ? access.canEditFields : ALL_EDITABLE_FIELDS;
    const requestedFields = Object.keys(body);
    const invalidFields = requestedFields.filter((f) => !allowedFields.includes(f));
    if (invalidFields.length > 0) return reply.code(403).send({ error: 'Campos no editables', fields: invalidFields });

    // Check for fields requiring approval
    const approvalFields = requestedFields.filter((f) => FIELDS_REQUIRING_APPROVAL.includes(f));
    const directFields = requestedFields.filter((f) => FIELDS_DIRECT_EDIT.includes(f));

    const where: any = { id: planId, tenantId: access.tenantId };
    if (access.area) where.area = access.area;
    if (access.executorId) where.executorId = access.executorId;

    const plan = await app.prisma.actionPlan.findFirst({ where });
    if (!plan) return reply.code(404).send({ error: 'Plan no encontrado' });

    // Concurrency check
    if (body._expectedUpdatedAt) {
      const expected = new Date(body._expectedUpdatedAt);
      if (new Date(plan.updatedAt).getTime() !== expected.getTime()) {
        return reply.code(409).send({
          error: 'Conflicto de concurrencia',
          message: 'El plan fue modificado después de tu última lectura',
          serverUpdatedAt: plan.updatedAt,
        });
      }
    }

    // Apply direct edits
    if (directFields.length > 0) {
      const updateData: any = {};
      for (const f of directFields) {
        if (['plannedStartDate', 'plannedEndDate'].includes(f)) {
          updateData[f] = body[f] ? new Date(body[f]) : null;
        } else {
          updateData[f] = body[f];
        }
      }
      updateData.updatedById = null;
      updateData.updatedAt = new Date();

      await app.prisma.actionPlan.update({ where: { id: planId }, data: updateData });

      for (const f of directFields) {
        const oldVal = String((plan as any)[f] ?? '');
        const newVal = String(body[f] ?? '');
        if (oldVal !== newVal) {
          await addLog(app.prisma, planId, null, 'PORTAL_UPDATE', f, oldVal, newVal, `Editado por ${access.recipientName} vía portal`);
          await addPortalLog(app.prisma, access.id, 'EDIT', planId, f, oldVal, newVal, req.ip, req.headers['user-agent']);
        }
      }
    }

    // Save approval fields as draft
    if (approvalFields.length > 0) {
      const draftData: any = {};
      for (const f of approvalFields) {
        draftData[f] = body[f];
      }

      // Check if there's an existing DRAFT for this plan+access
      const existingDraft = await app.prisma.portalDraftSnapshot.findFirst({
        where: { accessTokenId: access.id, actionPlanId: planId, status: 'DRAFT' },
        orderBy: { createdAt: 'desc' },
      });

      if (existingDraft) {
        await app.prisma.portalDraftSnapshot.update({
          where: { id: existingDraft.id },
          data: { draftData: { ...(existingDraft.draftData as any), ...draftData } },
        });
      } else {
        await app.prisma.portalDraftSnapshot.create({
          data: {
            accessTokenId: access.id,
            actionPlanId: planId,
            draftData,
            status: 'DRAFT',
          },
        });
      }

      for (const f of approvalFields) {
        const oldVal = String((plan as any)[f] ?? '');
        const newVal = String(body[f] ?? '');
        await addPortalLog(app.prisma, access.id, 'DRAFT_SAVE', planId, f, oldVal, newVal, req.ip, req.headers['user-agent']);
      }
    }

    const updated = await app.prisma.actionPlan.findFirst({
      where: { id: planId },
      include: planInclude(),
    });

    return reply.send({
      plan: updated,
      directApplied: directFields,
      pendingApproval: approvalFields,
      message: approvalFields.length > 0
        ? 'Algunos cambios requieren aprobación interna'
        : 'Cambios guardados correctamente',
    });
  });

  // ── POST /portal-accion/public/:token/plans/:planId/submit — submit draft ──
  app.post('/public/:token/plans/:planId/submit', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token, planId } = req.params as any;
    const result = await verifyToken(app.prisma, token);
    if (!result) return reply.code(404).send({ error: 'Token no encontrado' });
    if (result.error) return reply.code(403).send({ error: result.error });

    const access = result.access;
    const draft = await app.prisma.portalDraftSnapshot.findFirst({
      where: { accessTokenId: access.id, actionPlanId: planId, status: 'DRAFT' },
      orderBy: { createdAt: 'desc' },
    });

    if (!draft) return reply.code(404).send({ error: 'No hay borrador pendiente' });

    await app.prisma.portalDraftSnapshot.update({
      where: { id: draft.id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });

    await addPortalLog(app.prisma, access.id, 'SUBMIT', planId, undefined, undefined, undefined, req.ip, req.headers['user-agent']);

    // Notify internal supervisors
    const plan = await app.prisma.actionPlan.findFirst({
      where: { id: planId },
      select: { code: true, supervisorId: true, tenantId: true },
    });

    if (plan?.supervisorId) {
      const supervisor = await app.prisma.platformUser.findUnique({
        where: { id: plan.supervisorId },
        select: { email: true },
      });
      if (supervisor?.email) {
        const appUrl = process.env.CORS_ORIGIN || process.env.APP_URL || 'https://logismart.ar';
        sendEmail(portalDraftSubmittedEmail(supervisor.email, access.recipientName, plan.code || planId, `${appUrl}/plan-accion`))
          .catch(() => {});
      }
    }

    return reply.send({ ok: true, message: 'Borrador enviado para revisión' });
  });

  // ── POST /portal-accion/public/:token/plans/:planId/attachments — subir evidencia ──
  app.post('/public/:token/plans/:planId/attachments', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token, planId } = req.params as any;
    const result = await verifyToken(app.prisma, token);
    if (!result) return reply.code(404).send({ error: 'Token no encontrado' });
    if (result.error) return reply.code(403).send({ error: result.error });

    const access = result.access;
    if (!access.canAttachEvidence) return reply.code(403).send({ error: 'No tiene permiso para adjuntar evidencias' });

    const where: any = { id: planId, tenantId: access.tenantId };
    if (access.area) where.area = access.area;
    if (access.executorId) where.executorId = access.executorId;

    const plan = await app.prisma.actionPlan.findFirst({ where });
    if (!plan) return reply.code(404).send({ error: 'Plan no encontrado' });

    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'No se proporcionó archivo' });

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    if (fileBuffer.length > 10 * 1024 * 1024) {
      return reply.code(400).send({ error: 'Archivo demasiado grande. Máximo 10MB.' });
    }

    const storage = getStorage();
    const storageKey = `portal-accion/${access.tenantId}/${planId}/${Date.now()}-${data.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await storage.upload(storageKey, fileBuffer, data.mimetype);

    const attachment = await app.prisma.actionPlanAttachment.create({
      data: {
        actionPlanId: planId,
        filename: data.filename,
        url: `/storage/${storageKey}`,
        mimeType: data.mimetype,
        size: fileBuffer.length,
        uploadedById: undefined,
      },
    });

    await addLog(app.prisma, planId, undefined, 'PORTAL_ATTACHMENT', 'Adjunto', undefined, data.filename, `Subido por ${access.recipientName} vía portal`);
    await addPortalLog(app.prisma, access.id, 'ATTACH', planId, 'Adjunto', undefined, data.filename, req.ip, req.headers['user-agent']);

    return reply.code(201).send({ attachment });
  });

  // ── DELETE /portal-accion/public/:token/plans/:planId/attachments/:attId ──
  app.delete('/public/:token/plans/:planId/attachments/:attId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token, planId, attId } = req.params as any;
    const result = await verifyToken(app.prisma, token);
    if (!result) return reply.code(404).send({ error: 'Token no encontrado' });
    if (result.error) return reply.code(403).send({ error: result.error });

    const access = result.access;
    if (!access.canAttachEvidence) return reply.code(403).send({ error: 'No tiene permiso' });

    const att = await app.prisma.actionPlanAttachment.findFirst({
      where: { id: attId, actionPlanId: planId },
    });
    if (!att) return reply.code(404).send({ error: 'Adjunto no encontrado' });

    // Only allow deleting attachments uploaded via portal (uploadedById is null)
    if (att.uploadedById !== null) {
      return reply.code(403).send({ error: 'Solo podés eliminar evidencias subidas vía portal' });
    }

    await app.prisma.actionPlanAttachment.delete({ where: { id: attId } });
    await addLog(app.prisma, planId, undefined, 'PORTAL_ATTACHMENT_REMOVED', 'Adjunto', att.filename, undefined, `Eliminado por ${access.recipientName} vía portal`);
    await addPortalLog(app.prisma, access.id, 'ATTACH_DELETE', planId, 'Adjunto', att.filename, undefined, req.ip, req.headers['user-agent']);

    return reply.send({ success: true });
  });

  // ── GET /portal-accion/public/:token/plans/:planId/pdf — descargar PDF ──
  app.get('/public/:token/plans/:planId/pdf', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token, planId } = req.params as any;
    const result = await verifyToken(app.prisma, token);
    if (!result) return reply.code(404).send({ error: 'Token no encontrado' });
    if (result.error) return reply.code(403).send({ error: result.error });

    const access = result.access;
    if (!access.canDownloadPdf) return reply.code(403).send({ error: 'No tiene permiso para descargar PDF' });

    const where: any = { id: planId, tenantId: access.tenantId };
    if (access.area) where.area = access.area;
    if (access.executorId) where.executorId = access.executorId;

    const plan = await app.prisma.actionPlan.findFirst({
      where,
      include: {
        ...planInclude(),
        ncr: { select: { id: true, code: true, title: true, description: true, severity: true, status: true } },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!plan) return reply.code(404).send({ error: 'Plan no encontrado' });

    const branding = await getCompanyBranding(app.prisma, access.tenantId);

    // Generate PDF using Puppeteer
    const html = buildPlanPdfHtml(plan, branding);
    // @ts-ignore - puppeteer ya está instalado en el proyecto
    const puppeteer = (await import('puppeteer')).default;
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      });
      await browser.close();

      await addPortalLog(app.prisma, access.id, 'DOWNLOAD_PDF', planId, undefined, undefined, undefined, req.ip, req.headers['user-agent']);

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="plan-${plan.code || planId}.pdf"`);
      return reply.send(pdfBuffer);
    } catch (err: any) {
      await browser.close();
      console.error('[PORTAL PDF] Error:', err);
      return reply.code(500).send({ error: 'Error generando PDF' });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // RUTAS ADMINISTRATIVAS (con auth)
  // ════════════════════════════════════════════════════════════════════

  // ── POST /portal-accion/admin/access — crear acceso externo ──
  app.post('/admin/access', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const schema = z.object({
      recipientName: z.string().min(1).max(200),
      recipientEmail: z.string().email(),
      recipientPhone: z.string().max(50).optional(),
      sector: z.string().optional(),
      area: z.string().optional(),
      process: z.string().optional(),
      executorId: z.string().uuid().nullable().optional(),
      canEdit: z.boolean().default(true),
      canAttachEvidence: z.boolean().default(true),
      canDownloadPdf: z.boolean().default(true),
      canChangeStatus: z.boolean().default(false),
      canEditFields: z.array(z.string()).default([]),
      canCreateNonConformities: z.boolean().default(false),
      canViewNcrOwn: z.boolean().default(true),
      canViewNcrScope: z.boolean().default(false),
      canEditNcrDraft: z.boolean().default(true),
      canCorrectNcrReturned: z.boolean().default(true),
      canDownloadNcrPdf: z.boolean().default(true),
      expiresAt: z.string().optional().nullable(),
      maxAccesses: z.number().int().optional().nullable(),
      sendEmail: z.boolean().default(true),
    });

    let body: any;
    try {
      body = schema.parse(req.body);
    } catch (e: any) {
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors });
    }

    const rawToken = generatePortalToken();
    const tokenHash = hashToken(rawToken);
    const tokenPrefix = getTokenPrefix(rawToken);

    const access = await app.prisma.portalAccessToken.create({
      data: {
        tenantId,
        tokenHash,
        tokenPrefix,
        recipientName: body.recipientName,
        recipientEmail: body.recipientEmail,
        recipientPhone: body.recipientPhone ?? null,
        sector: body.sector ?? null,
        area: body.area ?? null,
        process: body.process ?? null,
        executorId: body.executorId ?? null,
        canEdit: body.canEdit,
        canAttachEvidence: body.canAttachEvidence,
        canDownloadPdf: body.canDownloadPdf,
        canChangeStatus: body.canChangeStatus,
        canEditFields: body.canEditFields,
        canCreateNonConformities: body.canCreateNonConformities,
        canViewNcrOwn: body.canViewNcrOwn,
        canViewNcrScope: body.canViewNcrScope,
        canEditNcrDraft: body.canEditNcrDraft,
        canCorrectNcrReturned: body.canCorrectNcrReturned,
        canDownloadNcrPdf: body.canDownloadNcrPdf,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        maxAccesses: body.maxAccesses ?? null,
        createdById: req.auth?.userId ?? null,
      },
    });

    // Send invitation email
    if (body.sendEmail) {
      const tenant = await app.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
      const appUrl = process.env.CORS_ORIGIN || process.env.APP_URL || 'https://logismart.ar';
      const portalUrl = `${appUrl}/portal-accion/${rawToken}`;
      const sectorLabel = [body.sector, body.area, body.process].filter(Boolean).join(' — ') || 'Todos los sectores';

      sendEmail(portalInvitationEmail(
        body.recipientEmail,
        body.recipientName,
        portalUrl,
        sectorLabel,
        tenant?.name ?? 'Empresa',
        body.expiresAt ? new Date(body.expiresAt) : null,
      )).catch((e: any) => console.error('[PORTAL] Error sending invitation email:', e.message));
    }

    return reply.code(201).send({
      access: { ...access, token: rawToken },
      message: 'Acceso creado' + (body.sendEmail ? ' y email enviado' : ''),
    });
  });

  // ── GET /portal-accion/admin/access — listar accesos ──
  app.get('/admin/access', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const { status } = (req.query as any) || {};
    const where: any = { tenantId };
    if (status && status !== 'ALL') where.status = status;

    const accesses = await app.prisma.portalAccessToken.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: USER_SELECT },
        _count: { select: { logs: true, drafts: true } },
      },
    });

    return reply.send({ accesses });
  });

  // ── GET /portal-accion/admin/access/:id — detalle + logs ──
  app.get('/admin/access/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as any;

    const access = await app.prisma.portalAccessToken.findFirst({
      where: { id, tenantId },
      include: {
        createdBy: { select: USER_SELECT },
        logs: { orderBy: { createdAt: 'desc' }, take: 100 },
        drafts: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!access) return reply.code(404).send({ error: 'Acceso no encontrado' });
    return reply.send({ access });
  });

  // ── PATCH /portal-accion/admin/access/:id — modificar permisos ──
  app.patch('/admin/access/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as any;

    const schema = z.object({
      canEdit: z.boolean().optional(),
      canAttachEvidence: z.boolean().optional(),
      canDownloadPdf: z.boolean().optional(),
      canChangeStatus: z.boolean().optional(),
      canEditFields: z.array(z.string()).optional(),
      canCreateNonConformities: z.boolean().optional(),
      canViewNcrOwn: z.boolean().optional(),
      canViewNcrScope: z.boolean().optional(),
      canEditNcrDraft: z.boolean().optional(),
      canCorrectNcrReturned: z.boolean().optional(),
      canDownloadNcrPdf: z.boolean().optional(),
      expiresAt: z.string().nullable().optional(),
      maxAccesses: z.number().int().nullable().optional(),
      status: z.enum(['ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED']).optional(),
    });

    let body: any;
    try {
      body = schema.parse(req.body);
    } catch (e: any) {
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors });
    }

    const updateData: any = { ...body };
    if (body.expiresAt !== undefined) updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    const updated = await app.prisma.portalAccessToken.updateMany({
      where: { id, tenantId },
      data: updateData,
    });

    if (updated.count === 0) return reply.code(404).send({ error: 'Acceso no encontrado' });
    return reply.send({ ok: true });
  });

  // ── POST /portal-accion/admin/access/:id/revoke — revocar ──
  app.post('/admin/access/:id/revoke', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as any;
    const { reason } = (req.body as any) || {};

    const access = await app.prisma.portalAccessToken.findFirst({ where: { id, tenantId } });
    if (!access) return reply.code(404).send({ error: 'Acceso no encontrado' });

    await app.prisma.portalAccessToken.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedById: req.auth?.userId ?? null,
        revokeReason: reason ?? null,
        sessionToken: null,
        sessionExpiresAt: null,
      },
    });

    // Notify recipient
    sendEmail(portalRevokedEmail(access.recipientEmail, access.recipientName, reason ?? ''))
      .catch(() => {});

    return reply.send({ ok: true });
  });

  // ── POST /portal-accion/admin/access/:id/suspend — suspender ──
  app.post('/admin/access/:id/suspend', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as any;

    const updated = await app.prisma.portalAccessToken.updateMany({
      where: { id, tenantId, status: 'ACTIVE' },
      data: { status: 'SUSPENDED', sessionToken: null, sessionExpiresAt: null },
    });

    if (updated.count === 0) return reply.code(404).send({ error: 'Acceso no encontrado o no activo' });
    return reply.send({ ok: true });
  });

  // ── POST /portal-accion/admin/access/:id/reactivate — reactivar ──
  app.post('/admin/access/:id/reactivate', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as any;

    const updated = await app.prisma.portalAccessToken.updateMany({
      where: { id, tenantId, status: 'SUSPENDED' },
      data: { status: 'ACTIVE' },
    });

    if (updated.count === 0) return reply.code(404).send({ error: 'Acceso no encontrado o no suspendido' });
    return reply.send({ ok: true });
  });

  // ── POST /portal-accion/admin/send-links — enviar links a responsables ──
  app.post('/admin/send-links', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const schema = z.object({
      planIds: z.array(z.string().uuid()).min(1),
      recipientName: z.string().min(1),
      recipientEmail: z.string().email(),
      sector: z.string().optional(),
      area: z.string().optional(),
      canEdit: z.boolean().default(true),
      canAttachEvidence: z.boolean().default(true),
      canDownloadPdf: z.boolean().default(true),
      canCreateNonConformities: z.boolean().default(false),
      canViewNcrOwn: z.boolean().default(true),
      canViewNcrScope: z.boolean().default(false),
      canEditNcrDraft: z.boolean().default(true),
      canCorrectNcrReturned: z.boolean().default(true),
      canDownloadNcrPdf: z.boolean().default(true),
      expiresAt: z.string().optional().nullable(),
    });

    let body: any;
    try {
      body = schema.parse(req.body);
    } catch (e: any) {
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors });
    }

    // Verify plans belong to tenant
    const plans = await app.prisma.actionPlan.findMany({
      where: { id: { in: body.planIds }, tenantId },
      select: { id: true, code: true, area: true, executorId: true },
    });

    if (plans.length === 0) return reply.code(404).send({ error: 'No se encontraron planes válidos' });

    // Determine sector/area from plans if not provided
    const sector = body.sector || null;
    const area = body.area || plans[0]?.area || null;
    const executorId = plans[0]?.executorId ?? null;

    const rawToken = generatePortalToken();
    const tokenHash = hashToken(rawToken);

    const access = await app.prisma.portalAccessToken.create({
      data: {
        tenantId,
        tokenHash,
        tokenPrefix: getTokenPrefix(rawToken),
        recipientName: body.recipientName,
        recipientEmail: body.recipientEmail,
        sector,
        area,
        executorId,
        canEdit: body.canEdit,
        canAttachEvidence: body.canAttachEvidence,
        canDownloadPdf: body.canDownloadPdf,
        canCreateNonConformities: body.canCreateNonConformities,
        canViewNcrOwn: body.canViewNcrOwn,
        canViewNcrScope: body.canViewNcrScope,
        canEditNcrDraft: body.canEditNcrDraft,
        canCorrectNcrReturned: body.canCorrectNcrReturned,
        canDownloadNcrPdf: body.canDownloadNcrPdf,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdById: req.auth?.userId ?? null,
      },
    });

    // Send email
    const tenant = await app.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    const appUrl = process.env.CORS_ORIGIN || process.env.APP_URL || 'https://logismart.ar';
    const portalUrl = `${appUrl}/portal-accion/${rawToken}`;
    const sectorLabel = [sector, area].filter(Boolean).join(' — ') || 'Todos los sectores';

    sendEmail(portalInvitationEmail(
      body.recipientEmail,
      body.recipientName,
      portalUrl,
      sectorLabel,
      tenant?.name ?? 'Empresa',
      body.expiresAt ? new Date(body.expiresAt) : null,
    )).catch((e: any) => console.error('[PORTAL] Error sending email:', e.message));

    return reply.code(201).send({
      access: { ...access, token: rawToken },
      plansCount: plans.length,
      message: `Link enviado a ${body.recipientEmail} para ${plans.length} plan(es)`,
    });
  });

  // ── GET /portal-accion/admin/drafts — listar drafts pendientes ──
  app.get('/admin/drafts', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const { status: draftStatus } = (req.query as any) || {};
    const where: any = { status: draftStatus || 'SUBMITTED' };

    const accessIds = await app.prisma.portalAccessToken.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const accessIdList = accessIds.map((a: any) => a.id);

    const drafts = await app.prisma.portalDraftSnapshot.findMany({
      where: { ...where, accessTokenId: { in: accessIdList } },
      include: {
        accessToken: {
          select: { id: true, recipientName: true, recipientEmail: true, sector: true, area: true },
        },
        actionPlan: {
          select: { id: true, code: true, findingDescription: true, status: true, area: true },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const filtered = drafts;

    return reply.send({ drafts: filtered });
  });

  // ── POST /portal-accion/admin/drafts/:id/approve — aprobar y aplicar ──
  app.post('/admin/drafts/:id/approve', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as any;

    const draft = await app.prisma.portalDraftSnapshot.findUnique({
      where: { id },
      include: { accessToken: true, actionPlan: { select: { id: true, code: true } } },
    });

    if (!draft) return reply.code(404).send({ error: 'Draft no encontrado' });
    if (draft.accessToken.tenantId !== tenantId) return reply.code(403).send({ error: 'No autorizado' });
    if (draft.status !== 'SUBMITTED') return reply.code(400).send({ error: 'El draft no está en estado SUBMITTED' });

    const draftData = draft.draftData as any;

    // Apply changes to the plan
    const updateData: any = { updatedById: req.auth?.userId ?? null };
    for (const [field, value] of Object.entries(draftData)) {
      if (['plannedStartDate', 'plannedEndDate'].includes(field)) {
        updateData[field] = value ? new Date(value as string) : null;
      } else {
        updateData[field] = value;
      }
    }

    const oldPlan = await app.prisma.actionPlan.findFirst({ where: { id: draft.actionPlanId } });

    await app.prisma.actionPlan.update({
      where: { id: draft.actionPlanId },
      data: updateData,
    });

    // Log changes
    for (const [field, value] of Object.entries(draftData)) {
      const oldVal = String((oldPlan as any)[field] ?? '');
      const newVal = String(value ?? '');
      if (oldVal !== newVal) {
        await addLog(app.prisma, draft.actionPlanId, req.auth?.userId, 'PORTAL_DRAFT_APPLIED', field, oldVal, newVal, `Aprobado por ${req.auth?.userId ?? 'admin'}, enviado por ${draft.accessToken.recipientName}`);
      }
    }

    await app.prisma.portalDraftSnapshot.update({
      where: { id },
      data: {
        status: 'APPLIED',
        reviewedAt: new Date(),
        reviewedById: req.auth?.userId ?? null,
      },
    });

    // Notify external user
    sendEmail(portalDraftResultEmail(draft.accessToken.recipientEmail, draft.accessToken.recipientName, draft.actionPlan.code || 'Plan', true))
      .catch(() => {});

    return reply.send({ ok: true, message: 'Draft aprobado y aplicado' });
  });

  // ── POST /portal-accion/admin/drafts/:id/reject — rechazar ──
  app.post('/admin/drafts/:id/reject', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as any;
    const { notes } = (req.body as any) || {};

    const draft = await app.prisma.portalDraftSnapshot.findUnique({
      where: { id },
      include: { accessToken: true, actionPlan: { select: { code: true } } },
    });

    if (!draft) return reply.code(404).send({ error: 'Draft no encontrado' });
    if (draft.accessToken.tenantId !== tenantId) return reply.code(403).send({ error: 'No autorizado' });
    if (draft.status !== 'SUBMITTED') return reply.code(400).send({ error: 'El draft no está en estado SUBMITTED' });

    await app.prisma.portalDraftSnapshot.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedById: req.auth?.userId ?? null,
        reviewNotes: notes ?? null,
      },
    });

    sendEmail(portalDraftResultEmail(draft.accessToken.recipientEmail, draft.accessToken.recipientName, draft.actionPlan.code || 'Plan', false, notes))
      .catch(() => {});

    return reply.send({ ok: true, message: 'Draft rechazado' });
  });

  // ════════════════════════════════════════════════════════════════════
  // NCR — NO CONFORMIDADES DESDE PORTAL EXTERNO
  // ════════════════════════════════════════════════════════════════════

  // ── Public: List NCRs visible to this access ──
  app.get('/public/:token/ncr', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as { token: string };
    const result = await verifyToken(app.prisma, token);
    if (!result) return reply.code(404).send({ error: 'Token inválido' });
    if (result.error) return reply.code(403).send({ error: result.error });
    const access = result.access;

    const where: any = {
      tenantId: access.tenantId,
      deletedAt: null,
      source: 'PORTAL_EXTERNAL',
    };

    if (access.canViewNcrScope) {
      // Can see all NCRs in authorized scope
      where.OR = [
        { portalAccessTokenId: access.id },
        {
          AND: [
            access.sector ? { } : {},
          ],
        },
      ];
      // Filter by sector/area/process if set
      if (access.sector || access.area || access.process) {
        where.OR = [
          { portalAccessTokenId: access.id },
          { externalLocation: { contains: access.sector ?? '' } },
        ];
      }
    } else if (access.canViewNcrOwn) {
      where.portalAccessTokenId = access.id;
    } else {
      return reply.send({ ncrs: [] });
    }

    const ncrs = await app.prisma.nonConformity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        assignedTo: { select: { id: true, email: true } },
        attachments: true,
        actionPlans: { select: { id: true, code: true, findingDescription: true, status: true } },
      },
    });

    return reply.send({ ncrs });
  });

  // ── Public: Get single NCR detail ──
  app.get('/public/:token/ncr/:ncrId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token, ncrId } = req.params as { token: string; ncrId: string };
    const result = await verifyToken(app.prisma, token);
    if (!result) return reply.code(404).send({ error: 'Token inválido' });
    if (result.error) return reply.code(403).send({ error: result.error });
    const access = result.access;

    const ncr = await app.prisma.nonConformity.findFirst({
      where: { id: ncrId, tenantId: access.tenantId, deletedAt: null },
      include: {
        assignedTo: { select: { id: true, email: true } },
        attachments: true,
        actionPlans: { select: { id: true, code: true, findingDescription: true, status: true } },
      },
    });

    if (!ncr) return reply.code(404).send({ error: 'NCR no encontrada' });

    // Verify access: own or scope
    const isOwn = ncr.portalAccessTokenId === access.id;
    if (!isOwn && !access.canViewNcrScope) {
      return reply.code(403).send({ error: 'No autorizado para ver esta NCR' });
    }

    return reply.send({ ncr });
  });

  // ── Public: Create NCR (draft or submit) ──
  const ncrCreateSchema = z.object({
    title: z.string().min(2),
    description: z.string().min(5),
    severity: z.enum(['CRITICAL', 'MAJOR', 'MINOR', 'OBSERVATION']).default('MAJOR'),
    standard: z.string().optional(),
    clause: z.string().optional(),
    detectedAt: z.string().optional(),
    location: z.string().optional(),
    productsAffected: z.string().optional(),
    immediateCorrection: z.string().optional(),
    observations: z.string().optional(),
    process: z.string().optional(),
    submit: z.boolean().default(false),
    idempotencyKey: z.string().optional(),
  });

  app.post('/public/:token/ncr', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as { token: string };
    const result = await verifyToken(app.prisma, token);
    if (!result) return reply.code(404).send({ error: 'Token inválido' });
    if (result.error) return reply.code(403).send({ error: result.error });
    const access = result.access;

    if (!access.canCreateNonConformities) {
      return reply.code(403).send({ error: 'No tiene permiso para crear No Conformidades' });
    }

    let body: z.infer<typeof ncrCreateSchema>;
    try {
      body = ncrCreateSchema.parse(req.body);
    } catch (e: any) {
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }

    // Idempotency check
    if (body.idempotencyKey) {
      const existing = await app.prisma.nonConformity.findUnique({
        where: { idempotencyKey: body.idempotencyKey },
      });
      if (existing) {
        return reply.code(200).send({ ncr: existing, idempotent: true });
      }
    }

    // Duplicate detection
    let possibleDuplicates: any[] = [];
    {
      const openNcrs = await app.prisma.nonConformity.findMany({
        where: {
          tenantId: access.tenantId,
          deletedAt: null,
          status: { in: ['OPEN', 'REPORTED', 'IN_ANALYSIS', 'ACTION_PLANNED', 'IN_PROGRESS'] },
        },
        select: { id: true, title: true, description: true, detectedAt: true, process: true, createdAt: true },
        take: 100,
        orderBy: { createdAt: 'desc' },
      });

      const titleLower = body.title.toLowerCase();
      const descLower = body.description.toLowerCase();
      for (const n of openNcrs) {
        let score = 0;
        if (n.title.toLowerCase().includes(titleLower) || titleLower.includes(n.title.toLowerCase())) score += 3;
        if (n.description.toLowerCase().includes(descLower.substring(0, 50))) score += 2;
        if (body.process && n.process === body.process) score += 1;
        if (body.detectedAt && n.detectedAt) {
          const diff = Math.abs(new Date(body.detectedAt).getTime() - new Date(n.detectedAt).getTime());
          if (diff < 7 * 24 * 60 * 60 * 1000) score += 1;
        }
        if (score >= 4) possibleDuplicates.push({ id: n.id, title: n.title, score });
      }
    }

    const tenantId = access.tenantId;
    const status = body.submit ? 'REPORTED' : 'EXTERNAL_DRAFT';

    // Generate a temporary code for drafts; real code on approval
    const year = new Date().getFullYear();
    const count = await app.prisma.nonConformity.count({
      where: { tenantId, code: { startsWith: `NCR-${year}-` } },
    });
    const code = `NCR-${year}-EXT-${String(count + 1).padStart(3, '0')}`;

    const ncr = await app.prisma.nonConformity.create({
      data: {
        tenantId,
        code,
        title: body.title,
        description: body.description,
        severity: body.severity,
        source: 'PORTAL_EXTERNAL',
        status: status as any,
        standard: body.standard ?? null,
        clause: body.clause ?? null,
        process: body.process ?? access.process ?? null,
        detectedAt: body.detectedAt ? new Date(body.detectedAt) : new Date(),
        portalAccessTokenId: access.id,
        externalReporterName: access.recipientName,
        externalReporterEmail: access.recipientEmail,
        externalDetectedAt: body.detectedAt ? new Date(body.detectedAt) : new Date(),
        externalLocation: body.location ?? null,
        externalProductsAffected: body.productsAffected ?? null,
        externalImmediateCorrection: body.immediateCorrection ?? null,
        externalObservations: body.observations ?? null,
        idempotencyKey: body.idempotencyKey ?? null,
        possibleDuplicateOfId: possibleDuplicates.length > 0 ? possibleDuplicates[0].id : null,
      },
      include: { attachments: true },
    });

    // Log
    await addPortalLog(app.prisma, access.id, 'NCR_CREATED', ncr.id, undefined, undefined, ncr.title, req.ip, req.headers['user-agent']);

    if (body.submit) {
      // Notify internal users
      const internalUsers = await app.prisma.platformUser.findMany({
        where: {
          OR: [
            { globalRole: 'SUPER_ADMIN' },
            { memberships: { some: { tenantId, role: 'TENANT_ADMIN' } } },
          ],
        },
        select: { email: true, firstName: true, lastName: true },
      });
      for (const user of internalUsers) {
        const ncrUrl = `${process.env.NEXT_PUBLIC_API_URL ?? ''}/no-conformidades/${ncr.id}`;
        sendEmail(portalNcrInternalNotificationEmail(user.email, `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(), ncr.title, access.recipientName, ncrUrl))
          .catch(() => {});
      }
      // Notify reporter
      sendEmail(portalNcrSubmittedEmail(access.recipientEmail, access.recipientName, ncr.title))
        .catch(() => {});
      await addPortalLog(app.prisma, access.id, 'NCR_SUBMITTED', ncr.id, undefined, undefined, undefined, req.ip, req.headers['user-agent']);
    }

    return reply.code(201).send({ ncr, possibleDuplicates });
  });

  // ── Public: Edit NCR (draft or needs_correction) ──
  const ncrEditSchema = z.object({
    title: z.string().min(2).optional(),
    description: z.string().min(5).optional(),
    severity: z.enum(['CRITICAL', 'MAJOR', 'MINOR', 'OBSERVATION']).optional(),
    standard: z.string().optional(),
    clause: z.string().optional(),
    detectedAt: z.string().optional(),
    location: z.string().optional(),
    productsAffected: z.string().optional(),
    immediateCorrection: z.string().optional(),
    observations: z.string().optional(),
    process: z.string().optional(),
  });

  app.patch('/public/:token/ncr/:ncrId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token, ncrId } = req.params as { token: string; ncrId: string };
    const result = await verifyToken(app.prisma, token);
    if (!result) return reply.code(404).send({ error: 'Token inválido' });
    if (result.error) return reply.code(403).send({ error: result.error });
    const access = result.access;

    const ncr = await app.prisma.nonConformity.findFirst({
      where: { id: ncrId, tenantId: access.tenantId, deletedAt: null },
    });
    if (!ncr) return reply.code(404).send({ error: 'NCR no encontrada' });
    if (ncr.portalAccessTokenId !== access.id) {
      return reply.code(403).send({ error: 'No autorizado para editar esta NCR' });
    }

    // Check permissions based on status
    if (ncr.status === 'EXTERNAL_DRAFT') {
      if (!access.canEditNcrDraft && !access.canCreateNonConformities) {
        return reply.code(403).send({ error: 'No tiene permiso para editar borradores' });
      }
    } else if (ncr.status === 'NEEDS_CORRECTION') {
      if (!access.canCorrectNcrReturned) {
        return reply.code(403).send({ error: 'No tiene permiso para corregir esta NCR' });
      }
    } else {
      return reply.code(403).send({ error: 'La NCR no está en estado editable' });
    }

    let body: z.infer<typeof ncrEditSchema>;
    try {
      body = ncrEditSchema.parse(req.body);
    } catch (e: any) {
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }

    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.severity !== undefined) updateData.severity = body.severity;
    if (body.standard !== undefined) updateData.standard = body.standard;
    if (body.clause !== undefined) updateData.clause = body.clause;
    if (body.detectedAt !== undefined) {
      updateData.detectedAt = new Date(body.detectedAt);
      updateData.externalDetectedAt = new Date(body.detectedAt);
    }
    if (body.location !== undefined) updateData.externalLocation = body.location;
    if (body.productsAffected !== undefined) updateData.externalProductsAffected = body.productsAffected;
    if (body.immediateCorrection !== undefined) updateData.externalImmediateCorrection = body.immediateCorrection;
    if (body.observations !== undefined) updateData.externalObservations = body.observations;
    if (body.process !== undefined) updateData.process = body.process;

    // If correcting, reset to REPORTED
    if (ncr.status === 'NEEDS_CORRECTION') {
      updateData.status = 'REPORTED';
      updateData.reviewNotes = null;
      updateData.reviewedAt = null;
    }

    const updated = await app.prisma.nonConformity.update({
      where: { id: ncrId },
      data: updateData,
      include: { attachments: true },
    });

    await addPortalLog(app.prisma, access.id, ncr.status === 'NEEDS_CORRECTION' ? 'NCR_CORRECTED' : 'NCR_EDITED', ncrId, undefined, undefined, JSON.stringify(Object.keys(body)), req.ip, req.headers['user-agent']);

    return reply.send({ ncr: updated });
  });

  // ── Public: Submit NCR (EXTERNAL_DRAFT → REPORTED) ──
  app.post('/public/:token/ncr/:ncrId/submit', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token, ncrId } = req.params as { token: string; ncrId: string };
    const result = await verifyToken(app.prisma, token);
    if (!result) return reply.code(404).send({ error: 'Token inválido' });
    if (result.error) return reply.code(403).send({ error: result.error });
    const access = result.access;

    const ncr = await app.prisma.nonConformity.findFirst({
      where: { id: ncrId, tenantId: access.tenantId, deletedAt: null },
    });
    if (!ncr) return reply.code(404).send({ error: 'NCR no encontrada' });
    if (ncr.portalAccessTokenId !== access.id) {
      return reply.code(403).send({ error: 'No autorizado' });
    }
    if (ncr.status !== 'EXTERNAL_DRAFT' && ncr.status !== 'NEEDS_CORRECTION') {
      return reply.code(400).send({ error: 'La NCR no está en estado borrador o corrección' });
    }

    const updated = await app.prisma.nonConformity.update({
      where: { id: ncrId },
      data: { status: 'REPORTED', reviewNotes: null, reviewedAt: null },
      include: { attachments: true },
    });

    // Notify internal users
    const internalUsers = await app.prisma.platformUser.findMany({
      where: {
        OR: [
          { globalRole: 'SUPER_ADMIN' },
          { memberships: { some: { tenantId: access.tenantId, role: 'TENANT_ADMIN' } } },
        ],
      },
      select: { email: true, firstName: true, lastName: true },
    });
    for (const user of internalUsers) {
      const ncrUrl = `${process.env.NEXT_PUBLIC_API_URL ?? ''}/no-conformidades/${ncr.id}`;
      sendEmail(portalNcrInternalNotificationEmail(user.email, `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(), ncr.title, access.recipientName, ncrUrl))
        .catch(() => {});
    }
    sendEmail(portalNcrSubmittedEmail(access.recipientEmail, access.recipientName, ncr.title))
      .catch(() => {});

    await addPortalLog(app.prisma, access.id, 'NCR_SUBMITTED', ncrId, undefined, undefined, ncr.title, req.ip, req.headers['user-agent']);

    return reply.send({ ncr: updated });
  });

  // ── Public: Delete NCR draft (only EXTERNAL_DRAFT) ──
  app.delete('/public/:token/ncr/:ncrId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token, ncrId } = req.params as { token: string; ncrId: string };
    const result = await verifyToken(app.prisma, token);
    if (!result) return reply.code(404).send({ error: 'Token inválido' });
    if (result.error) return reply.code(403).send({ error: result.error });
    const access = result.access;

    const ncr = await app.prisma.nonConformity.findFirst({
      where: { id: ncrId, tenantId: access.tenantId, deletedAt: null },
    });
    if (!ncr) return reply.code(404).send({ error: 'NCR no encontrada' });
    if (ncr.portalAccessTokenId !== access.id) {
      return reply.code(403).send({ error: 'No autorizado' });
    }
    if (ncr.status !== 'EXTERNAL_DRAFT') {
      return reply.code(403).send({ error: 'Solo se pueden eliminar borradores no enviados' });
    }

    await app.prisma.nonConformity.update({
      where: { id: ncrId },
      data: { deletedAt: new Date() },
    });

    await addPortalLog(app.prisma, access.id, 'NCR_DRAFT_DELETED', ncrId, undefined, ncr.title, undefined, req.ip, req.headers['user-agent']);

    return reply.send({ ok: true, message: 'Borrador eliminado' });
  });

  // ── Public: Upload NCR attachment ──
  app.post('/public/:token/ncr/:ncrId/attachments', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token, ncrId } = req.params as { token: string; ncrId: string };
    const result = await verifyToken(app.prisma, token);
    if (!result) return reply.code(404).send({ error: 'Token inválido' });
    if (result.error) return reply.code(403).send({ error: result.error });
    const access = result.access;

    if (!access.canCreateNonConformities) {
      return reply.code(403).send({ error: 'No tiene permiso para adjuntar evidencias' });
    }

    const ncr = await app.prisma.nonConformity.findFirst({
      where: { id: ncrId, tenantId: access.tenantId, deletedAt: null },
    });
    if (!ncr) return reply.code(404).send({ error: 'NCR no encontrada' });
    if (ncr.portalAccessTokenId !== access.id) {
      return reply.code(403).send({ error: 'No autorizado' });
    }
    if (ncr.status !== 'EXTERNAL_DRAFT' && ncr.status !== 'NEEDS_CORRECTION' && ncr.status !== 'REPORTED') {
      return reply.code(403).send({ error: 'La NCR no permite adjuntar evidencias en este estado' });
    }

    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'No se envió archivo' });

    const storage = getStorage();
    const buf = await data.toBuffer();
    const ext = path.extname(data.filename) || '';
    const key = `ncr/${ncrId}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    await storage.upload(key, buf, data.mimetype);

    const attachment = await app.prisma.nonConformityAttachment.create({
      data: {
        ncrId,
        filename: data.filename,
        url: key,
        mimeType: data.mimetype,
        size: buf.length,
        uploadedFromPortal: true,
      },
    });

    await addPortalLog(app.prisma, access.id, 'NCR_ATTACHMENT_UPLOADED', ncrId, undefined, undefined, data.filename, req.ip, req.headers['user-agent']);

    return reply.code(201).send({ attachment });
  });

  // ── Public: Delete NCR attachment ──
  app.delete('/public/:token/ncr/:ncrId/attachments/:attachmentId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token, ncrId, attachmentId } = req.params as { token: string; ncrId: string; attachmentId: string };
    const result = await verifyToken(app.prisma, token);
    if (!result) return reply.code(404).send({ error: 'Token inválido' });
    if (result.error) return reply.code(403).send({ error: result.error });
    const access = result.access;

    const ncr = await app.prisma.nonConformity.findFirst({
      where: { id: ncrId, tenantId: access.tenantId, deletedAt: null },
    });
    if (!ncr) return reply.code(404).send({ error: 'NCR no encontrada' });
    if (ncr.portalAccessTokenId !== access.id) {
      return reply.code(403).send({ error: 'No autorizado' });
    }
    if (ncr.status !== 'EXTERNAL_DRAFT' && ncr.status !== 'NEEDS_CORRECTION') {
      return reply.code(403).send({ error: 'No se pueden eliminar evidencias en este estado' });
    }

    const attachment = await app.prisma.nonConformityAttachment.findFirst({
      where: { id: attachmentId, ncrId },
    });
    if (!attachment) return reply.code(404).send({ error: 'Adjunto no encontrado' });

    const storage = getStorage();
    await storage.delete(attachment.url).catch(() => {});

    await app.prisma.nonConformityAttachment.delete({ where: { id: attachmentId } });

    await addPortalLog(app.prisma, access.id, 'NCR_ATTACHMENT_DELETED', ncrId, undefined, attachment.filename, undefined, req.ip, req.headers['user-agent']);

    return reply.send({ ok: true });
  });

  // ── Public: Download NCR controlled PDF ──
  app.get('/public/:token/ncr/:ncrId/pdf', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token, ncrId } = req.params as { token: string; ncrId: string };
    const result = await verifyToken(app.prisma, token);
    if (!result) return reply.code(404).send({ error: 'Token inválido' });
    if (result.error) return reply.code(403).send({ error: result.error });
    const access = result.access;

    if (!access.canDownloadNcrPdf) {
      return reply.code(403).send({ error: 'No tiene permiso para descargar PDF' });
    }

    const ncr = await app.prisma.nonConformity.findFirst({
      where: { id: ncrId, tenantId: access.tenantId, deletedAt: null },
      include: { attachments: true, assignedTo: { select: { email: true } }, actionPlans: { select: { id: true, code: true, findingDescription: true, status: true } } },
    });
    if (!ncr) return reply.code(404).send({ error: 'NCR no encontrada' });

    const isOwn = ncr.portalAccessTokenId === access.id;
    if (!isOwn && !access.canViewNcrScope) {
      return reply.code(403).send({ error: 'No autorizado' });
    }

    const branding = await getCompanyBranding(app.prisma, access.tenantId);
    const html = buildNcrPdfHtml(ncr, branding);
    // @ts-ignore - puppeteer ya está instalado en el proyecto
    const puppeteer = (await import('puppeteer')).default;
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    let pdfBuffer: Buffer;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      });
    } finally {
      await browser.close();
    }

    await addPortalLog(app.prisma, access.id, 'NCR_PDF_DOWNLOADED', ncrId, undefined, undefined, ncr.code, req.ip, req.headers['user-agent']);

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${ncr.code}.pdf"`);
    return reply.send(pdfBuffer);
  });

  // ════════════════════════════════════════════════════════════════════
  // NCR — ADMIN ROUTES (internal, auth-based)
  // ════════════════════════════════════════════════════════════════════

  // ── Admin: List NCRs pending external review ──
  app.get('/admin/ncr/pending', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const ncrs = await app.prisma.nonConformity.findMany({
      where: {
        tenantId,
        deletedAt: null,
        source: 'PORTAL_EXTERNAL',
        status: { in: ['REPORTED', 'NEEDS_CORRECTION'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        assignedTo: { select: { id: true, email: true } },
        reviewedBy: { select: { id: true, email: true } },
        attachments: true,
      },
    });

    return reply.send({ ncrs });
  });

  // ── Admin: Review NCR (approve / reject / request correction) ──
  const ncrReviewSchema = z.object({
    action: z.enum(['APPROVE', 'REJECT', 'REQUEST_CORRECTION']),
    notes: z.string().optional(),
    severity: z.enum(['CRITICAL', 'MAJOR', 'MINOR', 'OBSERVATION']).optional(),
    assignedToId: z.string().uuid().optional().nullable(),
    standard: z.string().optional(),
    clause: z.string().optional(),
  });

  app.patch('/admin/ncr/:ncrId/review', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const { ncrId } = req.params as { ncrId: string };
    let body: z.infer<typeof ncrReviewSchema>;
    try {
      body = ncrReviewSchema.parse(req.body);
    } catch (e: any) {
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }

    const ncr = await app.prisma.nonConformity.findFirst({
      where: { id: ncrId, tenantId, deletedAt: null },
    });
    if (!ncr) return reply.code(404).send({ error: 'NCR no encontrada' });
    if (ncr.status !== 'REPORTED' && ncr.status !== 'NEEDS_CORRECTION') {
      return reply.code(400).send({ error: 'La NCR no está en estado de revisión' });
    }

    const updateData: any = {
      reviewedById: req.auth?.userId ?? null,
      reviewedAt: new Date(),
      reviewNotes: body.notes ?? null,
    };

    if (body.action === 'APPROVE') {
      // Generate definitive code
      const year = new Date().getFullYear();
      const count = await app.prisma.nonConformity.count({
        where: { tenantId, code: { startsWith: `NCR-${year}-` } },
      });
      updateData.code = `NCR-${year}-${String(count + 1).padStart(3, '0')}`;
      updateData.status = 'OPEN';
      if (body.severity) updateData.severity = body.severity;
      if (body.assignedToId !== undefined) updateData.assignedToId = body.assignedToId;
      if (body.standard !== undefined) updateData.standard = body.standard;
      if (body.clause !== undefined) updateData.clause = body.clause;
    } else if (body.action === 'REJECT') {
      updateData.status = 'CANCELLED';
    } else if (body.action === 'REQUEST_CORRECTION') {
      updateData.status = 'NEEDS_CORRECTION';
    }

    const updated = await app.prisma.nonConformity.update({
      where: { id: ncrId },
      data: updateData,
      include: { assignedTo: { select: { email: true } } },
    });

    // Notify external reporter
    if (ncr.portalAccessTokenId && ncr.externalReporterEmail) {
      const approved = body.action === 'APPROVE';
      sendEmail(portalNcrReviewResultEmail(ncr.externalReporterEmail, ncr.externalReporterName ?? '', ncr.title, approved, body.notes))
        .catch(() => {});
    }

    return reply.send({ ncr: updated });
  });

  // ── Admin: Link NCR to Action Plan ──
  const ncrLinkPlanSchema = z.object({
    actionPlanId: z.string().uuid().optional(),
    createNew: z.boolean().default(false),
    noPlanRequired: z.boolean().default(false),
    noPlanReason: z.string().optional(),
  });

  app.post('/admin/ncr/:ncrId/link-plan', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const { ncrId } = req.params as { ncrId: string };
    let body: z.infer<typeof ncrLinkPlanSchema>;
    try {
      body = ncrLinkPlanSchema.parse(req.body);
    } catch (e: any) {
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }

    const ncr = await app.prisma.nonConformity.findFirst({
      where: { id: ncrId, tenantId, deletedAt: null },
    });
    if (!ncr) return reply.code(404).send({ error: 'NCR no encontrada' });

    if (body.noPlanRequired) {
      await app.prisma.nonConformity.update({
        where: { id: ncrId },
        data: { externalObservations: `Sin Plan de Acción: ${body.noPlanReason ?? 'No requiere'}` },
      });
      return reply.send({ ok: true, message: 'Marcada como sin Plan de Acción' });
    }

    if (body.createNew) {
      const year = new Date().getFullYear();
      const planCount = await app.prisma.actionPlan.count({
        where: { tenantId, code: { startsWith: `PA-${year}-` } },
      });
      const planCode = `PA-${year}-${String(planCount + 1).padStart(3, '0')}`;

      const plan = await app.prisma.actionPlan.create({
        data: {
          tenantId,
          code: planCode,
          ncrId,
          origin: 'NCR',
          type: 'CORRECTIVE',
          findingDescription: ncr.description,
          requirement: ncr.standard ? `${ncr.standard}${ncr.clause ? ` §${ncr.clause}` : ''}` : null,
          severity: ncr.severity,
          process: ncr.process ?? null,
          status: 'DRAFT',
          createdById: req.auth?.userId ?? null,
          updatedById: req.auth?.userId ?? null,
        },
      });
      return reply.send({ ok: true, plan });
    }

    if (body.actionPlanId) {
      const plan = await app.prisma.actionPlan.findFirst({
        where: { id: body.actionPlanId, tenantId },
      });
      if (!plan) return reply.code(404).send({ error: 'Plan no encontrado' });

      await app.prisma.actionPlan.update({
        where: { id: body.actionPlanId },
        data: { ncrId },
      });
      return reply.send({ ok: true, plan });
    }

    return reply.code(400).send({ error: 'Debe especificar una acción' });
  });
};

// ── PDF HTML Builder ──────────────────────────────────────────
function buildPlanPdfHtml(plan: any, branding: any): string {
  const primaryColor = branding.primaryColor || '#2563eb';
  const logoHtml = branding.logoUrl
    ? `<img src="${branding.logoUrl}" style="max-height:60px;max-width:200px;object-fit:contain;" />`
    : `<div style="font-size:24px;font-weight:700;color:${primaryColor};">${branding.name || 'SGI 360'}</div>`;

  const statusLabels: Record<string, string> = {
    DRAFT: 'Borrador', PENDING_CODE: 'Pendiente código', PENDING_APPROVAL: 'Pendiente aprobación',
    OPEN: 'Abierto', IN_EXECUTION: 'En ejecución', PENDING_EVIDENCE: 'Pendiente evidencia',
    PENDING_EFFECTIVENESS: 'Pendiente eficacia', EFFECTIVE: 'Eficaz', NOT_EFFECTIVE: 'No eficaz',
    OVERDUE: 'Vencido', CLOSED: 'Cerrado', CANCELLED: 'Cancelado',
  };

  const typeLabels: Record<string, string> = {
    IMMEDIATE_CORRECTION: 'Corrección inmediata', CORRECTIVE: 'Correctiva',
    PREVENTIVE: 'Preventiva', IMPROVEMENT: 'Mejora', RISK_TREATMENT: 'Tratamiento de riesgo',
  };

  const originLabels: Record<string, string> = {
    MANUAL: 'Manual', AUDIT: 'Auditoría', NCR: 'No conformidad', INCIDENT: 'Incidente',
    COMPLAINT: 'Queja', INSPECTION: 'Inspección', INDICATOR: 'Indicador',
    MANAGEMENT_REVIEW: 'Revisión por dirección', RISK: 'Riesgo', OTHER: 'Otro',
  };

  const row = (label: string, value: any) => `
    <tr>
      <td style="padding:6px 12px;color:#6b7280;font-size:11px;font-weight:600;white-space:nowrap;width:30%;">${label}</td>
      <td style="padding:6px 12px;color:#111827;font-size:12px;">${value ?? '<span style="color:#9ca3af;">—</span>'}</td>
    </tr>`;

  const section = (title: string, rows: string) => `
    <div style="margin-bottom:16px;">
      <div style="background:${primaryColor};color:#fff;font-size:11px;font-weight:700;padding:6px 12px;border-radius:4px 4px 0 0;text-transform:uppercase;letter-spacing:0.05em;">${title}</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 4px 4px;">
        ${rows}
      </table>
    </div>`;

  const attachmentsHtml = plan.attachments?.length > 0
    ? plan.attachments.map((a: any) => `<div style="padding:4px 0;font-size:11px;color:#4b5563;">📎 ${a.filename} (${a.mimeType || '—'})</div>`).join('')
    : '<div style="color:#9ca3af;font-size:11px;">Sin adjuntos</div>';

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; color: #111827; }
    .header { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; border-bottom: 2px solid ${primaryColor}; margin-bottom: 20px; }
    .doc-code { text-align: right; font-size: 11px; color: #6b7280; }
    .doc-code strong { font-size: 14px; color: #111827; }
  </style></head><body>
    <div class="header">
      <div>${logoHtml}</div>
      <div class="doc-code">
        <strong>${plan.code || 'SIN CÓDIGO'}</strong><br/>
        Plan de Acción<br/>
        Generado: ${new Date().toLocaleString('es-AR')}
      </div>
    </div>

    ${section('Información General',
      row('Código', plan.code) +
      row('Tipo', typeLabels[plan.type] || plan.type) +
      row('Origen', originLabels[plan.origin] || plan.origin) +
      row('Estado', statusLabels[plan.status] || plan.status) +
      row('Severidad', plan.severity) +
      row('Sede', plan.site) +
      row('Área', plan.area) +
      row('Proceso', plan.process) +
      row('Fecha apertura', plan.openedAt ? new Date(plan.openedAt).toLocaleDateString('es-AR') : null)
    )}

    ${section('Descripción del Hallazgo',
      row('Descripción', plan.findingDescription) +
      row('Requisito', plan.requirement) +
      row('Clasificación', plan.classification)
    )}

    ${section('Corrección Inmediata',
      row('Acción inmediata', plan.immediateCorrection)
    )}

    ${section('Análisis de Causa Raíz',
      row('Análisis', plan.rootCauseAnalysis) +
      row('Metodología', plan.analysisMethod) +
      row('Causa validada', plan.validatedRootCause)
    )}

    ${section('Acción Planificada',
      row('Acción', plan.plannedAction) +
      row('Resultado esperado', plan.expectedResult) +
      row('Recursos requeridos', plan.requiredResources)
    )}

    ${section('Responsables y Fechas',
      row('Responsable ejecución', plan.executor ? `${plan.executor.firstName} ${plan.executor.lastName}` : null) +
      row('Supervisor', plan.supervisor ? `${plan.supervisor.firstName} ${plan.supervisor.lastName}` : null) +
      row('Fecha inicio prevista', plan.plannedStartDate ? new Date(plan.plannedStartDate).toLocaleDateString('es-AR') : null) +
      row('Fecha fin prevista', plan.plannedEndDate ? new Date(plan.plannedEndDate).toLocaleDateString('es-AR') : null) +
      row('Fecha fin real', plan.actualEndDate ? new Date(plan.actualEndDate).toLocaleDateString('es-AR') : null) +
      row('Progreso', `${plan.progressPercent}%`)
    )}

    ${section('Verificación de Eficacia',
      row('Fecha verificación', plan.effectivenessCheckDate ? new Date(plan.effectivenessCheckDate).toLocaleDateString('es-AR') : null) +
      row('Método', plan.effectivenessMethod) +
      row('Resultado', plan.effectivenessResult) +
      row('Eficacia', plan.effectiveness === 'EFFECTIVE' ? '✅ Eficaz' : plan.effectiveness === 'NOT_EFFECTIVE' ? '❌ No eficaz' : '⏳ Pendiente')
    )}

    ${section('NCR Relacionada',
      row('Código NCR', plan.ncr?.code) +
      row('Título NCR', plan.ncr?.title) +
      row('Severidad NCR', plan.ncr?.severity)
    )}

    ${section('Evidencias / Adjuntos', attachmentsHtml)}

    ${plan.observations ? section('Observaciones', row('Observaciones', plan.observations)) : ''}

    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:10px;">
      Documento generado por SGI 360 — Portal Externo de Planes de Acción<br/>
      ${new Date().toISOString()}
    </div>
  </body></html>`;
}

// ── NCR PDF HTML Builder ──────────────────────────────────────
function buildNcrPdfHtml(ncr: any, branding: any): string {
  const primaryColor = branding.primaryColor || '#2563eb';
  const logoHtml = branding.logoUrl
    ? `<img src="${branding.logoUrl}" style="max-height:60px;max-width:200px;object-fit:contain;" />`
    : `<div style="font-size:24px;font-weight:700;color:${primaryColor};">${branding.name || 'SGI 360'}</div>`;

  const statusLabels: Record<string, string> = {
    EXTERNAL_DRAFT: 'Borrador externo',
    REPORTED: 'Reportada — Pendiente de revisión',
    NEEDS_CORRECTION: 'Requiere corrección',
    OPEN: 'Abierta',
    IN_ANALYSIS: 'En análisis',
    ACTION_PLANNED: 'Acción planificada',
    IN_PROGRESS: 'En progreso',
    VERIFICATION: 'Verificación',
    CLOSED: 'Cerrada',
    CANCELLED: 'Cancelada',
  };

  const severityLabels: Record<string, string> = {
    CRITICAL: 'Crítica',
    MAJOR: 'Mayor',
    MINOR: 'Menor',
    OBSERVATION: 'Observación',
  };

  const statusLabel = statusLabels[ncr.status] ?? ncr.status;
  const severityLabel = severityLabels[ncr.severity] ?? ncr.severity;
  const isDraft = ncr.status === 'EXTERNAL_DRAFT';
  const isPending = ncr.status === 'REPORTED' || ncr.status === 'NEEDS_CORRECTION';

  const row = (label: string, value: any) =>
    `<tr><td style="padding:6px 12px;font-weight:600;color:#374151;width:35%;border-bottom:1px solid #f3f4f6;">${label}</td><td style="padding:6px 12px;color:#111827;border-bottom:1px solid #f3f4f6;">${value ?? '—'}</td></tr>`;

  const section = (title: string, rows: string) =>
    `<div style="margin-top:24px;"><h2 style="font-size:14px;font-weight:700;color:${primaryColor};margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid ${primaryColor};">${title}</h2><table style="width:100%;border-collapse:collapse;font-size:12px;">${rows}</table></div>`;

  const attachmentsHtml = ncr.attachments?.length
    ? ncr.attachments.map((a: any) => `<div style="padding:4px 0;">📎 ${a.filename}</div>`).join('')
    : '<div style="color:#9ca3af;">Sin evidencias adjuntas</div>';

  const plansHtml = ncr.actionPlans?.length
    ? ncr.actionPlans.map((p: any) => `<div style="padding:4px 0;">📋 ${p.code || 'Sin código'} — ${p.findingDescription?.substring(0, 60) ?? ''} (${p.status})</div>`).join('')
    : '<div style="color:#9ca3af;">Sin Plan de Acción vinculado</div>';

  const statusBanner = isDraft
    ? '<div style="background:#fef3c7;border:1px solid #f59e0b;color:#92400e;padding:8px 16px;border-radius:8px;margin-bottom:16px;font-size:12px;font-weight:600;">⚠️ BORRADOR — Este documento no ha sido enviado para revisión</div>'
    : isPending
    ? '<div style="background:#dbeafe;border:1px solid #3b82f6;color:#1e40af;padding:8px 16px;border-radius:8px;margin-bottom:16px;font-size:12px;font-weight:600;">📋 PENDIENTE DE REVISIÓN — Este documento no está aprobado</div>'
    : '';

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;color:#111827;padding:20px;}</style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e5e7eb;">
      ${logoHtml}
      <div style="text-align:right;">
        <div style="font-size:18px;font-weight:700;color:#111827;">No Conformidad</div>
        <div style="font-size:12px;color:#6b7280;">${ncr.code}</div>
      </div>
    </div>

    ${statusBanner}

    ${section('Información General',
      row('Código', ncr.code) +
      row('Título', ncr.title) +
      row('Estado', statusLabel) +
      row('Severidad', severityLabel) +
      row('Origen', 'Portal Externo') +
      row('Fecha de detección', ncr.detectedAt ? new Date(ncr.detectedAt).toLocaleDateString('es-AR') : '—') +
      row('Fecha de creación', new Date(ncr.createdAt).toLocaleDateString('es-AR'))
    )}

    ${section('Descripción del Hallazgo',
      row('Descripción', ncr.description) +
      row('Norma', ncr.standard) +
      row('Cláusula', ncr.clause) +
      row('Proceso', ncr.process)
    )}

    ${section('Datos del Portal Externo',
      row('Informante', ncr.externalReporterName) +
      row('Correo del informante', ncr.externalReporterEmail) +
      row('Lugar de detección', ncr.externalLocation) +
      row('Productos afectados', ncr.externalProductsAffected) +
      row('Corrección inmediata', ncr.externalImmediateCorrection) +
      row('Observaciones', ncr.externalObservations)
    )}

    ${ncr.reviewNotes ? section('Revisión Interna',
      row('Notas del revisor', ncr.reviewNotes) +
      row('Revisado por', ncr.reviewedBy?.email) +
      row('Fecha de revisión', ncr.reviewedAt ? new Date(ncr.reviewedAt).toLocaleDateString('es-AR') : '—')
    ) : ''}

    ${section('Responsable Asignado',
      row('Responsable', ncr.assignedTo?.email ?? 'Sin asignar')
    )}

    ${section('Planes de Acción Vinculados', plansHtml)}

    ${section('Evidencias / Adjuntos', attachmentsHtml)}

    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:10px;">
      Documento generado por SGI 360 — Portal Externo de No Conformidades<br/>
      ${new Date().toISOString()}
    </div>
  </body></html>`;
}
