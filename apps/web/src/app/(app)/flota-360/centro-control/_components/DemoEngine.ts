// ============================================================
// Motor de demostración — simulación 100% aislada del backend.
// Nada de lo que genera toca la API ni se persiste.
// ============================================================
import type { CCUnit, CCEvent, Kpis, VisualStatus } from './types';
import { ROUTE_LOOP } from './types';

const DOMINIOS = [
  'AE 412 BD', 'AF 123 CD', 'AC 889 RT', 'AD 204 LM', 'AE 771 QZ', 'AF 330 GH',
  'AC 550 WK', 'AD 918 PL', 'AE 067 TN', 'AF 452 XS', 'AC 113 UB', 'AD 676 VF',
];
const NOMBRES = ['J. Pérez', 'M. Gómez', 'R. Sosa', 'L. Ferreyra', 'A. Duarte', 'C. Medina', 'P. Acosta', 'N. Vega'];

interface DemoState {
  units: CCUnit[];
  events: CCEvent[];
  tick: number;
  routeIdx: Map<string, number>;
}

const STATUSES_POOL: VisualStatus[] = [
  'disponible', 'disponible', 'disponible', 'disponible', 'disponible', 'disponible',
  'en_viaje', 'en_viaje', 'en_viaje', 'en_taller', 'en_taller', 'fuera_servicio',
];

function seedUnits(): CCUnit[] {
  return DOMINIOS.map((dominio, i) => {
    const status = STATUSES_POOL[i % STATUSES_POOL.length];
    return {
      id: `demo-${i}`,
      dominio,
      tipo: i % 4 === 3 ? 'SEMI' : 'TRACTOR',
      status,
      statusLabel: labelFor(status),
      conductor: NOMBRES[i % NOMBRES.length],
      currentOdometer: 120000 + i * 38500,
      alerts: status === 'fuera_servicio' ? ['Falla crítica en sistema de frenos'] : status === 'mantenimiento_proximo' ? ['Servicio próximo'] : [],
      source: 'demo',
      x: 0, y: 0,
    };
  });
}

function labelFor(s: VisualStatus): string {
  switch (s) {
    case 'disponible': return 'Disponible · Sin servicio';
    case 'en_viaje': return 'En servicio';
    case 'en_taller': return 'En taller · Reparación en curso';
    case 'fuera_servicio': return 'No disponible · Restringida';
    case 'mantenimiento_proximo': return 'Disponible · Servicio próximo';
    case 'inactiva': return 'Inactiva';
  }
}

const DEMO_EVENT_TEXTS: { kind: string; text: string; level: CCEvent['level'] }[] = [
  { kind: 'checklist', text: 'Checklist completado sin observaciones', level: 'exito' },
  { kind: 'checklist', text: 'Checklist completado con observaciones', level: 'advertencia' },
  { kind: 'falla', text: 'Falla crítica detectada en sistema de frenos', level: 'critica' },
  { kind: 'falla', text: 'Falla detectada en luces reglamentarias', level: 'advertencia' },
  { kind: 'ot', text: 'Orden de mantenimiento iniciada', level: 'info' },
  { kind: 'ot', text: 'Mantenimiento preventivo finalizado', level: 'exito' },
  { kind: 'viaje', text: 'Unidad salió a ruta — Destino: Córdoba', level: 'info' },
  { kind: 'viaje', text: 'Entrega completada — Cliente: Stellantis', level: 'exito' },
  { kind: 'taller', text: 'Ingreso a taller confirmado', level: 'info' },
  { kind: 'taller', text: 'Unidad liberada del taller', level: 'exito' },
  { kind: 'estadia', text: 'Nuevo registro de kilometraje', level: 'info' },
  { kind: 'calidad', text: 'Auditoría de calidad OK — Lote RU-2024', level: 'exito' },
];

export function createDemoState(): DemoState {
  const state: DemoState = {
    units: seedUnits(),
    events: [],
    tick: 0,
    routeIdx: new Map(),
  };
  // Sembrar el feed con algunos eventos iniciales
  for (let i = 0; i < 6; i++) applyDemoTick(state, true);
  return state;
}

// Un tick = un evento simulado + posible transición de estado.
// Devuelve el evento generado (o null si no tocó).
export function applyDemoTick(state: DemoState, silent = false): CCEvent | null {
  state.tick++;
  const tpl = DEMO_EVENT_TEXTS[Math.floor(Math.random() * DEMO_EVENT_TEXTS.length)];
  const unit = state.units[Math.floor(Math.random() * state.units.length)];

  // Transición coherente con el evento (probabilidad moderada)
  if (!silent && Math.random() < 0.55) {
    switch (tpl.kind) {
      case 'viaje':
        if (unit.status === 'disponible') setStatus(unit, 'en_viaje');
        else if (unit.status === 'en_viaje' && tpl.text.includes('Entrega')) setStatus(unit, 'disponible');
        break;
      case 'ot':
        if (tpl.text.includes('iniciada')) setStatus(unit, 'en_taller');
        else if (unit.status === 'en_taller') setStatus(unit, 'disponible');
        break;
      case 'falla':
        if (tpl.level === 'critica') { setStatus(unit, 'fuera_servicio'); unit.alerts = ['Falla crítica en sistema de frenos']; }
        else unit.alerts = [...unit.alerts.slice(0, 1), tpl.text];
        break;
      case 'checklist':
        if (unit.status === 'fuera_servicio' && tpl.level === 'exito') { setStatus(unit, 'disponible'); unit.alerts = []; }
        break;
      case 'taller':
        if (tpl.text.includes('Ingreso')) setStatus(unit, 'en_taller');
        else if (unit.status === 'en_taller') setStatus(unit, 'disponible');
        break;
    }
  }

  const ev: CCEvent = {
    id: `demo-ev-${state.tick}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    unidad: unit.dominio,
    unidadId: unit.id,
    kind: tpl.kind,
    text: tpl.text,
    level: tpl.level,
    source: 'demo',
  };
  state.events = [ev, ...state.events].slice(0, 50);
  return silent ? null : ev;
}

function setStatus(unit: CCUnit, s: VisualStatus) {
  unit.status = s;
  unit.statusLabel = labelFor(s);
  if (s === 'disponible' || s === 'en_viaje') unit.alerts = unit.alerts.filter((a) => !a.startsWith('Falla'));
}

// Avanza las posiciones de los camiones en ruta (anillo interno)
export function advanceRoute(state: DemoState, step = 1) {
  for (const u of state.units) {
    if (u.status !== 'en_viaje') { state.routeIdx.delete(u.id); continue; }
    const cur = state.routeIdx.get(u.id) ?? Math.floor(Math.random() * ROUTE_LOOP.length);
    state.routeIdx.set(u.id, (cur + step) % ROUTE_LOOP.length);
  }
}

export function demoKpis(units: CCUnit[]): Kpis {
  const total = units.length;
  const disp = units.filter((u) => u.status === 'disponible' || u.status === 'mantenimiento_proximo').length;
  return {
    total,
    operativos: disp,
    pctDisponible: total ? Math.round((disp / total) * 100) : 100,
    enViaje: units.filter((u) => u.status === 'en_viaje').length,
    enTaller: units.filter((u) => u.status === 'en_taller').length,
    fueraServicio: units.filter((u) => u.status === 'fuera_servicio').length,
    mantProximos: units.filter((u) => u.status === 'mantenimiento_proximo').length + 3,
    checklistsHoy: 4,
    incidencias: units.filter((u) => u.status === 'fuera_servicio').length + 1,
    costoMes: 285000,
  };
}
