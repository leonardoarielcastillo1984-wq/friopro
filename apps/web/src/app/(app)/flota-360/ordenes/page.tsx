'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { VehicleArt } from '../_components/FleetVisual';
import { apiFetch } from '@/lib/api';
import { FacturaFields, FACTURA_INICIAL, subirArchivoFactura, type FacturaData } from '../_components/FacturaForm';
import { Plus, X, ScanLine, CalendarClock, Wrench, Download, Play, CheckCircle2, Pause, Ban, PackagePlus, Trash2, UserCog, Pencil, Building2, FileText, ShieldCheck, Upload } from 'lucide-react';

type WorkOrderTask = {
  id: string; planId: string; status: 'PENDING' | 'COMPLETED' | 'SKIPPED'; completedAt?: string | null;
  plan?: { id: string; code: string; title: string; triggerKm?: number | null; frecuenciaDias?: number | null; componentKey?: string | null } | null;
};
type WorkOrder = {
  id: string; code: string; title: string; type: string; priority: string; status: string;
  assetId: string | null; scheduledDate: string | null; technician?: { id?: string; name: string } | null;
  technicianId?: string | null; laborCost?: number; partsCost?: number;
  totalCost: number; origen?: string | null; plan?: { id: string; code: string; title: string } | null;
  tareas?: WorkOrderTask[];
  // Ejecución externa
  ejecutorTipo?: 'INTERNO' | 'EXTERNO';
  tallerId?: string | null;
  taller?: { id: string; nombre: string; tipo: string; isActive?: boolean } | null;
  responsableSeguimientoNombre?: string | null;
  fechaIngresoTaller?: string | null;
  fechaEntregaEstimada?: string | null;
  fechaDevolucion?: string | null;
  trabajoSolicitado?: string | null;
  trabajoRealizado?: string | null;
  referenciaExterna?: string | null;
  observacionesExternas?: string | null;
  costoExterno?: number;
  recepcionResultado?: string | null;
  recepcionAt?: string | null;
  recepcionNotas?: string | null;
  garantiaAlcance?: string | null;
  garantiaInicio?: string | null;
  garantiaFechaLimite?: string | null;
  garantiaKmLimite?: number | null;
  garantiaCondiciones?: string | null;
  reclamoDeOtId?: string | null;
  sinCargo?: boolean;
};

type TallerOpt = { id: string; nombre: string; tipo: string; isActive: boolean };

const ESTADO_COLOR: Record<string, string> = {
  PENDING: 'bg-neutral-100 text-neutral-700', IN_PROGRESS: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-green-50 text-green-700', ON_HOLD: 'bg-amber-50 text-amber-700', CANCELLED: 'bg-red-50 text-red-600',
};
const ESTADO_LABEL: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En proceso', COMPLETED: 'Completada', ON_HOLD: 'En espera', CANCELLED: 'Cancelada',
};
const PRIORIDAD_COLOR: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700', HIGH: 'bg-red-50 text-red-600',
  MEDIUM: 'bg-amber-50 text-amber-700', LOW: 'bg-neutral-100 text-neutral-600',
};
const PRIORIDAD_LABEL: Record<string, string> = {
  CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja',
};

function origenDe(o: WorkOrder): { label: string; icon: any; color: string } {
  if (o.origen === 'INSPECCION') return { label: 'Inspección QR', icon: ScanLine, color: 'text-purple-600' };
  if (o.plan) return { label: 'Plan de mantenimiento', icon: CalendarClock, color: 'text-blue-600' };
  if (o.type === 'PREVENTIVE') return { label: 'Preventivo', icon: Wrench, color: 'text-neutral-500' };
  return { label: 'Correctivo', icon: Wrench, color: 'text-neutral-500' };
}

function fmtFecha(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function OrdenesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-neutral-500">Cargando…</div>}>
      <OrdenesPageInner />
    </Suspense>
  );
}

function OrdenesPageInner() {
  const params = useSearchParams();
  const [ordenes, setOrdenes] = useState<WorkOrder[]>([]);
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [talleres, setTalleres] = useState<TallerOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(params.get('nueva') === '1');
  const [editId, setEditId] = useState<string | null>(null);
  const [tab, setTab] = useState<'ACTIVAS' | 'HISTORIAL'>('ACTIVAS');
  const [form, setForm] = useState<any>({ title: '', type: 'CORRECTIVE', priority: 'MEDIUM', assetId: '', technicianId: '', scheduledDate: '' });
  const [conFactura, setConFactura] = useState(false);
  const [factura, setFactura] = useState<FacturaData>(FACTURA_INICIAL);
  const [facturaFile, setFacturaFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalleId, setDetalleId] = useState<string | null>(params.get('ver'));
  const detalle = ordenes.find(o => o.id === detalleId);

  const load = async () => {
    setLoading(true);
    try {
      const [o, v, t, ta] = await Promise.all([
        apiFetch<{ workOrders: WorkOrder[] }>('/maintenance/work-orders?scope=fleet'),
        apiFetch<{ vehiculos: any[] }>('/flota/vehiculos'),
        apiFetch<{ technicians: any[] }>('/maintenance/technicians?scope=fleet'),
        apiFetch<{ talleres: TallerOpt[] }>('/flota/talleres?activos=1').catch(() => ({ talleres: [] })),
      ]);
      setOrdenes(o.workOrders || []);
      setVehiculos(v.vehiculos || []);
      setTecnicos(t.technicians || []);
      setTalleres(ta.talleres || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const vehiculoId = params.get('vehiculoId');
    const titulo = params.get('titulo');
    const fecha = params.get('fecha');
    if (vehiculoId || titulo || fecha) {
      setForm((f: any) => ({
        ...f,
        assetId: vehiculoId || f.assetId,
        title: titulo || f.title,
        scheduledDate: fecha || f.scheduledDate,
      }));
      setShowModal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vehiculoPorAsset = useMemo(() => {
    const m = new Map<string, any>();
    vehiculos.forEach((v) => { if (v.maintenanceAssetId) m.set(v.maintenanceAssetId, v); });
    return m;
  }, [vehiculos]);

  // ?editar=<id> → abrir el modal de edición cuando ya cargaron las órdenes
  const editarParam = params.get('editar');
  useEffect(() => {
    if (!editarParam || loading || ordenes.length === 0) return;
    const o = ordenes.find((x) => x.id === editarParam);
    if (o) abrirEdicion(o);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editarParam, loading, ordenes.length]);

  const filtradas = ordenes.filter((o) =>
    tab === 'ACTIVAS' ? ['PENDING', 'IN_PROGRESS', 'ON_HOLD'].includes(o.status) : ['COMPLETED', 'CANCELLED'].includes(o.status)
  );

  const abrirEdicion = (o: WorkOrder) => {
    const veh = o.assetId ? vehiculoPorAsset.get(o.assetId) : null;
    setForm({
      title: o.title,
      type: o.type,
      priority: o.priority,
      assetId: veh?.id || '',
      ejecutorTipo: o.ejecutorTipo || 'INTERNO',
      technicianId: o.technicianId || o.technician?.id || '',
      tallerId: o.tallerId || '',
      trabajoSolicitado: o.trabajoSolicitado || '',
      fechaEntregaEstimada: o.fechaEntregaEstimada ? o.fechaEntregaEstimada.slice(0, 10) : '',
      referenciaExterna: o.referenciaExterna || '',
      scheduledDate: o.scheduledDate ? o.scheduledDate.slice(0, 10) : '',
    });
    setConFactura(false);
    setFactura(FACTURA_INICIAL);
    setFacturaFile(null);
    setError(null);
    setEditId(o.id);
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setEditId(null);
    setError(null);
  };

  const eliminar = async (o: WorkOrder) => {
    if (!window.confirm(`¿Eliminar la orden ${o.code} — "${o.title}"? Esta acción no se puede deshacer.`)) return;
    try {
      await apiFetch(`/maintenance/work-orders/${o.id}`, { method: 'DELETE' });
      if (detalleId === o.id) setDetalleId(null);
      load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo eliminar la orden');
    }
  };

  const crear = async () => {
    if (!form.title || !form.assetId) { setError('Título y vehículo son obligatorios'); return; }
    if (!editId && conFactura && !factura.total) { setError('Si cargás factura, el total es obligatorio'); return; }
    const esExterna = form.ejecutorTipo === 'EXTERNO';
    if (esExterna && !form.tallerId) { setError('Seleccioná el taller que ejecuta el trabajo'); return; }
    setSaving(true);
    setError(null);
    try {
      const veh = vehiculos.find((v) => v.id === form.assetId);

      if (editId) {
        const actual = ordenes.find((o) => o.id === editId);
        // Cambio de ejecutor → derivación con trazabilidad; si no cambió, PUT normal
        const cambioEjecutor = esExterna
          ? (actual?.ejecutorTipo !== 'EXTERNO' || actual?.tallerId !== form.tallerId)
          : (actual?.ejecutorTipo === 'EXTERNO' || (actual?.technicianId || null) !== (form.technicianId || null));
        if (cambioEjecutor) {
          await apiFetch(`/flota/ots/${editId}/derivar`, {
            method: 'POST',
            json: {
              ejecutorTipo: esExterna ? 'EXTERNO' : 'INTERNO',
              tallerId: esExterna ? form.tallerId : undefined,
              technicianId: !esExterna && form.technicianId ? form.technicianId : undefined,
            },
          });
        }
        await apiFetch(`/maintenance/work-orders/${editId}`, {
          method: 'PUT',
          json: {
            title: form.title,
            type: form.type,
            priority: form.priority,
            assetId: veh?.maintenanceAssetId || null,
            technicianId: esExterna ? null : (form.technicianId || null),
            trabajoSolicitado: esExterna ? form.trabajoSolicitado || null : undefined,
            referenciaExterna: esExterna ? form.referenciaExterna || null : undefined,
            fechaEntregaEstimada: esExterna && form.fechaEntregaEstimada ? new Date(`${form.fechaEntregaEstimada}T12:00:00`).toISOString() : undefined,
            scheduledDate: form.scheduledDate ? new Date(`${form.scheduledDate}T12:00:00`).toISOString() : undefined,
            // Preservar costos: el backend recalcula totalCost = laborCost + partsCost + costoExterno
            laborCost: actual?.laborCost ?? 0,
            partsCost: actual?.partsCost ?? 0,
          },
        });
        cerrarModal();
        setForm({ title: '', type: 'CORRECTIVE', priority: 'MEDIUM', assetId: '', technicianId: '', ejecutorTipo: 'INTERNO', tallerId: '', scheduledDate: '' });
        load();
        return;
      }

      const otRes = await apiFetch<{ workOrder?: any; id?: string }>('/maintenance/work-orders', {
        method: 'POST',
        json: {
          title: form.title,
          type: form.type,
          priority: form.priority,
          assetId: veh?.maintenanceAssetId || undefined,
          technicianId: esExterna ? undefined : (form.technicianId || undefined),
          ejecutorTipo: esExterna ? 'EXTERNO' : 'INTERNO',
          tallerId: esExterna ? form.tallerId : undefined,
          trabajoSolicitado: esExterna ? form.trabajoSolicitado || undefined : undefined,
          referenciaExterna: esExterna ? form.referenciaExterna || undefined : undefined,
          fechaEntregaEstimada: esExterna && form.fechaEntregaEstimada ? new Date(`${form.fechaEntregaEstimada}T12:00:00`).toISOString() : undefined,
          scheduledDate: form.scheduledDate ? new Date(`${form.scheduledDate}T12:00:00`).toISOString() : undefined,
        },
      });
      const workOrderId = (otRes as any)?.workOrder?.id || (otRes as any)?.id || null;

      // Factura opcional vinculada a la OT y al vehículo
      if (conFactura && factura.total) {
        let fileUrl: string | undefined, fileName: string | undefined, mimeType: string | undefined;
        if (facturaFile) {
          const up = await subirArchivoFactura(facturaFile);
          if (up) { fileUrl = up.url; fileName = up.name; mimeType = up.mimeType; }
        }
        await apiFetch('/flota/facturas', {
          method: 'POST',
          json: {
            vehiculoId: form.assetId,
            workOrderId: workOrderId || undefined,
            tallerId: esExterna ? form.tallerId : undefined,
            cargaKey: `ot-${workOrderId}-${Date.now()}`, // idempotencia: el retry devuelve la misma
            tipoComprobante: factura.tipoComprobante,
            numero: factura.numero || undefined,
            puntoVenta: factura.puntoVenta || undefined,
            fecha: factura.fecha || undefined,
            proveedor: factura.proveedor || undefined,
            cuitProveedor: factura.cuitProveedor || undefined,
            neto: factura.neto ? Number(factura.neto) : undefined,
            iva: factura.iva ? Number(factura.iva) : undefined,
            total: Number(factura.total),
            concepto: factura.concepto || form.title,
            categoria: factura.categoria,
            fileUrl, fileName, mimeType,
            notas: factura.notas || undefined,
          },
        }).catch(() => {});
      }

      // Una OT solo creada NO retira la unidad: el episodio de
      // indisponibilidad se abre recién cuando la OT entra en proceso
      // (IN_PROGRESS + retiraDeServicio), vía la lógica unificada del backend.

      cerrarModal();
      setForm({ title: '', type: 'CORRECTIVE', priority: 'MEDIUM', assetId: '', technicianId: '', ejecutorTipo: 'INTERNO', tallerId: '', scheduledDate: '' });
      setConFactura(false);
      setFactura(FACTURA_INICIAL);
      setFacturaFile(null);
      load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear la orden');
    } finally {
      setSaving(false);
    }
  };

  const exportarCSV = () => {
    const headers = ['Prioridad', 'Código', 'Título', 'Activo', 'Origen', 'Estado', 'Vencimiento', 'Responsable', 'Costo'];
    const rows = filtradas.map((o) => [
      PRIORIDAD_LABEL[o.priority] || o.priority,
      o.code,
      `"${(o.title || '').replace(/"/g, '""')}"`,
      o.assetId ? vehiculoPorAsset.get(o.assetId)?.dominio || '' : '',
      origenDe(o).label,
      ESTADO_LABEL[o.status] || o.status,
      fmtFecha(o.scheduledDate),
      o.technician?.name || '',
      o.totalCost || 0,
    ]);
    const csv = '﻿' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ordenes-trabajo-${tab === 'ACTIVAS' ? 'pendientes' : 'historial'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0d1b3d]">Órdenes de trabajo</h1>
          <p className="text-xs text-neutral-500">Seguimiento operativo de órdenes de mantenimiento de flota</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportarCSV} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
            <Download className="h-3.5 w-3.5" /> Exportar
          </button>
          <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
            <Plus className="h-3.5 w-3.5" /> Nueva OT
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-neutral-200">
        {(['ACTIVAS', 'HISTORIAL'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-neutral-500'}`}>
            {t === 'ACTIVAS' ? `Pendientes · ${ordenes.filter((o) => ['PENDING', 'IN_PROGRESS', 'ON_HOLD'].includes(o.status)).length}` : `Historial · ${ordenes.filter((o) => ['COMPLETED', 'CANCELLED'].includes(o.status)).length}`}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-2.5 py-2">Prioridad</th>
              <th className="text-left font-medium px-2.5 py-2">Código</th>
              <th className="text-left font-medium px-2.5 py-2">Título</th>
              <th className="text-left font-medium px-2.5 py-2">Activo / conjunto</th>
              <th className="text-left font-medium px-2.5 py-2">Origen</th>
              <th className="text-left font-medium px-2.5 py-2">Estado</th>
              <th className="text-left font-medium px-2.5 py-2">Vencimiento</th>
              <th className="text-left font-medium px-2.5 py-2">Responsable</th>
              <th className="text-left font-medium px-2.5 py-2">Costo</th>
              <th className="text-left font-medium px-2.5 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={10} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && filtradas.length === 0 && <tr><td colSpan={10} className="px-3 py-6 text-center text-neutral-400">Sin órdenes en esta vista</td></tr>}
            {filtradas.map((o) => {
              const org = origenDe(o);
              const OrigenIcon = org.icon;
              const veh = o.assetId ? vehiculoPorAsset.get(o.assetId) : null;
              const vencida = o.status === 'PENDING' && o.scheduledDate && new Date(o.scheduledDate) < new Date();
              return (
                <tr key={o.id} className="hover:bg-neutral-50">
                  <td className="px-2.5 py-2">
                    <span className={`inline-block rounded px-1.5 py-0.5 font-medium ${PRIORIDAD_COLOR[o.priority] || 'bg-neutral-100 text-neutral-600'}`}>
                      {PRIORIDAD_LABEL[o.priority] || o.priority}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 font-medium text-neutral-800">{o.code}</td>
                  <td className="px-2.5 py-2 text-neutral-600 max-w-[220px] truncate">{o.title}</td>
                  <td className="px-2.5 py-2 text-neutral-700">
                    {veh ? (
                      <Link href={`/flota-360/vehiculos/${veh.id}`} className="flex items-center gap-2 font-medium hover:text-blue-700"><VehicleArt semi={veh.tipo === 'SEMI'} className="fleet-thumb" />{veh.dominio}</Link>
                    ) : '—'}
                  </td>
                  <td className={`px-2.5 py-2 ${org.color}`}>
                    <span className="flex items-center gap-1"><OrigenIcon className="h-3 w-3 shrink-0" />{org.label}</span>
                  </td>
                  <td className="px-2.5 py-2">
                    <span className={`inline-block rounded px-1.5 py-0.5 font-medium ${ESTADO_COLOR[o.status] || 'bg-neutral-100'}`}>
                      {ESTADO_LABEL[o.status] || o.status}
                    </span>
                  </td>
                  <td className={`px-2.5 py-2 ${vencida ? 'text-red-600 font-semibold' : 'text-neutral-600'}`}>{fmtFecha(o.scheduledDate)}</td>
                  <td className="px-2.5 py-2 text-neutral-600">
                    {o.ejecutorTipo === 'EXTERNO'
                      ? <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3 text-indigo-500" />{o.taller?.nombre || 'Taller'}</span>
                      : o.technician?.name || '—'}
                  </td>
                  <td className="px-2.5 py-2 text-neutral-600">${(o.totalCost || 0).toLocaleString('es-AR')}</td>
                  <td className="px-2.5 py-2">
                    <div className="flex items-center gap-1.5">
                      <button className="text-xs font-medium text-blue-600 hover:underline" onClick={() => setDetalleId(o.id)}>Ver</button>
                      <button title="Editar orden" onClick={() => abrirEdicion(o)} className="p-1 text-neutral-400 hover:text-blue-600">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button title="Eliminar orden" onClick={() => eliminar(o)} className="p-1 text-neutral-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {veh && (
                      <Link href={`/flota-360/vehiculos/${veh.id}`} className="text-[11px] font-medium text-blue-600 hover:underline">Ver activo</Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {detalle && (
        <DetalleOT
          orden={detalle}
          tecnicos={tecnicos}
          talleres={talleres}
          vehiculo={detalle.assetId ? vehiculoPorAsset.get(detalle.assetId) : null}
          onClose={() => setDetalleId(null)}
          onChanged={load}
        />
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">{editId ? 'Editar orden de trabajo' : 'Nueva orden de trabajo'}</h2>
              <button onClick={cerrarModal}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Título *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Vehículo *</label>
                <select value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                  <option value="">Seleccionar…</option>
                  {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.dominio} ({v.tipo})</option>)}
                </select>
                {form.assetId && !vehiculos.find((v) => v.id === form.assetId)?.maintenanceAssetId && (
                  <p className="text-xs text-amber-600 mt-1">Este vehículo no tiene activo de mantenimiento vinculado; la OT se creará sin activo.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Tipo</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="CORRECTIVE">Correctivo</option>
                    <option value="PREVENTIVE">Preventivo</option>
                    <option value="PREDICTIVE">Predictivo</option>
                    <option value="EMERGENCY">Emergencia</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Prioridad</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="LOW">Baja</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                    <option value="CRITICAL">Crítica</option>
                  </select>
                </div>
              </div>
              {/* Ejecutor: interno (mecánico propio) o externo (taller/service) — uno solo */}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Ejecución</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button" onClick={() => setForm({ ...form, ejecutorTipo: 'INTERNO', tallerId: '' })}
                    className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${(form.ejecutorTipo || 'INTERNO') === 'INTERNO' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-neutral-300 text-neutral-600'}`}>
                    Interna (mecánico)
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, ejecutorTipo: 'EXTERNO', technicianId: '' })}
                    className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${form.ejecutorTipo === 'EXTERNO' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-neutral-300 text-neutral-600'}`}>
                    Externa (taller / service)
                  </button>
                </div>
              </div>
              {form.ejecutorTipo === 'EXTERNO' ? (
                <div className="rounded-md border border-indigo-100 bg-indigo-50/40 p-2.5 space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Taller / service oficial *</label>
                    <select value={form.tallerId || ''} onChange={(e) => setForm({ ...form, tallerId: e.target.value })} className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm">
                      <option value="">Seleccionar taller…</option>
                      {talleres.map((t) => <option key={t.id} value={t.id}>{t.nombre}{t.tipo === 'SERVICE_OFICIAL' ? ' (service oficial)' : ''}</option>)}
                    </select>
                    {talleres.length === 0 && <p className="text-[11px] text-amber-600 mt-1">No hay talleres activos — crealos en Menú → Talleres externos.</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Trabajo solicitado al taller</label>
                    <textarea value={form.trabajoSolicitado || ''} onChange={(e) => setForm({ ...form, trabajoSolicitado: e.target.value })} rows={2} placeholder="Qué se le encarga al taller…" className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Entrega estimada</label>
                      <input type="date" value={form.fechaEntregaEstimada || ''} onChange={(e) => setForm({ ...form, fechaEntregaEstimada: e.target.value })} className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Ref. taller (presupuesto / n°)</label>
                      <input value={form.referenciaExterna || ''} onChange={(e) => setForm({ ...form, referenciaExterna: e.target.value })} className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm" />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Mecánico</label>
                  <select value={form.technicianId} onChange={(e) => setForm({ ...form, technicianId: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="">Sin asignar</option>
                    {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Fecha programada</label>
                <input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>

              {/* Factura opcional del gasto (solo al crear) */}
              {!editId && (
                <>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input type="checkbox" checked={conFactura} onChange={(e) => setConFactura(e.target.checked)} className="h-3.5 w-3.5 rounded border-neutral-300 text-blue-600" />
                    <span className="text-xs font-medium text-neutral-700">Cargar factura / comprobante del gasto</span>
                  </label>
                  {conFactura && <FacturaFields data={factura} onChange={setFactura} file={facturaFile} onFile={setFacturaFile} />}
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={cerrarModal} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Cancelar</button>
              <button onClick={crear} disabled={saving} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Guardando…' : editId ? 'Guardar cambios' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Detalle operativo de OT: transiciones, técnico, repuestos, cierre
// ═══════════════════════════════════════════════════════════════
function DetalleOT({ orden, tecnicos, talleres, vehiculo, onClose, onChanged }: {
  orden: WorkOrder;
  tecnicos: any[];
  talleres: TallerOpt[];
  vehiculo: any;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [parts, setParts] = useState<any[]>([]);
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tecnicoId, setTecnicoId] = useState('');
  const [nuevoRep, setNuevoRep] = useState({ sparePartId: '', quantity: 1 });
  const [cierre, setCierre] = useState({ abierto: false, finalOdometer: '', laborCost: '', notas: '', tareasSel: [] as string[] });

  // ── Ejecución externa ──
  const esExterna = orden.ejecutorTipo === 'EXTERNO';
  const [externo, setExterno] = useState<{ facturas: any[]; eventos: any[] } | null>(null);
  const [derivSel, setDerivSel] = useState(''); // 'int:<tecId>' | 'ext:<tallerId>'
  const [ingForm, setIngForm] = useState({ abierto: false, fechaEntregaEstimada: '', referenciaExterna: '', trabajoSolicitado: '' });
  const [devForm, setDevForm] = useState({ abierto: false, fechaDevolucion: '', trabajoRealizado: '', observaciones: '' });
  const [recForm, setRecForm] = useState({ abierto: false, resultado: 'CONFORME', notas: '', tareasSel: [] as string[] });
  const [garForm, setGarForm] = useState({ abierto: false, alcance: '', inicio: '', fechaLimite: '', kmLimite: '', condiciones: '' });
  const [reclForm, setReclForm] = useState({ abierto: false, titulo: '', descripcion: '', sinCargo: true });
  const [facForm, setFacForm] = useState(false);
  const [factura, setFactura] = useState<FacturaData>(FACTURA_INICIAL);
  const [facturaFile, setFacturaFile] = useState<File | null>(null);

  const abierta = ['PENDING', 'IN_PROGRESS', 'ON_HOLD'].includes(orden.status);
  // Tareas preventivas de la OT (pueden haber varias o ninguna — ej. correctivo sin plan)
  const tareasOt: WorkOrderTask[] = orden.tareas || [];
  const tareasPendientes = tareasOt.filter((t) => t.status === 'PENDING');
  const requiereOdometro = tareasOt.some((t) => cierre.tareasSel.includes(t.id) && t.plan?.triggerKm);

  const cargarParts = async () => {
    try {
      const res = await apiFetch<{ parts: any[] }>(`/maintenance/work-orders/${orden.id}/parts`);
      setParts(res.parts || []);
    } catch { /* sin repuestos */ }
  };

  const cargarExterno = async () => {
    if (!esExterna && !orden.tallerId) { setExterno(null); return; }
    try {
      const res = await apiFetch<{ facturas: any[]; eventos: any[] }>(`/flota/ots/${orden.id}/externo`);
      setExterno({ facturas: res.facturas || [], eventos: res.eventos || [] });
    } catch { setExterno({ facturas: [], eventos: [] }); }
  };

  useEffect(() => {
    cargarParts();
    apiFetch<{ parts: any[] }>('/maintenance/spare-parts').then((r) => setCatalogo(r.parts || [])).catch(() => {});
    cargarExterno();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orden.id, orden.ejecutorTipo]);

  // Acciones del flujo externo: refrescan el detalle sin cerrar el modal
  const accionExterna = async (accion: 'derivar' | 'ingreso-taller' | 'devolucion' | 'recepcion' | 'garantia' | 'reclamo', json: any, metodo: 'POST' | 'PUT' = 'POST') => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/flota/ots/${orden.id}/${accion}`, { method: metodo, json });
      await cargarExterno();
      onChanged();
      return true;
    } catch (e: any) {
      setError(e?.message || 'No se pudo registrar la acción');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const cargarFactura = async () => {
    if (!factura.total) { setError('El total de la factura es obligatorio'); return; }
    setBusy(true);
    setError(null);
    try {
      let fileUrl: string | undefined, fileName: string | undefined, mimeType: string | undefined;
      if (facturaFile) {
        const up = await subirArchivoFactura(facturaFile);
        if (up) { fileUrl = up.url; fileName = up.name; mimeType = up.mimeType; }
      }
      await apiFetch('/flota/facturas', {
        method: 'POST',
        json: {
          vehiculoId: vehiculo?.id || undefined,
          workOrderId: orden.id,
          tallerId: orden.tallerId || undefined,
          cargaKey: `otdet-${orden.id}-${Date.now()}`,
          tipoComprobante: factura.tipoComprobante,
          numero: factura.numero || undefined,
          puntoVenta: factura.puntoVenta || undefined,
          fecha: factura.fecha || undefined,
          proveedor: factura.proveedor || orden.taller?.nombre || undefined,
          cuitProveedor: factura.cuitProveedor || undefined,
          neto: factura.neto ? Number(factura.neto) : undefined,
          iva: factura.iva ? Number(factura.iva) : undefined,
          total: Number(factura.total),
          concepto: factura.concepto || orden.title,
          categoria: factura.categoria,
          fileUrl, fileName, mimeType,
          notas: factura.notas || undefined,
        },
      });
      setFacForm(false);
      setFactura(FACTURA_INICIAL);
      setFacturaFile(null);
      await cargarExterno();
      onChanged();
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar la factura');
    } finally {
      setBusy(false);
    }
  };

  const actualizar = async (data: any) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/maintenance/work-orders/${orden.id}`, { method: 'PUT', json: data });
      // El estado de la unidad lo gobierna el episodio de indisponibilidad:
      // IN_PROGRESS la retira (si retiraDeServicio) y COMPLETED dispara la
      // re-evaluación de cierre — sin pasos manuales en esta pantalla.
      onChanged();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'No se pudo actualizar la orden');
    } finally {
      setBusy(false);
    }
  };

  const agregarRepuesto = async () => {
    if (!nuevoRep.sparePartId) return;
    setBusy(true);
    try {
      await apiFetch(`/maintenance/work-orders/${orden.id}/parts`, { method: 'POST', json: { sparePartId: nuevoRep.sparePartId, quantity: Number(nuevoRep.quantity) || 1 } });
      setNuevoRep({ sparePartId: '', quantity: 1 });
      await cargarParts();
    } catch (e: any) {
      setError(e?.message || 'No se pudo agregar el repuesto');
    } finally {
      setBusy(false);
    }
  };

  const quitarRepuesto = async (entryId: string) => {
    setBusy(true);
    try {
      await apiFetch(`/maintenance/work-orders/${orden.id}/parts/${entryId}`, { method: 'DELETE' });
      await cargarParts();
    } catch (e: any) {
      setError(e?.message || 'No se pudo quitar');
    } finally {
      setBusy(false);
    }
  };

  const completar = () => {
    if (requiereOdometro && !cierre.finalOdometer) {
      setError('El odómetro es obligatorio: hay tareas seleccionadas con intervalo en kilómetros.');
      return;
    }
    actualizar({
      status: 'COMPLETED',
      laborCost: cierre.laborCost ? Number(cierre.laborCost) : 0,
      partsCost: orden.totalCost - 0, // el backend recalcula con repuestos descontados
      finalOdometer: cierre.finalOdometer ? Number(cierre.finalOdometer) : undefined,
      description: cierre.notas || undefined,
      // Estado por tarea: solo las seleccionadas avanzan su intervalo.
      // Las no seleccionadas quedan PENDING (se pueden cerrar luego) — la OT
      // ya no omite toda la información preventiva al cerrar.
      tareas: tareasOt.map((t) => ({
        planId: t.planId,
        status: tareasPendientes.length === 0
          ? t.status // OT sin tareas pendientes (histórica o ya aplicada): no tocar
          : cierre.tareasSel.includes(t.id) ? 'COMPLETED' : 'PENDING',
      })),
    });
  };

  const org = origenDe(orden);
  const OrigenIcon = org.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Detalle de orden de trabajo">
      <section className="fleet-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <header className="fleet-panel-heading">
          <h2 className="flex items-center gap-2">{orden.code}
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${ESTADO_COLOR[orden.status] || 'bg-neutral-100'}`}>{ESTADO_LABEL[orden.status] || orden.status}</span>
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${PRIORIDAD_COLOR[orden.priority] || 'bg-neutral-100'}`}>{PRIORIDAD_LABEL[orden.priority] || orden.priority}</span>
          </h2>
          <button aria-label="Cerrar detalle" onClick={onClose}><X size={20} /></button>
        </header>

        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">{orden.title}</h3>
            <p className={`text-xs mt-1 flex items-center gap-1 ${org.color}`}><OrigenIcon className="h-3 w-3" />{org.label}{orden.plan ? ` · ${orden.plan.title}` : ''}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><p className="text-[11px] text-slate-500 uppercase">Activo</p><p className="font-medium">{vehiculo ? vehiculo.dominio : '—'}</p></div>
            <div><p className="text-[11px] text-slate-500 uppercase">Programada</p><p className="font-medium">{fmtFecha(orden.scheduledDate)}</p></div>
            <div>
              <p className="text-[11px] text-slate-500 uppercase">{esExterna ? 'Ejecutor' : 'Responsable'}</p>
              <p className="font-medium flex items-center gap-1">
                {esExterna ? <><Building2 className="h-3.5 w-3.5 text-indigo-500" />{orden.taller?.nombre || 'Taller'}</> : orden.technician?.name || 'Sin asignar'}
              </p>
              {esExterna && orden.responsableSeguimientoNombre && (
                <p className="text-[10px] text-neutral-400 mt-0.5">Seguimiento: {orden.responsableSeguimientoNombre}</p>
              )}
            </div>
            <div><p className="text-[11px] text-slate-500 uppercase">Costo</p><p className="font-medium">${(orden.totalCost || 0).toLocaleString('es-AR')}</p>
              {esExterna && (orden.costoExterno || 0) > 0 && (
                <p className="text-[10px] text-neutral-400 mt-0.5">Externo: ${(orden.costoExterno || 0).toLocaleString('es-AR')}</p>
              )}
            </div>
          </div>

          {/* ═══ Ejecución externa: seguimiento de la intervención en el taller ═══ */}
          {esExterna && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-indigo-900 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Intervención en {orden.taller?.nombre || 'taller'}
                  {orden.sinCargo && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">garantía — sin cargo</span>}
                </p>
                <span className="text-[10px] text-neutral-400">{orden.referenciaExterna ? `Ref. ${orden.referenciaExterna}` : ''}</span>
              </div>

              {/* Línea de tiempo: asignada → ingreso → devolución → recepción */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="rounded-md bg-white border border-neutral-200 px-2 py-1.5">
                  <p className="text-neutral-400">Ingreso</p>
                  <p className="font-medium text-neutral-800">{orden.fechaIngresoTaller ? fmtFecha(orden.fechaIngresoTaller) : 'Pendiente'}</p>
                </div>
                <div className="rounded-md bg-white border border-neutral-200 px-2 py-1.5">
                  <p className="text-neutral-400">Entrega estimada</p>
                  <p className={`font-medium ${orden.fechaEntregaEstimada && !orden.fechaDevolucion && new Date(orden.fechaEntregaEstimada) < new Date() ? 'text-red-600' : 'text-neutral-800'}`}>{fmtFecha(orden.fechaEntregaEstimada)}</p>
                </div>
                <div className="rounded-md bg-white border border-neutral-200 px-2 py-1.5">
                  <p className="text-neutral-400">Devolución</p>
                  <p className="font-medium text-neutral-800">{orden.fechaDevolucion ? fmtFecha(orden.fechaDevolucion) : 'Pendiente'}</p>
                </div>
                <div className="rounded-md bg-white border border-neutral-200 px-2 py-1.5">
                  <p className="text-neutral-400">Recepción</p>
                  {orden.recepcionResultado
                    ? <p className={`font-medium ${orden.recepcionResultado === 'CONFORME' ? 'text-emerald-700' : orden.recepcionResultado === 'OBSERVADO' ? 'text-amber-700' : 'text-red-600'}`}>{orden.recepcionResultado === 'CONFORME' ? 'Conforme' : orden.recepcionResultado === 'OBSERVADO' ? 'Observado' : 'Requiere corrección'}</p>
                    : <p className="font-medium text-neutral-500">Sin registrar</p>}
                </div>
              </div>

              {orden.trabajoSolicitado && <p className="text-[11px] text-neutral-600"><span className="font-medium">Solicitado:</span> {orden.trabajoSolicitado}</p>}
              {orden.trabajoRealizado && <p className="text-[11px] text-neutral-600"><span className="font-medium">Realizado:</span> {orden.trabajoRealizado}</p>}
              {orden.recepcionNotas && <p className="text-[11px] text-neutral-600"><span className="font-medium">Notas de recepción:</span> {orden.recepcionNotas}</p>}
              {orden.garantiaAlcance && (
                <p className="text-[11px] text-neutral-600 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" />
                  <span><span className="font-medium">Garantía:</span> {orden.garantiaAlcance}
                    {orden.garantiaFechaLimite ? ` hasta ${fmtFecha(orden.garantiaFechaLimite)}` : ''}
                    {orden.garantiaKmLimite ? ` / ${orden.garantiaKmLimite.toLocaleString('es-AR')} km` : ''}
                  </span>
                </p>
              )}

              {/* Acciones del flujo externo */}
              {abierta && (
                <div className="flex flex-wrap gap-1.5">
                  {!orden.fechaIngresoTaller && (
                    <button disabled={busy} onClick={() => setIngForm({ ...ingForm, abierto: !ingForm.abierto, trabajoSolicitado: orden.trabajoSolicitado || '', fechaEntregaEstimada: orden.fechaEntregaEstimada?.slice(0, 10) || '', referenciaExterna: orden.referenciaExterna || '' })} className="rounded-md border border-indigo-300 bg-white px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50">
                      Registrar ingreso
                    </button>
                  )}
                  {orden.fechaIngresoTaller && !orden.fechaDevolucion && (
                    <button disabled={busy} onClick={() => setDevForm({ ...devForm, abierto: !devForm.abierto, trabajoRealizado: orden.trabajoRealizado || '' })} className="rounded-md border border-indigo-300 bg-white px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50">
                      Registrar devolución
                    </button>
                  )}
                  {!orden.recepcionResultado && (
                    <button disabled={busy} onClick={() => setRecForm({ ...recForm, abierto: !recForm.abierto })} className="rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50">
                      Recepción / conformidad
                    </button>
                  )}
                  <button disabled={busy} onClick={() => setGarForm({ abierto: !garForm.abierto, alcance: orden.garantiaAlcance || '', inicio: orden.garantiaInicio?.slice(0, 10) || '', fechaLimite: orden.garantiaFechaLimite?.slice(0, 10) || '', kmLimite: orden.garantiaKmLimite ? String(orden.garantiaKmLimite) : '', condiciones: orden.garantiaCondiciones || '' })} className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50">
                    {orden.garantiaAlcance ? 'Editar garantía' : 'Garantía'}
                  </button>
                  <button disabled={busy} onClick={() => setReclForm({ abierto: !reclForm.abierto, titulo: `Reclamo: ${orden.title}`, descripcion: '', sinCargo: true })} className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50">
                    Reclamo
                  </button>
                </div>
              )}

              {/* Sub-formularios inline */}
              {ingForm.abierto && (
                <div className="rounded-md border border-neutral-200 bg-white p-3 space-y-2">
                  <p className="text-xs font-semibold text-neutral-800">Ingreso efectivo al taller</p>
                  <p className="text-[10px] text-neutral-500">La OT pasa a "En proceso" y la unidad se marca en taller. Hasta acá, la asignación era solo programación.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-[10px] text-neutral-500 mb-0.5">Entrega estimada</label><input type="date" value={ingForm.fechaEntregaEstimada} onChange={(e) => setIngForm({ ...ingForm, fechaEntregaEstimada: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs" /></div>
                    <div><label className="block text-[10px] text-neutral-500 mb-0.5">Ref. taller</label><input value={ingForm.referenciaExterna} onChange={(e) => setIngForm({ ...ingForm, referenciaExterna: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs" /></div>
                  </div>
                  <div><label className="block text-[10px] text-neutral-500 mb-0.5">Trabajo solicitado</label><input value={ingForm.trabajoSolicitado} onChange={(e) => setIngForm({ ...ingForm, trabajoSolicitado: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs" /></div>
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={async () => { if (await accionExterna('ingreso-taller', { fechaEntregaEstimada: ingForm.fechaEntregaEstimada || undefined, referenciaExterna: ingForm.referenciaExterna || undefined, trabajoSolicitado: ingForm.trabajoSolicitado || undefined })) setIngForm({ ...ingForm, abierto: false }); }} className="rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700">Confirmar ingreso</button>
                    <button onClick={() => setIngForm({ ...ingForm, abierto: false })} className="rounded-md border border-neutral-300 px-2.5 py-1 text-[11px] text-neutral-600">Volver</button>
                  </div>
                </div>
              )}
              {devForm.abierto && (
                <div className="rounded-md border border-neutral-200 bg-white p-3 space-y-2">
                  <p className="text-xs font-semibold text-neutral-800">Devolución de la unidad</p>
                  <p className="text-[10px] text-neutral-500">Registra que el taller devolvió la unidad. No habilita automáticamente ni cierra la OT — el cierre técnico es aparte.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-[10px] text-neutral-500 mb-0.5">Fecha de devolución</label><input type="date" value={devForm.fechaDevolucion} onChange={(e) => setDevForm({ ...devForm, fechaDevolucion: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs" /></div>
                  </div>
                  <div><label className="block text-[10px] text-neutral-500 mb-0.5">Trabajo realizado</label><input value={devForm.trabajoRealizado} onChange={(e) => setDevForm({ ...devForm, trabajoRealizado: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs" /></div>
                  <div><label className="block text-[10px] text-neutral-500 mb-0.5">Observaciones</label><input value={devForm.observaciones} onChange={(e) => setDevForm({ ...devForm, observaciones: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs" /></div>
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={async () => { if (await accionExterna('devolucion', { fechaDevolucion: devForm.fechaDevolucion || undefined, trabajoRealizado: devForm.trabajoRealizado || undefined, observaciones: devForm.observaciones || undefined })) setDevForm({ ...devForm, abierto: false }); }} className="rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700">Confirmar devolución</button>
                    <button onClick={() => setDevForm({ ...devForm, abierto: false })} className="rounded-md border border-neutral-300 px-2.5 py-1 text-[11px] text-neutral-600">Volver</button>
                  </div>
                </div>
              )}
              {recForm.abierto && (
                <div className="rounded-md border border-neutral-200 bg-white p-3 space-y-2">
                  <p className="text-xs font-semibold text-neutral-800">Recepción / conformidad</p>
                  <select value={recForm.resultado} onChange={(e) => setRecForm({ ...recForm, resultado: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs">
                    <option value="CONFORME">Conforme — el trabajo cumple</option>
                    <option value="OBSERVADO">Observado — tiene observaciones</option>
                    <option value="REQUIERE_CORRECCION">Requiere corrección</option>
                  </select>
                  {tareasPendientes.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-neutral-500">Tareas efectivamente completadas (las otras quedan pendientes — recepción parcial):</p>
                      {tareasPendientes.map((t) => (
                        <label key={t.id} className="flex items-center gap-1.5 text-[11px] text-neutral-700 cursor-pointer">
                          <input type="checkbox" checked={recForm.tareasSel.includes(t.id)} onChange={(e) => setRecForm({ ...recForm, tareasSel: e.target.checked ? [...recForm.tareasSel, t.id] : recForm.tareasSel.filter((x) => x !== t.id) })} />
                          {t.plan?.title || t.planId}
                        </label>
                      ))}
                    </div>
                  )}
                  <input value={recForm.notas} onChange={(e) => setRecForm({ ...recForm, notas: e.target.value })} placeholder="Notas de la recepción…" className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs" />
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={async () => { if (await accionExterna('recepcion', { resultado: recForm.resultado, notas: recForm.notas || undefined, tareasCompletadasIds: recForm.tareasSel })) setRecForm({ ...recForm, abierto: false }); }} className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700">Registrar recepción</button>
                    <button onClick={() => setRecForm({ ...recForm, abierto: false })} className="rounded-md border border-neutral-300 px-2.5 py-1 text-[11px] text-neutral-600">Volver</button>
                  </div>
                </div>
              )}
              {garForm.abierto && (
                <div className="rounded-md border border-neutral-200 bg-white p-3 space-y-2">
                  <p className="text-xs font-semibold text-neutral-800">Garantía del trabajo</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-[10px] text-neutral-500 mb-0.5">Alcance</label><input value={garForm.alcance} onChange={(e) => setGarForm({ ...garForm, alcance: e.target.value })} placeholder="Ej: repuestos y mano de obra" className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs" /></div>
                    <div><label className="block text-[10px] text-neutral-500 mb-0.5">Inicio</label><input type="date" value={garForm.inicio} onChange={(e) => setGarForm({ ...garForm, inicio: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs" /></div>
                    <div><label className="block text-[10px] text-neutral-500 mb-0.5">Vence (fecha)</label><input type="date" value={garForm.fechaLimite} onChange={(e) => setGarForm({ ...garForm, fechaLimite: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs" /></div>
                    <div><label className="block text-[10px] text-neutral-500 mb-0.5">Vence (km)</label><input type="number" value={garForm.kmLimite} onChange={(e) => setGarForm({ ...garForm, kmLimite: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs" /></div>
                  </div>
                  <input value={garForm.condiciones} onChange={(e) => setGarForm({ ...garForm, condiciones: e.target.value })} placeholder="Condiciones…" className="w-full rounded-md border border-neutral-300 px-2 py-1 text-xs" />
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={async () => { if (await accionExterna('garantia', { garantiaAlcance: garForm.alcance || undefined, garantiaInicio: garForm.inicio || undefined, garantiaFechaLimite: garForm.fechaLimite || undefined, garantiaKmLimite: garForm.kmLimite ? Number(garForm.kmLimite) : undefined, garantiaCondiciones: garForm.condiciones || undefined }, 'PUT')) setGarForm({ ...garForm, abierto: false }); }} className="rounded-md bg-neutral-800 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-neutral-900">Guardar garantía</button>
                    <button onClick={() => setGarForm({ ...garForm, abierto: false })} className="rounded-md border border-neutral-300 px-2.5 py-1 text-[11px] text-neutral-600">Volver</button>
                  </div>
                </div>
              )}
              {reclForm.abierto && (
                <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-800">Reclamo / devolución de garantía sobre esta OT</p>
                  <p className="text-[10px] text-amber-700">Crea una OT nueva vinculada a esta. Por defecto "sin cargo" (el taller lo cubre por garantía); desmarcá si hay costo nuevo.</p>
                  <input value={reclForm.titulo} onChange={(e) => setReclForm({ ...reclForm, titulo: e.target.value })} placeholder="Título del reclamo" className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs" />
                  <input value={reclForm.descripcion} onChange={(e) => setReclForm({ ...reclForm, descripcion: e.target.value })} placeholder="Qué falló / qué se reclama…" className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs" />
                  <label className="flex items-center gap-1.5 text-[11px] text-neutral-700 cursor-pointer">
                    <input type="checkbox" checked={reclForm.sinCargo} onChange={(e) => setReclForm({ ...reclForm, sinCargo: e.target.checked })} />
                    Sin cargo (cubierto por garantía)
                  </label>
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={async () => { if (await accionExterna('reclamo', { title: reclForm.titulo || `Reclamo sobre ${orden.code}`, description: reclForm.descripcion || undefined, sinCargo: reclForm.sinCargo })) setReclForm({ ...reclForm, abierto: false }); }} className="rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-amber-700">Crear OT de reclamo</button>
                    <button onClick={() => setReclForm({ ...reclForm, abierto: false })} className="rounded-md border border-neutral-300 px-2.5 py-1 text-[11px] text-neutral-600">Volver</button>
                  </div>
                </div>
              )}

              {/* Facturas vinculadas a la OT */}
              <div className="rounded-md border border-neutral-200 bg-white">
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-neutral-100">
                  <p className="text-[11px] font-semibold text-neutral-700 flex items-center gap-1"><FileText className="h-3 w-3" /> Comprobantes de la OT · ${(orden.costoExterno || 0).toLocaleString('es-AR')} imputado</p>
                  {abierta && <button disabled={busy} onClick={() => setFacForm(!facForm)} className="text-[10px] font-medium text-blue-600 hover:underline flex items-center gap-0.5"><Upload className="h-2.5 w-2.5" />Adjuntar</button>}
                </div>
                {(externo?.facturas || []).length > 0 ? (
                  <div className="divide-y divide-neutral-50">
                    {(externo?.facturas || []).map((f: any) => (
                      <div key={f.id} className="flex items-center justify-between px-2.5 py-1.5 text-[11px]">
                        <span className="text-neutral-700">{f.tipoComprobante} {f.puntoVenta ? `${f.puntoVenta}-` : ''}{f.numero || ''} · {fmtFecha(f.fecha)}</span>
                        <span className={`font-medium ${f.tipoComprobante === 'NOTA_CREDITO' ? 'text-red-600' : ''}`}>{f.tipoComprobante === 'NOTA_CREDITO' ? '−' : ''}${(f.total || 0).toLocaleString('es-AR')}{f.tipoComprobante === 'PRESUPUESTO' ? ' (no suma)' : ''}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="px-2.5 py-2 text-[10px] text-neutral-400">Sin comprobantes vinculados</p>}
                {facForm && (
                  <div className="border-t border-neutral-100 p-2.5 space-y-2">
                    <FacturaFields data={factura} onChange={setFactura} file={facturaFile} onFile={setFacturaFile} />
                    <div className="flex gap-2">
                      <button disabled={busy} onClick={cargarFactura} className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700">Cargar comprobante</button>
                      <button onClick={() => setFacForm(false)} className="rounded-md border border-neutral-300 px-2.5 py-1 text-[11px] text-neutral-600">Volver</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}

          {/* Acciones de estado */}
          {abierta && !cierre.abierto && (
            <div className="flex flex-wrap gap-2">
              {orden.status === 'PENDING' && (
                <button disabled={busy} onClick={() => actualizar({ status: 'IN_PROGRESS' })} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  <Play className="h-3.5 w-3.5" /> Iniciar trabajo
                </button>
              )}
              {orden.status === 'IN_PROGRESS' && (
                <>
                  <button disabled={busy} onClick={() => setCierre({ ...cierre, abierto: true, tareasSel: tareasPendientes.map((t) => t.id) })} className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Completar
                  </button>
                  <button disabled={busy} onClick={() => actualizar({ status: 'ON_HOLD' })} className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50">
                    <Pause className="h-3.5 w-3.5" /> Poner en espera
                  </button>
                </>
              )}
              {orden.status === 'ON_HOLD' && (
                <button disabled={busy} onClick={() => actualizar({ status: 'IN_PROGRESS' })} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  <Play className="h-3.5 w-3.5" /> Reanudar
                </button>
              )}
              {orden.status === 'PENDING' && (
                <button disabled={busy} onClick={() => setCierre({ ...cierre, abierto: true, tareasSel: tareasPendientes.map((t) => t.id) })} className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Completar directo
                </button>
              )}
              <button disabled={busy} onClick={() => actualizar({ status: 'CANCELLED' })} className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                <Ban className="h-3.5 w-3.5" /> Cancelar OT
              </button>
            </div>
          )}

          {/* Tareas preventivas de la OT: estado por tarea — una OT parcial no es cumplimiento total */}
          {tareasOt.length > 0 && !cierre.abierto && (
            <div className="rounded-lg border border-neutral-200">
              <div className="px-3 py-2 border-b border-neutral-100 text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 text-blue-600" /> Tareas preventivas de esta OT
              </div>
              <div className="divide-y divide-neutral-100">
                {tareasOt.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="font-medium text-neutral-800">{t.plan?.title || t.planId}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${t.status === 'COMPLETED' ? 'bg-green-50 text-green-700' : t.status === 'SKIPPED' ? 'bg-neutral-100 text-neutral-500' : 'bg-amber-50 text-amber-700'}`}>
                      {t.status === 'COMPLETED' ? 'Ejecutada' : t.status === 'SKIPPED' ? 'Omitida' : 'Pendiente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulario de cierre */}
          {cierre.abierto && abierta && (
            <div className="rounded-lg border border-green-200 bg-green-50/50 p-3.5 space-y-3">
              <p className="text-xs font-semibold text-green-800">Completar orden de trabajo</p>
              {tareasPendientes.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-neutral-600">Tareas realizadas en esta OT (las no marcadas quedan pendientes, no se reinicia su intervalo):</p>
                  {tareasPendientes.map((t) => {
                    const sel = cierre.tareasSel.includes(t.id);
                    return (
                      <label key={t.id} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs cursor-pointer ${sel ? 'border-green-300 bg-green-50' : 'border-neutral-200 bg-white'}`}>
                        <input type="checkbox" checked={sel} onChange={(e) => setCierre({ ...cierre, tareasSel: e.target.checked ? [...cierre.tareasSel, t.id] : cierre.tareasSel.filter((x) => x !== t.id) })} />
                        <span className="flex-1">
                          <span className="font-medium text-neutral-800">{t.plan?.title || t.planId}</span>
                          {t.plan?.triggerKm ? <span className="ml-1 text-[10px] text-amber-600">· requiere km</span> : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-600 mb-1">Odómetro final (km){requiereOdometro ? ' *' : ''}</label>
                  <input type="number" value={cierre.finalOdometer} onChange={(e) => setCierre({ ...cierre, finalOdometer: e.target.value })} placeholder={vehiculo?.currentOdometer ? `Actual: ${Math.round(vehiculo.currentOdometer)}` : (requiereOdometro ? 'Obligatorio' : 'Opcional')} className={`w-full rounded-md border px-2.5 py-1.5 text-sm ${requiereOdometro && !cierre.finalOdometer ? 'border-amber-400 bg-amber-50' : 'border-neutral-300'}`} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-600 mb-1">Mano de obra ($)</label>
                  <input type="number" value={cierre.laborCost} onChange={(e) => setCierre({ ...cierre, laborCost: e.target.value })} placeholder="0" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-neutral-600 mb-1">Notas de cierre</label>
                <input value={cierre.notas} onChange={(e) => setCierre({ ...cierre, notas: e.target.value })} placeholder="Trabajo realizado, observaciones…" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              <div className="flex gap-2">
                <button disabled={busy} onClick={completar} className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">Confirmar cierre</button>
                <button disabled={busy} onClick={() => setCierre({ ...cierre, abierto: false })} className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600">Volver</button>
              </div>
              <p className="text-[11px] text-neutral-500">
                {tareasPendientes.length > 0
                  ? `Al cerrar: se descuenta el stock, se actualiza el odómetro y se actualiza el próximo vencimiento de ${cierre.tareasSel.length} tarea${cierre.tareasSel.length === 1 ? '' : 's'} seleccionada${cierre.tareasSel.length === 1 ? '' : 's'}. ${tareasPendientes.length - cierre.tareasSel.length > 0 ? 'Las demás quedan pendientes.' : ''}`
                  : 'Al cerrar: se descuenta el stock de repuestos asignados, se actualiza el odómetro del vehículo y se libera el estado "en taller".'}
              </p>
            </div>
          )}

          {/* Asignar / derivar ejecutor: interno↔externo queda trazado en la bitácora del taller */}
          {abierta && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                  <UserCog className="inline h-3 w-3 mr-1" />{esExterna ? 'Derivar ejecutor' : 'Asignar / reasignar técnico'}
                </label>
                {esExterna ? (
                  <select value={derivSel} onChange={(e) => setDerivSel(e.target.value)} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="">Elegir nuevo ejecutor…</option>
                    <optgroup label="Talleres externos">
                      {talleres.filter((t) => t.id !== orden.tallerId).map((t) => <option key={t.id} value={`ext:${t.id}`}>{t.nombre}{t.tipo === 'SERVICE_OFICIAL' ? ' (service)' : ''}</option>)}
                    </optgroup>
                    <optgroup label="Ejecución interna">
                      {tecnicos.map((t) => <option key={t.id} value={`int:${t.id}`}>{t.name}</option>)}
                    </optgroup>
                  </select>
                ) : (
                  <select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="">Elegir técnico…</option>
                    {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    <optgroup label="Derivar a taller externo">
                      {talleres.map((t) => <option key={t.id} value={`ext:${t.id}`}>{t.nombre}{t.tipo === 'SERVICE_OFICIAL' ? ' (service)' : ''}</option>)}
                    </optgroup>
                  </select>
                )}
              </div>
              <button
                disabled={busy || (esExterna ? !derivSel : !tecnicoId)}
                onClick={async () => {
                  if (esExterna) {
                    if (derivSel.startsWith('ext:')) {
                      if (await accionExterna('derivar', { ejecutorTipo: 'EXTERNO', tallerId: derivSel.slice(4) })) setDerivSel('');
                    } else if (derivSel.startsWith('int:')) {
                      if (await accionExterna('derivar', { ejecutorTipo: 'INTERNO', technicianId: derivSel.slice(4) })) setDerivSel('');
                    }
                    return;
                  }
                  // Interna: mecánico → PUT normal; taller → derivación externa trazable
                  if (tecnicoId.startsWith('ext:')) {
                    await accionExterna('derivar', { ejecutorTipo: 'EXTERNO', tallerId: tecnicoId.slice(4) });
                    setTecnicoId('');
                    return;
                  }
                  actualizar({ technicianId: tecnicoId });
                }}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              >
                {esExterna ? 'Derivar' : 'Asignar'}
              </button>
            </div>
          )}

          {/* Repuestos */}
          <div className="rounded-lg border border-neutral-200">
            <div className="px-3 py-2 border-b border-neutral-100 text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
              <PackagePlus className="h-3.5 w-3.5 text-blue-600" /> Repuestos asignados
              <span className="text-neutral-400 font-normal">· se descuentan del stock al completar</span>
            </div>
            <div className="divide-y divide-neutral-100">
              {parts.length === 0 && <p className="px-3 py-3 text-xs text-neutral-400">Sin repuestos asignados</p>}
              {parts.map((p) => (
                <div key={p.id} className="px-3 py-2 flex items-center justify-between text-xs">
                  <span className="text-neutral-700">{p.sparePart?.code} · {p.sparePart?.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-neutral-500">x{p.quantity} · ${((p.unitCost || 0) * p.quantity).toLocaleString('es-AR')}</span>
                    {p.stockDeducted ? <span className="text-[10px] text-green-600 font-medium">descontado</span> : abierta && (
                      <button disabled={busy} onClick={() => quitarRepuesto(p.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </span>
                </div>
              ))}
            </div>
            {abierta && (
              <div className="px-3 py-2 border-t border-neutral-100 flex items-end gap-2">
                <select value={nuevoRep.sparePartId} onChange={(e) => setNuevoRep({ ...nuevoRep, sparePartId: e.target.value })} className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-xs">
                  <option value="">Agregar repuesto…</option>
                  {catalogo.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name} (stock {c.currentStock})</option>)}
                </select>
                <input type="number" min={1} value={nuevoRep.quantity} onChange={(e) => setNuevoRep({ ...nuevoRep, quantity: Number(e.target.value) })} className="w-16 rounded-md border border-neutral-300 px-2 py-1.5 text-xs" />
                <button disabled={busy || !nuevoRep.sparePartId} onClick={agregarRepuesto} className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">Agregar</button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
