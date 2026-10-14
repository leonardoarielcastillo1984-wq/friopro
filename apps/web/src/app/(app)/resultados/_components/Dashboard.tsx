'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Building2, ChevronRight, Loader2, X, AlertTriangle, MessageSquare, Sparkles, Send, Scale, Receipt } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine, CartesianGrid, Legend } from 'recharts';
import { fmtMoney, fmtPct, fmtFecha, fmtActualizado, MESES, GRUPO_LABEL, labelRubro } from './fmt';

type Mes = {
  mes: number; mesKey: string; facturado: number; ingresosOperativos: number;
  ventas: number; cobrado: number; costosOperativos: number; estructura: number;
  costosTotales: number; resultado: number; margen: number | null; lineas: number;
  porRubro: Record<string, number>;
};
type Linea = {
  fecha: string; concepto: string; importe: number; grupo: string; fuente: string; rubro: string;
  modulo: string; origenId: string | null; origenUrl: string | null;
  iva?: number; ivaBruto?: number; ivaRecuperable?: boolean;
};
type Comparativa = {
  actual: any; mesAnterior: any; mismoMesAnioAnterior: any;
  vsMesAnterior: any; vsAnioAnterior: any; drivers: Driver[];
  actualizadoEn?: string;
};
type Driver = { tipo: 'INGRESO' | 'COSTO'; clave: string; variacion: number; actual: number; anterior: number };
type Alerta = { severidad: 'INFO' | 'ATENCION' | 'CRITICA'; tipo: string; mensaje: string; impacto: number };
type Comentario = { id: string; mesKey: string; texto: string; createdByNombre: string | null; createdAt: string; updatedAt: string };

const FUENTE_ING_LABEL: Record<string, string> = {
  FACTURA_EMITIDA: 'Facturación emitida', INGRESO_FLOTA: 'Ingresos operativos de flota',
};
const driverLabel = (d: Driver) => d.tipo === 'INGRESO' ? (FUENTE_ING_LABEL[d.clave] || d.clave) : labelRubro(d.clave);

const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1)}MM`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(Math.round(n));
};

function Rubros({ porRubro, moneda, titulo, act }: { porRubro: Record<string, number>; moneda: string; titulo: string; act?: string | null }) {
  const items = Object.entries(porRubro).filter(([, v]) => Math.abs(v) > 0.5).sort((a, b) => b[1] - a[1]);
  const total = items.reduce((s, [, v]) => s + v, 0);
  const max = Math.max(1, ...items.map(([, v]) => Math.abs(v)));
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-neutral-900">{titulo}</span>
        <span className="text-xs text-neutral-500">Total {fmtMoney(total, moneda)}{act !== undefined && <span className="ml-2 text-[10px] text-neutral-400">· act. {fmtActualizado(act)}</span>}</span>
      </div>
      {items.length === 0 ? <div className="py-4 text-center text-sm text-neutral-400">Sin costos registrados.</div> : (
        <div className="space-y-2">
          {items.map(([r, v]) => (
            <div key={r} className="grid grid-cols-[10rem_1fr_7rem_3rem] items-center gap-3 text-sm">
              <span className="truncate text-neutral-700" title={labelRubro(r)}>{labelRubro(r)}</span>
              <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${(Math.abs(v) / max) * 100}%` }} />
              </div>
              <span className="text-right font-medium text-neutral-900">{fmtMoney(v, moneda)}</span>
              <span className="text-right text-xs text-neutral-400">{total ? Math.round((v / total) * 100) : 0}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ anio, moneda, centroCostoId, canEdit }: { anio: number; moneda: string; centroCostoId: string; canEdit: boolean }) {
  const [data, setData] = useState<{ meses: Mes[]; totales: any } | null>(null);
  const [detalle, setDetalle] = useState<{ mes: number; lineas: Linea[]; porRubro: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [grupoFiltro, setGrupoFiltro] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const hoy = new Date();
  const [mesSel, setMesSel] = useState(anio === hoy.getUTCFullYear() ? hoy.getUTCMonth() + 1 : 12);
  const [comp, setComp] = useState<Comparativa | null>(null);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [alertasAct, setAlertasAct] = useState<string | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [iva, setIva] = useState<{ recuperado: number; noRecuperado: number; estimado: number; cargasSinDesagregar: number; tasaEstimada: number; debito: number; aPagar: number; remanente: number } | null>(null);
  const [ivaMeses, setIvaMeses] = useState<any[]>([]);
  const [ivaPorMeses, setIvaPorMeses] = useState(false);
  const [f29, setF29] = useState<{ configurado: boolean; declarado: boolean | null; vigente: { folio: string | null; fecha: string | null; estado: string | null } | null; declaraciones: any[]; periodo?: string; error?: string } | null>(null);
  const [f29Estados, setF29Estados] = useState<{ periodo: number; declarado: boolean; estado: string | null }[] | null>(null);
  const [f29Open, setF29Open] = useState(false);
  const [f29Det, setF29Det] = useState<any>(null);
  const [f29Montos, setF29Montos] = useState<any>(null);
  const [f29DetLoading, setF29DetLoading] = useState(false);
  const [f29PdfBusy, setF29PdfBusy] = useState<string | null>(null);
  const [ivaTasaEdit, setIvaTasaEdit] = useState<string | null>(null);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  const mesKey = `${anio}-${String(mesSel).padStart(2, '0')}`;

  useEffect(() => {
    setLoading(true); setDetalle(null); setError(null);
    const params = new URLSearchParams({ anio: String(anio), moneda });
    if (centroCostoId) params.set('centroCostoId', centroCostoId);
    apiFetch<{ meses: Mes[]; totales: any }>(`/finanzas/resultado-mensual?${params}`)
      .then(setData).catch((e: any) => { setData(null); setError(e?.message || null); }).finally(() => setLoading(false));
    setMesSel(anio === hoy.getUTCFullYear() ? hoy.getUTCMonth() + 1 : 12);
  }, [anio, moneda, centroCostoId]);

  // Capa gerencial del mes seleccionado: comparativa + alertas + comentarios
  useEffect(() => {
    const params = new URLSearchParams({ anio: String(anio), mes: String(mesSel), moneda });
    if (centroCostoId) params.set('centroCostoId', centroCostoId);
    apiFetch<Comparativa>(`/finanzas/comparativa?${params}`).then(setComp).catch(() => setComp(null));
    apiFetch<{ alertas: Alerta[]; actualizadoEn?: string }>(`/finanzas/alertas?${params}`).then(d => { setAlertas(d.alertas || []); setAlertasAct(d.actualizadoEn || null); }).catch(() => { setAlertas([]); setAlertasAct(null); });
    apiFetch<{ comentarios: Comentario[] }>(`/finanzas/comentarios-periodo?mesKey=${mesKey}${centroCostoId ? `&centroCostoId=${centroCostoId}` : ''}`).then(d => setComentarios(d.comentarios || [])).catch(() => setComentarios([]));
    apiFetch<{ meses: any[]; tasaEstimada?: number }>(`/finanzas/iva-credito?anio=${anio}&moneda=${moneda}${centroCostoId ? `&centroCostoId=${centroCostoId}` : ''}`)
      .then(d => { setIvaMeses(d.meses || []); const m = (d.meses || []).find((x: any) => x.mes === mesSel); setIva(m ? { recuperado: m.recuperado, noRecuperado: m.noRecuperado, estimado: m.estimado, cargasSinDesagregar: m.cargasSinDesagregar, debito: m.debito ?? 0, aPagar: m.aPagar ?? 0, remanente: m.remanente ?? 0, tasaEstimada: d.tasaEstimada ?? 0.21 } : null); })
      .catch(() => { setIva(null); setIvaMeses([]); });
  }, [anio, mesSel, moneda, centroCostoId, mesKey]);

  // F29 real del período (SII vía APIGateway) — effect propio: solo depende del
  // mes. Si queda en el effect compartido, moneda/centroCostoId cargando async
  // lo re-disparan y mandan una 2da consulta idéntica al SII → HTTP 400.
  const f29MesRef = useRef(mesKey);
  useEffect(() => {
    f29MesRef.current = mesKey;
    setF29(null);
    apiFetch<any>(`/finanzas/f29?periodo=${mesKey}`)
      // Descartar respuestas viejas: la consulta del mes anterior puede llegar
      // después (los períodos sin declarar tardan ~10s en el SII) y pisaría el
      // dato del mes que se está viendo.
      .then(d => {
        if (d?.periodo && d.periodo !== f29MesRef.current) return;
        setF29(prev => (d?.error && prev?.vigente && prev?.periodo === mesKey) ? prev : d);
      })
      .catch(() => setF29(null));
  }, [mesKey]);

  // Estado F29 de TODOS los períodos — una sola consulta al SII (cacheada 6h server)
  useEffect(() => {
    apiFetch<any>('/finanzas/f29/estados').then(d => setF29Estados(d?.periodos || [])).catch(() => setF29Estados([]));
  }, []);

  // Detalle + montos declarados al expandir la línea F29
  useEffect(() => {
    if (!f29Open || !f29?.vigente?.folio) return;
    setF29DetLoading(true); setF29Det(null); setF29Montos(null);
    apiFetch<any>(`/finanzas/f29/detalle?folio=${f29.vigente.folio}`).then(setF29Det).catch(() => setF29Det(null));
    apiFetch<any>(`/finanzas/f29/montos?periodo=${mesKey}`).then(setF29Montos).catch(() => setF29Montos(null))
      .finally(() => setF29DetLoading(false));
  }, [f29Open, f29?.vigente?.folio, mesKey]);

  // Descarga el PDF de la declaración (compacto o certificado solemne)
  const descargarF29Pdf = async (tipo: 'compacto' | 'solemne') => {
    const folio = f29?.vigente?.folio;
    if (!folio || f29PdfBusy) return;
    setF29PdfBusy(tipo);
    try {
      const res = await fetch(`/api/finanzas/f29/pdf?folio=${folio}&tipo=${tipo}`, {
        headers: { authorization: `Bearer ${localStorage.getItem('accessToken') || ''}`, 'x-tenant-id': localStorage.getItem('tenantId') || '' },
      });
      if (!res.ok) {
        const j: any = await res.json().catch(() => null);
        alert(j?.error || 'No se pudo descargar el PDF del F29');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `F29_${tipo}_${folio}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } finally { setF29PdfBusy(null); }
  };

  // Vencimiento F29: día 20 del mes siguiente al período
  const f29Vencido = (yyyymm: number) => Date.now() > new Date(Date.UTC(Math.floor(yyyymm / 100), yyyymm % 100, 20)).getTime();
  const f29EstadoDe = (yyyymm: number) => f29Estados?.find(p => Number(p.periodo) === yyyymm) || null;
  const f29YmActual = hoy.getUTCFullYear() * 100 + hoy.getUTCMonth() + 1;
  const f29Atrasados = (f29Estados || []).filter(p => !p.declarado && Number(p.periodo) < f29YmActual && f29Vencido(Number(p.periodo)));
  const f29AtrasadosAnio = f29Atrasados.filter(p => Math.floor(Number(p.periodo) / 100) === anio);
  const f29AtrasadosOtros = f29Atrasados.length - f29AtrasadosAnio.length;

  const guardarTasaIva = async () => {
    const v = Number(ivaTasaEdit);
    if (!Number.isFinite(v) || v < 0 || v > 50 || !moneda) return;
    setIvaTasaEdit(null);
    await apiFetch('/finanzas/config', { method: 'PUT', json: { ivaTasa: { [moneda]: v / 100 } } }).catch(() => {});
    const d = await apiFetch<{ meses: any[]; tasaEstimada?: number }>(`/finanzas/iva-credito?anio=${anio}&moneda=${moneda}${centroCostoId ? `&centroCostoId=${centroCostoId}` : ''}`).catch(() => null);
    if (d) { setIvaMeses(d.meses || []); const m = (d.meses || []).find((x: any) => x.mes === mesSel); if (m) setIva({ recuperado: m.recuperado, noRecuperado: m.noRecuperado, estimado: m.estimado, cargasSinDesagregar: m.cargasSinDesagregar, debito: m.debito ?? 0, aPagar: m.aPagar ?? 0, remanente: m.remanente ?? 0, tasaEstimada: d.tasaEstimada ?? v / 100 }); }
  };

  const enviarComentario = async () => {
    if (!nuevoComentario.trim()) return;
    setEnviandoComentario(true);
    try {
      await apiFetch('/finanzas/comentarios-periodo', { method: 'POST', body: JSON.stringify({ mesKey, texto: nuevoComentario.trim(), centroCostoId: centroCostoId || null }) });
      setNuevoComentario('');
      const d = await apiFetch<{ comentarios: Comentario[] }>(`/finanzas/comentarios-periodo?mesKey=${mesKey}${centroCostoId ? `&centroCostoId=${centroCostoId}` : ''}`).catch(() => ({ comentarios: [] }));
      setComentarios(d.comentarios || []);
    } finally { setEnviandoComentario(false); }
  };

  const abrirDetalle = async (mes: number) => {
    setMesSel(mes);
    setLoadingDetalle(true); setGrupoFiltro('');
    const params = new URLSearchParams({ anio: String(anio), mes: String(mes), moneda });
    if (centroCostoId) params.set('centroCostoId', centroCostoId);
    try {
      const d = await apiFetch<{ lineas: Linea[]; porRubro: Record<string, number> }>(`/finanzas/resultado-mensual/detalle?${params}`);
      setDetalle({ mes, lineas: d.lineas, porRubro: d.porRubro || {} });
      setTimeout(() => document.getElementById('fin-detalle')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } finally { setLoadingDetalle(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-neutral-400"><Loader2 className="mr-2 animate-spin" size={18} />Calculando resultado…</div>;
  if (!data) return <div className="py-16 text-center text-neutral-400">{error || 'No se pudo cargar el resultado.'}</div>;

  const { meses, totales } = data;
  const conMovimiento = meses.filter(m => m.lineas > 0);
  const mejor = conMovimiento.length ? conMovimiento.reduce((a, b) => (b.resultado > a.resultado ? b : a)) : null;
  const peor = conMovimiento.length ? conMovimiento.reduce((a, b) => (b.resultado < a.resultado ? b : a)) : null;
  const chartData = meses.map(m => ({ name: MESES[m.mes - 1], mes: m.mes, Ventas: Math.round(m.ventas), Costos: Math.round(m.costosTotales), Resultado: Math.round(m.resultado) }));
  const tip = (v: any) => fmtMoney(Number(v), moneda);

  return (
    <div className="space-y-4">
      <div className="-mb-1 text-right text-[10px] text-neutral-400">Datos actualizados {fmtActualizado((data as any)?.actualizadoEn)}</div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          { label: `Ventas ${anio}`, value: fmtMoney(totales.ventas, moneda), icon: DollarSign, color: 'text-blue-600', sub: 'sin IVA' },
          { label: 'Costos', value: fmtMoney(totales.costos, moneda), icon: Building2, color: 'text-amber-600', sub: 'operativos + estructura' },
          { label: 'Resultado', value: fmtMoney(totales.resultado, moneda), icon: totales.resultado >= 0 ? TrendingUp : TrendingDown, color: totales.resultado >= 0 ? 'text-green-600' : 'text-red-600', sub: `margen ${fmtPct(totales.margen)}` },
          { label: 'Cobrado', value: fmtMoney(totales.cobrado, moneda), icon: Wallet, color: 'text-emerald-600', sub: 'entró al banco (con IVA)' },
          { label: 'Meses en positivo', value: String(totales.mesesPositivos ?? 0), icon: TrendingUp, color: 'text-green-600', sub: mejor ? `mejor: ${MESES[mejor.mes - 1]} (${compact(mejor.resultado)})` : '' },
          { label: 'Meses en negativo', value: String(totales.mesesNegativos ?? 0), icon: TrendingDown, color: 'text-red-600', sub: peor && peor.resultado < 0 ? `peor: ${MESES[peor.mes - 1]} (${compact(peor.resultado)})` : '' },
        ].map((k, i) => (
          <div key={i} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500"><k.icon size={13} className={k.color} />{k.label}</div>
            <div className="mt-1 text-lg font-semibold text-neutral-900">{k.value}</div>
            {k.sub && <div className="text-[11px] text-neutral-400">{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* ═══ Capa gerencial: resumen + ¿qué explica? + alertas + comentario ═══ */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Resumen del período (determinístico) + comparativa */}
        {comp && comp.actual.lineas > 0 && (
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900"><Sparkles size={14} className="text-purple-600" />Resumen — {MESES[mesSel - 1]} {anio}{comp.actualizadoEn && <span className="text-[10px] font-normal text-neutral-400">· act. {fmtActualizado(comp.actualizadoEn)}</span>}</span>
              <select value={mesSel} onChange={e => setMesSel(Number(e.target.value))} className="rounded-lg border border-neutral-200 px-2 py-1 text-xs">
                {meses.map(m => <option key={m.mes} value={m.mes}>{MESES[m.mes - 1]}</option>)}
              </select>
            </div>
            <p className="text-sm leading-relaxed text-neutral-700">
              {MESES[mesSel - 1]} {comp.actual.resultado >= 0 ? 'cerró con resultado positivo' : 'cerró en negativo'} de{' '}
              <strong>{fmtMoney(comp.actual.resultado, moneda)}</strong>
              {comp.actual.margen !== null && <> y margen del <strong>{fmtPct(comp.actual.margen)}</strong></>}.
              {comp.mesAnterior.hayDatos && comp.vsMesAnterior.resultado.pct !== null && (
                <> {' '}El resultado {comp.vsMesAnterior.resultado.abs >= 0 ? 'mejoró' : 'empeoró'}{' '}
                <strong>{Math.abs(comp.vsMesAnterior.resultado.pct).toFixed(1)} %</strong> respecto de{' '}
                {comp.mesAnterior.mesKey && `${(comp as any).esMesActual ? `los primeros ${(comp as any).diasTranscurridos} días de ` : ''}${MESES[Number(comp.mesAnterior.mesKey.slice(5)) - 1]}`}.</>
              )}
              {comp.drivers.length > 0 && comp.drivers[0].variacion > 0 && (
                <> El principal impulsor fue <strong>{driverLabel(comp.drivers[0]).toLowerCase()}</strong>.</>
              )}
              {comp.drivers.filter((d: Driver) => d.variacion < 0)[0] && (
                <> El principal desvío negativo fue <strong>{driverLabel(comp.drivers.filter((d: Driver) => d.variacion < 0)[0]).toLowerCase()}</strong>{' '}
                ({fmtMoney(comp.drivers.filter((d: Driver) => d.variacion < 0)[0].variacion, moneda)}).</>
              )}
            </p>
            {/* Comparativa */}
            <div className="mt-3 overflow-hidden rounded-lg border border-neutral-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-neutral-50 text-left text-[10px] uppercase tracking-wide text-neutral-400">
                    <th className="px-3 py-1.5"></th>
                    <th className="px-3 py-1.5 text-right">Ventas</th>
                    <th className="px-3 py-1.5 text-right">Costos</th>
                    <th className="px-3 py-1.5 text-right">Resultado</th>
                    <th className="px-3 py-1.5 text-right">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-neutral-100">
                    <td className="px-3 py-1.5 font-medium">vs {(comp as any).esMesActual ? `primeros ${(comp as any).diasTranscurridos}d ` : ''}{MESES[Number(comp.mesAnterior.mesKey.slice(5)) - 1]} {comp.mesAnterior.mesKey.slice(0, 4)}</td>
                    {[comp.vsMesAnterior.ventas, comp.vsMesAnterior.costos, comp.vsMesAnterior.resultado].map((d: any, i: number) => (
                      <td key={i} className={`px-3 py-1.5 text-right ${d.pct === null ? 'text-neutral-300' : d.pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {d.pct === null ? '—' : `${d.pct >= 0 ? '+' : ''}${d.pct.toFixed(1)}%`}
                      </td>
                    ))}
                    <td className={`px-3 py-1.5 text-right ${!comp.vsMesAnterior.margen ? 'text-neutral-300' : comp.vsMesAnterior.margen.abs >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {comp.vsMesAnterior.margen ? `${comp.vsMesAnterior.margen.abs >= 0 ? '+' : ''}${comp.vsMesAnterior.margen.abs.toFixed(1)} pp` : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 font-medium">vs {(comp as any).esMesActual ? `primeros ${(comp as any).diasTranscurridos}d ` : ''}{MESES[mesSel - 1]} {anio - 1}</td>
                    {comp.vsAnioAnterior ? [comp.vsAnioAnterior.ventas, comp.vsAnioAnterior.costos, comp.vsAnioAnterior.resultado].map((d: any, i: number) => (
                      <td key={i} className={`px-3 py-1.5 text-right ${d.pct === null ? 'text-neutral-300' : d.pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {d.pct === null ? '—' : `${d.pct >= 0 ? '+' : ''}${d.pct.toFixed(1)}%`}
                      </td>
                    )) : <td colSpan={3} className="px-3 py-1.5 text-right text-neutral-300">sin datos</td>}
                    <td className={`px-3 py-1.5 text-right ${!comp.vsAnioAnterior?.margen ? 'text-neutral-300' : comp.vsAnioAnterior.margen.abs >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {comp.vsAnioAnterior?.margen ? `${comp.vsAnioAnterior.margen.abs >= 0 ? '+' : ''}${comp.vsAnioAnterior.margen.abs.toFixed(1)} pp` : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Alertas gerenciales */}
        {alertas.length > 0 && (
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-900"><AlertTriangle size={14} className="text-amber-500" />Alertas — {MESES[mesSel - 1]}{alertasAct && <span className="text-[10px] font-normal text-neutral-400">· act. {fmtActualizado(alertasAct)}</span>}</div>
            <div className="space-y-1.5">
              {alertas.map((a, i) => (
                <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                  a.severidad === 'CRITICA' ? 'bg-red-50 text-red-800' : a.severidad === 'ATENCION' ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'
                }`}>
                  <span className="mt-0.5 shrink-0">{a.severidad === 'CRITICA' ? '🔴' : a.severidad === 'ATENCION' ? '⚠️' : '🟢'}</span>
                  <span className="flex-1">{a.mensaje}</span>
                  <span className="shrink-0 font-medium">{fmtMoney(a.impacto, moneda)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ¿Qué explica el resultado? — drivers determinísticos */}
      {comp && comp.drivers.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900"><Scale size={14} className="text-blue-600" />¿Qué explica el resultado de {MESES[mesSel - 1]}?</span>
            <span className="text-[11px] text-neutral-400">vs {MESES[Number(comp.mesAnterior.mesKey.slice(5)) - 1]} · variaciones sobre el resultado{comp.actualizadoEn && <> · act. {fmtActualizado(comp.actualizadoEn)}</>}</span>
          </div>
          <div className="space-y-2">
            {comp.drivers.map((d: Driver, i: number) => (
              <div key={i} className="grid grid-cols-[12rem_1fr_9rem_6rem] items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5 truncate text-neutral-700" title={driverLabel(d)}>
                  <span>{d.variacion >= 0 ? '🟢' : '🔴'}</span>{driverLabel(d)}
                </span>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-neutral-100">
                  <div className={`absolute top-0 h-full rounded-full ${d.variacion >= 0 ? 'bg-green-400' : 'bg-red-400'}`}
                    style={{ width: `${Math.min(100, (Math.abs(d.variacion) / Math.abs(comp.drivers[0].variacion)) * 100)}%`, left: 0 }} />
                </div>
                <span className={`text-right font-medium ${d.variacion >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {d.variacion >= 0 ? '+' : ''}{fmtMoney(d.variacion, moneda)}
                </span>
                <span className="text-right text-[11px] text-neutral-400">
                  {d.anterior !== 0 ? `${d.variacion >= 0 ? '+' : ''}${((d.variacion / Math.abs(d.anterior)) * 100).toFixed(0)}%` : 'nuevo'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IVA del mes — posición tipo F29: débito (ventas) − crédito (compras) */}
      {iva && (iva.recuperado > 0 || iva.noRecuperado > 0 || iva.estimado > 0 || iva.cargasSinDesagregar > 0 || iva.debito > 0) && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-sm font-semibold text-neutral-900"><Receipt size={14} className="text-teal-600" />IVA del mes — {MESES[mesSel - 1]} {anio}
            {ivaTasaEdit === null ? (
              canEdit ? (
                <button onClick={() => setIvaTasaEdit(String(Math.round(iva.tasaEstimada * 100)))} title="Editar la tasa de IVA estimada para esta moneda (ej.: ARS 21, CLP 19)" className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-normal text-neutral-500 hover:bg-neutral-200">estimado al {(iva.tasaEstimada * 100).toFixed(0)} % · editar</button>
              ) : <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-normal text-neutral-500">estimado al {(iva.tasaEstimada * 100).toFixed(0)} %</span>
            ) : (
              <span className="ml-2 flex items-center gap-1 text-[11px] font-normal text-neutral-500">estimado al
                <input autoFocus type="number" min={0} max={50} step={1} value={ivaTasaEdit} onChange={e => setIvaTasaEdit(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') guardarTasaIva(); if (e.key === 'Escape') setIvaTasaEdit(null); }} className="w-14 rounded border border-neutral-200 px-1.5 py-0.5 text-xs" />%
                <button onClick={guardarTasaIva} className="rounded bg-neutral-900 px-2 py-0.5 text-white hover:bg-neutral-700">ok</button>
                <button onClick={() => setIvaTasaEdit(null)} className="text-neutral-400 hover:text-neutral-600"><X size={12} /></button>
              </span>
            )}
          </div>
          {/* Posición F29: débito − crédito = a pagar (o remanente a favor) */}
          <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="text-[11px] uppercase tracking-wide text-blue-700">IVA débito (ventas)</div>
              <div className="mt-1 font-semibold text-blue-800">{fmtMoney(iva.debito, moneda)}</div>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <div className="text-[11px] uppercase tracking-wide text-emerald-700">IVA crédito (compras)</div>
              <div className="mt-1 font-semibold text-emerald-800">{fmtMoney(iva.recuperado, moneda)}</div>
            </div>
            <div className={`rounded-lg p-3 ${iva.remanente > 0 ? 'bg-teal-50' : 'bg-neutral-50'}`} title="Crédito acumulado de meses anteriores que aún no se usó">
              <div className={`text-[11px] uppercase tracking-wide ${iva.remanente > 0 ? 'text-teal-700' : 'text-neutral-500'}`}>Remanente a favor</div>
              <div className={`mt-1 font-semibold ${iva.remanente > 0 ? 'text-teal-800' : 'text-neutral-500'}`}>{fmtMoney(iva.remanente, moneda)}</div>
            </div>
            <div className={`rounded-lg p-3 ${iva.aPagar > 0 ? 'bg-red-50' : 'bg-neutral-50'}`} title="Débito − (crédito del mes + remanente). No incluye PPM ni retenciones del F29 real.">
              <div className={`text-[11px] uppercase tracking-wide ${iva.aPagar > 0 ? 'text-red-700' : 'text-neutral-500'}`}>A pagar estimado (F29)</div>
              <div className={`mt-1 font-semibold ${iva.aPagar > 0 ? 'text-red-800' : 'text-neutral-500'}`}>{fmtMoney(iva.aPagar, moneda)}</div>
            </div>
          </div>
          {/* F29 real (SII): lo que el contador efectivamente declaró */}
          {f29?.configurado && (
            <div className={`mb-3 rounded-lg border text-xs ${f29.declarado ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
                {f29.declarado && f29.vigente ? (
                  <>
                    <span className="font-semibold">F29 real:</span>
                    declarado el {f29.vigente.fecha || '—'}{f29.vigente.folio ? ` · folio ${f29.vigente.folio}` : ''}{f29.vigente.estado ? ` · ${f29.vigente.estado}` : ''}
                    {f29.declaraciones.length > 1 && <span className="text-blue-600">({f29.declaraciones.length} declaraciones — incluye rectificatorias)</span>}
                    <button type="button" onClick={() => setF29Open(o => !o)} className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 font-medium hover:bg-blue-100/60">
                      <ChevronRight size={12} className={`transition-transform ${f29Open ? 'rotate-90' : ''}`} />
                      {f29Open ? 'ocultar detalle' : 'ver detalle'}
                    </button>
                  </>
                ) : f29.error ? (
                  <span className="text-neutral-500">F29 real: no se pudo consultar ({f29.error})</span>
                ) : (
                  <span><span className="font-semibold">F29 real:</span> sin declaración para este período — vence el día 20 del mes siguiente</span>
                )}
              </div>
              {f29Open && f29.declarado && (
                <div className="border-t border-blue-200 px-3 py-2.5 text-neutral-700">
                  {f29DetLoading && <p className="flex items-center gap-1.5 text-neutral-500"><Loader2 size={12} className="animate-spin" />Consultando SII (detalle + formulario)… puede tardar ~15 s</p>}
                  {(f29Det?.error || f29Montos?.error) && (
                    <p className="mb-1.5 text-amber-700">No se pudo obtener parte del detalle: {f29Det?.error || f29Montos?.error}</p>
                  )}
                  {f29Montos?.principales && (
                    <div className="mb-2.5 overflow-x-auto">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Declarado en el SII vs estimado del sistema</div>
                      <table className="w-full min-w-[420px] text-left">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-wide text-neutral-400">
                            <th className="pb-1 pr-3 font-medium">Concepto</th>
                            <th className="pb-1 pr-3 font-medium text-right">Declarado</th>
                            <th className="pb-1 pr-3 font-medium text-right">Estimado</th>
                            <th className="pb-1 font-medium text-right">Diferencia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {([
                            { label: 'IVA débito (ventas)', dec: f29Montos.principales.debito, est: iva.debito },
                            { label: 'IVA crédito (compras)', dec: f29Montos.principales.credito, est: iva.recuperado },
                            { label: 'Remanente a favor', dec: f29Montos.principales.remanente, est: iva.remanente },
                            { label: 'PPM', dec: f29Montos.principales.ppm, est: null },
                            { label: 'Retenciones', dec: f29Montos.principales.retencion, est: null },
                            { label: 'Total a pagar', dec: f29Montos.principales.totalPagar, est: iva.aPagar },
                          ] as { label: string; dec: number | null; est: number | null }[])
                            .filter(r => r.dec !== null || r.est !== null)
                            .map(r => {
                              const dif = r.dec !== null && r.est !== null ? r.dec - r.est : null;
                              return (
                                <tr key={r.label} className="border-t border-blue-100">
                                  <td className="py-1 pr-3">{r.label}</td>
                                  <td className="py-1 pr-3 text-right font-medium">{r.dec !== null ? fmtMoney(r.dec, moneda) : '—'}</td>
                                  <td className="py-1 pr-3 text-right text-neutral-500">{r.est !== null ? fmtMoney(r.est, moneda) : '—'}</td>
                                  <td className={`py-1 text-right font-medium ${dif === null || Math.abs(dif) < 1 ? 'text-neutral-400' : dif > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                    {dif === null ? '—' : `${dif > 0 ? '+' : ''}${fmtMoney(dif, moneda)}`}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                      {f29Montos.nCodigos === 0 && <p className="mt-1 text-[11px] text-amber-700">El PDF se descargó pero no se pudieron extraer los montos — revisá el formulario con el botón de abajo.</p>}
                    </div>
                  )}
                  {f29Det?.historial?.length > 0 && (
                    <div className="mb-2.5">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Historial de la declaración</div>
                      {f29Det.historial.map((h: any, i: number) => (
                        <p key={i} className="text-[11px] text-neutral-600">{h.fecha || '—'} — {h.descripcion || ''}</p>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button type="button" onClick={() => descargarF29Pdf('compacto')} disabled={!!f29PdfBusy}
                      className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 font-medium text-blue-700 hover:bg-blue-100/60 disabled:opacity-50">
                      {f29PdfBusy === 'compacto' ? <Loader2 size={12} className="animate-spin" /> : <Receipt size={12} />}
                      PDF formulario compacto
                    </button>
                    <button type="button" onClick={() => descargarF29Pdf('solemne')} disabled={!!f29PdfBusy}
                      className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 font-medium text-blue-700 hover:bg-blue-100/60 disabled:opacity-50">
                      {f29PdfBusy === 'solemne' ? <Loader2 size={12} className="animate-spin" /> : <Receipt size={12} />}
                      PDF certificado solemne
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Tira de estados F29 del año + alerta de períodos vencidos sin declarar */}
          {f29Estados && f29Estados.length > 0 && (
            <div className="mb-3">
              <div className="flex flex-wrap items-center gap-1">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">F29 {anio}</span>
                {MESES.map((mLabel, i) => {
                  const ym = anio * 100 + i + 1;
                  const st = f29EstadoDe(ym);
                  const pendiente = st && !st.declarado;
                  const vencido = pendiente && f29Vencido(ym);
                  const conObs = !!st?.declarado && (st.estado || '').toLowerCase().includes('observ');
                  const cls = st?.declarado
                    ? conObs ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    : vencido ? 'bg-red-100 text-red-700 font-semibold' : pendiente ? 'bg-amber-50 text-amber-700' : 'bg-neutral-100 text-neutral-400';
                  return (
                    <span key={ym} title={st ? (st.declarado ? st.estado || 'Declarado' : `Sin declarar${vencido ? ' — vencido' : ' — aún en plazo'}`) : 'Sin datos del SII'}
                      className={`rounded px-1.5 py-0.5 text-[10px] ${cls}`}>{mLabel.slice(0, 3)}</span>
                  );
                })}
              </div>
              {f29AtrasadosAnio.length > 0 && (
                <p className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
                  <AlertTriangle size={12} />
                  {f29AtrasadosAnio.length === 1 ? 'Un período F29 vencido sin declarar' : `${f29AtrasadosAnio.length} períodos F29 vencidos sin declarar`} en {anio}: {f29AtrasadosAnio.map(p => MESES[Number(p.periodo) % 100 - 1]).join(', ')}
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <div className={`rounded-lg p-3 ${iva.noRecuperado > 0 ? 'bg-amber-50' : 'bg-neutral-50'}`}>
              <div className={`text-[11px] uppercase tracking-wide ${iva.noRecuperado > 0 ? 'text-amber-700' : 'text-neutral-500'}`}>IVA al costo (no recuperado)</div>
              <div className={`mt-1 font-semibold ${iva.noRecuperado > 0 ? 'text-amber-800' : 'text-neutral-500'}`}>{fmtMoney(iva.noRecuperado, moneda)}</div>
            </div>
            <div className={`rounded-lg p-3 ${iva.estimado > 0 ? 'bg-amber-50' : 'bg-neutral-50'}`}>
              <div className={`text-[11px] uppercase tracking-wide ${iva.estimado > 0 ? 'text-amber-700' : 'text-neutral-500'}`}>Estimado en combustible</div>
              <div className={`mt-1 font-semibold ${iva.estimado > 0 ? 'text-amber-800' : 'text-neutral-500'}`}>~{fmtMoney(iva.estimado, moneda)}</div>
            </div>
            <div className={`rounded-lg p-3 ${iva.cargasSinDesagregar > 0 ? 'bg-red-50' : 'bg-neutral-50'}`}>
              <div className={`text-[11px] uppercase tracking-wide ${iva.cargasSinDesagregar > 0 ? 'text-red-700' : 'text-neutral-500'}`}>Cargas sin IVA desagregado</div>
              <div className={`mt-1 font-semibold ${iva.cargasSinDesagregar > 0 ? 'text-red-800' : 'text-neutral-500'}`}>{iva.cargasSinDesagregar}</div>
            </div>
          </div>
          {iva.estimado > 0 && <p className="mt-2 text-[11px] text-neutral-400">El estimado supone que el precio de surtidor incluye IVA al {(iva.tasaEstimada * 100).toFixed(0)} %{canEdit && ' (editable arriba — AR 21 %, CL 19 %)'} — cargá el IVA real del ticket en Flota 360 → Combustible para que compute como crédito evidenciado.</p>}
          {/* Posición IVA por cada mes del año */}
          {ivaMeses.length > 0 && (
            <div className="mt-3">
              <button type="button" onClick={() => setIvaPorMeses(o => !o)} className="flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-700">
                <ChevronRight size={12} className={`transition-transform ${ivaPorMeses ? 'rotate-90' : ''}`} />
                {ivaPorMeses ? 'ocultar detalle por mes' : `ver por meses (${anio})`}
              </button>
              {ivaPorMeses && (
                <div className="mt-2 overflow-x-auto rounded-lg border border-neutral-100">
                  <table className="w-full min-w-[560px] text-xs">
                    <thead>
                      <tr className="bg-neutral-50 text-left text-[10px] uppercase tracking-wide text-neutral-400">
                        <th className="px-3 py-1.5 font-medium">Mes</th>
                        <th className="px-3 py-1.5 font-medium text-right">Débito</th>
                        <th className="px-3 py-1.5 font-medium text-right">Crédito</th>
                        <th className="px-3 py-1.5 font-medium text-right">Remanente</th>
                        <th className="px-3 py-1.5 font-medium text-right">A pagar</th>
                        <th className="px-3 py-1.5 font-medium text-right">IVA al costo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ivaMeses.map((m: any) => (
                        <tr key={m.mes} className={`border-t border-neutral-100 ${m.mes === mesSel ? 'bg-teal-50/60 font-medium' : ''}`}>
                          <td className="px-3 py-1.5">{MESES[m.mes - 1]}{m.mes === mesSel && <span className="ml-1 text-[10px] text-teal-600">· viendo</span>}</td>
                          <td className="px-3 py-1.5 text-right text-blue-700">{m.debito > 0 ? fmtMoney(m.debito, moneda) : '—'}</td>
                          <td className="px-3 py-1.5 text-right text-emerald-700">{m.recuperado > 0 ? fmtMoney(m.recuperado, moneda) : '—'}</td>
                          <td className="px-3 py-1.5 text-right text-teal-700">{m.remanente > 0 ? fmtMoney(m.remanente, moneda) : '—'}</td>
                          <td className={`px-3 py-1.5 text-right ${m.aPagar > 0 ? 'font-medium text-red-700' : 'text-neutral-400'}`}>{m.aPagar > 0 ? fmtMoney(m.aPagar, moneda) : '—'}</td>
                          <td className="px-3 py-1.5 text-right text-amber-700">{m.noRecuperado > 0 ? fmtMoney(m.noRecuperado, moneda) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Comentario del período */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-900"><MessageSquare size={14} className="text-neutral-500" />Comentario del período — {MESES[mesSel - 1]} {anio}</div>
        {comentarios.length === 0 && <p className="text-xs text-neutral-400">Sin comentarios. {canEdit && 'Registrá contexto gerencial para este mes (ej.: reparación extraordinaria, cliente nuevo).'}</p>}
        {comentarios.map(c => (
          <div key={c.id} className="mb-2 rounded-lg bg-neutral-50 px-3 py-2">
            <p className="text-sm text-neutral-800">{c.texto}</p>
            <p className="mt-1 text-[10px] text-neutral-400">{c.createdByNombre || 'Usuario'} · {fmtFecha(c.createdAt)}{c.updatedAt !== c.createdAt && ' (editado)'}</p>
          </div>
        ))}
        {canEdit && (
          <div className="mt-2 flex gap-2">
            <input value={nuevoComentario} onChange={e => setNuevoComentario(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviarComentario()}
              placeholder="Agregar comentario gerencial del mes…"
              className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
            <button onClick={enviarComentario} disabled={enviandoComentario || !nuevoComentario.trim()}
              className="flex items-center gap-1 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
              {enviandoComentario ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Agregar
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-2 text-sm font-semibold text-neutral-900">Resultado por mes <span className="font-normal text-neutral-400">— verde ganó, rojo perdió · clic para ver el detalle</span>{(data as any)?.actualizadoEn && <span className="ml-2 text-[10px] font-normal text-neutral-400">· act. {fmtActualizado((data as any).actualizadoEn)}</span>}</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={tip} cursor={{ fill: '#f5f5f5' }} />
                <ReferenceLine y={0} stroke="#a3a3a3" />
                <Bar dataKey="Resultado" radius={[4, 4, 0, 0]} onClick={(d: any) => d?.payload?.mes && abrirDetalle(d.payload.mes)} className="cursor-pointer">
                  {chartData.map((d, i) => <Cell key={i} fill={d.Resultado >= 0 ? '#16a34a' : '#dc2626'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-2 text-sm font-semibold text-neutral-900">Ventas vs costos{(data as any)?.actualizadoEn && <span className="ml-2 text-[10px] font-normal text-neutral-400">· act. {fmtActualizado((data as any).actualizadoEn)}</span>}</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={tip} cursor={{ fill: '#f5f5f5' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Ventas" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Costos" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <Rubros porRubro={totales.porRubro || {}} moneda={moneda} titulo={`¿En qué se fue la plata en ${anio}?`} act={(data as any)?.actualizadoEn} />

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        {(data as any)?.actualizadoEn && <div className="border-b border-neutral-100 px-4 py-1.5 text-right text-[10px] text-neutral-400">Datos actualizados {fmtActualizado((data as any).actualizadoEn)}</div>}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2.5 font-medium">Mes</th>
              <th className="px-4 py-2.5 text-right font-medium">Ventas</th>
              <th className="px-4 py-2.5 text-right font-medium">Costos operativos</th>
              <th className="px-4 py-2.5 text-right font-medium">Estructura</th>
              <th className="px-4 py-2.5 text-right font-medium">Resultado</th>
              <th className="px-4 py-2.5 text-right font-medium">Margen</th>
              <th className="px-4 py-2.5 text-right font-medium">Cobrado</th>
              <th className="w-8 px-2 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {meses.map(m => (
              <tr key={m.mes} className={`cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50/60 ${mesSel === m.mes ? 'bg-blue-50/40' : ''}`} onClick={() => abrirDetalle(m.mes)}>
                <td className="px-4 py-2.5 font-medium text-neutral-900">{MESES[m.mes - 1]}</td>
                <td className="px-4 py-2.5 text-right">{fmtMoney(m.ventas, moneda)}</td>
                <td className="px-4 py-2.5 text-right text-amber-700">{fmtMoney(m.costosOperativos, moneda)}</td>
                <td className="px-4 py-2.5 text-right text-purple-700">{fmtMoney(m.estructura, moneda)}</td>
                <td className={`px-4 py-2.5 text-right font-semibold ${m.resultado >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {m.lineas > 0 && (m.resultado >= 0 ? <TrendingUp size={12} className="mr-1 inline" /> : <TrendingDown size={12} className="mr-1 inline" />)}
                  {fmtMoney(m.resultado, moneda)}
                </td>
                <td className="px-4 py-2.5 text-right text-neutral-500">{fmtPct(m.margen)}</td>
                <td className="px-4 py-2.5 text-right text-emerald-700">{fmtMoney(m.cobrado, moneda)}</td>
                <td className="px-2 py-2.5 text-neutral-400"><ChevronRight size={14} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-neutral-200 bg-neutral-50 font-semibold">
              <td className="px-4 py-2.5">Total</td>
              <td className="px-4 py-2.5 text-right">{fmtMoney(totales.ventas, moneda)}</td>
              <td className="px-4 py-2.5 text-right text-amber-700">{fmtMoney(meses.reduce((s, m) => s + m.costosOperativos, 0), moneda)}</td>
              <td className="px-4 py-2.5 text-right text-purple-700">{fmtMoney(meses.reduce((s, m) => s + m.estructura, 0), moneda)}</td>
              <td className={`px-4 py-2.5 text-right ${totales.resultado >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtMoney(totales.resultado, moneda)}</td>
              <td className="px-4 py-2.5 text-right text-neutral-500">{fmtPct(totales.margen)}</td>
              <td className="px-4 py-2.5 text-right text-emerald-700">{fmtMoney(totales.cobrado, moneda)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-neutral-400">
        Resultado = ventas sin IVA − costos operativos − estructura (devengado: por fecha de factura). "Cobrado" es la plata que efectivamente entró, con IVA.
      </p>

      {loadingDetalle && <div className="p-6 text-center text-neutral-400"><Loader2 className="inline animate-spin" size={16} /></div>}
      {detalle && !loadingDetalle && (
        <div id="fin-detalle" className="space-y-4">
          <Rubros porRubro={detalle.porRubro} moneda={moneda} titulo={`Costos de ${MESES[detalle.mes - 1]} ${anio} por rubro`} />
          <div className="rounded-xl border border-neutral-200 bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-3">
              <span className="text-sm font-semibold text-neutral-900">Detalle — {MESES[detalle.mes - 1]} {anio}</span>
              <div className="ml-auto flex flex-wrap gap-1">
                {['', 'FACTURADO', 'INGRESO_OPERATIVO', 'COSTO_OP', 'GASTO_MANUAL', 'ESTRUCTURA', 'COBRADO'].map(g => (
                  <button key={g} onClick={() => setGrupoFiltro(g)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${grupoFiltro === g ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                    {g ? GRUPO_LABEL[g] : 'Todo'}
                  </button>
                ))}
                <button onClick={() => setDetalle(null)} className="ml-1 text-neutral-400 hover:text-neutral-600"><X size={16} /></button>
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {detalle.lineas.filter(l => !grupoFiltro || l.grupo === grupoFiltro).map((l, i) => (
                  <tr key={i} className="border-b border-neutral-100 last:border-0">
                    <td className="w-24 px-4 py-2 text-xs text-neutral-400">{fmtFecha(l.fecha)}</td>
                    <td className="px-4 py-2 text-neutral-800">
                      {l.origenUrl ? <a href={l.origenUrl} className="hover:text-blue-600 hover:underline">{l.concepto}</a> : l.concepto}
                      <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">{GRUPO_LABEL[l.grupo] || l.grupo}</span>
                      {(l.iva ?? 0) > 0 && <span title={l.ivaRecuperable === false ? 'El IVA computa como costo' : 'IVA recuperado como crédito fiscal'} className={`ml-1.5 rounded px-1 py-0.5 text-[10px] ${l.ivaRecuperable === false ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>IVA {l.ivaRecuperable === false ? 'al costo' : 'recuperable'}</span>}
                      {l.fuente === 'COMBUSTIBLE' && l.ivaRecuperable !== false && !(l.iva && l.iva > 0) && <span title="El precio de surtidor incluye IVA — desagregalo para evidenciar el crédito" className="ml-1.5 rounded bg-neutral-100 px-1 py-0.5 text-[10px] text-neutral-500">IVA sin desagregar</span>}
                    </td>
                    <td className="w-40 px-4 py-2 text-xs text-neutral-400">{['COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL'].includes(l.grupo) ? labelRubro(l.rubro) : l.modulo}</td>
                    <td className={`w-36 px-4 py-2 text-right font-medium ${l.importe < 0 ? 'text-red-600' : ['COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL'].includes(l.grupo) ? 'text-amber-700' : 'text-neutral-900'}`}>
                      {fmtMoney(l.importe, moneda)}
                    </td>
                  </tr>
                ))}
                {detalle.lineas.filter(l => !grupoFiltro || l.grupo === grupoFiltro).length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-neutral-400">Sin movimientos.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
