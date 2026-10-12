'use client';

// ============================================================
// Escena 3D isométrica del predio (wrapper React de FleetWorld)
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Maximize2, Sun, Moon, Clock3, Sparkles, Cloudy, CloudRain, CloudLightning, CloudSun } from 'lucide-react';
import type { CCUnit, Mode, VisualStatus } from './types';
import type { FleetWorld } from './world/FleetWorld';
import type { Scenario } from './world/layout-core';
import { genericScenario } from './world/layout';

type DayNight = 'day' | 'night' | 'auto';
type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm';
type WeatherSel = WeatherKind | 'auto';

// Fallback de ubicación del predio (Córdoba, centro del corredor logístico).
// Si el navegador permite geolocalización se usa la posición real del operador.
const YARD_COORDS = { lat: -31.42, lon: -64.18 };

const WX_LABEL: Record<WeatherKind, string> = {
  clear: 'Despejado', cloudy: 'Nublado', rain: 'Lluvia', storm: 'Tormenta',
};

// WMO weather codes (Open-Meteo) → tipo visual
function wxFromCode(code: number): WeatherKind {
  if (code >= 95) return 'storm';                              // tormenta
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 86)) return 'rain'; // llovizna/lluvia/nieve
  if (code >= 2) return 'cloudy';                              // nuboso / niebla (45,48)
  return 'clear';                                              // despejado / mayormente despejado
}

interface Props {
  units: CCUnit[];
  selectedId: string | null;
  onSelect: (u: CCUnit) => void;
  flashId?: string | null;
  mode: Mode;
  sector?: string;
  onSectorChange?: (key: string) => void;
  scenario?: Scenario;
}

const LEGEND: { s: VisualStatus; label: string; color: string }[] = [
  { s: 'disponible', label: 'Disponible', color: '#22c55e' },
  { s: 'en_viaje', label: 'En ruta', color: '#38bdf8' },
  { s: 'en_taller', label: 'En taller', color: '#f59e0b' },
  { s: 'mantenimiento_proximo', label: 'Mant. próximo', color: '#eab308' },
  { s: 'fuera_servicio', label: 'Fuera de servicio', color: '#ef4444' },
  { s: 'inactiva', label: 'Inactiva', color: '#64748b' },
];

export default function Scene3D({ units, selectedId, onSelect, flashId, mode, sector: sectorProp, onSectorChange, scenario }: Props) {
  const S = scenario ?? genericScenario;
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<FleetWorld | null>(null);
  const unitsRef = useRef(units);
  const onSelectRef = useRef(onSelect);
  const onSectorChangeRef = useRef(onSectorChange);
  const lastMode = useRef<Mode>(mode);
  const firstLoad = useRef(true);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sectorLocal, setSectorLocal] = useState(sectorProp ?? 'general');
  const [dayNight, setDayNight] = useState<DayNight>('auto');
  const [ambientOn, setAmbientOn] = useState(true);
  const [weather, setWeather] = useState<WeatherSel>('auto');
  const [autoWx, setAutoWx] = useState<WeatherKind | null>(null);
  const [wxIsDay, setWxIsDay] = useState<boolean | null>(null);
  const sector = sectorProp ?? sectorLocal;

  unitsRef.current = units;
  onSelectRef.current = onSelect;
  onSectorChangeRef.current = onSectorChange;

  useEffect(() => {
    let alive = true;
    let world: FleetWorld | null = null;
    (async () => {
      try {
        const { FleetWorld } = await import('./world/FleetWorld');
        if (!alive || !hostRef.current) return;
        world = new FleetWorld(hostRef.current, {
          scenario: S,
          onSelect: (id) => {
            const u = unitsRef.current.find((x) => x.id === id);
            if (u) onSelectRef.current(u);
          },
          // Click sobre la nave del taller = botón de sector TALLER
          onBuildingClick: (key) => {
            if (key !== 'taller') return;
            setSectorLocal('taller');
            onSectorChangeRef.current?.('taller');
            worldRef.current?.focusSector('taller');
          },
          onProgress: (p) => alive && setProgress(p),
        });
        worldRef.current = world;
        await world.init();
        if (!alive) return;
        setReady(true);
      } catch (e: any) {
        console.error('[CentroControl] WebGL', e);
        if (alive) setError('No se pudo iniciar la vista 3D en este navegador (WebGL no disponible).');
      }
    })();
    return () => {
      alive = false;
      world?.dispose();
      worldRef.current = null;
    };
  }, []);

  // Datos → mundo. Las animaciones de traslado se disparan solo por
  // cambios de estado posteriores a la carga inicial.
  useEffect(() => {
    const w = worldRef.current;
    if (!w) return;
    const modeChanged = lastMode.current !== mode;
    lastMode.current = mode;
    const animate = !firstLoad.current && !modeChanged;
    if (units.length) firstLoad.current = false;
    w.setUnits(units, animate);
  }, [units, mode, ready]);

  useEffect(() => { worldRef.current?.setSelected(selectedId); }, [selectedId, ready]);
  useEffect(() => { worldRef.current?.setFlash(flashId ?? null); }, [flashId, ready]);

  // Clima automático: Open-Meteo (sin API key) en la ubicación del navegador
  // o, si no hay geolocalización, la del predio. Re-consulta cada 10 min.
  useEffect(() => {
    if (weather !== 'auto') { worldRef.current?.setWeather(weather); return; }
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const fetchWx = async (lat: number, lon: number) => {
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,is_day&timezone=auto`);
        if (!r.ok) return;
        const j = await r.json();
        if (!alive) return;
        const kind = wxFromCode(j?.current?.weather_code ?? 0);
        setAutoWx(kind);
        setWxIsDay(j?.current?.is_day === 1 ? true : j?.current?.is_day === 0 ? false : null);
        worldRef.current?.setWeather(kind);
      } catch { /* offline: conserva el último estado */ }
    };
    const start = (lat: number, lon: number) => {
      fetchWx(lat, lon);
      timer = setInterval(() => fetchWx(lat, lon), 10 * 60_000);
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => { if (alive) start(p.coords.latitude, p.coords.longitude); },
        () => { if (alive) start(YARD_COORDS.lat, YARD_COORDS.lon); },
        { timeout: 5000, maximumAge: 30 * 60_000 },
      );
    } else start(YARD_COORDS.lat, YARD_COORDS.lon);
    return () => { alive = false; if (timer) clearInterval(timer); };
  }, [weather, ready]);

  // Día/Noche/Automático — auto usa is_day de Open-Meteo si ya llegó;
  // si no, la hora local del navegador del operador.
  useEffect(() => {
    const apply = () => {
      const night = dayNight === 'night' || (dayNight === 'auto' && (wxIsDay != null ? !wxIsDay : (() => { const h = new Date().getHours(); return h < 7 || h >= 20; })()));
      worldRef.current?.setDayNight(night ? 'night' : 'day');
    };
    apply();
    if (dayNight !== 'auto') return;
    const t = setInterval(apply, 60_000);
    return () => clearInterval(t);
  }, [dayNight, ready, wxIsDay]);

  useEffect(() => { worldRef.current?.setAmbient(ambientOn); }, [ambientOn, ready]);

  const go = (key: string) => {
    setSectorLocal(key);
    onSectorChange?.(key);
    worldRef.current?.focusSector(key);
  };

  return (
    <div className="cc3-wrap">
      <div ref={hostRef} className="cc3-host" />

      {!ready && !error && (
        <div className="cc3-loading" role="status" aria-live="polite">
          <div className="cc3-loading-bar"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <small>Cargando predio 3D… {Math.round(progress * 100)}%</small>
        </div>
      )}
      {error && <div className="cc3-loading" role="alert"><small>{error}</small></div>}

      {/* Navegación por sectores */}
      <nav className="cc3-sectors" aria-label="Sectores del predio">
        {S.sectors.map((s) => (
          <button key={s.key} className={sector === s.key ? 'on' : ''} onClick={() => go(s.key)}>{s.label}</button>
        ))}
      </nav>

      <div className="cc3-zoom" role="group" aria-label="Zoom">
        <button onClick={() => worldRef.current?.zoomBy(1.4)} aria-label="Acercar"><Plus size={14} /></button>
        <button onClick={() => worldRef.current?.zoomBy(1 / 1.4)} aria-label="Alejar"><Minus size={14} /></button>
        <button onClick={() => go('general')} aria-label="Vista general"><Maximize2 size={13} /></button>
      </div>

      {/* Iluminación y ambientación */}
      <div className="cc3-topbar">
        <div className="cc3-dn" role="group" aria-label="Iluminación">
          {([
            { k: 'day' as DayNight, icon: Sun, label: 'Día' },
            { k: 'night' as DayNight, icon: Moon, label: 'Noche' },
            { k: 'auto' as DayNight, icon: Clock3, label: 'Auto' },
          ]).map(({ k, icon: Icon, label }) => (
            <button key={k} className={dayNight === k ? 'on' : ''} onClick={() => setDayNight(k)}
              aria-label={`Iluminación ${label}`} title={label} aria-pressed={dayNight === k}><Icon size={13} /></button>
          ))}
          <button className={ambientOn ? 'on' : ''} onClick={() => setAmbientOn((v) => !v)}
            aria-label="Ambientación animada" aria-pressed={ambientOn}
            title={ambientOn ? 'Ambientación activa' : 'Ambientación pausada'}><Sparkles size={13} /></button>
        </div>

        {/* Clima: Auto (Open-Meteo) o manual */}
        <div className="cc3-wx" role="group" aria-label="Clima">
          {([
            { k: 'auto' as WeatherSel, icon: CloudSun, label: autoWx ? `Auto · ${WX_LABEL[autoWx]}` : 'Clima auto' },
            { k: 'clear' as WeatherSel, icon: Sun, label: 'Despejado' },
            { k: 'cloudy' as WeatherSel, icon: Cloudy, label: 'Nublado' },
            { k: 'rain' as WeatherSel, icon: CloudRain, label: 'Lluvia' },
            { k: 'storm' as WeatherSel, icon: CloudLightning, label: 'Tormenta' },
          ]).map(({ k, icon: Icon, label }) => (
            <button key={k} className={weather === k ? 'on' : ''} onClick={() => setWeather(k)}
              aria-label={`Clima ${label}`} title={label} aria-pressed={weather === k}><Icon size={13} /></button>
          ))}
          {weather === 'auto' && autoWx && <span className="cc3-wx-cur" title="Clima detectado (Open-Meteo)">{WX_LABEL[autoWx]}</span>}
        </div>
      </div>

      <div className="cc3-legend" aria-label="Referencias de estado">
        {LEGEND.map((l) => (
          <span key={l.s}><i style={{ background: l.color }} />{l.label}</span>
        ))}
        <small>
          {mode === 'real'
            ? 'Posiciones según estado compuesto real · sin GPS. Autoelevadores y personal: ambientación.'
            : 'Simulación de demostración.'}
        </small>
      </div>

      {/* Alternativa accesible por teclado */}
      <ul className="cc3-sr" aria-label="Unidades en el mapa">
        {units.map((u) => (
          <li key={u.id}>
            <button onClick={() => onSelect(u)} aria-pressed={selectedId === u.id}>
              {u.dominio} — {u.statusLabel}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
