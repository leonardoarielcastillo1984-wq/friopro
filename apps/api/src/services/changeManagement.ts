// ============================================================
// Lógica centralizada de Gestión de Cambios Enterprise (ISO 9001:2015 §6.3)
// Nivel global, recomendaciones y workflow. Auditable y modificable en un solo lugar.
// ============================================================

export type Nivel = 'BAJO' | 'MEDIO' | 'ALTO';
export type NivelGlobal = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';

// Dimensiones de la evaluación multidimensional del impacto.
export const DIMENSIONES = [
  'CALIDAD',
  'SST',
  'AMBIENTAL',
  'OPERATIVO',
  'TECNOLOGICO',
  'LEGAL',
  'CONTINUIDAD',
] as const;
export type Dimension = (typeof DIMENSIONES)[number];

export const DIMENSION_LABELS: Record<Dimension, string> = {
  CALIDAD: 'Calidad / SGC',
  SST: 'SST',
  AMBIENTAL: 'Ambiental',
  OPERATIVO: 'Operativo',
  TECNOLOGICO: 'Tecnológico',
  LEGAL: 'Legal / Regulatorio',
  CONTINUIDAD: 'Continuidad Operativa',
};

// Mapea las dimensiones a las columnas resumen de gestion_cambio.
export const DIMENSION_TO_COLUMN: Record<Dimension, string> = {
  CALIDAD: 'impactoCalidad',
  SST: 'impactoSST',
  AMBIENTAL: 'impactoAmbiental',
  OPERATIVO: 'impactoOperativo',
  TECNOLOGICO: 'impactoTecnologico',
  LEGAL: 'impactoLegal',
  CONTINUIDAD: 'impactoContinuidad',
};

function isNivel(v: any): v is Nivel {
  return v === 'BAJO' || v === 'MEDIO' || v === 'ALTO';
}

/**
 * Clasificación global del cambio a partir de los niveles por dimensión.
 * Reglas (modificables aquí):
 *   BAJO    → todas las dimensiones evaluadas en BAJO (o sin evaluar).
 *   MEDIO   → al menos una MEDIO y ninguna ALTO.
 *   ALTO    → al menos una ALTO (menos de 3 ALTO).
 *   CRITICO → 3 o más dimensiones en ALTO.
 */
export function computeNivelGlobal(niveles: Array<string | null | undefined>): NivelGlobal {
  const vals = niveles.filter(isNivel) as Nivel[];
  const altos = vals.filter((v) => v === 'ALTO').length;
  const medios = vals.filter((v) => v === 'MEDIO').length;

  if (altos >= 3) return 'CRITICO';
  if (altos >= 1) return 'ALTO';
  if (medios >= 1) return 'MEDIO';
  return 'BAJO';
}

/**
 * Extrae los niveles desde un registro de cambio (columnas resumen).
 */
export function nivelesDesdeCambio(c: Record<string, any>): Array<string | null> {
  return Object.values(DIMENSION_TO_COLUMN).map((col) => c?.[col] ?? null);
}

/**
 * Recomendaciones determinísticas según el nivel global y las dimensiones afectadas.
 * Arquitectura preparada para incorporar IA posteriormente (misma firma de salida).
 */
export function getRecomendaciones(
  nivelGlobal: NivelGlobal,
  niveles: Record<string, string | null | undefined>
): string[] {
  const recs: string[] = [];
  const hayAlto = Object.values(niveles).some((v) => v === 'ALTO');
  const hayMedioOAlto = Object.values(niveles).some((v) => v === 'ALTO' || v === 'MEDIO');

  if (nivelGlobal === 'CRITICO') {
    recs.push(
      'Plan formal de implementación',
      'Proyecto de implementación',
      'Gestión formal de riesgos',
      'Comunicación a partes interesadas',
      'Evaluación de capacitación',
      'Plan de contingencia',
      'Verificación de eficacia posterior'
    );
  } else if (nivelGlobal === 'ALTO') {
    recs.push(
      'Plan formal de implementación',
      'Gestión de riesgos asociada',
      'Comunicación a partes interesadas afectadas',
      'Verificación de eficacia posterior'
    );
    if (niveles.TECNOLOGICO === 'ALTO') recs.push('Validación de continuidad tecnológica');
  } else if (nivelGlobal === 'MEDIO') {
    recs.push('Planificación básica del cambio', 'Verificación de eficacia posterior');
    if (hayMedioOAlto) recs.push('Identificación de riesgos asociados');
  } else {
    recs.push('Registro y control estándar del cambio');
  }

  // Recomendaciones específicas por dimensión
  if (niveles.LEGAL === 'ALTO') recs.push('Revisión de cumplimiento legal / regulatorio');
  if (niveles.CONTINUIDAD === 'ALTO') recs.push('Plan de contingencia de continuidad operativa');
  if (niveles.SST === 'ALTO' && hayAlto) recs.push('Evaluación de riesgos SST (ISO 45001)');
  if (niveles.AMBIENTAL === 'ALTO') recs.push('Evaluación de aspectos e impactos ambientales (ISO 14001)');

  // Únicos, preservando orden
  return Array.from(new Set(recs));
}

// ── Workflow ──────────────────────────────────────────────
// Flujo principal: SOLICITADO → EN_REVISION → APROBADO → IMPLEMENTADO → EN_VERIFICACION → CERRADO
// RECHAZADO es estado alternativo desde EN_REVISION.
export const STATUS_FLOW: Record<string, string[]> = {
  SOLICITADO: ['EN_REVISION'],
  EN_REVISION: ['APROBADO', 'RECHAZADO'],
  APROBADO: ['IMPLEMENTADO'],
  IMPLEMENTADO: ['EN_VERIFICACION'],
  EN_VERIFICACION: ['CERRADO'],
  // Compatibilidad hacia atrás: registros que quedaron en el estado legacy VERIFICADO
  VERIFICADO: ['CERRADO'],
  RECHAZADO: [],
  CERRADO: [],
};

export const STATUS_ORDER = [
  'SOLICITADO',
  'EN_REVISION',
  'APROBADO',
  'IMPLEMENTADO',
  'EN_VERIFICACION',
  'CERRADO',
];

export function nextStatuses(current: string): string[] {
  return STATUS_FLOW[current] ?? [];
}

/**
 * Valida una transición. `allowAdmin` permite el salto excepcional
 * IMPLEMENTADO → CERRADO con trazabilidad (permiso administrativo).
 */
export function canTransition(from: string, to: string, allowAdmin = false): boolean {
  if (nextStatuses(from).includes(to)) return true;
  if (allowAdmin && from === 'IMPLEMENTADO' && to === 'CERRADO') return true;
  return false;
}
