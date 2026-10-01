// ────────────────────────────────────────────────────────────────────────────
// Jornadas y descansos — núcleo de la lógica.
//
// • Identidad: conductor verificado por PIN en el servidor (el QR sólo
//   identifica la unidad). conductorId solo no acredita nada.
// • Jornada explícita: entidad FlotaJornada vincula INICIO→FIN; una abierta
//   por conductor+tenant (índice único parcial + control transaccional).
// • Política configurable por tenant, versionada; cada jornada guarda un
//   snapshot para que cambios de umbral no reescriban evaluaciones pasadas.
// • Precisión: comparaciones en milisegundos, sin redondear antes de decidir.
// • Descanso = intervalo entre jornadas registradas. Nunca se describe como
//   descanso efectivo comprobado; sin historial se informa explícitamente.
// ────────────────────────────────────────────────────────────────────────────

import { notifyFlotaAlerta } from './notifyService.js';

let _bcrypt: any = null;
async function getBcrypt() {
  if (_bcrypt) return _bcrypt;
  _bcrypt = (await import('bcryptjs')).default;
  return _bcrypt;
}

const HORA_MS = 3600000;

// ── Política ────────────────────────────────────────────────────────────────

export interface JornadaPolitica {
  id?: string;
  descansoMinHoras: number;
  modoAplicacion: 'ADVERTENCIA' | 'BLOQUEO';
  jornadaAlertaHoras: number;
  avisoAnticipacionHoras: number;
  destinatarios: 'ADMINS' | string[];
  politicaRevisada: boolean;
  version: number;
}

export const POLITICA_DEFAULT: JornadaPolitica = {
  descansoMinHoras: 12,
  modoAplicacion: 'ADVERTENCIA',
  jornadaAlertaHoras: 12,
  avisoAnticipacionHoras: 1,
  destinatarios: 'ADMINS',
  politicaRevisada: false,
  version: 1,
};

export async function getPoliticaJornada(prisma: any, tenantId: string): Promise<JornadaPolitica> {
  const p = await prisma.flotaJornadaPolitica.findUnique({ where: { tenantId } });
  if (!p) return { ...POLITICA_DEFAULT };
  return {
    id: p.id,
    descansoMinHoras: p.descansoMinHoras,
    modoAplicacion: p.modoAplicacion,
    jornadaAlertaHoras: p.jornadaAlertaHoras,
    avisoAnticipacionHoras: p.avisoAnticipacionHoras,
    destinatarios: p.destinatarios ?? 'ADMINS',
    politicaRevisada: p.politicaRevisada,
    version: p.version,
  };
}

// Snapshot de la política en uso (lo que queda grabado en la jornada y en
// los rechazos — la regla aplicada en aquel momento).
function politicaSnapshot(p: JornadaPolitica) {
  return {
    descansoMinHoras: p.descansoMinHoras,
    modoAplicacion: p.modoAplicacion,
    jornadaAlertaHoras: p.jornadaAlertaHoras,
    avisoAnticipacionHoras: p.avisoAnticipacionHoras,
    version: p.version,
  };
}

// ── Identidad del conductor (PIN verificado en servidor) ────────────────────

export async function verificarConductor(
  prisma: any, tenantId: string, conductorId: string | undefined, pin: string | undefined
): Promise<{ ok: true; conductor: any } | { ok: false; code: number; error: string }> {
  if (!conductorId) {
    return { ok: false, code: 400, error: 'Identificá quién sos: elegí tu nombre y tu PIN.' };
  }
  if (!pin) {
    return { ok: false, code: 400, error: 'Ingresá tu PIN de conductor.' };
  }
  const conductor = await prisma.conductor.findFirst({
    where: { id: conductorId, tenantId, status: 'ACTIVO' },
  });
  if (!conductor) {
    // Respuesta genérica deliberada: no revelar si el id existe en otro tenant.
    return { ok: false, code: 401, error: 'Conductor o PIN inválido.' };
  }
  if (!conductor.pinHash) {
    return { ok: false, code: 403, error: 'Tu conductor no tiene PIN asignado. Pedile al responsable de flota que lo configure.' };
  }
  const valido = await (await getBcrypt()).compare(String(pin), conductor.pinHash);
  if (!valido) {
    return { ok: false, code: 401, error: 'Conductor o PIN inválido.' };
  }
  return { ok: true, conductor };
}

// Hash de un PIN nuevo (usado por el endpoint de empresa)
export async function hashPin(pin: string): Promise<string> {
  return (await getBcrypt()).hash(pin, 10);
}

// ── Estado previo al inicio (consulta informativa — la decisión se toma al
//    confirmar, en el servidor, dentro de la transacción) ────────────────────

export async function estadoServicioChofer(prisma: any, tenantId: string, conductorId: string) {
  const politica = await getPoliticaJornada(prisma, tenantId);
  const ahora = new Date();

  const [jornadaAbierta, ultimaCerrada, habilitacion] = await Promise.all([
    prisma.flotaJornada.findFirst({
      where: { tenantId, conductorId, estado: 'ABIERTA' },
      orderBy: { inicioAt: 'desc' },
    }),
    prisma.flotaJornada.findFirst({
      where: { tenantId, conductorId, estado: 'CERRADA' },
      orderBy: { inicioAt: 'desc' },
    }),
    prisma.flotaHabilitacionDescanso.findFirst({
      where: { tenantId, conductorId, usadaEnJornadaId: null },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const abierta = jornadaAbierta ? {
    id: jornadaAbierta.id,
    inicioAt: jornadaAbierta.inicioAt,
    unidades: jornadaAbierta.unidades,
    horasTranscurridas: Math.round(((ahora.getTime() - new Date(jornadaAbierta.inicioAt).getTime()) / HORA_MS) * 10) / 10,
    origen: jornadaAbierta.origen, destino: jornadaAbierta.destino,
  } : null;

  // Último cierre válido = finAt no nulo de la última jornada cerrada
  const ultimoCierre = ultimaCerrada?.finAt ? new Date(ultimaCerrada.finAt) : null;
  const cierreNoConfiable = !!ultimaCerrada && !ultimaCerrada.finAt; // regularizada sin horario

  const minDescansoMs = politica.descansoMinHoras * HORA_MS;
  let horasDesdeCierre: number | null = null;
  let restanteMinutos: number | null = null;
  let habilitadoDesde: Date | null = null;
  let evaluacion: string;

  if (abierta) {
    evaluacion = 'JORNADA_ABIERTA';
  } else if (cierreNoConfiable) {
    evaluacion = 'CIERRE_NO_CONFIABLE';
  } else if (!ultimoCierre) {
    evaluacion = 'SIN_HISTORIAL';
  } else {
    const transcurridoMs = ahora.getTime() - ultimoCierre.getTime();
    horasDesdeCierre = Math.round((transcurridoMs / HORA_MS) * 10) / 10;
    habilitadoDesde = new Date(ultimoCierre.getTime() + minDescansoMs);
    const restanteMs = habilitadoDesde.getTime() - ahora.getTime();
    restanteMinutos = restanteMs > 0 ? Math.ceil(restanteMs / 60000) : 0;
    evaluacion = transcurridoMs >= minDescansoMs ? 'CUMPLE' : 'INSUFICIENTE';
  }

  return {
    politica: politicaSnapshot(politica),
    jornadaAbierta: abierta,
    ultimoCierre,
    horasDesdeCierre,
    descansoMinHoras: politica.descansoMinHoras,
    habilitadoDesde,
    restanteMinutos,
    evaluacion,
    habilitacionDisponible: habilitacion ? { id: habilitacion.id, tipo: habilitacion.tipo } : null,
    // El bloqueo aplica solo en modo BLOQUEO; en ADVERTENCIA se informa igual.
    puedeIniciar: evaluacion === 'CUMPLE'
      || (politica.modoAplicacion === 'ADVERTENCIA' && evaluacion !== 'JORNADA_ABIERTA')
      || (evaluacion === 'SIN_HISTORIAL' && !!habilitacion)
      || (evaluacion === 'CIERRE_NO_CONFIABLE' && !!habilitacion),
  };
}

// ── Apertura de jornada ─────────────────────────────────────────────────────

export interface IniciarJornadaInput {
  tenantId: string;
  conductor: any;              // verificado por verificarConductor
  vehiculo: any;
  ahora: Date;
  clienteEventoId?: string;
  odometro?: number | null;
  notas?: string | null;
  lat?: number | null; lng?: number | null;
  origen?: string | null; destino?: string | null; carga?: string | null;
  flotaServicioId?: string | null; // servicio comercial que toma la unidad
  reportadoPorTelefono?: string | null;
}

type InicioResult =
  | { result: 'OK'; jornada: any; registro: any; descansoPrevioHoras: number | null; evaluacion: string; yaExistia?: boolean }
  | { result: 'RECHAZADO'; motivo: string; registro: any; estado: any };

export async function iniciarJornada(prisma: any, input: IniciarJornadaInput): Promise<InicioResult> {
  const { tenantId, conductor, vehiculo, ahora } = input;

  // Idempotencia: si el cliente reintenta con la misma clave, devolver el
  // registro existente en vez de duplicar la jornada.
  if (input.clienteEventoId) {
    const dup = await prisma.servicioRegistro.findFirst({
      where: { tenantId, clienteEventoId: input.clienteEventoId },
    });
    if (dup) {
      const j = dup.jornadaId ? await prisma.flotaJornada.findUnique({ where: { id: dup.jornadaId } }) : null;
      return { result: 'OK', jornada: j, registro: dup, descansoPrevioHoras: j?.descansoPrevioHoras ?? null, evaluacion: j?.evaluacionDescanso ?? 'YA_REGISTRADO', yaExistia: true };
    }
  }

  const politica = await getPoliticaJornada(prisma, tenantId);
  const snap = politicaSnapshot(politica);

  // Decisión dentro de transacción — la misma lógica que informa
  // estadoServicioChofer, re-evaluada al confirmar.
  const rechazo = await prisma.$transaction(async (tx: any) => {
    const abierta = await tx.flotaJornada.findFirst({
      where: { tenantId, conductorId: conductor.id, estado: 'ABIERTA' },
    });
    if (abierta) return { motivo: 'JORNADA_ABIERTA', detalleId: abierta.id };

    const ultimaCerrada = await tx.flotaJornada.findFirst({
      where: { tenantId, conductorId: conductor.id, estado: 'CERRADA' },
      orderBy: { inicioAt: 'desc' },
    });
    const ultimoCierre = ultimaCerrada?.finAt ? new Date(ultimaCerrada.finAt) : null;
    const cierreNoConfiable = !!ultimaCerrada && !ultimaCerrada.finAt;

    let evaluacion: string;
    let descansoMs: number | null = null;
    let habilitacion: any = null;

    if (cierreNoConfiable) {
      evaluacion = 'CIERRE_NO_CONFIABLE';
    } else if (!ultimoCierre) {
      evaluacion = 'SIN_HISTORIAL';
    } else {
      descansoMs = ahora.getTime() - ultimoCierre.getTime(); // exacto, sin redondear
      evaluacion = descansoMs >= politica.descansoMinHoras * HORA_MS ? 'CUMPLE' : 'INSUFICIENTE';
    }

    // En BLOQUEO, los estados sin evidencia de descanso requieren habilitación
    // autorizada previa (circuito explícito, no bypass genérico).
    if ((evaluacion === 'SIN_HISTORIAL' || evaluacion === 'CIERRE_NO_CONFIABLE')) {
      habilitacion = await tx.flotaHabilitacionDescanso.findFirst({
        where: { tenantId, conductorId: conductor.id, usadaEnJornadaId: null },
        orderBy: { createdAt: 'asc' },
      });
      if (politica.modoAplicacion === 'BLOQUEO' && !habilitacion) {
        return { motivo: evaluacion, detalleId: null };
      }
    }

    if (evaluacion === 'INSUFICIENTE' && politica.modoAplicacion === 'BLOQUEO') {
      return { motivo: 'DESCANSO_INSUFICIENTE', detalleId: ultimaCerrada.id };
    }

    // ── Crear la jornada (el índice único parcial garantiza exclusividad) ──
    // Intervalos por unidad con rol: el tractor/camión escaneado y, si hay
    // conjunto acoplado, el semi se agrega con su propio intervalo (su
    // utilización empieza cuando el servicio arranca estando acoplado).
    const rolDe = (v: any) => (v.tipo === 'SEMI' ? 'SEMI' : 'TRACTOR');
    const unidadesIni: any[] = [{
      vehiculoId: vehiculo.id, dominio: vehiculo.dominio, rol: rolDe(vehiculo),
      desde: ahora.toISOString(), hasta: null,
    }];
    const conjunto = await tx.conjuntoOperativo.findFirst({
      where: { tenantId, estado: 'ACOPLADO', OR: [{ tractorId: vehiculo.id }, { semiId: vehiculo.id }] },
    });
    if (conjunto) {
      const compId = conjunto.tractorId === vehiculo.id ? conjunto.semiId : conjunto.tractorId;
      const comp = await tx.vehiculo.findFirst({ where: { id: compId }, select: { id: true, dominio: true, tipo: true } });
      if (comp && !unidadesIni.some((u: any) => u.vehiculoId === comp.id)) {
        unidadesIni.push({ vehiculoId: comp.id, dominio: comp.dominio, rol: rolDe(comp), desde: ahora.toISOString(), hasta: null });
      }
    }

    let jornada: any;
    try {
      jornada = await tx.flotaJornada.create({
        data: {
          tenantId,
          conductorId: conductor.id,
          estado: 'ABIERTA',
          inicioAt: ahora,
          unidades: unidadesIni,
          origen: input.origen || null,
          destino: input.destino || null,
          carga: input.carga || null,
          descansoPrevioHoras: descansoMs == null ? null : Math.round((descansoMs / HORA_MS) * 10) / 10,
          evaluacionDescanso: evaluacion,
          evaluacionDescansoOriginal: evaluacion,
          descansoPrevioHorasOriginal: descansoMs == null ? null : Math.round((descansoMs / HORA_MS) * 10) / 10,
          politicaVersion: politica.version,
          politicaSnapshot: snap,
          habilitacionInicialId: habilitacion?.id ?? null,
        },
      });
    } catch (e: any) {
      // Violación del índice único parcial (condición de carrera)
      if (e?.code === 'P2002' || String(e?.message || '').includes('flota_jornadas_abierta_unq')) {
        return { motivo: 'JORNADA_ABIERTA', detalleId: null };
      }
      throw e;
    }

    if (habilitacion) {
      await tx.flotaHabilitacionDescanso.update({
        where: { id: habilitacion.id },
        data: { usadaEnJornadaId: jornada.id, usadaAt: ahora },
      });
    }

    const registro = await tx.servicioRegistro.create({
      data: {
        tenantId, vehiculoId: vehiculo.id, jornadaId: jornada.id,
        tipo: 'INICIO_SERVICIO',
        odometro: input.odometro ?? null,
        notas: input.notas || null,
        lat: input.lat ?? null, lng: input.lng ?? null,
        clienteEventoId: input.clienteEventoId ?? null,
        eventoAt: ahora,
        horasDescanso: jornada.descansoPrevioHoras,
        descansoInsuficiente: evaluacion === 'INSUFICIENTE',
        origen: input.origen || null, destino: input.destino || null, carga: input.carga || null,
        flotaServicioId: input.flotaServicioId || null,
        conductorId: conductor.id,
        reportadoPorNombre: conductor.nombre,
        reportadoPorTelefono: input.reportadoPorTelefono || null,
      },
    });
    return { jornada, registro, evaluacion };
  });

  // Rechazos: registrar el intento por separado, con motivo y regla aplicada.
  // No se crea jornada activa.
  if ('motivo' in rechazo) {
    const estado = await estadoServicioChofer(prisma, tenantId, conductor.id);
    const registro = await prisma.servicioRegistro.create({
      data: {
        tenantId, vehiculoId: vehiculo.id,
        tipo: 'INICIO_RECHAZADO',
        motivoRechazo: rechazo.motivo,
        reglaAplicada: snap,
        clienteEventoId: input.clienteEventoId ? `${input.clienteEventoId}-r` : null,
        eventoAt: ahora,
        lat: input.lat ?? null, lng: input.lng ?? null,
        conductorId: conductor.id,
        reportadoPorNombre: conductor.nombre,
        reportadoPorTelefono: input.reportadoPorTelefono || null,
      },
    });
    return { result: 'RECHAZADO', motivo: rechazo.motivo, registro, estado };
  }

  return {
    result: 'OK',
    jornada: rechazo.jornada,
    registro: rechazo.registro,
    descansoPrevioHoras: rechazo.jornada.descansoPrevioHoras,
    evaluacion: rechazo.evaluacion,
  };
}

// ── Cambio de unidad dentro de la jornada abierta ───────────────────────────
// No reinicia la jornada ni simula descanso: agrega la unidad a la lista.

export async function registrarCambioUnidad(prisma: any, args: {
  tenantId: string; conductor: any; vehiculo: any; ahora: Date;
  clienteEventoId?: string; odometro?: number | null; notas?: string | null;
}) {
  const { tenantId, conductor, vehiculo, ahora } = args;
  return prisma.$transaction(async (tx: any) => {
    const abierta = await tx.flotaJornada.findFirst({
      where: { tenantId, conductorId: conductor.id, estado: 'ABIERTA' },
    });
    if (!abierta) return { ok: false, code: 'SIN_JORNADA' };

    const unidades: any[] = Array.isArray(abierta.unidades) ? abierta.unidades : [];
    if (!unidades.some((u: any) => u.vehiculoId === vehiculo.id && !u.hasta)) {
      // Cerrar el intervalo del tractor/camión anterior: cada unidad recibe
      // solo su tramo. Los intervalos de semis se gestionan por acople/
      // desacople del conjunto, no por el cambio de tracción.
      for (const u of unidades) {
        if (!u.hasta && u.rol !== 'SEMI') u.hasta = ahora.toISOString();
      }
      unidades.push({
        vehiculoId: vehiculo.id, dominio: vehiculo.dominio,
        rol: vehiculo.tipo === 'SEMI' ? 'SEMI' : 'TRACTOR',
        desde: ahora.toISOString(), hasta: null,
      });
      await tx.flotaJornada.update({ where: { id: abierta.id }, data: { unidades } });
    }
    const registro = await tx.servicioRegistro.create({
      data: {
        tenantId, vehiculoId: vehiculo.id, jornadaId: abierta.id,
        tipo: 'CAMBIO_UNIDAD',
        odometro: args.odometro ?? null, notas: args.notas || null,
        clienteEventoId: args.clienteEventoId ?? null,
        eventoAt: ahora,
        conductorId: conductor.id,
        reportadoPorNombre: conductor.nombre,
      },
    });
    return { ok: true, jornada: abierta, registro };
  });
}

// ── Cambio de servicio comercial dentro de la jornada abierta ────────────────
// El chofer puede cubrir varios servicios en la misma jornada (Toyota a la
// mañana, otra cosa a la tarde). No toca la jornada: solo marca el tramo con
// un registro CAMBIO_SERVICIO; flotaServicioId null = queda sin servicio.

export async function registrarCambioServicio(prisma: any, args: {
  tenantId: string; conductor: any; vehiculo: any; ahora: Date;
  flotaServicioId: string | null;
  clienteEventoId?: string; odometro?: number | null; notas?: string | null;
}) {
  const { tenantId, conductor, vehiculo, ahora } = args;
  return prisma.$transaction(async (tx: any) => {
    const abierta = await tx.flotaJornada.findFirst({
      where: { tenantId, conductorId: conductor.id, estado: 'ABIERTA' },
    });
    if (!abierta) return { ok: false, code: 'SIN_JORNADA' };
    const registro = await tx.servicioRegistro.create({
      data: {
        tenantId, vehiculoId: vehiculo.id, jornadaId: abierta.id,
        tipo: 'CAMBIO_SERVICIO',
        flotaServicioId: args.flotaServicioId || null,
        odometro: args.odometro ?? null, notas: args.notas || null,
        clienteEventoId: args.clienteEventoId ?? null,
        eventoAt: ahora,
        conductorId: conductor.id,
        reportadoPorNombre: conductor.nombre,
      },
    });
    return { ok: true, jornada: abierta, registro };
  });
}

// ── Cierre de jornada ───────────────────────────────────────────────────────

export async function cerrarJornada(prisma: any, args: {
  tenantId: string; conductor: any; vehiculo: any; ahora: Date;
  clienteEventoId?: string; odometro?: number | null; notas?: string | null;
  lat?: number | null; lng?: number | null; reportadoPorTelefono?: string | null;
}): Promise<
  | { result: 'OK'; jornada: any; registro: any; horasTrabajadas: number; jornadaExcesiva: boolean }
  | { result: 'ERROR'; code: 'SIN_JORNADA' }
> {
  const { tenantId, conductor, vehiculo, ahora } = args;

  if (args.clienteEventoId) {
    const dup = await prisma.servicioRegistro.findFirst({
      where: { tenantId, clienteEventoId: args.clienteEventoId },
    });
    if (dup?.jornadaId) {
      const j = await prisma.flotaJornada.findUnique({ where: { id: dup.jornadaId } });
      if (j) return { result: 'OK', jornada: j, registro: dup, horasTrabajadas: j.horasTrabajadas ?? 0, jornadaExcesiva: !!j.jornadaExcesiva };
    }
    if (dup) return { result: 'ERROR', code: 'SIN_JORNADA' };
  }

  return prisma.$transaction(async (tx: any) => {
    // Cierra SOLO la jornada abierta del propio conductor — nunca la de otro.
    const abierta = await tx.flotaJornada.findFirst({
      where: { tenantId, conductorId: conductor.id, estado: 'ABIERTA' },
      orderBy: { inicioAt: 'desc' },
    });
    if (!abierta) return { result: 'ERROR' as const, code: 'SIN_JORNADA' as const };

    // Límite de alerta según la política vigente AL ABRIR la jornada
    const limiteHoras = abierta.politicaSnapshot?.jornadaAlertaHoras
      ?? (await getPoliticaJornada(prisma, tenantId)).jornadaAlertaHoras;

    const horasMs = ahora.getTime() - new Date(abierta.inicioAt).getTime();
    const horasTrabajadas = Math.round((horasMs / HORA_MS) * 10) / 10;
    const jornadaExcesiva = horasMs > limiteHoras * HORA_MS; // preciso, sin redondeo previo

    // El vehículo de cierre se agrega a las unidades de la jornada si es otra
    const unidades: any[] = Array.isArray(abierta.unidades) ? abierta.unidades : [];
    if (!unidades.some((u: any) => u.vehiculoId === vehiculo.id)) {
      unidades.push({ vehiculoId: vehiculo.id, dominio: vehiculo.dominio, rol: vehiculo.tipo === 'SEMI' ? 'SEMI' : 'TRACTOR', desde: null, hasta: ahora.toISOString() });
    }
    // Cerrar todos los intervalos abiertos (tractor + semis): el servicio
    // terminó para el conjunto completo en este instante.
    for (const u of unidades) {
      if (!u.hasta) u.hasta = ahora.toISOString();
    }

    const jornada = await tx.flotaJornada.update({
      where: { id: abierta.id },
      data: {
        estado: 'CERRADA', finAt: ahora, horasTrabajadas, jornadaExcesiva,
        cierreTipo: 'NORMAL', unidades,
      },
    });

    const registro = await tx.servicioRegistro.create({
      data: {
        tenantId, vehiculoId: vehiculo.id, jornadaId: jornada.id,
        tipo: 'FIN_SERVICIO',
        odometro: args.odometro ?? null, notas: args.notas || null,
        lat: args.lat ?? null, lng: args.lng ?? null,
        clienteEventoId: args.clienteEventoId ?? null,
        eventoAt: ahora,
        horasTrabajadas, jornadaExcesiva,
        conductorId: conductor.id,
        reportadoPorNombre: conductor.nombre,
        reportadoPorTelefono: args.reportadoPorTelefono || null,
      },
    });
    return { result: 'OK' as const, jornada, registro, horasTrabajadas, jornadaExcesiva };
  });
}

// ── Corrección autorizada de horarios (no destructiva) ──────────────────────

export async function corregirJornada(prisma: any, args: {
  tenantId: string; jornadaId: string; userId: string;
  inicioAt?: Date; finAt?: Date | null;
  motivo: string; evidencia?: string;
}): Promise<{ ok: true; jornada: any } | { ok: false; code: number; error: string }> {
  const { tenantId, jornadaId, userId, motivo, evidencia } = args;

  if (args.inicioAt === undefined && args.finAt === undefined) {
    return { ok: false, code: 400, error: 'Indicá al menos un horario a corregir.' };
  }

  const jornada = await prisma.flotaJornada.findFirst({ where: { id: jornadaId, tenantId } });
  if (!jornada) return { ok: false, code: 404, error: 'Jornada no encontrada' };

  const nuevoInicio = args.inicioAt ?? new Date(jornada.inicioAt);
  const nuevoFin = args.finAt !== undefined ? args.finAt : (jornada.finAt ? new Date(jornada.finAt) : null);

  // Validación de cronología
  if (nuevoFin && nuevoInicio >= nuevoFin) {
    return { ok: false, code: 400, error: 'El inicio debe ser anterior al cierre.' };
  }
  if (nuevoFin && nuevoFin.getTime() > Date.now() + 5 * 60000) {
    return { ok: false, code: 400, error: 'El cierre no puede estar en el futuro.' };
  }
  if (nuevoInicio.getTime() > Date.now() + 5 * 60000) {
    return { ok: false, code: 400, error: 'El inicio no puede estar en el futuro.' };
  }

  // Solapamiento con otras jornadas del mismo conductor
  const otras = await prisma.flotaJornada.findMany({
    where: {
      tenantId, conductorId: jornada.conductorId, id: { not: jornadaId },
      finAt: { not: null },
    },
    select: { id: true, inicioAt: true, finAt: true },
  });
  const finEfectivo = nuevoFin ?? new Date(); // abierta: solapa si otra empezó después del inicio
  for (const o of otras) {
    const oI = new Date(o.inicioAt).getTime(), oF = new Date(o.finAt).getTime();
    if (nuevoInicio.getTime() < oF && finEfectivo.getTime() > oI) {
      return { ok: false, code: 409, error: `El rango corregido se solapa con otra jornada (${new Date(o.inicioAt).toLocaleString('es-AR')} → ${new Date(o.finAt).toLocaleString('es-AR')}).` };
    }
  }

  const limiteHoras = jornada.politicaSnapshot?.jornadaAlertaHoras
    ?? (await getPoliticaJornada(prisma, tenantId)).jornadaAlertaHoras;

  const result = await prisma.$transaction(async (tx: any) => {
    // Correcciones trazables (una fila por campo)
    if (args.inicioAt !== undefined && nuevoInicio.getTime() !== new Date(jornada.inicioAt).getTime()) {
      await tx.flotaJornadaCorreccion.create({
        data: { tenantId, jornadaId, campo: 'inicioAt', valorAnterior: jornada.inicioAt?.toISOString?.() ?? null, valorNuevo: nuevoInicio.toISOString(), motivo, evidencia: evidencia || null, corregidoPorId: userId },
      });
    }
    if (args.finAt !== undefined) {
      const prev = jornada.finAt ? new Date(jornada.finAt).toISOString() : null;
      const next = nuevoFin ? nuevoFin.toISOString() : null;
      if (prev !== next) {
        await tx.flotaJornadaCorreccion.create({
          data: { tenantId, jornadaId, campo: jornada.estado === 'ABIERTA' ? 'cierre_regularizacion' : 'finAt', valorAnterior: prev, valorNuevo: next, motivo, evidencia: evidencia || null, corregidoPorId: userId },
        });
      }
    }

    const horasTrabajadas = nuevoFin
      ? Math.round(((nuevoFin.getTime() - nuevoInicio.getTime()) / HORA_MS) * 10) / 10
      : null;
    const jornadaExcesiva = nuevoFin != null && (nuevoFin.getTime() - nuevoInicio.getTime()) > limiteHoras * HORA_MS;

    const actualizada = await tx.flotaJornada.update({
      where: { id: jornadaId },
      data: {
        inicioAt: nuevoInicio,
        finAt: nuevoFin,
        estado: nuevoFin ? 'CERRADA' : jornada.estado,
        horasTrabajadas, jornadaExcesiva,
        cierreTipo: jornada.estado === 'ABIERTA' && nuevoFin ? 'REGULARIZADO' : jornada.cierreTipo,
        cierreMotivo: jornada.estado === 'ABIERTA' && nuevoFin ? motivo : jornada.cierreMotivo,
        cerradaPorUserId: jornada.estado === 'ABIERTA' && nuevoFin ? userId : jornada.cerradaPorUserId,
      },
    });
    return actualizada;
  });

  // Recalcular el descanso de la jornada SIGUIENTE del mismo conductor
  // (la corrección de un cierre cambia el intervalo previo de la próxima).
  if (result.finAt) {
    const siguiente = await prisma.flotaJornada.findFirst({
      where: {
        tenantId, conductorId: jornada.conductorId,
        inicioAt: { gt: result.inicioAt }, id: { not: jornadaId },
      },
      orderBy: { inicioAt: 'asc' },
    });
    if (siguiente) {
      const previaCerrada = await prisma.flotaJornada.findFirst({
        where: { tenantId, conductorId: jornada.conductorId, estado: 'CERRADA', finAt: { not: null }, inicioAt: { lt: siguiente.inicioAt } },
        orderBy: { finAt: 'desc' },
      });
      const politica = await getPoliticaJornada(prisma, tenantId);
      const snapSig = (siguiente.politicaSnapshot as any) ?? politica;
      const minMs = (snapSig.descansoMinHoras ?? politica.descansoMinHoras) * HORA_MS;
      const descansoMs = previaCerrada?.finAt
        ? new Date(siguiente.inicioAt).getTime() - new Date(previaCerrada.finAt).getTime()
        : null;
      const evaluacion = descansoMs == null ? 'SIN_HISTORIAL' : descansoMs >= minMs ? 'CUMPLE' : 'INSUFICIENTE';
      await prisma.flotaJornada.update({
        where: { id: siguiente.id },
        data: {
          // La evaluación recalculada va a los campos vigentes; los originales
          // (evaluacionDescansoOriginal) quedan intactos como evidencia.
          descansoPrevioHoras: descansoMs == null ? null : Math.round((descansoMs / HORA_MS) * 10) / 10,
          evaluacionDescanso: evaluacion,
        },
      });
    }
  }

  return { ok: true, jornada: result };
}

// ── Vincular descanso declarado (control pre-servicio) con la jornada ───────
// No sustituye el cálculo: sólo lo contrasta y marca discrepancias.

export async function vincularControlConJornada(prisma: any, tenantId: string, conductorId: string, horasDeclaradas: number | null) {
  if (horasDeclaradas == null) return;
  // Control registrado dentro de las 2h previas a la apertura de la jornada
  const jornada = await prisma.flotaJornada.findFirst({
    where: { tenantId, conductorId, estado: 'ABIERTA' },
  });
  if (!jornada) return;
  const calculado = jornada.descansoPrevioHoras;
  const discrepancia = calculado != null && Math.abs(calculado - horasDeclaradas) > 0.5;
  await prisma.flotaJornada.update({
    where: { id: jornada.id },
    data: { descansoDeclaradoHoras: horasDeclaradas, discrepanciaDeclaradoCalc: discrepancia },
  });
}

// ── Avisos de duración durante la jornada ───────────────────────────────────
// Se programa desde el estado/avisos periódico. Uno por tipo por jornada
// (@@unique). El fallo de envío no altera la habilitación.

export async function procesarAvisosJornada(prisma: any, tenantId: string) {
  const ahora = new Date();
  const abiertas = await prisma.flotaJornada.findMany({
    where: { tenantId, estado: 'ABIERTA' },
    include: { conductor: { select: { nombre: true } } },
  });

  for (const j of abiertas) {
    const snap: any = j.politicaSnapshot ?? await getPoliticaJornada(prisma, tenantId);
    const limiteMs = (snap.jornadaAlertaHoras ?? 12) * HORA_MS;
    const anticipoMs = (snap.avisoAnticipacionHoras ?? 1) * HORA_MS;
    const transcurrido = ahora.getTime() - new Date(j.inicioAt).getTime();
    const unidad = Array.isArray(j.unidades) && j.unidades.length ? j.unidades[j.unidades.length - 1].dominio || '—' : '—';

    const emitir = async (tipo: 'ANTICIPADO' | 'EXCESO', vencido: boolean) => {
      if (!vencido) return;
      let aviso;
      try {
        aviso = await prisma.flotaJornadaAviso.create({
          data: {
            tenantId, jornadaId: j.id, tipo,
            horasAlAviso: Math.round((transcurrido / HORA_MS) * 10) / 10,
            programadoPara: ahora,
          },
        });
      } catch { return; } // ya existe (@@unique) → no duplicar
      const detalle = tipo === 'ANTICIPADO'
        ? `lleva <strong>${aviso.horasAlAviso}h</strong> de jornada — se acerca al límite configurado (${snap.jornadaAlertaHoras}h). Coordinar el relevo o el descanso con el responsable.`
        : `superó el límite de jornada configurado (${snap.jornadaAlertaHoras}h): lleva <strong>${aviso.horasAlAviso}h</strong>. No es una orden de detención inmediata — gestionar la situación con el responsable.`;
      try {
        await notifyFlotaAlerta(prisma, {
          tenantId, vehiculoDominio: unidad,
          titulo: tipo === 'ANTICIPADO' ? 'Jornada próxima al límite' : 'Jornada excedió el límite',
          detalle, reportadoPorNombre: j.conductor?.nombre || '—',
          link: '/flota-360/documentacion?tab=jornadas',
          entityType: 'flota_jornada', entityId: j.id,
        });
        await prisma.flotaJornadaAviso.update({ where: { id: aviso.id }, data: { enviadoAt: new Date(), estadoEntrega: 'ENVIADO' } });
      } catch (e: any) {
        await prisma.flotaJornadaAviso.update({ where: { id: aviso.id }, data: { estadoEntrega: 'FALLIDO', detalleError: String(e?.message || e) } });
      }
    };

    await emitir('ANTICIPADO', transcurrido >= limiteMs - anticipoMs && transcurrido < limiteMs);
    await emitir('EXCESO', transcurrido >= limiteMs);
  }
}
