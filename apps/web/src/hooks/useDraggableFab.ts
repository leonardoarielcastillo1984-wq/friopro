'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * FAB arrastrable: el usuario puede reubicar los botones flotantes.
 * La posición se persiste en localStorage por storageKey.
 * Uso: const fab = useDraggableFab('feedback');
 *   <div ref={fab.ref} className="fixed z-50 ..." style={fab.style}> // sin pos → se usan clases por defecto
 *   <button {...fab.dragProps} onClick={...} />  // ignora clicks que fueron arrastre
 */
export function useDraggableFab(storageKey: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const drag = useRef<{ sx: number; sy: number; dx: number; dy: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('fab-pos:' + storageKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (Number.isFinite(p?.left) && Number.isFinite(p?.top)) setPos({ left: p.left, top: p.top });
      }
    } catch { /* noop */ }
  }, [storageKey]);

  // Si el viewport se achicó después de guardar la posición (o se guardó en otra
  // pantalla), el FAB quedaría fuera de vista. Re-clamar al montar y en resize.
  useEffect(() => {
    const clampToViewport = () => {
      setPos(p => {
        if (!p) return p;
        const el = ref.current;
        const w = el?.offsetWidth || 120;
        const h = el?.offsetHeight || 48;
        const left = Math.min(Math.max(p.left, 4), Math.max(4, window.innerWidth - w - 4));
        const top = Math.min(Math.max(p.top, 4), Math.max(4, window.innerHeight - h - 4));
        if (left === p.left && top === p.top) return p;
        try { localStorage.setItem('fab-pos:' + storageKey, JSON.stringify({ left, top })); } catch { /* noop */ }
        return { left, top };
      });
    };
    clampToViewport();
    window.addEventListener('resize', clampToViewport);
    return () => window.removeEventListener('resize', clampToViewport);
  }, [storageKey]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    drag.current = { sx: e.clientX, sy: e.clientY, dx: e.clientX - rect.left, dy: e.clientY - rect.top, moved: false };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* noop */ }
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    if (!d.moved && Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < 6) return;
    d.moved = true;
    const left = Math.min(Math.max(e.clientX - d.dx, 4), window.innerWidth - el.offsetWidth - 4);
    const top = Math.min(Math.max(e.clientY - d.dy, 4), window.innerHeight - el.offsetHeight - 4);
    setPos({ left, top });
  }, []);

  const onPointerUp = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) {
      justDragged.current = true;
      setTimeout(() => { justDragged.current = false; }, 50);
      setPos((p) => {
        if (p) { try { localStorage.setItem('fab-pos:' + storageKey, JSON.stringify(p)); } catch { /* noop */ } }
        return p;
      });
    }
  }, [storageKey]);

  /** Llamar al inicio del onClick del botón: devuelve true si el click fue en realidad un arrastre. */
  const wasDrag = useCallback(() => justDragged.current, []);

  return {
    ref,
    /** style para el contenedor fixed; undefined = usar clases por defecto */
    style: pos ? { left: pos.left, top: pos.top } as React.CSSProperties : undefined,
    dragProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    wasDrag,
  };
}
