'use client';

import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Tooltip explicativo al pasar el mouse (o tocar en mobile).
 * Uso: <Hint text="Qué es esto" /> junto a títulos/tarjetas/columnas,
 * o <Hint text="…">contenido</Hint> para envolver un elemento.
 */
export function Hint({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <span className="group/hint relative inline-flex cursor-help items-center align-middle" tabIndex={0}>
      {children ?? <Info className="h-3 w-3 text-neutral-300 transition-colors group-hover/hint:text-blue-500" />}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden w-56 -translate-x-1/2 rounded-lg bg-[#0d1b3d] px-3 py-2 text-[10px] font-normal leading-snug text-white shadow-xl group-hover/hint:block group-focus/hint:block"
      >
        {text}
      </span>
    </span>
  );
}
