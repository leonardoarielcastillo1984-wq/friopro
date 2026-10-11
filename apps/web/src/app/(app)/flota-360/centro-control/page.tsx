'use client';

// ============================================================
// Flota360 · Centro de Control Operativo
// Gemelo digital visual — modo REAL (API) / modo DEMO (aislado)
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { FlaskConical, Pause, Play, RotateCcw } from 'lucide-react';
import Scene3D from './_components/Scene3D';
import { KpiBar, EventsPanel, UnitDetail, RouteMap, SectorPanel, AlertsPanel } from './_components/Panels';
import { fetchCentroData } from './_components/data';
import { applyDemoTick, advanceRoute, createDemoState, demoKpis } from './_components/DemoEngine';
import type { CCUnit, CCEvent, Kpis, Mode, DemoSpeed } from './_components/types';
import { scenarioForTenant } from './_components/world/scenario';
import Taller3D from './_components/Taller3D';
import TallerPanel from './_components/TallerPanel';
import { fetchTallerResumen, demoTallerSnapshot } from './_components/taller-data';
import { buildTallerAlertas, type TallerSnapshot } from './_components/taller-types';
import './centro.css';

const POLL_MS = 30_000;

export default function CentroControlPage() {
  const { tenant } = useAuth();
  const scenario = useMemo(() => scenarioForTenant(tenant), [tenant]);
  const [mode, setMode] = useState<Mode>('real');
  const [units, setUnits] = useState<CCUnit[]>([]);
  const [events, setEvents] = useState<CCEvent[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [fallidos, setFallidos] = useState<string[]>([]);
  const [selected, setSelected] = useState<CCUnit | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [sector, setSector] = useState('general');
  const [tallerInside, setTallerInside] = useState(false);
  const [tallerSnap, setTallerSnap] = useState<TallerSnapshot | null>(null);
  const [tallerAttention, setTallerAttention] = useState(false);
  const restoreRef = useRef<{ unitId?: string; sector?: string } | null>(null);
  const restored = useRef(false);

  // Restaurar contexto al volver desde ficha/OT/gemelo (misma sesión)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('cc360-context');
      if (raw) restoreRef.current = JSON.parse(raw);
      if (restoreRef.current?.sector) setSector(restoreRef.current.sector);
    } catch { /* sin contexto previo */ }
  }, []);

  // Cuando llegan las unidades, re-seleccionar la que quedó activa
  useEffect(() => {
    if (restored.current || !units.length || !restoreRef.current?.unitId) return;
    restored.current = true;
    const u = units.find((x) => x.id === restoreRef.current!.unitId);
    if (u) onSelectRef.current(u);
  }, [units]);

  // Persistir contexto en cada cambio
  useEffect(() => {
    try { sessionStorage.setItem('cc360-context', JSON.stringify({ unitId: selected?.id, sector })); } catch {}
  }, [selected?.id, sector]);

  // Demo
  const [demoSpeed, setDemoSpeed] = useState<DemoSpeed>(1);
  const [demoPaused, setDemoPaused] = useState(false);
  const demoRef = useRef(createDemoState());

  // ── Modo real: polling ──
  const loadReal = useCallback(async () => {
    try {
      const data = await fetchCentroData();
      setUnits(data.units);
      setEvents(data.events);
      setKpis(data.kpis);
      setFallidos(data.endpointsFallidos);
    } catch {
      setFallidos((f) => [...f, 'fetch']);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode !== 'real') return;
    setLoading(true);
    loadReal();
    const t = setInterval(() => { if (!document.hidden) loadReal(); }, POLL_MS);
    return () => clearInterval(t);
  }, [mode, loadReal]);

  // ── Taller Inteligente: snapshot agregado (REAL) o demo ──
  const inTaller = sector === 'taller' || tallerInside;
  useEffect(() => {
    if (!inTaller) return;
    if (mode === 'demo') { setTallerSnap(demoTallerSnapshot(units)); return; }
    let alive = true;
    fetchTallerResumen().then((s) => { if (alive) setTallerSnap(s); });
    return () => { alive = false; };
  }, [inTaller, mode, units]);

  // ── Modo demo: tick engine ──
  useEffect(() => {
    if (mode !== 'demo') return;
    const s = demoRef.current;
    const apply = () => {
      setUnits([...s.units]);
      setEvents([...s.events]);
      setKpis(demoKpis(s.units));
    };
    apply();
    setLoading(false);

    if (demoPaused) return;
    const interval = 4500 / demoSpeed; // x1: 4.5s, x2: 2.25s, x4: ~1.1s
    const t = setInterval(() => {
      if (document.hidden) return;
      const ev = applyDemoTick(s);
      advanceRoute(s, 1);
      if (ev?.unidadId) {
        setFlashId(ev.unidadId);
        setTimeout(() => setFlashId(null), 2500);
      }
      apply();
    }, interval);
    return () => clearInterval(t);
  }, [mode, demoPaused, demoSpeed]);

  // ── Selección de unidad → ficha real ──
  const onSelectRef = useRef<(u: CCUnit) => void>(() => {});
  const onSelect = useCallback(async (u: CCUnit) => {
    setSelected(u);
    setDetail(null);
    if (u.source !== 'real') return; // demo: sin ficha backend
    setDetailLoading(true);
    try {
      const d = await apiFetch<any>(`/flota/vehiculos/${u.id}/completo`);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);
  onSelectRef.current = onSelect;

  const onSelectById = useCallback((id: string) => {
    const u = units.find((x) => x.id === id);
    if (u) onSelect(u);
  }, [units, onSelect]);

  const resetDemo = () => {
    demoRef.current = createDemoState();
    const s = demoRef.current;
    setUnits([...s.units]);
    setEvents([...s.events]);
    setKpis(demoKpis(s.units));
  };

  return (
    <div className="cc-root">
      {/* header */}
      <header className="cc-header">
        <div className="cc-title">
          <h1>FLOTA<span>360</span></h1>
          <small>Centro de Control Operativo</small>
        </div>

        <div className="cc-mode">
          {mode === 'demo' && (
            <div className="cc-demo-controls" role="group" aria-label="Controles de demostración">
              <button onClick={() => setDemoPaused((p) => !p)} aria-label={demoPaused ? 'Reanudar' : 'Pausar'} title={demoPaused ? 'Reanudar' : 'Pausar'}>
                {demoPaused ? <Play size={12} /> : <Pause size={12} />}
              </button>
              {([1, 2, 4] as DemoSpeed[]).map((v) => (
                <button key={v} onClick={() => setDemoSpeed(v)} className={demoSpeed === v ? 'on' : ''} aria-label={`Velocidad x${v}`}>x{v}</button>
              ))}
              <button onClick={resetDemo} aria-label="Reiniciar demostración" title="Reiniciar"><RotateCcw size={12} /></button>
            </div>
          )}
          <div className="cc-mode-toggle" role="group" aria-label="Modo de datos">
            <button className={mode === 'real' ? 'on' : ''} onClick={() => setMode('real')}>REAL</button>
            <button className={mode === 'demo' ? 'on demo' : ''} onClick={() => setMode('demo')}>DEMO</button>
          </div>
        </div>
      </header>

      {mode === 'demo' && (
        <div className="cc-demo-banner" role="status">
          <FlaskConical size={13} aria-hidden="true" />
          Modo demostración — datos simulados
        </div>
      )}

      {mode === 'real' && fallidos.length > 0 && !loading && (
        <div className="cc-demo-banner" style={{ borderColor: 'rgba(234,179,8,.4)', background: 'rgba(234,179,8,.08)', color: '#fde047' }} role="status">
          Algunos datos no pudieron cargarse ({fallidos.join(', ')}). Los indicadores reflejan solo lo disponible.
        </div>
      )}

      {/* KPIs */}
      {kpis && <KpiBar kpis={kpis} onOpen={() => {}} />}

      {/* main grid */}
      <div className="cc-main">
        <div className="cc-area-map">
          {tallerInside ? (
            <Taller3D
              snapshot={tallerSnap}
              selectedUnitId={selected?.id ?? null}
              attentionIds={tallerAttention && tallerSnap ? new Set(buildTallerAlertas(tallerSnap).map((a) => a.unidadId).filter(Boolean) as string[]) : null}
              onSelectUnit={onSelectById}
              onSelectBay={(key) => {
                const idx = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'].indexOf(key);
                const ocupadas = tallerSnap?.unidadesTaller
                  .filter((u) => u.fechaIngresoTaller || ['EN_TALLER', 'EN_REPARACION'].includes(u.estadoOperativo))
                  .sort((a, b) => (a.fechaIngresoTaller ?? '').localeCompare(b.fechaIngresoTaller ?? '')) ?? [];
                const u = ocupadas[idx];
                if (u) onSelectById(u.id);
              }}
            />
          ) : (
            <Scene3D
              units={units}
              selectedId={selected?.id ?? null}
              onSelect={onSelect}
              flashId={flashId}
              mode={mode}
              sector={sector}
              onSectorChange={setSector}
              scenario={scenario}
            />
          )}
          {!tallerInside && <SectorPanel sector={sector} units={units} kpis={kpis} scenario={scenario} />}
          {inTaller && tallerSnap && (
            <div className="cc-taller-overlay">
              <div className="cc-taller-head">
                <b>TALLER</b>
                <small>{tallerSnap.kpis.unidadesEnTaller} unidades · {tallerSnap.kpis.otsAbiertas} OTs</small>
                <button
                  className="cc-taller-toggle"
                  onClick={() => setTallerInside((v) => !v)}
                >
                  {tallerInside ? '← Volver al predio' : 'Ingresar al taller 3D'}
                </button>
              </div>
              <TallerPanel
                snapshot={tallerSnap}
                mode={mode}
                attention={tallerAttention}
                onToggleAttention={() => setTallerAttention((v) => !v)}
                onSelectUnit={onSelectById}
                onChanged={loadReal}
              />
            </div>
          )}
        </div>
        <aside className="cc-side">
          {selected && <UnitDetail unit={selected} detail={detail} loading={detailLoading} />}
          <AlertsPanel units={units} onSelectUnit={onSelectById} />
          <EventsPanel events={events} onSelectUnit={onSelectById} />
          <RouteMap units={units} onSelectUnit={onSelectById} />
        </aside>
      </div>
    </div>
  );
}
