// ============================================================
// Suelo del predio: textura pintada a escala + cerco perimetral
// con portones. Todo parametrizado por el Scenario activo.
// ============================================================
import * as THREE from 'three';
import type { Rect, GroundTools } from './layout-core';

const S = 10; // px por metro

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export interface GroundSpec {
  bounds: Rect;
  highwayZ: number;
  highwayW: number;
  paint: (t: GroundTools) => void;
}

export function buildGround(scene: THREE.Scene, maxAniso: number, spec: GroundSpec) {
  const { bounds: BOUNDS, highwayZ: HIGHWAY_Z, highwayW: HIGHWAY_W } = spec;
  const W = (BOUNDS.x1 - BOUNDS.x0) * S;
  const H = (BOUNDS.z1 - BOUNDS.z0) * S;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const X = (x: number) => (x - BOUNDS.x0) * S;
  const Z = (z: number) => (z - BOUNDS.z0) * S;
  const rect = (x0: number, z0: number, x1: number, z1: number) => g.fillRect(X(x0), Z(z0), (x1 - x0) * S, (z1 - z0) * S);
  const rand = rng(7);

  const noise = (x0: number, z0: number, x1: number, z1: number, colors: string[], n: number, size: [number, number]) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = colors[(rand() * colors.length) | 0];
      const s = size[0] + rand() * (size[1] - size[0]);
      g.fillRect(X(x0 + rand() * (x1 - x0)), Z(z0 + rand() * (z1 - z0)), s, s);
    }
  };

  // ── Césped base ──
  g.fillStyle = '#6d8c4a';
  g.fillRect(0, 0, W, H);
  noise(BOUNDS.x0, BOUNDS.z0, BOUNDS.x1, BOUNDS.z1, ['#668545', '#759552', '#61803f', '#7a9a58'], 90000, [3, 9]);

  // ── Herramientas de pintado (las consume el escenario) ──
  const WHITE = 'rgba(240,240,232,.92)';
  const YELLOW = 'rgba(250,204,21,.95)';

  const concrete = (x0: number, z0: number, x1: number, z1: number) => {
    g.fillStyle = '#b8b4aa';
    rect(x0, z0, x1, z1);
    noise(x0, z0, x1, z1, ['#b1ada3', '#bfbbb1', '#aca89e'], Math.round((x1 - x0) * (z1 - z0) * 20), [2, 6]);
    g.strokeStyle = 'rgba(80,76,70,.18)'; g.lineWidth = 1;
    for (let x = x0; x <= x1; x += 6) { g.beginPath(); g.moveTo(X(x), Z(z0)); g.lineTo(X(x), Z(z1)); g.stroke(); }
    for (let z = z0; z <= z1; z += 6) { g.beginPath(); g.moveTo(X(x0), Z(z)); g.lineTo(X(x1), Z(z)); g.stroke(); }
  };

  const lawn = (x0: number, z0: number, x1: number, z1: number) => {
    g.fillStyle = '#d9d5ca'; rect(x0 - 0.6, z0 - 0.6, x1 + 0.6, z1 + 0.6); // cordón
    g.fillStyle = '#6f9150'; rect(x0, z0, x1, z1);
    noise(x0, z0, x1, z1, ['#688a49', '#79995a', '#628444'], Math.round((x1 - x0) * (z1 - z0) * 1.4), [3, 8]);
  };

  const asphalt = (x0: number, z0: number, x1: number, z1: number) => {
    g.fillStyle = '#3d4147';
    rect(x0, z0, x1, z1);
    noise(x0, z0, x1, z1, ['#383c42', '#43474d', '#34383d', '#474b51'], Math.round((x1 - x0) * (z1 - z0) * 1.6), [2, 5]);
  };

  const vereda = (x0: number, z0: number, x1: number, z1: number) => {
    g.fillStyle = '#d6d2c8';
    rect(x0, z0, x1, z1);
  };

  const dirt = (x0: number, z0: number, x1: number, z1: number) => {
    g.fillStyle = '#a08b6d';
    rect(x0, z0, x1, z1);
    noise(x0, z0, x1, z1, ['#97835f', '#a8936f', '#8f7c5b', '#b09a76'], Math.round((x1 - x0) * (z1 - z0) * 1.8), [3, 8]);
  };

  const line = (x0: number, z0: number, x1: number, z1: number, color: string, w: number, dash?: number[]) => {
    g.strokeStyle = color; g.lineWidth = w * S; g.setLineDash(dash ? dash.map((d) => d * S) : []);
    g.beginPath(); g.moveTo(X(x0), Z(z0)); g.lineTo(X(x1), Z(z1)); g.stroke();
    g.setLineDash([]);
  };

  const arrow = (x: number, z: number, dirX: number) => {
    g.fillStyle = WHITE;
    g.beginPath();
    g.moveTo(X(x + dirX * 2.2), Z(z));
    g.lineTo(X(x - dirX * 0.4), Z(z - 1.1));
    g.lineTo(X(x - dirX * 0.4), Z(z - 0.4));
    g.lineTo(X(x - dirX * 2.6), Z(z - 0.4));
    g.lineTo(X(x - dirX * 2.6), Z(z + 0.4));
    g.lineTo(X(x - dirX * 0.4), Z(z + 0.4));
    g.lineTo(X(x - dirX * 0.4), Z(z + 1.1));
    g.closePath(); g.fill();
  };

  const zebra = (cx: number, cz: number, len: number, vertical: boolean) => {
    g.fillStyle = WHITE;
    for (let i = -len / 2; i < len / 2; i += 1.2) {
      if (vertical) rect(cx - 2, cz + i, cx + 2, cz + i + 0.6);
      else rect(cx + i, cz - 2, cx + i + 0.6, cz + 2);
    }
  };

  const hatchRect = (x0: number, z0: number, x1: number, z1: number, w = 1) => {
    const draw = (ax: number, az: number, bx: number, bz: number) => {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.floor(len / 1.2);
      for (let i = 0; i < n; i++) {
        g.fillStyle = i % 2 ? '#1c1c1c' : '#f5c518';
        const t0 = i / n, t1 = (i + 1) / n;
        const px0 = ax + (bx - ax) * t0, pz0 = az + (bz - az) * t0;
        const px1 = ax + (bx - ax) * t1, pz1 = az + (bz - az) * t1;
        const minx = Math.min(px0, px1) - (az === bz ? 0 : w / 2), maxx = Math.max(px0, px1) + (az === bz ? 0 : w / 2);
        const minz = Math.min(pz0, pz1) - (az === bz ? w / 2 : 0), maxz = Math.max(pz0, pz1) + (az === bz ? w / 2 : 0);
        rect(minx, minz, maxx, maxz);
      }
    };
    draw(x0, z0, x1, z0); draw(x1, z0, x1, z1); draw(x1, z1, x0, z1); draw(x0, z1, x0, z0);
  };

  const text = (txt: string, x: number, z: number, color: string, sizeM: number) => {
    g.save();
    g.fillStyle = color; g.font = `bold ${sizeM * S}px system-ui, sans-serif`; g.textAlign = 'center';
    g.fillText(txt, X(x), Z(z));
    g.restore();
  };

  const tools: GroundTools = {
    g, X, Z, S, rect, noise, asphalt, concrete, lawn, vereda, dirt,
    line, arrow, zebra, hatchRect, text, WHITE, YELLOW,
  };

  // Pintado propio del escenario
  spec.paint(tools);

  // Fundido de bordes hacia el campo exterior
  const fade = 40 * S;
  const edge = (x0: number, y0: number, x1: number, y1: number, gx0: number, gy0: number, gx1: number, gy1: number) => {
    const gr = g.createLinearGradient(gx0, gy0, gx1, gy1);
    gr.addColorStop(0, 'rgba(106,136,72,1)');
    gr.addColorStop(1, 'rgba(106,136,72,0)');
    g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  };
  edge(0, 0, fade, H, 0, 0, fade, 0);
  edge(W - fade, 0, W, H, W, 0, W - fade, 0);
  edge(0, 0, W, fade, 0, 0, 0, fade);
  edge(0, H - fade, W, H, 0, H, 0, H - fade);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;

  const w = BOUNDS.x1 - BOUNDS.x0, h = BOUNDS.z1 - BOUNDS.z0;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.94, metalness: 0 }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((BOUNDS.x0 + BOUNDS.x1) / 2, 0, (BOUNDS.z0 + BOUNDS.z1) / 2);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  scene.add(mesh);

  // Campo exterior
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: new THREE.Color('#6a8848'), roughness: 0.94 }));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.05;
  outer.receiveShadow = true;
  scene.add(outer);
  scene.add(buildHighway(maxAniso, HIGHWAY_Z, HIGHWAY_W));
  return mesh;
}

// ── Calle externa: franja continua con textura repetida ──
function buildHighway(maxAniso: number, highwayZ: number, highwayW: number) {
  const TOTAL = highwayW + 4;
  const RX = 24;                       // metros por repetición
  const c = document.createElement('canvas');
  c.width = RX * S; c.height = TOTAL * S;
  const g = c.getContext('2d')!;
  const rand = rng(3);
  g.fillStyle = '#9c9a8f'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#3d4147'; g.fillRect(0, 2 * S, c.width, highwayW * S);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = ['#383c42', '#43474d', '#34383d', '#474b51'][(rand() * 4) | 0];
    const s = 2 + rand() * 3;
    g.fillRect(rand() * c.width, 2 * S + rand() * highwayW * S, s, s);
  }
  const mid = (2 + highwayW / 2) * S;
  g.fillStyle = 'rgba(250,204,21,.95)';
  g.fillRect(0, mid - 0.32 * S, c.width, 0.14 * S);
  g.fillRect(0, mid + 0.18 * S, c.width, 0.14 * S);
  g.fillStyle = 'rgba(240,240,232,.92)';
  g.fillRect(0, (2.4) * S, c.width, 0.15 * S);
  g.fillRect(0, (2 + highwayW - 0.55) * S, c.width, 0.15 * S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  const LEN = 2400;
  tex.repeat.set(LEN / RX, 1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(LEN, TOTAL), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, 0.02, highwayZ);
  m.receiveShadow = true;
  return m;
}

// ── Cerco perimetral (malla romboidal) ──
function chainLinkTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(200,206,212,.95)'; g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(64, 64);
  g.moveTo(64, 0); g.lineTo(0, 64);
  g.moveTo(32, -32); g.lineTo(96, 32); g.moveTo(-32, 32); g.lineTo(32, 96);
  g.moveTo(32, 96); g.lineTo(96, 32); g.moveTo(-32, 32); g.lineTo(32, -32);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface GateDef { x: number; z: number; edge: 'N' | 'S' | 'E' | 'W'; arm?: boolean }

export interface FenceSpec {
  fence: Rect;
  gates: GateDef[];
}

// Divide el borde del cerco en segmentos evitando las aberturas de los portones
function edgeSegments(a0: number, a1: number, gaps: [number, number][]): [number, number][] {
  const sorted = [...gaps].sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let cur = a0;
  for (const [g0, g1] of sorted) {
    if (g0 > cur) out.push([cur, g0]);
    cur = Math.max(cur, g1);
  }
  if (cur < a1) out.push([cur, a1]);
  return out;
}

export function buildFence(scene: THREE.Scene, spec: FenceSpec) {
  const { fence: FENCE, gates } = spec;
  const H = 2.4;
  const group = new THREE.Group();
  group.name = 'fence';
  const link = chainLinkTexture();
  const postGeo = new THREE.CylinderGeometry(0.07, 0.07, H, 6);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x8a9199, metalness: 0.6, roughness: 0.4 });

  // Aberturas por borde (cada portón = gap de 14 m)
  const gap = (v: number) => [v - 7, v + 7] as [number, number];
  const gapsN = gates.filter((gt) => gt.edge === 'N').map((gt) => gap(gt.x));
  const gapsS = gates.filter((gt) => gt.edge === 'S').map((gt) => gap(gt.x));
  const gapsE = gates.filter((gt) => gt.edge === 'E').map((gt) => gap(gt.z));
  const gapsW = gates.filter((gt) => gt.edge === 'W').map((gt) => gap(gt.z));

  const segments: [number, number, number, number][] = [];
  for (const [a0, a1] of edgeSegments(FENCE.x0, FENCE.x1, gapsN)) segments.push([a0, FENCE.z0, a1, FENCE.z0]);
  for (const [a0, a1] of edgeSegments(FENCE.x0, FENCE.x1, gapsS)) segments.push([a0, FENCE.z1, a1, FENCE.z1]);
  for (const [z0, z1] of edgeSegments(FENCE.z0, FENCE.z1, gapsE)) segments.push([FENCE.x1, z0, FENCE.x1, z1]);
  for (const [z0, z1] of edgeSegments(FENCE.z0, FENCE.z1, gapsW)) segments.push([FENCE.x0, z0, FENCE.x0, z1]);

  const posts: THREE.Vector3[] = [];
  for (const [x0, z0, x1, z1] of segments) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.ceil(len / 3);
    for (let i = 0; i <= n; i++) posts.push(new THREE.Vector3(x0 + (x1 - x0) * i / n, H / 2, z0 + (z1 - z0) * i / n));
    const tex = link.clone();
    tex.needsUpdate = true;
    tex.repeat.set(len / 0.5, H / 0.5);
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.5 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, H), mat);
    mesh.position.set((x0 + x1) / 2, H / 2, (z0 + z1) / 2);
    mesh.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    mesh.castShadow = true;
    group.add(mesh);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 5), postMat);
    rail.rotation.z = Math.PI / 2;
    rail.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    rail.position.set((x0 + x1) / 2, H, (z0 + z1) / 2);
    group.add(rail);
  }
  const inst = new THREE.InstancedMesh(postGeo, postMat, posts.length);
  const m = new THREE.Matrix4();
  posts.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); inst.setMatrixAt(i, m); });
  inst.castShadow = true;
  group.add(inst);

  // Barrera del acceso principal (brazo rojo/blanco)
  const sc = document.createElement('canvas');
  sc.width = 128; sc.height = 8;
  const sg = sc.getContext('2d')!;
  for (let i = 0; i < 8; i++) { sg.fillStyle = i % 2 ? '#f1f1f1' : '#d62828'; sg.fillRect(i * 16, 0, 16, 8); }
  const stripes = new THREE.CanvasTexture(sc);
  stripes.colorSpace = THREE.SRGBColorSpace;

  let gateArm: THREE.Object3D | null = null;
  for (const gt of gates) {
    const zBase = gt.edge === 'N' ? FENCE.z0 - 0.8 : gt.edge === 'S' ? FENCE.z1 + 0.8 : gt.z;
    const xBase = gt.edge === 'E' ? FENCE.x1 + 0.8 : gt.edge === 'W' ? FENCE.x0 - 0.8 : gt.x;
    const horizontal = gt.edge === 'N' || gt.edge === 'S';
    const arm = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? 6.2 : 0.14, 0.14, horizontal ? 0.14 : 6.2), new THREE.MeshStandardMaterial({ map: stripes }));
    arm.position.set(xBase + (horizontal ? 3.4 : 0), 1.05, zBase + (horizontal ? 0 : 3.4));
    arm.castShadow = true;
    const armPost = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 0.35), new THREE.MeshStandardMaterial({ color: 0xf2c94c }));
    armPost.position.set(xBase + (horizontal ? 6.6 : 0), 0.55, zBase + (horizontal ? 0 : 6.6));
    armPost.castShadow = true;
    group.add(arm, armPost);
    if (gt.arm !== false && !gateArm) gateArm = arm; // primera barrera = la animada
    if (gt.arm === false) { arm.visible = false; armPost.visible = false; }
  }

  scene.add(group);
  return { group, gateArm };
}
