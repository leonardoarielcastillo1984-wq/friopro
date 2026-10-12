// ============================================================
// CampusWorld — motor 3D isométrico del Centro Empresarial.
// Un solo motor para las dos plantillas ('campus' | 'procesos'):
// el layout es función de la plantilla, los edificios son los
// mismos objetos y se reacomodan con transición suave.
// Reutiliza el loader de assets del Centro de Control de Flota.
// ============================================================
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { instance, placeOnGround } from '../../flota-360/centro-control/_components/world/assets';
import { layoutFor, type BuildingPlacement } from './scenario';
import { SALUD_META, LAYER_META } from './types';
import type { EmpresaDept, EmpresaConn, DeptSalud, TemplateKey } from './types';

const ISO_DIR = new THREE.Vector3(1, 0.8165, 1).normalize();
const CAM_DIST = 400;
const BASE_HALF_H = 105;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 6;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

interface BuildingEntry {
  dept: EmpresaDept;
  root: THREE.Group;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  halo: THREE.Mesh;
  haloMat: THREE.MeshBasicMaterial;
  tag: CSS2DObject;
  tagEl: HTMLDivElement;
  target: THREE.Vector3;
  moving: number; // 0..1 progreso del re-layout
  from: THREE.Vector3;
}

interface ConnEntry {
  conn: EmpresaConn;
  curve: THREE.QuadraticBezierCurve3;
  tube: THREE.Mesh;
  tubeMat: THREE.MeshBasicMaterial;
  pulses: THREE.Sprite[];
  group: THREE.Group;
}

export interface CampusWorldOptions {
  onSelectDept?: (key: string | null) => void;
  onSelectConn?: (conn: EmpresaConn | null) => void;
  onMoveDept?: (key: string, x: number, z: number) => void;
  onHover?: (key: string | null, x: number, y: number) => void;
}

export class CampusWorld {
  private container: HTMLElement;
  private opts: CampusWorldOptions;
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private target = new THREE.Vector3(0, 0, 0);
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private ro: ResizeObserver;
  private time = 0;

  private zoom = 1;
  private angle = 0; // rotación alrededor del campus
  private buildings = new Map<string, BuildingEntry>();
  private conns: ConnEntry[] = [];
  private zonesGroup = new THREE.Group();
  private pathsGroup = new THREE.Group();
  private worldGroup = new THREE.Group();
  private pointer = { down: false, dragging: false, pan: false, x: 0, y: 0 };
  private selectedKey: string | null = null;
  private hoveredKey: string | null = null;
  private editMode = false;
  private dragKey: string | null = null;
  private hoveredConn: ConnEntry | null = null;
  private tween: { t: number; dur: number; from: THREE.Vector3; to: THREE.Vector3; z0: number; z1: number } | null = null;
  private template: TemplateKey = 'campus';
  private depts: EmpresaDept[] = [];
  private connections: EmpresaConn[] = [];
  private salud = new Map<string, DeptSalud>();
  onZoomChange?: (z: number) => void;

  constructor(container: HTMLElement, opts: CampusWorldOptions = {}) {
    this.container = container;
    this.opts = opts;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.style.display = 'block';
    container.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    Object.assign(this.labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    container.appendChild(this.labels.domElement);

    const a = container.clientWidth / Math.max(1, container.clientHeight);
    this.camera = new THREE.OrthographicCamera(-BASE_HALF_H * a, BASE_HALF_H * a, BASE_HALF_H, -BASE_HALF_H, 1, 1500);

    this.scene.background = new THREE.Color(0x0a1628);
    this.scene.fog = new THREE.Fog(0x0a1628, 500, 1100);
    this.scene.add(this.worldGroup, this.pathsGroup, this.zonesGroup);

    this.buildLights();
    this.buildGround();
    this.buildGreenery();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.attachInput();
    this.loop();
  }

  // ═══ Configuración de datos ═══
  setData(depts: EmpresaDept[], connections: EmpresaConn[], salud: Map<string, DeptSalud>) {
    this.depts = depts.filter((d) => d.enabled);
    this.connections = connections;
    this.salud = salud;
  }

  async init(depts: EmpresaDept[], connections: EmpresaConn[], salud: Map<string, DeptSalud>) {
    this.setData(depts, connections, salud);
    await this.buildBuildings();
    this.applyLayout(this.template, false);
    this.rebuildConnections();
  }

  async setTemplate(t: TemplateKey) {
    if (t === this.template) return;
    this.template = t;
    this.applyLayout(t, true);
    this.rebuildConnections();
  }

  setSalud(key: string, s: DeptSalud) {
    this.salud.set(key, s);
    const e = this.buildings.get(key);
    if (!e) return;
    this.applySalud(e);
  }

  selectDept(key: string | null) {
    this.selectedKey = key;
    this.buildings.forEach((e, k) => {
      const on = k === key;
      e.halo.visible = on;
      e.tagEl.classList.toggle('sel', on);
    });
    if (key) {
      const e = this.buildings.get(key);
      if (e) this.tweenTo(e.target, 1.9);
    }
  }

  // Modo edición: arrastrar edificios para reposicionarlos.
  setEditMode(on: boolean) {
    this.editMode = on;
    if (!on) this.dragKey = null;
    this.renderer.domElement.style.cursor = on ? 'move' : 'grab';
  }

  // Vista de impacto (preparado): atenúa todo menos los keys dados.
  focusOnly(keys: Set<string> | null) {
    this.buildings.forEach((e, k) => {
      const on = !keys || keys.has(k);
      e.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mm) => { (mm as THREE.Material).opacity = on ? 1 : 0.25; (mm as THREE.Material).transparent = !on; });
        }
      });
      e.tagEl.style.opacity = on ? '1' : '0.25';
    });
    this.conns.forEach((c) => {
      const on = !keys || (keys.has(c.conn.from) && keys.has(c.conn.to));
      c.group.visible = this.template === 'procesos' && on;
    });
  }

  zoomIn() { this.setZoom(this.zoom * 1.3); }
  zoomOut() { this.setZoom(this.zoom / 1.3); }
  rotateL() { this.angle -= Math.PI / 4; }
  rotateR() { this.angle += Math.PI / 4; }
  fitView() {
    const l = layoutFor(this.template, this.depts);
    this.tweenTo(new THREE.Vector3(l.fitX, 0, l.fitZ), 1);
  }

  private setZoom(z: number) {
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    this.onZoomChange?.(this.zoom);
  }

  private tweenTo(to: THREE.Vector3, zoom: number) {
    this.tween = { t: 0, dur: 0.9, from: this.target.clone(), to: to.clone(), z0: this.zoom, z1: zoom };
  }

  // ═══ Construcción ═══
  private buildLights() {
    const hemi = new THREE.HemisphereLight(0xbdd7ff, 0x1c2b3a, 0.75);
    const sun = new THREE.DirectionalLight(0xfff2d9, 1.6);
    sun.position.set(140, 200, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = 160;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 20, far: 600 });
    sun.shadow.bias = -0.0004;
    this.scene.add(hemi, sun);
    const fill = new THREE.DirectionalLight(0x9db8ff, 0.35);
    fill.position.set(-100, 120, -60);
    this.scene.add(fill);
  }

  private buildGround() {
    // Base oscura tipo losa
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshStandardMaterial({ color: 0x12233c, roughness: 0.95, metalness: 0 })
    );
    g.rotation.x = -Math.PI / 2;
    g.receiveShadow = true;
    g.name = 'ground';
    this.worldGroup.add(g);

    // Plaza central clara
    const plaza = new THREE.Mesh(
      new THREE.PlaneGeometry(130, 46),
      new THREE.MeshStandardMaterial({ color: 0x1d3350, roughness: 0.9 })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.02;
    plaza.receiveShadow = true;
    this.worldGroup.add(plaza);

    // Ejes peatonales (cruz de la plaza)
    const walk = new THREE.MeshBasicMaterial({ color: 0x2a4a73, transparent: true, opacity: 0.9 });
    const h = new THREE.Mesh(new THREE.PlaneGeometry(190, 5), walk);
    h.rotation.x = -Math.PI / 2; h.position.y = 0.04;
    const v = new THREE.Mesh(new THREE.PlaneGeometry(5, 150), walk);
    v.rotation.x = -Math.PI / 2; v.position.y = 0.04;
    this.worldGroup.add(h, v);

    // Fuente/mástil central con bandera (punto de identidad del campus)
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.5, 16, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a9ab0, roughness: 0.4, metalness: 0.7 })
    );
    pole.position.set(0, 8, 0); pole.castShadow = true;
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 3.4),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6, side: THREE.DoubleSide })
    );
    flag.position.set(3.2, 13.8, 0);
    this.worldGroup.add(pole, flag);
  }

  private async buildGreenery() {
    // Vegetación de borde — decorativa, liviana
    const spots: [string, number, number, number][] = [
      ['pine-tree', -105, -40, 1.2], ['pine-tree', -105, 30, 1.1], ['oak-tree', -100, 75, 1],
      ['oak-tree', 105, -60, 1.15], ['pine-tree', 108, 15, 1.05], ['oak-tree', 100, 70, 1.1],
      ['cypress-tree', -40, -80, 1], ['cypress-tree', 45, -80, 1],
      ['bush', -20, 20, 1], ['bush', 24, -16, 1], ['hedge', -70, 0, 1], ['hedge', 70, 0, 1],
    ];
    await Promise.all(spots.map(async ([model, x, z, s]) => {
      try {
        const o = await instance(model);
        o.traverse((m) => { const mm = m as THREE.Mesh; if (mm.isMesh) { mm.castShadow = true; mm.receiveShadow = true; } });
        this.worldGroup.add(placeOnGround(o, x, z, Math.random() * Math.PI * 2, s));
      } catch { /* asset faltante: seguir */ }
    }));
  }

  private async buildBuildings() {
    await Promise.all(this.depts.map(async (dept) => {
      let root = new THREE.Group();
      try {
        const obj = await instance(dept.model);
        obj.traverse((m) => { const mm = m as THREE.Mesh; if (mm.isMesh) { mm.castShadow = true; mm.receiveShadow = true; } });
        root.add(obj);
      } catch {
        // Modelo no disponible → caja corporativa fallback
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(16, 22, 12),
          new THREE.MeshStandardMaterial({ color: 0x33507c, roughness: 0.6 })
        );
        box.position.y = 11; box.castShadow = true;
        root.add(box);
      }
      root.userData.deptKey = dept.key;

      // Anillo de estado en la base
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.85 });
      const ring = new THREE.Mesh(new THREE.RingGeometry(9.5, 12.5, 48), ringMat);
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
      root.add(ring);

      // Halo de selección
      const haloMat = new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
      const halo = new THREE.Mesh(new THREE.CircleGeometry(14, 40), haloMat);
      halo.rotation.x = -Math.PI / 2; halo.position.y = 0.05;
      halo.visible = false;
      root.add(halo);

      // Etiqueta CSS2D
      const tagEl = document.createElement('div');
      tagEl.className = 'ce-tag';
      const tag = new CSS2DObject(tagEl);
      tag.position.set(0, 0, 0);
      root.add(tag);

      const entry: BuildingEntry = {
        dept, root, ring, ringMat, halo, haloMat, tag, tagEl,
        target: new THREE.Vector3(), from: new THREE.Vector3(), moving: 0,
      };
      this.buildings.set(dept.key, entry);
      this.worldGroup.add(root);
      this.applySalud(entry);
      this.renderTag(entry);
    }));
  }

  private applySalud(e: BuildingEntry) {
    const s = this.salud.get(e.dept.key) ?? 'nodata';
    e.ringMat.color.setHex(SALUD_META[s].hex);
    e.tagEl.dataset.salud = s;
  }

  private renderTag(e: BuildingEntry) {
    e.tagEl.innerHTML = `
      <b>${esc(e.dept.name)}</b>
      ${e.dept.sub ? `<i>${esc(e.dept.sub)}</i>` : ''}
      <span class="dot"></span>`;
  }

  // ═══ Layout / plantillas ═══
  private applyLayout(template: TemplateKey, animate: boolean) {
    const layout = layoutFor(template, this.depts);
    const byKey = new Map<string, BuildingPlacement>(layout.placements.map((p) => [p.key, p]));

    this.buildings.forEach((e) => {
      const p = byKey.get(e.dept.key);
      e.root.visible = !!p;
      e.tagEl.style.display = p ? '' : 'none';
      if (!p) return;
      const to = new THREE.Vector3(p.x, 0, p.z);
      if (animate) {
        e.from.copy(e.root.position);
        e.target.copy(to);
        e.moving = 0;
      } else {
        e.root.position.copy(to);
        e.target.copy(to);
        e.from.copy(to);
      }
      e.root.rotation.y = p.rot;
      e.root.scale.setScalar(p.scale);
      e.tag.position.set(0, p.labelY, 0);
    });

    this.buildZones(layout.zones, animate);
    if (animate) this.tweenTo(new THREE.Vector3(layout.fitX, 0, layout.fitZ), 1);
    else { this.target.set(layout.fitX, 0, layout.fitZ); this.zoom = 1; }
  }

  private buildZones(zones: { key: string; x0: number; z0: number; x1: number; z1: number; label: string }[], animate: boolean) {
    this.zonesGroup.clear();
    zones.forEach((z) => {
      const meta = LAYER_META[z.key as keyof typeof LAYER_META];
      const w = z.x1 - z.x0, d = z.z1 - z.z0;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshBasicMaterial({ color: meta?.tint ?? 0x1d3350, transparent: true, opacity: 0.35 })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set((z.x0 + z.x1) / 2, 0.03, (z.z0 + z.z1) / 2);
      // Borde sutil de banda
      const edge = new THREE.Mesh(
        new THREE.PlaneGeometry(w - 1.4, d - 1.4),
        new THREE.MeshBasicMaterial({ color: 0x0a1628, transparent: true, opacity: 0.55 })
      );
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(mesh.position.x, 0.035, mesh.position.z);
      const el = document.createElement('div');
      el.className = 'ce-zone';
      el.textContent = z.label;
      const obj = new CSS2DObject(el);
      obj.position.set((z.x0 + z.x1) / 2, 1, z.z1 - 3);
      this.zonesGroup.add(mesh, edge, obj);
    });
    this.zonesGroup.visible = zones.length > 0;
    if (!animate) this.zonesGroup.visible = zones.length > 0 && this.template === 'procesos';
  }

  // ═══ Conexiones (mapa de procesos) ═══
  private rebuildConnections() {
    this.conns.forEach((c) => this.pathsGroup.remove(c.group));
    this.conns = [];
    if (this.template !== 'procesos') return;

    const pos = (key: string) => {
      const e = this.buildings.get(key);
      return e && e.root.visible ? e.target : null;
    };

    this.connections.forEach((conn) => {
      const a = pos(conn.from), b = pos(conn.to);
      if (!a || !b) return;
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      mid.y = 14 + a.distanceTo(b) * 0.12; // arco según distancia
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(a.x, 8, a.z), mid, new THREE.Vector3(b.x, 8, b.z)
      );
      const tubeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55 });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.5, 6, false), tubeMat);
      tube.userData.conn = conn;

      // Pulsos luminosos que viajan por la conexión
      const pulses: THREE.Sprite[] = [];
      for (let i = 0; i < 2; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this.pulseTex(), color: 0x7dd3fc, transparent: true, opacity: 0.95, depthWrite: false,
        }));
        sp.scale.set(3.4, 3.4, 1);
        sp.userData.t = i * 0.5;
        pulses.push(sp);
      }
      const group = new THREE.Group();
      group.add(tube, ...pulses);
      this.pathsGroup.add(group);
      this.conns.push({ conn, curve, tube, tubeMat, pulses, group });
    });
  }

  private _pulseTex: THREE.Texture | null = null;
  private pulseTex() {
    if (this._pulseTex) return this._pulseTex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.4, 'rgba(255,255,255,.6)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    this._pulseTex = new THREE.CanvasTexture(c);
    return this._pulseTex;
  }

  // ═══ Input ═══
  private attachInput() {
    const el = this.renderer.domElement;
    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', (ev) => {
      // Modo edición: si se agarró un edificio, arrastre de posición.
      if (this.editMode && ev.button === 0) {
        const hit = this.rayAt(ev);
        if (hit.building) {
          this.dragKey = hit.building;
          el.setPointerCapture(ev.pointerId);
          el.style.cursor = 'move';
          return;
        }
      }
      this.pointer.down = true; this.pointer.dragging = false; this.pointer.pan = ev.button === 2 || ev.shiftKey;
      this.pointer.x = ev.clientX; this.pointer.y = ev.clientY;
      el.setPointerCapture(ev.pointerId);
      el.style.cursor = 'grabbing';
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointermove', (ev) => {
      if (this.dragKey) { this.dragMove(ev); return; }
      if (this.pointer.down) {
        const dx = ev.clientX - this.pointer.x, dy = ev.clientY - this.pointer.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) this.pointer.dragging = true;
        if (this.pointer.dragging) {
          if (this.pointer.pan) {
            this.panBy(dx, dy);
          } else {
            this.angle += dx * 0.006;
          }
          this.pointer.x = ev.clientX; this.pointer.y = ev.clientY;
        }
      } else {
        this.hover(ev);
      }
    });
    el.addEventListener('pointerup', (ev) => {
      if (this.dragKey) {
        const k = this.dragKey;
        this.dragKey = null;
        const e = this.buildings.get(k);
        if (e) this.opts.onMoveDept?.(k, e.root.position.x, e.root.position.z);
        if (this.template === 'procesos') this.rebuildConnections();
        el.style.cursor = this.editMode ? 'move' : 'grab';
        return;
      }
      el.style.cursor = 'grab';
      const wasDrag = this.pointer.dragging;
      this.pointer.down = false; this.pointer.dragging = false;
      if (!wasDrag) this.click(ev);
    });
    el.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      this.setZoom(this.zoom * (ev.deltaY < 0 ? 1.12 : 0.9));
    }, { passive: false });
  }

  private dragMove(ev: PointerEvent) {
    const e = this.buildings.get(this.dragKey!);
    if (!e) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    const nd = new THREE.Vector2(
      ((ev.clientX - r.left) / r.width) * 2 - 1,
      -((ev.clientY - r.top) / r.height) * 2 + 1
    );
    this.raycaster.setFromCamera(nd, this.camera);
    const pt = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, pt)) {
      // Snap suave a grilla de 2 unidades
      e.root.position.set(Math.round(pt.x / 2) * 2, 0, Math.round(pt.z / 2) * 2);
      e.target.copy(e.root.position);
      e.from.copy(e.root.position);
    }
  }

  private panBy(dx: number, dy: number) {
    const scale = (BASE_HALF_H * 2) / this.container.clientHeight / this.zoom;
    const dir = ISO_DIR.clone();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize().negate();
    const fwd = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), right).normalize();
    this.target.addScaledVector(right, -dx * scale);
    this.target.addScaledVector(fwd, -dy * scale);
  }

  private rayAt(ev: PointerEvent): { building: string | null; conn: EmpresaConn | null } {
    const r = this.renderer.domElement.getBoundingClientRect();
    const nd = new THREE.Vector2(
      ((ev.clientX - r.left) / r.width) * 2 - 1,
      -((ev.clientY - r.top) / r.height) * 2 + 1
    );
    this.raycaster.setFromCamera(nd, this.camera);
    // Edificios primero
    const roots = [...this.buildings.values()].filter((e) => e.root.visible).map((e) => e.root);
    const hits = this.raycaster.intersectObjects(roots, true);
    if (hits.length) {
      let o: THREE.Object3D | null = hits[0].object;
      while (o && !o.userData.deptKey) o = o.parent;
      if (o?.userData.deptKey) return { building: o.userData.deptKey, conn: null };
    }
    // Conexiones (solo plantilla procesos)
    if (this.template === 'procesos') {
      const ch = this.raycaster.intersectObjects(this.conns.map((c) => c.tube));
      if (ch.length && ch[0].object.userData.conn) return { building: null, conn: ch[0].object.userData.conn };
    }
    return { building: null, conn: null };
  }

  private hover(ev: PointerEvent) {
    const { building, conn } = this.rayAt(ev);
    if (building !== this.hoveredKey) {
      this.hoveredKey = building;
      this.buildings.forEach((e, k) => {
        const on = k === building;
        e.ringMat.opacity = on || k === this.selectedKey ? 1 : 0.85;
        e.root.scale.setScalar(e.root.scale.x); // no-op keep
      });
    }
    this.hoveredConn = this.conns.find((c) => c.conn === conn) ?? null;
    this.conns.forEach((c) => {
      c.tubeMat.opacity = c === this.hoveredConn ? 0.95 : 0.55;
      c.tubeMat.color.setHex(c === this.hoveredConn ? 0xfbbf24 : 0x38bdf8);
    });
    this.renderer.domElement.style.cursor = building || conn ? 'pointer' : 'grab';
    this.opts.onHover?.(building, ev.clientX, ev.clientY);
  }

  private click(ev: PointerEvent) {
    const { building, conn } = this.rayAt(ev);
    if (building) {
      this.opts.onSelectDept?.(building);
      return;
    }
    if (conn) {
      this.opts.onSelectConn?.(conn);
      return;
    }
    this.opts.onSelectDept?.(null);
  }

  // ═══ Render loop ═══
  private resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    const a = w / h;
    const half = BASE_HALF_H;
    this.camera.left = -half * a; this.camera.right = half * a;
    this.camera.top = half; this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;

    // Tween de cámara
    if (this.tween) {
      const tw = this.tween;
      tw.t += dt / tw.dur;
      const k = ease(Math.min(1, tw.t));
      this.target.lerpVectors(tw.from, tw.to, k);
      this.zoom = tw.z0 + (tw.z1 - tw.z0) * k;
      if (tw.t >= 1) this.tween = null;
    }

    // Re-layout animado de edificios
    this.buildings.forEach((e) => {
      if (e.moving < 1) {
        e.moving = Math.min(1, e.moving + dt / 1.1);
        const k = ease(e.moving);
        e.root.position.lerpVectors(e.from, e.target, k);
      }
      // Pulso del anillo según salud
      const s = this.salud.get(e.dept.key) ?? 'nodata';
      if (s === 'crit') {
        e.ringMat.opacity = 0.6 + Math.sin(this.time * 4) * 0.35;
      } else if (s === 'warn') {
        e.ringMat.opacity = 0.75 + Math.sin(this.time * 2) * 0.15;
      }
      // Halo seleccionado respira
      if (e.halo.visible) e.haloMat.opacity = 0.22 + Math.sin(this.time * 3) * 0.08;
    });

    // Pulsos viajando por conexiones
    this.conns.forEach((c) => {
      c.pulses.forEach((p) => {
        p.userData.t = (p.userData.t + dt * 0.22) % 1;
        const pt = c.curve.getPoint(p.userData.t);
        p.position.copy(pt);
      });
    });

    // Cámara isométrica con rotación
    const dir = ISO_DIR.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.angle);
    this.camera.position.copy(this.target).addScaledVector(dir, CAM_DIST);
    this.camera.lookAt(this.target);
    this.camera.zoom = this.zoom;
    this.camera.updateProjectionMatrix();

    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose?.();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mm) => mm.dispose?.());
      }
    });
    this.renderer.dispose();
  }
}
