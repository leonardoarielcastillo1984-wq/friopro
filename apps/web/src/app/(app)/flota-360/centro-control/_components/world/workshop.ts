// ============================================================
// Nave industrial del taller construida a medida (reemplaza el
// modelo genérico): chapa acanalada PBR (Poly Haven, CC0), techo
// multi-caballete con lucernarios, canaletas y bajadas, extractores
// eólicos, zócalo de hormigón, portones seccionales abiertos con
// interior iluminado, ventanas corridas y cartel DADA.
// ============================================================
import * as THREE from 'three';

export interface WorkshopSpec {
  x0: number; x1: number; z0: number; z1: number;   // huella (z1 = frente con portones)
  doors: number[];                                   // centro X de cada portón del frente
  spans: number;                                     // caballetes (cumbreras N-S)
  eave?: number; ridge?: number;
  doorW?: number; doorH?: number;
}

const TEX = '/cc-assets/tex';
const loader = new THREE.TextureLoader();
let corr: Promise<{ map: THREE.Texture; nor: THREE.Texture; rough: THREE.Texture }> | null = null;
function corrugated(maxAniso: number) {
  if (!corr) {
    const one = (f: string, srgb: boolean) => loader.loadAsync(`${TEX}/${f}`).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = maxAniso;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
    corr = Promise.all([one('corrugated_diff.jpg', true), one('corrugated_nor.jpg', false), one('corrugated_rough.jpg', false)])
      .then(([map, nor, rough]) => ({ map, nor, rough }));
  }
  return corr;
}

// Material de chapa con escala física: `rx`,`ry` = repeticiones sobre la cara.
// `rot` gira las ondas (techo: ondas en el sentido de la pendiente).
export function sheetMat(color: number, rx: number, ry: number, maxAniso: number, opts: { rot?: boolean; metal?: number } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: opts.metal ?? 0.35, envMapIntensity: 1 });
  corrugated(maxAniso).then((c) => {
    const set = (t: THREE.Texture) => {
      const k = t.clone();
      k.repeat.set(rx, ry);
      if (opts.rot) { k.center.set(0.5, 0.5); k.rotation = Math.PI / 2; k.repeat.set(ry, rx); }
      k.needsUpdate = true;
      return k;
    };
    m.map = set(c.map); m.normalMap = set(c.nor); m.roughnessMap = set(c.rough);
    m.normalScale.set(1.2, 1.2);
    m.roughness = 1;
    m.needsUpdate = true;
  }).catch(() => {});
  return m;
}

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function hazardTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f2c230'; g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#1a1a1a';
  for (let y = -64; y < 320; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y - 40); g.lineTo(64, y - 16); g.lineTo(0, y + 24); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function signTex() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0d4da0'; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 0, 1024, 18);
  g.fillStyle = '#ffffff'; g.font = '900 150px system-ui, Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('DADA', 380, 136);
  g.font = '700 58px system-ui, Arial, sans-serif'; g.fillStyle = '#cfe0f7'; g.fillText('TALLER', 800, 136);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// Fondo cálido visto a través de los portones: degradé de nave iluminada
function interiorTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#2a2620'); gr.addColorStop(0.35, '#8a7348'); gr.addColorStop(0.75, '#5a4b33'); gr.addColorStop(1, '#2b2721');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  for (let x = 20; x < 256; x += 56) { g.fillStyle = 'rgba(255,236,190,.55)'; g.fillRect(x, 24, 30, 6); }
  g.fillStyle = 'rgba(30,30,30,.6)';
  g.fillRect(30, 150, 50, 70); g.fillRect(180, 160, 40, 60);   // bancos / estanterías
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildWorkshop(spec: WorkshopSpec, maxAniso: number): { root: THREE.Group; nightGlows: THREE.Object3D[] } {
  const { x0, x1, z0, z1, doors, spans } = spec;
  const EAVE = spec.eave ?? 9;
  const RIDGE = spec.ridge ?? 12.5;
  const DW = spec.doorW ?? 7.5, DH = spec.doorH ?? 6.6;
  const W = x1 - x0, D = z1 - z0;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const T = 0.3;                 // espesor de pared
  const PLINTH = 1.2;
  const root = new THREE.Group();
  root.name = 'workshop';
  const nightGlows: THREE.Object3D[] = [];

  const SHEET = 2;               // metros por repetición de la chapa
  const wallColor = 0xd3d7da;
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x9e9a92, roughness: 0.92 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x5b6470, roughness: 0.45, metalness: 0.6 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.6, metalness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1d2a36, roughness: 0.08, metalness: 0.3, envMapIntensity: 1.6 });
  const glassNight = new THREE.MeshStandardMaterial({ color: 0x1d2a36, emissive: 0xffd9a0, emissiveIntensity: 0.9, roughness: 0.1 });

  // ── Muros largos (este/oeste) y fondo (norte) ──
  const wallH = EAVE - PLINTH;
  const longWall = (x: number) => {
    root.add(box(T, wallH, D, sheetMat(wallColor, D / SHEET, wallH / SHEET, maxAniso), x, PLINTH + wallH / 2, cz));
    root.add(box(T + 0.25, PLINTH, D + 0.25, concreteMat, x, PLINTH / 2, cz));
    // ventanas corridas altas
    const win = box(0.12, 1.4, D - 8, glassMat, x + (x < cx ? -T / 2 - 0.02 : T / 2 + 0.02), EAVE - 2.2, cz);
    win.castShadow = false;
    root.add(win);
    const winN = win.clone(); winN.material = glassNight; winN.visible = false; root.add(winN); nightGlows.push(winN);
  };
  longWall(x0); longWall(x1);
  root.add(box(W, wallH, T, sheetMat(wallColor, W / SHEET, wallH / SHEET, maxAniso), cx, PLINTH + wallH / 2, z0));
  root.add(box(W + 0.25, PLINTH, T + 0.25, concreteMat, cx, PLINTH / 2, z0));

  // ── Frente (sur) con aberturas de portones ──
  const openings = [...doors].sort((a, b) => a - b).map((d) => [d - DW / 2, d + DW / 2] as [number, number]);
  let cur = x0;
  const frontSeg = (a: number, b: number) => {
    if (b - a < 0.05) return;
    root.add(box(b - a, wallH, T, sheetMat(wallColor, (b - a) / SHEET, wallH / SHEET, maxAniso), (a + b) / 2, PLINTH + wallH / 2, z1));
    root.add(box(b - a, PLINTH, T + 0.25, concreteMat, (a + b) / 2, PLINTH / 2, z1));
  };
  const hz = hazardTex();
  const hzMat = new THREE.MeshStandardMaterial({ map: hz, roughness: 0.7 });
  const inside = new THREE.MeshBasicMaterial({ map: interiorTex(), toneMapped: true });
  for (const [a, b] of openings) {
    frontSeg(cur, a);
    const lintelH = EAVE - DH;
    root.add(box(b - a, lintelH, T, sheetMat(wallColor, (b - a) / SHEET, lintelH / SHEET, maxAniso), (a + b) / 2, DH + lintelH / 2, z1));
    // marco con banda de seguridad + caja del portón enrollado
    for (const jx of [a, b]) root.add(box(0.45, DH, 0.5, hzMat, jx, DH / 2, z1 + 0.1));
    root.add(box(b - a + 0.6, 0.9, 0.9, trimMat, (a + b) / 2, DH + 0.45, z1 + 0.35));
    // interior visible: piso oscuro + fondo iluminado
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(b - a, 12), new THREE.MeshStandardMaterial({ color: 0x5d5a55, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set((a + b) / 2, 0.03, z1 - 6); floor.receiveShadow = true;
    root.add(floor);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(b - a + 2, DH + 1), inside);
    back.position.set((a + b) / 2, (DH + 1) / 2, z1 - 11);
    root.add(back);
    for (const sx of [a - 0.01, b + 0.01]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(11, DH), darkMat);
      side.rotation.y = Math.PI / 2; side.position.set(sx + (sx < (a + b) / 2 ? 0.2 : -0.2), DH / 2, z1 - 5.5);
      root.add(side);
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(b - a, 11), darkMat);
    ceil.rotation.x = Math.PI / 2; ceil.position.set((a + b) / 2, DH, z1 - 5.5);
    root.add(ceil);
    // luz cálida que se derrama al apron por la noche
    const spill = new THREE.Mesh(
      new THREE.PlaneGeometry(b - a + 4, 9),
      new THREE.MeshBasicMaterial({ color: 0xffc879, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    spill.rotation.x = -Math.PI / 2; spill.position.set((a + b) / 2, 0.06, z1 + 4); spill.visible = false;
    root.add(spill); nightGlows.push(spill);
    cur = b;
  }
  frontSeg(cur, x1);

  // ── Hastiales y techo multi-caballete ──
  const spanW = W / spans;
  const rise = RIDGE - EAVE;
  const slope = Math.hypot(spanW / 2, rise);
  const ang = Math.atan2(rise, spanW / 2);
  const roofColor = 0xa7aeb5;
  const skyMat = new THREE.MeshStandardMaterial({ color: 0xdfe7ea, roughness: 0.25, metalness: 0, transparent: true, opacity: 0.85, envMapIntensity: 1.3 });
  const skyNight = new THREE.MeshStandardMaterial({ color: 0xdfe7ea, emissive: 0xffe2b0, emissiveIntensity: 0.55, roughness: 0.3 });
  const gableMat = sheetMat(wallColor, spanW / SHEET, rise / SHEET, maxAniso);
  const gutterMat = new THREE.MeshStandardMaterial({ color: 0x8c949c, roughness: 0.35, metalness: 0.75 });
  const OVH = 0.6;   // alero
  for (let i = 0; i < spans; i++) {
    const sx0 = x0 + i * spanW, sxm = sx0 + spanW / 2;
    // hastial triangular en ambos extremos
    const tri = new THREE.Shape();
    tri.moveTo(-spanW / 2, 0); tri.lineTo(spanW / 2, 0); tri.lineTo(0, rise); tri.closePath();
    const tg = new THREE.ShapeGeometry(tri);
    const uv = tg.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (uv.getX(k) + spanW / 2) / spanW, uv.getY(k) / rise);
    for (const [gz, ry] of [[z1 + T / 2 + 0.01, 0], [z0 - T / 2 - 0.01, Math.PI]] as [number, number][]) {
      const gm = new THREE.Mesh(tg, gableMat);
      gm.position.set(sxm, EAVE, gz); gm.rotation.y = ry; gm.castShadow = true; gm.receiveShadow = true;
      root.add(gm);
    }
    // aguas del techo (ondas en el sentido de la pendiente)
    for (const side of [-1, 1]) {
      const len = slope + OVH;
      const plane = box(len, 0.18, D + OVH * 2, sheetMat(roofColor, (D + OVH * 2) / SHEET, len / SHEET, maxAniso, { rot: true, metal: 0.5 }),
        0, 0, 0);
      plane.rotation.z = side * -ang;
      plane.position.set(sxm + side * (spanW / 4 + OVH / 4), EAVE + rise / 2 - 0.02, cz);
      root.add(plane);
      // lucernarios (2 bandas por agua)
      for (const f of [-0.28, 0.22]) {
        const sk = new THREE.Mesh(new THREE.BoxGeometry(slope * 0.34, 0.06, 2.2), skyMat);
        sk.rotation.z = side * -ang;
        sk.position.set(sxm + side * spanW / 4, EAVE + rise / 2 + 0.12, cz + f * D);
        root.add(sk);
        const skn = sk.clone(); skn.material = skyNight; skn.visible = false; root.add(skn); nightGlows.push(skn);
      }
    }
    // cumbrera
    root.add(box(0.9, 0.35, D + OVH * 2, trimMat, sxm, RIDGE + 0.1, cz));
    // extractores eólicos sobre la cumbrera
    for (let z = z0 + 8; z < z1 - 4; z += 14) {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.6, 14), gutterMat);
      base.position.set(sxm, RIDGE + 0.55, z); base.castShadow = true;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), gutterMat);
      head.position.set(sxm, RIDGE + 0.85, z); head.castShadow = true;
      root.add(base, head);
    }
    // canaleta de limahoya / perimetral
    const gx = sx0 + (i === 0 ? -OVH * 0.6 : 0);
    root.add(box(0.5, 0.35, D + OVH * 2, gutterMat, gx, EAVE + 0.05, cz));
  }
  root.add(box(0.5, 0.35, D + OVH * 2, gutterMat, x1 + OVH * 0.6, EAVE + 0.05, cz));

  // bajadas pluviales en esquinas y a mitad de los muros largos
  const pipeGeo = new THREE.CylinderGeometry(0.11, 0.11, EAVE, 8);
  for (const [px, pz] of [[x0 - 0.35, z0 + 0.6], [x0 - 0.35, cz], [x0 - 0.35, z1 - 0.6], [x1 + 0.35, z0 + 0.6], [x1 + 0.35, cz], [x1 + 0.35, z1 - 0.6]]) {
    const p = new THREE.Mesh(pipeGeo, gutterMat); p.position.set(px, EAVE / 2, pz); p.castShadow = true; root.add(p);
  }

  // cartel corporativo sobre el frente
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.5), new THREE.MeshStandardMaterial({ map: signTex(), roughness: 0.4, metalness: 0.1 }));
  sign.position.set(x0 + 11, EAVE - 1.6, z1 + T / 2 + 0.05);
  root.add(sign);
  // puerta peatonal + equipos exteriores (condensadora en muro este)
  root.add(box(1.1, 2.2, 0.12, trimMat, x1 - 6, 1.1, z1 + T / 2 + 0.05));
  root.add(box(1.4, 1.1, 0.8, new THREE.MeshStandardMaterial({ color: 0xe5e7e9, roughness: 0.5, metalness: 0.3 }), x1 + 0.9, 0.55, z0 + 10));
  root.add(box(1.4, 1.1, 0.8, new THREE.MeshStandardMaterial({ color: 0xe5e7e9, roughness: 0.5, metalness: 0.3 }), x1 + 0.9, 0.55, z0 + 12));
  // luminarias de fachada (apliques sobre portones)
  for (const d of doors) {
    const lamp = box(1.2, 0.25, 0.5, darkMat, d, DH + 1.4, z1 + 0.5);
    root.add(lamp);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.4), new THREE.MeshBasicMaterial({ color: 0xfff1cf }));
    glow.rotation.x = Math.PI / 2; glow.position.set(d, DH + 1.26, z1 + 0.5); glow.visible = false;
    root.add(glow); nightGlows.push(glow);
  }

  root.traverse((o) => { o.matrixAutoUpdate = false; o.updateMatrix(); });
  root.updateMatrixWorld(true);
  return { root, nightGlows };
}
