'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Users } from 'lucide-react';

type Conductor = {
  id: string; nombre: string; dni: string | null; categoria: string | null;
  licenciaVto: string | null; psicofisicoVto: string | null; status: string;
};

function diasRestantes(fecha: string | null) {
  if (!fecha) return null;
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);
}

export default function ConductoresPage() {
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{ conductores: Conductor[] }>('/flota/conductores');
        setConductores(res.conductores || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Conductores</h1>
        <p className="text-sm text-neutral-500">Licencias y psicofísico — mismos datos que Infraestructura</p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Nombre</th>
              <th className="text-left font-medium px-3 py-2">DNI</th>
              <th className="text-left font-medium px-3 py-2">Categoría</th>
              <th className="text-left font-medium px-3 py-2">Vto. Licencia</th>
              <th className="text-left font-medium px-3 py-2">Vto. Psicofísico</th>
              <th className="text-left font-medium px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && conductores.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-400">Sin conductores registrados</td></tr>}
            {conductores.map((c) => {
              const dLic = diasRestantes(c.licenciaVto);
              const dPsico = diasRestantes(c.psicofisicoVto);
              return (
                <tr key={c.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 font-medium text-neutral-800 flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-neutral-400" />{c.nombre}</td>
                  <td className="px-3 py-2 text-neutral-600">{c.dni || '—'}</td>
                  <td className="px-3 py-2 text-neutral-600">{c.categoria || '—'}</td>
                  <td className={`px-3 py-2 ${dLic != null && dLic <= 30 ? 'text-amber-600 font-medium' : 'text-neutral-600'}`}>{c.licenciaVto ? new Date(c.licenciaVto).toLocaleDateString('es-AR') : '—'}</td>
                  <td className={`px-3 py-2 ${dPsico != null && dPsico <= 30 ? 'text-amber-600 font-medium' : 'text-neutral-600'}`}>{c.psicofisicoVto ? new Date(c.psicofisicoVto).toLocaleDateString('es-AR') : '—'}</td>
                  <td className="px-3 py-2 text-neutral-600">{c.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
