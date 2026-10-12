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

// Mapa de detalle en mosaico (normal + rugosidad) a partir de ruido de valor
// periódico: micro-relieve del asfalto/hormigón que responde a la luz.
function detailMaps(maxAniso: number, seed = 11) {
  const N = 512;
  const rand = rng(seed);
  const h = new Float32Array(N * N);
  const octave = (cells: number, amp: number) => {
    const grid = new Float32Array(cells * cells);
    for (let i = 0; i < grid.length; i++) grid[i] = rand();
    const at = (x: number, y: number) => grid[((y % cells) + cells) % cells * cells + (((x % cells) + cells) % cells)];
    const k = N / cells;
    for (let y = 0; y < N; y++) {
      const gy = y / k, y0 = Math.floor(gy), fy = gy - y0, sy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < N; x++) {
        const gx = x / k, x0 = Math.floor(gx), fx = gx - x0, sx = fx * fx * (3 - 2 * fx);
        const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
        const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
        h[y * N + x] += (a + (b - a) * sy) * amp;
      }
    }
  };
  octave(8, 0.35); octave(32, 0.3); octave(128, 0.22); octave(256, 0.13);
  const nc = document.createElement('canvas'); nc.width = nc.height = N;
  const rc = document.createElement('canvas'); rc.width = rc.height = N;
  const nd = nc.getContext('2d')!.createImageData(N, N);
  const rd = rc.getContext('2d')!.createImageData(N, N);
  const H = (x: number, y: number) => h[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * 2.2;
      const dy = (H(x, y + 1) - H(x, y - 1)) * 2.2;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * N + x) * 4;
      nd.data[i] = ((-dx / l) * 0.5 + 0.5) * 255;
      nd.data[i + 1] = ((-dy / l) * 0.5 + 0.5) * 255;
      nd.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      nd.data[i + 3] = 255;
      const r = 200 + H(x, y) * 55;
      rd.data[i] = rd.data[i + 1] = rd.data[i + 2] = Math.min(255, r);
      rd.data[i + 3] = 255;
    }
  }
  nc.getContext('2d')!.putImageData(nd, 0, 0);
  rc.getContext('2d')!.putImageData(rd, 0, 0);
  const mk = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    return t;
  };
  return { normal: mk(nc), rough: mk(rc) };
}

function withDetail(mat: THREE.MeshStandardMaterial, d: { normal: THREE.Texture; rough: THREE.Texture }, rx: number, ry: number, strength = 0.55) {
  mat.normalMap = d.normal.clone();
  mat.normalMap.repeat.set(rx, ry);
  mat.normalMap.needsUpdate = true;
  mat.normalScale.set(strength, strength);
  mat.roughnessMap = d.rough.clone();
  mat.roughnessMap.repeat.set(rx * 0.37, ry * 0.37);
  mat.roughnessMap.needsUpdate = true;
  mat.roughness = 1;
  return mat;
}

// ── Detalle fotográfico (Poly Haven, CC0) ──
// El canvas pintado define layout, demarcación y manchas; las fotos aportan
// el grano real del material. Se modula el color por la razón foto/promedio
// (el promedio sale del último nivel de mipmap), mezclando dos escalas para
// romper la repetición. Máscara: R=asfalto, G=hormigón, B=tierra, resto=pasto.
const TEX_BASE = '/cc-assets/tex';
const SURF_TILE = { asph: 30, conc: 4, dirt: 20, grass: 5 };   // metros por repetición
let photoSet: Promise<Record<'asph' | 'conc' | 'dirt' | 'grass', THREE.Texture>> | null = null;
function loadPhotoSet(maxAniso: number) {
  if (!photoSet) {
    const loader = new THREE.TextureLoader();
    const one = (f: string) => loader.loadAsync(`${TEX_BASE}/${f}`).then((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = maxAniso;
      return t;
    });
    photoSet = Promise.all([one('asphalt_diff.jpg'), one('concrete_diff.jpg'), one('dirt_diff.jpg'), one('grass_diff.jpg')])
      .then(([asph, conc, dirt, grass]) => ({ asph, conc, dirt, grass }));
  }
  return photoSet;
}

const BLACK_1PX = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
BLACK_1PX.needsUpdate = true;

// metersPerUv: metros que abarca 1 unidad de vMapUv (incluye el repeat del map).
// weights: si no hay máscara, mezcla fija (asfalto, hormigón, tierra, pasto).
function withPhotoDetail(
  mat: THREE.MeshStandardMaterial, maxAniso: number, metersPerUv: [number, number],
  opts: { mask?: THREE.Texture; weights?: [number, number, number, number]; strength?: number },
) {
  const u = {
    tAsph: { value: BLACK_1PX as THREE.Texture }, tConc: { value: BLACK_1PX as THREE.Texture },
    tDirt: { value: BLACK_1PX as THREE.Texture }, tGrass: { value: BLACK_1PX as THREE.Texture },
    tMask: { value: opts.mask ?? BLACK_1PX },
    uUseMask: { value: opts.mask ? 1 : 0 },
    uWeights: { value: new THREE.Vector4(...(opts.weights ?? [0, 0, 0, 1])) },
    uMpu: { value: new THREE.Vector2(...metersPerUv) },
    uTile: { value: new THREE.Vector4(SURF_TILE.asph, SURF_TILE.conc, SURF_TILE.dirt, SURF_TILE.grass) },
    uDetail: { value: 0 },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tAsph; uniform sampler2D tConc; uniform sampler2D tDirt; uniform sampler2D tGrass; uniform sampler2D tMask;
uniform float uUseMask; uniform vec4 uWeights; uniform vec2 uMpu; uniform vec4 uTile; uniform float uDetail;
vec3 phDetail(sampler2D t, vec2 m, float tile) {
  vec2 p = m / tile;
  vec3 a = texture2D(t, p).rgb;
  vec3 b = texture2D(t, vec2(p.y, -p.x) * 0.29 + vec2(0.37, 0.11)).rgb;
  vec3 avg = textureLod(t, vec2(0.5), 14.0).rgb;
  return clamp(mix(a, b, 0.38) / max(avg, vec3(0.015)), 0.25, 2.4);
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
if (uDetail > 0.0) {
  vec2 m = vMapUv * uMpu;
  vec4 w = uWeights;
  if (uUseMask > 0.5) { vec3 k = texture2D(tMask, vMapUv).rgb; w = vec4(k, clamp(1.0 - k.r - k.g - k.b, 0.0, 1.0)); }
  vec3 r = vec3(0.0);
  if (w.x > 0.002) r += phDetail(tAsph, m, uTile.x) * w.x;
  if (w.y > 0.002) r += phDetail(tConc, m, uTile.y) * w.y;
  if (w.z > 0.002) r += phDetail(tDirt, m, uTile.z) * w.z;
  if (w.w > 0.002) r += phDetail(tGrass, m, uTile.w) * w.w;
  float ws = w.x + w.y + w.z + w.w;
  if (ws > 0.001) diffuseColor.rgb *= mix(vec3(1.0), r / ws, uDetail);
}`);
  };
  mat.customProgramCacheKey = () => 'cc-photo-detail';
  loadPhotoSet(maxAniso).then((p) => {
    u.tAsph.value = p.asph; u.tConc.value = p.conc; u.tDirt.value = p.dirt; u.tGrass.value = p.grass;
    u.uDetail.value = opts.strength ?? 0.85;
  }).catch((e) => console.warn('[CentroControl] texturas de superficie no disponibles', e));
  return mat;
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

  // Máscara de superficies (2 px/m): negro = pasto
  const MS = 2;
  const mcv = document.createElement('canvas');
  mcv.width = Math.ceil((BOUNDS.x1 - BOUNDS.x0) * MS); mcv.height = Math.ceil((BOUNDS.z1 - BOUNDS.z0) * MS);
  const mg = mcv.getContext('2d')!;
  mg.fillStyle = '#000'; mg.fillRect(0, 0, mcv.width, mcv.height);
  const mask = (color: string, x0: number, z0: number, x1: number, z1: number) => {
    mg.fillStyle = color;
    mg.fillRect((x0 - BOUNDS.x0) * MS, (z0 - BOUNDS.z0) * MS, (x1 - x0) * MS, (z1 - z0) * MS);
  };

  const noise = (x0: number, z0: number, x1: number, z1: number, colors: string[], n: number, size: [number, number]) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = colors[(rand() * colors.length) | 0];
      const s = size[0] + rand() * (size[1] - size[0]);
      g.fillRect(X(x0 + rand() * (x1 - x0)), Z(z0 + rand() * (z1 - z0)), s, s);
    }
  };

  // Manchas suaves (variación macro de tono), en metros
  const blob = (cx: number, cz: number, r: number, rgb: string, a: number) => {
    const gr = g.createRadialGradient(X(cx), Z(cz), 0, X(cx), Z(cz), r * S);
    gr.addColorStop(0, `rgba(${rgb},${a})`);
    gr.addColorStop(0.6, `rgba(${rgb},${a * 0.45})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(X(cx - r), Z(cz - r), 2 * r * S, 2 * r * S);
  };
  const blobs = (x0: number, z0: number, x1: number, z1: number, n: number, rMin: number, rMax: number, pal: [string, number][]) => {
    for (let i = 0; i < n; i++) {
      const [rgb, a] = pal[(rand() * pal.length) | 0];
      blob(x0 + rand() * (x1 - x0), z0 + rand() * (z1 - z0), rMin + rand() * (rMax - rMin), rgb, a * (0.5 + rand() * 0.5));
    }
  };
  const clipped = (x0: number, z0: number, x1: number, z1: number, fn: () => void) => {
    g.save();
    g.beginPath(); g.rect(X(x0), Z(z0), (x1 - x0) * S, (z1 - z0) * S); g.clip();
    fn();
    g.restore();
  };
  // Grieta: paseo aleatorio fino con ramificaciones ocasionales
  const crack = (x: number, z: number, steps: number, depth = 0) => {
    g.strokeStyle = `rgba(18,18,20,${0.35 + rand() * 0.25})`;
    g.lineWidth = Math.max(0.6, 1.3 - depth * 0.4);
    g.beginPath(); g.moveTo(X(x), Z(z));
    let a = rand() * Math.PI * 2;
    for (let i = 0; i < steps; i++) {
      a += (rand() - 0.5) * 1.1;
      x += Math.cos(a) * 0.7; z += Math.sin(a) * 0.7;
      g.lineTo(X(x), Z(z));
      if (depth < 1 && rand() < 0.07) { g.stroke(); crack(x, z, (steps - i) >> 1, depth + 1); g.beginPath(); g.moveTo(X(x), Z(z)); }
    }
    g.stroke();
  };
  // Huellas de neumáticos: pares de bandas tenues con leve ondulación
  const tireTracks = (x0: number, z0: number, x1: number, z1: number, n: number) => {
    const alongX = (x1 - x0) >= (z1 - z0);
    for (let i = 0; i < n; i++) {
      const off = alongX ? z0 + 1.5 + rand() * (z1 - z0 - 3) : x0 + 1.5 + rand() * (x1 - x0 - 3);
      const wob = (rand() - 0.5) * 2.4;
      g.strokeStyle = `rgba(16,16,18,${0.05 + rand() * 0.07})`;
      g.lineWidth = (0.3 + rand() * 0.25) * S;
      for (const d of [0, 1.9 + rand() * 0.3]) {
        g.beginPath();
        if (alongX) { g.moveTo(X(x0), Z(off + d)); g.quadraticCurveTo(X((x0 + x1) / 2), Z(off + d + wob), X(x1), Z(off + d)); }
        else { g.moveTo(X(off + d), Z(z0)); g.quadraticCurveTo(X(off + d + wob), Z((z0 + z1) / 2), X(off + d), Z(z1)); }
        g.stroke();
      }
    }
  };

  // ── Césped base: tonos irregulares, zonas secas y pisoteadas ──
  g.fillStyle = '#6a8a48';
  g.fillRect(0, 0, W, H);
  {
    const bw = BOUNDS.x1 - BOUNDS.x0, bh = BOUNDS.z1 - BOUNDS.z0;
    blobs(BOUNDS.x0, BOUNDS.z0, BOUNDS.x1, BOUNDS.z1, Math.round(bw * bh / 260), 6, 18,
      [['86,118,58', 0.35], ['120,138,72', 0.3], ['74,100,48', 0.35], ['150,146,92', 0.22], ['98,128,62', 0.3]]);
  }
  noise(BOUNDS.x0, BOUNDS.z0, BOUNDS.x1, BOUNDS.z1, ['#638342', '#729250', '#5c7c3c', '#7d9b58', '#86996a'], 110000, [2, 6]);

  // ── Herramientas de pintado (las consume el escenario) ──
  const WHITE = 'rgba(240,240,232,.92)';
  const YELLOW = 'rgba(250,204,21,.95)';

  const concrete = (x0: number, z0: number, x1: number, z1: number) => {
    const A = (x1 - x0) * (z1 - z0);
    mask('#00ff00', x0, z0, x1, z1);
    g.fillStyle = '#b0aca2';
    rect(x0, z0, x1, z1);
    clipped(x0, z0, x1, z1, () => {
      // Losas de 6 m con tono propio (vaciados distintos)
      for (let x = x0; x < x1; x += 6) {
        for (let z = z0; z < z1; z += 6) {
          const v = rand();
          g.fillStyle = v < 0.5 ? `rgba(255,252,240,${0.04 + rand() * 0.07})` : `rgba(70,64,56,${0.03 + rand() * 0.07})`;
          rect(x, z, Math.min(x + 6, x1), Math.min(z + 6, z1));
        }
      }
      blobs(x0, z0, x1, z1, Math.round(A / 45), 1.5, 6, [['92,86,76', 0.16], ['120,110,92', 0.14], ['205,200,188', 0.16]]);
      noise(x0, z0, x1, z1, ['#a9a59b', '#b9b5ab', '#a5a197', '#c2beb4'], Math.round(A * 16), [1, 4]);
      // Suciedad de tránsito y manchas de aceite
      blobs(x0, z0, x1, z1, Math.round(A / 160), 2, 5, [['58,54,48', 0.14]]);
      blobs(x0, z0, x1, z1, Math.round(A / 420), 0.5, 1.4, [['30,28,26', 0.35]]);
      tireTracks(x0, z0, x1, z1, Math.max(1, Math.round(A / 1400)));
      // Juntas de dilatación: surco oscuro + borde claro
      g.lineWidth = 1.6;
      for (let x = x0; x <= x1; x += 6) {
        g.strokeStyle = 'rgba(55,50,44,.42)'; g.beginPath(); g.moveTo(X(x), Z(z0)); g.lineTo(X(x), Z(z1)); g.stroke();
        g.strokeStyle = 'rgba(235,232,222,.18)'; g.beginPath(); g.moveTo(X(x) + 1.5, Z(z0)); g.lineTo(X(x) + 1.5, Z(z1)); g.stroke();
      }
      for (let z = z0; z <= z1; z += 6) {
        g.strokeStyle = 'rgba(55,50,44,.42)'; g.beginPath(); g.moveTo(X(x0), Z(z)); g.lineTo(X(x1), Z(z)); g.stroke();
        g.strokeStyle = 'rgba(235,232,222,.18)'; g.beginPath(); g.moveTo(X(x0), Z(z) + 1.5); g.lineTo(X(x1), Z(z) + 1.5); g.stroke();
      }
      for (let i = 0; i < A / 1800; i++) crack(x0 + rand() * (x1 - x0), z0 + rand() * (z1 - z0), 6 + ((rand() * 8) | 0));
    });
  };

  const lawn = (x0: number, z0: number, x1: number, z1: number) => {
    const A = (x1 - x0) * (z1 - z0);
    mask('#00ff00', x0 - 0.6, z0 - 0.6, x1 + 0.6, z1 + 0.6);
    mask('#000000', x0, z0, x1, z1);
    g.fillStyle = '#cfcabd'; rect(x0 - 0.6, z0 - 0.6, x1 + 0.6, z1 + 0.6); // cordón
    g.fillStyle = 'rgba(90,84,74,.35)'; rect(x0 - 0.6, z1 + 0.3, x1 + 0.6, z1 + 0.6);
    g.fillStyle = '#6c8e4c'; rect(x0, z0, x1, z1);
    clipped(x0, z0, x1, z1, () => {
      blobs(x0, z0, x1, z1, Math.max(2, Math.round(A / 30)), 1.5, 6, [['88,122,60', 0.4], ['126,144,78', 0.3], ['70,98,46', 0.4]]);
      noise(x0, z0, x1, z1, ['#658747', '#77975a', '#5f8142', '#82a060'], Math.round(A * 3), [2, 5]);
    });
  };

  const asphalt = (x0: number, z0: number, x1: number, z1: number) => {
    const A = (x1 - x0) * (z1 - z0);
    mask('#ff0000', x0, z0, x1, z1);
    g.fillStyle = '#3b3f44';
    rect(x0, z0, x1, z1);
    clipped(x0, z0, x1, z1, () => {
      // Envejecimiento desparejo: zonas lavadas por el sol y zonas más nuevas
      blobs(x0, z0, x1, z1, Math.round(A / 55), 3, 11, [['92,94,96', 0.22], ['26,28,32', 0.3], ['110,104,94', 0.12]]);
      noise(x0, z0, x1, z1, ['#363a40', '#43474d', '#30343a', '#4a4e54'], Math.round(A * 1.8), [1.5, 4]);
      noise(x0, z0, x1, z1, ['#5a5e63', '#25282c'], Math.round(A * 0.9), [1, 2]);   // árido
      // Bacheos: parches rectangulares de mezcla más oscura
      for (let i = 0; i < A / 700; i++) {
        const w = 2.5 + rand() * 6, d = 1.8 + rand() * 4;
        const px = x0 + rand() * (x1 - x0 - w), pz = z0 + rand() * (z1 - z0 - d);
        g.fillStyle = `rgba(24,26,30,${0.35 + rand() * 0.25})`; rect(px, pz, px + w, pz + d);
        g.strokeStyle = 'rgba(14,14,16,.45)'; g.lineWidth = 1.2;
        g.strokeRect(X(px), Z(pz), w * S, d * S);
      }
      blobs(x0, z0, x1, z1, Math.round(A / 260), 0.5, 1.6, [['12,12,14', 0.45]]);       // aceite
      for (let i = 0; i < A / 420; i++) crack(x0 + rand() * (x1 - x0), z0 + rand() * (z1 - z0), 8 + ((rand() * 14) | 0));
      tireTracks(x0, z0, x1, z1, Math.max(1, Math.round(A / 900)));
    });
  };

  const vereda = (x0: number, z0: number, x1: number, z1: number) => {
    mask('#00ff00', x0, z0, x1, z1);
    g.fillStyle = '#d6d2c8';
    rect(x0, z0, x1, z1);
  };

  const dirt = (x0: number, z0: number, x1: number, z1: number) => {
    const A = (x1 - x0) * (z1 - z0);
    mask('#0000ff', x0, z0, x1, z1);
    g.fillStyle = '#9c876a';
    rect(x0, z0, x1, z1);
    clipped(x0, z0, x1, z1, () => {
      blobs(x0, z0, x1, z1, Math.round(A / 60), 3, 10, [['130,110,82', 0.3], ['176,156,122', 0.25], ['110,124,70', 0.18], ['84,72,56', 0.22]]);
      noise(x0, z0, x1, z1, ['#93805f', '#a8936f', '#8a785a', '#b29c78', '#7d6e55'], Math.round(A * 2.2), [2, 6]);
      tireTracks(x0, z0, x1, z1, Math.max(1, Math.round(A / 1200)));
    });
  };

  // Demarcación con desgaste: trazo principal + erosión por tránsito
  const line = (x0: number, z0: number, x1: number, z1: number, color: string, w: number, dash?: number[]) => {
    g.save();
    g.globalAlpha = 0.88;
    g.strokeStyle = color; g.lineWidth = w * S; g.setLineDash(dash ? dash.map((d) => d * S) : []);
    g.beginPath(); g.moveTo(X(x0), Z(z0)); g.lineTo(X(x1), Z(z1)); g.stroke();
    g.setLineDash([]);
    g.restore();
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.round(len * w * 22);
    g.fillStyle = 'rgba(60,62,66,.55)';
    for (let i = 0; i < n; i++) {
      const t = rand(), o = (rand() - 0.5) * w;
      const nx = -(z1 - z0) / (len || 1), nz = (x1 - x0) / (len || 1);
      const s = 1 + rand() * 2;
      g.fillRect(X(x0 + (x1 - x0) * t + nx * o), Z(z0 + (z1 - z0) * t + nz * o), s, s);
    }
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
  const detail = detailMaps(maxAniso);
  const maskTex = new THREE.CanvasTexture(mcv);
  maskTex.colorSpace = THREE.NoColorSpace;
  maskTex.generateMipmaps = false;
  maskTex.minFilter = THREE.LinearFilter;
  const groundMat = withDetail(new THREE.MeshStandardMaterial({ map: tex, metalness: 0 }), detail, w / 5, h / 5);
  withPhotoDetail(groundMat, maxAniso, [w, h], { mask: maskTex });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), groundMat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((BOUNDS.x0 + BOUNDS.x1) / 2, 0, (BOUNDS.z0 + BOUNDS.z1) / 2);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  mesh.userData.groundSurface = true;
  scene.add(mesh);

  // Campo exterior: mosaico de pasto con variación (sin efecto alfombra)
  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    withDetail(new THREE.MeshStandardMaterial({ map: grassTile(maxAniso), metalness: 0 }), detail, 600, 600, 0.4),
  );
  (outer.material as THREE.MeshStandardMaterial).map!.repeat.set(3000 / 90, 3000 / 90);
  withPhotoDetail(outer.material as THREE.MeshStandardMaterial, maxAniso, [90, 90], { weights: [0, 0, 0, 1] });
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.05;
  outer.receiveShadow = true;
  scene.add(outer);
  const hw = buildHighway(maxAniso, HIGHWAY_Z, HIGHWAY_W);
  withDetail(hw.material as THREE.MeshStandardMaterial, detail, 2400 / 5, (HIGHWAY_W + 4) / 5);
  withPhotoDetail(hw.material as THREE.MeshStandardMaterial, maxAniso, [24, HIGHWAY_W + 4], { weights: [1, 0, 0, 0] });
  hw.userData.groundSurface = true;
  scene.add(hw);
  return mesh;
}

// Mosaico de pasto periódico (90 m) para el campo exterior
function grassTile(maxAniso: number) {
  const N = 1024, M = 90, k = N / M;
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d')!;
  const rand = rng(23);
  g.fillStyle = '#688846'; g.fillRect(0, 0, N, N);
  const pal = ['86,118,58', '120,138,72', '74,100,48', '150,146,92', '98,128,62'];
  for (let i = 0; i < 70; i++) {
    const x = rand() * N, y = rand() * N, r = (6 + rand() * 18) * k;
    const rgb = pal[(rand() * pal.length) | 0], a = 0.15 + rand() * 0.2;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r);
    }
  }
  const cols = ['#638342', '#729250', '#5c7c3c', '#7d9b58'];
  for (let i = 0; i < 26000; i++) { g.fillStyle = cols[(rand() * 4) | 0]; const s = 1 + rand() * 2.5; g.fillRect(rand() * N, rand() * N, s, s); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  return t;
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
