'use client';

// ============================================================
// Panel del Taller Inteligente: KPIs interactivos, pestañas
// operativas (Órdenes / Planificación / Mecánicos / Repuestos /
// Inmovilizaciones / Costos / Indicadores), modo ATENCIÓN
// REQUERIDA y ficha de OT con acciones sobre flujos existentes.
// ============================================================
import { useMemo, useState } from 'react';
import {
  Wrench, AlertTriangle, Package, Clock3, DollarSign, Users,
  Activity, X, ChevronRight, ExternalLink, Filter,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type {
  TallerSnapshot, TallerOT, TallerEpisodio, TallerMecanico, TallerRepuestoPend,
} from './taller-types';
import { ETAPA_LABEL, buildTallerAlertas } from './taller-types';

type Tab = 'ordenes' | 'mecanicos' | 'repuestos' | 'inmovilizaciones' | 'costos' | 'indicadores';
type KpiFilter = 'all' | 'taller' | 'inmov' | 'abiertas' | 'ejecucion' | 'pendientes' | 'urgentes' | 'repuestos';

interface Props {
  snapshot: TallerSnapshot;
  mode: 'real' | 'demo';
  attention: boolean;
  onToggleAttention: () => void;
  onSelectUnit: (id: string) => void;
  onFocusBay?: (key: string) => void;
  onChanged?: () => void;
  onClose?: () => void;
}

const OT_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pendiente', cls: 'st-pend' },
  IN_PROGRESS: { label: 'En ejecución', cls: 'st-prog' },
  ON_HOLD: { label: 'En espera', cls: 'st-hold' },
  COMPLETED: { label: 'Finalizada', cls: 'st-done' },
};
const OT_PRIO: Record<string, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica' };
const OT_TYPE: Record<string, string> = { PREVENTIVE: 'Preventivo', CORRECTIVE: 'Correctivo', PREDICTIVE: 'Predictivo', EMERGENCY: 'Emergencia' };

const fmt$ = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
const fmtDate = (s?: string | null) => s ? new Date(s).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—';
const fmtH = (h: number | null | undefined) => h == null ? '—' : h >= 24 ? `${(h / 24).toFixed(1)} d` : `${h.toFixed(1)} h`;
const daysBetween = (a?: string | null, b?: string | null) => {
  if (!a || !b) return null;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400e3));
};

export default function TallerPanel({ snapshot, mode, attention, onToggleAttention, onSelectUnit, onFocusBay, onChanged, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('ordenes');
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>('all');
  const [umbral, setUmbral] = useState(3);
  const [otSel, setOtSel] = useState<TallerOT | null>(null);
  const [mecSel, setMecSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const k = snapshot.kpis;
  const alertas = useMemo(() => buildTallerAlertas(snapshot), [snapshot]);
  const alertUnitIds = useMemo(() => new Set(alertas.filter((a) => a.unidadId).map((a) => a.unidadId!)), [alertas]);

  const otsFiltradas = useMemo(() => {
    switch (kpiFilter) {
      case 'ejecucion': return snapshot.ots.filter((o) => o.status === 'IN_PROGRESS');
      case 'pendientes': return snapshot.ots.filter((o) => o.status === 'PENDING');
      case 'urgentes': return snapshot.ots.filter((o) => ['HIGH', 'CRITICAL'].includes(o.priority));
      case 'repuestos': return snapshot.ots.filter((o) => o.repuestos.some((r) => r.falta));
      case 'inmov': return snapshot.ots.filter((o) => o.vehiculoId && snapshot.episodios.some((e) => e.vehiculoId === o.vehiculoId));
      default: return snapshot.ots;
    }
  }, [snapshot, kpiFilter]);

  const episodiosFiltrados = useMemo(() =>
    [...snapshot.episodios].filter((e) => e.dias >= umbral).sort((a, b) => b.dias - a.dias),
    [snapshot, umbral]);

  // Acciones de OT → endpoints existentes (sin flujo paralelo)
  const otAction = async (ot: TallerOT, accion: 'status' | 'derivar', payload: any) => {
    if (mode === 'demo') { setMsg('Modo DEMO: las acciones no modifican datos reales.'); return; }
    setBusy(true); setMsg(null);
    try {
      if (accion === 'status') {
        await apiFetch(`/maintenance/work-orders/${ot.id}`, { method: 'PUT', json: payload });
      } else {
        await apiFetch(`/flota/ots/${ot.id}/derivar`, { method: 'POST', json: payload });
      }
      setOtSel(null);
      onChanged?.();
    } catch (e: any) {
      setMsg(e?.message || 'La acción fue rechazada por el servidor');
    } finally { setBusy(false); }
  };

  const kpis: { key: KpiFilter; label: string; value: string | number; warn?: boolean }[] = [
    { key: 'taller', label: 'En taller', value: k.unidadesEnTaller },
    { key: 'inmov', label: 'Inmovilizadas', value: k.unidadesInmovilizadas, warn: k.unidadesInmovilizadas > 0 },
    { key: 'abiertas', label: 'OTs abiertas', value: k.otsAbiertas },
    { key: 'ejecucion', label: 'En ejecución', value: k.otsEnEjecucion },
    { key: 'pendientes', label: 'Pendientes', value: k.otsPendientes },
    { key: 'urgentes', label: 'Urgentes', value: k.otsUrgentes, warn: k.otsUrgentes > 0 },
    { key: 'repuestos', label: 'Rep. faltantes', value: k.repuestosFaltantes, warn: k.repuestosFaltantes > 0 },
  ];

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'ordenes', label: 'Órdenes', icon: Wrench },
    { key: 'mecanicos', label: 'Mecánicos', icon: Users },
    { key: 'repuestos', label: 'Repuestos', icon: Package },
    { key: 'inmovilizaciones', label: 'Inmovilizaciones', icon: Clock3 },
    { key: 'costos', label: 'Costos', icon: DollarSign },
    { key: 'indicadores', label: 'Indicadores', icon: Activity },
  ];

  return (
    <div className="cctaller">
      {/* Barra superior: KPIs + atención requerida */}
      <div className="cct-kpis">
        <div className="cct-kpi-list">
          {kpis.map((p) => (
            <button key={p.key}
              className={`cct-kpi ${kpiFilter === p.key ? 'on' : ''} ${p.warn ? 'warn' : ''}`}
              onClick={() => setKpiFilter(kpiFilter === p.key ? 'all' : p.key)}
              title={`Filtrar por ${p.label}`}>
              <b>{p.value}</b><span>{p.label}</span>
            </button>
          ))}
        </div>
        <div className="cct-kpi-side">
          <button className={`cct-attention ${attention ? 'on' : ''}`} onClick={onToggleAttention}
            title="Destacar urgencias, bloqueos, repuestos faltantes e inmovilizaciones prolongadas">
            <AlertTriangle size={13} /> ATENCIÓN REQUERIDA{attention ? ` · ${alertas.length}` : ''}
          </button>
          {onClose && <button className="cct-close" onClick={onClose} aria-label="Cerrar panel del taller"><X size={14} /></button>}
        </div>
      </div>

      {attention && (
        <div className="cct-attlist">
          {alertas.slice(0, 10).map((a, i) => (
            <button key={i} className={`cct-att-item ${a.sev}`}
              onClick={() => a.unidadId && onSelectUnit(a.unidadId)}>
              <i />{a.dominio ?? a.otCode ?? '—'} <span>{a.motivo}</span>
            </button>
          ))}
          {!alertas.length && <div className="cct-empty">Sin problemas activos.</div>}
        </div>
      )}

      {msg && <div className="cct-msg" role="status">{msg}</div>}

      {/* Pestañas */}
      <nav className="cct-tabs">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>
            <Icon size={13} />{label}
          </button>
        ))}
      </nav>

      <div className="cct-body">
        {tab === 'ordenes' && (
          <div className="cct-list">
            {otsFiltradas.map((o) => (
              <button key={o.id} className={`cct-row ${otSel?.id === o.id ? 'on' : ''}`} onClick={() => setOtSel(otSel?.id === o.id ? null : o)}>
                <div className="cct-row-main">
                  <b>{o.code}</b>
                  <span className={`cct-st ${OT_STATUS[o.status]?.cls ?? ''}`}>{OT_STATUS[o.status]?.label ?? o.status}</span>
                  <span className={`cct-prio p${o.priority}`}>{OT_PRIO[o.priority] ?? o.priority}</span>
                </div>
                <div className="cct-row-sub">
                  <span>{o.title}</span>
                  {o.vehiculo && <button className="cct-link" onClick={(e) => { e.stopPropagation(); o.vehiculoId && onSelectUnit(o.vehiculoId); }}>{o.vehiculo}</button>}
                </div>
                <div className="cct-row-sub dim">
                  {o.type && <span>{OT_TYPE[o.type] ?? o.type}</span>}
                  {o.tecnico ? <span>· {o.tecnico.name}</span> : <span className="warn">· sin mecánico</span>}
                  {o.repuestos.some((r) => r.falta) && <span className="warn">· faltan repuestos</span>}
                  {o.tareas.total > 0 && <span>· {o.tareas.completadas}/{o.tareas.total} tareas</span>}
                </div>
              </button>
            ))}
            {!otsFiltradas.length && <div className="cct-empty">Sin órdenes en este filtro.</div>}
          </div>
        )}

        {tab === 'mecanicos' && (
          <div className="cct-list">
            {snapshot.mecanicos.map((m) => (
              <button key={m.id} className={`cct-row ${mecSel === m.id ? 'on' : ''}`} onClick={() => setMecSel(mecSel === m.id ? null : m.id)}>
                <div className="cct-row-main">
                  <b>{m.name}</b>
                  <span className={`cct-st ${m.availabilityStatus === 'AVAILABLE' ? 'st-done' : m.availabilityStatus === 'BUSY' ? 'st-prog' : 'st-hold'}`}>
                    {m.availabilityStatus === 'AVAILABLE' ? 'Disponible' : m.availabilityStatus === 'BUSY' ? 'Ocupado' : 'No disponible'}
                  </span>
                </div>
                <div className="cct-row-sub dim">
                  {m.specialization && <span>{m.specialization} · </span>}
                  <span>{m.otsActivas} en curso · {m.otsPendientes} pendientes · {m.dailyCapacityHours}h/día ref.</span>
                </div>
                {mecSel === m.id && m.ordenes.length > 0 && (
                  <div className="cct-sublist">
                    {m.ordenes.map((o) => (
                      <div key={o.id} className="cct-subitem">
                        <b>{o.code}</b> {o.title}
                        <span className={`cct-st ${OT_STATUS[o.status]?.cls ?? ''}`}>{OT_STATUS[o.status]?.label ?? o.status}</span>
                      </div>
                    ))}
                  </div>
                )}
                {mecSel === m.id && !m.ordenes.length && <div className="cct-sublist dim">Sin órdenes asignadas abiertas.</div>}
              </button>
            ))}
            {!snapshot.mecanicos.length && <div className="cct-empty">Sin mecánicos registrados en Flota 360.</div>}
          </div>
        )}

        {tab === 'repuestos' && (
          <div className="cct-list">
            {snapshot.repuestosPendientes.map((r, i) => (
              <div key={i} className={`cct-row ${r.falta ? 'alert' : ''}`}>
                <div className="cct-row-main">
                  <b>{r.repuesto}</b>
                  <span className={`cct-st ${r.falta ? 'st-hold' : 'st-pend'}`}>{r.falta ? 'Sin stock' : 'Reservado'}</span>
                </div>
                <div className="cct-row-sub dim">
                  <span>OT {r.otCode}</span>
                  {r.vehiculo && <button className="cct-link" onClick={() => r.vehiculoId && onSelectUnit(r.vehiculoId)}>{r.vehiculo}</button>}
                  <span>· req {r.requerido} · stock {r.stock}</span>
                  {r.costoUnit > 0 && <span>· {fmt$(r.costoUnit)} c/u</span>}
                </div>
              </div>
            ))}
            {!snapshot.repuestosPendientes.length && <div className="cct-empty">Sin repuestos comprometidos en OTs abiertas.</div>}
          </div>
        )}

        {tab === 'inmovilizaciones' && (
          <>
            <div className="cct-filter">
              <Filter size={12} />
              {[3, 7, 15, 30].map((d) => (
                <button key={d} className={umbral === d ? 'on' : ''} onClick={() => setUmbral(d)}>+{d}d</button>
              ))}
              <span className="dim">{episodiosFiltrados.length} unidades</span>
            </div>
            <div className="cct-list">
              {episodiosFiltrados.map((e) => (
                <button key={e.id} className={`cct-row ${e.dias >= 15 ? 'alert' : ''}`} onClick={() => onSelectUnit(e.vehiculoId)}>
                  <div className="cct-row-main">
                    <b>{e.dominio ?? '—'}</b>
                    <span className={`cct-st ${e.dias >= 15 ? 'st-hold' : e.dias >= 7 ? 'st-pend' : 'st-prog'}`}>{e.dias} días</span>
                  </div>
                  <div className="cct-row-sub dim">
                    <span>{e.etapa ? (ETAPA_LABEL[e.etapa] ?? e.etapa) : 'Sin etapa'}</span>
                    {e.motivo && <span>· {e.motivo}</span>}
                  </div>
                  <div className="cct-row-sub dim">
                    {e.tallerNombre && <span>{e.tallerNombre} · </span>}
                    {e.tallerTipo && <span>{e.tallerTipo === 'INTERNO' ? 'Taller interno' : 'Taller externo'}</span>}
                    {e.fechaDevolucionEstimada && <span>· est. {fmtDate(e.fechaDevolucionEstimada)}</span>}
                    {e.responsableSeguimientoNombre && <span>· {e.responsableSeguimientoNombre}</span>}
                  </div>
                </button>
              ))}
              {!episodiosFiltrados.length && <div className="cct-empty">Sin unidades inmovilizadas sobre el umbral.</div>}
            </div>
          </>
        )}

        {tab === 'costos' && (
          <div className="cct-list">
            <div className="cct-stat">
              <span>Costo del mes (mantenimiento)</span><b>{fmt$(k.costoMes)}</b>
            </div>
            {Object.entries(snapshot.porTipoCosto).filter(([, v]) => v > 0).map(([t, v]) => (
              <div key={t} className="cct-stat dim">
                <span>{OT_TYPE[t] ?? t}</span><b>{fmt$(v)}</b>
              </div>
            ))}
            <div className="cct-subtitle">Costo por unidad (mes en curso)</div>
            {snapshot.costoPorUnidad.slice(0, 12).map((c) => (
              <button key={c.vehiculoId} className="cct-row" onClick={() => onSelectUnit(c.vehiculoId)}>
                <div className="cct-row-main"><b>{c.dominio ?? '—'}</b><span>{fmt$(c.total)}</span></div>
              </button>
            ))}
            {!snapshot.costoPorUnidad.length && <div className="cct-empty">Sin costos imputados este mes.</div>}
          </div>
        )}

        {tab === 'indicadores' && (
          <div className="cct-list">
            <div className="cct-stat"><span>MTTR (90 días)</span><b>{fmtH(k.mttrHoras)}</b></div>
            <div className="cct-note">Media de horas entre inicio y cierre de OTs de flota completadas en 90 días.</div>
            <div className="cct-stat"><span>Cumplimiento preventivo (90 días)</span><b>{k.cumplimientoPreventivoPct == null ? '—' : `${k.cumplimientoPreventivoPct}%`}</b></div>
            <div className="cct-note">Tareas de plan ejecutadas sobre programadas.</div>
            <div className="cct-stat"><span>Preventivo / Correctivo (90d)</span><b>{k.preventivoVsCorrectivo.preventivo} / {k.preventivoVsCorrectivo.correctivo}</b></div>
            <div className="cct-stat"><span>Trabajos finalizados (90d)</span><b>{k.trabajosFinalizados90d}</b></div>
            <div className="cct-stat"><span>Mecánicos ocupados</span><b>{k.mecanicosOcupados}/{k.mecanicosTotal}</b></div>
            <div className="cct-stat"><span>Mecánicos disponibles</span><b>{k.mecanicosDisponibles}</b></div>
            <div className="cct-note dim">Utilización de bahías y productividad horaria requieren registros de asignación de bahía y horas efectivas — no se presentan como datos reales sin esa fuente.</div>
          </div>
        )}
      </div>

      {/* Ficha de OT con acciones del flujo existente */}
      {otSel && (
        <div className="cct-otcard">
          <div className="cct-ot-head">
            <b>{otSel.code}</b>
            <span className={`cct-st ${OT_STATUS[otSel.status]?.cls ?? ''}`}>{OT_STATUS[otSel.status]?.label}</span>
            <button className="cct-close" onClick={() => setOtSel(null)} aria-label="Cerrar"><X size={13} /></button>
          </div>
          <div className="cct-ot-body">
            <div className="cct-ot-title">{otSel.title}</div>
            <div className="cct-ot-grid">
              <span>Unidad</span><button className="cct-link" onClick={() => otSel.vehiculoId && onSelectUnit(otSel.vehiculoId)}>{otSel.vehiculo ?? otSel.assetNombre ?? '—'}</button>
              <span>Tipo</span><b>{OT_TYPE[otSel.type] ?? otSel.type}</b>
              <span>Prioridad</span><b>{OT_PRIO[otSel.priority] ?? otSel.priority}</b>
              <span>Ejecutor</span><b>{otSel.ejecutorTipo === 'EXTERNO' ? (otSel.taller?.nombre ?? 'Externo') : (otSel.tecnico?.name ?? 'Sin asignar')}</b>
              <span>Ingreso taller</span><b>{fmtDate(otSel.fechaIngresoTaller)}</b>
              <span>Entrega est.</span><b>{fmtDate(otSel.fechaEntregaEstimada)}</b>
              <span>Estimado / real</span><b>{otSel.estimatedDuration ?? '—'}h / {otSel.actualDuration ?? '—'}h</b>
              <span>Tareas plan</span><b>{otSel.tareas.completadas}/{otSel.tareas.total}</b>
            </div>
            {otSel.repuestos.length > 0 && (
              <div className="cct-ot-parts">
                <div className="cct-subtitle">Repuestos</div>
                {otSel.repuestos.map((r) => (
                  <div key={r.id} className={`cct-part ${r.falta ? 'alert' : ''}`}>
                    {r.repuesto ?? 'Repuesto'} — {r.cantidad} u. {r.falta && <span>(stock {r.stock})</span>}
                  </div>
                ))}
              </div>
            )}
            <div className="cct-ot-cost">
              {otSel.laborCost > 0 && <span>MO {fmt$(otSel.laborCost)}</span>}
              {otSel.partsCost > 0 && <span>Repuestos {fmt$(otSel.partsCost)}</span>}
              {otSel.costoExterno > 0 && <span>Externo {fmt$(otSel.costoExterno)}</span>}
              <b>Total {fmt$(otSel.totalCost + otSel.costoExterno)}</b>
            </div>
            <div className="cct-ot-actions">
              {otSel.status === 'PENDING' && otSel.ejecutorTipo === 'INTERNO' && (
                <button disabled={busy} onClick={() => otAction(otSel, 'status', { status: 'IN_PROGRESS' })}>Iniciar trabajo</button>
              )}
              {otSel.status === 'IN_PROGRESS' && (
                <>
                  <button disabled={busy} onClick={() => otAction(otSel, 'status', { status: 'ON_HOLD' })}>Pausar</button>
                  <button disabled={busy} className="primary" onClick={() => otAction(otSel, 'status', { status: 'COMPLETED' })}>Finalizar</button>
                </>
              )}
              {otSel.status === 'ON_HOLD' && (
                <button disabled={busy} onClick={() => otAction(otSel, 'status', { status: 'IN_PROGRESS' })}>Reanudar</button>
              )}
              <a className="cct-linkbtn" href={`/flota-360/ordenes?ot=${otSel.id}`} target="_blank" rel="noreferrer">
                <ExternalLink size={12} /> Abrir en Órdenes
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
