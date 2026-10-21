'use client';

// ============================================================
// Flota360 · Seguimiento en vivo
// Mapa Mercosur: unidades sobre corredores logísticos reales.
// Vista conceptual — sin telemetría conectada, las posiciones
// son simuladas sobre las unidades reales de la flota.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import {
  Navigation, MapPin, Gauge, Radio, Flag, Crosshair, X, Plus, Minus, FlaskConical,
} from 'lucide-react';
import MercosurMap, { type TrackUnit, type UnitInfo } from './_components/MercosurMap';
import { CORRIDORS, pointAt, headingAt, corridorKm } from './_components/corridors';

interface SimUnit extends TrackUnit {
  lastSignalAt: number; // epoch ms
}

const TICK_MS = 1000;
/** factor de simulación: 1s real = SIM_FACTOR s de viaje (para que se vea mover) */
const SIM_FACTOR = 90;

function seedUnits(dominios: { id: string; dominio: string }[]): SimUnit[] {
  const now = Date.now();
  const list = dominios.length ? dominios : [
    { id: 'demo-1', dominio: 'AE007GS' }, { id: 'demo-2', dominio: 'AF218LP' },
    { id: 'demo-3', dominio: 'JKW074' }, { id: 'demo-4', dominio: 'AE554BX' },
    { id: 'demo-5', dominio: 'AG110TR' }, { id: 'demo-6', dominio: 'AA902KM' },
    { id: 'demo-7', dominio: 'AD771MZ' }, { id: 'demo-8', dominio: 'AE303CH' },
  ];
  return list.slice(0, 14).map((v, i) => {
    const cor = CORRIDORS[i % CORRIDORS.length];
    // algunas unidades detenidas o sin señal para poblar la leyenda
    const status: SimUnit['status'] =
      i % 7 === 6 ? 'sin_senal' : i % 5 === 4 ? 'detenida' : 'en_ruta';
    return {
      id: v.id,
      dominio: v.dominio,
      corridorId: cor.id,
      t: 0.08 + ((i * 0.17) % 0.8),
      dir: i % 2 === 0 ? 1 : -1,
      speed: status === 'en_ruta' ? 62 + ((i * 13) % 28) : 0,
      status,
      lastSignalAt: now - (status === 'sin_senal' ? 42 * 60_000 : (i % 5) * 9000 + 3000),
    };
  });
}

function stepUnits(units: SimUnit[]): SimUnit[] {
  const now = Date.now();
  return units.map((u) => {
    const cor = CORRIDORS.find((c) => c.id === u.corridorId)!;
    const km = corridorKm(cor);
    let { t, dir, speed, status, lastSignalAt } = u;
    if (status === 'en_ruta') {
      speed = Math.max(45, Math.min(95, speed + (Math.random() - 0.5) * 6));
      const dKm = (speed * SIM_FACTOR) / 3600;
      t += (dir * dKm) / km;
      if (t >= 1) { t = 1; dir = -1; }
      if (t <= 0) { t = 0; dir = 1; }
      // paradas ocasionales
      if (Math.random() < 0.008) { status = 'detenida'; speed = 0; }
      lastSignalAt = now;
    } else if (status === 'detenida') {
      // retoma tras ~20-60s de simulación
      if (Math.random() < 0.05) { status = 'en_ruta'; speed = 55 + Math.random() * 30; lastSignalAt = now; }
    }
    return { ...u, t, dir, speed, status, lastSignalAt };
  });
}

function toInfo(u: SimUnit): UnitInfo {
  const cor = CORRIDORS.find((c) => c.id === u.corridorId)!;
  const km = corridorKm(cor);
  const restKm = u.dir === 1 ? km * (1 - u.t) : km * u.t;
  const eta = u.status === 'en_ruta' && u.speed > 0
    ? new Date(Date.now() + (restKm / u.speed) * 3600_000).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : null;
  const sec = Math.floor((Date.now() - u.lastSignalAt) / 1000);
  const ultimaSenal = sec < 60 ? `hace ${Math.max(1, sec)} s` : sec < 3600 ? `hace ${Math.floor(sec / 60)} min` : `hace ${Math.floor(sec / 3600)} h`;
  return {
    ...u,
    pos: pointAt(cor, u.t),
    rumbo: headingAt(cor, u.t),
    corridor: cor,
    eta,
    ultimaSenal,
  };
}

const STATUS_LABEL: Record<SimUnit['status'], string> = {
  en_ruta: 'En ruta', detenida: 'Detenida', sin_senal: 'Sin señal',
};
const STATUS_DOT: Record<SimUnit['status'], string> = {
  en_ruta: '#38bdf8', detenida: '#fbbf24', sin_senal: '#f87171',
};

export default function SeguimientoPage() {
  const [units, setUnits] = useState<SimUnit[]>([]);
  const [selected, setSelected] = useState<UnitInfo | null>(null);
  const [follow, setFollow] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [loading, setLoading] = useState(true);
  const simRef = useRef<SimUnit[]>([]);

  // unidades reales del tenant → placas reales en el mapa
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await apiFetch<any>('/flota/vehiculos');
        const veh = (r?.vehiculos ?? []).filter((v: any) => v.status !== 'BAJA')
          .map((v: any) => ({ id: v.id, dominio: v.dominio }));
        if (alive) { simRef.current = seedUnits(veh); setUnits([...simRef.current]); }
      } catch {
        if (alive) { simRef.current = seedUnits([]); setUnits([...simRef.current]); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // loop de simulación
  useEffect(() => {
    if (loading) return;
    const t = setInterval(() => {
      if (document.hidden) return;
      simRef.current = stepUnits(simRef.current);
      setUnits([...simRef.current]);
    }, TICK_MS);
    return () => clearInterval(t);
  }, [loading]);

  const infos = useMemo(() => units.map(toInfo), [units]);
  const enRuta = infos.filter((u) => u.status === 'en_ruta').length;

  const onSelect = useCallback((u: UnitInfo) => {
    setSelected(u);
    setFollow(false);
  }, []);

  return (
    <div className="flex h-[calc(100vh-9rem)] min-h-[540px] flex-col overflow-hidden rounded-xl border border-[#1e3a5f] bg-[#0a1220] text-slate-200">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#1e3a5f] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-sky-400" />
          <h1 className="text-sm font-bold tracking-wide">SEGUIMIENTO <span className="text-sky-400">EN VIVO</span></h1>
          <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-medium text-sky-300">
            {enRuta} unidades en ruta
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300 sm:flex">
            <FlaskConical size={12} /> Vista conceptual · posiciones simuladas
          </span>
          <button
            onClick={() => setZoom((z) => z + 1)}
            className="rounded-md border border-[#1e3a5f] p-1.5 text-slate-300 hover:bg-white/5"
            aria-label="Acercar"
          ><Plus size={14} /></button>
          <button
            onClick={() => setZoom((z) => z - 1)}
            className="rounded-md border border-[#1e3a5f] p-1.5 text-slate-300 hover:bg-white/5"
            aria-label="Alejar"
          ><Minus size={14} /></button>
        </div>
      </div>

      {/* mapa + popup */}
      <div className="relative flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">Cargando flota…</div>
        ) : (
          <MercosurMap units={infos} selectedId={selected?.id ?? null} onSelect={onSelect} follow={follow} zoomSignal={zoom} />
        )}

        {selected && (
          <div className="absolute right-3 top-3 w-64 overflow-hidden rounded-xl border border-[#1e3a5f] bg-[#0d1b3d]/95 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between border-b border-[#1e3a5f] px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS_DOT[selected.status] }} />
                <span className="text-sm font-bold">{selected.dominio}</span>
                <span className="text-[11px] text-slate-400">{STATUS_LABEL[selected.status]}</span>
              </div>
              <button onClick={() => { setSelected(null); setFollow(false); }} className="text-slate-400 hover:text-white" aria-label="Cerrar"><X size={14} /></button>
            </div>
            <div className="space-y-2 px-3.5 py-3 text-[12px]">
              <p className="flex items-center gap-2 text-slate-300">
                <MapPin size={13} className="shrink-0 text-sky-400" />
                {selected.dir === 1 ? `${selected.corridor.origen} → ${selected.corridor.destino}` : `${selected.corridor.destino} → ${selected.corridor.origen}`}
              </p>
              <p className="flex items-center gap-2 text-slate-300">
                <Gauge size={13} className="shrink-0 text-sky-400" />
                {selected.status === 'en_ruta' ? `${Math.round(selected.speed)} km/h` : 'Detenida'}
              </p>
              <p className="flex items-center gap-2 text-slate-300">
                <Radio size={13} className="shrink-0 text-sky-400" />
                Última señal: {selected.ultimaSenal}
              </p>
              <p className="flex items-center gap-2 text-slate-300">
                <Flag size={13} className="shrink-0 text-sky-400" />
                Llegada estimada: {selected.eta ?? '—'}
              </p>
            </div>
            <div className="flex gap-2 px-3.5 pb-3">
              <button
                onClick={() => setFollow((f) => !f)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-semibold transition-colors ${
                  follow ? 'bg-sky-600 text-white' : 'bg-sky-500/15 text-sky-300 hover:bg-sky-500/25'
                }`}
              >
                <Crosshair size={13} /> {follow ? 'Siguiendo…' : 'Seguir unidad'}
              </button>
              {!selected.id.startsWith('demo-') && (
                <Link
                  href={`/flota-360/vehiculos/${selected.id}`}
                  className="flex items-center justify-center rounded-md border border-[#1e3a5f] px-2.5 py-1.5 text-[12px] text-slate-300 hover:bg-white/5"
                >
                  Ficha
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* leyenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#1e3a5f] px-4 py-2 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: '#38bdf8' }} />En ruta</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: '#fbbf24' }} />Detenida</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: '#f87171' }} />Sin señal</span>
        <span className="ml-auto italic">Vista conceptual · Datos simulados</span>
      </div>
    </div>
  );
}
