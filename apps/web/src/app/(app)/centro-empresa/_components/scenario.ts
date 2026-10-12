// ============================================================
// Layouts del campus empresarial.
// Un solo motor (CampusWorld) — el layout cambia según plantilla:
//   'campus'   → edificios alrededor de una plaza central.
//   'procesos' → tres bandas horizontales (estratégicos / operativos / apoyo).
// Las posiciones guardadas en config (campusPos/procPos) tienen
// prioridad sobre el auto-layout.
// ============================================================
import type { EmpresaDept, TemplateKey, DeptLayer } from './types';

export interface BuildingPlacement {
  key: string;
  x: number;
  z: number;
  rot: number;
  scale: number;
  labelY: number;
}

export interface Zone {
  key: DeptLayer;
  x0: number; z0: number; x1: number; z1: number;
  label: string;
}

export interface CampusLayout {
  placements: BuildingPlacement[];
  zones: Zone[];
  fitX: number; fitZ: number;   // centro para el encuadre inicial
  fitR: number;                 // radio para el encuadre
}

// Escala/orientación por modelo para que los edificios se lean bien.
export const MODEL_TUNE: Record<string, { scale: number; labelY: number }> = {
  'office-building': { scale: 0.62, labelY: 26 },
  'site-office':     { scale: 0.85, labelY: 9 },
  'factory':         { scale: 0.55, labelY: 18 },
  'warehouse':       { scale: 0.55, labelY: 13 },
  'car-wash':        { scale: 0.9,  labelY: 10 },
  'gas-station':     { scale: 0.9,  labelY: 9 },
  'water-tower':     { scale: 0.8,  labelY: 16 },
};

const tune = (model: string) => MODEL_TUNE[model] ?? { scale: 0.7, labelY: 14 };

// ── Campus: grilla alrededor de una plaza central ────────────
function campusLayout(depts: EmpresaDept[]): CampusLayout {
  const enabled = depts.filter((d) => d.enabled);
  const fixed = new Map(enabled.filter((d) => d.campusPos).map((d) => [d.key, d.campusPos!]));

  // Auto-layout: dos hileras curvas alrededor de la plaza (0,0)
  const auto = enabled.filter((d) => !d.campusPos);
  const COLS = Math.ceil(auto.length / 2) || 1;
  const placements: BuildingPlacement[] = [];

  auto.forEach((d, i) => {
    const row = i < COLS ? 0 : 1;
    const col = i % COLS;
    const t = tune(d.model);
    placements.push({
      key: d.key,
      x: -60 + col * (120 / Math.max(1, COLS - 1)),
      z: row === 0 ? -52 : 56,
      rot: row === 0 ? Math.PI : 0,
      scale: t.scale,
      labelY: t.labelY,
    });
  });

  enabled.filter((d) => d.campusPos).forEach((d) => {
    const t = tune(d.model);
    const p = fixed.get(d.key)!;
    placements.push({ key: d.key, x: p.x, z: p.z, rot: 0, scale: t.scale, labelY: t.labelY });
  });

  return { placements, zones: [], fitX: 0, fitZ: 2, fitR: 110 };
}

// ── Procesos: tres bandas ISO 9001 ───────────────────────────
const LAYER_ORDER: DeptLayer[] = ['STRATEGIC', 'OPERATIONAL', 'SUPPORT'];
const BAND_Z: Record<DeptLayer, number> = { STRATEGIC: -58, OPERATIONAL: 0, SUPPORT: 58 };
const BAND_LABEL: Record<DeptLayer, string> = {
  STRATEGIC: 'PROCESOS ESTRATÉGICOS',
  OPERATIONAL: 'PROCESOS OPERATIVOS',
  SUPPORT: 'PROCESOS DE APOYO',
};

function procesosLayout(depts: EmpresaDept[]): CampusLayout {
  const enabled = depts.filter((d) => d.enabled);
  const byLayer = new Map<DeptLayer, EmpresaDept[]>();
  LAYER_ORDER.forEach((l) => byLayer.set(l, []));
  enabled.forEach((d) => byLayer.get(d.layer)?.push(d));

  const placements: BuildingPlacement[] = [];
  LAYER_ORDER.forEach((layer) => {
    const group = byLayer.get(layer)!;
    const withPos = group.filter((d) => d.procPos);
    const auto = group.filter((d) => !d.procPos);
    const z = BAND_Z[layer];
    auto.forEach((d, i) => {
      const t = tune(d.model);
      placements.push({
        key: d.key,
        x: auto.length === 1 ? 0 : -70 + i * (140 / (auto.length - 1)),
        z,
        rot: layer === 'STRATEGIC' ? Math.PI : 0,
        scale: t.scale,
        labelY: t.labelY,
      });
    });
    withPos.forEach((d) => {
      const t = tune(d.model);
      placements.push({ key: d.key, x: d.procPos!.x, z: d.procPos!.z, rot: 0, scale: t.scale, labelY: t.labelY });
    });
  });

  const zones: Zone[] = LAYER_ORDER.map((l) => ({
    key: l, x0: -95, z0: BAND_Z[l] - 26, x1: 95, z1: BAND_Z[l] + 26,
    label: BAND_LABEL[l],
  }));

  return { placements, zones, fitX: 0, fitZ: 0, fitR: 115 };
}

export function layoutFor(template: TemplateKey, depts: EmpresaDept[]): CampusLayout {
  return template === 'procesos' ? procesosLayout(depts) : campusLayout(depts);
}
