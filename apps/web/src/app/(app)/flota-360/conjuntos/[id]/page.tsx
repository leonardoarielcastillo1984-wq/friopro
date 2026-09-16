'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { ChevronLeft, Truck, DollarSign } from 'lucide-react';

export default function ConjuntoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [conjunto, setConjunto] = useState<any>(null);
  const [costos, setCostos] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [c, k] = await Promise.all([
          apiFetch<any>(`/fleet-ops/conjuntos/${id}`),
          apiFetch<any>(`/fleet-ops/conjuntos/${id}/costos`).catch(() => null),
        ]);
        setConjunto(c.conjunto);
        setCostos(k);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="p-8 text-sm text-neutral-500">Cargando conjunto…</div>;
  if (!conjunto) return <div className="p-8 text-sm text-neutral-500">Conjunto no encontrado</div>;

  return (
    <div className="space-y-4">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">
        <ChevronLeft className="h-4 w-4" /> Volver
      </button>

      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Tractor + Semi: conjunto operativo</h1>
        <p className="text-sm text-neutral-500">{conjunto.tractor.dominio} + {conjunto.semi.dominio} · {conjunto.estado}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[{ label: 'Tractor', v: conjunto.tractor }, { label: 'Semi', v: conjunto.semi }].map(({ label, v }) => (
          <div key={label} className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-neutral-900">{label} {v.dominio}</span>
              <span className="text-xs font-medium rounded-full bg-green-50 text-green-700 px-2 py-0.5">{v.status}</span>
            </div>
            <p className="text-sm text-neutral-500">Km acumulados: {v.currentOdometer != null ? Math.round(v.currentOdometer).toLocaleString('es-AR') : '—'}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-neutral-800">Costos del conjunto ({costos?.periodo || '—'})</h3>
        </div>
        {!costos?.hayDatos ? (
          <p className="text-sm text-neutral-400">Sin datos suficientes para este período</p>
        ) : (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><p className="text-neutral-500 text-xs">Tractor</p><p className="font-semibold text-neutral-900">${costos.costoTractor.toLocaleString('es-AR')}</p></div>
            <div><p className="text-neutral-500 text-xs">Semi</p><p className="font-semibold text-neutral-900">${costos.costoSemi.toLocaleString('es-AR')}</p></div>
            <div><p className="text-neutral-500 text-xs">Combustible</p><p className="font-semibold text-neutral-900">${costos.costoCombustible.toLocaleString('es-AR')}</p></div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <div className="px-4 py-2.5 border-b border-neutral-200 text-sm font-semibold text-neutral-800">Historial de acople</div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-neutral-100">
            {(conjunto.eventos || []).map((e: any) => (
              <tr key={e.id}>
                <td className="px-4 py-2 text-neutral-600">{new Date(e.fecha).toLocaleString('es-AR')}</td>
                <td className="px-4 py-2">
                  <span className={`font-medium ${e.tipo === 'ACOPLE' ? 'text-green-700' : 'text-red-600'}`}>{e.tipo === 'ACOPLE' ? 'Acoplado' : 'Desacoplado'}</span>
                </td>
                <td className="px-4 py-2 text-neutral-500">{e.ubicacion || '—'}</td>
              </tr>
            ))}
            {(conjunto.eventos || []).length === 0 && (
              <tr><td className="px-4 py-4 text-center text-neutral-400">Sin eventos registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
