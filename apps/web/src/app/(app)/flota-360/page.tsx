'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { VehicleArt } from './_components/FleetVisual';
import { apiFetch } from '@/lib/api';
import { AlertTriangle, Plus, QrCode, ChevronRight, Truck, ScanLine, CalendarClock, Wrench, CircleCheck, ClipboardList } from 'lucide-react';

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
  completadas: Orden[];
  inmovilizados: { id: string; dominio: string; tipo: string; notas: string | null; enTallerDesde?: string; diasEnTaller?: number }[];
  proximosVencimientos: { id: string; tipo: string; vehiculo: string | null; fechaVto: string }[];
};

const PRIORIDAD_COLOR: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700', HIGH: 'bg-red-50 text-red-600',
  MEDIUM: 'bg-amber-50 text-amber-700', LOW: 'bg-neutral-100 text-neutral-600',
};

const PRIORIDAD_LABEL: Record<string, string> = {
  CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja',
};

const ESTADO_COLOR: Record<string, string> = {
  PENDING: 'bg-neutral-100 text-neutral-700', IN_PROGRESS: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-green-50 text-green-700', ON_HOLD: 'bg-amber-50 text-amber-700',
};

const ESTADO_LABEL: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En proceso', COMPLETED: 'Completada', ON_HOLD: 'En espera', CANCELLED: 'Cancelada',
};

const ORIGEN_META: Record<string, { icon: any; color: string }> = {
  'Inspección QR': { icon: ScanLine, color: 'text-purple-600' },
  'Plan de mantenimiento': { icon: CalendarClock, color: 'text-blue-600' },
  'Correctivo': { icon: Wrench, color: 'text-neutral-500' },
  'Preventivo': { icon: Wrench, color: 'text-neutral-500' },
};

function fmtFecha(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

export default function CentroDeTrabajoPage() {
  const [data, setData] = useState<CentroTrabajo | null>(null);
  const [tab, setTab] = useState<'hoy' | 'proceso' | 'pendientes' | 'completadas'>('hoy');
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

  const listas: Record<string, Orden[]> = {
    hoy: data.trabajoHoy, proceso: data.enProceso, pendientes: data.pendientes, completadas: data.completadas,
  };
  const lista = listas[tab];
  const resumenCards = [
    { label: 'Trabajo para hoy', value: data.resumen.hoy, helper: 'OTs con atención hoy', icon: ClipboardList, tone: 'blue' },
    { label: 'En proceso', value: data.resumen.enProceso, helper: 'unidades o tareas en curso', icon: Wrench, tone: 'violet' },
    { label: 'Pendientes', value: data.resumen.pendientes, helper: 'esperan programación', icon: CalendarClock, tone: 'amber' },
    { label: 'Vencidas', value: data.resumen.vencidas, helper: data.resumen.vencidas > 0 ? 'requieren prioridad' : 'sin prioridades críticas', icon: data.resumen.vencidas > 0 ? AlertTriangle : CircleCheck, tone: data.resumen.vencidas > 0 ? 'red' : 'green' },
  ];
  const cardTone: Record<string, string> = {
    blue: 'border-blue-100 bg-blue-50/45 text-blue-700',
    violet: 'border-violet-100 bg-violet-50/45 text-violet-700',
    amber: 'border-amber-100 bg-amber-50/50 text-amber-700',
    red: 'border-red-200 bg-red-50/60 text-red-700',
    green: 'border-emerald-100 bg-emerald-50/50 text-emerald-700',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-[#0d1b3d]">Centro de trabajo</h1>
          <p className="text-xs text-neutral-500">Toda la operación de mantenimiento de flota en un solo lugar</p>
        </div>
        <div className="flex gap-2">
          <Link href="/flota-360/ordenes?nueva=1" className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
            <Plus className="h-3.5 w-3.5" /> Nueva OT
          </Link>
          <Link href="/flota-360/inspecciones" className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
            <QrCode className="h-3.5 w-3.5" /> Registrar inspección QR
          </Link>
        </div>
      </div>

      {/* Lectura inmediata: un centro de control, no una tabla de órdenes. */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {resumenCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`rounded-xl border p-3 ${cardTone[card.tone]}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{card.label}</p>
                  <p className="mt-1 text-2xl leading-none font-bold text-neutral-900">{card.value}</p>
                </div>
                <div className="rounded-lg bg-white/70 p-1.5 shadow-sm"><Icon className="h-4 w-4" /></div>
              </div>
              <p className="mt-2 text-[11px] text-neutral-500">{card.helper}</p>
            </div>
          );
        })}
      </div>

      {data.resumen.vencidas > 0 && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-red-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="font-semibold">{data.resumen.vencidas} órdenes vencidas requieren atención</span>
          </div>
          <button onClick={() => setTab('pendientes')} className="text-xs font-semibold text-red-700 hover:underline">Ver prioridades →</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-0.5 border border-neutral-200 border-b-0 bg-white rounded-t-lg px-1">
            {[
              { key: 'hoy', label: 'Trabajo para hoy', n: data.trabajoHoy.length },
              { key: 'proceso', label: 'En proceso', n: data.enProceso.length },
              { key: 'pendientes', label: 'Pendientes', n: data.pendientes.length },
              { key: 'completadas', label: 'Completadas', n: data.completadas.length },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as any)}
                className={`px-2.5 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                  tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-neutral-500 hover:text-neutral-800'
                }`}
              >
                {t.label} <span className="text-neutral-400">· {t.n}</span>
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-2.5 py-2">Prioridad</th>
                  <th className="text-left font-medium px-2.5 py-2">Orden</th>
                  <th className="text-left font-medium px-2.5 py-2">Activo / conjunto</th>
                  <th className="text-left font-medium px-2.5 py-2">Estado</th>
                  <th className="text-left font-medium px-2.5 py-2">Vence</th>
                  <th className="text-left font-medium px-2.5 py-2">Responsable</th>
                  <th className="text-left font-medium px-2.5 py-2">Origen</th>
                  <th className="text-left font-medium px-2.5 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {lista.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-6 text-center text-neutral-400">Sin órdenes en esta vista</td></tr>
                )}
                {lista.map((o) => {
                  const meta = ORIGEN_META[o.origen] || { icon: Wrench, color: 'text-neutral-400' };
                  const OrigenIcon = meta.icon;
                  return (
                    <tr key={o.id} className="hover:bg-neutral-50">
                      <td className="px-2.5 py-2">
                        <span className={`inline-block rounded px-1.5 py-0.5 font-medium ${PRIORIDAD_COLOR[o.prioridad] || 'bg-neutral-100 text-neutral-600'}`}>
                          {PRIORIDAD_LABEL[o.prioridad] || o.prioridad}
                        </span>
                      </td>
                      <td className="px-2.5 py-2">
                        <div className="font-medium text-neutral-800">{o.codigo}</div>
                        <div className="text-[11px] text-neutral-500 truncate max-w-[200px]">{o.titulo}</div>
                      </td>
                      <td className="px-2.5 py-2 text-neutral-700">{o.vehiculo ? <Link href={`/flota-360/vehiculos/${o.vehiculo.id}`} className="flex items-center gap-2"><VehicleArt semi={o.vehiculo.tipo === 'SEMI'} className="fleet-thumb" />{o.vehiculo.dominio}</Link> : o.activoNombre || '—'}</td>
                      <td className="px-2.5 py-2">
                        <span className={`inline-block rounded px-1.5 py-0.5 font-medium ${ESTADO_COLOR[o.estado] || 'bg-neutral-100'}`}>
                          {ESTADO_LABEL[o.estado] || o.estado}
                        </span>
                      </td>
                      <td className={`px-2.5 py-2 ${o.vencida ? 'text-red-600 font-semibold' : 'text-neutral-600'}`}>{fmtFecha(o.vence)}</td>
                      <td className="px-2.5 py-2 text-neutral-600">{o.responsable || '—'}</td>
                      <td className={`px-2.5 py-2 ${meta.color}`}>
                        <span className="flex items-center gap-1"><OrigenIcon className="h-3 w-3 shrink-0" /> <span className="text-[11px]">{o.origen}</span></span>
                      </td>
                      <td className="px-2.5 py-2">
                        <Link href={`/flota-360/ordenes?ver=${o.id}`} className="text-[11px] font-medium text-blue-600 hover:underline">Ver OT</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-violet-600 shadow-sm"><ScanLine className="h-3.5 w-3.5" /></span>
              <div>
                <p className="text-xs font-semibold text-neutral-800">Inspecciones QR activas</p>
                <p className="text-[11px] text-neutral-500">Plantillas, historial y hallazgos se mantienen integrados.</p>
              </div>
            </div>
            <Link href="/flota-360/inspecciones" className="mt-2 inline-flex text-[11px] font-medium text-violet-700 hover:underline">Ver inspecciones y hallazgos →</Link>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-xs font-semibold text-neutral-800">Inmovilizados</h3>
              {data.inmovilizados.length > 0 && (
                <span className="rounded-full bg-red-100 text-red-700 text-[11px] font-medium px-1.5 py-0.5">{data.inmovilizados.length}</span>
              )}
            </div>
            {data.inmovilizados.length === 0 ? (
              <p className="text-[11px] text-neutral-400">Sin vehículos en taller</p>
            ) : (
              <ul className="space-y-1.5">
                {data.inmovilizados.map((v) => (
                  <li key={v.id} className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-3 w-3 text-red-500 shrink-0" />
                      <Link href={`/flota-360/vehiculos/${v.id}`} className="font-medium text-neutral-800 hover:text-blue-700">{v.dominio}</Link>
                      {v.diasEnTaller != null && (
                        <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold ${v.diasEnTaller > 3 ? 'bg-red-100 text-red-700' : 'bg-neutral-100 text-neutral-600'}`}>
                          {v.diasEnTaller === 0 ? 'Hoy' : `${v.diasEnTaller}d en taller`}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500 pl-4 truncate">{v.notas || 'En taller'}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-xs font-semibold text-neutral-800">Próximos vencimientos</h3>
              <Link href="/flota-360/documentacion" className="text-[11px] text-blue-600 hover:underline flex items-center">Ver todos <ChevronRight className="h-3 w-3" /></Link>
            </div>
            {data.proximosVencimientos.length === 0 ? (
              <p className="text-[11px] text-neutral-400">Sin vencimientos en los próximos 7 días</p>
            ) : (
              <ul className="space-y-1">
                {data.proximosVencimientos.slice(0, 6).map((v) => (
                  <li key={v.id} className="flex items-center justify-between text-xs">
                    <span className="text-neutral-700 truncate">{v.tipo} {v.vehiculo ? `· ${v.vehiculo}` : ''}</span>
                    <span className="text-[11px] text-neutral-500 shrink-0">{fmtFecha(v.fechaVto)}</span>
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
