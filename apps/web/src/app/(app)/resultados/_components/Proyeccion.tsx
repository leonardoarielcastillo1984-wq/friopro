'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Loader2, Scale, CalendarClock, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { fmtMoney, fmtPct, fmtFecha, fmtActualizado, MESES } from './fmt';

type BloqueMes = {
  ventas: { real?: number; compromisos: number; estimacion: number; proyectado: number };
  costos: { real?: number; compromisos: number; estimacion: number; proyectado: number };
  resultadoProyectado: number; margenProyectado: number | null;
  confianza: number; confianzaLabel: string; metodo: string;
};
type ProyCierre = BloqueMes & {
  esMesActual: boolean; diasTranscurridos: number; diasRestantes: number;
  mes: number; anio: number;
  siguiente?: { anio: number; mes: number } & BloqueMes;
  actualizadoEn?: string;
};
type FlujoData = {
  saldoActual: number;
  proximosCobros: { fecha: string; importe: number; concepto: string; tipo: string; via?: string }[];
  proximosPagos: { fecha: string; importe: number; concepto: string; tipo: string }[];
  proyeccion: { dias: number; cobros: number; pagos: number; saldoProyectado: number }[];
  recurrentesMensual: number;
  actualizadoEn?: string;
};

const confColor = (c: number) => c >= 70 ? 'text-green-700 bg-green-50' : c >= 40 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50';

export default function Proyeccion({ anio, moneda, centroCostoId }: { anio: number; moneda: string; centroCostoId: string }) {
  const [cierre, setCierre] = useState<ProyCierre | null>(null);
  const [caja, setCaja] = useState<FlujoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [horizonte, setHorizonte] = useState(30);

  useEffect(() => {
    setLoading(true);
    const cc = centroCostoId ? `&centroCostoId=${centroCostoId}` : '';
    Promise.all([
      apiFetch<ProyCierre>(`/finanzas/proyeccion-cierre?anio=${anio}&moneda=${moneda}${cc}`).catch(() => null),
      apiFetch<FlujoData>(`/finanzas/flujo-caja${moneda ? `?moneda=${moneda}` : ''}`).catch(() => null),
    ]).then(([p, c]) => { setCierre(p); setCaja(c); }).finally(() => setLoading(false));
  }, [anio, moneda, centroCostoId]);

  if (loading) return <div className="flex items-center justify-center py-16 text-neutral-400"><Loader2 className="mr-2 animate-spin" size={18} />Calculando proyección…</div>;
  if (!cierre && !caja) return <div className="py-16 text-center text-neutral-400">No se pudo cargar la proyección.</div>;

  const proy = caja?.proyeccion.find(p => p.dias === horizonte) || caja?.proyeccion[1];
  const cortes = caja?.proximosCobros.filter(c => new Date(c.fecha) <= new Date(Date.now() + horizonte * 86400000)) || [];
  const cortesP = caja?.proximosPagos.filter(c => new Date(c.fecha) <= new Date(Date.now() + horizonte * 86400000)) || [];

  const cardMes = (b: BloqueMes, titulo: string, sub: string) => (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-neutral-900"><Scale size={15} className="mr-1 inline text-purple-600" />{titulo}{' '}
          <span className="font-normal text-neutral-400">{sub}</span></span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${confColor(b.confianza)}`}>Confianza {b.confianzaLabel} ({b.confianza}% respaldado)</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg bg-neutral-50 p-3">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500">Ventas proyectadas</div>
          <div className="mt-1 font-semibold">{fmtMoney(b.ventas.proyectado, moneda)}</div>
          <div className="mt-1 text-[10px] text-neutral-400">
            {b.ventas.real != null ? `real ${fmtMoney(b.ventas.real, moneda)} + ` : ''}comp. {fmtMoney(b.ventas.compromisos, moneda)} + est. {fmtMoney(b.ventas.estimacion, moneda)}
          </div>
        </div>
        <div className="rounded-lg bg-neutral-50 p-3">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500">Costos proyectados</div>
          <div className="mt-1 font-semibold">{fmtMoney(b.costos.proyectado, moneda)}</div>
          <div className="mt-1 text-[10px] text-neutral-400">
            {b.costos.real != null ? `real ${fmtMoney(b.costos.real, moneda)} + ` : ''}comp. {fmtMoney(b.costos.compromisos, moneda)} + est. {fmtMoney(b.costos.estimacion, moneda)}
          </div>
        </div>
        <div className={`rounded-lg p-3 ${b.resultadoProyectado >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="text-[11px] uppercase tracking-wide text-neutral-500">Resultado proyectado</div>
          <div className={`mt-1 font-semibold ${b.resultadoProyectado >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmtMoney(b.resultadoProyectado, moneda)}</div>
        </div>
        <div className="rounded-lg bg-neutral-50 p-3">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500">Margen proyectado</div>
          <div className="mt-1 font-semibold">{fmtPct(b.margenProyectado)}</div>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-neutral-400">{b.metodo}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 1 — Cierre del mes en curso (devengado) */}
      {cierre?.esMesActual && cardMes(cierre, 'Cierre del mes', `— ${MESES[cierre.mes - 1]} ${cierre.anio} · quedan ${cierre.diasRestantes} días${cierre.actualizadoEn ? ` · act. ${fmtActualizado(cierre.actualizadoEn)}` : ''}`)}

      {/* 2 — Mes siguiente */}
      {cierre?.siguiente && cardMes(cierre.siguiente, 'Mes siguiente', `— ${MESES[cierre.siguiente.mes - 1]} ${cierre.siguiente.anio}`)}

      {/* 3 — Caja a futuro */}
      {caja && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-neutral-900"><CalendarClock size={14} className="mr-1 inline" />Proyección de caja{caja.actualizadoEn && <span className="ml-2 text-[10px] font-normal text-neutral-400">· act. {fmtActualizado(caja.actualizadoEn)}</span>}</span>
            <div className="flex gap-1">
              {[7, 30, 60, 90].map(d => (
                <button key={d} onClick={() => setHorizonte(d)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${horizonte === d ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>{d}d</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg bg-neutral-50 p-3">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">Saldo hoy</div>
              <div className="mt-1 font-semibold">{fmtMoney(caja.saldoActual, moneda)}</div>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <div className="text-[11px] uppercase tracking-wide text-emerald-700">Cobros esperados {horizonte}d</div>
              <div className="mt-1 font-semibold text-emerald-700">+{fmtMoney(proy?.cobros || 0, moneda)}</div>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <div className="text-[11px] uppercase tracking-wide text-amber-700">Pagos previstos {horizonte}d</div>
              <div className="mt-1 font-semibold text-amber-700">−{fmtMoney(proy?.pagos || 0, moneda)}</div>
            </div>
            <div className={`rounded-lg p-3 ${(proy?.saldoProyectado ?? 0) >= 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
              <div className={`text-[11px] uppercase tracking-wide ${(proy?.saldoProyectado ?? 0) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>Saldo proyectado</div>
              <div className={`mt-1 font-semibold ${(proy?.saldoProyectado ?? 0) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmtMoney(proy?.saldoProyectado || 0, moneda)}</div>
            </div>
          </div>
          {caja.recurrentesMensual > 0 && <p className="mt-2 text-[11px] text-neutral-400">Además hay {fmtMoney(caja.recurrentesMensual, moneda)}/mes de gastos recurrentes comprometidos.</p>}
          <p className="mt-1 text-[11px] text-neutral-400">Los cobros de facturas se fechan con el hábito de pago real del cliente (emisión + días que suele demorar); sin historial se usa el vencimiento.</p>
        </div>
      )}

      {/* Detalle de cobros/pagos del horizonte */}
      {caja && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 bg-white">
            <div className="border-b border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-900"><ArrowDownToLine size={14} className="mr-1 inline text-emerald-600" />Cobros esperados <span className="font-normal text-neutral-400">({horizonte} días)</span></div>
            <table className="w-full text-sm">
              <tbody>
                {cortes.slice(0, 12).map((c, i) => (
                  <tr key={i} className="border-b border-neutral-100 last:border-0">
                    <td className="w-24 px-4 py-2 text-xs text-neutral-400">
                      {fmtFecha(c.fecha)}
                      {c.via === 'HISTORIAL' && <span className="block text-[9px] text-sky-600" title="Estimado por hábito de pago del cliente">historial</span>}
                    </td>
                    <td className="max-w-60 truncate px-4 py-2 text-neutral-700" title={c.concepto}>{c.concepto}</td>
                    <td className="w-32 px-4 py-2 text-right font-medium text-emerald-700">{fmtMoney(c.importe, moneda)}</td>
                  </tr>
                ))}
                {cortes.length === 0 && <tr><td className="px-4 py-8 text-center text-neutral-400">Sin cobros previstos en el horizonte.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white">
            <div className="border-b border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-900"><ArrowUpFromLine size={14} className="mr-1 inline text-amber-600" />Pagos previstos <span className="font-normal text-neutral-400">({horizonte} días)</span></div>
            <table className="w-full text-sm">
              <tbody>
                {cortesP.slice(0, 12).map((c, i) => (
                  <tr key={i} className="border-b border-neutral-100 last:border-0">
                    <td className="w-24 px-4 py-2 text-xs text-neutral-400">{fmtFecha(c.fecha)}</td>
                    <td className="max-w-60 truncate px-4 py-2 text-neutral-700" title={c.concepto}>{c.concepto}</td>
                    <td className="w-32 px-4 py-2 text-right font-medium text-amber-700">{fmtMoney(c.importe, moneda)}</td>
                  </tr>
                ))}
                {cortesP.length === 0 && <tr><td className="px-4 py-8 text-center text-neutral-400">Sin pagos previstos en el horizonte.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
