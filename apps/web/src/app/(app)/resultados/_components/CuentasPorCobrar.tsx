'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Loader2, Wallet, AlertTriangle, Clock, CalendarClock, Paperclip } from 'lucide-react';
import { fmtMoney, fmtFecha } from './fmt';

type Cliente = {
  cliente: string; rut: string | null; facturado: number; cobrado: number; notasCredito: number; saldo: number;
  aging: { corriente: number; d1_30: number; d31_60: number; d61_90: number; d90: number };
  diasPagoPromedio: number | null; frecuenciaPagoDias: number | null; facturasPagadas: number;
  ultimoCobro: string | null; pendientes: any[];
};

const BUCKETS: { key: keyof Cliente['aging']; label: string; color: string }[] = [
  { key: 'corriente', label: 'Sin vencer', color: 'bg-blue-400' },
  { key: 'd1_30', label: '1-30 días', color: 'bg-amber-300' },
  { key: 'd31_60', label: '31-60 días', color: 'bg-orange-400' },
  { key: 'd61_90', label: '61-90 días', color: 'bg-red-400' },
  { key: 'd90', label: '+90 días', color: 'bg-red-700' },
];

export default function CuentasPorCobrar({ moneda, onIrFacturacion }: { moneda: string; onIrFacturacion: () => void }) {
  const [data, setData] = useState<{ clientes: Cliente[]; totales: { saldo: number; vencido: number; d90: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    apiFetch<any>(`/finanzas/cuentas-por-cobrar?moneda=${moneda}`)
      .then(setData).catch((e: any) => setError(e?.message || 'No se pudo cargar')).finally(() => setLoading(false));
  }, [moneda]);

  if (loading) return <div className="py-16 text-center text-neutral-400"><Loader2 className="inline animate-spin" size={18} /></div>;
  if (error || !data) return <div className="py-16 text-center text-neutral-400">{error}</div>;
  const { clientes, totales } = data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500"><Wallet size={13} className="text-blue-600" />Nos deben en total</div>
          <div className="mt-1 text-xl font-semibold text-neutral-900">{fmtMoney(totales.saldo, moneda)}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500"><AlertTriangle size={13} className="text-amber-600" />Vencido</div>
          <div className="mt-1 text-xl font-semibold text-amber-700">{fmtMoney(totales.vencido, moneda)}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500"><AlertTriangle size={13} className="text-red-600" />Más de 90 días</div>
          <div className="mt-1 text-xl font-semibold text-red-600">{fmtMoney(totales.d90, moneda)}</div>
        </div>
      </div>

      {clientes.length === 0 && (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white py-12 text-center text-sm text-neutral-400">
          Sin facturas en {moneda}. <button onClick={onIrFacturacion} className="text-blue-600 hover:underline">Cargá o importá facturas</button> y registrá los cobros para ver cuánto debe cada cliente.
        </div>
      )}

      {clientes.map(c => {
        const totalAging = BUCKETS.reduce((s, b) => s + c.aging[b.key], 0);
        return (
          <div key={c.cliente + c.rut} className="rounded-xl border border-neutral-200 bg-white">
            <div className="flex flex-wrap items-start gap-6 border-b border-neutral-100 p-4">
              <div className="min-w-48 flex-1">
                <div className="text-base font-semibold text-neutral-900">{c.cliente}</div>
                {c.rut && <div className="text-xs text-neutral-400">RUT {c.rut}</div>}
                <div className="mt-2 text-xs text-neutral-500">
                  Facturado {fmtMoney(c.facturado, moneda)} · Cobrado {fmtMoney(c.cobrado, moneda)}
                  {c.notasCredito > 0 && <> · NC {fmtMoney(c.notasCredito, moneda)}</>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase text-neutral-400">Saldo adeudado</div>
                <div className={`text-xl font-semibold ${c.saldo > 0 ? 'text-amber-700' : 'text-green-700'}`}>{fmtMoney(c.saldo, moneda)}</div>
              </div>
              <div className="flex gap-6 text-sm">
                <div>
                  <div className="flex items-center gap-1 text-[11px] uppercase text-neutral-400"><Clock size={11} />Tarda en pagar</div>
                  <div className="font-semibold text-neutral-900">{c.diasPagoPromedio !== null ? `${c.diasPagoPromedio} días` : '—'}</div>
                  <div className="text-[10px] text-neutral-400">{c.facturasPagadas ? `promedio de ${c.facturasPagadas} facturas` : 'sin facturas pagadas'}</div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-[11px] uppercase text-neutral-400"><CalendarClock size={11} />Paga cada</div>
                  <div className="font-semibold text-neutral-900">{c.frecuenciaPagoDias !== null ? `${c.frecuenciaPagoDias} días` : '—'}</div>
                  <div className="text-[10px] text-neutral-400">último pago {fmtFecha(c.ultimoCobro)}</div>
                </div>
              </div>
            </div>

            {totalAging > 0 && (
              <div className="px-4 pt-3">
                <div className="flex h-3 overflow-hidden rounded-full bg-neutral-100">
                  {BUCKETS.map(b => c.aging[b.key] > 0 && (
                    <div key={b.key} className={b.color} style={{ width: `${(c.aging[b.key] / totalAging) * 100}%` }} title={`${b.label}: ${fmtMoney(c.aging[b.key], moneda)}`} />
                  ))}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-500">
                  {BUCKETS.map(b => (
                    <span key={b.key} className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${b.color}`} />{b.label}: <b className="text-neutral-700">{fmtMoney(c.aging[b.key], moneda)}</b></span>
                  ))}
                </div>
              </div>
            )}

            {c.pendientes.length > 0 ? (
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-400">
                    <th className="px-4 py-2 font-medium">Factura</th><th className="px-4 py-2 font-medium">Emisión</th>
                    <th className="px-4 py-2 font-medium">Vence</th><th className="px-4 py-2 text-right font-medium">Total</th>
                    <th className="px-4 py-2 text-right font-medium">Saldo</th><th className="px-4 py-2 text-right font-medium">Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {c.pendientes.map((p: any) => (
                    <tr key={p.id} className="border-t border-neutral-100">
                      <td className="px-4 py-2 text-neutral-700">
                        {p.numero || 's/n'}
                        {p.fileUrl && <a href={p.fileUrl} target="_blank" rel="noreferrer" className="ml-1.5 inline-block text-blue-500" title="Ver factura"><Paperclip size={12} /></a>}
                      </td>
                      <td className="px-4 py-2 text-xs text-neutral-500">{fmtFecha(p.fechaEmision)}</td>
                      <td className="px-4 py-2 text-xs text-neutral-500">{fmtFecha(p.fechaVencimiento)}</td>
                      <td className="px-4 py-2 text-right">{fmtMoney(p.total, p.moneda)}</td>
                      <td className="px-4 py-2 text-right font-medium text-amber-700">{fmtMoney(p.saldo, p.moneda)}</td>
                      <td className={`px-4 py-2 text-right text-xs font-medium ${p.diasAtraso > 60 ? 'text-red-600' : p.diasAtraso > 0 ? 'text-amber-600' : 'text-neutral-400'}`}>
                        {p.diasAtraso > 0 ? `${p.diasAtraso} días` : 'al día'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="px-4 py-3 text-xs text-green-700">No tiene facturas pendientes.</div>}
          </div>
        );
      })}
      <p className="text-xs text-neutral-400">
        "Tarda en pagar" = días promedio entre la emisión y el cobro que canceló cada factura. "Paga cada" = intervalo promedio entre pagos recibidos.
        Los importes incluyen IVA (es lo que el cliente transfiere).
      </p>
    </div>
  );
}
