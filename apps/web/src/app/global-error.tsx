'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center max-w-md p-8">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error de Aplicación</h1>
            <p className="text-gray-700 mb-4">
              {error.message || 'Ocurrió un error inesperado'}
            </p>
            <button
              onClick={reset}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
