// ═══════════════════════════════════════════════════════════════
// FLOTA 360 — Única fuente de verdad del estado de las unidades.
//
// Dimensiones separadas (NO un enum único):
//  - Situación administrativa: Vehiculo.status (ACTIVO/INACTIVO/BAJA;
//    'EN_TALLER' persiste solo como espejo legacy del episodio abierto).
//  - Disponibilidad: derivada = situación activa + sin restricciones
//    activas + sin episodio de indisponibilidad abierto.
//  - Utilización: derivada de FlotaJornada.unidades (intervalos por unidad).
//  - Ubicación: declarada en VehiculoUbicacionEvento (no infiere nada).
//  - Mantenimiento: UnidadIndisponibilidad + etapas (motivo, responsable,
//    ingreso/salida efectivos, OTs relacionadas).
//
// Reglas:
//  - estadoOperativo y status son DERIVADOS: solo este servicio los escribe.
//  - Cambiar una etiqueta jamás levanta una restricción ni cierra un caso.
//  - Toda escritura relacionada es transaccional e idempotente.
// ═══════════════════════════════════════════════════════════════

import { restriccionesActivasDe, restriccionesDelConjunto } from './defectService.js';
import { registrarCambioVehiculo } from './vehiculoAudit.js';

export const ETAPAS_INDISPONIBILIDAD = [
  'PENDIENTE_INGRESO',
  'PENDIENTE_DIAGNOSTICO',
  'ESPERANDO_PRESUPUESTO',
  'ESPERANDO_AUTORIZACION',
  'ESPERANDO_REPUESTO',
  'ESPERANDO_PAGO_REPUESTO',
  'ESPERANDO_TURNO_MANO_OBRA',
  'REPARACION_EN_CURSO',
  'PENDIENTE_VERIFICACION',
  'PENDIENTE_HABILITACION',
  'OTRO',
] as const;
export type EtapaIndisponibilidad = (typeof ETAPAS_INDISPONIBILIDAD)[number];

export const ETAPA_LABEL: Record<string, string> = {
  PENDIENTE_INGRESO: 'Pendiente de ingreso a taller',
  PENDIENTE_DIAGNOSTICO: 'Pendiente de diagnóstico',
  ESPERANDO_PRESUPUESTO: 'Esperando presupuesto',
  ESPERANDO_AUTORIZACION: 'Esperando autorización',
  ESPERANDO_REPUESTO: 'Esperando repuesto',
  ESPERANDO_PAGO_REPUESTO: 'Esperando pago del repuesto',
  ESPERANDO_TURNO_MANO_OBRA: 'Esperando turno o mano de obra',
  REPARACION_EN_CURSO: 'Reparación en curso',
  PENDIENTE_VERIFICACION: 'Pendiente de verificación',
  PENDIENTE_HABILITACION: 'Pendiente de habilitación',
  OTRO: 'Otro motivo',
};

export const UBICACION_TIPOS = ['ESTACIONAMIENTO', 'TALLER_INTERNO', 'TALLER_EXTERNO', 'OTRO'] as const;
export const UBICACION_LABEL: Record<string, string> = {
  ESTACIONAMIENTO: 'Estacionamiento',
  TALLER_INTERNO: 'Taller interno',
  TALLER_EXTERNO: 'Taller externo',
  OTRO: 'Otra ubicación',
  SIN_DATOS: 'Sin ubicación registrada',
};

const SITUACION_LABEL: Record<string, string> = {
  ACTIVO: 'Activa', EN_TALLER: 'Activa', INACTIVO: 'Inactiva', BAJA: 'Baja',
};

// Etapa → espejo legacy en Vehiculo.estadoOperativo (compatibilidad con
// VehiculoEstadoEvento y consumidores existentes).
function etapaAEstadoOperativo(etapa?: string | null): string {
  return etapa === 'REPARACION_EN_CURSO' ? 'EN_REPARACION' : 'EN_TALLER';
}

// ── Episodio abierto actual ────────────────────────────────────────────────
export async function episodioAbiertoDe(tx: any, tenantId: string, vehiculoId: string) {
  return tx.unidadIndisponibilidad.findFirst({
    where: { tenantId, vehiculoId, estado: 'ABIERTA' },
    include: { etapas: { orderBy: { inicioAt: 'asc' } } },
  });
}

function etapaVigente(episodio: any) {
  if (!episodio?.etapas?.length) return null;
  return episodio.etapas.find((e: any) => !e.finAt) ?? episodio.etapas[episodio.etapas.length - 1];
}

// ── Sincronización derivada: estadoOperativo + status + espejo en el
//    MaintenanceAsset. Crea VehiculoEstadoEvento solo si cambió el estadío.
//    Idempotente. NUNCA toca BAJA ni INACTIVO (situación administrativa).
async function syncEstadoUnidad(tx: any, opts: {
  tenantId: string; vehiculoId: string; origen: string;
  notas?: string | null; workOrderId?: string | null; createdByName?: string | null;
}) {
  const { tenantId, vehiculoId, origen, notas, workOrderId, createdByName } = opts;
  const vehiculo = await tx.vehiculo.findFirst({ where: { id: vehiculoId, tenantId } });
  if (!vehiculo) return null;

  const episodio = await episodioAbiertoDe(tx, tenantId, vehiculoId);
  const etapa = episodio ? etapaVigente(episodio)?.etapa ?? 'OTRO' : null;
  let nuevoEstadoOp: string;
  if (episodio) nuevoEstadoOp = etapaAEstadoOperativo(etapa);
  else {
    const activas = await restriccionesActivasDe(tx, tenantId, vehiculoId);
    nuevoEstadoOp = activas.length > 0 ? 'RESTRINGIDA' : 'OPERATIVO';
  }

  // Espejo administrativo legacy: EN_TALLER solo mientras haya episodio.
  let nuevoStatus = vehiculo.status;
  if (vehiculo.status !== 'BAJA' && vehiculo.status !== 'INACTIVO') {
    nuevoStatus = episodio ? 'EN_TALLER' : 'ACTIVO';
  }

  const cambios: any = {};
  if (vehiculo.estadoOperativo !== nuevoEstadoOp) cambios.estadoOperativo = nuevoEstadoOp;
  if (vehiculo.status !== nuevoStatus) cambios.status = nuevoStatus;
  if (Object.keys(cambios).length > 0) {
    await tx.vehiculo.update({ where: { id: vehiculoId }, data: cambios });
    if (cambios.estadoOperativo) {
      await tx.vehiculoEstadoEvento.create({
        data: { tenantId, vehiculoId, estado: nuevoEstadoOp, origen, notas: notas ?? null, workOrderId: workOrderId ?? null, createdByName: createdByName ?? null },
      });
    }
  }

  // MaintenanceAsset.status se deriva del estado central: MAINTENANCE solo
  // mientras haya episodio abierto; nunca pisa INACTIVE administrativo.
  if (vehiculo.maintenanceAssetId) {
    const asset = await tx.maintenanceAsset.findFirst({ where: { id: vehiculo.maintenanceAssetId, tenantId }, select: { status: true } });
    if (asset && asset.status !== 'INACTIVE') {
      const assetStatus = episodio ? 'MAINTENANCE' : 'ACTIVE';
      if (asset.status !== assetStatus) {
        await tx.maintenanceAsset.update({ where: { id: vehiculo.maintenanceAssetId }, data: { status: assetStatus } });
      }
    }
  }
  return { estadoOperativo: nuevoEstadoOp, status: nuevoStatus, episodio };
}

// ── Abrir (o engrosar) el episodio de indisponibilidad ─────────────────────
// Idempotente: si ya hay episodio abierto suma la causa (OT) y, si la etapa
// pedida difiere, cierra la etapa vigente y abre la nueva — sin reiniciar
// el contador total.
export async function abrirIndisponibilidad(tx: any, opts: {
  tenantId: string; vehiculoId: string;
  origen: string; // MANUAL | OT | CHECKLIST | QR_MECANICO | MIGRACION
  motivo?: string | null;
  etapa?: EtapaIndisponibilidad | string;
  comentario?: string | null;
  workOrderId?: string | null;
  inicioAt?: Date;
  tallerTipo?: 'INTERNO' | 'EXTERNO' | null;
  tallerId?: string | null;
  tallerNombre?: string | null;
  fechaIngresoTaller?: Date | null;
  fechaDevolucionEstimada?: Date | null;
  responsableNombre?: string | null;
  observaciones?: string | null;
  usuario?: { id?: string | null; nombre?: string | null };
  ahora?: Date;
}) {
  const ahora = opts.ahora ?? new Date();
  const { tenantId, vehiculoId } = opts;
  const etapa = ETAPAS_INDISPONIBILIDAD.includes(opts.etapa as any) ? (opts.etapa as string) : 'OTRO';
  const usuario = opts.usuario ?? {};

  const vehiculo = await tx.vehiculo.findFirst({ where: { id: vehiculoId, tenantId }, select: { id: true, status: true } });
  if (!vehiculo) return { error: 'Vehículo no encontrado', code: 404 };
  if (vehiculo.status === 'BAJA') return { error: 'La unidad está dada de baja', code: 409 };

  let episodio = await episodioAbiertoDe(tx, tenantId, vehiculoId);
  if (!episodio) {
    episodio = await tx.unidadIndisponibilidad.create({
      data: {
        tenantId, vehiculoId,
        inicioAt: opts.inicioAt ?? ahora,
        origen: opts.origen,
        motivo: opts.motivo ?? null,
        workOrderIds: opts.workOrderId ? [opts.workOrderId] : [],
        tallerTipo: opts.tallerTipo ?? null,
        tallerId: opts.tallerId ?? null,
        tallerNombre: opts.tallerNombre ?? null,
        fechaIngresoTaller: opts.fechaIngresoTaller ?? null,
        fechaDevolucionEstimada: opts.fechaDevolucionEstimada ?? null,
        responsableSeguimientoNombre: opts.responsableNombre ?? null,
        observaciones: opts.observaciones ?? null,
        etapas: {
          create: {
            tenantId, etapa, comentario: opts.comentario ?? null,
            inicioAt: opts.inicioAt ?? ahora, workOrderId: opts.workOrderId ?? null,
            responsableNombre: opts.responsableNombre ?? usuario.nombre ?? null,
            registradoPorId: usuario.id ?? null, registradoPorName: usuario.nombre ?? null,
          },
        },
      },
      include: { etapas: true },
    });
  } else {
    // Episodio ya abierto: sumar la OT a las causas (sin duplicar) y absorber
    // datos de taller que falten. El inicioAt del episodio NO se toca.
    const data: any = {};
    if (opts.workOrderId && !episodio.workOrderIds.includes(opts.workOrderId)) {
      data.workOrderIds = [...episodio.workOrderIds, opts.workOrderId];
    }
    if (!episodio.tallerTipo && opts.tallerTipo) data.tallerTipo = opts.tallerTipo;
    if (!episodio.tallerId && opts.tallerId) data.tallerId = opts.tallerId;
    if (!episodio.tallerNombre && opts.tallerNombre) data.tallerNombre = opts.tallerNombre;
    if (!episodio.fechaIngresoTaller && opts.fechaIngresoTaller) data.fechaIngresoTaller = opts.fechaIngresoTaller;
    if (opts.fechaDevolucionEstimada) data.fechaDevolucionEstimada = opts.fechaDevolucionEstimada;
    if (opts.responsableNombre) data.responsableSeguimientoNombre = opts.responsableNombre;
    if (opts.motivo && !episodio.motivo) data.motivo = opts.motivo;
    if (Object.keys(data).length > 0) {
      episodio = await tx.unidadIndisponibilidad.update({ where: { id: episodio.id }, data, include: { etapas: true } });
    }
  }

  // Cambio de etapa si difiere de la vigente (nunca reinicia el episodio).
  const vigente = etapaVigente(episodio);
  if (!vigente || vigente.etapa !== etapa) {
    await cambiarEtapa(tx, {
      tenantId, indisponibilidadId: episodio.id, etapa,
      comentario: opts.comentario ?? null, workOrderId: opts.workOrderId ?? null,
      responsableNombre: opts.responsableNombre ?? usuario.nombre ?? null,
      usuario, ahora,
    });
  }

  const sync = await syncEstadoUnidad(tx, {
    tenantId, vehiculoId, origen: opts.origen === 'QR_MECANICO' ? 'QR_MECANICO' : 'SISTEMA',
    notas: opts.motivo ?? opts.comentario ?? null, workOrderId: opts.workOrderId ?? null,
    createdByName: usuario.nombre ?? null,
  });
  return { episodio, ...sync };
}

// ── Cambio de etapa/motivo dentro del episodio (historial conservado) ──────
export async function cambiarEtapa(tx: any, opts: {
  tenantId: string; indisponibilidadId: string;
  etapa: string; comentario?: string | null; workOrderId?: string | null;
  responsableNombre?: string | null;
  usuario?: { id?: string | null; nombre?: string | null };
  ahora?: Date;
}) {
  const ahora = opts.ahora ?? new Date();
  const { tenantId, indisponibilidadId } = opts;
  if (!ETAPAS_INDISPONIBILIDAD.includes(opts.etapa as any)) return { error: 'Etapa inválida', code: 400 };

  const episodio = await tx.unidadIndisponibilidad.findFirst({
    where: { id: indisponibilidadId, tenantId }, include: { etapas: { orderBy: { inicioAt: 'asc' } } },
  });
  if (!episodio) return { error: 'Episodio no encontrado', code: 404 };
  if (episodio.estado !== 'ABIERTA') return { error: 'El episodio está cerrado', code: 409 };

  const vigente = etapaVigente(episodio);
  if (vigente && vigente.etapa === opts.etapa && !opts.comentario) {
    return { episodio, sinCambio: true };
  }
  const ops: any[] = [];
  if (vigente && !vigente.finAt) {
    ops.push(tx.unidadIndisponibilidadEtapa.update({ where: { id: vigente.id }, data: { finAt: ahora } }));
  }
  ops.push(tx.unidadIndisponibilidadEtapa.create({
    data: {
      tenantId, indisponibilidadId,
      etapa: opts.etapa, comentario: opts.comentario ?? null,
      inicioAt: ahora, workOrderId: opts.workOrderId ?? null,
      responsableNombre: opts.responsableNombre ?? episodio.responsableSeguimientoNombre ?? opts.usuario?.nombre ?? null,
      registradoPorId: opts.usuario?.id ?? null, registradoPorName: opts.usuario?.nombre ?? null,
    },
  }));
  if (opts.responsableNombre && opts.responsableNombre !== episodio.responsableSeguimientoNombre) {
    ops.push(tx.unidadIndisponibilidad.update({ where: { id: indisponibilidadId }, data: { responsableSeguimientoNombre: opts.responsableNombre } }));
  }
  await Promise.all(ops);
  return { episodio: await tx.unidadIndisponibilidad.findUnique({ where: { id: indisponibilidadId }, include: { etapas: true } }) };
}

// ── Ubicación declarada (dimensión independiente de disponibilidad) ────────
export async function registrarUbicacion(tx: any, opts: {
  tenantId: string; vehiculoId: string;
  tipo: string; // UBICACION_TIPOS o 'SIN_DATOS'
  detalle?: string | null; notas?: string | null; createdByName?: string | null;
}) {
  const { tenantId, vehiculoId } = opts;
  const tipo = UBICACION_TIPOS.includes(opts.tipo as any) || opts.tipo === 'SIN_DATOS' ? opts.tipo : 'OTRO';
  const ahora = new Date();
  const evento = await tx.vehiculoUbicacionEvento.create({
    data: { tenantId, vehiculoId, tipo, detalle: opts.detalle ?? null, notas: opts.notas ?? null, createdByName: opts.createdByName ?? null },
  });
  await tx.vehiculo.update({
    where: { id: vehiculoId },
    data: {
      ubicacionTipo: tipo === 'SIN_DATOS' ? null : tipo,
      ubicacionDetalle: tipo === 'SIN_DATOS' ? null : (opts.detalle ?? null),
      ubicacionDesde: ahora,
      ubicacionPor: opts.createdByName ?? null,
    },
  });
  return { tipo, desde: ahora, evento };
}

// ── Ingreso/salida efectivos del taller ────────────────────────────────────
export async function registrarIngresoTaller(tx: any, opts: {
  tenantId: string; indisponibilidadId: string;
  fecha?: Date; tallerTipo?: 'INTERNO' | 'EXTERNO'; tallerId?: string | null; tallerNombre?: string | null;
  fechaDevolucionEstimada?: Date | null;
  usuario?: { id?: string | null; nombre?: string | null };
}) {
  const ahora = opts.fecha ?? new Date();
  const ep = await tx.unidadIndisponibilidad.findFirst({ where: { id: opts.indisponibilidadId, tenantId: opts.tenantId } });
  if (!ep) return { error: 'Episodio no encontrado', code: 404 };
  if (ep.estado !== 'ABIERTA') return { error: 'El episodio está cerrado', code: 409 };

  const data: any = { fechaIngresoTaller: ep.fechaIngresoTaller ?? ahora };
  if (opts.tallerTipo) data.tallerTipo = opts.tallerTipo;
  if (opts.tallerId !== undefined) data.tallerId = opts.tallerId;
  if (opts.tallerNombre !== undefined) data.tallerNombre = opts.tallerNombre;
  if (opts.fechaDevolucionEstimada !== undefined) data.fechaDevolucionEstimada = opts.fechaDevolucionEstimada;
  await tx.unidadIndisponibilidad.update({ where: { id: ep.id }, data });

  await registrarUbicacion(tx, {
    tenantId: opts.tenantId, vehiculoId: ep.vehiculoId,
    tipo: (opts.tallerTipo ?? ep.tallerTipo) === 'EXTERNO' ? 'TALLER_EXTERNO' : 'TALLER_INTERNO',
    detalle: opts.tallerNombre ?? ep.tallerNombre ?? null,
    notas: 'Ingreso a taller registrado', createdByName: opts.usuario?.nombre ?? null,
  });
  return { episodio: await tx.unidadIndisponibilidad.findUnique({ where: { id: ep.id }, include: { etapas: true } }) };
}

export async function registrarSalidaTaller(tx: any, opts: {
  tenantId: string; indisponibilidadId: string; fecha?: Date;
  usuario?: { id?: string | null; nombre?: string | null };
}) {
  const ahora = opts.fecha ?? new Date();
  const ep = await tx.unidadIndisponibilidad.findFirst({ where: { id: opts.indisponibilidadId, tenantId: opts.tenantId } });
  if (!ep) return { error: 'Episodio no encontrado', code: 404 };
  await tx.unidadIndisponibilidad.update({ where: { id: ep.id }, data: { fechaSalidaTaller: ep.fechaSalidaTaller ?? ahora } });
  // Al salir del taller la ubicación anterior ya no es confiable: no se
  // inventa una nueva — queda SIN_DATOS hasta que se registre otra.
  await registrarUbicacion(tx, {
    tenantId: opts.tenantId, vehiculoId: ep.vehiculoId, tipo: 'SIN_DATOS',
    notas: 'Salida de taller registrada — ubicación posterior sin declarar',
    createdByName: opts.usuario?.nombre ?? null,
  });
  return { episodio: await tx.unidadIndisponibilidad.findUnique({ where: { id: ep.id }, include: { etapas: true } }) };
}

// ── Evaluación de causas abiertas + cierre del episodio ────────────────────
// El episodio permanece abierto mientras subsistan causas: restricciones
// activas u OTs que retiran la unidad aún abiertas. Las verificaciones
// pendientes se reflejan vía restricciones (casos bloqueantes).
async function causasAbiertas(tx: any, tenantId: string, vehiculoId: string, episodio: any) {
  const restricciones = await restriccionesActivasDe(tx, tenantId, vehiculoId);
  const veh = await tx.vehiculo.findFirst({ where: { id: vehiculoId, tenantId }, select: { maintenanceAssetId: true } });
  let otsAbiertas: any[] = [];
  if (veh?.maintenanceAssetId) {
    otsAbiertas = await tx.workOrder.findMany({
      where: {
        tenantId, assetId: veh.maintenanceAssetId, retiraDeServicio: true,
        status: { in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD'] },
      },
      select: { id: true, code: true, status: true },
    });
  }
  return { restricciones, otsAbiertas };
}

export async function evaluarYCerrarIndisponibilidad(tx: any, opts: {
  tenantId: string; vehiculoId: string;
  usuario?: { id?: string | null; nombre?: string | null };
  origen?: string; motivo?: string | null; ahora?: Date;
}) {
  const { tenantId, vehiculoId } = opts;
  const ahora = opts.ahora ?? new Date();
  const episodio = await episodioAbiertoDe(tx, tenantId, vehiculoId);
  if (!episodio) {
    await syncEstadoUnidad(tx, { tenantId, vehiculoId, origen: opts.origen ?? 'SISTEMA', notas: opts.motivo, createdByName: opts.usuario?.nombre });
    return { episodio: null, cerrado: false, motivos: [] as string[] };
  }

  const { restricciones, otsAbiertas } = await causasAbiertas(tx, tenantId, vehiculoId, episodio);
  const motivos: string[] = [
    ...restricciones.map((r: any) => `restricción activa: ${r.motivo}`),
    ...otsAbiertas.map((o: any) => `OT ${o.code || o.id} que retira la unidad sigue abierta`),
  ];

  if (motivos.length > 0) {
    // Persiste la causa: ajustar la etapa según el circuito de defectos.
    const casos = await tx.defectoCaso.findMany({
      where: { tenantId, vehiculoId, estado: { in: ['VERIFICADO'] } },
      select: { id: true },
    });
    const etapaNueva = restricciones.length > 0
      ? (casos.length > 0 ? 'PENDIENTE_HABILITACION' : 'PENDIENTE_VERIFICACION')
      : vigenteOr(episodio);
    const vigente = etapaVigente(episodio);
    if (vigente && vigente.etapa !== etapaNueva && restricciones.length > 0) {
      await cambiarEtapa(tx, {
        tenantId, indisponibilidadId: episodio.id, etapa: etapaNueva,
        comentario: `Reparación informada — ${motivos.join('; ')}`,
        usuario: opts.usuario, ahora,
      });
    }
    await syncEstadoUnidad(tx, { tenantId, vehiculoId, origen: opts.origen ?? 'SISTEMA', notas: opts.motivo, createdByName: opts.usuario?.nombre });
    return { episodio, cerrado: false, motivos };
  }

  // Sin causas: cerrar episodio + etapa vigente en la misma transacción.
  const vigente = etapaVigente(episodio);
  const data: any = {
    estado: 'CERRADA', finAt: ahora,
    cerradaPorNombre: opts.usuario?.nombre ?? null,
    cierreMotivo: opts.motivo ?? null,
  };
  if (episodio.fechaIngresoTaller && !episodio.fechaSalidaTaller) data.fechaSalidaTaller = ahora;
  const ops: any[] = [tx.unidadIndisponibilidad.update({ where: { id: episodio.id }, data })];
  if (vigente && !vigente.finAt) {
    ops.push(tx.unidadIndisponibilidadEtapa.update({ where: { id: vigente.id }, data: { finAt: ahora } }));
  }
  await Promise.all(ops);
  await syncEstadoUnidad(tx, { tenantId, vehiculoId, origen: opts.origen ?? 'SISTEMA', notas: opts.motivo, createdByName: opts.usuario?.nombre });
  return { episodio, cerrado: true, motivos: [] };
}

function vigenteOr(episodio: any): string {
  return etapaVigente(episodio)?.etapa ?? 'OTRO';
}

// Cierre manual = declarar la unidad disponible. No levanta restricciones:
// si hay restricciones activas u OTs retirando la unidad, se rechaza.
export async function cerrarIndisponibilidadManual(tx: any, opts: {
  tenantId: string; vehiculoId: string;
  usuario: { id?: string | null; nombre?: string | null };
  motivo?: string | null;
}) {
  const episodio = await episodioAbiertoDe(tx, opts.tenantId, opts.vehiculoId);
  if (!episodio) return { error: 'La unidad no tiene un episodio de indisponibilidad abierto', code: 409 };
  const { restricciones, otsAbiertas } = await causasAbiertas(tx, opts.tenantId, opts.vehiculoId, episodio);
  if (restricciones.length > 0) {
    return {
      error: `La unidad tiene ${restricciones.length} restricción(es) de servicio activas. Requiere habilitación autorizada (no se levantan al cambiar el estado).`,
      code: 409,
      restricciones: restricciones.map((r: any) => ({ id: r.id, motivo: r.motivo, casoId: r.casoId })),
    };
  }
  if (otsAbiertas.length > 0) {
    return {
      error: `La unidad tiene ${otsAbiertas.length} OT(s) abiertas que la retiran del servicio.`,
      code: 409,
      ots: otsAbiertas,
    };
  }
  return evaluarYCerrarIndisponibilidad(tx, { ...opts, origen: 'SISTEMA' });
}

// ── Impedimentos para iniciar/incorporarse a un servicio ───────────────────
export async function impedimentosParaServicio(tx: any, tenantId: string, vehiculo: { id: string; dominio: string; status?: string }) {
  const motivos: string[] = [];
  if (vehiculo.status === 'BAJA') motivos.push(`la unidad ${vehiculo.dominio} está dada de baja`);
  if (vehiculo.status === 'INACTIVO') motivos.push(`la unidad ${vehiculo.dominio} está inactiva`);

  const episodio = await episodioAbiertoDe(tx, tenantId, vehiculo.id);
  if (episodio) {
    motivos.push(`la unidad ${vehiculo.dominio} está fuera de servicio (${ETAPA_LABEL[vigenteOr(episodio)] ?? 'en mantenimiento'})`);
  }
  const { restricciones, conjunto } = await restriccionesDelConjunto(tx, tenantId, vehiculo.id);
  for (const r of restricciones) {
    motivos.push(`restricción activa en ${r.vehiculo?.dominio || 'la unidad'}: ${r.motivo}`);
  }
  // Episodio del compañero acoplado (un semi detenido impide el conjunto).
  if (conjunto) {
    const compId = conjunto.tractorId === vehiculo.id ? conjunto.semiId : conjunto.tractorId;
    const epComp = await episodioAbiertoDe(tx, tenantId, compId);
    if (epComp) {
      const comp = await tx.vehiculo.findFirst({ where: { id: compId }, select: { dominio: true } });
      motivos.push(`la unidad acoplada ${comp?.dominio || compId} está fuera de servicio (${ETAPA_LABEL[vigenteOr(epComp)] ?? 'en mantenimiento'})`);
    }
  }
  return { ok: motivos.length === 0, motivos, restricciones, episodio, conjunto };
}

// ── Estado compuesto (una etiqueta por dimensión, nunca un megaenum) ───────
export function componerEstado(args: {
  vehiculo: any; // status, ubicacionTipo, ubicacionDetalle, ubicacionDesde
  episodio?: any | null;
  restricciones?: any[];
  enServicio?: boolean;
}) {
  const { vehiculo, episodio, restricciones = [], enServicio = false } = args;
  const advertencias: string[] = [];

  const situacion = vehiculo.status === 'BAJA' ? 'BAJA' : vehiculo.status === 'INACTIVO' ? 'INACTIVA' : 'ACTIVA';
  const etapa = episodio ? etapaVigente(episodio) : null;
  const disponible = situacion === 'ACTIVA' && !episodio && restricciones.length === 0;
  const utilizacion = enServicio ? 'EN_SERVICIO' : 'SIN_SERVICIO';
  const ubicacion = vehiculo.ubicacionTipo ?? null;

  if (enServicio && restricciones.length > 0) advertencias.push('Servicio abierto con restricciones activas — requiere conciliación');
  if (enServicio && episodio) advertencias.push('Servicio abierto sobre unidad retirada del servicio — requiere conciliación');

  // Etiqueta compuesta legible
  let etiqueta: string;
  if (situacion === 'BAJA') etiqueta = 'Baja';
  else if (situacion === 'INACTIVA') etiqueta = 'Inactiva';
  else if (episodio) {
    const etapaCodigo = etapa?.etapa ?? 'OTRO';
    if (etapaCodigo === 'PENDIENTE_HABILITACION') etiqueta = 'Verificada · Pendiente de habilitación';
    else if (etapaCodigo === 'PENDIENTE_VERIFICACION') etiqueta = 'Reparación terminada · Pendiente de verificación';
    else {
      const base = episodio.fechaIngresoTaller ? 'En taller' : 'No disponible';
      etiqueta = `${base} · ${ETAPA_LABEL[etapaCodigo] ?? etapaCodigo}`;
    }
    if (restricciones.length > 0) etiqueta += ' · Restringida';
  } else if (restricciones.length > 0) {
    etiqueta = `No disponible · Restringida (${restricciones[0].motivo})`;
  } else {
    // Disponible
    etiqueta = 'Disponible';
    if (ubicacion) etiqueta += ` · ${UBICACION_LABEL[ubicacion] ?? ubicacion}`;
    etiqueta += utilizacion === 'EN_SERVICIO' ? '' : (ubicacion ? ' · Sin servicio' : ' · Sin servicio registrado');
    if (utilizacion === 'EN_SERVICIO') etiqueta = 'En servicio';
  }

  return {
    situacion,
    situacionLabel: SITUACION_LABEL[vehiculo.status] ?? situacion,
    disponible,
    restringida: restricciones.length > 0,
    restricciones: restricciones.map((r: any) => ({ id: r.id, motivo: r.motivo })),
    episodioId: episodio?.id ?? null,
    etapa: etapa?.etapa ?? null,
    etapaLabel: etapa ? (ETAPA_LABEL[etapa.etapa] ?? etapa.etapa) : null,
    enTallerEfectivo: !!episodio?.fechaIngresoTaller,
    utilizacion,
    ubicacionTipo: ubicacion,
    ubicacionLabel: ubicacion ? (UBICACION_LABEL[ubicacion] ?? ubicacion) : UBICACION_LABEL.SIN_DATOS,
    ubicacionDetalle: vehiculo.ubicacionDetalle ?? null,
    ubicacionDesde: vehiculo.ubicacionDesde ?? null,
    estadoComentario: vehiculo.estadoComentario ?? null,
    estadoComentarioAt: vehiculo.estadoComentarioAt ?? null,
    estadoComentarioPor: vehiculo.estadoComentarioPor ?? null,
    motivoEpisodio: episodio?.motivo ?? null,
    comentarioEtapa: etapa?.comentario ?? null,
    etiqueta,
    advertencias,
  };
}

// Batch: compone el estado de muchas unidades con 3 consultas totales.
export async function estadoCompuestoBatch(tx: any, tenantId: string, vehiculos: any[]) {
  const ids = vehiculos.map((v: any) => v.id);
  if (ids.length === 0) return new Map<string, any>();
  const [episodios, restricciones, jornadasAbiertas] = await Promise.all([
    tx.unidadIndisponibilidad.findMany({
      where: { tenantId, vehiculoId: { in: ids }, estado: 'ABIERTA' },
      include: { etapas: { orderBy: { inicioAt: 'asc' } } },
    }),
    tx.restriccionServicio.findMany({ where: { tenantId, vehiculoId: { in: ids }, activa: true } }),
    tx.flotaJornada.findMany({ where: { tenantId, estado: 'ABIERTA' }, select: { id: true, unidades: true } }),
  ]);
  const epPorVeh = new Map(episodios.map((e: any) => [e.vehiculoId, e]));
  const restPorVeh = new Map<string, any[]>();
  for (const r of restricciones) {
    const arr = restPorVeh.get(r.vehiculoId) || [];
    arr.push(r);
    restPorVeh.set(r.vehiculoId, arr);
  }
  const enServicio = new Set<string>();
  for (const j of jornadasAbiertas) {
    for (const u of (Array.isArray(j.unidades) ? j.unidades : []) as any[]) {
      if (u && u.vehiculoId && !u.hasta) enServicio.add(u.vehiculoId);
    }
  }
  const out = new Map<string, any>();
  for (const v of vehiculos) {
    out.set(v.id, componerEstado({
      vehiculo: v,
      episodio: epPorVeh.get(v.id) ?? null,
      restricciones: restPorVeh.get(v.id) ?? [],
      enServicio: enServicio.has(v.id),
    }));
  }
  return out;
}

// ── Auditoría administrativa (mantiene VehiculoHistorialCambio coherente) ──
export async function auditarCambioEstado(tx: any, opts: {
  tenantId: string; vehiculo: any; origen: string; motivo: string;
  antes: string; despues: string;
}) {
  const LABEL: Record<string, string> = { ACTIVO: 'Activo', EN_TALLER: 'En taller', INACTIVO: 'Inactivo', BAJA: 'Baja' };
  if (opts.antes === opts.despues) return;
  await registrarCambioVehiculo(tx, {
    tenantId: opts.tenantId, vehiculo: opts.vehiculo,
    accion: 'CAMBIO_ESTADO', origen: opts.origen, motivo: opts.motivo,
    cambios: [{
      campo: 'status', etiqueta: 'Estado administrativo',
      antes: opts.antes, despues: opts.despues,
      antesTxt: LABEL[opts.antes] ?? opts.antes, despuesTxt: LABEL[opts.despues] ?? opts.despues,
    }],
    actor: { usuarioId: null, usuarioNombre: null },
  });
}
