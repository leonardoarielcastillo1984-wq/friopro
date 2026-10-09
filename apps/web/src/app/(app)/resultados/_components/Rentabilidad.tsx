'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Loader2, Target, TrendingUp, TrendingDown, AlertTriangle, Users, Building2, Layers, Scale } from 'lucide-react';
import { fmtMoney, fmtPct, fmtActualizado, labelRubro } from './fmt';

type Fila = { key: string; nombre: string; metodo: string; ventas: number; costos: number | null; resultado: number | null; margen: number | null };
type PE = {
  costosFijos: number; costosVariables: number; sinClasificar: number; ventas: number;
  margenContribucion: number; ratioContribucion: number; puntoEquilibrio: number | null;
  peMensual: number | null; ventasMensualProm: number; vsPuntoEquilibrio: number | null;
  porRubro: { rubro: string; fijo: number; variable: number; mixto: number; clase: string | null }[];
  mesesConsiderados: number;
  actualizadoEn?: string;
};
type Proy = {
  esMesActual: boolean; diasTranscurridos: number; diasRestantes: number;
  ventas: { real: number; compromisos: number; estimacion: number; proyectado: number };
  costos: { real: number; compromisos: number; estimacion: number; proyectado: number };
  resultadoProyectado: number; margenProyectado: number | null;
  confianza: number; confianzaLabel: string; metodo: string;
  actualizadoEn?: string;
};

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export default function Rentabilidad({ anio, moneda, centroCostoId }: { anio: number; moneda: string; centroCostoId: string }) {
  const [vista, setVista] = useState<'centro' | 'cliente' | 'servicio'>('centro');
  const [rent, setRent] = useState<{ porCentroCosto: Fila[]; porCliente: Fila[]; porServicio: Fila[]; notaCostos: string } | null>(null);
  const [pe, setPe] = useState<PE | null>(null);
  const [proy, setProy] = useState<Proy | null>(null);
  const [loading, setLoading] = useState(true);
  const [ordenCliente, setOrdenCliente] = useState<'ventas' | 'resultado' | 'margen' | 'menorMargen' | 'perdida'>('ventas');

  useEffect(() => {
    setLoading(true);
    const cc = centroCostoId ? `&centroCostoId=${centroCostoId}` : '';
    Promise.all([
      apiFetch<any>(`/finanzas/rentabilidad?anio=${anio}&moneda=${moneda}${cc}`).catch(() => null),
      apiFetch<PE>(`/finanzas/punto-equilibrio?anio=${anio}&moneda=${moneda}${cc}`).catch(() => null),
      apiFetch<Proy>(`/finanzas/proyeccion-cierre?anio=${anio}&moneda=${moneda}${cc}`).catch(() => null),
    ]).then(([r, p, pr]) => { setRent(r); setPe(p); setProy(pr); }).finally(() => setLoading(false));
  }, [anio, moneda, centroCostoId]);

  if (loading) return <div className="flex items-center justify-center py-16 text-neutral-400"><Loader2 className="mr-2 animate-spin" size={18} />Calculando rentabilidad…</div>;

  const filas = vista === 'centro' ? rent?.porCentroCosto : vista === 'cliente' ? rent?.porCliente : rent?.porServicio;
  let lista = [...(filas || [])];
  if (vista === 'cliente') {
    if (ordenCliente === 'resultado') lista.sort((a, b) => (b.resultado ?? 0) - (a.resultado ?? 0));
    if (ordenCliente === 'margen') lista.sort((a, b) => (b.margen ?? -999) - (a.margen ?? -999));
    if (ordenCliente === 'menorMargen') lista.sort((a, b) => (a.margen ?? 999) - (b.margen ?? 999));
    if (ordenCliente === 'perdida') lista = lista.filter(f => (f.resultado ?? 0) < 0);
  }

  const confColor = proy ? (proy.confianza >= 70 ? 'text-green-700 bg-green-50' : proy.confianza >= 40 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50') : '';

  return (
    <div className="space-y-4">
      {/* Punto de equilibrio */}
      {pe && pe.peMensual !== null && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900"><Target size={15} className="text-blue-600" />Punto de equilibrio <span className="font-normal text-neutral-400">— facturación mensual mínima para no perder</span>{pe.actualizadoEn && <span className="ml-auto text-[10px] font-normal text-neutral-400">act. {fmtActualizado(pe.actualizadoEn)}</span>}</div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="rounded-lg bg-neutral-50 p-3">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">Punto de equilibrio</div>
              <div className="mt-1 text-lg font-semibold">{fmtMoney(pe.peMensual, moneda)}<span className="text-xs font-normal text-neutral-400">/mes</span></div>
            </div>
            <div className="rounded-lg bg-neutral-50 p-3">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">Ventas prom./mes</div>
              <div className="mt-1 text-lg font-semibold">{fmtMoney(pe.ventasMensualProm, moneda)}</div>
            </div>
            <div className="rounded-lg bg-neutral-50 p-3">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">Margen contribución</div>
              <div className="mt-1 text-lg font-semibold">{fmtPct(pe.ratioContribucion)}</div>
            </div>
            <div className="rounded-lg bg-neutral-50 p-3">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">Costos fijos / var.</div>
              <div className="mt-1 text-sm font-semibold">{fmtMoney(pe.costosFijos, moneda)} / {fmtMoney(pe.costosVariables, moneda)}</div>
            </div>
            <div className={`rounded-lg p-3 ${(pe.vsPuntoEquilibrio ?? 0) >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">Estado</div>
              <div className={`mt-1 text-sm font-semibold ${(pe.vsPuntoEquilibrio ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {(pe.vsPuntoEquilibrio ?? 0) >= 0 ? '🟢' : '🔴'} {Math.abs(pe.vsPuntoEquilibrio || 0).toFixed(1)} % {(pe.vsPuntoEquilibrio ?? 0) >= 0 ? 'por encima' : 'por debajo'} del equilibrio
              </div>
            </div>
          </div>
          {pe.sinClasificar > 0 && <p className="mt-2 text-[11px] text-amber-600"><AlertTriangle size={11} className="mr-1 inline" />{fmtMoney(pe.sinClasificar, moneda)} en costos sin clasificar fijo/variable (quedan fuera del cálculo). Clasificalos por rubro en Config.</p>}
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] text-neutral-400 hover:text-neutral-600">Ver clasificación por rubro</summary>
            <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] sm:grid-cols-3 lg:grid-cols-4">
              {pe.porRubro.map(r => (
                <div key={r.rubro} className="flex justify-between rounded bg-neutral-50 px-2 py-1">
                  <span className="truncate">{labelRubro(r.rubro)}</span>
                  <span className={`ml-2 font-medium ${r.clase === 'FIJO' ? 'text-blue-600' : r.clase === 'VARIABLE' ? 'text-amber-600' : 'text-neutral-400'}`}>{r.clase || '—'}</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Proyección de cierre */}
      {proy && proy.esMesActual && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-neutral-900"><Scale size={15} className="mr-1 inline text-purple-600" />Proyección de cierre — {MESES_CORTO[new Date().getUTCMonth()]} {new Date().getUTCFullYear()}{proy.actualizadoEn && <span className="ml-2 text-[10px] font-normal text-neutral-400">· act. {fmtActualizado(proy.actualizadoEn)}</span>}</span>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${confColor}`}>Confianza {proy.confianzaLabel} ({proy.confianza}% respaldado)</span>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg bg-neutral-50 p-3">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">Ventas proyectadas</div>
              <div className="mt-1 font-semibold">{fmtMoney(proy.ventas.proyectado, moneda)}</div>
              <div className="mt-1 text-[10px] text-neutral-400">real {fmtMoney(proy.ventas.real, moneda)} + est. {fmtMoney(proy.ventas.estimacion, moneda)}</div>
            </div>
            <div className="rounded-lg bg-neutral-50 p-3">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">Costos proyectados</div>
              <div className="mt-1 font-semibold">{fmtMoney(proy.costos.proyectado, moneda)}</div>
              <div className="mt-1 text-[10px] text-neutral-400">real {fmtMoney(proy.costos.real, moneda)} + comp. {fmtMoney(proy.costos.compromisos, moneda)} + est. {fmtMoney(proy.costos.estimacion, moneda)}</div>
            </div>
            <div className={`rounded-lg p-3 ${proy.resultadoProyectado >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">Resultado proyectado</div>
              <div className={`mt-1 font-semibold ${proy.resultadoProyectado >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmtMoney(proy.resultadoProyectado, moneda)}</div>
            </div>
            <div className="rounded-lg bg-neutral-50 p-3">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">Margen proyectado</div>
              <div className="mt-1 font-semibold">{fmtPct(proy.margenProyectado)}</div>
              <div className="mt-1 text-[10px] text-neutral-400">quedan {proy.diasRestantes} días</div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-neutral-400">{proy.metodo}</p>
        </div>
      )}

      {/* Rentabilidad por dimensión */}
      <div className="rounded-xl border border-neutral-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-3">
          <span className="text-sm font-semibold text-neutral-900">Rentabilidad por{(rent as any)?.actualizadoEn && <span className="ml-1 text-[10px] font-normal text-neutral-400">· act. {fmtActualizado((rent as any).actualizadoEn)}</span>}</span>
          <div className="ml-2 flex gap-1">
            {([['centro', 'Unidad / centro de costo', Building2], ['cliente', 'Cliente', Users], ['servicio', 'Servicio', Layers]] as const).map(([k, l, Icon]) => (
              <button key={k} onClick={() => setVista(k)}
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium ${vista === k ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                <Icon size={11} />{l}
              </button>
            ))}
          </div>
          {vista === 'cliente' && (
            <select value={ordenCliente} onChange={e => setOrdenCliente(e.target.value as any)} className="ml-auto rounded-lg border border-neutral-200 px-2 py-1 text-xs">
              <option value="ventas">Mayor facturación</option><option value="resultado">Mayor resultado</option>
              <option value="margen">Mayor margen</option><option value="menorMargen">Menor margen</option><option value="perdida">En pérdida</option>
            </select>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2 font-medium">{vista === 'cliente' ? 'Cliente' : vista === 'servicio' ? 'Servicio' : 'Centro / unidad'}</th>
              <th className="px-4 py-2 text-right font-medium">Ventas</th>
              <th className="px-4 py-2 text-right font-medium">Costos</th>
              <th className="px-4 py-2 text-right font-medium">Resultado</th>
              <th className="px-4 py-2 text-right font-medium">Margen</th>
            </tr>
          </thead>
          <tbody>
            {lista.map(f => (
              <tr key={f.key} className={`border-b border-neutral-100 last:border-0 ${(f.resultado ?? 0) < 0 ? 'bg-red-50/40' : ''}`}>
                <td className="px-4 py-2.5">
                  <div className="font-medium text-neutral-900">{f.nombre}</div>
                  {f.metodo === 'PROPORCIONAL_VENTAS' && <div className="text-[10px] text-neutral-400">costos prorrateados por ventas</div>}
                </td>
                <td className="px-4 py-2.5 text-right">{fmtMoney(f.ventas, moneda)}</td>
                <td className="px-4 py-2.5 text-right text-amber-700">{f.costos !== null ? fmtMoney(f.costos, moneda) : '—'}</td>
                <td className={`px-4 py-2.5 text-right font-semibold ${(f.resultado ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {f.resultado !== null ? <>{(f.resultado ?? 0) >= 0 ? <TrendingUp size={11} className="mr-1 inline" /> : <TrendingDown size={11} className="mr-1 inline" />}{fmtMoney(f.resultado, moneda)}</> : <span className="font-normal text-neutral-400">Sin datos</span>}
                </td>
                <td className={`px-4 py-2.5 text-right ${(f.margen ?? 0) < 0 ? 'font-semibold text-red-600' : 'text-neutral-500'}`}>{f.margen !== null ? fmtPct(f.margen) : '—'}</td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-neutral-400">Sin datos en el período{vista === 'servicio' ? ' — marcá servicio en las facturas/ingresos para habilitar esta vista' : ''}.</td></tr>}
          </tbody>
        </table>
        {rent?.notaCostos && <p className="border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-400">{rent.notaCostos}</p>}
      </div>
    </div>
  );
}
