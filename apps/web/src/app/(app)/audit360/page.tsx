'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Loader2, ArrowLeft, Clock, Mail } from 'lucide-react';

export default function Audit360Page() {
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50">
      {/* Header */}
      <div className="border-b border-purple-100 bg-white/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
          >
            <ArrowLeft className="h-5 w-5" />
            Volver
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-purple-600">Audit360</h1>
            <p className="text-sm text-purple-500">Sistema especializado para Auditorías</p>
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
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-full blur-3xl animate-pulse" />

              {/* Icon */}
              <div className="relative flex items-center justify-center h-48 w-48 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 border-2 border-purple-200">
                <div className="text-7xl">📋</div>
              </div>
            </div>
          </div>

          {/* Right: Content */}
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                <Clock className="h-4 w-4" />
                Próximamente
              </div>
              <h2 className="text-4xl font-bold text-gray-900">
                Audit360
              </h2>
              <p className="text-xl text-gray-600">
                Plataforma especializada para profesionales de auditoría
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-gray-600 leading-relaxed">
                <strong>Audit360</strong> es una solución avanzada diseñada específicamente para firmas de auditoría y profesionales independientes que necesitan gestionar auditorías complejas con eficiencia.
              </p>

              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Características que vendrán:</h3>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-3">
                    <span className="text-purple-500 font-bold mt-1">✓</span>
                    <span>Gestión integral de proyectos de auditoría</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-500 font-bold mt-1">✓</span>
                    <span>Planificación y seguimiento de auditorías</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-500 font-bold mt-1">✓</span>
                    <span>Gestión de evidencia y documentación</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-500 font-bold mt-1">✓</span>
                    <span>Generación automática de informes de auditoría</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-500 font-bold mt-1">✓</span>
                    <span>Colaboración en equipo de auditoría</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-purple-500 font-bold mt-1">✓</span>
                    <span>Cumplimiento de estándares internacionales</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Notification */}
            <div className="rounded-xl bg-purple-50 border border-purple-200 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">¿Eres auditor profesional?</p>
                  <p className="text-sm text-gray-600">
                    Te avisaremos cuando Audit360 esté disponible
                  </p>
                </div>
              </div>
              <button className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium transition-colors">
                Notificarme cuando esté listo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="border-t border-purple-100 bg-purple-50/50 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-8 text-center text-gray-600">
          <p>
            Estamos desarrollando una solución especializada para auditores. Gracias por tu paciencia.
          </p>
        </div>
      </div>
    </div>
  );
}
