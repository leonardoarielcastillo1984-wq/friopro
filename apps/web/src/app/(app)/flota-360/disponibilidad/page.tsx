'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  Activity, AlertTriangle, CalendarClock, DollarSign, Download,
  TrendingUp, Truck, Wrench,
} from 'lucide-react';

const ESTADO_OP: Record<string, { label: string; cls: string; dot: string }> = {
  OPERATIVO: { label: 'Operativo', cls: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  EN_TALLER: { label: 'En taller', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  EN_REPARACION: { label: 'En reparación', cls: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
};

function fmtFecha(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—';
  return `$${Math.round(n).toLocaleString('es-AR')}`;
}

export default function DisponibilidadPage() {
  const [dias, setDias] = useState(30);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = async (d: number) => {
    setLoading(true);
    try {
      const res = await apiFetch<any>(`/fleet-ops/disponibilidad?dias=${d}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(dias); }, [dias]);

  const exportar = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const tenantId = localStorage.getItem('tenantId');
      const res = await fetch(`/api/fleet-ops/tiempos-taller/export?dias=${dias}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
        },
      });
      if (!res.ok) throw new Error('Error al exportar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tiempos-taller-${dias}d.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silencioso
    } finally {
      setExporting(false);
    }
  };

  if (loading && !data) return <div className="p-8 text-sm text-neutral-500">Cargando tablero…</div>;

  const flota = data?.flota || {};
  const cumpl = data?.cumplimientoPreventivo?.flota || {};
  const presu = data?.presupuesto || {};
  const alertas = data?.alertasEstadia || [];
  const ranking = data?.rankingEstadia || [];
  const cumplPorUnidad = data?.cumplimientoPreventivo?.porUnidad || [];
  const maxHoras = Math.max(1, ...ranking.map((r: any) => r.horasNoDisponible));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-[#0d1b3d]">Disponibilidad de flota</h1>
          <p className="text-xs text-neutral-500">Estadíos operativos, tiempos de taller en turnos de 9hs y cumplimiento preventivo</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-700">
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
            <option value={180}>Últimos 180 días</option>
          </select>
          <button onClick={exportar} disabled={exporting} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> {exporting ? 'Exportando…' : 'Exportar tiempos'}
          </button>
        </div>
      </div>

      {/* KPIs de flota */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] font-medium uppercase mb-1"><Truck className="h-3.5 w-3.5" /> Unidades</div>
          <p className="text-xl font-bold text-neutral-900">{flota.total ?? 0}</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50/50 p-3">
          <div className="flex items-center gap-1.5 text-green-700 text-[11px] font-medium uppercase mb-1"><Activity className="h-3.5 w-3.5" /> Operativas</div>
          <p className="text-xl font-bold text-green-700">{flota.operativos ?? 0}</p>
          <p className="text-[11px] text-green-600">{flota.pctDisponible ?? 0}% disponible</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <div className="flex items-center gap-1.5 text-amber-700 text-[11px] font-medium uppercase mb-1"><Wrench className="h-3.5 w-3.5" /> En taller</div>
          <p className="text-xl font-bold text-amber-700">{flota.enTaller ?? 0}</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
          <div className="flex items-center gap-1.5 text-blue-700 text-[11px] font-medium uppercase mb-1"><Wrench className="h-3.5 w-3.5" /> En reparación</div>
          <p className="text-xl font-bold text-blue-700">{flota.enReparacion ?? 0}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] font-medium uppercase mb-1"><CalendarClock className="h-3.5 w-3.5" /> Prev. al día</div>
          <p className={`text-xl font-bold ${(cumpl.pct ?? 100) >= 80 ? 'text-green-700' : (cumpl.pct ?? 100) >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{cumpl.pct ?? '—'}%</p>
          <p className="text-[11px] text-neutral-400">{cumpl.alDia ?? 0}/{cumpl.total ?? 0} planes{cumpl.vencidos ? ` · ${cumpl.vencidos} vencidos` : ''}</p>
        </div>
      </div>

      {/* Alertas de estadía prolongada */}
      {alertas.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-800">Estadía prolongada en taller</h2>
            <span className="text-[11px] text-amber-600">más de {data?.diasAlertaEstadia} días sin volver a operativo</span>
          </div>
          <div className="space-y-1.5">
            {alertas.map((a: any) => (
              <div key={a.vehiculoId} className="flex items-center justify-between text-xs bg-white/70 rounded-md px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${ESTADO_OP[a.estadoOperativo]?.dot ?? 'bg-neutral-300'}`} />
                  <Link href={`/flota-360/vehiculos/${a.vehiculoId}`} className="font-semibold text-neutral-800 hover:text-blue-700">{a.dominio}</Link>
                  <span className="text-neutral-500">{ESTADO_OP[a.estadoOperativo]?.label}</span>
                  <span className="text-neutral-400">desde {fmtFecha(a.desde)}</span>
                </div>
                <span className="font-medium text-amber-700">{a.dias} días · {a.turnos} turnos</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ranking de estadía */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-800 mb-1">Tiempo no disponible por unidad</h2>
          <p className="text-[11px] text-neutral-400 mb-3">Horas en taller + reparación en los últimos {dias} días</p>
          {ranking.every((r: any) => r.horasNoDisponible === 0) ? (
            <p className="text-xs text-neutral-400 py-4 text-center">Sin estadías registradas en el período — toda la flota operativa</p>
          ) : (
            <div className="space-y-2">
              {ranking.filter((r: any) => r.horasNoDisponible > 0).map((r: any) => (
                <div key={r.vehiculoId}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <Link href={`/flota-360/vehiculos/${r.vehiculoId}`} className="font-medium text-neutral-700 hover:text-blue-700">{r.dominio}</Link>
                    <span className="text-neutral-500">{r.horasNoDisponible} hs · {r.turnosNoDisponible} turnos{r.ciclos > 0 ? ` · ${r.ciclos} ingreso${r.ciclos > 1 ? 's' : ''}` : ''}</span>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-100 overflow-hidden flex">
                    {r.horasReparacion > 0 && <div className="h-full bg-blue-500" style={{ width: `${(r.horasReparacion / maxHoras) * 100}%` }} />}
                    {r.horasTaller > 0 && <div className="h-full bg-amber-400" style={{ width: `${(r.horasTaller / maxHoras) * 100}%` }} />}
                  </div>
                </div>
              ))}
              <div className="flex gap-4 pt-1 text-[10px] text-neutral-400">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> En reparación</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> En taller (espera)</span>
              </div>
            </div>
          )}
        </div>

        {/* Cumplimiento preventivo por unidad */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-800 mb-1">Cumplimiento preventivo por unidad</h2>
          <p className="text-[11px] text-neutral-400 mb-3">% de planes de mantenimiento sin vencer</p>
          {cumplPorUnidad.length === 0 ? (
            <p className="text-xs text-neutral-400 py-4 text-center">Sin planes activos asignados</p>
          ) : (
            <div className="space-y-2">
              {cumplPorUnidad.map((u: any) => (
                <div key={u.vehiculoId}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <Link href={`/flota-360/vehiculos/${u.vehiculoId}`} className="font-medium text-neutral-700 hover:text-blue-700">{u.dominio}</Link>
                    <span className="text-neutral-500">{u.alDia}/{u.total} al día{u.vencidos > 0 ? ` · ${u.vencidos} vencido${u.vencidos > 1 ? 's' : ''}` : ''}</span>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                    <div className={`h-full ${u.pct >= 80 ? 'bg-green-500' : u.pct >= 60 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${u.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Presupuesto vs real */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-neutral-800">Presupuesto vs. gasto real del mes</h2>
        </div>
        {presu.mensual == null ? (
          <p className="text-xs text-neutral-500">
            No hay presupuesto mensual configurado.{' '}
            <Link href="/flota-360/configuracion" className="text-blue-600 hover:underline">Configurarlo →</Link>
          </p>
        ) : (
          <>
            <div className="flex items-end justify-between mb-2 flex-wrap gap-2">
              <div>
                <p className="text-2xl font-bold text-neutral-900">{fmtMoney(presu.gastoMes)} <span className="text-sm font-normal text-neutral-400">de {fmtMoney(presu.mensual)}</span></p>
                <p className="text-xs text-neutral-500">
                  {presu.pct != null && `${presu.pct}% del presupuesto mensual`}
                  {presu.pct != null && presu.pct > 100 && <span className="text-red-600 font-medium"> — excedido</span>}
                </p>
              </div>
              <div className="flex gap-4 text-[11px] text-neutral-500">
                <span>Combustible {fmtMoney(presu.desglose?.combustible)}</span>
                <span>Mantenimiento {fmtMoney(presu.desglose?.mantenimiento)}</span>
                <span>Neumáticos {fmtMoney(presu.desglose?.neumaticos)}</span>
              </div>
            </div>
            <div className="h-3 rounded-full bg-neutral-100 overflow-hidden">
              <div className={`h-full ${(presu.pct ?? 0) > 100 ? 'bg-red-500' : (presu.pct ?? 0) > 80 ? 'bg-amber-400' : 'bg-green-500'}`} style={{ width: `${Math.min(100, presu.pct ?? 0)}%` }} />
            </div>
          </>
        )}
      </div>

      {/* Tabla completa por unidad */}
      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Unidad</th>
              <th className="text-left font-medium px-3 py-2">Estado actual</th>
              <th className="text-right font-medium px-3 py-2">Hs taller</th>
              <th className="text-right font-medium px-3 py-2">Hs reparación</th>
              <th className="text-right font-medium px-3 py-2">Turnos no disp.</th>
              <th className="text-right font-medium px-3 py-2">Ingresos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {(data?.rankingEstadia || []).map((u: any) => (
              <tr key={u.vehiculoId} className="hover:bg-neutral-50">
                <td className="px-3 py-2">
                  <Link href={`/flota-360/vehiculos/${u.vehiculoId}`} className="font-medium text-neutral-800 hover:text-blue-700">{u.dominio}</Link>
                  <span className="text-neutral-400 ml-1.5">{u.tipo}</span>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium ${ESTADO_OP[u.estadoActual]?.cls ?? 'bg-neutral-100 text-neutral-600'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${ESTADO_OP[u.estadoActual]?.dot ?? 'bg-neutral-400'}`} />
                    {ESTADO_OP[u.estadoActual]?.label ?? u.estadoActual}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-neutral-600">{u.horasTaller}</td>
                <td className="px-3 py-2 text-right text-neutral-600">{u.horasReparacion}</td>
                <td className="px-3 py-2 text-right font-medium text-neutral-800">{u.turnosNoDisponible}</td>
                <td className="px-3 py-2 text-right text-neutral-600">{u.ciclos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
