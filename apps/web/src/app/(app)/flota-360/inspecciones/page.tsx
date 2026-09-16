'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { ScanLine, ExternalLink } from 'lucide-react';

type Inspeccion = {
  id: string; activoNombre: string; dominioTractor: string | null; dominioSemi: string | null;
  estado: string; puntaje: number | null; hallazgosCount: number; createdAt: string;
  qr?: { plantilla?: { nombre: string; categoria: string } };
};

const ESTADO_COLOR: Record<string, string> = {
  COMPLETA: 'bg-green-50 text-green-700', CON_HALLAZGOS: 'bg-amber-50 text-amber-700',
  CRITICA: 'bg-red-50 text-red-700', INCOMPLETA: 'bg-neutral-100 text-neutral-600',
};

export default function InspeccionesQRPage() {
  const [inspecciones, setInspecciones] = useState<Inspeccion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{ inspecciones: Inspeccion[] }>('/inspecciones?limit=50');
        setInspecciones(res.inspecciones || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Inspecciones QR</h1>
          <p className="text-sm text-neutral-500">Datos del sistema de Inspecciones Inteligentes existente — flujo, tokens y checklists intactos</p>
        </div>
        <Link href="/infraestructura?tab=inspecciones" className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
          <ExternalLink className="h-4 w-4" /> Gestionar plantillas y QRs
        </Link>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Fecha</th>
              <th className="text-left font-medium px-3 py-2">Activo / Dominio</th>
              <th className="text-left font-medium px-3 py-2">Plantilla</th>
              <th className="text-left font-medium px-3 py-2">Estado</th>
              <th className="text-left font-medium px-3 py-2">Hallazgos</th>
              <th className="text-left font-medium px-3 py-2">Puntaje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && inspecciones.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-400">Sin inspecciones registradas</td></tr>}
            {inspecciones.map((i) => (
              <tr key={i.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 text-neutral-600">{new Date(i.createdAt).toLocaleDateString('es-AR')}</td>
                <td className="px-3 py-2 text-neutral-800 font-medium flex items-center gap-1.5">
                  <ScanLine className="h-3.5 w-3.5 text-neutral-400" />
                  {i.activoNombre}{i.dominioTractor ? ` · ${i.dominioTractor}` : ''}{i.dominioSemi ? ` + ${i.dominioSemi}` : ''}
                </td>
                <td className="px-3 py-2 text-neutral-600">{i.qr?.plantilla?.nombre || '—'}</td>
                <td className="px-3 py-2"><span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${ESTADO_COLOR[i.estado] || 'bg-neutral-100'}`}>{i.estado}</span></td>
                <td className="px-3 py-2 text-neutral-600">{i.hallazgosCount}</td>
                <td className="px-3 py-2 text-neutral-600">{i.puntaje != null ? `${Math.round(i.puntaje)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
