'use client';

import { Shield, ArrowLeft, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AccessDeniedProps {
  moduleName?: string;
}

export default function AccessDenied({ moduleName = 'este módulo' }: AccessDeniedProps) {
  const router = useRouter();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 shadow-lg p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Acceso Denegado
        </h2>
        <p className="text-gray-600 mb-6">
          No tenés permiso para acceder a <strong>{moduleName}</strong>.
          <br />
          Contactá al administrador de tu empresa para solicitar acceso.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Inicio
        </button>
      </div>
    </div>
  );
}
