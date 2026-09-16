'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus, X, Wrench, Zap, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, ScanLine, CalendarClock } from 'lucide-react';

type Rule = {
  id: string; nombre: string; categoria: string; tipoActivoAplicable: string;
  frecuenciaKm: number | null; frecuenciaDias: number | null; criticidad: string;
  duracionEstimada: number | null; accionVencimiento: string;
  repuestosRequeridos?: { sparePartId: string; cantidad: number }[];
  aplicaciones: { assetId: string; generatedPlanId: string | null }[];
};

type Alerta = {
  id: string; activo: { id: string; dominio: string; tipo: string } | null; componente: string;
  kmActual: number | null; proximoServicioKm: number | null; kmRestantes: number | null;
  diasRestantes: number | null; fechaEstimada: string | null; estado: 'VENCIDO' | 'URGENTE' | 'PROXIMO';
};

type CeldaPrograma = { estado: 'PROGRAMADO' | 'EJECUTADO' | 'VENCIDO' | 'QR'; titulo: string } | null;
type FilaPrograma = { vehiculoId: string; dominio: string; tipo: string; celdas: CeldaPrograma[] };
type Semana = { index: number; desde: string; hasta: string };

type RepuestoInv = {
  id: string; code: string; name: string; category: string | null;
  currentStock: number; minStock: number; reservado: number; disponible: number; estado: 'OK' | 'BAJO' | 'CRITICO';
};

const CRIT_COLOR: Record<string, string> = { BAJA: 'bg-neutral-100 text-neutral-600', MEDIA: 'bg-amber-50 text-amber-700', ALTA: 'bg-red-50 text-red-700' };
const ALERTA_COLOR: Record<string, string> = { VENCIDO: 'bg-red-50 text-red-700', URGENTE: 'bg-amber-50 text-amber-700', PROXIMO: 'bg-blue-50 text-blue-700' };
const ALERTA_LABEL: Record<string, string> = { VENCIDO: 'Vencido', URGENTE: 'Urgente', PROXIMO: 'Próximo' };
const REPUESTO_COLOR: Record<string, string> = { OK: 'bg-green-50 text-green-700', BAJO: 'bg-amber-50 text-amber-700', CRITICO: 'bg-red-50 text-red-700' };

function fmtFecha(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

export default function PlanesFrecuenciasClient() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [semanas, setSemanas] = useState<Semana[]>([]);
  const [filas, setFilas] = useState<FilaPrograma[]>([]);
  const [repuestos, setRepuestos] = useState<RepuestoInv[]>([]);
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [applyRule, setApplyRule] = useState<Rule | null>(null);
  const [applyAssetVeh, setApplyAssetVeh] = useState('');
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [form, setForm] = useState<any>({
    nombre: '', categoria: 'GENERAL', tipoActivoAplicable: 'TODOS',
    frecuenciaKm: '', frecuenciaDias: '', criticidad: 'MEDIA', duracionEstimada: '', accionVencimiento: 'ALERTA',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, a, prog, inv, v] = await Promise.all([
        apiFetch<{ rules: Rule[] }>('/fleet-ops/component-rules'),
        apiFetch<{ alertas: Alerta[] }>('/fleet-ops/alertas-servicio'),
        apiFetch<{ semanas: Semana[]; filas: FilaPrograma[] }>('/fleet-ops/programa-mantenimiento?semanas=6'),
        apiFetch<{ repuestos: RepuestoInv[] }>('/fleet-ops/repuestos-inventario'),
        apiFetch<{ vehiculos: any[] }>('/flota/vehiculos'),
      ]);
      setRules(r.rules || []);
      setAlertas(a.alertas || []);
      setSemanas(prog.semanas || []);
      setFilas(prog.filas || []);
      setRepuestos(inv.repuestos || []);
      setVehiculos(v.vehiculos || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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
          duracionEstimada: form.duracionEstimada ? Number(form.duracionEstimada) : undefined,
        },
      });
      setShowModal(false);
      setForm({ nombre: '', categoria: 'GENERAL', tipoActivoAplicable: 'TODOS', frecuenciaKm: '', frecuenciaDias: '', criticidad: 'MEDIA', duracionEstimada: '', accionVencimiento: 'ALERTA' });
      load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear la regla');
    } finally {
      setSaving(false);
    }
  };

  const aplicar = async () => {
    if (!applyRule || !applyAssetVeh) return;
    const veh = vehiculos.find((v) => v.id === applyAssetVeh);
    if (!veh?.maintenanceAssetId) { setError('Este vehículo no tiene un activo de mantenimiento vinculado'); return; }
    setSaving(true);
    try {
      await apiFetch(`/fleet-ops/component-rules/${applyRule.id}/aplicar`, { method: 'POST', json: { assetId: veh.maintenanceAssetId } });
      setApplyRule(null);
      setApplyAssetVeh('');
      load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-xs text-neutral-500">Cargando planes y frecuencias…</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0d1b3d]">Planes y frecuencias</h1>
          <p className="text-xs text-neutral-500">Define los mantenimientos por componente, controlá las frecuencias por km o tiempo, y mantené el stock de repuestos integrado al plan.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 shrink-0">
          <Plus className="h-3.5 w-3.5" /> Nuevo componente
        </button>
      </div>

      {/* Fila 1: Catálogo + Próximas alertas */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-3">
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800 flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" /> Catálogo de componentes</div>
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-2.5 py-1.5">Componente</th>
                <th className="text-left font-medium px-2.5 py-1.5">Regla de servicio</th>
                <th className="text-left font-medium px-2.5 py-1.5">Criticidad</th>
                <th className="text-left font-medium px-2.5 py-1.5">Hs. est.</th>
                <th className="text-left font-medium px-2.5 py-1.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rules.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-400">Sin componentes definidos</td></tr>}
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="px-2.5 py-2 font-medium text-neutral-800">{r.nombre}<div className="text-[11px] text-neutral-400">{r.categoria} · {r.tipoActivoAplicable}</div></td>
                  <td className="px-2.5 py-2 text-neutral-600">
                    {r.frecuenciaKm ? `Cada ${r.frecuenciaKm.toLocaleString('es-AR')} km` : ''}
                    {r.frecuenciaKm && r.frecuenciaDias ? ' o ' : ''}
                    {r.frecuenciaDias ? `${r.frecuenciaDias} días` : ''}
                    {!r.frecuenciaKm && !r.frecuenciaDias && '—'}
                    {r.repuestosRequeridos && r.repuestosRequeridos.length > 0 && (
                      <div className="text-[11px] text-neutral-400">{r.repuestosRequeridos.length} repuesto(s)</div>
                    )}
                  </td>
                  <td className="px-2.5 py-2"><span className={`inline-block rounded px-1.5 py-0.5 font-medium ${CRIT_COLOR[r.criticidad]}`}>{r.criticidad}</span></td>
                  <td className="px-2.5 py-2 text-neutral-600">{r.duracionEstimada ? `${r.duracionEstimada}h` : '—'}</td>
                  <td className="px-2.5 py-2 text-right">
                    <button onClick={() => setApplyRule(r)} className="inline-flex items-center gap-1 text-blue-600 hover:underline"><Zap className="h-3 w-3" /> Aplicar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Próximas alertas</div>
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-2.5 py-1.5">Activo</th>
                <th className="text-left font-medium px-2.5 py-1.5">Componente</th>
                <th className="text-left font-medium px-2.5 py-1.5">Faltan</th>
                <th className="text-left font-medium px-2.5 py-1.5">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {alertas.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-neutral-400">Sin alertas próximas</td></tr>}
              {alertas.slice(0, 8).map((a) => (
                <tr key={a.id} className="hover:bg-neutral-50">
                  <td className="px-2.5 py-2 font-medium text-neutral-800">{a.activo?.dominio || '—'}</td>
                  <td className="px-2.5 py-2 text-neutral-600">{a.componente}</td>
                  <td className="px-2.5 py-2 text-neutral-600">
                    {a.kmRestantes != null ? `${a.kmRestantes.toLocaleString('es-AR')} km` : a.diasRestantes != null ? `${a.diasRestantes} días` : '—'}
                  </td>
                  <td className="px-2.5 py-2"><span className={`inline-block rounded px-1.5 py-0.5 font-medium ${ALERTA_COLOR[a.estado]}`}>{ALERTA_LABEL[a.estado]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fila 2: Programa de mantenimientos + Inventario de repuestos */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-3">
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Programa de mantenimientos</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-2.5 py-1.5 sticky left-0 bg-neutral-50">Activo</th>
                  {semanas.map((s) => (
                    <th key={s.index} className="text-center font-medium px-2 py-1.5 min-w-[68px]">
                      Sem {new Date(s.desde).getDate()}/{new Date(s.desde).getMonth() + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filas.length === 0 && <tr><td colSpan={semanas.length + 1} className="px-3 py-6 text-center text-neutral-400">Sin OT programadas en el rango</td></tr>}
                {filas.map((f) => (
                  <tr key={f.vehiculoId} className="hover:bg-neutral-50">
                    <td className="px-2.5 py-2 font-medium text-neutral-800 sticky left-0 bg-white">{f.dominio}<div className="text-[11px] text-neutral-400">{f.tipo}</div></td>
                    {f.celdas.map((c, ci) => (
                      <td key={ci} className="px-2 py-2 text-center" title={c?.titulo || ''}>
                        {c?.estado === 'EJECUTADO' && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 inline" />}
                        {c?.estado === 'VENCIDO' && <AlertTriangle className="h-3.5 w-3.5 text-red-600 inline" />}
                        {c?.estado === 'PROGRAMADO' && <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />}
                        {c?.estado === 'QR' && <ScanLine className="h-3.5 w-3.5 text-purple-600 inline" />}
                        {!c && <span className="text-neutral-300">–</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-1.5 border-t border-neutral-100 flex items-center gap-3 text-[11px] text-neutral-500">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500 inline-block" /> Programado</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" /> Ejecutado</span>
            <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-600" /> Vencido</span>
            <span className="flex items-center gap-1"><ScanLine className="h-3 w-3 text-purple-600" /> Inspección QR</span>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800">Inventario de repuestos</div>
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-2.5 py-1.5">Repuesto</th>
                <th className="text-left font-medium px-2.5 py-1.5">Stock</th>
                <th className="text-left font-medium px-2.5 py-1.5">Reservado</th>
                <th className="text-left font-medium px-2.5 py-1.5">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {repuestos.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-neutral-400">Sin repuestos</td></tr>}
              {repuestos.slice(0, 8).map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50">
                  <td className="px-2.5 py-2 font-medium text-neutral-800">{p.name}<div className="text-[11px] text-neutral-400">{p.code}</div></td>
                  <td className="px-2.5 py-2 text-neutral-600">{p.currentStock} <span className="text-neutral-400">/ mín. {p.minStock}</span></td>
                  <td className="px-2.5 py-2 text-neutral-600">{p.reservado > 0 ? p.reservado : '—'}</td>
                  <td className="px-2.5 py-2"><span className={`inline-block rounded px-1.5 py-0.5 font-medium ${REPUESTO_COLOR[p.estado]}`}>{p.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <div className="px-3 py-2 border-b border-neutral-200 text-xs font-semibold text-neutral-800">Planes de mantenimiento activos</div>
        <table className="w-full text-xs">
          <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-2.5 py-1.5">Plan</th>
              <th className="text-left font-medium px-2.5 py-1.5">Activo</th>
              <th className="text-left font-medium px-2.5 py-1.5">Frecuencia</th>
              <th className="text-left font-medium px-2.5 py-1.5">Próxima ejecución</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rules.every((r) => r.aplicaciones.length === 0) && (
              <tr><td colSpan={4} className="px-3 py-4 text-center text-neutral-400">Sin planes vinculados a activos</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Nuevo componente</h2>
              <button onClick={() => setShowModal(false)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Nombre *</label>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Cambio de aceite de motor" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Categoría</label>
                  <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    {['MOTOR', 'FRENOS', 'NEUMATICOS', 'SUSPENSION', 'LUBRICACION', 'DOCUMENTACION', 'GENERAL'].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Aplica a</label>
                  <select value={form.tipoActivoAplicable} onChange={(e) => setForm({ ...form, tipoActivoAplicable: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    {['TODOS', 'TRACTOR', 'CAMION', 'UTILITARIO', 'SEMI', 'CONJUNTO'].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Frecuencia (km)</label>
                  <input type="number" value={form.frecuenciaKm} onChange={(e) => setForm({ ...form, frecuenciaKm: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Frecuencia (días)</label>
                  <input type="number" value={form.frecuenciaDias} onChange={(e) => setForm({ ...form, frecuenciaDias: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
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
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Duración estimada (h)</label>
                  <input type="number" value={form.duracionEstimada} onChange={(e) => setForm({ ...form, duracionEstimada: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
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
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setShowModal(false)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Cancelar</button>
              <button onClick={crear} disabled={saving} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {applyRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Aplicar "{applyRule.nombre}"</h2>
              <button onClick={() => setApplyRule(null)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <label className="block text-xs font-medium text-neutral-600 mb-1">Vehículo</label>
              <select value={applyAssetVeh} onChange={(e) => setApplyAssetVeh(e.target.value)} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                <option value="">Seleccionar…</option>
                {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.dominio}</option>)}
              </select>
              <p className="text-xs text-neutral-500">Esto crea o actualiza un Plan de Mantenimiento real vinculado a este vehículo, sin afectar planes existentes de otros activos.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setApplyRule(null)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Cancelar</button>
              <button onClick={aplicar} disabled={saving} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Aplicando…' : 'Aplicar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
