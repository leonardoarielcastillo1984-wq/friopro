'use client';

import { MapPin } from 'lucide-react';

interface Territory {
  [key: string]: any;
}

interface ExecutiveCostMapProps {
  data?: Territory[];
  onTerritoryClick?: (territory: Territory) => void;
}

function label(t: Territory): string {
  return t?.name ?? t?.territory ?? t?.province ?? t?.provincia ?? t?.code ?? 'Sin nombre';
}

function value(t: Territory): number | null {
  const v = t?.value ?? t?.cost ?? t?.costo ?? t?.total ?? t?.amount ?? null;
  return typeof v === 'number' ? v : null;
}

function fmt(n: number): string {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(n);
  }
}

/**
 * Mapa de costos por territorio (vista ejecutiva).
 * Render basado en datos: una grilla de territorios clickeables con su valor.
 */
export default function ExecutiveCostMap({ data = [], onTerritoryClick }: ExecutiveCostMapProps) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-10 text-center">
        <MapPin className="mx-auto h-6 w-6 text-slate-400" />
        <p className="mt-2 text-sm text-slate-500">Sin datos de territorios para mostrar.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {data.map((t, i) => {
          const v = value(t);
          return (
            <button
              key={t?.id ?? t?.code ?? i}
              type="button"
              onClick={() => onTerritoryClick?.(t)}
              className="flex flex-col items-start gap-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-3 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50"
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <MapPin className="h-3.5 w-3.5 text-indigo-500" />
                {label(t)}
              </span>
              {v !== null && <span className="text-xs text-slate-500">{fmt(v)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
