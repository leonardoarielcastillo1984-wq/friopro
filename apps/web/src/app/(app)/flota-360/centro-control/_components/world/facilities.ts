// ============================================================
// Garita y lavadero construidos a medida (reemplazan modelos
// genéricos) con materiales PBR: chapa acanalada, vidrio, acero,
// hormigón y piso mojado con reflejos.
// ============================================================
import * as THREE from 'three';
import { sheetMat } from './workshop';

export interface WashSpec { x0: number; x1: number; z0: number; z1: number; arches?: number[] }
export interface GuardSpec { x: number; z: number; rot: number; laneX?: number }

type Built = { root: THREE.Group; nightGlows: THREE.Object3D[] };

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}

function textTex(lines: { t: string; font: string; color: string; y: number }[], bg: string, w = 512, h = 128) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const l of lines) { g.font = l.font; g.fillStyle = l.color; g.fillText(l.t, w / 2, l.y); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

const M = () => ({
  steel: new THREE.MeshStandardMaterial({ color: 0x6f7883, roughness: 0.4, metalness: 0.75 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.5, metalness: 0.3 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0xa29d94, roughness: 0.92 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x24394a, roughness: 0.05, metalness: 0.3, envMapIntensity: 1.8, transparent: true, opacity: 0.82 }),
  glassNight: new THREE.MeshStandardMaterial({ color: 0x2a3a48, emissive: 0xffe0b0, emissiveIntensity: 0.9, roughness: 0.1 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x23282f, roughness: 0.6, metalness: 0.3 }),
  white: new THREE.MeshStandardMaterial({ color: 0xe8eaec, roughness: 0.55, metalness: 0.15 }),
});

// ── Lavadero: pórtico abierto de estructura metálica, techo de chapa con
// policarbonato, piso mojado reflectivo, rejillas de desagüe, arcos de
// lavado con cepillos, hidrolavadora, tanque de agua tratada.
export function buildWash(s: WashSpec, aniso: number): Built {
  const root = new THREE.Group(); root.name = 'wash';
  const glows: THREE.Object3D[] = [];
  const m = M();
  const W = s.x1 - s.x0, D = s.z1 - s.z0, cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
  const H = 6.8;

  // Piso mojado: losa con película de agua (baja rugosidad, oscurecida)
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(W + 6, D - 1).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x4a4e52, roughness: 0.12, metalness: 0.1, envMapIntensity: 1.4, transparent: true, opacity: 0.72 }));
  wet.position.set(cx, 0.035, cz); wet.receiveShadow = true;
  root.add(wet);
  // Charcos más brillantes
  for (const [px, pz, r] of [[cx - W * 0.3, cz + 1.5, 1.8], [cx + W * 0.15, cz - 2, 2.4], [cx + W * 0.38, cz + 2.4, 1.4]]) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(r, 24).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x2e3338, roughness: 0.03, metalness: 0.2, envMapIntensity: 2, transparent: true, opacity: 0.8 }));
    p.scale.set(1.6, 1, 1); p.position.set(px, 0.04, pz); root.add(p);
  }
  // Rejillas de desagüe longitudinales
  const grate = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.5, metalness: 0.8 });
  for (const z of [cz - D / 2 + 1.2, cz + D / 2 - 1.2]) root.add(box(W + 4, 0.04, 0.45, grate, cx, 0.05, z, false));
  root.add(box(0.45, 0.04, D - 2, grate, cx, 0.05, cz, false));

  // Pórticos (columnas + vigas) cada ~6 m
  const nP = Math.max(3, Math.round(W / 6) + 1);
  for (let i = 0; i < nP; i++) {
    const x = s.x0 + (W * i) / (nP - 1);
    // frente sur libre para el ingreso en diagonal: columnas solo en los extremos
    const zs = i === 0 || i === nP - 1 ? [s.z0, s.z1] : [s.z0];
    for (const z of zs) {
      root.add(box(0.35, H, 0.35, m.steel, x, H / 2, z));
      root.add(box(0.8, 0.5, 0.8, m.concrete, x, 0.25, z));
    }
    root.add(box(0.3, 0.45, D + 0.6, m.steel, x, H + 0.2, cz));
  }
  // Techo: chapa + bandas de policarbonato translúcido
  const roof = box(W + 1.6, 0.16, D + 1.6, sheetMat(0xb7bec5, (D + 1.6) / 2, (W + 1.6) / 2, aniso, { rot: true, metal: 0.5 }), cx, H + 0.5, cz);
  root.add(roof);
  const poly = new THREE.MeshStandardMaterial({ color: 0xe8f3f6, roughness: 0.2, transparent: true, opacity: 0.55, envMapIntensity: 1.2 });
  for (let i = 0; i < nP - 1; i++) {
    const x = s.x0 + (W * (i + 0.5)) / (nP - 1);
    root.add(box(1.6, 0.05, D + 1.4, poly, x, H + 0.6, cz, false));
  }
  // Cenefa con identificación
  const signMat = new THREE.MeshStandardMaterial({
    map: textTex([{ t: 'DADA · LAVADERO', font: '800 64px system-ui, Arial', color: '#ffffff', y: 66 }], '#0d4da0'), roughness: 0.4,
  });
  for (const [z, ry] of [[s.z1 + 0.85, 0], [s.z0 - 0.85, Math.PI]] as [number, number][]) {
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(16, W * 0.6), 1.3), signMat);
    sg.position.set(cx, H + 0.05, z); sg.rotation.y = ry; root.add(sg);
  }
  // Arcos de lavado con cepillos rotativos verticales (uno por box)
  const brush = new THREE.MeshStandardMaterial({ color: 0x1f6fd1, roughness: 0.85 });
  const brushRed = new THREE.MeshStandardMaterial({ color: 0xd0342c, roughness: 0.85 });
  for (const x of s.arches ?? [s.x0 + W * 0.28, s.x0 + W * 0.72]) {
    root.add(box(0.4, 5.6, 0.4, m.yellow, x, 2.8, cz - 3.6));
    root.add(box(0.4, 5.6, 0.4, m.yellow, x, 2.8, cz + 3.6));
    root.add(box(0.5, 0.5, 7.6, m.yellow, x, 5.6, cz));
    for (const [z, mat] of [[cz - 2.4, brush], [cz + 2.4, brushRed]] as [number, THREE.Material][]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 4.4, 16), mat);
      b.position.set(x + 0.9, 2.6, z); b.castShadow = true; root.add(b);
    }
    // rociadores en el arco
    for (let z = -3; z <= 3; z += 1.2) root.add(box(0.12, 0.12, 0.12, m.dark, x, 5.25, cz + z, false));
  }
  // Equipos: hidrolavadora, tanque de agua tratada, carretel de manguera
  // equipos sobre el lado norte (fuera de las trayectorias de ingreso/salida)
  root.add(box(1.4, 1.2, 0.9, new THREE.MeshStandardMaterial({ color: 0xd8262b, roughness: 0.45, metalness: 0.3 }), s.x0 + W * 0.5, 0.6, s.z0 - 1.2));
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 3.2, 24), m.white);
  tank.position.set(s.x1 + 1.8, 1.6, s.z0 + 0.6); tank.castShadow = true; root.add(tank);
  root.add(box(0.15, 3.4, 0.15, m.steel, s.x1 + 3.15, 1.7, s.z0 + 0.6));
  const reel = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.12, 8, 20), m.yellow);
  reel.position.set(s.x0 - 0.4, 1.4, s.z0 + 0.4); reel.rotation.y = Math.PI / 2; root.add(reel);
  // Luminarias bajo techo
  for (let i = 0; i < nP - 1; i++) {
    const x = s.x0 + (W * (i + 0.5)) / (nP - 1);
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2f7ff }));
    lamp.position.set(x, H - 0.05, cz); lamp.visible = false; root.add(lamp); glows.push(lamp);
  }
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xcfe2ff, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.position.set(cx, 0.07, cz); pool.visible = false; root.add(pool); glows.push(pool);

  root.traverse((o) => { o.matrixAutoUpdate = false; o.updateMatrix(); });
  root.updateMatrixWorld(true);
  return { root, nightGlows: glows };
}

// ── Garita: cabina vidriada sobre zócalo, techo plano con alero, marquesina
// sobre el carril de acceso, cartel, luz de vigilancia.
export function buildGuard(s: GuardSpec, aniso: number): Built {
  const root = new THREE.Group(); root.name = 'guard';
  const g = new THREE.Group();
  const glows: THREE.Object3D[] = [];
  const m = M();
  const BW = 4.2, BD = 3.2, BH = 2.7, BASE = 0.5;
  // zócalo / vereda perimetral
  g.add(box(BW + 1.6, 0.18, BD + 1.6, m.concrete, 0, 0.09, 0));
  g.add(box(BW, BASE, BD, m.white, 0, 0.18 + BASE / 2, 0));
  // esquineros y montantes
  const y0 = 0.18 + BASE;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.14, BH, 0.14, m.dark, sx * (BW / 2 - 0.07), y0 + BH / 2, sz * (BD / 2 - 0.07)));
  // vidrios en las 4 caras (antepecho + paño)
  const gl: [number, number, number, number, number][] = [
    [BW - 0.3, BH - 0.2, 0.06, 0, BD / 2 - 0.04], [BW - 0.3, BH - 0.2, 0.06, 0, -BD / 2 + 0.04],
    [0.06, BH - 0.2, BD - 0.3, BW / 2 - 0.04, 0], [0.06, BH - 0.2, BD - 0.3, -BW / 2 + 0.04, 0],
  ];
  for (const [w, h, d, x, z] of gl) {
    const pane = box(w, h, d, m.glass, x, y0 + BH / 2, z, false); g.add(pane);
    const pn = box(w * 0.98, h * 0.98, d * 0.5, m.glassNight, x, y0 + BH / 2, z, false); pn.visible = false; g.add(pn); glows.push(pn);
  }
  // mostrador interior visible
  g.add(box(BW - 0.6, 0.9, 0.6, m.dark, 0, y0 + 0.45, -BD / 2 + 0.6));
  // techo plano con alero y cenefa
  const roofY = y0 + BH;
  g.add(box(BW + 1.4, 0.28, BD + 1.4, sheetMat(0x9aa3ab, (BD + 1.4) / 2, (BW + 1.4) / 2, aniso, { rot: true, metal: 0.5 }), 0, roofY + 0.14, 0));
  g.add(box(BW + 1.45, 0.42, 0.06, m.white, 0, roofY + 0.05, (BD + 1.4) / 2));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(BW + 0.6, 0.55), new THREE.MeshStandardMaterial({
    map: textTex([{ t: 'CONTROL DE ACCESO', font: '800 54px system-ui, Arial', color: '#ffffff', y: 64 }], '#0d4da0', 768, 128), roughness: 0.4,
  }));
  sign.position.set(0, roofY + 0.62, (BD + 1.4) / 2 - 0.1); g.add(sign);
  g.add(box(BW + 0.7, 0.62, 0.08, m.dark, 0, roofY + 0.62, (BD + 1.4) / 2 - 0.16));
  // equipo de aire en el techo + reflector
  g.add(box(1.0, 0.6, 0.7, m.white, BW / 2 - 0.8, roofY + 0.58, -0.6));
  g.add(box(0.5, 0.3, 0.3, m.dark, -BW / 2 + 0.2, roofY + 0.45, BD / 2 + 0.5));
  const spot = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.22), new THREE.MeshBasicMaterial({ color: 0xfff6dc }));
  spot.position.set(-BW / 2 + 0.2, roofY + 0.45, BD / 2 + 0.66); spot.visible = false; g.add(spot); glows.push(spot);
  // marquesina sobre el carril de acceso (luz libre 5,4 m)
  const MX = s.laneX != null ? s.laneX - s.x : BW / 2 + 5.5;
  const MW = s.laneX != null ? 13.4 : 9.4;
  for (const sx of [-1, 1]) for (const z of [-2.6, 2.6]) g.add(box(0.25, 5.4, 0.25, m.steel, MX + sx * (MW / 2 - 0.3), 2.7, z));
  g.add(box(MW, 0.22, 6.6, sheetMat(0xb7bec5, 6.6 / 2, MW / 2, aniso, { rot: true }), MX, 5.5, 0));
  g.add(box(MW, 0.5, 0.08, m.yellow, MX, 5.25, 3.3));
  g.add(box(MW, 0.5, 0.08, m.yellow, MX, 5.25, -3.3));
  for (const lx of [-3, 3]) {
    const lg = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff4dc }));
    lg.position.set(MX + lx, 5.38, 0); lg.visible = false; g.add(lg); glows.push(lg);
  }
  // puesto de identificación (lector) junto al carril
  g.add(box(0.35, 1.25, 0.35, m.dark, BW / 2 + 1.2, 0.62, 1.6));
  g.add(box(0.3, 0.25, 0.08, new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.8 }), BW / 2 + 1.2, 1.15, 1.79, false));

  g.rotation.y = s.rot;
  g.position.set(s.x, 0, s.z);
  root.add(g);
  root.traverse((o) => { o.matrixAutoUpdate = false; o.updateMatrix(); });
  root.updateMatrixWorld(true);
  return { root, nightGlows: glows };
}
