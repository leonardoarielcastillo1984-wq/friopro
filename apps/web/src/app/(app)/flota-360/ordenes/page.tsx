'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { VehicleArt } from '../_components/FleetVisual';
import { apiFetch } from '@/lib/api';
import { FacturaFields, FACTURA_INICIAL, subirArchivoFactura, type FacturaData } from '../_components/FacturaForm';
import { Plus, X, ScanLine, CalendarClock, Wrench, Download, Play, CheckCircle2, Pause, Ban, PackagePlus, Trash2, UserCog, Pencil } from 'lucide-react';

type WorkOrder = {
  id: string; code: string; title: string; type: string; priority: string; status: string;
  assetId: string | null; scheduledDate: string | null; technician?: { id?: string; name: string } | null;
  technicianId?: string | null; laborCost?: number; partsCost?: number;
  totalCost: number; origen?: string | null; plan?: { id: string; code: string; title: string } | null;
};

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

// Sugerir cambio de estadío operativo de la unidad (con confirmación, nunca forzado)
const ESTADO_OP_LABEL: Record<string, string> = { OPERATIVO: 'Operativo', EN_TALLER: 'En taller', EN_REPARACION: 'En reparación' };
async function sugerirEstado(vehiculo: any, estadoSugerido: string, workOrderId?: string | null) {
  if (!vehiculo?.id) return;
  const actual = vehiculo.estadoOperativo ?? 'OPERATIVO';
  if (actual === estadoSugerido) return;
  if (!window.confirm(`¿Marcar la unidad ${vehiculo.dominio} como "${ESTADO_OP_LABEL[estadoSugerido]}"?`)) return;
  try {
    await apiFetch(`/fleet-ops/vehiculos/${vehiculo.id}/estado`, {
      method: 'POST',
      json: { estado: estadoSugerido, workOrderId: workOrderId || undefined },
    });
    vehiculo.estadoOperativo = estadoSugerido;
  } catch { /* el cambio de estadío es opcional */ }
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
      const [o, v, t] = await Promise.all([
        apiFetch<{ workOrders: WorkOrder[] }>('/maintenance/work-orders?scope=fleet'),
        apiFetch<{ vehiculos: any[] }>('/flota/vehiculos'),
        apiFetch<{ technicians: any[] }>('/maintenance/technicians?scope=fleet'),
      ]);
      setOrdenes(o.workOrders || []);
      setVehiculos(v.vehiculos || []);
      setTecnicos(t.technicians || []);
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
      technicianId: o.technicianId || o.technician?.id || '',
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
    setSaving(true);
    setError(null);
    try {
      const veh = vehiculos.find((v) => v.id === form.assetId);

      if (editId) {
        const actual = ordenes.find((o) => o.id === editId);
        await apiFetch(`/maintenance/work-orders/${editId}`, {
          method: 'PUT',
          json: {
            title: form.title,
            type: form.type,
            priority: form.priority,
            assetId: veh?.maintenanceAssetId || null,
            technicianId: form.technicianId || null,
            scheduledDate: form.scheduledDate ? new Date(`${form.scheduledDate}T12:00:00`).toISOString() : undefined,
            // Preservar costos: el backend recalcula totalCost = laborCost + partsCost
            laborCost: actual?.laborCost ?? 0,
            partsCost: actual?.partsCost ?? 0,
          },
        });
        cerrarModal();
        setForm({ title: '', type: 'CORRECTIVE', priority: 'MEDIUM', assetId: '', technicianId: '', scheduledDate: '' });
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
          technicianId: form.technicianId || undefined,
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

      // OT creada → sugerir pasar la unidad a En taller (si está operativa)
      if (veh && (veh.estadoOperativo ?? 'OPERATIVO') === 'OPERATIVO') {
        await sugerirEstado(veh, 'EN_TALLER', workOrderId);
      }

      cerrarModal();
      setForm({ title: '', type: 'CORRECTIVE', priority: 'MEDIUM', assetId: '', technicianId: '', scheduledDate: '' });
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
                  <td className="px-2.5 py-2 text-neutral-600">{o.technician?.name || '—'}</td>
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
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Mecánico</label>
                <select value={form.technicianId} onChange={(e) => setForm({ ...form, technicianId: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                  <option value="">Sin asignar</option>
                  {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
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
function DetalleOT({ orden, tecnicos, vehiculo, onClose, onChanged }: {
  orden: WorkOrder;
  tecnicos: any[];
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
  const [cierre, setCierre] = useState({ abierto: false, finalOdometer: '', laborCost: '', notas: '' });

  const abierta = ['PENDING', 'IN_PROGRESS', 'ON_HOLD'].includes(orden.status);

  const cargarParts = async () => {
    try {
      const res = await apiFetch<{ parts: any[] }>(`/maintenance/work-orders/${orden.id}/parts`);
      setParts(res.parts || []);
    } catch { /* sin repuestos */ }
  };

  useEffect(() => {
    cargarParts();
    apiFetch<{ parts: any[] }>('/maintenance/spare-parts').then((r) => setCatalogo(r.parts || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orden.id]);

  const actualizar = async (data: any) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/maintenance/work-orders/${orden.id}`, { method: 'PUT', json: data });
      // Sugerir cambio de estadío según la transición de la OT
      if (vehiculo?.id) {
        const actual = vehiculo.estadoOperativo ?? 'OPERATIVO';
        if (data.status === 'IN_PROGRESS' && actual !== 'EN_REPARACION') {
          await sugerirEstado(vehiculo, 'EN_REPARACION', orden.id);
        } else if (data.status === 'COMPLETED' && actual !== 'OPERATIVO') {
          await sugerirEstado(vehiculo, 'OPERATIVO', orden.id);
        }
      }
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

  const completar = () => actualizar({
    status: 'COMPLETED',
    laborCost: cierre.laborCost ? Number(cierre.laborCost) : 0,
    partsCost: orden.totalCost - 0, // el backend recalcula con repuestos descontados
    finalOdometer: cierre.finalOdometer ? Number(cierre.finalOdometer) : undefined,
    description: cierre.notas || undefined,
  });

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
            <div><p className="text-[11px] text-slate-500 uppercase">Responsable</p><p className="font-medium">{orden.technician?.name || 'Sin asignar'}</p></div>
            <div><p className="text-[11px] text-slate-500 uppercase">Costo</p><p className="font-medium">${(orden.totalCost || 0).toLocaleString('es-AR')}</p></div>
          </div>

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
                  <button disabled={busy} onClick={() => setCierre({ ...cierre, abierto: true })} className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
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
                <button disabled={busy} onClick={() => setCierre({ ...cierre, abierto: true })} className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Completar directo
                </button>
              )}
              <button disabled={busy} onClick={() => actualizar({ status: 'CANCELLED' })} className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                <Ban className="h-3.5 w-3.5" /> Cancelar OT
              </button>
            </div>
          )}

          {/* Formulario de cierre */}
          {cierre.abierto && abierta && (
            <div className="rounded-lg border border-green-200 bg-green-50/50 p-3.5 space-y-3">
              <p className="text-xs font-semibold text-green-800">Completar orden de trabajo</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-600 mb-1">Odómetro final (km)</label>
                  <input type="number" value={cierre.finalOdometer} onChange={(e) => setCierre({ ...cierre, finalOdometer: e.target.value })} placeholder={vehiculo?.currentOdometer ? `Actual: ${Math.round(vehiculo.currentOdometer)}` : 'Opcional'} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
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
              <p className="text-[11px] text-neutral-500">Al cerrar: se descuenta el stock de repuestos asignados, se actualiza el odómetro del vehículo y se libera el estado "en taller".</p>
            </div>
          )}

          {/* Asignar técnico */}
          {abierta && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-neutral-600 mb-1"><UserCog className="inline h-3 w-3 mr-1" />Asignar / reasignar técnico</label>
                <select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                  <option value="">Elegir técnico…</option>
                  {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <button disabled={busy || !tecnicoId} onClick={() => actualizar({ technicianId: tecnicoId })} className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">Asignar</button>
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
