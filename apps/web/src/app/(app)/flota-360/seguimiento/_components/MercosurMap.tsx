'use client';

// ============================================================
// Mapa Mercosur — canvas 2D, proyección Web-Mercator, pan/zoom.
// Misma identidad visual oscura de Flota360 (navy + azul).
// Las unidades se mueven por los corredores de corridors.ts.
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { COUNTRIES } from './geo';
import { CORRIDORS, CITIES, BORDERS, pointAt, headingAt, corridorKm, type Corridor } from './corridors';

export interface TrackUnit {
  id: string;
  dominio: string;
  corridorId: string;
  /** progreso 0..1 dentro del corredor */
  t: number;
  /** sentido: +1 hacia destino, -1 hacia origen */
  dir: 1 | -1;
  /** velocidad mostrada (km/h) */
  speed: number;
  status: 'en_ruta' | 'detenida' | 'sin_senal';
  servicio?: string | null;
}

export interface UnitInfo extends TrackUnit {
  pos: [number, number];
  rumbo: number;
  corridor: Corridor;
  eta: string | null;
  ultimaSenal: string;
}

const STATUS_COLOR: Record<TrackUnit['status'], string> = {
  en_ruta: '#38bdf8',
  detenida: '#fbbf24',
  sin_senal: '#f87171',
};

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

export default function MercosurMap({ units, selectedId, onSelect, follow, zoomSignal }: {
  units: UnitInfo[];
  selectedId: string | null;
  onSelect: (u: UnitInfo) => void;
  follow: boolean;
  /** cambia para aplicar zoom: cada +1 acerca, cada -1 aleja */
  zoomSignal?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const camRef = useRef<Cam>({ cx: 0.5, cy: 0.5, scale: 1 });
  const lastZoomSignal = useRef(0);
  const dragRef = useRef<{ x: number; y: number; cam: Cam } | null>(null);
  const hoverRef = useRef<string | null>(null);
  const [, force] = useState(0);

  // Fit inicial: encuadrar el bounding box del mapa
  const resetView = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    camRef.current = { cx: 0.5, cy: 0.5, scale: 1 };
    force((n) => n + 1);
  }, []);

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
    const base = Math.min(W, H);
    const S = base * cam.scale;
    const px = (lon: number, lat: number): [number, number] => {
      const [mx, my] = merc(lon, lat);
      return [W / 2 + (mx - cam.cx) * S, H / 2 + (my - cam.cy) * S];
    };

    // fondo océano
    ctx.fillStyle = '#0a1220';
    ctx.fillRect(0, 0, W, H);

    // países
    for (const c of COUNTRIES) {
      for (const ring of c.rings) {
        ctx.beginPath();
        ring.forEach(([lon, lat], i) => {
          const [x, y] = px(lon, lat);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = '#12253a';
        ctx.fill('evenodd');
        ctx.strokeStyle = 'rgba(96,165,250,0.35)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    // corredores
    for (const cor of CORRIDORS) {
      ctx.beginPath();
      cor.pts.forEach(([lon, lat], i) => {
        const [x, y] = px(lon, lat);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = 'rgba(56,189,248,0.28)';
      ctx.lineWidth = Math.max(1.4, 2.2 * cam.scale * 0.35);
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.strokeStyle = 'rgba(56,189,248,0.12)';
      ctx.lineWidth = Math.max(4, 7 * cam.scale * 0.35);
      ctx.stroke();
    }

    // pasos de frontera
    for (const b of BORDERS) {
      const [x, y] = px(b.lon, b.lat);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = 'rgba(251,191,36,0.9)';
      ctx.fillRect(-3.5, -3.5, 7, 7);
      ctx.restore();
      if (cam.scale > 1.6) {
        ctx.font = '10px system-ui';
        ctx.fillStyle = 'rgba(251,191,36,0.75)';
        ctx.fillText(b.nombre, x + 7, y + 3);
      }
    }

    // ciudades
    for (const c of CITIES) {
      const [x, y] = px(c.lon, c.lat);
      ctx.beginPath();
      ctx.arc(x, y, c.major ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle = c.major ? '#7dd3fc' : 'rgba(125,211,252,0.6)';
      ctx.fill();
      if (c.major || cam.scale > 2.2) {
        ctx.font = '10.5px system-ui';
        ctx.fillStyle = 'rgba(226,232,240,0.8)';
        ctx.fillText(c.nombre, x + 6, y - 4);
      }
    }

    // unidades — estela + marcador + etiqueta
    for (const u of units) {
      const [x, y] = px(u.pos[0], u.pos[1]);
      const color = STATUS_COLOR[u.status];
      const sel = u.id === selectedId;

      // estela (últimos puntos del corredor)
      ctx.beginPath();
      for (let k = 0; k <= 18; k++) {
        const tt = u.t - u.dir * k * 0.006;
        const [lon, lat] = pointAt(u.corridor, tt);
        const [sx, sy] = px(lon, lat);
        k === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      }
      ctx.strokeStyle = color + '66';
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.setLineDash([]);

      // halo
      ctx.beginPath();
      ctx.arc(x, y, sel ? 11 : 8, 0, Math.PI * 2);
      ctx.fillStyle = color + '33';
      ctx.fill();

      // marcador
      ctx.beginPath();
      ctx.arc(x, y, sel ? 6.5 : 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#0a1220';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // etiqueta patente·velocidad
      const label = `${u.dominio}${u.status === 'en_ruta' ? ` · ${Math.round(u.speed)} km/h` : ''}`;
      ctx.font = '600 10.5px system-ui';
      const tw = ctx.measureText(label).width;
      const lx = x + 10, ly = y - 16;
      ctx.fillStyle = sel ? 'rgba(8,20,38,0.95)' : 'rgba(8,20,38,0.8)';
      const pad = 4, lh = 15;
      ctx.beginPath();
      ctx.roundRect(lx - pad, ly - lh + 3, tw + pad * 2, lh, 4);
      ctx.fill();
      ctx.strokeStyle = color + 'aa';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = sel ? '#ffffff' : 'rgba(226,232,240,0.92)';
      ctx.fillText(label, lx, ly - 1);
    }
  }, [units, selectedId]);

  // botones +/- del header
  useEffect(() => {
    const d = (zoomSignal ?? 0) - lastZoomSignal.current;
    if (d !== 0) {
      const cam = camRef.current;
      cam.scale = Math.min(8, Math.max(0.85, cam.scale * (d > 0 ? 1.3 : 0.77)));
      lastZoomSignal.current = zoomSignal ?? 0;
    }
  }, [zoomSignal]);

  // seguir unidad: centrar cámara en la seleccionada
  useEffect(() => {
    if (!follow || !selectedId) return;
    const u = units.find((x) => x.id === selectedId);
    if (!u) return;
    const [mx, my] = merc(u.pos[0], u.pos[1]);
    const cam = camRef.current;
    cam.cx += (mx - cam.cx) * 0.12;
    cam.cy += (my - cam.cy) * 0.12;
  }, [units, follow, selectedId]);

  // loop de dibujo
  useEffect(() => {
    let raf = 0;
    const tick = () => { draw(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  // hit-test
  const unitAt = useCallback((mx: number, my: number): UnitInfo | null => {
    const el = wrapRef.current;
    if (!el) return null;
    const cam = camRef.current;
    const S = Math.min(el.clientWidth, el.clientHeight) * cam.scale;
    for (const u of units) {
      const [mxu, myu] = merc(u.pos[0], u.pos[1]);
      const x = el.clientWidth / 2 + (mxu - cam.cx) * S;
      const y = el.clientHeight / 2 + (myu - cam.cy) * S;
      if ((x - mx) ** 2 + (y - my) ** 2 < 18 ** 2) return u;
    }
    return null;
  }, [units]);

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden"
      onWheel={(e) => {
        const cam = camRef.current;
        const f = e.deltaY < 0 ? 1.12 : 0.89;
        cam.scale = Math.min(8, Math.max(0.85, cam.scale * f));
      }}
      onMouseDown={(e) => {
        dragRef.current = { x: e.clientX, y: e.clientY, cam: { ...camRef.current } };
      }}
      onMouseMove={(e) => {
        const el = wrapRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        if (dragRef.current) {
          const cam = dragRef.current.cam;
          const S = Math.min(el.clientWidth, el.clientHeight) * camRef.current.scale;
          camRef.current.cx = cam.cx - (e.clientX - dragRef.current.x) / S;
          camRef.current.cy = cam.cy - (e.clientY - dragRef.current.y) / S;
        } else {
          const h = unitAt(mx, my);
          if (h?.id !== hoverRef.current) {
            hoverRef.current = h?.id ?? null;
            el.style.cursor = h ? 'pointer' : 'grab';
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
        const u = unitAt(e.clientX - rect.left, e.clientY - rect.top);
        if (u) onSelect(u);
      }}
      onMouseLeave={() => { dragRef.current = null; hoverRef.current = null; }}
      onDoubleClick={resetView}
      style={{ cursor: 'grab', touchAction: 'none' }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
