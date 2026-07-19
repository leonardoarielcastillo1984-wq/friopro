import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import XLSX from 'xlsx';
import { createGroqOnlyLLMProvider } from '../services/llm/factory.js';
import {
  computeAbsenceDays,
  enrichBalance,
  computeAvailable,
  round2,
  type HolidayLike,
} from '../domain/absenceCalc.js';
import { queueEmail } from '../jobs/emailQueue.js';
import type { EmailPayload } from '../services/email.js';
import { absenceSubmittedEmail, absenceApprovedEmail, absenceRejectedEmail } from '../services/absenceEmailTemplates.js';

// -------- HELPERS --------
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cleanUUID = (v: string | undefined | null) => (v && UUID_RE.test(v) ? v : undefined);
const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (val === '' || val === null ? undefined : val), schema);
const parseDate = (v: string | undefined) => (v ? new Date(v) : undefined);
const empFullName = (e: any) => (e ? `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() : '—');

// Estados de solicitud que "ocupan" al empleado (para detectar solapamientos)
const ACTIVE_REQUEST_STATUSES = [
  'SUBMITTED',
  'PENDING_APPROVAL',
  'PENDING_DOCS',
  'PENDING_COVERAGE',
  'APPROVED',
  'IN_PROGRESS',
];

async function resolveUserName(tx: any, userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const u = await tx.platformUser.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    });
    if (!u) return null;
    const full = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
    return full || u.email || null;
  } catch {
    return null;
  }
}

// Catálogo de tipos por defecto (configurable; el tenant puede editar/desactivar)
const DEFAULT_ABSENCE_TYPES = [
  { code: 'VACATION', name: 'Vacaciones', color: '#3B82F6', requiresBalance: true, deductsBalance: true, countingMode: 'BUSINESS', approvalRule: 'JEFE_RRHH' },
  { code: 'SICK', name: 'Licencia por enfermedad', color: '#EF4444', requiresDocumentation: true, sensitiveData: true, countingMode: 'CALENDAR', approvalRule: 'RRHH', allowsRetroactive: true },
  { code: 'STUDY', name: 'Licencia por estudio', color: '#8B5CF6', requiresDocumentation: true, countingMode: 'BUSINESS', approvalRule: 'JEFE_RRHH' },
  { code: 'MATERNITY', name: 'Licencia por maternidad', color: '#EC4899', requiresDocumentation: true, sensitiveData: true, countingMode: 'CALENDAR', approvalRule: 'RRHH' },
  { code: 'PATERNITY', name: 'Licencia por paternidad', color: '#06B6D4', requiresDocumentation: true, countingMode: 'CALENDAR', approvalRule: 'RRHH' },
  { code: 'SPECIAL', name: 'Licencia especial', color: '#14B8A6', countingMode: 'CALENDAR', approvalRule: 'RRHH' },
  { code: 'JUSTIFIED', name: 'Ausencia justificada', color: '#F59E0B', requiresDocumentation: true, countingMode: 'CALENDAR', allowsRetroactive: true, approvalRule: 'RRHH' },
  { code: 'UNJUSTIFIED', name: 'Ausencia injustificada', color: '#DC2626', countingMode: 'CALENDAR', allowsRetroactive: true, approvalRule: 'RRHH' },
  { code: 'COMP_DAY', name: 'Día compensatorio', color: '#22C55E', requiresBalance: true, deductsBalance: true, countingMode: 'BUSINESS', approvalRule: 'JEFE' },
  { code: 'DAY_OFF', name: 'Franco', color: '#84CC16', countingMode: 'BUSINESS', approvalRule: 'JEFE' },
  { code: 'SUSPENSION', name: 'Suspensión', color: '#6B7280', countingMode: 'CALENDAR', sensitiveData: true, approvalRule: 'RRHH', allowsRetroactive: true },
  { code: 'OTHER', name: 'Otro', color: '#94A3B8', countingMode: 'CALENDAR', approvalRule: 'RRHH' },
];

const DEFAULT_POLICY = {
  workingWeekdays: [1, 2, 3, 4, 5],
  allowNegativeBalance: false,
  allowExceptions: true,
  defaultMinAdvanceDays: 0,
  carryoverEnabled: true,
  pendingRequestSlaHours: 48,
  sensitiveVisibilityRoles: [] as string[],
};

// Deriva el período (año) desde una fecha de inicio
const periodOf = (d: Date) => String(d.getUTCFullYear());

// -------- SCHEMAS --------
const typeSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: emptyToUndefined(z.string().optional()),
  color: emptyToUndefined(z.string().optional()),
  active: z.boolean().optional(),
  requiresBalance: z.boolean().optional(),
  deductsBalance: z.boolean().optional(),
  requiresDocumentation: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  allowsSelfService: z.boolean().optional(),
  countingMode: z.enum(['BUSINESS', 'CALENDAR']).optional(),
  allowsHalfDay: z.boolean().optional(),
  allowsRetroactive: z.boolean().optional(),
  requiresSubstitute: z.boolean().optional(),
  requiresCoverage: z.boolean().optional(),
  sensitiveData: z.boolean().optional(),
  approvalRule: emptyToUndefined(z.string().optional()),
  minAdvanceDays: z.number().int().optional(),
  maxDurationDays: z.number().int().optional(),
  config: z.any().optional(),
});

const policySchema = z.object({
  workingWeekdays: z.array(z.number().int().min(0).max(6)).optional(),
  allowNegativeBalance: z.boolean().optional(),
  allowExceptions: z.boolean().optional(),
  defaultMinAdvanceDays: z.number().int().optional(),
  defaultMaxDurationDays: z.number().int().nullable().optional(),
  carryoverEnabled: z.boolean().optional(),
  carryoverMaxDays: z.number().int().nullable().optional(),
  carryoverExpiryMonths: z.number().int().nullable().optional(),
  pendingRequestSlaHours: z.number().int().optional(),
  sensitiveVisibilityRoles: z.array(z.string()).optional(),
  config: z.any().optional(),
});

const holidaySchema = z.object({
  date: z.string().min(1),
  name: z.string().min(1),
  scope: emptyToUndefined(z.string().optional()),
  location: emptyToUndefined(z.string().optional()),
  recurring: z.boolean().optional(),
  active: z.boolean().optional(),
});

const balanceSchema = z.object({
  employeeId: z.string().uuid(),
  absenceTypeId: z.string().uuid(),
  period: z.string().min(1),
  assignedDays: z.number().optional(),
  carriedDays: z.number().optional(),
  accruedDays: z.number().optional(),
  expiresAt: emptyToUndefined(z.string().optional()),
  notes: emptyToUndefined(z.string().optional()),
  reason: emptyToUndefined(z.string().optional()),
});

const adjustSchema = z.object({
  amount: z.number(), // positivo o negativo
  reason: z.string().min(1),
});

const requestSchema = z.object({
  employeeId: z.string().uuid(),
  absenceTypeId: z.string().uuid(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  halfDay: z.boolean().optional(),
  startTime: emptyToUndefined(z.string().optional()),
  endTime: emptyToUndefined(z.string().optional()),
  reason: emptyToUndefined(z.string().optional()),
  notes: emptyToUndefined(z.string().optional()),
  substituteEmployeeId: emptyToUndefined(z.string().uuid().optional()),
  affectedProcessIds: z.array(z.string()).optional(),
  affectedFunctions: emptyToUndefined(z.string().optional()),
  createdByHr: z.boolean().optional(),
  override: z.boolean().optional(), // excepción autorizada (requiere reason)
  overrideReason: emptyToUndefined(z.string().optional()),
});

const decisionSchema = z.object({
  comment: emptyToUndefined(z.string().optional()),
});

const attachmentSchema = z.object({
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  fileType: emptyToUndefined(z.string().optional()),
  category: emptyToUndefined(z.string().optional()),
  sensitive: z.boolean().optional(),
});

// -------- DOMAIN HELPERS (dentro de tx) --------

async function getPolicy(tx: any, tenantId: string) {
  const p = await tx.absencePolicy.findUnique({ where: { tenantId } });
  return p || { ...DEFAULT_POLICY, tenantId };
}

async function getHolidays(tx: any, tenantId: string): Promise<HolidayLike[]> {
  const rows = await tx.absenceHoliday.findMany({ where: { tenantId, active: true } });
  return rows.map((h: any) => ({ date: h.date, recurring: h.recurring, active: h.active }));
}

async function getOrCreateBalance(
  tx: any,
  tenantId: string,
  employeeId: string,
  absenceTypeId: string,
  period: string,
  userId: string | null,
) {
  let bal = await tx.absenceBalance.findFirst({
    where: { tenantId, employeeId, absenceTypeId, period },
  });
  if (!bal) {
    bal = await tx.absenceBalance.create({
      data: { tenantId, employeeId, absenceTypeId, period, createdById: userId, updatedById: userId },
    });
  }
  return bal;
}

/**
 * Aplica un delta a un campo del saldo y registra el movimiento (historial inmutable).
 * Los movimientos sólo se registran para campos que afectan el disponible.
 */
async function applyBalanceDelta(
  tx: any,
  balance: any,
  opts: {
    field: 'assignedDays' | 'carriedDays' | 'accruedDays' | 'usedDays' | 'reservedDays' | 'adjustmentPositive' | 'adjustmentNegative';
    delta: number;
    movementType: string;
    source: string;
    reason?: string | null;
    referenceType?: string | null;
    referenceId?: string | null;
    userId?: string | null;
    userName?: string | null;
    logMovement?: boolean;
  },
) {
  const prev = Number(balance[opts.field] ?? 0);
  const next = round2(prev + opts.delta);
  const updated = await tx.absenceBalance.update({
    where: { id: balance.id },
    data: { [opts.field]: next, updatedById: opts.userId ?? undefined },
  });
  if (opts.logMovement !== false) {
    await tx.absenceBalanceMovement.create({
      data: {
        tenantId: balance.tenantId,
        balanceId: balance.id,
        movementType: opts.movementType,
        source: opts.source,
        field: opts.field,
        previousValue: prev,
        newValue: next,
        delta: round2(opts.delta),
        reason: opts.reason ?? null,
        referenceType: opts.referenceType ?? null,
        referenceId: opts.referenceId ?? null,
        userId: opts.userId ?? null,
        userName: opts.userName ?? null,
      },
    });
  }
  return updated;
}

/** Actualiza sólo pendingDays (informativo, no afecta disponible, sin movimiento). */
async function bumpPending(tx: any, balanceId: string, delta: number) {
  const bal = await tx.absenceBalance.findUnique({ where: { id: balanceId } });
  if (!bal) return;
  const next = Math.max(0, round2(Number(bal.pendingDays ?? 0) + delta));
  await tx.absenceBalance.update({ where: { id: balanceId }, data: { pendingDays: next } });
}

// Adjunta datos de empleado (fuente = Employee) sin relación Prisma
async function attachEmployees(tx: any, tenantId: string, rows: any[]) {
  const ids = new Set<string>();
  for (const r of rows) {
    if (r.employeeId) ids.add(r.employeeId);
    if (r.substituteEmployeeId) ids.add(r.substituteEmployeeId);
  }
  if (ids.size === 0) return rows;
  const emps = await tx.employee.findMany({
    where: { tenantId, id: { in: [...ids] } },
    select: {
      id: true, firstName: true, lastName: true, status: true,
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true, code: true } },
    },
  });
  const map = new Map(emps.map((e: any) => [e.id, e]));
  return rows.map((r) => ({
    ...r,
    employee: r.employeeId ? map.get(r.employeeId) ?? null : null,
    substitute: r.substituteEmployeeId ? map.get(r.substituteEmployeeId) ?? null : null,
  }));
}

// Regla de aprobación → rol del primer paso
function approverRoleFor(type: any): string {
  return parseApprovalChain(type)[0] ?? 'RRHH';
}

// Regla de aprobación → cadena ordenada de roles (multinivel).
// Soporta combos separados por _ + - o espacio, ej: "JEFE_RRHH", "JEFE-DIRECCION-RRHH".
function parseApprovalChain(type: any): string[] {
  const raw = (type?.approvalRule || 'JEFE').toUpperCase();
  const known = ['JEFE', 'DIRECCION', 'RRHH'];
  const tokens = raw.split(/[^A-Z]+/).filter(Boolean);
  const chain = tokens.filter((t: string) => known.includes(t));
  return chain.length > 0 ? chain : ['RRHH'];
}

// Emails de los administradores del tenant (para notificaciones de aprobación).
async function getTenantAdminEmails(tx: any, tenantId: string): Promise<string[]> {
  try {
    const memberships = await tx.tenantMembership.findMany({
      where: { tenantId, role: 'TENANT_ADMIN', deletedAt: null, status: 'ACTIVE' },
      select: { userId: true },
    });
    const ids = memberships.map((m: any) => m.userId).filter(Boolean);
    if (ids.length === 0) return [];
    const users = await tx.platformUser.findMany({ where: { id: { in: ids } }, select: { email: true } });
    return users.map((u: any) => u.email).filter((e: any): e is string => !!e);
  } catch {
    return [];
  }
}

// Mapea el usuario autenticado (PlatformUser) a su Employee del tenant (por email).
async function getEmployeeForUser(tx: any, tenantId: string, userId: string | null) {
  if (!userId) return null;
  const pu = await tx.platformUser.findUnique({ where: { id: userId }, select: { email: true } });
  if (!pu?.email) return null;
  return tx.employee.findFirst({
    where: { tenantId, email: pu.email, deletedAt: null },
    select: {
      id: true, firstName: true, lastName: true, email: true, status: true, supervisorId: true, reportsToPositionId: true,
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true, code: true } },
    },
  });
}

// Encuentra el PlatformUser.id de un empleado (por email) para notificarlo.
async function userIdForEmployeeEmail(tx: any, email?: string | null): Promise<string | null> {
  if (!email) return null;
  const pu = await tx.platformUser.findUnique({ where: { email }, select: { id: true } });
  return pu?.id ?? null;
}

// Crea una notificación in-app (usa enum SYSTEM_ALERT; entityType distingue el módulo).
async function createAbsenceNotification(
  tx: any,
  args: { tenantId: string; userId: string | null; title: string; message: string; link?: string; entityId?: string | null },
) {
  if (!args.userId) return;
  try {
    await tx.notification.create({
      data: {
        tenantId: args.tenantId,
        userId: args.userId,
        type: 'SYSTEM_ALERT',
        title: args.title,
        message: args.message,
        link: args.link ?? null,
        entityType: 'absence_request',
        entityId: args.entityId ?? null,
      },
    });
  } catch {
    /* noop: la notificación no debe romper la operación */
  }
}

async function notifyTenantAdmins(
  tx: any,
  tenantId: string,
  args: { title: string; message: string; link?: string; entityId?: string | null },
) {
  try {
    const memberships = await tx.tenantMembership.findMany({
      where: { tenantId, role: 'TENANT_ADMIN', deletedAt: null, status: 'ACTIVE' },
      select: { userId: true },
    });
    for (const m of memberships) {
      await createAbsenceNotification(tx, { tenantId, userId: m.userId, ...args });
    }
  } catch {
    /* noop */
  }
}

/**
 * Aprueba un paso de la cadena de una solicitud (multinivel + bloqueo documental).
 * Reutilizable por el endpoint individual y por la aprobación en lote.
 */
async function approveRequestTx(tx: any, tenantId: string, id: string, userId: string | null, comment?: string | null) {
  const r = await tx.absenceRequest.findFirst({ where: { id, tenantId, deletedAt: null }, include: { absenceType: true } });
  if (!r) return { error: 'Solicitud no encontrada' };
  if (!['PENDING_APPROVAL', 'PENDING_DOCS', 'PENDING_COVERAGE', 'SUBMITTED'].includes(r.status)) {
    return { error: `No se puede aprobar una solicitud en estado ${r.status}` };
  }
  if (r.absenceType?.requiresDocumentation) {
    const docCount = await tx.absenceAttachment.count({ where: { tenantId, requestId: id, deletedAt: null } });
    if (docCount === 0) {
      if (r.status !== 'PENDING_DOCS') await tx.absenceRequest.update({ where: { id }, data: { status: 'PENDING_DOCS', updatedById: userId } });
      return { error: 'Esta ausencia requiere documentación adjunta antes de poder aprobarse.' };
    }
  }
  const userName = await resolveUserName(tx, userId);
  const step = await tx.absenceApproval.findFirst({ where: { tenantId, requestId: id, decision: 'PENDING' }, orderBy: { stepOrder: 'asc' } });
  if (step) {
    await tx.absenceApproval.update({ where: { id: step.id }, data: { decision: 'APPROVED', comment: comment ?? null, approverUserId: userId, approverName: userName, previousStatus: r.status, newStatus: 'APPROVED', decidedAt: new Date() } });
  }
  const remaining = await tx.absenceApproval.count({ where: { tenantId, requestId: id, decision: 'PENDING' } });
  if (remaining > 0) {
    const updated = await tx.absenceRequest.update({ where: { id }, data: { status: 'PENDING_APPROVAL', updatedById: userId } });
    await notifyTenantAdmins(tx, tenantId, { title: 'Aprobación pendiente (siguiente nivel)', message: 'Una solicitud avanzó de nivel y espera tu aprobación.', link: `/rrhh/ausencias?tab=solicitudes&request=${id}`, entityId: id });
    return { updated, finalApproved: false };
  }
  const updated = await tx.absenceRequest.update({ where: { id }, data: { status: 'APPROVED', updatedById: userId } });
  await reserveBalanceForRequest(tx, tenantId, updated, userId, userName);
  if (!step) {
    await tx.absenceApproval.create({ data: { tenantId, requestId: id, stepOrder: 1, decision: 'APPROVED', comment: comment ?? null, approverUserId: userId, approverName: userName, previousStatus: r.status, newStatus: 'APPROVED', decidedAt: new Date() } });
  }
  const empA = await tx.employee.findUnique({ where: { id: r.employeeId }, select: { email: true, firstName: true, lastName: true } });
  await createAbsenceNotification(tx, { tenantId, userId: await userIdForEmployeeEmail(tx, empA?.email), title: 'Solicitud de ausencia aprobada', message: 'Tu solicitud de ausencia fue aprobada.', link: `/rrhh/ausencias?tab=mis-solicitudes&request=${id}`, entityId: id });
  return {
    updated, finalApproved: true, employeeEmail: empA?.email || null,
    reqInfo: { employeeName: `${empA?.firstName ?? ''} ${empA?.lastName ?? ''}`.trim(), typeName: r.absenceType?.name || 'Ausencia', startDate: r.startDate, endDate: r.endDate, days: r.computedDays },
  };
}

/**
 * Valida y crea una solicitud de ausencia (borrador). Reutilizable por RRHH y por el Portal del Empleado.
 * Devuelve { error } o { created, breakdown, overrides, warnings }.
 */
async function createAbsenceRequestTx(tx: any, tenantId: string, data: any, userId: string | null) {
  const start = parseDate(data.startDate)!;
  const end = parseDate(data.endDate)!;
  if (end.getTime() < start.getTime()) return { error: 'La fecha de fin no puede ser anterior a la de inicio' };

  const employee = await tx.employee.findFirst({ where: { id: data.employeeId, tenantId, deletedAt: null } });
  if (!employee) return { error: 'Empleado no encontrado en este tenant' };
  if (employee.status !== 'ACTIVE') return { error: 'El empleado no está activo' };

  const type = await tx.absenceType.findFirst({ where: { id: data.absenceTypeId, tenantId, deletedAt: null } });
  if (!type) return { error: 'Tipo de ausencia no encontrado' };
  if (!type.active) return { error: 'El tipo de ausencia está inactivo' };

  if (data.substituteEmployeeId) {
    const sub = await tx.employee.findFirst({ where: { id: data.substituteEmployeeId, tenantId, deletedAt: null } });
    if (!sub) return { error: 'Sustituto no encontrado en este tenant' };
  }

  const policy = await getPolicy(tx, tenantId);
  const holidays = await getHolidays(tx, tenantId);
  const countingMode = type.countingMode || 'BUSINESS';
  const calc = computeAbsenceDays({
    startDate: start, endDate: end, countingMode,
    halfDay: !!data.halfDay && type.allowsHalfDay,
    workingWeekdays: policy.workingWeekdays, holidays,
  });

  const overrides: string[] = [];
  const warnings: string[] = [];

  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  if (start.getTime() < today.getTime() && !type.allowsRetroactive) {
    if (data.override) overrides.push('Carga retroactiva no permitida por el tipo');
    else return { error: 'Este tipo no permite carga retroactiva' };
  }

  const minAdv = type.minAdvanceDays ?? policy.defaultMinAdvanceDays ?? 0;
  if (minAdv > 0 && !type.allowsRetroactive) {
    const diffDays = Math.floor((start.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays < minAdv) {
      if (data.override) overrides.push(`Anticipación mínima de ${minAdv} días no cumplida`);
      else return { error: `Requiere anticipación mínima de ${minAdv} días` };
    }
  }

  const maxDur = type.maxDurationDays ?? policy.defaultMaxDurationDays ?? null;
  if (maxDur && calc.days > maxDur) {
    if (data.override) overrides.push(`Duración (${calc.days}) supera el máximo de ${maxDur}`);
    else return { error: `La duración (${calc.days}) supera el máximo de ${maxDur} días` };
  }

  const overlap = await tx.absenceRequest.findFirst({
    where: {
      tenantId, employeeId: data.employeeId, deletedAt: null,
      status: { in: ACTIVE_REQUEST_STATUSES },
      startDate: { lte: end }, endDate: { gte: start },
    },
  });
  if (overlap) {
    if (data.override) overrides.push('Existe una solicitud superpuesta');
    else return { error: 'El empleado ya tiene una solicitud que se superpone en esas fechas' };
  }

  if (type.requiresBalance) {
    const period = periodOf(start);
    const bal = await tx.absenceBalance.findFirst({ where: { tenantId, employeeId: data.employeeId, absenceTypeId: type.id, period } });
    const available = bal ? computeAvailable(bal) : 0;
    if (calc.days > available && !policy.allowNegativeBalance) {
      if (data.override) overrides.push(`Saldo insuficiente (disponible ${available}, requerido ${calc.days})`);
      else return { error: `Saldo insuficiente: disponible ${available}, requerido ${calc.days}` };
    }
  }

  if (overrides.length > 0 && !data.overrideReason) return { error: 'Las excepciones requieren un motivo (overrideReason)' };
  if (overrides.length > 0 && !policy.allowExceptions) return { error: 'La política del tenant no permite excepciones' };

  const created = await tx.absenceRequest.create({
    data: {
      tenantId,
      employeeId: data.employeeId,
      absenceTypeId: data.absenceTypeId,
      startDate: start, endDate: end,
      halfDay: !!data.halfDay && type.allowsHalfDay,
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      countingMode,
      computedDays: calc.days,
      reason: data.reason ?? null,
      notes: data.notes ?? null,
      substituteEmployeeId: cleanUUID(data.substituteEmployeeId) ?? null,
      affectedProcessIds: (data.affectedProcessIds ?? []).filter((v: string) => UUID_RE.test(v)),
      affectedFunctions: data.affectedFunctions ?? null,
      status: 'DRAFT',
      createdByHr: !!data.createdByHr,
      origin: data.createdByHr ? 'HR' : 'EMPLOYEE',
      createdById: userId,
      updatedById: userId,
    },
  });
  return { created, breakdown: calc, overrides, warnings };
}

// Solapamiento de ausencias con compañeros del mismo sector (informativo).
async function computeTeamOverlap(tx: any, tenantId: string, employeeId: string, from: Date, to: Date) {
  const emp = await tx.employee.findFirst({
    where: { id: employeeId, tenantId, deletedAt: null },
    select: { id: true, departmentId: true, department: { select: { id: true, name: true } } },
  });
  const base = { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  if (!emp) return { error: 'Empleado no encontrado' };
  if (!emp.departmentId) return { ...base, department: null, total: 0, overlapCount: 0, overlaps: [] };
  const peers = await tx.employee.findMany({
    where: { tenantId, deletedAt: null, status: 'ACTIVE', departmentId: emp.departmentId, id: { not: employeeId } },
    select: { id: true, firstName: true, lastName: true, position: { select: { name: true } } },
  });
  const peerIds = peers.map((p: any) => p.id);
  if (peerIds.length === 0) return { ...base, department: emp.department, total: 0, overlapCount: 0, overlaps: [] };
  const abs = await tx.absenceRequest.findMany({
    where: {
      tenantId, deletedAt: null, employeeId: { in: peerIds },
      status: { in: ACTIVE_REQUEST_STATUSES },
      startDate: { lte: to }, endDate: { gte: from },
    },
    include: { absenceType: { select: { name: true, color: true, sensitiveData: true } } },
    orderBy: { startDate: 'asc' },
  });
  const peerMap = new Map(peers.map((p: any) => [p.id, p]));
  const overlaps = abs.map((a: any) => {
    const p: any = peerMap.get(a.employeeId);
    const confirmed = ['APPROVED', 'IN_PROGRESS'].includes(a.status);
    return {
      employeeId: a.employeeId,
      employeeName: empFullName(p),
      position: p?.position?.name || null,
      startDate: a.startDate,
      endDate: a.endDate,
      type: a.absenceType?.sensitiveData ? 'Ausencia' : (a.absenceType?.name || 'Ausencia'),
      color: a.absenceType?.sensitiveData ? null : (a.absenceType?.color || null),
      confirmed,
      status: a.status,
    };
  });
  return {
    ...base,
    department: emp.department,
    total: peers.length,
    overlapCount: new Set(overlaps.map((o: any) => o.employeeId)).size,
    overlaps,
  };
}

// Cobertura de competencias DETERMINÍSTICA: requeridas del puesto vs actuales del empleado.
async function computeCompetencyCoverage(tx: any, positionId: string | null | undefined, employeeId: string | null | undefined) {
  if (!positionId || !employeeId) return { required: 0, covered: 0, percent: 100, status: 'FULL', missing: [] as any[] };
  const [posComps, empComps] = await Promise.all([
    tx.positionCompetency.findMany({ where: { positionId }, include: { competency: { select: { name: true } } } }),
    tx.employeeCompetency.findMany({ where: { employeeId } }),
  ]);
  const empMap = new Map(empComps.map((c: any) => [c.competencyId, c.currentLevel]));
  let covered = 0;
  const missing: any[] = [];
  for (const pc of posComps) {
    const cur = Number(empMap.get(pc.competencyId) ?? 0);
    if (cur >= pc.requiredLevel) covered++;
    else missing.push({ name: pc.competency?.name ?? 'Competencia', required: pc.requiredLevel, current: cur });
  }
  const required = posComps.length;
  const percent = required === 0 ? 100 : round2((covered / required) * 100);
  const status = percent >= 100 ? 'FULL' : percent > 0 ? 'PARTIAL' : 'NONE';
  return { required, covered, percent, status, missing };
}

// Estado efectivo de una delegación según fechas.
function delegationEffectiveStatus(d: any): string {
  if (d.status === 'CANCELLED') return 'CANCELLED';
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const start = new Date(d.startDate); const end = new Date(d.endDate);
  if (today.getTime() > end.getTime()) return 'EXPIRED';
  if (today.getTime() < start.getTime()) return 'SCHEDULED';
  return 'ACTIVE';
}

// -------- ROUTES --------
export const absencesRoutes: FastifyPluginAsync = async (app) => {
  // ============ ABSENCE TYPES ============
  app.get('/types', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const q = req.query as any;
    const where: any = { tenantId, deletedAt: null };
    if (q.active === 'true') where.active = true;
    const items = await app.runWithDbContext(req, (tx: any) =>
      tx.absenceType.findMany({ where, orderBy: { name: 'asc' } }),
    );
    return reply.send({ items });
  });

  app.post('/types', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    let data;
    try {
      data = typeSchema.parse(req.body);
    } catch (e: any) {
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }
    const userId = (req as any).auth?.userId ?? null;
    try {
      const item = await app.runWithDbContext(req, (tx: any) =>
        tx.absenceType.create({ data: { tenantId, ...data, createdById: userId, updatedById: userId } }),
      );
      return reply.code(201).send({ item });
    } catch (e: any) {
      if (e?.code === 'P2002') return reply.code(409).send({ error: 'Ya existe un tipo con ese código' });
      throw e;
    }
  });

  app.patch('/types/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const data = typeSchema.partial().parse(req.body);
    const userId = (req as any).auth?.userId ?? null;
    const item = await app.runWithDbContext(req, async (tx: any) => {
      const exists = await tx.absenceType.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!exists) return null;
      return tx.absenceType.update({ where: { id }, data: { ...data, updatedById: userId } });
    });
    if (!item) return reply.code(404).send({ error: 'Tipo no encontrado' });
    return reply.send({ item });
  });

  app.delete('/types/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    await app.runWithDbContext(req, (tx: any) =>
      tx.absenceType.updateMany({ where: { id, tenantId }, data: { deletedAt: new Date(), active: false } }),
    );
    return reply.send({ ok: true });
  });

  // Sembrar catálogo por defecto (idempotente por code)
  app.post('/types/seed-defaults', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const userId = (req as any).auth?.userId ?? null;
    const created = await app.runWithDbContext(req, async (tx: any) => {
      const out: string[] = [];
      for (const t of DEFAULT_ABSENCE_TYPES) {
        const exists = await tx.absenceType.findFirst({ where: { tenantId, code: t.code } });
        if (!exists) {
          await tx.absenceType.create({ data: { tenantId, ...t, createdById: userId, updatedById: userId } });
          out.push(t.code);
        }
      }
      return out;
    });
    return reply.send({ created, count: created.length });
  });

  // ============ POLICY ============
  app.get('/policy', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const item = await app.runWithDbContext(req, async (tx: any) => {
      const p = await tx.absencePolicy.findUnique({ where: { tenantId } });
      return p || { tenantId, ...DEFAULT_POLICY, _default: true };
    });
    return reply.send({ item });
  });

  app.put('/policy', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const data = policySchema.parse(req.body);
    const item = await app.runWithDbContext(req, (tx: any) =>
      tx.absencePolicy.upsert({
        where: { tenantId },
        create: { tenantId, ...DEFAULT_POLICY, ...data },
        update: { ...data },
      }),
    );
    return reply.send({ item });
  });

  // ============ HOLIDAYS ============
  app.get('/holidays', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const items = await app.runWithDbContext(req, (tx: any) =>
      tx.absenceHoliday.findMany({ where: { tenantId }, orderBy: { date: 'asc' } }),
    );
    return reply.send({ items });
  });

  app.post('/holidays', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const data = holidaySchema.parse(req.body);
    const item = await app.runWithDbContext(req, (tx: any) =>
      tx.absenceHoliday.create({ data: { tenantId, ...data, date: new Date(data.date) } }),
    );
    return reply.code(201).send({ item });
  });

  app.delete('/holidays/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    await app.runWithDbContext(req, (tx: any) =>
      tx.absenceHoliday.deleteMany({ where: { id, tenantId } }),
    );
    return reply.send({ ok: true });
  });

  // ============ BALANCES ============
  app.get('/balances', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const q = req.query as any;
    const where: any = { tenantId };
    if (q.employeeId && UUID_RE.test(q.employeeId)) where.employeeId = q.employeeId;
    if (q.absenceTypeId && UUID_RE.test(q.absenceTypeId)) where.absenceTypeId = q.absenceTypeId;
    if (q.period) where.period = q.period;
    const items = await app.runWithDbContext(req, async (tx: any) => {
      const rows = await tx.absenceBalance.findMany({
        where,
        include: { absenceType: { select: { id: true, code: true, name: true, color: true } } },
        orderBy: [{ period: 'desc' }],
      });
      return attachEmployees(tx, tenantId, rows);
    });
    return reply.send({ items: items.map((b: any) => enrichBalance(b)) });
  });

  app.post('/balances', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const data = balanceSchema.parse(req.body);
    const userId = (req as any).auth?.userId ?? null;
    try {
      const item = await app.runWithDbContext(req, async (tx: any) => {
        const userName = await resolveUserName(tx, userId);
        const bal = await getOrCreateBalance(tx, tenantId, data.employeeId, data.absenceTypeId, data.period, userId);
        // Aplicar asignaciones como deltas con movimiento (historial)
        let cur = bal;
        if (data.assignedDays && data.assignedDays !== 0) {
          cur = await applyBalanceDelta(tx, cur, { field: 'assignedDays', delta: data.assignedDays, movementType: 'ASSIGN', source: 'MANUAL', reason: data.reason ?? 'Asignación manual', referenceType: 'balance', referenceId: bal.id, userId, userName });
        }
        if (data.carriedDays && data.carriedDays !== 0) {
          cur = await applyBalanceDelta(tx, cur, { field: 'carriedDays', delta: data.carriedDays, movementType: 'CARRYOVER', source: 'MANUAL', reason: data.reason ?? 'Arrastre manual', referenceType: 'balance', referenceId: bal.id, userId, userName });
        }
        if (data.accruedDays && data.accruedDays !== 0) {
          cur = await applyBalanceDelta(tx, cur, { field: 'accruedDays', delta: data.accruedDays, movementType: 'ACCRUE', source: 'MANUAL', reason: data.reason ?? 'Devengamiento manual', referenceType: 'balance', referenceId: bal.id, userId, userName });
        }
        if (data.expiresAt || data.notes) {
          cur = await tx.absenceBalance.update({ where: { id: bal.id }, data: { expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined, notes: data.notes ?? undefined } });
        }
        return cur;
      });
      return reply.code(201).send({ item: enrichBalance(item) });
    } catch (e: any) {
      if (e?.code === 'P2002') return reply.code(409).send({ error: 'Ya existe un saldo para ese empleado/tipo/período' });
      throw e;
    }
  });

  app.patch('/balances/:id/adjust', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const data = adjustSchema.parse(req.body);
    const userId = (req as any).auth?.userId ?? null;
    const item = await app.runWithDbContext(req, async (tx: any) => {
      const bal = await tx.absenceBalance.findFirst({ where: { id, tenantId } });
      if (!bal) return null;
      const userName = await resolveUserName(tx, userId);
      const field = data.amount >= 0 ? 'adjustmentPositive' : 'adjustmentNegative';
      const delta = Math.abs(data.amount);
      return applyBalanceDelta(tx, bal, {
        field, delta,
        movementType: data.amount >= 0 ? 'ADJUST_POS' : 'ADJUST_NEG',
        source: 'HR_CORRECTION', reason: data.reason, referenceType: 'balance', referenceId: bal.id, userId, userName,
      });
    });
    if (!item) return reply.code(404).send({ error: 'Saldo no encontrado' });
    return reply.send({ item: enrichBalance(item) });
  });

  app.get('/balances/:id/movements', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const items = await app.runWithDbContext(req, (tx: any) =>
      tx.absenceBalanceMovement.findMany({ where: { tenantId, balanceId: id }, orderBy: { createdAt: 'desc' }, take: 200 }),
    );
    return reply.send({ items });
  });

  // ============ REQUESTS ============
  app.get('/requests', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const q = req.query as any;
    const where: any = { tenantId, deletedAt: null };
    if (q.employeeId && UUID_RE.test(q.employeeId)) where.employeeId = q.employeeId;
    if (q.status) where.status = q.status;
    if (q.absenceTypeId && UUID_RE.test(q.absenceTypeId)) where.absenceTypeId = q.absenceTypeId;
    const items = await app.runWithDbContext(req, async (tx: any) => {
      const rows = await tx.absenceRequest.findMany({
        where,
        include: { absenceType: { select: { id: true, code: true, name: true, color: true, sensitiveData: true } } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      return attachEmployees(tx, tenantId, rows);
    });
    return reply.send({ items });
  });

  app.get('/requests/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const item = await app.runWithDbContext(req, async (tx: any) => {
      const r = await tx.absenceRequest.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          absenceType: true,
          approvals: { orderBy: { stepOrder: 'asc' } },
          attachments: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        },
      });
      if (!r) return null;
      const [withEmp] = await attachEmployees(tx, tenantId, [r]);
      return withEmp;
    });
    if (!item) return reply.code(404).send({ error: 'Solicitud no encontrada' });
    return reply.send({ item });
  });

  // Crear solicitud (borrador). Calcula días y valida.
  app.post('/requests', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    let data;
    try {
      data = requestSchema.parse(req.body);
    } catch (e: any) {
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }
    const userId = (req as any).auth?.userId ?? null;

    const result = await app.runWithDbContext(req, (tx: any) => createAbsenceRequestTx(tx, tenantId, data, userId));

    if ((result as any).error) return reply.code(400).send({ error: (result as any).error });
    return reply.code(201).send({
      item: (result as any).created,
      breakdown: (result as any).breakdown,
      overrides: (result as any).overrides,
    });
  });

  // Enviar solicitud (DRAFT → PENDING_APPROVAL). Marca pendiente el saldo (informativo).
  app.post('/requests/:id/submit', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const userId = (req as any).auth?.userId ?? null;
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const r = await tx.absenceRequest.findFirst({ where: { id, tenantId, deletedAt: null }, include: { absenceType: true } });
      if (!r) return { error: 'Solicitud no encontrada' };
      if (r.status !== 'DRAFT' && r.status !== 'SUBMITTED') return { error: `No se puede enviar una solicitud en estado ${r.status}` };

      const requiresApproval = r.absenceType?.requiresApproval !== false;
      const newStatus = requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED';

      // Saldo pendiente (informativo) si el tipo descuenta saldo
      if (r.absenceType?.requiresBalance) {
        const period = periodOf(new Date(r.startDate));
        const bal = await getOrCreateBalance(tx, tenantId, r.employeeId, r.absenceTypeId, period, userId);
        await bumpPending(tx, bal.id, r.computedDays);
      }

      const updated = await tx.absenceRequest.update({ where: { id }, data: { status: newStatus, updatedById: userId } });

      let adminEmails: string[] = [];
      let empName = 'Un empleado';
      if (requiresApproval) {
        // Cadena de aprobación multinivel según approvalRule del tipo.
        const chain = parseApprovalChain(r.absenceType);
        // Limpiar pasos previos (reenvío) y crear la cadena completa.
        await tx.absenceApproval.deleteMany({ where: { tenantId, requestId: id, decision: 'PENDING' } });
        for (let i = 0; i < chain.length; i++) {
          await tx.absenceApproval.create({
            data: {
              tenantId, requestId: id, stepOrder: i + 1,
              approverRole: chain[i],
              decision: 'PENDING', previousStatus: r.status, newStatus,
            },
          });
        }
        const emp = await tx.employee.findUnique({ where: { id: r.employeeId }, select: { firstName: true, lastName: true } });
        empName = emp ? `${emp.firstName} ${emp.lastName}`.trim() : 'Un empleado';
        await notifyTenantAdmins(tx, tenantId, {
          title: 'Nueva solicitud de ausencia',
          message: `${empName} envió una solicitud de ausencia que requiere aprobación.`,
          link: `/rrhh/ausencias?tab=solicitudes&request=${id}`,
          entityId: id,
        });
        adminEmails = await getTenantAdminEmails(tx, tenantId);
      } else {
        // Auto-aprobada: reservar saldo directamente
        await reserveBalanceForRequest(tx, tenantId, updated, userId);
      }
      return {
        updated, adminEmails,
        reqInfo: { employeeName: empName, typeName: r.absenceType?.name || 'Ausencia', startDate: r.startDate, endDate: r.endDate, days: r.computedDays, reason: r.reason },
      };
    });
    if ((result as any).error) return reply.code(400).send({ error: (result as any).error });
    // Email a los aprobadores (fuera de la transacción)
    for (const email of ((result as any).adminEmails || [])) {
      await queueEmail(absenceSubmittedEmail(email, (result as any).reqInfo));
    }
    return reply.send({ item: (result as any).updated });
  });

  // Aprobar (→ APPROVED). Reserva el saldo (idempotente).
  app.post('/requests/:id/approve', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const { comment } = decisionSchema.parse(req.body ?? {});
    const userId = (req as any).auth?.userId ?? null;
    const result = await app.runWithDbContext(req, (tx: any) => approveRequestTx(tx, tenantId, id, userId, comment));
    if ((result as any).error) return reply.code(400).send({ error: (result as any).error });
    if ((result as any).finalApproved && (result as any).employeeEmail) {
      await queueEmail(absenceApprovedEmail((result as any).employeeEmail, (result as any).reqInfo));
    }
    return reply.send({ item: (result as any).updated });
  });

  // Aprobación en lote. Aprueba (o avanza de nivel) varias solicitudes de una vez.
  app.post('/requests/bulk-approve', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { ids, comment } = z.object({ ids: z.array(z.string().uuid()).min(1).max(200), comment: z.string().optional() }).parse(req.body ?? {});
    const userId = (req as any).auth?.userId ?? null;
    const emailsToSend: EmailPayload[] = [];
    const outcome = await app.runWithDbContext(req, async (tx: any) => {
      const okIds: string[] = []; const errors: { id: string; error: string }[] = [];
      for (const id of ids) {
        const res: any = await approveRequestTx(tx, tenantId, id, userId, comment);
        if (res.error) { errors.push({ id, error: res.error }); continue; }
        okIds.push(id);
        if (res.finalApproved && res.employeeEmail) emailsToSend.push(absenceApprovedEmail(res.employeeEmail, res.reqInfo));
      }
      return { okIds, errors };
    });
    for (const e of emailsToSend) await queueEmail(e);
    return reply.send({ approved: (outcome as any).okIds.length, failed: (outcome as any).errors.length, errors: (outcome as any).errors });
  });

  // Feed iCal (suscripción Google/Outlook) de ausencias aprobadas / en curso.
  app.get('/calendar.ics', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const rows = await app.runWithDbContext(req, async (tx: any) => {
      const list = await tx.absenceRequest.findMany({
        where: { tenantId, deletedAt: null, status: { in: ['APPROVED', 'IN_PROGRESS'] } },
        include: { absenceType: { select: { name: true, sensitiveData: true } } },
        take: 1000, orderBy: { startDate: 'asc' },
      });
      return attachEmployees(tx, tenantId, list);
    });
    const pad = (n: number) => String(n).padStart(2, '0');
    const asDate = (d: any) => { const x = new Date(d); return `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}`; };
    const asDateExclusive = (d: any) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + 1); return `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}`; };
    const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const esc = (s: string) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SGI 360//Ausencias//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Ausencias SGI 360'];
    for (const r of rows as any[]) {
      const emp = empFullName(r.employee);
      const label = r.absenceType?.sensitiveData ? 'Ausencia' : (r.absenceType?.name || 'Ausencia');
      lines.push('BEGIN:VEVENT', `UID:absence-${r.id}@sgi360`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${asDate(r.startDate)}`, `DTEND;VALUE=DATE:${asDateExclusive(r.endDate)}`, `SUMMARY:${esc(`${emp} — ${label}`)}`, `STATUS:CONFIRMED`, 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    reply.header('Content-Type', 'text/calendar; charset=utf-8');
    reply.header('Content-Disposition', 'inline; filename="ausencias.ics"');
    return reply.send(lines.join('\r\n'));
  });

  // Rechazar (→ REJECTED). Libera pendiente. No consume saldo.
  app.post('/requests/:id/reject', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const { comment } = decisionSchema.parse(req.body ?? {});
    const userId = (req as any).auth?.userId ?? null;
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const r = await tx.absenceRequest.findFirst({ where: { id, tenantId, deletedAt: null }, include: { absenceType: true } });
      if (!r) return { error: 'Solicitud no encontrada' };
      if (['REJECTED', 'CANCELLED', 'FINISHED'].includes(r.status)) return { error: `La solicitud ya está en estado ${r.status}` };
      const userName = await resolveUserName(tx, userId);
      // Liberar pendiente
      if (r.absenceType?.requiresBalance) {
        const period = periodOf(new Date(r.startDate));
        const bal = await tx.absenceBalance.findFirst({ where: { tenantId, employeeId: r.employeeId, absenceTypeId: r.absenceTypeId, period } });
        if (bal) await bumpPending(tx, bal.id, -r.computedDays);
      }
      const updated = await tx.absenceRequest.update({ where: { id }, data: { status: 'REJECTED', updatedById: userId } });
      const step = await tx.absenceApproval.findFirst({ where: { tenantId, requestId: id, decision: 'PENDING' }, orderBy: { stepOrder: 'asc' } });
      if (step) {
        await tx.absenceApproval.update({ where: { id: step.id }, data: { decision: 'REJECTED', comment: comment ?? null, approverUserId: userId, approverName: userName, previousStatus: r.status, newStatus: 'REJECTED', decidedAt: new Date() } });
      } else {
        await tx.absenceApproval.create({ data: { tenantId, requestId: id, stepOrder: 1, decision: 'REJECTED', comment: comment ?? null, approverUserId: userId, approverName: userName, previousStatus: r.status, newStatus: 'REJECTED', decidedAt: new Date() } });
      }
      const empR = await tx.employee.findUnique({ where: { id: r.employeeId }, select: { email: true, firstName: true, lastName: true } });
      await createAbsenceNotification(tx, { tenantId, userId: await userIdForEmployeeEmail(tx, empR?.email), title: 'Solicitud de ausencia rechazada', message: comment ? `Tu solicitud fue rechazada: ${comment}` : 'Tu solicitud de ausencia fue rechazada.', link: `/rrhh/ausencias?tab=mis-solicitudes&request=${id}`, entityId: id });
      return {
        updated, employeeEmail: empR?.email || null,
        reqInfo: { employeeName: `${empR?.firstName ?? ''} ${empR?.lastName ?? ''}`.trim(), typeName: r.absenceType?.name || 'Ausencia', startDate: r.startDate, endDate: r.endDate, days: r.computedDays },
      };
    });
    if ((result as any).error) return reply.code(400).send({ error: (result as any).error });
    if ((result as any).employeeEmail) {
      await queueEmail(absenceRejectedEmail((result as any).employeeEmail, (result as any).reqInfo, comment));
    }
    return reply.send({ item: (result as any).updated });
  });

  // Cancelar (→ CANCELLED). Libera reservado o pendiente según corresponda.
  app.post('/requests/:id/cancel', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const { comment } = decisionSchema.parse(req.body ?? {});
    const userId = (req as any).auth?.userId ?? null;
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const r = await tx.absenceRequest.findFirst({ where: { id, tenantId, deletedAt: null }, include: { absenceType: true } });
      if (!r) return { error: 'Solicitud no encontrada' };
      if (['CANCELLED', 'REJECTED', 'FINISHED'].includes(r.status)) return { error: `La solicitud ya está en estado ${r.status}` };
      const userName = await resolveUserName(tx, userId);
      const period = periodOf(new Date(r.startDate));
      const bal = r.absenceType?.requiresBalance
        ? await tx.absenceBalance.findFirst({ where: { tenantId, employeeId: r.employeeId, absenceTypeId: r.absenceTypeId, period } })
        : null;
      if (bal) {
        if (r.balanceReserved) {
          await applyBalanceDelta(tx, bal, { field: 'reservedDays', delta: -r.computedDays, movementType: 'RELEASE', source: 'REQUEST_CANCELLED', reason: comment ?? 'Solicitud cancelada', referenceType: 'absence_request', referenceId: r.id, userId, userName });
        } else {
          await bumpPending(tx, bal.id, -r.computedDays);
        }
      }
      const updated = await tx.absenceRequest.update({ where: { id }, data: { status: 'CANCELLED', balanceReserved: false, updatedById: userId } });
      return { updated };
    });
    if ((result as any).error) return reply.code(400).send({ error: (result as any).error });
    return reply.send({ item: (result as any).updated });
  });

  // Marcar como tomada (APPROVED/IN_PROGRESS → FINISHED). Reservado → usado.
  app.post('/requests/:id/mark-taken', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const userId = (req as any).auth?.userId ?? null;
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const r = await tx.absenceRequest.findFirst({ where: { id, tenantId, deletedAt: null }, include: { absenceType: true } });
      if (!r) return { error: 'Solicitud no encontrada' };
      if (!['APPROVED', 'IN_PROGRESS'].includes(r.status)) return { error: `No se puede marcar como tomada en estado ${r.status}` };
      if (r.balanceUsed) return { error: 'La solicitud ya fue computada como utilizada' };
      const userName = await resolveUserName(tx, userId);
      if (r.absenceType?.requiresBalance && r.balanceReserved) {
        const period = periodOf(new Date(r.startDate));
        const bal = await tx.absenceBalance.findFirst({ where: { tenantId, employeeId: r.employeeId, absenceTypeId: r.absenceTypeId, period } });
        if (bal) {
          await applyBalanceDelta(tx, bal, { field: 'reservedDays', delta: -r.computedDays, movementType: 'RELEASE', source: 'ABSENCE_USED', reason: 'Ausencia tomada (libera reserva)', referenceType: 'absence_request', referenceId: r.id, userId, userName });
          const bal2 = await tx.absenceBalance.findUnique({ where: { id: bal.id } });
          await applyBalanceDelta(tx, bal2, { field: 'usedDays', delta: r.computedDays, movementType: 'USE', source: 'ABSENCE_USED', reason: 'Ausencia efectivamente tomada', referenceType: 'absence_request', referenceId: r.id, userId, userName });
        }
      }
      const updated = await tx.absenceRequest.update({ where: { id }, data: { status: 'FINISHED', balanceUsed: true, balanceReserved: false, updatedById: userId } });
      return { updated };
    });
    if ((result as any).error) return reply.code(400).send({ error: (result as any).error });
    return reply.send({ item: (result as any).updated });
  });

  // Editar solicitud (estados pendientes, antes de reservar/consumir saldo)
  app.patch('/requests/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const data = requestSchema.partial().parse(req.body);
    const userId = (req as any).auth?.userId ?? null;
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const r = await tx.absenceRequest.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!r) return { error: 'Solicitud no encontrada' };
      // Editable mientras el saldo no esté reservado/consumido y no esté en estado terminal.
      if (r.balanceReserved || r.balanceUsed || ['APPROVED', 'IN_PROGRESS', 'FINISHED', 'CANCELLED', 'REJECTED'].includes(r.status)) {
        return { error: 'Sólo se pueden editar solicitudes pendientes (no aprobadas, canceladas ni rechazadas)' };
      }
      const type = await tx.absenceType.findFirst({ where: { id: data.absenceTypeId ?? r.absenceTypeId, tenantId } });
      const oldType = await tx.absenceType.findFirst({ where: { id: r.absenceTypeId, tenantId } });
      const policy = await getPolicy(tx, tenantId);
      const holidays = await getHolidays(tx, tenantId);
      const start = data.startDate ? parseDate(data.startDate)! : new Date(r.startDate);
      const end = data.endDate ? parseDate(data.endDate)! : new Date(r.endDate);
      if (end.getTime() < start.getTime()) return { error: 'La fecha de fin no puede ser anterior a la de inicio' };
      const countingMode = type?.countingMode || r.countingMode;
      const calc = computeAbsenceDays({ startDate: start, endDate: end, countingMode, halfDay: (data.halfDay ?? r.halfDay) && !!type?.allowsHalfDay, workingWeekdays: policy.workingWeekdays, holidays });
      // El pendiente (informativo) se aplica al enviar (status != DRAFT). Reajustar si cambió tipo/fechas/días.
      const pendingApplied = r.status !== 'DRAFT';
      if (pendingApplied && oldType?.requiresBalance) {
        const oldBal = await tx.absenceBalance.findFirst({ where: { tenantId, employeeId: r.employeeId, absenceTypeId: r.absenceTypeId, period: periodOf(new Date(r.startDate)) } });
        if (oldBal) await bumpPending(tx, oldBal.id, -r.computedDays);
      }
      if (pendingApplied && type?.requiresBalance) {
        const newBal = await tx.absenceBalance.findFirst({ where: { tenantId, employeeId: r.employeeId, absenceTypeId: type.id, period: periodOf(start) } });
        if (newBal) await bumpPending(tx, newBal.id, calc.days);
      }
      const updated = await tx.absenceRequest.update({
        where: { id },
        data: {
          absenceTypeId: data.absenceTypeId ?? undefined,
          startDate: start, endDate: end,
          halfDay: (data.halfDay ?? r.halfDay) && !!type?.allowsHalfDay,
          startTime: data.startTime ?? undefined,
          endTime: data.endTime ?? undefined,
          reason: data.reason ?? undefined,
          notes: data.notes ?? undefined,
          substituteEmployeeId: data.substituteEmployeeId !== undefined ? (cleanUUID(data.substituteEmployeeId) ?? null) : undefined,
          affectedProcessIds: data.affectedProcessIds ? data.affectedProcessIds.filter((v: string) => UUID_RE.test(v)) : undefined,
          affectedFunctions: data.affectedFunctions ?? undefined,
          countingMode, computedDays: calc.days, updatedById: userId,
        },
      });
      return { updated };
    });
    if ((result as any).error) return reply.code(400).send({ error: (result as any).error });
    return reply.send({ item: (result as any).updated });
  });

  // Eliminar solicitud (soft-delete). Revierte cualquier efecto en el saldo.
  app.delete('/requests/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const userId = (req as any).auth?.userId ?? null;
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const r = await tx.absenceRequest.findFirst({ where: { id, tenantId, deletedAt: null }, include: { absenceType: true } });
      if (!r) return { error: 'Solicitud no encontrada' };
      const userName = await resolveUserName(tx, userId);
      if (r.absenceType?.requiresBalance) {
        const bal = await tx.absenceBalance.findFirst({ where: { tenantId, employeeId: r.employeeId, absenceTypeId: r.absenceTypeId, period: periodOf(new Date(r.startDate)) } });
        if (bal) {
          if (r.balanceUsed) {
            await applyBalanceDelta(tx, bal, { field: 'usedDays', delta: -r.computedDays, movementType: 'ADJUST_NEG', source: 'REQUEST_DELETED', reason: 'Solicitud eliminada (revierte uso)', referenceType: 'absence_request', referenceId: r.id, userId, userName });
          } else if (r.balanceReserved) {
            await applyBalanceDelta(tx, bal, { field: 'reservedDays', delta: -r.computedDays, movementType: 'RELEASE', source: 'REQUEST_DELETED', reason: 'Solicitud eliminada (libera reserva)', referenceType: 'absence_request', referenceId: r.id, userId, userName });
          } else if (r.status !== 'DRAFT' && !['CANCELLED', 'REJECTED'].includes(r.status)) {
            await bumpPending(tx, bal.id, -r.computedDays);
          }
        }
      }
      const deleted = await tx.absenceRequest.update({ where: { id }, data: { deletedAt: new Date(), balanceReserved: false, updatedById: userId } });
      return { deleted };
    });
    if ((result as any).error) return reply.code(400).send({ error: (result as any).error });
    return reply.send({ ok: true });
  });

  // Adjuntar documentación (metadata; el archivo se sube vía storage existente)
  app.post('/requests/:id/attachments', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const data = attachmentSchema.parse(req.body);
    const userId = (req as any).auth?.userId ?? null;
    const item = await app.runWithDbContext(req, async (tx: any) => {
      const r = await tx.absenceRequest.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!r) return null;
      const userName = await resolveUserName(tx, userId);
      return tx.absenceAttachment.create({
        data: { tenantId, requestId: id, ...data, uploadedById: userId, uploadedByName: userName },
      });
    });
    if (!item) return reply.code(404).send({ error: 'Solicitud no encontrada' });
    return reply.code(201).send({ item });
  });

  // ============ DISPONIBILIDAD ============
  app.get('/availability', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const q = req.query as any;
    const from = q.from ? new Date(q.from) : new Date(); from.setUTCHours(0, 0, 0, 0);
    const to = q.to ? new Date(q.to) : new Date(from); to.setUTCHours(23, 59, 59, 999);
    const data = await app.runWithDbContext(req, async (tx: any) => {
      const empWhere: any = { tenantId, deletedAt: null, status: 'ACTIVE' };
      if (q.departmentId && UUID_RE.test(q.departmentId)) empWhere.departmentId = q.departmentId;
      if (q.positionId && UUID_RE.test(q.positionId)) empWhere.positionId = q.positionId;
      const employees = await tx.employee.findMany({
        where: empWhere,
        select: { id: true, firstName: true, lastName: true, department: { select: { id: true, name: true } }, position: { select: { id: true, name: true } } },
        orderBy: [{ lastName: 'asc' }],
      });
      const abs = await tx.absenceRequest.findMany({
        where: { tenantId, deletedAt: null, status: { in: ['APPROVED', 'IN_PROGRESS'] }, startDate: { lte: to }, endDate: { gte: from } },
        include: { absenceType: { select: { name: true, color: true, sensitiveData: true } } },
      });
      const byEmp = new Map<string, any[]>();
      for (const a of abs) { const arr = byEmp.get(a.employeeId) || []; arr.push(a); byEmp.set(a.employeeId, arr); }
      const rows = employees.map((e: any) => {
        const list = byEmp.get(e.id) || [];
        let status = 'AVAILABLE';
        if (list.length) status = list.some((a: any) => new Date(a.startDate) <= from && new Date(a.endDate) >= to) ? 'ABSENT' : 'PARTIAL';
        return {
          ...e, status,
          absences: list.map((a: any) => ({ id: a.id, startDate: a.startDate, endDate: a.endDate, type: a.absenceType?.name, color: a.absenceType?.color, sensitive: a.absenceType?.sensitiveData, halfDay: a.halfDay })),
        };
      });
      const filtered = q.status ? rows.filter((r: any) => r.status === q.status) : rows;
      return {
        from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), employees: filtered,
        total: rows.length, available: rows.filter((r: any) => r.status === 'AVAILABLE').length,
        absent: rows.filter((r: any) => r.status === 'ABSENT').length, partial: rows.filter((r: any) => r.status === 'PARTIAL').length,
      };
    });
    return reply.send(data);
  });

  // ============ SOLAPAMIENTO EN EL MISMO SECTOR (informativo al crear solicitud) ============
  app.get('/team-overlap', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const q = req.query as any;
    const employeeId = cleanUUID(q.employeeId);
    if (!employeeId) return reply.code(400).send({ error: 'Se requiere employeeId' });
    if (!q.from || !q.to) return reply.code(400).send({ error: 'Se requieren fechas from y to' });
    const from = new Date(q.from); from.setUTCHours(0, 0, 0, 0);
    const to = new Date(q.to); to.setUTCHours(23, 59, 59, 999);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return reply.code(400).send({ error: 'Fechas inválidas' });

    const data = await app.runWithDbContext(req, (tx: any) => computeTeamOverlap(tx, tenantId, employeeId, from, to));
    if ((data as any).error) return reply.code(404).send(data);
    return reply.send(data);
  });

  // ============ COBERTURA OPERATIVA ============
  app.get('/coverage', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const q = req.query as any;
    const date = q.date ? new Date(q.date) : new Date(); date.setUTCHours(12, 0, 0, 0);
    const scopeType = (q.scopeType || 'DEPARTMENT').toUpperCase();
    const data = await app.runWithDbContext(req, async (tx: any) => {
      const employees = await tx.employee.findMany({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, departmentId: true, positionId: true, department: { select: { name: true } }, position: { select: { name: true } } },
      });
      const abs = await tx.absenceRequest.findMany({
        where: { tenantId, deletedAt: null, status: { in: ['APPROVED', 'IN_PROGRESS'] }, startDate: { lte: date }, endDate: { gte: date } },
        select: { employeeId: true },
      });
      const absentSet = new Set(abs.map((a: any) => a.employeeId));
      const rules = await tx.coverageRule.findMany({ where: { tenantId, active: true, scopeType } });
      const ruleMap = new Map(rules.map((r: any) => [r.scopeId || r.scopeKey, r]));
      const groups = new Map<string, { key: string; name: string; total: number; absent: number }>();
      for (const e of employees) {
        const key = scopeType === 'POSITION' ? (e.positionId || 'none') : (e.departmentId || 'none');
        const name = scopeType === 'POSITION' ? (e.position?.name || 'Sin puesto') : (e.department?.name || 'Sin área');
        const g = groups.get(key) || { key, name, total: 0, absent: 0 };
        g.total++; if (absentSet.has(e.id)) g.absent++;
        groups.set(key, g);
      }
      const result = [...groups.values()].map((g) => {
        const available = g.total - g.absent;
        const percent = g.total === 0 ? 100 : round2((available / g.total) * 100);
        const rule: any = ruleMap.get(g.key);
        const min = rule?.minCoveragePercent ?? 60;
        const status = percent < min ? 'CRITICAL' : percent < min + 10 ? 'WARNING' : 'OK';
        return { ...g, available, percent, minCoveragePercent: min, critical: rule?.critical ?? false, onBreach: rule?.onBreach ?? 'WARN', status };
      }).sort((a, b) => a.percent - b.percent);
      return { date: date.toISOString().slice(0, 10), scopeType, groups: result };
    });
    return reply.send(data);
  });

  // Cobertura de competencias de un empleado respecto de un puesto
  app.get('/coverage/competency', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const q = req.query as any;
    if (!q.employeeId || !UUID_RE.test(q.employeeId)) return reply.code(400).send({ error: 'employeeId requerido' });
    const data = await app.runWithDbContext(req, async (tx: any) => {
      const emp = await tx.employee.findFirst({ where: { id: q.employeeId, tenantId, deletedAt: null }, select: { id: true, positionId: true } });
      if (!emp) return { error: 'Empleado no encontrado' };
      const positionId = q.positionId && UUID_RE.test(q.positionId) ? q.positionId : emp.positionId;
      const cov = await computeCompetencyCoverage(tx, positionId, emp.id);
      return { positionId, ...cov };
    });
    if ((data as any).error) return reply.code(404).send(data);
    return reply.send(data);
  });

  // Validación de sustituto: disponibilidad + cobertura de competencias
  app.get('/substitute-check', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const q = req.query as any;
    if (!q.substituteEmployeeId || !UUID_RE.test(q.substituteEmployeeId)) return reply.code(400).send({ error: 'substituteEmployeeId requerido' });
    const from = q.from ? new Date(q.from) : new Date();
    const to = q.to ? new Date(q.to) : new Date(from);
    const data = await app.runWithDbContext(req, async (tx: any) => {
      const sub = await tx.employee.findFirst({
        where: { id: q.substituteEmployeeId, tenantId, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, status: true, positionId: true, position: { select: { name: true } }, department: { select: { name: true } } },
      });
      if (!sub) return { error: 'Sustituto no encontrado' };
      const conflict = await tx.absenceRequest.findFirst({
        where: { tenantId, employeeId: sub.id, deletedAt: null, status: { in: ACTIVE_REQUEST_STATUSES }, startDate: { lte: to }, endDate: { gte: from } },
        select: { id: true, startDate: true, endDate: true },
      });
      const targetPositionId = q.positionId && UUID_RE.test(q.positionId) ? q.positionId : undefined;
      const competency = targetPositionId ? await computeCompetencyCoverage(tx, targetPositionId, sub.id) : null;
      return { substitute: sub, active: sub.status === 'ACTIVE', availableInRange: !conflict, conflict, competency };
    });
    if ((data as any).error) return reply.code(404).send(data);
    return reply.send(data);
  });

  // ============ REGLAS DE COBERTURA (CRUD) ============
  app.get('/coverage-rules', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const items = await app.runWithDbContext(req, (tx: any) => tx.coverageRule.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } }));
    return reply.send({ items });
  });
  app.post('/coverage-rules', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const schema = z.object({
      scopeType: z.enum(['DEPARTMENT', 'PROCESS', 'POSITION', 'SITE', 'SHIFT']),
      scopeId: emptyToUndefined(z.string().uuid().optional()),
      scopeKey: emptyToUndefined(z.string().optional()),
      scopeName: emptyToUndefined(z.string().optional()),
      minCoveragePercent: z.number().min(0).max(100).optional(),
      critical: z.boolean().optional(),
      onBreach: z.enum(['WARN', 'REQUIRE_APPROVAL', 'BLOCK', 'ALLOW_EXCEPTION']).optional(),
      active: z.boolean().optional(),
    });
    let data;
    try { data = schema.parse(req.body); } catch (e: any) { return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message }); }
    const userId = (req as any).auth?.userId ?? null;
    const item = await app.runWithDbContext(req, (tx: any) => tx.coverageRule.create({ data: { tenantId, ...data, createdById: userId } }));
    return reply.code(201).send({ item });
  });
  app.patch('/coverage-rules/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const schema = z.object({
      minCoveragePercent: z.number().min(0).max(100).optional(), critical: z.boolean().optional(),
      onBreach: z.enum(['WARN', 'REQUIRE_APPROVAL', 'BLOCK', 'ALLOW_EXCEPTION']).optional(), active: z.boolean().optional(),
      scopeName: emptyToUndefined(z.string().optional()),
    });
    const data = schema.parse(req.body);
    const item = await app.runWithDbContext(req, async (tx: any) => {
      const exists = await tx.coverageRule.findFirst({ where: { id, tenantId } });
      if (!exists) return null;
      return tx.coverageRule.update({ where: { id }, data });
    });
    if (!item) return reply.code(404).send({ error: 'Regla no encontrada' });
    return reply.send({ item });
  });
  app.delete('/coverage-rules/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    await app.runWithDbContext(req, (tx: any) => tx.coverageRule.deleteMany({ where: { id, tenantId } }));
    return reply.send({ ok: true });
  });

  // ============ DELEGACIONES (matriz) ============
  app.get('/delegations', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const items = await app.runWithDbContext(req, async (tx: any) => {
      const rows = await tx.temporaryDelegation.findMany({ where: { tenantId }, orderBy: { startDate: 'desc' } });
      const ids = new Set<string>();
      for (const d of rows) { if (d.usualResponsibleEmployeeId) ids.add(d.usualResponsibleEmployeeId); if (d.substituteEmployeeId) ids.add(d.substituteEmployeeId); }
      const emps = ids.size ? await tx.employee.findMany({ where: { tenantId, id: { in: [...ids] } }, select: { id: true, firstName: true, lastName: true } }) : [];
      const map = new Map(emps.map((e: any) => [e.id, e]));
      return rows.map((d: any) => ({
        ...d,
        effectiveStatus: delegationEffectiveStatus(d),
        usualResponsible: d.usualResponsibleEmployeeId ? map.get(d.usualResponsibleEmployeeId) ?? null : null,
        substitute: d.substituteEmployeeId ? map.get(d.substituteEmployeeId) ?? null : null,
      }));
    });
    return reply.send({ items });
  });
  app.post('/delegations', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const schema = z.object({
      functionName: z.string().min(1),
      usualResponsibleEmployeeId: emptyToUndefined(z.string().uuid().optional()),
      substituteEmployeeId: emptyToUndefined(z.string().uuid().optional()),
      delegationKind: z.enum(['FUNCTIONAL', 'OPERATIONAL', 'PERMISSIONS']).optional(),
      scope: emptyToUndefined(z.string().optional()),
      startDate: z.string().min(1),
      endDate: z.string().min(1),
      observations: emptyToUndefined(z.string().optional()),
    });
    let data;
    try { data = schema.parse(req.body); } catch (e: any) { return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message }); }
    if (new Date(data.endDate) < new Date(data.startDate)) return reply.code(400).send({ error: 'La fecha de fin no puede ser anterior a la de inicio' });
    const userId = (req as any).auth?.userId ?? null;
    const item = await app.runWithDbContext(req, (tx: any) => tx.temporaryDelegation.create({
      data: {
        tenantId, functionName: data.functionName,
        usualResponsibleEmployeeId: cleanUUID(data.usualResponsibleEmployeeId) ?? null,
        substituteEmployeeId: cleanUUID(data.substituteEmployeeId) ?? null,
        delegationKind: data.delegationKind ?? 'FUNCTIONAL', scope: data.scope ?? null,
        startDate: new Date(data.startDate), endDate: new Date(data.endDate),
        observations: data.observations ?? null, createdById: userId,
      },
    }));
    return reply.code(201).send({ item });
  });
  app.patch('/delegations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const schema = z.object({
      functionName: z.string().optional(),
      usualResponsibleEmployeeId: emptyToUndefined(z.string().uuid().optional()),
      substituteEmployeeId: emptyToUndefined(z.string().uuid().optional()),
      delegationKind: z.enum(['FUNCTIONAL', 'OPERATIONAL', 'PERMISSIONS']).optional(),
      scope: emptyToUndefined(z.string().optional()),
      startDate: emptyToUndefined(z.string().optional()),
      endDate: emptyToUndefined(z.string().optional()),
      status: z.enum(['SCHEDULED', 'ACTIVE', 'EXPIRED', 'CANCELLED']).optional(),
      observations: emptyToUndefined(z.string().optional()),
    });
    const data: any = schema.parse(req.body);
    const userId = (req as any).auth?.userId ?? null;
    const item = await app.runWithDbContext(req, async (tx: any) => {
      const exists = await tx.temporaryDelegation.findFirst({ where: { id, tenantId } });
      if (!exists) return null;
      const patch: any = { ...data };
      if (data.usualResponsibleEmployeeId !== undefined) patch.usualResponsibleEmployeeId = cleanUUID(data.usualResponsibleEmployeeId) ?? null;
      if (data.substituteEmployeeId !== undefined) patch.substituteEmployeeId = cleanUUID(data.substituteEmployeeId) ?? null;
      if (data.startDate) patch.startDate = new Date(data.startDate);
      if (data.endDate) patch.endDate = new Date(data.endDate);
      if (data.status === 'CANCELLED') { patch.approvedById = userId; patch.approvedByName = await resolveUserName(tx, userId); }
      return tx.temporaryDelegation.update({ where: { id }, data: patch });
    });
    if (!item) return reply.code(404).send({ error: 'Delegación no encontrada' });
    return reply.send({ item });
  });
  app.delete('/delegations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    await app.runWithDbContext(req, (tx: any) => tx.temporaryDelegation.deleteMany({ where: { id, tenantId } }));
    return reply.send({ ok: true });
  });

  // ============ DASHBOARD (resumen ejecutivo) ============
  app.get('/dashboard', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const q = req.query as any;
    const year = q.year ? Number(q.year) : new Date().getUTCFullYear();
    const data = await app.runWithDbContext(req, async (tx: any) => {
      const today = new Date(); today.setUTCHours(0, 0, 0, 0);
      const yearStart = new Date(Date.UTC(year, 0, 1));
      const yearEnd = new Date(Date.UTC(year, 11, 31));
      const in30 = new Date(today.getTime() + 30 * 86400000);

      const [pending, absentToday, upcoming, approvedPeriod, rejectedPeriod, activeEmployees] = await Promise.all([
        tx.absenceRequest.count({ where: { tenantId, deletedAt: null, status: 'PENDING_APPROVAL' } }),
        tx.absenceRequest.count({ where: { tenantId, deletedAt: null, status: { in: ['APPROVED', 'IN_PROGRESS'] }, startDate: { lte: today }, endDate: { gte: today } } }),
        tx.absenceRequest.count({ where: { tenantId, deletedAt: null, status: 'APPROVED', startDate: { gt: today, lte: in30 } } }),
        tx.absenceRequest.count({ where: { tenantId, deletedAt: null, status: { in: ['APPROVED', 'FINISHED'] }, startDate: { gte: yearStart, lte: yearEnd } } }),
        tx.absenceRequest.count({ where: { tenantId, deletedAt: null, status: 'REJECTED', updatedAt: { gte: yearStart, lte: yearEnd } } }),
        tx.employee.count({ where: { tenantId, deletedAt: null, status: 'ACTIVE' } }),
      ]);

      // Solicitudes activas sin sustituto para tipos que lo requieren
      const reqNoSub = await tx.absenceRequest.findMany({
        where: { tenantId, deletedAt: null, status: { in: ACTIVE_REQUEST_STATUSES }, substituteEmployeeId: null },
        include: { absenceType: { select: { requiresSubstitute: true, requiresCoverage: true } } },
      });
      const withoutSubstitute = reqNoSub.filter((r: any) => r.absenceType?.requiresSubstitute).length;
      const criticalCoverage = reqNoSub.filter((r: any) => r.absenceType?.requiresCoverage).length;

      // Días pendientes (disponible) de tipos que descuentan saldo, del período
      const balances = await tx.absenceBalance.findMany({
        where: { tenantId, period: String(year) },
        include: { absenceType: { select: { requiresBalance: true } } },
      });
      const pendingVacationDays = round2(
        balances.filter((b: any) => b.absenceType?.requiresBalance).reduce((s: number, b: any) => s + computeAvailable(b), 0),
      );

      // Índice de ausentismo = díasUsados / (dotación * díasHábilesAprox transcurridos) * 100
      const usedAgg = await tx.absenceRequest.aggregate({
        _sum: { computedDays: true },
        where: { tenantId, deletedAt: null, status: { in: ['APPROVED', 'IN_PROGRESS', 'FINISHED'] }, startDate: { gte: yearStart, lte: yearEnd } },
      });
      const usedDays = usedAgg._sum.computedDays || 0;
      const monthsElapsed = today.getUTCFullYear() === year ? today.getUTCMonth() + 1 : 12;
      const workingDaysApprox = Math.round(21.6 * Math.max(1, monthsElapsed));
      const denom = Math.max(1, activeEmployees * workingDaysApprox);
      const absenteeismIndex = round2((usedDays / denom) * 100);

      // SLA de solicitudes pendientes
      const policy = await getPolicy(tx, tenantId);
      const slaMs = (policy.pendingRequestSlaHours || 48) * 3600000;
      const overdue = await tx.absenceRequest.count({
        where: { tenantId, deletedAt: null, status: 'PENDING_APPROVAL', updatedAt: { lt: new Date(Date.now() - slaMs) } },
      });

      const alerts: { level: string; message: string }[] = [];
      if (criticalCoverage > 0) alerts.push({ level: 'error', message: `${criticalCoverage} solicitud(es) que requieren análisis de cobertura sin sustituto.` });
      if (withoutSubstitute > 0) alerts.push({ level: 'warning', message: `${withoutSubstitute} solicitud(es) requieren sustituto y no lo tienen definido.` });
      if (overdue > 0) alerts.push({ level: 'warning', message: `${overdue} solicitud(es) pendientes hace más de ${policy.pendingRequestSlaHours}h.` });
      if (pending > 0) alerts.push({ level: 'info', message: `${pending} solicitud(es) pendientes de aprobación.` });

      return {
        year, pending, absentToday, upcoming, approvedPeriod, rejectedPeriod,
        criticalCoverage, withoutSubstitute, pendingVacationDays, absenteeismIndex,
        overdue, activeEmployees, alerts,
      };
    });
    return reply.send(data);
  });

  // ============ PORTAL DEL EMPLEADO (self-service) ============
  // GET /me — datos del empleado autenticado: saldos, solicitudes, próximas ausencias
  app.get('/me', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const userId = (req as any).auth?.userId ?? null;
    const data = await app.runWithDbContext(req, async (tx: any) => {
      const employee = await getEmployeeForUser(tx, tenantId, userId);
      if (!employee) return { linked: false };
      const [balances, requests] = await Promise.all([
        tx.absenceBalance.findMany({
          where: { tenantId, employeeId: employee.id },
          include: { absenceType: { select: { id: true, code: true, name: true, color: true, sensitiveData: true } } },
          orderBy: { period: 'desc' },
        }),
        tx.absenceRequest.findMany({
          where: { tenantId, employeeId: employee.id, deletedAt: null },
          include: {
            absenceType: { select: { id: true, code: true, name: true, color: true } },
            approvals: { orderBy: { stepOrder: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);
      const today = new Date(); today.setUTCHours(0, 0, 0, 0);
      const upcoming = requests.filter((r: any) => r.status === 'APPROVED' && new Date(r.startDate) >= today);
      return { linked: true, employee, balances: balances.map((b: any) => enrichBalance(b)), requests, upcoming };
    });
    return reply.send(data);
  });

  // GET /me/team-overlap — compañeros del mismo sector con ausencias en el período (informativo)
  app.get('/me/team-overlap', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const userId = (req as any).auth?.userId ?? null;
    const q = req.query as any;
    if (!q.from || !q.to) return reply.code(400).send({ error: 'Se requieren fechas from y to' });
    const from = new Date(q.from); from.setUTCHours(0, 0, 0, 0);
    const to = new Date(q.to); to.setUTCHours(23, 59, 59, 999);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return reply.code(400).send({ error: 'Fechas inválidas' });
    const data = await app.runWithDbContext(req, async (tx: any) => {
      const employee = await getEmployeeForUser(tx, tenantId, userId);
      if (!employee) return { error: 'Tu usuario no está vinculado a un legajo de empleado.' };
      return computeTeamOverlap(tx, tenantId, employee.id, from, to);
    });
    if ((data as any).error) return reply.code(404).send(data);
    return reply.send(data);
  });

  // GET /me/substitutes — posibles reemplazos (compañeros activos), con flag de ocupado en el período
  app.get('/me/substitutes', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const userId = (req as any).auth?.userId ?? null;
    const q = req.query as any;
    const hasRange = !!(q.from && q.to);
    const from = hasRange ? new Date(q.from) : null; if (from) from.setUTCHours(0, 0, 0, 0);
    const to = hasRange ? new Date(q.to) : null; if (to) to.setUTCHours(23, 59, 59, 999);
    const data = await app.runWithDbContext(req, async (tx: any) => {
      const me = await getEmployeeForUser(tx, tenantId, userId);
      if (!me) return { error: 'Tu usuario no está vinculado a un legajo de empleado.' };
      const emps = await tx.employee.findMany({
        where: { tenantId, deletedAt: null, status: 'ACTIVE', id: { not: me.id } },
        select: { id: true, firstName: true, lastName: true, departmentId: true, department: { select: { name: true } }, position: { select: { name: true } } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
      let busySet = new Set<string>();
      if (from && to && emps.length) {
        const busy = await tx.absenceRequest.findMany({
          where: {
            tenantId, deletedAt: null, employeeId: { in: emps.map((e: any) => e.id) },
            status: { in: ACTIVE_REQUEST_STATUSES }, startDate: { lte: to }, endDate: { gte: from },
          },
          select: { employeeId: true },
        });
        busySet = new Set(busy.map((b: any) => b.employeeId));
      }
      const items = emps.map((e: any) => ({
        id: e.id,
        name: empFullName(e),
        department: e.department?.name || null,
        position: e.position?.name || null,
        sameDepartment: !!(me.department?.id && e.departmentId === me.department.id),
        busy: busySet.has(e.id),
      }));
      // Compañeros del mismo sector primero
      items.sort((a: any, b: any) => (Number(b.sameDepartment) - Number(a.sameDepartment)) || a.name.localeCompare(b.name));
      return { items };
    });
    if ((data as any).error) return reply.code(404).send(data);
    return reply.send(data);
  });

  // POST /me/requests — el empleado solicita su propia ausencia (crea y envía)
  app.post('/me/requests', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const userId = (req as any).auth?.userId ?? null;
    const meReqSchema = requestSchema.omit({ employeeId: true, createdByHr: true, override: true, overrideReason: true });
    let body;
    try {
      body = meReqSchema.parse(req.body);
    } catch (e: any) {
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const employee = await getEmployeeForUser(tx, tenantId, userId);
      if (!employee) return { error: 'Tu usuario no está vinculado a un legajo de empleado. Contactá a RRHH.' };
      const type = await tx.absenceType.findFirst({ where: { id: body.absenceTypeId, tenantId, deletedAt: null } });
      if (!type) return { error: 'Tipo de ausencia no encontrado' };
      if (type.allowsSelfService === false) return { error: 'Este tipo de ausencia no permite autogestión' };

      const createRes: any = await createAbsenceRequestTx(tx, tenantId, { ...body, employeeId: employee.id, createdByHr: false }, userId);
      if (createRes.error) return createRes;
      const created = createRes.created;

      const requiresApproval = type.requiresApproval !== false;
      const newStatus = requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED';
      if (type.requiresBalance) {
        const period = periodOf(new Date(created.startDate));
        const bal = await getOrCreateBalance(tx, tenantId, employee.id, created.absenceTypeId, period, userId);
        await bumpPending(tx, bal.id, created.computedDays);
      }
      const updated = await tx.absenceRequest.update({ where: { id: created.id }, data: { status: newStatus, updatedById: userId } });
      if (requiresApproval) {
        await tx.absenceApproval.create({ data: { tenantId, requestId: created.id, stepOrder: 1, approverRole: approverRoleFor(type), decision: 'PENDING', previousStatus: 'DRAFT', newStatus } });
        await notifyTenantAdmins(tx, tenantId, {
          title: 'Nueva solicitud de ausencia',
          message: `${employee.firstName} ${employee.lastName} envió una solicitud de ausencia que requiere aprobación.`,
          link: `/rrhh/ausencias?tab=solicitudes&request=${created.id}`,
          entityId: created.id,
        });
      } else {
        await reserveBalanceForRequest(tx, tenantId, updated, userId);
      }
      return { created: updated };
    });
    if ((result as any).error) return reply.code(400).send({ error: (result as any).error });
    return reply.code(201).send({ item: (result as any).created });
  });

  // POST /me/requests/:id/cancel — el empleado cancela su propia solicitud
  app.post('/me/requests/:id/cancel', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const userId = (req as any).auth?.userId ?? null;
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const employee = await getEmployeeForUser(tx, tenantId, userId);
      if (!employee) return { error: 'Tu usuario no está vinculado a un legajo de empleado.' };
      const r = await tx.absenceRequest.findFirst({ where: { id, tenantId, deletedAt: null }, include: { absenceType: true } });
      if (!r) return { error: 'Solicitud no encontrada' };
      if (r.employeeId !== employee.id) return { error: 'No podés cancelar solicitudes de otros empleados', code: 403 };
      if (['CANCELLED', 'REJECTED', 'FINISHED'].includes(r.status)) return { error: `La solicitud ya está en estado ${r.status}` };
      if (r.status === 'IN_PROGRESS') return { error: 'La ausencia ya inició; requiere intervención de RRHH' };
      const userName = await resolveUserName(tx, userId);
      if (r.absenceType?.requiresBalance) {
        const period = periodOf(new Date(r.startDate));
        const bal = await tx.absenceBalance.findFirst({ where: { tenantId, employeeId: r.employeeId, absenceTypeId: r.absenceTypeId, period } });
        if (bal) {
          if (r.balanceReserved) {
            await applyBalanceDelta(tx, bal, { field: 'reservedDays', delta: -r.computedDays, movementType: 'RELEASE', source: 'REQUEST_CANCELLED', reason: 'Cancelada por el empleado', referenceType: 'absence_request', referenceId: r.id, userId, userName });
          } else {
            await bumpPending(tx, bal.id, -r.computedDays);
          }
        }
      }
      const updated = await tx.absenceRequest.update({ where: { id }, data: { status: 'CANCELLED', balanceReserved: false, updatedById: userId } });
      return { updated };
    });
    if ((result as any).code === 403) return reply.code(403).send({ error: (result as any).error });
    if ((result as any).error) return reply.code(400).send({ error: (result as any).error });
    return reply.send({ item: (result as any).updated });
  });

  // ============ INDICADORES (avanzados) ============
  app.get('/indicators', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const q = req.query as any;
    const year = q.year ? Number(q.year) : new Date().getUTCFullYear();
    const data = await app.runWithDbContext(req, async (tx: any) => {
      const yearStart = new Date(Date.UTC(year, 0, 1));
      const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
      const employees = await tx.employee.findMany({ where: { tenantId, deletedAt: null, status: 'ACTIVE' }, select: { id: true, departmentId: true, department: { select: { name: true } } } });
      const empDept = new Map<string, string>(employees.map((e: any): [string, string] => [e.id, e.department?.name || 'Sin área']));
      const deptCount = new Map<string, number>();
      for (const e of employees) { const k = e.department?.name || 'Sin área'; deptCount.set(k, (deptCount.get(k) || 0) + 1); }
      const reqs = await tx.absenceRequest.findMany({ where: { tenantId, deletedAt: null, startDate: { gte: yearStart, lte: yearEnd } }, include: { absenceType: { select: { name: true, color: true } } } });
      const byTypeMap = new Map<string, any>();
      const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: 0, days: 0 }));
      const areaDays = new Map<string, number>();
      let approvedCount = 0, rejectedCount = 0;
      for (const r of reqs) {
        if (['APPROVED', 'FINISHED'].includes(r.status)) approvedCount++;
        if (r.status === 'REJECTED') rejectedCount++;
        if (['APPROVED', 'IN_PROGRESS', 'FINISHED'].includes(r.status)) {
          const tn = r.absenceType?.name || '—';
          const t = byTypeMap.get(tn) || { name: tn, color: r.absenceType?.color, count: 0, days: 0 };
          t.count++; t.days += r.computedDays; byTypeMap.set(tn, t);
          const m = new Date(r.startDate).getUTCMonth(); monthly[m].count++; monthly[m].days += r.computedDays;
          const dn = empDept.get(r.employeeId) || 'Sin área'; areaDays.set(dn, (areaDays.get(dn) || 0) + r.computedDays);
        }
      }
      const approvals = await tx.absenceApproval.findMany({ where: { tenantId, decision: { in: ['APPROVED', 'REJECTED'] }, decidedAt: { not: null } }, select: { createdAt: true, decidedAt: true } });
      let totalH = 0, n = 0;
      for (const a of approvals) { if (a.decidedAt) { totalH += (new Date(a.decidedAt).getTime() - new Date(a.createdAt).getTime()) / 3600000; n++; } }
      const avgApprovalHours = n ? round2(totalH / n) : 0;
      const rejectionRate = (approvedCount + rejectedCount) ? round2((rejectedCount / (approvedCount + rejectedCount)) * 100) : 0;
      const monthsElapsed = new Date().getUTCFullYear() === year ? new Date().getUTCMonth() + 1 : 12;
      const workingDaysApprox = 21.6 * Math.max(1, monthsElapsed);
      const absenteeismByArea = [...areaDays.entries()].map(([name, days]) => ({ name, days: round2(days), index: round2((days / Math.max(1, (deptCount.get(name) || 1) * workingDaysApprox)) * 100) })).sort((a, b) => b.days - a.days);
      const withoutSubstitute = await tx.absenceRequest.count({ where: { tenantId, deletedAt: null, status: { in: ACTIVE_REQUEST_STATUSES }, substituteEmployeeId: null, absenceType: { is: { requiresSubstitute: true } } } });
      return { year, byType: [...byTypeMap.values()].sort((a, b) => b.days - a.days), monthlyTrend: monthly, absenteeismByArea, avgApprovalHours, rejectionRate, approvedCount, rejectedCount, withoutSubstitute };
    });
    return reply.send(data);
  });

  // ============ IMPORT / EXPORT DE SALDOS ============
  app.get('/balances/template', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const info = await app.runWithDbContext(req, async (tx: any) => {
      const types = await tx.absenceType.findMany({ where: { tenantId, deletedAt: null, requiresBalance: true }, select: { code: true, name: true } });
      const emps = await tx.employee.findMany({ where: { tenantId, deletedAt: null, status: 'ACTIVE' }, select: { dni: true }, take: 3 });
      return { types, emps };
    });
    const wb = XLSX.utils.book_new();
    const header = ['dni', 'tipoCodigo', 'periodo', 'diasAsignados', 'observaciones'];
    const example = (info.emps || []).map((e: any) => [e.dni, info.types[0]?.code || 'VACATION', String(new Date().getFullYear()), 14, '']);
    const ws = XLSX.utils.aoa_to_sheet([header, ...example]);
    XLSX.utils.book_append_sheet(wb, ws, 'SALDOS');
    const infoSheet = XLSX.utils.aoa_to_sheet([
      ['INSTRUCCIONES'], [''],
      ['- dni: DNI de un empleado EXISTENTE (la importación no crea empleados).'],
      ['- tipoCodigo: código de un tipo de ausencia que requiere saldo.'],
      ['- periodo: año, ej. ' + new Date().getFullYear() + '.'],
      ['- diasAsignados: número de días a asignar (reemplaza el asignado actual).'], [''],
      ['Tipos disponibles:'],
      ...(info.types || []).map((t: any) => [`${t.code} — ${t.name}`]),
    ]);
    XLSX.utils.book_append_sheet(wb, infoSheet, 'INSTRUCCIONES');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', 'attachment; filename=plantilla_saldos.xlsx');
    return reply.send(buf);
  });

  app.post('/balances/import', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const userId = (req as any).auth?.userId ?? null;
    let fileBuffer: Buffer | null = null;
    let commit = false;
    try {
      const parts = (req as any).parts();
      for await (const part of parts) {
        if (part.type === 'file') { const chunks: Buffer[] = []; for await (const c of part.file) chunks.push(c); fileBuffer = Buffer.concat(chunks); }
        else if (part.fieldname === 'commit') commit = String((part as any).value) === 'true';
      }
    } catch { return reply.code(400).send({ error: 'No se pudo leer el formulario multipart' }); }
    if (!fileBuffer || fileBuffer.length === 0) return reply.code(400).send({ error: 'No se proporcionó archivo' });
    if (fileBuffer[0] !== 0x50 || fileBuffer[1] !== 0x4B) return reply.code(400).send({ error: 'El archivo no es un .xlsx válido' });
    let wb: any;
    try { wb = XLSX.read(fileBuffer, { type: 'buffer' }); } catch { return reply.code(400).send({ error: 'No se pudo leer el Excel' }); }
    const sheetName = wb.SheetNames.find((nm: string) => nm.toUpperCase() === 'SALDOS') || wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[sheetName], { header: 1, defval: '' }) as any[][];
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const types = await tx.absenceType.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, code: true } });
      const typeByCode = new Map(types.map((t: any) => [String(t.code).toUpperCase(), t.id]));
      const valid: any[] = []; const errors: any[] = []; const warnings: any[] = [];
      const seen = new Set<string>();
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.every((c: any) => c === '' || c == null)) continue;
        const line = i + 1;
        const dni = typeof r[0] === 'string' ? r[0].trim() : r[0];
        const tipoCodigo = typeof r[1] === 'string' ? r[1].trim() : r[1];
        const periodo = r[2]; const diasAsignados = r[3]; const observaciones = r[4];
        if (!dni) { errors.push({ line, error: 'DNI vacío' }); continue; }
        const emp = await tx.employee.findFirst({ where: { tenantId, dni: String(dni), deletedAt: null }, select: { id: true, firstName: true, lastName: true } });
        if (!emp) { errors.push({ line, dni, error: 'Empleado no encontrado' }); continue; }
        const typeId = typeByCode.get(String(tipoCodigo).toUpperCase());
        if (!typeId) { errors.push({ line, error: `Tipo '${tipoCodigo}' inexistente` }); continue; }
        const period = String(periodo || new Date().getFullYear());
        const days = Number(diasAsignados);
        if (isNaN(days)) { errors.push({ line, error: 'diasAsignados inválido' }); continue; }
        const key = `${emp.id}|${typeId}|${period}`;
        if (seen.has(key)) { warnings.push({ line, warning: 'Duplicado en el archivo (se ignora)' }); continue; }
        seen.add(key);
        valid.push({ line, employeeId: emp.id, employeeName: `${emp.firstName} ${emp.lastName}`, absenceTypeId: typeId, period, assignedDays: days, observaciones: String(observaciones || '') });
      }
      let applied = 0;
      if (commit) {
        const userName = await resolveUserName(tx, userId);
        for (const v of valid) {
          const bal = await getOrCreateBalance(tx, tenantId, v.employeeId, v.absenceTypeId, v.period, userId);
          const delta = round2(v.assignedDays - Number(bal.assignedDays || 0));
          if (delta !== 0) await applyBalanceDelta(tx, bal, { field: 'assignedDays', delta, movementType: 'ASSIGN', source: 'IMPORT', reason: v.observaciones || 'Importación masiva', referenceType: 'import', referenceId: bal.id, userId, userName });
          applied++;
        }
      }
      return { total: valid.length + errors.length, valid, errors, warnings, applied, committed: commit };
    });
    return reply.send(result);
  });

  app.get('/export', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const q = req.query as any;
    const type = q.type || 'requests';
    const data = await app.runWithDbContext(req, async (tx: any) => {
      if (type === 'balances') {
        const rows = await tx.absenceBalance.findMany({ where: { tenantId }, include: { absenceType: { select: { name: true } } } });
        const withEmp = await attachEmployees(tx, tenantId, rows);
        return { name: 'Saldos', header: ['Empleado', 'Tipo', 'Período', 'Acreditado', 'Usado', 'Reservado', 'Pendiente', 'Disponible'], rows: withEmp.map((b: any) => [empFullName(b.employee), b.absenceType?.name, b.period, b.assignedDays + b.carriedDays + b.accruedDays, b.usedDays, b.reservedDays, b.pendingDays, computeAvailable(b)]) };
      }
      if (type === 'movements') {
        const rows = await tx.absenceBalanceMovement.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 5000 });
        return { name: 'Movimientos', header: ['Fecha', 'Tipo', 'Origen', 'Campo', 'Anterior', 'Nuevo', 'Delta', 'Motivo', 'Usuario'], rows: rows.map((m: any) => [new Date(m.createdAt).toLocaleString('es-AR'), m.movementType, m.source, m.field, m.previousValue, m.newValue, m.delta, m.reason || '', m.userName || '']) };
      }
      const rows = await tx.absenceRequest.findMany({ where: { tenantId, deletedAt: null }, include: { absenceType: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 5000 });
      const withEmp = await attachEmployees(tx, tenantId, rows);
      return { name: 'Solicitudes', header: ['Empleado', 'Tipo', 'Desde', 'Hasta', 'Días', 'Estado', 'Sustituto'], rows: withEmp.map((r: any) => [empFullName(r.employee), r.absenceType?.name, new Date(r.startDate).toLocaleDateString('es-AR'), new Date(r.endDate).toLocaleDateString('es-AR'), r.computedDays, r.status, empFullName(r.substitute)]) };
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([data.header, ...data.rows]);
    XLSX.utils.book_append_sheet(wb, ws, data.name);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename=ausencias_${type}.xlsx`);
    return reply.send(buf);
  });

  // ============ DEVENGAMIENTO (reglas + ejecución) ============
  app.get('/accrual-rules', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const items = await app.runWithDbContext(req, async (tx: any) => {
      const rows = await tx.accrualRule.findMany({ where: { tenantId }, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }] });
      const types = await tx.absenceType.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, name: true } });
      const tmap = new Map(types.map((t: any) => [t.id, t.name]));
      return rows.map((r: any) => ({ ...r, absenceTypeName: tmap.get(r.absenceTypeId) || null }));
    });
    return reply.send({ items });
  });
  app.post('/accrual-rules', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const schema = z.object({
      name: z.string().min(1), absenceTypeId: z.string().uuid(),
      method: z.enum(['ANNUAL', 'MONTHLY', 'MANUAL']).optional(),
      contractType: emptyToUndefined(z.string().optional()), location: emptyToUndefined(z.string().optional()),
      minTenureMonths: z.number().int().optional(), maxTenureMonths: z.number().int().optional(),
      daysGranted: z.number(), carryoverMaxDays: z.number().int().optional(), expiryMonths: z.number().int().optional(),
      requiresReview: z.boolean().optional(), active: z.boolean().optional(), priority: z.number().int().optional(),
    });
    let data;
    try { data = schema.parse(req.body); } catch (e: any) { return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message }); }
    const userId = (req as any).auth?.userId ?? null;
    const item = await app.runWithDbContext(req, (tx: any) => tx.accrualRule.create({ data: { tenantId, ...data, createdById: userId } }));
    return reply.code(201).send({ item });
  });
  app.patch('/accrual-rules/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const schema = z.object({
      name: z.string().optional(), method: z.enum(['ANNUAL', 'MONTHLY', 'MANUAL']).optional(),
      contractType: emptyToUndefined(z.string().optional()), location: emptyToUndefined(z.string().optional()),
      minTenureMonths: z.number().int().nullable().optional(), maxTenureMonths: z.number().int().nullable().optional(),
      daysGranted: z.number().optional(), requiresReview: z.boolean().optional(), active: z.boolean().optional(), priority: z.number().int().optional(),
    });
    const data = schema.parse(req.body);
    const item = await app.runWithDbContext(req, async (tx: any) => {
      const exists = await tx.accrualRule.findFirst({ where: { id, tenantId } });
      if (!exists) return null;
      return tx.accrualRule.update({ where: { id }, data });
    });
    if (!item) return reply.code(404).send({ error: 'Regla no encontrada' });
    return reply.send({ item });
  });
  app.delete('/accrual-rules/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    await app.runWithDbContext(req, (tx: any) => tx.accrualRule.deleteMany({ where: { id, tenantId } }));
    return reply.send({ ok: true });
  });
  app.post('/accrual/run', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const userId = (req as any).auth?.userId ?? null;
    const body = z.object({ period: z.string().optional(), absenceTypeId: emptyToUndefined(z.string().uuid().optional()), dryRun: z.boolean().optional() }).parse(req.body ?? {});
    const period = body.period || String(new Date().getUTCFullYear());
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const userName = await resolveUserName(tx, userId);
      const ruleWhere: any = { tenantId, active: true };
      if (body.absenceTypeId) ruleWhere.absenceTypeId = body.absenceTypeId;
      const rules = await tx.accrualRule.findMany({ where: ruleWhere, orderBy: { priority: 'desc' } });
      if (rules.length === 0) return { period, applied: [], review: [], appliedCount: 0, reviewCount: 0, message: 'No hay reglas de devengamiento activas.' };
      const employees = await tx.employee.findMany({ where: { tenantId, deletedAt: null, status: 'ACTIVE' }, select: { id: true, firstName: true, lastName: true, hireDate: true, contractType: true, location: true } });
      const now = new Date();
      const applied: any[] = []; const review: any[] = [];
      for (const e of employees) {
        const tenureMonths = e.hireDate ? Math.floor((now.getTime() - new Date(e.hireDate).getTime()) / (30 * 86400000)) : 0;
        const byType = new Map<string, any>();
        for (const r of rules) {
          if (r.contractType && r.contractType !== e.contractType) continue;
          if (r.location && r.location !== e.location) continue;
          if (r.minTenureMonths != null && tenureMonths < r.minTenureMonths) continue;
          if (r.maxTenureMonths != null && tenureMonths > r.maxTenureMonths) continue;
          if (!byType.has(r.absenceTypeId)) byType.set(r.absenceTypeId, r);
        }
        for (const [typeId, r] of byType) {
          const granted = Number(r.daysGranted || 0);
          if (granted <= 0) continue;
          if (r.requiresReview) { review.push({ employee: `${e.firstName} ${e.lastName}`, rule: r.name, granted }); continue; }
          if (body.dryRun) { applied.push({ employee: `${e.firstName} ${e.lastName}`, rule: r.name, granted, dryRun: true }); continue; }
          const bal = await getOrCreateBalance(tx, tenantId, e.id, typeId, period, userId);
          const delta = round2(granted - Number(bal.accruedDays || 0));
          if (delta !== 0) await applyBalanceDelta(tx, bal, { field: 'accruedDays', delta, movementType: 'ACCRUE', source: 'ACCRUAL', reason: `Devengamiento ${period} · ${r.name}`, referenceType: 'accrual_rule', referenceId: r.id, userId, userName });
          applied.push({ employee: `${e.firstName} ${e.lastName}`, rule: r.name, granted });
        }
      }
      return { period, applied, review, appliedCount: applied.length, reviewCount: review.length, dryRun: !!body.dryRun };
    });
    return reply.send(result);
  });

  // ============ ANÁLISIS DE IMPACTO (Fase 5) ============
  app.get('/requests/:id/impact', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const data = await app.runWithDbContext(req, async (tx: any) => {
      const r = await tx.absenceRequest.findFirst({ where: { id, tenantId, deletedAt: null }, include: { absenceType: true } });
      if (!r) return { error: 'Solicitud no encontrada' };
      const emp = await tx.employee.findFirst({ where: { id: r.employeeId, tenantId }, select: { id: true, firstName: true, lastName: true, departmentId: true, positionId: true, department: { select: { name: true } }, position: { select: { name: true } } } });
      const from = new Date(r.startDate); const to = new Date(r.endDate);
      const findings: any[] = [];
      if (emp?.departmentId) {
        const deptEmps = await tx.employee.findMany({ where: { tenantId, departmentId: emp.departmentId, deletedAt: null, status: 'ACTIVE' }, select: { id: true } });
        const deptIds = new Set(deptEmps.map((x: any) => x.id));
        const overlaps = await tx.absenceRequest.findMany({ where: { tenantId, deletedAt: null, employeeId: { in: [...deptIds].filter((x) => x !== emp.id) }, status: { in: ['APPROVED', 'IN_PROGRESS'] }, startDate: { lte: to }, endDate: { gte: from } }, select: { employeeId: true } });
        if (overlaps.length) findings.push({ level: 'warning', category: 'Equipo', message: `${overlaps.length} compañero(s) del área tienen ausencias que se solapan en el período.` });
        const absentReqs = await tx.absenceRequest.findMany({ where: { tenantId, deletedAt: null, status: { in: ['APPROVED', 'IN_PROGRESS'] }, startDate: { lte: from }, endDate: { gte: from } }, select: { employeeId: true } });
        const absentInDept = new Set(absentReqs.map((a: any) => a.employeeId).filter((eid: string) => deptIds.has(eid)));
        absentInDept.add(emp.id);
        const projected = deptEmps.length > 0 ? round2(((deptEmps.length - absentInDept.size) / deptEmps.length) * 100) : 100;
        const rule = await tx.coverageRule.findFirst({ where: { tenantId, active: true, scopeType: 'DEPARTMENT', scopeId: emp.departmentId } });
        const min = rule?.minCoveragePercent ?? 60;
        if (projected < min) findings.push({ level: 'error', category: 'Cobertura', message: `Con esta ausencia, la cobertura del área ${emp.department?.name || ''} bajaría a ${projected}% (mínimo ${min}%).` });
      }
      if (r.absenceType?.requiresSubstitute && !r.substituteEmployeeId) findings.push({ level: 'error', category: 'Sustituto', message: 'El tipo requiere sustituto y no hay uno asignado.' });
      let competency = null;
      if (r.substituteEmployeeId && emp?.positionId) {
        competency = await computeCompetencyCoverage(tx, emp.positionId, r.substituteEmployeeId);
        if (competency.percent < 100) findings.push({ level: 'warning', category: 'Competencias', message: `El sustituto cubre ${competency.percent}% de las competencias del puesto (${competency.covered}/${competency.required}).` });
      }
      try {
        const delegs = await tx.temporaryDelegation.findMany({ where: { tenantId, usualResponsibleEmployeeId: emp?.id, status: { not: 'CANCELLED' }, startDate: { lte: to }, endDate: { gte: from } } });
        const noCover = delegs.filter((d: any) => !d.substituteEmployeeId);
        if (noCover.length) findings.push({ level: 'warning', category: 'Delegación', message: `${noCover.length} función(es) delegadas sin sustituto durante el período.` });
      } catch { /* modelo no disponible */ }
      try {
        const trainings = await tx.trainingAssignment.count({ where: { employeeId: emp?.id, training: { is: { scheduledDate: { gte: from, lte: to } } } } });
        if (trainings > 0) findings.push({ level: 'info', category: 'Capacitación', message: `${trainings} capacitación(es) asignadas en el período.` });
      } catch { /* fallback seguro */ }
      if (findings.length === 0) findings.push({ level: 'info', category: 'General', message: 'No se detectaron conflictos determinísticos para el período.' });
      return {
        request: { id: r.id, employee: empFullName(emp), department: emp?.department?.name, position: emp?.position?.name, type: r.absenceType?.name, startDate: r.startDate, endDate: r.endDate, days: r.computedDays },
        findings, competency,
      };
    });
    if ((data as any).error) return reply.code(404).send(data);
    return reply.send(data);
  });

  app.post('/requests/:id/impact/ai', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const body = req.body as any;
    const llm = createGroqOnlyLLMProvider((req as any).tenant, (app as any).prisma, tenantId, (req as any).auth?.userId ?? null, 'absences-impact');
    const prompt = `Sos analista de RRHH y continuidad operativa. Analizá el impacto de esta ausencia y respondé en español, breve y accionable.\n\n` +
      `Contexto: ${JSON.stringify(body?.context || {})}\n` +
      `Hallazgos determinísticos: ${JSON.stringify(body?.findings || [])}\n\n` +
      `Devolvé, en secciones cortas: 1) Resumen de riesgos, 2) Conflictos a atender, 3) Medidas sugeridas, 4) Recomendación de cobertura. ` +
      `No apruebes ni rechaces la solicitud. No modifiques saldos ni asignes sustitutos. No inventes datos que no estén en el contexto.`;
    try {
      const res = await llm.chat([{ role: 'user', content: prompt }], 1200);
      return reply.send({ analysis: res?.text || 'Sin respuesta del modelo' });
    } catch (e: any) {
      return reply.code(500).send({ error: 'No se pudo generar el análisis con IA', details: e?.message });
    }
  });
};

/** Reserva el saldo de una solicitud aprobada (idempotente vía balanceReserved). */
async function reserveBalanceForRequest(tx: any, tenantId: string, request: any, userId: string | null, userName?: string | null) {
  if (request.balanceReserved) return;
  const type = await tx.absenceType.findUnique({ where: { id: request.absenceTypeId } });
  if (!type?.requiresBalance) {
    await tx.absenceRequest.update({ where: { id: request.id }, data: { balanceReserved: true } });
    return;
  }
  const period = String(new Date(request.startDate).getUTCFullYear());
  let bal = await tx.absenceBalance.findFirst({ where: { tenantId, employeeId: request.employeeId, absenceTypeId: request.absenceTypeId, period } });
  if (!bal) {
    bal = await tx.absenceBalance.create({ data: { tenantId, employeeId: request.employeeId, absenceTypeId: request.absenceTypeId, period } });
  }
  // Quitar de pendiente (informativo) y pasar a reservado (afecta disponible)
  const pendNext = Math.max(0, round2(Number(bal.pendingDays ?? 0) - request.computedDays));
  await tx.absenceBalance.update({ where: { id: bal.id }, data: { pendingDays: pendNext } });
  const bal2 = await tx.absenceBalance.findUnique({ where: { id: bal.id } });
  const prev = Number(bal2.reservedDays ?? 0);
  const next = round2(prev + request.computedDays);
  await tx.absenceBalance.update({ where: { id: bal.id }, data: { reservedDays: next, updatedById: userId ?? undefined } });
  await tx.absenceBalanceMovement.create({
    data: {
      tenantId, balanceId: bal.id, movementType: 'RESERVE', source: 'REQUEST_APPROVED', field: 'reservedDays',
      previousValue: prev, newValue: next, delta: round2(request.computedDays),
      reason: 'Solicitud aprobada — reserva de saldo', referenceType: 'absence_request', referenceId: request.id,
      userId: userId ?? null, userName: userName ?? null,
    },
  });
  await tx.absenceRequest.update({ where: { id: request.id }, data: { balanceReserved: true } });
}
