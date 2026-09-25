'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { VehicleArt } from './FleetVisual';
import { apiFetch } from '@/lib/api';
import { Plus, X, Truck, Container, Trash2 } from 'lucide-react';

type Vehiculo = {
  id: string; dominio: string; tipo: string; tipoCombustible?: string | null; marca?: string; modelo?: string; anio?: number;
  status: string; currentOdometer?: number | null; conductorId?: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVO: 'bg-green-50 text-green-700', EN_TALLER: 'bg-amber-50 text-amber-700',
  INACTIVO: 'bg-neutral-100 text-neutral-600', BAJA: 'bg-red-50 text-red-600',
};

export default function VehiculosList({ modo }: { modo: 'flota' | 'semis' }) {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<'visual' | 'tabla'>('visual');
  const [busqueda, setBusqueda] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>({ dominio: '', tipo: modo === 'semis' ? 'SEMI' : 'CAMION', tipoCombustible: 'DIESEL', marca: '', modelo: '', anio: '', currentOdometer: '', valorAdquisicion: '' });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ vehiculos: Vehiculo[] }>('/flota/vehiculos');
      setVehiculos(res.vehiculos || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtrados = vehiculos.filter((v) => (modo === 'semis' ? v.tipo === 'SEMI' : v.tipo !== 'SEMI') && `${v.dominio} ${v.marca || ''} ${v.modelo || ''}`.toLowerCase().includes(busqueda.toLowerCase()));

  const guardar = async () => {
    if (!form.dominio) { setError('El dominio es obligatorio'); return; }
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/flota/vehiculos', {
        method: 'POST',
        json: {
          dominio: form.dominio,
          tipo: modo === 'semis' ? 'SEMI' : (form.tipo || 'CAMION'),
          tipoCombustible: modo === 'semis' ? undefined : (form.tipoCombustible || 'DIESEL'),
          marca: form.marca || undefined,
          modelo: form.modelo || undefined,
          anio: form.anio ? Number(form.anio) : undefined,
          currentOdometer: form.currentOdometer !== '' && form.currentOdometer != null ? Number(form.currentOdometer) : undefined,
          valorAdquisicion: form.valorAdquisicion !== '' && form.valorAdquisicion != null ? Number(form.valorAdquisicion) : undefined,
        },
      });
      setShowModal(false);
      setForm({ dominio: '', tipo: modo === 'semis' ? 'SEMI' : 'CAMION', tipoCombustible: 'DIESEL', marca: '', modelo: '', anio: '', currentOdometer: '', valorAdquisicion: '' });
      load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear');
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (v: Vehiculo) => {
    if (!window.confirm(`¿Dar de baja la unidad ${v.dominio}? Quedará marcada como BAJA (el historial se conserva).`)) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/flota/vehiculos/${v.id}`, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo dar de baja la unidad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{modo === 'semis' ? 'Semis' : 'Vehículos'}</h1>
          <p className="text-sm text-neutral-500">
            {modo === 'semis' ? 'Semirremolques como activos independientes, con mantenimiento y QR propios' : 'Tractores, camiones y utilitarios de la flota'}
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> {modo === 'semis' ? 'Nuevo semi' : 'Nuevo vehículo'}
        </button>
      </div>

      <div className="flex justify-between gap-3 flex-wrap"><input aria-label="Buscar unidades" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar dominio, marca o modelo…" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm w-72" /><div className="flex gap-1 rounded-lg bg-slate-100 p-1">{(['visual', 'tabla'] as const).map(view => <button key={view} onClick={() => setVista(view)} aria-pressed={vista === view} className={`rounded-md px-4 py-1 text-xs ${vista === view ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}>{view === 'visual' ? 'Vista visual' : 'Tabla'}</button>)}</div></div>
      {error && !showModal && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</p>}
      {vista === 'visual' ? <div className="fleet-asset-grid">
        {loading && <p>Cargando unidades…</p>}
        {!loading && !filtrados.length && <p className="text-sm text-slate-500">Sin unidades para esta búsqueda.</p>}
        {filtrados.map(v => <Link key={v.id} href={`/flota-360/vehiculos/${v.id}`} className="fleet-panel hover:border-blue-300 transition-colors relative">
          <div className="flex items-center justify-between p-4"><strong className="text-lg">{v.dominio}</strong><span className="flex items-center gap-1.5"><span className={`rounded-full px-2 py-1 text-[10px] ${STATUS_COLOR[v.status] || 'bg-slate-100'}`}>{v.status.replaceAll('_', ' ')}</span>{v.status !== 'BAJA' && (<button disabled={busy} title="Dar de baja" onClick={(e) => { e.preventDefault(); e.stopPropagation(); eliminar(v); }} className="p-1 text-neutral-400 hover:text-red-600 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>)}</span></div>
          <div className="fleet-asset-art"><VehicleArt semi={v.tipo === 'SEMI'} /></div>
          <div className="p-4"><p className="font-semibold text-sm">{[v.marca, v.modelo].filter(Boolean).join(' ') || v.tipo}</p><p className="text-xs text-slate-500 mt-1">{v.tipo}{v.tipoCombustible === 'GNC' ? ' · GNC' : v.tipoCombustible === 'MIXTO' ? ' · Diésel+GNC' : ''} · {v.anio || 'Año sin informar'}</p><div className="flex justify-between border-t border-slate-100 mt-4 pt-3 text-xs"><span>{v.currentOdometer != null ? `${v.currentOdometer.toLocaleString('es-AR')} km` : 'Sin lectura'}</span><span className="text-blue-600 font-semibold">Ver gemelo digital →</span></div></div>
        </Link>)}
      </div> : <div className="rounded-lg border border-neutral-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Dominio</th>
              <th className="text-left font-medium px-3 py-2">Tipo</th>
              <th className="text-left font-medium px-3 py-2">Marca / Modelo</th>
              <th className="text-left font-medium px-3 py-2">Odómetro</th>
              <th className="text-left font-medium px-3 py-2">Estado</th>
              <th className="text-left font-medium px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && filtrados.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-400">Sin registros</td></tr>
            )}
            {filtrados.map((v) => (
              <tr key={v.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 font-medium text-neutral-800 flex items-center gap-2">
                  {v.tipo === 'SEMI'
                    ? <Container className="h-3.5 w-3.5 text-neutral-400" />
                    : <Truck className="h-3.5 w-3.5 text-neutral-400" />}
                  {v.dominio}
                </td>
                <td className="px-3 py-2 text-neutral-600">{v.tipo}{(v.tipoCombustible === 'GNC' || v.tipoCombustible === 'MIXTO') ? <span className="ml-1 rounded bg-teal-50 px-1 text-[10px] font-semibold text-teal-700">{v.tipoCombustible === 'MIXTO' ? 'D+GNC' : 'GNC'}</span> : null}</td>
                <td className="px-3 py-2 text-neutral-600">{[v.marca, v.modelo].filter(Boolean).join(' ') || '—'}</td>
                <td className="px-3 py-2 text-neutral-600">{v.currentOdometer != null ? `${Math.round(v.currentOdometer).toLocaleString('es-AR')} km` : '—'}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLOR[v.status] || 'bg-neutral-100'}`}>{v.status}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Link href={`/flota-360/vehiculos/${v.id}`} className="text-xs text-blue-600 hover:underline">Ver ficha</Link>
                    {v.status !== 'BAJA' && (
                      <button disabled={busy} title="Dar de baja" onClick={() => eliminar(v)} className="p-1 text-neutral-400 hover:text-red-600 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">{modo === 'semis' ? 'Nuevo semi' : 'Nuevo vehículo'}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Dominio / Identificación *</label>
                <input value={form.dominio} onChange={(e) => setForm({ ...form, dominio: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              {modo === 'flota' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Tipo</label>
                    <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                      <option value="CAMION">Camión</option>
                      <option value="TRACTOR">Tractor</option>
                      <option value="UTILITARIO">Utilitario</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Combustible</label>
                    <select value={form.tipoCombustible} onChange={(e) => setForm({ ...form, tipoCombustible: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                      <option value="DIESEL">Diésel</option>
                      <option value="MIXTO">Diésel + GNC (dual)</option>
                      <option value="GNC">Solo GNC</option>
                      <option value="NAFTA">Nafta</option>
                      <option value="ELECTRICO">Eléctrico</option>
                    </select>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Marca</label>
                  <input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Modelo</label>
                  <input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Año</label>
                  <input type="number" value={form.anio} onChange={(e) => setForm({ ...form, anio: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Odómetro (km)</label>
                  <input type="number" min={0} value={form.currentOdometer} onChange={(e) => setForm({ ...form, currentOdometer: e.target.value })} placeholder="0" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Valor adquisición ($)</label>
                  <input type="number" min={0} step="0.01" value={form.valorAdquisicion} onChange={(e) => setForm({ ...form, valorAdquisicion: e.target.value })} placeholder="Costo de compra" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setShowModal(false)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Guardando…' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
