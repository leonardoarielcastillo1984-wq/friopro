// ============================================================
// Núcleo compartido de escenarios del Centro de Control.
// Tipos + helpers geométricos reutilizables (anillo, rutas a la
// vía externa, asignación de grupos). Cada predio (genérico,
// DADA, futuros) exporta un `Scenario` con su geometría.
// ============================================================
import type { VisualStatus } from '../types';

import type { WorkshopSpec } from './workshop';

export type V2 = [number, number];
export interface Rect { x0: number; z0: number; x1: number; z1: number }

export interface BuildingDef {
  key: string;
  model: string;
  label: string;
  sub: string;
  x: number; z: number;
  rot: number;
  scale: number;
  labelY: number;
  workshop?: WorkshopSpec;
}

export interface Slot {
  key: string;
  x: number; z: number;
  heading: number;
  approach: V2[];
  attach: V2;
  exit: V2[];
  exitReverse?: boolean;
  virtual?: boolean;
}

export type SlotGroup = string;

export interface Sector { key: string; label: string; x: number; z: number; zoom: number }

export interface PropDef { n: string; x: number; z: number; r?: number; s?: number; lamp?: boolean }
export interface VegItem { x: number; z: number; model?: string; scale?: number; rot?: number; jitter?: number; sway?: boolean }
export interface WalkerDef { model: string; path: V2[]; idle?: string }
export interface ShuttleDef { a: V2[]; start: V2 }

export type VehicleKind = 'tractor' | 'trailer' | 'rigid' | 'pickup' | 'tow';

export function kindFor(tipo: string | undefined | null): VehicleKind {
  const t = (tipo || '').toUpperCase();
  if (t.includes('TRACTOR')) return 'tractor';
  if (t.includes('SEMI') || t.includes('ACOPLADO') || t.includes('REMOLQUE')) return 'trailer';
  if (t.includes('GRUA') || t.includes('GRÚA')) return 'tow';
  if (t.includes('CAMIONETA') || t.includes('PICK') || t.includes('UTIL')) return 'pickup';
  return 'rigid';
}

export const STATUS_COLOR: Record<VisualStatus, number> = {
  disponible: 0x22c55e,
  en_viaje: 0x38bdf8,
  en_taller: 0xf59e0b,
  fuera_servicio: 0xef4444,
  mantenimiento_proximo: 0xeab308,
  inactiva: 0x64748b,
};

// ── Anillo rectangular de circulación interna ──
export interface RingDef { x0: number; x1: number; z0: number; z1: number; w: number }

export function makeRing(ring: RingDef) {
  const RW = ring.x1 - ring.x0;
  const RH = ring.z1 - ring.z0;
  const LEN = 2 * (RW + RH);
  const CORNERS: V2[] = [[ring.x0, ring.z0], [ring.x1, ring.z0], [ring.x1, ring.z1], [ring.x0, ring.z1]];
  const CORNER_S = [0, RW, RW + RH, 2 * RW + RH];

  function ringParam([x, z]: V2): number {
    const d = [Math.abs(z - ring.z0), Math.abs(x - ring.x1), Math.abs(z - ring.z1), Math.abs(x - ring.x0)];
    const e = d.indexOf(Math.min(...d));
    if (e === 0) return x - ring.x0;
    if (e === 1) return RW + (z - ring.z0);
    if (e === 2) return RW + RH + (ring.x1 - x);
    return 2 * RW + RH + (ring.z1 - z);
  }

  // Puntos de esquina a recorrer entre dos puntos del anillo (camino más corto)
  function ringPath(a: V2, b: V2): V2[] {
    const sa = ringParam(a), sb = ringParam(b);
    const fwd = (sb - sa + LEN) % LEN;
    const dir = fwd <= LEN / 2 ? 1 : -1;
    const dist = dir === 1 ? fwd : LEN - fwd;
    const pts: V2[] = [];
    const cs = CORNER_S.map((s, i) => ({ s, p: CORNERS[i] }));
    const off = (s: number) => dir === 1 ? (s - sa + LEN) % LEN : (sa - s + LEN) % LEN;
    cs.filter((c) => off(c.s) > 0.5 && off(c.s) < dist - 0.5).sort((p, q) => off(p.s) - off(q.s)).forEach((c) => pts.push(c.p));
    return pts;
  }

  function nearestRingPoint(x: number, z: number): V2 {
    const cands: V2[] = [
      [Math.min(Math.max(x, ring.x0), ring.x1), ring.z0],
      [Math.min(Math.max(x, ring.x0), ring.x1), ring.z1],
      [ring.x0, Math.min(Math.max(z, ring.z0), ring.z1)],
      [ring.x1, Math.min(Math.max(z, ring.z0), ring.z1)],
    ];
    let best = cands[0], bd = Infinity;
    for (const c of cands) { const d = Math.hypot(c[0] - x, c[1] - z); if (d < bd) { bd = d; best = c; } }
    return best;
  }

  return { LEN, ringParam, ringPath, nearestRingPoint };
}

// ── Rutas entre la calle externa y el portón ──
// side = +1 → la calle está al SUR (z crece al salir); side = -1 → NORTE.
export interface RouteCfg {
  gateX: number;
  gateJoin: V2;             // punto del anillo junto al portón
  laneE: number; laneW: number;
  bounds: { x0: number; x1: number };
  side: 1 | -1;
}

export interface Routes {
  // Del portón hacia el carril este de la calle externa
  outToHighway(): V2[];
  // De la calle externa hacia el portón (según posición/sentido del camión)
  inFromHighway(x: number, dir: 1 | -1): { pts: V2[]; relaunch?: { x: number; lane: number; rot: number; dir: 1 | -1 } };
  gateJoin: V2;
}

export function makeRoutes(c: RouteCfg): Routes {
  const s = c.side;
  const mid: V2[] = [[c.gateX + 1.5, c.gateJoin[1] + 35 * s], [c.gateX + 1.5, c.gateJoin[1] + 14 * s]];
  const tail = (): V2[] => [...mid.slice().reverse(), c.gateJoin];
  const fromWestPts: V2[] = [[c.gateX - 18, c.laneE], [c.gateX - 4, c.laneW + s]];
  const fromEastPts: V2[] = [[c.gateX + 18, c.laneW], [c.gateX + 5, c.laneW - s]];
  return {
    gateJoin: c.gateJoin,
    outToHighway: () => [...mid.map((p): V2 => [p[0], p[1]]), [c.gateX + 5, c.laneE - s], [c.gateX + 18, c.laneE]],
    inFromHighway: (x, dir) => {
      if (dir === 1 && x < c.gateX - 25) return { pts: [...fromWestPts, ...tail()] };
      if (dir === -1 && x > c.gateX + 25) return { pts: [...fromEastPts, ...tail()] };
      // ya pasó el portón: reingresa desde el extremo más cercano
      const fromWest = x < c.gateX;
      const lane = fromWest ? c.laneE : c.laneW;
      const nx = fromWest ? c.bounds.x0 - 10 : c.bounds.x1 + 10;
      return {
        pts: [...(fromWest ? fromWestPts : fromEastPts), ...tail()],
        relaunch: { x: nx, lane, rot: fromWest ? Math.PI / 2 : -Math.PI / 2, dir: fromWest ? 1 : -1 },
      };
    },
  };
}

// ── Herramientas de pintado del suelo (canvas 2D a escala) ──
// Las provee ground.ts; cada escenario implementa paint() con ellas.
export interface GroundTools {
  g: CanvasRenderingContext2D;
  X: (x: number) => number;
  Z: (z: number) => number;
  S: number;
  rect: (x0: number, z0: number, x1: number, z1: number) => void;
  noise: (x0: number, z0: number, x1: number, z1: number, colors: string[], n: number, size: [number, number]) => void;
  asphalt: (x0: number, z0: number, x1: number, z1: number) => void;
  concrete: (x0: number, z0: number, x1: number, z1: number) => void;
  lawn: (x0: number, z0: number, x1: number, z1: number) => void;
  vereda: (x0: number, z0: number, x1: number, z1: number) => void;
  dirt: (x0: number, z0: number, x1: number, z1: number) => void;
  line: (x0: number, z0: number, x1: number, z1: number, color: string, w: number, dash?: number[]) => void;
  arrow: (x: number, z: number, dirX: number) => void;
  zebra: (cx: number, cz: number, len: number, vertical: boolean) => void;
  hatchRect: (x0: number, z0: number, x1: number, z1: number, w?: number) => void;
  text: (txt: string, x: number, z: number, color: string, sizeM: number) => void;
  WHITE: string;
  YELLOW: string;
}

// ── Escenario completo de un predio ──
export interface Scenario {
  key: string;
  bounds: Rect;
  fence: Rect;
  ring: RingDef;
  ringPath: (a: V2, b: V2) => V2[];
  nearestRingPoint: (x: number, z: number) => V2;
  highwayZ: number;
  highwayW: number;
  hwLaneE: number;
  hwLaneW: number;
  gateX: number;
  gateZ: number;                    // coordenada del cerco donde está el portón
  gateSide: 1 | -1;                 // +1 = portón en el borde sur, -1 = norte
  extraGates?: { x: number; z: number; edge: 'N' | 'S' | 'E' | 'W' }[]; // aberturas sin barrera
  routes: Routes;
  buildings: BuildingDef[];
  slots: Record<SlotGroup, Slot[]>;
  groupFor: (status: VisualStatus, kind: VehicleKind) => SlotGroup;
  groupLabel: Record<string, string>;
  groupAnchor: Record<string, V2>;
  extraSlots: (group: SlotGroup) => Slot[];
  sectors: Sector[];
  props: PropDef[];
  lamps: V2[];
  vegetation: VegItem[];
  walkers: WalkerDef[];
  shuttles: ShuttleDef[];
  paint: (t: GroundTools) => void;
}
