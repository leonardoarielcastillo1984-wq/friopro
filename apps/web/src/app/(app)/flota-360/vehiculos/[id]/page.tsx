'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { ChevronLeft, Gauge, Wrench, ShieldCheck, ScanLine, AlertTriangle } from 'lucide-react';

export default function VehiculoFichaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [completo, setCompleto] = useState<any>(null);
  const [twin, setTwin] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [c, t] = await Promise.all([
          apiFetch<any>(`/flota/vehiculos/${id}/completo`),
          apiFetch<any>(`/flota/vehiculos/${id}/twin`).catch(() => null),
        ]);
        setCompleto(c);
        setTwin(t);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="p-8 text-sm text-neutral-500">Cargando ficha…</div>;
  if (!completo?.vehiculo) return <div className="p-8 text-sm text-neutral-500">Vehículo no encontrado</div>;

  const v = completo.vehiculo;
  const mant = completo.mantenimiento || {};
  const kpis = mant.kpis || {};
  const workOrders = mant.workOrders || [];
  const twinData = twin?.twin || null;
  const health = twinData?.healthScore ?? null;

  return (
    <div className="space-y-4">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">
        <ChevronLeft className="h-4 w-4" /> Volver
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
            {v.dominio}
            <span className="text-xs font-medium rounded-full bg-green-50 text-green-700 px-2 py-0.5">{v.status}</span>
          </h1>
          <p className="text-sm text-neutral-500">{[v.tipo, v.marca, v.modelo, v.anio].filter(Boolean).join(' · ')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs font-medium uppercase mb-1"><Gauge className="h-3.5 w-3.5" /> Odómetro</div>
          <p className="text-2xl font-semibold text-neutral-900">{v.currentOdometer != null ? Math.round(v.currentOdometer).toLocaleString('es-AR') : '—'} km</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs font-medium uppercase mb-1"><ShieldCheck className="h-3.5 w-3.5" /> Salud del activo</div>
          <p className="text-2xl font-semibold text-neutral-900">{health != null ? `${Math.round(health)}/100` : 'Sin datos suficientes'}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-2 text-neutral-500 text-xs font-medium uppercase mb-1"><Wrench className="h-3.5 w-3.5" /> Órdenes abiertas</div>
          <p className="text-2xl font-semibold text-neutral-900">{kpis.otsPendientes ?? 0}</p>
        </div>
      </div>

      {twinData?.alertas?.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
          {twinData.alertas.map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> <span className="font-medium">{a.componente}:</span> {a.mensaje}
            </div>
          ))}
        </div>
      )}

      {Array.isArray(workOrders) && (
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-neutral-200 text-sm font-semibold text-neutral-800">Órdenes de trabajo recientes</div>
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase">
              <tr>
                <th className="text-left font-medium px-3 py-2">Código</th>
                <th className="text-left font-medium px-3 py-2">Título</th>
                <th className="text-left font-medium px-3 py-2">Estado</th>
                <th className="text-left font-medium px-3 py-2">Costo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {workOrders.slice(0, 10).map((o: any) => (
                <tr key={o.id}>
                  <td className="px-3 py-2 font-medium text-neutral-800">{o.code}</td>
                  <td className="px-3 py-2 text-neutral-600">{o.title}</td>
                  <td className="px-3 py-2 text-neutral-600">{o.status}</td>
                  <td className="px-3 py-2 text-neutral-600">${(o.totalCost || 0).toLocaleString('es-AR')}</td>
                </tr>
              ))}
              {workOrders.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-neutral-400">Sin órdenes registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500 flex items-center gap-2">
        <ScanLine className="h-4 w-4" /> Historial de inspecciones QR, neumáticos y documentación: ver en las secciones dedicadas de Flota 360 filtrando por este dominio.
      </div>
    </div>
  );
}
