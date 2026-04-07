'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Loader2, ArrowLeft, Clock, Mail } from 'lucide-react';

export default function Seguridad360Page() {
  const router = useRouter();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50">
      {/* Header */}
      <div className="border-b border-red-100 bg-white/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium"
          >
            <ArrowLeft className="h-5 w-5" />
            Volver
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Seguridad 360</h1>
            <p className="text-sm text-red-500">Sistema de Gestión de Seguridad Vial</p>
          </div>
          <div className="w-12" />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Illustration */}
          <div className="flex items-center justify-center">
            <div className="relative">
              {/* Animated Circle Background */}
              <div className="absolute inset-0 bg-gradient-to-r from-red-400/20 to-orange-400/20 rounded-full blur-3xl animate-pulse" />

              {/* Icon */}
              <div className="relative flex items-center justify-center h-48 w-48 rounded-full bg-gradient-to-br from-red-100 to-orange-100 border-2 border-red-200">
                <div className="text-7xl">🛡️</div>
              </div>
            </div>
          </div>

          {/* Right: Content */}
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                <Clock className="h-4 w-4" />
                Próximamente
              </div>
              <h2 className="text-4xl font-bold text-gray-900">
                Seguridad 360
              </h2>
              <p className="text-xl text-gray-600">
                Sistema integral de Gestión de Seguridad Vial
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-gray-600 leading-relaxed">
                El módulo <strong>Seguridad 360</strong> está siendo desarrollado para proporcionar una solución completa de gestión de seguridad vial para tu empresa.
              </p>

              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Características que vendrán:</h3>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-3">
                    <span className="text-red-500 font-bold mt-1">✓</span>
                    <span>Gestión de flotas vehiculares</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-500 font-bold mt-1">✓</span>
                    <span>Monitoreo de seguridad vial en tiempo real</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-500 font-bold mt-1">✓</span>
                    <span>Análisis de incidentes y comportamiento del conductor</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-500 font-bold mt-1">✓</span>
                    <span>Reportes de cumplimiento normativo</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-red-500 font-bold mt-1">✓</span>
                    <span>Capacitaciones en seguridad vial</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Notification */}
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">¿Quieres notificaciones?</p>
                  <p className="text-sm text-gray-600">
                    Te avisaremos cuando este módulo esté disponible
                  </p>
                </div>
              </div>
              <button className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-medium transition-colors">
                Notificarme cuando esté listo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="border-t border-red-100 bg-red-50/50 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-8 text-center text-gray-600">
          <p>
            Seguimos trabajando en nuevas características. Mientras tanto, disfruta de los otros módulos disponibles en tu plan.
          </p>
        </div>
      </div>
    </div>
  );
}
