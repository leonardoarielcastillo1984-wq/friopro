'use client';

// Tarjeta ampliable: botón ↗ que abre el mismo contenido en un modal grande.
// Uso:
//   <ExpandableCard titulo="Ventas vs costos" explica="grafico-ventas" explicaTitulo="…">
//     {(expandido) => <div className={expandido ? 'h-[70vh]' : 'h-64'}>…contenido…</div>}
//   </ExpandableCard>
// children puede ser JSX fijo o una función que recibe `expandido` para
// agrandar el contenido dentro del modal (p.ej. altura de gráficos recharts).

import React, { useEffect, useState } from 'react';
import { Maximize2, X } from 'lucide-react';

export default function ExpandableCard({
  titulo,
  acciones,
  children,
  explica,
  explicaTitulo,
  className = '',
}: {
  titulo: React.ReactNode;
  /** Botones/acciones extra del encabezado (se repiten dentro del modal). */
  acciones?: React.ReactNode;
  explica?: string;
  explicaTitulo?: string;
  className?: string;
  children: React.ReactNode | ((expandido: boolean) => React.ReactNode);
}) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [abierto]);

  const contenido = (expandido: boolean) =>
    typeof children === 'function' ? children(expandido) : children;

  return (
    <div className={`rounded-xl border border-neutral-200 bg-white p-4 ${className}`}
      data-explica={explica} data-explica-titulo={explicaTitulo}>
      <div className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold text-neutral-900">
        <span className="min-w-0 flex-1">{titulo}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {acciones}
          <button
            type="button"
            onClick={() => setAbierto(true)}
            aria-label="Ampliar indicador"
            title="Ampliar"
            className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            <Maximize2 size={14} />
          </button>
        </span>
      </div>
      {contenido(false)}

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAbierto(false)}>
          <div
            role="dialog" aria-modal="true"
            className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2 text-base font-semibold text-neutral-900">
              <span className="min-w-0 flex-1">{titulo}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                {acciones}
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  aria-label="Cerrar vista ampliada"
                  title="Cerrar"
                  className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                >
                  <X size={16} />
                </button>
              </span>
            </div>
            {contenido(true)}
          </div>
        </div>
      )}
    </div>
  );
}
