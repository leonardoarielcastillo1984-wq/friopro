'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Package, AlertTriangle } from 'lucide-react';

type Parte = {
  id: string; code: string; name: string; category: string | null;
  currentStock: number; minStock: number; unitCost: number; location: string | null; supplier: string | null;
};

export default function RepuestosPage() {
  const [partes, setPartes] = useState<Parte[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{ parts: Parte[] }>('/maintenance/spare-parts');
        setPartes(res.parts || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtradas = partes.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase()));
  const bajoStock = partes.filter((p) => p.currentStock <= p.minStock);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Repuestos e inventario</h1>
          <p className="text-sm text-neutral-500">Mismo catálogo y stock que Mantenimiento — el descuento sigue ocurriendo solo al completar una OT o intervención QR</p>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar repuesto…" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm w-56" />
      </div>

      {bajoStock.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4" /> {bajoStock.length} repuestos con stock igual o por debajo del mínimo
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Código</th>
              <th className="text-left font-medium px-3 py-2">Nombre</th>
              <th className="text-left font-medium px-3 py-2">Categoría</th>
              <th className="text-left font-medium px-3 py-2">Stock</th>
              <th className="text-left font-medium px-3 py-2">Costo unit.</th>
              <th className="text-left font-medium px-3 py-2">Proveedor</th>
              <th className="text-left font-medium px-3 py-2">Ubicación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && filtradas.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-400">Sin repuestos</td></tr>}
            {filtradas.map((p) => (
              <tr key={p.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 font-medium text-neutral-800 flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-neutral-400" />{p.code}</td>
                <td className="px-3 py-2 text-neutral-700">{p.name}</td>
                <td className="px-3 py-2 text-neutral-600">{p.category || '—'}</td>
                <td className="px-3 py-2">
                  <span className={p.currentStock <= p.minStock ? 'text-red-600 font-medium' : 'text-neutral-700'}>{p.currentStock}</span>
                  <span className="text-neutral-400"> / mín. {p.minStock}</span>
                </td>
                <td className="px-3 py-2 text-neutral-600">${p.unitCost.toLocaleString('es-AR')}</td>
                <td className="px-3 py-2 text-neutral-600">{p.supplier || '—'}</td>
                <td className="px-3 py-2 text-neutral-600">{p.location || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
