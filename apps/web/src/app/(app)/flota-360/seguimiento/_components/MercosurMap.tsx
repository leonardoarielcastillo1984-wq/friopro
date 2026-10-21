'use client';

// ============================================================
// Mapa Mercosur — canvas 2D, Web-Mercator, pan/zoom.
// Estética del mockup: océano oscuro, tierra navy, relieve Andes
// sutil, corredores finos azul grisáceo, viaje seleccionado
// destacado (punteado + restante tenue), íconos camión, cluster,
// símbolos de pausa/señal, etiquetas sin solapamiento, escala km.
// ============================================================
import React, { useCallback, useEffect, useRef } from 'react';
import { COUNTRIES, COUNTRY_LABELS, OCEAN_LABELS, ANDES } from './geo';
import { CORRIDORS, CITIES, BORDERS, pointAt, type Corridor } from './corridors';

export interface TrackUnit {
  id: string;
  dominio: string;
  corridorId: string;
  t: number;
  dir: 1 | -1;
  speed: number;
  status: 'en_ruta' | 'detenida' | 'sin_senal';
  /** tramo del viaje dentro del corredor (t0..t1) */
  t0: number;
  t1: number;
  viajeOrigen: string;
  viajeDestino: string;
}

export interface UnitInfo extends TrackUnit {
  pos: [number, number];
  rumbo: number;
  corridor: Corridor;
  eta: string | null;
  restKm: number;
  progress: number; // 0..1 del viaje
  ultimaSenal: string;
}

const STATUS_COLOR = { en_ruta: '#38bdf8', detenida: '#fbbf24', sin_senal: '#f87171' } as const;

const MIN_LON = -79, MAX_LON = -34, MIN_LAT = -57, MAX_LAT = -9;

function merc(lon: number, lat: number): [number, number] {
  const x = (lon - MIN_LON) / (MAX_LON - MIN_LON);
  const latC = Math.min(85, Math.max(-85, lat));
  const y0 = Math.log(Math.tan(Math.PI / 4 + (MIN_LAT * Math.PI) / 360));
  const y1 = Math.log(Math.tan(Math.PI / 4 + (MAX_LAT * Math.PI) / 360));
  const y = Math.log(Math.tan(Math.PI / 4 + (latC * Math.PI) / 360));
  return [x, 1 - (y - y0) / (y1 - y0)];
}

interface Cam { cx: number; cy: number; scale: number }
interface Cluster { x: number; y: number; ids: string[] }

export default function MercosurMap({ units, selectedId, onSelect, follow, zoomSignal, recenterSignal }: {
  units: UnitInfo[];
  selectedId: string | null;
  onSelect: (u: UnitInfo) => void;
  follow: boolean;
  zoomSignal?: number;
  recenterSignal?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const camRef = useRef<Cam>({ cx: 0.52, cy: 0.48, scale: 1.06 });
  const lastZoomSignal = useRef(0);
  const lastRecenter = useRef(0);
  const dragRef = useRef<{ x: number; y: number; cam: Cam } | null>(null);
  const clustersRef = useRef<Cluster[]>([]);
  const hoverRef = useRef<string | null>(null);

  const project = useCallback((lon: number, lat: number, W: number, H: number): [number, number] => {
    const cam = camRef.current;
    const S = Math.min(W, H) * cam.scale;
    const [mx, my] = merc(lon, lat);
    return [W / 2 + (mx - cam.cx) * S, H / 2 + (my - cam.cy) * S];
  }, []);

  const buildClusters = useCallback((W: number, H: number): { singles: { u: UnitInfo; x: number; y: number }[]; clusters: Cluster[] } => {
    const pts = units.map((u) => ({ u, p: project(u.pos[0], u.pos[1], W, H) }));
    const used = new Set<string>();
    const singles: { u: UnitInfo; x: number; y: number }[] = [];
    const clusters: Cluster[] = [];
    for (const a of pts) {
      if (used.has(a.u.id)) continue;
      const near = pts.filter((b) => !used.has(b.u.id) && (b.p[0] - a.p[0]) ** 2 + (b.p[1] - a.p[1]) ** 2 < 34 ** 2);
      if (near.length > 1) {
        const cx = near.reduce((s, b) => s + b.p[0], 0) / near.length;
        const cy = near.reduce((s, b) => s + b.p[1], 0) / near.length;
        near.forEach((b) => used.add(b.u.id));
        clusters.push({ x: cx, y: cy, ids: near.map((b) => b.u.id) });
      } else {
        used.add(a.u.id);
        singles.push({ u: a.u, x: a.p[0], y: a.p[1] });
      }
    }
    clustersRef.current = clusters;
    return { singles, clusters };
  }, [units, project]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const el = wrapRef.current;
    if (!canvas || !el) return;
    const dpr = window.devicePixelRatio || 1;
    const W = el.clientWidth, H = el.clientHeight;
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cam = camRef.current;
    const px = (lon: number, lat: number) => project(lon, lat, W, H);

    // océano
    ctx.fillStyle = '#070f1c';
    ctx.fillRect(0, 0, W, H);

    // tierra + fronteras
    for (const c of COUNTRIES) {
      for (const ring of c.rings) {
        ctx.beginPath();
        ring.forEach(([lon, lat], i) => { const [x, y] = px(lon, lat); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
        ctx.closePath();
        ctx.fillStyle = '#101f33';
        ctx.fill('evenodd');
        ctx.strokeStyle = 'rgba(148,163,184,0.30)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    // relieve Andes: sombreado muy sutil
    ctx.save();
    ctx.beginPath();
    ANDES.forEach(([lon, lat], i) => { const [x, y] = px(lon, lat); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.strokeStyle = 'rgba(2,6,16,0.5)';
    ctx.lineWidth = Math.max(8, 16 * cam.scale * 0.3);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(2,6,16,0.6)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(148,180,220,0.16)';
    ctx.lineWidth = Math.max(2, 4 * cam.scale * 0.3);
    ctx.stroke();
    ctx.restore();

    // corredores — finos, azul grisáceo, discretos
    for (const cor of CORRIDORS) {
      ctx.beginPath();
      cor.pts.forEach(([lon, lat], i) => { const [x, y] = px(lon, lat); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      ctx.strokeStyle = 'rgba(100,140,180,0.38)';
      ctx.lineWidth = 1.1;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // viaje seleccionado: recorrido punteado celeste, restante tenue
    const sel = units.find((u) => u.id === selectedId);
    if (sel) {
      const seg = (a: number, b: number) => {
        ctx.beginPath();
        for (let k = 0; k <= 40; k++) {
          const [lon, lat] = pointAt(sel.corridor, a + ((b - a) * k) / 40);
          const [x, y] = px(lon, lat);
          k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(56,189,248,0.28)';
      if (sel.dir === 1) seg(sel.t, sel.t1); else seg(sel.t0, sel.t);
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(125,211,252,0.9)';
      ctx.lineWidth = 2.2;
      if (sel.dir === 1) seg(sel.t0, sel.t); else seg(sel.t, sel.t1);
      ctx.setLineDash([]);
    }

    // pasos fronterizos
    for (const b of BORDERS) {
      const [x, y] = px(b.lon, b.lat);
      ctx.save();
      ctx.translate(x, y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = 'rgba(251,191,36,0.85)';
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
      if (cam.scale > 1.5) {
        ctx.font = '9.5px system-ui';
        ctx.fillStyle = 'rgba(251,191,36,0.6)';
        ctx.fillText(b.nombre, x + 7, y + 3);
      }
    }

    // ciudades
    for (const c of CITIES) {
      const [x, y] = px(c.lon, c.lat);
      ctx.beginPath(); ctx.arc(x, y, c.major ? 2.4 : 1.6, 0, Math.PI * 2);
      ctx.fillStyle = c.major ? 'rgba(186,230,253,0.9)' : 'rgba(186,230,253,0.55)';
      ctx.fill();
      if (c.major || cam.scale > 2.0) {
        ctx.font = '9.5px system-ui';
        ctx.fillStyle = 'rgba(203,213,225,0.72)';
        ctx.fillText(c.nombre, x + 5, y - 3);
      }
    }

    // nombres de países — grandes, tenues
    ctx.save();
    ctx.textAlign = 'center';
    for (const c of COUNTRY_LABELS) {
      const [x, y] = px(c.lon, c.lat);
      const fs = Math.max(12, 14 * cam.scale * 0.6);
      ctx.font = `600 ${fs}px system-ui`;
      ctx.fillStyle = 'rgba(148,163,184,0.20)';
      ctx.fillText(c.nombre, x, y);
    }
    ctx.textAlign = 'left';
    ctx.restore();
    for (const o of OCEAN_LABELS) {
      const [x, y] = px(o.lon, o.lat);
      ctx.font = 'italic 11px system-ui';
      ctx.fillStyle = 'rgba(125,160,200,0.30)';
      ctx.fillText(o.nombre, x - 42, y);
    }

    // clusters + unidades
    const { singles, clusters } = buildClusters(W, H);
    const labelRects: { x: number; y: number; w: number; h: number }[] = [];
    const overlaps = (r: { x: number; y: number; w: number; h: number }) =>
      labelRects.some((o) => !(r.x > o.x + o.w || r.x + r.w < o.x || r.y > o.y + o.h || r.y + r.h < o.y));

    for (const cl of clusters) {
      ctx.beginPath(); ctx.arc(cl.x, cl.y, 13, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56,189,248,0.18)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(56,189,248,0.8)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.font = '700 10.5px system-ui';
      ctx.fillStyle = '#7dd3fc';
      ctx.textAlign = 'center';
      ctx.fillText(`+${cl.ids.length}`, cl.x, cl.y + 3.5);
      ctx.textAlign = 'left';
    }

    let labelsDrawn = 0;
    const ordered = [...singles].sort((a, b) => (a.u.id === selectedId ? -1 : b.u.id === selectedId ? 1 : 0));
    for (const { u, x, y } of ordered) {
      const color = STATUS_COLOR[u.status];
      const isSel = u.id === selectedId;

      // ícono camión orientado por rumbo
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(((u.rumbo - 90) * Math.PI) / 180);
      const s = isSel ? 1.25 : 1;
      if (isSel) {
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56,189,248,0.9)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.fillStyle = u.status === 'sin_senal' ? 'rgba(30,41,59,0.9)' : color;
      ctx.strokeStyle = 'rgba(226,232,240,0.85)';
      ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.roundRect(-7 * s, -3 * s, 10 * s, 6 * s, 1.5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.roundRect(4 * s, -2.5 * s, 4 * s, 5 * s, 1.2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0b1526';
      [-4, 0, 5.5].forEach((wx) => {
        ctx.beginPath(); ctx.arc(wx * s, 3.4 * s, 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(wx * s, -3.4 * s, 1.4, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();

      // símbolos de estado — no dependen solo del color
      if (u.status === 'detenida') {
        ctx.fillStyle = 'rgba(251,191,36,0.95)';
        ctx.beginPath(); ctx.arc(x + 7, y - 7, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0b1526';
        ctx.fillRect(x + 4.8, y - 9.5, 1.6, 5);
        ctx.fillRect(x + 7.6, y - 9.5, 1.6, 5);
      } else if (u.status === 'sin_senal') {
        ctx.strokeStyle = 'rgba(248,113,113,0.95)';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(x + 8, y - 8, 5.5, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 5.4, y - 10.6); ctx.lineTo(x + 10.6, y - 5.4); ctx.stroke();
      }

      // etiqueta: seleccionada + hasta 2 más, sin solapamiento
      if (isSel || (u.status === 'en_ruta' && labelsDrawn < 3)) {
        const label = `${u.dominio}${u.status === 'en_ruta' ? ` · ${Math.round(u.speed)} km/h` : u.status === 'detenida' ? ' · detenida' : ' · sin señal'}`;
        ctx.font = '600 10px system-ui';
        const tw = ctx.measureText(label).width;
        const lh = 15;
        const spots = [
          { x: x + 12, y: y - lh - 4 },
          { x: x - tw - 20, y: y - lh - 4 },
          { x: x + 12, y: y + 10 },
        ];
        const spot = spots.find((s2) => !overlaps({ x: s2.x, y: s2.y, w: tw + 8, h: lh }));
        if (spot) {
          ctx.fillStyle = 'rgba(8,20,38,0.88)';
          ctx.beginPath(); ctx.roundRect(spot.x, spot.y, tw + 8, lh, 4); ctx.fill();
          ctx.strokeStyle = color + '88'; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = isSel ? '#e0f2fe' : 'rgba(226,232,240,0.9)';
          ctx.fillText(label, spot.x + 4, spot.y + 11);
          labelRects.push({ x: spot.x, y: spot.y, w: tw + 8, h: lh });
          labelsDrawn++;
        }
      }
    }

    // escala km — inferior izquierda
    const midLat = MIN_LAT + (MAX_LAT - MIN_LAT) * (1 - cam.cy);
    const S = Math.min(W, H) * cam.scale;
    const pxPerKm = S / (45 * 111.32 * Math.cos((midLat * Math.PI) / 180));
    const nice = [50, 100, 200, 250, 500, 1000].find((k) => k * pxPerKm > 40) || 50;
    const barW = nice * pxPerKm;
    const bx = 14, by = H - 26;
    ctx.strokeStyle = 'rgba(203,213,225,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + barW, by); ctx.stroke();
    [0, 0.5, 1].forEach((f) => {
      ctx.beginPath(); ctx.moveTo(bx + barW * f, by - 3); ctx.lineTo(bx + barW * f, by + 3); ctx.stroke();
    });
    ctx.font = '9px system-ui';
    ctx.fillStyle = 'rgba(203,213,225,0.6)';
    ctx.fillText('0', bx - 2, by - 6);
    ctx.fillText(`${Math.round(nice / 2)}`, bx + barW / 2 - 8, by - 6);
    ctx.fillText(`${nice} km`, bx + barW - 20, by - 6);
  }, [units, selectedId, project, buildClusters]);

  useEffect(() => {
    const d = (zoomSignal ?? 0) - lastZoomSignal.current;
    if (d !== 0) {
      const cam = camRef.current;
      cam.scale = Math.min(9, Math.max(0.8, cam.scale * (d > 0 ? 1.35 : 0.74)));
      lastZoomSignal.current = zoomSignal ?? 0;
    }
  }, [zoomSignal]);

  useEffect(() => {
    const d = (recenterSignal ?? 0) - lastRecenter.current;
    if (d !== 0) {
      camRef.current = { cx: 0.52, cy: 0.48, scale: 1.06 };
      lastRecenter.current = recenterSignal ?? 0;
    }
  }, [recenterSignal]);

  useEffect(() => {
    if (!follow || !selectedId) return;
    const u = units.find((x) => x.id === selectedId);
    if (!u) return;
    const [mx, my] = merc(u.pos[0], u.pos[1]);
    const cam = camRef.current;
    cam.cx += (mx - cam.cx) * 0.1;
    cam.cy += (my - cam.cy) * 0.1;
    if (cam.scale < 2.2) cam.scale += (2.2 - cam.scale) * 0.04;
  }, [units, follow, selectedId]);

  useEffect(() => {
    let raf = 0;
    const tick = () => { draw(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  const hitTest = useCallback((mx: number, my: number): UnitInfo | null => {
    const el = wrapRef.current;
    if (!el) return null;
    for (const u of units) {
      const [x, y] = project(u.pos[0], u.pos[1], el.clientWidth, el.clientHeight);
      if ((x - mx) ** 2 + (y - my) ** 2 < 20 ** 2) return u;
    }
    return null;
  }, [units, project]);

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden"
      onWheel={(e) => {
        const cam = camRef.current;
        cam.scale = Math.min(9, Math.max(0.8, cam.scale * (e.deltaY < 0 ? 1.12 : 0.89)));
      }}
      onMouseDown={(e) => { dragRef.current = { x: e.clientX, y: e.clientY, cam: { ...camRef.current } }; }}
      onMouseMove={(e) => {
        const el = wrapRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        if (dragRef.current) {
          const cam = dragRef.current.cam;
          const S = Math.min(el.clientWidth, el.clientHeight) * camRef.current.scale;
          camRef.current.cx = Math.min(1.1, Math.max(-0.1, cam.cx - (e.clientX - dragRef.current.x) / S));
          camRef.current.cy = Math.min(1.1, Math.max(-0.1, cam.cy - (e.clientY - dragRef.current.y) / S));
        } else {
          const h = hitTest(mx, my);
          const cl = clustersRef.current.find((c) => (c.x - mx) ** 2 + (c.y - my) ** 2 < 15 ** 2);
          if ((h?.id ?? cl?.ids[0] ?? null) !== hoverRef.current) {
            hoverRef.current = h?.id ?? cl?.ids[0] ?? null;
            el.style.cursor = h || cl ? 'pointer' : 'grab';
          }
        }
      }}
      onMouseUp={(e) => {
        const wasDrag = dragRef.current && (Math.abs(e.clientX - dragRef.current.x) > 4 || Math.abs(e.clientY - dragRef.current.y) > 4);
        dragRef.current = null;
        if (wasDrag) return;
        const el = wrapRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const cl = clustersRef.current.find((c) => (c.x - mx) ** 2 + (c.y - my) ** 2 < 16 ** 2);
        if (cl) {
          const cam = camRef.current;
          const S = Math.min(el.clientWidth, el.clientHeight) * cam.scale;
          cam.cx += (cl.x - el.clientWidth / 2) / S;
          cam.cy += (cl.y - el.clientHeight / 2) / S;
          cam.scale = Math.min(9, cam.scale * 1.7);
          return;
        }
        const u = hitTest(mx, my);
        if (u) onSelect(u);
      }}
      onMouseLeave={() => { dragRef.current = null; hoverRef.current = null; }}
      style={{ cursor: 'grab', touchAction: 'none' }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
