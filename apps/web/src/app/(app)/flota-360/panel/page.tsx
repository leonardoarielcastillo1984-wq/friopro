'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  LayoutDashboard, Users, TrendingUp, AlertTriangle, CheckCircle2,
  Truck, Wrench, CalendarClock, Disc, FileWarning, AlertOctagon,
  DollarSign, Gauge, Medal, ChevronDown, ChevronUp, Fuel, Pencil, X,
} from 'lucide-react';

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
  alertas: { tipo: string; severidad: string; titulo: string; detalle: string; link: string }[];
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
  rankingUnidades: { id: string; dominio: string; tipo: string; combustible: number; facturas: number }[];
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
  const [tab, setTab] = useState<'flota' | 'conductores' | 'ejecutivo'>('flota');

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-bold text-[#0d1b3d]">Panel de flota</h1>
        <p className="text-xs text-neutral-500">Analítica para administración y dirección</p>
      </div>

      <div className="flex items-center gap-0.5 border border-neutral-200 bg-white rounded-lg px-1 w-fit">
        {[
          { key: 'flota', label: 'Flota', icon: LayoutDashboard },
          { key: 'conductores', label: 'Ranking de conductores', icon: Users },
          { key: 'ejecutivo', label: 'Ejecutivo', icon: TrendingUp },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key as any)}
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
              {data.rankingUnidades.map((v, i) => (
                <li key={v.id} className="flex items-center gap-2.5 px-3 py-2">
                  <span className="w-5 text-center text-[11px] font-bold text-neutral-400">{i + 1}</span>
                  <Truck className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                  <Link href={`/flota-360/vehiculos/${v.id}`} className="flex-1 text-xs font-medium text-neutral-800 hover:text-blue-700 truncate">{v.dominio}</Link>
                  <span className="text-xs font-semibold text-neutral-800">{fmtMoney(Number(v.combustible) + Number(v.facturas))}</span>
                </li>
              ))}
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
