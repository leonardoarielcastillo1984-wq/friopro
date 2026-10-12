// ============================================================
// Kit de detalle para tractor y semirremolque (modelo semi-truck).
// Agrega piezas reales que el modelo base no tiene: espejos, parrilla
// cromada, ópticas, paragolpes, tanques de combustible, escapes,
// estribos, balizas, guardabarros; en el semi: cinta reflectiva,
// protección lateral, patas de apoyo, luces traseras, paragolpes
// trasero, bisagras/trabas de puertas y faroles laterales.
// Las piezas se fusionan por material en plantillas compartidas:
// cada unidad suma ~6 draw calls por pieza (tractor y semi).
// Coordenadas: las del modelo (frente +Z, izquierda +X).
// ============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type Part = { geo: THREE.BufferGeometry; mat: string; p: [number, number, number]; r?: [number, number, number] };

let mats: Record<string, THREE.Material> | null = null;
function materials() {
  if (mats) return mats;
  const tape = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 8;
    const g = c.getContext('2d')!;
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f4f4' : '#d0141e'; g.fillRect(i * 32, 0, 32, 8); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
    return t;
  })();
  const grille = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#15181c'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#c9ced4';
    for (let y = 4; y < 128; y += 14) g.fillRect(0, y, 128, 6);
    g.fillRect(0, 0, 6, 128); g.fillRect(122, 0, 6, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  mats = {
    chrome: new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 1, roughness: 0.18, envMapIntensity: 1.4 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1c1f23, metalness: 0.2, roughness: 0.7 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x111214, metalness: 0, roughness: 0.92 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9aa1a8, metalness: 0.8, roughness: 0.38 }),
    lens: new THREE.MeshStandardMaterial({ color: 0xeef3f7, emissive: 0xfff4dc, emissiveIntensity: 0.35, roughness: 0.05, metalness: 0.1 }),
    amber: new THREE.MeshStandardMaterial({ color: 0xffa21a, emissive: 0xff8a00, emissiveIntensity: 0.6, roughness: 0.3 }),
    red: new THREE.MeshStandardMaterial({ color: 0xc0101a, emissive: 0xff1a1a, emissiveIntensity: 0.7, roughness: 0.3 }),
    tape: new THREE.MeshStandardMaterial({ map: tape, roughness: 0.25, metalness: 0.2, emissive: 0x220000, envMapIntensity: 1.5 }),
    grille: new THREE.MeshStandardMaterial({ map: grille, metalness: 0.85, roughness: 0.25 }),
  };
  return mats;
}

function bake(parts: Part[]): THREE.Mesh[] {
  const M = materials();
  const byMat = new Map<string, THREE.BufferGeometry[]>();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  for (const pt of parts) {
    const g = pt.geo.clone();
    e.set(...(pt.r ?? [0, 0, 0])); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(...pt.p), q, one);
    g.applyMatrix4(m4);
    const ng = g.index ? g.toNonIndexed() : g;
    if (!byMat.has(pt.mat)) byMat.set(pt.mat, []);
    byMat.get(pt.mat)!.push(ng);
  }
  const out: THREE.Mesh[] = [];
  for (const [k, gs] of byMat) {
    const merged = mergeGeometries(gs, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, M[k]);
    mesh.castShadow = k !== 'tape' && k !== 'lens' && k !== 'amber' && k !== 'red';
    mesh.receiveShadow = true;
    mesh.name = `kit_${k}`;
    out.push(mesh);
  }
  return out;
}

const B = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const CYL_Z = (r: number, len: number, seg = 16) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);
const CYL_Y = (r: number, len: number, seg = 12) => new THREE.CylinderGeometry(r, r, len, seg);

let tractorTpl: THREE.Mesh[] | null = null;
let trailerTpl: THREE.Mesh[] | null = null;

function tractorParts(): Part[] {
  const P: Part[] = [];
  for (const s of [1, -1]) {
    // espejos retrovisores: brazo + carcasa + espejo de rampa
    P.push({ geo: B(0.32, 0.05, 0.05), mat: 'steel', p: [s * 1.6, 2.75, 6.55] });
    P.push({ geo: B(0.1, 0.62, 0.24), mat: 'dark', p: [s * 1.78, 2.7, 6.55] });
    P.push({ geo: B(0.1, 0.24, 0.22), mat: 'dark', p: [s * 1.74, 2.2, 6.62] });
    // ópticas delanteras y giros
    P.push({ geo: B(0.5, 0.24, 0.06), mat: 'lens', p: [s * 1.05, 1.2, 9.12] });
    P.push({ geo: B(0.16, 0.12, 0.06), mat: 'amber', p: [s * 1.38, 1.2, 9.1] });
    // tanques de combustible cromados + tapas
    P.push({ geo: CYL_Z(0.33, 1.6), mat: 'chrome', p: [s * 1.24, 0.78, 4.3] });
    P.push({ geo: B(0.08, 0.7, 0.06), mat: 'dark', p: [s * 1.24, 0.78, 3.95] });
    P.push({ geo: B(0.08, 0.7, 0.06), mat: 'dark', p: [s * 1.24, 0.78, 4.65] });
    // estribos bajo la puerta
    P.push({ geo: B(0.42, 0.06, 1.1), mat: 'steel', p: [s * 1.32, 0.48, 5.7] });
    P.push({ geo: B(0.42, 0.06, 1.1), mat: 'steel', p: [s * 1.32, 0.95, 5.7] });
    // escapes verticales detrás de la cabina
    P.push({ geo: CYL_Y(0.1, 2.5), mat: 'chrome', p: [s * 1.22, 3.15, 3.95] });
    P.push({ geo: CYL_Y(0.11, 0.25), mat: 'dark', p: [s * 1.22, 4.5, 3.95] });
    // guardabarros traseros (antiproyección)
    P.push({ geo: B(0.62, 0.62, 0.03), mat: 'rubber', p: [s * 0.95, 0.4, 0.7] });
    // guardabarros sobre ejes motrices
    P.push({ geo: B(0.7, 0.06, 2.3), mat: 'dark', p: [s * 0.95, 1.12, 2.14] });
  }
  // parrilla, paragolpes y visera
  P.push({ geo: B(1.36, 1.05, 0.05), mat: 'grille', p: [0, 1.6, 9.11] });
  P.push({ geo: B(2.92, 0.36, 0.32), mat: 'chrome', p: [0, 0.6, 9.18] });
  P.push({ geo: B(2.5, 0.08, 0.35), mat: 'dark', p: [0, 2.98, 6.85] });
  // balizas de techo
  for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) P.push({ geo: B(0.14, 0.08, 0.1), mat: 'amber', p: [x, 3.98, 6.3] });
  return P;
}

// Coordenadas del nodo trailer: caja x ±1.32, piso y≈0, frente z≈0.9, cola z≈-11.4
function trailerParts(): Part[] {
  const P: Part[] = [];
  const X = 1.32, ZF = 0.9, ZR = -11.38, L = ZF - ZR;
  for (const s of [1, -1]) {
    // cinta reflectiva alternada rojo/blanco (lateral)
    P.push({ geo: B(0.02, 0.1, L - 0.4), mat: 'tape', p: [s * (X + 0.05), 0.12, (ZF + ZR) / 2] });
    // protección lateral (dos largueros + parantes)
    for (const y of [-0.38, -0.72]) P.push({ geo: B(0.05, 0.12, 6.8), mat: 'steel', p: [s * 1.24, y, -4.5] });
    for (const z of [-1.3, -4.5, -7.7]) P.push({ geo: B(0.06, 0.5, 0.06), mat: 'steel', p: [s * 1.2, -0.55, z] });
    // patas de apoyo
    P.push({ geo: B(0.14, 0.95, 0.14), mat: 'steel', p: [s * 0.95, -0.62, -1.1] });
    P.push({ geo: B(0.36, 0.05, 0.36), mat: 'steel', p: [s * 0.95, -1.08, -1.1] });
    // faroles laterales ámbar
    for (let z = -0.5; z > ZR + 0.6; z -= 3.2) P.push({ geo: B(0.04, 0.08, 0.12), mat: 'amber', p: [s * (X + 0.06), -0.02, z] });
    // luces traseras y guardabarros traseros
    P.push({ geo: B(0.42, 0.18, 0.05), mat: 'red', p: [s * 0.98, -0.32, ZR - 0.06] });
    P.push({ geo: B(0.14, 0.16, 0.05), mat: 'amber', p: [s * 0.6, -0.32, ZR - 0.06] });
    P.push({ geo: B(0.62, 0.62, 0.03), mat: 'rubber', p: [s * 0.95, -0.78, -10.95] });
    // bisagras de puertas traseras
    for (const y of [0.5, 1.3, 2.1]) P.push({ geo: B(0.12, 0.14, 0.04), mat: 'steel', p: [s * 1.24, y, ZR - 0.04] });
  }
  // marco trasero + paragolpes antiempotramiento + cinta trasera
  P.push({ geo: B(2.7, 0.12, 0.08), mat: 'steel', p: [0, 2.8, ZR - 0.02] });
  P.push({ geo: B(0.06, 2.8, 0.05), mat: 'dark', p: [0, 1.4, ZR - 0.04] });
  for (const x of [-0.35, -0.25, 0.25, 0.35]) P.push({ geo: CYL_Y(0.025, 2.6, 6), mat: 'steel', p: [x, 1.35, ZR - 0.08] });
  P.push({ geo: B(2.4, 0.14, 0.14), mat: 'steel', p: [0, -0.72, ZR + 0.15] });
  P.push({ geo: B(2.36, 0.1, 0.02), mat: 'tape', p: [0, -0.72, ZR + 0.06] });
  P.push({ geo: B(2.6, 0.08, 0.02), mat: 'tape', p: [0, 0.1, ZR - 0.06] });
  return P;
}

const cloneTpl = (tpl: THREE.Mesh[]) => tpl.map((m) => { const c = new THREE.Mesh(m.geometry, m.material); c.castShadow = m.castShadow; c.receiveShadow = m.receiveShadow; c.name = m.name; return c; });

// Kit genérico para modelos de una sola pieza (rígido, pickup, grúa): se
// dimensiona con el bounding box del modelo (frente +Z) y se cachea por modelo.
const genericTpl = new Map<string, THREE.Mesh[]>();
export function genericKit(model: string, bb: THREE.Box3, heavy: boolean): THREE.Group {
  let tpl = genericTpl.get(model);
  if (!tpl) {
    const hw = (bb.max.x - bb.min.x) / 2, hgt = bb.max.y - bb.min.y, L = bb.max.z - bb.min.z;
    const zf = bb.max.z, zr = bb.min.z, y0 = bb.min.y;
    const P: Part[] = [];
    for (const s of [1, -1]) {
      // espejos a la altura de la cabina
      const my = y0 + hgt * (heavy ? 0.62 : 0.6), mz = zf - L * (heavy ? 0.2 : 0.42);
      P.push({ geo: B(0.28, 0.04, 0.04), mat: 'steel', p: [s * (hw + 0.1), my, mz] });
      P.push({ geo: B(0.08, heavy ? 0.5 : 0.18, heavy ? 0.2 : 0.24), mat: 'dark', p: [s * (hw + 0.26), my, mz] });
      // ópticas delanteras y traseras
      P.push({ geo: B(heavy ? 0.42 : 0.34, 0.18, 0.05), mat: 'lens', p: [s * hw * 0.68, y0 + hgt * (heavy ? 0.28 : 0.42), zf + 0.02] });
      P.push({ geo: B(0.3, 0.16, 0.05), mat: 'red', p: [s * hw * 0.75, y0 + hgt * (heavy ? 0.22 : 0.45), zr - 0.02] });
      if (heavy) {
        P.push({ geo: B(0.55, 0.55, 0.03), mat: 'rubber', p: [s * hw * 0.7, y0 + 0.36, zr + 0.25] });
        P.push({ geo: B(0.02, 0.09, L * 0.55), mat: 'tape', p: [s * (hw + 0.02), y0 + hgt * 0.3, zr + L * 0.3] });
        for (let z = zr + 0.6; z < zr + L * 0.6; z += 2.4) P.push({ geo: B(0.04, 0.07, 0.1), mat: 'amber', p: [s * (hw + 0.03), y0 + hgt * 0.22, z] });
      }
    }
    P.push({ geo: B(hw * 2 + 0.06, heavy ? 0.3 : 0.2, 0.22), mat: heavy ? 'chrome' : 'dark', p: [0, y0 + (heavy ? 0.5 : 0.45), zf + 0.06] });
    P.push({ geo: B(hw * 1.8, heavy ? 0.16 : 0.14, 0.18), mat: 'dark', p: [0, y0 + (heavy ? 0.5 : 0.42), zr - 0.06] });
    if (heavy) {
      P.push({ geo: B(hw * 1.7, 0.08, 0.02), mat: 'tape', p: [0, y0 + 0.5, zr - 0.16] });
      for (const x of [-0.45, 0, 0.45]) P.push({ geo: B(0.14, 0.08, 0.1), mat: 'amber', p: [x * hw, y0 + hgt * 0.995, zf - L * 0.25] });
    }
    tpl = bake(P);
    genericTpl.set(model, tpl);
  }
  const g = new THREE.Group(); g.name = 'kit_generic';
  g.add(...cloneTpl(tpl));
  return g;
}

export function tractorKit(): THREE.Group {
  if (!tractorTpl) tractorTpl = bake(tractorParts());
  const g = new THREE.Group(); g.name = 'kit_tractor';
  g.add(...cloneTpl(tractorTpl));
  return g;
}

export function trailerKit(): THREE.Group {
  if (!trailerTpl) trailerTpl = bake(trailerParts());
  const g = new THREE.Group(); g.name = 'kit_semi';
  g.add(...cloneTpl(trailerTpl));
  return g;
}
