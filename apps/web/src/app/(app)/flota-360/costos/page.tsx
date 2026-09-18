'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { DollarSign, TrendingDown, TrendingUp, Gauge, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

type CostosTCO = {
  hayDatos: boolean;
  kpis: { costoTotalMes: number; costoPorKm: number | null; variacionVsMesAnterior: number | null; unidadesConDesvio: number };
  evolucion: { mes: string; combustible: number; mantenimiento: number; neumaticos: number; total: number }[];
  composicion: { combustible: number; mantenimiento: number; neumaticos: number };
  desvios: {
    vehiculoId: string; dominio: string; tipo: string;
    costoMes: number; costoMesAnterior: number; variacion: number | null;
    causaPrincipal: string | null;
    desglose: { combustible: number; mantenimiento: number; neumaticos: number };
  }[];
};

const TIPO_LABEL: Record<string, string> = {
  TRACTOR: 'Tractor', SEMI: 'Semi', CAMION: 'Camión', UTILITARIO: 'Utilitario',
};

function fmtMoney(n: number | null | undefined) {
  return n != null ? `$${Math.round(n).toLocaleString('es-AR')}` : '—';
}

export default function CostosPage() {
  const [data, setData] = useState<CostosTCO | null>(null);
  const [tco, setTco] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [c, t] = await Promise.all([
          apiFetch<CostosTCO>('/fleet-ops/costos-tco'),
          apiFetch<any>('/flota/tco/analisis').catch(() => null),
        ]);
        setData(c);
        setTco(t?.vehiculos || t?.analisis || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !data) return <div className="p-8 text-sm text-neutral-500">Cargando…</div>;

  const { kpis, evolucion, composicion, desvios } = data;
  const maxTotal = Math.max(...evolucion.map((m) => m.total), 1);
  const compTotal = composicion.combustible + composicion.mantenimiento + composicion.neumaticos;

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-bold text-[#0d1b3d]">Costos y TCO</h1>
        <p className="text-xs text-neutral-500">Vista ejecutiva del costo operativo de flota</p>
      </div>

      {!data.hayDatos ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-400 text-center">Sin datos suficientes de costos este mes</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] font-medium uppercase mb-1"><DollarSign className="h-3.5 w-3.5" /> Costo total del mes</div>
              <p className="text-xl font-bold text-neutral-900">{fmtMoney(kpis.costoTotalMes)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] font-medium uppercase mb-1"><Gauge className="h-3.5 w-3.5" /> Costo por km</div>
              <p className="text-xl font-bold text-neutral-900">{kpis.costoPorKm != null ? `$${kpis.costoPorKm}` : '—'}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] font-medium uppercase mb-1">
                {kpis.variacionVsMesAnterior != null && kpis.variacionVsMesAnterior > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                Variación vs. mes anterior
              </div>
              <p className={`text-xl font-bold ${kpis.variacionVsMesAnterior == null ? 'text-neutral-400' : kpis.variacionVsMesAnterior <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {kpis.variacionVsMesAnterior != null ? `${kpis.variacionVsMesAnterior > 0 ? '+' : ''}${kpis.variacionVsMesAnterior}%` : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] font-medium uppercase mb-1"><AlertTriangle className="h-3.5 w-3.5" /> Unidades con desvío</div>
              <p className={`text-xl font-bold ${kpis.unidadesConDesvio > 0 ? 'text-amber-600' : 'text-neutral-900'}`}>{kpis.unidadesConDesvio}</p>
              <p className="text-[11px] text-neutral-400">&gt;20% vs. mes anterior</p>
            </div>
          </div>

          {/* Evolución mensual + composición */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3">
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <h3 className="text-xs font-semibold text-neutral-800 mb-3">Evolución de costos (últimos 6 meses)</h3>
              <div className="flex items-end gap-2 h-36">
                {evolucion.map((m) => (
                  <div key={m.mes} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <span className="text-[10px] font-medium text-neutral-600">{m.total > 0 ? `$${(m.total / 1000).toFixed(0)}k` : ''}</span>
                    <div className="w-full flex flex-col-reverse rounded-sm overflow-hidden" style={{ height: 100 }}>
                      {m.total > 0 && (
                        <>
                          <div className="bg-blue-500" style={{ height: `${(m.combustible / maxTotal) * 100}%` }} title={`Combustible ${fmtMoney(m.combustible)}`} />
                          <div className="bg-amber-500" style={{ height: `${(m.mantenimiento / maxTotal) * 100}%` }} title={`Mantenimiento ${fmtMoney(m.mantenimiento)}`} />
                          <div className="bg-purple-500" style={{ height: `${(m.neumaticos / maxTotal) * 100}%` }} title={`Neumáticos ${fmtMoney(m.neumaticos)}`} />
                        </>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-400 capitalize">{m.mes}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-neutral-500">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-500 inline-block" /> Combustible</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500 inline-block" /> Mantenimiento</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-purple-500 inline-block" /> Neumáticos</span>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <h3 className="text-xs font-semibold text-neutral-800 mb-3">Composición del mes</h3>
              {compTotal === 0 ? (
                <p className="text-xs text-neutral-400">Sin costos registrados este mes</p>
              ) : (
                <div className="space-y-2.5">
                  {[
                    { label: 'Combustible', valor: composicion.combustible, color: 'bg-blue-500' },
                    { label: 'Mantenimiento', valor: composicion.mantenimiento, color: 'bg-amber-500' },
                    { label: 'Neumáticos', valor: composicion.neumaticos, color: 'bg-purple-500' },
                  ].map((c) => (
                    <div key={c.label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-neutral-600">{c.label}</span>
                        <span className="font-semibold text-neutral-800">{fmtMoney(c.valor)} <span className="text-neutral-400 font-normal">({compTotal > 0 ? Math.round((c.valor / compTotal) * 100) : 0}%)</span></span>
                      </div>
                      <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                        <div className={`h-full rounded-full ${c.color}`} style={{ width: `${compTotal > 0 ? (c.valor / compTotal) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mayores desvíos */}
          <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
            <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800">Costo por unidad y desvíos del mes</div>
            {desvios.length === 0 ? (
              <p className="px-3 py-4 text-xs text-neutral-400">Sin costos por unidad en el período</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left font-medium px-2.5 py-2">Unidad</th>
                    <th className="text-left font-medium px-2.5 py-2">Costo mes</th>
                    <th className="text-left font-medium px-2.5 py-2">Mes anterior</th>
                    <th className="text-left font-medium px-2.5 py-2">Variación</th>
                    <th className="text-left font-medium px-2.5 py-2">Causa principal</th>
                    <th className="text-left font-medium px-2.5 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {desvios.map((d) => (
                    <Fragment key={d.vehiculoId}>
                      <tr className="hover:bg-neutral-50 cursor-pointer" onClick={() => setExpandido(expandido === d.vehiculoId ? null : d.vehiculoId)}>
                        <td className="px-2.5 py-2 font-medium text-neutral-800">
                          {d.dominio}
                          <div className="text-[11px] text-neutral-400">{TIPO_LABEL[d.tipo] || d.tipo}</div>
                        </td>
                        <td className="px-2.5 py-2 font-semibold text-neutral-900">{fmtMoney(d.costoMes)}</td>
                        <td className="px-2.5 py-2 text-neutral-500">{fmtMoney(d.costoMesAnterior)}</td>
                        <td className="px-2.5 py-2">
                          {d.variacion != null ? (
                            <span className={`inline-flex items-center gap-0.5 font-semibold ${d.variacion > 20 ? 'text-red-600' : d.variacion > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                              {d.variacion > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {d.variacion > 0 ? '+' : ''}{d.variacion}%
                            </span>
                          ) : <span className="text-neutral-400">—</span>}
                        </td>
                        <td className="px-2.5 py-2 text-neutral-600">{d.causaPrincipal || '—'}</td>
                        <td className="px-2.5 py-2 text-neutral-400">
                          {expandido === d.vehiculoId ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </td>
                      </tr>
                      {expandido === d.vehiculoId && (
                        <tr className="bg-neutral-50">
                          <td colSpan={6} className="px-4 py-2.5">
                            <div className="flex items-center gap-6 text-xs">
                              <span className="text-neutral-500">Combustible: <b className="text-neutral-800">{fmtMoney(d.desglose.combustible)}</b></span>
                              <span className="text-neutral-500">Mantenimiento: <b className="text-neutral-800">{fmtMoney(d.desglose.mantenimiento)}</b></span>
                              <span className="text-neutral-500">Neumáticos: <b className="text-neutral-800">{fmtMoney(d.desglose.neumaticos)}</b></span>
                              <Link href={`/flota-360/vehiculos/${d.vehiculoId}`} className="ml-auto text-blue-600 hover:underline font-medium">Ver ficha del activo</Link>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* TCO por vehículo */}
      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800">Costo por km por vehículo (TCO)</div>
        {tco.length === 0 ? (
          <p className="px-3 py-4 text-xs text-neutral-400">Sin datos suficientes de TCO</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-2.5 py-2">Vehículo</th>
                <th className="text-left font-medium px-2.5 py-2">Combustible</th>
                <th className="text-left font-medium px-2.5 py-2">Mantenimiento</th>
                <th className="text-left font-medium px-2.5 py-2">Neumáticos</th>
                <th className="text-left font-medium px-2.5 py-2">Total</th>
                <th className="text-left font-medium px-2.5 py-2">Costo/km</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {tco.map((v: any, i: number) => (
                <tr key={i} className="hover:bg-neutral-50">
                  <td className="px-2.5 py-2 font-medium text-neutral-800">
                    {v.vehiculoId ? <Link href={`/flota-360/vehiculos/${v.vehiculoId}`} className="hover:text-blue-700">{v.dominio || v.vehiculo}</Link> : (v.dominio || v.vehiculo)}
                  </td>
                  <td className="px-2.5 py-2 text-neutral-600">{fmtMoney(v.costoCombustible ?? v.combustible)}</td>
                  <td className="px-2.5 py-2 text-neutral-600">{fmtMoney(v.costoMantenimiento ?? v.mantenimiento)}</td>
                  <td className="px-2.5 py-2 text-neutral-600">{fmtMoney(v.costoNeumaticos ?? v.neumaticos)}</td>
                  <td className="px-2.5 py-2 font-medium text-neutral-800">{fmtMoney(v.costoTotal ?? v.total)}</td>
                  <td className="px-2.5 py-2 text-neutral-600">{v.costoPorKm != null ? `$${Number(v.costoPorKm).toLocaleString('es-AR')}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
