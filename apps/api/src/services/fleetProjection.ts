// ═══════════════════════════════════════════════════════════════
// FLOTA 360 — Motor de proyección por vehículo y componente
//
// Tres métricas diferenciadas (nunca mezclar):
//  A) INTERVALO_MANTENIMIENTO — consumo del intervalo de una tarea
//     (puede superar 100% = vencida). No es desgaste físico.
//  B) VIDA_SERVICIO_REF — recorrido del componente respecto de un
//     rango orientativo con fuente declarada. Dispara revisión, no
//     rotura ni reemplazo obligatorio.
//  C) CONDICION_MEDIDA — medición real con fecha y unidad. Única
//     evidencia de condición observada; la extrapolación declara
//     su modelo y límites.
//
// Reglas duras:
//  - Sin historial de instalación/ejecución no se inventa el punto
//    de partida (origen desconocido → incertidumbre visible).
//  - Sin ritmo de uso no se inventan fechas (solo distancia).
//  - Costos: subtotal conocido + conceptos sin cotización; nunca
//    mostrar $0 como estimación completa.
//  - La simulación no crea OTs, compras ni modifica el historial.
// ═══════════════════════════════════════════════════════════════

const MS_MES = 30.44 * 86400000;

// ── Componentes conocidos y su matching con texto libre de OTs/planes ──
// match se usa para encontrar la última ejecución real de la tarea.
export const COMPONENTES_DEF: {
  key: string; label: string; sistema: string; match: RegExp;
  metricaDefault: 'INTERVALO_MANTENIMIENTO' | 'VIDA_SERVICIO_REF' | 'CONDICION_MEDIDA';
}[] = [
  { key: 'aceite_motor',          label: 'Aceite de motor',                 sistema: 'MOTOR',                metricaDefault: 'INTERVALO_MANTENIMIENTO', match: /aceite(?!.*(caja|transmisi|hidr))|cambio de aceite|service/i },
  { key: 'filtro_aceite',         label: 'Filtro de aceite',                sistema: 'MOTOR',                metricaDefault: 'INTERVALO_MANTENIMIENTO', match: /filtro.*aceite|aceite.*filtro/i },
  { key: 'filtro_aire',           label: 'Filtro de aire',                  sistema: 'MOTOR',                metricaDefault: 'INTERVALO_MANTENIMIENTO', match: /filtro.*aire|aire.*filtro/i },
  { key: 'filtro_combustible',    label: 'Filtro de combustible',           sistema: 'MOTOR',                metricaDefault: 'INTERVALO_MANTENIMIENTO', match: /filtro.*combustible|combustible.*filtro/i },
  { key: 'refrigerante',          label: 'Refrigerante / anticongelante',   sistema: 'REFRIGERACION',        metricaDefault: 'INTERVALO_MANTENIMIENTO', match: /refrigerante|anticongelante|coolant/i },
  { key: 'fluido_hidraulico',     label: 'Fluido hidráulico',               sistema: 'CHASIS',               metricaDefault: 'INTERVALO_MANTENIMIENTO', match: /hidr[aá]ulic/i },
  { key: 'aceite_transmision',    label: 'Aceite de caja / transmisión',    sistema: 'TRANSMISION',          metricaDefault: 'INTERVALO_MANTENIMIENTO', match: /aceite.*(caja|transmisi)|(caja|transmisi).*aceite/i },
  { key: 'embrague',              label: 'Embrague',                        sistema: 'TRANSMISION',          metricaDefault: 'VIDA_SERVICIO_REF',       match: /embrague|clutch/i },
  { key: 'caja_cambios',          label: 'Caja de cambios (inspección)',    sistema: 'TRANSMISION',          metricaDefault: 'VIDA_SERVICIO_REF',       match: /caja|cambios|transmisi(?!.*aceite)/i },
  { key: 'cardan_crucetas',       label: 'Cardán / crucetas',               sistema: 'TRANSMISION',          metricaDefault: 'INTERVALO_MANTENIMIENTO', match: /card[aá]n|cruceta/i },
  { key: 'diferencial',           label: 'Aceite de diferencial',           sistema: 'TRANSMISION',          metricaDefault: 'INTERVALO_MANTENIMIENTO', match: /diferencial/i },
  { key: 'frenos',                label: 'Frenos (pastillas/zapatas)',      sistema: 'FRENOS',               metricaDefault: 'CONDICION_MEDIDA',        match: /freno|brake|pastilla|zapata/i },
  { key: 'mangueras',             label: 'Mangueras y flexibles',           sistema: 'CHASIS',               metricaDefault: 'INTERVALO_MANTENIMIENTO', match: /manguera|flexible/i },
  { key: 'refrigeracion_mecanica',label: 'Refrigeración mecánica (bomba/radiador/correas)', sistema: 'REFRIGERACION', metricaDefault: 'INTERVALO_MANTENIMIENTO', match: /radiador|bomba.*agua|termostato|correa|tensor/i },
  { key: 'direccion_suspension',  label: 'Dirección y suspensión',          sistema: 'DIRECCION_SUSPENSION', metricaDefault: 'CONDICION_MEDIDA',        match: /direcci[oó]n|suspensi[oó]n|amortiguador/i },
  { key: 'burro_arranque',        label: 'Burro de arranque',               sistema: 'ELECTRICO',            metricaDefault: 'VIDA_SERVICIO_REF',       match: /burro|arranque|starter/i },
  { key: 'alternador',            label: 'Alternador',                      sistema: 'ELECTRICO',            metricaDefault: 'VIDA_SERVICIO_REF',       match: /alternador/i },
  { key: 'bateria',               label: 'Batería',                         sistema: 'ELECTRICO',            metricaDefault: 'VIDA_SERVICIO_REF',       match: /bater[ií]a/i },
];

const ORIGEN_LABEL: Record<string, string> = {
  ORIGINAL_CONFIRMADO: 'original confirmado',
  REEMPLAZO_DOCUMENTADO: 'reemplazo documentado',
  ORIGEN_DESCONOCIDO: 'origen desconocido',
};
const ESTADO_REF_LABEL: Record<string, string> = {
  VERIFICADA: 'referencia verificada',
  INTERNA_APROBADA: 'referencia interna aprobada',
  PROVISIONAL: 'hipótesis configurable — pendiente de validación',
  FALTANTE: 'sin referencia validada',
};

// ── Ritmo de uso desde lecturas de odómetro con fecha ──
function estimarRitmoUso(puntos: { km: number; fecha: Date }[]): { kmMes: number; fuente: string; puntosUsados: number } | null {
  const validos = puntos.filter(p => p.km != null && p.fecha).sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  if (validos.length < 2) return null;
  const first = validos[0], last = validos[validos.length - 1];
  const dKm = last.km - first.km;
  const dMeses = (last.fecha.getTime() - first.fecha.getTime()) / MS_MES;
  if (dKm <= 0 || dMeses < 0.5) return null;
  return { kmMes: Math.round(dKm / dMeses), fuente: 'HISTORIAL_ODOMETRO', puntosUsados: validos.length };
}

// ── Última ejecución real de una tarea (OT con km o fecha, o plan) ──
function ultimaEjecucion(match: RegExp, ots: any[], planes: any[], planMatchExtra?: RegExp) {
  let mejor: { km: number | null; fecha: Date | null; origen: string; detalle: string } | null = null;
  for (const ot of ots) {
    const texto = `${ot.title || ''} ${ot.description || ''}`;
    if (!match.test(texto)) continue;
    const kmOt = ot.vehiculoHistorial?.[0]?.odometro ?? null;
    const fechaOt = ot.completedAt ? new Date(ot.completedAt) : null;
    if (!mejor || (kmOt ?? -1) > (mejor.km ?? -1) || (kmOt == null && fechaOt && (!mejor.fecha || fechaOt > mejor.fecha))) {
      mejor = { km: kmOt, fecha: fechaOt, origen: 'OT', detalle: ot.title };
    }
  }
  for (const p of planes) {
    if (p.lastOdometerExecution == null && !p.lastExecutionDate) continue;
    const texto = `${p.title || ''} ${p.name || ''}`;
    if (!match.test(texto) && !(planMatchExtra && planMatchExtra.test(texto))) continue;
    const kmP = p.lastOdometerExecution ?? null;
    const fechaP = p.lastExecutionDate ? new Date(p.lastExecutionDate) : null;
    if (!mejor || (kmP ?? -1) > (mejor.km ?? -1)) {
      mejor = { km: kmP, fecha: fechaP, origen: 'PLAN', detalle: p.title || p.name };
    }
  }
  return mejor;
}

// ── Instalación vigente de un componente en el vehículo ──
function instalacionVigente(componentKey: string, instalaciones: any[], keyToComponentId: Map<string, string>) {
  const compId = keyToComponentId.get(componentKey);
  if (!compId) return null;
  return instalaciones.find(i => i.instance?.componentId === compId && !i.removedAt) || null;
}

// ═══════════════════════════════════════════════════════════════
// MOTOR PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export async function proyectarVehiculo(prisma: any, tenantId: string, vehiculoId: string, opts: {
  kmProyectar: number;
  mesesProyectar?: number | null;
  kmMesHipotesis?: number | null;
  escenario: 'CON_MANTENIMIENTO' | 'SIN_MANTENIMIENTO';
  perfil?: string | null;
}) {
  const { kmProyectar, escenario } = opts;
  const now = new Date();

  const vehiculo = await prisma.vehiculo.findFirst({
    where: { id: vehiculoId, tenantId },
    include: {
      posicionesNeumatico: { where: { activo: true }, include: { neumatico: { include: { mediciones: { orderBy: { fecha: 'asc' } } } } } },
      vencimientos: true,
      registrosCombustible: { orderBy: { fecha: 'desc' }, take: 30 },
      historialMantenimiento: { orderBy: { fecha: 'desc' }, take: 60 },
    },
  });
  if (!vehiculo) return null;

  const km = vehiculo.currentOdometer || 0;
  const kmFinal = km + kmProyectar;
  const perfil = opts.perfil || vehiculo.perfilUso || null;

  // ── Ritmo de uso: historial de odómetro → hipótesis declarada → sin fecha ──
  const puntosOdo: { km: number; fecha: Date }[] = [];
  for (const h of vehiculo.historialMantenimiento || []) if (h.odometro && h.fecha) puntosOdo.push({ km: h.odometro, fecha: new Date(h.fecha) });
  for (const r of vehiculo.registrosCombustible || []) if (r.odometro && r.fecha) puntosOdo.push({ km: r.odometro, fecha: new Date(r.fecha) });
  let ritmo = estimarRitmoUso(puntosOdo);
  let ritmoFuente: string | null = ritmo?.fuente || null;
  let kmMes: number | null = ritmo?.kmMes ?? null;
  if (kmMes == null && opts.kmMesHipotesis) { kmMes = opts.kmMesHipotesis; ritmoFuente = 'HIPOTESIS_USUARIO'; }
  else if (kmMes == null && vehiculo.kmMesEstimado) { kmMes = vehiculo.kmMesEstimado; ritmoFuente = 'DECLARADO_VEHICULO'; }

  const mesesProyectar = opts.mesesProyectar ?? (kmMes ? kmProyectar / kmMes : null);
  const fechaEstimada = mesesProyectar != null ? new Date(now.getTime() + mesesProyectar * MS_MES) : null;
  const diasEstimados = mesesProyectar != null ? Math.round(mesesProyectar * 30.44) : null;

  // ── Datos de contexto ──
  const assetId = vehiculo.maintenanceAssetId;
  const [planes, ots, referencias, instalaciones, mediciones, componentes] = await Promise.all([
    assetId ? prisma.maintenancePlan.findMany({ where: { assetId, tenantId, status: 'ACTIVE' } }).catch(() => []) : [],
    assetId ? prisma.workOrder.findMany({
      where: { assetId, tenantId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' }, take: 100,
      select: { id: true, title: true, description: true, type: true, completedAt: true, totalCost: true, planId: true, vehiculoHistorial: { select: { odometro: true, fecha: true }, take: 1 } },
    }).catch(() => []) : [],
    prisma.fleetComponentReference.findMany({ where: { isActive: true, OR: [{ tenantId }, { tenantId: null }] } }).catch(() => []),
    prisma.fleetComponentInstallation.findMany({ where: { vehiculoId, tenantId }, include: { instance: { include: { component: true } } } }).catch(() => []),
    prisma.fleetComponentMeasurement.findMany({ where: { vehiculoId, tenantId }, orderBy: { fecha: 'asc' } }).catch(() => []),
    prisma.fleetComponent.findMany({ where: { tenantId, isActive: true } }).catch(() => []),
  ]);

  // Mapa componentKey → fleetComponent.id (para instalaciones) por nombre/sinónimos
  const keyToComponentId = new Map<string, string>();
  for (const def of COMPONENTES_DEF) {
    const comp = componentes.find((c: any) => def.match.test(c.nombre) || (c.sinonimos || []).some((s: string) => def.match.test(s)));
    if (comp) keyToComponentId.set(def.key, comp.id);
  }

  // Costo promedio por plan (OTs completadas vinculadas)
  const planIds = planes.map((p: any) => p.id);
  const otsPorPlan = planIds.length ? await prisma.workOrder.groupBy({
    by: ['planId'], where: { tenantId, planId: { in: planIds }, status: 'COMPLETED', totalCost: { not: null } },
    _avg: { totalCost: true }, _count: { _all: true },
  }).catch(() => []) : [];
  const costoPlan = Object.fromEntries(otsPorPlan.map((o: any) => [o.planId, o._avg.totalCost || 0]));

  // Referencia aplicable por componente (tenant propio > global; más específica > genérica)
  function refPara(key: string) {
    const cands = referencias.filter((r: any) => r.componentKey === key);
    if (!cands.length) return null;
    const score = (r: any) =>
      (r.tenantId === tenantId ? 100 : 0) +
      (r.marcaVehiculo && vehiculo.marca && r.marcaVehiculo.toLowerCase() === vehiculo.marca.toLowerCase() ? 10 : 0) +
      (r.modeloVehiculo && vehiculo.modelo && r.modeloVehiculo.toLowerCase() === vehiculo.modelo.toLowerCase() ? 10 : 0) +
      (r.regimenUso && perfil && r.regimenUso === perfil ? 5 : 0);
    return cands.sort((a: any, b: any) => score(b) - score(a))[0];
  }

  // ═══════════════════════════════════════════════════════════
  // Proyección por componente
  // ═══════════════════════════════════════════════════════════
  const componentesOut: any[] = [];
  const timeline: any[] = [];
  const advertencias: string[] = [];
  let conceptosSinPrecio = 0;

  for (const def of COMPONENTES_DEF) {
    const ref = refPara(def.key);
    const inst = instalacionVigente(def.key, instalaciones, keyToComponentId);
    const meds = mediciones.filter((m: any) => m.componentKey === def.key);
    const ultimaMed = meds.length ? meds[meds.length - 1] : null;
    const tipoMetrica = ref?.tipoMetrica || def.metricaDefault;
    const porQue: string[] = [];
    const out: any = {
      key: def.key, label: ref?.componentLabel || def.label, sistema: def.sistema,
      tipoMetrica, referencia: ref ? {
        fuente: ref.fuente, documento: ref.documentoSeccion, estado: ref.estado,
        estadoLabel: ESTADO_REF_LABEL[ref.estado] || ref.estado, version: ref.version,
        intervaloKm: ref.intervaloKm, intervaloMeses: ref.intervaloMeses, intervaloHoras: ref.intervaloHoras,
        rangoMinKm: ref.rangoMinKm, rangoMaxKm: ref.rangoMaxKm, unidad: ref.unidad,
      } : null,
      evidencia: ref ? ref.estado : 'FALTANTE',
      porQue,
    };

    // ── A) Intervalo de mantenimiento ──
    if (tipoMetrica === 'INTERVALO_MANTENIMIENTO') {
      const intervaloKm = ref?.intervaloKm ?? null;
      const intervaloMeses = ref?.intervaloMeses ?? null;
      const ultima = ultimaEjecucion(ref?.matchRegex ? new RegExp(ref.matchRegex, 'i') : def.match, ots, planes);

      if (intervaloKm == null && intervaloMeses == null) {
        out.situacion = 'SIN_REFERENCIA';
        porQue.push('No hay intervalo configurado ni referencia aplicable para esta tarea.');
        if (ultima) porQue.push(`Última ejecución registrada: ${ultima.detalle}${ultima.km != null ? ` a ${Math.round(ultima.km).toLocaleString('es-AR')} km` : ''}.`);
      } else if (!ultima || (ultima.km == null && ultima.fecha == null)) {
        out.situacion = 'SIN_HISTORIAL';
        porQue.push('Sin registro de última ejecución: no se puede calcular el consumo del intervalo sin inventar el punto de partida.');
        if (ultima) porQue.push(`Última OT relacionada: "${ultima.detalle}" (sin odómetro ni fecha utilizable).`);
      } else {
        const kmDesde = ultima.km != null ? Math.max(0, km - ultima.km) : null;
        const mesesDesde = ultima.fecha ? Math.max(0, (now.getTime() - ultima.fecha.getTime()) / MS_MES) : null;
        const consumoKm = intervaloKm && kmDesde != null ? kmDesde / intervaloKm : null;
        const consumoMeses = intervaloMeses && mesesDesde != null ? mesesDesde / intervaloMeses : null;
        const consumo = Math.max(consumoKm ?? -1, consumoMeses ?? -1);
        const consumoProy = Math.max(
          intervaloKm && kmDesde != null ? (kmDesde + kmProyectar) / intervaloKm : -1,
          intervaloMeses && mesesDesde != null && mesesProyectar != null ? (mesesDesde + mesesProyectar) / intervaloMeses : -1,
        );
        out.intervalo = { km: intervaloKm, meses: intervaloMeses, tarea: ref?.tarea || null };
        out.kmDesdeUltimo = kmDesde != null ? Math.round(kmDesde) : null;
        out.mesesDesdeUltimo = mesesDesde != null ? Math.round(mesesDesde * 10) / 10 : null;
        out.consumoPct = consumo >= 0 ? Math.round(consumo * 100) : null;
        out.consumoProyectadoPct = consumoProy >= 0 ? Math.round(consumoProy * 100) : null;
        out.ultimaEjecucion = { km: ultima.km, fecha: ultima.fecha, origen: ultima.origen, detalle: ultima.detalle };
        out.situacion = consumo >= 1 ? 'VENCIDO' : consumo >= 0.8 ? 'PROXIMO' : 'AL_DIA';

        porQue.push(`Última ejecución: ${ultima.detalle} (${ultima.origen === 'PLAN' ? 'plan de mantenimiento' : 'OT'}${ultima.km != null ? `, a ${Math.round(ultima.km).toLocaleString('es-AR')} km` : ''}${ultima.fecha ? `, ${ultima.fecha.toLocaleDateString('es-AR')}` : ''}).`);
        porQue.push(`Intervalo aplicable: ${intervaloKm ? `${intervaloKm.toLocaleString('es-AR')} km` : ''}${intervaloKm && intervaloMeses ? ' o ' : ''}${intervaloMeses ? `${intervaloMeses} meses` : ''} — vence por el que corresponda primero.`);
        if (consumo >= 1) porQue.push(`Intervalo ya excedido: ${Math.round((consumo - 1) * 100)}% por encima del límite.`);

        // Eventos en el rango (con dedup km+fecha)
        const eventos: number[] = [];
        if (intervaloKm && kmDesde != null) {
          let prox = (ultima.km! + intervaloKm);
          if (escenario === 'CON_MANTENIMIENTO') {
            while (prox <= kmFinal && eventos.length < 50) { eventos.push(Math.round(prox)); prox += intervaloKm; }
          } else {
            if (prox <= kmFinal) eventos.push(Math.round(prox)); // sin mantenimiento: solo marca el vencimiento
          }
        }
        out.serviciosEnRango = eventos.length;
        out.proximoEnKm = eventos[0] ?? (intervaloKm && kmDesde != null ? Math.round(ultima.km! + intervaloKm) : null);
        out.vencido = consumo >= 1;
        for (const enKm of eventos) {
          timeline.push({
            km: enKm, tipo: 'SERVICIO', componente: def.label, key: def.key,
            detalle: `${ref?.tarea || def.label} — ${enKm <= km ? 'vencido' : 'previsto'}`,
            estado: enKm <= km ? 'VENCIDO' : 'PREVISTO',
            dias: kmMes ? Math.round((enKm - km) / (kmMes / 30.44)) : null,
          });
        }
      }
    }

    // ── B) Referencia orientativa de vida en servicio ──
    if (tipoMetrica === 'VIDA_SERVICIO_REF') {
      const rangoMin = ref?.rangoMinKm ?? null;
      const rangoMax = ref?.rangoMaxKm ?? null;
      if (inst) {
        const kmInst = inst.installedKm ?? null;
        const kmComp = kmInst != null ? Math.max(0, km - kmInst) : null;
        const kmCompProy = kmComp != null ? kmComp + kmProyectar : null;
        out.instancia = {
          origen: inst.origen, origenLabel: ORIGEN_LABEL[inst.origen] || inst.origen,
          installedKm: kmInst, installedAt: inst.installedAt,
          kmComponente: kmComp != null ? Math.round(kmComp) : null,
          kmComponenteProyectado: kmCompProy != null ? Math.round(kmCompProy) : null,
          serial: inst.instance?.serialNumber || null,
        };
        porQue.push(`Componente ${ORIGEN_LABEL[inst.origen] || 'de origen desconocido'}${kmInst != null ? `, instalado a ${Math.round(kmInst).toLocaleString('es-AR')} km del vehículo` : ''}.`);
        if (kmComp != null) porQue.push(`El componente lleva ${Math.round(kmComp).toLocaleString('es-AR')} km; en el escenario alcanzaría ${Math.round(kmCompProy!).toLocaleString('es-AR')} km (el vehículo llega a ${Math.round(kmFinal).toLocaleString('es-AR')} km).`);
        if (inst.origen === 'ORIGEN_DESCONOCIDO') porQue.push('Origen desconocido: el recorrido del componente es una estimación con incertidumbre, confirmar fecha/km de instalación.');
      } else {
        out.instancia = null;
        porQue.push('Sin ciclo de instalación registrado para este componente: no se puede calcular su recorrido sin inventar el punto de partida.');
      }

      if (rangoMin != null || rangoMax != null) {
        const kmCompProy = out.instancia?.kmComponenteProyectado ?? null;
        out.referenciaVida = { rangoMinKm: rangoMin, rangoMaxKm: rangoMax, unidad: ref?.unidad || 'km' };
        if (kmCompProy != null) {
          const pos = rangoMax != null && kmCompProy > rangoMax ? 'SUPERADO_RANGO'
            : rangoMin != null && kmCompProy >= rangoMin ? 'EN_RANGO_EVALUACION' : 'BAJO_RANGO';
          out.posicionRango = pos;
          out.situacion = pos === 'BAJO_RANGO' ? 'AL_DIA' : pos === 'EN_RANGO_EVALUACION' ? 'EVALUAR' : 'SUPERADO';
          porQue.push(`Rango orientativo de evaluación: ${rangoMin?.toLocaleString('es-AR') ?? '—'}–${rangoMax?.toLocaleString('es-AR') ?? '—'} km (${ESTADO_REF_LABEL[ref!.estado]}).`);
          if (pos !== 'BAJO_RANGO') porQue.push('Entra en el rango orientativo: corresponde revisión/evaluación de condición, no reemplazo automático.');
          if (pos !== 'BAJO_RANGO') {
            timeline.push({
              km: km + Math.max(0, (rangoMin ?? kmCompProy) - (out.instancia?.kmComponente ?? 0)), tipo: 'EVALUACION', componente: def.label, key: def.key,
              detalle: `${def.label} entra en rango orientativo de evaluación (${rangoMin?.toLocaleString('es-AR')}–${rangoMax?.toLocaleString('es-AR')} km)`,
              estado: 'PREVISTO', dias: kmMes ? Math.round(Math.max(0, (rangoMin ?? 0) - (out.instancia?.kmComponente ?? 0)) / (kmMes / 30.44)) : null,
            });
          }
        } else {
          out.situacion = 'SIN_HISTORIAL';
        }
      } else {
        out.situacion = out.situacion || 'SIN_REFERENCIA';
        porQue.push('Sin rango de referencia validado: la fila se muestra con sus datos conocidos pero no genera porcentajes ni hitos inventados.');
      }
    }

    // ── C) Condición medida ──
    if (tipoMetrica === 'CONDICION_MEDIDA' || ultimaMed) {
      if (ultimaMed) {
        out.ultimaMedicion = {
          tipo: ultimaMed.tipo, valor: ultimaMed.valor, valorTexto: ultimaMed.valorTexto,
          unidad: ultimaMed.unidad, fecha: ultimaMed.fecha, kmAlMedir: ultimaMed.kmAlMedir,
        };
        porQue.push(`Última medición: ${ultimaMed.valor ?? ultimaMed.valorTexto ?? '—'} ${ultimaMed.unidad || ''} (${new Date(ultimaMed.fecha).toLocaleDateString('es-AR')}${ultimaMed.kmAlMedir != null ? `, a ${Math.round(ultimaMed.kmAlMedir).toLocaleString('es-AR')} km` : ''}).`);
        // Extrapolación lineal solo si hay ≥2 mediciones con km — modelo declarado
        const conKm = meds.filter((m: any) => m.kmAlMedir != null && m.valor != null);
        if (conKm.length >= 2) {
          const a = conKm[conKm.length - 2], b = conKm[conKm.length - 1];
          const dKm = b.kmAlMedir - a.kmAlMedir;
          if (dKm > 0) {
            const tasa = (b.valor - a.valor) / dKm;
            out.proyeccionMedicion = {
              valorProyectado: Math.round((b.valor + tasa * kmProyectar) * 100) / 100,
              modelo: 'Extrapolación lineal entre las 2 últimas mediciones — no representa desgaste físico real si el patrón no es lineal.',
            };
            porQue.push(`Proyección por extrapolación lineal (${conKm.length} mediciones con km): ${out.proyeccionMedicion.valorProyectado} ${ultimaMed.unidad || ''} al final del escenario.`);
          }
        } else if (meds.length === 1) {
          porQue.push('Una sola medición: no se extrapola (faltaría inventar la tasa de cambio).');
        }
        if (!out.situacion) out.situacion = 'MEDIDA';
      } else if (tipoMetrica === 'CONDICION_MEDIDA') {
        out.situacion = 'SIN_MEDICION';
        porQue.push('Sin mediciones registradas de condición (espesor, profundidad, inspección). Sin evidencia medida no se informa condición.');
      }
    }

    // Costo estimado del servicio (si hay plan vinculado con historial)
    const planMatch = planes.find((p: any) => def.match.test(`${p.title || ''} ${p.name || ''}`));
    const costoUnit = planMatch ? (costoPlan[planMatch.id] || null) : null;
    out.costoEstimadoUnitario = costoUnit != null ? Math.round(costoUnit) : null;
    out.sinCostoHistorico = costoUnit == null;
    if ((out.serviciosEnRango || 0) > 0 && costoUnit == null) conceptosSinPrecio += out.serviciosEnRango;
    out.costoEstimadoTotal = costoUnit != null && out.serviciosEnRango ? Math.round(costoUnit * out.serviciosEnRango) : null;
    if (planMatch) porQue.push(`Plan vinculado: "${planMatch.title || planMatch.name}".`);
    if (costoUnit == null && (out.serviciosEnRango || 0) > 0) porQue.push('Sin costo histórico para estimar: concepto pendiente de cotización.');

    if (ref) porQue.push(`Referencia: ${ref.fuente || 'sin fuente declarada'}${ref.documentoSeccion ? ` — ${ref.documentoSeccion}` : ''} (${ESTADO_REF_LABEL[ref.estado]}).`);
    else porQue.push('Sin referencia en el catálogo técnico para este componente.');

    componentesOut.push(out);
  }

  // ── Neumáticos: condición medida por instancia (lógica existente, correcta) ──
  const neumaticosProj = (vehiculo.posicionesNeumatico || []).map((p: any) => {
    const n = p.neumatico;
    if (!n) return null;
    const banda0 = n.profBandaOriginal ?? 8;
    const banda = n.profBanda ?? banda0;
    const kmAcum = n.kmAcumulados || 0;
    let tasa: number | null = null;
    let modeloTasa = 'sin datos suficientes';
    const meds = (n.mediciones || []).filter((m: any) => m.kmAlMedir != null).sort((a: any, b: any) => a.kmAlMedir - b.kmAlMedir);
    if (meds.length >= 2) {
      const first = meds[0], last = meds[meds.length - 1];
      const dKm = last.kmAlMedir - first.kmAlMedir;
      if (dKm > 0) { tasa = (first.profBanda - last.profBanda) / dKm; modeloTasa = `tasa medida: ${(tasa * 1000).toFixed(2)} mm/1000km (${meds.length} mediciones)`; }
    } else if (kmAcum > 1000 && banda0 > banda) {
      tasa = (banda0 - banda) / kmAcum; modeloTasa = 'tasa estimada desde montaje (1 punto)';
    }
    const bandaFut = tasa != null ? Math.max(0, banda - tasa * kmProyectar) : null;
    const kmRestantes = tasa != null && tasa > 0 ? Math.round((banda - 1.6) / tasa) : null;
    return {
      codigo: n.codigo, posicion: `Eje ${p.eje} ${p.lado}/${p.posicion}`,
      condicion: n.condicion, recaps: n.recapsCount || 0,
      bandaActual: Math.round(banda * 10) / 10,
      bandaProyectada: bandaFut != null ? Math.round(bandaFut * 10) / 10 : null,
      kmDesdeMontaje: Math.round(kmAcum),
      kmRestantes, reemplazoEnRango: kmRestantes != null && kmRestantes <= kmProyectar,
      precioCompra: n.precioCompra || null, sinPrecio: n.precioCompra == null,
      modeloTasa, medicionesUsadas: meds.length,
    };
  }).filter(Boolean);
  const reemplazos = neumaticosProj.filter((x: any) => x.reemplazoEnRango);
  const costoNeumaticosConocido = reemplazos.reduce((a: number, x: any) => a + (x.precioCompra || 0), 0);
  const neumaticosSinPrecio = reemplazos.filter((x: any) => x.sinPrecio).length;
  conceptosSinPrecio += neumaticosSinPrecio;
  for (const x of reemplazos) {
    timeline.push({
      km: km + (x.kmRestantes || 0), tipo: 'NEUMATICO', componente: 'Neumáticos', key: 'neumaticos',
      detalle: `Reemplazo previsto ${x.codigo} (${x.posicion}) — banda proyectada < 1.6mm`,
      estado: 'PREVISTO', costo: x.precioCompra, dias: kmMes && x.kmRestantes ? Math.round(x.kmRestantes / (kmMes / 30.44)) : null,
    });
  }

  // ── Documentación que vence en el horizonte (solo si hay fecha estimada) ──
  const docsEnRango = fechaEstimada
    ? (vehiculo.vencimientos || []).filter((v: any) => { const f = new Date(v.fechaVto); return f > now && f <= fechaEstimada; })
      .map((v: any) => ({ tipo: v.tipo, fechaVto: v.fechaVto }))
    : [];

  // ── Costos operativos (combustible + OTs últimos 6m) ──
  const hace6m = new Date(); hace6m.setMonth(hace6m.getMonth() - 6);
  const [comb, ots6m] = await Promise.all([
    prisma.registroCombustible.aggregate({ where: { tenantId, vehiculoId, fecha: { gte: hace6m } }, _sum: { costoTotal: true } }).catch(() => ({ _sum: {} })),
    assetId ? prisma.workOrder.aggregate({ where: { tenantId, assetId, status: 'COMPLETED', completedAt: { gte: hace6m } }, _sum: { totalCost: true } }).catch(() => ({ _sum: {} })) : { _sum: {} },
  ]);
  const regs6m = (vehiculo.registrosCombustible || []).filter((r: any) => new Date(r.fecha) >= hace6m && r.odometro);
  let kmRecorridos6m: number | null = null;
  if (regs6m.length >= 2) {
    const ord = [...regs6m].sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    const diff = ord[ord.length - 1].odometro - ord[0].odometro;
    if (diff > 0) kmRecorridos6m = diff;
  }
  const costos6m = (comb._sum.costoTotal || 0) + (ots6m._sum.totalCost || 0);
  const costoPorKm = kmRecorridos6m && kmRecorridos6m > 0 ? costos6m / kmRecorridos6m : null;
  const costoOperativo = costoPorKm != null ? Math.round(costoPorKm * kmProyectar) : null;

  const costoServiciosConocido = componentesOut.reduce((a: number, c: any) => a + (c.costoEstimadoTotal || 0), 0);
  const subtotalConocido = (costoOperativo ?? 0) + costoServiciosConocido + costoNeumaticosConocido;
  const estimacionCompleta = conceptosSinPrecio === 0 && costoOperativo != null;

  // Dedup timeline: mismo componente+km → un solo evento
  const seen = new Set<string>();
  const timelineDedup = timeline.filter(t => {
    const k = `${t.key}:${t.km}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).sort((a, b) => a.km - b.km);

  if (kmMes == null) advertencias.push('Sin ritmo de uso estimable ni hipótesis declarada: el escenario se muestra solo por distancia, sin fechas.');
  if (conceptosSinPrecio > 0) advertencias.push(`${conceptosSinPrecio} concepto(s) sin cotización: el total es una estimación incompleta, no $0 ni el costo real.`);
  if (escenario === 'SIN_MANTENIMIENTO') advertencias.push('Escenario sin mantenimiento: se muestran tareas vencidas y su exceso de intervalo. No se calcula fecha de avería.');

  return {
    kmActual: km, kmProyectar, kmFinal,
    escenario, perfil,
    ritmoUso: { kmMes, fuente: ritmoFuente, puntosUsados: ritmo?.puntosUsados ?? 0 },
    mesesProyectar: mesesProyectar != null ? Math.round(mesesProyectar * 10) / 10 : null,
    diasEstimados, fechaEstimada: fechaEstimada?.toISOString() || null,
    componentes: componentesOut,
    neumaticos: neumaticosProj,
    docsEnRango,
    costos: {
      operativo: costoOperativo,
      serviciosConocido: Math.round(costoServiciosConocido),
      neumaticosConocido: Math.round(costoNeumaticosConocido),
      subtotalConocido: Math.round(subtotalConocido),
      conceptosSinPrecio,
      estimacionCompleta,
      moneda: 'ARS',
      costoPorKmUsado: costoPorKm != null ? Math.round(costoPorKm * 100) / 100 : null,
    },
    timeline: timelineDedup.slice(0, 40),
    advertencias,
  };
}
