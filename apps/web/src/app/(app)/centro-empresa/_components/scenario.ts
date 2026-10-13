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

// Multiplicador fino por modelo — el tamaño final lo normaliza CampusWorld
// por bounding box (todas las huellas salen ~iguales); estos valores son
// ajustes relativos por si un modelo se ve desproporcionado.
export const MODEL_TUNE: Record<string, { scale: number; labelY: number }> = {
  'office-building': { scale: 1.0, labelY: 26 },
  'site-office':     { scale: 1.0, labelY: 10 },
  'factory':         { scale: 1.0, labelY: 18 },
  'warehouse':       { scale: 1.0, labelY: 13 },
  'car-wash':        { scale: 1.0, labelY: 11 },
  'gas-station':     { scale: 1.0, labelY: 10 },
  'water-tower':     { scale: 1.0, labelY: 16 },
};

const tune = (model: string) => MODEL_TUNE[model] ?? { scale: 1.0, labelY: 14 };

// ── Campus: anillos radiales alrededor de la plaza central ───
// Estratégicos en el anillo interno, operativos al medio, apoyo
// en el anillo externo — jerarquía organizativa visible.
// Un solo círculo alrededor de Dirección: todos los departamentos
// equiespaciados en un anillo único (hueco hacia la calle del sur).
const RING_R = 44;
const RING_GAP_HALF = Math.PI / 6;          // 30° de hueco hacia el sur
const RING_A0 = (3 * Math.PI) / 2 + RING_GAP_HALF;  // arranca al SE
const RING_SPAN = Math.PI * 2 - RING_GAP_HALF * 2;  // 300°

// Dirección manda desde el centro de la plaza (donde estaba la fuente).
const isDireccion = (d: EmpresaDept) => d.key === 'direccion' || /direcci/i.test(d.name);

function campusLayout(depts: EmpresaDept[]): CampusLayout {
  const enabled = depts.filter((d) => d.enabled);
  const direccion = enabled.find(isDireccion);
  const ringDepts = enabled.filter((d) => !d.campusPos && d !== direccion);

  const placements: BuildingPlacement[] = [];
  if (direccion) {
    const t = tune(direccion.model);
    placements.push({
      key: direccion.key, x: 0, z: -3,
      rot: Math.PI,                    // frente hacia la calle (sur)
      scale: t.scale * 1.15, labelY: t.labelY,
    });
  }
  const n = ringDepts.length;
  ringDepts.forEach((d, i) => {
    const a = n === 1 ? (3 * Math.PI) / 2 - Math.PI : RING_A0 + (RING_SPAN * i) / (n - 1);
    const x = Math.cos(a) * RING_R;
    const z = -Math.sin(a) * RING_R - 4;
    const t = tune(d.model);
    placements.push({
      key: d.key, x, z,
      rot: Math.atan2(-x, -z) + Math.PI,   // mirando a la plaza
      scale: t.scale, labelY: t.labelY,
    });
  });

  enabled.filter((d) => d.campusPos && d !== direccion).forEach((d) => {
    const t = tune(d.model);
    const p = d.campusPos!;
    placements.push({ key: d.key, x: p.x, z: p.z, rot: 0, scale: t.scale, labelY: t.labelY });
  });

  return { placements, zones: [], fitX: 0, fitZ: 2, fitR: 105 };
}

// ── Procesos: tres bandas ISO 9001 (alineadas a campus-scene) ─
const LAYER_ORDER: DeptLayer[] = ['STRATEGIC', 'OPERATIONAL', 'SUPPORT'];
const BAND_Z: Record<DeptLayer, number> = { STRATEGIC: -30, OPERATIONAL: 0, SUPPORT: 30 };
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
        x: auto.length === 1 ? 0 : -64 + i * (128 / (auto.length - 1)),
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
    key: l, x0: -78, z0: BAND_Z[l] - 12, x1: 78, z1: BAND_Z[l] + 12,
    label: BAND_LABEL[l],
  }));

  return { placements, zones, fitX: 0, fitZ: 0, fitR: 105 };
}

export function layoutFor(template: TemplateKey, depts: EmpresaDept[]): CampusLayout {
  return template === 'procesos' ? procesosLayout(depts) : campusLayout(depts);
}
