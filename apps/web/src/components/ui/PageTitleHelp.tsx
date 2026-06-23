'use client';

import { HelpCircle } from 'lucide-react';
import Tooltip from './Tooltip';
import { getModuleInfo } from '@/lib/moduleDescriptions';

interface PageTitleHelpProps {
  /** Texto explicativo directo. Tiene prioridad sobre `moduleHref`. */
  text?: string;
  /** Ruta del módulo para tomar la descripción del registro central. */
  moduleHref?: string;
  /** Título opcional mostrado en negrita dentro del tooltip. */
  title?: string;
  /** Lado donde se muestra el tooltip. */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Tamaño del ícono en px. */
  size?: number;
  className?: string;
}

/**
 * Ícono de ayuda (i) para colocar junto a un título de página o sección.
 * Muestra un tooltip con una breve explicación del módulo.
 *
 * Uso:
 *   <h1>Documentos <PageTitleHelp moduleHref="/documents" /></h1>
 *   <h2>Mi sección <PageTitleHelp text="Explicación libre" /></h2>
 */
export default function PageTitleHelp({
  text,
  moduleHref,
  title,
  side = 'bottom',
  size = 16,
  className = '',
}: PageTitleHelpProps) {
  const info = moduleHref ? getModuleInfo(moduleHref) : null;
  const resolvedTitle = title ?? info?.title;
  const resolvedText = text ?? info?.description;

  if (!resolvedText) return null;

  const content = (
    <div>
      {resolvedTitle && <div className="mb-0.5 font-semibold">{resolvedTitle}</div>}
      <div className="text-slate-200">{resolvedText}</div>
    </div>
  );

  return (
    <Tooltip content={content} side={side}>
      <button
        type="button"
        aria-label={resolvedTitle ? `Ayuda: ${resolvedTitle}` : 'Ayuda'}
        className={`inline-flex items-center justify-center text-gray-400 hover:text-brand-600 transition-colors align-middle ${className}`}
      >
        <HelpCircle style={{ width: size, height: size }} />
      </button>
    </Tooltip>
  );
}
