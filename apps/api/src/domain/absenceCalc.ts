/**
 * absenceCalc — Fórmulas DETERMINÍSTICAS del módulo Ausencias y Disponibilidad.
 * Sin IA. Documentadas y testeables.
 *
 * Conceptos de saldo (evita doble descuento):
 *   disponible = asignado + arrastrado + devengado + ajustePos
 *                - ajusteNeg - usado - reservado
 *   - pendiente: informativo (solicitudes PENDING). NO descuenta.
 *   - reservado: solicitudes APROBADAS futuras. Descuenta de disponible.
 *   - usado: ausencia efectivamente tomada.
 */

export interface HolidayLike {
  date: string | Date; // fecha del feriado
  recurring?: boolean; // se repite cada año (mismo día/mes)
  active?: boolean;
}

export interface DayComputationInput {
  startDate: string | Date;
  endDate: string | Date;
  countingMode?: string; // 'BUSINESS' (hábiles) | 'CALENDAR' (corridos)
  halfDay?: boolean;
  workingWeekdays?: number[]; // 0=Dom..6=Sáb. Default L-V.
  holidays?: HolidayLike[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Normaliza a UTC midnight para evitar drift por timezone. */
function toUtcMidnight(d: string | Date): Date {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function mmdd(d: Date): string {
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Construye índices de feriados: exactos (YYYY-MM-DD) y recurrentes (MM-DD).
 */
export function buildHolidayIndex(holidays: HolidayLike[] = []) {
  const exact = new Set<string>();
  const recurring = new Set<string>();
  for (const h of holidays) {
    if (h.active === false) continue;
    const d = toUtcMidnight(h.date);
    if (isNaN(d.getTime())) continue;
    if (h.recurring) recurring.add(mmdd(d));
    else exact.add(ymd(d));
  }
  return { exact, recurring };
}

function isHoliday(d: Date, idx: { exact: Set<string>; recurring: Set<string> }): boolean {
  return idx.exact.has(ymd(d)) || idx.recurring.has(mmdd(d));
}

/**
 * Calcula la cantidad de días de una ausencia según el modo de cómputo.
 * Devuelve además el desglose para transparencia.
 */
export function computeAbsenceDays(input: DayComputationInput): {
  days: number;
  totalCalendarDays: number;
  weekendDays: number;
  holidayDays: number;
  businessDays: number;
} {
  const start = toUtcMidnight(input.startDate);
  const end = toUtcMidnight(input.endDate);
  const mode = (input.countingMode || 'BUSINESS').toUpperCase();
  const working = (input.workingWeekdays && input.workingWeekdays.length > 0)
    ? input.workingWeekdays
    : [1, 2, 3, 4, 5];
  const workingSet = new Set(working);
  const holIdx = buildHolidayIndex(input.holidays);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end.getTime() < start.getTime()) {
    return { days: 0, totalCalendarDays: 0, weekendDays: 0, holidayDays: 0, businessDays: 0 };
  }

  let totalCalendarDays = 0;
  let weekendDays = 0;
  let holidayDays = 0;
  let businessDays = 0;

  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const d = new Date(t);
    totalCalendarDays++;
    const isWorkingWeekday = workingSet.has(d.getUTCDay());
    const hol = isHoliday(d, holIdx);
    if (!isWorkingWeekday) weekendDays++;
    if (hol) holidayDays++;
    if (isWorkingWeekday && !hol) businessDays++;
  }

  let days = mode === 'CALENDAR' ? totalCalendarDays : businessDays;

  // Media jornada solo aplica a un único día computable.
  if (input.halfDay && days > 0) {
    days = mode === 'CALENDAR'
      ? (totalCalendarDays === 1 ? 0.5 : days)
      : (businessDays === 1 ? 0.5 : days);
  }

  return { days, totalCalendarDays, weekendDays, holidayDays, businessDays };
}

export interface BalanceLike {
  assignedDays?: number;
  carriedDays?: number;
  accruedDays?: number;
  usedDays?: number;
  reservedDays?: number;
  pendingDays?: number;
  adjustmentPositive?: number;
  adjustmentNegative?: number;
}

const n = (v: number | undefined | null) => (typeof v === 'number' && !isNaN(v) ? v : 0);

/** Saldo total acreditado (asignado + arrastrado + devengado + ajustePos). */
export function computeCredited(b: BalanceLike): number {
  return n(b.assignedDays) + n(b.carriedDays) + n(b.accruedDays) + n(b.adjustmentPositive);
}

/** Saldo disponible = acreditado - ajusteNeg - usado - reservado. */
export function computeAvailable(b: BalanceLike): number {
  return computeCredited(b) - n(b.adjustmentNegative) - n(b.usedDays) - n(b.reservedDays);
}

/** Enriquecer un saldo con campos derivados. */
export function enrichBalance<T extends BalanceLike>(b: T) {
  const credited = computeCredited(b);
  const available = computeAvailable(b);
  return {
    ...b,
    _credited: round2(credited),
    _available: round2(available),
    _committed: round2(n(b.reservedDays) + n(b.pendingDays)),
  };
}

export function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
