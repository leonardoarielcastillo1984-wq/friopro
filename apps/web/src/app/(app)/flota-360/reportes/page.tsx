'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { FileBarChart, ExternalLink, AlertTriangle, TrendingDown, Leaf, CircleDot, Gauge, DollarSign, ShieldAlert, Fuel } from 'lucide-react';

type Predictivo = {
  cubiertas: any[];
  combustible: any[];
  huellaCarbono: { litrosTotal: number; co2TotalKg: number; co2TotalTn: number; ultimos12Meses: any[] };
  parametros: { profLimiteMm: number; umbralDesvioPct: number };
};

type Kpis = {
  flota: { totalVehiculos: number; activos: number; enTaller: number; disponibilidadPct: number | null; edadPromedioAnios: number | null; odometroPromedio: number | null };
  costos: any[];
  mantenimiento: { costoPreventivo: number; costoCorrectivo: number; preventivoPct: number | null; correctivoPct: number | null };
  utilizacion: any[];
  combustible: any[];
  outliersCombustible: any[];
  cubiertas: any[];
  seguridad: { incidentesPor100k: any[]; multasPorChofer: any[]; controles: { total: number; noAptos: number; pctNoApto: number | null; fatigaAlta: number; alcoholemiaPositiva: number } };
  co2PorKm: any[];
};

const ESTADO_CUBIERTA: Record<string, string> = {
  VENCIDA: 'bg-red-100 text-red-700',
  CRITICO: 'bg-red-50 text-red-700',
  PROXIMO: 'bg-amber-50 text-amber-700',
  OK: 'bg-green-50 text-green-700',
};
const ESTADO_L: Record<string, string> = {
  VENCIDA: 'Vencida',
  CRITICO: 'Crítico',
  PROXIMO: 'Próximo',
  OK: 'OK',
};

const fmt$ = (n: number | null | undefined) => n != null ? `$${n.toLocaleString('es-AR')}` : '—';

export default function ReportesFlotaPage() {
  const [data, setData] = useState<Predictivo | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<Predictivo>('/fleet-ops/predictivo').catch(() => null),
      apiFetch<Kpis>('/fleet-ops/kpis').catch(() => null),
    ]).then(([p, k]) => { setData(p); setKpis(k); })
      .finally(() => setLoading(false));
  }, []);

  const alertasCombustible = data?.combustible.filter(c => c.alerta) || [];
  const cubiertasCriticas = data?.cubiertas.filter(c => c.estado !== 'OK') || [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Reportes</h1>
        <p className="text-sm text-neutral-500">Mantenimiento predictivo, huella de carbono y reportes generales</p>
      </div>

      {/* Alertas predictivas */}
      {!loading && (cubiertasCriticas.length > 0 || alertasCombustible.length > 0) && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>
            {cubiertasCriticas.length > 0 && <strong>{cubiertasCriticas.length} cubierta{cubiertasCriticas.length !== 1 ? 's' : ''} próxima{cubiertasCriticas.length !== 1 ? 's' : ''} al límite. </strong>}
            {alertasCombustible.length > 0 && <strong>{alertasCombustible.length} vehículo{alertasCombustible.length !== 1 ? 's' : ''} con consumo anómalo.</strong>}
          </span>
        </div>
      )}

      {/* ══ KPIs DE FLOTA ══ */}
      {kpis && (
        <>
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
              <p className="text-xs text-neutral-500">Disponibilidad</p>
              <p className="text-lg font-semibold text-neutral-900">{kpis.flota.disponibilidadPct != null ? `${kpis.flota.disponibilidadPct}%` : '—'}</p>
              <p className="text-xs text-neutral-400">{kpis.flota.activos} activas · {kpis.flota.enTaller} en taller</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
              <p className="text-xs text-neutral-500">Edad promedio</p>
              <p className="text-lg font-semibold text-neutral-900">{kpis.flota.edadPromedioAnios != null ? `${kpis.flota.edadPromedioAnios} años` : '—'}</p>
              <p className="text-xs text-neutral-400">{kpis.flota.totalVehiculos} unidades</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
              <p className="text-xs text-neutral-500">Odómetro promedio</p>
              <p className="text-lg font-semibold text-neutral-900">{kpis.flota.odometroPromedio != null ? `${kpis.flota.odometroPromedio.toLocaleString('es-AR')} km` : '—'}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
              <p className="text-xs text-neutral-500">Preventivo vs correctivo</p>
              <p className="text-lg font-semibold text-neutral-900">{kpis.mantenimiento.preventivoPct != null ? `${kpis.mantenimiento.preventivoPct}% / ${kpis.mantenimiento.correctivoPct}%` : '—'}</p>
              <p className="text-xs text-neutral-400">{fmt$(kpis.mantenimiento.costoPreventivo)} prev · {fmt$(kpis.mantenimiento.costoCorrectivo)} corr</p>
            </div>
          </div>

          {/* CPK por vehículo */}
          <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
            <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-neutral-900">Costo por km (CPK)</h2>
              <span className="text-xs text-neutral-400">combustible + mantenimiento + facturas + multas / km recorridos</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Vehículo</th>
                  <th className="text-left font-medium px-3 py-2">Km</th>
                  <th className="text-left font-medium px-3 py-2">Combustible</th>
                  <th className="text-left font-medium px-3 py-2">Mantenim.</th>
                  <th className="text-left font-medium px-3 py-2">Facturas</th>
                  <th className="text-left font-medium px-3 py-2">Multas</th>
                  <th className="text-left font-medium px-3 py-2">Total</th>
                  <th className="text-left font-medium px-3 py-2">CPK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {kpis.costos.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-neutral-400">Sin datos de costos</td></tr>}
                {kpis.costos.map(c => (
                  <tr key={c.vehiculoId} className="hover:bg-neutral-50">
                    <td className="px-3 py-2 font-medium text-neutral-800">{c.vehiculo}</td>
                    <td className="px-3 py-2 text-neutral-600">{c.kmRecorridos.toLocaleString('es-AR')}</td>
                    <td className="px-3 py-2 text-neutral-600">{fmt$(c.costoCombustible)}</td>
                    <td className="px-3 py-2 text-neutral-600">{fmt$(c.costoMantenimiento)}</td>
                    <td className="px-3 py-2 text-neutral-600">{fmt$(c.costoFacturas)}</td>
                    <td className="px-3 py-2 text-neutral-600">{fmt$(c.costoMultas)}</td>
                    <td className="px-3 py-2 text-neutral-600">{fmt$(c.costoTotal)}</td>
                    <td className="px-3 py-2 font-semibold text-neutral-800">{c.cpk != null ? `$${c.cpk}/km` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* L/100km + outliers + km/día */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
              <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
                <Fuel className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-neutral-900">Consumo L/100km</h2>
                <span className="text-xs text-neutral-400">ranking entre unidades del mismo modelo</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Vehículo</th>
                    <th className="text-left font-medium px-3 py-2">Modelo</th>
                    <th className="text-left font-medium px-3 py-2">L/100km</th>
                    <th className="text-left font-medium px-3 py-2">$/km comb.</th>
                    <th className="text-left font-medium px-3 py-2">Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {kpis.combustible.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-400">Sin datos</td></tr>}
                  {kpis.combustible.map(c => (
                    <tr key={c.vehiculoId} className="hover:bg-neutral-50">
                      <td className="px-3 py-2 font-medium text-neutral-800">{c.vehiculo}</td>
                      <td className="px-3 py-2 text-neutral-600 text-xs">{c.modelo}</td>
                      <td className="px-3 py-2 font-semibold text-neutral-800">{c.l100km}</td>
                      <td className="px-3 py-2 text-neutral-600">{c.costoPorKm != null ? `$${c.costoPorKm}` : '—'}</td>
                      <td className="px-3 py-2 text-neutral-600">{c.grupoModelo > 1 ? `${c.rankingModelo}°/${c.grupoModelo}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-4">
              {kpis.outliersCombustible.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-white overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-red-100 px-4 py-3">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <h2 className="text-sm font-semibold text-neutral-900">Cargas anómalas</h2>
                    <span className="text-xs text-neutral-400">rendimiento &lt;70% de la media — posible robo o carga irregular</span>
                  </div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-neutral-100">
                      {kpis.outliersCombustible.slice(0, 5).map((o, i) => (
                        <tr key={i} className="hover:bg-neutral-50">
                          <td className="px-3 py-2 font-medium text-neutral-800">{o.vehiculo}</td>
                          <td className="px-3 py-2 text-neutral-600 text-xs">{new Date(o.fecha).toLocaleDateString('es-AR')}</td>
                          <td className="px-3 py-2 text-neutral-600">{o.rendimiento} vs {o.mediaVehiculo} km/L</td>
                          <td className="px-3 py-2"><span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700">{o.desvioPct}%</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
                <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
                  <Gauge className="h-4 w-4 text-purple-600" />
                  <h2 className="text-sm font-semibold text-neutral-900">Utilización (km/día)</h2>
                  <span className="text-xs text-neutral-400">menor = subutilizada</span>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-neutral-100">
                    {kpis.utilizacion.length === 0 && <tr><td className="px-3 py-6 text-center text-neutral-400">Sin datos de odómetro</td></tr>}
                    {kpis.utilizacion.slice(0, 6).map(u => (
                      <tr key={u.vehiculoId} className="hover:bg-neutral-50">
                        <td className="px-3 py-2 font-medium text-neutral-800">{u.vehiculo}</td>
                        <td className="px-3 py-2 text-neutral-600">{u.status}</td>
                        <td className="px-3 py-2 font-semibold text-neutral-800 text-right">{u.kmPorDia} km/día</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Cubiertas costo/km + Seguridad + CO2/km */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
              <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
                <CircleDot className="h-4 w-4 text-neutral-600" />
                <h2 className="text-sm font-semibold text-neutral-900">Cubierta — costo/km</h2>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-neutral-100">
                  {kpis.cubiertas.length === 0 && <tr><td className="px-3 py-6 text-center text-neutral-400">Sin datos</td></tr>}
                  {kpis.cubiertas.slice(0, 6).map(c => (
                    <tr key={c.neumaticoId} className="hover:bg-neutral-50">
                      <td className="px-3 py-2 font-medium text-neutral-800">{c.codigo}<span className="block text-xs font-normal text-neutral-400">{c.marca || ''} · {c.recaps} recap{c.recaps !== 1 ? 's' : ''}</span></td>
                      <td className="px-3 py-2 text-neutral-600 text-right">{c.kmAcumulados.toLocaleString('es-AR')} km</td>
                      <td className="px-3 py-2 font-semibold text-neutral-800 text-right">${c.costoPorKm}/km</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
              <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
                <ShieldAlert className="h-4 w-4 text-orange-600" />
                <h2 className="text-sm font-semibold text-neutral-900">Seguridad</h2>
              </div>
              <div className="px-4 py-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-neutral-600">Controles pre-servicio</span><span className="font-semibold">{kpis.seguridad.controles.total}</span></div>
                <div className="flex justify-between"><span className="text-neutral-600">No aptos</span><span className={`font-semibold ${kpis.seguridad.controles.noAptos > 0 ? 'text-red-600' : ''}`}>{kpis.seguridad.controles.noAptos}{kpis.seguridad.controles.pctNoApto != null ? ` (${kpis.seguridad.controles.pctNoApto}%)` : ''}</span></div>
                <div className="flex justify-between"><span className="text-neutral-600">Fatiga alta (≥7)</span><span className={`font-semibold ${kpis.seguridad.controles.fatigaAlta > 0 ? 'text-amber-600' : ''}`}>{kpis.seguridad.controles.fatigaAlta}</span></div>
                <div className="flex justify-between"><span className="text-neutral-600">Alcoholemia &gt;0</span><span className={`font-semibold ${kpis.seguridad.controles.alcoholemiaPositiva > 0 ? 'text-red-600' : ''}`}>{kpis.seguridad.controles.alcoholemiaPositiva}</span></div>
                {kpis.seguridad.multasPorChofer.length > 0 && (
                  <div className="border-t border-neutral-100 pt-2">
                    <p className="text-xs font-medium text-neutral-500 mb-1">Multas por chofer (12m)</p>
                    {kpis.seguridad.multasPorChofer.slice(0, 3).map(m => (
                      <div key={m.conductorId} className="flex justify-between text-xs"><span className="text-neutral-600">{m.chofer}</span><span className="font-medium">{m.cantidad} · {fmt$(m.montoTotal)}</span></div>
                    ))}
                  </div>
                )}
                {kpis.seguridad.incidentesPor100k.length > 0 && (
                  <div className="border-t border-neutral-100 pt-2">
                    <p className="text-xs font-medium text-neutral-500 mb-1">Incidentes / 100k km</p>
                    {kpis.seguridad.incidentesPor100k.slice(0, 3).map(i => (
                      <div key={i.vehiculoId} className="flex justify-between text-xs"><span className="text-neutral-600">{i.vehiculo}</span><span className="font-medium">{i.tasaPor100kKm != null ? i.tasaPor100kKm : `${i.incidentes} inc.`}</span></div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
              <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
                <Leaf className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-neutral-900">g CO₂/km</h2>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-neutral-100">
                  {kpis.co2PorKm.length === 0 && <tr><td className="px-3 py-6 text-center text-neutral-400">Sin datos</td></tr>}
                  {kpis.co2PorKm.slice(0, 6).map(c => (
                    <tr key={c.vehiculoId} className="hover:bg-neutral-50">
                      <td className="px-3 py-2 font-medium text-neutral-800">{c.vehiculo}</td>
                      <td className="px-3 py-2 font-semibold text-neutral-800 text-right">{c.gCo2PorKm.toLocaleString('es-AR')} g/km</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Proyección de desgaste de cubiertas ── */}
      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
          <CircleDot className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-neutral-900">Proyección de desgaste de cubiertas</h2>
          <span className="text-xs text-neutral-400">regresión sobre mediciones de banda · límite {data?.parametros.profLimiteMm ?? 2}mm</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Cubierta</th>
              <th className="text-left font-medium px-3 py-2">Vehículo / posición</th>
              <th className="text-left font-medium px-3 py-2">Banda actual</th>
              <th className="text-left font-medium px-3 py-2">Desgaste</th>
              <th className="text-left font-medium px-3 py-2">Km restantes</th>
              <th className="text-left font-medium px-3 py-2">Fecha estimada</th>
              <th className="text-left font-medium px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && (!data || data.cubiertas.length === 0) && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-400">Sin mediciones suficientes (se necesitan ≥2 por cubierta)</td></tr>
            )}
            {data?.cubiertas.map(c => (
              <tr key={c.neumaticoId} className="hover:bg-neutral-50">
                <td className="px-3 py-2 font-medium text-neutral-800">{c.codigo}<span className="block text-xs font-normal text-neutral-400">{c.medida || c.marca || ''}</span></td>
                <td className="px-3 py-2 text-neutral-600">{c.vehiculo}<span className="block text-xs text-neutral-400">{c.posicion}</span></td>
                <td className="px-3 py-2 text-neutral-600">{c.profActual}mm</td>
                <td className="px-3 py-2 text-neutral-600">{c.desgasteMmPor1000Km}mm/1000km</td>
                <td className="px-3 py-2 font-semibold text-neutral-800">{c.kmRestantes.toLocaleString('es-AR')} km</td>
                <td className="px-3 py-2 text-neutral-600 text-xs">{c.fechaEstimada ? new Date(c.fechaEstimada).toLocaleDateString('es-AR') : '—'}</td>
                <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs font-bold ${ESTADO_CUBIERTA[c.estado]}`}>{ESTADO_L[c.estado]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Desvío de consumo de combustible ── */}
      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
          <TrendingDown className="h-4 w-4 text-orange-600" />
          <h2 className="text-sm font-semibold text-neutral-900">Desvío de consumo de combustible</h2>
          <span className="text-xs text-neutral-400">últimas 3 cargas vs. histórico · alerta si cae &gt;{Math.abs(data?.parametros.umbralDesvioPct ?? 15)}%</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Vehículo</th>
              <th className="text-left font-medium px-3 py-2">Rend. histórico</th>
              <th className="text-left font-medium px-3 py-2">Rend. reciente</th>
              <th className="text-left font-medium px-3 py-2">Desvío</th>
              <th className="text-left font-medium px-3 py-2">Diagnóstico</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && (!data || data.combustible.length === 0) && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-400">Sin cargas suficientes (se necesitan ≥4 con rendimiento por vehículo)</td></tr>
            )}
            {data?.combustible.map(c => (
              <tr key={c.vehiculoId} className="hover:bg-neutral-50">
                <td className="px-3 py-2 font-medium text-neutral-800">{c.vehiculo}</td>
                <td className="px-3 py-2 text-neutral-600">{c.rendHistorico} km/L</td>
                <td className="px-3 py-2 text-neutral-600">{c.rendReciente} km/L</td>
                <td className="px-3 py-2">
                  <span className={`font-semibold ${c.desvioPct < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {c.desvioPct > 0 ? '+' : ''}{c.desvioPct}%
                  </span>
                </td>
                <td className="px-3 py-2">
                  {c.alerta
                    ? <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700">Posible falla — revisar</span>
                    : <span className="text-xs text-neutral-400">Normal</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Huella de carbono ── */}
      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
          <Leaf className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-neutral-900">Huella de carbono</h2>
          <span className="text-xs text-neutral-400">litros consumidos × factor de emisión (diésel 2.68, nafta 2.31, GNC 1.90 kg CO₂/L)</span>
        </div>
        <div className="grid grid-cols-2 gap-4 px-4 py-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-neutral-500">Combustible total</p>
            <p className="text-lg font-semibold text-neutral-900">{data ? data.huellaCarbono.litrosTotal.toLocaleString('es-AR') : '—'} L</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">CO₂ emitido (histórico)</p>
            <p className="text-lg font-semibold text-neutral-900">{data ? data.huellaCarbono.co2TotalTn.toLocaleString('es-AR') : '—'} t</p>
          </div>
        </div>
        {data && data.huellaCarbono.ultimos12Meses.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-3 py-2">Vehículo</th>
                <th className="text-left font-medium px-3 py-2">Litros (12m)</th>
                <th className="text-left font-medium px-3 py-2">CO₂ (12m)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.huellaCarbono.ultimos12Meses.map(h => (
                <tr key={h.vehiculoId} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 font-medium text-neutral-800">{h.vehiculo}</td>
                  <td className="px-3 py-2 text-neutral-600">{h.litros.toLocaleString('es-AR')} L</td>
                  <td className="px-3 py-2 text-neutral-600">{(h.co2Kg / 1000).toFixed(2)} t</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Link al centro de reportes general */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileBarChart className="h-6 w-6 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-neutral-800">Centro de reportes de SGI360</p>
            <p className="text-xs text-neutral-500">Incluye exportaciones de mantenimiento, flota e inspecciones</p>
          </div>
        </div>
        <Link href="/reportes" className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
          <ExternalLink className="h-4 w-4" /> Ir a Reportes
        </Link>
      </div>
    </div>
  );
}
