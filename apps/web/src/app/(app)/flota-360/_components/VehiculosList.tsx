'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Plus, X, Truck } from 'lucide-react';

type Vehiculo = {
  id: string; dominio: string; tipo: string; marca?: string; modelo?: string; anio?: number;
  status: string; currentOdometer?: number | null; conductorId?: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVO: 'bg-green-50 text-green-700', EN_TALLER: 'bg-amber-50 text-amber-700',
  INACTIVO: 'bg-neutral-100 text-neutral-600', BAJA: 'bg-red-50 text-red-600',
};

export default function VehiculosList({ modo }: { modo: 'flota' | 'semis' }) {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>({ dominio: '', tipo: modo === 'semis' ? 'SEMI' : 'CAMION', marca: '', modelo: '', anio: '' });
  const [saving, setSaving] = useState(false);
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

  const filtrados = vehiculos.filter((v) => (modo === 'semis' ? v.tipo === 'SEMI' : v.tipo !== 'SEMI'));

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
          marca: form.marca || undefined,
          modelo: form.modelo || undefined,
          anio: form.anio ? Number(form.anio) : undefined,
        },
      });
      setShowModal(false);
      setForm({ dominio: '', tipo: modo === 'semis' ? 'SEMI' : 'CAMION', marca: '', modelo: '', anio: '' });
      load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear');
    } finally {
      setSaving(false);
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

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
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
                  <Truck className="h-3.5 w-3.5 text-neutral-400" /> {v.dominio}
                </td>
                <td className="px-3 py-2 text-neutral-600">{v.tipo}</td>
                <td className="px-3 py-2 text-neutral-600">{[v.marca, v.modelo].filter(Boolean).join(' ') || '—'}</td>
                <td className="px-3 py-2 text-neutral-600">{v.currentOdometer != null ? `${Math.round(v.currentOdometer).toLocaleString('es-AR')} km` : '—'}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLOR[v.status] || 'bg-neutral-100'}`}>{v.status}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/flota-360/vehiculos/${v.id}`} className="text-xs text-blue-600 hover:underline">Ver ficha</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Tipo</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="CAMION">Camión</option>
                    <option value="TRACTOR">Tractor</option>
                    <option value="UTILITARIO">Utilitario</option>
                    <option value="OTRO">Otro</option>
                  </select>
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
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Año</label>
                <input type="number" value={form.anio} onChange={(e) => setForm({ ...form, anio: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
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
