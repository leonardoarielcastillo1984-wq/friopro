'use client';

// ============================================================
// Flota360 · Seguimiento en vivo
// Layout del mockup: header con chips + buscador, mapa 75%,
// panel lateral con ficha de unidad (3D, trayecto, ETA,
// actividad), leyenda inferior con escala.
// Vista conceptual — posiciones simuladas sobre flota real.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import {
  Navigation, MapPin, Gauge, Radio, Flag, Crosshair, X, Plus, Minus,
  Search, FileText, Clock3,
} from 'lucide-react';
import MercosurMap, { type TrackUnit, type UnitInfo } from './_components/MercosurMap';
import TruckThumb from './_components/TruckThumb';
import { CORRIDORS, pointAt, headingAt, corridorKm, fracAtVertex } from './_components/corridors';

interface SimUnit extends TrackUnit {
  lastSignalAt: number;
}

const TICK_MS = 1000;
const SIM_FACTOR = 90; // 1s real = 90s de viaje (se ve mover)

// Viajes definidos sobre corredores: algunos completos, otros
// tramos parciales (ej. Buenos Aires → Rosario dentro de RN9).
function seedUnits(dominios: { id: string; dominio: string }[]): SimUnit[] {
  const now = Date.now();
  const list = dominios.length ? dominios : [
    { id: 'demo-1', dominio: 'AG524WU' }, { id: 'demo-2', dominio: 'AG712CJ' },
    { id: 'demo-3', dominio: 'AH338SZ' }, { id: 'demo-4', dominio: 'AF218LP' },
    { id: 'demo-5', dominio: 'JKW074' }, { id: 'demo-6', dominio: 'AE554BX' },
    { id: 'demo-7', dominio: 'AG110TR' }, { id: 'demo-8', dominio: 'AA902KM' },
    { id: 'demo-9', dominio: 'AD771MZ' }, { id: 'demo-10', dominio: 'AE303CH' },
    { id: 'demo-11', dominio: 'AF620QA' }, { id: 'demo-12', dominio: 'AB445ND' },
  ];

  const viaje = (corridorId: string, origen: string, destino: string, i0: number, i1: number) => {
    const cor = CORRIDORS.find((c) => c.id === corridorId)!;
    return { corridorId, viajeOrigen: origen, viajeDestino: destino, t0: fracAtVertex(cor, i0), t1: fracAtVertex(cor, i1) };
  };

  // Distribución pensada: 1 viaje corto BA→Rosario (el del mockup),
  // varios en corredores completos, algunos cerca de BA (cluster).
  const VIAJES = [
    () => viaje('ba-ros-cba', 'Buenos Aires', 'Rosario', 0, 4),
    () => viaje('ros-psl-spo', 'Rosario', 'São Paulo', 0, CORRIDORS.find((c) => c.id === 'ros-psl-spo')!.pts.length - 1),
    () => viaje('ba-mza-scl', 'Buenos Aires', 'Santiago de Chile', 0, CORRIDORS.find((c) => c.id === 'ba-mza-scl')!.pts.length - 1),
    () => viaje('cba-asu', 'Córdoba', 'Asunción', 0, CORRIDORS.find((c) => c.id === 'cba-asu')!.pts.length - 1),
    () => viaje('ba-mvd', 'Buenos Aires', 'Montevideo', 0, CORRIDORS.find((c) => c.id === 'ba-mvd')!.pts.length - 1),
    () => viaje('ba-neu', 'Buenos Aires', 'Neuquén', 0, CORRIDORS.find((c) => c.id === 'ba-neu')!.pts.length - 1),
    () => viaje('sal-cba', 'Salta', 'Córdoba', 0, CORRIDORS.find((c) => c.id === 'sal-cba')!.pts.length - 1),
    () => viaje('mza-pyj', 'Mendoza', 'Ciudad del Este', 0, CORRIDORS.find((c) => c.id === 'mza-pyj')!.pts.length - 1),
    // cluster cerca de BA
    () => viaje('ba-mdp', 'Buenos Aires', 'Mar del Plata', 0, CORRIDORS.find((c) => c.id === 'ba-mdp')!.pts.length - 1),
    () => viaje('ba-mdp', 'Buenos Aires', 'Mar del Plata', 0, CORRIDORS.find((c) => c.id === 'ba-mdp')!.pts.length - 1),
    () => viaje('ba-ros-cba', 'Buenos Aires', 'Córdoba', 0, CORRIDORS.find((c) => c.id === 'ba-ros-cba')!.pts.length - 1),
    () => viaje('ba-ros-cba', 'Buenos Aires', 'Córdoba', 0, CORRIDORS.find((c) => c.id === 'ba-ros-cba')!.pts.length - 1),
  ];

  return list.slice(0, 14).map((v, i) => {
    const vj = VIAJES[i % VIAJES.length]();
    const status: SimUnit['status'] =
      i % 6 === 5 ? 'sin_senal' : i % 5 === 4 ? 'detenida' : 'en_ruta';
    // las unidades del "cluster" arrancan cerca del origen (BA)
    const nearOrigin = i >= 8;
    const t0 = vj.t0, t1 = vj.t1;
    const t = nearOrigin
      ? t0 + (t1 - t0) * (0.02 + (i % 3) * 0.03)
      : t0 + (t1 - t0) * (0.15 + ((i * 0.23) % 0.7));
    return {
      id: v.id,
      dominio: v.dominio,
      t,
      dir: 1 as const,
      speed: status === 'en_ruta' ? 62 + ((i * 13) % 28) : 0,
      status,
      lastSignalAt: now - (status === 'sin_senal' ? 42 * 60_000 : (i % 5) * 9000 + 3000),
      ...vj,
    };
  });
}

function stepUnits(units: SimUnit[]): SimUnit[] {
  const now = Date.now();
  return units.map((u) => {
    const cor = CORRIDORS.find((c) => c.id === u.corridorId)!;
    const kmSpan = corridorKm(cor) * (u.t1 - u.t0);
    let { t, dir, speed, status, lastSignalAt } = u;
    if (status === 'en_ruta') {
      speed = Math.max(45, Math.min(95, speed + (Math.random() - 0.5) * 6));
      const dKm = (speed * SIM_FACTOR) / 3600;
      t += (dir * dKm) / Math.max(1, kmSpan);
      if (t >= u.t1) { t = u.t1; dir = -1; }
      if (t <= u.t0) { t = u.t0; dir = 1; }
      if (Math.random() < 0.008) { status = 'detenida'; speed = 0; }
      lastSignalAt = now;
    } else if (status === 'detenida') {
      if (Math.random() < 0.05) { status = 'en_ruta'; speed = 55 + Math.random() * 30; lastSignalAt = now; }
    }
    return { ...u, t, dir, speed, status, lastSignalAt };
  });
}

function toInfo(u: SimUnit): UnitInfo {
  const cor = CORRIDORS.find((c) => c.id === u.corridorId)!;
  const spanKm = corridorKm(cor) * (u.t1 - u.t0);
  const restKm = u.dir === 1 ? spanKm * (u.t1 - u.t) / (u.t1 - u.t0) : spanKm * (u.t - u.t0) / (u.t1 - u.t0);
  const progress = u.dir === 1 ? (u.t - u.t0) / (u.t1 - u.t0) : (u.t1 - u.t) / (u.t1 - u.t0);
  const eta = u.status === 'en_ruta' && u.speed > 0
    ? new Date(Date.now() + (restKm / u.speed) * 3600_000).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : null;
  const sec = Math.floor((Date.now() - u.lastSignalAt) / 1000);
  const ultimaSenal = sec < 60 ? `hace ${Math.max(1, sec)} s` : sec < 3600 ? `hace ${Math.floor(sec / 60)} min` : `hace ${Math.floor(sec / 3600)} h`;
  const rumboBase = headingAt(cor, u.t);
  return {
    ...u,
    pos: pointAt(cor, u.t),
    rumbo: u.dir === 1 ? rumboBase : rumboBase + 180,
    corridor: cor,
    eta,
    restKm,
    progress: Math.min(1, Math.max(0, progress)),
    ultimaSenal,
  };
}

const STATUS_LABEL = { en_ruta: 'En ruta', detenida: 'Detenida', sin_senal: 'Sin señal' } as const;
const STATUS_DOT = { en_ruta: '#38bdf8', detenida: '#fbbf24', sin_senal: '#f87171' } as const;

export default function SeguimientoPage() {
  const [units, setUnits] = useState<SimUnit[]>([]);
  const [selected, setSelected] = useState<UnitInfo | null>(null);
  const [follow, setFollow] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [recenter, setRecenter] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const simRef = useRef<SimUnit[]>([]);

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
  // refrescar la ficha seleccionada con la simulación
  const selInfo = selected ? infos.find((u) => u.id === selected.id) ?? null : null;

  const counts = useMemo(() => ({
    total: infos.length,
    enRuta: infos.filter((u) => u.status === 'en_ruta').length,
    detenidas: infos.filter((u) => u.status === 'detenida').length,
    sinSenal: infos.filter((u) => u.status === 'sin_senal').length,
  }), [infos]);

  const onSelect = useCallback((u: UnitInfo) => {
    setSelected(u);
    setFollow(false);
  }, []);

  const searchMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return infos.filter((u) =>
      u.dominio.toLowerCase().includes(q) ||
      u.viajeOrigen.toLowerCase().includes(q) ||
      u.viajeDestino.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [query, infos]);

  return (
    <div className="flex h-[calc(100vh-9rem)] min-h-[560px] flex-col overflow-hidden rounded-xl border border-[#1e3a5f] bg-[#0a1220] text-slate-200">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#1e3a5f] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-sky-400" />
          <h1 className="text-sm font-bold tracking-wide">Seguimiento <span className="text-sky-400">en vivo</span></h1>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="rounded-full bg-white/5 px-2 py-0.5 font-medium text-slate-300">{counts.total} unidades</span>
          <span className="flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 font-medium text-sky-300"><span className="h-1.5 w-1.5 rounded-full bg-sky-400" />{counts.enRuta} en ruta</span>
          <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-300"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{counts.detenidas} detenidas</span>
          <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 font-medium text-red-300"><span className="h-1.5 w-1.5 rounded-full bg-red-400" />{counts.sinSenal} sin señal</span>
        </div>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar patente o ciudad…"
            className="w-52 rounded-md border border-[#1e3a5f] bg-[#0d1b3d] py-1.5 pl-8 pr-3 text-[12px] text-slate-200 placeholder-slate-500 outline-none focus:border-sky-500/60"
          />
          {searchMatches.length > 0 && (
            <div className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-md border border-[#1e3a5f] bg-[#0d1b3d] shadow-xl">
              {searchMatches.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { onSelect(u); setFollow(true); setQuery(''); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-white/5"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_DOT[u.status] }} />
                  <span className="font-semibold">{u.dominio}</span>
                  <span className="truncate text-slate-400">{u.viajeOrigen} → {u.viajeDestino}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* cuerpo: mapa + panel */}
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">Cargando flota…</div>
          ) : (
            <MercosurMap
              units={infos}
              selectedId={selInfo?.id ?? null}
              onSelect={onSelect}
              follow={follow}
              zoomSignal={zoom}
              recenterSignal={recenter}
            />
          )}
          {/* controles del mapa */}
          <div className="absolute left-3 top-1/2 flex -translate-y-1/2 flex-col gap-1">
            <button onClick={() => setZoom((z) => z + 1)} aria-label="Acercar" className="rounded-md border border-[#1e3a5f] bg-[#0d1b3d]/90 p-1.5 text-slate-300 shadow hover:bg-white/10"><Plus size={14} /></button>
            <button onClick={() => setZoom((z) => z - 1)} aria-label="Alejar" className="rounded-md border border-[#1e3a5f] bg-[#0d1b3d]/90 p-1.5 text-slate-300 shadow hover:bg-white/10"><Minus size={14} /></button>
            <button onClick={() => { setRecenter((r) => r + 1); setFollow(false); }} aria-label="Recentrar" className="rounded-md border border-[#1e3a5f] bg-[#0d1b3d]/90 p-1.5 text-slate-300 shadow hover:bg-white/10"><Crosshair size={14} /></button>
          </div>
        </div>

        {/* panel lateral */}
        <aside className="w-[290px] shrink-0 overflow-y-auto border-l border-[#1e3a5f] bg-[#0d1b3d]">
          {selInfo ? (
            <div>
              <div className="flex items-center justify-between border-b border-[#1e3a5f] px-4 py-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Unidad seleccionada</span>
                <button onClick={() => { setSelected(null); setFollow(false); }} className="text-slate-400 hover:text-white" aria-label="Cerrar"><X size={14} /></button>
              </div>
              <div className="space-y-3 px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold tracking-wide">{selInfo.dominio}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    selInfo.status === 'en_ruta' ? 'bg-sky-500/15 text-sky-300'
                    : selInfo.status === 'detenida' ? 'bg-amber-500/15 text-amber-300'
                    : 'bg-red-500/15 text-red-300'
                  }`}>{STATUS_LABEL[selInfo.status]}</span>
                </div>

                <TruckThumb />

                <div>
                  <p className="flex items-center gap-2 text-[13px] text-slate-300">
                    <MapPin size={13} className="shrink-0 text-sky-400" />
                    {selInfo.dir === 1 ? `${selInfo.viajeOrigen} → ${selInfo.viajeDestino}` : `${selInfo.viajeDestino} → ${selInfo.viajeOrigen}`}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${Math.round(selInfo.progress * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-right text-[11px] text-slate-400">{Math.round(selInfo.progress * 100)}% del recorrido</p>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-[12px]">
                  <div>
                    <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><Gauge size={11} />Velocidad</p>
                    <p className="mt-0.5 font-semibold">{selInfo.status === 'en_ruta' ? `${Math.round(selInfo.speed)} km/h` : '0 km/h'}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><Radio size={11} />Última señal</p>
                    <p className="mt-0.5 font-semibold">{selInfo.ultimaSenal}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><Clock3 size={11} />Llegada estimada</p>
                    <p className="mt-0.5 font-semibold">{selInfo.eta ?? '—'}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><Flag size={11} />Distancia restante</p>
                    <p className="mt-0.5 font-semibold">{Math.round(selInfo.restKm)} km</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setFollow((f) => !f)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[12px] font-semibold transition-colors ${
                      follow ? 'bg-sky-500 text-[#0a1220]' : 'bg-sky-500/15 text-sky-300 hover:bg-sky-500/25'
                    }`}
                  >
                    <Crosshair size={13} /> {follow ? 'Siguiendo…' : 'Seguir unidad'}
                  </button>
                  {!selInfo.id.startsWith('demo-') && (
                    <Link
                      href={`/flota-360/vehiculos/${selInfo.id}`}
                      className="flex items-center justify-center gap-1.5 rounded-md border border-[#1e3a5f] px-3 py-2 text-[12px] text-slate-300 hover:bg-white/5"
                    >
                      <FileText size={13} /> Ver ficha
                    </Link>
                  )}
                </div>

                <Actividad unit={selInfo} />
              </div>
            </div>
          ) : (
            <div className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Unidades en seguimiento</p>
              <p className="mt-1 text-[11px] text-slate-500">Seleccioná una unidad en el mapa o en la lista.</p>
              <ul className="mt-3 space-y-1">
                {infos.map((u) => (
                  <li key={u.id}>
                    <button
                      onClick={() => { onSelect(u); }}
                      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-white/5"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_DOT[u.status] }} />
                      <span className="w-20 shrink-0 text-[12px] font-semibold">{u.dominio}</span>
                      <span className="truncate text-[11px] text-slate-400">
                        {u.dir === 1 ? `${u.viajeOrigen} → ${u.viajeDestino}` : `${u.viajeDestino} → ${u.viajeOrigen}`}
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] text-slate-500">
                        {u.status === 'en_ruta' ? `${Math.round(u.speed)} km/h` : STATUS_LABEL[u.status]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {/* leyenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#1e3a5f] px-4 py-2 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: '#38bdf8' }} />En ruta</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: '#fbbf24' }} />Detenida</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: '#f87171' }} />Sin señal</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-px w-4 bg-slate-500" />Corredor logístico</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5 rotate-45 bg-amber-400/80" />Paso fronterizo</span>
        <span className="ml-auto italic">Vista conceptual · Posiciones simuladas</span>
      </div>
    </div>
  );
}

// Actividad reciente sintética, determinística por unidad.
function Actividad({ unit }: { unit: UnitInfo }) {
  const eventos = useMemo(() => {
    const evs: { hora: string; titulo: string; detalle: string }[] = [];
    const salida = new Date(Date.now() - (unit.restKm > 0 ? (unit.progress * (unit.restKm / Math.max(0.01, 1 - unit.progress || 1)) / Math.max(1, unit.speed)) * 3600_000 : 45 * 60_000));
    evs.push({
      hora: salida.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      titulo: `Salió de ${unit.viajeOrigen}`,
      detalle: 'Inicio de viaje',
    });
    if (unit.status === 'detenida') {
      evs.push({
        hora: new Date(Date.now() - 14 * 60_000).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        titulo: 'Detención en curso',
        detalle: 'Última posición reportada',
      });
    } else if (unit.status === 'sin_senal') {
      evs.push({
        hora: unit.ultimaSenal,
        titulo: 'Señal perdida',
        detalle: 'Sin reporte de posición',
      });
    } else {
      const h = unit.dominio.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      evs.push({
        hora: new Date(Date.now() - (40 + (h % 80)) * 60_000).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        titulo: 'Parada técnica',
        detalle: `${12 + (h % 25)} min`,
      });
    }
    return evs.slice(0, 3);
  }, [unit.id, unit.status, unit.dominio, unit.progress, unit.restKm, unit.speed, unit.viajeOrigen, unit.ultimaSenal]);

  return (
    <div className="border-t border-[#1e3a5f] pt-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <Clock3 size={11} /> Actividad reciente
      </p>
      <ul className="mt-2 space-y-2.5">
        {eventos.map((e, i) => (
          <li key={i} className="flex gap-2.5 text-[12px]">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
            <div className="min-w-0">
              <p className="text-slate-300"><span className="mr-1.5 text-slate-500">{e.hora}</span>{e.titulo}</p>
              <p className="text-[11px] text-slate-500">{e.detalle}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
