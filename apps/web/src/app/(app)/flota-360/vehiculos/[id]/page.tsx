'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DigitalTwin } from '../../_components/FleetVisual';
import CargaCombustible from '../../_components/CargaCombustible';
import NeumaticosPanel from '../../_components/NeumaticosPanel';
import FacturasPanel from '../../_components/FacturasPanel';
import MultasPanel from '../../_components/MultasPanel';
import RecurrenciasPanel from '../../_components/RecurrenciasPanel';
import { apiFetch } from '@/lib/api';
import {
  ChevronLeft, Gauge, Wrench, ShieldCheck, ScanLine, AlertTriangle,
  CalendarClock, DollarSign, Activity, Pencil, Fuel, X, History, TrendingUp, Disc,
} from 'lucide-react';

const ESTADO_LABEL: Record<string, string> = {
  ACTIVO: 'Activo', EN_TALLER: 'En taller', INACTIVO: 'Inactivo', BAJA: 'Baja',
};
const ESTADO_COLOR: Record<string, string> = {
  ACTIVO: 'bg-green-50 text-green-700', EN_TALLER: 'bg-amber-50 text-amber-700',
  INACTIVO: 'bg-neutral-100 text-neutral-600', BAJA: 'bg-red-50 text-red-600',
};
const ESTADO_OT_LABEL: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En proceso', COMPLETED: 'Completada', ON_HOLD: 'En espera', CANCELLED: 'Cancelada',
};
const TIPO_LABEL: Record<string, string> = {
  TRACTOR: 'Tractor', SEMI: 'Semirremolque', CAMION: 'Camión', UTILITARIO: 'Utilitario',
};
const ESTADO_OP: Record<string, { label: string; cls: string; dot: string }> = {
  OPERATIVO: { label: 'Operativo', cls: 'bg-green-100 text-green-700 border-green-300', dot: 'bg-green-500' },
  EN_TALLER: { label: 'En taller', cls: 'bg-amber-100 text-amber-700 border-amber-300', dot: 'bg-amber-500' },
  EN_REPARACION: { label: 'En reparación', cls: 'bg-blue-100 text-blue-700 border-blue-300', dot: 'bg-blue-500' },
};

function fmtFecha(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function saludColor(s: number | null | undefined) {
  if (s == null) return 'text-neutral-400';
  if (s >= 80) return 'text-green-600';
  if (s >= 60) return 'text-amber-600';
  return 'text-red-600';
}
function saludBar(s: number | null | undefined) {
  if (s == null) return 'bg-neutral-200';
  if (s >= 80) return 'bg-green-500';
  if (s >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}
function estadoGeneralLabel(e: string | null | undefined) {
  if (['CRITICO', 'CRÍTICO', 'MALO'].includes(e || '')) return { label: 'Requiere revisión', cls: 'bg-red-100 text-red-700' };
  if (['ATENCION', 'REGULAR'].includes(e || '')) return { label: 'Requiere atención', cls: 'bg-amber-100 text-amber-700' };
  return { label: 'Operativo', cls: 'bg-green-100 text-green-700' };
}

export default function VehiculoFichaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [completo, setCompleto] = useState<any>(null);
  const [twin, setTwin] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCarga, setShowCarga] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [proyKm, setProyKm] = useState(50000);
  const [proy, setProy] = useState<any>(null);
  const [proyLoading, setProyLoading] = useState(false);
  const [conductores, setConductores] = useState<any[]>([]);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [estadoOp, setEstadoOp] = useState<any>(null);
  const [estadoSaving, setEstadoSaving] = useState<string | null>(null);
  const [showEstadoHist, setShowEstadoHist] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [c, t, e, cond] = await Promise.all([
        apiFetch<any>(`/flota/vehiculos/${id}/completo`),
        apiFetch<any>(`/flota/vehiculos/${id}/twin`).catch(() => null),
        apiFetch<any>(`/fleet-ops/vehiculos/${id}/estado-historial`).catch(() => null),
        apiFetch<{ conductores: any[] }>('/flota/conductores').catch(() => ({ conductores: [] })),
      ]);
      setCompleto(c);
      setTwin(t);
      setEstadoOp(e);
      setConductores(cond.conductores || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const abrirEdicion = async () => {
    const v = completo?.vehiculo;
    const asset = completo?.mantenimiento?.asset;
    setEditForm({
      dominio: v?.dominio || '', tipo: v?.tipo || 'CAMION',
      marca: v?.marca || '', modelo: v?.modelo || '',
      anio: v?.anio || '', color: v?.color || '',
      chasis: v?.chasis || '', motor: v?.motor || '',
      cantEjes: v?.cantEjes ?? '', configEjes: v?.configEjes || '',
      status: v?.status || 'ACTIVO',
      currentOdometer: v?.currentOdometer ?? '', conductorId: v?.conductorId || '',
      valorAdquisicion: v?.valorAdquisicion ?? '',
      fechaCompra: asset?.purchaseDate ? String(asset.purchaseDate).slice(0, 10) : '',
      notas: v?.notas || '',
    });
    setEditError(null);
    setShowEdit(true);
    if (conductores.length === 0) {
      apiFetch<{ conductores: any[] }>('/flota/conductores').then((r) => setConductores(r.conductores || [])).catch(() => {});
    }
  };

  const guardarEdicion = async () => {
    setSaving(true);
    setEditError(null);
    try {
      await apiFetch(`/flota/vehiculos/${id}`, {
        method: 'PATCH',
        json: {
          dominio: editForm.dominio || undefined,
          tipo: editForm.tipo || undefined,
          marca: editForm.marca || undefined,
          modelo: editForm.modelo || undefined,
          anio: editForm.anio ? Number(editForm.anio) : undefined,
          color: editForm.color || undefined,
          chasis: editForm.chasis || undefined,
          motor: editForm.motor || undefined,
          cantEjes: editForm.cantEjes !== '' && editForm.cantEjes != null ? Number(editForm.cantEjes) : undefined,
          configEjes: editForm.configEjes || undefined,
          status: editForm.status || undefined,
          currentOdometer: editForm.currentOdometer !== '' ? Number(editForm.currentOdometer) : undefined,
          valorAdquisicion: editForm.valorAdquisicion !== '' ? Number(editForm.valorAdquisicion) : undefined,
          purchaseDate: editForm.fechaCompra ? new Date(editForm.fechaCompra + 'T00:00:00').toISOString() : undefined,
          conductorId: editForm.conductorId || null,
          notas: editForm.notas || undefined,
        },
      });
      setShowEdit(false);
      await load();
    } catch (e: any) {
      setEditError(e?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const cambiarEstado = async (estado: string) => {
    setEstadoSaving(estado);
    try {
      await apiFetch(`/fleet-ops/vehiculos/${id}/estado`, { method: 'POST', json: { estado } });
      const e = await apiFetch<any>(`/fleet-ops/vehiculos/${id}/estado-historial`).catch(() => null);
      setEstadoOp(e);
      const c = await apiFetch<any>(`/flota/vehiculos/${id}/completo`).catch(() => null);
      if (c) setCompleto(c);
    } finally {
      setEstadoSaving(null);
    }
  };

  if (loading) return <div className="p-8 text-sm text-neutral-500">Cargando ficha…</div>;
  if (!completo?.vehiculo) return <div className="p-8 text-sm text-neutral-500">Vehículo no encontrado</div>;

  const v = completo.vehiculo;
  const cargarProyeccion = async (km: number) => {
    setProyKm(km);
    setProyLoading(true);
    try {
      const r = await apiFetch<any>(`/flota/vehiculos/${id}/proyeccion?km=${km}`);
      setProy(r.proyeccion || null);
    } catch {
      setProy(null);
    } finally {
      setProyLoading(false);
    }
  };

  const mant = completo.mantenimiento || {};
  const kpis = mant.kpis || {};
  const workOrders = mant.workOrders || [];
  const twinData = twin?.twin || null;
  const health = twinData?.healthScore ?? null;
  const esSemi = twinData?.esSemi ?? v.tipo === 'SEMI';
  const componentes = twinData?.componentes || {};
  const estadoGral = estadoGeneralLabel(twinData?.estadoGeneral);
  const proxServicio = twinData?.proximoServicio;
  const ultimaInsp = twinData?.ultimaInspeccion;

  return (
    <div className="space-y-4">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800">
        <ChevronLeft className="h-3.5 w-3.5" /> Volver
      </button>

      {/* Header del activo */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-[#0d1b3d] flex items-center gap-2">
            {[v.marca, v.modelo].filter(Boolean).join(' ')} · {v.dominio}
            <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${ESTADO_COLOR[v.status] || 'bg-neutral-100 text-neutral-600'}`}>
              {ESTADO_LABEL[v.status] || v.status}
            </span>
            {twinData && (
              <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${estadoGral.cls}`}>{estadoGral.label}</span>
            )}
          </h1>
          <p className="text-xs text-neutral-500">
            {[TIPO_LABEL[v.tipo] || v.tipo, v.marca, v.modelo, v.anio].filter(Boolean).join(' · ')}
            {esSemi && ' · Sin motor propio'}
          </p>
          {(v.chasis || v.motor || v.color || v.configEjes || v.cantEjes) && (
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {[
                v.color && `Color ${v.color}`,
                v.chasis && `Chasis ${v.chasis}`,
                v.motor && `Motor ${v.motor}`,
                (v.configEjes || v.cantEjes) && `Ejes ${v.configEjes || v.cantEjes}`,
              ].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={abrirEdicion} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
          {!esSemi && (
            <button onClick={() => setShowCarga(true)} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
              <Fuel className="h-3.5 w-3.5" /> Registrar carga
            </button>
          )}
          <Link href={`/flota-360/ordenes?nueva=1&vehiculoId=${v.id}`} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
            <Wrench className="h-3.5 w-3.5" /> Nueva OT
          </Link>
        </div>
      </div>

      {/* Estadío operativo — OPERATIVO / EN_TALLER / EN_REPARACION */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Activity className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-sm font-semibold text-neutral-800">Estadío de la unidad</p>
              <p className="text-xs text-neutral-500">
                {estadoOp?.estadoOperativo
                  ? <>Actual: <span className="font-medium">{ESTADO_OP[estadoOp.estadoOperativo]?.label ?? estadoOp.estadoOperativo}</span>
                      {estadoOp.historial?.[0] && ` · hace ${estadoOp.historial[0].horas} hs (${estadoOp.historial[0].turnos} turnos)`}</>
                  : 'Sin eventos registrados'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {(['OPERATIVO', 'EN_TALLER', 'EN_REPARACION'] as const).map((e) => {
              const cfg = ESTADO_OP[e];
              const activo = estadoOp?.estadoOperativo === e || (!estadoOp?.estadoOperativo && e === 'OPERATIVO');
              return (
                <button
                  key={e}
                  onClick={() => cambiarEstado(e)}
                  disabled={estadoSaving !== null || activo}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${
                    activo ? cfg.cls + ' cursor-default' : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50'
                  } disabled:opacity-60`}
                >
                  <span className={`h-2 w-2 rounded-full ${activo ? cfg.dot : 'bg-neutral-300'}`} />
                  {estadoSaving === e ? 'Guardando…' : cfg.label}
                </button>
              );
            })}
          </div>
        </div>
        {estadoOp?.ultimoCiclo && (
          <p className="text-[11px] text-neutral-500 mt-2">
            Última estadía en taller: {fmtFecha(estadoOp.ultimoCiclo.desde)} → {fmtFecha(estadoOp.ultimoCiclo.hasta)}
            {' · '}{estadoOp.ultimoCiclo.horasTotal} hs totales ({estadoOp.ultimoCiclo.turnosTotal} turnos de 9hs)
            {estadoOp.ultimoCiclo.horasReparacion > 0 && ` · ${estadoOp.ultimoCiclo.horasReparacion} hs en reparación efectiva (${estadoOp.ultimoCiclo.turnosReparacion} turnos)`}
          </p>
        )}
        {estadoOp?.historial?.length > 0 && (
          <>
            <button onClick={() => setShowEstadoHist(!showEstadoHist)} className="text-xs text-blue-600 mt-2 hover:underline">
              {showEstadoHist ? 'Ocultar historial' : `Ver historial (${estadoOp.historial.length} eventos)`}
            </button>
            {showEstadoHist && (
              <div className="mt-2 border-t border-neutral-100 pt-2 space-y-1 max-h-48 overflow-y-auto">
                {estadoOp.historial.map((h: any) => (
                  <div key={h.id} className="flex items-center justify-between text-xs py-1">
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${ESTADO_OP[h.estado]?.dot ?? 'bg-neutral-300'}`} />
                      <span className="font-medium text-neutral-700">{ESTADO_OP[h.estado]?.label ?? h.estado}</span>
                      <span className="text-neutral-400">{fmtFecha(h.desde)} {new Date(h.desde).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {h.createdByName && <span className="text-neutral-400">· {h.createdByName}</span>}
                      {h.origen === 'QR_MECANICO' && <span className="text-[10px] text-blue-500">QR</span>}
                    </div>
                    <span className="text-neutral-500">{h.horas} hs · {h.turnos} turnos{h.esActual ? ' (actual)' : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] font-medium uppercase mb-1"><Gauge className="h-3.5 w-3.5" /> Odómetro</div>
          <p className="text-xl font-bold text-neutral-900">{v.currentOdometer != null ? Math.round(v.currentOdometer).toLocaleString('es-AR') : '—'}<span className="text-xs font-normal text-neutral-400"> km</span></p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] font-medium uppercase mb-1"><ShieldCheck className="h-3.5 w-3.5" /> Salud</div>
          <p className={`text-xl font-bold ${saludColor(health)}`}>{health != null ? `${Math.round(health)}/100` : 'Sin datos'}</p>
          {twinData?.riskScore != null && <p className="text-[11px] text-neutral-400">Riesgo {Math.round(twinData.riskScore)}/100</p>}
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] font-medium uppercase mb-1"><Wrench className="h-3.5 w-3.5" /> OTs abiertas</div>
          <p className="text-xl font-bold text-neutral-900">{twinData?.otAbiertas ?? kpis.otsPendientes ?? 0}</p>
          {twinData?.diasEnTaller != null && <p className="text-[11px] text-amber-600">{twinData.diasEnTaller}d en taller</p>}
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] font-medium uppercase mb-1"><DollarSign className="h-3.5 w-3.5" /> Costo/km (6m)</div>
          <p className="text-xl font-bold text-neutral-900">{twinData?.costoPorKm != null ? `$${twinData.costoPorKm}` : '—'}</p>
          {twinData?.costos6m != null && <p className="text-[11px] text-neutral-400">Total ${twinData.costos6m.toLocaleString('es-AR')}</p>}
        </div>
      </div>

      <div className="fleet-twin-grid">
        <DigitalTwin vehicle={v} components={componentes} health={health} />
        <section className="fleet-panel">
          <header className="fleet-panel-heading"><h2>Estado operativo</h2></header>
          <div className="fleet-fact"><p className="fleet-fact-label"><Gauge size={16} /> Kilometraje registrado</p><p className="fleet-fact-value">{v.currentOdometer?.toLocaleString('es-AR') ?? 'Sin lectura'} <small className="text-sm font-normal">{v.currentOdometer != null ? 'km' : ''}</small></p></div>
          <div className="fleet-fact"><p className="fleet-fact-label"><CalendarClock size={16} /> Próximo servicio</p><p className="font-semibold text-sm">{proxServicio?.plan || 'Sin plan asignado'}</p><p className="text-xs text-slate-500 mt-2">{proxServicio?.tipo === 'KM' ? `${proxServicio.kmRestantes?.toLocaleString('es-AR')} km restantes` : proxServicio?.fecha ? fmtFecha(proxServicio.fecha) : 'Configurá las frecuencias por componente.'}</p><Link className="text-xs text-blue-600 inline-block mt-3" href={`/flota-360/planes?vehiculoId=${v.id}`}>Ver planificación →</Link></div>
          <div className="fleet-fact"><p className="fleet-fact-label"><Wrench size={16} /> Órdenes abiertas</p><p className="fleet-fact-value">{twinData?.otAbiertas ?? kpis.otsPendientes ?? 0}</p></div>
          <div className="fleet-fact"><p className="fleet-fact-label"><ScanLine size={16} /> Última inspección QR</p><p className="text-sm font-semibold">{ultimaInsp ? fmtFecha(ultimaInsp.createdAt) : 'Sin registros'}</p><p className="text-xs text-slate-500 mt-2">{ultimaInsp ? `${ultimaInsp.hallazgosCount ?? 0} hallazgos registrados` : 'Las inspecciones existentes se conservan.'}</p></div>
        </section>
        <section className="fleet-panel">
          <header className="fleet-panel-heading"><h2>Costos del activo</h2><span className="fleet-caption">Últimos 6 meses</span></header>
          {v.valorAdquisicion != null && (
            <div className="fleet-fact"><p className="fleet-fact-label">Valor de adquisición</p><p className="fleet-fact-value">$ {Number(v.valorAdquisicion).toLocaleString('es-AR')}</p></div>
          )}
          {mant.asset?.purchaseDate && (
            <div className="fleet-fact"><p className="fleet-fact-label">Fecha de compra</p><p className="fleet-fact-value">{fmtFecha(mant.asset.purchaseDate)}</p></div>
          )}
          <div className="fleet-fact"><p className="fleet-fact-label">Costo por kilómetro</p><p className="text-4xl font-bold text-blue-700">{twinData?.costoPorKm != null ? `$ ${twinData.costoPorKm.toLocaleString('es-AR')}` : 'Sin datos'}</p></div>
          <div className="fleet-fact"><p className="fleet-fact-label">Costo acumulado registrado</p><p className="fleet-fact-value">{twinData?.costos6m != null ? `$ ${twinData.costos6m.toLocaleString('es-AR')}` : 'Sin datos'}</p></div>
          <div className="fleet-fact"><p className="text-xs text-slate-500 leading-relaxed">Consultá el desglose de mantenimiento, combustible y neumáticos, y compará el desempeño de las unidades.</p><Link href="/flota-360/costos" className="mt-4 block rounded-lg bg-blue-50 p-3 text-sm font-semibold text-blue-700">Abrir análisis de costos →</Link></div>
        </section>
      </div>

      {/* Análisis de reemplazo — evaluación económica del desgaste */}
      {twinData?.reemplazo && (() => {
        const r = twinData.reemplazo;
        const REC: Record<string, { label: string; cls: string; bar: string }> = {
          MANTENER: { label: 'Mantener unidad', cls: 'bg-green-100 text-green-700', bar: 'border-green-200 bg-green-50/40' },
          VIGILAR: { label: 'Vigilar costos', cls: 'bg-amber-100 text-amber-700', bar: 'border-amber-200 bg-amber-50/40' },
          EVALUAR_REEMPLAZO: { label: 'Evaluar reemplazo', cls: 'bg-orange-100 text-orange-700', bar: 'border-orange-200 bg-orange-50/40' },
          REEMPLAZAR: { label: 'Reemplazo recomendado', cls: 'bg-red-100 text-red-700', bar: 'border-red-200 bg-red-50/40' },
        };
        const rec = REC[r.recomendacion] || REC.MANTENER;
        return (
          <div className={`rounded-lg border p-4 ${rec.bar}`}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-neutral-800">Análisis de reemplazo</h3>
              </div>
              <span className={`text-[11px] font-semibold rounded-full px-2.5 py-1 ${rec.cls}`}>{rec.label}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div>
                <p className="text-[11px] text-neutral-500 uppercase font-medium">Costo últimos 12m</p>
                <p className="text-lg font-bold text-neutral-900">${(r.costoAnualUltimos12m ?? 0).toLocaleString('es-AR')}</p>
                {r.tendenciaPct != null && r.tendenciaPct !== 0 && (
                  <p className={`text-[11px] ${r.tendenciaPct > 0 ? 'text-red-600' : 'text-green-600'}`}>{r.tendenciaPct > 0 ? '+' : ''}{r.tendenciaPct}% vs semestre anterior</p>
                )}
              </div>
              <div>
                <p className="text-[11px] text-neutral-500 uppercase font-medium">Proyección 12m</p>
                <p className="text-lg font-bold text-neutral-900">${(r.proyeccion12m ?? 0).toLocaleString('es-AR')}</p>
                {r.ratioProyVsCapital != null && <p className="text-[11px] text-neutral-400">{Math.round(r.ratioProyVsCapital * 100)}% del costo anual de una unidad nueva</p>}
              </div>
              <div>
                <p className="text-[11px] text-neutral-500 uppercase font-medium">Acumulado reparaciones</p>
                <p className="text-lg font-bold text-neutral-900">${(r.costoAcumulado ?? 0).toLocaleString('es-AR')}</p>
                {r.valorResidual != null && <p className="text-[11px] text-neutral-400">Valor residual est. ${r.valorResidual.toLocaleString('es-AR')}</p>}
              </div>
              <div>
                <p className="text-[11px] text-neutral-500 uppercase font-medium">Reemplazo estimado</p>
                <p className="text-lg font-bold text-neutral-900">
                  {r.mesesEstimadosReemplazo != null ? `~${r.mesesEstimadosReemplazo} meses` : 'Sin fecha límite'}
                </p>
                {r.kmEstimadosReemplazo != null && <p className="text-[11px] text-neutral-400">≈ {r.kmEstimadosReemplazo.toLocaleString('es-AR')} km</p>}
              </div>
            </div>
            {r.motivos?.length > 0 && (
              <ul className="space-y-1">
                {r.motivos.map((m: string, i: number) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-neutral-600">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" /> {m}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })()}

      {/* Detalle complementario de indicadores */}
      {Object.keys(componentes).length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-neutral-800">Salud por sistema</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(componentes).map(([key, comp]: [string, any]) => (
              <div key={key} className="rounded-md border border-neutral-100 bg-neutral-50 p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-neutral-700">{comp.label || key}</span>
                  {comp.sinDatos || comp.salud == null ? (
                    <span className="text-[11px] text-neutral-400">Sin datos</span>
                  ) : (
                    <span className={`text-xs font-bold ${saludColor(comp.salud)}`}>{Math.round(comp.salud)}%</span>
                  )}
                </div>
                <div className="h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                  <div className={`h-full rounded-full ${saludBar(comp.salud)}`} style={{ width: `${comp.salud ?? 0}%` }} />
                </div>
                {comp.kmRestantes != null && (
                  <p className="text-[10px] text-neutral-400 mt-1">{comp.kmRestantes.toLocaleString('es-AR')} km restantes</p>
                )}
                {comp.montados != null && <p className="text-[10px] text-neutral-400 mt-1">{comp.montados} montados</p>}
                {comp.l100km != null && <p className="text-[10px] text-neutral-400 mt-1">{comp.l100km} L/100km</p>}
                {(comp.vencidos > 0 || comp.porVencer > 0) && (
                  <p className="text-[10px] text-amber-600 mt-1">{comp.vencidos > 0 ? `${comp.vencidos} vencidos` : ''}{comp.vencidos > 0 && comp.porVencer > 0 ? ' · ' : ''}{comp.porVencer > 0 ? `${comp.porVencer} por vencer` : ''}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proyección del gemelo digital */}
      <div className="rounded-lg border border-violet-200 bg-white p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-violet-600" />
            <h3 className="text-sm font-semibold text-neutral-800">Proyección — ¿qué pasa si recorro…?</h3>
          </div>
          <div className="flex items-center gap-1.5">
            {[10000, 50000, 100000].map((k) => (
              <button key={k} onClick={() => cargarProyeccion(k)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${proyKm === k && proy ? 'bg-violet-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                +{(k / 1000).toLocaleString('es-AR')}k km
              </button>
            ))}
            <input type="number" min={1000} step={5000} placeholder="km" className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-xs" onKeyDown={(e) => { if (e.key === 'Enter') { const v = Number((e.target as HTMLInputElement).value); if (v >= 1000) cargarProyeccion(v); } }} />
          </div>
        </div>

        {!proy && !proyLoading && <p className="text-xs text-neutral-400">Elegí un kilometraje para proyectar servicios, desgaste y costos estimados.</p>}
        {proyLoading && <p className="text-xs text-neutral-400">Proyectando…</p>}

        {proy && !proyLoading && (
          <div className="space-y-4">
            {/* Resumen del horizonte */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-600">
              <span>De <b>{proy.kmActual?.toLocaleString('es-AR')}</b> a <b>{proy.kmFinal?.toLocaleString('es-AR')} km</b></span>
              {proy.diasEstimados != null && <span>≈ {proy.diasEstimados} días{proy.fechaEstimada ? ` (hasta ~${fmtFecha(proy.fechaEstimada)})` : ''} al ritmo actual ({proy.kmDia} km/día)</span>}
              {proy.diasEstimados == null && <span className="text-neutral-400">Sin ritmo de uso estimado (pocos registros de combustible)</span>}
            </div>

            {/* Costos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-md bg-neutral-50 border border-neutral-100 p-2.5">
                <p className="text-[10px] font-medium text-neutral-500 uppercase">Operativo</p>
                <p className="text-sm font-bold text-neutral-800">{proy.costos.operativo != null ? `$ ${proy.costos.operativo.toLocaleString('es-AR')}` : 'Sin datos'}</p>
                {proy.costos.costoPorKmUsado != null && <p className="text-[10px] text-neutral-400">${proy.costos.costoPorKmUsado}/km</p>}
              </div>
              <div className="rounded-md bg-neutral-50 border border-neutral-100 p-2.5">
                <p className="text-[10px] font-medium text-neutral-500 uppercase">Servicios</p>
                <p className="text-sm font-bold text-neutral-800">$ {proy.costos.servicios.toLocaleString('es-AR')}</p>
                <p className="text-[10px] text-neutral-400">{proy.servicios.reduce((a: number, s: any) => a + s.veces, 0)} ejecuciones</p>
              </div>
              <div className="rounded-md bg-neutral-50 border border-neutral-100 p-2.5">
                <p className="text-[10px] font-medium text-neutral-500 uppercase">Neumáticos</p>
                <p className="text-sm font-bold text-neutral-800">$ {proy.costos.neumaticos.toLocaleString('es-AR')}</p>
                <p className="text-[10px] text-neutral-400">{proy.neumaticos.filter((x: any) => x.reemplazoEnRango).length} reemplazos</p>
              </div>
              <div className="rounded-md bg-violet-50 border border-violet-200 p-2.5">
                <p className="text-[10px] font-medium text-violet-600 uppercase">Total estimado</p>
                <p className="text-sm font-bold text-violet-700">$ {proy.costos.total.toLocaleString('es-AR')}</p>
              </div>
            </div>

            {/* Programa de mantenimiento proyectado */}
            <div>
              <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Programa de mantenimiento — desgaste sin service</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {proy.componentes.map((c: any) => (
                  <div key={c.key} className="rounded-md border border-neutral-100 bg-neutral-50 p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-neutral-700">{c.label}</span>
                      <span className={`text-xs font-bold ${saludColor(c.saludProyectada)}`}>{c.saludActual}% → {c.saludProyectada}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                      <div className={`h-full rounded-full ${saludBar(c.saludProyectada)}`} style={{ width: `${c.saludProyectada}%` }} />
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-1">
                      cada {c.intervaloKm.toLocaleString('es-AR')} km · {c.veces > 0 ? <b className="text-violet-600">{c.veces} service(s)</b> : 'sin service'} en el rango
                      {c.conPlanCargado && ' · plan cargado'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Neumáticos proyectados */}
            {proy.neumaticos.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-1.5 flex items-center gap-1"><Disc className="h-3 w-3" /> Desgaste de neumáticos</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {proy.neumaticos.map((x: any) => (
                    <div key={x.codigo + x.posicion} className={`rounded-md border px-2.5 py-1.5 text-xs ${x.reemplazoEnRango ? 'border-red-200 bg-red-50' : 'border-neutral-100 bg-neutral-50'}`}>
                      <div className="flex justify-between">
                        <span className="font-medium text-neutral-800">{x.codigo}</span>
                        <span className={x.reemplazoEnRango ? 'text-red-600 font-semibold' : 'text-neutral-500'}>{x.bandaActual} → {x.bandaProyectada} mm</span>
                      </div>
                      <p className="text-[10px] text-neutral-400">{x.posicion}{x.kmRestantes != null ? ` · ${x.kmRestantes.toLocaleString('es-AR')} km rest.` : ''}{x.reemplazoEnRango ? ' · REEMPLAZAR' : ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            {proy.timeline.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">Timeline de eventos</p>
                <ul className="space-y-1">
                  {proy.timeline.map((t: any, i: number) => (
                    <li key={i} className="flex items-center gap-3 text-xs rounded-md border border-neutral-100 bg-neutral-50 px-3 py-1.5">
                      <span className="font-mono font-medium text-neutral-700 w-20 shrink-0">{t.km.toLocaleString('es-AR')} km</span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${t.tipo === 'SERVICIO' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{t.tipo === 'SERVICIO' ? 'Servicio' : 'Neumático'}</span>
                      <span className="flex-1 text-neutral-700">{t.detalle}</span>
                      {t.dias != null && <span className="text-neutral-400 shrink-0">~{t.dias}d</span>}
                      {t.costo != null && t.costo > 0 && <span className="text-neutral-500 shrink-0">$ {t.costo.toLocaleString('es-AR')}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {proy.docsEnRango.length > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                {proy.docsEnRango.length} documento(s) vencen dentro del horizonte: {proy.docsEnRango.map((d: any) => d.tipo).join(', ')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Alertas */}
      {twinData?.alertas?.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
          {twinData.alertas.map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> <span className="font-medium">{a.componente}:</span> {a.mensaje}
            </div>
          ))}
        </div>
      )}

      {/* Próximo servicio + última inspección */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5">
          <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] font-medium uppercase mb-1.5"><CalendarClock className="h-3.5 w-3.5" /> Próximo servicio</div>
          {proxServicio ? (
            <div className="text-xs text-neutral-700">
              <p className="font-semibold text-neutral-900">{proxServicio.plan}</p>
              {proxServicio.tipo === 'KM'
                ? <p>A los {proxServicio.proximoKm?.toLocaleString('es-AR')} km · faltan {proxServicio.kmRestantes?.toLocaleString('es-AR')} km</p>
                : <p>{fmtFecha(proxServicio.fecha)} · en {proxServicio.diasRestantes} días</p>}
            </div>
          ) : twinData?.prediccion?.proximoServicioKm != null ? (
            <p className="text-xs text-neutral-700">Estimado en {twinData.prediccion.proximoServicioKm.toLocaleString('es-AR')} km{twinData.prediccion.proximoServicioDias != null ? ` (~${twinData.prediccion.proximoServicioDias} días)` : ''}</p>
          ) : (
            <p className="text-xs text-neutral-400">Sin plan de mantenimiento activo</p>
          )}
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3.5">
          <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] font-medium uppercase mb-1.5"><ScanLine className="h-3.5 w-3.5" /> Última inspección QR</div>
          {ultimaInsp ? (
            <div className="text-xs text-neutral-700">
              <p className="font-semibold text-neutral-900">{fmtFecha(ultimaInsp.createdAt)}</p>
              <p>{ultimaInsp.hallazgosCount > 0 ? `${ultimaInsp.hallazgosCount} hallazgo(s)` : 'Sin hallazgos'}{ultimaInsp.puntaje != null ? ` · puntaje ${ultimaInsp.puntaje}` : ''}</p>
            </div>
          ) : (
            <p className="text-xs text-neutral-400">Sin inspecciones registradas</p>
          )}
        </div>
      </div>

      {/* OTs recientes */}
      {Array.isArray(workOrders) && (
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800 flex items-center justify-between">
            <span>Órdenes de trabajo recientes</span>
            <Link href="/flota-360/ordenes" className="text-[11px] font-normal text-blue-600 hover:underline">Ver todas</Link>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-500 uppercase">
              <tr>
                <th className="text-left font-medium px-3 py-2">Código</th>
                <th className="text-left font-medium px-3 py-2">Título</th>
                <th className="text-left font-medium px-3 py-2">Estado</th>
                <th className="text-left font-medium px-3 py-2">Programada</th>
                <th className="text-left font-medium px-3 py-2">Costo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {workOrders.slice(0, 10).map((o: any) => (
                <tr key={o.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 font-medium text-neutral-800">{o.code}</td>
                  <td className="px-3 py-2 text-neutral-600">{o.title}</td>
                  <td className="px-3 py-2 text-neutral-600">{ESTADO_OT_LABEL[o.status] || o.status}</td>
                  <td className="px-3 py-2 text-neutral-600">{fmtFecha(o.scheduledDate)}</td>
                  <td className="px-3 py-2 text-neutral-600">${(o.totalCost || 0).toLocaleString('es-AR')}</td>
                </tr>
              ))}
              {workOrders.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-4 text-center text-neutral-400">Sin órdenes registradas</td></tr>
              )}
            </tbody>
          </table>
          {/* Análisis de reparaciones recurrentes por componente */}
          <RecurrenciasPanel vehiculoId={v.id} workOrders={workOrders} />
        </div>
      )}

      {/* Neumáticos: diagrama de ejes + montar/desmontar/presión/medición */}
      <NeumaticosPanel vehiculoId={v.id} odometro={v.currentOdometer ?? null} />

      {/* Facturas y multas de la unidad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FacturasPanel vehiculoId={v.id} />
        <MultasPanel vehiculoId={v.id} conductores={conductores} />
      </div>

      {/* Historial de mantenimiento */}
      {Array.isArray(v.historialMantenimiento) && v.historialMantenimiento.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
            <History className="h-3.5 w-3.5 text-blue-600" /> Historial de mantenimiento
          </div>
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-500 uppercase">
              <tr>
                <th className="text-left font-medium px-3 py-2">Fecha</th>
                <th className="text-left font-medium px-3 py-2">Tipo</th>
                <th className="text-left font-medium px-3 py-2">Descripción</th>
                <th className="text-left font-medium px-3 py-2">Odómetro</th>
                <th className="text-left font-medium px-3 py-2">Costo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {v.historialMantenimiento.map((h: any) => (
                <tr key={h.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 text-neutral-600">{fmtFecha(h.fecha)}</td>
                  <td className="px-3 py-2 text-neutral-600">{h.tipo}</td>
                  <td className="px-3 py-2 text-neutral-700">{h.descripcion}</td>
                  <td className="px-3 py-2 text-neutral-600">{h.odometro != null ? `${Math.round(h.odometro).toLocaleString('es-AR')} km` : '—'}</td>
                  <td className="px-3 py-2 text-neutral-600">${(h.costo || 0).toLocaleString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal edición de vehículo */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Editar vehículo</h2>
              <button onClick={() => setShowEdit(false)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {editError && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{editError}</p>}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Dominio</label>
                  <input value={editForm.dominio} onChange={(e) => setEditForm({ ...editForm, dominio: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Tipo</label>
                  <select value={editForm.tipo} onChange={(e) => setEditForm({ ...editForm, tipo: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="CAMION">Camión</option>
                    <option value="TRACTOR">Tractor</option>
                    <option value="SEMI">Semi</option>
                    <option value="UTILITARIO">Utilitario</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Marca</label>
                  <input value={editForm.marca} onChange={(e) => setEditForm({ ...editForm, marca: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Modelo</label>
                  <input value={editForm.modelo} onChange={(e) => setEditForm({ ...editForm, modelo: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Año</label>
                  <input type="number" value={editForm.anio} onChange={(e) => setEditForm({ ...editForm, anio: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Color</label>
                  <input value={editForm.color} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Odómetro (km)</label>
                  <input type="number" min={0} value={editForm.currentOdometer} onChange={(e) => setEditForm({ ...editForm, currentOdometer: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Chasis N°</label>
                  <input value={editForm.chasis} onChange={(e) => setEditForm({ ...editForm, chasis: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Motor N°</label>
                  <input value={editForm.motor} onChange={(e) => setEditForm({ ...editForm, motor: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Cant. ejes</label>
                  <input type="number" min={1} max={10} value={editForm.cantEjes} onChange={(e) => setEditForm({ ...editForm, cantEjes: e.target.value })} placeholder="2" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Config. ejes</label>
                  <input value={editForm.configEjes} onChange={(e) => setEditForm({ ...editForm, configEjes: e.target.value })} placeholder="4x2, 6x4…" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Estado</label>
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="ACTIVO">Activo</option>
                    <option value="EN_TALLER">En taller</option>
                    <option value="INACTIVO">Inactivo</option>
                    <option value="BAJA">Baja</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Fecha de compra</label>
                  <input type="date" value={editForm.fechaCompra} onChange={(e) => setEditForm({ ...editForm, fechaCompra: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Valor de adquisición ($)</label>
                <input type="number" min={0} step="0.01" value={editForm.valorAdquisicion} onChange={(e) => setEditForm({ ...editForm, valorAdquisicion: e.target.value })} placeholder="Costo de compra del vehículo" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Conductor asignado</label>
                <select value={editForm.conductorId} onChange={(e) => setEditForm({ ...editForm, conductorId: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                  <option value="">Sin asignar</option>
                  {conductores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Notas</label>
                <input value={editForm.notas} onChange={(e) => setEditForm({ ...editForm, notas: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setShowEdit(false)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Cancelar</button>
              <button onClick={guardarEdicion} disabled={saving} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {showCarga && (
        <CargaCombustible
          vehiculos={[{ id: v.id, dominio: v.dominio, tipo: v.tipo, currentOdometer: v.currentOdometer }]}
          vehiculoId={v.id}
          onClose={() => setShowCarga(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
