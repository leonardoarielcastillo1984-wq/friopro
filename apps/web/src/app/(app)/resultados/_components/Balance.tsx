'use client';

// BALANCE — estado de situación patrimonial estimado a fin de mes.
// Gerencial, no contable: activo (caja + CxC + flota) contra pasivo
// (CxP + IVA a pagar) y patrimonio por diferencia.

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Loader2, Landmark, Scale, Truck, Info } from 'lucide-react';
import { fmtMoney, fmtActualizado, MESES } from './fmt';
import { useAsistente } from './useAsistente';

type BalanceData = {
  anio: number; mes: number; moneda: string | null; alCorteDe: string;
  activo: {
    corriente: { caja: number; cuentasPorCobrar: number; total: number };
    noCorriente: { flotaValorEstimado: number; total: number; unidades: number };
    total: number;
  };
  pasivo: {
    corriente: { cuentasPorPagar: number; cxpVencido: number; ivaAPagarEstimado: number; total: number };
    total: number;
  };
  patrimonio: { estimado: number; nota: string };
  ratios: { liquidez: number | null; endeudamiento: number | null };
  flotaDetalle: { dominio: string; tipo: string; anio: number | null; precioCompra: number; valorEstimado: number }[];
  supuestos: string[];
  actualizadoEn?: string;
};

export default function Balance({ anio, moneda }: { anio: number; moneda: string }) {
  const hoy = new Date();
  const [mesSel, setMesSel] = useState(anio === hoy.getUTCFullYear() ? hoy.getUTCMonth() + 1 : 12);
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const A = useAsistente({ anio, mes: mesSel, moneda });

  useEffect(() => {
    setMesSel(anio === hoy.getUTCFullYear() ? hoy.getUTCMonth() + 1 : 12);
  }, [anio]);

  useEffect(() => {
    setLoading(true); setError(null);
    apiFetch<BalanceData>(`/finanzas/balance?anio=${anio}&mes=${mesSel}&moneda=${moneda}`)
      .then(setData)
      .catch((e: any) => { setData(null); setError(e?.message || 'No se pudo cargar'); })
      .finally(() => setLoading(false));
  }, [anio, mesSel, moneda]);

  if (loading) return <div className="flex items-center justify-center py-16 text-neutral-400"><Loader2 className="mr-2 animate-spin" size={18} />Calculando balance…</div>;
  if (error || !data) return <div className="py-16 text-center text-neutral-400">{error || 'Sin datos'}</div>;

  const { activo, pasivo, patrimonio, ratios } = data;
  const mesesOpts = Array.from({ length: anio === hoy.getUTCFullYear() ? hoy.getUTCMonth() + 1 : 12 }, (_, i) => i + 1);

  const Fila = ({ label, valor, exp, strong, warn }: { label: string; valor: number; exp?: string; strong?: boolean; warn?: boolean }) => (
    <div className="flex items-center justify-between border-b border-neutral-100 py-1.5 last:border-0" {...(exp ? { 'data-explica': exp, 'data-explica-titulo': label } : {})}>
      <span className={`text-xs ${strong ? 'font-semibold text-neutral-900' : 'text-neutral-600'}`}>{label}</span>
      <span className={`text-sm ${strong ? 'font-bold' : 'font-medium'} ${warn ? 'text-red-600' : 'text-neutral-900'}`}>{fmtMoney(valor, moneda)}</span>
    </div>
  );

  return (
    <div className={`space-y-4 ${A.wrap.className}`} onClickCapture={A.onAsistenteClick}>
      {A.Estilos}
      <div className="-mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2"><A.Boton /><A.PreguntaBar /></div>
        <div className="flex items-center gap-2">
          <select value={mesSel} onChange={e => setMesSel(Number(e.target.value))} className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs">
            {mesesOpts.map(m => <option key={m} value={m}>Al cierre de {MESES[m - 1]} {anio}</option>)}
          </select>
          {data.actualizadoEn && <span className="text-[10px] text-neutral-400">act. {fmtActualizado(data.actualizadoEn)}</span>}
        </div>
      </div>
      {A.Panel}

      <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-2.5 text-xs text-amber-800" data-explica="balance-activo" data-explica-titulo="Balance gerencial">
        <strong>Balance estimado al {data.alCorteDe}</strong> — foto gerencial de lo que la empresa tiene y debe. No reemplaza al balance contable del contador.
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ACTIVO */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4" data-explica="balance-activo" data-explica-titulo="Activo" data-explica-datos={JSON.stringify({ caja: activo.corriente.caja, cxc: activo.corriente.cuentasPorCobrar, flota: activo.noCorriente.flotaValorEstimado, total: activo.total })}>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-900"><Landmark size={15} className="text-blue-600" />Activo</div>
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-neutral-400">Corriente</div>
          <Fila label="Caja estimada" valor={activo.corriente.caja} exp="balance-caja" />
          <Fila label="Cuentas por cobrar" valor={activo.corriente.cuentasPorCobrar} exp="balance-cxc" />
          <Fila label="Total corriente" valor={activo.corriente.total} strong />
          <div className="mb-2 mt-4 text-[10px] font-medium uppercase tracking-wide text-neutral-400">No corriente</div>
          <Fila label={`Flota (${activo.noCorriente.unidades} unidades)`} valor={activo.noCorriente.flotaValorEstimado} exp="balance-flota" />
          <div className="mt-3 flex items-center justify-between border-t-2 border-neutral-900 pt-2">
            <span className="text-sm font-bold">Total activo</span>
            <span className="text-base font-bold text-blue-700">{fmtMoney(activo.total, moneda)}</span>
          </div>
        </div>

        {/* PASIVO */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4" data-explica="balance-pasivo" data-explica-titulo="Pasivo" data-explica-datos={JSON.stringify({ cxp: pasivo.corriente.cuentasPorPagar, cxpVencido: pasivo.corriente.cxpVencido, iva: pasivo.corriente.ivaAPagarEstimado, total: pasivo.total })}>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-900"><Scale size={15} className="text-red-600" />Pasivo</div>
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-neutral-400">Corriente</div>
          <Fila label="Cuentas por pagar" valor={pasivo.corriente.cuentasPorPagar} exp="balance-cxp" />
          {pasivo.corriente.cxpVencido > 0 && <Fila label="· de lo cual vencido" valor={pasivo.corriente.cxpVencido} warn />}
          <Fila label="IVA a pagar estimado" valor={pasivo.corriente.ivaAPagarEstimado} exp="balance-iva" />
          <div className="mt-3 flex items-center justify-between border-t-2 border-neutral-900 pt-2">
            <span className="text-sm font-bold">Total pasivo</span>
            <span className="text-base font-bold text-red-700">{fmtMoney(pasivo.total, moneda)}</span>
          </div>
        </div>

        {/* PATRIMONIO + RATIOS */}
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-4" data-explica="balance-patrimonio" data-explica-titulo="Patrimonio estimado" data-explica-datos={JSON.stringify({ patrimonio: patrimonio.estimado })}>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">Patrimonio estimado</div>
            <div className={`text-2xl font-bold ${patrimonio.estimado >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmtMoney(patrimonio.estimado, moneda)}</div>
            <p className="mt-1 text-[11px] text-neutral-500">= activo − pasivo</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-neutral-400">Ratios</div>
            <div className="flex items-center justify-between border-b border-neutral-100 py-1.5" data-explica="balance-liquidez" data-explica-titulo="Liquidez corriente">
              <span className="text-xs text-neutral-600">Liquidez corriente</span>
              <span className={`text-sm font-bold ${ratios.liquidez === null ? 'text-neutral-300' : ratios.liquidez >= 1 ? 'text-green-700' : 'text-red-600'}`}>
                {ratios.liquidez === null ? '—' : ratios.liquidez.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5" data-explica="balance-endeudamiento" data-explica-titulo="Endeudamiento">
              <span className="text-xs text-neutral-600">Endeudamiento</span>
              <span className="text-sm font-bold text-neutral-900">{ratios.endeudamiento === null ? '—' : `${ratios.endeudamiento.toFixed(1)} %`}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detalle flota */}
      {data.flotaDetalle.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4" data-explica="balance-flota" data-explica-titulo="Valor de flota estimado">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900"><Truck size={15} className="text-neutral-600" />Flota — valor estimado por unidad</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-[10px] uppercase tracking-wide text-neutral-400">
                  <th className="px-3 py-1.5">Unidad</th><th className="px-3 py-1.5">Tipo</th><th className="px-3 py-1.5">Año</th>
                  <th className="px-3 py-1.5 text-right">Precio compra</th><th className="px-3 py-1.5 text-right">Valor estimado</th>
                </tr>
              </thead>
              <tbody>
                {data.flotaDetalle.map(v => (
                  <tr key={v.dominio} className="border-b border-neutral-50 last:border-0">
                    <td className="px-3 py-1.5 font-medium">{v.dominio}</td>
                    <td className="px-3 py-1.5 text-neutral-500">{v.tipo}</td>
                    <td className="px-3 py-1.5 text-neutral-500">{v.anio ?? '—'}</td>
                    <td className="px-3 py-1.5 text-right">{fmtMoney(v.precioCompra, moneda)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{fmtMoney(v.valorEstimado, moneda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Supuestos */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-neutral-700"><Info size={13} className="text-neutral-400" />Supuestos de la estimación</div>
        <ul className="ml-4 list-disc space-y-0.5 text-[11px] text-neutral-500">
          {data.supuestos.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </div>
    </div>
  );
}
