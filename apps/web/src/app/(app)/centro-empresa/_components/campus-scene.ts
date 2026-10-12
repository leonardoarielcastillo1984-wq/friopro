// ============================================================
// Escenografía del Campus Empresarial — reutiliza el pipeline
// fotorealista de flota-360 (suelo texturizado + árboles
// procedurales) y agrega plaza circular, fuente, farolas,
// marcos de bandas con glow y flechas de flujo.
// ============================================================
import * as THREE from 'three';
import { buildGround } from '../../flota-360/centro-control/_components/world/ground';
import type { GroundTools } from '../../flota-360/centro-control/_components/world/layout-core';
import { buildTrees, type TreeItem } from '../../flota-360/centro-control/_components/world/trees';
import { instance } from '../../flota-360/centro-control/_components/world/assets';
import type { DeptLayer } from './types';

export const CAMPUS_BOUNDS = { x0: -96, z0: -72, x1: 96, z1: 72 };
export const PLAZA_R = 15;        // jardín central
export const RING_WALK = 24;      // radio exterior del paseo circular

// ── Suelo fotorealista del campus ────────────────────────────
function paintCampus(t: GroundTools) {
  const { g, X, Z, S, mg, mx, mz } = t;

  // Paseo circular: anillo de hormigón alrededor del jardín/fuente
  const ring = (rIn: number, rOut: number, fill: string, maskColor?: string) => {
    g.save();
    g.beginPath();
    g.arc(X(0), Z(0), rOut * S, 0, Math.PI * 2);
    g.arc(X(0), Z(0), rIn * S, 0, Math.PI * 2, true);
    g.fillStyle = fill;
    g.fill();
    g.restore();
    if (maskColor && mg && mx && mz) {
      const MS = 2;
      mg.beginPath();
      mg.arc(mx(0), mz(0), rOut * MS, 0, Math.PI * 2);
      mg.arc(mx(0), mz(0), rIn * MS, 0, Math.PI * 2, true);
      mg.fillStyle = maskColor;
      mg.fill();
    }
  };
  // Paseo de adoquines r 15→24, cordón exterior
  ring(PLAZA_R, RING_WALK + 1.2, '#cfcabd');
  ring(PLAZA_R + 0.6, RING_WALK, '#b8b3a8', '#00ff00');
  // cantero entre jardín y paseo
  ring(PLAZA_R - 0.9, PLAZA_R, '#8f8a7d');
  // jardín central: pasto más prolijo con bordes
  ring(0, PLAZA_R - 0.9, '#6c8e4c');

  // Senderos radiales del paseo hacia afuera (4 direcciones)
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    const x0 = Math.cos(a) * (RING_WALK - 1), z0 = Math.sin(a) * (RING_WALK - 1);
    const x1 = Math.cos(a) * (RING_WALK + 16), z1 = Math.sin(a) * (RING_WALK + 16);
    t.concrete(Math.min(x0, x1) - 2, Math.min(z0, z1) - 2, Math.max(x0, x1) + 2, Math.max(z0, z1) + 2);
  }

  // Calle de acceso curva (arco) que bordea el campus por el sur
  const road = (fn: (cx: number) => void) => {
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = '#3d4147';
    g.lineWidth = 9 * S;
    g.beginPath();
    g.moveTo(X(-95), Z(58));
    g.quadraticCurveTo(X(0), Z(40), X(95), Z(56));
    g.stroke();
    // banquinas
    g.strokeStyle = '#8f8a7d';
    g.lineWidth = 10.6 * S;
    g.globalCompositeOperation = 'destination-over';
    g.beginPath();
    g.moveTo(X(-95), Z(58));
    g.quadraticCurveTo(X(0), Z(40), X(95), Z(56));
    g.stroke();
    g.restore();
    if (mg && mx && mz) {
      mg.save();
      mg.strokeStyle = '#ff0000'; // asfalto en la máscara
      mg.lineWidth = 9 * 2;
      mg.lineCap = 'round';
      mg.beginPath();
      mg.moveTo(mx(-95), mz(58));
      mg.quadraticCurveTo(mx(0), mz(40), mx(95), mz(56));
      mg.stroke();
      mg.restore();
    }
    // línea central discontinua
    g.save();
    g.strokeStyle = 'rgba(240,240,232,.85)';
    g.lineWidth = 0.35 * S;
    g.setLineDash([3 * S, 3 * S]);
    g.beginPath();
    g.moveTo(X(-95), Z(58));
    g.quadraticCurveTo(X(0), Z(40), X(95), Z(56));
    g.stroke();
    g.restore();
    fn(0);
  };
  road(() => {});

  // Acceso peatonal plaza → calle
  t.concrete(-2.5, RING_WALK, 2.5, 40);

  // Estacionamiento sudeste
  t.asphalt(58, 44, 92, 62);
  for (let i = 0; i < 5; i++) {
    t.line(62 + i * 6, 46, 62 + i * 6, 58, t.WHITE, 0.12);
  }
  t.zebra(0, 42, 5, false);
}

export function buildCampusGround(scene: THREE.Scene, maxAniso: number) {
  return buildGround(scene, maxAniso, {
    bounds: CAMPUS_BOUNDS,
    highwayZ: 110,       // calle externa lejos al sur
    highwayW: 10,
    paint: paintCampus,
  });
}

// ── Árboles procedurales alrededor del campus ────────────────
export function campusTrees(avoid: { x: number; z: number; r: number }[]): { group: THREE.Group; update: (t: number) => void } {
  const rand = (() => { let s = 7; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  const items: TreeItem[] = [];
  const free = (x: number, z: number) =>
    Math.hypot(x, z) > RING_WALK + 3.5 &&                       // fuera de la plaza
    z < 38 && z > -68 && Math.abs(x) < 90 &&                  // dentro del predio
    avoid.every((a) => Math.hypot(x - a.x, z - a.z) > a.r);

  // anillo de vegetación perimetral + grupos internos
  for (let i = 0; i < 90; i++) {
    const a = rand() * Math.PI * 2;
    const r = 55 + rand() * 30;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.75;
    if (!free(x, z)) continue;
    items.push({ x, z, rot: rand() * 6.3, scale: 0.5 + rand() * 0.5, kind: rand() < 0.3 ? 'conifer' : 'broad' });
  }
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const r = RING_WALK + 6 + rand() * 22;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!free(x, z)) continue;
    items.push({ x, z, rot: rand() * 6.3, scale: 0.45 + rand() * 0.4, kind: rand() < 0.55 ? 'broad' : 'shrub' });
  }
  // arbustos en el jardín de la plaza
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + rand() * 0.3;
    const r = PLAZA_R - 4 - rand() * 4;
    items.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, rot: rand() * 6.3, scale: 0.5 + rand() * 0.3, kind: 'shrub' });
  }
  return buildTrees(items);
}

// ── Fuente central de la plaza ───────────────────────────────
export function buildFountain(): THREE.Group {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xb8b3a4, roughness: 0.8 });
  const water = new THREE.MeshStandardMaterial({ color: 0x3fa9d0, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.85 });

  const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.7, 1.1, 28), stone);
  basin.position.y = 0.55; basin.castShadow = basin.receiveShadow = true;
  const pool = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.1, 0.35, 28), water);
  pool.position.y = 1.0;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.32, 10, 28), stone);
  rim.rotation.x = Math.PI / 2; rim.position.y = 1.15;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 2.6, 14), stone);
  column.position.y = 1.6; column.castShadow = true;
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.1, 0.5, 16), stone);
  cup.position.y = 2.9; cup.castShadow = true;
  const jet = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 10), new THREE.MeshStandardMaterial({ color: 0xbfe8f5, transparent: true, opacity: 0.55 }));
  jet.position.y = 4.0;
  g.add(basin, pool, rim, column, cup, jet);
  g.name = 'fountain';
  return g;
}

// ── Farolas y props (GLB, async) ─────────────────────────────
export async function buildProps(avoid: { x: number; z: number; r: number }[]): Promise<THREE.Group> {
  const g = new THREE.Group();
  const spots: { x: number; z: number; rot: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    spots.push({ x: Math.cos(a) * (RING_WALK + 1.8), z: Math.sin(a) * (RING_WALK + 1.8), rot: -a });
  }
  const ok = spots.filter((s) => avoid.every((a) => Math.hypot(s.x - a.x, s.z - a.z) > a.r));
  await Promise.all(ok.map(async (s) => {
    try {
      const m = await instance('street-light');
      m.position.set(s.x, 0, s.z);
      m.rotation.y = s.rot;
      g.add(m);
    } catch { /* prop opcional */ }
  }));
  return g;
}

// ── Bandas de procesos con glow ──────────────────────────────
export interface BandDef { layer: DeptLayer; label: string; color: number; z: number }

export const PROCESS_BANDS: BandDef[] = [
  { layer: 'STRATEGIC',   label: 'PROCESOS ESTRATÉGICOS', color: 0x38bdf8, z: -30 },
  { layer: 'OPERATIONAL', label: 'PROCESOS OPERATIVOS',   color: 0x34d399, z: 0 },
  { layer: 'SUPPORT',     label: 'PROCESOS DE APOYO',     color: 0xf59e0b, z: 30 },
];

const BAND_W = 150, BAND_H = 22, BAND_R = 8;

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function buildBandFrames(): { group: THREE.Group; mats: THREE.MeshBasicMaterial[] } {
  const group = new THREE.Group();
  group.name = 'bands';
  const mats: THREE.MeshBasicMaterial[] = [];
  for (const b of PROCESS_BANDS) {
    // relleno tenue
    const fillMat = new THREE.MeshBasicMaterial({ color: b.color, transparent: true, opacity: 0.07, depthWrite: false });
    const fill = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(BAND_W, BAND_H, BAND_R)), fillMat);
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(0, 0.06, b.z);
    // borde luminoso: shape con hueco interior
    const edgeMat = new THREE.MeshBasicMaterial({ color: b.color, transparent: true, opacity: 0.55, depthWrite: false });
    const edgeShape = roundedRect(BAND_W, BAND_H, BAND_R);
    const inner = roundedRect(BAND_W - 1.6, BAND_H - 1.6, BAND_R - 1);
    edgeShape.holes.push(new THREE.Path(inner.getPoints(64)));
    const edge = new THREE.Mesh(new THREE.ShapeGeometry(edgeShape), edgeMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(0, 0.07, b.z);
    mats.push(fillMat, edgeMat);
    group.add(fill, edge);
  }
  return { group, mats };
}

// ── Flechas verticales entre bandas (interdependencia) ───────
export function buildInterBandArrows(): { group: THREE.Group; mats: THREE.MeshBasicMaterial[] } {
  const group = new THREE.Group();
  const mats: THREE.MeshBasicMaterial[] = [];
  // apoyo → operativo y operativo → estratégico (hacia arriba en el mapa = -z)
  const pairs: [number, number, number][] = [
    [PROCESS_BANDS[2].z - BAND_H / 2, PROCESS_BANDS[1].z + BAND_H / 2, PROCESS_BANDS[2].color],
    [PROCESS_BANDS[1].z - BAND_H / 2, PROCESS_BANDS[0].z + BAND_H / 2, PROCESS_BANDS[1].color],
  ];
  for (const x of [-52, 0, 52]) {
    for (const [zFrom, zTo, color] of pairs) {
      const len = Math.abs(zTo - zFrom);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1, len * 0.55, 10), mat);
      cone.position.set(x, 0.5, (zFrom + zTo) / 2);
      // punta hacia -z (arriba en pantalla)
      cone.rotation.x = -Math.PI / 2;
      cone.position.z = zTo - (zTo - zFrom) * 0.2;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, len * 0.5, 8), mat);
      shaft.rotation.x = Math.PI / 2;
      shaft.position.set(x, 0.5, zFrom + len * 0.15);
      mats.push(mat);
      group.add(cone, shaft);
    }
  }
  return { group, mats };
}

// ── Flecha de flujo en el extremo de una conexión ────────────
export function makeFlowArrow(color = 0x38bdf8): { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial } {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 8), mat);
  return { mesh: cone, mat };
}
