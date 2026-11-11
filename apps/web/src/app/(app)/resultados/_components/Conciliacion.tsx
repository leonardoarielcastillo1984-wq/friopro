'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Loader2, Landmark, Link2, Ban, Undo2, CheckCircle2, AlertTriangle, Search, X, ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';
import { fmtMoney, fmtFecha, fmtActualizado } from './fmt';
import ConciliarCartola from './ConciliarCartola';

type Vinculo = { tipo?: 'factura' | 'gasto'; doc?: 'factura' | 'gasto'; id: string; numero: string | null; cliente?: string; proveedor?: string; aplicar: number; moneda?: string };
// Tipo efectivo del doc vinculado: las filas nuevas traen `tipo`, las
// reconstruidas por el backfill traen `doc`.
const tipoDoc = (v: Vinculo) => v.tipo || v.doc || 'gasto';
type Mov = {
  id: string; tipo: 'ABONO' | 'CARGO'; origen: string; firma: string;
  fecha: string; descripcion: string; referencia: string | null; monto: number; moneda: string;
  estado: 'conciliado' | 'vinculado_manual' | 'sin_match' | 'deshecho' | 'ignorado' | 'sugerido' | 'interno';
  como: string | null; motivo: string | null; vinculos: Vinculo[] | null; excedente: number | null;
  appliedAt: string | null; resueltoPor: string | null; createdByNombre: string | null; createdAt: string;
};
type DocCandidato = { id: string; numero: string | null; contraparte: string; fechaEmision: string; saldo: number };
// Documento sin conciliación: factura emitida sin cobro de cartola/caja chica
// o gasto sin pago vinculado a un movimiento.
type DocSinConciliar = { tipo: 'factura' | 'gasto'; id: string; numero: string | null; contraparte: string; fecha: string; total: number; saldo: number; moneda: string; situacion: 'pendiente' | 'pago_manual' };

const ESTADOS: Record<string, { label: string; cls: string }> = {
  conciliado: { label: 'Conciliado', cls: 'bg-emerald-50 text-emerald-700' },
  vinculado_manual: { label: 'Vinculado a mano', cls: 'bg-blue-50 text-blue-700' },
  sin_match: { label: 'Sin match', cls: 'bg-red-50 text-red-700' },
  sugerido: { label: 'Sugerido', cls: 'bg-amber-50 text-amber-700' },
  interno: { label: 'Interno', cls: 'bg-sky-50 text-sky-700' },
  deshecho: { label: 'Deshecho', cls: 'bg-neutral-100 text-neutral-500' },
  ignorado: { label: 'Ignorado', cls: 'bg-neutral-100 text-neutral-400' },
};
const COMO_LABEL: Record<string, string> = { folio: 'por folio', rut: 'por RUT', nombre: 'por nombre', monto: 'por monto', exacto: 'exacto', manual: 'manual' };

export default function Conciliacion({ moneda, canEdit, onChanged }: { moneda: string; canEdit: boolean; onChanged: () => void }) {
  const [movs, setMovs] = useState<Mov[]>([]);
  const [resumen, setResumen] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fEstado, setFEstado] = useState<'sin_match' | 'todos' | 'conciliados' | 'docs'>('sin_match');
  const [docs, setDocs] = useState<DocSinConciliar[]>([]);
  const [docsResumen, setDocsResumen] = useState<any>(null);
  const [fTipo, setFTipo] = useState('');
  const [fOrigen, setFOrigen] = useState('');
  const [buscar, setBuscar] = useState('');
  // Por defecto se contempla solo el año en curso; el selector permite ver otros.
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(String(anioActual));
  const [desde, setDesde] = useState(`${anioActual}-01-01`);
  const [hasta, setHasta] = useState(`${anioActual}-12-31`);
  const anios = useMemo(() => [anioActual - 2, anioActual - 1, anioActual, anioActual + 1], [anioActual]);
  const [cajaOpen, setCajaOpen] = useState(false);
  const [vinculando, setVinculando] = useState<Mov | null>(null);
  const [candidatos, setCandidatos] = useState<DocCandidato[]>([]);
  const [candidatosLoading, setCandidatosLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cajaResumen, setCajaResumen] = useState<{ meses: any[]; transferencias: any[] } | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const p = new URLSearchParams();
    if (desde) p.set('desde', desde);
    if (hasta) p.set('hasta', hasta ? `${hasta}T23:59:59` : '');
    if (fEstado === 'docs') {
      // Lado documento: facturas emitidas y gastos sin movimiento vinculado.
      if (moneda) p.set('moneda', moneda);
      apiFetch<{ docs: DocSinConciliar[]; resumen: any }>(`/finanzas/docs-sin-conciliar?${p}`)
        .then(d => { setDocs(d.docs); setDocsResumen(d.resumen); })
        .catch((e: any) => setError(e?.message || 'No se pudo cargar'))
        .finally(() => setLoading(false));
      return;
    }
    if (fTipo) p.set('tipo', fTipo);
    if (fOrigen) p.set('origen', fOrigen);
    apiFetch<{ movs: Mov[]; resumen: any }>(`/finanzas/cartola-movs?${p}`)
      .then(d => { setMovs(d.movs); setResumen(d.resumen); })
      .catch((e: any) => setError(e?.message || 'No se pudo cargar'))
      .finally(() => setLoading(false));
  }, [fEstado, fTipo, fOrigen, desde, hasta, moneda]);

  useEffect(() => { load(); }, [load]);

  // Cuadre del fondo de caja chica: reposiciones vs gastos por mes, con
  // la transferencia de cartola que financió cada reposición.
  useEffect(() => {
    if (fOrigen !== 'CAJA_CHICA') { setCajaResumen(null); return; }
    const p = new URLSearchParams();
    if (desde) p.set('desde', desde);
    if (hasta) p.set('hasta', hasta);
    apiFetch<{ meses: any[]; transferencias: any[] }>(`/finanzas/caja-chica-resumen?${p}`)
      .then(setCajaResumen).catch(() => setCajaResumen(null));
  }, [fOrigen, desde, hasta]);

  const visibles = useMemo(() => {
    let list = movs;
    if (fEstado === 'sin_match') list = list.filter(m => m.estado === 'sin_match' || m.estado === 'sugerido');
    else if (fEstado === 'conciliados') list = list.filter(m => m.estado === 'conciliado' || m.estado === 'vinculado_manual');
    if (buscar.trim()) {
      const q = buscar.trim().toLowerCase();
      list = list.filter(m => m.descripcion?.toLowerCase().includes(q) || m.referencia?.toLowerCase().includes(q));
    }
    return list;
  }, [movs, fEstado, buscar]);

  // ── Vinculación manual ────────────────────────────────────────────────────
  const abrirVincular = async (m: Mov) => {
    setVinculando(m); setCandidatosLoading(true); setCandidatos([]);
    try {
      if (m.tipo === 'ABONO') {
        // Pendientes de cobro: aplanar clientes → facturas con saldo.
        const d = await apiFetch<{ clientes: any[] }>(`/finanzas/cuentas-por-cobrar?moneda=${moneda}`);
        const docs: DocCandidato[] = [];
        for (const c of d.clientes || []) {
          for (const p of c.pendientes || []) {
            docs.push({ id: p.id, numero: p.numero || null, contraparte: c.cliente, fechaEmision: p.fechaEmision, saldo: p.saldo });
          }
        }
        setCandidatos(docs.sort((a, b) => Math.abs(a.saldo - m.monto) - Math.abs(b.saldo - m.monto)).slice(0, 60));
      } else {
        const d = await apiFetch<{ items: any[] }>(`/finanzas/cuentas-por-pagar?moneda=${moneda}`);
        setCandidatos((d.items || [])
          .filter(i => i.saldo > 0.5 && i.origen === 'GASTO')
          .map(i => ({ id: i.id, numero: i.comprobante || null, contraparte: i.proveedor, fechaEmision: i.fechaEmision, saldo: i.saldo }))
          .sort((a, b) => Math.abs(a.saldo - m.monto) - Math.abs(b.saldo - m.monto)).slice(0, 60));
      }
    } catch (e: any) { setError(e?.message || 'No se pudieron cargar los pendientes'); }
    finally { setCandidatosLoading(false); }
  };

  const vincular = async (doc: DocCandidato) => {
    if (!vinculando) return;
    setBusyId(vinculando.id); setError(null);
    try {
      await apiFetch(`/finanzas/cartola-movs/${vinculando.id}/vincular`, {
        method: 'POST',
        json: { docTipo: vinculando.tipo === 'ABONO' ? 'factura' : 'gasto', docId: doc.id },
      });
      setVinculando(null); load(); onChanged();
    } catch (e: any) { setError(e?.message || 'No se pudo vincular'); }
    finally { setBusyId(null); }
  };

  const ignorar = async (m: Mov, flag: boolean) => {
    setBusyId(m.id); setError(null);
    try {
      await apiFetch(`/finanzas/cartola-movs/${m.id}/ignorar`, { method: 'POST', json: { ignorar: flag } });
      load(); onChanged();
    } catch (e: any) { setError(e?.message || 'Error'); }
    finally { setBusyId(null); }
  };

  const deshacer = async (m: Mov) => {
    if (!confirm('¿Deshacer esta conciliación? Se eliminan los cobros/pagos registrados y los documentos vuelven a pendiente.')) return;
    setBusyId(m.id); setError(null);
    try {
      await apiFetch('/finanzas/cartola-deshacer', { method: 'POST', json: { referencia: m.firma } });
      load(); onChanged();
    } catch (e: any) { setError(e?.message || 'Error al deshacer'); }
    finally { setBusyId(null); }
  };

  const sel = 'rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm focus:outline-none';

  if (loading && !movs.length) return <div className="flex items-center justify-center py-16 text-neutral-400"><Loader2 className="mr-2 animate-spin" size={18} />Cargando conciliación…</div>;

  return (
    <div className="space-y-4">
      {/* Resumen */}
      {resumen && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: 'Movimientos', v: resumen.total, cls: 'text-neutral-900' },
            { label: 'Conciliados', v: resumen.conciliados, cls: 'text-emerald-700' },
            { label: 'Sin match', v: resumen.sinMatch, cls: resumen.sinMatch ? 'text-red-600' : 'text-neutral-900' },
            { label: 'Vinculados a mano', v: resumen.manuales, cls: 'text-blue-700' },
            { label: 'Deshechos', v: resumen.deshechos, cls: 'text-neutral-500' },
          ].map(k => (
            <div key={k.label} className="rounded-xl border border-neutral-200 bg-white p-3.5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{k.label}</div>
              <div className={`mt-1 text-xl font-bold tabular-nums ${k.cls}`}>{k.v}</div>
            </div>
          ))}
          {(resumen.sugeridos ?? 0) > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5" title="Coincidencia solo por monto — requieren confirmación manual">
              <div className="text-[11px] font-medium uppercase tracking-wide text-amber-700">Sugeridos</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-amber-700">{resumen.sugeridos}</div>
            </div>
          )}
          {(resumen.internos ?? 0) > 0 && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3.5" title="Reposiciones del fondo — no cruzan con documentos">
              <div className="text-[11px] font-medium uppercase tracking-wide text-sky-700">Internos</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-sky-700">{resumen.internos}</div>
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-neutral-200">
          {([['sin_match', 'Sin match'], ['docs', 'Docs sin match'], ['conciliados', 'Conciliados'], ['todos', 'Todos']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFEstado(k)}
              className={`px-3 py-1.5 text-xs font-medium ${fEstado === k ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600 hover:bg-neutral-50'}`}>{l}</button>
          ))}
        </div>
        <select value={fTipo} onChange={e => setFTipo(e.target.value)} className={sel}>
          <option value="">Abonos y cargos</option><option value="ABONO">Solo abonos</option><option value="CARGO">Solo cargos</option>
        </select>
        <select value={fOrigen} onChange={e => setFOrigen(e.target.value)} className={sel}>
          <option value="">Todo origen</option><option value="CARTOLA">Cartola</option><option value="CAJA_CHICA">Caja chica</option>
        </select>
        <select value={anio} className={sel} title="Año de los movimientos"
          onChange={e => {
            const y = e.target.value; setAnio(y);
            if (y) { setDesde(`${y}-01-01`); setHasta(`${y}-12-31`); }
            else { setDesde(''); setHasta(''); }
          }}>
          <option value="">Todos</option>
          {anios.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <input type="date" value={desde} onChange={e => { setDesde(e.target.value); setAnio(''); }} className={sel} />
        <input type="date" value={hasta} onChange={e => { setHasta(e.target.value); setAnio(''); }} className={sel} />
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar descripción o referencia…"
            className={`${sel} w-60 pl-7`} />
        </div>
        {loading && <Loader2 size={14} className="animate-spin text-neutral-400" />}
        {canEdit && (
          <button onClick={() => setCajaOpen(true)}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
            <Landmark size={13} />Importar caja chica
          </button>
        )}
      </div>

      {error && <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{error}</div>}

      {/* Cuadre de caja chica: lo que entró al fondo vs lo que salió, por mes */}
      {fOrigen === 'CAJA_CHICA' && cajaResumen && cajaResumen.meses.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Wallet size={15} />Cuadre de caja chica
            <span className="ml-1 text-[11px] font-normal text-amber-700">reposiciones vs gastos del fondo, cruzado con la cartola</span>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-amber-800/70">
                  <th className="py-1 pr-4 font-medium">Mes</th>
                  <th className="py-1 pr-4 text-right font-medium">Reposiciones</th>
                  <th className="py-1 pr-4 text-right font-medium">Gastos</th>
                  <th className="py-1 pr-4 text-right font-medium">Diferencia</th>
                  <th className="py-1 text-right font-medium">Saldo fondo</th>
                </tr>
              </thead>
              <tbody>
                {cajaResumen.meses.map((m: any) => (
                  <tr key={m.mes} className="border-t border-amber-200/60">
                    <td className="py-1.5 pr-4 font-medium text-amber-900">{m.mes}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-emerald-700">{fmtMoney(m.entra, moneda)} <span className="text-amber-800/50">({m.nEntra})</span></td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-red-600">{fmtMoney(m.sale, moneda)} <span className="text-amber-800/50">({m.nSale})</span></td>
                    <td className={`py-1.5 pr-4 text-right tabular-nums font-medium ${m.saldoMes >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {fmtMoney(m.saldoMes, moneda)}
                      <div className="text-[9px] font-normal">{m.saldoMes >= 0 ? 'remanente' : 'sobregiro (fondos propios)'}</div>
                    </td>
                    <td className={`py-1.5 text-right tabular-nums font-semibold ${m.saldoAcumulado >= 0 ? 'text-amber-900' : 'text-red-700'}`}>{fmtMoney(m.saldoAcumulado, moneda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cajaResumen.transferencias.length > 0 && (
            <div className="mt-2 space-y-0.5 border-t border-amber-200/60 pt-2">
              {cajaResumen.transferencias.map((t: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  {t.estado === 'confirmada'
                    ? <><CheckCircle2 size={11} className="shrink-0 text-emerald-600" /><span className="text-amber-900">{fmtFecha(t.fecha)} — {fmtMoney(t.monto, moneda)} confirmada en cartola <span className="text-amber-800/60">({t.cartolaDescripcion})</span></span></>
                    : <><AlertTriangle size={11} className="shrink-0 text-amber-600" /><span className="text-amber-800">{fmtFecha(t.fecha)} — {fmtMoney(t.monto, moneda)} sin cargo equivalente en cartola (±$2, ±3 días)</span></>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {fEstado === 'docs' ? (
          // ── Documentos sin conciliación (facturas emitidas y gastos) ──
          docs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-neutral-400">
              <CheckCircle2 size={28} className="text-emerald-400" />
              <p className="text-sm">No hay documentos sin conciliar. Todo está vinculado a un movimiento.</p>
            </div>
          ) : (
            <>
              {docsResumen && (
                <div className="flex flex-wrap gap-3 border-b border-neutral-100 px-4 py-2 text-[11px] text-neutral-500">
                  <span><b className="text-emerald-700">{docsResumen.facturasPend}</b> facturas emitidas sin cobro vinculado</span>
                  <span><b className="text-red-600">{docsResumen.gastosPend}</b> gastos sin pago vinculado</span>
                  {docsResumen.pagosManuales > 0 && <span><b className="text-amber-600">{docsResumen.pagosManuales}</b> saldados fuera de cartola</span>}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-neutral-100 text-[11px] uppercase tracking-wide text-neutral-400">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Fecha</th>
                      <th className="px-4 py-2.5 font-medium">Documento</th>
                      <th className="px-4 py-2.5 font-medium">Contraparte</th>
                      <th className="px-4 py-2.5 text-right font-medium">Total</th>
                      <th className="px-4 py-2.5 text-right font-medium">Saldo</th>
                      <th className="px-4 py-2.5 font-medium">Alerta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.filter(d => !buscar.trim() || d.contraparte?.toLowerCase().includes(buscar.trim().toLowerCase()) || String(d.numero || '').includes(buscar.trim())).map(d => (
                      <tr key={`${d.tipo}-${d.id}`} className="border-t border-neutral-100 align-top">
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-neutral-500">{fmtFecha(d.fecha)}</td>
                        <td className="px-4 py-2.5">
                          {d.tipo === 'factura'
                            ? <span className="font-medium text-emerald-700">Factura emitida N° {d.numero || 's/n'}</span>
                            : <span className="font-medium text-red-600">Gasto {d.numero || 's/n'}</span>}
                        </td>
                        <td className="max-w-56 truncate px-4 py-2.5 text-xs text-neutral-700" title={d.contraparte}>{d.contraparte || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs tabular-nums">{fmtMoney(d.total, d.moneda || moneda)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs font-medium tabular-nums">{fmtMoney(d.saldo, d.moneda || moneda)}</td>
                        <td className="px-4 py-2.5">
                          <div className={`flex items-start gap-1 text-[11px] ${d.situacion === 'pendiente' ? 'text-red-600' : 'text-amber-600'}`}>
                            <AlertTriangle size={11} className="mt-px shrink-0" />
                            <span>{d.situacion === 'pendiente'
                              ? (d.tipo === 'factura' ? 'Cobro pendiente — sin transferencia ni caja chica asociada.' : 'Pago pendiente — sin movimiento de cartola ni caja chica asociado.')
                              : 'Saldado por fuera de cartola/caja chica (registro manual).'}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        ) : visibles.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-neutral-400">
            <CheckCircle2 size={28} className="text-emerald-400" />
            <p className="text-sm">{fEstado === 'sin_match' ? 'No hay movimientos sin conciliar.' : 'No hay movimientos en este filtro.'}</p>
            <p className="text-xs">{fEstado === 'sin_match' ? 'Revisá “Docs sin match” para ver facturas y gastos pendientes de movimiento.' : 'Importá una cartola desde Cuentas por cobrar → “Conciliar cartola”.'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-[11px] uppercase tracking-wide text-neutral-400">
                <th className="px-4 py-2.5 font-medium">Fecha</th>
                <th className="px-4 py-2.5 font-medium">Movimiento</th>
                <th className="px-4 py-2.5 text-right font-medium">Monto</th>
                <th className="px-4 py-2.5 font-medium">Estado / vínculo</th>
                <th className="px-4 py-2.5 font-medium">Trazabilidad</th>
                {canEdit && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {visibles.map(m => {
                const est = ESTADOS[m.estado] || ESTADOS.sin_match;
                const vincs = (m.vinculos || []) as Vinculo[];
                return (
                  <tr key={m.id} className={`border-t border-neutral-100 align-top ${m.estado === 'sin_match' ? 'bg-red-50/30' : ''}`}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-neutral-500">{fmtFecha(m.fecha)}</td>
                    <td className="max-w-72 px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {m.tipo === 'ABONO' ? <ArrowUpRight size={13} className="shrink-0 text-emerald-600" /> : <ArrowDownRight size={13} className="shrink-0 text-red-500" />}
                        <span className="truncate text-xs font-medium text-neutral-800" title={m.descripcion}>{m.descripcion || '—'}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-neutral-400">
                        {m.origen === 'CAJA_CHICA'
                          ? <span className="rounded bg-amber-50 px-1 py-px text-amber-700">caja chica</span>
                          : <span className="rounded bg-sky-50 px-1 py-px text-sky-700">cartola</span>}
                        {m.referencia && <span>ref {m.referencia}</span>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums">{fmtMoney(m.monto, m.moneda || moneda)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${est.cls}`}>{est.label}</span>
                      {m.como && <span className="ml-1 text-[10px] text-neutral-400">{COMO_LABEL[m.como] || m.como}</span>}
                      {vincs.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {vincs.map((v, i) => (
                            <div key={i} className="text-[11px] text-neutral-600">
                              {tipoDoc(v) === 'factura'
                                ? <span className="font-medium text-emerald-700">Cobro · Factura N° {v.numero || 's/n'}</span>
                                : <span className="font-medium text-red-600">Pago · Gasto {v.numero || 's/n'}</span>}
                              {' — '}{v.cliente || v.proveedor || ''}
                              <span className="text-neutral-400"> · {fmtMoney(v.aplicar, v.moneda || moneda)}</span>
                            </div>
                          ))}
                          {(m.excedente ?? 0) > 0.5 && <div className="text-[10px] text-amber-600">excedente {fmtMoney(m.excedente, m.moneda || moneda)}</div>}
                        </div>
                      )}
                      {m.motivo && <div className="mt-1 text-[11px] text-red-500">{m.motivo}</div>}
                      {(m.estado === 'sin_match' || m.estado === 'sugerido') && (
                        <div className="mt-1 flex items-start gap-1 text-[11px] text-red-600">
                          <AlertTriangle size={11} className="mt-px shrink-0" />
                          <span>{m.estado === 'sugerido'
                            ? 'Match solo por monto — no se aplicó automáticamente, confirmá el vínculo.'
                            : m.tipo === 'ABONO'
                            ? 'Cobro sin factura emitida asociada — emití la factura o vinculala a mano.'
                            : 'Pago sin gasto/comprobante asociado (SII, caja chica o cartola) — cargalo o vinculalo.'}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[10px] leading-4 text-neutral-400">
                      {m.appliedAt && <div>aplicado {fmtActualizado(m.appliedAt)}</div>}
                      {(m.resueltoPor || m.createdByNombre) && <div>{m.resueltoPor || m.createdByNombre}</div>}
                    </td>
                    {canEdit && (
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        {busyId === m.id ? <Loader2 size={14} className="inline animate-spin text-neutral-400" /> : (
                          <div className="flex justify-end gap-1">
                            {(m.estado === 'sin_match' || m.estado === 'sugerido') && (
                              <>
                                <button onClick={() => abrirVincular(m)} title="Vincular a un documento pendiente"
                                  className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100"><Link2 size={11} />Vincular</button>
                                <button onClick={() => ignorar(m, true)} title="Ignorar (movimiento interno, sin documento)"
                                  className="rounded-md px-2 py-1 text-[11px] text-neutral-400 hover:bg-neutral-100"><Ban size={11} /></button>
                              </>
                            )}
                            {m.estado === 'ignorado' && (
                              <button onClick={() => ignorar(m, false)} title="Volver a pendientes"
                                className="rounded-md px-2 py-1 text-[11px] text-neutral-500 hover:bg-neutral-100">Restaurar</button>
                            )}
                            {(m.estado === 'conciliado' || m.estado === 'vinculado_manual') && (
                              <button onClick={() => deshacer(m)} title="Deshacer: borra los cobros/pagos y vuelve a pendiente"
                                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-red-500 hover:bg-red-50"><Undo2 size={11} />Deshacer</button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {cajaOpen && <ConciliarCartola moneda={moneda} origen="CAJA_CHICA" onClose={() => setCajaOpen(false)} onDone={() => { load(); onChanged(); }} />}

      {/* Modal de vinculación manual */}
      {vinculando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setVinculando(null)}>
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-neutral-200 px-5 py-3.5">
              <Link2 size={15} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-neutral-900">
                Vincular {vinculando.tipo === 'ABONO' ? 'abono' : 'cargo'} — {fmtMoney(vinculando.monto, vinculando.moneda || moneda)}
              </h2>
              <button onClick={() => setVinculando(null)} className="ml-auto rounded p-1 text-neutral-400 hover:bg-neutral-100"><X size={16} /></button>
            </div>
            <div className="border-b border-neutral-100 px-5 py-3 text-xs text-neutral-500">
              <div className="font-medium text-neutral-700">{vinculando.descripcion || 'Sin descripción'}</div>
              <div>{fmtFecha(vinculando.fecha)} · Elegí {vinculando.tipo === 'ABONO' ? 'la factura que se cobró' : 'el gasto que se pagó'}. Ordenados por cercanía al monto.</div>
            </div>
            <div className="flex-1 overflow-auto">
              {candidatosLoading ? (
                <div className="flex items-center justify-center py-10 text-neutral-400"><Loader2 size={16} className="mr-2 animate-spin" />Buscando pendientes…</div>
              ) : candidatos.length === 0 ? (
                <div className="py-10 text-center text-sm text-neutral-400">No hay documentos pendientes en {moneda}.</div>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {candidatos.map(d => (
                      <tr key={d.id} className="border-b border-neutral-50 hover:bg-blue-50/40">
                        <td className="px-4 py-2.5">
                          <div className="text-xs font-medium text-neutral-800">{d.contraparte}</div>
                          <div className="text-[10px] text-neutral-400">{d.numero || 's/n'} · {fmtFecha(d.fechaEmision)}</div>
                        </td>
                        <td className={`whitespace-nowrap px-4 py-2.5 text-right text-xs tabular-nums ${Math.abs(d.saldo - vinculando.monto) < 1 ? 'font-semibold text-emerald-700' : 'text-neutral-700'}`}>
                          {fmtMoney(d.saldo, moneda)}
                          {Math.abs(d.saldo - vinculando.monto) < 1 && <div className="text-[9px] font-medium text-emerald-600">monto exacto</div>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => vincular(d)} disabled={busyId === vinculando.id}
                            className="rounded-md bg-neutral-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
                            {busyId === vinculando.id ? <Loader2 size={11} className="animate-spin" /> : 'Vincular'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
