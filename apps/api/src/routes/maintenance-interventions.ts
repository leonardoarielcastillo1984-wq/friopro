import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import crypto from 'crypto';
import { notifyIntervencionRegistrada } from '../services/notifyService.js';

const generateToken = () => crypto.randomBytes(20).toString('hex');

// ── Catálogo built-in de tareas típicas de mantenimiento vehicular ────────────
const BUILT_IN_TYPES: Array<{ name: string; category: string; km?: number; days?: number }> = [
  { name: 'Cambio de aceite y filtro', category: 'MOTOR', km: 10000 },
  { name: 'Cambio de filtro de aire', category: 'MOTOR', km: 20000 },
  { name: 'Cambio de filtro de combustible', category: 'MOTOR', km: 20000 },
  { name: 'Cambio de filtro de habitáculo', category: 'MOTOR', km: 20000 },
  { name: 'Revisión / ajuste de frenos', category: 'FRENOS', km: 10000 },
  { name: 'Cambio de pastillas de freno', category: 'FRENOS', km: 40000 },
  { name: 'Cambio de líquido de frenos', category: 'FRENOS', km: 40000, days: 730 },
  { name: 'Rotación de neumáticos', category: 'NEUMATICOS', km: 10000 },
  { name: 'Cambio de neumáticos', category: 'NEUMATICOS', km: 60000 },
  { name: 'Alineación y balanceo', category: 'NEUMATICOS', km: 10000 },
  { name: 'Revisión de suspensión', category: 'SUSPENSION', km: 20000 },
  { name: 'Cambio de refrigerante', category: 'FLUIDOS', days: 730 },
  { name: 'Cambio de aceite de caja / diferencial', category: 'TRANSMISION', km: 60000 },
  { name: 'Revisión de correas y mangueras', category: 'MOTOR', km: 40000 },
  { name: 'Revisión eléctrica / luces', category: 'ELECTRICO', km: 10000 },
  { name: 'Reparación de espejo / carrocería', category: 'CARROCERIA' },
  { name: 'Lavado y engrase general', category: 'GENERAL', days: 30 },
  { name: 'Verificación técnica / VTV', category: 'GENERAL', days: 365 },
];

export async function maintenanceInterventionsRoutes(app: FastifyInstance) {

  // ── TIPOS DE INTERVENCIÓN (catálogo) ────────────────────────────────────────
  app.get('/types', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    let types = await (app.prisma as any).maintenanceInterventionType.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Auto-seed del catálogo built-in la primera vez
    if (types.length === 0) {
      await (app.prisma as any).maintenanceInterventionType.createMany({
        data: BUILT_IN_TYPES.map(t => ({
          tenantId,
          name: t.name,
          category: t.category,
          defaultKmInterval: t.km ?? null,
          defaultDaysInterval: t.days ?? null,
          isBuiltIn: true,
        })),
      });
      types = await (app.prisma as any).maintenanceInterventionType.findMany({
        where: { tenantId, isActive: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      });
    }

    return reply.send({ types });
  });

  app.post('/types', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({
      name: z.string().min(1).max(200),
      category: z.string().default('GENERAL'),
      description: z.string().optional(),
      defaultKmInterval: z.number().int().positive().optional().nullable(),
      defaultDaysInterval: z.number().int().positive().optional().nullable(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const type = await (app.prisma as any).maintenanceInterventionType.create({
      data: { tenantId, ...body.data },
    });
    return reply.code(201).send({ type });
  });

  app.put('/types/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const schema = z.object({
      name: z.string().min(1).max(200).optional(),
      category: z.string().optional(),
      description: z.string().optional().nullable(),
      defaultKmInterval: z.number().int().positive().optional().nullable(),
      defaultDaysInterval: z.number().int().positive().optional().nullable(),
      isActive: z.boolean().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    await (app.prisma as any).maintenanceInterventionType.updateMany({
      where: { id, tenantId },
      data: body.data,
    });
    return reply.send({ ok: true });
  });

  app.delete('/types/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    await (app.prisma as any).maintenanceInterventionType.updateMany({
      where: { id, tenantId },
      data: { isActive: false },
    });
    return reply.send({ ok: true });
  });

  // ── QR DE INTERVENCIÓN ──────────────────────────────────────────────────────
  app.get('/qrs', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const qrs = await (app.prisma as any).maintenanceInterventionQR.findMany({
      where: { tenantId, isActive: true },
      include: {
        maintenanceAsset: { select: { id: true, name: true, code: true, currentOdometer: true } },
        _count: { select: { intervenciones: true } },
      },
      orderBy: { generatedAt: 'desc' },
    });
    const baseUrl = process.env.APP_URL || 'https://logismart.ar';
    return reply.send({ qrs: qrs.map((q: any) => ({ ...q, publicUrl: `${baseUrl}/mantenimiento-qr/${q.token}` })) });
  });

  app.post('/qrs', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({
      maintenanceAssetId: z.string().uuid(),
      titulo: z.string().optional(),
      instrucciones: z.string().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const asset = await (app.prisma as any).maintenanceAsset.findFirst({
      where: { id: body.data.maintenanceAssetId, tenantId },
    });
    if (!asset) return reply.code(404).send({ error: 'Activo no encontrado' });

    // Si ya existe un QR activo para este activo, devolverlo (idempotente)
    const existing = await (app.prisma as any).maintenanceInterventionQR.findFirst({
      where: { maintenanceAssetId: asset.id, tenantId, isActive: true },
    });
    const baseUrl = process.env.APP_URL || 'https://logismart.ar';
    if (existing) {
      return reply.send({ qr: { ...existing, publicUrl: `${baseUrl}/mantenimiento-qr/${existing.token}` }, existing: true });
    }

    const qr = await (app.prisma as any).maintenanceInterventionQR.create({
      data: {
        tenantId,
        token: generateToken(),
        maintenanceAssetId: asset.id,
        activoNombre: asset.name,
        activoCodigo: asset.code,
        titulo: body.data.titulo,
        instrucciones: body.data.instrucciones,
      },
    });
    return reply.code(201).send({ qr: { ...qr, publicUrl: `${baseUrl}/mantenimiento-qr/${qr.token}` } });
  });

  app.delete('/qrs/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    await (app.prisma as any).maintenanceInterventionQR.updateMany({
      where: { id, tenantId },
      data: { isActive: false },
    });
    return reply.send({ ok: true });
  });

  // ── INTERVENCIONES (historial, autenticado) ─────────────────────────────────
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const where: any = { tenantId };
    if (q.assetId) where.maintenanceAssetId = q.assetId;
    const intervenciones = await (app.prisma as any).maintenanceIntervention.findMany({
      where,
      include: {
        maintenanceAsset: { select: { id: true, name: true, code: true } },
        plan: { select: { id: true, title: true, code: true } },
      },
      orderBy: { performedAt: 'desc' },
      take: q.limit ? parseInt(q.limit) : 100,
    });
    return reply.send({ intervenciones });
  });

  // ── RUTA PÚBLICA GET: ficha del activo + preventivos pendientes ─────────────
  app.get('/public/:token', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;
    const qr = await (app.prisma as any).maintenanceInterventionQR.findFirst({
      where: { token, isActive: true },
      include: {
        maintenanceAsset: true,
        tenant: { select: { id: true, name: true } },
      },
    });
    if (!qr) return reply.code(404).send({ error: 'QR no encontrado o inactivo' });

    const asset = qr.maintenanceAsset;
    const kmActual = asset.currentOdometer ?? null;

    const [settings, tipos, planes, ultimas] = await Promise.all([
      (app.prisma as any).companySettings.findUnique({
        where: { tenantId: qr.tenantId }, select: { logoUrl: true, primaryColor: true },
      }).catch(() => null),
      (app.prisma as any).maintenanceInterventionType.findMany({
        where: { tenantId: qr.tenantId, isActive: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      }),
      (app.prisma as any).maintenancePlan.findMany({
        where: { assetId: asset.id, status: 'ACTIVE' },
        orderBy: { nextExecutionDate: 'asc' },
      }),
      (app.prisma as any).maintenanceIntervention.findMany({
        where: { maintenanceAssetId: asset.id },
        orderBy: { performedAt: 'desc' },
        take: 10,
        select: { id: true, tiposLabel: true, descripcion: true, odometro: true, performedAt: true, performedByName: true, cumplioPreventivo: true },
      }),
    ]);

    // Calcular estado de cada plan preventivo
    const now = new Date();
    const preventivos = planes.map((p: any) => {
      let estado: 'VENCIDO' | 'PROXIMO' | 'AL_DIA' = 'AL_DIA';
      let detalle = '';
      if (p.frequencyUnit === 'KM' && p.triggerKm) {
        const base = p.lastOdometerExecution ?? 0;
        const restante = kmActual != null ? (base + p.triggerKm) - kmActual : null;
        detalle = `cada ${p.triggerKm.toLocaleString('es-AR')} km` + (restante != null ? ` · faltan ${Math.max(0, Math.round(restante)).toLocaleString('es-AR')} km` : '');
        if (restante != null && restante <= 0) estado = 'VENCIDO';
        else if (restante != null && restante <= Math.max(500, p.triggerKm * 0.1)) estado = 'PROXIMO';
      } else if (p.nextExecutionDate) {
        const dias = Math.ceil((new Date(p.nextExecutionDate).getTime() - now.getTime()) / 86400000);
        detalle = `próxima: ${new Date(p.nextExecutionDate).toLocaleDateString('es-AR')} (${dias} días)`;
        if (dias < 0) estado = 'VENCIDO';
        else if (dias <= 7) estado = 'PROXIMO';
      }
      return { id: p.id, code: p.code, title: p.title, type: p.type, estado, detalle };
    });

    return reply.send({
      qr: { id: qr.id, activoNombre: qr.activoNombre, activoCodigo: qr.activoCodigo, titulo: qr.titulo, instrucciones: qr.instrucciones },
      activo: {
        id: asset.id, name: asset.name, code: asset.code, category: asset.category,
        manufacturer: asset.manufacturer, model: asset.model, serialNumber: asset.serialNumber,
        currentOdometer: asset.currentOdometer, status: asset.status,
      },
      empresa: { nombre: qr.tenant.name, logoUrl: settings?.logoUrl ?? null, primaryColor: settings?.primaryColor ?? '#2563eb' },
      tipos,
      preventivos,
      ultimasIntervenciones: ultimas,
    });
  });

  // ── RUTA PÚBLICA POST: registrar intervención realizada ─────────────────────
  app.post('/public/:token', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;
    const qr = await (app.prisma as any).maintenanceInterventionQR.findFirst({
      where: { token, isActive: true },
      include: { maintenanceAsset: true },
    });
    if (!qr) return reply.code(404).send({ error: 'QR no encontrado o inactivo' });

    const schema = z.object({
      performedByName: z.string().min(1).max(200),
      performedByEmail: z.string().email().optional().or(z.literal('')).transform(v => v || undefined),
      performedByPhone: z.string().max(50).optional().or(z.literal('')).transform(v => v || undefined),
      tipoIds: z.array(z.string().uuid()).min(1, 'Seleccioná al menos una tarea'),
      descripcion: z.string().max(2000).optional(),
      odometro: z.number().positive().optional(),
      performedAt: z.string().optional(),
      planId: z.string().uuid().optional().nullable(),
      fotos: z.array(z.object({ url: z.string() })).optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    // Resolver nombres de tipos seleccionados (snapshot)
    const tiposSel = await (app.prisma as any).maintenanceInterventionType.findMany({
      where: { id: { in: body.data.tipoIds }, tenantId: qr.tenantId },
      select: { id: true, name: true },
    });
    const tiposLabel = tiposSel.map((t: any) => t.name);
    if (tiposLabel.length === 0) return reply.code(400).send({ error: 'Tipos de intervención inválidos' });

    const asset = qr.maintenanceAsset;
    const km = body.data.odometro ?? null;
    const performedAt = body.data.performedAt ? new Date(body.data.performedAt) : new Date();

    // Validar plan si se indicó cumplimiento de preventivo
    let plan: any = null;
    if (body.data.planId) {
      plan = await (app.prisma as any).maintenancePlan.findFirst({
        where: { id: body.data.planId, assetId: asset.id, tenantId: qr.tenantId },
      });
    }

    const intervencion = await (app.prisma as any).maintenanceIntervention.create({
      data: {
        tenantId: qr.tenantId,
        qrId: qr.id,
        maintenanceAssetId: asset.id,
        tiposLabel,
        descripcion: body.data.descripcion || null,
        odometro: km,
        performedAt,
        performedByName: body.data.performedByName,
        performedByEmail: body.data.performedByEmail || null,
        performedByPhone: body.data.performedByPhone || null,
        fotos: body.data.fotos ?? null,
        planId: plan?.id ?? null,
        cumplioPreventivo: !!plan,
      },
    });

    await (app.prisma as any).maintenanceInterventionQR.update({
      where: { id: qr.id },
      data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
    });

    // Actualizar activo: odómetro + última fecha de mantenimiento
    try {
      const updateData: any = { lastMaintenanceDate: performedAt };
      if (km && (asset.currentOdometer == null || km > asset.currentOdometer)) {
        updateData.currentOdometer = km;
      }
      await (app.prisma as any).maintenanceAsset.update({ where: { id: asset.id }, data: updateData });
    } catch (e: any) { console.error('[intervenciones] asset update error:', e); }

    // Si se marcó cumplimiento de un plan preventivo, avanzarlo
    if (plan) {
      try {
        const planUpdate: any = {
          lastExecutionDate: performedAt,
          totalExecutions: { increment: 1 },
        };
        if (plan.frequencyUnit === 'KM' && km) {
          planUpdate.lastOdometerExecution = km;
        } else if (plan.nextExecutionDate) {
          const next = new Date(plan.nextExecutionDate);
          switch (plan.frequencyUnit) {
            case 'DAYS': next.setDate(next.getDate() + plan.frequencyValue); break;
            case 'WEEKS': next.setDate(next.getDate() + plan.frequencyValue * 7); break;
            case 'MONTHS': next.setMonth(next.getMonth() + plan.frequencyValue); break;
            case 'YEARS': next.setFullYear(next.getFullYear() + plan.frequencyValue); break;
          }
          planUpdate.nextExecutionDate = next;
        }
        await (app.prisma as any).maintenancePlan.update({ where: { id: plan.id }, data: planUpdate });
      } catch (e: any) { console.error('[intervenciones] plan update error:', e); }
    }

    // Registrar en historial del vehículo de flota (si el activo está vinculado a uno)
    try {
      const vehiculo = await (app.prisma as any).vehiculo.findFirst({
        where: { maintenanceAssetId: asset.id, tenantId: qr.tenantId },
      });
      if (vehiculo) {
        if (km && (vehiculo.currentOdometer == null || km > vehiculo.currentOdometer)) {
          await (app.prisma as any).vehiculo.update({
            where: { id: vehiculo.id },
            data: { currentOdometer: km },
          });
        }
        await (app.prisma as any).vehiculoHistorialMantenimiento.create({
          data: {
            tenantId: qr.tenantId,
            vehiculoId: vehiculo.id,
            fecha: performedAt,
            tipo: plan ? 'PREVENTIVE' : 'CORRECTIVE',
            descripcion: tiposLabel.join(' + ') + (body.data.descripcion ? ` — ${body.data.descripcion}` : ''),
            odometro: km ?? vehiculo.currentOdometer,
            notas: `Registrado vía QR por ${body.data.performedByName}`,
          },
        });
      }
    } catch (e: any) { console.error('[intervenciones] vehiculo historial error:', e); }

    // Notificar a admins
    notifyIntervencionRegistrada(app.prisma, {
      tenantId: qr.tenantId,
      activoNombre: qr.activoNombre,
      tiposLabel,
      performedByName: body.data.performedByName,
      cumplioPreventivo: !!plan,
      planTitle: plan?.title ?? null,
      intervencionId: intervencion.id,
    }).catch((e: any) => console.error('[intervenciones] notify error:', e));

    return reply.code(201).send({
      ok: true,
      intervencionId: intervencion.id,
      cumplioPreventivo: !!plan,
      planTitle: plan?.title ?? null,
      mensaje: plan
        ? `Intervención registrada. Se marcó como cumplido el preventivo "${plan.title}".`
        : 'Intervención registrada correctamente en la ficha del activo.',
    });
  });
}
