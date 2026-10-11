// ============================================================
// Centro de Control — escenario DADA (predio real)
// Distribución según referencia aérea del establecimiento:
//   · Garita y acceso: esquina noroeste, sobre la calle externa norte
//   · Lavadero de camiones: franja norte, entre la garita y el taller
//   · Taller: nave industrial dominante centro-este (multi-caballete),
//     con dársenas de camiones en su cara oeste y sur
//   · Playa de camiones: gran patio de hormigón abierto centro-sur,
//     con filas de semirremolques DADA al sur
//   · Calle de salida: boulevard dedicado en la franja oeste hacia el portón
//   · Fuera de servicio: esquina sudeste cercada con rayado
//   · Inactivas: lote de tierra al este (portón de servicio)
//   · Frente del taller (sur): boxes interiores con unidad a medio entrar
//     + dársenas amplias de espera identificadas con recuadro amarillo
//   · Alrededores: tierra pelada al noroeste, franja de pasto y árboles al este
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

// Lazo de circulación interna: calle oeste (bajada de la garita),
// calle norte (borde sur de la playa de autos), calle este (apron de
// dársenas del taller) y calle sur (cruce del patio hacia los semis).
export const RING: RingDef = { x0: -82, x1: 22, z0: -54, z1: 26, w: 12 };
export const GATE_X = -86;          // acceso por garita (borde norte, extremo oeste)
export const HIGHWAY_Z = -118;      // calle externa (borde norte)
export const HIGHWAY_W = 15;
export const HW_LANE_E = HIGHWAY_Z - 3.6;   // carril hacia el este (externo)
export const HW_LANE_W = HIGHWAY_Z + 3.6;   // carril hacia el oeste (interno)
export const SERVICE_GATE_Z = 26;   // portón este hacia el lote de inactivas

const H_N = Math.PI;        // mirando al norte (-Z)
const H_S = 0;              // mirando al sur (+Z)
const H_E = Math.PI / 2;    // mirando al este (+X)
const H_W = -Math.PI / 2;   // mirando al oeste (-X): culata contra la nave

export const BUILDINGS: BuildingDef[] = [
  { key: 'garita', model: 'site-office', label: 'GARITA', sub: 'Control de acceso', x: -99, z: -87, rot: 0.5, scale: 1, labelY: 6 },
  // Taller: nave industrial dominante del predio (multi-caballete)
  { key: 'taller', model: 'factory', label: 'TALLER', sub: 'Mantenimiento y reparación', x: 64, z: -20, rot: 0, scale: 1.8, labelY: 30 },
  // Lavadero de camiones (franja norte, junto a la garita)
  { key: 'lavadero', model: 'car-wash', label: 'LAVADERO', sub: 'Lavado de unidades', x: 20, z: -87, rot: 0, scale: 1.2, labelY: 10 },
];

// ── Slots por estado ──

// Tractores (sin acoplado): dos filas enfrentadas en la mitad norte del patio,
// cajones cerrados tipo dársena — más angostos porque el tractor va bobtail
function tractoresSlots(): Slot[] {
  const out: Slot[] = [];
  for (let x = -56; x <= 7; x += 7) {
    // Fila A (norte): trompa al norte
    out.push({ key: `TR-A${out.length + 1}`, x, z: -18, heading: H_N, attach: [-82, -18], approach: [[-74, -18], [x - 8, -18], [x, -18]], exit: [[x, -8], [-74, -8], [-74, 26]] });
    // Fila B (sur): trompa al sur
    out.push({ key: `TR-B${out.length + 1}`, x, z: -2, heading: H_S, attach: [-82, 26], approach: [[-74, 26], [-74, 16], [x - 8, 16], [x, -2]], exit: [[x, 16], [-74, 16], [-74, 26]] });
  }
  return out;
}

// Camiones rígidos (vehículos de tracción con chasis): fila al sur de tractores
function rigidSlots(): Slot[] {
  const out: Slot[] = [];
  for (let x = -56; x <= -4; x += 6.5) {
    out.push({ key: `R-A${out.length + 1}`, x, z: 13, heading: H_S, attach: [-82, 26], approach: [[-74, 26], [-74, 18], [x - 9, 18], [x, 13]], exit: [[x, 18], [-74, 18], [-74, 26]] });
  }
  return out;
}

// Semirremolques: dos filas ordenadas al sur del patio (como en la imagen)
function semiSlots(): Slot[] {
  const out: Slot[] = [];
  const xs = [-48, -39, -30, -21, -12, -3, 6, 24, 33, 42, 51, 60];
  xs.forEach((x, i) => out.push({
    key: `S-A${i + 1}`, x, z: 38, heading: H_N, attach: [x, 26],
    approach: [[x, 32], [x, 38]], exit: [[x, 26]],
  }));
  const xs2 = [-42, -33, -24, -15, -6, 3, 12];
  xs2.forEach((x, i) => out.push({
    key: `S-B${i + 1}`, x, z: 52, heading: H_N, attach: [x, 26],
    approach: [[x, 34], [x, 46], [x, 52]], exit: [[x, 34], [x, 26]],
  }));
  return out;
}

// Rigs (tractor + semi sin desacoplar, según checklist): extremo este de la fila sur
function rigSlots(): Slot[] {
  return [30, 39, 48].map((x, i) => ({
    key: `RIG-${i + 1}`, x, z: 52, heading: H_N, attach: [x, 26],
    approach: [[x, 34], [x, 46], [x, 52]], exit: [[x, 34], [x, 26]],
  }));
}

// Taller: boxes interiores (unidad a medio entrar por el portón del frente)
// + dársenas de espera amplias sobre el frente sur (esperando reparación)
function shopSlots(): Slot[] {
  const out: Slot[] = [];
  [50, 66, 82].forEach((x, i) => {
    out.push({
      key: `T-I${i + 1}`, x, z: 15.5, heading: H_N, attach: [20, 24],
      approach: [[20, 24], [x - 14, 24], [x, 15.5]], exit: [[x - 14, 24], [20, 24]],
    });
  });
  [44, 60, 76, 92].forEach((x, i) => {
    out.push({
      key: `T-S${i + 1}`, x, z: 26, heading: H_N, attach: [20, 24],
      approach: [[20, 24], [x - 14, 24], [x, 26]], exit: [[x - 14, 24], [20, 24]],
    });
  });
  return out;
}

// Lavadero: 2 boxes de lavado dentro de la nave + cola de espera
function livianosSlots(): Slot[] {
  const out: Slot[] = [];
  [10, 25].forEach((x, i) => {
    out.push({ key: `L-W${i + 1}`, x, z: -87, heading: H_E, attach: [-50, -54], approach: [[-50, -60], [x - 16, -60], [x - 16, -80], [x, -87]], exit: [[x + 8, -87], [40, -80], [40, -60], [-50, -60], [-50, -54]] });
  });
  for (let x = -46; x <= 24; x += 7) {
    out.push({ key: `L-C${out.length + 1}`, x, z: -74, heading: H_N, attach: [-50, -54], approach: [[-50, -60], [x, -60], [x, -74]], exit: [[x, -60], [-50, -60], [-50, -54]] });
  }
  return out;
}

// Fuera de servicio: esquina sudeste cercada con rayado
function holdSlots(): Slot[] {
  const out: Slot[] = [];
  const zs = [36, 46];
  zs.forEach((z, r) => {
    [88, 100].forEach((x, c) => {
      out.push({
        key: `H${r * 2 + c + 1}`, x, z, heading: H_E, attach: [22, 26],
        approach: [[22, 26], [76, 26], [x - 11, z], [x, z]],
        exit: [[x - 11, z], [76, 26], [22, 26]],
      });
    });
  });
  return out;
}

// Inactivas: lote de tierra al este, se llega por el portón de servicio
function inactiveSlots(): Slot[] {
  const out: Slot[] = [];
  const zs = [-16, -6, 4, 14, 24];
  [122, 138].forEach((x, c) => {
    zs.forEach((z, r) => {
      out.push({
        key: `I${c * 6 + r + 1}`, x, z, heading: H_N, attach: [22, 26],
        approach: [[76, 26], [104, 26], [x, 26], [x, z]],
        exit: [[x, 26], [104, 26], [76, 26]],
      });
    });
  });
  return out;
}

export const SLOTS: Record<SlotGroup, Slot[]> = {
  tractores: tractoresSlots(),
  rigid: rigidSlots(),
  semi: semiSlots(),
  rig: rigSlots(),
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
    case 'tractores':
      for (let i = 0; i < 2; i++) out.push(mk(`TRX${i}`, -63 - i * 7, -18, H_N));
      for (let i = 0; i < 2; i++) out.push(mk(`TRY${i}`, -63 - i * 7, -2, H_S));
      break;
    case 'rigid':
      for (let i = 0; i < 3; i++) out.push(mk(`RX${i}`, 2.5 + i * 6.5, 13, H_S));
      break;
    case 'rig':
      for (let i = 0; i < 2; i++) out.push(mk(`RIGX${i}`, 57 + i * 9, 52, H_N));
      break;
    case 'semi':
      out.push(mk('SX-A0', 15, 38, H_N)); out.push(mk('SX-A1', -57, 38, H_N));
      out.push(mk('SX-B0', 21, 52, H_N)); out.push(mk('SX-B1', 57, 52, H_N)); out.push(mk('SX-B2', -51, 52, H_N));
      break;
    case 'shop':
      for (let i = 0; i < 3; i++) out.push(mk(`TX${i}`, 23, -2 - i * 14, H_W));
      break;
    case 'hold':
      [36, 46].forEach((z, r) => out.push(mk(`HX${r}`, 76, z, H_E)));
      break;
    case 'inactive':
      for (let i = 0; i < 4; i++) out.push(mk(`IX${i}`, 154, -16 + i * 10, H_N));
      break;
    case 'livianos':
      [-60, -53, 31, 38, 45, 52].forEach((x, i) => out.push(mk(`LX${i}`, x, -74, H_N)));
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
      if (kind === 'tractor') return 'tractores';
      return 'rigid';
  }
}

export const GROUP_LABEL: Record<SlotGroup, string> = {
  tractores: 'Tractores', rigid: 'Camiones', semi: 'Semirremolques', rig: 'Acopladas',
  shop: 'Taller', hold: 'Fuera de servicio', inactive: 'Inactivas', livianos: 'Lavadero', route: 'En ruta',
};

export const GROUP_ANCHOR: Record<SlotGroup, V2> = {
  tractores: [-30, -10], rigid: [-30, 13], semi: [4, 44], rig: [40, 46], shop: [66, 22], hold: [92, 40],
  inactive: [132, 6], livianos: [-10, -78], route: [60, HIGHWAY_Z - 9],
};

// ── Sectores para navegación de cámara ──
export const SECTORS: Sector[] = [
  { key: 'general', label: 'Vista general', x: -2, z: -14, zoom: 1.5 },
  { key: 'garita', label: 'Garita', x: -88, z: -74, zoom: 3.2 },
  { key: 'taller', label: 'Taller', x: 64, z: -18, zoom: 2.2 },
  { key: 'parking', label: 'Playa de camiones', x: -10, z: 16, zoom: 2.4 },
  { key: 'livianos', label: 'Lavadero', x: -10, z: -78, zoom: 3 },
  { key: 'hold', label: 'Fuera de servicio', x: 90, z: 40, zoom: 3 },
];

// ── Props decorativos ──
function buildPropsList(): { props: PropDef[]; lamps: V2[] } {
  const props: PropDef[] = [];
  const p = (n: string, x: number, z: number, r = 0, s = 1) => props.push({ n, x, z, r, s });

  // Garita: bolardos y señalización
  p('bollard', -94, -95); p('bollard', -78, -95);
  p('stop-sign', -77.5, -90, Math.PI / 2);
  p('traffic-barrel', -94, -60); p('traffic-barrel', -78, -60);
  // Junto a los portones del taller: bancos de trabajo y herramientas
  p('workbench', 40, 17); p('toolbox', 42.5, 17.3, 0.4);
  p('air-compressor', 96, 17, Math.PI); p('toolbox', 94, 17.5, -0.3);
  p('gas-cylinder', 43, 19.5); p('gas-cylinder', 43.8, 20.3);
  p('dumpster', 106, 12, Math.PI / 2);
  // Pallets junto al borde oeste del frente del taller
  for (let i = 0; i < 9; i++) p('wooden-pallet', 26 + (i % 3) * 2.4, 14 + Math.floor(i / 3) * 2.6, i * 0.2);
  p('cardboard-box-stack', 34, 16.5, 0.3); p('cardboard-box-stack', 36.5, 17.5, -0.4);
  p('pallet-jack', 40, 16, -0.6); p('pallet-jack', 104, 16, -0.6);
  p('steel-beam-stack', 108, 18, Math.PI / 2); p('concrete-pipe', 110, 24, Math.PI / 2);
  // Sector fuera de servicio: barreras perimetrales
  for (let i = 0; i < 5; i++) p('jersey-barrier', 78, 32 + i * 4.6, Math.PI / 2);
  p('traffic-barrel', 80, 52); p('traffic-barrel', 106, 52);
  // Portón de servicio este + lote de inactivas
  p('traffic-barrel', 108, 20); p('traffic-barrel', 108, 32);
  p('dumpster', 150, -20, 0);
  // Tanques de agua del lavadero (a la espalda de la nave)
  p('fuel-tank', 36, -91, 0, 1); p('fuel-tank', 36, -85, 0, 1);
  p('traffic-barrel', 3, -80); p('traffic-barrel', 34, -80);
  p('toolbox', 4, -90, 0.4);
  // Calle de salida oeste: balizas de canalización
  for (let z = -40; z <= 48; z += 22) { p('traffic-barrel', -90, z); p('traffic-barrel', -104, z); }
  // Algunos livianos de personal cerca del lavadero
  const cars = ['hatchback', 'pickup-truck', 'hatchback'];
  [-43.2, -36.4, -29.6].forEach((x, i) => p(cars[i], x, -64.5, i % 2 ? Math.PI : 0));
  // Luminarias
  const lamps: V2[] = [];
  const lamp = (x: number, z: number, r: number) => { props.push({ n: 'street-light', x, z, r, lamp: true }); lamps.push([x, z]); };
  lamp(-94, -100, 0); lamp(-78, -58, Math.PI);                 // acceso y garita
  for (let x = -76; x <= 16; x += 30) lamp(x, -58, 0);         // calle norte
  for (let x = -76; x <= 16; x += 30) lamp(x, 30.5, Math.PI);  // calle sur
  lamp(24, -48, -Math.PI / 2); lamp(24, -18, -Math.PI / 2); lamp(24, 8, -Math.PI / 2); // apron de dársenas
  lamp(-88, -30, Math.PI / 2); lamp(-88, 8, Math.PI / 2);      // calle oeste
  lamp(-46, -62, 0); lamp(20, -62, 0);                         // playa de livianos
  lamp(-30, 44, Math.PI); lamp(30, 44, Math.PI);               // filas de semis
  lamp(94, 28, Math.PI);                                       // fuera de servicio
  lamp(120, -20, 0); lamp(146, 28, Math.PI);                   // lote de inactivas
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
  for (let z = FENCE.z0; z <= FENCE.z1 - 4; z += 9) { if (z > 20 && z < 32) continue; plant(FENCE.x1 + 7, z); }
  // Franja verde del este (entre el taller y el cerco, como en la imagen)
  for (let z = -86; z < 22; z += 10) plant(105, z);
  // Tierra pelada del noroeste: algunos árboles dispersos en los bordes
  for (let x = -160; x < -112; x += 16) plant(x, -142 + r() * 8);
  for (let z = -140; z < -100; z += 14) plant(-162 + r() * 6, z);
  // Banquina de la calle externa
  for (let x = BOUNDS.x0 + 10; x < BOUNDS.x1; x += 14) if (Math.abs(x - GATE_X) > 16) plant(x, -134 - r() * 8);
  // Árboles dentro del predio
  for (let x = -56; x <= 24; x += 12) plant(x, -93);           // fila norte de la playa de autos
  for (let x = -52; x <= 20; x += 14) { if (r() > 0.4) plant(x, -63); } // islas de la playa
  for (let x = -98; x < -68; x += 9) { plant(x, -72); }        // junto a la garita
  items.push({ x: -70, z: -52, model: 'oak-tree', scale: 1.3 }); // árbol de la isla del acceso
  plant(-100, -64);
  for (let x = 34; x < 100; x += 11) plant(x, -80);            // jardín noreste interior
  for (let x = 34; x < 100; x += 11) { if (r() > 0.4) plant(x + 5, -86); }
  for (let z = -50; z < 0; z += 12) plant(106, z);             // borde este del taller
  items.push({ x: -60, z: 54, model: 'oak-tree', scale: 1.1 });
  items.push({ x: -56, z: 46, model: 'oak-tree', scale: 1 });
  for (let x = -52; x <= 60; x += 6) hedge(x, -59.5);          // seto divisor de la playa de autos
  bush(-100, -80); bush(-104, -72); bush(-76, -52); bush(28, -56);
  items.push({ x: -66, z: 46, model: 'oak-tree', scale: 1.2 });
  items.push({ x: 66, z: 54, model: 'oak-tree', scale: 1.1 });
  return items;
}

// ── Ambientación ──
const WALKERS: WalkerDef[] = [
  { model: 'people/character-male-e', path: [[-84, -89]], idle: 'idle' },                       // guardia en la garita
  { model: 'people/character-male-a', path: [[26, -44], [26, -6]] },                            // mecánico por las dársenas
  { model: 'people/character-male-c', path: [[42, 23]], idle: 'interact-right' },              // mecánico en dársena de espera
  { model: 'people/character-female-b', path: [[88, 23]], idle: 'interact-right' },            // mecánico en dársena de espera
  { model: 'people/character-male-a', path: [[29, 15]], idle: 'pick-up' },                      // operario con pallets
  { model: 'people/character-male-c', path: [[-44, 34], [44, 34]] },                            // operario por las filas de semis
  { model: 'people/character-female-b', path: [[-16, -70], [20, -70]] },                        // operaria del lavadero
];

const SHUTTLES: ShuttleDef[] = [
  { a: [[-44, 36], [4, 36], [40, 36]], start: [-50, 38] },     // autoelevador de los semis
];

// ── Pintado del suelo ──
export function paintYard(t: GroundTools) {
  const { asphalt, lawn, vereda, dirt, line, arrow, zebra, hatchRect, text } = t;
  const { WHITE, YELLOW } = t;
  const hw = RING.w / 2;

  // Playa general de hormigón dentro del cerco
  t.concrete(FENCE.x0 + 6, FENCE.z0 + 6, FENCE.x1 - 4, FENCE.z1 - 4);

  // Tierra pelada del noroeste, por fuera del cerco
  dirt(-168, -152, -112, -100);
  // Lote de tierra de inactivas (este)
  dirt(112, -24, 162, 40);

  // Canteros de césped
  lawn(-76, -68, -62, -58);            // isla del acceso (junto a la garita)
  lawn(32, -92, 100, -62);             // jardín noreste interior
  lawn(102, -92, 108, 24);             // franja este interior
  lawn(-108, -92, -60, -70);           // entorno de la garita
  lawn(-108, 52, -94, 56);             // esquina sudoeste

  // Calle externa → acceso por la garita
  asphalt(GATE_X - 7, HIGHWAY_Z + HIGHWAY_W / 2, GATE_X + 7, RING.z0);
  // Lazo de circulación interna
  asphalt(RING.x0 - hw, RING.z0 - hw, RING.x1 + hw, RING.z0 + hw);  // calle norte
  asphalt(RING.x0 - hw, RING.z1 - hw, RING.x1 + hw, RING.z1 + hw);  // calle sur
  asphalt(RING.x0 - hw, RING.z0 - hw, RING.x0 + hw, RING.z1 + hw);  // calle oeste
  asphalt(RING.x1 - hw, RING.z0 - hw, RING.x1 + hw, RING.z1 + hw);  // calle este
  // Apron oeste del taller (calle de maniobra) + frente sur amplio con dársenas
  asphalt(14, -54, 28, 12);
  asphalt(20, 14, 104, 32);
  // Losa de la nave del taller
  t.concrete(28, -56, 102, 14);
  // Apron del lavadero (franja norte)
  asphalt(-52, -92, 28, -62);
  // Calle de salida oeste (ex acopio): boulevard dedicado hacia el portón
  asphalt(-105, -52, -89, 56);
  line(-97, -48, -97, 52, WHITE, 0.12, [3, 3]);
  text('SALIDA', -97, -38, 'rgba(240,240,232,.7)', 3);
  text('SALIDA', -97, 44, 'rgba(240,240,232,.7)', 3);
  // Franja de semirremolques (sur)
  asphalt(-58, 32, 66, 56);
  // Calle al portón de servicio este
  asphalt(22, 20, 112, 32);
  // Zona fuera de servicio: piso de hormigón
  t.concrete(76, 30, 106, 52);

  // Vereda junto a la garita
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
  line(30, 26, 108, 26, WHITE, 0.12, [3, 3]);

  // Cajones cerrados tipo dársena por tipo de unidad
  t.g.strokeStyle = WHITE; t.g.lineWidth = 0.12 * t.S;
  for (const s of SLOTS.tractores) {
    t.g.strokeRect(t.X(s.x - 2.5), t.Z(s.z - 4.2), 5 * t.S, 8.4 * t.S);
  }
  for (const s of SLOTS.rigid) {
    t.g.strokeRect(t.X(s.x - 2.6), t.Z(s.z - 5.5), 5.2 * t.S, 11 * t.S);
  }
  text('TRACTORES', -32, -25.8, 'rgba(240,240,232,.7)', 2.4);
  text('CAMIONES', -32, 19.5, 'rgba(240,240,232,.7)', 2.4);
  // Cajones de semirremolques y de unidades acopladas (rig)
  for (const s of [...SLOTS.semi, ...SLOTS.rig]) {
    const z0 = s.z - 6;
    line(s.x - 4.4, z0, s.x - 4.4, z0 + 12, WHITE, 0.13);
    line(s.x + 4.4, z0, s.x + 4.4, z0 + 12, WHITE, 0.13);
    line(s.x - 4.4, z0 + 12, s.x + 4.4, z0 + 12, WHITE, 0.13);
  }
  text('SEMIRREMOLQUES', 4, 30.2, 'rgba(240,240,232,.7)', 2.4);
  // Carriles del lavadero: dos vías de lavado + cola pintada
  line(2, -92, 2, -78, WHITE, 0.13);
  line(36, -92, 36, -78, WHITE, 0.13);
  line(19, -92, 19, -66, WHITE, 0.1, [2.5, 2.5]);
  text('LAVADERO', 10, -63.5, 'rgba(240,240,232,.7)', 2.4);
  for (const s of SLOTS.livianos) {
    if (s.key.startsWith('L-W')) continue;
    line(s.x - 3.4, -78, s.x - 3.4, -70, WHITE, 0.1);
  }

  // Dársenas de espera del taller: recuadros amarillos amplios (esperan reparación)
  for (const s of SLOTS.shop) {
    if (s.key.startsWith('T-I')) continue;   // boxes interiores: sin recuadro
    t.g.strokeStyle = YELLOW; t.g.lineWidth = 0.18 * t.S;
    t.g.strokeRect(t.X(s.x - 8), t.Z(19.5), 16 * t.S, 13 * t.S);
  }
  text('ESPERA TALLER', 62, 33.8, 'rgba(245,197,24,.7)', 2.2);
  // Sector fuera de servicio: rayado + leyenda
  hatchRect(76, 30, 106, 52);
  text('FUERA DE SERVICIO', 91, 34.4, 'rgba(245,197,24,.75)', 2.2);
  // Lote de inactivas: cajones en la tierra
  for (const s of SLOTS.inactive) {
    line(s.x - 5.4, s.z - 7, s.x - 5.4, s.z + 7, 'rgba(240,240,232,.55)', 0.13);
    line(s.x + 5.4, s.z - 7, s.x + 5.4, s.z + 7, 'rgba(240,240,232,.55)', 0.13);
  }

  // Flechas de sentido
  for (let x = -66; x < 8; x += 26) arrow(x, RING.z0 - 2.6, 1);
  for (let x = -66; x < 8; x += 26) arrow(x + 13, RING.z1 + 2.6, -1);
  arrow(GATE_X + 3.5, -78, 1);
  arrow(-78, -14, 1); arrow(-78, 12, 1);
  arrow(70, 29, 1); arrow(96, 29, 1);

  // Sendas peatonales
  zebra(GATE_X, -60, 10, false);
  zebra(30, -28, 8, true);
  zebra(-52, -62, 8, false);
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
