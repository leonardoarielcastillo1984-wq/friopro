'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Fuel } from 'lucide-react';

export default function CombustiblePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch<any>('/flota/dashboard');
        setData(res.flota?.combustible ? { ...res.flota.combustible, top: res.flota.topConsumidores } : null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-8 text-sm text-neutral-500">Cargando…</div>;

  const hayDatos = data && data.litrosMes > 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Combustible</h1>
        <p className="text-sm text-neutral-500">Consumo del mes en curso, agregado desde los registros de carga existentes</p>
      </div>

      {!hayDatos ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-400 text-center">Sin datos suficientes de combustible este mes</div>
      ) : (
        <>
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
                {(!data.top || data.top.length === 0) && <tr><td colSpan={3} className="px-3 py-4 text-center text-neutral-400">Sin registros este mes</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
