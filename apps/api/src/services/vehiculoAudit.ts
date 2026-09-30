// ═══════════════════════════════════════════════════════════════════════════
// FLOTA 360 — Auditoría del registro maestro de vehículos y semirremolques
// Helpers puros (diff + etiquetas) para poder testearlos sin BD, y helpers de
// persistencia (actor / registrar evento) pensados para usarse DENTRO de la
// misma transacción que muta el vehículo (atomicidad modificación + evento).
// ═══════════════════════════════════════════════════════════════════════════
import type { FastifyRequest } from 'fastify';

// ── Campos auditables del maestro ────────────────────────────────────────────
// Solo datos maestros. Los historiales operativos (mantenimiento, combustible,
// neumáticos) tienen sus propias tablas y quedan fuera de este alcance.
export const CAMPOS_AUDITABLES: Record<string, string> = {
  dominio: 'Dominio',
  tipo: 'Tipo de unidad',
  cantEjes: 'Cantidad de ejes',
  configEjes: 'Configuración de ejes',
  marca: 'Marca',
  modelo: 'Modelo',
  anio: 'Año',
  color: 'Color',
  chasis: 'N° de chasis',
  motor: 'N° de motor',
  tipoCombustible: 'Combustible',
  currentOdometer: 'Odómetro',
  valorAdquisicion: 'Valor de adquisición',
  status: 'Estado administrativo',
  estadoOperativo: 'Estadío operativo',
  conductorId: 'Conductor asignado',
  maintenanceAssetId: 'Activo de mantenimiento',
  perfilUso: 'Perfil de uso',
  kmMesEstimado: 'Km estimados por mes',
  notas: 'Notas',
};

export const ACCION_LABEL: Record<string, string> = {
  ALTA: 'Alta de unidad',
  EDICION: 'Edición de datos',
  CAMBIO_ESTADO: 'Cambio de estado',
  BAJA: 'Baja de unidad',
  REACTIVACION: 'Reactivación',
  ELIMINADO_PERMANENTE: 'Eliminación permanente',
};

export const ORIGEN_LABEL: Record<string, string> = {
  WEB: 'Panel web',
  API: 'API',
  IMPORTACION: 'Importación',
  QR_MECANICO: 'QR del mecánico',
  QR_CHOFER: 'QR del chofer',
  AUTOMATICO_OT: 'Automático (orden de trabajo)',
  AUTOMATICO_SISTEMA: 'Automático (sistema)',
  SEED_DEMO: 'Carga de demostración',
};

// Estados/valores → etiqueta legible para auditoría (se guarda ya resuelto).
export const VALOR_LABEL: Record<string, Record<string, string>> = {
  status: {
    ACTIVO: 'Activo', EN_TALLER: 'En taller', INACTIVO: 'Inactivo', BAJA: 'Baja',
  },
  estadoOperativo: {
    OPERATIVO: 'Operativo', EN_TALLER: 'En taller', EN_REPARACION: 'En reparación',
  },
  tipo: {
    CAMION: 'Camión', TRACTOR: 'Tractor', SEMI: 'Semirremolque',
    UTILITARIO: 'Utilitario', OTRO: 'Otro',
  },
  tipoCombustible: {
    DIESEL: 'Diésel', NAFTA: 'Nafta', GNC: 'GNC', MIXTO: 'Diésel + GNC', ELECTRICO: 'Eléctrico',
  },
  perfilUso: {
    RUTA: 'Ruta / larga distancia', URBANO: 'Urbano', OBRA: 'Obra', MIXTO: 'Mixto',
  },
};

export type CambioCampo = {
  campo: string;
  etiqueta: string;
  antes: unknown;
  despues: unknown;
  antesTxt: string;
  despuesTxt: string;
};

function normValor(v: unknown): unknown {
  if (v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  return v;
}

function valorTxt(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  const mapa = VALOR_LABEL[campo];
  if (mapa && typeof v === 'string' && mapa[v]) return mapa[v];
  if (typeof v === 'number') return v.toLocaleString('es-AR');
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

/**
 * Compara dos snapshots de vehículo y devuelve SOLO los campos auditables que
 * cambiaron de verdad. Clave para el requisito "no generar eventos por guardar
 * un formulario sin cambios reales".
 */
export function diffVehiculo(antes: any, despues: any, campos?: string[]): CambioCampo[] {
  const keys = campos ?? Object.keys(CAMPOS_AUDITABLES);
  const cambios: CambioCampo[] = [];
  for (const campo of keys) {
    if (!(campo in CAMPOS_AUDITABLES)) continue;
    const a = normValor(antes?.[campo]);
    const d = normValor(despues?.[campo]);
    // Comparación tolerante a representaciones equivalentes
    // (p.ej. 100 vs "100", null vs undefined ya normalizados)
    const iguales = a === d || (a != null && d != null && String(a) === String(d));
    if (iguales) continue;
    cambios.push({
      campo,
      etiqueta: CAMPOS_AUDITABLES[campo],
      antes: a,
      despues: d,
      antesTxt: valorTxt(campo, a),
      despuesTxt: valorTxt(campo, d),
    });
  }
  return cambios;
}

/** Valores iniciales para el evento de ALTA (todos los campos con valor). */
export function cambiosDeAlta(v: any): CambioCampo[] {
  const cambios: CambioCampo[] = [];
  for (const campo of Object.keys(CAMPOS_AUDITABLES)) {
    const d = normValor(v?.[campo]);
    if (d === null || d === '') continue;
    cambios.push({
      campo,
      etiqueta: CAMPOS_AUDITABLES[campo],
      antes: null,
      despues: d,
      antesTxt: '—',
      despuesTxt: valorTxt(campo, d),
    });
  }
  return cambios;
}

/** Deriva la acción de auditoría según qué cambió. */
export function accionPorCambios(cambios: CambioCampo[], statusAntes?: string | null): string {
  const cambioStatus = cambios.find((c) => c.campo === 'status');
  if (!cambioStatus) return 'EDICION';
  if (cambioStatus.despues === 'BAJA') return 'BAJA';
  if (statusAntes === 'BAJA' && cambioStatus.despues !== 'BAJA') return 'REACTIVACION';
  return 'CAMBIO_ESTADO';
}

/** Acciones que exigen motivo obligatorio. */
export const ACCIONES_CON_MOTIVO = new Set(['BAJA', 'REACTIVACION', 'CAMBIO_ESTADO']);

// ── Actor (identidad de sesión, nunca del body) ──────────────────────────────
export type ActorInfo = { usuarioId: string | null; usuarioNombre: string | null };

/**
 * Resuelve el usuario autenticado a nombre visible. El JWT solo trae userId,
 * así que se consulta PlatformUser. Si no hay usuario (proceso automático),
 * devuelve nulls — nunca un usuario ficticio.
 */
export async function resolverActor(prisma: any, req: FastifyRequest): Promise<ActorInfo> {
  const userId = (req as any).auth?.userId ?? null;
  if (!userId) return { usuarioId: null, usuarioNombre: null };
  try {
    const u = await prisma.platformUser.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    const nombre = u ? ([u.firstName, u.lastName].filter(Boolean).join(' ') || u.email) : null;
    return { usuarioId: userId, usuarioNombre: nombre };
  } catch {
    return { usuarioId: userId, usuarioNombre: null };
  }
}

export type RegistrarEventoArgs = {
  tenantId: string;
  vehiculo: { id: string; dominio: string; tipo?: string | null };
  accion: string;
  origen: string;
  cambios?: CambioCampo[] | null;
  motivo?: string | null;
  actor?: ActorInfo;
  req?: FastifyRequest;
};

/**
 * Inserta el evento de auditoría. Diseñado para invocarse con el `tx` de la
 * transacción que aplica la modificación, así modificación y evento se
 * confirman o revierten juntos.
 */
export async function registrarCambioVehiculo(tx: any, args: RegistrarEventoArgs) {
  const { tenantId, vehiculo, accion, origen, cambios, motivo, actor, req } = args;
  return tx.vehiculoHistorialCambio.create({
    data: {
      tenantId,
      vehiculoId: vehiculo.id,
      tipoActivo: vehiculo.tipo === 'SEMI' ? 'SEMI' : 'VEHICULO',
      dominio: vehiculo.dominio,
      accion,
      origen,
      cambios: cambios && cambios.length ? (cambios as any) : undefined,
      motivo: motivo ?? null,
      usuarioId: actor?.usuarioId ?? null,
      usuarioNombre: actor?.usuarioNombre ?? null,
      requestId: (req as any)?.id ?? null,
      userAgent: typeof req?.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    },
  });
}

// ── Zona horaria del tenant para mostrar el historial ────────────────────────
// Tenant.country es ISO-3166 alpha-2. Mapeo a IANA; default Argentina.
const TZ_POR_PAIS: Record<string, string> = {
  AR: 'America/Argentina/Buenos_Aires',
  CL: 'America/Santiago',
  BR: 'America/Sao_Paulo',
  UY: 'America/Montevideo',
  PY: 'America/Asuncion',
  BO: 'America/La_Paz',
  PE: 'America/Lima',
  MX: 'America/Mexico_City',
  CO: 'America/Bogota',
  EC: 'America/Guayaquil',
  ES: 'Europe/Madrid',
  US: 'America/New_York',
};

export function tzParaPais(country: string | null | undefined): string {
  return (country && TZ_POR_PAIS[country.toUpperCase()]) || 'America/Argentina/Buenos_Aires';
}
