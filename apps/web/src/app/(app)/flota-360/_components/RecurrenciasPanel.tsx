'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  AlertTriangle, ChevronDown, ChevronRight, Wrench, RefreshCw, CheckCircle2,
  Clock, DollarSign, Plus, X, GitBranch, ClipboardCheck, Search,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Análisis de reparaciones recurrentes — panel dentro de la sección
// "Órdenes de trabajo recientes" de la ficha del vehículo.
// Circuito: clasificación de OTs por componente → detección por
// reglas → caso → alternativas → decisión → ejecución → seguimiento.
// ═══════════════════════════════════════════════════════════════

const ESTADO_CASO: Record<string, { label: string; cls: string }> = {
  DETECTADO: { label: 'Detectado', cls: 'bg-amber-100 text-amber-700' },
  EN_ANALISIS: { label: 'En análisis', cls: 'bg-blue-100 text-blue-700' },
  ACCION_APROBADA: { label: 'Acción aprobada', cls: 'bg-indigo-100 text-indigo-700' },
  EN_EJECUCION: { label: 'En ejecución', cls: 'bg-violet-100 text-violet-700' },
  EN_SEGUIMIENTO: { label: 'En seguimiento', cls: 'bg-cyan-100 text-cyan-700' },
  CERRADO: { label: 'Cerrado', cls: 'bg-neutral-100 text-neutral-500' },
};
const TIPO_ALT: Record<string, string> = {
  REPARAR: 'Reparar', REPARACION_INTEGRAL: 'Reparación integral',
  REEMPLAZAR: 'Reemplazar', RECLAMO_GARANTIA: 'Reclamar garantía',
};
const RESULTADO_SEG: Record<string, { label: string; cls: string }> = {
  PENDIENTE: { label: 'Resultado pendiente', cls: 'bg-neutral-100 text-neutral-600' },
  SIN_RECURRENCIA: { label: 'Sin recurrencia observada', cls: 'bg-green-100 text-green-700' },
  RECURRENCIA: { label: 'Volvió a fallar', cls: 'bg-red-100 text-red-700' },
};

function fmtFecha(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtMoney(n: number | null | undefined, moneda = 'ARS') {
  if (n == null) return '—';
  return `${moneda === 'ARS' ? '$' : moneda + ' '}${n.toLocaleString('es-AR')}`;
}

export default function RecurrenciasPanel({ vehiculoId, workOrders }: { vehiculoId: string; workOrders: any[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Configuración: catálogo de componentes + reglas
  const [componentes, setComponentes] = useState<any[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [nuevoComp, setNuevoComp] = useState({ nombre: '', categoria: 'GENERAL', sinonimos: '' });
  const [nuevaRegla, setNuevaRegla] = useState<Record<string, { max: string; dias: string }>>({});

  // Vincular OT manualmente
  const [vincularOT, setVincularOT] = useState<string | null>(null);
  const [vincForm, setVincForm] = useState({ componentId: '', subcomponente: '', sintoma: '', causa: '' });

  // Alternativa nueva por caso
  const [altForm, setAltForm] = useState<Record<string, any>>({});
  // Decisión por caso
  const [decForm, setDecForm] = useState<Record<string, any>>({});
  // Ejecución por caso
  const [ejecForm, setEjecForm] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [r, c] = await Promise.all([
        apiFetch(`/fleet-recurrence/vehiculos/${vehiculoId}/recurrencias`),
        apiFetch('/fleet-recurrence/componentes').catch(() => ({ componentes: [] })),
      ]);
      setData(r);
      setComponentes((c as any)?.componentes || []);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar el análisis');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (open && !data) load(); /* eslint-disable-next-line */ }, [open]);

  const casos = data?.casos || [];
  const casosAbiertos = casos.filter((c: any) => c.status !== 'CERRADO');
  const compConDatos = data?.componentesConDatos || [];

  // ── Acciones ────────────────────────────────────────────────
  const evaluar = async () => {
    setBusy('evaluar');
    try { await apiFetch(`/fleet-recurrence/vehiculos/${vehiculoId}/evaluar`, { method: 'POST' }); await load(); }
    finally { setBusy(null); }
  };
  const clasificacionAsistida = async () => {
    setBusy('clasif');
    try { await apiFetch(`/fleet-recurrence/vehiculos/${vehiculoId}/clasificacion-asistida`, { method: 'POST' }); await load(); }
    finally { setBusy(null); }
  };
  const crearComponente = async () => {
    if (!nuevoComp.nombre.trim()) return;
    setBusy('comp');
    try {
      await apiFetch('/fleet-recurrence/componentes', {
        method: 'POST',
        json: { nombre: nuevoComp.nombre.trim(), categoria: nuevoComp.categoria, sinonimos: nuevoComp.sinonimos.split(',').map(s => s.trim()).filter(Boolean) },
      });
      setNuevoComp({ nombre: '', categoria: 'GENERAL', sinonimos: '' });
      await load();
    } finally { setBusy(null); }
  };
  const crearRegla = async (componentId: string) => {
    const f = nuevaRegla[componentId] || { max: '3', dias: '180' };
    setBusy('regla-' + componentId);
    try {
      await apiFetch(`/fleet-recurrence/componentes/${componentId}/reglas`, {
        method: 'POST', json: { maxIntervenciones: Number(f.max) || 3, ventanaDias: Number(f.dias) || 180 },
      });
      await load();
    } finally { setBusy(null); }
  };
  const vincular = async () => {
    if (!vincularOT || !vincForm.componentId) return;
    setBusy('vinc');
    try {
      await apiFetch(`/fleet-recurrence/work-orders/${vincularOT}/componente`, {
        method: 'POST',
        json: { componentId: vincForm.componentId, subcomponente: vincForm.subcomponente || undefined, sintoma: vincForm.sintoma || undefined, causa: vincForm.causa || undefined },
      });
      setVincularOT(null); setVincForm({ componentId: '', subcomponente: '', sintoma: '', causa: '' });
      await load();
    } finally { setBusy(null); }
  };
  const confirmarSugerencia = async (linkId: string, confirmar: boolean) => {
    setBusy('sug-' + linkId);
    try {
      await apiFetch(`/fleet-recurrence/links/${linkId}`, { method: 'PATCH', json: confirmar ? { clasificacion: 'CONFIRMADA' } : { eliminar: true } });
      await load();
    } finally { setBusy(null); }
  };
  const cargarAlternativa = async (casoId: string) => {
    const f = altForm[casoId];
    if (!f?.tipo) return;
    setBusy('alt-' + casoId);
    try {
      await apiFetch(`/fleet-recurrence/casos/${casoId}/alternativas`, {
        method: 'POST',
        json: {
          tipo: f.tipo, descripcion: f.descripcion || undefined,
          costoInmediato: f.costoInmediato ? Number(f.costoInmediato) : null,
          costoInstalacion: f.costoInstalacion ? Number(f.costoInstalacion) : null,
          moneda: f.moneda || 'ARS', proveedor: f.proveedor || undefined,
          plazoInmovilizacionDias: f.plazo ? Number(f.plazo) : null,
          garantiaMeses: f.garantiaMeses ? Number(f.garantiaMeses) : null,
          costosFuturosEstimados: f.costosFuturos ? Number(f.costosFuturos) : null,
          baseEstimacion: f.baseEstimacion || undefined,
          valorParadaPorDia: f.valorParada ? Number(f.valorParada) : null,
          baseValorParada: f.baseValorParada || undefined,
        },
      });
      setAltForm(p => ({ ...p, [casoId]: {} }));
      await load();
    } finally { setBusy(null); }
  };
  const decidir = async (casoId: string) => {
    const f = decForm[casoId];
    if (!f?.alternativaId || !f?.fundamento?.trim()) return;
    setBusy('dec-' + casoId);
    try {
      await apiFetch(`/fleet-recurrence/casos/${casoId}/decidir`, {
        method: 'POST',
        json: { alternativaId: f.alternativaId, fundamento: f.fundamento, workOrderAccionId: f.workOrderAccionId || null },
      });
      setDecForm(p => ({ ...p, [casoId]: {} }));
      await load();
    } finally { setBusy(null); }
  };
  const ejecutar = async (casoId: string) => {
    const f = ejecForm[casoId] || {};
    setBusy('eje-' + casoId);
    try {
      await apiFetch(`/fleet-recurrence/casos/${casoId}/ejecutar`, {
        method: 'POST',
        json: {
          km: f.km ? Number(f.km) : undefined,
          revisionDias: f.revisionDias ? Number(f.revisionDias) : null,
          revisionKm: f.revisionKm ? Number(f.revisionKm) : null,
          instanciaNueva: f.serialNueva ? { serialNumber: f.serialNueva } : undefined,
          notas: f.notas || undefined,
        },
      });
      setEjecForm(p => ({ ...p, [casoId]: {} }));
      await load();
    } finally { setBusy(null); }
  };
  const cambiarEstado = async (casoId: string, estado: string) => {
    setBusy('est-' + casoId);
    try { await apiFetch(`/fleet-recurrence/casos/${casoId}/estado`, { method: 'POST', json: { estado } }); await load(); }
    finally { setBusy(null); }
  };
  const cerrarCaso = async (casoId: string) => {
    setBusy('cer-' + casoId);
    try { await apiFetch(`/fleet-recurrence/casos/${casoId}/cerrar`, { method: 'POST', json: {} }); await load(); }
    finally { setBusy(null); }
  };

  // ── Resumen de la línea ─────────────────────────────────────
  const resumen = loading && !data
    ? 'Analizando…'
    : error
      ? 'No se pudo cargar'
      : !data
        ? 'Análisis de reparaciones recurrentes'
        : data.sinActivo
          ? 'Sin activo de mantenimiento vinculado — análisis no disponible'
          : casosAbiertos.length > 0
            ? `${casosAbiertos.length} caso(s) abierto(s) · ${compConDatos.length} componente(s) con intervenciones`
            : compConDatos.length > 0
              ? `Sin casos abiertos · ${compConDatos.length} componente(s) con intervenciones registradas`
              : 'Sin recurrencias detectadas con los datos disponibles';

  const otsSinVinculo = (workOrders || []).filter((o: any) => o.status === 'COMPLETED');

  return (
    <div className="border-t border-neutral-200">
      {/* Línea "Análisis de reparaciones recurrentes" */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2.5 flex items-center gap-2 text-left hover:bg-neutral-50 transition-colors"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-neutral-400" /> : <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />}
        <GitBranch className="h-3.5 w-3.5 text-indigo-600" />
        <span className="text-xs font-semibold text-neutral-800">Análisis de reparaciones recurrentes</span>
        <span className={`ml-auto text-[11px] ${casosAbiertos.length > 0 ? 'text-amber-700 font-medium' : 'text-neutral-500'}`}>{resumen}</span>
        {casosAbiertos.length > 0 && <span className="rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5">{casosAbiertos.length}</span>}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {loading && !data && <p className="text-xs text-neutral-400 py-2">Analizando intervenciones del vehículo…</p>}
          {error && <p className="text-xs text-red-600 py-2">{error}</p>}

          {data?.sinActivo && (
            <p className="text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-md px-3 py-2">
              Este vehículo no tiene un activo de mantenimiento vinculado. El análisis de recurrencias necesita órdenes de trabajo asociadas.
            </p>
          )}

          {data && !data.sinActivo && (
            <>
              {/* Acciones */}
              <div className="flex flex-wrap gap-1.5">
                <button onClick={evaluar} disabled={busy === 'evaluar'} className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
                  <RefreshCw className={`h-3 w-3 ${busy === 'evaluar' ? 'animate-spin' : ''}`} /> Evaluar ahora
                </button>
                <button onClick={clasificacionAsistida} disabled={busy === 'clasif'} className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
                  <Search className="h-3 w-3" /> Clasificación asistida
                </button>
                <button onClick={() => setShowConfig(s => !s)} className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50">
                  <Wrench className="h-3 w-3" /> Componentes y reglas
                </button>
              </div>

              {!data.hayReglas && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  No hay reglas de recurrencia configuradas. Creá un componente y su regla en «Componentes y reglas» para activar la detección automática.
                </p>
              )}

              {(data.sugerenciasPendientes ?? 0) > 0 && (
                <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                  {data.sugerenciasPendientes} clasificación(es) sugerida(s) pendiente(s) de confirmación — no cuentan como hechos verificados hasta confirmarlas.
                </p>
              )}

              {/* Configuración de componentes y reglas */}
              {showConfig && (
                <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 space-y-3">
                  <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">Catálogo de componentes y reglas de recurrencia</p>
                  {componentes.map((c: any) => (
                    <div key={c.id} className="rounded-md border border-neutral-200 bg-white p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-neutral-800">{c.nombre} <span className="font-normal text-neutral-400">· {c.categoria}</span></p>
                        <span className="text-[10px] text-neutral-400">{c._count?.links ?? 0} vínculos · {c._count?.casos ?? 0} casos</span>
                      </div>
                      {c.sinonimos?.length > 0 && <p className="text-[10px] text-neutral-400">Sinónimos: {c.sinonimos.join(', ')}</p>}
                      {(c.reglas || []).map((r: any) => (
                        <p key={r.id} className="text-[11px] text-neutral-600">Regla: ≥{r.maxIntervenciones} intervenciones en {r.ventanaDias} días{r.soloFallas ? ' · solo fallas' : ''}{r.kmMaxEntre ? ` · km entre fallas ≤ ${r.kmMaxEntre.toLocaleString('es-AR')}` : ''}</p>
                      ))}
                      <div className="flex items-center gap-1.5 pt-1">
                        <input placeholder="máx." className="w-14 rounded border border-neutral-300 px-1.5 py-0.5 text-[11px]"
                          value={nuevaRegla[c.id]?.max ?? ''} onChange={e => setNuevaRegla(p => ({ ...p, [c.id]: { ...p[c.id], max: e.target.value, dias: p[c.id]?.dias ?? '180' } }))} />
                        <span className="text-[10px] text-neutral-400">interv. en</span>
                        <input placeholder="días" className="w-16 rounded border border-neutral-300 px-1.5 py-0.5 text-[11px]"
                          value={nuevaRegla[c.id]?.dias ?? ''} onChange={e => setNuevaRegla(p => ({ ...p, [c.id]: { ...p[c.id], dias: e.target.value, max: p[c.id]?.max ?? '3' } }))} />
                        <span className="text-[10px] text-neutral-400">días</span>
                        <button onClick={() => crearRegla(c.id)} disabled={busy === 'regla-' + c.id} className="rounded bg-indigo-600 text-white px-2 py-0.5 text-[11px] font-medium disabled:opacity-50">+ Regla</button>
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-neutral-200">
                    <input placeholder="Nuevo componente (ej: Burro de arranque)" className="flex-1 min-w-48 rounded border border-neutral-300 px-2 py-1 text-[11px]"
                      value={nuevoComp.nombre} onChange={e => setNuevoComp(p => ({ ...p, nombre: e.target.value }))} />
                    <input placeholder="sinónimos, separados, por comas" className="flex-1 min-w-40 rounded border border-neutral-300 px-2 py-1 text-[11px]"
                      value={nuevoComp.sinonimos} onChange={e => setNuevoComp(p => ({ ...p, sinonimos: e.target.value }))} />
                    <button onClick={crearComponente} disabled={busy === 'comp' || !nuevoComp.nombre.trim()} className="rounded bg-indigo-600 text-white px-2.5 py-1 text-[11px] font-medium disabled:opacity-50">+ Componente</button>
                  </div>
                </div>
              )}

              {/* Casos */}
              {casos.length === 0 && !loading && (
                <p className="text-xs text-neutral-500 py-1">
                  {compConDatos.length > 0
                    ? 'Hay intervenciones clasificadas pero ninguna regla alcanzó su umbral. Esto no confirma ausencia de problemas: depende de las reglas configuradas y de la clasificación de las OTs.'
                    : 'No hay intervenciones clasificadas por componente. Vinculá OTs a componentes (manual o con clasificación asistida) para empezar el análisis.'}
                </p>
              )}

              {casos.map((caso: any) => (
                <div key={caso.id} className={`rounded-md border p-3 space-y-2.5 ${caso.status === 'CERRADO' ? 'border-neutral-200 bg-neutral-50 opacity-80' : 'border-amber-200 bg-amber-50/40'}`}>
                  {/* Cabecera del caso */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ESTADO_CASO[caso.status]?.cls || 'bg-neutral-100'}`}>{ESTADO_CASO[caso.status]?.label || caso.status}</span>
                    <p className="text-xs font-bold text-neutral-900">{caso.component?.nombre}</p>
                    {caso.instance?.serialNumber && <span className="text-[10px] text-neutral-400">serie {caso.instance.serialNumber}</span>}
                    <span className="ml-auto text-[10px] text-neutral-400">abierto {fmtFecha(caso.openedAt)}</span>
                  </div>

                  {caso.motivoResumen && (
                    <p className="text-[11px] text-amber-800 flex items-start gap-1"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {caso.motivoResumen}</p>
                  )}
                  {caso.datosFaltantes?.length > 0 && (
                    <div className="text-[11px] text-neutral-500 space-y-0.5">
                      {caso.datosFaltantes.map((f: string, i: number) => <p key={i}>· Dato faltante: {f}</p>)}
                    </div>
                  )}

                  {/* Intervenciones */}
                  {caso.intervenciones?.length > 0 && (
                    <div className="rounded-md border border-neutral-200 bg-white overflow-hidden">
                      <table className="w-full text-[11px]">
                        <thead className="bg-neutral-50 text-neutral-500">
                          <tr>
                            <th className="text-left font-medium px-2 py-1.5">OT</th>
                            <th className="text-left font-medium px-2 py-1.5">Pieza / trabajo</th>
                            <th className="text-left font-medium px-2 py-1.5">Fecha</th>
                            <th className="text-right font-medium px-2 py-1.5">Costo</th>
                            <th className="text-right font-medium px-2 py-1.5">Parada</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {caso.intervenciones.map((iv: any) => (
                            <tr key={iv.workOrderId}>
                              <td className="px-2 py-1.5 font-medium text-neutral-800">{iv.code}</td>
                              <td className="px-2 py-1.5 text-neutral-600">{iv.subcomponente || iv.title}{iv.causa ? ` · causa: ${iv.causa}` : ''}</td>
                              <td className="px-2 py-1.5 text-neutral-600">{fmtFecha(iv.completedAt)}</td>
                              <td className="px-2 py-1.5 text-right text-neutral-600">{iv.totalCost != null ? fmtMoney(iv.totalCost) : 'sin dato'}</td>
                              <td className="px-2 py-1.5 text-right text-neutral-600">{iv.horasParadaAtribuida > 0 ? `${iv.horasParadaAtribuida} h` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="px-2 py-1.5 bg-neutral-50 border-t border-neutral-100 flex gap-4 text-[10px] text-neutral-500">
                        <span>{caso.intervenciones.length} intervención(es)</span>
                        <span>Costo registrado: {caso.costoTotalIntervenciones != null ? fmtMoney(caso.costoTotalIntervenciones) : 'sin datos'} {caso.intervencionesConCosto < caso.intervenciones.length ? `(${caso.intervencionesConCosto}/${caso.intervenciones.length} con costo)` : ''}</span>
                        <span>Parada atribuida: {caso.horasParadaTotal > 0 ? `${caso.horasParadaTotal} h` : 'sin datos'}</span>
                      </div>
                    </div>
                  )}

                  {/* Alternativas */}
                  {caso.status !== 'CERRADO' && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">Alternativas (costos a futuro)</p>
                      {(caso.alternativas || []).map((a: any) => (
                        <div key={a.id} className={`rounded-md border px-2.5 py-1.5 text-[11px] flex flex-wrap items-center gap-x-3 gap-y-0.5 ${a.seleccionada ? 'border-green-300 bg-green-50' : 'border-neutral-200 bg-white'}`}>
                          <span className="font-semibold text-neutral-800">{TIPO_ALT[a.tipo] || a.tipo}</span>
                          {a.seleccionada && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                          <span className="text-neutral-600">{fmtMoney(a.costoInmediato, a.moneda)}{a.costoInstalacion != null ? ` + inst. ${fmtMoney(a.costoInstalacion, a.moneda)}` : ''}</span>
                          {a.plazoInmovilizacionDias != null && <span className="text-neutral-500">{a.plazoInmovilizacionDias} días parada</span>}
                          {a.garantiaMeses != null && <span className="text-neutral-500">garantía {a.garantiaMeses} m</span>}
                          {a.proveedor && <span className="text-neutral-400">{a.proveedor}</span>}
                          {a.moneda !== 'ARS' && a.tipoCambio == null && <span className="text-amber-600">moneda {a.moneda} sin conversión</span>}
                        </div>
                      ))}
                      {/* Form nueva alternativa */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select className="rounded border border-neutral-300 px-1.5 py-1 text-[11px]" value={altForm[caso.id]?.tipo || ''}
                          onChange={e => setAltForm(p => ({ ...p, [caso.id]: { ...p[caso.id], tipo: e.target.value } }))}>
                          <option value="">+ Alternativa…</option>
                          {Object.entries(TIPO_ALT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        {altForm[caso.id]?.tipo && (
                          <>
                            <input placeholder="costo" className="w-20 rounded border border-neutral-300 px-1.5 py-1 text-[11px]" value={altForm[caso.id]?.costoInmediato || ''}
                              onChange={e => setAltForm(p => ({ ...p, [caso.id]: { ...p[caso.id], costoInmediato: e.target.value } }))} />
                            <input placeholder="+ instalación" className="w-20 rounded border border-neutral-300 px-1.5 py-1 text-[11px]" value={altForm[caso.id]?.costoInstalacion || ''}
                              onChange={e => setAltForm(p => ({ ...p, [caso.id]: { ...p[caso.id], costoInstalacion: e.target.value } }))} />
                            <input placeholder="días parada" className="w-20 rounded border border-neutral-300 px-1.5 py-1 text-[11px]" value={altForm[caso.id]?.plazo || ''}
                              onChange={e => setAltForm(p => ({ ...p, [caso.id]: { ...p[caso.id], plazo: e.target.value } }))} />
                            <input placeholder="proveedor" className="w-24 rounded border border-neutral-300 px-1.5 py-1 text-[11px]" value={altForm[caso.id]?.proveedor || ''}
                              onChange={e => setAltForm(p => ({ ...p, [caso.id]: { ...p[caso.id], proveedor: e.target.value } }))} />
                            <button onClick={() => cargarAlternativa(caso.id)} disabled={busy === 'alt-' + caso.id} className="rounded bg-indigo-600 text-white px-2 py-1 text-[11px] font-medium disabled:opacity-50">Cargar</button>
                          </>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-400">Los gastos ya realizados son costos pasados comunes a todas las alternativas: la comparación es sobre lo que se espera gastar a partir de ahora.</p>
                    </div>
                  )}

                  {/* Decisión */}
                  {['DETECTADO', 'EN_ANALISIS'].includes(caso.status) && (
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-amber-200/60 pt-2">
                      {caso.status === 'DETECTADO' && (
                        <button onClick={() => cambiarEstado(caso.id, 'EN_ANALISIS')} disabled={busy === 'est-' + caso.id} className="rounded border border-blue-300 text-blue-700 px-2 py-1 text-[11px] font-medium hover:bg-blue-50 disabled:opacity-50">Tomar en análisis</button>
                      )}
                      <select className="rounded border border-neutral-300 px-1.5 py-1 text-[11px]" value={decForm[caso.id]?.alternativaId || ''}
                        onChange={e => setDecForm(p => ({ ...p, [caso.id]: { ...p[caso.id], alternativaId: e.target.value } }))}>
                        <option value="">Elegir alternativa…</option>
                        {(caso.alternativas || []).map((a: any) => <option key={a.id} value={a.id}>{TIPO_ALT[a.tipo] || a.tipo}{a.costoInmediato != null ? ` (${fmtMoney(a.costoInmediato, a.moneda)})` : ''}</option>)}
                      </select>
                      <input placeholder="fundamento de la decisión (obligatorio)" className="flex-1 min-w-48 rounded border border-neutral-300 px-2 py-1 text-[11px]"
                        value={decForm[caso.id]?.fundamento || ''} onChange={e => setDecForm(p => ({ ...p, [caso.id]: { ...p[caso.id], fundamento: e.target.value } }))} />
                      <select className="rounded border border-neutral-300 px-1.5 py-1 text-[11px]" value={decForm[caso.id]?.workOrderAccionId || ''}
                        onChange={e => setDecForm(p => ({ ...p, [caso.id]: { ...p[caso.id], workOrderAccionId: e.target.value } }))}>
                        <option value="">sin OT vinculada</option>
                        {otsSinVinculo.map((o: any) => <option key={o.id} value={o.id}>{o.code} — {o.title}</option>)}
                      </select>
                      <button onClick={() => decidir(caso.id)} disabled={busy === 'dec-' + caso.id || !decForm[caso.id]?.alternativaId || !decForm[caso.id]?.fundamento?.trim()}
                        className="rounded bg-indigo-600 text-white px-2.5 py-1 text-[11px] font-medium disabled:opacity-50">Aprobar acción</button>
                    </div>
                  )}

                  {/* Decisión tomada + ejecución */}
                  {caso.alternativaElegida && (
                    <div className="rounded-md border border-indigo-200 bg-indigo-50/60 px-2.5 py-1.5 text-[11px] space-y-0.5">
                      <p><span className="font-semibold text-indigo-800">Decisión: {TIPO_ALT[caso.alternativaElegida] || caso.alternativaElegida}</span>
                        {caso.decididoPor && <span className="text-neutral-500"> por {caso.decididoPor} el {fmtFecha(caso.decididoAt)}</span>}</p>
                      {caso.decisionFundamento && <p className="text-neutral-600">Fundamento: {caso.decisionFundamento}</p>}
                    </div>
                  )}

                  {['ACCION_APROBADA', 'EN_EJECUCION'].includes(caso.status) && (
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-amber-200/60 pt-2">
                      <span className="text-[11px] text-neutral-600">Registrar ejecución:</span>
                      <input placeholder="km actual" className="w-20 rounded border border-neutral-300 px-1.5 py-1 text-[11px]" value={ejecForm[caso.id]?.km || ''}
                        onChange={e => setEjecForm(p => ({ ...p, [caso.id]: { ...p[caso.id], km: e.target.value } }))} />
                      {caso.alternativaElegida === 'REEMPLAZAR' && (
                        <input placeholder="n° serie pieza nueva" className="w-32 rounded border border-neutral-300 px-1.5 py-1 text-[11px]" value={ejecForm[caso.id]?.serialNueva || ''}
                          onChange={e => setEjecForm(p => ({ ...p, [caso.id]: { ...p[caso.id], serialNueva: e.target.value } }))} />
                      )}
                      <input placeholder="revisar a los X días" className="w-28 rounded border border-neutral-300 px-1.5 py-1 text-[11px]" value={ejecForm[caso.id]?.revisionDias || ''}
                        onChange={e => setEjecForm(p => ({ ...p, [caso.id]: { ...p[caso.id], revisionDias: e.target.value } }))} />
                      <input placeholder="o a los X km" className="w-24 rounded border border-neutral-300 px-1.5 py-1 text-[11px]" value={ejecForm[caso.id]?.revisionKm || ''}
                        onChange={e => setEjecForm(p => ({ ...p, [caso.id]: { ...p[caso.id], revisionKm: e.target.value } }))} />
                      <button onClick={() => ejecutar(caso.id)} disabled={busy === 'eje-' + caso.id} className="rounded bg-cyan-600 text-white px-2.5 py-1 text-[11px] font-medium disabled:opacity-50">Ejecutada → seguimiento</button>
                    </div>
                  )}

                  {/* Seguimiento */}
                  {caso.status === 'EN_SEGUIMIENTO' && caso.seguimiento && (
                    <div className="rounded-md border border-cyan-200 bg-cyan-50/60 px-2.5 py-1.5 text-[11px] space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${RESULTADO_SEG[caso.seguimiento.resultado]?.cls}`}>{RESULTADO_SEG[caso.seguimiento.resultado]?.label}</span>
                        <span className="text-neutral-500">acción el {fmtFecha(caso.accionEjecutadaAt)}{caso.accionEjecutadaKm != null ? ` a ${caso.accionEjecutadaKm.toLocaleString('es-AR')} km` : ''}</span>
                      </div>
                      <p className="text-neutral-600">{caso.seguimiento.detalle}</p>
                      <button onClick={() => cerrarCaso(caso.id)} disabled={busy === 'cer-' + caso.id} className="mt-1 rounded border border-neutral-300 text-neutral-600 px-2 py-0.5 text-[11px] hover:bg-white disabled:opacity-50">Cerrar caso</button>
                    </div>
                  )}

                  {/* Eventos (trazabilidad) */}
                  {caso.eventos?.length > 0 && (
                    <details className="text-[10px] text-neutral-400">
                      <summary className="cursor-pointer hover:text-neutral-600">Trazabilidad ({caso.eventos.length} eventos)</summary>
                      <div className="mt-1 space-y-0.5 pl-2 border-l-2 border-neutral-200">
                        {caso.eventos.map((e: any) => (
                          <p key={e.id}>{fmtFecha(e.createdAt)} · {e.tipo}{e.userName ? ` · ${e.userName}` : ''}{e.detalle ? ` — ${e.detalle}` : ''}</p>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}

              {/* Vincular OT a componente */}
              <div className="rounded-md border border-neutral-200 bg-white p-2.5 space-y-1.5">
                <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide flex items-center gap-1"><ClipboardCheck className="h-3 w-3" /> Clasificar intervención por componente</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <select className="rounded border border-neutral-300 px-1.5 py-1 text-[11px] max-w-56" value={vincularOT || ''} onChange={e => setVincularOT(e.target.value || null)}>
                    <option value="">Elegir OT completada…</option>
                    {otsSinVinculo.map((o: any) => <option key={o.id} value={o.id}>{o.code} — {o.title}</option>)}
                  </select>
                  {vincularOT && (
                    <>
                      <select className="rounded border border-neutral-300 px-1.5 py-1 text-[11px]" value={vincForm.componentId} onChange={e => setVincForm(p => ({ ...p, componentId: e.target.value }))}>
                        <option value="">Componente padre…</option>
                        {componentes.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                      <input placeholder="pieza (ej: carbones)" className="w-28 rounded border border-neutral-300 px-1.5 py-1 text-[11px]" value={vincForm.subcomponente} onChange={e => setVincForm(p => ({ ...p, subcomponente: e.target.value }))} />
                      <input placeholder="causa (opcional)" className="w-28 rounded border border-neutral-300 px-1.5 py-1 text-[11px]" value={vincForm.causa} onChange={e => setVincForm(p => ({ ...p, causa: e.target.value }))} />
                      <button onClick={vincular} disabled={busy === 'vinc' || !vincForm.componentId} className="rounded bg-indigo-600 text-white px-2 py-1 text-[11px] font-medium disabled:opacity-50">Vincular</button>
                      <button onClick={() => setVincularOT(null)} className="text-neutral-400 hover:text-neutral-600"><X className="h-3.5 w-3.5" /></button>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-neutral-400">Agrupa OTs bajo el componente padre aunque la pieza o la descripción difieran. La detección corre sobre clasificaciones confirmadas.</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
