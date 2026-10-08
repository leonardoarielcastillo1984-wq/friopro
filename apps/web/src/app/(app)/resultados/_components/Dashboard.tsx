'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Building2, ChevronRight, Loader2 } from 'lucide-react';
import { fmtMoney, fmtPct, fmtFecha, MESES, GRUPO_LABEL } from './fmt';

type Mes = {
  mes: number; mesKey: string; facturado: number; ingresosOperativos: number;
  ventas: number; cobrado: number; costosOperativos: number; estructura: number;
  costosTotales: number; resultado: number; margen: number | null; lineas: number;
};

type Linea = {
  fecha: string; concepto: string; importe: number; grupo: string; fuente: string;
  modulo: string; origenId: string | null; origenUrl: string | null; centroCostoId: string | null;
};

export default function Dashboard({ anio, moneda, centroCostoId }: { anio: number; moneda: string; centroCostoId: string }) {
  const [data, setData] = useState<{ meses: Mes[]; totales: any } | null>(null);
  const [detalle, setDetalle] = useState<{ mes: number; lineas: Linea[]; porGrupo: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [grupoFiltro, setGrupoFiltro] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    setDetalle(null);
    const params = new URLSearchParams({ anio: String(anio) });
    if (moneda) params.set('moneda', moneda);
    if (centroCostoId) params.set('centroCostoId', centroCostoId);
    apiFetch<{ meses: Mes[]; totales: any }>(`/finanzas/resultado-mensual?${params}`)
      .then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [anio, moneda, centroCostoId]);

  const abrirDetalle = async (mes: number) => {
    setLoadingDetalle(true);
    setGrupoFiltro('');
    const params = new URLSearchParams({ anio: String(anio), mes: String(mes) });
    if (moneda) params.set('moneda', moneda);
    if (centroCostoId) params.set('centroCostoId', centroCostoId);
    try {
      const d = await apiFetch<{ lineas: Linea[]; porGrupo: Record<string, number> }>(`/finanzas/resultado-mensual/detalle?${params}`);
      setDetalle({ mes, lineas: d.lineas, porGrupo: d.porGrupo });
    } finally { setLoadingDetalle(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-neutral-400"><Loader2 className="animate-spin mr-2" size={18} />Calculando consolidado…</div>;
  if (!data) return <div className="py-16 text-center text-neutral-400">No se pudo cargar el consolidado.</div>;

  const { meses, totales } = data;
  const ultimo = meses[meses.length - 1];
  const maxAbs = Math.max(1, ...meses.map(m => Math.max(Math.abs(m.ventas), Math.abs(m.costosTotales))));

  return (
    <div className="space-y-4">
      {/* KPIs año */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Ventas YTD', value: fmtMoney(totales.ventas, moneda), icon: DollarSign, color: 'text-blue-600' },
          { label: 'Cobrado YTD', value: fmtMoney(totales.cobrado, moneda), icon: Wallet, color: 'text-emerald-600' },
          { label: 'Costos YTD', value: fmtMoney(totales.costos, moneda), icon: Building2, color: 'text-amber-600' },
          { label: 'Resultado YTD', value: fmtMoney(totales.resultado, moneda), icon: totales.resultado >= 0 ? TrendingUp : TrendingDown, color: totales.resultado >= 0 ? 'text-green-600' : 'text-red-600' },
          { label: 'Margen YTD', value: fmtPct(totales.margen), icon: TrendingUp, color: (totales.margen ?? 0) >= 0 ? 'text-green-600' : 'text-red-600' },
        ].map((k, i) => (
          <div key={i} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500"><k.icon size={13} className={k.color} />{k.label}</div>
            <div className="mt-1 text-lg font-semibold text-neutral-900">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Último mes */}
      {ultimo && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="text-sm font-semibold text-neutral-900">{MESES[ultimo.mes - 1]} {anio} — en números</div>
          <div className="mt-3 grid grid-cols-3 gap-x-6 gap-y-1 text-sm lg:grid-cols-6">
            <span className="text-neutral-500">Facturado</span><span className="font-medium">{fmtMoney(ultimo.facturado, moneda)}</span>
            <span className="text-neutral-500">Ingresos op.</span><span className="font-medium">{fmtMoney(ultimo.ingresosOperativos, moneda)}</span>
            <span className="text-neutral-500">Costos</span><span className="font-medium text-amber-700">{fmtMoney(ultimo.costosTotales, moneda)}</span>
            <span className="text-neutral-500">Estructura</span><span className="font-medium">{fmtMoney(ultimo.estructura, moneda)}</span>
            <span className="text-neutral-500">Cobrado</span><span className="font-medium text-emerald-700">{fmtMoney(ultimo.cobrado, moneda)}</span>
            <span className="text-neutral-500">Resultado</span><span className={`font-semibold ${ultimo.resultado >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtMoney(ultimo.resultado, moneda)}</span>
          </div>
        </div>
      )}

      {/* Tabla mensual con barras */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2.5 font-medium">Mes</th>
              <th className="px-4 py-2.5 text-right font-medium">Ventas</th>
              <th className="px-4 py-2.5 text-right font-medium">Cobrado</th>
              <th className="px-4 py-2.5 text-right font-medium">Costos</th>
              <th className="px-4 py-2.5 text-right font-medium">Resultado</th>
              <th className="px-4 py-2.5 text-right font-medium">Margen</th>
              <th className="px-4 py-2.5 w-40 font-medium"></th>
              <th className="px-2 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {meses.map(m => (
              <tr key={m.mes} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60 cursor-pointer" onClick={() => abrirDetalle(m.mes)}>
                <td className="px-4 py-2.5 font-medium text-neutral-900">{MESES[m.mes - 1]}</td>
                <td className="px-4 py-2.5 text-right">{fmtMoney(m.ventas, moneda)}</td>
                <td className="px-4 py-2.5 text-right text-emerald-700">{fmtMoney(m.cobrado, moneda)}</td>
                <td className="px-4 py-2.5 text-right text-amber-700">{fmtMoney(m.costosTotales, moneda)}</td>
                <td className={`px-4 py-2.5 text-right font-semibold ${m.resultado >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtMoney(m.resultado, moneda)}</td>
                <td className="px-4 py-2.5 text-right text-neutral-500">{fmtPct(m.margen)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div className="bg-blue-400" style={{ width: `${Math.min(100, (Math.abs(m.ventas) / maxAbs) * 100)}%` }} />
                    <div className="bg-amber-400" style={{ width: `${Math.min(100, (Math.abs(m.costosTotales) / maxAbs) * 100)}%` }} />
                  </div>
                </td>
                <td className="px-2 py-2.5 text-neutral-400"><ChevronRight size={14} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-400">Resultado = ventas (facturado + ingresos operativos) − costos − estructura. Clic en un mes para ver el detalle con trazabilidad al origen.</p>

      {/* Detalle del mes */}
      {detalle && (
        <div className="rounded-xl border border-neutral-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-3">
            <span className="text-sm font-semibold text-neutral-900">Detalle — {MESES[detalle.mes - 1]} {anio}</span>
            <div className="ml-auto flex gap-1">
              {['', 'FACTURADO', 'INGRESO_OPERATIVO', 'COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL', 'COBRADO'].map(g => (
                <button key={g} onClick={() => setGrupoFiltro(g)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${grupoFiltro === g ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                  {g ? GRUPO_LABEL[g] : 'Todo'}
                </button>
              ))}
            </div>
          </div>
          {loadingDetalle ? <div className="p-6 text-center text-neutral-400"><Loader2 className="inline animate-spin" size={16} /></div> : (
            <table className="w-full text-sm">
              <tbody>
                {detalle.lineas.filter(l => !grupoFiltro || l.grupo === grupoFiltro).map((l, i) => (
                  <tr key={i} className="border-b border-neutral-100 last:border-0">
                    <td className="w-24 px-4 py-2 text-xs text-neutral-400">{fmtFecha(l.fecha)}</td>
                    <td className="px-4 py-2 text-neutral-800">
                      {l.origenUrl ? <a href={l.origenUrl} className="hover:text-blue-600 hover:underline">{l.concepto}</a> : l.concepto}
                      <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">{l.fuente}</span>
                    </td>
                    <td className="w-32 px-4 py-2 text-xs text-neutral-400">{l.modulo}</td>
                    <td className={`w-36 px-4 py-2 text-right font-medium ${l.importe < 0 ? 'text-red-600' : ['COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL'].includes(l.grupo) ? 'text-amber-700' : 'text-neutral-900'}`}>
                      {fmtMoney(l.importe, moneda)}
                    </td>
                  </tr>
                ))}
                {detalle.lineas.filter(l => !grupoFiltro || l.grupo === grupoFiltro).length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-neutral-400">Sin movimientos en este grupo.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
