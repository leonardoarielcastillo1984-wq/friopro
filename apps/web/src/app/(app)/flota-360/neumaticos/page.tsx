'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Disc } from 'lucide-react';

type Neumatico = {
  id: string; codigo: string; marca: string | null; medida: string | null; status: string;
  condicion: string; profBanda: number | null; kmAcumulados: number;
};

const STATUS_COLOR: Record<string, string> = {
  DISPONIBLE: 'bg-green-50 text-green-700', EN_USO: 'bg-blue-50 text-blue-700', BAJA: 'bg-red-50 text-red-600',
};

export default function NeumaticosPage() {
  const [neumaticos, setNeumaticos] = useState<Neumatico[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{ neumaticos: Neumatico[] }>('/flota/neumaticos');
        setNeumaticos(res.neumaticos || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const enAlerta = neumaticos.filter((n) => (n.profBanda != null && n.profBanda < 3) || n.kmAcumulados > 80000);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Neumáticos</h1>
        <p className="text-sm text-neutral-500">Montaje, rotación, presión, daños, recaps y CPK — gestión completa en la sección "Vehículos" o desde Infraestructura</p>
      </div>

      {enAlerta.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          {enAlerta.length} neumáticos con banda baja o alto kilometraje acumulado
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Código</th>
              <th className="text-left font-medium px-3 py-2">Marca / Medida</th>
              <th className="text-left font-medium px-3 py-2">Condición</th>
              <th className="text-left font-medium px-3 py-2">Banda</th>
              <th className="text-left font-medium px-3 py-2">Km acumulados</th>
              <th className="text-left font-medium px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && neumaticos.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-400">Sin neumáticos registrados</td></tr>}
            {neumaticos.map((n) => (
              <tr key={n.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 font-medium text-neutral-800 flex items-center gap-1.5"><Disc className="h-3.5 w-3.5 text-neutral-400" />{n.codigo}</td>
                <td className="px-3 py-2 text-neutral-600">{[n.marca, n.medida].filter(Boolean).join(' · ') || '—'}</td>
                <td className="px-3 py-2 text-neutral-600">{n.condicion}</td>
                <td className={`px-3 py-2 ${n.profBanda != null && n.profBanda < 3 ? 'text-red-600 font-medium' : 'text-neutral-600'}`}>{n.profBanda != null ? `${n.profBanda} mm` : '—'}</td>
                <td className="px-3 py-2 text-neutral-600">{Math.round(n.kmAcumulados).toLocaleString('es-AR')} km</td>
                <td className="px-3 py-2"><span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_COLOR[n.status] || 'bg-neutral-100'}`}>{n.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
