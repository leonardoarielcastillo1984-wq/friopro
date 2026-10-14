'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Loader2, Wallet, ArrowDownToLine, ArrowUpFromLine, TrendingUp, TrendingDown, CalendarClock, Pencil, Check, X } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend } from 'recharts';
import { fmtMoney, fmtFecha, fmtActualizado, MESES } from './fmt';
import { useAsistente } from './useAsistente';

type FlujoData = {
  saldoInicial: number; saldoActual: number;
  cobrosPeriodo: number; pagosPeriodo: number; flujoNeto: number;
  meses: { mes: number; mesKey: string; cobros: number; pagos: number; flujoNeto: number; saldo: number }[];
  proximosCobros: { fecha: string; importe: number; concepto: string; tipo: string }[];
  proximosPagos: { fecha: string; importe: number; concepto: string; tipo: string }[];
  proyeccion: { dias: number; cobros: number; pagos: number; saldoProyectado: number }[];
  recurrentesMensual: number;
  actualizadoEn?: string;
};

const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1)}MM`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(Math.round(n));
};

export default function FlujoCaja({ moneda, canEdit }: { moneda: string; canEdit: boolean }) {
  const A = useAsistente({ moneda });
  const [data, setData] = useState<FlujoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [horizonte, setHorizonte] = useState(30);
  const [editSaldo, setEditSaldo] = useState<string | null>(null);
  const [savingSaldo, setSavingSaldo] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch<FlujoData>(`/finanzas/flujo-caja${moneda ? `?moneda=${moneda}` : ''}`)
      .then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [moneda]);

  const guardarSaldo = async () => {
    const v = Number(editSaldo);
    if (editSaldo === null || !Number.isFinite(v) || !moneda) return;
    setSavingSaldo(true);
    try {
      // Merge con los saldos de otras monedas para no pisarlos.
      const cfg = await apiFetch<{ saldoInicial?: Record<string, number> }>('/finanzas/config').catch(() => null);
      await apiFetch('/finanzas/config', { method: 'PUT', json: { saldoInicial: { ...(cfg?.saldoInicial || {}), [moneda]: v } } });
      const d = await apiFetch<FlujoData>(`/finanzas/flujo-caja${moneda ? `?moneda=${moneda}` : ''}`).catch(() => null);
      if (d) setData(d);
      setEditSaldo(null);
    } finally { setSavingSaldo(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-neutral-400"><Loader2 className="mr-2 animate-spin" size={18} />Calculando flujo de caja…</div>;
  if (!data) return <div className="py-16 text-center text-neutral-400">No se pudo cargar el flujo de caja.</div>;

  const chartData = data.meses.map(m => ({ name: MESES[m.mes - 1], mes: m.mes, Cobros: Math.round(m.cobros), Pagos: Math.round(m.pagos), Saldo: Math.round(m.saldo), 'Flujo neto': Math.round(m.flujoNeto) }));
  const tip = (v: any) => fmtMoney(Number(v), moneda);
  const proy = data.proyeccion.find(p => p.dias === horizonte) || data.proyeccion[1];
  const cortes = data.proximosCobros.filter(c => new Date(c.fecha) <= new Date(Date.now() + horizonte * 86400000));
  const cortesP = data.proximosPagos.filter(c => new Date(c.fecha) <= new Date(Date.now() + horizonte * 86400000));

  return (
    <div className={`space-y-4 ${A.wrap.className}`} onClickCapture={A.onAsistenteClick}>
      {A.Estilos}
      <div className="-mb-1 flex flex-wrap items-center gap-2"><A.Boton /><A.PreguntaBar /></div>
      {A.Panel}
      <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-2.5 text-xs text-blue-800" data-explica="caja-intro" data-explica-titulo="Flujo de caja">
        <div className="flex items-center justify-between gap-2">
          <span><strong>Flujo de caja</strong> muestra la plata que <strong>efectivamente entró y salió</strong>. Es distinto del resultado económico (devengado): una venta suma resultado al facturarse pero suma caja cuando se cobra.</span>
          {data.actualizadoEn && <span className="shrink-0 text-[10px] text-blue-700/60">act. {fmtActualizado(data.actualizadoEn)}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Saldo inicial', value: fmtMoney(data.saldoInicial, moneda), icon: Wallet, color: 'text-neutral-500', sub: 'configuración del período', editable: true },
          { label: 'Cobros del período', value: fmtMoney(data.cobrosPeriodo, moneda), icon: ArrowDownToLine, color: 'text-emerald-600', sub: 'entró al banco' },
          { label: 'Pagos del período', value: fmtMoney(data.pagosPeriodo, moneda), icon: ArrowUpFromLine, color: 'text-amber-600', sub: 'salió del banco' },
          { label: 'Flujo neto', value: fmtMoney(data.flujoNeto, moneda), icon: data.flujoNeto >= 0 ? TrendingUp : TrendingDown, color: data.flujoNeto >= 0 ? 'text-green-600' : 'text-red-600', sub: 'cobros − pagos' },
          { label: 'Saldo actual', value: fmtMoney(data.saldoActual, moneda), icon: Wallet, color: data.saldoActual >= 0 ? 'text-blue-600' : 'text-red-600', sub: 'real, a hoy' },
        ].map((k, i) => (
          <div key={i} data-explica="caja-kpi" data-explica-titulo={k.label} data-explica-texto={`${k.label}: ${k.value}${k.sub ? ` (${k.sub})` : ''}`} data-explica-datos={JSON.stringify({ label: k.label, saldoInicial: data.saldoInicial, cobros: data.cobrosPeriodo, pagos: data.pagosPeriodo, flujoNeto: data.flujoNeto, saldoActual: data.saldoActual })}
            className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              <k.icon size={13} className={k.color} />{k.label}
              {k.editable && canEdit && editSaldo === null && (
                <button onClick={() => setEditSaldo(String(data.saldoInicial))} className="text-neutral-300 hover:text-neutral-600" title="Editar saldo inicial"><Pencil size={11} /></button>
              )}
            </div>
            {k.editable && editSaldo !== null ? (
              <div className="mt-1 flex items-center gap-1">
                <input type="number" value={editSaldo} onChange={e => setEditSaldo(e.target.value)} autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') guardarSaldo(); if (e.key === 'Escape') setEditSaldo(null); }}
                  className="w-full rounded border border-neutral-300 px-1.5 py-0.5 text-sm focus:outline-none focus:border-blue-400" />
                <button onClick={guardarSaldo} disabled={savingSaldo} className="text-emerald-600 hover:text-emerald-700 disabled:opacity-40"><Check size={14} /></button>
                <button onClick={() => setEditSaldo(null)} className="text-neutral-400 hover:text-neutral-600"><X size={14} /></button>
              </div>
            ) : (
              <div className="mt-1 text-lg font-semibold text-neutral-900">{k.value}</div>
            )}
            <div className="text-[11px] text-neutral-400">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4" data-explica="caja-grafico" data-explica-titulo="Flujo de caja por mes">
        <div className="mb-2 text-sm font-semibold text-neutral-900">Flujo de caja por mes <span className="font-normal text-neutral-400">— barras: movimiento del mes · línea: saldo acumulado</span></div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={tip} cursor={{ fill: '#f5f5f5' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#a3a3a3" />
              <Bar dataKey="Cobros" fill="#10b981" radius={[3, 3, 0, 0]} className="cursor-pointer"
                onClick={(d: any) => d?.payload?.mes && A.asistente && A.pedirExplicacion('grafico-mes', `Cobros de ${d.payload.name}`, undefined, { mes: d.payload.mes, cobros: d.payload.Cobros, saldo: d.payload.Saldo }, d.payload.mes)} />
              <Bar dataKey="Pagos" fill="#f59e0b" radius={[3, 3, 0, 0]} className="cursor-pointer"
                onClick={(d: any) => d?.payload?.mes && A.asistente && A.pedirExplicacion('grafico-mes', `Pagos de ${d.payload.name}`, undefined, { mes: d.payload.mes, pagos: d.payload.Pagos, saldo: d.payload.Saldo }, d.payload.mes)} />
              <Line type="monotone" dataKey="Saldo" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4" data-explica="caja-proyeccion" data-explica-titulo={`Proyección de caja a ${horizonte} días`} data-explica-datos={JSON.stringify(proy)}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-neutral-900"><CalendarClock size={14} className="mr-1 inline" />Proyección de caja{data.actualizadoEn && <span className="ml-2 text-[10px] font-normal text-neutral-400">· act. {fmtActualizado(data.actualizadoEn)}</span>}</span>
          <div className="flex gap-1">
            {[7, 30, 60, 90].map(d => (
              <button key={d} onClick={() => setHorizonte(d)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium ${horizonte === d ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                {d} días
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg bg-neutral-50 p-3">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">Saldo actual</div>
            <div className="mt-1 font-semibold">{fmtMoney(data.saldoActual, moneda)}</div>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3">
            <div className="text-[11px] uppercase tracking-wide text-emerald-700">Cobros previstos {horizonte}d</div>
            <div className="mt-1 font-semibold text-emerald-700">+{fmtMoney(proy.cobros, moneda)}</div>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <div className="text-[11px] uppercase tracking-wide text-amber-700">Pagos previstos {horizonte}d</div>
            <div className="mt-1 font-semibold text-amber-700">−{fmtMoney(proy.pagos, moneda)}</div>
          </div>
          <div className={`rounded-lg p-3 ${proy.saldoProyectado >= 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
            <div className={`text-[11px] uppercase tracking-wide ${proy.saldoProyectado >= 0 ? 'text-blue-700' : 'text-red-700'}`}>Saldo proyectado</div>
            <div className={`mt-1 font-semibold ${proy.saldoProyectado >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmtMoney(proy.saldoProyectado, moneda)}</div>
          </div>
        </div>
        {data.recurrentesMensual > 0 && <p className="mt-2 text-[11px] text-neutral-400">Además hay {fmtMoney(data.recurrentesMensual, moneda)}/mes de gastos recurrentes comprometidos.</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-900">Próximos cobros <span className="font-normal text-neutral-400">({horizonte} días)</span></div>
          <table className="w-full text-sm">
            <tbody>
              {cortes.slice(0, 12).map((c, i) => (
                <tr key={i} data-explica="caja-cobro" data-explica-titulo={c.concepto} data-explica-datos={JSON.stringify(c)}
                  className="border-b border-neutral-100 last:border-0">
                  <td className="w-24 px-4 py-2 text-xs text-neutral-400">{fmtFecha(c.fecha)}</td>
                  <td className="max-w-60 truncate px-4 py-2 text-neutral-700" title={c.concepto}>{c.concepto}</td>
                  <td className="w-32 px-4 py-2 text-right font-medium text-emerald-700">{fmtMoney(c.importe, moneda)}</td>
                </tr>
              ))}
              {cortes.length === 0 && <tr><td className="px-4 py-8 text-center text-neutral-400">Sin cobros previstos en el horizonte.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-900">Próximos pagos <span className="font-normal text-neutral-400">({horizonte} días)</span></div>
          <table className="w-full text-sm">
            <tbody>
              {cortesP.slice(0, 12).map((c, i) => (
                <tr key={i} data-explica="caja-pago" data-explica-titulo={c.concepto} data-explica-datos={JSON.stringify(c)}
                  className="border-b border-neutral-100 last:border-0">
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
    </div>
  );
}
