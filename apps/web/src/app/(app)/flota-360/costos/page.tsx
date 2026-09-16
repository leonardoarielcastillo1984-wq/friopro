'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react';

type Costos = {
  hayDatos: boolean; costoTotalMes: number; costoCombustible: number; costoMantenimiento: number;
  variacionVsMesAnterior: number | null; comparacionDisponible: boolean;
};

export default function CostosPage() {
  const [data, setData] = useState<Costos | null>(null);
  const [tco, setTco] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [c, t] = await Promise.all([
          apiFetch<Costos>('/fleet-ops/costos-ejecutivos'),
          apiFetch<any>('/flota/tco/analisis').catch(() => null),
        ]);
        setData(c);
        setTco(t?.vehiculos || t?.analisis || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !data) return <div className="p-8 text-sm text-neutral-500">Cargando…</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Costos y TCO</h1>
        <p className="text-sm text-neutral-500">Vista ejecutiva de costo de flota, agregada desde combustible, mantenimiento y OT existentes</p>
      </div>

      {!data.hayDatos ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-400 text-center">Sin datos suficientes de costos este mes</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex items-center gap-2 text-neutral-500 text-xs font-medium uppercase mb-1"><DollarSign className="h-3.5 w-3.5" /> Costo total del mes</div>
            <p className="text-2xl font-semibold text-neutral-900">${data.costoTotalMes.toLocaleString('es-AR')}</p>
            {data.comparacionDisponible && data.variacionVsMesAnterior != null ? (
              <p className={`text-xs mt-1 flex items-center gap-1 ${data.variacionVsMesAnterior <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.variacionVsMesAnterior <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                {Math.abs(data.variacionVsMesAnterior)}% vs. mes anterior
              </p>
            ) : (
              <p className="text-xs mt-1 text-neutral-400">Sin datos suficientes del período anterior para comparar</p>
            )}
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="text-neutral-500 text-xs font-medium uppercase mb-1">Combustible</div>
            <p className="text-2xl font-semibold text-neutral-900">${data.costoCombustible.toLocaleString('es-AR')}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="text-neutral-500 text-xs font-medium uppercase mb-1">Mantenimiento (OT)</div>
            <p className="text-2xl font-semibold text-neutral-900">${data.costoMantenimiento.toLocaleString('es-AR')}</p>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <div className="px-4 py-2.5 border-b border-neutral-200 text-sm font-semibold text-neutral-800">Costo por km por vehículo (TCO)</div>
        {tco.length === 0 ? (
          <p className="px-4 py-4 text-sm text-neutral-400">Sin datos suficientes de TCO</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
              <tr><th className="text-left font-medium px-3 py-2">Vehículo</th><th className="text-left font-medium px-3 py-2">Costo/km</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {tco.map((v: any, i: number) => (
                <tr key={i}><td className="px-3 py-2 font-medium text-neutral-800">{v.dominio || v.vehiculo}</td><td className="px-3 py-2 text-neutral-600">${v.costoPorKm?.toLocaleString('es-AR') || '—'}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
