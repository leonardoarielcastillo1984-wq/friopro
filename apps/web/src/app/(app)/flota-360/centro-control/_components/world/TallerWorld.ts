// ============================================================
// Taller Inteligente 3D — interior de la nave de mantenimiento.
// Escena Three.js propia (mismo estilo isométrico del Centro de
// Control): piso de hormigón pintado, bahías configurables con
// color de estado, vehículos reales en reparación, mecánicos,
// bancos, estanterías de repuestos, iluminación industrial.
// ============================================================
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { instance, placeOnGround } from './assets';
import { Vehicle } from './vehicles';
import { kindFor } from './layout-core';
import { BAY_COLOR, BAY_LABEL, type BayEstado } from '../taller-types';

export interface TallerVeh {
  id: string;
  dominio: string;
  tipo?: string | null;
  estadoOperativo?: string | null;
}

export interface TallerBayState {
  estado: BayEstado;
  unidad?: { id: string; dominio: string } | null;
  otCode?: string | null;
}

export interface TallerWorldOptions {
  onSelectUnit: (id: string) => void;
  onSelectBay: (key: string) => void;
}

interface BayDef {
  key: string;
  x: number; z: number;
  heading: number;
  label: string;
}

interface VehEntry {
  unit: TallerVeh;
  vehicle: Vehicle;
  bay: string | null;
  tag: CSS2DObject;
}

const H = 90;      // largo de la nave (x)
const W = 46;      // profundidad (z)
const WALL_H = 8.5;
const BAY_W = 13.5, BAY_D = 17;

// Bahías configurables del taller (distribución demostrativa;
// la ocupación real viene de los datos, no de esta geometría).
export const TALLER_BAYS: BayDef[] = [
  { key: 'B1', x: -30, z: -12, heading: 0,          label: 'Bahía 1' },
  { key: 'B2', x: -10, z: -12, heading: 0,          label: 'Bahía 2' },
  { key: 'B3', x: 10,  z: -12, heading: 0,          label: 'Bahía 3' },
  { key: 'B4', x: 30,  z: -12, heading: 0,          label: 'Bahía 4' },
  { key: 'B5', x: -30, z: 12,  heading: Math.PI,    label: 'Bahía 5' },
  { key: 'B6', x: -10, z: 12,  heading: Math.PI,    label: 'Bahía 6' },
];

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export class TallerWorld {
  private container: HTMLElement;
  private opts: TallerWorldOptions;
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private ray = new THREE.Raycaster();
  private clock = new THREE.Clock();
  private ro: ResizeObserver;
  private disposed = false;
  private running = false;

  private target = new THREE.Vector2(0, 0);
  private camTarget = new THREE.Vector2(0, 0);
  private yaw = Math.PI * 0.75;
  private yawTarget = Math.PI * 0.75;
  private dist = 60;
  private distTarget = 60;
  private pointer = { down: false, dragging: false, rotate: false, x: 0, y: 0 };

  private entries = new Map<string, VehEntry>();
  private bayMeshes = new Map<string, { pad: THREE.Mesh; label: CSS2DObject; labelEl: HTMLDivElement; strip: THREE.Mesh }>();
  private bayStates = new Map<string, TallerBayState>();
  private mechs: THREE.Object3D[] = [];
  private selectedId: string | null = null;
  private attentionIds: Set<string> | null = null;
  private dimmed = false;
  private pulse = 0;

  constructor(container: HTMLElement, opts: TallerWorldOptions) {
    this.container = container;
    this.opts = opts;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    container.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    Object.assign(this.labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    this.labels.domElement.className = 'cc3-labels';
    container.appendChild(this.labels.domElement);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
    this.scene.background = new THREE.Color(0x0d1117);
    this.scene.fog = new THREE.Fog(0x0d1117, 300, 620);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.bindInput();
  }

  // ───────────────────────── Escena ─────────────────────────
  async init() {
    this.setupLights();
    this.buildShell();
    this.buildBays();
    await this.buildProps();
    if (this.disposed) return;
    this.loop();
  }

  private setupLights() {
    this.scene.add(new THREE.HemisphereLight(0xcfd8e8, 0x2a2118, 0.85));
    // Key light cálida cenital (simula luminarias industriales)
    const key = new THREE.DirectionalLight(0xfff0d8, 1.6);
    key.position.set(30, 60, 40);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 5; sc.far = 220;
    key.shadow.bias = -0.0004;
    this.scene.add(key);
    // Puntos de luz sobre cada fila de bahías (glow de luminarias)
    for (const z of [-12, 12]) {
      for (const x of [-30, -10, 10, 30]) {
        const pl = new THREE.PointLight(0xffe9c4, 14, 26, 1.8);
        pl.position.set(x, 7.2, z);
        this.scene.add(pl);
      }
    }
  }

  private buildShell() {
    const grp = new THREE.Group();

    // Piso de hormigón con textura pintada
    const floorTex = this.paintFloor();
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(H, W),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.92, metalness: 0.02 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    grp.add(floor);

    // Delantal exterior frente al acceso
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(H + 30, 22),
      new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.95 }),
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(0, -0.01, W / 2 + 11);
    apron.receiveShadow = true;
    grp.add(apron);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x5a6472, roughness: 0.9 });
    const wallMatIn = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.85 });

    // Pared fondo (norte)
    const wN = new THREE.Mesh(new THREE.BoxGeometry(H, WALL_H, 0.6), wallMat);
    wN.position.set(0, WALL_H / 2, -W / 2 - 0.3);
    wN.castShadow = wN.receiveShadow = true;
    grp.add(wN);
    // Zócalo de seguridad amarillo
    const zoc = new THREE.Mesh(new THREE.BoxGeometry(H, 1.1, 0.64), new THREE.MeshStandardMaterial({ color: 0xcca700, roughness: 0.8 }));
    zoc.position.set(0, 0.55, -W / 2 - 0.28);
    grp.add(zoc);

    // Laterales este/oeste
    for (const sx of [-1, 1]) {
      const wS = new THREE.Mesh(new THREE.BoxGeometry(0.6, WALL_H, W), wallMat);
      wS.position.set(sx * (H / 2 + 0.3), WALL_H / 2, 0);
      wS.castShadow = wS.receiveShadow = true;
      grp.add(wS);
      const zocS = new THREE.Mesh(new THREE.BoxGeometry(0.64, 1.1, W), new THREE.MeshStandardMaterial({ color: 0xcca700, roughness: 0.8 }));
      zocS.position.set(sx * (H / 2 + 0.28), 0.55, 0);
      grp.add(zocS);
    }

    // Frente sur: abierto (portones). Columnas + dintel + 2 tramos de pared alta
    for (const x of [-H / 2, -22.5, 0, 22.5, H / 2]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.9, WALL_H, 0.9), wallMatIn);
      col.position.set(x, WALL_H / 2, W / 2);
      col.castShadow = true;
      grp.add(col);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(H + 1.2, 1.4, 0.9), wallMat);
    lintel.position.set(0, WALL_H - 0.7, W / 2);
    grp.add(lintel);

    // Caballete / vigas del techo (sin techo: vista abierta isométrica)
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x3d4757, roughness: 0.7, metalness: 0.4 });
    for (let x = -H / 2 + 10; x <= H / 2 - 10; x += 20) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.7, W), beamMat);
      beam.position.set(x, WALL_H + 0.35, 0);
      grp.add(beam);
    }
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(H, 0.5, 0.5), beamMat);
    ridge.position.set(0, WALL_H + 1.6, 0);
    grp.add(ridge);

    // Luminarias colgantes sobre bahías
    const lampGeo = new THREE.BoxGeometry(3.4, 0.18, 1.1);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x222a36, emissive: 0xfff2cc, emissiveIntensity: 1.6 });
    for (const z of [-12, 12]) {
      for (const x of [-30, -10, 10, 30]) {
        const lm = new THREE.Mesh(lampGeo, lampMat);
        lm.position.set(x, 7.4, z);
        grp.add(lm);
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, WALL_H - 6.4), beamMat);
        cable.position.set(x, (WALL_H + 6.4) / 2 + 0.4, z);
        grp.add(cable);
      }
    }
    this.scene.add(grp);
  }

  private paintFloor(): THREE.CanvasTexture {
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 512;
    const g = cv.getContext('2d')!;
    // Hormigón base
    g.fillStyle = '#6a6f78';
    g.fillRect(0, 0, 1024, 512);
    // Manchas/suciedad sutil
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${30 + Math.random() * 30},${30 + Math.random() * 30},${30 + Math.random() * 30},${0.05 + Math.random() * 0.08})`;
      const s = 2 + Math.random() * 12;
      g.fillRect(Math.random() * 1024, Math.random() * 512, s, s);
    }
    const X = (x: number) => ((x + H / 2) / H) * 1024;
    const Z = (z: number) => ((z + W / 2) / W) * 512;

    // Pasillo central de circulación peatonal
    g.strokeStyle = 'rgba(245,197,24,0.55)';
    g.lineWidth = 3;
    g.setLineDash([14, 10]);
    g.beginPath(); g.moveTo(X(-42), Z(0)); g.lineTo(X(42), Z(0)); g.stroke();
    g.setLineDash([]);

    // Rectángulos de bahías
    for (const b of TALLER_BAYS) {
      g.strokeStyle = '#e8e8e8';
      g.lineWidth = 4;
      g.strokeRect(X(b.x - BAY_W / 2), Z(b.z - BAY_D / 2), BAY_W / H * 1024, BAY_D / W * 512);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      g.fillRect(X(b.x - BAY_W / 2), Z(b.z - BAY_D / 2), BAY_W / H * 1024, BAY_D / W * 512);
      // números de bahía
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.font = 'bold 34px system-ui';
      g.textAlign = 'center';
      g.fillText(b.key, X(b.x), Z(b.z + (b.heading === 0 ? -BAY_D / 2 + 2.4 : BAY_D / 2 - 0.6)));
    }
    // Zona repuestos (este) y herramientas (oeste)
    g.strokeStyle = 'rgba(56,189,248,0.5)';
    g.lineWidth = 3;
    g.strokeRect(X(38), Z(-22), (7 / H) * 1024, (44 / W) * 512);
    g.strokeRect(X(-45), Z(-22), (7 / H) * 1024, (44 / W) * 512);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  private buildBays() {
    const stripGeo = new THREE.BoxGeometry(BAY_W, 0.08, 0.9);
    for (const b of TALLER_BAYS) {
      // Pad invisible clickeable que cubre la bahía
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(BAY_W, 0.12, BAY_D),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      pad.position.set(b.x, 0.06, b.z);
      pad.userData.bay = b.key;
      this.scene.add(pad);

      // Franja de estado en el borde frontal de la bahía
      const strip = new THREE.Mesh(stripGeo, new THREE.MeshStandardMaterial({
        color: parseInt(BAY_COLOR.disponible.slice(1), 16), roughness: 0.6,
        emissive: parseInt(BAY_COLOR.disponible.slice(1), 16), emissiveIntensity: 0.25,
      }));
      strip.position.set(b.x, 0.09, b.z + (b.heading === 0 ? BAY_D / 2 - 0.4 : -BAY_D / 2 + 0.4));
      this.scene.add(strip);

      // Etiqueta de bahía (CSS2D)
      const el = document.createElement('div');
      el.className = 'ccw-bay';
      el.innerHTML = `<b>${esc(b.key)}</b><span>${esc(BAY_LABEL.disponible)}</span>`;
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => this.opts.onSelectBay(b.key));
      const obj = new CSS2DObject(el);
      obj.position.set(b.x, 5.4, b.z + (b.heading === 0 ? -BAY_D / 2 - 0.8 : BAY_D / 2 + 0.8));
      this.scene.add(obj);

      this.bayMeshes.set(b.key, { pad, label: obj, labelEl: el, strip });
      this.bayStates.set(b.key, { estado: 'disponible', unidad: null });
    }
  }

  private async buildProps() {
    const put = async (n: string, x: number, z: number, r = 0, s = 1) => {
      const o = placeOnGround(await instance(n), x, z, r, s);
      this.scene.add(o);
    };
    // Zona oeste: bancos y herramientas
    await put('workbench', -41, -16, Math.PI / 2);
    await put('workbench', -41, -10, Math.PI / 2);
    await put('toolbox', -40.5, -6, 0.4);
    await put('toolbox', -41, 8, -0.2);
    await put('air-compressor', -41, 14, Math.PI / 2);
    await put('gas-cylinder', -42, 18);
    await put('gas-cylinder', -41.2, 19);
    // Zona este: repuestos (estanterías) — sector clickeable vía pad
    for (let i = 0; i < 3; i++) await put('pallet-rack', 41, -16 + i * 8, -Math.PI / 2);
    await put('forklift', 38, 14, Math.PI);
    for (let i = 0; i < 4; i++) await put('wooden-pallet', 40 + (i % 2) * 3, 6 + Math.floor(i / 2) * 2.6, i * 0.3);
    await put('cardboard-box-stack', 42, 19, 0.4);
    // Señalización y orden
    await put('traffic-barrel', -20, 1.8); await put('traffic-barrel', 20, 1.8);
    await put('bollard', -22.5, 20); await put('bollard', 22.5, 20);
    // Mesa de diagnóstico central
    await put('workbench', 0, -19.5, 0);
    await put('toolbox', 1.8, -19.8, 0.2);
  }

  // Mecánicos: figura junto a la bahía cuando su OT está asignada
  async setMechanics(spots: { bay: string; name: string }[]) {
    for (const m of this.mechs) m.removeFromParent();
    this.mechs = [];
    const models = ['people/character-male-a', 'people/character-male-c', 'people/character-male-e'];
    for (let i = 0; i < spots.length; i++) {
      const b = TALLER_BAYS.find((x) => x.key === spots[i].bay);
      if (!b) continue;
      const person = placeOnGround(await instance(models[i % models.length]), b.x + 4.6, b.z + (b.heading === 0 ? 3.4 : -3.4), Math.PI * 0.3);
      this.scene.add(person);
      this.mechs.push(person);
      const el = document.createElement('div');
      el.className = 'ccw-mech';
      el.textContent = esc(spots[i].name);
      const tag = new CSS2DObject(el);
      tag.position.set(b.x + 4.6, 2.6, b.z + (b.heading === 0 ? 3.4 : -3.4));
      this.scene.add(tag);
      this.mechs.push(tag as unknown as THREE.Object3D);
    }
  }

  // ───────────────────────── Unidades ─────────────────────────
  async setUnits(units: TallerVeh[]) {
    const seen = new Set<string>();
    const waiting = units.filter((u) => ![...this.bayStates.values()].some((s) => s.unidad?.id === u.id));
    // Asignación: unidades en bahías según estado real (fechaIngresoTaller /
    // EN_REPARACION primero); resto en la fila de espera del frente sur.
    let bayIdx = 0;
    for (const u of units) {
      seen.add(u.id);
      let e = this.entries.get(u.id);
      if (!e) {
        const v = new Vehicle(kindFor(u.tipo));
        await v.init();
        if (this.disposed) { v.dispose(); return; }
        this.scene.add(v.root);
        const tagEl = document.createElement('div');
        tagEl.className = 'ccw-tag';
        tagEl.innerHTML = `<b>${esc(u.dominio)}</b>`;
        tagEl.style.pointerEvents = 'auto';
        tagEl.style.cursor = 'pointer';
        tagEl.addEventListener('click', () => this.opts.onSelectUnit(u.id));
        const tag = new CSS2DObject(tagEl);
        this.scene.add(tag);
        v.root.userData.unitId = u.id;
        e = { unit: u, vehicle: v, bay: null, tag };
        this.entries.set(u.id, e);
      }
      // Bahía libre o espera
      const bay = this.bayFor(u);
      if (bay) {
        e.bay = bay.key;
        e.vehicle.setPose(bay.x, bay.z + (bay.heading === 0 ? 1.2 : -1.2), bay.heading);
        e.tag.position.set(bay.x, 4.4, bay.z + (bay.heading === 0 ? -2 : 2));
      } else {
        // Fila de espera frente al taller (sur)
        const i = waiting.indexOf(u);
        const wx = -38 + (i % 6) * 15.5;
        const wz = W / 2 + 8;
        e.bay = null;
        e.vehicle.setPose(wx, wz, Math.PI);
        e.tag.position.set(wx, 4.4, wz + 2);
      }
      e.vehicle.root.traverse((o) => { o.userData.unitId = u.id; });
    }
    // Remover unidades que ya no están en el taller
    for (const [id, e] of this.entries) {
      if (seen.has(id)) continue;
      e.vehicle.dispose();
      e.tag.removeFromParent();
      this.entries.delete(id);
    }
    this.applyBayVisuals();
  }

  private bayFor(u: TallerVeh): BayDef | null {
    // Bahía ya asignada por estado (setBayStates las marca)
    for (const [k, s] of this.bayStates) {
      if (s.unidad?.id === u.id) return TALLER_BAYS.find((b) => b.key === k) ?? null;
    }
    return null;
  }

  // Estados de bahía derivados de datos reales (o demo). unitId puede ser null.
  setBayStates(states: Map<string, TallerBayState>) {
    this.bayStates = states;
    this.applyBayVisuals();
  }

  private applyBayVisuals() {
    for (const [k, m] of this.bayMeshes) {
      const s = this.bayStates.get(k) ?? { estado: 'disponible' as BayEstado, unidad: null };
      const hex = parseInt(BAY_COLOR[s.estado].slice(1), 16);
      const mat = m.strip.material as THREE.MeshStandardMaterial;
      mat.color.setHex(hex);
      mat.emissive.setHex(hex);
      m.labelEl.innerHTML = `<b>${esc(k)}</b><span>${esc(BAY_LABEL[s.estado])}${s.unidad ? ` · ${esc(s.unidad.dominio)}` : ''}${s.otCode ? ` · ${esc(s.otCode)}` : ''}</span>`;
      m.labelEl.style.borderColor = BAY_COLOR[s.estado];
    }
  }

  setSelected(id: string | null) {
    this.selectedId = id;
    for (const [uid, e] of this.entries) {
      const on = uid === id;
      e.vehicle.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mm of mats) {
          const sm = mm as THREE.MeshStandardMaterial;
          if (!sm.emissive) continue;
          if (!(sm.userData as any)._e0) (sm.userData as any)._e0 = sm.emissive.getHex();
          sm.emissive.setHex(on ? 0x38bdf8 : (sm.userData as any)._e0);
          sm.emissiveIntensity = on ? 0.45 : 0.15;
        }
      });
    }
  }

  // Modo ATENCIÓN REQUERIDA: atenúa todo menos las unidades con alerta
  setAttention(ids: Set<string> | null) {
    this.attentionIds = ids;
    this.dimmed = ids != null;
    for (const [uid, e] of this.entries) {
      const dim = this.dimmed && !ids!.has(uid);
      e.vehicle.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mm of mats) (mm as THREE.MeshStandardMaterial).transparent = dim, (mm as THREE.MeshStandardMaterial).opacity = dim ? 0.25 : 1;
      });
      (e.tag.element as HTMLElement).style.opacity = dim ? '0.25' : '1';
    }
  }

  focusBay(key: string) {
    const b = TALLER_BAYS.find((x) => x.key === key);
    if (b) { this.target.set(b.x, b.z); this.distTarget = 34; }
  }

  resetView() {
    this.target.set(0, 2);
    this.yawTarget = Math.PI * 0.75;
    this.distTarget = 60;
  }

  // ───────────────────────── Cámara / input ─────────────────────────
  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    const a = w / h;
    const s = 34;
    this.camera.left = -s * a; this.camera.right = s * a;
    this.camera.top = s; this.camera.bottom = -s;
    this.camera.updateProjectionMatrix();
  }

  private applyCamera() {
    this.camTarget.lerp(this.target, 0.08);
    this.yaw += (this.yawTarget - this.yaw) * 0.08;
    this.dist += (this.distTarget - this.dist) * 0.1;
    const d = this.dist;
    this.camera.position.set(
      this.camTarget.x + Math.sin(this.yaw) * d,
      d * 0.85,
      this.camTarget.y + Math.cos(this.yaw) * d,
    );
    this.camera.lookAt(this.camTarget.x, 0, this.camTarget.y);
  }

  private bindInput() {
    const el = this.renderer.domElement;
    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', (e) => {
      this.pointer = { down: true, dragging: false, rotate: e.button === 2 || e.shiftKey, x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.pointer.down) return;
      const dx = e.clientX - this.pointer.x;
      const dy = e.clientY - this.pointer.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) this.pointer.dragging = true;
      if (this.pointer.dragging) {
        if (this.pointer.rotate) {
          this.yawTarget = Math.max(Math.PI * 0.45, Math.min(Math.PI * 1.05, this.yawTarget - dx * 0.004));
        } else {
          const k = this.dist / 340;
          const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
          this.target.x -= dx * k * rx - dy * k * rz * 0.6;
          this.target.y -= dx * k * -rz + dy * k * rx * 0.6;
          this.target.x = Math.max(-55, Math.min(55, this.target.x));
          this.target.y = Math.max(-30, Math.min(40, this.target.y));
        }
      }
      this.pointer.x = e.clientX; this.pointer.y = e.clientY;
    });
    el.addEventListener('pointerup', (e) => {
      if (!this.pointer.dragging && e.target === el) this.pick(e.clientX, e.clientY);
      this.pointer.down = false;
    });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.distTarget = Math.max(18, Math.min(110, this.distTarget * (e.deltaY > 0 ? 1.12 : 0.9)));
    }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private pick(cx: number, cy: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    // 1) vehículos
    const vehRoots = [...this.entries.values()].map((e) => e.vehicle.root);
    const hits = this.ray.intersectObjects(vehRoots, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.unitId) o = o.parent;
      if (o?.userData.unitId) { this.opts.onSelectUnit(o.userData.unitId); return; }
    }
    // 2) bahías
    const bayHits = this.ray.intersectObjects([...this.bayMeshes.values()].map((b) => b.pad), false);
    if (bayHits[0]?.object.userData.bay) this.opts.onSelectBay(bayHits[0].object.userData.bay);
  }

  private loop = () => {
    if (this.disposed) return;
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.pulse += dt;
    for (const e of this.entries.values()) e.vehicle.update(dt);
    // Pulso de la franja de estado (alertas visuales)
    const s = 0.35 + Math.sin(this.pulse * 3.2) * 0.3;
    for (const [k, m] of this.bayMeshes) {
      const st = this.bayStates.get(k)?.estado;
      (m.strip.material as THREE.MeshStandardMaterial).emissiveIntensity =
        st === 'bloqueado' || st === 'espera_repuestos' ? 0.3 + s : 0.25;
    }
    this.applyCamera();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    this.ro.disconnect();
    for (const e of this.entries.values()) { e.vehicle.dispose(); e.tag.removeFromParent(); }
    this.entries.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }
}
