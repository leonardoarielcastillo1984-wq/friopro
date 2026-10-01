'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Briefcase, Plus, X, Truck, DollarSign } from 'lucide-react';
import { Hint } from '../_components/Hint';

function fmtMoney(n: number | null | undefined) {
  return n != null ? `$${Math.round(n).toLocaleString('es-AR')}` : '—';
}

const MODALIDAD_LABEL: Record<string, string> = {
  POR_DIA: 'por día', POR_MES: 'por mes', POR_KM: 'por km', VIAJE: 'por viaje',
};
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

type ServicioRent = {
  id: string; nombre: string; cliente: string | null; tipo: string;
  modalidadCobro: string; monto: number | null; kmEstimadosDia: number | null;
  diasSemana: number[] | null; origen: string | null; destino: string | null; activo: boolean;
  unidades: {
    vehiculoId: string; dominio: string; tipo: string; desde: string; hasta: string | null;
    vigente: boolean; diasAsignados: number; horasServicio: number | null; kmEstimados: number;
    ingresoTeorico: number | null; ingresoReal: number; costo: number; margen: number;
  }[];
  totales: { diasAsignados: number; horasServicio: number | null; kmEstimados: number; ingresoTeorico: number | null; ingresoReal: number; costos: number; margen: number };
};

type Servicio = {
  id: string; nombre: string; cliente: string | null; tipo: string; modalidadCobro: string;
  monto: number | null; kmEstimadosDia: number | null; origen: string | null; destino: string | null;
  diasSemana: number[] | null; activo: boolean; notas: string | null;
  unidades: { id: string; vehiculoId: string; desde: string; hasta: string | null; vehiculo: { id: string; dominio: string; tipo: string } }[];
};

const FORM_VACIO = {
  nombre: '', cliente: '', tipo: 'FIJO' as 'FIJO' | 'PUNTUAL',
  modalidadCobro: 'POR_DIA' as 'POR_DIA' | 'POR_MES' | 'POR_KM' | 'VIAJE',
  monto: '', kmEstimadosDia: '', origen: '', destino: '', notas: '',
  diasSemana: [1, 2, 3, 4, 5] as number[],
};

export default function ServiciosPage() {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [rentabilidad, setRentabilidad] = useState<Map<string, ServicioRent>>(new Map());
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [dias, setDias] = useState(30);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [asignar, setAsignar] = useState<{ servicioId: string; vehiculoIds: string[] } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - dias * 86400000);
    const [s, r, v] = await Promise.all([
      apiFetch<{ servicios: Servicio[] }>('/flota/servicios'),
      apiFetch<{ servicios: ServicioRent[] }>(`/fleet-ops/servicios-rentabilidad?desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`).catch(() => ({ servicios: [] })),
      apiFetch<{ vehiculos: any[] }>('/flota/vehiculos').catch(() => ({ vehiculos: [] })),
    ]);
    setServicios(s.servicios);
    setRentabilidad(new Map<string, ServicioRent>(r.servicios.map((x) => [x.id, x] as [string, ServicioRent])));
    setVehiculos(v.vehiculos || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [dias]);

  const guardar = async () => {
    setSaving(true);
    await apiFetch('/flota/servicios', {
      method: 'POST',
      body: JSON.stringify({
        nombre: form.nombre,
        cliente: form.cliente || null,
        tipo: form.tipo,
        modalidadCobro: form.modalidadCobro,
        monto: form.monto ? Number(form.monto) : null,
        kmEstimadosDia: form.kmEstimadosDia ? Number(form.kmEstimadosDia) : null,
        origen: form.origen || null,
        destino: form.destino || null,
        notas: form.notas || null,
        diasSemana: form.diasSemana.length ? form.diasSemana : null,
      }),
    });
    setSaving(false);
    setModal(false);
    setForm(FORM_VACIO);
    load();
  };

  const asignarUnidad = async () => {
    if (!asignar || !asignar.vehiculoIds.length) return;
    setSaving(true);
    await apiFetch(`/flota/servicios/${asignar.servicioId}/unidades`, {
      method: 'POST',
      body: JSON.stringify({ vehiculoIds: asignar.vehiculoIds }),
    });
    setSaving(false);
    setAsignar(null);
    load();
  };

  const cerrarAsignacion = async (asignacionId: string) => {
    if (!confirm('¿Cerrar esta asignación? La unidad deja de cubrir el servicio desde hoy.')) return;
    await apiFetch(`/flota/servicios/asignaciones/${asignacionId}`, { method: 'PATCH', body: JSON.stringify({}) });
    load();
  };

  const desactivar = async (id: string) => {
    if (!confirm('¿Desactivar el servicio? El historial queda guardado.')) return;
    await apiFetch(`/flota/servicios/${id}`, { method: 'DELETE' });
    load();
  };

  if (loading) return <p className="text-sm text-neutral-400 p-4">Cargando servicios…</p>;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-blue-700" />
          <h1 className="text-lg font-bold text-neutral-900">Servicios comerciales</h1>
          <Hint text="Contratos o servicios recurrentes (ej. 'Toyota — diario'). Asignás unidades una vez y el sistema mide la rentabilidad del servicio solo: tarifa × días + ingresos reales − costos prorrateados." />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Período:</span>
          {[30, 60, 90].map((d) => (
            <button key={d} onClick={() => setDias(d)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${dias === d ? 'bg-blue-600 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}>
              {d}d
            </button>
          ))}
          <button onClick={() => setModal(true)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 inline-flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" /> Nuevo servicio
          </button>
        </div>
      </div>

      {servicios.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center">
          <Briefcase className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
          <p className="text-sm text-neutral-500">Todavía no hay servicios dados de alta.</p>
          <p className="text-xs text-neutral-400 mt-1">Ejemplo: "Toyota — distribución diaria", con tarifa por día y unidades asignadas.</p>
        </div>
      )}

      {servicios.map((s) => {
        const rent = rentabilidad.get(s.id);
        const vigentes = s.unidades.filter((u) => !u.hasta);
        return (
          <div key={s.id} className={`rounded-lg border bg-white overflow-hidden ${s.activo ? 'border-neutral-200' : 'border-neutral-200 opacity-60'}`}>
            {/* Cabecera del servicio */}
            <div className="px-3 py-2.5 border-b border-neutral-100 flex items-center gap-3 flex-wrap">
              <div className="min-w-0">
                <span className="font-semibold text-sm text-neutral-900">{s.nombre}</span>
                {s.cliente && <span className="ml-2 text-xs text-neutral-500">· {s.cliente}</span>}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${s.tipo === 'FIJO' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>{s.tipo}</span>
                  {s.monto && <span className="text-[10px] text-neutral-500">{fmtMoney(s.monto)} {MODALIDAD_LABEL[s.modalidadCobro]}</span>}
                  {s.origen && s.destino && <span className="text-[10px] text-neutral-400">{s.origen} → {s.destino}</span>}
                  {s.diasSemana && <span className="text-[10px] text-neutral-400">{s.diasSemana.map((d) => DIAS_SEMANA[d - 1]).join('·')}</span>}
                  {!s.activo && <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] font-semibold text-neutral-500">INACTIVO</span>}
                </div>
              </div>
              {rent && (
                <div className="ml-auto flex items-center gap-4 text-xs">
                  <span className="text-neutral-500">Ing. real <b className="text-green-700">{fmtMoney(rent.totales.ingresoReal)}</b></span>
                  {rent.totales.ingresoTeorico != null && <span className="text-neutral-500" title="Tarifa × días asignados">teórico <b className="text-blue-700">{fmtMoney(rent.totales.ingresoTeorico)}</b></span>}
                  <span className="text-neutral-500">Costos <b className="text-red-600">{fmtMoney(rent.totales.costos)}</b></span>
                  <span className={`font-bold ${rent.totales.margen >= 0 ? 'text-green-700' : 'text-red-600'}`} title="Ingreso real (o teórico si no hay) − costos prorrateados">
                    Margen {fmtMoney(rent.totales.margen)}
                  </span>
                </div>
              )}
              <button onClick={() => setAsignar({ servicioId: s.id, vehiculoIds: [] })}
                className="rounded-md border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50 inline-flex items-center gap-1">
                <Truck className="h-3 w-3" /> Asignar unidad
              </button>
              {s.activo && (
                <button onClick={() => desactivar(s.id)} className="text-[10px] text-neutral-400 hover:text-red-500" title="Desactivar servicio">✕</button>
              )}
            </div>

            {/* Unidades asignadas */}
            {s.unidades.length === 0 ? (
              <p className="px-3 py-3 text-xs text-neutral-400">Sin unidades asignadas — asigná una para empezar a medir.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] font-medium text-neutral-500 uppercase border-b border-neutral-50">
                    <th className="px-3 py-1.5">Unidad</th>
                    <th className="px-3 py-1.5">Vigencia</th>
                    <th className="px-3 py-1.5 text-right">Días</th>
                    <th className="px-3 py-1.5 text-right">Km est.</th>
                    <th className="px-3 py-1.5 text-right"><span className="inline-flex items-center gap-0.5">Ing. teórico <Hint text="Tarifa del servicio × días asignados (o por km/mes según modalidad)" /></span></th>
                    <th className="px-3 py-1.5 text-right"><span className="inline-flex items-center gap-0.5">Ing. real <Hint text="Ingresos registrados de la unidad vinculados a este servicio o al mismo cliente" /></span></th>
                    <th className="px-3 py-1.5 text-right"><span className="inline-flex items-center gap-0.5">Costo <Hint text="Costos de la unidad prorrateados por los días que estuvo asignada (variables + cuota + sueldo)" /></span></th>
                    <th className="px-3 py-1.5 text-right">Margen</th>
                    <th className="px-3 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {s.unidades.map((u) => {
                    const ru = rent?.unidades.find((x) => x.vehiculoId === u.vehiculoId);
                    return (
                      <tr key={u.id} className={`border-b border-neutral-50 ${!u.hasta ? '' : 'opacity-50'}`}>
                        <td className="px-3 py-2">
                          <Link href={`/flota-360/vehiculos/${u.vehiculoId}`} className="font-medium text-blue-700 hover:underline">{u.vehiculo.dominio}</Link>
                          <span className="text-neutral-400 text-[10px]"> · {u.vehiculo.tipo === 'CAMION' ? 'Tractor' : u.vehiculo.tipo}</span>
                          {!u.hasta && <span className="ml-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-semibold text-green-700">VIGENTE</span>}
                        </td>
                        <td className="px-3 py-2 text-neutral-500">
                          {new Date(u.desde).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                          {' → '}{u.hasta ? new Date(u.hasta).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : 'hoy'}
                        </td>
                        <td className="px-3 py-2 text-right" title={ru?.horasServicio != null ? `${ru.horasServicio}h de tramo reales en el servicio` : undefined}>
                          {ru?.diasAsignados ?? '—'}{ru?.horasServicio != null ? ` (${ru.horasServicio}h)` : ''}
                        </td>
                        <td className="px-3 py-2 text-right">{ru?.kmEstimados ? ru.kmEstimados.toLocaleString('es-AR') : '—'}</td>
                        <td className="px-3 py-2 text-right text-blue-700">{ru?.ingresoTeorico != null ? fmtMoney(ru.ingresoTeorico) : '—'}</td>
                        <td className="px-3 py-2 text-right text-green-700">{ru ? fmtMoney(ru.ingresoReal) : '—'}</td>
                        <td className="px-3 py-2 text-right text-red-600">{ru ? fmtMoney(ru.costo) : '—'}</td>
                        <td className={`px-3 py-2 text-right font-bold ${(ru?.margen ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>{ru ? fmtMoney(ru.margen) : '—'}</td>
                        <td className="px-3 py-2 text-right">
                          {!u.hasta && (
                            <button onClick={() => cerrarAsignacion(u.id)} className="text-[10px] text-neutral-400 hover:text-red-500" title="Cerrar asignación (la unidad deja de cubrir el servicio)">
                              cerrar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {/* Modal nuevo servicio */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setModal(false)}>
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5"><Briefcase className="h-4 w-4 text-blue-600" /> Nuevo servicio</h3>
              <button onClick={() => setModal(false)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Nombre *</label>
                  <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Toyota — distribución diaria" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Cliente</label>
                  <input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} placeholder="Toyota" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Tipo</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as any })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="FIJO">Fijo (recurrente)</option>
                    <option value="PUNTUAL">Puntual (viaje/evento)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Cobro</label>
                  <select value={form.modalidadCobro} onChange={(e) => setForm({ ...form, modalidadCobro: e.target.value as any })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="POR_DIA">Por día</option>
                    <option value="POR_MES">Por mes</option>
                    <option value="POR_KM">Por km</option>
                    <option value="VIAJE">Por viaje (ingresos reales)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Tarifa $</label>
                  <input type="number" min={0} value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                {form.modalidadCobro === 'POR_KM' && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Km/día estimados</label>
                    <input type="number" min={0} value={form.kmEstimadosDia} onChange={(e) => setForm({ ...form, kmEstimadosDia: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Origen</label>
                  <input value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Destino</label>
                  <input value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              {form.tipo === 'FIJO' && (
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Días que corre</label>
                  <div className="flex gap-1.5">
                    {DIAS_SEMANA.map((d, i) => (
                      <button key={d} type="button"
                        onClick={() => setForm({ ...form, diasSemana: form.diasSemana.includes(i + 1) ? form.diasSemana.filter((x) => x !== i + 1) : [...form.diasSemana, i + 1].sort() })}
                        className={`rounded-md px-2 py-1 text-[11px] font-medium ${form.diasSemana.includes(i + 1) ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-500'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Notas</label>
                <input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              <button onClick={guardar} disabled={saving || !form.nombre}
                className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
                {saving ? 'Guardando…' : 'Crear servicio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal asignar unidad */}
      {asignar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setAsignar(null)}>
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5"><Truck className="h-4 w-4 text-blue-600" /> Asignar unidades</h3>
              <button onClick={() => setAsignar(null)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="max-h-64 overflow-y-auto rounded-md border border-neutral-200 divide-y divide-neutral-100">
                {vehiculos.map((v: any) => {
                  const sel = asignar.vehiculoIds.includes(v.id);
                  return (
                    <label key={v.id} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-xs ${sel ? 'bg-blue-50' : 'hover:bg-neutral-50'}`}>
                      <input type="checkbox" checked={sel} className="rounded"
                        onChange={() => setAsignar({ ...asignar, vehiculoIds: sel ? asignar.vehiculoIds.filter((x) => x !== v.id) : [...asignar.vehiculoIds, v.id] })} />
                      <span className="font-medium text-neutral-800">{v.dominio}</span>
                      <span className="text-neutral-400">{v.tipo === 'CAMION' ? 'Tractor' : v.tipo}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-neutral-500">Podés elegir varias. Cada asignación queda vigente desde hoy y registra el historial de días trabajados para el servicio. El chofer también puede tomarla solo desde su QR al iniciar la jornada.</p>
              <button onClick={asignarUnidad} disabled={saving || !asignar.vehiculoIds.length}
                className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
                {saving ? 'Asignando…' : `Asignar ${asignar.vehiculoIds.length || ''} unidad${asignar.vehiculoIds.length === 1 ? '' : 'es'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
