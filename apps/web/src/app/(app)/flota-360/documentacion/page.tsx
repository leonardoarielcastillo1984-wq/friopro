'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { FileWarning } from 'lucide-react';

type Vencimiento = {
  id: string; tipo: string; fechaVto: string; renovado: boolean;
  vehiculo?: { dominio: string } | null;
};

export default function DocumentacionPage() {
  const [vencimientos, setVencimientos] = useState<Vencimiento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{ vencimientos: Vencimiento[] }>('/flota/vencimientos');
        setVencimientos(res.vencimientos || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hoy = new Date();
  const ordenados = [...vencimientos].sort((a, b) => new Date(a.fechaVto).getTime() - new Date(b.fechaVto).getTime());

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Documentación y vencimientos</h1>
        <p className="text-sm text-neutral-500">VTV, seguros, habilitaciones y RUTA de toda la flota</p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Vehículo</th>
              <th className="text-left font-medium px-3 py-2">Documento</th>
              <th className="text-left font-medium px-3 py-2">Vencimiento</th>
              <th className="text-left font-medium px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={4} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && ordenados.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-neutral-400">Sin vencimientos registrados</td></tr>}
            {ordenados.map((v) => {
              const vencido = new Date(v.fechaVto) < hoy;
              const dias = Math.ceil((new Date(v.fechaVto).getTime() - hoy.getTime()) / 86400000);
              return (
                <tr key={v.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 font-medium text-neutral-800 flex items-center gap-1.5"><FileWarning className="h-3.5 w-3.5 text-neutral-400" />{v.vehiculo?.dominio || '—'}</td>
                  <td className="px-3 py-2 text-neutral-600">{v.tipo}</td>
                  <td className="px-3 py-2 text-neutral-600">{new Date(v.fechaVto).toLocaleDateString('es-AR')}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${vencido ? 'bg-red-50 text-red-700' : dias <= 30 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                      {vencido ? 'Vencido' : `${dias} días`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
