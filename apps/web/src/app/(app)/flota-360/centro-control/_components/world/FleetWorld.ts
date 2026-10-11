// ============================================================
// FleetWorld — motor 3D isométrico del Centro de Control (Three.js)
// Independiente de React: recibe unidades (reales o demo) y las
// representa en el predio. Movimientos de unidades = cambios de
// estado reales; animaciones ambientales = decorativas.
// ============================================================
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { CCUnit } from '../types';
import { instance, instanceSkinned, placeOnGround, preload, MODEL_LIST, PEOPLE } from './assets';
import { buildGround, buildFence } from './ground';
import { Vehicle } from './vehicles';
import {
  kindFor, STATUS_COLOR, type Slot, type SlotGroup, type V2, type Scenario,
} from './layout-core';
import { genericScenario } from './layout';

const ISO_DIR = new THREE.Vector3(1, 0.8165, 1).normalize();
const CAM_DIST = 420;
const BASE_HALF_H = 112;
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 7;
const ROUTE_VISIBLE = 6;
const YARD_SPEED = 8;
const HW_SPEED = 15;
const HW_EDGE = 40;

// Decide si un tractor que vuelve acoplado estaciona el conjunto junto (rig)
// o desacopla el semi en su dársena — determinista por unidad (~1/3 acoplados)
const keepsRig = (id: string): boolean => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997;
  return h % 3 === 0;
};

interface Entry {
  unit: CCUnit;
  vehicle: Vehicle | null;
  ready: Promise<void>;
  group: SlotGroup;
  slot: Slot | null;
  shown: boolean;
  glow: THREE.Mesh | null;
  outline: THREE.LineLoop | null;
  tag: CSS2DObject;
  tagEl: HTMLDivElement;
  hw?: { dir: 1 | -1; mode: 'loop' | 'leaving' | 'joining' };
  attachedTo?: string | null;   // trailer viajando dentro de la combi de este tractor
  carrying?: string | null;     // tractor que lleva acoplado este semi (id de unidad)
  headlight?: THREE.Sprite;
  taillight?: THREE.Sprite;
  beacon?: THREE.Sprite;
}

interface Walker {
  obj: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  path: V2[];
  i: number;
  dir: 1 | -1;
  speed: number;
  pause: number;
}

interface Shuttle {
  v: Vehicle;
  a: V2[];
  b: V2[];
  leg: 0 | 1;
  wait: number;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Glow radial (halos de luminarias, faros, balizas)
function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 64, 4, 32, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.55, 'rgba(255,255,255,.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.save(); g.scale(1, 2); g.fillRect(0, 0, 64, 64); g.restore();
  const t = new THREE.CanvasTexture(c);
  return t;
}

export interface WorldOptions {
  onSelect: (id: string) => void;
  onProgress?: (p: number) => void;
  scenario?: Scenario;
}

export class FleetWorld {
  private container: HTMLElement;
  private opts: WorldOptions;
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private target = new THREE.Vector3(0, 0, 10);
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private entries = new Map<string, Entry>();
  private walkers: Walker[] = [];
  private shuttles: Shuttle[] = [];
  private badges = new Map<SlotGroup, { obj: CSS2DObject; el: HTMLDivElement }>();
  private signs: CSS2DObject[] = [];
  private glowTex = glowTexture();
  private radialTex = radialTexture();
  private selectedId: string | null = null;
  private hoveredId: string | null = null;
  private flashId: string | null = null;
  private tween: { t: number; dur: number; from: THREE.Vector3; to: THREE.Vector3; z0: number; z1: number } | null = null;
  private pointer = { down: false, dragging: false, x: 0, y: 0, last: new THREE.Vector3(), lastHover: 0 };
  private gateArm: THREE.Object3D | null = null;
  private gateArmBase = { x: 0, z: 0 };
  private gateAngle = 0;
  private S: Scenario = genericScenario;
  private ro: ResizeObserver;
  private time = 0;
  private ready = false;
  private pendingUnits: { units: CCUnit[]; animate: boolean } | null = null;
  onZoomChange?: (z: number) => void;

  // ── Día / noche ──
  private hemi!: THREE.HemisphereLight;
  private sun!: THREE.DirectionalLight;
  private lightMix = 0;              // 0 = día, 1 = noche (interpolado)
  private lightTarget = 0;
  private lampGlows: THREE.Object3D[] = [];
  // ── Clima ──
  private wxKind: 'clear' | 'cloudy' | 'rain' | 'storm' = 'clear';
  private weatherMix = 0;             // 0 = despejado, 1 = tormenta pesada
  private weatherTarget = 0;
  private rain: THREE.Points | null = null;
  private flashT = 0;                 // relámpago: tiempo restante del destello
  private flashCd = 6;                // cooldown hasta el próximo
  // ── Ambientación decorativa ──
  private ambientOn = true;
  private swayTrees: { o: THREE.Object3D; phase: number; amp: number }[] = [];
  // ── Agrupamientos ──
  private expandedGroup: SlotGroup | null = null;
  private lastUnits: CCUnit[] = [];

  constructor(container: HTMLElement, opts: WorldOptions) {
    this.container = container;
    this.opts = opts;
    if (opts.scenario) this.S = opts.scenario;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    Object.assign(this.labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    this.labels.domElement.className = 'cc3-labels';
    container.appendChild(this.labels.domElement);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
    this.camera.zoom = 1;

    this.scene.background = new THREE.Color(0x0b1220);
    this.scene.fog = new THREE.Fog(0x8fa488, 520, 980);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.bindInput();
  }

  // ───────────────────────── Inicialización ─────────────────────────
  async init() {
    const all = [...MODEL_LIST, ...PEOPLE];
    await preload(all, (d, t) => this.opts.onProgress?.(d / t));
    if (this.disposed) return;

    this.setupLights();
    const S = this.S;
    const ground = buildGround(this.scene, this.renderer.capabilities.getMaxAnisotropy(), {
      bounds: S.bounds, highwayZ: S.highwayZ, highwayW: S.highwayW, paint: S.paint,
    });
    ground.matrixAutoUpdate = false;
    ground.updateMatrix();
    const gates = [
      { x: S.gateX, z: S.gateZ, edge: (S.gateSide === 1 ? 'S' : 'N') as 'S' | 'N', arm: true },
      ...(S.extraGates ?? []),
    ];
    const { gateArm } = buildFence(this.scene, { fence: S.fence, gates });
    this.gateArm = gateArm;
    this.gateArmBase = { x: S.gateX + 6.6, z: S.gateZ + 0.8 * S.gateSide };

    await Promise.all([this.buildFacility(), this.buildProps(), this.buildVegetation(), this.buildAmbient()]);
    if (this.disposed) return;

    this.ready = true;
    const g = this.S.sectors[0];
    this.jumpTo(g.x, g.z, g.zoom);
    this.loop();
    if (this.pendingUnits) {
      const p = this.pendingUnits;
      this.pendingUnits = null;
      this.setUnits(p.units, p.animate);
    }
  }

  private setupLights() {
    this.hemi = new THREE.HemisphereLight(0xe8f1ff, 0x6b5b45, 1.25);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.5);
    this.sun.position.set(-110, 210, 150);
    this.sun.target.position.set(0, 0, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    const sc = this.sun.shadow.camera;
    sc.left = -210; sc.right = 210; sc.top = 190; sc.bottom = -190; sc.near = 10; sc.far = 700;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.35;
    this.scene.add(this.sun, this.sun.target);
  }

  // ───────────────────────── Día / noche ─────────────────────────
  setDayNight(mode: 'day' | 'night') {
    this.lightTarget = mode === 'night' ? 1 : 0;
  }

  setAmbient(on: boolean) { this.ambientOn = on; }

  // ───────────────────────── Clima ─────────────────────────
  // Nublado/lluvia/tormenta: atenúa el sol, grisa la niebla, agrega lluvia y
  // (solo tormenta) relámpagos. Se combina con día/noche.
  setWeather(kind: 'clear' | 'cloudy' | 'rain' | 'storm') {
    this.wxKind = kind;
    this.weatherTarget = kind === 'clear' ? 0 : kind === 'cloudy' ? 0.55 : kind === 'rain' ? 0.78 : 1;
    if ((kind === 'rain' || kind === 'storm') && !this.rain) this.buildRain();
    if (this.rain) this.rain.visible = false; // el loop lo enciende por weatherMix
  }

  private buildRain() {
    const N = 1600;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 300;
      pos[i * 3 + 1] = Math.random() * 90;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 220;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xaec4dd, size: 0.9, transparent: true, opacity: 0.55,
      depthWrite: false, sizeAttenuation: true,
    });
    this.rain = new THREE.Points(geo, mat);
    this.rain.visible = false;
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  private applyLightMix() {
    const m = this.lightMix;
    const wx = this.weatherMix;
    const DAY = { hemi: 1.25, sun: 2.5, exp: 1.05, fog: 0x8fa488, bg: 0x0b1220 };
    const NIGHT = { hemi: 0.38, sun: 0.5, exp: 0.88, fog: 0x18202e, bg: 0x04070e };
    const flash = this.flashT > 0 ? this.flashT / 0.3 : 0;
    this.hemi.intensity = (DAY.hemi + (NIGHT.hemi - DAY.hemi) * m) * (1 - 0.22 * wx) + flash * 1.4;
    this.sun.intensity = (DAY.sun + (NIGHT.sun - DAY.sun) * m) * (1 - 0.68 * wx);
    this.renderer.toneMappingExposure = (DAY.exp + (NIGHT.exp - DAY.exp) * m) * (1 - 0.1 * wx) + flash * 0.08;
    const fogC = new THREE.Color(DAY.fog).lerp(new THREE.Color(NIGHT.fog), m).lerp(new THREE.Color(0x69748a), wx * 0.55);
    (this.scene.fog as THREE.Fog).color.copy(fogC);
    const bgC = new THREE.Color(DAY.bg).lerp(new THREE.Color(NIGHT.bg), m).lerp(new THREE.Color(0x14181f), wx * 0.4);
    if (flash > 0) bgC.lerp(new THREE.Color(0x9fb4d8), flash * 0.5);
    (this.scene.background as THREE.Color).copy(bgC);
    // cielo/luna tenue en la hemisférica y sol frío nocturno
    this.hemi.color.copy(new THREE.Color(0xe8f1ff).lerp(new THREE.Color(0x33415e), m).lerp(new THREE.Color(0x8b98ab), wx * 0.5));
    this.hemi.groundColor.copy(new THREE.Color(0x6b5b45).lerp(new THREE.Color(0x14161f), m));
    this.sun.color.copy(new THREE.Color(0xfff1dc).lerp(new THREE.Color(0x9fc0ff), m).lerp(new THREE.Color(0xb9c6d8), wx * 0.6));
    const night = m > 0.45 || wx > 0.6;   // lluvia pesada también prende farolas
    for (const g of this.lampGlows) g.visible = night;
  }

  private async buildFacility() {
    for (const b of this.S.buildings) {
      let top = b.labelY;
      if (b.model) {
        const obj = await instance(b.model);
        placeOnGround(obj, b.x, b.z, b.rot, b.scale);
        obj.traverse((o) => { o.matrixAutoUpdate = false; o.updateMatrix(); });
        obj.updateMatrixWorld(true);
        this.scene.add(obj);
        top = new THREE.Box3().setFromObject(obj).max.y;
      }
      if (!b.label) continue;

      const el = document.createElement('div');
      el.className = `cc3-sign cc3-sign--${b.key}`;
      el.innerHTML = `<b>${b.label}</b><small>${b.sub}</small>`;
      const sign = new CSS2DObject(el);
      sign.position.set(b.x, top + 3, b.z);
      this.scene.add(sign);
      this.signs.push(sign);
    }
  }

  private async put(name: string, x: number, z: number, rot = 0, scale = 1) {
    const o = await instance(name);
    placeOnGround(o, x, z, rot, scale);
    o.traverse((c) => { c.matrixAutoUpdate = false; c.updateMatrix(); });
    o.updateMatrixWorld(true);
    this.scene.add(o);
    return o;
  }

  private async buildProps() {
    const jobs = this.S.props.map((pr) => this.put(pr.n, pr.x, pr.z, pr.r ?? 0, pr.s ?? 1));
    await Promise.all(jobs);
    this.buildLampGlows(this.S.lamps);
  }

  // Halo cálido + charco de luz en cada farola (visibles solo de noche)
  private buildLampGlows(lamps: V2[]) {
    const headMat = new THREE.SpriteMaterial({
      map: this.radialTex, color: 0xffd9a0, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const poolMat = new THREE.MeshBasicMaterial({
      map: this.radialTex, color: 0xffc26e, transparent: true, opacity: 0.28,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const poolGeo = new THREE.PlaneGeometry(16, 16);
    for (const [x, z] of lamps) {
      const halo = new THREE.Sprite(headMat.clone());
      halo.scale.set(6, 6, 1);
      halo.position.set(x, 5.4, z);
      halo.visible = false;
      const pool = new THREE.Mesh(poolGeo, poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x, 0.12, z);
      pool.visible = false;
      this.scene.add(halo, pool);
      this.lampGlows.push(halo, pool);
    }
  }

  private async buildVegetation() {
    const jobs: Promise<unknown>[] = [];
    const trees = ['oak-tree', 'pine-tree', 'cypress-tree', 'oak-tree'];
    let i = 0;
    for (const v of this.S.vegetation) {
      const n = v.model ?? trees[(i++ * 2654435761 % 97) % trees.length];
      const jx = v.jitter ?? 0;
      const x = v.x + (jx ? ((i * 7919) % 100 / 100 - 0.5) * jx : 0);
      const z = v.z + (jx ? ((i * 104729) % 100 / 100 - 0.5) * jx : 0);
      jobs.push(this.put(n, x, z, v.rot ?? (i * 0.7) % 6.28, v.scale ?? 1).then((o) => {
        // balanceo sutil al viento: solo una fracción para no recalcular matrices de todo
        if (v.sway && this.swayTrees.length < 46) {
          o.matrixAutoUpdate = true;
          this.swayTrees.push({ o, phase: i * 0.61, amp: 0.018 + (i % 20) * 0.001 });
        }
      }));
    }
    await Promise.all(jobs);
  }

  // ── Ambiente decorativo (no representa operaciones registradas) ──
  private async buildAmbient() {
    // Autoelevadores del predio
    for (const f of this.S.shuttles) {
      const v = new Vehicle('rigid', 'forklift');
      await v.init();
      v.setPose(f.start[0], f.start[1], 0);
      this.scene.add(v.root);
      const back = [...f.a].reverse().slice(1).concat([f.start]);
      this.shuttles.push({ v, a: f.a, b: back, leg: 0, wait: Math.random() * 3 });
    }

    // Operarios
    for (const d of this.S.walkers) {
      const { obj, clips } = await instanceSkinned(d.model);
      const box = new THREE.Box3().setFromObject(obj);
      const h = box.max.y - box.min.y || 1;
      obj.scale.setScalar(1.75 / h);
      obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.frustumCulled = false; } });
      obj.position.set(d.path[0][0], 0, d.path[0][1]);
      const mixer = new THREE.AnimationMixer(obj);
      const clip = THREE.AnimationClip.findByName(clips, d.idle ?? 'walk') ?? clips[0];
      if (clip) mixer.clipAction(clip).play();
      mixer.update(Math.random() * 2);
      this.scene.add(obj);
      if (!d.idle) this.walkers.push({ obj, mixer, path: d.path, i: 0, dir: 1, speed: 1.3, pause: 0 });
      else this.walkers.push({ obj, mixer, path: d.path, i: 0, dir: 1, speed: 0, pause: Infinity });
    }
  }

  // ───────────────────────── Datos → escena ─────────────────────────
  setUnits(units: CCUnit[], animate: boolean) {
    this.lastUnits = units;
    if (!this.ready) { this.pendingUnits = { units, animate }; return; }
    const ids = new Set(units.map((u) => u.id));
    for (const [id, e] of this.entries) {
      if (!ids.has(id)) { e.vehicle?.dispose(); e.tag.removeFromParent(); this.entries.delete(id); }
    }

    // Agrupar por destino
    const byGroup = new Map<SlotGroup, CCUnit[]>();
    for (const u of units) {
      let g = this.S.groupFor(u.status, kindFor(u.tipo));
      // Tractor que vuelve acoplado y no desacopla: estaciona el conjunto junto (rig)
      const prev = this.entries.get(u.id);
      if (prev?.carrying && u.status === 'disponible' && kindFor(u.tipo) === 'tractor'
        && this.S.slots.rig?.length && keepsRig(u.id)) g = 'rig';
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(u);
    }

    const overflow = new Map<SlotGroup, number>();
    for (const [group, list] of byGroup) {
      // estables primero: los que ya estaban en el grupo conservan su lugar
      list.sort((a, b) => {
        const ea = this.entries.get(a.id), eb = this.entries.get(b.id);
        const sa = ea?.group === group && ea.shown ? 0 : 1;
        const sb = eb?.group === group && eb.shown ? 0 : 1;
        return sa - sb || a.dominio.localeCompare(b.dominio);
      });
      const expanded = this.expandedGroup === group;
      const pool = group === 'route' ? [] : (expanded ? [...(this.S.slots[group] ?? []), ...this.S.extraSlots(group)] : (this.S.slots[group] ?? []));
      const cap = group === 'route' ? ROUTE_VISIBLE : pool.length;
      const used = new Set<string>();
      for (const u of list) {
        const e = this.entries.get(u.id);
        if (e?.group === group && e.slot && e.shown) used.add(e.slot.key);
      }
      let shownCount = 0;
      for (const u of list) {
        let e = this.entries.get(u.id);
        if (!e) e = this.createEntry(u);
        const prevGroup = e.group, prevShown = e.shown;
        e.unit = u;
        const visible = shownCount < cap;
        if (visible) shownCount++;
        let slot: Slot | null = null;
        if (visible && group !== 'route') {
          if (prevGroup === group && e.slot && prevShown && pool.includes(e.slot)) slot = e.slot;
          else {
            slot = pool.find((s) => !used.has(s.key)) ?? null;
            if (slot) used.add(slot.key);
          }
        }
        const changed = prevGroup !== group || !prevShown;
        e.group = group;
        e.slot = slot;
        e.shown = visible;
        this.applyEntry(e, changed && animate && prevShown && visible, animate);
      }
      overflow.set(group, Math.max(0, list.length - cap));
    }
    this.updateBadges(overflow, byGroup);
  }

  private createEntry(u: CCUnit): Entry {
    const tagEl = document.createElement('div');
    tagEl.className = 'cc3-tag';
    const tag = new CSS2DObject(tagEl);
    tag.visible = false;
    const e: Entry = {
      unit: u, vehicle: null, ready: Promise.resolve(), group: 'park', slot: null, shown: false,
      glow: null, outline: null, tag, tagEl,
    };
    const kind = kindFor(u.tipo);
    const v = new Vehicle(kind);
    e.ready = v.init().then(() => {
      if (this.disposed || !this.entries.has(u.id)) return;
      e.vehicle = v;
      v.root.userData.unitId = u.id;
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: this.glowTex, transparent: true, depthWrite: false, opacity: 0.6, color: STATUS_COLOR[u.status] }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.08;
      glow.renderOrder = 1;
      v.root.add(glow);
      e.glow = glow;
      const ol = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => new THREE.Vector3(x / 2, 0, z / 2))),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }),
      );
      ol.position.y = 0.12;
      ol.visible = false;
      v.root.add(ol);
      e.outline = ol;
      // Faros y baliza: solo de noche / en alerta (visibles por estado en el loop)
      const mkSprite = (color: number, size: number) => {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this.radialTex, color, transparent: true, opacity: 0.9,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        sp.scale.set(size, size * 0.7, 1);
        sp.visible = false;
        return sp;
      };
      const off = v.bodyCenterOffset;
      const L2 = v.length / 2;
      e.headlight = mkSprite(0xfff3c4, 3.2); e.headlight.position.set(0, 1.1, off + L2 + 0.6); v.root.add(e.headlight);
      e.taillight = mkSprite(0xff5a4e, 2.4); e.taillight.position.set(0, 1.1, off - L2 - 0.4); v.root.add(e.taillight);
      e.beacon = mkSprite(0xffb020, 2.8);   e.beacon.position.set(0, 3.4, off); v.root.add(e.beacon);
      v.root.add(tag);
      this.scene.add(v.root);
    });
    this.entries.set(u.id, e);
    return e;
  }

  private applyEntry(e: Entry, animate: boolean, live: boolean) {
    e.ready.then(() => {
      const v = e.vehicle;
      if (!v) return;
      // Semi viajando dentro de una combi: queda oculto mientras lo lleva el tractor
      if (e.attachedTo) { v.stop(); v.root.visible = false; e.tag.visible = false; return; }
      // Un semirremolque no circula solo por la ruta: viaja acoplado a un tractor
      if (v.kind === 'trailer' && e.group === 'route') { v.stop(); v.root.visible = false; e.tag.visible = false; return; }
      v.root.visible = e.shown;
      v.setBobtail(['shop', 'hold', 'tractores', 'inactive'].includes(e.group) || (e.group === 'route' && !e.carrying));
      this.styleEntry(e);
      if (!e.shown) { v.stop(); return; }

      if (e.group === 'route') {
        if (animate) this.driveToHighway(e);
        else if (!e.hw) this.placeOnHighway(e);
        return;
      }
      const s = e.slot!;
      if (s.virtual) { e.hw = undefined; v.stop(); v.setPose(s.x, s.z, s.heading); v.root.userData.slot = s; if (e.carrying && e.group !== 'rig') this.releaseTrailer(e); }
      else if (animate && v.kind !== 'trailer') this.driveToSlot(e, s);
      else if (!live || !v.moving) { e.hw = undefined; v.stop(); v.setPose(s.x, s.z, s.heading); v.root.userData.slot = s; if (e.carrying && e.group !== 'rig') this.releaseTrailer(e); }
    });
  }

  // Reserva un semirremolque estacionado en la fila S-A para acoplar
  private pickTrailer(e: Entry): Entry | null {
    for (const t of this.entries.values()) {
      if (t === e || t.attachedTo || !t.shown) continue;
      const tv = t.vehicle;
      if (!tv || tv.kind !== 'trailer' || !t.slot || t.slot.virtual || !t.slot.key.startsWith('S-A')) continue;
      t.attachedTo = e.unit.id;
      return t;
    }
    return null;
  }

  // Deja el semi acoplado en su dársena y libera la vinculación (sin animación)
  private releaseTrailer(e: Entry) {
    const te = e.carrying ? this.entries.get(e.carrying) : undefined;
    e.carrying = null;
    if (!te || te.attachedTo !== e.unit.id) return;
    te.attachedTo = null;
    const tv = te.vehicle;
    if (tv && te.slot && te.shown) { tv.stop(); tv.setPose(te.slot.x, te.slot.z, te.slot.heading); tv.root.visible = true; }
  }

  private styleEntry(e: Entry) {
    const v = e.vehicle;
    if (!v || !e.glow || !e.outline) return;
    const color = STATUS_COLOR[e.unit.status];
    (e.glow.material as THREE.MeshBasicMaterial).color.setHex(color);
    const bob = ['shop', 'hold', 'tractores', 'inactive'].includes(e.group) || (e.group === 'route' && !e.carrying);
    const L = v.kind === 'tractor' ? (bob ? 8.5 : 19) : v.kind === 'trailer' ? 14.5 : v.length + 1.2;
    const off = v.bodyCenterOffset;
    e.glow.scale.set(v.width + 2.6, L + 3, 1);
    e.glow.position.z = off;
    e.outline.scale.set(v.width + 1.4, 1, L + 1);
    e.outline.position.z = off;
    e.tag.position.set(0, 6, off + (v.kind === 'tractor' ? 2 : 0));
    const crit = e.unit.status === 'fuera_servicio';
    e.tagEl.innerHTML = `<i style="background:#${color.toString(16).padStart(6, '0')}"></i><span class="cc3-tag-txt"><b>${e.unit.dominio}</b><span class="cc3-tag-sub">${e.unit.statusLabel}</span></span>${crit || e.unit.alerts.length ? '<em aria-hidden="true">!</em>' : ''}`;
    e.tagEl.dataset.status = e.unit.status;
  }

  // ── Rutas ──

  // Lleva el vehículo hasta el anillo; devuelve el punto de llegada
  private leaveCurrent(e: Entry): V2 {
    const v = e.vehicle!;
    const prevSlot = (v.root.userData.slot as Slot | undefined) ?? null;
    const atSlot = prevSlot && Math.hypot(v.root.position.x - prevSlot.x, v.root.position.z - prevSlot.z) < 1;
    v.stop();
    if (e.hw) {
      const pts = this.pathFromHighway(e);
      v.drive(pts, { speed: HW_SPEED * 0.8 });
      e.hw = undefined;
      return this.S.routes.gateJoin;
    }
    if (atSlot && prevSlot) {
      v.drive(prevSlot.exit, { speed: prevSlot.exitReverse ? 3 : YARD_SPEED * 0.6, reverse: !!prevSlot.exitReverse });
      return prevSlot.exit[prevSlot.exit.length - 1];
    }
    const p = this.S.nearestRingPoint(v.root.position.x, v.root.position.z);
    v.drive([p], { speed: YARD_SPEED * 0.6 });
    return p;
  }

  private driveToSlot(e: Entry, s: Slot) {
    const v = e.vehicle!;
    let from = this.leaveCurrent(e);
    // Desacople: si vuelve acoplado y no es rig, deja el semi en su dársena
    const te = e.carrying ? this.entries.get(e.carrying) : undefined;
    if (te && te.attachedTo === e.unit.id && e.group !== 'rig') {
      const ds = te.slot && !te.slot.virtual && te.slot.key.startsWith('S-A') ? te.slot : null;
      if (ds) {
        const stop: V2 = ds.attach;
        v.drive([...this.S.ringPath(from, stop), stop], { speed: YARD_SPEED });
        v.drive([[ds.x, ds.z + 4]], {
          speed: 3.2, reverse: true,
          onDone: () => {
            te.attachedTo = null; e.carrying = null;
            const tv = te.vehicle;
            if (tv) { tv.stop(); tv.setPose(ds.x, ds.z, ds.heading); tv.root.visible = te.shown; }
            v.setBobtail(true);
          },
        });
        v.drive([stop], { speed: 4 });
        from = stop;
      } else {
        this.releaseTrailer(e);
      }
    }
    const ring = this.S.ringPath(from, s.attach);
    v.drive([...ring, s.attach], { speed: YARD_SPEED });
    v.drive(s.approach, {
      speed: YARD_SPEED * 0.55,
      onDone: () => { v.root.userData.slot = s; v.setPose(s.x, s.z, s.heading); },
    });
    v.root.userData.slot = undefined;
  }

  private driveToHighway(e: Entry) {
    const v = e.vehicle!;
    let from = this.leaveCurrent(e);
    // Acople: el tractor pasa a buscar un semi de la fila antes de salir a la ruta
    if (v.kind === 'tractor' && !e.carrying) {
      const te = this.pickTrailer(e);
      if (te && te.slot) {
        e.carrying = te.unit.id;
        const ds = te.slot;
        const stop: V2 = ds.attach;
        v.drive([...this.S.ringPath(from, stop), stop], { speed: YARD_SPEED });
        v.drive([[ds.x, ds.z + 4]], {
          speed: 3.2, reverse: true,
          onDone: () => {
            const tv = te.vehicle;
            if (tv) { tv.stop(); tv.root.visible = false; }
            te.tag.visible = false;
            v.setBobtail(false);
          },
        });
        v.drive([stop], { speed: 4 });
        from = stop;
      }
    }
    const gate = this.S.routes.gateJoin;
    v.drive([...this.S.ringPath(from, gate), gate], { speed: YARD_SPEED });
    v.drive(this.S.routes.outToHighway(), { speed: YARD_SPEED * 0.8 });
    e.hw = { dir: 1, mode: 'joining' };
    v.drive([[this.S.bounds.x1 + HW_EDGE, this.S.hwLaneE]], { speed: HW_SPEED, onDone: () => this.highwayWrap(e) });
    v.root.userData.slot = undefined;
  }

  private placeOnHighway(e: Entry) {
    const v = e.vehicle!;
    // Colocación directa (sin animación): acoplar un semi disponible si es tractor
    if (v.kind === 'tractor' && !e.carrying) {
      const te = this.pickTrailer(e);
      if (te) {
        e.carrying = te.unit.id;
        if (te.vehicle) te.vehicle.root.visible = false;
        te.tag.visible = false;
        v.setBobtail(false);
      }
    }
    const dir: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
    const x = this.S.bounds.x0 + Math.random() * (this.S.bounds.x1 - this.S.bounds.x0);
    const lane = dir === 1 ? this.S.hwLaneE : this.S.hwLaneW;
    v.stop();
    v.setPose(x, lane, dir === 1 ? Math.PI / 2 : -Math.PI / 2);
    e.hw = { dir, mode: 'loop' };
    v.drive([[dir === 1 ? this.S.bounds.x1 + HW_EDGE : this.S.bounds.x0 - HW_EDGE, lane]], { speed: HW_SPEED, onDone: () => this.highwayWrap(e) });
    v.root.userData.slot = undefined;
  }

  // Al salir del mapa vuelve a entrar por el carril opuesto (tránsito continuo)
  private highwayWrap(e: Entry) {
    const v = e.vehicle;
    if (!v || e.group !== 'route' || !e.shown) return;
    const dir: 1 | -1 = e.hw?.dir === 1 ? -1 : 1;
    const lane = dir === 1 ? this.S.hwLaneE : this.S.hwLaneW;
    const x0 = dir === 1 ? this.S.bounds.x0 - HW_EDGE : this.S.bounds.x1 + HW_EDGE;
    const x1 = dir === 1 ? this.S.bounds.x1 + HW_EDGE : this.S.bounds.x0 - HW_EDGE;
    v.setPose(x0, lane, dir === 1 ? Math.PI / 2 : -Math.PI / 2);
    e.hw = { dir, mode: 'loop' };
    v.drive([[x1, lane]], { speed: HW_SPEED, onDone: () => this.highwayWrap(e) });
  }

  // Desde la ruta hacia el portón
  private pathFromHighway(e: Entry): V2[] {
    const v = e.vehicle!;
    const x = v.root.position.x;
    const dir = e.hw?.dir ?? 1;
    const r = this.S.routes.inFromHighway(x, dir);
    if (r.relaunch) {
      v.setPose(r.relaunch.x, r.relaunch.lane, r.relaunch.rot);
      e.hw = { dir: r.relaunch.dir, mode: 'leaving' };
    }
    return r.pts;
  }

  private updateBadges(overflow: Map<SlotGroup, number>, byGroup: Map<SlotGroup, CCUnit[]>) {
    for (const g of Object.keys(this.S.groupAnchor) as SlotGroup[]) {
      const n = overflow.get(g) ?? 0;
      let b = this.badges.get(g);
      if (n <= 0) { if (b) b.obj.visible = false; continue; }
      if (!b) {
        const el = document.createElement('div');
        el.className = 'cc3-cluster';
        const obj = new CSS2DObject(el);
        const [x, z] = this.S.groupAnchor[g];
        obj.position.set(x, 4, z);
        this.scene.add(obj);
        el.style.pointerEvents = 'auto';
        el.style.cursor = 'pointer';
        el.title = 'Ver unidades agrupadas';
        el.addEventListener('click', () => this.expandGroup(g));
        b = { obj, el };
        this.badges.set(g, b);
      }
      b.obj.visible = true;
      const total = byGroup.get(g)?.length ?? 0;
      b.el.innerHTML = `<b>+${n}</b><span>${this.S.groupLabel[g] ?? g} · ${total} en total</span>`;
    }
  }

  // Despliega las unidades ocultas de un agrupamiento en slots de desborde
  expandGroup(g: SlotGroup) {
    if (this.expandedGroup === g) return;
    this.expandedGroup = g;
    this.setUnits(this.lastUnits, false);
    const [x, z] = this.S.groupAnchor[g];
    this.focus(x, z, 3);
  }

  collapseGroups() {
    if (!this.expandedGroup) return;
    this.expandedGroup = null;
    this.setUnits(this.lastUnits, false);
  }

  // ───────────────────────── Selección ─────────────────────────
  setSelected(id: string | null, focus = true) {
    this.selectedId = id;
    if (!id || !focus) return;
    const e = this.entries.get(id);
    if (!e) return;
    if (e.shown && e.vehicle) {
      const p = e.vehicle.root.position;
      this.focus(p.x, p.z, Math.max(this.camera.zoom, 3.2));
    } else {
      const [x, z] = this.S.groupAnchor[e.group];
      this.focus(x, z, Math.max(this.camera.zoom, 2.4));
    }
  }

  setFlash(id: string | null) {
    this.flashId = id;
  }

  // ───────────────────────── Cámara ─────────────────────────
  focus(x: number, z: number, zoom: number) {
    this.tween = { t: 0, dur: 0.9, from: this.target.clone(), to: new THREE.Vector3(x, 0, z), z0: this.camera.zoom, z1: THREE.MathUtils.clamp(zoom, ZOOM_MIN, ZOOM_MAX) };
  }

  jumpTo(x: number, z: number, zoom: number) {
    this.tween = null;
    this.target.set(x, 0, z);
    this.camera.zoom = THREE.MathUtils.clamp(zoom, ZOOM_MIN, ZOOM_MAX);
    this.updateCamera();
    this.onZoomChange?.(this.camera.zoom);
  }

  focusSector(key: string) {
    this.collapseGroups();
    const s = this.S.sectors.find((x) => x.key === key);
    if (s) this.focus(s.x, s.z, s.zoom);
  }

  zoomBy(f: number) {
    this.focus(this.target.x, this.target.z, this.camera.zoom * f);
  }

  get zoom() { return this.camera.zoom; }

  private updateCamera() {
    this.camera.position.copy(this.target).addScaledVector(ISO_DIR, CAM_DIST);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
  }

  private resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    const aspect = w / h;
    // en pantallas angostas ampliar el encuadre para que entre el predio
    const halfH = aspect < 1.5 ? BASE_HALF_H * (1.5 / aspect) * 0.92 : BASE_HALF_H;
    this.camera.left = -halfH * aspect; this.camera.right = halfH * aspect;
    this.camera.top = halfH; this.camera.bottom = -halfH;
    this.updateCamera();
  }

  private groundAt(cx: number, cy: number): THREE.Vector3 | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, p) ? p : null;
  }

  private pick(cx: number, cy: number): string | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const roots: THREE.Object3D[] = [];
    for (const e of this.entries.values()) if (e.vehicle && e.shown) roots.push(e.vehicle.root);
    const hits = this.raycaster.intersectObjects(roots, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.unitId) o = o.parent;
      if (o && (h.object as THREE.Mesh).isMesh && h.object.visible) return o.userData.unitId as string;
    }
    return null;
  }

  private clampTarget() {
    this.target.x = THREE.MathUtils.clamp(this.target.x, this.S.fence.x0 - 20, this.S.fence.x1 + 20);
    this.target.z = THREE.MathUtils.clamp(this.target.z, this.S.fence.z0 - 10, this.S.bounds.z1 - 15);
  }

  private bindInput() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('pointerleave', this.onLeave);
  }

  private onDown = (ev: PointerEvent) => {
    this.pointer.down = true;
    this.pointer.dragging = false;
    this.pointer.x = ev.clientX; this.pointer.y = ev.clientY;
    const g = this.groundAt(ev.clientX, ev.clientY);
    if (g) this.pointer.last.copy(g);
    this.tween = null;
  };

  private onMove = (ev: PointerEvent) => {
    if (this.pointer.down) {
      if (!this.pointer.dragging && Math.hypot(ev.clientX - this.pointer.x, ev.clientY - this.pointer.y) > 4) {
        this.pointer.dragging = true;
        this.renderer.domElement.style.cursor = 'grabbing';
      }
      if (this.pointer.dragging) {
        const g = this.groundAt(ev.clientX, ev.clientY);
        if (g) {
          this.target.sub(g.sub(this.pointer.last));
          this.clampTarget();
          this.updateCamera();
          const g2 = this.groundAt(ev.clientX, ev.clientY);
          if (g2) this.pointer.last.copy(g2);
        }
      }
      return;
    }
    if (ev.target !== this.renderer.domElement) return;
    const now = performance.now();
    if (now - this.pointer.lastHover < 70) return;
    this.pointer.lastHover = now;
    const id = this.pick(ev.clientX, ev.clientY);
    this.hoveredId = id;
    this.renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
  };

  private onUp = (ev: PointerEvent) => {
    if (!this.pointer.down) return;
    this.pointer.down = false;
    this.renderer.domElement.style.cursor = 'grab';
    if (!this.pointer.dragging && ev.target === this.renderer.domElement) {
      const id = this.pick(ev.clientX, ev.clientY);
      if (id) this.opts.onSelect(id);
    }
    this.pointer.dragging = false;
  };

  private onLeave = () => { this.hoveredId = null; };

  private onWheel = (ev: WheelEvent) => {
    ev.preventDefault();
    this.tween = null;
    const before = this.groundAt(ev.clientX, ev.clientY);
    const f = Math.exp(-ev.deltaY * 0.0015);
    this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom * f, ZOOM_MIN, ZOOM_MAX);
    this.updateCamera();
    const after = this.groundAt(ev.clientX, ev.clientY);
    if (before && after) { this.target.add(before.sub(after)); this.clampTarget(); this.updateCamera(); }
    this.onZoomChange?.(this.camera.zoom);
  };

  // ───────────────────────── Bucle ─────────────────────────
  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden) { this.clock.getDelta(); return; }
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;

    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const k = ease(tw.t);
      this.target.lerpVectors(tw.from, tw.to, k);
      this.camera.zoom = tw.z0 + (tw.z1 - tw.z0) * k;
      this.updateCamera();
      this.onZoomChange?.(this.camera.zoom);
      if (tw.t >= 1) this.tween = null;
    }

    // Transición día↔noche y clima (applyLightMix combina ambos)
    let lightDirty = false;
    if (this.lightMix !== this.lightTarget) {
      this.lightMix += (this.lightTarget - this.lightMix) * Math.min(1, dt * 1.6);
      if (Math.abs(this.lightMix - this.lightTarget) < 0.005) this.lightMix = this.lightTarget;
      lightDirty = true;
    }
    if (this.weatherMix !== this.weatherTarget) {
      this.weatherMix += (this.weatherTarget - this.weatherMix) * Math.min(1, dt * 1.2);
      if (Math.abs(this.weatherMix - this.weatherTarget) < 0.005) this.weatherMix = this.weatherTarget;
      lightDirty = true;
    }
    // Relámpagos (solo tormenta)
    if (this.wxKind === 'storm' && this.weatherMix > 0.5) {
      this.flashCd -= dt;
      if (this.flashCd <= 0) { this.flashT = 0.3; this.flashCd = 3.5 + Math.random() * 6; lightDirty = true; }
    }
    if (this.flashT > 0) { this.flashT -= dt; lightDirty = true; }
    if (lightDirty) this.applyLightMix();
    const night = this.lightMix > 0.45 || this.weatherMix > 0.6;

    // Lluvia: caída con deriva de viento, sigue el objetivo de la cámara
    if (this.rain && this.weatherMix > 0.35) {
      this.rain.visible = true;
      (this.rain.material as THREE.PointsMaterial).opacity = 0.2 + this.weatherMix * 0.45;
      const pos = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const fall = 65 * dt * (0.7 + this.weatherMix * 0.5);
      const wind = (this.wxKind === 'storm' ? 14 : 7) * dt;
      for (let i = 0; i < pos.count; i++) {
        arr[i * 3 + 1] -= fall * (0.7 + (i % 5) * 0.12);
        arr[i * 3] += wind * (1 + (i % 3) * 0.3);
        if (arr[i * 3 + 1] < 0) {
          arr[i * 3] = (Math.random() - 0.5) * 300;
          arr[i * 3 + 1] = 70 + Math.random() * 20;
          arr[i * 3 + 2] = (Math.random() - 0.5) * 220;
        }
      }
      pos.needsUpdate = true;
      this.rain.position.set(this.target.x, 0, this.target.z);
    } else if (this.rain) this.rain.visible = false;

    // ── Espaciado anti-colisión entre vehículos en marcha ──
    const movers: { e: Entry; p: THREE.Vector3; fx: number; fz: number }[] = [];
    for (const e of this.entries.values()) {
      const v = e.vehicle;
      if (!v || !e.shown) continue;
      const h = v.root.rotation.y, dir = v.dirSign;
      movers.push({ e, p: v.root.position, fx: Math.sin(h) * dir, fz: Math.cos(h) * dir });
    }
    for (const m of movers) {
      const v = m.e.vehicle!;
      if (!v.moving) { v.spacingTarget = 1; continue; }
      let minGap = Infinity;
      for (const o of movers) {
        if (o === m || !o.e.vehicle) continue;
        const dx = o.p.x - m.p.x, dz = o.p.z - m.p.z;
        const ahead = dx * m.fx + dz * m.fz;           // proyección hacia adelante
        const side = Math.abs(dx * -m.fz + dz * m.fx); // desvío lateral
        if (ahead > 0 && ahead < 14 && side < 4.2) minGap = Math.min(minGap, ahead);
      }
      v.spacingTarget = minGap < 7 ? 0 : minGap < 14 ? (minGap - 7) / 7 : 1;
    }

    let gateBusy = false;
    const showAllTags = this.camera.zoom >= 2.3;
    for (const e of this.entries.values()) {
      const v = e.vehicle;
      if (!v || !e.shown) continue;
      v.update(dt);
      const p = v.root.position;
      if (Math.abs(p.x - this.S.gateX) < 10 && Math.abs(p.z - this.S.gateZ) < 14) gateBusy = true;
      const sel = e.unit.id === this.selectedId;
      const hov = e.unit.id === this.hoveredId;
      const fl = e.unit.id === this.flashId;
      const crit = e.unit.status === 'fuera_servicio';
      if (e.glow) {
        const m = e.glow.material as THREE.MeshBasicMaterial;
        const pulse = crit || fl ? 0.16 + 0.14 * Math.sin(this.time * 4) : 0;
        m.opacity = sel ? 0.9 : hov ? 0.75 : 0.38 + pulse;
      }
      if (e.outline) {
        e.outline.visible = sel || hov;
        (e.outline.material as THREE.LineBasicMaterial).opacity = sel ? 0.7 + 0.3 * Math.sin(this.time * 4) : 0.6;
      }
      e.tag.visible = sel || hov || fl || showAllTags || (crit && this.camera.zoom >= 1.4);
      e.tagEl.classList.toggle('is-sel', sel);
      e.tagEl.classList.toggle('is-zoomed', this.camera.zoom >= 3.4);
      // Luces: faros solo de noche en movimiento; baliza parpadea si hay alerta
      if (e.headlight) e.headlight.visible = night && v.moving;
      if (e.taillight) e.taillight.visible = night && v.moving;
      if (e.beacon) {
        const alert = crit || e.unit.alerts.length > 0 || e.group === 'hold';
        e.beacon.visible = alert && (night || crit) && this.ambientOn;
        if (e.beacon.visible) (e.beacon.material as THREE.SpriteMaterial).opacity = 0.35 + 0.55 * Math.abs(Math.sin(this.time * 5 + p.x));
      }
    }

    // Ambientación decorativa (pausada si el usuario la desactiva)
    if (this.ambientOn) {
      const t = this.time;
      for (const s of this.swayTrees) {
        s.o.rotation.z = Math.sin(t * 1.4 + s.phase) * s.amp;
      }
    }
    if (this.gateArm) {
      const targetRot = gateBusy ? Math.PI / 2.3 : 0;
      this.gateAngle += (targetRot - this.gateAngle) * Math.min(1, dt * 4);
      this.gateArm.rotation.z = -this.gateAngle;
      this.gateArm.position.x = this.gateArmBase.x - Math.cos(this.gateAngle) * 3.2;
      this.gateArm.position.y = 1.05 + Math.sin(this.gateAngle) * 3.2;
    }

    if (this.ambientOn) for (const s of this.shuttles) {
      s.v.update(dt);
      if (!s.v.moving) {
        s.wait -= dt;
        if (s.wait <= 0) {
          if (s.leg === 0) s.v.drive(s.a, { speed: 2.6 });
          else s.v.drive(s.b, { speed: 2.2, reverse: true });
          s.leg = s.leg === 0 ? 1 : 0;
          s.wait = 2.5 + Math.random() * 3;
        }
      }
    }
    for (const w of this.walkers) {
      w.mixer.update(dt);
      if (w.speed === 0 || w.path.length < 2) continue;
      const next = w.path[w.i + w.dir] ?? null;
      if (!next) { w.dir = w.dir === 1 ? -1 : 1; continue; }
      const dx = next[0] - w.obj.position.x, dz = next[1] - w.obj.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.2) { w.i += w.dir; continue; }
      const step = Math.min(d, w.speed * dt);
      w.obj.position.x += (dx / d) * step;
      w.obj.position.z += (dz / d) * step;
      w.obj.rotation.y = Math.atan2(dx, dz);
    }

    const sZoom = this.camera.zoom;
    for (const s of this.signs) (s.element as HTMLElement).classList.toggle('is-compact', sZoom < 1.15);

    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  };

  // Para capturas/verificación
  renderOnce() {
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('wheel', this.onWheel);
    el.removeEventListener('pointerleave', this.onLeave);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry && m.parent?.name === 'fence') m.geometry.dispose();
    });
    this.renderer.dispose();
    el.remove();
    this.labels.domElement.remove();
  }
}
