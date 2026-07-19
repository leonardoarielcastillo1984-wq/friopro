/**
 * Dominio: evaluación determinística de Objetivos SGI360.
 * Centraliza umbrales de riesgo y fórmulas de progreso (KPI / acciones / esperado).
 * NO depende de IA. Todos los cálculos son determinísticos y acotados.
 */

/** Umbrales de desviación (puntos porcentuales) para clasificar el riesgo. */
export const OBJECTIVE_RISK_THRESHOLDS = {
  /** Desviación >= -10 pp → NORMAL */
  attention: -10,
  /** Desviación entre -10 y -20 pp → ATTENTION; menor a -20 → AT_RISK */
  atRisk: -20,
} as const;

export type RiskLevel = 'NORMAL' | 'ATTENTION' | 'AT_RISK';
export type ProgressMethod = 'MANUAL' | 'KPI' | 'ACTIONS';

const clamp = (n: number, min = 0, max = 100) => Math.min(Math.max(n, min), max);

/**
 * Progreso esperado según fechas (distribución lineal en el tiempo).
 * Devuelve null si no hay fechas suficientes para calcular.
 */
export function computeExpectedProgress(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const t = now.getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  if (t <= start) return 0;
  if (t >= end) return 100;
  return Math.round(((t - start) / (end - start)) * 100);
}

/**
 * Progreso automático por KPI vinculado.
 * Soporta HIGHER_BETTER / LOWER_BETTER, metas de incremento/reducción,
 * porcentajes y valores absolutos. Evita divisiones por cero. Acota 0..100.
 */
export function computeKpiProgress(args: {
  baseline: number | null | undefined;
  current: number | null | undefined;
  target: number | null | undefined;
  direction: string | null | undefined; // HIGHER_BETTER | LOWER_BETTER
}): number | null {
  const { baseline, current, target, direction } = args;
  if (current === null || current === undefined) return null;
  if (target === null || target === undefined) return null;

  const higher = direction !== 'LOWER_BETTER';
  const b = baseline ?? (higher ? 0 : null);

  if (higher) {
    // Meta de incremento: desde línea base hacia meta (mayor es mejor)
    const base = b ?? 0;
    const denom = target - base;
    if (denom === 0) return current >= target ? 100 : 0;
    return clamp(((current - base) / denom) * 100);
  } else {
    // Meta de reducción: desde línea base hacia meta (menor es mejor)
    if (b === null) {
      // Sin línea base: aproximar por relación meta/actual
      if (current <= 0) return 100;
      return clamp((target / current) * 100);
    }
    const denom = b - target;
    if (denom === 0) return current <= target ? 100 : 0;
    return clamp(((b - current) / denom) * 100);
  }
}

/** Progreso automático por acciones/hitos (distribución uniforme si no hay ponderación). */
export function computeActionsProgress(
  activities: Array<{ status?: string | null }> | null | undefined,
): number | null {
  if (!activities || activities.length === 0) return null;
  const total = activities.length;
  const completed = activities.filter((a) => a.status === 'COMPLETED').length;
  return clamp(Math.round((completed / total) * 100));
}

export interface ObjectiveAssessment {
  progressMethod: ProgressMethod;
  actualProgress: number;
  expectedProgress: number | null;
  deviation: number | null;
  riskLevel: RiskLevel;
  computedStatus: string; // PLANNED | IN_PROGRESS | ACHIEVED | DELAYED | CANCELLED
  isAtRisk: boolean;
  isDelayed: boolean;
  reason: string;
  kpi?: {
    value: number | null;
    target: number | null;
    baseline: number | null;
    unit: string | null;
    direction: string | null;
    frequency: string | null;
  } | null;
}

/**
 * Evalúa un objetivo de forma determinística.
 * - Calcula progreso real según el método (KPI/acciones/manual).
 * - Calcula progreso esperado por fechas.
 * - Determina desviación y nivel de riesgo con umbrales centralizados.
 * - Determina estado: Cumplido / Retrasado / En curso / Planificado / Cancelado.
 * NO muta el objetivo; solo devuelve la evaluación.
 */
export function assessObjective(obj: {
  status?: string | null;
  progress?: number | null;
  progressMethod?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  baselineValue?: number | null;
  activities?: Array<{ status?: string | null }> | null;
  primaryIndicator?: {
    currentValue?: number | null;
    targetValue?: number | null;
    unit?: string | null;
    direction?: string | null;
    frequency?: string | null;
  } | null;
}, now: Date = new Date()): ObjectiveAssessment {
  const method = (obj.progressMethod as ProgressMethod) || 'MANUAL';
  const storedStatus = obj.status || 'PLANNED';

  // KPI info (fuente de verdad = indicador)
  const kpi = obj.primaryIndicator
    ? {
        value: obj.primaryIndicator.currentValue ?? null,
        target: obj.primaryIndicator.targetValue ?? null,
        baseline: obj.baselineValue ?? null,
        unit: obj.primaryIndicator.unit ?? null,
        direction: obj.primaryIndicator.direction ?? null,
        frequency: obj.primaryIndicator.frequency ?? null,
      }
    : null;

  // Progreso real según método
  let actualProgress = obj.progress ?? 0;
  if (method === 'KPI' && kpi) {
    const p = computeKpiProgress({
      baseline: kpi.baseline,
      current: kpi.value,
      target: kpi.target,
      direction: kpi.direction,
    });
    if (p !== null) actualProgress = p;
  } else if (method === 'ACTIONS') {
    const p = computeActionsProgress(obj.activities);
    if (p !== null) actualProgress = p;
  }
  actualProgress = clamp(Math.round(actualProgress));

  const expectedProgress = computeExpectedProgress(obj.startDate, obj.endDate, now);
  const deviation = expectedProgress !== null ? actualProgress - expectedProgress : null;

  // Determinación de estado (Cumplido / Retrasado)
  const endPassed = !!obj.endDate && new Date(obj.endDate).getTime() < now.getTime();
  const achieved = actualProgress >= 100;

  let computedStatus = storedStatus;
  let isDelayed = false;
  if (storedStatus === 'CANCELLED') {
    computedStatus = 'CANCELLED';
  } else if (achieved) {
    computedStatus = 'ACHIEVED';
  } else if (endPassed) {
    computedStatus = 'DELAYED';
    isDelayed = true;
  } else if (actualProgress > 0) {
    computedStatus = 'IN_PROGRESS';
  } else {
    computedStatus = storedStatus === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'PLANNED';
  }

  // Nivel de riesgo por desviación (solo aplica a objetivos activos no cumplidos)
  let riskLevel: RiskLevel = 'NORMAL';
  if (!achieved && computedStatus !== 'CANCELLED' && deviation !== null) {
    if (deviation < OBJECTIVE_RISK_THRESHOLDS.atRisk) riskLevel = 'AT_RISK';
    else if (deviation < OBJECTIVE_RISK_THRESHOLDS.attention) riskLevel = 'ATTENTION';
  }
  const isAtRisk = riskLevel === 'AT_RISK' && !isDelayed && !achieved;

  // Explicación determinística
  let reason: string;
  if (achieved) {
    reason = 'El objetivo alcanzó su meta según el método de medición definido.';
  } else if (isDelayed) {
    reason = `La fecha de finalización venció y el objetivo no fue cumplido (avance ${actualProgress}%).`;
  } else if (expectedProgress === null) {
    reason = 'Sin fechas de inicio/fin definidas: no es posible calcular la desviación temporal.';
  } else {
    const dev = deviation as number;
    const devTxt = dev >= 0 ? `+${dev}` : `${dev}`;
    reason = `El avance real es del ${actualProgress}%, mientras que el avance esperado para el período es del ${expectedProgress}%. Existe una desviación de ${devTxt} puntos porcentuales.`;
  }

  return {
    progressMethod: method,
    actualProgress,
    expectedProgress,
    deviation,
    riskLevel,
    computedStatus,
    isAtRisk,
    isDelayed,
    reason,
    kpi,
  };
}
