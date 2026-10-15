'use client';

// BALANCE — estado de situación patrimonial estimado a fin de mes.
// Mix gerencial/contable para ejercicio anual al 31/12 (Chile):
// activo (caja + CxC + remanente IVA + PPM + flota depreciada), pasivo
// corriente (CxP + IVA + provisión laboral + deuda <12m) y no corriente
// (cuotas leasing/préstamo >12m), patrimonio compuesto cruzado contra
// el implícito (activo − pasivo) como control de calidad.

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Loader2, Landmark, Scale, Truck, Info, CalendarDays, CreditCard } from 'lucide-react';
import { fmtMoney, fmtActualizado, MESES } from './fmt';
import { useAsistente } from './useAsistente';

type BalanceData = {
  anio: number; mes: number; moneda: string | null; alCorteDe: string;
  activo: {
    corriente: { caja: number; cuentasPorCobrar: number; remanenteIva: number; ppmAnticipos: number; total: number };
    noCorriente: { flotaValorEstimado: number; total: number; unidades: number };
    total: number;
  };
  pasivo: {
    corriente: { cuentasPorPagar: number; cxpVencido: number; ivaAPagarEstimado: number; provisionLaboral: number; financiacionCorriente: number; total: number };
    noCorriente: { financiacionFlota: number; total: number };
    total: number;
  };
  patrimonio: {
    capital: number; utilidadesRetenidas: number; resultadoEjercicio: number; retiros: number;
    compuesto: number; implicito: number; diferencia: number; nota: string;
  };
  ratios: { liquidez: number | null; endeudamiento: number | null };
  flotaDetalle: { dominio: string; tipo: string; anio: number | null; precioCompra: number; valorEstimado: number }[];
  financiacionDetalle: { dominio: string; cuotaMensual: number; cuotasRestantes: number; deudaCorriente: number; deudaNoCorriente: number }[];
  supuestos: string[];
  actualizadoEn?: string;
};

export default function Balance({ anio, moneda }: { anio: number; moneda: string }) {
  const hoy = new Date();
  const esActual = anio === hoy.getUTCFullYear();
  const [mesSel, setMesSel] = useState(esActual ? hoy.getUTCMonth() + 1 : 12);
  const [ejercicio, setEjercicio] = useState(!esActual); // año pasado → 31/12 por defecto
  const [data, setData] = useState<BalanceData | null>(null);
  const [ant, setAnt] = useState<BalanceData | null>(null); // ejercicio anterior (31/12 año-1)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const A = useAsistente({ anio, mes: mesSel, moneda });

  useEffect(() => {
    const cur = anio === hoy.getUTCFullYear();
    setMesSel(cur ? hoy.getUTCMonth() + 1 : 12);
    setEjercicio(!cur);
  }, [anio]);

  const mesEfectivo = ejercicio ? 12 : mesSel;

  useEffect(() => {
    setLoading(true); setError(null);
    apiFetch<BalanceData>(`/finanzas/balance?anio=${anio}&mes=${mesEfectivo}&moneda=${moneda}`)
      .then(setData)
      .catch((e: any) => { setData(null); setError(e?.message || 'No se pudo cargar'); })
      .finally(() => setLoading(false));
    // En modo ejercicio: traer también el 31/12 del año anterior para comparar.
    if (ejercicio) {
      apiFetch<BalanceData>(`/finanzas/balance?anio=${anio - 1}&mes=12&moneda=${moneda}`)
        .then(setAnt).catch(() => setAnt(null));
    } else setAnt(null);
  }, [anio, mesEfectivo, moneda, ejercicio]);

  if (loading) return <div className="flex items-center justify-center py-16 text-neutral-400"><Loader2 className="mr-2 animate-spin" size={18} />Calculando balance…</div>;
  if (error || !data) return <div className="py-16 text-center text-neutral-400">{error || 'Sin datos'}</div>;

  const { activo, pasivo, patrimonio, ratios } = data;
  const mesesOpts = Array.from({ length: esActual ? hoy.getUTCMonth() + 1 : 12 }, (_, i) => i + 1);
  const difPatrimonio = Math.abs(patrimonio.diferencia);
  const hayPatrimonioCfg = patrimonio.capital !== 0 || patrimonio.utilidadesRetenidas !== 0 || patrimonio.retiros !== 0;

  // Comparación vs ejercicio anterior (solo en modo ejercicio)
  const Delta = ({ ahora, antes }: { ahora: number; antes?: number }) => {
    if (antes === undefined) return null;
    const d = ahora - antes;
    if (Math.abs(d) < 1) return <span className="text-[10px] text-neutral-300">=</span>;
    return <span className={`text-[10px] font-medium ${d >= 0 ? 'text-green-600' : 'text-red-500'}`}>{d >= 0 ? '+' : '−'}{fmtMoney(Math.abs(d), moneda)}</span>;
  };

  const Fila = ({ label, valor, antes, exp, strong, warn }: { label: string; valor: number; antes?: number; exp?: string; strong?: boolean; warn?: boolean }) => (
    <div className="flex items-center justify-between border-b border-neutral-100 py-1.5 last:border-0" {...(exp ? { 'data-explica': exp, 'data-explica-titulo': label } : {})}>
      <span className={`text-xs ${strong ? 'font-semibold text-neutral-900' : 'text-neutral-600'}`}>{label}</span>
      <span className="flex items-center gap-1.5">
        {ejercicio && <Delta ahora={valor} antes={antes} />}
        <span className={`text-sm ${strong ? 'font-bold' : 'font-medium'} ${warn ? 'text-red-600' : 'text-neutral-900'}`}>{fmtMoney(valor, moneda)}</span>
      </span>
    </div>
  );

  return (
    <div className={`space-y-4 ${A.wrap.className}`} onClickCapture={A.onAsistenteClick}>
      {A.Estilos}
      <div className="-mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2"><A.Boton /><A.PreguntaBar /></div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEjercicio(v => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${ejercicio ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'}`}
            title="Corte al 31/12 del ejercicio + comparación con el 31/12 anterior">
            <CalendarDays size={13} />Ejercicio {anio} (31/12)
          </button>
          {!ejercicio && (
            <select value={mesSel} onChange={e => setMesSel(Number(e.target.value))} className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs">
              {mesesOpts.map(m => <option key={m} value={m}>Al cierre de {MESES[m - 1]} {anio}</option>)}
            </select>
          )}
          {data.actualizadoEn && <span className="text-[10px] text-neutral-400">act. {fmtActualizado(data.actualizadoEn)}</span>}
        </div>
      </div>
      {A.Panel}

      <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-2.5 text-xs text-amber-800" data-explica="balance-general" data-explica-titulo="Balance gerencial">
        <strong>Balance estimado al {data.alCorteDe}</strong>{ejercicio && <>, comparado contra el ejercicio anterior (31/12/{anio - 1})</>} — foto gerencial de lo que la empresa tiene y debe. No reemplaza al balance contable del contador.
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ACTIVO */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4" data-explica="balance-activo" data-explica-titulo="Activo" data-explica-datos={JSON.stringify({ caja: activo.corriente.caja, cxc: activo.corriente.cuentasPorCobrar, flota: activo.noCorriente.flotaValorEstimado, total: activo.total })}>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-900"><Landmark size={15} className="text-blue-600" />Activo</div>
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-neutral-400">Corriente</div>
          <Fila label="Caja estimada" valor={activo.corriente.caja} antes={ant?.activo.corriente.caja} exp="balance-caja" />
          <Fila label="Cuentas por cobrar" valor={activo.corriente.cuentasPorCobrar} antes={ant?.activo.corriente.cuentasPorCobrar} exp="balance-cxc" />
          {activo.corriente.remanenteIva > 0 && <Fila label="Remanente crédito IVA" valor={activo.corriente.remanenteIva} antes={ant?.activo.corriente.remanenteIva} exp="balance-remanente" />}
          {activo.corriente.ppmAnticipos > 0 && <Fila label="PPM anticipados" valor={activo.corriente.ppmAnticipos} antes={ant?.activo.corriente.ppmAnticipos} exp="balance-ppm" />}
          <Fila label="Total corriente" valor={activo.corriente.total} antes={ant?.activo.corriente.total} strong />
          <div className="mb-2 mt-4 text-[10px] font-medium uppercase tracking-wide text-neutral-400">No corriente</div>
          <Fila label={`Flota (${activo.noCorriente.unidades} unidades)`} valor={activo.noCorriente.flotaValorEstimado} antes={ant?.activo.noCorriente.flotaValorEstimado} exp="balance-flota" />
          <div className="mt-3 flex items-center justify-between border-t-2 border-neutral-900 pt-2">
            <span className="text-sm font-bold">Total activo</span>
            <span className="flex items-center gap-1.5">
              {ejercicio && <Delta ahora={activo.total} antes={ant?.activo.total} />}
              <span className="text-base font-bold text-blue-700">{fmtMoney(activo.total, moneda)}</span>
            </span>
          </div>
        </div>

        {/* PASIVO */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4" data-explica="balance-pasivo" data-explica-titulo="Pasivo" data-explica-datos={JSON.stringify({ cxp: pasivo.corriente.cuentasPorPagar, cxpVencido: pasivo.corriente.cxpVencido, iva: pasivo.corriente.ivaAPagarEstimado, total: pasivo.total })}>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-900"><Scale size={15} className="text-red-600" />Pasivo</div>
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-neutral-400">Corriente (&lt;12 meses)</div>
          <Fila label="Cuentas por pagar" valor={pasivo.corriente.cuentasPorPagar} antes={ant?.pasivo.corriente.cuentasPorPagar} exp="balance-cxp" />
          {pasivo.corriente.cxpVencido > 0 && <Fila label="· de lo cual vencido" valor={pasivo.corriente.cxpVencido} warn />}
          <Fila label="IVA a pagar estimado" valor={pasivo.corriente.ivaAPagarEstimado} antes={ant?.pasivo.corriente.ivaAPagarEstimado} exp="balance-iva" />
          {pasivo.corriente.provisionLaboral > 0 && <Fila label="Remuneraciones por pagar" valor={pasivo.corriente.provisionLaboral} antes={ant?.pasivo.corriente.provisionLaboral} exp="balance-provision" />}
          {pasivo.corriente.financiacionCorriente > 0 && <Fila label="Deuda financiera flota" valor={pasivo.corriente.financiacionCorriente} antes={ant?.pasivo.corriente.financiacionCorriente} exp="balance-deuda-fin" />}
          <Fila label="Total corriente" valor={pasivo.corriente.total} antes={ant?.pasivo.corriente.total} strong />
          <div className="mb-2 mt-4 text-[10px] font-medium uppercase tracking-wide text-neutral-400">No corriente (&gt;12 meses)</div>
          <Fila label="Leasing / préstamo flota" valor={pasivo.noCorriente.financiacionFlota} antes={ant?.pasivo.noCorriente.financiacionFlota} exp="balance-deuda-fin" />
          <div className="mt-3 flex items-center justify-between border-t-2 border-neutral-900 pt-2">
            <span className="text-sm font-bold">Total pasivo</span>
            <span className="flex items-center gap-1.5">
              {ejercicio && <Delta ahora={pasivo.total} antes={ant?.pasivo.total} />}
              <span className="text-base font-bold text-red-700">{fmtMoney(pasivo.total, moneda)}</span>
            </span>
          </div>
        </div>

        {/* PATRIMONIO + RATIOS */}
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-4" data-explica="balance-patrimonio" data-explica-titulo="Patrimonio" data-explica-datos={JSON.stringify(patrimonio)}>
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-neutral-400">Patrimonio</div>
            {hayPatrimonioCfg ? (
              <>
                <Fila label="Capital aportado" valor={patrimonio.capital} />
                <Fila label="Utilidades retenidas" valor={patrimonio.utilidadesRetenidas} />
                <Fila label="Resultado del ejercicio" valor={patrimonio.resultadoEjercicio} warn={patrimonio.resultadoEjercicio < 0} />
                {patrimonio.retiros !== 0 && <Fila label="Retiros / distribuciones" valor={-patrimonio.retiros} warn />}
                <div className="mt-2 flex items-center justify-between border-t-2 border-neutral-900 pt-2">
                  <span className="text-xs font-semibold">Compuesto</span>
                  <span className={`text-base font-bold ${patrimonio.compuesto >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmtMoney(patrimonio.compuesto, moneda)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] text-neutral-400">Implícito (activo − pasivo)</span>
                  <span className="text-xs font-medium text-neutral-600">{fmtMoney(patrimonio.implicito, moneda)}</span>
                </div>
                {difPatrimonio > Math.max(1, Math.abs(patrimonio.implicito) * 0.05) && (
                  <p className="mt-1.5 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-700">Diferencia de {fmtMoney(difPatrimonio, moneda)} contra el compuesto — hay movimientos fuera del sistema (datos faltantes o cifras de config por revisar).</p>
                )}
              </>
            ) : (
              <>
                <div className={`text-2xl font-bold ${patrimonio.implicito >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmtMoney(patrimonio.implicito, moneda)}</div>
                <p className="mt-1 text-[11px] text-neutral-500">= activo − pasivo. Configurá capital aportado y retiros en <b>Configuración → Patrimonio</b> para descomponerlo.</p>
              </>
            )}
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

      {/* Detalle deuda financiera flota */}
      {data.financiacionDetalle.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4" data-explica="balance-deuda-fin" data-explica-titulo="Deuda financiera de flota (leasing / préstamo)">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900"><CreditCard size={15} className="text-neutral-600" />Deuda financiera de flota — cuotas restantes por unidad</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-[10px] uppercase tracking-wide text-neutral-400">
                  <th className="px-3 py-1.5">Unidad</th><th className="px-3 py-1.5 text-right">Cuota mensual</th>
                  <th className="px-3 py-1.5 text-right">Cuotas restantes</th>
                  <th className="px-3 py-1.5 text-right">Corriente (&lt;12m)</th><th className="px-3 py-1.5 text-right">No corriente (&gt;12m)</th>
                </tr>
              </thead>
              <tbody>
                {data.financiacionDetalle.map(v => (
                  <tr key={v.dominio} className="border-b border-neutral-50 last:border-0">
                    <td className="px-3 py-1.5 font-medium">{v.dominio}</td>
                    <td className="px-3 py-1.5 text-right">{fmtMoney(v.cuotaMensual, moneda)}</td>
                    <td className="px-3 py-1.5 text-right text-neutral-500">{v.cuotasRestantes}</td>
                    <td className="px-3 py-1.5 text-right">{fmtMoney(v.deudaCorriente, moneda)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{fmtMoney(v.deudaNoCorriente, moneda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
