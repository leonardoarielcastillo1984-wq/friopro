// ═══════════════════════════════════════════════════════════════
// FLOTA 360 — Circuito de defectos de inspección
//
// Separación conceptual (regla dura):
//  - REPORTE   = InspeccionHallazgo (cada detección informada, con
//                unidad, ítem, respuesta, observación, foto y autor).
//  - CASO      = DefectoCaso (el defecto abierto y su seguimiento).
//  - OT        = WorkOrder (la gestión de la reparación, una por caso).
//
// Reglas:
//  - Mismo defecto aún abierto → el reporte se vincula al caso
//    existente (primera/última detección, contador). NUNCA genera
//    otra OT por la misma falla.
//  - Reaparición tras resolución verificada → caso NUEVO vinculado
//    al anterior como POSIBLE recurrencia (sin afirmar misma causa).
//  - Matching por identificadores: vehículo + itemKey (tipoDefecto
//    configurado o label+sección) + componentKey/posición cuando
//    existan. Nunca solo por texto ni dominio.
//  - Un reporte "sin falla" posterior NO cierra un caso abierto.
//  - Reintentos: reporteKey (inspección+ítem) y submissionKey
//    (inspección) son únicos — nada se duplica.
//  - Bloqueo: la restricción de servicio se registra de inmediato,
//    aunque la creación de la OT o la asignación falle después.
// ═══════════════════════════════════════════════════════════════

const ESTADOS_ABIERTOS = ['ABIERTO', 'EN_TRATAMIENTO', 'REPARADO_INFORMADO'];

export interface ReglaRespuesta {
  generaHallazgo: boolean;
  severidad: 'LEVE' | 'MODERADO' | 'CRITICO';
  bloqueaServicio: boolean;
  instruccionChofer: string | null;
  prioridadOt: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  tipoDefecto: string | null;
  componentKey: string | null;
  posicion: string | null;
  configurada: boolean; // true si el responsable definió regla; false = legacy pendiente de revisión
}

const SEVERIDADES = ['LEVE', 'MODERADO', 'CRITICO'];
const PRIORIDADES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function normalizar(s: string | null | undefined): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Regla de criticidad aplicable a una respuesta puntual de un ítem.
 * Prioridad: override por valor (reglasRespuesta) → regla por defecto
 * del ítem → comportamiento legacy (triggerHallazgo, MODERADO,
 * "pendiente de revisión", nunca bloqueante por defecto).
 */
export function reglaParaRespuesta(item: any, resp: { valor?: any; esOk?: boolean | null }): ReglaRespuesta {
  const base: ReglaRespuesta = {
    generaHallazgo: !!item.triggerHallazgo,
    severidad: (SEVERIDADES.includes(item.severidadHallazgo) ? item.severidadHallazgo : 'MODERADO'),
    bloqueaServicio: !!item.bloqueaServicio,
    instruccionChofer: item.instruccionChofer || null,
    prioridadOt: (PRIORIDADES.includes(item.prioridadOt) ? item.prioridadOt : 'MEDIUM'),
    tipoDefecto: item.tipoDefecto || null,
    componentKey: item.componentKey || null,
    posicion: item.posicion || null,
    configurada: !!(item.severidadHallazgo || item.bloqueaServicio || item.instruccionChofer || item.prioridadOt || item.tipoDefecto),
  };

  // Overrides por respuesta concreta (ítems OPCION/ESCALA/NUMERO)
  const reglas = Array.isArray(item.reglasRespuesta) ? item.reglasRespuesta : [];
  const valorStr = resp.valor == null ? null : String(resp.valor);
  const porValor = reglas.find((r: any) => r && String(r.valor) === valorStr);
  if (porValor) {
    return {
      generaHallazgo: porValor.generaHallazgo !== undefined ? !!porValor.generaHallazgo : true,
      severidad: SEVERIDADES.includes(porValor.severidad) ? porValor.severidad : base.severidad,
      bloqueaServicio: porValor.bloqueaServicio !== undefined ? !!porValor.bloqueaServicio : base.bloqueaServicio,
      instruccionChofer: porValor.instruccionChofer ?? base.instruccionChofer,
      prioridadOt: PRIORIDADES.includes(porValor.prioridadOt) ? porValor.prioridadOt : base.prioridadOt,
      tipoDefecto: porValor.tipoDefecto ?? base.tipoDefecto,
      componentKey: porValor.componentKey ?? base.componentKey,
      posicion: porValor.posicion ?? base.posicion,
      configurada: true,
    };
  }
  return base;
}

/**
 * Firma estable del defecto para agrupar reportes en un caso:
 * tipoDefecto configurado, o label+sección normalizados.
 */
export function itemKeyDe(item: any, regla: ReglaRespuesta): string {
  if (regla.tipoDefecto) return normalizar(regla.tipoDefecto);
  return normalizar(`${item.seccion || ''}|${item.label || ''}`);
}

function eventoCaso(tx: any, casoId: string, tenantId: string, tipo: string, detalle: string | null, usuario?: { id?: string | null; nombre?: string | null }) {
  return tx.defectoCasoEvento.create({
    data: { tenantId, casoId, tipo, detalle, usuarioId: usuario?.id ?? null, usuarioNombre: usuario?.nombre ?? null },
  });
}

export interface ResultadoReporte {
  reporte: any;
  caso: any;
  casoNuevo: boolean;
  esRecurrencia: boolean;
  restriccion: any | null;
  duplicado: boolean;
}

/**
 * Registra un reporte (hallazgo) y lo vincula al caso de defecto
 * correspondiente. Idempotente por reporteKey. La restricción se
 * crea dentro de la misma transacción que el caso.
 */
export async function procesarReporteDefecto(
  tx: any,
  opts: {
    tenantId: string;
    inspeccionId: string;
    item: any;
    resp: { valor?: any; esOk?: boolean | null; observacion?: string | null; fotoUrl?: string | null };
    regla: ReglaRespuesta;
    vehiculo: { id: string; maintenanceAssetId?: string | null } | null;
    equipoDestino: string | null;
    inspectorNombre: string;
    fecha: Date;
  },
): Promise<ResultadoReporte | null> {
  const { tenantId, inspeccionId, item, resp, regla, vehiculo, equipoDestino, inspectorNombre, fecha } = opts;
  const reporteKey = `insp:${inspeccionId}:${item.id}`;

  // Idempotencia por reintento: mismo inspección+ítem → mismo reporte
  const existente = await tx.inspeccionHallazgo.findFirst({ where: { tenantId, reporteKey }, include: { caso: true } });
  if (existente) {
    return { reporte: existente, caso: existente.caso, casoNuevo: false, esRecurrencia: false, restriccion: null, duplicado: true };
  }

  const itemKey = itemKeyDe(item, regla);
  const valorStr = resp.valor == null ? (resp.esOk === false ? 'NO_CUMPLE' : String(resp.valor)) : String(resp.valor);
  const reglaSnapshot = {
    severidad: regla.severidad, bloqueaServicio: regla.bloqueaServicio,
    prioridadOt: regla.prioridadOt, tipoDefecto: regla.tipoDefecto,
    componentKey: regla.componentKey, posicion: regla.posicion,
    configurada: regla.configurada,
  };

  // ── Caso abierto del mismo defecto en la misma unidad ──
  let caso: any = null;
  let esRecurrencia = false;
  if (vehiculo) {
    caso = await tx.defectoCaso.findFirst({
      where: {
        tenantId, vehiculoId: vehiculo.id, itemKey,
        estado: { in: ESTADOS_ABIERTOS },
        // Identificadores estructurados cuando existen
        componentKey: regla.componentKey ?? undefined,
        posicion: regla.posicion ?? undefined,
      },
      orderBy: { primerReporteAt: 'desc' },
    });

    if (!caso) {
      // ¿Reaparición tras resolución verificada? → caso nuevo vinculado
      const casoPrevio = await tx.defectoCaso.findFirst({
        where: {
          tenantId, vehiculoId: vehiculo.id, itemKey,
          estado: { in: ['VERIFICADO', 'RESUELTO'] },
          componentKey: regla.componentKey ?? undefined,
          posicion: regla.posicion ?? undefined,
        },
        orderBy: { resueltoAt: 'desc' },
      });
      esRecurrencia = !!casoPrevio;
      caso = await tx.defectoCaso.create({
        data: {
          tenantId, vehiculoId: vehiculo.id,
          maintenanceAssetId: vehiculo.maintenanceAssetId ?? null,
          itemKey, itemLabel: item.label, itemId: item.id,
          seccion: item.seccion ?? null, equipoDestino,
          componentKey: regla.componentKey, posicion: regla.posicion,
          severidad: regla.severidad, bloqueante: regla.bloqueaServicio,
          estado: 'ABIERTO',
          primerReporteAt: fecha, ultimoReporteAt: fecha, reportesCount: 1,
          casoPrevioId: casoPrevio?.id ?? null,
        },
      });
      await eventoCaso(tx, caso.id, tenantId, 'CREADO',
        `Caso abierto por reporte de ${inspectorNombre} (${item.label})` +
        (esRecurrencia ? ` — posible recurrencia del caso ${casoPrevio.id.slice(0, 8)} (resolución verificada)` : ''),
        { nombre: inspectorNombre });
    } else {
      // Mismo defecto aún abierto: vincular, actualizar seguimiento
      const data: any = {
        ultimoReporteAt: fecha,
        reportesCount: { increment: 1 },
      };
      // Una regla bloqueante nueva eleva el caso a bloqueante
      if (regla.bloqueaServicio && !caso.bloqueante) data.bloqueante = true;
      // Si la severidad del defecto sube, se registra (nunca baja sola)
      if (SEVERIDADES.indexOf(regla.severidad) > SEVERIDADES.indexOf(caso.severidad)) data.severidad = regla.severidad;
      caso = await tx.defectoCaso.update({ where: { id: caso.id }, data });
      await eventoCaso(tx, caso.id, tenantId, 'REPORTE',
        `Nuevo reporte del mismo defecto (${inspectorNombre}) — reporte #${caso.reportesCount}`,
        { nombre: inspectorNombre });
    }
  }

  // ── Reporte (hallazgo) — siempre conservado ──
  const reporte = await tx.inspeccionHallazgo.create({
    data: {
      tenantId, inspeccionId,
      descripcion: resp.observacion || `${item.label}: No cumple`,
      tipo: 'OPERATIVO',
      severidad: regla.severidad,
      estado: 'ABIERTO',
      itemLabel: item.label, equipoDestino,
      fotoUrl: resp.fotoUrl ?? null,
      itemId: item.id, valorRespuesta: valorStr,
      reglaSnapshot, reporteKey,
      bloqueante: regla.bloqueaServicio,
      prioridadOt: regla.prioridadOt,
      instruccionChofer: regla.instruccionChofer,
      vehiculoId: vehiculo?.id ?? null,
      maintenanceAssetId: vehiculo?.maintenanceAssetId ?? null,
      casoId: caso?.id ?? null,
    },
  });

  // ── Restricción de servicio inmediata (aunque la OT falle después) ──
  let restriccion: any = null;
  if (regla.bloqueaServicio && vehiculo && caso) {
    // Idempotente: una restricción activa por caso
    restriccion = await tx.restriccionServicio.findFirst({
      where: { tenantId, casoId: caso.id, activa: true },
    });
    if (!restriccion) {
      restriccion = await tx.restriccionServicio.create({
        data: {
          tenantId, vehiculoId: vehiculo.id, casoId: caso.id, hallazgoId: reporte.id,
          motivo: `${item.label}: ${resp.observacion || 'condición informada en checklist'}`,
          origen: 'CHECKLIST', createdByName: inspectorNombre,
        },
      });
      await eventoCaso(tx, caso.id, tenantId, 'REPORTE',
        `Restricción de servicio registrada — ${restriccion.motivo}`, { nombre: inspectorNombre });
    }
  }

  return { reporte, caso, casoNuevo: caso?.reportesCount === 1, esRecurrencia, restriccion, duplicado: false };
}

/** Restricciones activas de una unidad. */
export async function restriccionesActivasDe(tx: any, tenantId: string, vehiculoId: string) {
  return tx.restriccionServicio.findMany({
    where: { tenantId, vehiculoId, activa: true },
    include: { caso: { select: { id: true, itemLabel: true, severidad: true, estado: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Restricciones que aplican al conjunto operativo vigente: las de la
 * unidad + las del compañero acoplado (tractor↔semi). Bloquear el semi
 * correcto refleja la restricción en el conjunto.
 */
export async function restriccionesDelConjunto(tx: any, tenantId: string, vehiculoId: string) {
  const conjunto = await tx.conjuntoOperativo.findFirst({
    where: { tenantId, estado: 'ACOPLADO', OR: [{ tractorId: vehiculoId }, { semiId: vehiculoId }] },
  });
  const unidadIds = [vehiculoId];
  if (conjunto) unidadIds.push(conjunto.tractorId === vehiculoId ? conjunto.semiId : conjunto.tractorId);
  const restricciones = await tx.restriccionServicio.findMany({
    where: { tenantId, activa: true, vehiculoId: { in: unidadIds } },
    include: { caso: { select: { id: true, itemLabel: true } }, vehiculo: { select: { id: true, dominio: true, tipo: true } } },
  });
  return { conjunto, unidadIds, restricciones };
}

/**
 * OT completada → el caso queda REPARADO_INFORMADO (no RESUELTO):
 * la verificación y la habilitación son pasos separados.
 */
export async function marcarReparacionInformadaPorOT(
  tx: any, tenantId: string, workOrderId: string, porNombre?: string | null,
) {
  const casos = await tx.defectoCaso.findMany({
    where: { tenantId, workOrderId, estado: { in: ESTADOS_ABIERTOS } },
  });
  for (const caso of casos) {
    await tx.defectoCaso.update({
      where: { id: caso.id },
      data: { estado: 'REPARADO_INFORMADO', reparacionInformadaAt: new Date(), reparacionInformadaPor: porNombre ?? null },
    });
    await eventoCaso(tx, caso.id, tenantId, 'REPARACION_INFORMADA',
      `OT ${workOrderId.slice(0, 8)} marcada como completada${porNombre ? ` por ${porNombre}` : ''} — pendiente de verificación`,
      { nombre: porNombre });
    // Los reportes del caso siguen ABIERTOS hasta la verificación
  }
  return casos.map((c: any) => c.id);
}

/**
 * Verificación del defecto (paso separado de la reparación):
 *  - OK → VERIFICADO. Si el caso no era bloqueante, queda RESUELTO.
 *         Si era bloqueante, sigue restringido hasta la habilitación.
 *  - FALLA_PERSISTE → vuelve a ABIERTO (nunca cierra por sí solo).
 */
export async function verificarCaso(
  tx: any,
  opts: { tenantId: string; casoId: string; resultado: 'OK' | 'FALLA_PERSISTE'; notas?: string | null; usuario: { id?: string | null; nombre?: string | null } },
) {
  const { tenantId, casoId, resultado, notas, usuario } = opts;
  const caso = await tx.defectoCaso.findFirst({ where: { id: casoId, tenantId } });
  if (!caso) return { error: 'Caso no encontrado', code: 404 };
  if (!['REPARADO_INFORMADO', 'EN_TRATAMIENTO', 'ABIERTO'].includes(caso.estado)) {
    return { error: `El caso está en estado ${caso.estado}; no admite verificación`, code: 409 };
  }

  const ahora = new Date();
  if (resultado === 'FALLA_PERSISTE') {
    const upd = await tx.defectoCaso.update({
      where: { id: casoId },
      data: {
        estado: 'ABIERTO', verificadoAt: ahora, verificadoPorId: usuario.id ?? null,
        verificadoPorNombre: usuario.nombre ?? null, verificacionResultado: 'FALLA_PERSISTE',
        verificacionNotas: notas ?? null,
      },
    });
    await eventoCaso(tx, casoId, tenantId, 'VERIFICACION_FALLIDA', `Verificación: la falla persiste. ${notas || ''}`, usuario);
    return { caso: upd };
  }

  const resuelto = !caso.bloqueante; // no bloqueante: verificar = resolver
  const upd = await tx.defectoCaso.update({
    where: { id: casoId },
    data: {
      estado: resuelto ? 'RESUELTO' : 'VERIFICADO',
      verificadoAt: ahora, verificadoPorId: usuario.id ?? null, verificadoPorNombre: usuario.nombre ?? null,
      verificacionResultado: 'OK', verificacionNotas: notas ?? null,
      resueltoAt: resuelto ? ahora : null,
    },
  });
  await tx.inspeccionHallazgo.updateMany({
    where: { tenantId, casoId },
    data: { estado: resuelto ? 'RESUELTO' : 'EN_PROCESO', resolvedAt: resuelto ? ahora : null },
  });
  await eventoCaso(tx, casoId, tenantId, 'VERIFICADO',
    `Resolución verificada${caso.bloqueante ? ' — la unidad sigue restringida hasta la habilitación' : ''}. ${notas || ''}`, usuario);
  return { caso: upd };
}

/**
 * Habilitación de la unidad (paso separado, con permiso):
 *  - Requiere el caso VERIFICADO si era bloqueante.
 *  - Levanta SOLO la restricción de este caso; el vehículo sigue
 *    restringido si tiene otras activas (se informa cuáles).
 *  - Devuelve `libre` = quedó sin restricciones activas.
 */
export async function habilitarPorCaso(
  tx: any,
  opts: { tenantId: string; casoId: string; motivo?: string | null; usuario: { id?: string | null; nombre?: string | null } },
) {
  const { tenantId, casoId, motivo, usuario } = opts;
  const caso = await tx.defectoCaso.findFirst({ where: { id: casoId, tenantId } });
  if (!caso) return { error: 'Caso no encontrado', code: 404 };
  if (caso.bloqueante && caso.estado !== 'VERIFICADO') {
    return { error: `El defecto bloqueante requiere verificación previa (estado actual: ${caso.estado})`, code: 409 };
  }
  if (!caso.bloqueante && caso.estado !== 'RESUELTO' && caso.estado !== 'VERIFICADO') {
    return { error: `El caso no está resuelto ni verificado (estado: ${caso.estado})`, code: 409 };
  }

  const ahora = new Date();
  // Levantar la(s) restricción(es) de ESTE caso solamente
  await tx.restriccionServicio.updateMany({
    where: { tenantId, casoId, activa: true },
    data: { activa: false, levantadaAt: ahora, levantadaPorId: usuario.id ?? null, levantadaPorNombre: usuario.nombre ?? null, levantadaMotivo: motivo ?? null },
  });
  const upd = await tx.defectoCaso.update({
    where: { id: casoId },
    data: { estado: 'RESUELTO', habilitadoAt: ahora, habilitadoPorId: usuario.id ?? null, habilitadoPorNombre: usuario.nombre ?? null, resueltoAt: caso.resueltoAt ?? ahora },
  });
  await tx.inspeccionHallazgo.updateMany({ where: { tenantId, casoId }, data: { estado: 'RESUELTO', resolvedAt: caso.resueltoAt ?? ahora } });
  await eventoCaso(tx, casoId, tenantId, 'HABILITADO', `Habilitación autorizada por ${usuario.nombre ?? 'usuario'}${motivo ? ` — ${motivo}` : ''}`, usuario);

  const restantes = await restriccionesActivasDe(tx, tenantId, caso.vehiculoId);
  return { caso: upd, libre: restantes.length === 0, restriccionesRestantes: restantes };
}

/**
 * Reasociación manual trazable de un reporte a otro caso
 * (corrección de asociación errónea; nada se borra ni se fusiona).
 */
export async function reasignarReporte(
  tx: any,
  opts: { tenantId: string; hallazgoId: string; casoDestinoId: string; motivo: string; usuario: { id?: string | null; nombre?: string | null } },
) {
  const { tenantId, hallazgoId, casoDestinoId, motivo, usuario } = opts;
  const hallazgo = await tx.inspeccionHallazgo.findFirst({ where: { id: hallazgoId, tenantId } });
  if (!hallazgo) return { error: 'Reporte no encontrado', code: 404 };
  const destino = await tx.defectoCaso.findFirst({ where: { id: casoDestinoId, tenantId } });
  if (!destino) return { error: 'Caso destino no encontrado', code: 404 };
  const origen = hallazgo.casoId ? await tx.defectoCaso.findFirst({ where: { id: hallazgo.casoId, tenantId } }) : null;

  await tx.inspeccionHallazgo.update({
    where: { id: hallazgoId },
    data: { casoId: casoDestinoId, vehiculoId: destino.vehiculoId, maintenanceAssetId: destino.maintenanceAssetId },
  });
  await tx.defectoCaso.update({
    where: { id: casoDestinoId },
    data: { ultimoReporteAt: new Date(), reportesCount: { increment: 1 } },
  });
  if (origen) {
    await tx.defectoCaso.update({ where: { id: origen.id }, data: { reportesCount: { decrement: 1 } } });
    await eventoCaso(tx, origen.id, tenantId, 'REASIGNADO',
      `Reporte ${hallazgoId.slice(0, 8)} reasignado al caso ${casoDestinoId.slice(0, 8)} — ${motivo}`, usuario);
  }
  await eventoCaso(tx, casoDestinoId, tenantId, 'REASIGNADO',
    `Reporte ${hallazgoId.slice(0, 8)} asociado manualmente desde ${origen ? `caso ${origen.id.slice(0, 8)}` : 'reporte sin caso'} — ${motivo}`, usuario);
  return { ok: true };
}
