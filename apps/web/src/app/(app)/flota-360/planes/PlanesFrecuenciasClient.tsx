'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { VehicleArt } from '../_components/FleetVisual';
import { apiFetch } from '@/lib/api';
import {
  Plus, X, Wrench, Zap, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, ScanLine, CalendarClock,
  Pencil, PackageSearch, Users2, ExternalLink, RotateCcw, History, Filter, Trash2,
} from 'lucide-react';

type RepuestoRegla = { sparePartId: string; cantidad: number; nombre: string; code: string | null; disponible: number | null; currentStock: number | null };
type ReglaAplicacion = { assetId: string; generatedPlanId: string | null; isActive: boolean; frecuenciaKmOverride: number | null; frecuenciaDiasOverride: number | null; vehiculo: { dominio: string; tipo: string } | null };
type Rule = {
  id: string; nombre: string; categoria: string; tipoActivoAplicable: string;
  frecuenciaKm: number | null; frecuenciaDias: number | null; kmAnticipacion: number | null; diasAnticipacion: number | null;
  criticidad: string; duracionEstimada: number | null; accionVencimiento: string;
  repuestosRequeridos: RepuestoRegla[];
  aplicaciones: ReglaAplicacion[];
};

type Alerta = {
  id: string; planId: string; assetId: string;
  activo: { id: string; dominio: string; tipo: string; status?: string } | null; componente: string;
  kmActual: number | null; proximoServicioKm: number | null; kmRestantes: number | null;
  diasRestantes: number | null; fechaEstimada: string | null; criticidad: string;
  estado: 'VENCIDO' | 'URGENTE' | 'PROXIMO';
};

type EventoCelda = { tipo: 'OT' | 'QR' | 'PLAN'; id: string; codigo?: string; titulo?: string; estado: string; prioridad?: string; origen?: string | null; hallazgos?: number; criticos?: number };

type PlanActivo = {
  id: string; plan: string; codigo: string;
  activo: { id: string; dominio: string; tipo: string; status: string } | null;
  componente: string | null; frecuencia: string;
  ultimaEjecucion: string | null; proximaEjecucion: string | null;
  proximoKm: number | null; kmRestantes: number | null; diasRestantes: number | null;
  estado: 'VENCIDO' | 'URGENTE' | 'PROXIMO' | 'OK'; estadoPlan: string;
  tecnicoSugerido: string | null; accionVencimiento: string | null; origen: string;
};
type Celda = { eventos: EventoCelda[] } | null;
type Columna = { index: number; label: string; desde: string; hasta: string };
type Fila = { vehiculoId: string; dominio: string; tipo: string; status: string; odometro: number | null; hasPlan: boolean; celdas: Celda[] };

type RepuestoInv = {
  id: string; code: string; name: string; category: string | null;
  currentStock: number; minStock: number; reservado: number; disponible: number; estado: 'OK' | 'BAJO' | 'CRITICO';
  proximasOTs: { code: string; title: string; scheduledDate: string | null }[];
  planesQueLoRequieren: string[];
};

type CeldaTaller = { fecha: string; horasAsignadas: number; capacidad: number; sobreasignado: boolean; ots: { id: string; codigo: string; titulo: string }[] };
type FilaTaller = { tecnicoId: string; nombre: string; especializacion: string | null; celdas: CeldaTaller[] };

const CRIT_COLOR: Record<string, string> = { BAJA: 'bg-neutral-100 text-neutral-600', MEDIA: 'bg-amber-50 text-amber-700', ALTA: 'bg-red-50 text-red-700' };
const ALERTA_COLOR: Record<string, string> = { VENCIDO: 'bg-red-50 text-red-700', URGENTE: 'bg-amber-50 text-amber-700', PROXIMO: 'bg-blue-50 text-blue-700' };
const ALERTA_LABEL: Record<string, string> = { VENCIDO: 'Vencido', URGENTE: 'Urgente', PROXIMO: 'Próximo' };
const REPUESTO_COLOR: Record<string, string> = { OK: 'bg-green-50 text-green-700', BAJO: 'bg-amber-50 text-amber-700', CRITICO: 'bg-red-50 text-red-700' };

function fmtFecha(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}
function fmtFechaInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

const FORM_INICIAL = {
  nombre: '', categoria: 'GENERAL', tipoActivoAplicable: 'TODOS',
  frecuenciaKm: '', frecuenciaDias: '', kmAnticipacion: '', diasAnticipacion: '',
  criticidad: 'MEDIA', duracionEstimada: '', accionVencimiento: 'ALERTA',
  repuestos: [] as { sparePartId: string; cantidad: number }[],
};

export default function PlanesFrecuenciasClient() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [columnas, setColumnas] = useState<Columna[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [repuestos, setRepuestos] = useState<RepuestoInv[]>([]);
  const [tallerDias, setTallerDias] = useState<string[]>([]);
  const [tallerFilas, setTallerFilas] = useState<FilaTaller[]>([]);
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [tiposDisponibles, setTiposDisponibles] = useState<string[]>([]);
  const [planesActivos, setPlanesActivos] = useState<PlanActivo[]>([]);
  const [tecnicos, setTecnicos] = useState<{ id: string; name: string }[]>([]);
  const [catalogoRepuestos, setCatalogoRepuestos] = useState<{ id: string; code: string; name: string; currentStock: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros / cabecera
  const [periodo, setPeriodo] = useState<'SEMANA' | 'MES' | 'TRIMESTRE'>('MES');
  const [ancla, setAncla] = useState<Date>(new Date());
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroVehiculo, setFiltroVehiculo] = useState('');
  useEffect(() => { setFiltroVehiculo(new URLSearchParams(window.location.search).get('vehiculoId') || ''); }, []);
  const [soloAlertas, setSoloAlertas] = useState(false);

  // Modales
  const [showModal, setShowModal] = useState(false);
  const [editRule, setEditRule] = useState<Rule | null>(null);
  const [applyRule, setApplyRule] = useState<Rule | null>(null);
  const [applyAssetVehs, setApplyAssetVehs] = useState<string[]>([]);
  const [applyOverrideKm, setApplyOverrideKm] = useState('');
  const [applyOverrideDias, setApplyOverrideDias] = useState('');
  const [applyTecnico, setApplyTecnico] = useState('');
  const [applyAccion, setApplyAccion] = useState('');
  const [applyKmBase, setApplyKmBase] = useState('');
  const [applyProxima, setApplyProxima] = useState('');
  const [celdaDetalle, setCeldaDetalle] = useState<{ fila: Fila; col: Columna; eventos: EventoCelda[] } | null>(null);
  const [moverFecha, setMoverFecha] = useState('');
  const [showNuevoPlan, setShowNuevoPlan] = useState(false);
  const [nuevoPlanForm, setNuevoPlanForm] = useState<any>({ title: '', assetVehId: '', frequencyUnit: 'DAYS', frequencyValue: '30', triggerKm: '', nextExecutionDate: '' });
  const [ajusteRepuesto, setAjusteRepuesto] = useState<RepuestoInv | null>(null);
  const [ajusteDelta, setAjusteDelta] = useState('');
  const [ajusteMotivo, setAjusteMotivo] = useState('');
  const [historialRepuesto, setHistorialRepuesto] = useState<RepuestoInv | null>(null);
  const [historialMovs, setHistorialMovs] = useState<any[]>([]);

  const [form, setForm] = useState<any>(FORM_INICIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('periodo', periodo);
      params.set('desde', fmtFechaInput(ancla));
      if (filtroTipo) params.set('tipo', filtroTipo);
      if (filtroEstado) params.set('estado', filtroEstado);
      if (filtroVehiculo) params.set('vehiculoId', filtroVehiculo);
      if (soloAlertas) params.set('soloAlertas', 'true');

      const alertaParams = new URLSearchParams();
      if (filtroTipo) alertaParams.set('tipo', filtroTipo);

      const planesParams = new URLSearchParams();
      if (filtroTipo) planesParams.set('tipo', filtroTipo);
      if (filtroEstado) planesParams.set('estado', filtroEstado);
      if (filtroVehiculo) planesParams.set('vehiculoId', filtroVehiculo);

      const [r, a, prog, inv, v, taller, filtros, planes, tecs, spareCat] = await Promise.all([
        apiFetch<{ rules: Rule[] }>('/fleet-ops/component-rules'),
        apiFetch<{ alertas: Alerta[] }>(`/fleet-ops/alertas-servicio?${alertaParams.toString()}`),
        apiFetch<{ columnas: Columna[]; filas: Fila[] }>(`/fleet-ops/programa-mantenimiento?${params.toString()}`),
        apiFetch<{ repuestos: RepuestoInv[] }>('/fleet-ops/repuestos-inventario'),
        apiFetch<{ vehiculos: any[] }>('/flota/vehiculos'),
        apiFetch<{ dias: string[]; filas: FilaTaller[] }>('/fleet-ops/carga-taller?dias=7'),
        apiFetch<{ tipos: string[] }>('/fleet-ops/filtros'),
        apiFetch<{ planes: PlanActivo[] }>(`/fleet-ops/planes-activos?${planesParams.toString()}`),
        apiFetch<{ technicians: any[] }>('/maintenance/technicians?scope=fleet').catch(() => ({ technicians: [] })),
        apiFetch<{ parts: any[] }>('/maintenance/spare-parts').catch(() => ({ parts: [] })),
      ]);
      setRules(r.rules || []);
      setAlertas(a.alertas || []);
      setColumnas(prog.columnas || []);
      setFilas(prog.filas || []);
      setRepuestos(inv.repuestos || []);
      setVehiculos(v.vehiculos || []);
      setTallerDias(taller.dias || []);
      setTallerFilas(taller.filas || []);
      setTiposDisponibles(filtros.tipos || []);
      setPlanesActivos(planes.planes || []);
      setTecnicos((tecs.technicians || []).map((t: any) => ({ id: t.id, name: t.name })));
      setCatalogoRepuestos((spareCat.parts || []).map((p: any) => ({ id: p.id, code: p.code, name: p.name, currentStock: p.currentStock })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [periodo, ancla, filtroTipo, filtroEstado, filtroVehiculo, soloAlertas]);

  const irAnterior = () => {
    const d = new Date(ancla);
    if (periodo === 'SEMANA') d.setDate(d.getDate() - 7);
    else if (periodo === 'TRIMESTRE') d.setMonth(d.getMonth() - 3);
    else d.setMonth(d.getMonth() - 1);
    setAncla(d);
  };
  const irSiguiente = () => {
    const d = new Date(ancla);
    if (periodo === 'SEMANA') d.setDate(d.getDate() + 7);
    else if (periodo === 'TRIMESTRE') d.setMonth(d.getMonth() + 3);
    else d.setMonth(d.getMonth() + 1);
    setAncla(d);
  };
  const irHoy = () => setAncla(new Date());

  const periodoLabel = useMemo(() => {
    if (periodo === 'SEMANA') return `Semana del ${ancla.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}`;
    if (periodo === 'TRIMESTRE') return `Q${Math.floor(ancla.getMonth() / 3) + 1} ${ancla.getFullYear()}`;
    return ancla.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  }, [periodo, ancla]);

  const crear = async () => {
    if (!form.nombre) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/fleet-ops/component-rules', {
        method: 'POST',
        json: {
          ...form,
          frecuenciaKm: form.frecuenciaKm ? Number(form.frecuenciaKm) : undefined,
          frecuenciaDias: form.frecuenciaDias ? Number(form.frecuenciaDias) : undefined,
          kmAnticipacion: form.kmAnticipacion ? Number(form.kmAnticipacion) : undefined,
          diasAnticipacion: form.diasAnticipacion ? Number(form.diasAnticipacion) : undefined,
          duracionEstimada: form.duracionEstimada ? Number(form.duracionEstimada) : undefined,
          repuestos: (form.repuestos || []).map((rp: any) => ({ sparePartId: rp.sparePartId, cantidad: Number(rp.cantidad) || 1 })),
        },
      });
      setShowModal(false);
      setForm(FORM_INICIAL);
      load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear la regla');
    } finally {
      setSaving(false);
    }
  };

  const abrirEditar = (r: Rule) => {
    setEditRule(r);
    setForm({
      nombre: r.nombre, categoria: r.categoria, tipoActivoAplicable: r.tipoActivoAplicable,
      frecuenciaKm: r.frecuenciaKm ?? '', frecuenciaDias: r.frecuenciaDias ?? '',
      kmAnticipacion: r.kmAnticipacion ?? '', diasAnticipacion: r.diasAnticipacion ?? '',
      criticidad: r.criticidad, duracionEstimada: r.duracionEstimada ?? '', accionVencimiento: r.accionVencimiento,
      repuestos: (r.repuestosRequeridos || []).map((rp) => ({ sparePartId: rp.sparePartId, cantidad: rp.cantidad })),
    });
  };

  const guardarEdicion = async () => {
    if (!editRule) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/fleet-ops/component-rules/${editRule.id}`, {
        method: 'PUT',
        json: {
          ...form,
          frecuenciaKm: form.frecuenciaKm ? Number(form.frecuenciaKm) : undefined,
          frecuenciaDias: form.frecuenciaDias ? Number(form.frecuenciaDias) : undefined,
          kmAnticipacion: form.kmAnticipacion ? Number(form.kmAnticipacion) : undefined,
          diasAnticipacion: form.diasAnticipacion ? Number(form.diasAnticipacion) : undefined,
          duracionEstimada: form.duracionEstimada ? Number(form.duracionEstimada) : undefined,
          repuestos: (form.repuestos || []).map((rp: any) => ({ sparePartId: rp.sparePartId, cantidad: Number(rp.cantidad) || 1 })),
        },
      });
      setEditRule(null);
      setForm(FORM_INICIAL);
      load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo actualizar la regla');
    } finally {
      setSaving(false);
    }
  };

  const eliminarRegla = async (r: Rule) => {
    if (!confirm(`¿Eliminar el componente "${r.nombre}"? Los planes ya generados en las unidades no se borran.`)) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/fleet-ops/component-rules/${r.id}`, { method: 'DELETE' });
      load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo eliminar el componente');
    } finally {
      setSaving(false);
    }
  };

  const toggleApplyVeh = (id: string) => {
    setApplyAssetVehs((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const aplicar = async () => {
    if (!applyRule || applyAssetVehs.length === 0) { setError('Seleccioná al menos un activo'); return; }
    const assetIds = applyAssetVehs
      .map((vid) => vehiculos.find((v) => v.id === vid)?.maintenanceAssetId)
      .filter(Boolean);
    if (assetIds.length === 0) { setError('Los activos seleccionados no tienen un activo de mantenimiento vinculado'); return; }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/fleet-ops/component-rules/${applyRule.id}/aplicar`, {
        method: 'POST',
        json: {
          assetIds,
          frecuenciaKmOverride: applyOverrideKm ? Number(applyOverrideKm) : undefined,
          frecuenciaDiasOverride: applyOverrideDias ? Number(applyOverrideDias) : undefined,
          tecnicoSugeridoId: applyTecnico || undefined,
          accionVencimientoOverride: applyAccion || undefined,
          kmBase: applyKmBase ? Number(applyKmBase) : undefined,
          proximaEjecucion: applyProxima || undefined,
        },
      });
      setApplyRule(null);
      setApplyAssetVehs([]);
      setApplyOverrideKm(''); setApplyOverrideDias('');
      setApplyTecnico(''); setApplyAccion(''); setApplyKmBase(''); setApplyProxima('');
      load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo aplicar la regla');
    } finally {
      setSaving(false);
    }
  };

  const crearPlanManual = async () => {
    const veh = vehiculos.find((v) => v.id === nuevoPlanForm.assetVehId);
    if (!nuevoPlanForm.title || !veh?.maintenanceAssetId) { setError('Título y activo son obligatorios'); return; }
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/maintenance/plans', {
        method: 'POST',
        json: {
          title: nuevoPlanForm.title,
          assetId: veh.maintenanceAssetId,
          frequencyUnit: nuevoPlanForm.frequencyUnit,
          frequencyValue: Number(nuevoPlanForm.frequencyValue) || 30,
          triggerKm: nuevoPlanForm.triggerKm ? Number(nuevoPlanForm.triggerKm) : undefined,
          nextExecutionDate: nuevoPlanForm.nextExecutionDate || undefined,
        },
      });
      setShowNuevoPlan(false);
      setNuevoPlanForm({ title: '', assetVehId: '', frequencyUnit: 'DAYS', frequencyValue: '30', triggerKm: '', nextExecutionDate: '' });
      load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear el plan');
    } finally {
      setSaving(false);
    }
  };

  const moverOT = async (workOrderId: string) => {
    if (!moverFecha) return;
    setSaving(true);
    try {
      await apiFetch('/fleet-ops/programa-mantenimiento/mover-ot', { method: 'PATCH', json: { workOrderId, nuevaFecha: moverFecha } });
      setCeldaDetalle(null);
      setMoverFecha('');
      load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo mover la orden');
    } finally {
      setSaving(false);
    }
  };

  const abrirAjuste = (p: RepuestoInv) => { setAjusteRepuesto(p); setAjusteDelta(''); setAjusteMotivo(''); };
  const guardarAjuste = async () => {
    if (!ajusteRepuesto || !ajusteDelta || !ajusteMotivo || ajusteMotivo.trim().length < 3) { setError('Ingresá cantidad y motivo (mínimo 3 caracteres)'); return; }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/fleet-ops/repuestos-inventario/${ajusteRepuesto.id}/ajustar`, { method: 'POST', json: { delta: Number(ajusteDelta), motivo: ajusteMotivo } });
      setAjusteRepuesto(null);
      load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo ajustar el stock');
    } finally {
      setSaving(false);
    }
  };

  const abrirHistorial = async (p: RepuestoInv) => {
    setHistorialRepuesto(p);
    const res = await apiFetch<{ movimientos: any[] }>(`/fleet-ops/repuestos-inventario/${p.id}/movimientos`);
    setHistorialMovs(res.movimientos || []);
  };

  if (loading && filas.length === 0 && rules.length === 0) return <div className="p-6 text-xs text-neutral-500">Cargando planes y frecuencias…</div>;

  const unidadesConPlan = filas.filter((f) => f.hasPlan).length;
  const alertasVencidas = alertas.filter((a) => a.estado === 'VENCIDO').length;
  const alertasUrgentes = alertas.filter((a) => a.estado === 'URGENTE').length;
  const repuestosCriticos = repuestos.filter((r) => r.estado === 'CRITICO' || r.estado === 'BAJO').length;

  const ReglaForm = () => (
    <div className="p-4 space-y-3">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Nombre *</label>
        <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Aceite de motor" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Sistema / categoría</label>
          <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
            {['MOTOR', 'FRENOS', 'NEUMATICOS', 'SUSPENSION', 'LUBRICACION', 'DOCUMENTACION', 'GENERAL'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Tipo de activo aplicable</label>
          <select value={form.tipoActivoAplicable} onChange={(e) => setForm({ ...form, tipoActivoAplicable: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
            {['TODOS', 'TRACTOR', 'CAMION', 'UTILITARIO', 'SEMI', 'CONJUNTO'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Regla por kilometraje</label>
          <input type="number" value={form.frecuenciaKm} onChange={(e) => setForm({ ...form, frecuenciaKm: e.target.value })} placeholder="Ej: 30000" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Regla por tiempo (días)</label>
          <input type="number" value={form.frecuenciaDias} onChange={(e) => setForm({ ...form, frecuenciaDias: e.target.value })} placeholder="Ej: 365" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Alerta preventiva (km antes)</label>
          <input type="number" value={form.kmAnticipacion} onChange={(e) => setForm({ ...form, kmAnticipacion: e.target.value })} placeholder="Ej: 3000" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Alerta preventiva (días antes)</label>
          <input type="number" value={form.diasAnticipacion} onChange={(e) => setForm({ ...form, diasAnticipacion: e.target.value })} placeholder="Ej: 30" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Criticidad</label>
          <select value={form.criticidad} onChange={(e) => setForm({ ...form, criticidad: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
            <option value="BAJA">Baja</option><option value="MEDIA">Media</option><option value="ALTA">Alta</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Horas estimadas</label>
          <input type="number" value={form.duracionEstimada} onChange={(e) => setForm({ ...form, duracionEstimada: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Repuestos que consume</label>
        <div className="space-y-1.5">
          {(form.repuestos || []).map((rp: any, i: number) => {
            const parte = catalogoRepuestos.find((p) => p.id === rp.sparePartId);
            return (
              <div key={rp.sparePartId} className="flex items-center gap-2">
                <span className="flex-1 truncate text-xs text-neutral-700">{parte ? `${parte.code} · ${parte.name}` : rp.sparePartId}</span>
                <input type="number" min={1} value={rp.cantidad} onChange={(e) => setForm({ ...form, repuestos: form.repuestos.map((x: any, j: number) => j === i ? { ...x, cantidad: Number(e.target.value) } : x) })} className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-xs" />
                <button type="button" onClick={() => setForm({ ...form, repuestos: form.repuestos.filter((_: any, j: number) => j !== i) })} className="text-neutral-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
              </div>
            );
          })}
          <select value="" onChange={(e) => { const pid = e.target.value; if (pid) setForm({ ...form, repuestos: [...(form.repuestos || []), { sparePartId: pid, cantidad: 1 }] }); }} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
            <option value="">+ Agregar repuesto…</option>
            {catalogoRepuestos.filter((p) => !(form.repuestos || []).some((rp: any) => rp.sparePartId === p.id)).map((p) => (
              <option key={p.id} value={p.id}>{p.code} · {p.name} (stock {p.currentStock})</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Acción ante vencimiento</label>
        <select value={form.accionVencimiento} onChange={(e) => setForm({ ...form, accionVencimiento: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
          <option value="ALERTA">Solo alerta</option>
          <option value="SUGERENCIA_OT">Sugerencia de OT</option>
          <option value="GENERAR_OT">Generar OT automáticamente</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="fleet-planning space-y-3">
      {/* Cabecera */}
      <div className="rounded-lg border border-neutral-200 bg-white p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-[#0d1b3d]">Planes y frecuencias</h1>
            <p className="text-xs text-neutral-500">Cockpit operativo de planificación de mantenimiento de flota</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowNuevoPlan(true)} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 shrink-0">
              <CalendarClock className="h-3.5 w-3.5" /> Nuevo plan
            </button>
            <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 shrink-0">
              <Plus className="h-3.5 w-3.5" /> Nuevo componente
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap border-t border-neutral-100 pt-2.5">
          <div className="flex items-center rounded-md border border-neutral-300 overflow-hidden">
            {(['SEMANA', 'MES', 'TRIMESTRE'] as const).map((p) => (
              <button key={p} onClick={() => setPeriodo(p)} className={`px-2.5 py-1 text-[11px] font-medium ${periodo === p ? 'bg-blue-600 text-white' : 'bg-white text-neutral-600 hover:bg-neutral-50'}`}>
                {p === 'SEMANA' ? 'Semana' : p === 'MES' ? 'Mes' : 'Trimestre'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={irAnterior} className="rounded-md border border-neutral-300 p-1 hover:bg-neutral-50"><ChevronLeft className="h-3.5 w-3.5" /></button>
            <button onClick={irHoy} className="rounded-md border border-neutral-300 px-2 py-1 text-[11px] font-medium hover:bg-neutral-50">Hoy</button>
            <button onClick={irSiguiente} className="rounded-md border border-neutral-300 p-1 hover:bg-neutral-50"><ChevronRight className="h-3.5 w-3.5" /></button>
            <span className="text-xs font-medium text-neutral-700 ml-1 capitalize">{periodoLabel}</span>
          </div>
          <div className="h-4 w-px bg-neutral-200 mx-1" />
          <Filter className="h-3.5 w-3.5 text-neutral-400" />
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="rounded-md border border-neutral-300 px-2 py-1 text-[11px]">
            <option value="">Todos los tipos</option>
            {tiposDisponibles.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="rounded-md border border-neutral-300 px-2 py-1 text-[11px]">
            <option value="">Todos los estados</option>
            <option value="ACTIVO">Activo</option>
            <option value="EN_TALLER">En taller</option>
            <option value="INACTIVO">Inactivo</option>
            <option value="BAJA">Baja</option>
          </select>
          <select value={filtroVehiculo} onChange={(e) => setFiltroVehiculo(e.target.value)} className="rounded-md border border-neutral-300 px-2 py-1 text-[11px] max-w-[140px]">
            <option value="">Todas las unidades</option>
            {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.dominio}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-[11px] text-neutral-600 cursor-pointer">
            <input type="checkbox" checked={soloAlertas} onChange={(e) => setSoloAlertas(e.target.checked)} className="rounded" />
            Solo alertas
          </label>
        </div>
      </div>

      {/* Contexto visual del período: mantiene visible frecuencia, riesgo y cobertura de la flota. */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-xl border border-blue-100 bg-blue-50/45 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">Cobertura de planes</p>
          <p className="mt-1 text-xl font-bold text-neutral-900">{unidadesConPlan}<span className="text-xs font-medium text-neutral-400"> / {filas.length}</span></p>
          <p className="mt-1 text-[11px] text-neutral-500">unidades con frecuencia configurada</p>
        </div>
        <div className={`rounded-xl border p-3 ${alertasVencidas > 0 ? 'border-red-200 bg-red-50/60' : 'border-emerald-100 bg-emerald-50/50'}`}>
          <p className={`text-[10px] font-semibold uppercase tracking-wide ${alertasVencidas > 0 ? 'text-red-700' : 'text-emerald-700'}`}>Servicios vencidos</p>
          <p className="mt-1 text-xl font-bold text-neutral-900">{alertasVencidas}</p>
          <p className="mt-1 text-[11px] text-neutral-500">requieren definición de OT</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/55 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Próximos a vencer</p>
          <p className="mt-1 text-xl font-bold text-neutral-900">{alertasUrgentes}</p>
          <p className="mt-1 text-[11px] text-neutral-500">dentro de la ventana preventiva</p>
        </div>
        <div className={`rounded-xl border p-3 ${repuestosCriticos > 0 ? 'border-violet-100 bg-violet-50/55' : 'border-neutral-200 bg-white'}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">Repuestos a revisar</p>
          <p className="mt-1 text-xl font-bold text-neutral-900">{repuestosCriticos}</p>
          <p className="mt-1 text-[11px] text-neutral-500">stock bajo o reservado sin cobertura</p>
        </div>
      </div>

      {/* Fila 1: Catálogo + Próximas alertas */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-3">
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800 flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" /> Catálogo de componentes</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-2.5 py-1.5">Componente</th>
                  <th className="text-left font-medium px-2.5 py-1.5">Sistema</th>
                  <th className="text-left font-medium px-2.5 py-1.5">Aplica a</th>
                  <th className="text-left font-medium px-2.5 py-1.5">Regla km / tiempo</th>
                  <th className="text-left font-medium px-2.5 py-1.5">Alerta prev.</th>
                  <th className="text-left font-medium px-2.5 py-1.5">Criticidad</th>
                  <th className="text-left font-medium px-2.5 py-1.5">Hs. est.</th>
                  <th className="text-left font-medium px-2.5 py-1.5">Repuestos (disp./reserv.)</th>
                  <th className="text-left font-medium px-2.5 py-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rules.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-neutral-400">Sin componentes definidos. Creá el primero con "Nuevo componente".</td></tr>}
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50 align-top">
                    <td className="px-2.5 py-2 font-medium text-neutral-800">{r.nombre}<div className="text-[11px] text-neutral-400">{r.aplicaciones.length} activo(s) aplicado(s)</div></td>
                    <td className="px-2.5 py-2 text-neutral-600">{r.categoria}</td>
                    <td className="px-2.5 py-2 text-neutral-600">{r.tipoActivoAplicable}</td>
                    <td className="px-2.5 py-2 text-neutral-600">
                      {r.frecuenciaKm ? `${r.frecuenciaKm.toLocaleString('es-AR')} km` : ''}
                      {r.frecuenciaKm && r.frecuenciaDias ? ' o ' : ''}
                      {r.frecuenciaDias ? `${r.frecuenciaDias} días` : ''}
                      {!r.frecuenciaKm && !r.frecuenciaDias && '—'}
                    </td>
                    <td className="px-2.5 py-2 text-neutral-500 text-[11px]">
                      {r.kmAnticipacion ? `${r.kmAnticipacion} km antes` : ''}
                      {r.kmAnticipacion && r.diasAnticipacion ? ' / ' : ''}
                      {r.diasAnticipacion ? `${r.diasAnticipacion}d antes` : ''}
                      {!r.kmAnticipacion && !r.diasAnticipacion && '—'}
                    </td>
                    <td className="px-2.5 py-2"><span className={`inline-block rounded px-1.5 py-0.5 font-medium ${CRIT_COLOR[r.criticidad]}`}>{r.criticidad}</span></td>
                    <td className="px-2.5 py-2 text-neutral-600">{r.duracionEstimada ? `${r.duracionEstimada}h` : '—'}</td>
                    <td className="px-2.5 py-2 text-neutral-600">
                      {r.repuestosRequeridos.length === 0 ? '—' : r.repuestosRequeridos.map((rp) => (
                        <div key={rp.sparePartId} className="text-[11px]">
                          {rp.nombre} ×{rp.cantidad} <span className={rp.disponible != null && rp.disponible <= 0 ? 'text-red-600 font-medium' : 'text-neutral-400'}>({rp.disponible ?? '—'} disp.)</span>
                        </div>
                      ))}
                    </td>
                    <td className="px-2.5 py-2 text-right whitespace-nowrap">
                      <button onClick={() => { setApplyRule(r); setApplyAssetVehs(vehiculos.filter((v) => v.maintenanceAssetId && (r.tipoActivoAplicable === 'TODOS' || v.tipo === r.tipoActivoAplicable)).map((v) => v.id)); }} className="inline-flex items-center gap-1 text-blue-600 hover:underline mr-2"><Zap className="h-3 w-3" /> Aplicar a activos</button>
                      <button onClick={() => abrirEditar(r)} className="inline-flex items-center gap-1 text-neutral-500 hover:underline mr-2"><Pencil className="h-3 w-3" /> Editar</button>
                      <button onClick={() => eliminarRegla(r)} className="inline-flex items-center gap-1 text-red-500 hover:underline"><Trash2 className="h-3 w-3" /> Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Próximas alertas</div>
          <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wide sticky top-0">
                <tr>
                  <th className="text-left font-medium px-2.5 py-1.5">Activo</th>
                  <th className="text-left font-medium px-2.5 py-1.5">Componente</th>
                  <th className="text-left font-medium px-2.5 py-1.5">Faltan</th>
                  <th className="text-left font-medium px-2.5 py-1.5">Fecha est.</th>
                  <th className="text-left font-medium px-2.5 py-1.5">Crit.</th>
                  <th className="text-left font-medium px-2.5 py-1.5">Estado</th>
                  <th className="text-left font-medium px-2.5 py-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {alertas.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-400">Sin alertas próximas</td></tr>}
                {alertas.map((a) => (
                  <tr key={a.id} className="hover:bg-neutral-50">
                    <td className="px-2.5 py-2 font-medium text-neutral-800">{a.activo?.dominio || '—'}<div className="text-[11px] text-neutral-400">{a.activo?.tipo}</div></td>
                    <td className="px-2.5 py-2 text-neutral-600">{a.componente}</td>
                    <td className="px-2.5 py-2 text-neutral-600">
                      {a.kmRestantes != null ? `${a.kmRestantes.toLocaleString('es-AR')} km` : ''}
                      {a.kmRestantes != null && a.diasRestantes != null ? ' / ' : ''}
                      {a.diasRestantes != null ? `${a.diasRestantes}d` : ''}
                      {a.kmRestantes == null && a.diasRestantes == null && '—'}
                    </td>
                    <td className="px-2.5 py-2 text-neutral-500">{fmtFecha(a.fechaEstimada)}</td>
                    <td className="px-2.5 py-2"><span className={`inline-block rounded px-1 py-0.5 font-medium ${CRIT_COLOR[a.criticidad]}`}>{a.criticidad[0]}</span></td>
                    <td className="px-2.5 py-2"><span className={`inline-block rounded px-1.5 py-0.5 font-medium ${ALERTA_COLOR[a.estado]}`}>{ALERTA_LABEL[a.estado]}</span></td>
                    <td className="px-2.5 py-2 text-right">
                      <Link href={`/flota-360/ordenes?nueva=1&vehiculoId=${a.activo?.id || ''}&titulo=${encodeURIComponent(a.componente)}`} className="text-blue-600 hover:underline whitespace-nowrap">Crear OT</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Fila 2: Matriz / cronograma de mantenimiento */}
      <div className="fleet-schedule rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <div className="px-3 py-2 border-b border-neutral-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Programa de mantenimientos</span>
          <span className="text-[11px] text-neutral-400">Click en un evento para ver el detalle</span>
        </div>
        <div className="overflow-x-auto">
          <table className="fleet-plan-matrix w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-2.5 py-1.5 sticky left-0 bg-neutral-50 z-10 min-w-[140px]">Activo</th>
                {columnas.map((c) => (
                  <th key={c.index} className="text-center font-medium px-2 py-1.5 min-w-[64px] capitalize">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filas.length === 0 && <tr><td colSpan={columnas.length + 1} className="px-3 py-6 text-center text-neutral-400">No hay vehículos cargados en la flota</td></tr>}
              {filas.map((f) => (
                <tr key={f.vehiculoId} className="hover:bg-neutral-50">
                  <td className="px-2.5 py-2 font-medium text-neutral-800 sticky left-0 bg-white z-10">
                    <Link href={`/flota-360/vehiculos/${f.vehiculoId}`} className="flex items-center gap-2 text-blue-800"><VehicleArt semi={f.tipo === 'SEMI'} className="fleet-thumb" /><strong>{f.dominio}</strong></Link>
                    <div className="text-[11px] text-neutral-400">{f.tipo} · {f.odometro != null ? `${f.odometro.toLocaleString('es-AR')} km` : 's/odómetro'}</div>
                    {!f.hasPlan && <span className="inline-block mt-0.5 rounded bg-neutral-100 text-neutral-500 px-1 py-0.5 text-[10px]">Sin plan asignado</span>}
                  </td>
                  {f.celdas.map((c, ci) => {
                    const col = columnas[ci];
                    const tieneVencido = c?.eventos.some((e) => e.estado === 'VENCIDO');
                    const tieneEjecutado = c?.eventos.some((e) => e.estado === 'EJECUTADO');
                    const tieneProgramado = c?.eventos.some((e) => e.estado === 'PROGRAMADO');
                    const tienePlan = c?.eventos.some((e) => e.tipo === 'PLAN');
                    const tieneQR = c?.eventos.some((e) => e.tipo === 'QR');
                    return (
                      <td key={ci} className="px-2 py-2 text-center group relative">
                        {c ? (
                          <div>{c.eventos.map((evento, index) => <button key={`${evento.tipo}-${evento.id}-${index}`} onClick={() => setCeldaDetalle({ fila: f, col, eventos: c.eventos })} className={`fleet-event fleet-event-${evento.estado === 'VENCIDO' ? 'red' : evento.estado === 'EJECUTADO' ? 'green' : evento.tipo === 'QR' ? 'violet' : evento.tipo === 'PLAN' ? 'amber' : 'blue'}`} title={evento.titulo || evento.codigo}>
                            <strong className="block">{evento.titulo || evento.codigo || (evento.tipo === 'QR' ? 'Inspección QR' : 'Mantenimiento')}</strong><span>{evento.tipo === 'QR' ? 'Inspección QR' : evento.estado.toLowerCase().replaceAll('_', ' ')}</span>
                          </button>)}</div>
                        ) : (
                          <Link
                            href={`/flota-360/ordenes?nueva=1&vehiculoId=${f.vehiculoId}&fecha=${col ? fmtFechaInput(new Date(col.desde)) : ''}&titulo=${encodeURIComponent('Mantenimiento programado')}`}
                            className="text-neutral-200 group-hover:text-blue-500 text-[13px] leading-none"
                            title="Crear OT en esta fecha"
                          >
                            +
                          </Link>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-1.5 border-t border-neutral-100 flex items-center gap-3 text-[11px] text-neutral-500 flex-wrap">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500 inline-block" /> Programado</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" /> Ejecutado</span>
          <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-600" /> Vencido</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> Alerta próxima</span>
          <span className="flex items-center gap-1"><ScanLine className="h-3 w-3 text-purple-600" /> Inspección / hallazgo QR</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-neutral-200 inline-block" /> Sin plan asignado</span>
        </div>
      </div>

      {/* Fila 3: Inventario de repuestos + Carga de taller */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-3">
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800 flex items-center gap-1.5"><PackageSearch className="h-3.5 w-3.5" /> Inventario de repuestos</div>
          <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wide sticky top-0">
                <tr>
                  <th className="text-left font-medium px-2.5 py-1.5">Repuesto</th>
                  <th className="text-left font-medium px-2.5 py-1.5">Stock</th>
                  <th className="text-left font-medium px-2.5 py-1.5">Reservado</th>
                  <th className="text-left font-medium px-2.5 py-1.5">Disponible</th>
                  <th className="text-left font-medium px-2.5 py-1.5">Próx. OT</th>
                  <th className="text-left font-medium px-2.5 py-1.5">Estado</th>
                  <th className="text-left font-medium px-2.5 py-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {repuestos.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-400">Sin repuestos cargados</td></tr>}
                {repuestos.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50">
                    <td className="px-2.5 py-2 font-medium text-neutral-800">{p.name}<div className="text-[11px] text-neutral-400">{p.code}</div></td>
                    <td className="px-2.5 py-2 text-neutral-600">{p.currentStock} <span className="text-neutral-400">/ mín. {p.minStock}</span></td>
                    <td className="px-2.5 py-2 text-neutral-600">{p.reservado > 0 ? p.reservado : '—'}</td>
                    <td className="px-2.5 py-2 text-neutral-600">{p.disponible}</td>
                    <td className="px-2.5 py-2 text-neutral-500 text-[11px]">{p.proximasOTs[0] ? p.proximasOTs[0].code : '—'}</td>
                    <td className="px-2.5 py-2"><span className={`inline-block rounded px-1.5 py-0.5 font-medium ${REPUESTO_COLOR[p.estado]}`}>{p.estado}</span></td>
                    <td className="px-2.5 py-2 text-right whitespace-nowrap">
                      <button onClick={() => abrirAjuste(p)} className="inline-flex items-center gap-1 text-blue-600 hover:underline mr-2"><RotateCcw className="h-3 w-3" /> Ajustar</button>
                      <button onClick={() => abrirHistorial(p)} className="inline-flex items-center gap-1 text-neutral-500 hover:underline"><History className="h-3 w-3" /> Historial</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800 flex items-center gap-1.5"><Users2 className="h-3.5 w-3.5" /> Carga de taller (próximos 7 días)</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-2.5 py-1.5 min-w-[110px]">Técnico</th>
                  {tallerDias.map((d) => (
                    <th key={d} className="text-center font-medium px-1.5 py-1.5 min-w-[46px]">{new Date(d).toLocaleDateString('es-AR', { weekday: 'short' })}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {tallerFilas.length === 0 && <tr><td colSpan={tallerDias.length + 1} className="px-3 py-6 text-center text-neutral-400">Sin técnicos activos cargados</td></tr>}
                {tallerFilas.map((t) => (
                  <tr key={t.tecnicoId} className="hover:bg-neutral-50">
                    <td className="px-2.5 py-2 font-medium text-neutral-800">{t.nombre}<div className="text-[11px] text-neutral-400">{t.especializacion || '—'}</div></td>
                    {t.celdas.map((c, ci) => (
                      <td key={ci} className="px-1.5 py-2 text-center" title={c.ots.map((o) => o.codigo).join(', ')}>
                        <span className={`inline-block rounded px-1 py-0.5 text-[10px] font-medium ${c.sobreasignado ? 'bg-red-100 text-red-700' : c.horasAsignadas > 0 ? 'bg-blue-50 text-blue-700' : 'text-neutral-300'}`}>
                          {c.horasAsignadas}/{c.capacidad}h
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-1.5 border-t border-neutral-100 text-[11px] text-neutral-500">
            En rojo: técnicos con horas asignadas por encima de su capacidad diaria de referencia.
          </div>
        </div>
      </div>

      {/* Fila 4: Planes de mantenimiento activos */}
      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800 flex items-center justify-between">
          <span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Planes de mantenimiento activos</span>
          <span className="text-[11px] font-normal text-neutral-400">{planesActivos.length} plan(es)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-2.5 py-1.5">Plan</th>
                <th className="text-left font-medium px-2.5 py-1.5">Activo</th>
                <th className="text-left font-medium px-2.5 py-1.5">Componente</th>
                <th className="text-left font-medium px-2.5 py-1.5">Frecuencia</th>
                <th className="text-left font-medium px-2.5 py-1.5">Última ejec.</th>
                <th className="text-left font-medium px-2.5 py-1.5">Próxima ejec.</th>
                <th className="text-left font-medium px-2.5 py-1.5">Próximo km</th>
                <th className="text-left font-medium px-2.5 py-1.5">Estado</th>
                <th className="text-left font-medium px-2.5 py-1.5">Técnico</th>
                <th className="text-left font-medium px-2.5 py-1.5">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {planesActivos.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-6 text-center text-neutral-400">Sin planes activos. Aplicá un componente del catálogo o creá un plan manual.</td></tr>
              )}
              {planesActivos.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50">
                  <td className="px-2.5 py-2 font-medium text-neutral-800">
                    {p.plan}
                    <div className="text-[11px] text-neutral-400">{p.codigo} · {p.origen}</div>
                  </td>
                  <td className="px-2.5 py-2 text-neutral-700">
                    {p.activo ? (
                      <Link href={`/flota-360/vehiculos/${p.activo.id}`} className="hover:text-blue-700 font-medium">{p.activo.dominio}</Link>
                    ) : '—'}
                    {p.activo && <div className="text-[11px] text-neutral-400">{p.activo.tipo}</div>}
                  </td>
                  <td className="px-2.5 py-2 text-neutral-600">{p.componente || '—'}</td>
                  <td className="px-2.5 py-2 text-neutral-600">{p.frecuencia}</td>
                  <td className="px-2.5 py-2 text-neutral-500">{fmtFecha(p.ultimaEjecucion)}</td>
                  <td className="px-2.5 py-2 text-neutral-600">
                    {fmtFecha(p.proximaEjecucion)}
                    {p.diasRestantes != null && <div className="text-[11px] text-neutral-400">{p.diasRestantes}d</div>}
                  </td>
                  <td className="px-2.5 py-2 text-neutral-600">
                    {p.proximoKm != null ? p.proximoKm.toLocaleString('es-AR') : '—'}
                    {p.kmRestantes != null && <div className="text-[11px] text-neutral-400">faltan {p.kmRestantes.toLocaleString('es-AR')}</div>}
                  </td>
                  <td className="px-2.5 py-2">
                    <span className={`inline-block rounded px-1.5 py-0.5 font-medium ${
                      p.estado === 'VENCIDO' ? 'bg-red-50 text-red-700' :
                      p.estado === 'URGENTE' ? 'bg-amber-50 text-amber-700' :
                      p.estado === 'PROXIMO' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                    }`}>
                      {p.estado === 'VENCIDO' ? 'Vencido' : p.estado === 'URGENTE' ? 'Urgente' : p.estado === 'PROXIMO' ? 'Próximo' : 'Al día'}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-neutral-600">{p.tecnicoSugerido || '—'}</td>
                  <td className="px-2.5 py-2 text-right whitespace-nowrap">
                    <Link
                      href={`/flota-360/ordenes?nueva=1&vehiculoId=${p.activo?.id || ''}&titulo=${encodeURIComponent(p.plan)}`}
                      className="text-blue-600 hover:underline"
                    >
                      Crear OT
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: nuevo/editar componente */}
      {(showModal || editRule) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">{editRule ? `Editar "${editRule.nombre}"` : 'Nuevo componente'}</h2>
              <button onClick={() => { setShowModal(false); setEditRule(null); setForm(FORM_INICIAL); }}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <ReglaForm />
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => { setShowModal(false); setEditRule(null); setForm(FORM_INICIAL); }} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Cancelar</button>
              <button onClick={editRule ? guardarEdicion : crear} disabled={saving} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Guardando…' : editRule ? 'Guardar cambios' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: aplicar a activos (múltiple + excepción de frecuencia) */}
      {applyRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Aplicar "{applyRule.nombre}" a activos</h2>
              <button onClick={() => { setApplyRule(null); setApplyAssetVehs([]); }}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <label className="block text-xs font-medium text-neutral-600 mb-1">Seleccioná uno o varios activos</label>
              <div className="max-h-40 overflow-y-auto border border-neutral-200 rounded-md divide-y divide-neutral-100">
                {vehiculos.filter((v) => v.maintenanceAssetId).map((v) => (
                  <label key={v.id} className="flex items-center gap-2 px-2.5 py-1.5 text-sm cursor-pointer hover:bg-neutral-50">
                    <input type="checkbox" checked={applyAssetVehs.includes(v.id)} onChange={() => toggleApplyVeh(v.id)} className="rounded" />
                    {v.dominio} <span className="text-neutral-400 text-xs">({v.tipo})</span>
                  </label>
                ))}
                {vehiculos.filter((v) => v.maintenanceAssetId).length === 0 && <p className="text-xs text-neutral-400 px-2.5 py-2">No hay vehículos con activo de mantenimiento vinculado</p>}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Excepción km (opcional)</label>
                  <input type="number" value={applyOverrideKm} onChange={(e) => setApplyOverrideKm(e.target.value)} placeholder={applyRule.frecuenciaKm ? String(applyRule.frecuenciaKm) : '—'} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Excepción días (opcional)</label>
                  <input type="number" value={applyOverrideDias} onChange={(e) => setApplyOverrideDias(e.target.value)} placeholder={applyRule.frecuenciaDias ? String(applyRule.frecuenciaDias) : '—'} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Km base (opcional)</label>
                  <input type="number" value={applyKmBase} onChange={(e) => setApplyKmBase(e.target.value)} placeholder="Odómetro de referencia" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Próxima ejecución (opcional)</label>
                  <input type="date" value={applyProxima} onChange={(e) => setApplyProxima(e.target.value)} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Técnico sugerido (opcional)</label>
                  <select value={applyTecnico} onChange={(e) => setApplyTecnico(e.target.value)} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="">Sin asignar</option>
                    {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Acción ante vencimiento</label>
                  <select value={applyAccion} onChange={(e) => setApplyAccion(e.target.value)} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="">Según regla ({applyRule.accionVencimiento === 'ALERTA' ? 'Solo alerta' : applyRule.accionVencimiento === 'SUGERENCIA_OT' ? 'Sugerencia de OT' : 'Generar OT'})</option>
                    <option value="ALERTA">Solo alerta</option>
                    <option value="SUGERENCIA_OT">Sugerencia de OT</option>
                    <option value="GENERAR_OT">Generar OT automáticamente</option>
                  </select>
                </div>
              </div>
              {applyRule.repuestosRequeridos.length > 0 && (
                <div className="rounded-md bg-neutral-50 border border-neutral-200 px-2.5 py-2">
                  <p className="text-[11px] font-medium text-neutral-600 mb-1">Repuestos que requiere este componente</p>
                  {applyRule.repuestosRequeridos.map((rp) => (
                    <p key={rp.sparePartId} className="text-[11px] text-neutral-500">
                      {rp.nombre} ×{rp.cantidad} — <span className={rp.disponible != null && rp.disponible <= 0 ? 'text-red-600 font-medium' : ''}>{rp.disponible ?? '—'} disponibles</span>
                    </p>
                  ))}
                </div>
              )}
              <p className="text-xs text-neutral-500">Crea o actualiza un Plan de Mantenimiento real por cada activo seleccionado, sin afectar planes existentes de otros activos.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => { setApplyRule(null); setApplyAssetVehs([]); }} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Cancelar</button>
              <button onClick={aplicar} disabled={saving} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Aplicando…' : `Aplicar a ${applyAssetVehs.length || 0}`}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: nuevo plan manual (motor existente) */}
      {showNuevoPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Nuevo plan de mantenimiento</h2>
              <button onClick={() => setShowNuevoPlan(false)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Título *</label>
                <input value={nuevoPlanForm.title} onChange={(e) => setNuevoPlanForm({ ...nuevoPlanForm, title: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Activo *</label>
                <select value={nuevoPlanForm.assetVehId} onChange={(e) => setNuevoPlanForm({ ...nuevoPlanForm, assetVehId: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                  <option value="">Seleccionar…</option>
                  {vehiculos.filter((v) => v.maintenanceAssetId).map((v) => <option key={v.id} value={v.id}>{v.dominio}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Unidad de frecuencia</label>
                  <select value={nuevoPlanForm.frequencyUnit} onChange={(e) => setNuevoPlanForm({ ...nuevoPlanForm, frequencyUnit: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="DAYS">Días</option><option value="KM">Km</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Valor</label>
                  <input type="number" value={nuevoPlanForm.frequencyValue} onChange={(e) => setNuevoPlanForm({ ...nuevoPlanForm, frequencyValue: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Próxima ejecución</label>
                <input type="date" value={nuevoPlanForm.nextExecutionDate} onChange={(e) => setNuevoPlanForm({ ...nuevoPlanForm, nextExecutionDate: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setShowNuevoPlan(false)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Cancelar</button>
              <button onClick={crearPlanManual} disabled={saving} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Creando…' : 'Crear plan'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: detalle de celda / mover OT */}
      {celdaDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">{celdaDetalle.fila.dominio} · {celdaDetalle.col?.label}</h2>
              <button onClick={() => setCeldaDetalle(null)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="text-xs text-red-600">{error}</p>}
              {celdaDetalle.eventos.map((ev, i) => (
                <div key={i} className="rounded-md border border-neutral-200 p-2.5 space-y-1.5">
                  {ev.tipo === 'OT' ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-800">{ev.codigo} · {ev.titulo}</span>
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${ev.estado === 'VENCIDO' ? 'bg-red-50 text-red-700' : ev.estado === 'EJECUTADO' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>{ev.estado === 'VENCIDO' ? 'Vencido' : ev.estado === 'EJECUTADO' ? 'Ejecutado' : 'Programado'}</span>
                      </div>
                      <p className="text-xs text-neutral-500">Prioridad: {ev.prioridad} · Origen: {ev.origen || 'Mantenimiento'}</p>
                      <Link href="/flota-360/ordenes" className="text-xs text-blue-600 hover:underline flex items-center gap-1 w-fit"><ExternalLink className="h-3 w-3" /> Ver en Órdenes de trabajo</Link>
                      {ev.estado !== 'EJECUTADO' && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <input type="date" value={moverFecha} onChange={(e) => setMoverFecha(e.target.value)} className="rounded-md border border-neutral-300 px-2 py-1 text-xs" />
                          <button onClick={() => moverOT(ev.id)} disabled={saving || !moverFecha} className="rounded-md bg-neutral-800 px-2 py-1 text-[11px] font-medium text-white hover:bg-neutral-700 disabled:opacity-50">Mover</button>
                        </div>
                      )}
                    </>
                  ) : ev.tipo === 'PLAN' ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-800 flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5 text-amber-600" /> {ev.titulo || 'Servicio planificado'}</span>
                        <span className="inline-block rounded px-1.5 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-700">Alerta próxima</span>
                      </div>
                      <p className="text-xs text-neutral-500">El plan de mantenimiento vence en este período. Podés generar la OT con fecha programada.</p>
                      <Link href={`/flota-360/ordenes?nueva=1&vehiculoId=${celdaDetalle.fila.vehiculoId}&titulo=${encodeURIComponent(ev.titulo || 'Servicio planificado')}&fecha=${celdaDetalle.col ? fmtFechaInput(new Date(celdaDetalle.col.desde)) : ''}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1 w-fit"><ExternalLink className="h-3 w-3" /> Crear OT programada</Link>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-800 flex items-center gap-1"><ScanLine className="h-3.5 w-3.5 text-purple-600" /> Inspección QR</span>
                      </div>
                      <p className="text-xs text-neutral-500">{ev.hallazgos || 0} hallazgo(s) registrado(s){ev.criticos ? `, ${ev.criticos} crítico(s)` : ''}</p>
                      <Link href="/flota-360/inspecciones" className="text-xs text-blue-600 hover:underline flex items-center gap-1 w-fit"><ExternalLink className="h-3 w-3" /> Ver inspecciones QR</Link>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: ajuste de stock */}
      {ajusteRepuesto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Ajustar stock: {ajusteRepuesto.name}</h2>
              <button onClick={() => setAjusteRepuesto(null)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <p className="text-xs text-neutral-500">Stock actual: {ajusteRepuesto.currentStock}</p>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Cantidad (positivo = ingreso, negativo = egreso) *</label>
                <input type="number" value={ajusteDelta} onChange={(e) => setAjusteDelta(e.target.value)} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Motivo *</label>
                <input value={ajusteMotivo} onChange={(e) => setAjusteMotivo(e.target.value)} placeholder="Ej: Conteo físico, devolución, rotura" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setAjusteRepuesto(null)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Cancelar</button>
              <button onClick={guardarAjuste} disabled={saving} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar ajuste'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: historial de movimientos */}
      {historialRepuesto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Historial: {historialRepuesto.name}</h2>
              <button onClick={() => setHistorialRepuesto(null)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-2">
              {historialMovs.length === 0 && <p className="text-xs text-neutral-400">Sin movimientos registrados</p>}
              {historialMovs.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-xs border-b border-neutral-100 pb-1.5">
                  <div>
                    <span className={`font-medium ${m.delta > 0 ? 'text-green-700' : 'text-red-700'}`}>{m.delta > 0 ? '+' : ''}{m.delta}</span>
                    <span className="text-neutral-600 ml-2">{m.motivo}</span>
                  </div>
                  <span className="text-neutral-400">{fmtFecha(m.fecha)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
