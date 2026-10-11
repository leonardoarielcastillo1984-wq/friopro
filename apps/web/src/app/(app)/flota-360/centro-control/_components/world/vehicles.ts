// ============================================================
// Vehículo 3D: modelo según tipo real, articulación de semirremolque,
// ruedas que giran con la distancia y recorrido por curvas suaves.
// ============================================================
import * as THREE from 'three';
import { instance } from './assets';
import type { VehicleKind, V2 } from './layout';

const MODEL_FOR: Record<VehicleKind, string> = {
  tractor: 'semi-truck',
  trailer: 'semi-truck',
  rigid: 'delivery-truck',
  pickup: 'pickup-truck',
  tow: 'tow-truck',
};

const TRAILER_KINGPIN_Z = 2.30;   // en coordenadas del modelo semi-truck
const TRAILER_LENGTH = 9.6;       // perno rey → eje del semirremolque

interface Wheel { node: THREE.Object3D; radius: number }

interface Motion {
  curve: THREE.CatmullRomCurve3;
  length: number;
  u: number;           // distancia recorrida (m)
  speed: number;       // m/s
  reverse: boolean;
  onDone?: () => void;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class Vehicle {
  readonly root = new THREE.Group();
  readonly kind: VehicleKind;
  private model!: THREE.Object3D;
  private trailer: THREE.Object3D | null = null;
  private wheels: Wheel[] = [];
  private trailerWheels: Wheel[] = [];
  private kingpinLocalZ = 0;
  private trailerAxle = new THREE.Vector2();
  private queue: Motion[] = [];
  private bobtail = false;
  length = 6;
  width = 2.6;
  moving = false;

  private modelName: string;

  constructor(kind: VehicleKind, modelOverride?: string) {
    this.kind = kind;
    this.modelName = modelOverride ?? MODEL_FOR[kind];
  }

  async init() {
    const obj = await instance(this.modelName);
    this.model = obj;
    const wheelNodes: THREE.Object3D[] = [];
    obj.traverse((o) => {
      const n = o.name || '';
      if (/trailer$/.test(n)) this.trailer = o;
      if (/_wheel_/.test(n)) wheelNodes.push(o);
    });

    const isTrailerWheel = (w: THREE.Object3D) => {
      let p: THREE.Object3D | null = w.parent;
      while (p) { if (p === this.trailer) return true; p = p.parent; }
      return false;
    };
    const radiusOf = (w: THREE.Object3D) => {
      const b = new THREE.Box3().setFromObject(w);
      return Math.max(0.25, (b.max.y - b.min.y) / 2);
    };
    obj.updateMatrixWorld(true);
    const cabWheels = wheelNodes.filter((w) => !isTrailerWheel(w));
    this.wheels = cabWheels.map((node) => ({ node, radius: radiusOf(node) }));
    this.trailerWheels = wheelNodes.filter(isTrailerWheel).map((node) => ({ node, radius: radiusOf(node) }));

    // Pivote del vehículo = centro del eje trasero de la cabina
    const zs = cabWheels.map((w) => w.position.z);
    const mid = (Math.min(...zs) + Math.max(...zs)) / 2;
    const rear = zs.filter((z) => z < mid);
    const rearAxle = rear.length ? rear.reduce((a, b) => a + b, 0) / rear.length : 0;

    if (this.kind === 'trailer') {
      // Solo semirremolque: ocultar tractor, pivote en el perno rey
      this.trailer?.parent?.children.forEach((c) => { if (c !== this.trailer) c.visible = false; });
      obj.position.z = -TRAILER_KINGPIN_Z;
      this.length = 13.5;
      this.kingpinLocalZ = 0;
    } else {
      obj.position.z = -rearAxle;
      this.kingpinLocalZ = TRAILER_KINGPIN_Z - rearAxle;
      const b = new THREE.Box3().setFromObject(obj);
      this.length = b.max.z - b.min.z;
      this.width = b.max.x - b.min.x;
    }
    this.root.add(obj);
    this.root.userData.vehicle = this;
    if (this.trailer) this.buildLona();
    this.resetTrailer();
  }

  // Lona azul con logo "DADA" en blanco sobre la caja del semirremolque.
  // Se mide el bbox del cuerpo del trailer en espacio local del nodo trailer,
  // así el overlay articula junto con él.
  private buildLona() {
    const t = this.trailer!;
    const bodyMesh = t.children.find((c) => !/_wheel_/.test(c.name)) as THREE.Mesh | undefined;
    if (!bodyMesh) return;
    t.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(bodyMesh).applyMatrix4(t.matrixWorld.clone().invert());

    const LONA_BLUE = '#0d4da0';
    const mkTex = (withLogo: boolean, flip = false) => {
      const cv = document.createElement('canvas');
      cv.width = 1024; cv.height = 512;
      const g = cv.getContext('2d')!;
      g.fillStyle = LONA_BLUE; g.fillRect(0, 0, 1024, 512);
      // pliegues verticales de lona
      for (let x = 0; x < 1024; x += 42) {
        g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x, 0, 8, 512);
        g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(x + 34, 0, 8, 512);
      }
      // franjas superior/inferior
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 0, 1024, 14); g.fillRect(0, 498, 1024, 14);
      if (withLogo) {
        g.fillStyle = '#ffffff';
        g.font = '900 190px system-ui, Arial, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('DADA', 512, 268);
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      if (flip) { tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = -1; }
      return tex;
    };
    const side = () => new THREE.MeshStandardMaterial({ map: mkTex(true), roughness: 0.85, metalness: 0 });
    const sideFlip = () => new THREE.MeshStandardMaterial({ map: mkTex(true, true), roughness: 0.85, metalness: 0 });
    const plain = () => new THREE.MeshStandardMaterial({ map: mkTex(false), roughness: 0.85, metalness: 0 });

    const w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z;
    // Solo la caja: dejar el ~28% inferior libre (bastidor, patas, ruedas)
    const y0 = bb.min.y + (bb.max.y - bb.min.y) * 0.28;
    const y1 = bb.max.y;
    const geo = new THREE.BoxGeometry(w + 0.06, y1 - y0 + 0.03, d + 0.04);
    // Orden de materiales BoxGeometry: +x, -x, +y, -y, +z, -z
    const lona = new THREE.Mesh(geo, [sideFlip(), side(), plain(), plain(), plain(), side()]);
    lona.position.set((bb.min.x + bb.max.x) / 2, (y0 + y1) / 2, (bb.min.z + bb.max.z) / 2);
    t.add(lona);
  }

  // Tractor sin semirremolque (en reparación)
  setBobtail(v: boolean) {
    if (this.kind !== 'tractor' || !this.trailer || this.bobtail === v) return;
    this.bobtail = v;
    this.trailer.visible = !v;
  }

  get bodyCenterOffset() {
    // centro aproximado de la huella respecto del pivote (para resplandor y etiquetas)
    if (this.kind === 'trailer') return -6.2;
    if (this.kind === 'tractor' && !this.bobtail) return -3.6;
    return 0.9;
  }

  setPose(x: number, z: number, heading: number) {
    this.root.position.set(x, 0, z);
    this.root.rotation.y = heading;
    this.resetTrailer();
  }

  private resetTrailer() {
    const h = this.root.rotation.y;
    const kx = this.root.position.x + Math.sin(h) * this.kingpinLocalZ;
    const kz = this.root.position.z + Math.cos(h) * this.kingpinLocalZ;
    this.trailerAxle.set(kx - Math.sin(h) * TRAILER_LENGTH, kz - Math.cos(h) * TRAILER_LENGTH);
    if (this.trailer && this.kind === 'tractor') this.trailer.rotation.y = 0;
  }

  // Encola un recorrido por puntos (suavizado con Catmull-Rom)
  drive(points: V2[], opts: { speed?: number; reverse?: boolean; onDone?: () => void } = {}) {
    const start = this.queue.length ? null : new THREE.Vector3(this.root.position.x, 0, this.root.position.z);
    const pts = points.map(([x, z]) => new THREE.Vector3(x, 0, z));
    if (start) pts.unshift(start);
    else {
      const last = this.queue[this.queue.length - 1].curve.getPointAt(1);
      pts.unshift(last);
    }
    const clean: THREE.Vector3[] = [];
    for (const p of pts) if (!clean.length || clean[clean.length - 1].distanceTo(p) > 0.5) clean.push(p);
    if (clean.length < 2) { opts.onDone?.(); return; }
    const curve = new THREE.CatmullRomCurve3(clean, false, 'centripetal', 0.5);
    this.queue.push({ curve, length: curve.getLength(), u: 0, speed: opts.speed ?? 7, reverse: !!opts.reverse, onDone: opts.onDone });
    this.moving = true;
  }

  stop() {
    this.queue = [];
    this.moving = false;
  }

  // Espaciado anti-colisión: el mundo baja spacingTarget cuando hay
  // otro vehículo adelante; el factor real se interpola suavemente.
  spacing = 1;
  spacingTarget = 1;

  // +1 avance, -1 reversa (tramo actual del recorrido)
  get dirSign(): 1 | -1 {
    return this.queue[0]?.reverse ? -1 : 1;
  }

  update(dt: number) {
    const m = this.queue[0];
    if (!m) { this.moving = false; return; }
    // Aceleración/frenado suaves en extremos
    const remain = m.length - m.u;
    const ease = Math.min(1, 0.35 + m.u / 6, 0.25 + remain / 8);
    this.spacing += (this.spacingTarget - this.spacing) * Math.min(1, dt * 6);
    const step = m.speed * ease * this.spacing * dt;
    m.u = Math.min(m.length, m.u + step);
    const t = m.length > 0 ? m.u / m.length : 1;
    const p = m.curve.getPointAt(t);
    const tan = m.curve.getTangentAt(t);
    let heading = Math.atan2(tan.x, tan.z);
    if (m.reverse) heading = wrap(heading + Math.PI);
    this.root.position.set(p.x, 0, p.z);
    // giro suavizado
    const cur = this.root.rotation.y;
    this.root.rotation.y = cur + wrap(heading - cur) * Math.min(1, dt * 10);

    const dist = m.reverse ? -step : step;
    for (const w of this.wheels) w.node.rotation.x += dist / w.radius;
    this.updateTrailer(dist);

    if (m.u >= m.length - 0.01) {
      this.queue.shift();
      m.onDone?.();
      if (!this.queue.length) this.moving = false;
    }
  }

  private updateTrailer(dist: number) {
    if (this.kind !== 'tractor' || !this.trailer || this.bobtail) return;
    const h = this.root.rotation.y;
    const kx = this.root.position.x + Math.sin(h) * this.kingpinLocalZ;
    const kz = this.root.position.z + Math.cos(h) * this.kingpinLocalZ;
    const dx = kx - this.trailerAxle.x, dz = kz - this.trailerAxle.y;
    const d = Math.hypot(dx, dz) || 1;
    this.trailerAxle.set(kx - (dx / d) * TRAILER_LENGTH, kz - (dz / d) * TRAILER_LENGTH);
    const th = Math.atan2(dx, dz);
    let rel = wrap(th - h);
    rel = Math.max(-1.2, Math.min(1.2, rel));
    this.trailer.rotation.y = rel;
    for (const w of this.trailerWheels) w.node.rotation.x += dist / w.radius;
  }

  dispose() {
    this.root.removeFromParent();
  }
}
