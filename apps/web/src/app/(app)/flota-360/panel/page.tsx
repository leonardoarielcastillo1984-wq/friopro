'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  LayoutDashboard, Users, TrendingUp, AlertTriangle, CheckCircle2,
  Truck, Wrench, CalendarClock, Disc, FileWarning, AlertOctagon,
  DollarSign, Gauge, Medal, ChevronDown, ChevronUp, Fuel, Pencil, X, Landmark,
} from 'lucide-react';
import { Hint } from '../_components/Hint';

// ═══════════════════════════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════════════════════════

type PanelFlota = {
  kpis: {
    totalUnidades: number; activos: number; enTaller: number; disponibilidad: number | null;
    otsAbiertas: number; otsVencidas: number; planesActivos: number; planesVencidos: number;
    cumplimientoPlanes: number | null; multasPendientes: number; montoMultasPend: number;
    cubiertasCriticas: number; cubiertasBajas: number; incidentesMes: number; docsPorVencer: number;
  };
  situacionFlota?: {
    enServicio: number; disponibleSinServicio: number; enTaller: number;
    noDisponibleOtro: number; restringida: number; inactiva: number; baja: number;
    porEtapa: Record<string, number>;
  };
  alertas: { tipo: string; severidad: string; titulo: string; detalle: string; link: string }[];
};

const ETAPA_LABEL: Record<string, string> = {
  PENDIENTE_INGRESO: 'Pend. ingreso a taller', PENDIENTE_DIAGNOSTICO: 'Pend. diagnóstico',
  ESPERANDO_PRESUPUESTO: 'Esperando presupuesto', ESPERANDO_AUTORIZACION: 'Esperando autorización',
  ESPERANDO_REPUESTO: 'Esperando repuesto', ESPERANDO_PAGO_REPUESTO: 'Esperando pago repuesto',
  ESPERANDO_TURNO_MANO_OBRA: 'Esperando turno/MO', REPARACION_EN_CURSO: 'Reparación en curso',
  PENDIENTE_VERIFICACION: 'Pend. verificación', PENDIENTE_HABILITACION: 'Pend. habilitación',
  OTRO: 'Otro motivo',
};

type ScoreItem = {
  id: string; nombre: string; categoria: string | null; status: string;
  vehiculos: string[]; score: number; rating: string; confianza: string; tendencia: number;
  penalizaciones: { motivo: string; puntos: number; detalle: string }[];
  bonificaciones: { motivo: string; puntos: number; detalle: string }[];
  stats: { multas: number; multasPendientes: number; incidentes: number; presionesBajas: number; desgasteIrregular: number; inspecciones: number; kmPorLitro: number | null; kmRecorridos: number };
};

type PanelEjecutivo = {
  mes: string; costoRealMes: number;
  desglose: { combustible: number; mantenimiento: number; facturas: number; multas: number };
  presupuesto: number | null; desvioPresupuesto: number | null;
  rankingUnidades: { id: string; dominio: string; tipo: string; presupuesto: number | null; combustible: number; facturas: number }[];
};

const RATING_COLOR: Record<string, string> = {
  EXCELENTE: 'bg-emerald-100 text-emerald-700', BUENO: 'bg-blue-100 text-blue-700',
  REGULAR: 'bg-amber-100 text-amber-700', DEFICIENTE: 'bg-orange-100 text-orange-700', CRITICO: 'bg-red-100 text-red-700',
};
const RATING_LABEL: Record<string, string> = {
  EXCELENTE: 'Excelente', BUENO: 'Bueno', REGULAR: 'Regular', DEFICIENTE: 'Deficiente', CRITICO: 'Crítico',
};
const SEV_COLOR: Record<string, string> = {
  CRITICA: 'border-red-200 bg-red-50 text-red-700', ALTA: 'border-amber-200 bg-amber-50 text-amber-700',
  MEDIA: 'border-blue-200 bg-blue-50 text-blue-700', BAJA: 'border-neutral-200 bg-neutral-50 text-neutral-600',
};

function fmtMoney(n: number | null | undefined) {
  return n != null ? `$${Math.round(n).toLocaleString('es-AR')}` : '—';
}

// ═══════════════════════════════════════════════════════════════
// Página principal con tabs
// ═══════════════════════════════════════════════════════════════

export default function PanelPage() {
  const [tab, setTab] = useState<'flota' | 'conductores' | 'ejecutivo' | 'performance' | 'rentabilidad'>('flota');

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-bold text-[#0d1b3d]">Panel de flota</h1>
        <p className="text-xs text-neutral-500">Analítica para administración y dirección</p>
      </div>

      <div className="flex items-center gap-0.5 border border-neutral-200 bg-white rounded-lg px-1 w-fit">
        {[
          { key: 'flota', label: 'Flota', icon: LayoutDashboard, hint: 'KPIs operativos y alertas activas de toda la flota' },
          { key: 'conductores', label: 'Ranking de conductores', icon: Users, hint: 'Scorecard por chofer: infracciones, incidentes, presiones y rating' },
          { key: 'ejecutivo', label: 'Ejecutivo', icon: TrendingUp, hint: 'Costo real del mes vs presupuesto y ranking de unidades por gasto' },
          { key: 'performance', label: 'Performance', icon: Gauge, hint: 'Eficacia/eficiencia por unidad en la ventana operativa configurable' },
          { key: 'rentabilidad', label: 'Rentabilidad', icon: Landmark, hint: 'Margen por unidad, punto de equilibrio, payback, clientes, talleres, conductores y cash flow' },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} title={t.hint} onClick={() => setTab(t.key as any)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md my-1 transition-colors ${
                tab === t.key ? 'bg-blue-600 text-white' : 'text-neutral-500 hover:text-neutral-800'
              }`}>
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'flota' && <TabFlota />}
      {tab === 'conductores' && <TabConductores />}
      {tab === 'ejecutivo' && <TabEjecutivo />}
      {tab === 'performance' && <TabPerformance />}
      {tab === 'rentabilidad' && <TabRentabilidad />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab Flota: KPIs + alertas activas
// ═══════════════════════════════════════════════════════════════

function TabFlota() {
  const [data, setData] = useState<PanelFlota | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<PanelFlota>('/flota/panel').then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <div className="p-8 text-sm text-neutral-500">Cargando panel…</div>;
  const { kpis, alertas } = data;

  const cards = [
    { label: 'Disponibilidad', value: kpis.disponibilidad != null ? `${kpis.disponibilidad}%` : '—', sub: `${kpis.activos} activas · ${kpis.enTaller} en taller`, icon: Truck, alert: kpis.enTaller > 0 },
    { label: 'OTs abiertas', value: kpis.otsAbiertas, sub: kpis.otsVencidas > 0 ? `${kpis.otsVencidas} vencidas` : 'al día', icon: Wrench, alert: kpis.otsVencidas > 0 },
    { label: 'Cumplimiento planes', value: kpis.cumplimientoPlanes != null ? `${kpis.cumplimientoPlanes}%` : '—', sub: `${kpis.planesActivos} activos · ${kpis.planesVencidos} vencidos`, icon: CalendarClock, alert: kpis.planesVencidos > 0 },
    { label: 'Cubiertas en alerta', value: kpis.cubiertasCriticas + kpis.cubiertasBajas, sub: `${kpis.cubiertasCriticas} críticas · ${kpis.cubiertasBajas} bajas`, icon: Disc, alert: kpis.cubiertasCriticas > 0 },
    { label: 'Multas pendientes', value: kpis.multasPendientes, sub: fmtMoney(kpis.montoMultasPend), icon: AlertOctagon, alert: kpis.multasPendientes > 0 },
    { label: 'Docs por vencer', value: kpis.docsPorVencer, sub: 'próximos 7 días', icon: FileWarning, alert: kpis.docsPorVencer > 0 },
    { label: 'Incidentes del mes', value: kpis.incidentesMes, sub: 'reportados en ruta', icon: AlertTriangle, alert: kpis.incidentesMes > 0 },
  ];

  const { situacionFlota: sf } = data;
  const segmentos = sf ? ([
    { key: 'enServicio', label: 'En servicio', n: sf.enServicio, cls: 'bg-emerald-500', txt: 'text-emerald-700' },
    { key: 'disponibleSinServicio', label: 'Disponible · sin servicio', n: sf.disponibleSinServicio, cls: 'bg-sky-400', txt: 'text-sky-700' },
    { key: 'enTaller', label: 'En taller / reparación', n: sf.enTaller, cls: 'bg-amber-500', txt: 'text-amber-700' },
    { key: 'restringida', label: 'Restringida (bloqueada)', n: sf.restringida, cls: 'bg-red-500', txt: 'text-red-700' },
    { key: 'noDisponibleOtro', label: 'No disponible · otra etapa', n: sf.noDisponibleOtro, cls: 'bg-orange-400', txt: 'text-orange-700' },
    { key: 'inactiva', label: 'Inactiva', n: sf.inactiva, cls: 'bg-neutral-400', txt: 'text-neutral-600' },
    { key: 'baja', label: 'Baja', n: sf.baja, cls: 'bg-neutral-700', txt: 'text-neutral-800' },
  ].filter((s) => s.n > 0)) : [];
  const etapasDetalle = sf ? Object.entries(sf.porEtapa) : [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-2.5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`rounded-lg border p-3 ${c.alert ? 'border-amber-200 bg-amber-50/50' : 'border-neutral-200 bg-white'}`}>
              <div className="flex items-center gap-1.5 text-neutral-500 text-[10px] font-medium uppercase mb-1"><Icon className="h-3 w-3" /> {c.label}</div>
              <p className="text-xl font-bold text-neutral-900">{c.value}</p>
              <p className="text-[10px] text-neutral-400 mt-0.5">{c.sub}</p>
            </div>
          );
        })}
      </div>

      {sf && kpis.totalUnidades > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-blue-600" /> Situación de la flota — ahora
            </h2>
            <span className="text-[10px] text-neutral-400">{kpis.totalUnidades} unidades</span>
          </div>
          {/* Barra apilada */}
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-100 mb-2.5">
            {segmentos.map((s) => (
              <div key={s.key} className={s.cls} style={{ width: `${(s.n / kpis.totalUnidades) * 100}%` }}
                title={`${s.label}: ${s.n}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {segmentos.map((s) => (
              <span key={s.key} className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${s.txt}`}>
                <span className={`h-2 w-2 rounded-full ${s.cls}`} />
                {s.label}: <strong>{s.n}</strong>
                <span className="text-neutral-400 font-normal">({Math.round((s.n / kpis.totalUnidades) * 100)}%)</span>
              </span>
            ))}
          </div>
          {etapasDetalle.length > 0 && (
            <p className="mt-2 text-[10px] text-neutral-500">
              Detalle no disponibles: {etapasDetalle.map(([e, n]) => `${ETAPA_LABEL[e] ?? e} (${n})`).join(' · ')}
            </p>
          )}
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Alertas activas
          {alertas.length > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{alertas.length}</span>}
        </div>
        {alertas.length === 0 ? (
          <p className="px-3 py-5 text-xs text-neutral-400 text-center flex items-center justify-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Sin alertas — la flota está en condiciones</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {alertas.map((a, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${SEV_COLOR[a.severidad] || SEV_COLOR.BAJA}`}>{a.severidad}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-neutral-800">{a.titulo}</p>
                  <p className="text-[11px] text-neutral-500 truncate">{a.detalle}</p>
                </div>
                <Link href={a.link} className="text-[11px] font-medium text-blue-600 hover:underline shrink-0">Ver →</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab Conductores: ranking con rating de performance
// ═══════════════════════════════════════════════════════════════

function TabConductores() {
  const [data, setData] = useState<{ scorecard: ScoreItem[]; rendimientoFlotaKmL: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ scorecard: ScoreItem[]; rendimientoFlotaKmL: number | null }>('/flota/conductores/scorecard')
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <div className="p-8 text-sm text-neutral-500">Cargando ranking…</div>;
  const { scorecard, rendimientoFlotaKmL } = data;

  const medalColor = ['text-amber-500', 'text-neutral-400', 'text-amber-700'];

  return (
    <div className="space-y-3">
      {rendimientoFlotaKmL != null && (
        <p className="text-xs text-neutral-500 flex items-center gap-1.5">
          <Fuel className="h-3.5 w-3.5" /> Rendimiento promedio de flota: <strong className="text-neutral-800">{rendimientoFlotaKmL} km/L</strong> — se usa como referencia para la eficiencia de cada chofer
        </p>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800">Ranking de performance — últimos 6 meses</div>
        {scorecard.length === 0 ? (
          <p className="px-3 py-5 text-xs text-neutral-400 text-center">Sin conductores cargados</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-3 py-2 w-10">#</th>
                <th className="text-left font-medium px-3 py-2">Conductor</th>
                <th className="text-left font-medium px-3 py-2">Unidad</th>
                <th className="text-center font-medium px-3 py-2">Multas</th>
                <th className="text-center font-medium px-3 py-2">Incidentes</th>
                <th className="text-center font-medium px-3 py-2">km/L</th>
                <th className="text-center font-medium px-3 py-2">km recorridos</th>
                <th className="text-center font-medium px-3 py-2">Score</th>
                <th className="text-left font-medium px-3 py-2">Rating</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {scorecard.map((c, i) => (
                <>
                  <tr key={c.id} className="hover:bg-neutral-50 cursor-pointer" onClick={() => setExpandido(expandido === c.id ? null : c.id)}>
                    <td className="px-3 py-2.5">
                      {i < 3 ? <Medal className={`h-4 w-4 ${medalColor[i]}`} /> : <span className="text-neutral-400 font-medium">{i + 1}</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-neutral-800">{c.nombre}</p>
                      {c.categoria && <p className="text-[10px] text-neutral-400">Lic. {c.categoria}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-neutral-600">{c.vehiculos.join(', ') || '—'}</td>
                    <td className={`px-3 py-2.5 text-center font-medium ${c.stats.multasPendientes > 0 ? 'text-red-600' : 'text-neutral-600'}`}>{c.stats.multas}</td>
                    <td className={`px-3 py-2.5 text-center font-medium ${c.stats.incidentes > 0 ? 'text-amber-600' : 'text-neutral-600'}`}>{c.stats.incidentes}</td>
                    <td className="px-3 py-2.5 text-center text-neutral-600">{c.stats.kmPorLitro ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-neutral-600">{c.stats.kmRecorridos > 0 ? c.stats.kmRecorridos.toLocaleString('es-AR') : '—'}</span>
                      {c.stats.kmRecorridos > 0 && (
                        <span className={`ml-1 rounded px-1 py-0.5 text-[9px] font-semibold ${c.confianza === 'ALTA' ? 'bg-emerald-50 text-emerald-600' : c.confianza === 'MEDIA' ? 'bg-amber-50 text-amber-600' : 'bg-neutral-100 text-neutral-400'}`} title={`Confianza del dato: ${c.confianza.toLowerCase()}`}>
                          {c.confianza === 'ALTA' ? '●●●' : c.confianza === 'MEDIA' ? '●●○' : '●○○'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-sm font-bold ${c.score >= 75 ? 'text-emerald-600' : c.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{c.score}</span>
                      {c.tendencia !== 0 && (
                        <span className={`ml-1 text-[10px] font-semibold ${c.tendencia > 0 ? 'text-emerald-500' : 'text-red-500'}`} title={c.tendencia > 0 ? `Mejoró ${c.tendencia} pts vs. mes anterior` : `Empeoró ${-c.tendencia} pts vs. mes anterior`}>
                          {c.tendencia > 0 ? '▲' : '▼'}{Math.abs(c.tendencia)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${RATING_COLOR[c.rating]}`}>{RATING_LABEL[c.rating]}</span></td>
                    <td className="px-3 py-2.5 text-neutral-400">{expandido === c.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</td>
                  </tr>
                  {expandido === c.id && (
                    <tr key={`${c.id}-det`} className="bg-neutral-50">
                      <td colSpan={10} className="px-4 py-3">
                        {c.penalizaciones.length === 0 && c.bonificaciones.length === 0 ? (
                          <p className="text-xs text-green-700 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Sin penalizaciones ni bonificaciones — desempeño sin observaciones</p>
                        ) : (
                          <div className="space-y-1">
                            {c.bonificaciones.length > 0 && (
                              <>
                                <p className="text-[10px] font-semibold text-emerald-600 uppercase">Bonificaciones</p>
                                {c.bonificaciones.map((b, j) => (
                                  <div key={`b${j}`} className="flex items-center gap-2 text-xs">
                                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">+{b.puntos}</span>
                                    <span className="font-medium text-neutral-700">{b.motivo}</span>
                                    <span className="text-neutral-400">{b.detalle}</span>
                                  </div>
                                ))}
                              </>
                            )}
                            {c.penalizaciones.length > 0 && (
                              <>
                                <p className="text-[10px] font-semibold text-neutral-500 uppercase">Penalizaciones que bajan el score</p>
                                {c.penalizaciones.map((p, j) => (
                                  <div key={j} className="flex items-center gap-2 text-xs">
                                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">-{p.puntos}</span>
                                    <span className="font-medium text-neutral-700">{p.motivo}</span>
                                    <span className="text-neutral-400">{p.detalle}</span>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-[11px] text-neutral-500">
        <strong className="text-neutral-700">Cómo se calcula el score:</strong> cada chofer parte de 100 puntos. Se descuentan multas por tipo (exceso de velocidad -10, tránsito -6, documentación -4, estacionamiento -2; no cuentan anuladas ni en disputa), incidentes (-3 a -12 según gravedad), presiones bajas sin corregir (-2 c/u, máx -10), desgaste irregular de cubiertas (-4 c/u, máx -12), consumo sobre el promedio de flota (-5 a -10) y documentación vencida (-6 c/u). Se <strong className="text-emerald-700">bonifica</strong> +5 por eficiencia &gt;10% sobre el promedio, +1 por checklist pre-viaje realizado (máx +4) y +1 por inspección con hallazgos reportados (máx +4). Los puntos ●●● indican la confianza del dato según km recorridos; ▲/▼ muestra la tendencia del score vs. el mes anterior.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab Ejecutivo: costo real vs presupuesto + ranking de unidades
// ═══════════════════════════════════════════════════════════════

function TabEjecutivo() {
  const [data, setData] = useState<PanelEjecutivo | null>(null);
  const [loading, setLoading] = useState(true);
  const [editPresupuesto, setEditPresupuesto] = useState(false);
  const [presupuestoInput, setPresupuestoInput] = useState('');
  const [savingPres, setSavingPres] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch<PanelEjecutivo>('/flota/panel-ejecutivo');
      setData(r);
      setPresupuestoInput(r.presupuesto != null ? String(r.presupuesto) : '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const guardarPresupuesto = async () => {
    setSavingPres(true);
    try {
      await apiFetch('/flota/config/presupuesto', { method: 'PUT', json: { presupuestoMensual: presupuestoInput ? Number(presupuestoInput) : null } });
      setEditPresupuesto(false);
      await load();
    } finally {
      setSavingPres(false);
    }
  };

  if (loading || !data) return <div className="p-8 text-sm text-neutral-500">Cargando vista ejecutiva…</div>;

  const { desglose } = data;
  const totalDesglose = desglose.combustible + desglose.mantenimiento + desglose.facturas + desglose.multas;
  const pctUsado = data.presupuesto != null && data.presupuesto > 0 ? Math.min((data.costoRealMes / data.presupuesto) * 100, 100) : null;

  return (
    <div className="space-y-3">
      {/* Presupuesto vs real */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-neutral-800 capitalize">Costo operativo — {data.mes}</h3>
            <button onClick={() => setEditPresupuesto(true)} className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline">
              <Pencil className="h-3 w-3" /> {data.presupuesto != null ? 'Editar presupuesto' : 'Definir presupuesto'}
            </button>
          </div>

          <div className="flex items-end gap-6 mb-3">
            <div>
              <p className="text-[10px] font-medium text-neutral-500 uppercase">Real del mes</p>
              <p className="text-2xl font-bold text-neutral-900">{fmtMoney(data.costoRealMes)}</p>
            </div>
            {data.presupuesto != null && (
              <>
                <div>
                  <p className="text-[10px] font-medium text-neutral-500 uppercase">Presupuesto</p>
                  <p className="text-2xl font-bold text-neutral-500">{fmtMoney(data.presupuesto)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-neutral-500 uppercase">Desvío</p>
                  <p className={`text-2xl font-bold ${data.desvioPresupuesto != null && data.desvioPresupuesto > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {data.desvioPresupuesto != null ? `${data.desvioPresupuesto > 0 ? '+' : ''}${data.desvioPresupuesto}%` : '—'}
                  </p>
                </div>
              </>
            )}
          </div>

          {pctUsado != null && (
            <div>
              <div className="h-2.5 rounded-full bg-neutral-100 overflow-hidden">
                <div className={`h-full rounded-full ${pctUsado > 100 ? 'bg-red-500' : pctUsado > 85 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pctUsado}%` }} />
              </div>
              <p className="text-[10px] text-neutral-400 mt-1">{Math.round(pctUsado)}% del presupuesto utilizado</p>
            </div>
          )}

          {/* Desglose */}
          <div className="mt-4 space-y-2">
            {[
              { label: 'Combustible', valor: desglose.combustible, color: 'bg-blue-500' },
              { label: 'Mantenimiento', valor: desglose.mantenimiento, color: 'bg-amber-500' },
              { label: 'Facturas', valor: desglose.facturas, color: 'bg-violet-500' },
              { label: 'Multas', valor: desglose.multas, color: 'bg-red-400' },
            ].map((d) => (
              <div key={d.label}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-neutral-600">{d.label}</span>
                  <span className="font-semibold text-neutral-800">{fmtMoney(d.valor)} <span className="text-neutral-400 font-normal">({totalDesglose > 0 ? Math.round((d.valor / totalDesglose) * 100) : 0}%)</span></span>
                </div>
                <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                  <div className={`h-full rounded-full ${d.color}`} style={{ width: `${totalDesglose > 0 ? (d.valor / totalDesglose) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ranking de unidades por costo */}
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800">Unidades con mayor costo del mes</div>
          {data.rankingUnidades.length === 0 ? (
            <p className="px-3 py-4 text-xs text-neutral-400">Sin costos registrados</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {data.rankingUnidades.map((v, i) => {
                const real = Number(v.combustible) + Number(v.facturas);
                const pres = v.presupuesto != null ? Number(v.presupuesto) : null;
                const desvio = pres != null && pres > 0 ? Math.round(((real - pres) / pres) * 100) : null;
                return (
                <li key={v.id} className="flex items-center gap-2.5 px-3 py-2">
                  <span className="w-5 text-center text-[11px] font-bold text-neutral-400">{i + 1}</span>
                  <Truck className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Link href={`/flota-360/vehiculos/${v.id}`} className="text-xs font-medium text-neutral-800 hover:text-blue-700 truncate block">{v.dominio}</Link>
                    {pres != null && <span className="text-[10px] text-neutral-400">presupuesto {fmtMoney(pres)}</span>}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-neutral-800">{fmtMoney(real)}</span>
                    {desvio != null && (
                      <p className={`text-[10px] font-semibold ${desvio > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {desvio > 0 ? '+' : ''}{desvio}% vs pres.
                      </p>
                    )}
                  </div>
                </li>
              );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Modal presupuesto */}
      {editPresupuesto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-xs rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5"><DollarSign className="h-4 w-4 text-blue-600" /> Presupuesto mensual</h3>
              <button onClick={() => setEditPresupuesto(false)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4">
              <label className="block text-xs font-medium text-neutral-600 mb-1">Monto mensual ($)</label>
              <input type="number" min={0} value={presupuestoInput} onChange={(e) => setPresupuestoInput(e.target.value)} placeholder="ej: 5000000" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              <p className="text-[11px] text-neutral-400 mt-1.5">Se compara contra el costo real del mes (combustible + mantenimiento + facturas + multas).</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setEditPresupuesto(false)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">Cancelar</button>
              <button disabled={savingPres} onClick={guardarPresupuesto} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{savingPres ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab Performance: eficacia/eficiencia por unidad en período
// elegible, con ventana operativa configurable (días/horas hábiles)
// ═══════════════════════════════════════════════════════════════

type PerfUnidad = {
  vehiculoId: string; dominio: string; tipo: string; situacion: string; estadoActual: string;
  kmRecorridos: number | null;
  horasElegibles: number; horasDisponibles: number; horasEnServicioNeto: number;
  horasEstacionada: number; horasNoDisponible: number; horasTaller: number; horasReparacion: number;
  horasServicioFueraVentana: number; ciclos: number;
  disponibilidadPct: number | null; utilizacionPct: number | null;
  horasPorEtapa: Record<string, number>;
  ventana: { horasElegibles: number; horasDisponibles: number; horasNoDisponible: number; horasEnServicio: number; horasEstacionada: number; disponibilidadPct: number | null; utilizacionPct: number | null } | null;
  costosPeriodo: { total: number; combustible: number; mantenimiento: number; facturas: number; multas: number; costoPorKm: number | null; presupuestoProrrateado: number | null; desvioPresupuestoPct: number | null };
  comentario: string | null;
  sinDatos: boolean; ambiguo: boolean;
};

type PerformanceData = {
  periodo: { desde: string; hasta: string; dias: number };
  ventana: { activa: boolean; diasHabiles: number[]; horaDesde: string; horaHasta: string };
  unidades: PerfUnidad[];
  totales: { unidades: number; kmRecorridos: number; horasEnServicio: number; horasEstacionada: number; horasNoDisponible: number; horasTaller: number; costoTotal: number } | null;
};

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function TabPerformance() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [vehiculosAll, setVehiculosAll] = useState<{ id: string; dominio: string; tipo: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detOpen, setDetOpen] = useState<Record<string, boolean>>({});
  const [detData, setDetData] = useState<Record<string, any>>({});
  const [detLoading, setDetLoading] = useState<string | null>(null);

  // Filtros
  const [tipos, setTipos] = useState<string[]>(['CAMION', 'SEMI']);
  const [selUnidades, setSelUnidades] = useState<string[]>([]);
  const [preset, setPreset] = useState('30d');
  const [desdeCustom, setDesdeCustom] = useState('');
  const [hastaCustom, setHastaCustom] = useState('');

  // Config ventana
  const [editVentana, setEditVentana] = useState(false);
  const [ventanaForm, setVentanaForm] = useState({ activa: false, diasHabiles: [1, 2, 3, 4, 5, 6], horaDesde: '06:00', horaHasta: '20:00' });
  const [savingVent, setSavingVent] = useState(false);

  const rango = (): { desde: Date; hasta: Date } => {
    const hasta = new Date(); hasta.setHours(23, 59, 59, 999);
    if (preset === 'custom' && desdeCustom && hastaCustom) {
      return { desde: new Date(desdeCustom + 'T00:00:00'), hasta: new Date(hastaCustom + 'T23:59:59') };
    }
    const dias = preset === '7d' ? 7 : preset === '90d' ? 90 : preset === 'mesAnt' ? 30 : 30;
    if (preset === 'mesAnt') {
      const h = new Date(); h.setDate(1); h.setHours(0, 0, 0, 0);
      return { desde: new Date(h.getFullYear(), h.getMonth() - 1, 1), hasta: new Date(h.getFullYear(), h.getMonth(), 0, 23, 59, 59) };
    }
    return { desde: new Date(hasta.getTime() - dias * 86400000), hasta };
  };

  const load = async () => {
    setLoading(true);
    try {
      const { desde, hasta } = rango();
      const params = new URLSearchParams({ desde: desde.toISOString(), hasta: hasta.toISOString() });
      const tiposSel = tipos.length ? tipos.join(',') : '';
      if (tiposSel) params.set('tipos', tiposSel);
      if (selUnidades.length) params.set('unidades', selUnidades.join(','));
      const [perf, veh] = await Promise.all([
        apiFetch<PerformanceData>(`/fleet-ops/performance?${params.toString()}`),
        apiFetch<{ vehiculos: any[] }>('/flota/vehiculos'),
      ]);
      setData(perf);
      setVehiculosAll((veh.vehiculos || []).map((v: any) => ({ id: v.id, dominio: v.dominio, tipo: v.tipo })));
      if (perf.ventana) setVentanaForm({ activa: !!perf.ventana.activa, diasHabiles: perf.ventana.diasHabiles || [1, 2, 3, 4, 5, 6], horaDesde: perf.ventana.horaDesde || '06:00', horaHasta: perf.ventana.horaHasta || '20:00' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [preset, tipos.join(','), selUnidades.join(','), desdeCustom, hastaCustom]);

  const guardarVentana = async () => {
    setSavingVent(true);
    try {
      await apiFetch('/fleet-ops/config-ops', { method: 'PUT', json: { ventana: ventanaForm } });
      setEditVentana(false);
      await load();
    } finally {
      setSavingVent(false);
    }
  };

  // Segundo nivel de expansión: detalle día por día (lazy fetch)
  const toggleDetalle = async (vehiculoId: string) => {
    const next = !detOpen[vehiculoId];
    setDetOpen((p) => ({ ...p, [vehiculoId]: next }));
    if (next && !detData[vehiculoId]) {
      setDetLoading(vehiculoId);
      try {
        const { desde, hasta } = rango();
        const params = new URLSearchParams({ desde: desde.toISOString(), hasta: hasta.toISOString() });
        const d = await apiFetch<any>(`/fleet-ops/vehiculos/${vehiculoId}/detalle-diario?${params.toString()}`);
        setDetData((p) => ({ ...p, [vehiculoId]: d }));
      } finally {
        setDetLoading(null);
      }
    }
  };

  const toggleUnidad = (id: string) => setSelUnidades((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const toggleDia = (d: number) => setVentanaForm((f) => ({ ...f, diasHabiles: f.diasHabiles.includes(d) ? f.diasHabiles.filter((x) => x !== d) : [...f.diasHabiles, d].sort() }));

  const tiposDisponibles = [...new Set(vehiculosAll.map((v) => v.tipo))].sort();
  const unidadesFiltrables = vehiculosAll.filter((v) => tipos.length === 0 || tipos.includes(v.tipo));
  const ventanaActiva = data?.ventana?.activa === true;

  if (loading && !data) return <div className="p-8 text-sm text-neutral-500">Cargando performance…</div>;

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="rounded-lg border border-neutral-200 bg-white p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-medium text-neutral-500 uppercase mr-1">Período:</span>
            {[
              { k: '7d', l: 'Última semana' }, { k: '30d', l: 'Último mes' },
              { k: 'mesAnt', l: 'Mes anterior' }, { k: '90d', l: '90 días' }, { k: 'custom', l: 'Personalizado' },
            ].map((p) => (
              <button key={p.k} onClick={() => setPreset(p.k)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${preset === p.k ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                {p.l}
              </button>
            ))}
            {preset === 'custom' && (
              <>
                <input type="date" value={desdeCustom} onChange={(e) => setDesdeCustom(e.target.value)} className="rounded-md border border-neutral-300 px-2 py-1 text-[11px]" />
                <span className="text-neutral-400 text-[11px]">a</span>
                <input type="date" value={hastaCustom} onChange={(e) => setHastaCustom(e.target.value)} className="rounded-md border border-neutral-300 px-2 py-1 text-[11px]" />
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-medium text-neutral-500 uppercase mr-1">Tipo:</span>
            {tiposDisponibles.map((t) => (
              <button key={t} onClick={() => setTipos((s) => s.includes(t) ? s.filter((x) => x !== t) : [...s, t])}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${tipos.includes(t) ? 'bg-emerald-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                {t === 'CAMION' ? 'Tractores' : t === 'SEMI' ? 'Semis' : t}
              </button>
            ))}
          </div>
          <button onClick={() => setEditVentana(true)} className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline">
            <Pencil className="h-3 w-3" /> Ventana operativa {ventanaActiva ? `(${ventanaForm.horaDesde}–${ventanaForm.horaHasta})` : '(24/7)'}
          </button>
        </div>

        {/* Selector de unidades */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-medium text-neutral-500 uppercase">Unidades:</span>
            <button onClick={() => setSelUnidades([])} className={`text-[11px] font-medium ${selUnidades.length === 0 ? 'text-blue-600' : 'text-neutral-400 hover:text-neutral-600'}`}>
              Todas ({unidadesFiltrables.length})
            </button>
            {selUnidades.length > 0 && <span className="text-[10px] text-blue-600 font-medium">{selUnidades.length} seleccionadas</span>}
          </div>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {unidadesFiltrables.map((v) => (
              <button key={v.id} onClick={() => toggleUnidad(v.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border ${selUnidades.includes(v.id) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'}`}>
                {v.dominio}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs de la selección */}
      {data?.totales && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {[
            { l: 'Unidades', v: String(data.totales.unidades) },
            { l: 'Km recorridos', v: data.totales.kmRecorridos.toLocaleString('es-AR') },
            { l: 'Hs en servicio', v: data.totales.horasEnServicio.toLocaleString('es-AR') },
            { l: 'Hs estacionada', v: data.totales.horasEstacionada.toLocaleString('es-AR') },
            { l: 'Hs en taller', v: data.totales.horasTaller.toLocaleString('es-AR') },
            { l: 'Costo total', v: fmtMoney(data.totales.costoTotal) },
          ].map((k) => (
            <div key={k.l} className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
              <p className="text-[10px] font-medium text-neutral-500 uppercase">{k.l}</p>
              <p className="text-lg font-bold text-neutral-900">{k.v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Aviso ventana */}
      {ventanaActiva && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-800">
          Ventana operativa activa: <strong>{ventanaForm.diasHabiles.map((d) => DIAS_SEMANA[d]).join(', ')}</strong> de <strong>{ventanaForm.horaDesde} a {ventanaForm.horaHasta}</strong>. Las columnas "en ventana" miden solo ese período; la improductividad nocturna/fin de semana no cuenta.
        </div>
      )}

      {/* Tabla por unidad */}
      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800">
          Performance por unidad — {data?.periodo.dias ?? '—'} días
        </div>
        {(data?.unidades?.length ?? 0) === 0 ? (
          <p className="px-3 py-4 text-xs text-neutral-400">Sin unidades para los filtros elegidos</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] font-medium text-neutral-500 uppercase border-b border-neutral-100">
                  <th className="px-3 py-2">Unidad</th>
                  <th className="px-2 py-2 text-right">Km</th>
                  <th className="px-2 py-2 text-right">Hs servicio</th>
                  <th className="px-2 py-2 text-right">Hs estacionada</th>
                  <th className="px-2 py-2 text-right">Hs taller</th>
                  <th className="px-2 py-2 text-right">Hs no disp.</th>
                  <th className="px-2 py-2 text-right">Disponib. %</th>
                  <th className="px-2 py-2 text-right">Utiliz. %</th>
                  <th className="px-2 py-2 text-right">Costo</th>
                  <th className="px-2 py-2 text-right">$/km</th>
                  <th className="px-2 py-2 text-right">vs Presup.</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data!.unidades.map((u) => {
                  const open = expanded === u.vehiculoId;
                  const m = ventanaActiva && u.ventana ? u.ventana : { horasEnServicio: u.horasEnServicioNeto, horasEstacionada: u.horasEstacionada, horasNoDisponible: u.horasNoDisponible, disponibilidadPct: u.disponibilidadPct, utilizacionPct: u.utilizacionPct };
                  const desvio = u.costosPeriodo.desvioPresupuestoPct;
                  return (
                    <Fragment key={u.vehiculoId}>
                      <tr className="hover:bg-neutral-50 cursor-pointer" onClick={() => setExpanded(open ? null : u.vehiculoId)}>
                        <td className="px-3 py-2">
                          <Link href={`/flota-360/vehiculos/${u.vehiculoId}`} className="font-medium text-neutral-800 hover:text-blue-700" onClick={(e) => e.stopPropagation()}>{u.dominio}</Link>
                          <span className="text-[10px] text-neutral-400 ml-1.5">{u.tipo === 'CAMION' ? 'Tractor' : u.tipo === 'SEMI' ? 'Semi' : u.tipo}</span>
                          {u.ambiguo && <span className="ml-1 text-[9px] text-amber-600" title="Datos ambiguos del período">⚠</span>}
                        </td>
                        <td className="px-2 py-2 text-right font-medium">{u.kmRecorridos != null ? u.kmRecorridos.toLocaleString('es-AR') : '—'}</td>
                        <td className="px-2 py-2 text-right">{m.horasEnServicio.toLocaleString('es-AR')}{u.horasServicioFueraVentana > 0 && <span className="block text-[9px] text-neutral-400">+{u.horasServicioFueraVentana} fuera</span>}</td>
                        <td className="px-2 py-2 text-right text-amber-700">{m.horasEstacionada.toLocaleString('es-AR')}</td>
                        <td className="px-2 py-2 text-right text-red-700">{u.horasTaller.toLocaleString('es-AR')}</td>
                        <td className="px-2 py-2 text-right">{m.horasNoDisponible.toLocaleString('es-AR')}</td>
                        <td className="px-2 py-2 text-right font-semibold">{m.disponibilidadPct != null ? `${m.disponibilidadPct}%` : '—'}</td>
                        <td className="px-2 py-2 text-right font-semibold text-blue-700">{m.utilizacionPct != null ? `${m.utilizacionPct}%` : '—'}</td>
                        <td className="px-2 py-2 text-right">{fmtMoney(u.costosPeriodo.total)}</td>
                        <td className="px-2 py-2 text-right">{u.costosPeriodo.costoPorKm != null ? `$${u.costosPeriodo.costoPorKm.toLocaleString('es-AR')}` : '—'}</td>
                        <td className={`px-2 py-2 text-right font-semibold ${desvio == null ? 'text-neutral-400' : desvio > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {desvio != null ? `${desvio > 0 ? '+' : ''}${desvio}%` : '—'}
                        </td>
                        <td className="px-2 py-2 text-right">{open ? <ChevronUp className="h-3.5 w-3.5 text-neutral-400 inline" /> : <ChevronDown className="h-3.5 w-3.5 text-neutral-400 inline" />}</td>
                      </tr>
                      {open && (
                        <tr className="bg-neutral-50">
                          <td colSpan={12} className="px-4 py-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                              <div>
                                <p className="font-semibold text-neutral-700 mb-1">Tiempos del período</p>
                                <p>Elegibles: <strong>{u.horasElegibles}h</strong> · Disponibles: <strong>{u.horasDisponibles}h</strong></p>
                                <p>Reparación efectiva: <strong>{u.horasReparacion}h</strong> · Ciclos taller: <strong>{u.ciclos}</strong></p>
                                {u.comentario && <p className="mt-1 text-neutral-500 italic">"{u.comentario}"</p>}
                              </div>
                              <div>
                                <p className="font-semibold text-neutral-700 mb-1">Etapas de taller</p>
                                {Object.keys(u.horasPorEtapa).length === 0 ? <p className="text-neutral-400">Sin etapas en el período</p> :
                                  Object.entries(u.horasPorEtapa).sort((a, b) => b[1] - a[1]).map(([k, h]) => (
                                    <p key={k}>{ETAPA_LABEL[k] || k}: <strong>{h}h</strong></p>
                                  ))}
                              </div>
                              <div>
                                <p className="font-semibold text-neutral-700 mb-1">Costos del período</p>
                                <p>Combustible: <strong>{fmtMoney(u.costosPeriodo.combustible)}</strong> · Mantenimiento: <strong>{fmtMoney(u.costosPeriodo.mantenimiento)}</strong></p>
                                <p>Facturas: <strong>{fmtMoney(u.costosPeriodo.facturas)}</strong> · Multas: <strong>{fmtMoney(u.costosPeriodo.multas)}</strong></p>
                                {u.costosPeriodo.presupuestoProrrateado != null && <p>Presupuesto del período: <strong>{fmtMoney(u.costosPeriodo.presupuestoProrrateado)}</strong></p>}
                              </div>
                            </div>
                            {/* Segundo nivel: detalle día por día con horarios */}
                            <div className="mt-3 border-t border-neutral-200 pt-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleDetalle(u.vehiculoId); }}
                                className="flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline"
                              >
                                {detOpen[u.vehiculoId] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                {detOpen[u.vehiculoId] ? 'Ocultar detalle por día' : 'Ver detalle por día — en qué horarios estuvo en servicio / estacionada / taller'}
                              </button>
                              {detOpen[u.vehiculoId] && (
                                <div className="mt-2 rounded-md border border-neutral-200 bg-white">
                                  {detLoading === u.vehiculoId && <p className="px-3 py-3 text-[11px] text-neutral-400">Cargando detalle…</p>}
                                  {detData[u.vehiculoId] && (
                                    <DetalleDiario data={detData[u.vehiculoId]} />
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal ventana operativa */}
      {editVentana && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5"><Gauge className="h-4 w-4 text-blue-600" /> Ventana operativa</h3>
              <button onClick={() => setEditVentana(false)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={ventanaForm.activa} onChange={(e) => setVentanaForm({ ...ventanaForm, activa: e.target.checked })} className="h-4 w-4" />
                <span className="font-medium text-neutral-700">Medir solo en horario operativo</span>
              </label>
              {ventanaForm.activa && (
                <>
                  <div>
                    <p className="text-xs font-medium text-neutral-600 mb-1">Días hábiles</p>
                    <div className="flex gap-1">
                      {DIAS_SEMANA.map((d, i) => (
                        <button key={i} type="button" onClick={() => toggleDia(i)}
                          className={`px-2 py-1 rounded text-[11px] font-medium ${ventanaForm.diasHabiles.includes(i) ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-500'}`}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-neutral-600 block mb-1">Desde</label>
                      <input type="time" value={ventanaForm.horaDesde} onChange={(e) => setVentanaForm({ ...ventanaForm, horaDesde: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-neutral-600 block mb-1">Hasta</label>
                      <input type="time" value={ventanaForm.horaHasta} onChange={(e) => setVentanaForm({ ...ventanaForm, horaHasta: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                    </div>
                  </div>
                  <p className="text-[11px] text-neutral-400">Fuera de esta franja no se contabiliza ni productividad ni improductividad (ej. nocturno, domingos).</p>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setEditVentana(false)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">Cancelar</button>
              <button disabled={savingVent} onClick={guardarVentana} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{savingVent ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Detalle día por día de una unidad (segundo nivel de expansión
// en Performance): rangos horarios de servicio, estacionada y
// taller con motivo + etapas. Datos de /detalle-diario.
// ═══════════════════════════════════════════════════════════════

function DetalleDiario({ data }: { data: any }) {
  const fmtHora = (ms: number) => new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const fmtDia = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' });
  };
  const dias = [...(data.dias || [])].reverse(); // más reciente primero
  if (dias.length === 0) return <p className="px-3 py-3 text-[11px] text-neutral-400">Sin actividad en el período</p>;
  return (
    <div className="max-h-72 overflow-y-auto">
      <table className="w-full text-[11px]">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-[9px] font-semibold text-neutral-400 uppercase border-b border-neutral-100">
            <th className="px-3 py-1.5 w-24">Día</th>
            <th className="px-3 py-1.5">En servicio</th>
            <th className="px-3 py-1.5">Estacionada</th>
            <th className="px-3 py-1.5">Taller / no disponible</th>
          </tr>
        </thead>
        <tbody>
          {dias.map((d: any) => {
            const sinNada = d.horasServicio === 0 && d.horasTaller === 0 && d.horasNoDisponible === 0;
            return (
              <tr key={d.fecha} className={`border-b border-neutral-50 align-top ${d.horasTaller > 0 || d.horasNoDisponible > 0 ? 'bg-red-50/40' : ''}`}>
                <td className="px-3 py-1.5 whitespace-nowrap font-medium text-neutral-700">{fmtDia(d.fecha)}</td>
                <td className="px-3 py-1.5">
                  {d.servicio.length === 0 ? <span className="text-neutral-300">—</span> : (
                    <div className="space-y-0.5">
                      {d.servicio.map((s: any, i: number) => (
                        <p key={i} className="text-blue-700">
                          {fmtHora(s.desde)} → {fmtHora(s.hasta)}
                          <span className="text-neutral-400"> ({Math.round((s.hasta - s.desde) / 360000) / 10}h)</span>
                        </p>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-1.5">
                  {d.horasEstacionada > 0 ? (
                    <span className={sinNada ? 'text-amber-700 font-medium' : 'text-neutral-600'}>{d.horasEstacionada}h{sinNada ? ' sin trabajo' : ''}</span>
                  ) : <span className="text-neutral-300">—</span>}
                </td>
                <td className="px-3 py-1.5">
                  {d.taller.length === 0 && d.horasNoDisponible === 0 ? <span className="text-neutral-300">—</span> : (
                    <div className="space-y-1">
                      {d.taller.map((t: any, i: number) => (
                        <div key={i}>
                          <p className="text-red-700 font-medium">
                            {fmtHora(t.desde)} → {fmtHora(t.hasta)} · {t.motivo}
                          </p>
                          {t.etapas.length > 0 && (
                            <div className="ml-3 space-y-0.5">
                              {t.etapas.map((et: any, j: number) => (
                                <p key={j} className="text-[10px] text-neutral-500">
                                  {ETAPA_LABEL[et.etapa] || et.etapa}: {fmtHora(et.desde)} → {fmtHora(et.hasta)}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {d.taller.length === 0 && d.horasNoDisponible > 0 && (
                        <p className="text-red-600">{d.horasNoDisponible}h no disponible (restricción/episodio sin taller)</p>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab Rentabilidad: margen por unidad, L/100km, preventivo vs
// correctivo, fallas repetidas, costo de oportunidad, financiación,
// talleres, conductores y cash flow proyectado.
// ═══════════════════════════════════════════════════════════════

type RentabilidadData = {
  periodo: { desde: string; hasta: string; dias: number };
  ingresoHoraFlota: number | null;
  unidades: {
    vehiculoId: string; dominio: string; tipo: string; marca: string | null; modelo: string | null; anio: number | null;
    kmRecorridos: number | null; ingresos: number; ingresosCount: number;
    costos: { total: number; combustible: number; mantenimiento: number; facturas: number; multas: number; cuotas: number; personal?: number };
    margen: number; margenPorKm: number | null; ingresoPorKm: number | null;
    lts100km: number | null; rendimientoPromKmL: number | null;
    preventivo: { n: number; costo: number }; correctivo: { n: number; costo: number };
    ratioPreventivo: number | null;
    fallasRecurrentes: number; casosDefecto: number; episodios: number;
    horasNoDisponible: number; horasEnServicio: number;
    costoOportunidad: number | null;
    financiacion: { cuotaMensual: number; cuotasTotales: number; cuotasPagadas: number; cuotasRestantes: number; saldoPendiente: number; costoPeriodo: number } | null;
    valorAdquisicion: number | null; valorResidual: number | null;
    puntoEquilibrioMes: number; bajoEquilibrio: boolean;
    costoFijoMes: number; costoVarPorKm: number | null;
    pendienteCobro: number;
    payback: { recuperado: number; pct: number; mesesEstimado: number | null } | null;
    enDeclive: boolean;
    diasFacturados: number; diasSinFacturar: number;
    margenMeses: number[];
    consumoAnomalo: { reciente: number; historico: number; caidaPct: number } | null;
    vsMedianaTipo: number | null;
    renovacion: { recomendada: boolean; motivo: string } | null;
  }[];
  talleres: { tallerId: string; nombre: string; ots: number; costoTotal: number; demoraPromHs: number | null; reclamos: number }[];
  conductores: { conductorId: string; nombre: string; horasTrabajadas: number; jornadasExcesivas: number; rendimientoPromKmL: number | null; litrosCargados: number; multasPagadas: number; sueldoPeriodo?: number | null; unidadDominio?: string | null; margenUnidad?: number | null; retornoSueldo?: number | null }[];
  clientes: { cliente: string; ingresos: number; viajes: number; share: number; dsoDias?: number | null; pendiente?: number; vencido?: number }[];
  totales: { unidades: number; ingresos: number; costos: number; margen: number; km: number; costoOportunidad: number; pendienteCobro?: number; deudaFlota?: number; unidadesEnDeclive?: number };
  porTipo?: { tipo: string; unidades: number; margenMesProm: number; ingresoMesProm: number; costoFijoMesProm: number; costoVarKmProm: number | null; kmMesProm: number | null }[];
  alertas?: { tipo: string; severidad: 'ROJO' | 'AMARILLO'; titulo: string; detalle: string; vehiculoId?: string }[];
};

type CashFlowData = {
  horizonte: { desde: string; hasta: string; dias: number };
  items: { tipo: string; fecha: string; vehiculo?: string; descripcion: string; monto: number | null; estimado: boolean; entrada?: boolean; vencido?: boolean }[];
  total: number; totalCobros?: number; neto?: number; deudaFlota?: number; sinMonto: number;
};

function TabRentabilidad() {
  const [data, setData] = useState<RentabilidadData | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState(90);
  const [cotizador, setCotizador] = useState<{ abierto: boolean; unidadId: string; km: string; diasViaje: string; margenPct: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - dias * 86400000);
    Promise.all([
      apiFetch<RentabilidadData>(`/fleet-ops/rentabilidad?desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`),
      apiFetch<CashFlowData>('/fleet-ops/cash-flow?dias=90').catch(() => null),
    ]).then(([r, cf]) => { setData(r); setCashFlow(cf); }).finally(() => setLoading(false));
  }, [dias]);

  if (loading) return <div className="p-8 text-sm text-neutral-500">Cargando rentabilidad…</div>;
  if (!data) return <div className="p-8 text-sm text-neutral-500">Sin datos</div>;

  const TIPO_ITEM: Record<string, { label: string; cls: string; hint: string }> = {
    VENCIMIENTO: { label: 'Vencimiento', cls: 'bg-amber-100 text-amber-700', hint: 'Documento que vence: VTV, seguro, habilitación…' },
    CUOTA: { label: 'Cuota préstamo', cls: 'bg-blue-100 text-blue-700', hint: 'Cuota mensual del préstamo/prenda de la unidad' },
    NEUMATICO: { label: 'Neumático', cls: 'bg-violet-100 text-violet-700', hint: 'Cubierta bajo mínimo legal — reposición próxima' },
    COBRO: { label: 'Cobro', cls: 'bg-green-100 text-green-700', hint: 'Facturación registrada pendiente de cobro (entrada de plata)' },
  };

  return (
    <div className="space-y-3">
      {/* Selector de período + cotizador */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-neutral-500">Período:</span>
        {[30, 60, 90, 180].map((d) => (
          <button key={d} onClick={() => setDias(d)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${dias === d ? 'bg-blue-600 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}>
            {d}d
          </button>
        ))}
        <button onClick={() => setCotizador({ abierto: true, unidadId: '', km: '', diasViaje: '1', margenPct: '20' })}
          title="Cuánto cobrar mínimo un viaje: costo/km real de la unidad + costo fijo diario + margen"
          className="ml-auto rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 inline-flex items-center gap-1">
          <DollarSign className="h-3.5 w-3.5" /> Cotizar viaje
        </button>
      </div>

      {/* Semáforo de alertas accionables */}
      {(data.alertas || []).length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800 flex items-center gap-1">
            Semáforo — qué atender ya
            <Hint text="Alertas automáticas: cobros vencidos, unidades para renovar, consumo sospechoso, declive y unidades bajo el punto de equilibrio." />
          </div>
          <ul className="divide-y divide-neutral-50">
            {(data.alertas || []).slice(0, 12).map((a, i) => (
              <li key={i} className="px-3 py-2 flex items-start gap-2 text-xs">
                <span className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${a.severidad === 'ROJO' ? 'bg-red-500' : 'bg-amber-400'}`} />
                <div className="flex-1">
                  <span className="font-medium text-neutral-800">
                    {a.vehiculoId ? <Link href={`/flota-360/vehiculos/${a.vehiculoId}`} className="text-blue-700 hover:underline">{a.titulo}</Link> : a.titulo}
                  </span>
                  <span className="text-neutral-500"> — {a.detalle}</span>
                </div>
                <span className="text-[9px] uppercase text-neutral-400 shrink-0">{a.tipo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* KPIs de flota */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Ingresos', value: fmtMoney(data.totales.ingresos), cls: 'text-green-700', hint: 'Facturación registrada de todas las unidades en el período (ficha → Ingresos)' },
          { label: 'Costos', value: fmtMoney(data.totales.costos), cls: 'text-red-600', hint: 'Combustible + mantenimiento + facturas + multas (empresa) + cuotas + sueldo del chofer' },
          { label: 'Margen', value: fmtMoney(data.totales.margen), cls: data.totales.margen >= 0 ? 'text-green-700' : 'text-red-600', hint: 'Ingresos − costos del período. Negativo = la flota pierde plata' },
          { label: 'Km recorridos', value: data.totales.km.toLocaleString('es-AR'), cls: 'text-neutral-800', hint: 'Km estimados por odómetro (cargas de combustible y bitácora)' },
          { label: 'Por cobrar', value: fmtMoney(data.totales.pendienteCobro ?? 0), cls: 'text-blue-700', hint: 'Ingresos registrados aún no cobrados' },
          { label: 'Deuda flota', value: data.totales.deudaFlota ? fmtMoney(data.totales.deudaFlota) : '—', cls: 'text-red-700', hint: 'Saldo pendiente de todos los préstamos/prendas de unidades' },
          { label: 'Costo oportunidad', value: data.totales.costoOportunidad ? fmtMoney(data.totales.costoOportunidad) : '—', cls: 'text-amber-600', hint: 'Plata que dejó de entrar por unidades paradas en taller (ingreso/hora promedio × horas no disponibles)' },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-neutral-200 bg-white p-3" title={k.hint}>
            <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide flex items-center gap-1">{k.label} <Hint text={k.hint} /></p>
            <p className={`text-lg font-bold mt-1 ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>
      {(data.totales.unidadesEnDeclive ?? 0) > 0 && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <b>{data.totales.unidadesEnDeclive}</b> unidad{data.totales.unidadesEnDeclive === 1 ? '' : 'es'} en declive — 3 meses seguidos con margen negativo o en caída. Candidata{data.totales.unidadesEnDeclive === 1 ? '' : 's'} a vender o reasignar.
        </p>
      )}
      {data.totales.ingresos === 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Sin ingresos cargados en el período. Registrá facturación por unidad en la ficha del vehículo (sección "Ingresos") para habilitar margen y costo de oportunidad.
        </p>
      )}

      {/* Tabla por unidad */}
      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800">
          Rentabilidad por unidad — {data.periodo.dias} días
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-medium text-neutral-500 uppercase border-b border-neutral-100">
                <th className="px-3 py-2">Unidad</th>
                <th className="px-3 py-2 text-right">Km</th>
                <th className="px-3 py-2 text-right"><span className="inline-flex items-center gap-1">Ingresos <Hint text="Facturación de la unidad en el período (ficha → Ingresos)" /></span></th>
                <th className="px-3 py-2 text-right"><span className="inline-flex items-center gap-1">Costos <Hint text="Combustible + mantenimiento + facturas + multas (empresa) + cuotas préstamo + sueldo chofer" /></span></th>
                <th className="px-3 py-2 text-right"><span className="inline-flex items-center gap-1">Margen <Hint text="Ingresos − costos. Rojo = la unidad pierde plata" /></span></th>
                <th className="px-3 py-2 text-right"><span className="inline-flex items-center gap-1">Equilibrio <Hint text="Facturación mensual mínima para no perder: fijos (cuota+sueldo+documentos) + variable estimado por km" /></span></th>
                <th className="px-3 py-2 text-right">$/km</th>
                <th className="px-3 py-2 text-right"><span className="inline-flex items-center gap-1">L/100km <Hint text="Consumo: litros cargados ÷ km × 100. Menor = mejor" /></span></th>
                <th className="px-3 py-2 text-right"><span className="inline-flex items-center gap-1">Prev/Corr <Hint text="OTs preventivas vs correctivas. Lo ideal: más verde que rojo" /></span></th>
                <th className="px-3 py-2 text-right"><span className="inline-flex items-center gap-1">Uso <Hint text="Días que facturó vs días hábiles sin facturar (sin carga) del período" /></span></th>
                <th className="px-3 py-2 text-right"><span className="inline-flex items-center gap-1">Payback <Hint text="% del valor de compra ya recuperado vía margen acumulado desde la compra" /></span></th>
                <th className="px-3 py-2 text-right"><span className="inline-flex items-center gap-1">Cuotas <Hint text="Cuotas de préstamo pagadas/totales y costo del período" /></span></th>
              </tr>
            </thead>
            <tbody>
              {data.unidades.map((u) => (
                <tr key={u.vehiculoId} className="border-b border-neutral-50 hover:bg-neutral-50/50">
                  <td className="px-3 py-2">
                    <Link href={`/flota-360/vehiculos/${u.vehiculoId}`} className="font-semibold text-blue-700 hover:underline">{u.dominio}</Link>
                    {u.enDeclive && <span title="3 meses seguidos con margen negativo o en caída" className="ml-1 rounded bg-red-100 px-1 py-0.5 text-[9px] font-semibold text-red-700">EN DECLIVE</span>}
                    {u.renovacion?.recomendada && <span title={u.renovacion.motivo} className="ml-1 rounded bg-orange-100 px-1 py-0.5 text-[9px] font-semibold text-orange-700">RENOVAR?</span>}
                    {u.consumoAnomalo && <span title={`Últimas cargas ${u.consumoAnomalo.reciente} km/L vs histórico ${u.consumoAnomalo.historico} km/L`} className="ml-1 rounded bg-purple-100 px-1 py-0.5 text-[9px] font-semibold text-purple-700">CONSUMO −{u.consumoAnomalo.caidaPct}%</span>}
                    <p className="text-[10px] text-neutral-400">{u.tipo}{u.anio ? ` · ${u.anio}` : ''}
                      {u.vsMedianaTipo != null && <span className={u.vsMedianaTipo < -20 ? 'text-red-500 font-medium' : 'text-neutral-400'} title="Vs mediana de margen/día de unidades del mismo tipo"> · {u.vsMedianaTipo > 0 ? '+' : ''}{u.vsMedianaTipo}% vs tipo</span>}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-right">{u.kmRecorridos != null ? u.kmRecorridos.toLocaleString('es-AR') : '—'}</td>
                  <td className="px-3 py-2 text-right text-green-700">{u.ingresos > 0 ? fmtMoney(u.ingresos) : '—'}
                    {u.pendienteCobro > 0 && <p className="text-[9px] text-blue-500">{fmtMoney(u.pendienteCobro)} s/cobrar</p>}
                  </td>
                  <td className="px-3 py-2 text-right" title={`Comb ${fmtMoney(u.costos.combustible)} · Mant ${fmtMoney(u.costos.mantenimiento)} · Fact ${fmtMoney(u.costos.facturas)} · Multas ${fmtMoney(u.costos.multas)} · Cuotas ${fmtMoney(u.costos.cuotas)} · Personal ${fmtMoney(u.costos.personal || 0)}`}>{fmtMoney(u.costos.total)}</td>
                  <td className={`px-3 py-2 text-right font-bold ${u.margen >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtMoney(u.margen)}</td>
                  <td className="px-3 py-2 text-right">
                    {u.puntoEquilibrioMes > 0 ? (
                      <span className={u.bajoEquilibrio ? 'text-red-600 font-semibold' : 'text-neutral-600'} title={u.bajoEquilibrio ? 'Está facturando por debajo del punto de equilibrio' : 'Factura por encima del equilibrio'}>
                        {fmtMoney(u.puntoEquilibrioMes)}
                        {u.bajoEquilibrio && <p className="text-[9px] text-red-500">bajo equilibrio</p>}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">{u.margenPorKm != null ? `$${u.margenPorKm}` : '—'}</td>
                  <td className="px-3 py-2 text-right">{u.lts100km != null ? u.lts100km : '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="text-green-700">{u.preventivo.n}</span>
                    <span className="text-neutral-400"> / </span>
                    <span className={u.correctivo.n > u.preventivo.n ? 'text-red-600 font-semibold' : 'text-neutral-600'}>{u.correctivo.n}</span>
                  </td>
                  <td className="px-3 py-2 text-right" title={`${u.diasFacturados} días facturó · ${u.horasNoDisponible}h en taller`}>
                    {u.diasFacturados}<span className="text-neutral-400"> fact.</span>
                    {u.diasSinFacturar > 0 && <p className="text-[9px] text-amber-600">{u.diasSinFacturar} sin carga</p>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {u.payback ? (
                      <span title={`Recuperó ${fmtMoney(u.payback.recuperado)} de ${fmtMoney(u.valorAdquisicion)}${u.payback.mesesEstimado ? ` — payback estimado en ${u.payback.mesesEstimado} meses` : ''}`}>
                        <span className={`font-semibold ${u.payback.pct >= 100 ? 'text-green-700' : u.payback.pct >= 50 ? 'text-blue-700' : 'text-neutral-600'}`}>{u.payback.pct}%</span>
                        {u.payback.mesesEstimado && u.payback.pct < 100 && <p className="text-[9px] text-neutral-400">~{u.payback.mesesEstimado}m restantes</p>}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {u.financiacion ? (
                      <span title={`Cuota ${fmtMoney(u.financiacion.cuotaMensual)} — saldo ${fmtMoney(u.financiacion.saldoPendiente)}`}>
                        {u.financiacion.cuotasPagadas}/{u.financiacion.cuotasTotales}
                        <p className="text-[9px] text-neutral-400">{fmtMoney(u.financiacion.costoPeriodo)} período</p>
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Clientes */}
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800 flex items-center gap-1">
            Ingresos por cliente <Hint text="Qué cliente aporta más facturación. Se lee del campo 'Cliente' al registrar ingresos en la ficha de la unidad." />
          </div>
          {(data.clientes || []).length === 0 ? (
            <p className="px-3 py-4 text-xs text-neutral-400">Cargá el campo "Cliente" al registrar ingresos para ver este ranking</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] font-medium text-neutral-500 uppercase border-b border-neutral-100">
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2 text-right">Ingresos</th>
                  <th className="px-3 py-2 text-right"><span className="inline-flex items-center gap-0.5">DSO <Hint text="Días promedio de cobro: cuánto tarda en pagar este cliente desde que se registra el ingreso. Menor = mejor." /></span></th>
                  <th className="px-3 py-2 text-right"><span className="inline-flex items-center gap-0.5">Vencido <Hint text="Plata que este cliente adeuda pasada la fecha de cobro" /></span></th>
                  <th className="px-3 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {data.clientes.map((c) => (
                  <tr key={c.cliente} className="border-b border-neutral-50">
                    <td className="px-3 py-2 font-medium">{c.cliente}</td>
                    <td className="px-3 py-2 text-right text-green-700">{fmtMoney(c.ingresos)}
                      {(c.pendiente ?? 0) > 0 && <p className="text-[9px] text-blue-500">{fmtMoney(c.pendiente!)} s/cobrar</p>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {c.dsoDias != null ? (
                        <span className={c.dsoDias > 45 ? 'text-red-600 font-semibold' : c.dsoDias > 30 ? 'text-amber-600' : 'text-emerald-600'} title="Días promedio que tarda en pagar">
                          {c.dsoDias}d
                        </span>
                      ) : <span className="text-neutral-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {(c.vencido ?? 0) > 0 ? <span className="text-red-600 font-semibold">{fmtMoney(c.vencido!)}</span> : <span className="text-neutral-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-block rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{c.share}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Talleres */}
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800 flex items-center gap-1">
            Talleres externos <Hint text="Ranking de talleres por OTs completadas: cuánto cobran, cuánto demoran y cuántas veces hubo que volver (reclamos)." />
          </div>
          {data.talleres.length === 0 ? (
            <p className="px-3 py-4 text-xs text-neutral-400">Sin OTs externas completadas en el período</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] font-medium text-neutral-500 uppercase border-b border-neutral-100">
                  <th className="px-3 py-2">Taller</th>
                  <th className="px-3 py-2 text-right">OTs</th>
                  <th className="px-3 py-2 text-right">Costo</th>
                  <th className="px-3 py-2 text-right">Demora prom.</th>
                  <th className="px-3 py-2 text-right">Reclamos</th>
                </tr>
              </thead>
              <tbody>
                {data.talleres.map((t) => (
                  <tr key={t.tallerId} className="border-b border-neutral-50">
                    <td className="px-3 py-2 font-medium">{t.nombre}</td>
                    <td className="px-3 py-2 text-right">{t.ots}</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(t.costoTotal)}</td>
                    <td className="px-3 py-2 text-right">{t.demoraPromHs != null ? `${Math.round(t.demoraPromHs / 24)}d` : '—'}</td>
                    <td className={`px-3 py-2 text-right ${t.reclamos > 0 ? 'text-red-600 font-semibold' : ''}`}>{t.reclamos || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Conductores */}
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800 flex items-center gap-1">
            Conductores <Hint text="Horas trabajadas, eficiencia de combustible (km/L), litros cargados, jornadas >12h y multas del período. El sueldo se carga en la ficha del conductor." />
          </div>
          {data.conductores.length === 0 ? (
            <p className="px-3 py-4 text-xs text-neutral-400">Sin registros de jornada ni cargas en el período</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] font-medium text-neutral-500 uppercase border-b border-neutral-100">
                  <th className="px-3 py-2">Conductor</th>
                  <th className="px-3 py-2 text-right">Hs trab.</th>
                  <th className="px-3 py-2 text-right">km/L prom.</th>
                  <th className="px-3 py-2 text-right"><span className="inline-flex items-center gap-0.5">Produce <Hint text="Ingresos de su unidad asignada ÷ su sueldo del período. Ej: 3x = cada $ de sueldo genera $3 de facturación" /></span></th>
                  <th className="px-3 py-2 text-right">Litros</th>
                  <th className="px-3 py-2 text-right">Jornadas &gt;12h</th>
                  <th className="px-3 py-2 text-right">Multas</th>
                </tr>
              </thead>
              <tbody>
                {data.conductores.map((c) => (
                  <tr key={c.conductorId} className="border-b border-neutral-50">
                    <td className="px-3 py-2 font-medium">{c.nombre}
                      {c.unidadDominio && <p className="text-[9px] text-neutral-400">{c.unidadDominio}</p>}
                    </td>
                    <td className="px-3 py-2 text-right">{c.horasTrabajadas}</td>
                    <td className="px-3 py-2 text-right">{c.rendimientoPromKmL ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {c.retornoSueldo != null ? (
                        <span className={c.retornoSueldo < 2 ? 'text-red-600 font-semibold' : c.retornoSueldo < 3 ? 'text-amber-600' : 'text-emerald-600'}
                          title={c.unidadDominio ? `Margen de ${c.unidadDominio}: ${fmtMoney(c.margenUnidad ?? 0)} — sueldo período ${fmtMoney(c.sueldoPeriodo ?? 0)}` : undefined}>
                          {c.retornoSueldo}x
                        </span>
                      ) : <span className="text-neutral-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right">{c.litrosCargados || '—'}</td>
                    <td className={`px-3 py-2 text-right ${c.jornadasExcesivas > 0 ? 'text-amber-600 font-semibold' : ''}`}>{c.jornadasExcesivas || '—'}</td>
                    <td className="px-3 py-2 text-right">{c.multasPagadas > 0 ? fmtMoney(c.multasPagadas) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Simulador: si compro otra unidad */}
      {(data.porTipo || []).length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800 flex items-center gap-1">
            Si compro otra unidad…
            <Hint text="Proyección basada en el promedio real de tus unidades de cada tipo: qué margen mensual esperaría una unidad nueva del mismo tipo, su fijo mensual y km típicos." />
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-medium text-neutral-500 uppercase border-b border-neutral-100">
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2 text-right">Tienes</th>
                <th className="px-3 py-2 text-right">Factura prom/mes</th>
                <th className="px-3 py-2 text-right">Margen prom/mes</th>
                <th className="px-3 py-2 text-right">Km prom/mes</th>
                <th className="px-3 py-2 text-right">$/km variable</th>
                <th className="px-3 py-2 text-right">Fijo mensual</th>
              </tr>
            </thead>
            <tbody>
              {data.porTipo!.map((t) => (
                <tr key={t.tipo} className="border-b border-neutral-50">
                  <td className="px-3 py-2 font-medium">{t.tipo === 'CAMION' ? 'Tractor' : t.tipo === 'SEMI' ? 'Semi' : t.tipo}</td>
                  <td className="px-3 py-2 text-right">{t.unidades}</td>
                  <td className="px-3 py-2 text-right text-green-700">{fmtMoney(t.ingresoMesProm)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${t.margenMesProm >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtMoney(t.margenMesProm)}</td>
                  <td className="px-3 py-2 text-right">{t.kmMesProm != null ? t.kmMesProm.toLocaleString('es-AR') : '—'}</td>
                  <td className="px-3 py-2 text-right">{t.costoVarKmProm != null ? `$${t.costoVarKmProm}` : '—'}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(t.costoFijoMesProm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-[10px] text-neutral-400">Promedios reales de tu flota por tipo. El margen estimado ya descuenta combustible, mantenimiento, cuotas y sueldo.</p>
        </div>
      )}

      {/* Cash flow proyectado */}
      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <div className="px-3 py-2 border-b border-neutral-200 flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-semibold text-neutral-800 flex items-center gap-1">
            Cash flow proyectado — próximos {cashFlow?.horizonte.dias ?? 90} días
            <Hint text="Egresos comprometidos (cuotas, vencimientos, cubiertas) vs cobros pendientes de ingresos registrados. Neto = cobros − egresos." />
          </span>
          {cashFlow && (
            <span className="text-xs flex items-center gap-3">
              {cashFlow.totalCobros != null && cashFlow.totalCobros > 0 && (
                <span>Entradas <b className="text-green-700">+{fmtMoney(cashFlow.totalCobros)}</b></span>
              )}
              <span>Salidas <b className="text-red-600">−{fmtMoney(cashFlow.total)}</b></span>
              {cashFlow.neto != null && (
                <span>Neto <b className={cashFlow.neto >= 0 ? 'text-green-700' : 'text-red-600'}>{fmtMoney(cashFlow.neto)}</b></span>
              )}
              {cashFlow.deudaFlota != null && cashFlow.deudaFlota > 0 && (
                <span className="text-neutral-400" title="Saldo total pendiente de préstamos de flota">deuda {fmtMoney(cashFlow.deudaFlota)}</span>
              )}
              {cashFlow.sinMonto > 0 && <span className="text-neutral-400">{cashFlow.sinMonto} sin monto</span>}
            </span>
          )}
        </div>
        {!cashFlow || cashFlow.items.length === 0 ? (
          <p className="px-3 py-4 text-xs text-neutral-400">Sin egresos comprometidos en el horizonte</p>
        ) : (
          <table className="w-full text-xs">
            <tbody>
              {cashFlow.items.slice(0, 30).map((it, i) => {
                const t = TIPO_ITEM[it.tipo] || { label: it.tipo, cls: 'bg-neutral-100 text-neutral-600', hint: it.tipo };
                return (
                  <tr key={i} className={`border-b border-neutral-50 ${it.vencido ? 'bg-red-50/40' : ''}`}>
                    <td className="px-3 py-1.5 w-24 text-neutral-500">{new Date(it.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}{it.vencido && <p className="text-[9px] text-red-600 font-semibold">vencido</p>}</td>
                    <td className="px-3 py-1.5 w-28"><span title={t.hint} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${t.cls}`}>{t.label}</span></td>
                    <td className="px-3 py-1.5">{it.vehiculo && <b className="mr-1">{it.vehiculo}</b>}{it.descripcion}</td>
                    <td className={`px-3 py-1.5 text-right font-medium ${it.entrada ? 'text-green-700' : ''}`}>{it.monto != null ? `${it.entrada ? '+' : '−'}${fmtMoney(it.monto)}` : <span className="text-neutral-400">s/est.</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal cotizador de viaje mínimo */}
      {cotizador?.abierto && (() => {
        const u = data.unidades.find((x) => x.vehiculoId === cotizador.unidadId);
        const km = Number(cotizador.km) || 0;
        const dViaje = Number(cotizador.diasViaje) || 1;
        const margenPct = Number(cotizador.margenPct) || 0;
        const fijoDia = u ? u.costoFijoMes / 30.44 : 0;
        const varKm = u?.costoVarPorKm ?? null;
        const costoViaje = u ? Math.round((varKm ?? 0) * km + fijoDia * dViaje) : null;
        const precioSugerido = costoViaje != null ? Math.round(costoViaje * (1 + margenPct / 100)) : null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setCotizador(null)}>
            <div className="w-full max-w-md rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5"><DollarSign className="h-4 w-4 text-green-600" /> Cotizar viaje mínimo</h3>
                <button onClick={() => setCotizador(null)}><X className="h-4 w-4 text-neutral-400" /></button>
              </div>
              <div className="p-4 space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Unidad</label>
                  <select value={cotizador.unidadId} onChange={(e) => setCotizador({ ...cotizador, unidadId: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="">Elegir unidad…</option>
                    {data.unidades.map((x) => <option key={x.vehiculoId} value={x.vehiculoId}>{x.dominio} — {x.tipo === 'CAMION' ? 'Tractor' : x.tipo}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Km del viaje</label>
                    <input type="number" min={0} value={cotizador.km} onChange={(e) => setCotizador({ ...cotizador, km: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Días</label>
                    <input type="number" min={1} step={0.5} value={cotizador.diasViaje} onChange={(e) => setCotizador({ ...cotizador, diasViaje: e.target.value })} title="Días que la unidad queda ocupada (cubre su costo fijo: cuota, sueldo, seguro)" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Margen %</label>
                    <input type="number" min={0} value={cotizador.margenPct} onChange={(e) => setCotizador({ ...cotizador, margenPct: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                  </div>
                </div>
                {u && (
                  <div className="rounded-lg bg-neutral-50 p-3 space-y-1.5 text-xs">
                    <p className="text-neutral-500">Costo variable: <b>${varKm ?? '—'}/km</b> · Fijo diario: <b>{fmtMoney(Math.round(fijoDia))}</b> (cuota + sueldo + documentos)</p>
                    {costoViaje != null && km > 0 ? (
                      <>
                        <p className="text-neutral-700">Costo del viaje: <b>{fmtMoney(costoViaje)}</b> ({km.toLocaleString('es-AR')} km × ${varKm} + {dViaje}d × {fmtMoney(Math.round(fijoDia))})</p>
                        <p className="text-green-700 font-bold text-base">Cobrar mínimo: {fmtMoney(precioSugerido!)} <span className="text-xs font-normal text-neutral-500">(+{margenPct}% margen)</span></p>
                        <p className="text-neutral-500">Equivale a ${Math.round((precioSugerido! / km) * 100) / 100}/km facturado</p>
                        {varKm == null && <p className="text-amber-600">Sin km medidos aún — el cálculo usa solo el costo fijo diario.</p>}
                      </>
                    ) : (
                      <p className="text-neutral-400">Ingresá los km del viaje para calcular.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
