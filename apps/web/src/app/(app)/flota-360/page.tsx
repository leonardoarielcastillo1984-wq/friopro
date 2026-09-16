'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { AlertTriangle, Plus, QrCode, ChevronRight, Truck } from 'lucide-react';

type Orden = {
  id: string; codigo: string; titulo: string; tipo: string; prioridad: string; estado: string;
  vehiculo: { id: string; dominio: string; tipo: string } | null;
  activoNombre: string | null; responsable: string | null; vence: string | null; vencida: boolean; esHoy: boolean; origen: string;
};

type CentroTrabajo = {
  resumen: { vencidas: number; hoy: number; enProceso: number; pendientes: number };
  trabajoHoy: Orden[];
  vencidas: Orden[];
  enProceso: Orden[];
  pendientes: Orden[];
  inmovilizados: { id: string; dominio: string; tipo: string; notas: string | null }[];
  proximosVencimientos: { id: string; tipo: string; vehiculo: string | null; fechaVto: string }[];
};

const PRIORIDAD_COLOR: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700', HIGH: 'bg-red-50 text-red-600',
  MEDIUM: 'bg-amber-50 text-amber-700', LOW: 'bg-neutral-100 text-neutral-600',
};

const ESTADO_COLOR: Record<string, string> = {
  PENDING: 'bg-neutral-100 text-neutral-700', IN_PROGRESS: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-green-50 text-green-700', ON_HOLD: 'bg-amber-50 text-amber-700',
};

function fmtFecha(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

export default function CentroDeTrabajoPage() {
  const [data, setData] = useState<CentroTrabajo | null>(null);
  const [tab, setTab] = useState<'hoy' | 'proceso' | 'pendientes'>('hoy');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<CentroTrabajo>('/fleet-ops/centro-de-trabajo');
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading || !data) {
    return <div className="p-8 text-sm text-neutral-500">Cargando centro de trabajo…</div>;
  }

  const lista = tab === 'hoy' ? data.trabajoHoy : tab === 'proceso' ? data.enProceso : data.pendientes;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Centro de trabajo</h1>
          <p className="text-sm text-neutral-500">Toda la operación de mantenimiento de flota en un solo lugar</p>
        </div>
        <div className="flex gap-2">
          <Link href="/flota-360/ordenes?nueva=1" className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Nueva OT
          </Link>
          <Link href="/flota-360/inspecciones" className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            <QrCode className="h-4 w-4" /> Registrar inspección QR
          </Link>
        </div>
      </div>

      {data.resumen.vencidas > 0 && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">{data.resumen.vencidas} órdenes vencidas</span>
          </div>
          <button onClick={() => setTab('pendientes')} className="text-xs font-medium text-red-700 hover:underline">Ver prioridades →</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-1 border-b border-neutral-200">
            {[
              { key: 'hoy', label: `Trabajo para hoy · ${data.trabajoHoy.length}` },
              { key: 'proceso', label: `En proceso · ${data.enProceso.length}` },
              { key: 'pendientes', label: `Pendientes · ${data.pendientes.length}` },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as any)}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                  tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-neutral-500 hover:text-neutral-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Prioridad</th>
                  <th className="text-left font-medium px-3 py-2">Orden</th>
                  <th className="text-left font-medium px-3 py-2">Vehículo</th>
                  <th className="text-left font-medium px-3 py-2">Estado</th>
                  <th className="text-left font-medium px-3 py-2">Vence</th>
                  <th className="text-left font-medium px-3 py-2">Responsable</th>
                  <th className="text-left font-medium px-3 py-2">Origen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {lista.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-400">Sin órdenes en esta vista</td></tr>
                )}
                {lista.map((o) => (
                  <tr key={o.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${PRIORIDAD_COLOR[o.prioridad] || 'bg-neutral-100 text-neutral-600'}`}>
                        {o.prioridad}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-neutral-800">{o.codigo}</div>
                      <div className="text-xs text-neutral-500 truncate max-w-[200px]">{o.titulo}</div>
                    </td>
                    <td className="px-3 py-2 text-neutral-700">{o.vehiculo?.dominio || o.activoNombre || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${ESTADO_COLOR[o.estado] || 'bg-neutral-100'}`}>
                        {o.estado}
                      </span>
                    </td>
                    <td className={`px-3 py-2 ${o.vencida ? 'text-red-600 font-medium' : 'text-neutral-600'}`}>{fmtFecha(o.vence)}</td>
                    <td className="px-3 py-2 text-neutral-600">{o.responsable || '—'}</td>
                    <td className="px-3 py-2 text-neutral-500 text-xs">{o.origen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-neutral-800">Vehículos inmovilizados</h3>
              {data.inmovilizados.length > 0 && (
                <span className="rounded-full bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5">{data.inmovilizados.length}</span>
              )}
            </div>
            {data.inmovilizados.length === 0 ? (
              <p className="text-xs text-neutral-400">Sin vehículos en taller</p>
            ) : (
              <ul className="space-y-1.5">
                {data.inmovilizados.map((v) => (
                  <li key={v.id} className="flex items-center gap-2 text-sm">
                    <Truck className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <span className="font-medium text-neutral-800">{v.dominio}</span>
                    <span className="text-xs text-neutral-500 truncate">{v.notas || 'En taller'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-neutral-800">Próximos vencimientos</h3>
              <Link href="/flota-360/documentacion" className="text-xs text-blue-600 hover:underline flex items-center">Ver todos <ChevronRight className="h-3 w-3" /></Link>
            </div>
            {data.proximosVencimientos.length === 0 ? (
              <p className="text-xs text-neutral-400">Sin vencimientos en los próximos 7 días</p>
            ) : (
              <ul className="space-y-1.5">
                {data.proximosVencimientos.slice(0, 6).map((v) => (
                  <li key={v.id} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-700">{v.tipo} {v.vehiculo ? `· ${v.vehiculo}` : ''}</span>
                    <span className="text-xs text-neutral-500">{fmtFecha(v.fechaVto)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
