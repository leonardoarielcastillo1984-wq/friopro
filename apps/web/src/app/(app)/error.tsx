'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AppError]', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-7 w-7 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-neutral-900">Algo salió mal</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Ocurrió un error inesperado. Podés intentar recargar la página o volver al inicio.
        </p>
        {error.message && (
          <p className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-mono break-all">
            {error.message}
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Reintentar
          </button>
          <a
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            <Home className="h-4 w-4" /> Inicio
          </a>
        </div>
      </div>
    </div>
  );
}
