// ============================================================
// Centro de Control — escenario GENÉRICO (predio logístico demo)
// Eje X = este, eje Z = sur. La cámara mira desde el sudeste.
// ============================================================
import type { VisualStatus } from '../types';
import {
  makeRing, makeRoutes, kindFor, STATUS_COLOR,
  type V2, type Rect, type RingDef, type BuildingDef, type Slot, type SlotGroup,
  type Sector, type PropDef, type VegItem, type WalkerDef, type ShuttleDef,
  type GroundTools, type Scenario, type VehicleKind,
} from './layout-core';

export type { V2, Rect, RingDef, BuildingDef, Slot, SlotGroup, Sector, PropDef, VegItem, WalkerDef, ShuttleDef, GroundTools, Scenario, VehicleKind };
export { kindFor, STATUS_COLOR };

export const BOUNDS: Rect = { x0: -170, x1: 170, z0: -110, z1: 135 };
export const FENCE: Rect = { x0: -122, x1: 122, z0: -88, z1: 92 };

// Calle perimetral interna (anillo)
export const RING: RingDef = { x0: -105, x1: 105, z0: -12, z1: 58, w: 10 };
export const AISLE_Z = 23;          // calle del estacionamiento
export const GATE_X = 0;            // acceso principal
export const HIGHWAY_Z = 104;       // ruta externa
export const HIGHWAY_W = 15;
export const INACTIVE_LANE_Z = 86;
export const HW_LANE_E = HIGHWAY_Z + 3.6;   // carril hacia el este
export const HW_LANE_W = HIGHWAY_Z - 3.6;   // carril hacia el oeste

export const BUILDINGS: BuildingDef[] = [
  { key: 'deposito', model: 'warehouse', label: 'DEPÓSITO GENERAL', sub: 'Recepción y despacho', x: -60, z: -54, rot: 0, scale: 1, labelY: 16 },
  { key: 'planta', model: 'factory', label: 'PLANTA', sub: 'Producción y expedición', x: 12, z: -52, rot: Math.PI, scale: 0.85, labelY: 26 },
  { key: 'admin', model: 'office-building', label: 'ADMINISTRACIÓN', sub: 'Operaciones y planificación', x: 78, z: -50, rot: Math.PI, scale: 0.75, labelY: 25 },
  { key: 'taller', model: 'warehouse', label: 'TALLER', sub: 'Mantenimiento y reparación', x: 20, z: 21, rot: 0, scale: 0.62, labelY: 12 },
  { key: 'calidad', model: 'car-wash', label: 'CALIDAD', sub: 'Inspección y checklists', x: 70, z: 14, rot: Math.PI / 2, scale: 0.9, labelY: 10 },
  { key: 'combustible', model: 'gas-station', label: 'COMBUSTIBLE', sub: 'Surtidor de flota', x: -52, z: 74, rot: 0, scale: 0.9, labelY: 9 },
  { key: 'garita', model: 'site-office', label: 'GARITA', sub: 'Control de acceso', x: -13, z: 84, rot: 0, scale: 1, labelY: 6 },
];

// ── Slots por estado ──
const H_N = Math.PI;        // mirando al norte (-Z)
const H_S = 0;              // mirando al sur (+Z)
const H_E = Math.PI / 2;    // mirando al este (+X)

function parkSlots(): Slot[] {
  const out: Slot[] = [];
  const attach: V2 = [RING.x0, AISLE_Z];
  for (let i = 0; i < 12; i++) {
    const x = -89.5 + i * 5.2;
    // Fila norte: trompa al norte
    out.push({ key: `P-N${i + 1}`, x, z: 2.5, heading: H_N, attach, approach: [[RING.x0 + 6, AISLE_Z], [x - 7, AISLE_Z], [x, AISLE_Z - 5], [x, 2.5]], exit: [[x, -5], [x, RING.z0]] });
    // Fila sur: trompa al sur
    out.push({ key: `P-S${i + 1}`, x, z: 43.5, heading: H_S, attach, approach: [[RING.x0 + 6, AISLE_Z], [x - 7, AISLE_Z], [x, AISLE_Z + 5], [x, 43.5]], exit: [[x, 51], [x, RING.z1]] });
  }
  return out;
}

function shopSlots(): Slot[] {
  return [6, 14.5, 23, 31.5].map((x, i) => ({
    key: `T${i + 1}`, x, z: 40, heading: H_N, attach: [x, RING.z1] as V2, approach: [[x, RING.z1 - 3], [x, 40]] as V2[],
    exit: [[x, 52], [x, RING.z1]] as V2[], exitReverse: true,
  }));
}

function holdSlots(): Slot[] {
  const out: Slot[] = [];
  const rows = [41, 47, 53];
  rows.forEach((z, r) => {
    [64, 88].forEach((x, c) => {
      out.push({
        key: `H${r * 2 + c + 1}`, x, z, heading: H_E,
        attach: [40, RING.z1],
        approach: [[40, RING.z1 - 3], [40, z + 3], [44, z], [x, z]],
        exit: [[x + 10, z], [RING.x1 - 4, z], [RING.x1, z - 4]],
      });
    });
  });
  return out;
}

function inactiveSlots(): Slot[] {
  return [34, 42, 50, 58, 66, 74].map((x, i) => ({
    key: `I${i + 1}`, x, z: 70, heading: H_N,
    attach: [GATE_X, RING.z1],
    approach: [[GATE_X, RING.z1 + 6], [GATE_X, INACTIVE_LANE_Z - 3], [GATE_X + 5, INACTIVE_LANE_Z], [x - 7, INACTIVE_LANE_Z], [x, INACTIVE_LANE_Z - 5], [x, 70]] as V2[],
    exit: [[x, 63], [x, RING.z1]] as V2[],
  }));
}

// Muelles del depósito: semirremolques sin tractor, culata contra el muelle
function dockSlots(): Slot[] {
  return [-66, -60, -54, -48].map((x, i) => ({
    key: `D${i + 1}`, x, z: -45, heading: H_S, attach: [x, RING.z0] as V2, approach: [[x, RING.z0], [x, -45]] as V2[],
    exit: [[x, RING.z0]] as V2[],
  }));
}

const ring = makeRing(RING);
export const RING_LEN = ring.LEN;
export const ringParam = ring.ringParam;
export const ringPath = ring.ringPath;

export const SLOTS: Record<SlotGroup, Slot[]> = {
  park: parkSlots(),
  shop: shopSlots(),
  hold: holdSlots(),
  inactive: inactiveSlots(),
  dock: dockSlots(),
};

// Slots virtuales adicionales que se habilitan al expandir un agrupamiento
// (clic en el badge "+N"). Se usan solo para ubicar unidades de desborde.
export function extraSlots(group: SlotGroup): Slot[] {
  const mk = (key: string, x: number, z: number, heading: number): Slot =>
    ({ key, x, z, heading, attach: [x, z], approach: [], exit: [], virtual: true });
  const out: Slot[] = [];
  switch (group) {
    case 'park':
      for (let i = 0; i < 3; i++) {
        out.push(mk(`PX-N${i}`, -26 + i * 5.2, 2.5, H_N));
        out.push(mk(`PX-S${i}`, -26 + i * 5.2, 43.5, H_S));
      }
      break;
    case 'shop':
      for (let i = 0; i < 3; i++) out.push(mk(`TX${i}`, 46 + i * 9, 37, H_N));
      break;
    case 'hold':
      [59, 65].forEach((z, r) => [64, 88].forEach((x, c) => out.push(mk(`HX${r * 2 + c}`, x, z, H_E))));
      break;
    case 'inactive':
      for (let i = 0; i < 4; i++) out.push(mk(`IX${i}`, 82 + i * 8, 70, H_N));
      break;
    case 'dock':
      for (let i = 0; i < 4; i++) out.push(mk(`DX${i}`, -42 + i * 6, -45, H_S));
      break;
    default:
      break;
  }
  return out;
}

export function groupFor(status: VisualStatus, kind: VehicleKind): SlotGroup {
  switch (status) {
    case 'en_viaje': return 'route';
    case 'en_taller': return 'shop';
    case 'fuera_servicio': return 'hold';
    case 'inactiva': return 'inactive';
    default: return kind === 'trailer' ? 'dock' : 'park';
  }
}

export const GROUP_LABEL: Record<SlotGroup, string> = {
  park: 'Estacionamiento', shop: 'Taller', hold: 'Fuera de servicio', inactive: 'Inactivas', dock: 'Muelles', route: 'En ruta',
};

// Centro del grupo (para insignias de agrupamiento)
export const GROUP_ANCHOR: Record<SlotGroup, V2> = {
  park: [-62, AISLE_Z], shop: [19, 50], hold: [70, 36], inactive: [54, 62], dock: [-62, -16], route: [60, HIGHWAY_Z - 9],
};

// ── Sectores para navegación de cámara ──
export const SECTORS: Sector[] = [
  { key: 'general', label: 'Vista general', x: -8, z: 14, zoom: 1.45 },
  { key: 'parking', label: 'Estacionamiento', x: -62, z: 22, zoom: 2.4 },
  { key: 'taller', label: 'Taller', x: 20, z: 32, zoom: 3.2 },
  { key: 'deposito', label: 'Depósito', x: -60, z: -36, zoom: 2.4 },
  { key: 'hold', label: 'Fuera de servicio', x: 68, z: 40, zoom: 3 },
  { key: 'acceso', label: 'Acceso y ruta', x: 0, z: 92, zoom: 2.2 },
];

// ── Props decorativos ──
function buildPropsList(): { props: PropDef[]; lamps: V2[] } {
  const props: PropDef[] = [];
  const p = (n: string, x: number, z: number, r = 0, s = 1) => props.push({ n, x, z, r, s });

  // Patio de pallets junto al depósito
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) p('wooden-pallet', -96 + j * 1.8, -46 + i * 2.4);
  for (let i = 0; i < 4; i++) p('cardboard-box-stack', -96 + (i % 2) * 2.2, -38 + Math.floor(i / 2) * 2.2, i * 0.4);
  p('pallet-rack', -98, -56, Math.PI / 2); p('pallet-rack', -98, -60, Math.PI / 2); p('pallet-rack', -98, -64, Math.PI / 2);
  p('pallet-jack', -91, -42, 0.6);
  // Taller: banco, cajas de herramientas, compresor
  p('workbench', 2, 30); p('toolbox', 4.5, 30.5, 0.3); p('air-compressor', 37, 30.8, Math.PI);
  p('toolbox', 35, 30.4, -0.4); p('dumpster', 40, 22, Math.PI / 2);
  p('gas-cylinder', 38.5, 26); p('gas-cylinder', 39.2, 26.8);
  // Autos del personal frente a administración
  const cars = ['hatchback', 'pickup-truck', 'hatchback', 'hatchback', 'pickup-truck', 'hatchback', 'hatchback', 'hatchback', 'pickup-truck'];
  [59.5, 62.5, 68.5, 71.5, 74.5, 80.5, 86.5, 89.5, 95.5].forEach((x, i) => p(cars[i], x, -28.8, i % 3 === 0 ? 0 : Math.PI));
  // Planta: utilitarios en la playa de carga y acopios
  p('delivery-van', -4, -30, Math.PI / 2); p('delivery-van', 4, -30, Math.PI / 2);
  p('steel-beam-stack', 24, -32); p('steel-beam-stack', 30, -32, 0.1);
  p('concrete-pipe', 36, -26, Math.PI / 2); p('concrete-pipe', 36, -22, Math.PI / 2);
  p('conveyor-belt', -38, -38, Math.PI / 2);
  for (let i = 0; i < 6; i++) p('wooden-pallet', -45 + (i % 3) * 1.6, -30 + Math.floor(i / 3) * 1.4);
  p('cardboard-box-stack', -40, -30, 0.3);
  // Planta y depósito
  p('dumpster', -30, -40); p('dumpster', 36, -40);
  p('water-tower', 44, -72, 0, 0.9);
  p('fuel-tank', -64, 70, Math.PI / 2); p('fuel-tank', -64, 76, Math.PI / 2);
  // Sector fuera de servicio
  for (let i = 0; i < 10; i++) p('jersey-barrier', 50 + i * 4.6, 35.6);
  p('traffic-barrel', 96, 36); p('traffic-barrel', 96, 52); p('traffic-barrel', 46, 52.5);
  // Acceso
  p('bollard', GATE_X - 6.5, FENCE.z1 + 1); p('bollard', GATE_X + 7.5, FENCE.z1 + 1);
  p('stop-sign', GATE_X - 7, 95, Math.PI / 2);
  // Luminarias sobre el anillo (halos nocturnos)
  const lamps: V2[] = [];
  const lamp = (x: number, z: number, r: number) => { props.push({ n: 'street-light', x, z, r, lamp: true }); lamps.push([x, z]); };
  for (let x = RING.x0 + 15; x < RING.x1; x += 30) {
    lamp(x, RING.z0 - 6.5, 0);
    lamp(x, RING.z1 + 6.5, Math.PI);
  }
  for (let z = RING.z0 + 15; z < RING.z1; z += 25) {
    lamp(RING.x0 - 6.5, z, Math.PI / 2);
    lamp(RING.x1 + 6.5, z, -Math.PI / 2);
  }
  return { props, lamps };
}

// ── Vegetación ──
function buildVegetationList(): VegItem[] {
  const items: VegItem[] = [];
  let seed = 11;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const plant = (x: number, z: number) => items.push({ x: x + (r() - 0.5) * 3, z: z + (r() - 0.5) * 3, rot: r() * Math.PI * 2, scale: 0.8 + r() * 0.5, sway: r() > 0.45 });
  const bush = (x: number, z: number, s = 1.2) => items.push({ x, z: z + r() * 6, model: 'bush', scale: s, rot: r() * 6 });
  const hedge = (x: number, z: number, s = 0.9) => items.push({ x, z, model: 'hedge', scale: s });

  // Cortina forestal fuera del cerco
  for (let x = FENCE.x0 - 4; x <= FENCE.x1 + 4; x += 9) { plant(x, FENCE.z0 - 6); if (r() > 0.4) plant(x + 4, FENCE.z0 - 14); }
  for (let z = FENCE.z0; z <= FENCE.z1 - 4; z += 9) { plant(FENCE.x0 - 6, z); plant(FENCE.x1 + 6, z); if (r() > 0.5) plant(FENCE.x1 + 14, z + 4); }
  // Banquina sur de la ruta
  for (let x = BOUNDS.x0 + 10; x < BOUNDS.x1; x += 14) if (Math.abs(x) > 14) plant(x, 122 + r() * 6);
  // Canteros dentro del predio
  for (let x = 64; x <= 94; x += 6) hedge(x, -34.5);
  for (let x = -120 + 6; x < -108; x += 5) for (let z = -80; z < 80; z += 16) bush(x, z);
  // Canteros interiores
  for (let x = -108; x < 110; x += 10) plant(x, -83);
  for (let z = -72; z < -24; z += 9) { plant(104, z); plant(110, z + 4); }
  for (let x = -108; x < -74; x += 9) for (let z = 70; z < 88; z += 9) plant(x, z);
  for (let x = 90; x < 112; x += 9) for (let z = 70; z < 88; z += 9) plant(x, z);
  plant(-28, 70); plant(-24, 76);
  for (let z = 2; z < 26; z += 7) { bush(-18, z, 1.3); bush(-6, z + 3, 1.3); }
  items.push({ x: -12, z: 12, model: 'oak-tree', scale: 1.2 });
  return items;
}

// ── Ambientación (operarios y autoelevadores de relleno) ──
const WALKERS: WalkerDef[] = [
  { model: 'people/character-male-a', path: [[62, -38.5], [94, -38.5], [94, -36], [62, -36]] },
  { model: 'people/character-male-c', path: [[-82, -34.5], [-40, -34.5]] },
  { model: 'people/character-female-b', path: [[-10, -36.5], [34, -36.5]] },
  { model: 'people/character-male-e', path: [[3.5, 31.5], [36, 31.5]] },
  { model: 'people/character-male-a', path: [[1.5, 31]], idle: 'interact-right' },
  { model: 'people/character-male-c', path: [[36.5, 31]], idle: 'interact-left' },
  { model: 'people/character-male-e', path: [[-8, 88]], idle: 'idle' },
  { model: 'people/character-female-b', path: [[-94, -44]], idle: 'pick-up' },
];

const SHUTTLES: ShuttleDef[] = [
  { a: [[-92, -40], [-80, -34], [-74, -31]], start: [-92, -42] },
  { a: [[-90, -48], [-62, -36], [-58, -31]], start: [-90, -50] },
];

// ── Pintado del suelo (idéntico al renderer original) ──
export function paintYard(t: GroundTools) {
  const { asphalt, lawn, vereda, line, arrow, zebra, hatchRect, text } = t;
  const { WHITE, YELLOW } = t;

  // Playa de hormigón dentro del cerco
  const inner = { x0: FENCE.x0 + 8, x1: FENCE.x1 - 8, z0: FENCE.z0 + 8, z1: FENCE.z1 - 2 };
  t.concrete(inner.x0, inner.z0, inner.x1, inner.z1);

  // Canteros de césped dentro del predio
  lawn(inner.x0, inner.z0, inner.x1, -78);
  lawn(98, -76, inner.x1, -20);
  lawn(-112, -76, -102, -20);
  lawn(inner.x0, 64, -70, inner.z1);
  lawn(-34, 64, -18, 80);
  lawn(86, 64, inner.x1, inner.z1);
  lawn(-22, -2, -2, 28);
  lawn(-112, -8, -110.5, 54);

  const hw = RING.w / 2;
  // Playa de estacionamiento
  asphalt(RING.x0 + hw, RING.z0 + hw, -26, RING.z1 - hw);
  // Anillo
  asphalt(RING.x0 - hw, RING.z0 - hw, RING.x1 + hw, RING.z0 + hw);
  asphalt(RING.x0 - hw, RING.z1 - hw, RING.x1 + hw, RING.z1 + hw);
  asphalt(RING.x0 - hw, RING.z0 - hw, RING.x0 + hw, RING.z1 + hw);
  asphalt(RING.x1 - hw, RING.z0 - hw, RING.x1 + hw, RING.z1 + hw);
  // Acceso principal
  asphalt(GATE_X - 6, RING.z1, GATE_X + 6, HIGHWAY_Z - HIGHWAY_W / 2);
  // Playón de inactivas + carril
  asphalt(GATE_X + 6, 62, 82, INACTIVE_LANE_Z + 4);
  // Sector fuera de servicio
  asphalt(42, 34, 98, RING.z1 - hw);
  // Playón del taller
  asphalt(-2, 33, 40, RING.z1 - hw);
  // Playón de muelles
  asphalt(-86, RING.z0 + hw, -34, -30);
  asphalt(-86, -30, -34, RING.z0 - hw);
  // Calle de servicio a combustible
  asphalt(-66, RING.z1 + hw, -38, 82);
  // Playa de autos del personal (frente a administración)
  asphalt(56, -32, 98, RING.z0 - hw);
  // Playa de carga de la planta
  asphalt(-12, -38, 38, RING.z0 - hw);

  // Veredas
  vereda(-84, -36, -36, -33.5);
  vereda(-12, -38, 36, -35.5);
  vereda(62, -40, 94, -37);
  vereda(3, 31, 38, 33);

  // Eje central del anillo (discontinuo)
  line(RING.x0, RING.z0, RING.x1, RING.z0, WHITE, 0.15, [3, 3]);
  line(RING.x0, RING.z1, RING.x1, RING.z1, WHITE, 0.15, [3, 3]);
  line(RING.x0, RING.z0, RING.x0, RING.z1, WHITE, 0.15, [3, 3]);
  line(RING.x1, RING.z0, RING.x1, RING.z1, WHITE, 0.15, [3, 3]);
  // Bordes del anillo
  for (const o of [-hw + 0.4, hw - 0.4]) {
    line(RING.x0 - hw, RING.z0 + o, RING.x1 + hw, RING.z0 + o, WHITE, 0.12);
    line(RING.x0 - hw, RING.z1 + o, RING.x1 + hw, RING.z1 + o, WHITE, 0.12);
  }

  // Cajones de estacionamiento (semis: 5.2 m × 17 m)
  for (const s of SLOTS.park) {
    const north = s.key.startsWith('P-N');
    const z0 = north ? -4 : 32, z1 = north ? 14 : 50;
    line(s.x - 2.6, z0, s.x - 2.6, z1, WHITE, 0.14);
    line(s.x + 2.6, z0, s.x + 2.6, z1, WHITE, 0.14);
  }
  // Pasillo central: flechas de sentido
  for (let x = -92; x < -34; x += 18) arrow(x, AISLE_Z, 1);
  for (let x = -80; x < 100; x += 30) { arrow(x, RING.z0 - 2.4, 1); arrow(x + 15, RING.z1 + 2.4, -1); }

  // Bahías del taller (recuadros amarillos)
  for (const s of SLOTS.shop) {
    t.g.strokeStyle = YELLOW; t.g.lineWidth = 0.18 * t.S;
    t.g.strokeRect(t.X(s.x - 2.8), t.Z(34), 5.6 * t.S, 21 * t.S);
  }
  // Sector fuera de servicio: borde rayado amarillo/negro
  hatchRect(43, 35, 97, RING.z1 - hw - 1);
  text('FUERA DE SERVICIO', 70, 38.6, 'rgba(245,197,24,.75)', 2.6);
  // Muelles: líneas guía amarillas
  for (const s of SLOTS.dock) line(s.x, -33.5, s.x, -48, YELLOW, 0.14);
  // Autos del personal: cajones
  for (let x = 58; x <= 96; x += 3) line(x, -31.5, x, -26, WHITE, 0.1);
  // Inactivas: cajones
  for (const s of SLOTS.inactive) { line(s.x - 2.6, 63, s.x - 2.6, 81, WHITE, 0.14); line(s.x + 2.6, 63, s.x + 2.6, 81, WHITE, 0.14); }

  // Sendas peatonales (cebra)
  zebra(GATE_X, RING.z1 + 8, 10, false);
  zebra(-60, RING.z0, 9, false);
  zebra(78, RING.z0, 9, false);
  zebra(20, RING.z1, 9, false);
  // Línea de PARE en el acceso
  line(GATE_X - 5.5, HIGHWAY_Z - HIGHWAY_W / 2 - 3, GATE_X + 5.5, HIGHWAY_Z - HIGHWAY_W / 2 - 3, WHITE, 0.45);
}

// ── Escenario armado ──
const { props, lamps } = buildPropsList();

export const genericScenario: Scenario = {
  key: 'generic',
  bounds: BOUNDS,
  fence: FENCE,
  ring: RING,
  ringPath: ring.ringPath,
  nearestRingPoint: ring.nearestRingPoint,
  highwayZ: HIGHWAY_Z,
  highwayW: HIGHWAY_W,
  hwLaneE: HW_LANE_E,
  hwLaneW: HW_LANE_W,
  gateX: GATE_X,
  gateZ: FENCE.z1,
  gateSide: 1,
  routes: makeRoutes({ gateX: GATE_X, gateJoin: [GATE_X, RING.z1], laneE: HW_LANE_E, laneW: HW_LANE_W, bounds: BOUNDS, side: 1 }),
  buildings: BUILDINGS,
  slots: SLOTS,
  groupFor,
  groupLabel: GROUP_LABEL,
  groupAnchor: GROUP_ANCHOR,
  extraSlots,
  sectors: SECTORS,
  props,
  lamps,
  vegetation: buildVegetationList(),
  walkers: WALKERS,
  shuttles: SHUTTLES,
  paint: paintYard,
};
