/**
 * Absence Scheduler — automatiza el ciclo de vida de ausencias.
 *
 * Ejecuta periódicamente (intervalo configurable) para todos los tenants activos:
 *  1. Transiciones de estado por fecha: APPROVED → IN_PROGRESS (al iniciar) y
 *     APPROVED/IN_PROGRESS → FINISHED (al terminar), consolidando el saldo (reservado → usado).
 *  2. Devengado (accrual) mensual idempotente según reglas activas.
 *  3. Recordatorios por email a administradores con solicitudes pendientes (máx. 1/día).
 *
 * Usa un PrismaClient propio y opera cross-tenant (igual que subscriptionMonitor).
 */
import { PrismaClient } from '@prisma/client';
import { queueEmail } from '../jobs/emailQueue.js';
import { absencePendingReminderEmail } from './absenceEmailTemplates.js';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const periodOf = (d: Date) => String(d.getUTCFullYear());
const PENDING_STATUSES = ['SUBMITTED', 'PENDING_APPROVAL', 'PENDING_DOCS', 'PENDING_COVERAGE'];

class AbsenceScheduler {
  private prisma = new PrismaClient();
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastAccrualDay = '';
  private lastReminderDay = '';

  startMonitoring(intervalHours = 6) {
    // Corrida inicial diferida para no competir con el arranque.
    setTimeout(() => void this.runOnce(), 60_000);
    this.timer = setInterval(() => void this.runOnce(), intervalHours * 60 * 60 * 1000);
    console.log(`[ABSENCE_SCHEDULER] Started with ${intervalHours}h interval`);
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  async runOnce() {
    if (this.running) return;
    this.running = true;
    try {
      const tenants = await this.prisma.tenant.findMany({ where: { licenseStatus: { not: 'EXPIRED' } }, select: { id: true }, take: 500 });
      const todayKey = new Date().toISOString().slice(0, 10);
      const dayOfMonth = new Date().getUTCDate();
      for (const t of tenants) {
        try { await this.transitionForTenant(t.id); } catch (e: any) { console.error(`[ABSENCE_SCHEDULER] transitions ${t.id}:`, e?.message); }
      }
      // Accrual: una vez por día, sólo en los primeros días del mes (idempotente igual).
      if (this.lastAccrualDay !== todayKey && dayOfMonth <= 3) {
        for (const t of tenants) {
          try { await this.accrualForTenant(t.id); } catch (e: any) { console.error(`[ABSENCE_SCHEDULER] accrual ${t.id}:`, e?.message); }
        }
        this.lastAccrualDay = todayKey;
      }
      // Recordatorios: una vez por día.
      if (this.lastReminderDay !== todayKey) {
        for (const t of tenants) {
          try { await this.remindersForTenant(t.id); } catch (e: any) { console.error(`[ABSENCE_SCHEDULER] reminders ${t.id}:`, e?.message); }
        }
        this.lastReminderDay = todayKey;
      }
    } catch (e: any) {
      console.error('[ABSENCE_SCHEDULER] runOnce error:', e?.message);
    } finally {
      this.running = false;
    }
  }

  private async applyDelta(balance: any, field: string, delta: number, movementType: string, source: string, reason: string) {
    const prev = Number(balance[field] ?? 0);
    const next = round2(prev + delta);
    await this.prisma.absenceBalance.update({ where: { id: balance.id }, data: { [field]: next } });
    await this.prisma.absenceBalanceMovement.create({
      data: {
        tenantId: balance.tenantId, balanceId: balance.id, movementType, source, field,
        previousValue: prev, newValue: next, delta: round2(delta),
        reason, referenceType: 'absence_scheduler', referenceId: null, userId: null, userName: 'Sistema (scheduler)',
      },
    });
    return { ...balance, [field]: next };
  }

  /** Transiciones de estado por fecha + consolidación de saldo. */
  private async transitionForTenant(tenantId: string) {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));

    // APPROVED cuyo período ya comenzó y no terminó → IN_PROGRESS
    await this.prisma.absenceRequest.updateMany({
      where: { tenantId, deletedAt: null, status: 'APPROVED', startDate: { lte: todayEnd }, endDate: { gte: todayStart } },
      data: { status: 'IN_PROGRESS' },
    });

    // Cuyo período ya terminó → FINISHED (consolidando saldo)
    const finished = await this.prisma.absenceRequest.findMany({
      where: { tenantId, deletedAt: null, status: { in: ['APPROVED', 'IN_PROGRESS'] }, endDate: { lt: todayStart } },
      include: { absenceType: { select: { requiresBalance: true } } },
      take: 500,
    });
    for (const r of finished) {
      if (r.absenceType?.requiresBalance && r.balanceReserved && !r.balanceUsed) {
        const bal = await this.prisma.absenceBalance.findFirst({ where: { tenantId, employeeId: r.employeeId, absenceTypeId: r.absenceTypeId, period: periodOf(new Date(r.startDate)) } });
        if (bal) {
          const b1 = await this.applyDelta(bal, 'reservedDays', -Number(r.computedDays), 'RELEASE', 'ABSENCE_USED', 'Ausencia finalizada (libera reserva)');
          await this.applyDelta(b1, 'usedDays', Number(r.computedDays), 'USE', 'ABSENCE_USED', 'Ausencia efectivamente tomada (automático)');
        }
      }
      await this.prisma.absenceRequest.update({ where: { id: r.id }, data: { status: 'FINISHED', balanceUsed: true, balanceReserved: false } });
    }
  }

  /** Devengado mensual idempotente (delta = otorgado - ya devengado). */
  private async accrualForTenant(tenantId: string) {
    const period = String(new Date().getUTCFullYear());
    const rules = await this.prisma.accrualRule.findMany({ where: { tenantId, active: true }, orderBy: { priority: 'desc' } });
    if (rules.length === 0) return;
    const employees = await this.prisma.employee.findMany({ where: { tenantId, deletedAt: null, status: 'ACTIVE' }, select: { id: true, hireDate: true, contractType: true, location: true } });
    const now = new Date();
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
        if (granted <= 0 || r.requiresReview) continue;
        let bal = await this.prisma.absenceBalance.findFirst({ where: { tenantId, employeeId: e.id, absenceTypeId: typeId, period } });
        if (!bal) bal = await this.prisma.absenceBalance.create({ data: { tenantId, employeeId: e.id, absenceTypeId: typeId, period } });
        const delta = round2(granted - Number(bal.accruedDays || 0));
        if (delta !== 0) await this.applyDelta(bal, 'accruedDays', delta, 'ACCRUE', 'ACCRUAL', `Devengamiento automático ${period} · ${r.name}`);
      }
    }
  }

  /** Recordatorio por email a administradores con solicitudes pendientes. */
  private async remindersForTenant(tenantId: string) {
    const count = await this.prisma.absenceRequest.count({ where: { tenantId, deletedAt: null, status: { in: PENDING_STATUSES } } });
    if (count === 0) return;
    const memberships = await this.prisma.tenantMembership.findMany({ where: { tenantId, role: 'TENANT_ADMIN', deletedAt: null, status: 'ACTIVE' }, select: { userId: true } });
    const ids = memberships.map((m: any) => m.userId).filter(Boolean);
    if (ids.length === 0) return;
    const users = await this.prisma.platformUser.findMany({ where: { id: { in: ids } }, select: { email: true } });
    for (const u of users) {
      if (u.email) await queueEmail(absencePendingReminderEmail(u.email, count));
    }
  }
}

export const absenceScheduler = new AbsenceScheduler();
