'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { FileWarning, Plus, X, RefreshCw, Trash2 } from 'lucide-react';
import { DocsChoferPanel, IncidentesPanel, BitacoraPanel, ControlesPanel, JornadasPanel, LibroJornadaPanel } from '../_components/DriverHubPanels';

type Vencimiento = {
  id: string; tipo: string; fechaVto: string; renovado: boolean;
  vehiculoId?: string;
  vehiculo?: { id: string; dominio: string } | null;
};

const TIPOS_DOC = ['VTV', 'SEGURO', 'HABILITACION', 'RUTA', 'CNRT', 'SENASA', 'OTRO'];

type Tab = 'vencimientos' | 'docs' | 'incidentes' | 'bitacora' | 'controles' | 'jornadas' | 'libro';

export default function DocumentacionPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'vencimientos');
  const [vencimientos, setVencimientos] = useState<Vencimiento[]>([]);
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNuevo, setShowNuevo] = useState(false);
  const [renovar, setRenovar] = useState<Vencimiento | null>(null);
  const [form, setForm] = useState({ vehiculoId: '', tipo: 'VTV', fechaVto: '', notas: '' });
  const [nuevaFecha, setNuevaFecha] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [v, veh] = await Promise.all([
        apiFetch<{ vencimientos: Vencimiento[] }>('/flota/vencimientos'),
        apiFetch<{ vehiculos: any[] }>('/flota/vehiculos'),
      ]);
      setVencimientos(v.vencimientos || []);
      setVehiculos(veh.vehiculos || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const crear = async () => {
    if (!form.vehiculoId || !form.fechaVto) { setError('Vehículo y fecha son obligatorios'); return; }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/flota/vehiculos/${form.vehiculoId}/vencimientos`, {
        method: 'POST',
        json: { tipo: form.tipo, fechaVto: new Date(`${form.fechaVto}T12:00:00`).toISOString(), notas: form.notas || undefined },
      });
      setShowNuevo(false);
      setForm({ vehiculoId: '', tipo: 'VTV', fechaVto: '', notas: '' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear el vencimiento');
    } finally {
      setBusy(false);
    }
  };

  const confirmarRenovacion = async () => {
    if (!renovar) return;
    setBusy(true);
    setError(null);
    try {
      // Marcar el actual como renovado
      await apiFetch(`/flota/vencimientos/${renovar.id}`, { method: 'PATCH', json: { renovado: true } });
      // Si se indicó nueva fecha, crear el vencimiento siguiente
      if (nuevaFecha && renovar.vehiculoId) {
        await apiFetch(`/flota/vehiculos/${renovar.vehiculoId}/vencimientos`, {
          method: 'POST',
          json: { tipo: renovar.tipo, fechaVto: new Date(`${nuevaFecha}T12:00:00`).toISOString() },
        });
      }
      setRenovar(null);
      setNuevaFecha('');
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo renovar');
    } finally {
      setBusy(false);
    }
  };

  const eliminar = async (id: string) => {
    setBusy(true);
    try {
      await apiFetch(`/flota/vencimientos/${id}`, { method: 'DELETE' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const hoy = new Date();
  const activos = vencimientos.filter((v) => !v.renovado);
  const ordenados = [...activos].sort((a, b) => new Date(a.fechaVto).getTime() - new Date(b.fechaVto).getTime());

  const TABS: { id: Tab; label: string }[] = [
    { id: 'vencimientos', label: 'Vencimientos' },
    { id: 'docs', label: 'Docs chofer' },
    { id: 'incidentes', label: 'Incidentes' },
    { id: 'bitacora', label: 'Bitácora' },
    { id: 'jornadas', label: 'Jornadas' },
    { id: 'libro', label: 'Libro de jornada' },
    { id: 'controles', label: 'Controles pre-servicio' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Documentación y vencimientos</h1>
          <p className="text-sm text-neutral-500">VTV, seguros, habilitaciones, docs para choferes e incidentes en ruta</p>
        </div>
        {tab === 'vencimientos' && (
          <button onClick={() => setShowNuevo(true)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Nuevo vencimiento
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-neutral-200">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'docs' && <DocsChoferPanel vehiculos={vehiculos} />}
      {tab === 'incidentes' && <IncidentesPanel />}
      {tab === 'bitacora' && <BitacoraPanel vehiculos={vehiculos} />}
      {tab === 'jornadas' && <JornadasPanel />}
      {tab === 'libro' && <LibroJornadaPanel />}
      {tab === 'controles' && <ControlesPanel vehiculos={vehiculos} />}

      {tab === 'vencimientos' && <>
      {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Vehículo</th>
              <th className="text-left font-medium px-3 py-2">Documento</th>
              <th className="text-left font-medium px-3 py-2">Vencimiento</th>
              <th className="text-left font-medium px-3 py-2">Estado</th>
              <th className="text-left font-medium px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && ordenados.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-400">Sin vencimientos registrados</td></tr>}
            {ordenados.map((v) => {
              const vencido = new Date(v.fechaVto) < hoy;
              const dias = Math.ceil((new Date(v.fechaVto).getTime() - hoy.getTime()) / 86400000);
              return (
                <tr key={v.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 font-medium text-neutral-800">
                    <span className="flex items-center gap-1.5"><FileWarning className="h-3.5 w-3.5 text-neutral-400" />{v.vehiculo?.dominio || '—'}</span>
                  </td>
                  <td className="px-3 py-2 text-neutral-600">{v.tipo}</td>
                  <td className="px-3 py-2 text-neutral-600">{new Date(v.fechaVto).toLocaleDateString('es-AR')}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${vencido ? 'bg-red-50 text-red-700' : dias <= 30 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                      {vencido ? 'Vencido' : `${dias} días`}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button disabled={busy} onClick={() => { setRenovar(v); setNuevaFecha(''); }} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline disabled:opacity-50">
                        <RefreshCw className="h-3 w-3" /> Renovar
                      </button>
                      <button disabled={busy} onClick={() => eliminar(v.id)} className="text-red-400 hover:text-red-600 disabled:opacity-50" title="Eliminar">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>}

      {/* Modal nuevo vencimiento */}
      {showNuevo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Nuevo vencimiento</h2>
              <button onClick={() => setShowNuevo(false)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Vehículo *</label>
                <select value={form.vehiculoId} onChange={(e) => setForm({ ...form, vehiculoId: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                  <option value="">Seleccionar…</option>
                  {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.dominio} ({v.tipo})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Documento</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    {TIPOS_DOC.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Vence *</label>
                  <input type="date" value={form.fechaVto} onChange={(e) => setForm({ ...form, fechaVto: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Notas</label>
                <input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setShowNuevo(false)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">Cancelar</button>
              <button onClick={crear} disabled={busy} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{busy ? 'Guardando…' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal renovar */}
      {renovar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Renovar {renovar.tipo} — {renovar.vehiculo?.dominio}</h2>
              <button onClick={() => setRenovar(null)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-neutral-500">Se marca el documento actual como renovado. Si cargás la nueva fecha, se crea el próximo vencimiento automáticamente.</p>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Nueva fecha de vencimiento</label>
                <input type="date" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setRenovar(null)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">Cancelar</button>
              <button onClick={confirmarRenovacion} disabled={busy} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{busy ? 'Guardando…' : 'Confirmar renovación'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
