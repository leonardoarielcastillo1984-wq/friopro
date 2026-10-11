'use client';

// ============================================================
// Paneles del Centro de Control: KPIs, eventos, detalle, rutas
// ============================================================
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Truck, Wrench, AlertTriangle, CalendarClock, CheckCircle2,
  DollarSign, MapPin, Activity, ScanLine, Ban, ExternalLink,
  ClipboardCheck, Cpu, Gauge, History, Boxes,
} from 'lucide-react';
import type { CCEvent, CCUnit, Kpis } from './types';
import type { Scenario } from './world/layout-core';

const fmt = (n?: number | null) => n == null ? '—' : n.toLocaleString('es-AR');
const fmtMoney = (n?: number | null) =>
  n == null ? '—' : `$ ${Math.round(n / 1000)}k`;

// ── Contador animado ──
function AnimatedNumber({ value }: { value: number | null }) {
  return <span className="cc-kpi-num">{fmt(value)}</span>;
}

export function KpiBar({ kpis, onOpen }: { kpis: Kpis; onOpen: (f: string) => void }) {
  const items = [
    { key: 'total', label: 'Flota', value: kpis.total, icon: Truck, tone: '#38bdf8', sub: `${fmt(kpis.operativos)} operativas` },
    { key: 'disp', label: 'Disponibilidad', value: kpis.pctDisponible, icon: CheckCircle2, tone: '#22c55e', sub: '%', suffix: '%' },
    { key: 'viaje', label: 'En servicio', value: kpis.enViaje, icon: MapPin, tone: '#38bdf8', sub: 'unidades' },
    { key: 'taller', label: 'En taller', value: kpis.enTaller, icon: Wrench, tone: '#f59e0b', sub: 'unidades' },
    { key: 'fuera', label: 'Fuera servicio', value: kpis.fueraServicio, icon: Ban, tone: '#ef4444', sub: 'unidades' },
    { key: 'mant', label: 'Servicios', value: kpis.mantProximos, icon: CalendarClock, tone: '#eab308', sub: 'alertas' },
    { key: 'insp', label: 'Incidencias', value: kpis.incidencias, icon: AlertTriangle, tone: '#fb923c', sub: 'abiertas' },
  ];

  return (
    <div className="cc-kpi-bar" role="region" aria-label="Indicadores de flota">
      {items.map(({ key, label, value, icon: Icon, tone, sub, suffix }) => (
        <button key={key} className="cc-kpi" onClick={() => onOpen(key)} aria-label={`${label}: ${value ?? 'sin datos'}`}>
          <Icon className="cc-kpi-icon" style={{ color: tone }} aria-hidden="true" />
          <span className="cc-kpi-body">
            <AnimatedNumber value={value} />
            {suffix && <span className="cc-kpi-suffix">{suffix}</span>}
            <span className="cc-kpi-label">{label}</span>
          </span>
          <span className="cc-kpi-sub">{sub}</span>
        </button>
      ))}
      <button className="cc-kpi cc-kpi-wide" onClick={() => onOpen('costos')}>
        <DollarSign className="cc-kpi-icon" style={{ color: '#4ade80' }} aria-hidden="true" />
        <span className="cc-kpi-body">
          <span className="cc-kpi-num">{fmtMoney(kpis.costoMes)}</span>
          <span className="cc-kpi-label">Costo del mes</span>
        </span>
        <span className="cc-kpi-sub">comb + mant + neum</span>
      </button>
    </div>
  );
}

// ── Feed de eventos ──
const LEVEL_DOT: Record<CCEvent['level'], string> = {
  critica: '#ef4444',
  advertencia: '#eab308',
  info: '#38bdf8',
  exito: '#22c55e',
};

export function EventsPanel({ events, onSelectUnit }: {
  events: CCEvent[];
  onSelectUnit: (unidadId: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // autoscroll al tope cuando entra un evento nuevo
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [events[0]?.id]);

  return (
    <aside className="cc-events" aria-label="Actividad operativa">
      <header className="cc-panel-head">
        <Activity size={14} aria-hidden="true" />
        <h2>ACTIVIDAD OPERATIVA</h2>
        <span className="cc-badge">{events.length}</span>
      </header>
      <div ref={listRef} className="cc-events-list" role="log" aria-live="polite">
        {events.length === 0 && (
          <p className="cc-empty">Sin eventos recientes registrados.</p>
        )}
        {events.map((e) => (
          <button
            key={e.id}
            className={`cc-event cc-event-${e.level} ${e.source === 'demo' ? 'cc-event-demo' : ''}`}
            onClick={() => e.unidadId && onSelectUnit(e.unidadId)}
          >
            <span className="cc-event-dot" style={{ background: LEVEL_DOT[e.level] }} />
            <span className="cc-event-time">
              {new Date(e.at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="cc-event-body">
              {e.unidad && <strong className="cc-event-unit">{e.unidad}</strong>}
              <span className="cc-event-text">{e.text}</span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}

// ── Detalle de unidad ──
const OT_LABEL: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En curso', COMPLETED: 'Completada', CANCELLED: 'Cancelada',
};

export function UnitDetail({ unit, detail, loading }: {
  unit: CCUnit | null;
  detail: any | null;
  loading: boolean;
}) {
  if (!unit) {
    return (
      <section className="cc-unit cc-unit-empty" aria-label="Detalle de unidad">
        <header className="cc-panel-head"><Truck size={14} aria-hidden="true" /><h2>DETALLE DE UNIDAD</h2></header>
        <p className="cc-empty">Seleccioná un camión del mapa para ver su ficha operativa.</p>
      </section>
    );
  }

  const v = detail?.vehiculo;
  const mant = detail?.mantenimiento;
  const k = mant?.kpis;
  const asset = mant?.asset;
  const otsAbiertas: any[] = (mant?.workOrders ?? []).filter((o: any) => ['PENDING', 'IN_PROGRESS'].includes(o.status));
  const predicciones: any[] = mant?.predictions ?? [];
  const kmActual = unit.currentOdometer ?? v?.currentOdometer ?? asset?.currentOdometer;
  const costoKm = kmActual && k?.costoTotalMantenimiento ? Math.round(k.costoTotalMantenimiento / kmActual) : null;
  const ficha = `/flota-360/vehiculos/${unit.id}`;

  return (
    <section className="cc-unit" aria-label={`Detalle de unidad ${unit.dominio}`}>
      <header className="cc-panel-head">
        <Truck size={14} aria-hidden="true" />
        <h2>UNIDAD {unit.dominio}</h2>
        <span className={`cc-status-pill cc-st-${unit.status}`}>{unit.statusLabel}</span>
      </header>

      <div className="cc-unit-body">
        <dl className="cc-kv">
          <div><dt>Vehículo</dt><dd>{[v?.marca, v?.modelo, v?.anio].filter(Boolean).join(' ') || unit.tipo}</dd></div>
          <div><dt>Conductor</dt><dd>{unit.conductor ?? v?.conductor?.nombre ?? 'Sin asignar'}</dd></div>
          <div><dt>Km actuales</dt><dd>{fmt(kmActual)}</dd></div>
          <div><dt>Últ. mantenimiento</dt><dd>{k?.ultimaFechaMantenimiento ? new Date(k.ultimaFechaMantenimiento).toLocaleDateString('es-AR') : '—'}</dd></div>
          <div><dt>Próximo service</dt><dd>{k?.proximaFechaMantenimiento ? new Date(k.proximaFechaMantenimiento).toLocaleDateString('es-AR') : '—'}</dd></div>
          <div><dt>OTs abiertas</dt><dd>{loading ? '…' : k ? `${k.otsPendientes} de ${k.otsTotal}` : 'Sin datos'}</dd></div>
          <div><dt>Costo mant./km</dt><dd>{costoKm != null ? `$${fmt(costoKm)}` : '—'}</dd></div>
        </dl>

        {loading && <p className="cc-unit-sub">Cargando ficha…</p>}
        {!loading && unit.source === 'real' && !detail && <p className="cc-unit-sub">Sin ficha de mantenimiento disponible.</p>}

        {otsAbiertas.length > 0 && (
          <ul className="cc-unit-ots">
            {otsAbiertas.slice(0, 3).map((o) => (
              <li key={o.id}>
                <Wrench size={10} aria-hidden="true" />
                <span className="cc-unit-ot-txt">{o.code ? `${o.code} · ` : ''}{o.title ?? 'Orden de trabajo'}</span>
                <em>{OT_LABEL[o.status] ?? o.status}</em>
              </li>
            ))}
          </ul>
        )}

        {predicciones.length > 0 && (
          <ul className="cc-unit-ots cc-unit-pred">
            {predicciones.slice(0, 2).map((p, i) => (
              <li key={p.id ?? i}>
                <Cpu size={10} aria-hidden="true" />
                <span className="cc-unit-ot-txt">{p.componentLabel ?? p.componente ?? p.title ?? 'Componente'}</span>
                <em>{Math.round((p.probabilidad ?? 0) * 100)}%</em>
              </li>
            ))}
          </ul>
        )}

        {unit.alerts.length > 0 && (
          <ul className="cc-unit-alerts">
            {unit.alerts.slice(0, 3).map((a, i) => <li key={i}><AlertTriangle size={11} aria-hidden="true" /> {a}</li>)}
          </ul>
        )}
      </div>

      <nav className="cc-unit-actions" aria-label="Acciones de la unidad">
        <Link href={ficha}><ExternalLink size={11} /> Ficha</Link>
        <Link href={`/flota-360/ordenes?vehiculoId=${unit.id}`}><Wrench size={11} /> Órdenes</Link>
        <Link href={`/flota-360/inspecciones?vehiculoId=${unit.id}`}><ClipboardCheck size={11} /> Checklists</Link>
        <Link href={ficha}><History size={11} /> Historial</Link>
        <Link href={ficha} className="cc-act-gemelo"><Gauge size={11} /> Gemelo digital</Link>
      </nav>
    </section>
  );
}

// ── KPIs por sector (experiencia ejecutiva) ──
const SECTOR_KPIS: Record<string, { title: string; metrics: (units: CCUnit[], kpis: Kpis | null) => { label: string; value: string }[] }> = {
  taller: {
    title: 'Taller',
    metrics: (units) => {
      const enTaller = units.filter((u) => u.status === 'en_taller');
      const vencidos = units.filter((u) => u.alerts.some((a) => /vencid/i.test(a)));
      return [
        { label: 'Inmovilizadas', value: `${enTaller.length}` },
        { label: 'Mant. vencidos', value: vencidos.length ? `${vencidos.length}` : '0' },
        { label: 'Tiempo prom. en taller', value: 'Sin datos' },
      ];
    },
  },
  parking: {
    title: 'Estacionamiento',
    metrics: (units) => [
      { label: 'Disponibles', value: `${units.filter((u) => u.status === 'disponible').length}` },
      { label: 'Mant. próximos', value: `${units.filter((u) => u.status === 'mantenimiento_proximo').length}` },
      { label: 'Inactivas', value: `${units.filter((u) => u.status === 'inactiva').length}` },
    ],
  },
  deposito: {
    title: 'Depósito y muelles',
    metrics: (units) => {
      const semis = units.filter((u) => u.status === 'disponible' && /SEMI|ACOPLADO|REMOLQUE/i.test(u.tipo));
      return [
        { label: 'Semis en muelles', value: `${semis.length}` },
        { label: 'Unidades en predio', value: `${units.filter((u) => u.status !== 'en_viaje').length}` },
      ];
    },
  },
  hold: {
    title: 'Fuera de servicio',
    metrics: (units) => [
      { label: 'Restringidas', value: `${units.filter((u) => u.status === 'fuera_servicio').length}` },
      { label: 'Con falla crítica', value: `${units.filter((u) => u.alerts.some((a) => /cr[ií]tic/i.test(a))).length}` },
    ],
  },
  acceso: {
    title: 'Acceso y ruta',
    metrics: (units, kpis) => [
      { label: 'En servicio (jornada)', value: `${units.filter((u) => u.status === 'en_viaje').length}` },
      { label: 'Incidencias', value: kpis?.incidencias != null ? `${kpis.incidencias}` : 'Sin datos' },
      { label: 'Disponibilidad flota', value: kpis?.pctDisponible != null ? `${kpis.pctDisponible}%` : 'Sin datos' },
    ],
  },
  // ── Sectores del predio DADA ──
  garita: {
    title: 'Garita y acceso',
    metrics: (units, kpis) => [
      { label: 'En servicio (jornada)', value: `${units.filter((u) => u.status === 'en_viaje').length}` },
      { label: 'Incidencias', value: kpis?.incidencias != null ? `${kpis.incidencias}` : 'Sin datos' },
      { label: 'Disponibilidad flota', value: kpis?.pctDisponible != null ? `${kpis.pctDisponible}%` : 'Sin datos' },
    ],
  },
  livianos: {
    title: 'Lavadero',
    metrics: (units) => [
      { label: 'En cola / lavado', value: `${units.filter((u) => u.status === 'disponible' && /PICKUP|CAMIONETA|AUTO|LIVIANO/i.test(u.tipo)).length}` },
      { label: 'Livianos en servicio', value: `${units.filter((u) => u.status === 'en_viaje' && /PICKUP|CAMIONETA|AUTO|LIVIANO/i.test(u.tipo)).length}` },
      { label: 'Livianos inmovilizados', value: `${units.filter((u) => /PICKUP|CAMIONETA|AUTO|LIVIANO/i.test(u.tipo) && (u.status === 'en_taller' || u.status === 'fuera_servicio')).length}` },
    ],
  },
};

export function SectorPanel({ sector, units, kpis, scenario }: {
  sector: string;
  units: CCUnit[];
  kpis: Kpis | null;
  scenario?: Scenario;
}) {
  const def = SECTOR_KPIS[sector];
  if (!def || sector === 'general') return null;
  const title = scenario?.sectors.find((s) => s.key === sector)?.label ?? def.title;
  const items = def.metrics(units, kpis);
  return (
    <div className="cc-sector-kpis" role="region" aria-label={`Indicadores de ${title}`}>
      <header><Boxes size={11} aria-hidden="true" /><span>{title}</span></header>
      <dl>
        {items.map((m) => (
          <div key={m.label}>
            <dt>{m.label}</dt>
            <dd className={m.value === 'Sin datos' ? 'is-na' : ''}>{m.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ── Mapa de rutas (Argentina simplificada) ──
const CITIES = [
  { name: 'Córdoba', x: 38, y: 46 },
  { name: 'Santa Fe', x: 52, y: 42 },
  { name: 'Rosario', x: 55, y: 55 },
  { name: 'Buenos Aires', x: 66, y: 68 },
];

export function RouteMap({ units, onSelectUnit }: {
  units: CCUnit[];
  onSelectUnit: (id: string) => void;
}) {
  const viajando = units.filter((u) => u.status === 'en_viaje');
  return (
    <section className="cc-routes" aria-label="Mapa de rutas">
      <header className="cc-panel-head">
        <MapPin size={14} aria-hidden="true" />
        <h2>MAPA DE RUTAS</h2>
        <span className="cc-badge">{viajando.length} en servicio</span>
      </header>
      <div className="cc-routes-body">
        <svg viewBox="0 0 120 100" className="cc-arg-map" role="img" aria-label="Mapa esquemático de Argentina">
          {/* silueta esquemática */}
          <path d="M35 8 L55 12 L62 22 L58 34 L66 46 L72 58 L76 70 L68 82 L58 90 L52 82 L46 74 L40 62 L34 50 L30 38 L28 24 Z"
            fill="#12385c" stroke="#2563eb" strokeWidth="0.8" opacity="0.85" />
          {CITIES.map((c) => (
            <g key={c.name}>
              <circle cx={c.x} cy={c.y} r="1.8" fill="#60a5fa" />
              <text x={c.x + 3} y={c.y + 1.5} fontSize="4.4" fill="#93c5fd">{c.name}</text>
            </g>
          ))}
          {/* unidades en servicio: posición indicativa sobre la red vial central */}
          {viajando.slice(0, 8).map((u, i) => {
            const cx = 44 + (i % 3) * 9 + (i * 3.7) % 6;
            const cy = 34 + (i * 11) % 36;
            return (
              <g key={u.id} className="cc-route-unit" onClick={() => onSelectUnit(u.id)}>
                <circle cx={cx} cy={cy} r="4.4" fill="#38bdf8" opacity="0.22">
                  <animate attributeName="r" values="3.4;5.4;3.4" dur="2.2s" repeatCount="indefinite" />
                </circle>
                <circle cx={cx} cy={cy} r="2.2" fill="#38bdf8" stroke="#0c4a6e" strokeWidth="0.6" />
              </g>
            );
          })}
        </svg>
        <div className="cc-routes-side">
          {viajando.length === 0 && (
            <p className="cc-empty">Sin unidades en servicio. Sin GPS: se muestran jornadas abiertas reportadas.</p>
          )}
          {viajando.slice(0, 8).map((u) => (
            <button key={u.id} className="cc-route-row" onClick={() => onSelectUnit(u.id)}>
              <span className="cc-route-plate">{u.dominio}</span>
              <span className="cc-route-meta">{u.conductor ?? 'sin conductor'} · jornada abierta</span>
            </button>
          ))}
        </div>
      </div>
      <p className="cc-routes-note">
        <ScanLine size={10} aria-hidden="true" /> Sin GPS — posiciones según jornada/servicio reportado, no telemetría.
      </p>
    </section>
  );
}
