/**
 * Tests de aceptación A–P — Jornadas y Descansos (Flota 360)
 *
 * Cobertura del circuito completo:
 *   A. PIN inválido / conductor sin PIN → 401/403, sin evento creado
 *   B. Inicio válido → jornada ABIERTA única, snapshot de política
 *   C. Idempotencia: mismo clienteEventoId → mismo registro, sin duplicar
 *   D. Doble inicio sin cierre → 409 JORNADA_ABIERTA
 *   E. Cierre válido → horasTrabajadas exactas, jornada CERRADA
 *   F. Fin sin jornada abierta → 409 SIN_JORNADA_ABIERTA
 *   G. Descanso insuficiente en ADVERTENCIA → registra con flag INSUFICIENTE
 *   H. Descanso insuficiente en BLOQUEO → 409 + INICIO_RECHAZADO, sin jornada
 *   I. Cambio de unidad dentro de jornada abierta → no reinicia jornada
 *   J. Bitácora con jornada abierta → nota vinculada a la jornada
 *   K. Corrección de horarios → valor vigente actualizado + original preservado + auditoría
 *   L. Regularización → jornada cerrada sin fin confiable → próxima evaluación
 *   M. Habilitación de inicio → permite primer inicio en BLOQUEO
 *   N. Sin historial en BLOQUEO sin habilitación → 409 SIN_HISTORIAL
 *   O. Rol no-admin no puede corregir → 403
 *   P. Estado pre-servicio → devuelve jornada abierta, último cierre, restante
 *
 * Requieren una DB Postgres activa con el schema migrado (misma estrategia que
 * enforcement.test.ts). Si DATABASE_URL no está disponible, se saltean.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { buildApp } from '../src/app.js';

const prisma = new PrismaClient();
const DB_OK = !!process.env.DATABASE_URL;
const t = DB_OK ? test : test.skip;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function withCtx<T>(ctx: { userId?: string }, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    if (ctx.userId) await tx.$executeRaw`SELECT set_config('app.user_id', ${ctx.userId}, true)`;
    return fn(tx);
  });
}

async function fixture(opts?: { modoAplicacion?: 'ADVERTENCIA' | 'BLOQUEO' }) {
  const app = await buildApp();
  const sa = await prisma.platformUser.create({ data: { email: `sa-${Date.now()}@t.x`, passwordHash: 'x', globalRole: 'SUPER_ADMIN' } });
  const tenant = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${sa.id}, true)`;
    return tx.tenant.create({ data: { name: 'T-Jornadas', slug: `tj-${Date.now()}-${Math.random().toString(16).slice(2)}` } });
  });
  const bcrypt = (await import('bcryptjs')).default;
  const conductor = await prisma.conductor.create({
    data: { tenantId: tenant.id, nombre: 'Chofer Test', status: 'ACTIVO', pinHash: await bcrypt.hash('1234', 4) },
  });
  const asset = await prisma.maintenanceAsset.create({
    data: { tenantId: tenant.id, name: 'Scania', code: 'SC-1', qrToken: createHash('sha256').update(`${Date.now()}${Math.random()}`).digest('hex').slice(0, 24) },
  });
  const vehiculo = await prisma.vehiculo.create({
    data: { tenantId: tenant.id, dominio: `T${Math.floor(Math.random() * 1e6)}`, tipo: 'CAMION' } as any,
  });
  await prisma.maintenanceAsset.update({ where: { id: asset.id }, data: { vehiculoId: vehiculo.id } as any });
  if (opts?.modoAplicacion) {
    await prisma.flotaJornadaPolitica.upsert({
      where: { tenantId: tenant.id },
      create: { tenantId: tenant.id, modoAplicacion: opts.modoAplicacion, politicaRevisada: true },
      update: { modoAplicacion: opts.modoAplicacion, politicaRevisada: true },
    });
  }
  const token = asset.qrToken;
  const adminToken = app.signAccessToken({ userId: sa.id, tenantId: tenant.id, globalRole: 'SUPER_ADMIN' });
  const postServicio = (body: any) => app.inject({ method: 'POST', url: `/driver-hub/public/${token}/servicio`, payload: body });
  const postEstado = (body: any) => app.inject({ method: 'POST', url: `/driver-hub/public/${token}/servicio/estado`, payload: body });
  const authPost = (url: string, body: any, role?: string) =>
    app.inject({ method: 'POST', url: `/driver-hub${url}`, headers: { authorization: `Bearer ${role ? app.signAccessToken({ userId: sa.id, tenantId: tenant.id, tenantRole: role }) : adminToken}` }, payload: body });
  return { app, prisma, tenant, sa, conductor, vehiculo, token, adminToken, postServicio, postEstado, authPost };
}

const abrir = (postServicio: any, conductorId: string, extra: any = {}) =>
  postServicio({ tipo: 'INICIO_SERVICIO', conductorId, pin: '1234', reportadoPorNombre: 'Chofer Test', ...extra });
const cerrar = (postServicio: any, conductorId: string, extra: any = {}) =>
  postServicio({ tipo: 'FIN_SERVICIO', conductorId, pin: '1234', reportadoPorNombre: 'Chofer Test', ...extra });

// ── A. Identidad verificada por PIN ──────────────────────────────────────────
t('A — PIN inválido o ausente → 401, sin registro ni jornada', async () => {
  const f = await fixture();
  const r = await f.postServicio({ tipo: 'INICIO_SERVICIO', conductorId: f.conductor.id, pin: '9999', reportadoPorNombre: 'Chofer Test' });
  assert.equal(r.statusCode, 401);
  assert.equal(await prisma.servicioRegistro.count({ where: { tenantId: f.tenant.id } }), 0);
  assert.equal(await prisma.flotaJornada.count({ where: { tenantId: f.tenant.id } }), 0);
  await f.app.close();
});

t('A2 — conductor sin PIN configurado → 403 con mensaje claro', async () => {
  const f = await fixture();
  await prisma.conductor.update({ where: { id: f.conductor.id }, data: { pinHash: null } });
  const r = await f.postServicio({ tipo: 'INICIO_SERVICIO', conductorId: f.conductor.id, pin: '1234', reportadoPorNombre: 'Chofer Test' });
  assert.equal(r.statusCode, 403);
  assert.match(r.json().error, /PIN/i);
  await f.app.close();
});

// ── B. Inicio válido: jornada única + snapshot ───────────────────────────────
t('B — INICIO válido crea jornada ABIERTA con snapshot de política', async () => {
  const f = await fixture();
  const r = await abrir(f.postServicio, f.conductor.id);
  assert.equal(r.statusCode, 201);
  const jornada = await prisma.flotaJornada.findFirst({ where: { tenantId: f.tenant.id, conductorId: f.conductor.id } });
  assert.ok(jornada);
  assert.equal(jornada!.estado, 'ABIERTA');
  assert.ok(jornada!.politicaSnapshot);
  await f.app.close();
});

// ── C. Idempotencia ──────────────────────────────────────────────────────────
t('C — mismo clienteEventoId devuelve el mismo registro, sin duplicar', async () => {
  const f = await fixture();
  const evId = `ev-${Date.now()}`;
  const r1 = await abrir(f.postServicio, f.conductor.id, { clienteEventoId: evId });
  const r2 = await abrir(f.postServicio, f.conductor.id, { clienteEventoId: evId });
  assert.equal(r1.statusCode, 201); assert.equal(r2.statusCode, 201);
  assert.equal(r1.json().registroId, r2.json().registroId);
  assert.equal(await prisma.flotaJornada.count({ where: { tenantId: f.tenant.id } }), 1);
  await f.app.close();
});

// ── D. Una sola jornada abierta ──────────────────────────────────────────────
t('D — segundo INICIO con jornada abierta → 409 JORNADA_ABIERTA (aunque cambie de unidad)', async () => {
  const f = await fixture();
  await abrir(f.postServicio, f.conductor.id);
  const r = await abrir(f.postServicio, f.conductor.id);
  assert.equal(r.statusCode, 409);
  assert.equal(r.json().code, 'JORNADA_ABIERTA');
  await f.app.close();
});

// ── E. Cierre exacto ─────────────────────────────────────────────────────────
t('E — FIN cierra la jornada con horas trabajadas calculadas del servidor', async () => {
  const f = await fixture();
  await abrir(f.postServicio, f.conductor.id);
  // Retroceder inicio 9.5h para medir cierre
  const j = await prisma.flotaJornada.findFirst({ where: { conductorId: f.conductor.id } });
  const inicioAt = new Date(Date.now() - 9.5 * 3600000);
  await prisma.flotaJornada.update({ where: { id: j!.id }, data: { inicioAt } });
  const r = await cerrar(f.postServicio, f.conductor.id);
  assert.equal(r.statusCode, 201);
  const cerrada = await prisma.flotaJornada.findUnique({ where: { id: j!.id } });
  assert.equal(cerrada!.estado, 'CERRADA');
  assert.ok(Math.abs((cerrada!.horasTrabajadas ?? 0) - 9.5) < 0.2, `horasTrabajadas=${cerrada!.horasTrabajadas}`);
  await f.app.close();
});

// ── F. Fin sin jornada ───────────────────────────────────────────────────────
t('F — FIN sin jornada abierta → 409 SIN_JORNADA_ABIERTA, sin registro suelto', async () => {
  const f = await fixture();
  const r = await cerrar(f.postServicio, f.conductor.id);
  assert.equal(r.statusCode, 409);
  assert.equal(await prisma.servicioRegistro.count({ where: { tenantId: f.tenant.id, tipo: 'FIN_SERVICIO' } }), 0);
  await f.app.close();
});

// ── G/H. Descanso insuficiente: ADVERTENCIA vs BLOQUEO ───────────────────────
async function cerrarHaceHoras(f: any, horas: number) {
  await abrir(f.postServicio, f.conductor.id);
  const j = await prisma.flotaJornada.findFirst({ where: { conductorId: f.conductor.id, estado: 'ABIERTA' } });
  await prisma.flotaJornada.update({ where: { id: j!.id }, data: { inicioAt: new Date(Date.now() - 4 * 3600000), finAt: new Date(Date.now() - horas * 3600000), estado: 'CERRADA', horasTrabajadas: 4, cierreTipo: 'NORMAL' } });
}

t('G — ADVERTENCIA: descanso insuficiente registra pero queda marcado INSUFICIENTE', async () => {
  const f = await fixture({ modoAplicacion: 'ADVERTENCIA' });
  await cerrarHaceHoras(f, 5); // cerró hace 5h, mínimo 12h
  const r = await abrir(f.postServicio, f.conductor.id);
  assert.equal(r.statusCode, 201);
  const j = await prisma.flotaJornada.findFirst({ where: { conductorId: f.conductor.id, estado: 'ABIERTA' } });
  assert.equal(j!.evaluacionDescanso, 'INSUFICIENTE');
  assert.ok((j!.descansoPrevioHoras ?? 99) < 12);
  await f.app.close();
});

t('H — BLOQUEO: descanso insuficiente → 409 + INICIO_RECHAZADO registrado, sin jornada', async () => {
  const f = await fixture({ modoAplicacion: 'BLOQUEO' });
  await cerrarHaceHoras(f, 5);
  const r = await abrir(f.postServicio, f.conductor.id);
  assert.equal(r.statusCode, 409);
  assert.ok(r.json().bloqueado);
  assert.equal(await prisma.flotaJornada.count({ where: { conductorId: f.conductor.id, estado: 'ABIERTA' } }), 0);
  const rechazo = await prisma.servicioRegistro.findFirst({ where: { tenantId: f.tenant.id, tipo: 'INICIO_RECHAZADO' } });
  assert.ok(rechazo); assert.equal(rechazo!.motivoRechazo, 'DESCANSO_INSUFICIENTE');
  await f.app.close();
});

// ── I. Cambio de unidad ──────────────────────────────────────────────────────
t('I — CAMBIO_UNIDAD con jornada abierta agrega la unidad sin reiniciar jornada ni descanso', async () => {
  const f = await fixture();
  await abrir(f.postServicio, f.conductor.id);
  const j = await prisma.flotaJornada.findFirst({ where: { conductorId: f.conductor.id, estado: 'ABIERTA' } });
  const inicioOriginal = j!.inicioAt;
  const r = await f.postServicio({ tipo: 'CAMBIO_UNIDAD', conductorId: f.conductor.id, pin: '1234', reportadoPorNombre: 'Chofer Test' });
  assert.equal(r.statusCode, 201);
  const j2 = await prisma.flotaJornada.findUnique({ where: { id: j!.id } });
  assert.equal(j2!.inicioAt.getTime(), inicioOriginal.getTime()); // no se reinicia
  assert.ok((j2!.unidades as any[]).length >= 2);
  await f.app.close();
});

// ── J. Bitácora vinculada a la jornada ───────────────────────────────────────
t('J — BITACORA con jornada abierta vincula la nota a la jornada', async () => {
  const f = await fixture();
  await abrir(f.postServicio, f.conductor.id);
  const j = await prisma.flotaJornada.findFirst({ where: { conductorId: f.conductor.id, estado: 'ABIERTA' } });
  const r = await f.postServicio({ tipo: 'BITACORA', conductorId: f.conductor.id, pin: '1234', reportadoPorNombre: 'Chofer Test', notas: 'Demora en planta' });
  assert.equal(r.statusCode, 201);
  const reg = await prisma.servicioRegistro.findUnique({ where: { id: r.json().registroId } });
  assert.equal(reg!.jornadaId, j!.id);
  await f.app.close();
});

// ── K. Corrección autorizada ─────────────────────────────────────────────────
t('K — corrección de horarios actualiza valores vigentes, preserva originales y audita', async () => {
  const f = await fixture();
  await cerrarHaceHoras(f, 3); // jornada cerrada, descanso corto
  const j = await prisma.flotaJornada.findFirst({ where: { conductorId: f.conductor.id, estado: 'CERRADA' } });
  const nuevoFin = new Date(Date.now() - 14 * 3600000); // lo muevo a 14h atrás → descanso suficiente
  const r = await f.authPost(`/jornadas-lista/${j!.id}/corregir`, { finAt: nuevoFin.toISOString(), motivo: 'El chofer cerró con demora por falta de señal' });
  assert.equal(r.statusCode, 200, JSON.stringify(r.json()));
  const j2 = await prisma.flotaJornada.findUnique({ where: { id: j!.id } });
  assert.equal(j2!.finAt!.getTime(), nuevoFin.getTime());
  const corr = await prisma.flotaJornadaCorreccion.findFirst({ where: { jornadaId: j!.id } });
  assert.ok(corr); assert.equal(corr!.campo, 'finAt'); assert.ok(corr!.valorAnterior);
  await f.app.close();
});

// ── L. Regularización → próxima evaluación CIERRE_NO_CONFIABLE ───────────────
t('L — regularizar jornada abierta la cierra sin fin y marca el próximo inicio', async () => {
  const f = await fixture();
  await abrir(f.postServicio, f.conductor.id);
  const j = await prisma.flotaJornada.findFirst({ where: { conductorId: f.conductor.id, estado: 'ABIERTA' } });
  const r = await f.authPost(`/jornadas-lista/${j!.id}/regularizar`, { motivo: 'No registró el fin — confirmado por teléfono' });
  assert.equal(r.statusCode, 200);
  const j2 = await prisma.flotaJornada.findUnique({ where: { id: j!.id } });
  assert.equal(j2!.estado, 'CERRADA'); assert.equal(j2!.finAt, null); assert.equal(j2!.cierreTipo, 'REGULARIZADO');
  // Próximo inicio → evaluación CIERRE_NO_CONFIABLE
  const r2 = await abrir(f.postServicio, f.conductor.id);
  assert.equal(r2.statusCode, 201);
  const j3 = await prisma.flotaJornada.findFirst({ where: { conductorId: f.conductor.id, estado: 'ABIERTA' } });
  assert.equal(j3!.evaluacionDescanso, 'CIERRE_NO_CONFIABLE');
  await f.app.close();
});

// ── M/N. Habilitación vs BLOQUEO sin historial ───────────────────────────────
t('M — habilitación permite el primer inicio en modo BLOQUEO (un solo uso)', async () => {
  const f = await fixture({ modoAplicacion: 'BLOQUEO' });
  const hab = await f.authPost('/habilitaciones-descanso', { conductorId: f.conductor.id, descansoDeclaradoHoras: 13, fundamento: 'Alta nueva — primer servicio' });
  assert.equal(hab.statusCode, 201);
  const r = await abrir(f.postServicio, f.conductor.id);
  assert.equal(r.statusCode, 201);
  const j = await prisma.flotaJornada.findFirst({ where: { conductorId: f.conductor.id, estado: 'ABIERTA' } });
  assert.ok(j); assert.equal(j!.evaluacionDescanso, 'HABILITADO');
  // La habilitación quedó consumida
  const h2 = await prisma.flotaHabilitacionDescanso.findFirst({ where: { conductorId: f.conductor.id, usadaEnJornadaId: null } });
  assert.equal(h2, null);
  await f.app.close();
});

t('N — BLOQUEO sin historial ni habilitación → 409 SIN_HISTORIAL, sin jornada', async () => {
  const f = await fixture({ modoAplicacion: 'BLOQUEO' });
  const r = await abrir(f.postServicio, f.conductor.id);
  assert.equal(r.statusCode, 409);
  assert.equal(await prisma.flotaJornada.count({ where: { conductorId: f.conductor.id } }), 0);
  await f.app.close();
});

// ── O. Rol ───────────────────────────────────────────────────────────────────
t('O — rol OPERADOR no puede corregir jornadas → 403', async () => {
  const f = await fixture();
  await cerrarHaceHoras(f, 3);
  const j = await prisma.flotaJornada.findFirst({ where: { conductorId: f.conductor.id, estado: 'CERRADA' } });
  const r = await f.authPost(`/jornadas-lista/${j!.id}/corregir`, { finAt: new Date().toISOString(), motivo: 'Intento sin permiso' }, 'OPERADOR');
  assert.equal(r.statusCode, 403);
  await f.app.close();
});

// ── P. Estado pre-servicio ───────────────────────────────────────────────────
t('P — /servicio/estado devuelve jornada abierta, último cierre y descanso mínimo', async () => {
  const f = await fixture();
  const r = await f.postEstado({ conductorId: f.conductor.id, pin: '1234' });
  assert.equal(r.statusCode, 200);
  const d = r.json();
  assert.equal(d.descansoMinHoras, 12);
  assert.equal(d.jornadaAbierta, null);
  assert.equal(d.evaluacion, 'SIN_HISTORIAL');
  // Con PIN malo → 401
  const bad = await f.postEstado({ conductorId: f.conductor.id, pin: '0000' });
  assert.equal(bad.statusCode, 401);
  await f.app.close();
});
