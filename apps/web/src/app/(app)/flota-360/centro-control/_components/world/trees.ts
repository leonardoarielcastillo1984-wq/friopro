// ============================================================
// Árboles procedurales con InstancedMesh: copas irregulares hechas
// de masas deformadas por ruido (no low-poly facetado), variación de
// tono por masa y por altura (sombra interna, copa más clara al sol),
// tronco con ramas, viento por shader. Una variante = 1 draw call.
// ============================================================
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type TreeKind = 'broad' | 'conifer' | 'shrub';
export interface TreeItem { x: number; z: number; rot: number; scale: number; kind: TreeKind }

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Ruido suave determinista por posición (los vértices compartidos se desplazan igual)
function lump(x: number, y: number, z: number, seed: number) {
  return (
    Math.sin(x * 1.9 + seed) * Math.sin(y * 2.3 + seed * 0.7) * Math.sin(z * 1.7 + seed * 1.3) * 0.55 +
    Math.sin(x * 4.1 + y * 3.3 + seed * 2.1) * Math.sin(z * 3.7 - y * 2.9) * 0.3 +
    Math.sin(x * 8.3 - z * 7.1 + seed) * 0.15
  );
}

function blob(r: number, cx: number, cy: number, cz: number, seed: number, color: THREE.Color, rand: () => number) {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(r, 3);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    const d = 1 + lump(n.x * 1.6, n.y * 1.6, n.z * 1.6, seed) * 0.28;
    v.copy(n).multiplyScalar(r * d);
    v.y *= 0.82;                                  // masas algo achatadas
    p.setXYZ(i, v.x + cx, v.y + cy, v.z + cz);
  }
  g.computeVertexNormals();
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) - cy, ny = y / r;
    // abajo y adentro más oscuro, arriba iluminado; moteado de follaje
    const shade = 0.58 + 0.5 * THREE.MathUtils.clamp((ny + 1) / 2, 0, 1) + (rand() - 0.5) * 0.12;
    c.copy(color).multiplyScalar(shade);
    if (rand() < 0.06) c.lerp(new THREE.Color(0x9aa860), 0.25);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g.toNonIndexed();
}

function wood(r0: number, r1: number, len: number, from: THREE.Vector3, dir: THREE.Vector3, color: THREE.Color) {
  const g = new THREE.CylinderGeometry(r1, r0, len, 7, 1, false);
  g.deleteAttribute('uv');
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  g.applyQuaternion(q);
  g.translate(from.x, from.y, from.z);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g.toNonIndexed();
}

const BARK = new THREE.Color(0x4a3b2e);
const LEAF_BROAD = [0x3f5e2a, 0x4c6c30, 0x56733a, 0x3a5628, 0x5b7a3c, 0x47652e].map((c) => new THREE.Color(c));
const LEAF_CONIFER = [0x2c4a2c, 0x34522f, 0x2a4430].map((c) => new THREE.Color(c));

function broadleaf(seed: number) {
  const rand = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const H = 4 + rand() * 1.6;                      // altura de fuste
  parts.push(wood(0.32, 0.2, H + 1.2, new THREE.Vector3(), new THREE.Vector3((rand() - 0.5) * 0.15, 1, (rand() - 0.5) * 0.15), BARK));
  const base = LEAF_BROAD[(rand() * LEAF_BROAD.length) | 0];
  const R = 3.2 + rand() * 1.2;
  const n = 9 + ((rand() * 6) | 0);
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, d = rand() * R * 0.62;
    const y = H + 1.4 + rand() * R * 0.9;
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d;
    if (i < 4) parts.push(wood(0.14, 0.06, Math.hypot(cx, y - H, cz) * 0.8, new THREE.Vector3(0, H, 0), new THREE.Vector3(cx, y - H, cz), BARK));
    const tint = base.clone().offsetHSL((rand() - 0.5) * 0.03, (rand() - 0.5) * 0.08, (rand() - 0.5) * 0.06);
    parts.push(blob(R * (0.42 + rand() * 0.25), cx, y, cz, seed * 13 + i, tint, rand));
  }
  return mergeGeometries(parts, false)!;
}

function conifer(seed: number) {
  const rand = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const H = 11 + rand() * 4;
  parts.push(wood(0.3, 0.1, H, new THREE.Vector3(), new THREE.Vector3(0, 1, 0), BARK));
  const base = LEAF_CONIFER[(rand() * LEAF_CONIFER.length) | 0];
  const tiers = 7;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const r = (1 - t) * 2.5 + 0.6;
    const tint = base.clone().offsetHSL(0, 0, (rand() - 0.5) * 0.05 + t * 0.03);
    parts.push(blob(r, (rand() - 0.5) * 0.3, 2.2 + t * (H - 2.6), (rand() - 0.5) * 0.3, seed * 7 + i, tint, rand));
  }
  return mergeGeometries(parts, false)!;
}

function shrub(seed: number) {
  const rand = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const base = LEAF_BROAD[(rand() * LEAF_BROAD.length) | 0];
  for (let i = 0; i < 4; i++) {
    const tint = base.clone().offsetHSL(0, 0, (rand() - 0.5) * 0.06);
    parts.push(blob(0.7 + rand() * 0.4, (rand() - 0.5) * 1.2, 0.6, (rand() - 0.5) * 1.2, seed * 5 + i, tint, rand));
  }
  return mergeGeometries(parts, false)!;
}

export function buildTrees(items: TreeItem[]) {
  const group = new THREE.Group();
  group.name = 'trees';
  const uTime = { value: 0 };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, envMapIntensity: 0.55 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  float hgt = max(0.0, transformed.y - 3.0);
  vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float ph = ip.x * 0.13 + ip.z * 0.17;
  transformed.x += sin(uTime * 1.3 + ph) * 0.018 * hgt + sin(uTime * 3.1 + ph * 2.0 + transformed.y) * 0.02;
  transformed.z += cos(uTime * 1.1 + ph * 1.3) * 0.014 * hgt;
#endif`);
  };
  mat.customProgramCacheKey = () => 'cc-trees';

  const VARIANTS: Record<TreeKind, number> = { broad: 6, conifer: 3, shrub: 3 };
  const make: Record<TreeKind, (s: number) => THREE.BufferGeometry> = { broad: broadleaf, conifer, shrub };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

  (Object.keys(VARIANTS) as TreeKind[]).forEach((kind) => {
    const list = items.filter((it) => it.kind === kind);
    if (!list.length) return;
    const nv = VARIANTS[kind];
    for (let vi = 0; vi < nv; vi++) {
      const mine = list.filter((_, i) => i % nv === vi);
      if (!mine.length) continue;
      const geo = make[kind](101 + vi * 37 + kind.length * 11);
      const im = new THREE.InstancedMesh(geo, mat, mine.length);
      mine.forEach((it, i) => {
        const k = it.scale * (0.85 + ((i * 7919) % 30) / 100);
        q.setFromAxisAngle(up, it.rot);
        s.set(k, k * (0.92 + ((i * 104729) % 16) / 100), k);
        p.set(it.x, 0, it.z);
        im.setMatrixAt(i, m4.compose(p, q, s));
      });
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      group.add(im);
    }
  });

  return { group, update: (t: number) => { uTime.value = t; } };
}
