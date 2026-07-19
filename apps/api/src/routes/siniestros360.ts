import { z } from 'zod';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient, Prisma } from '@prisma/client';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import fs from 'node:fs';
import nodePath from 'node:path';
import { notifySiniestroCreado, notifyCambioEstado, notifyAlertaCritica, notifyDocumentoSubido } from './siniestros360-email.js';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.SINIESTROS360_JWT_SECRET || 'siniestros360-testing-secret-key-min32chars-xyz123';

interface JwtPayload { userId: string; email: string; tenantId: string; role: string; }

function verifyToken(req: FastifyRequest): JwtPayload | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as JwtPayload & { scope?: string };
    if (payload.scope !== 'siniestros360') return null;
    return payload;
  } catch { return null; }
}

async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<JwtPayload | null> {
  const p = verifyToken(req);
  if (!p) { reply.code(401).send({ error: 'No autorizado' }); return null; }
  return p;
}

function pad(n: number) { return String(n).padStart(5, '0'); }

export async function registerSiniestros360Routes(app: FastifyInstance) {

  // ── Email helper: obtiene emails admin/supervisor del tenant ──────────────
  async function getTenantAdminEmails(tenantId: string): Promise<string[]> {
    try {
      const members = await prisma.siniestro360TenantMembership.findMany({
        where: { tenantId, role: { in: ['SUPERADMIN', 'ADMIN', 'SUPERVISOR'] }, active: true },
        include: { user: { select: { email: true } } },
      });
      return members.map((m: any) => m.user?.email).filter(Boolean) as string[];
    } catch { return []; }
  }


  // ═══════════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════════
  app.post('/siniestros360/auth/login', async (req, reply) => {
    const { email, password } = req.body as any;
    if (!email || !password) return reply.code(400).send({ error: 'Email y contraseña requeridos' });
    const user = await prisma.siniestro360User.findFirst({
      where: { email, status: 'ACTIVE', deletedAt: null },
      include: { memberships: { where: { status: 'ACTIVE' }, include: { tenant: true } } },
    });
    if (!user || !user.passwordHash || !user.memberships?.length) return reply.code(401).send({ error: 'Credenciales inválidas o sin acceso' });
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) return reply.code(401).send({ error: 'Credenciales inválidas' });
    const m = user.memberships[0];
    const token = jwt.sign({ userId: user.id, email: user.email, tenantId: m.tenantId, role: m.role, scope: 'siniestros360' }, JWT_SECRET, { expiresIn: '7d' });
    return { token, user: { id: user.id, email: user.email, tenantId: m.tenantId, tenantName: m.tenant.name, role: m.role } };
  });

  app.get('/siniestros360/auth/me', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const user = await prisma.siniestro360User.findFirst({ where: { id: p.userId, deletedAt: null }, select: { id: true, email: true, name: true } });
    if (!user) return reply.code(404).send({ error: 'No encontrado' });
    return { ...user, tenantId: p.tenantId, role: p.role };
  });

  // ── SIGNUP (self-service: crea tenant + admin user) ──
  app.post('/siniestros360/auth/signup', async (req, reply) => {
    const { companyName, name, email, password, phone } = (req.body as any) || {};
    if (!companyName || !name || !email || !password) return reply.code(400).send({ error: 'Datos incompletos' });
    if (String(password).length < 8) return reply.code(400).send({ error: 'La contraseña debe tener al menos 8 caracteres' });
    const existing = await prisma.siniestro360User.findFirst({ where: { email, deletedAt: null } });
    if (existing) return reply.code(409).send({ error: 'Ya existe una cuenta con este email. Iniciá sesión o recuperá tu contraseña.' });
    const slugBase = String(companyName).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'tenant';
    let slug = `s360-${slugBase}`; let n = 1;
    while (await prisma.tenant.findUnique({ where: { slug } })) { slug = `s360-${slugBase}-${n++}`; }
    const passwordHash = await argon2.hash(password);
    let tenant: any, user: any;
    try {
      const result = await prisma.$transaction(async (tx: any) => {
        const t = await tx.tenant.create({ data: { name: companyName, slug, status: 'ACTIVE', licensePlan: 'TRIAL' } });
        const u = await tx.siniestro360User.create({ data: { tenantId: t.id, email, name, phone: phone ?? null, passwordHash, status: 'ACTIVE' } });
        await tx.siniestro360TenantMembership.create({ data: { tenantId: t.id, userId: u.id, role: 'ADMIN', status: 'ACTIVE' } });
        return { tenant: t, user: u };
      });
      tenant = result.tenant; user = result.user;
    } catch (err: any) {
      return reply.code(500).send({ error: 'No se pudo crear la cuenta. Intentá nuevamente.' });
    }
    try { const mod: any = await import('./siniestros360-email.js'); if (mod.sendSiniestros360WelcomeEmail) await mod.sendSiniestros360WelcomeEmail({ to: email, name, password, companyName }).catch(() => {}); } catch {}
    const token = jwt.sign({ userId: user.id, email: user.email, tenantId: tenant.id, role: 'ADMIN', scope: 'siniestros360' }, JWT_SECRET, { expiresIn: '7d' });
    return reply.code(201).send({ token, user: { id: user.id, email: user.email, name: user.name, role: 'ADMIN', tenantId: tenant.id, tenantName: tenant.name } });
  });

  // ── FORGOT PASSWORD (token DB, 1h) ──
  app.post('/siniestros360/auth/forgot-password', async (req, reply) => {
    const { email } = (req.body as any) || {};
    if (!email) return reply.code(400).send({ error: 'Email requerido' });
    const token = crypto.randomBytes(32).toString('hex');
    const user = await prisma.siniestro360User.findFirst({ where: { email, status: 'ACTIVE', deletedAt: null } });
    if (user) {
      const expiresAt = new Date(Date.now() + 3_600_000);
      await prisma.$executeRawUnsafe(`INSERT INTO siniestro360_password_resets (token, "userId", email, "expiresAt") VALUES ($1, $2::uuid, $3, $4)`, token, user.id, user.email, expiresAt);
      try { const mod: any = await import('./siniestros360-email.js'); if (mod.sendSiniestros360PasswordReset) await mod.sendSiniestros360PasswordReset(user.email, user.name || user.email, token).catch(() => {}); } catch {}
    }
    return reply.send({ ok: true, message: 'Si el correo existe en el sistema, recibirás instrucciones para restablecer tu contraseña.' });
  });

  // ── RESET PASSWORD ──
  app.post('/siniestros360/auth/reset-password', async (req, reply) => {
    const { token, password } = (req.body as any) || {};
    if (!token || !password || String(password).length < 8) return reply.code(400).send({ error: 'Datos inválidos' });
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT "userId", "expiresAt" FROM siniestro360_password_resets WHERE token = $1 LIMIT 1`, token);
    const entry = rows[0];
    if (!entry || new Date(entry.expiresAt).getTime() < Date.now()) {
      if (entry) await prisma.$executeRawUnsafe(`DELETE FROM siniestro360_password_resets WHERE token = $1`, token).catch(() => {});
      return reply.code(400).send({ error: 'Token inválido o expirado. Solicitá un nuevo enlace.' });
    }
    const passwordHash = await argon2.hash(password);
    await prisma.siniestro360User.update({ where: { id: entry.userId }, data: { passwordHash } });
    await prisma.$executeRawUnsafe(`DELETE FROM siniestro360_password_resets WHERE token = $1`, token).catch(() => {});
    return reply.send({ ok: true, message: 'Contraseña actualizada correctamente.' });
  });

  // ═══════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════

  const siniestroSchema = z.object({
    fecha: z.string().optional(),
    hora: z.string().optional(),
    descripcion: z.string().min(5, 'Descripción mínimo 5 caracteres').max(2000),
    ubicacion: z.string().max(500).optional(),
    status: z.enum(['ABIERTO', 'EN_ANALISIS', 'PENDIENTE_DOCUMENTACION', 'INFORMADO_ASEGURADORA', 'EN_PERITAJE', 'EN_REPARACION', 'EN_NEGOCIACION', 'APROBADO', 'RECHAZADO', 'CERRADO']).optional(),
    severity: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).optional(),
    priority: z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).optional(),
    montoEstimado: z.number().min(0).max(1_000_000_000).optional(),
    vehiculoId: z.string().uuid().optional().nullable(),
    conductorId: z.string().uuid().optional().nullable(),
    polizaId: z.string().uuid().optional().nullable(),
    aseguradoraId: z.string().uuid().optional().nullable(),
    peritoId: z.string().uuid().optional().nullable(),
    tallerId: z.string().uuid().optional().nullable(),
    terceroId: z.string().uuid().optional().nullable(),
  });

  app.get('/siniestros360/dashboard', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const tid = p.tenantId;

    const [abiertos, enAnalisis, pendDoc, informado, enPeritaje, aprobados, rechazados, cerrados] = await Promise.all([
      prisma.siniestro360.count({ where: { tenantId: tid, deletedAt: null, status: 'ABIERTO' } }),
      prisma.siniestro360.count({ where: { tenantId: tid, deletedAt: null, status: 'EN_ANALISIS' } }),
      prisma.siniestro360.count({ where: { tenantId: tid, deletedAt: null, status: 'PENDIENTE_DOCUMENTACION' } }),
      prisma.siniestro360.count({ where: { tenantId: tid, deletedAt: null, status: 'INFORMADO_ASEGURADORA' } }),
      prisma.siniestro360.count({ where: { tenantId: tid, deletedAt: null, status: 'EN_PERITAJE' } }),
      prisma.siniestro360.count({ where: { tenantId: tid, deletedAt: null, status: 'APROBADO' } }),
      prisma.siniestro360.count({ where: { tenantId: tid, deletedAt: null, status: 'RECHAZADO' } }),
      prisma.siniestro360.count({ where: { tenantId: tid, deletedAt: null, status: 'CERRADO' } }),
    ]);

    const totales = await prisma.siniestro360.aggregate({
      where: { tenantId: tid, deletedAt: null },
      _sum: { montoEstimado: true, montoFinal: true },
      _count: true,
    });

    const recentSiniestros = await prisma.siniestro360.findMany({
      where: { tenantId: tid, deletedAt: null },
      orderBy: { createdAt: 'desc' }, take: 10,
      include: { vehiculo: { select: { patente: true, marca: true, modelo: true } }, conductor: { select: { nombre: true, apellido: true } }, aseguradora: { select: { nombre: true } } },
    });

    const alertasPendientes = await prisma.siniestro360Alerta.count({ where: { tenantId: tid, leida: false } });
    const totalVehiculos = await prisma.siniestro360Vehiculo.count({ where: { tenantId: tid, deletedAt: null } });
    const totalPolizas = await prisma.siniestro360Poliza.count({ where: { tenantId: tid, deletedAt: null } });

    // Tendencia últimos 6 meses
    const now = new Date();
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const cnt = await prisma.siniestro360.count({ where: { tenantId: tid, deletedAt: null, createdAt: { gte: d, lt: end } } });
      trend.push({ mes: d.toLocaleString('es', { month: 'short' }), total: cnt });
    }

    return {
      kpis: { abiertos, enAnalisis, pendDoc, informado, enPeritaje, aprobados, rechazados, cerrados, total: totales._count, costoEstimado: totales._sum.montoEstimado || 0, costoFinal: totales._sum.montoFinal || 0, alertasPendientes, totalVehiculos, totalPolizas },
      recentSiniestros, trend,
    };
  });

  // ═══════════════════════════════════════════════════════════
  // SINIESTROS - CRUD COMPLETO
  // ═══════════════════════════════════════════════════════════
  app.get('/siniestros360/siniestros', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
        const { status, severity, priority, search, page = '1', limit = '20', desde, hasta, sortBy = 'createdAt', sortDir = 'desc' } = req.query as any;
    const where: any = { tenantId: p.tenantId, deletedAt: null };
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (priority) where.priority = priority;
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = new Date(desde);
      if (hasta) where.fecha.lte = new Date(hasta + 'T23:59:59');
    }
    if (search) where.OR = [
      { codigo: { contains: search, mode: 'insensitive' } },
      { descripcion: { contains: search, mode: 'insensitive' } },
      { ubicacion: { contains: search, mode: 'insensitive' } },
    ];
    const validSortFields: Record<string, boolean> = { createdAt: true, fecha: true, montoEstimado: true, codigo: true };
    const orderField = validSortFields[sortBy] ? sortBy : 'createdAt';
    const orderDir = sortDir === 'asc' ? 'asc' : 'desc';
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [items, total] = await Promise.all([
      prisma.siniestro360.findMany({ where, include: { vehiculo: { select: { patente: true, marca: true, modelo: true } }, conductor: { select: { nombre: true, apellido: true } }, poliza: { select: { numero: true } }, aseguradora: { select: { nombre: true } }, perito: { select: { nombre: true, apellido: true } }, taller: { select: { nombre: true } } }, orderBy: { [orderField]: orderDir }, skip, take: parseInt(limit) }),
      prisma.siniestro360.count({ where }),
    ]);
    return { items, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) };
  });

  app.get('/siniestros360/siniestros/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any;
    const item = await prisma.siniestro360.findFirst({ where: { id, tenantId: p.tenantId, deletedAt: null }, include: { vehiculo: true, conductor: true, poliza: { include: { aseguradora: true } }, aseguradora: true, perito: true, taller: true, tercero: true, documentos: { orderBy: { createdAt: 'desc' } }, historial: { orderBy: { createdAt: 'desc' }, take: 20 }, alertas: { where: { leida: false } } } });
    if (!item) return reply.code(404).send({ error: 'No encontrado' });
    return item;
  });

  app.post('/siniestros360/siniestros', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const bodyValidation = siniestroSchema.safeParse(req.body);
    if (!bodyValidation.success) return reply.status(400).send({ error: 'Validación fallida', details: bodyValidation.error.flatten().fieldErrors });
    const data = req.body as any;
    const count = await prisma.siniestro360.count({ where: { tenantId: p.tenantId } });
    const codigo = `SIN-${pad(count + 1)}`;
    const item = await prisma.siniestro360.create({
      data: { tenantId: p.tenantId, codigo, fecha: new Date(data.fecha || Date.now()), hora: data.hora, ubicacion: data.ubicacion, descripcion: data.descripcion, observaciones: data.observaciones, status: data.status || 'ABIERTO', severity: data.severity || 'MODERADO', priority: data.priority || 'MEDIA', conductorId: data.conductorId || null, vehiculoId: data.vehiculoId || null, terceroId: data.terceroId || null, polizaId: data.polizaId || null, aseguradoraId: data.aseguradoraId || null, peritoId: data.peritoId || null, tallerId: data.tallerId || null, montoEstimado: data.montoEstimado ? parseFloat(data.montoEstimado) : null, responsableId: p.userId, createdById: p.userId },
    });
    await prisma.siniestro360Historial.create({ data: { tenantId: p.tenantId, siniestroId: item.id, userId: p.userId, accion: 'CREADO', valorNuevo: `Siniestro ${codigo} creado` } });
    // Email: notify admins of new siniestro (async, non-blocking)
    setImmediate(() => {
      getTenantAdminEmails(p.tenantId).then(emails => {
        if (emails.length) notifySiniestroCreado(item, p.email, emails).catch(() => {});
      }).catch(() => {});
    });
    return reply.code(201).send(item);
  });

  app.put('/siniestros360/siniestros/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any;
    const data = req.body as any;
    const prev = await prisma.siniestro360.findFirst({ where: { id, tenantId: p.tenantId } });
    if (!prev) return reply.code(404).send({ error: 'No encontrado' });
    const item = await prisma.siniestro360.update({ where: { id }, data: { ...data, montoEstimado: data.montoEstimado ? parseFloat(data.montoEstimado) : prev.montoEstimado, montoFinal: data.montoFinal ? parseFloat(data.montoFinal) : prev.montoFinal, updatedById: p.userId } });
    if (data.status && data.status !== prev.status) {
      await prisma.siniestro360Historial.create({ data: { tenantId: p.tenantId, siniestroId: id, userId: p.userId, accion: 'CAMBIO_ESTADO', valorAnterior: prev.status, valorNuevo: data.status } });
    }
    return item;
  });

  app.delete('/siniestros360/siniestros/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any;
    const prev = await prisma.siniestro360.findFirst({ where: { id, tenantId: p.tenantId } });
    if (!prev) return reply.code(404).send({ error: 'No encontrado' });
    await prisma.siniestro360.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  });

  // ═══════════════════════════════════════════════════════════
  // QR SYSTEM
  // ═══════════════════════════════════════════════════════════
  app.get('/siniestros360/vehiculos/:id/qr', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any;
    const v = await prisma.siniestro360Vehiculo.findFirst({ where: { id, tenantId: p.tenantId } });
    if (!v) return reply.code(404).send({ error: 'No encontrado' });
    const token = jwt.sign({ vehiculoId: id, tenantId: p.tenantId, type: 'qr' }, JWT_SECRET, { expiresIn: '365d' });
    const url = `${process.env.NEXTAUTH_URL || 'https://test.logismart.ar'}/siniestros360/qr/${token}`;
    return { url, token, vehiculo: v };
  });

  app.post('/siniestros360/qr/submit', async (req, reply) => {
    const { token, descripcion, ubicacion, terceroNombre, terceroTelefono, danos, observaciones } = req.body as any;
    if (!token) return reply.code(400).send({ error: 'Token requerido' });
    let payload: any;
    try { payload = jwt.verify(token, JWT_SECRET) as any; } catch { return reply.code(401).send({ error: 'Token inválido' }); }
    if (payload.type !== 'qr') return reply.code(400).send({ error: 'Token inválido' });
    const v = await prisma.siniestro360Vehiculo.findFirst({ where: { id: payload.vehiculoId, tenantId: payload.tenantId } });
    if (!v) return reply.code(404).send({ error: 'Vehículo no encontrado' });
    const count = await prisma.siniestro360.count({ where: { tenantId: payload.tenantId } });
    const codigo = `SIN-QR-${pad(count + 1)}`;
    const siniestro = await prisma.siniestro360.create({
      data: { tenantId: payload.tenantId, codigo, fecha: new Date(), hora: new Date().toTimeString().slice(0, 5), ubicacion: ubicacion || 'Reporte QR', descripcion: descripcion || 'Reporte vía QR', observaciones, status: 'ABIERTO', severity: 'MODERADO', priority: 'MEDIA', vehiculoId: payload.vehiculoId, createdById: null }
    });
    if (terceroNombre) {
      const tercero = await prisma.siniestro360Tercero.create({ data: { tenantId: payload.tenantId, nombre: terceroNombre || '', apellido: '', dni: '', telefono: terceroTelefono || '', createdById: null } });
      await prisma.siniestro360.update({ where: { id: siniestro.id }, data: { terceroId: tercero.id } });
    }
    await prisma.siniestro360Historial.create({ data: { tenantId: payload.tenantId, siniestroId: siniestro.id, userId: null, accion: 'CREADO_QR', valorNuevo: `Siniestro reportado vía QR desde ${v.patente}` } });
    return reply.code(201).send({ ok: true, codigo: siniestro.codigo, id: siniestro.id });
  });

  app.get('/siniestros360/qr/info/:token', async (req, reply) => {
    const { token } = req.params as any;
    try {
      const payload = jwt.verify(token, JWT_SECRET) as any;
      if (payload.type !== 'qr') return reply.code(400).send({ error: 'Token inválido' });
      const v = await prisma.siniestro360Vehiculo.findFirst({ where: { id: payload.vehiculoId, tenantId: payload.tenantId }, select: { id: true, patente: true, marca: true, modelo: true, anio: true, tipo: true } });
      if (!v) return reply.code(404).send({ error: 'No encontrado' });
      return { vehiculo: v };
    } catch { return reply.code(401).send({ error: 'Token inválido o expirado' }); }
  });

  // ═══════════════════════════════════════════════════════════
  // VEHICULOS - CRUD COMPLETO
  // ═══════════════════════════════════════════════════════════
  app.get('/siniestros360/vehiculos', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { search } = req.query as any;
    const where: any = { tenantId: p.tenantId, deletedAt: null };
    if (search) where.OR = [{ patente: { contains: search, mode: 'insensitive' } }, { marca: { contains: search, mode: 'insensitive' } }, { modelo: { contains: search, mode: 'insensitive' } }];
    return prisma.siniestro360Vehiculo.findMany({ where, include: { conductores: { select: { nombre: true, apellido: true }, take: 1 }, _count: { select: { siniestros: true } } }, orderBy: { createdAt: 'desc' } });
  });

  app.post('/siniestros360/vehiculos', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const data = req.body as any;
    const item = await prisma.siniestro360Vehiculo.create({ data: { tenantId: p.tenantId, patente: data.patente?.toUpperCase(), marca: data.marca, modelo: data.modelo, anio: parseInt(data.anio), color: data.color, tipo: data.tipo, chasis: data.vin, createdById: p.userId } });
    return reply.code(201).send(item);
  });

  app.put('/siniestros360/vehiculos/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any; const data = req.body as any;
    const prev = await prisma.siniestro360Vehiculo.findFirst({ where: { id, tenantId: p.tenantId } });
    if (!prev) return reply.code(404).send({ error: 'No encontrado' });
    return prisma.siniestro360Vehiculo.update({ where: { id }, data: { ...data, patente: data.patente?.toUpperCase(), anio: data.anio ? parseInt(data.anio) : prev.anio } });
  });

  app.delete('/siniestros360/vehiculos/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any;
    const prev = await prisma.siniestro360Vehiculo.findFirst({ where: { id, tenantId: p.tenantId } });
    if (!prev) return reply.code(404).send({ error: 'No encontrado' });
    await prisma.siniestro360Vehiculo.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  });

  // ═══════════════════════════════════════════════════════════
  // CONDUCTORES - CRUD COMPLETO
  // ═══════════════════════════════════════════════════════════
  app.get('/siniestros360/conductores', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { search } = req.query as any;
    const where: any = { tenantId: p.tenantId, deletedAt: null };
    if (search) where.OR = [{ nombre: { contains: search, mode: 'insensitive' } }, { apellido: { contains: search, mode: 'insensitive' } }, { dni: { contains: search } }];
    return prisma.siniestro360Conductor.findMany({ where, include: { vehiculo: { select: { patente: true, marca: true } }, _count: { select: { siniestros: true } } }, orderBy: { createdAt: 'desc' } });
  });

  app.post('/siniestros360/conductores', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const data = req.body as any;
    const item = await prisma.siniestro360Conductor.create({ data: { tenantId: p.tenantId, nombre: data.nombre, apellido: data.apellido, dni: data.dni, licencia: data.licencia, telefono: data.telefono, email: data.email, vehiculoId: data.vehiculoId || null, createdById: p.userId } });
    return reply.code(201).send(item);
  });

  app.put('/siniestros360/conductores/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any; const data = req.body as any;
    const prev = await prisma.siniestro360Conductor.findFirst({ where: { id, tenantId: p.tenantId } });
    if (!prev) return reply.code(404).send({ error: 'No encontrado' });
    return prisma.siniestro360Conductor.update({ where: { id }, data });
  });

  app.delete('/siniestros360/conductores/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any;
    await prisma.siniestro360Conductor.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  });

  // ═══════════════════════════════════════════════════════════
  // POLIZAS - CRUD COMPLETO
  // ═══════════════════════════════════════════════════════════
  app.get('/siniestros360/polizas', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { search, status } = req.query as any;
    const where: any = { tenantId: p.tenantId, deletedAt: null };
    if (status) where.status = status;
    if (search) where.OR = [{ numero: { contains: search, mode: 'insensitive' } }, { compania: { contains: search, mode: 'insensitive' } }];
    return prisma.siniestro360Poliza.findMany({ where, include: { aseguradora: { select: { nombre: true } }, vehiculo: { select: { patente: true, marca: true, modelo: true } }, _count: { select: { siniestros: true } } }, orderBy: { vigenciaHasta: 'asc' } });
  });

  app.post('/siniestros360/polizas', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const data = req.body as any;
    const item = await prisma.siniestro360Poliza.create({ data: { tenantId: p.tenantId, numero: data.numero, compania: data.compania, tipo: data.tipo, cobertura: data.cobertura || null, sumaAsegurada: data.sumaAsegurada ? parseFloat(data.sumaAsegurada) : null, franquicia: data.franquicia ? parseFloat(data.franquicia) : null, vigenciaDesde: new Date(data.vigenciaDesde), vigenciaHasta: new Date(data.vigenciaHasta), aseguradoraId: data.aseguradoraId || null, vehiculoId: data.vehiculoId || null, createdById: p.userId } });
    return reply.code(201).send(item);
  });

  app.put('/siniestros360/polizas/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any; const data = req.body as any;
    const prev = await prisma.siniestro360Poliza.findFirst({ where: { id, tenantId: p.tenantId } });
    if (!prev) return reply.code(404).send({ error: 'No encontrado' });
    return prisma.siniestro360Poliza.update({ where: { id }, data: { ...data, sumaAsegurada: data.sumaAsegurada ? parseFloat(data.sumaAsegurada) : prev.sumaAsegurada, franquicia: data.franquicia ? parseFloat(data.franquicia) : prev.franquicia, vigenciaDesde: data.vigenciaDesde ? new Date(data.vigenciaDesde) : prev.vigenciaDesde, vigenciaHasta: data.vigenciaHasta ? new Date(data.vigenciaHasta) : prev.vigenciaHasta } });
  });

  app.delete('/siniestros360/polizas/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any;
    await prisma.siniestro360Poliza.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  });

  // ═══════════════════════════════════════════════════════════
  // PERITOS - CRUD COMPLETO
  // ═══════════════════════════════════════════════════════════
  app.get('/siniestros360/peritos', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { search, status } = req.query as any;
    const where: any = { tenantId: p.tenantId, deletedAt: null };
    if (status) where.status = status;
    if (search) where.OR = [{ nombre: { contains: search, mode: 'insensitive' } }, { apellido: { contains: search, mode: 'insensitive' } }, { matricula: { contains: search, mode: 'insensitive' } }];
    return prisma.siniestro360Perito.findMany({ where, include: { _count: { select: { siniestros: true } } }, orderBy: { createdAt: 'desc' } });
  });

  app.post('/siniestros360/peritos', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const data = req.body as any;
    const item = await prisma.siniestro360Perito.create({ data: { tenantId: p.tenantId, nombre: data.nombre, apellido: data.apellido, matricula: data.matricula, telefono: data.telefono, email: data.email, especialidad: data.especialidad, status: data.status || 'DISPONIBLE', createdById: p.userId } });
    return reply.code(201).send(item);
  });

  app.put('/siniestros360/peritos/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any; const data = req.body as any;
    const prev = await prisma.siniestro360Perito.findFirst({ where: { id, tenantId: p.tenantId } });
    if (!prev) return reply.code(404).send({ error: 'No encontrado' });
    return prisma.siniestro360Perito.update({ where: { id }, data });
  });

  app.delete('/siniestros360/peritos/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any;
    await prisma.siniestro360Perito.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  });

  // ═══════════════════════════════════════════════════════════
  // TALLERES - CRUD COMPLETO
  // ═══════════════════════════════════════════════════════════
  app.get('/siniestros360/talleres', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { search, status } = req.query as any;
    const where: any = { tenantId: p.tenantId, deletedAt: null };
    if (status) where.status = status;
    if (search) where.OR = [{ nombre: { contains: search, mode: 'insensitive' } }, { cuit: { contains: search } }];
    return prisma.siniestro360Taller.findMany({ where, include: { _count: { select: { siniestros: true } } }, orderBy: { createdAt: 'desc' } });
  });

  app.post('/siniestros360/talleres', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const data = req.body as any;
    const item = await prisma.siniestro360Taller.create({ data: { tenantId: p.tenantId, nombre: data.nombre, cuit: data.cuit, telefono: data.telefono, email: data.email, direccion: data.direccion, especialidad: data.especialidad, status: data.status || 'ACTIVO', createdById: p.userId } });
    return reply.code(201).send(item);
  });

  app.put('/siniestros360/talleres/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any; const data = req.body as any;
    const prev = await prisma.siniestro360Taller.findFirst({ where: { id, tenantId: p.tenantId } });
    if (!prev) return reply.code(404).send({ error: 'No encontrado' });
    return prisma.siniestro360Taller.update({ where: { id }, data });
  });

  app.delete('/siniestros360/talleres/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any;
    await prisma.siniestro360Taller.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  });

  // ═══════════════════════════════════════════════════════════
  // ASEGURADORAS - CRUD COMPLETO
  // ═══════════════════════════════════════════════════════════
  app.get('/siniestros360/aseguradoras', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { search } = req.query as any;
    const where: any = { tenantId: p.tenantId, deletedAt: null };
    if (search) where.OR = [{ nombre: { contains: search, mode: 'insensitive' } }, { cuit: { contains: search } }];
    return prisma.siniestro360Aseguradora.findMany({ where, include: { _count: { select: { polizas: true, siniestros: true } } }, orderBy: { createdAt: 'desc' } });
  });

  app.post('/siniestros360/aseguradoras', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const data = req.body as any;
    const item = await prisma.siniestro360Aseguradora.create({ data: { tenantId: p.tenantId, nombre: data.nombre, cuit: data.cuit, telefono: data.telefono, email: data.email, direccion: data.direccion, contactoSiniestros: data.contactoSiniestros, telefonoSiniestros: data.telefonoSiniestros, createdById: p.userId } });
    return reply.code(201).send(item);
  });

  app.put('/siniestros360/aseguradoras/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any; const data = req.body as any;
    const prev = await prisma.siniestro360Aseguradora.findFirst({ where: { id, tenantId: p.tenantId } });
    if (!prev) return reply.code(404).send({ error: 'No encontrado' });
    return prisma.siniestro360Aseguradora.update({ where: { id }, data });
  });

  app.delete('/siniestros360/aseguradoras/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any;
    await prisma.siniestro360Aseguradora.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  });

  // ═══════════════════════════════════════════════════════════
  // TERCEROS
  // ═══════════════════════════════════════════════════════════
  app.get('/siniestros360/terceros', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    return prisma.siniestro360Tercero.findMany({ where: { tenantId: p.tenantId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
  });

  app.post('/siniestros360/terceros', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const data = req.body as any;
    const item = await prisma.siniestro360Tercero.create({ data: { tenantId: p.tenantId, nombre: data.nombre, apellido: data.apellido, dni: data.dni, telefono: data.telefono, email: data.email, direccion: data.direccion, companiaAseguradora: data.companiaAseguradora, numeroPoliza: data.numeroPoliza, patenteVehiculo: data.patenteVehiculo, marcaVehiculo: data.marcaVehiculo, modeloVehiculo: data.modeloVehiculo, createdById: p.userId } });
    return reply.code(201).send(item);
  });

  // ═══════════════════════════════════════════════════════════
  // ALERTAS
  // ═══════════════════════════════════════════════════════════
  app.get('/siniestros360/alertas', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { leida } = req.query as any;
    const where: any = { tenantId: p.tenantId };
    if (leida !== undefined) where.leida = leida === 'true';
    return prisma.siniestro360Alerta.findMany({ where, include: { siniestro: { select: { codigo: true, descripcion: true } } }, orderBy: { createdAt: 'desc' }, take: 50 });
  });

  app.patch('/siniestros360/alertas/:id/leer', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any;
    await prisma.siniestro360Alerta.update({ where: { id }, data: { leida: true } });
    return { ok: true };
  });

  app.patch('/siniestros360/alertas/leer-todas', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    await prisma.siniestro360Alerta.updateMany({ where: { tenantId: p.tenantId, leida: false }, data: { leida: true } });
    return { ok: true };
  });


  app.post('/siniestros360/alertas', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { siniestroId, tipo, mensaje, prioridad = 'MEDIA', fechaVencimiento } = req.body as any;
    if (!tipo || !mensaje) return reply.status(400).send({ error: 'tipo y mensaje son requeridos' });
    const alerta = await prisma.siniestro360Alerta.create({
      data: {
        tenant: { connect: { id: p.tenantId } },
        ...(siniestroId ? { siniestro: { connect: { id: siniestroId } } } : {}),
        tipo,
        mensaje,
        prioridad,
        fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
        leida: false,
      }
    });
    // Email: notify on CRITICA/LEGAL alerts
    try {
      if (prioridad === 'CRITICA' || tipo === 'LEGAL' || tipo === 'VENCIMIENTO') {
        const adminEmails = await getTenantAdminEmails(p.tenantId);
        if (adminEmails.length) await notifyAlertaCritica(alerta, adminEmails).catch(() => {});
      }
    } catch {}
    return alerta;
  });

  // ═══════════════════════════════════════════════════════════
  // HISTORIAL
  // ═══════════════════════════════════════════════════════════
  app.get('/siniestros360/historial', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { siniestroId, page = '1' } = req.query as any;
    const where: any = { tenantId: p.tenantId };
    if (siniestroId) where.siniestroId = siniestroId;
    const [items, total] = await Promise.all([
      prisma.siniestro360Historial.findMany({ where, include: { siniestro: { select: { codigo: true } }, user: { select: { email: true } } }, orderBy: { createdAt: 'desc' }, skip: (parseInt(page) - 1) * 50, take: 50 }),
      prisma.siniestro360Historial.count({ where }),
    ]);
    return { items, total };
  });

  // ═══════════════════════════════════════════════════════════
  // IA ANALIZADORA DE POLIZAS — GROQ REAL
  // ═══════════════════════════════════════════════════════════
  let groqClient: any = null;
  if (process.env.GROQ_API_KEY) {
    try {
      const { Groq } = await import('groq-sdk');
      groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    } catch { groqClient = null; }
  }

  app.post('/siniestros360/ia/analizar-poliza', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { polizaId, siniestroId, texto, guardarHistorial } = req.body as any;

    let contexto = '';
    let siniestroData: any = null;
    let polizaData: any = null;

    if (siniestroId) {
      siniestroData = await prisma.siniestro360.findFirst({
        where: { id: siniestroId, tenantId: p.tenantId },
        include: {
          vehiculo: { select: { patente: true, marca: true, modelo: true } },
          conductor: { select: { nombre: true, apellido: true } },
          aseguradora: { select: { nombre: true } },
        }
      });
      if (siniestroData) {
        contexto += `\n=== DATOS DEL SINIESTRO ===\nCódigo: ${siniestroData.codigo}\nDescripción: ${siniestroData.descripcion || 'N/A'}\nFecha: ${siniestroData.fecha?.toLocaleDateString('es-AR') || 'N/A'}\nUbicación: ${siniestroData.ubicacion || 'N/A'}\nEstado: ${siniestroData.status}\nGravedad: ${siniestroData.severity}\nMonto estimado: $${siniestroData.montoEstimado || 0}\nVehículo: ${siniestroData.vehiculo ? siniestroData.vehiculo.patente + ' ' + siniestroData.vehiculo.marca + ' ' + siniestroData.vehiculo.modelo : 'N/A'}\nConductor: ${siniestroData.conductor ? siniestroData.conductor.nombre + ' ' + (siniestroData.conductor.apellido || '') : 'N/A'}\nAseguradora: ${siniestroData.aseguradora?.nombre || 'N/A'}`;
      }
    }

    if (polizaId) {
      polizaData = await prisma.siniestro360Poliza.findFirst({
        where: { id: polizaId, tenantId: p.tenantId },
        include: { aseguradora: { select: { nombre: true } } }
      });
      if (polizaData) {
        contexto += `\n=== DATOS DE LA PÓLIZA ===\nNúmero: ${polizaData.numero}\nCompañía: ${polizaData.compania}\nTipo: ${polizaData.tipo}\nCobertura: ${polizaData.cobertura || 'N/A'}\nSuma asegurada: $${polizaData.sumaAsegurada || 0}\nFranquicia: $${polizaData.franquicia || 0}\nVigencia: ${polizaData.vigenciaDesde?.toLocaleDateString('es-AR') || 'N/A'} - ${polizaData.vigenciaHasta?.toLocaleDateString('es-AR') || 'N/A'}`;
      }
    }

    if (texto) contexto += `\n=== TEXTO ADICIONAL / CLÁUSULAS ===\n${texto}`;

    if (!contexto.trim()) {
      return reply.code(400).send({ error: 'Se requiere al menos un siniestro, póliza o texto para analizar' });
    }

    if (!groqClient) {
      return reply.code(503).send({ error: 'Motor IA no configurado. Configure GROQ_API_KEY en las variables de entorno.' });
    }

    const systemPrompt = `Eres un experto en seguros y siniestros de flota vehicular en Argentina con 20 años de experiencia. Analizas pólizas, cláusulas y datos de siniestros para determinar coberturas, riesgos y acciones a tomar. Siempre respondes en español argentino con terminología técnica del sector asegurador.`;

    const userPrompt = `Analiza la siguiente información de un siniestro/póliza y proporciona un análisis profesional:

${contexto}

Responde ÚNICAMENTE con un JSON válido (sin texto adicional, sin markdown) con esta estructura:
{
  "nivelRiesgo": "BAJO|MEDIO|ALTO|CRITICO",
  "coberturaAplicable": "descripción breve de qué cobertura aplica en este caso",
  "exclusionesPosibles": ["exclusión relevante 1", "exclusión relevante 2"],
  "plazosDenuncia": "descripción de plazos críticos (ej: 72hs para denuncia formal)",
  "riesgosRechazo": ["riesgo principal 1", "riesgo 2"],
  "documentacionRequerida": ["documento 1", "documento 2", "documento 3"],
  "recomendaciones": ["acción recomendada 1", "acción 2", "acción 3"],
  "alertasUrgentes": ["alerta crítica si aplica, o vacío si no hay"],
  "resumenEjecutivo": "Párrafo de 2-3 oraciones con el análisis ejecutivo del caso",
  "probabilidadAprobacion": "ALTA|MEDIA|BAJA|MUY_BAJA",
  "franquiciaAplica": true,
  "accionInmediata": "Qué hacer en las próximas 24-48 horas para maximizar la cobertura"
}`;

    try {
      const completion = await groqClient.chat.completions.create({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.15,
        max_tokens: 1800,
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0]?.message?.content || '{}';
      let analisis: any;
      try {
        analisis = JSON.parse(raw);
      } catch {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        analisis = jsonMatch ? JSON.parse(jsonMatch[0]) : { resumenEjecutivo: raw };
      }

      if (guardarHistorial && siniestroId) {
        await prisma.siniestro360Historial.create({
          data: {
            tenantId: p.tenantId,
            siniestroId,
            userId: p.userId,
            accion: 'ANALISIS_IA',
            campo: 'ia',
            valorAnterior: null,
            valorNuevo: `Riesgo: ${analisis.nivelRiesgo} | Prob. aprobación: ${analisis.probabilidadAprobacion} | ${(analisis.resumenEjecutivo || '').slice(0, 250)}`,
          }
        });
      }

      return {
        ...analisis,
        motorIA: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        timestamp: new Date().toISOString(),
        contextoAnalizado: {
          tieneSiniestro: !!siniestroData,
          tienePoliza: !!polizaData,
          tieneTextoAdicional: !!texto,
          tokensSiniestro: siniestroData?.codigo || null,
        },
      };
    } catch (err: any) {
      app.log.error('[S360-IA] Groq error:', err.message);
      return reply.code(500).send({ error: 'Error al procesar análisis IA: ' + err.message });
    }
  });


  // ═══════════════════════════════════════════════════════════
  // REPORTES
  // ═══════════════════════════════════════════════════════════
  app.get('/siniestros360/reportes/resumen', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { desde, hasta } = req.query as any;
    const tid = p.tenantId;
    const where: any = { tenantId: tid, deletedAt: null };
    if (desde) where.fecha = { ...where.fecha, gte: new Date(desde) };
    if (hasta) where.fecha = { ...where.fecha, lte: new Date(hasta) };

    const [siniestros, totales, porStatus, porSeveridad] = await Promise.all([
      prisma.siniestro360.findMany({ where, include: { vehiculo: { select: { patente: true, marca: true } }, conductor: { select: { nombre: true, apellido: true } }, aseguradora: { select: { nombre: true } } }, orderBy: { fecha: 'desc' } }),
      prisma.siniestro360.aggregate({ where, _sum: { montoEstimado: true, montoFinal: true }, _count: true, _avg: { montoEstimado: true } }),
      prisma.siniestro360.groupBy({ by: ['status'], where, _count: true }),
      prisma.siniestro360.groupBy({ by: ['severity'], where, _count: true }),
    ]);

    return { siniestros, totales, porStatus, porSeveridad, generado: new Date().toISOString(), tenant: tid };
  });

  // ═══════════════════════════════════════════════════════════
  // USUARIOS DEL MODULO
  // ═══════════════════════════════════════════════════════════
  app.get('/siniestros360/usuarios', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const members = await prisma.siniestro360TenantMembership.findMany({
      where: { tenantId: p.tenantId, status: 'ACTIVE' },
      include: { user: { select: { id: true, email: true } } },
    });
    return members.map(m => ({ id: m.user.id, email: m.user.email, role: m.role, status: m.status, joinedAt: m.createdAt }));
  });

  app.post('/siniestros360/usuarios', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    if (p.role !== 'ADMIN') return reply.code(403).send({ error: 'Solo administradores pueden crear usuarios' });
    const { email, password, role } = req.body as any;
    if (!email || !password) return reply.code(400).send({ error: 'Email y contraseña requeridos' });
    const hash = await argon2.hash(password);
    let user = await prisma.siniestro360User.findFirst({ where: { email, tenantId: p.tenantId } });
    if (!user) { user = await prisma.siniestro360User.create({ data: { email, passwordHash: hash, tenantId: p.tenantId, status: 'ACTIVE' } }); }
    const exists = await prisma.siniestro360TenantMembership.findFirst({ where: { tenantId: p.tenantId, userId: user.id } });
    if (exists) return reply.code(409).send({ error: 'El usuario ya tiene acceso' });
    await prisma.siniestro360TenantMembership.create({ data: { tenantId: p.tenantId, userId: user.id, role: role || 'OPERADOR', status: 'ACTIVE' } });
    return reply.code(201).send({ id: user.id, email: user.email, role: role || 'OPERADOR' });
  });


  // ═══════════════════════════════════════════════════════════
  // TERCEROS — CRUD COMPLETO
  // ═══════════════════════════════════════════════════════════
  app.get('/siniestros360/terceros/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any;
    const item = await prisma.siniestro360Tercero.findFirst({
      where: { id, tenantId: p.tenantId, deletedAt: null },
      include: { siniestros: { select: { id: true, codigo: true, descripcion: true, status: true, fecha: true }, where: { deletedAt: null } } }
    });
    if (!item) return reply.code(404).send({ error: 'No encontrado' });
    return item;
  });

  app.put('/siniestros360/terceros/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any;
    const data = req.body as any;
    const existing = await prisma.siniestro360Tercero.findFirst({ where: { id, tenantId: p.tenantId, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: 'No encontrado' });
    const item = await prisma.siniestro360Tercero.update({
      where: { id },
      data: {
        nombre: data.nombre ?? existing.nombre,
        apellido: data.apellido ?? existing.apellido,
        dni: data.dni ?? existing.dni,
        telefono: data.telefono ?? existing.telefono,
        email: data.email ?? existing.email,
        direccion: data.direccion ?? existing.direccion,
        companiaAseguradora: data.companiaAseguradora ?? existing.companiaAseguradora,
        numeroPoliza: data.numeroPoliza ?? existing.numeroPoliza,
        patenteVehiculo: data.patenteVehiculo ?? existing.patenteVehiculo,
        marcaVehiculo: data.marcaVehiculo ?? existing.marcaVehiculo,
        modeloVehiculo: data.modeloVehiculo ?? existing.modeloVehiculo,
        updatedById: p.userId,
      }
    });
    return item;
  });

  app.delete('/siniestros360/terceros/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    if (!['SUPERADMIN', 'ADMIN'].includes(p.role)) return reply.code(403).send({ error: 'Sin permiso' });
    const { id } = req.params as any;
    const existing = await prisma.siniestro360Tercero.findFirst({ where: { id, tenantId: p.tenantId, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: 'No encontrado' });
    await prisma.siniestro360Tercero.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  });

  // ═══════════════════════════════════════════════════════════
  // USUARIOS — CRUD COMPLETO
  // ═══════════════════════════════════════════════════════════
  app.put('/siniestros360/usuarios/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    if (!['SUPERADMIN', 'ADMIN'].includes(p.role)) return reply.code(403).send({ error: 'Solo administradores' });
    const { id } = req.params as any;
    const { role, status, firstName, lastName } = req.body as any;
    const membership = await prisma.siniestro360TenantMembership.findFirst({ where: { userId: id, tenantId: p.tenantId } });
    if (!membership) return reply.code(404).send({ error: 'Usuario no encontrado en este tenant' });
    if (membership.userId === p.userId && status === 'INACTIVE') return reply.code(400).send({ error: 'No puedes desactivarte a ti mismo' });
    await prisma.siniestro360TenantMembership.update({ where: { id: membership.id }, data: { ...(role && { role }), ...(status && { status }) } });
    if (firstName !== undefined || lastName !== undefined) {
      await prisma.siniestro360User.update({ where: { id }, data: { ...(firstName !== undefined && { firstName }), ...(lastName !== undefined && { lastName }) } });
    }
    return { ok: true };
  });

  app.delete('/siniestros360/usuarios/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    if (!['SUPERADMIN', 'ADMIN'].includes(p.role)) return reply.code(403).send({ error: 'Solo administradores' });
    const { id } = req.params as any;
    if (id === p.userId) return reply.code(400).send({ error: 'No puedes eliminarte a ti mismo' });
    const membership = await prisma.siniestro360TenantMembership.findFirst({ where: { userId: id, tenantId: p.tenantId } });
    if (!membership) return reply.code(404).send({ error: 'No encontrado' });
    await prisma.siniestro360TenantMembership.update({ where: { id: membership.id }, data: { status: 'INACTIVE' } });
    return { ok: true };
  });

  // ═══════════════════════════════════════════════════════════
  // HISTORIAL — NOTA MANUAL
  // ═══════════════════════════════════════════════════════════
  app.post('/siniestros360/historial', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { siniestroId, descripcion } = req.body as any;
    if (!siniestroId || !descripcion?.trim()) return reply.code(400).send({ error: 'siniestroId y descripción requeridos' });
    const siniestro = await prisma.siniestro360.findFirst({ where: { id: siniestroId, tenantId: p.tenantId, deletedAt: null } });
    if (!siniestro) return reply.code(404).send({ error: 'Siniestro no encontrado' });
    const item = await prisma.siniestro360Historial.create({
      data: { tenantId: p.tenantId, siniestroId, userId: p.userId, accion: 'NOTA_MANUAL', campo: 'nota', valorAnterior: null, valorNuevo: descripcion.trim() }
    });
    return reply.code(201).send(item);
  });

  // ═══════════════════════════════════════════════════════════
  // SINIESTRO — FLUJO DE ESTADOS
  // ═══════════════════════════════════════════════════════════
  app.patch('/siniestros360/siniestros/:id/estado', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any;
    const { status, motivo } = req.body as any;
    const VALID = ['ABIERTO','EN_ANALISIS','PENDIENTE_DOCUMENTACION','INFORMADO_ASEGURADORA','EN_PERITAJE','EN_REPARACION','EN_NEGOCIACION','APROBADO','RECHAZADO','CERRADO'];
    if (!VALID.includes(status)) return reply.code(400).send({ error: 'Estado inválido' });
    const s = await prisma.siniestro360.findFirst({ where: { id, tenantId: p.tenantId, deletedAt: null } });
    if (!s) return reply.code(404).send({ error: 'No encontrado' });
    const prev = s.status;
    const dates: any = {};
    if (status === 'INFORMADO_ASEGURADORA') dates.fechaInformacionAseguradora = new Date();
    if (status === 'EN_PERITAJE') dates.fechaPeritaje = new Date();
    if (status === 'APROBADO') dates.fechaAprobacion = new Date();
    if (status === 'RECHAZADO') dates.fechaRechazo = new Date();
    if (status === 'CERRADO') dates.fechaCierre = new Date();
    await prisma.siniestro360.update({ where: { id }, data: { status, ...dates, updatedById: p.userId } });
    await prisma.siniestro360Historial.create({
      data: { tenantId: p.tenantId, siniestroId: id, userId: p.userId, accion: 'CAMBIO_ESTADO', campo: 'status', valorAnterior: prev, valorNuevo: status + (motivo ? ` — ${motivo}` : '') }
    });
    if (status === 'RECHAZADO') {
      await prisma.siniestro360Alerta.create({
        data: { tenantId: p.tenantId, siniestroId: id, tipo: 'RECHAZO', mensaje: `Siniestro ${s.codigo} fue rechazado${motivo ? ': ' + motivo : ''}`, prioridad: 'ALTA', leida: false }
      });
    }
    // Email: notify on estado change
    setImmediate(() => {
      getTenantAdminEmails(p.tenantId).then(emails => {
        if (emails.length) notifyCambioEstado({ id, codigo: s.codigo }, prev, status, p.email, emails).catch(() => {});
      }).catch(() => {});
    });
    return { ok: true, status, prevStatus: prev };
  });

  // ═══════════════════════════════════════════════════════════
  // SINIESTRO — DATOS ECONÓMICOS
  // ═══════════════════════════════════════════════════════════
  app.patch('/siniestros360/siniestros/:id/economico', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any;
    const body = req.body as any;
    const s = await prisma.siniestro360.findFirst({ where: { id, tenantId: p.tenantId, deletedAt: null } });
    if (!s) return reply.code(404).send({ error: 'No encontrado' });
    const upd: any = { updatedById: p.userId };
    if (body.montoEstimado !== undefined) upd.montoEstimado = Number(body.montoEstimado);
    if (body.montoFinal !== undefined) upd.montoFinal = Number(body.montoFinal);
    if (body.franquicia !== undefined) upd.franquicia = Number(body.franquicia);
    if (body.recuperado !== undefined) upd.recuperado = Number(body.recuperado);
    if (body.observaciones !== undefined) upd.observaciones = body.observaciones;
    await prisma.siniestro360.update({ where: { id }, data: upd });
    await prisma.siniestro360Historial.create({
      data: { tenantId: p.tenantId, siniestroId: id, userId: p.userId, accion: 'ACTUALIZACION_ECONOMICA', campo: 'economico', valorAnterior: JSON.stringify({ montoEstimado: s.montoEstimado, montoFinal: s.montoFinal }), valorNuevo: JSON.stringify({ montoEstimado: body.montoEstimado, montoFinal: body.montoFinal }) }
    });
    return { ok: true };
  });

  // ═══════════════════════════════════════════════════════════
  // SINIESTRO — ASIGNACIONES
  // ═══════════════════════════════════════════════════════════
  app.patch('/siniestros360/siniestros/:id/asignaciones', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any;
    const { peritoId, tallerId, conductorId, vehiculoId, polizaId, aseguradoraId } = req.body as any;
    const s = await prisma.siniestro360.findFirst({ where: { id, tenantId: p.tenantId, deletedAt: null } });
    if (!s) return reply.code(404).send({ error: 'No encontrado' });
    const upd: any = { updatedById: p.userId };
    const cambios: string[] = [];
    if (peritoId !== undefined) { upd.peritoId = peritoId || null; cambios.push('perito'); }
    if (tallerId !== undefined) { upd.tallerId = tallerId || null; cambios.push('taller'); }
    if (conductorId !== undefined) { upd.conductorId = conductorId || null; cambios.push('conductor'); }
    if (vehiculoId !== undefined) { upd.vehiculoId = vehiculoId || null; cambios.push('vehículo'); }
    if (polizaId !== undefined) { upd.polizaId = polizaId || null; cambios.push('póliza'); }
    if (aseguradoraId !== undefined) { upd.aseguradoraId = aseguradoraId || null; cambios.push('aseguradora'); }
    if (cambios.length === 0) return reply.code(400).send({ error: 'Sin campos para actualizar' });
    await prisma.siniestro360.update({ where: { id }, data: upd });
    await prisma.siniestro360Historial.create({
      data: { tenantId: p.tenantId, siniestroId: id, userId: p.userId, accion: 'ASIGNACION', campo: cambios.join(', '), valorAnterior: null, valorNuevo: `Actualizado: ${cambios.join(', ')}` }
    });
    return { ok: true, updated: cambios };
  });

  // ═══════════════════════════════════════════════════════════
  // DOCUMENTOS
  // ═══════════════════════════════════════════════════════════
  const UPLOAD_DIR = process.env.UPLOAD_DIR || (fs.existsSync('/app/uploads') ? '/app/uploads/s360' : './uploads/s360');
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  app.get('/siniestros360/documentos', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { siniestroId } = req.query as any;
    if (!siniestroId) return reply.code(400).send({ error: 'siniestroId requerido' });
    return prisma.siniestro360Documento.findMany({ where: { tenantId: p.tenantId, siniestroId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
  });

  app.post('/siniestros360/documentos', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { siniestroId, tipo, titulo, descripcion, fileData, fileName } = req.body as any;
    if (!siniestroId || !tipo || !titulo || !fileData) return reply.code(400).send({ error: 'siniestroId, tipo, titulo y fileData requeridos' });
    const siniestro = await prisma.siniestro360.findFirst({ where: { id: siniestroId, tenantId: p.tenantId, deletedAt: null } });
    if (!siniestro) return reply.code(404).send({ error: 'Siniestro no encontrado' });
    const buffer = Buffer.from(fileData, 'base64');
    const ext = fileName ? nodePath.extname(fileName) : '.bin';
    const stored = `${p.tenantId.slice(0, 8)}_${Date.now()}${ext}`;
    fs.writeFileSync(nodePath.join(UPLOAD_DIR, stored), buffer);
    const doc = await prisma.siniestro360Documento.create({
      data: { tenantId: p.tenantId, siniestroId, tipo, titulo, descripcion: descripcion || null, archivo: stored, tamano: buffer.length, createdById: p.userId }
    });
    await prisma.siniestro360Historial.create({
      data: { tenantId: p.tenantId, siniestroId, userId: p.userId, accion: 'DOCUMENTO_SUBIDO', campo: 'documentos', valorAnterior: null, valorNuevo: `${tipo}: ${titulo}` }
    });
    return reply.code(201).send(doc);
  });

  app.get('/siniestros360/documentos/:id/file', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any;
    const doc = await prisma.siniestro360Documento.findFirst({ where: { id, tenantId: p.tenantId, deletedAt: null } });
    if (!doc) return reply.code(404).send({ error: 'No encontrado' });
    const fullPath = nodePath.join(UPLOAD_DIR, doc.archivo);
    if (!fs.existsSync(fullPath)) return reply.code(404).send({ error: 'Archivo no encontrado en storage' });
    const buffer = fs.readFileSync(fullPath);
    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.titulo)}"`);
    reply.header('Content-Type', 'application/octet-stream');
    return reply.send(buffer);
  });

  app.delete('/siniestros360/documentos/:id', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { id } = req.params as any;
    const doc = await prisma.siniestro360Documento.findFirst({ where: { id, tenantId: p.tenantId, deletedAt: null } });
    if (!doc) return reply.code(404).send({ error: 'No encontrado' });
    await prisma.siniestro360Documento.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  });

  // ═══════════════════════════════════════════════════════════
  // IA — ANÁLISIS REAL CON GROQ
  // ═══════════════════════════════════════════════════════════

    app.log.info('[SINIESTROS360] ✅ Enterprise routes registered — v2.0');
  // ═══════════════════════════════════════════════════════════
  // REPORTES — EXPORTACIÓN CSV + RESUMEN MEJORADO
  // ═══════════════════════════════════════════════════════════
  app.get('/siniestros360/reportes/exportar', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { desde, hasta, status, severity, formato = 'csv' } = req.query as any;
    const tid = p.tenantId;
    const where: any = { tenantId: tid, deletedAt: null };
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = new Date(desde);
      if (hasta) where.fecha.lte = new Date(hasta + 'T23:59:59');
    }
    if (status) where.status = status;
    if (severity) where.severity = severity;

    const siniestros = await prisma.siniestro360.findMany({
      where,
      include: {
        vehiculo: { select: { patente: true, marca: true, modelo: true } },
        conductor: { select: { nombre: true, apellido: true } },
        aseguradora: { select: { nombre: true } },
        poliza: { select: { numero: true, compania: true } },
        perito: { select: { nombre: true, apellido: true } },
        taller: { select: { nombre: true } },
      },
      orderBy: { fecha: 'desc' },
      take: 5000,
    });

    // Build CSV
    const headers = [
      'Código', 'Fecha', 'Estado', 'Gravedad', 'Prioridad',
      'Descripción', 'Ubicación', 'Vehículo', 'Patente',
      'Conductor', 'Aseguradora', 'Póliza',
      'Monto Estimado', 'Monto Final', 'Franquicia', 'Recuperado',
      'Perito', 'Taller',
    ];

    const escape = (v: any) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    };

    const rows = siniestros.map(s => [
      s.codigo,
      s.fecha ? new Date(s.fecha).toLocaleDateString('es-AR') : '',
      s.status,
      s.severity,
      s.priority,
      s.descripcion || '',
      s.ubicacion || '',
      s.vehiculo ? `${s.vehiculo.marca} ${s.vehiculo.modelo}` : '',
      s.vehiculo?.patente || '',
      s.conductor ? `${s.conductor.nombre} ${s.conductor.apellido || ''}`.trim() : '',
      s.aseguradora?.nombre || '',
      s.poliza?.numero || '',
      s.montoEstimado || 0,
      s.montoFinal || 0,
      s.franquicia || 0,
      s.recuperado || 0,
      s.perito ? `${s.perito.nombre} ${s.perito.apellido || ''}`.trim() : '',
      s.taller?.nombre || '',
    ].map(escape).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const filename = `siniestros360_export_${new Date().toISOString().slice(0, 10)}.csv`;

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send('\uFEFF' + csv); // BOM for Excel UTF-8
  });

  app.get('/siniestros360/reportes/stats', async (req, reply) => {
    const p = await requireAuth(req, reply); if (!p) return;
    const { desde, hasta } = req.query as any;
    const tid = p.tenantId;
    const where: any = { tenantId: tid, deletedAt: null };
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = new Date(desde);
      if (hasta) where.fecha.lte = new Date(hasta + 'T23:59:59');
    }

    const [byStatus, bySeverity, allSiniestros, totals] = await Promise.all([
      prisma.siniestro360.groupBy({ by: ['status'], where, _count: true }),
      prisma.siniestro360.groupBy({ by: ['severity'], where, _count: true }),
      prisma.siniestro360.findMany({ where, select: { fecha: true, montoEstimado: true }, orderBy: { fecha: 'asc' } }),
      prisma.siniestro360.aggregate({
        where,
        _count: true,
        _sum: { montoEstimado: true, montoFinal: true, recuperado: true },
        _avg: { montoEstimado: true },
      }),
    ]);

    // Aggregate by month in JS
    const monthMap: Record<string, { total: number; monto: number }> = {};
    for (const s of allSiniestros) {
      if (!s.fecha) continue;
      const mes = new Date(s.fecha).toISOString().slice(0, 7);
      if (!monthMap[mes]) monthMap[mes] = { total: 0, monto: 0 };
      monthMap[mes].total++;
      monthMap[mes].monto += s.montoEstimado || 0;
    }
    const byMonth = Object.entries(monthMap)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 12)
      .map(([mes, v]) => ({ mes, ...v }));

    return {
      byStatus: byStatus.map(s => ({ status: s.status, count: s._count })),
      bySeverity: bySeverity.map(s => ({ severity: s.severity, count: s._count })),
      byMonth,
      totales: {
        total: totals._count,
        montoEstimadoTotal: totals._sum.montoEstimado || 0,
        montoFinalTotal: totals._sum.montoFinal || 0,
        recuperadoTotal: totals._sum.recuperado || 0,
        montoEstimadoPromedio: Math.round(totals._avg.montoEstimado || 0),
      },
    };
  });

}
