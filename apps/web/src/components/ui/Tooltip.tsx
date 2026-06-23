'use client';

import {
  useState,
  useRef,
  useId,
  useCallback,
  cloneElement,
  isValidElement,
  type ReactNode,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';

type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

interface TooltipProps {
  /** Contenido del tooltip. Puede ser texto o JSX. */
  content: ReactNode;
  /** Elemento disparador (debe aceptar ref y eventos). */
  children: ReactElement;
  /** Lado preferido donde se muestra el tooltip. */
  side?: TooltipSide;
  /** Retardo en ms antes de mostrar. */
  delay?: number;
  /** Deshabilita el tooltip (no se muestra). */
  disabled?: boolean;
  /** Ancho máximo del tooltip en px. */
  maxWidth?: number;
}

interface Coords {
  top: number;
  left: number;
}

const GAP = 8; // distancia entre disparador y tooltip

export default function Tooltip({
  content,
  children,
  side = 'top',
  delay = 250,
  disabled = false,
  maxWidth = 260,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const computePosition = useCallback(() => {
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;
    const r = triggerEl.getBoundingClientRect();
    const tip = tooltipRef.current;
    const tipW = tip?.offsetWidth ?? maxWidth;
    const tipH = tip?.offsetHeight ?? 32;

    let top = 0;
    let left = 0;
    switch (side) {
      case 'right':
        top = r.top + r.height / 2 - tipH / 2;
        left = r.right + GAP;
        break;
      case 'left':
        top = r.top + r.height / 2 - tipH / 2;
        left = r.left - tipW - GAP;
        break;
      case 'bottom':
        top = r.bottom + GAP;
        left = r.left + r.width / 2 - tipW / 2;
        break;
      case 'top':
      default:
        top = r.top - tipH - GAP;
        left = r.left + r.width / 2 - tipW / 2;
        break;
    }

    // Mantener dentro del viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    left = Math.max(8, Math.min(left, vw - tipW - 8));
    top = Math.max(8, Math.min(top, vh - tipH - 8));

    setCoords({ top, left });
  }, [side, maxWidth]);

  const show = useCallback(() => {
    if (disabled || !content) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setOpen(true);
      // Posicionar tras montar para tener medidas reales
      requestAnimationFrame(computePosition);
    }, delay);
  }, [disabled, content, delay, computePosition]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  }, []);

  if (!isValidElement(children)) return children as unknown as ReactElement;

  const childProps = children.props as Record<string, any>;

  const trigger = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const childRef = (children as any).ref;
      if (typeof childRef === 'function') childRef(node);
      else if (childRef && typeof childRef === 'object') childRef.current = node;
    },
    'aria-describedby': open ? tooltipId : undefined,
    onMouseEnter: (e: any) => {
      childProps.onMouseEnter?.(e);
      show();
    },
    onMouseLeave: (e: any) => {
      childProps.onMouseLeave?.(e);
      hide();
    },
    onFocus: (e: any) => {
      childProps.onFocus?.(e);
      show();
    },
    onBlur: (e: any) => {
      childProps.onBlur?.(e);
      hide();
    },
  } as any);

  return (
    <>
      {trigger}
      {open && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            style={{ top: coords.top, left: coords.left, maxWidth }}
            className="pointer-events-none fixed z-[9999] rounded-lg bg-slate-900 px-3 py-2 text-xs leading-relaxed text-white shadow-xl ring-1 ring-black/10 animate-in fade-in-0 zoom-in-95"
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
