'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Fuel, Plus } from 'lucide-react';
import CargaCombustible from '../_components/CargaCombustible';

type Registro = {
  id: string; fecha: string; litros: number | null; costoTotal: number | null; odometro: number | null;
  rendimiento: number | null; estacion: string | null; tipoCombustible: string;
  vehiculo?: { id: string; dominio: string; tipo: string } | null;
  conductor?: { id: string; nombre: string } | null;
};

export default function CombustiblePage() {
  const [data, setData] = useState<any>(null);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCarga, setShowCarga] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [dash, regs, veh] = await Promise.all([
        apiFetch<any>('/flota/dashboard'),
        apiFetch<{ registros: Registro[] }>('/flota/combustible'),
        apiFetch<{ vehiculos: any[] }>('/flota/vehiculos'),
      ]);
      setData(dash.flota?.combustible ? { ...dash.flota.combustible, top: dash.flota.topConsumidores } : null);
      setRegistros(regs.registros || []);
      setVehiculos((veh.vehiculos || []).filter((v) => v.tipo !== 'SEMI'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="p-8 text-sm text-neutral-500">Cargando…</div>;

  const hayDatos = data && data.litrosMes > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Combustible</h1>
          <p className="text-sm text-neutral-500">Cargas, rendimiento y odómetro — el registro de carga actualiza el kilometraje del vehículo</p>
        </div>
        <button onClick={() => setShowCarga(true)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Registrar carga
        </button>
      </div>

      {!hayDatos ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-400 text-center">Sin datos suficientes de combustible este mes — registrá la primera carga</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex items-center gap-2 text-neutral-500 text-xs font-medium uppercase mb-1"><Fuel className="h-3.5 w-3.5" /> Litros del mes</div>
            <p className="text-2xl font-semibold text-neutral-900">{data.litrosMes.toLocaleString('es-AR')} L</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="text-neutral-500 text-xs font-medium uppercase mb-1">Costo del mes</div>
            <p className="text-2xl font-semibold text-neutral-900">${data.costoMes.toLocaleString('es-AR')}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="text-neutral-500 text-xs font-medium uppercase mb-1">Rendimiento promedio</div>
            <p className="text-2xl font-semibold text-neutral-900">{data.promedioKmL != null ? `${data.promedioKmL} km/L` : 'Sin datos suficientes'}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="text-neutral-500 text-xs font-medium uppercase mb-1">L/100km</div>
            <p className="text-2xl font-semibold text-neutral-900">{data.l100km != null ? data.l100km : 'Sin datos suficientes'}</p>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <div className="px-4 py-2.5 border-b border-neutral-200 text-sm font-semibold text-neutral-800">Cargas recientes</div>
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
            <tr>
              <th className="text-left font-medium px-3 py-2">Fecha</th>
              <th className="text-left font-medium px-3 py-2">Vehículo</th>
              <th className="text-left font-medium px-3 py-2">Litros</th>
              <th className="text-left font-medium px-3 py-2">Odómetro</th>
              <th className="text-left font-medium px-3 py-2">Rendimiento</th>
              <th className="text-left font-medium px-3 py-2">Costo</th>
              <th className="text-left font-medium px-3 py-2">Conductor</th>
              <th className="text-left font-medium px-3 py-2">Estación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {registros.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-neutral-400">Sin cargas registradas</td></tr>}
            {registros.map((r) => (
              <tr key={r.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 text-neutral-600">{new Date(r.fecha).toLocaleDateString('es-AR')}</td>
                <td className="px-3 py-2 font-medium text-neutral-800">
                  {r.vehiculo ? <Link href={`/flota-360/vehiculos/${r.vehiculo.id}`} className="hover:text-blue-700">{r.vehiculo.dominio}</Link> : '—'}
                </td>
                <td className="px-3 py-2 text-neutral-600">{r.litros != null ? `${r.litros.toLocaleString('es-AR')} L` : '—'}</td>
                <td className="px-3 py-2 text-neutral-600">{r.odometro != null ? `${Math.round(r.odometro).toLocaleString('es-AR')} km` : '—'}</td>
                <td className="px-3 py-2 text-neutral-600">{r.rendimiento != null ? `${r.rendimiento} km/L` : '—'}</td>
                <td className="px-3 py-2 text-neutral-600">{r.costoTotal != null ? `$${Math.round(r.costoTotal).toLocaleString('es-AR')}` : '—'}</td>
                <td className="px-3 py-2 text-neutral-600">{r.conductor?.nombre || '—'}</td>
                <td className="px-3 py-2 text-neutral-600">{r.estacion || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hayDatos && (data.top || []).length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-neutral-200 text-sm font-semibold text-neutral-800">Top consumidores del mes</div>
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
              <tr><th className="text-left font-medium px-3 py-2">Vehículo</th><th className="text-left font-medium px-3 py-2">Litros</th><th className="text-left font-medium px-3 py-2">Costo</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {(data.top || []).map((v: any, i: number) => (
                <tr key={i}><td className="px-3 py-2 font-medium text-neutral-800">{v.dominio}</td><td className="px-3 py-2 text-neutral-600">{Math.round(v.litros)} L</td><td className="px-3 py-2 text-neutral-600">${Math.round(v.costo).toLocaleString('es-AR')}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCarga && (
        <CargaCombustible
          vehiculos={vehiculos}
          onClose={() => setShowCarga(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
