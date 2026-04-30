'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseSessionTimeoutOptions {
  timeoutMs?: number;
  onInactive: () => void;
  disabled?: boolean;
}

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'wheel'] as const;

export function useSessionTimeout({ timeoutMs = 30 * 60 * 1000, onInactive, disabled = false }: UseSessionTimeoutOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onInactiveRef = useRef(onInactive);

  // keep callback ref up to date
  useEffect(() => {
    onInactiveRef.current = onInactive;
  }, [onInactive]);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    if (disabled) return;
    clear();
    timerRef.current = setTimeout(() => {
      onInactiveRef.current();
    }, timeoutMs);
  }, [clear, disabled, timeoutMs]);

  useEffect(() => {
    if (disabled) {
      clear();
      return;
    }

    reset();

    const handleActivity = () => {
      reset();
    };

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      clear();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [reset, clear, disabled]);

  return { reset, clear };
}
