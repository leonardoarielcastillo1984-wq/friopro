// ============================================================
// Centro de Control — escenario DADA (predio real)
// Distribución según referencia aérea del establecimiento:
//   · Garita y acceso: noroeste (arriba-izquierda)
//   · Estacionamiento de livianos: norte-centro
//   · Taller: este (naves industriales con bahías al oeste)
//   · Playa de camiones: centro-sur
//   · Semirremolques: franja sur
//   · Fuera de servicio: esquina sudeste
//   · Inactivas: lote de tierra al este (portón de servicio)
// La calle externa corre por el borde norte.
// Eje X = este, eje Z = sur. La cámara mira desde el sudeste.
// ============================================================
import type { VisualStatus } from '../types';
import {
  makeRing, makeRoutes,
  type V2, type Rect, type RingDef, type BuildingDef, type Slot, type SlotGroup,
  type Sector, type PropDef, type VegItem, type WalkerDef, type ShuttleDef,
  type GroundTools, type Scenario, type VehicleKind,
} from './layout-core';

export const BOUNDS: Rect = { x0: -170, x1: 170, z0: -160, z1: 110 };
export const FENCE: Rect = { x0: -110, x1: 110, z0: -96, z1: 58 };

// Lazo de circulación interna (calle norte, calle del taller, calle sur, calle oeste)
export const RING: RingDef = { x0: -86, x1: 58, z0: -56, z1: 30, w: 12 };
export const GATE_X = -86;          // acceso por garita (borde norte, extremo oeste)
export const HIGHWAY_Z = -118;      // calle externa (borde norte)
export const HIGHWAY_W = 15;
export const HW_LANE_E = HIGHWAY_Z - 3.6;   // carril hacia el este (externo)
export const HW_LANE_W = HIGHWAY_Z + 3.6;   // carril hacia el oeste (interno)
export const SERVICE_GATE_Z = 30;   // portón este hacia el lote de inactivas

const H_N = Math.PI;        // mirando al norte (-Z)
const H_S = 0;              // mirando al sur (+Z)
const H_E = Math.PI / 2;    // mirando al este (+X)

export const BUILDINGS: BuildingDef[] = [
  { key: 'garita', model: 'site-office', label: 'GARITA', sub: 'Control de acceso', x: -100, z: -88, rot: 0.55, scale: 1, labelY: 6 },
  { key: 'taller', model: 'warehouse', label: 'TALLER', sub: 'Mantenimiento y reparación', x: 97, z: -46, rot: -Math.PI / 2, scale: 1.4, labelY: 22 },
  { key: 'taller2', model: 'warehouse', label: '', sub: '', x: 97, z: -10, rot: -Math.PI / 2, scale: 1.4, labelY: 22 },
  { key: 'taller-of', model: 'site-office', label: 'OFICINAS TALLER', sub: 'Administración de mantenimiento', x: 84, z: 6, rot: -Math.PI / 2, scale: 0.95, labelY: 7 },
  // Carteles flotantes de zonas (sin edificio)
  { key: 'z-park', model: '', label: 'ESTACIONAMIENTO', sub: 'Camiones y semirremolques', x: -26, z: -10, rot: 0, scale: 1, labelY: 9 },
  { key: 'z-cars', model: '', label: 'ESTACIONAMIENTO', sub: 'Vehículos livianos', x: -22, z: -78, rot: 0, scale: 1, labelY: 7 },
];

// ── Slots por estado ──

// Playa central: 3 filas de camiones (tractores y rígidos)
function parkSlots(): Slot[] {
  const out: Slot[] = [];
  const xs: number[] = [];
  for (let x = -60; x <= 14; x += 6.5) xs.push(x);
  xs.forEach((x, i) => {
    // Fila A (norte): trompa al sur
    out.push({ key: `P-A${i + 1}`, x, z: -34, heading: H_S, attach: [-64, -56], approach: [[-64, -44], [x - 9, -44], [x, -40], [x, -34]], exit: [[x, -26], [-64, -26], [-64, -56]] });
    // Fila B (media): trompa al norte
    out.push({ key: `P-B${i + 1}`, x, z: -6, heading: H_N, attach: [-64, -56], approach: [[-64, -14], [x - 9, -14], [x, -6]], exit: [[x, 2], [-64, 2], [-64, 30]] });
    // Fila C (sur): trompa al sur
    out.push({ key: `P-C${i + 1}`, x, z: 12, heading: H_S, attach: [-64, 30], approach: [[-64, 8], [x - 9, 8], [x, 12]], exit: [[x, 20], [x - 9, 20], [-64, 20], [-64, 30]] });
  });
  return out;
}

// Semirremolques: franja sur del predio, nariz al norte contra el cerco
function semiSlots(): Slot[] {
  const out: Slot[] = [];
  const xs = [-64, -54, -44, -34, -24, 20, 31, 42, 53, 64];
  xs.forEach((x, i) => out.push({
    key: `S${i + 1}`, x, z: 44, heading: H_N, attach: [x, 30],
    approach: [[x, 38], [x, 44]], exit: [[x, 30]],
  }));
  return out;
}

// Bahías del taller: camión mirando al este frente a los portones
function shopSlots(): Slot[] {
  const zs = [-46, -33, -20, -7];
  return zs.map((z, i) => ({
    key: `T${i + 1}`, x: 70, z, heading: H_E, attach: [58, z],
    approach: [[62, z], [70, z]], exit: [[58, z], [58, 30]],
  }));
}

// Vehículos livianos: lote norte, dos filas mirando al sur
function livianosSlots(): Slot[] {
  const out: Slot[] = [];
  for (let x = -54; x <= 12; x += 3.4) {
    out.push({ key: `L-A${out.length + 1}`, x, z: -88, heading: H_S, attach: [-50, -56], approach: [[-50, -70], [x, -70], [x, -84], [x, -88]], exit: [[x, -70], [-50, -70], [-50, -56]] });
  }
  for (let x = -54; x <= 12; x += 6.8) {
    out.push({ key: `L-B${out.length + 1}`, x, z: -72, heading: H_S, attach: [-50, -56], approach: [[-50, -70], [x, -70], [x, -72]], exit: [[x, -66], [-50, -66], [-50, -56]] });
  }
  return out;
}

// Fuera de servicio: esquina sudeste cercada con rayado
function holdSlots(): Slot[] {
  const out: Slot[] = [];
  const zs = [22, 34, 46];
  zs.forEach((z, r) => {
    [88, 100].forEach((x, c) => {
      out.push({
        key: `H${r * 2 + c + 1}`, x, z, heading: H_E, attach: [58, 24],
        approach: [[58, 30], [74, 30], [74, z], [x - 11, z], [x, z]],
        exit: [[x + 11, z], [74, z], [74, 30], [58, 24]],
      });
    });
  });
  return out;
}

// Inactivas: lote de tierra al este, se llega por el portón de servicio
function inactiveSlots(): Slot[] {
  const out: Slot[] = [];
  const zs = [-24, -14, -4, 6, 16, 26];
  [124, 140].forEach((x, c) => {
    zs.forEach((z, r) => {
      out.push({
        key: `I${c * 6 + r + 1}`, x, z, heading: H_N, attach: [58, 28],
        approach: [[104, 28], [x, 28], [x, z]],
        exit: [[x, 28], [104, 28], [58, 28]],
      });
    });
  });
  return out;
}

export const SLOTS: Record<SlotGroup, Slot[]> = {
  park: parkSlots(),
  semi: semiSlots(),
  shop: shopSlots(),
  hold: holdSlots(),
  inactive: inactiveSlots(),
  livianos: livianosSlots(),
};

// Slots virtuales al expandir un agrupamiento
export function extraSlots(group: SlotGroup): Slot[] {
  const mk = (key: string, x: number, z: number, heading: number): Slot =>
    ({ key, x, z, heading, attach: [x, z], approach: [], exit: [], virtual: true });
  const out: Slot[] = [];
  switch (group) {
    case 'park':
      for (let i = 0; i < 4; i++) {
        out.push(mk(`PX-A${i}`, 24 + i * 6.5, -34, H_S));
        out.push(mk(`PX-B${i}`, 24 + i * 6.5, -6, H_N));
        out.push(mk(`PX-C${i}`, 24 + i * 6.5, 12, H_S));
      }
      break;
    case 'semi':
      for (let i = 0; i < 4; i++) out.push(mk(`SX${i}`, -14 + i * 11, 44, H_N));
      break;
    case 'shop':
      for (let i = 0; i < 2; i++) out.push(mk(`TX${i}`, 70, 6 + i * 11, H_E));
      break;
    case 'hold':
      [22, 34].forEach((z, r) => [90, 102].forEach((x, c) => out.push(mk(`HX${r * 2 + c}`, x - 2, z, H_E))));
      break;
    case 'inactive':
      for (let i = 0; i < 4; i++) out.push(mk(`IX${i}`, 132, -24 + i * 10, H_N));
      break;
    case 'livianos':
      for (let i = 0; i < 6; i++) out.push(mk(`LX${i}`, 22 + i * 4, -72, H_S));
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
    default:
      if (kind === 'trailer') return 'semi';
      if (kind === 'pickup') return 'livianos';
      return 'park';
  }
}

export const GROUP_LABEL: Record<SlotGroup, string> = {
  park: 'Estacionamiento', semi: 'Semirremolques', shop: 'Taller', hold: 'Fuera de servicio',
  inactive: 'Inactivas', livianos: 'Vehículos livianos', route: 'En ruta',
};

export const GROUP_ANCHOR: Record<SlotGroup, V2> = {
  park: [-24, -10], semi: [0, 42], shop: [66, -26], hold: [94, 32],
  inactive: [132, 2], livianos: [-22, -78], route: [60, HIGHWAY_Z - 9],
};

// ── Sectores para navegación de cámara ──
export const SECTORS: Sector[] = [
  { key: 'general', label: 'Vista general', x: -6, z: -16, zoom: 1.5 },
  { key: 'garita', label: 'Garita', x: -86, z: -74, zoom: 3.2 },
  { key: 'taller', label: 'Taller', x: 74, z: -26, zoom: 2.5 },
  { key: 'parking', label: 'Estacionamiento', x: -24, z: -8, zoom: 2.3 },
  { key: 'livianos', label: 'Vehículos livianos', x: -22, z: -78, zoom: 3 },
  { key: 'hold', label: 'Fuera de servicio', x: 94, z: 32, zoom: 3 },
];

// ── Props decorativos ──
function buildPropsList(): { props: PropDef[]; lamps: V2[] } {
  const props: PropDef[] = [];
  const p = (n: string, x: number, z: number, r = 0, s = 1) => props.push({ n, x, z, r, s });

  // Garita: bolardos y señalización
  p('bollard', -94, -94.5); p('bollard', -78, -94.5);
  p('stop-sign', -77.5, -90, Math.PI / 2);
  p('traffic-barrel', -92, -60); p('traffic-barrel', -80, -60);
  // Taller: herramientas junto a las bahías
  p('workbench', 76, -52); p('toolbox', 78.5, -52.3, 0.4); p('air-compressor', 76, -3, Math.PI);
  p('toolbox', 74, -3.5, -0.3); p('dumpster', 80, 12, Math.PI / 2);
  p('gas-cylinder', 77, -49.5); p('gas-cylinder', 77.8, -48.7);
  // Pallets y acopio frente al taller
  for (let i = 0; i < 6; i++) p('wooden-pallet', 72 + (i % 3) * 1.8, 4 + Math.floor(i / 3) * 2.2, i * 0.2);
  p('cardboard-box-stack', 77, 5, 0.3); p('pallet-jack', 70, 2, 0.8);
  p('steel-beam-stack', 90, 12, Math.PI / 2); p('concrete-pipe', 98, 12, Math.PI / 2);
  // Sector fuera de servicio: barreras perimetrales
  for (let i = 0; i < 6; i++) p('jersey-barrier', 82, 18 + i * 4.6, Math.PI / 2);
  p('traffic-barrel', 84, 50); p('traffic-barrel', 106, 50);
  // Portón de servicio este + lote de inactivas
  p('traffic-barrel', 108, 24); p('traffic-barrel', 108, 36);
  p('dumpster', 150, -26, 0);
  // Silos del acopio vecino (sudoeste, fuera del cerco)
  for (let i = 0; i < 5; i++) p('fuel-tank', -152 + i * 7.5, 44, Math.PI / 2, 1.15);
  // Silos nordeste (fondo de la imagen)
  for (let i = 0; i < 3; i++) p('fuel-tank', 128 + i * 9, -72, 0, 1.25);
  p('water-tower', 152, -60, 0, 0.85);
  // Autos de personal (relleno visual del lote de livianos, fila B entre slots)
  const cars = ['hatchback', 'pickup-truck', 'hatchback', 'hatchback', 'delivery-van', 'hatchback'];
  [-50.6, -43.8, -37, -23.4, -16.6, -9.8].forEach((x, i) => p(cars[i], x, -80.5, i % 2 ? Math.PI : 0));
  // Luminarias
  const lamps: V2[] = [];
  const lamp = (x: number, z: number, r: number) => { props.push({ n: 'street-light', x, z, r, lamp: true }); lamps.push([x, z]); };
  lamp(-92, -102, 0); lamp(-80, -64, Math.PI);                 // acceso y garita
  for (let x = -80; x <= 40; x += 30) lamp(x, -62.5, 0);       // calle norte
  for (let x = -80; x <= 40; x += 30) lamp(x, 37.5, Math.PI);  // calle sur
  lamp(52, -48, -Math.PI / 2); lamp(52, -16, -Math.PI / 2); lamp(52, 14, -Math.PI / 2); // playón taller
  lamp(-94, -30, Math.PI / 2); lamp(-94, 8, Math.PI / 2);      // calle oeste
  lamp(-30, -66, 0); lamp(10, -66, 0);                         // lote de livianos
  lamp(-20, 44, Math.PI); lamp(36, 44, Math.PI);               // franja de semis
  lamp(96, 18, Math.PI);                                       // fuera de servicio
  lamp(124, -30, 0); lamp(144, 30, Math.PI);                   // lote de inactivas
  return { props, lamps };
}

// ── Vegetación ──
function buildVegetationList(): VegItem[] {
  const items: VegItem[] = [];
  let seed = 23;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const plant = (x: number, z: number) => items.push({ x: x + (r() - 0.5) * 3, z: z + (r() - 0.5) * 3, rot: r() * Math.PI * 2, scale: 0.8 + r() * 0.5, sway: r() > 0.45 });
  const bush = (x: number, z: number, s = 1.2) => items.push({ x, z: z + r() * 4, model: 'bush', scale: s, rot: r() * 6 });
  const hedge = (x: number, z: number, s = 0.9) => items.push({ x, z, model: 'hedge', scale: s });

  // Cortina forestal por fuera del cerco
  for (let x = FENCE.x0 - 4; x <= FENCE.x1 + 4; x += 8) {
    if (x > -104 && x < -66) continue; // no tapar el acceso
    plant(x, FENCE.z0 - 8); if (r() > 0.4) plant(x + 4, FENCE.z0 - 16);
  }
  for (let x = FENCE.x0 - 4; x <= FENCE.x1 + 4; x += 9) { plant(x, FENCE.z1 + 7); if (r() > 0.5) plant(x + 4, FENCE.z1 + 15); }
  for (let z = FENCE.z0; z <= FENCE.z1 - 4; z += 9) { plant(FENCE.x0 - 7, z); if (r() > 0.5) plant(FENCE.x0 - 15, z + 4); }
  for (let z = FENCE.z0; z <= FENCE.z1 - 4; z += 9) { if (z > 18 && z < 44) continue; plant(FENCE.x1 + 7, z); }
  // Alrededor del lote de tierra (este)
  for (let z = -30; z < 38; z += 10) plant(162, z);
  for (let x = 116; x < 160; x += 11) plant(x, -36);
  // Banquina de la calle externa
  for (let x = BOUNDS.x0 + 10; x < BOUNDS.x1; x += 14) if (Math.abs(x - GATE_X) > 16) plant(x, -134 - r() * 8);
  // Franja verde entre el lote de livianos y la playa (como en la imagen)
  for (let x = -52; x <= 12; x += 10) plant(x, -60);
  // Árboles dentro del cerco
  for (let z = -80; z < 44; z += 12) plant(-104, z);          // franja oeste
  for (let x = -100; x < -66; x += 9) { plant(x, -70); }      // junto a la garita
  plant(-98, -52); plant(-96, -40);
  for (let x = 24; x < 70; x += 11) plant(x, -80);            // jardín noreste
  for (let x = 24; x < 70; x += 11) { if (r() > 0.4) plant(x + 5, -86); }
  for (let x = -64; x < -30; x += 9) plant(x, 54);            // sudoeste junto a semis
  // Setos del lote de livianos
  for (let x = -56; x <= 14; x += 6) hedge(x, -57.5);
  bush(-100, -78); bush(-104, -70); bush(-76, -52); bush(20, -52);
  items.push({ x: -70, z: 50, model: 'oak-tree', scale: 1.25 });
  items.push({ x: 68, z: 52, model: 'oak-tree', scale: 1.15 });
  return items;
}

// ── Ambientación ──
const WALKERS: WalkerDef[] = [
  { model: 'people/character-male-e', path: [[-84, -89]], idle: 'idle' },                       // guardia en la garita
  { model: 'people/character-male-a', path: [[60, -44], [60, -10]] },                           // mecánico por las bahías
  { model: 'people/character-male-c', path: [[60, -44]], idle: 'interact-right' },              // mecánico en bahía 1
  { model: 'people/character-female-b', path: [[60, -10]], idle: 'interact-right' },            // mecánico en bahía 4
  { model: 'people/character-male-a', path: [[72, 4]], idle: 'pick-up' },                       // operario con pallets
  { model: 'people/character-male-c', path: [[-40, 38], [40, 38]] },                            // operario por la franja de semis
  { model: 'people/character-female-b', path: [[-48, -64], [8, -64]] },                         // personal hacia el lote
];

const SHUTTLES: ShuttleDef[] = [
  { a: [[54, -16], [62, -6], [70, -6]], start: [52, -20] },    // autoelevador del taller
  { a: [[-50, 24], [-24, 24], [-10, 24]], start: [-54, 26] },  // autoelevador de la playa
];

// ── Pintado del suelo ──
export function paintYard(t: GroundTools) {
  const { asphalt, lawn, vereda, dirt, line, arrow, zebra, hatchRect, text } = t;
  const { WHITE, YELLOW } = t;
  const hw = RING.w / 2;

  // Playa general de hormigón dentro del cerco
  t.concrete(FENCE.x0 + 8, FENCE.z0 + 8, FENCE.x1 - 8, FENCE.z1 - 4);

  // Canteros de césped
  lawn(-102, -88, -96, 50);            // franja oeste interior
  lawn(-96, -60, -70, -50);            // isla junto a la garita
  lawn(-58, -62, 18, -56);             // divisor lote de livianos / playa
  lawn(20, -88, 102, -66);             // jardín noreste
  lawn(-102, 46, -70, 50);             // sudoeste
  lawn(72, 46, 102, 50);               // sudeste (entre semis y hold)
  lawn(-102, -88, -60, -62);           // entorno de la garita (oeste)
  lawn(-60, -94, 18, -90);             // borde norte del lote de livianos

  // Calle externa → acceso por la garita
  asphalt(GATE_X - 7, HIGHWAY_Z + HIGHWAY_W / 2, GATE_X + 7, RING.z0);
  // Lazo de circulación interna
  asphalt(RING.x0 - hw, RING.z0 - hw, RING.x1 + hw, RING.z0 + hw);  // calle norte
  asphalt(RING.x0 - hw, RING.z1 - hw, RING.x1 + hw, RING.z1 + hw);  // calle sur
  asphalt(RING.x0 - hw, RING.z0 - hw, RING.x0 + hw, RING.z1 + hw);  // calle oeste
  asphalt(RING.x1 - hw, RING.z0 - hw, RING.x1 + hw, RING.z1 + hw);  // calle del taller
  // Playón del taller (bahías frente al edificio)
  asphalt(52, -52, 78, 6);
  // Lote de vehículos livianos
  asphalt(-58, -90, 18, -64);
  // Calles internas de la playa de camiones
  asphalt(-92, -46, 20, -38);
  asphalt(-92, -20, 20, -10);
  asphalt(-92, 2, 20, 10);
  asphalt(-92, 18, 58, 22);
  // Franja de semirremolques (sur)
  asphalt(-70, 38, 70, 56);
  // Calle al portón de servicio este
  asphalt(58, 24, 112, 36);
  // Lote de tierra (inactivas)
  dirt(112, -30, 160, 36);
  // Zona fuera de servicio: piso de hormigón
  t.concrete(82, 16, 108, 52);

  // Veredas junto al taller y la garita
  vereda(58, -54, 78, -51);
  vereda(-102, -92, -92, -84);

  // Eje central del lazo (discontinuo) + bordes
  line(RING.x0, RING.z0, RING.x1, RING.z0, WHITE, 0.15, [3, 3]);
  line(RING.x0, RING.z1, RING.x1, RING.z1, WHITE, 0.15, [3, 3]);
  line(RING.x0, RING.z0, RING.x0, RING.z1, WHITE, 0.15, [3, 3]);
  line(RING.x1, RING.z0, RING.x1, RING.z1, WHITE, 0.15, [3, 3]);
  for (const o of [-hw + 0.4, hw - 0.4]) {
    line(RING.x0 - hw, RING.z0 + o, RING.x1 + hw, RING.z0 + o, WHITE, 0.12);
    line(RING.x0 - hw, RING.z1 + o, RING.x1 + hw, RING.z1 + o, WHITE, 0.12);
  }
  // Eje del acceso
  line(GATE_X, HIGHWAY_Z + HIGHWAY_W / 2 + 2, GATE_X, RING.z0 - 4, WHITE, 0.15, [3, 3]);
  // Eje de la calle al portón este
  line(60, 30, 108, 30, WHITE, 0.12, [3, 3]);

  // Cajones de estacionamiento de camiones
  const rows: { z0: number; z1: number }[] = [
    { z0: -40, z1: -22 },   // fila A (frente sur)
    { z0: -16, z1: 2 },     // fila B (frente norte)
    { z0: 4, z1: 20 },      // fila C (frente sur)
  ];
  for (const s of SLOTS.park) {
    const r = rows[Math.floor((+s.key.slice(3) - 1) )] ?? rows[0];
    line(s.x - 2.6, r.z0, s.x - 2.6, r.z1, WHITE, 0.13);
    line(s.x + 2.6, r.z0, s.x + 2.6, r.z1, WHITE, 0.13);
  }
  // Cajones de semirremolques
  for (const s of SLOTS.semi) {
    line(s.x - 4.4, 38, s.x - 4.4, 54, WHITE, 0.13);
    line(s.x + 4.4, 38, s.x + 4.4, 54, WHITE, 0.13);
  }
  // Cajones del lote de livianos
  for (const s of SLOTS.livianos) {
    const back = s.key.startsWith('L-A');
    const z0 = back ? -90 : -78, z1 = back ? -82 : -66;
    line(s.x - 1.6, z0, s.x - 1.6, z1, WHITE, 0.1);
  }

  // Bahías del taller: recuadros amarillos frente a los portones
  for (const s of SLOTS.shop) {
    t.g.strokeStyle = YELLOW; t.g.lineWidth = 0.18 * t.S;
    t.g.strokeRect(t.X(62), t.Z(s.z - 3.6), 16 * t.S, 7.2 * t.S);
  }
  // Sector fuera de servicio: rayado + leyenda
  hatchRect(82, 16, 108, 52);
  text('FUERA DE SERVICIO', 95, 20.4, 'rgba(245,197,24,.75)', 2.2);
  // Lote de inactivas: cajones en la tierra
  for (const s of SLOTS.inactive) {
    line(s.x - 5.4, s.z - 7, s.x - 5.4, s.z + 7, 'rgba(240,240,232,.55)', 0.13);
    line(s.x + 5.4, s.z - 7, s.x + 5.4, s.z + 7, 'rgba(240,240,232,.55)', 0.13);
  }

  // Flechas de sentido
  for (let x = -70; x < 40; x += 26) arrow(x, RING.z0 - 2.6, 1);
  for (let x = -70; x < 40; x += 26) arrow(x + 13, RING.z1 + 2.6, -1);
  arrow(GATE_X + 3.5, -80, 1);
  arrow(-70, -42, 1); arrow(-30, -42, 1);
  arrow(-70, -15, 1); arrow(-30, -15, 1);
  arrow(-70, 6, 1); arrow(-30, 6, 1);
  arrow(84, 33, 1);

  // Sendas peatonales
  zebra(GATE_X, -60, 10, false);
  zebra(58, -28, 8, true);
  zebra(-50, -62, 8, false);
  // Línea de PARE en el acceso (cruzando la calle interna)
  line(GATE_X - 6, RING.z0 - hw - 1.4, GATE_X + 6, RING.z0 - hw - 1.4, WHITE, 0.45);
}

// ── Escenario armado ──
const ring = makeRing(RING);
const { props, lamps } = buildPropsList();

export const dadaScenario: Scenario = {
  key: 'dada',
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
  gateZ: FENCE.z0,
  gateSide: -1,
  extraGates: [{ x: 0, z: SERVICE_GATE_Z, edge: 'E' }],
  routes: makeRoutes({ gateX: GATE_X, gateJoin: [GATE_X, RING.z0], laneE: HW_LANE_E, laneW: HW_LANE_W, bounds: BOUNDS, side: -1 }),
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
