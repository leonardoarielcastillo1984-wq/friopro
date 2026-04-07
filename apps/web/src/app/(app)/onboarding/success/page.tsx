'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, ArrowRight, Building2 } from 'lucide-react';

export default function OnboardingSuccessPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center">
          {/* Success Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>

          {/* Success Message */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            ¡Bienvenido a SGI360!
          </h1>
          
          <p className="text-lg text-gray-600 mb-8">
            Tu cuenta ha sido creada exitosamente. Estás listo para comenzar tu transformación digital.
          </p>

          {/* Company Info */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">Detalles de tu Cuenta</h2>
            </div>
            
            <div className="space-y-3 text-left">
              <div className="flex justify-between">
                <span className="text-gray-600">Plan:</span>
                <span className="font-medium text-green-600">Starter (Trial 14 días)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Estado:</span>
                <span className="font-medium text-green-600">Activo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Acceso Dashboard:</span>
                <span className="font-medium text-blue-600">Inmediato</span>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-blue-50 rounded-xl p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-3">Próximos Pasos</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>✅ Explora el dashboard principal</p>
              <p>✅ Configura tu perfil de empresa</p>
              <p>✅ Invita a tu equipo</p>
              <p>✅ Comienza tu primera auditoría</p>
            </div>
          </div>

          {/* Auto-redirect Message */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
            <p className="text-sm text-yellow-800">
              Serás redirigido automáticamente al dashboard en {countdown} segundos...
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              Ir al Dashboard ahora
              <ArrowRight className="w-4 h-4" />
            </button>
            
            <Link
              href="/plans"
              className="block w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-200 transition-colors font-medium text-center"
            >
              Ver Planes y Precios
            </Link>
          </div>

          {/* Help Link */}
          <div className="mt-8">
            <p className="text-sm text-gray-600">
              ¿Necesitas ayuda?{' '}
              <Link href="/support" className="text-blue-600 hover:text-blue-700 font-medium">
                Contacta Soporte
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
