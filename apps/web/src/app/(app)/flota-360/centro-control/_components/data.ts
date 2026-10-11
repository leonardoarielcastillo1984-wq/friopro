// ============================================================
// Adaptador: datos reales de la API → modelo visual del Centro
// Solo lectura. Nunca persiste ni inventa datos.
// ============================================================
import { apiFetch } from '@/lib/api';
import type { CCUnit, CCEvent, Kpis, VisualStatus } from './types';

interface ApiVehiculo {
  id: string;
  dominio: string;
  tipo: string;
  status: string;
  estadoOperativo?: string;
  currentOdometer?: number | null;
  conductor?: { nombre?: string } | null;
  estadoCompuesto?: {
    situacion: string;
    disponible: boolean;
    restringida: boolean;
    restricciones?: { motivo: string }[];
    enTallerEfectivo: boolean;
    utilizacion: string;
    etiqueta: string;
    etapaLabel?: string | null;
    advertencias?: string[];
  } | null;
}

// Un vehículo puede tener varias señales; la primera que aplica gana.
function toVisualStatus(v: ApiVehiculo, alertaServicio: boolean): VisualStatus {
  const c = v.estadoCompuesto;
  if (!c || c.situacion === 'INACTIVA') return 'inactiva';
  if (c.enTallerEfectivo) return 'en_taller';
  if (!c.disponible) return 'fuera_servicio';
  if (c.utilizacion === 'EN_SERVICIO') return 'en_viaje';
  if (alertaServicio) return 'mantenimiento_proximo';
  return 'disponible';
}

interface Extras {
  parejaPorVeh: Map<string, { id: string; dominio: string }>;
  servicioPorVeh: Map<string, { nombre: string; destino?: string | null; cliente?: string | null }>;
  mantPorVeh: Map<string, NonNullable<CCUnit['mant']>>;
  checkPorVeh: Map<string, { at: string; resultado: string }>;
}

function toUnit(v: ApiVehiculo, alertasPorVeh: Map<string, string[]>, ex: Extras): CCUnit {
  const c = v.estadoCompuesto;
  const alertas: string[] = [
    ...(alertasPorVeh.get(v.id) ?? []),
    ...(c?.advertencias ?? []),
    ...(c?.restricciones ?? []).map((r) => `Restringida: ${r.motivo}`),
  ];
  const status = toVisualStatus(v, alertas.length > 0 && !!c?.disponible);
  const pareja = ex.parejaPorVeh.get(v.id);
  return {
    id: v.id,
    dominio: v.dominio,
    tipo: v.tipo,
    status,
    statusLabel: c?.etiqueta ?? v.estadoOperativo ?? 'Sin datos',
    conductor: v.conductor?.nombre ?? null,
    currentOdometer: v.currentOdometer ?? null,
    alerts: alertas,
    parejaId: pareja?.id ?? null,
    parejaDominio: pareja?.dominio ?? null,
    servicio: ex.servicioPorVeh.get(v.id) ?? null,
    mant: ex.mantPorVeh.get(v.id) ?? null,
    checklist: ex.checkPorVeh.get(v.id) ?? null,
    source: 'real',
    x: 0, y: 0,
  };
}

// ── Feed de eventos compuesto desde fuentes reales ──
function eventosDesdeInspecciones(inspecciones: any[]): CCEvent[] {
  return (inspecciones ?? []).slice(0, 20).map((i: any): CCEvent => {
    const fallaCritica = !!(i.tieneFallosCriticos || i.resultado === 'NO_APTO' || i.apto === false);
    const conObs = !!(i.tieneObservaciones || i.resultado === 'APTO_CON_OBSERVACIONES');
    return {
      id: `insp-${i.id}`,
      at: i.createdAt ?? i.fecha ?? new Date().toISOString(),
      unidad: i.vehiculo?.dominio ?? i.dominio ?? undefined,
      unidadId: i.vehiculoId ?? i.vehiculo?.id,
      kind: 'checklist',
      text: fallaCritica
        ? `Checklist con falla crítica — ${i.plantilla?.nombre ?? 'inspección'}`
        : conObs
          ? `Checklist completado con observaciones`
          : `Checklist completado sin observaciones`,
      level: fallaCritica ? 'critica' : conObs ? 'advertencia' : 'exito',
      source: 'real',
    };
  });
}

function eventosDesdeAlertasServicio(alertas: any[]): CCEvent[] {
  return (alertas ?? []).slice(0, 15).map((a: any, idx: number): CCEvent => {
    const vencido = a.estado === 'VENCIDO' || a.vencido === true || (a.kmRestantes ?? 1) <= 0 || (a.diasRestantes ?? 1) <= 0;
    return {
      id: `alert-${a.id ?? idx}`,
      at: a.fechaObjetivo ?? a.fechaVencimiento ?? a.updatedAt ?? new Date().toISOString(),
      unidad: a.vehiculo?.dominio ?? a.dominio ?? undefined,
      unidadId: a.vehiculoId ?? a.vehiculo?.id,
      kind: 'servicio',
      text: vencido
        ? `Servicio vencido — ${a.plan?.nombre ?? a.nombre ?? 'plan de mantenimiento'}`
        : `Servicio próximo — ${a.plan?.nombre ?? a.nombre ?? 'plan de mantenimiento'}`,
      level: vencido ? 'critica' : 'advertencia',
      source: 'real',
    };
  });
}

function eventosDesdeEstadias(estadias: any[]): CCEvent[] {
  return (estadias ?? []).slice(0, 10).map((a: any, idx: number): CCEvent => ({
    id: `est-${a.vehiculoId ?? idx}`,
    at: a.desde ?? new Date().toISOString(),
    unidad: a.dominio,
    unidadId: a.vehiculoId,
    kind: 'estadia',
    text: `Inmovilizada ${a.dias != null ? `${a.dias} días` : '—'} (${a.etapa ?? a.etiqueta ?? 'sin etapa'})`,
    level: 'advertencia',
    source: 'real',
  }));
}

export interface CentroData {
  units: CCUnit[];
  events: CCEvent[];
  kpis: Kpis;
  fetchedAt: string;
  endpointsFallidos: string[];
}

export async function fetchCentroData(): Promise<CentroData> {
  const fallidos: string[] = [];

  const safe = async <T>(path: string, pick: (r: any) => T, def: T): Promise<T> => {
    try {
      const r = await apiFetch<any>(path);
      return pick(r);
    } catch {
      fallidos.push(path);
      return def;
    }
  };

  const [vehiculos, disp, alertas, inspecciones, conjuntos, servicios] = await Promise.all([
    safe('/flota/vehiculos', (r) => r?.vehiculos ?? [], [] as ApiVehiculo[]),
    safe('/fleet-ops/disponibilidad?dias=30', (r) => r, null as any),
    safe('/fleet-ops/alertas-servicio', (r) => r?.alertas ?? r?.items ?? [], [] as any[]),
    safe('/inspecciones?take=40', (r) => r?.inspecciones ?? [], [] as any[]),
    safe('/fleet-ops/conjuntos?estado=ACOPLADO', (r) => r?.conjuntos ?? [], [] as any[]),
    safe('/flota/servicios?activos=1', (r) => r?.servicios ?? [], [] as any[]),
  ]);

  // Índice de alertas de servicio por vehículo + semáforo de mantenimiento.
  // El endpoint devuelve la unidad en a.activo (no a.vehiculoId).
  const alertasPorVeh = new Map<string, string[]>();
  const mantPorVeh = new Map<string, NonNullable<CCUnit['mant']>>();
  const rank: Record<string, number> = { VENCIDO: 0, URGENTE: 1, PROXIMO: 2 };
  for (const a of alertas) {
    const vid = a.vehiculoId ?? a.activo?.id ?? a.vehiculo?.id;
    if (!vid) continue;
    const vencido = a.estado === 'VENCIDO' || a.vencido === true || (a.kmRestantes ?? 1) <= 0 || (a.diasRestantes ?? 1) <= 0;
    const arr = alertasPorVeh.get(vid) ?? [];
    arr.push(vencido ? 'Servicio vencido' : 'Servicio próximo a vencer');
    alertasPorVeh.set(vid, arr);
    const estado = (a.estado === 'VENCIDO' || a.estado === 'URGENTE' || a.estado === 'PROXIMO') ? a.estado : (vencido ? 'VENCIDO' : 'PROXIMO');
    const cur = mantPorVeh.get(vid);
    if (!cur || rank[estado] < rank[cur.estado]) {
      mantPorVeh.set(vid, {
        estado,
        kmRestantes: a.kmRestantes ?? null,
        diasRestantes: a.diasRestantes ?? null,
        componente: a.componente ?? a.plan?.nombre ?? a.nombre ?? 'Plan de mantenimiento',
      });
    }
  }

  // Parejas reales de conjuntos operativos acoplados (tractor↔semi)
  const parejaPorVeh = new Map<string, { id: string; dominio: string }>();
  for (const c of conjuntos) {
    if (c?.tractor?.id && c?.semi?.id) {
      parejaPorVeh.set(c.tractor.id, { id: c.semi.id, dominio: c.semi.dominio });
      parejaPorVeh.set(c.semi.id, { id: c.tractor.id, dominio: c.tractor.dominio });
    }
  }

  // Servicio vigente por unidad (asignaciones abiertas: hasta === null)
  const servicioPorVeh = new Map<string, { nombre: string; destino?: string | null; cliente?: string | null }>();
  for (const s of servicios) {
    for (const a of s?.unidades ?? []) {
      if (!a.hasta && a.vehiculoId && !servicioPorVeh.has(a.vehiculoId)) {
        servicioPorVeh.set(a.vehiculoId, { nombre: s.nombre, destino: s.destino ?? null, cliente: s.cliente ?? null });
      }
    }
  }

  // Último checklist por unidad (inspecciones vienen ordenadas por fecha desc)
  const checkPorVeh = new Map<string, { at: string; resultado: string }>();
  for (const i of inspecciones) {
    const vid = i.vehiculoId ?? i.vehiculo?.id;
    if (!vid || checkPorVeh.has(vid)) continue;
    const resultado = i.resultado ?? (i.apto === false ? 'NO_APTO' : i.tieneFallosCriticos ? 'NO_APTO' : i.tieneObservaciones ? 'APTO_CON_OBSERVACIONES' : 'APTO');
    checkPorVeh.set(vid, { at: i.createdAt ?? i.fecha ?? '', resultado });
  }

  const ex: Extras = { parejaPorVeh, servicioPorVeh, mantPorVeh, checkPorVeh };
  const units = vehiculos
    .filter((v) => v.status !== 'BAJA')
    .map((v) => toUnit(v, alertasPorVeh, ex));

  const flota = disp?.flota ?? {};
  const estadias: any[] = disp?.alertasEstadia ?? [];
  const gastoMes = (disp?.gastoCombustible ?? 0) + (disp?.gastoMantenimiento ?? 0) + (disp?.gastoNeumaticos ?? 0);

  const kpis: Kpis = {
    total: flota.total ?? units.length,
    operativos: flota.operativos ?? units.filter((u) => u.status === 'disponible').length,
    pctDisponible: flota.pctDisponible ?? null,
    enViaje: units.filter((u) => u.status === 'en_viaje').length,
    enTaller: flota.enTaller ?? units.filter((u) => u.status === 'en_taller').length,
    fueraServicio: units.filter((u) => u.status === 'fuera_servicio').length,
    mantProximos: alertas.length,
    checklistsHoy: null,
    incidencias: estadias.length + units.reduce((n, u) => n + u.alerts.length, 0),
    costoMes: disp ? gastoMes : null,
  };

  const events = [
    ...eventosDesdeInspecciones(inspecciones),
    ...eventosDesdeAlertasServicio(alertas),
    ...eventosDesdeEstadias(estadias),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 40);

  return { units, events, kpis, fetchedAt: new Date().toISOString(), endpointsFallidos: fallidos };
}
