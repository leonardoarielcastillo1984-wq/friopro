'use client';

import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

export default function PagoExitosoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Google Ads conversion event
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'conversion', {
        'send_to': 'AW-18147230024/gk1GCK3CrqkcEMiCo81D',
        'value': 1.0,
        'currency': 'ARS',
        'transaction_id': ''
      });
    }
  }, []);

  const planTier = searchParams.get('plan') || 'PREMIUM';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          ¡Pago Exitoso!
        </h1>
        
        <p className="text-gray-600 mb-6">
          Tu plan {planTier} ha sido activado exitosamente.
        </p>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-green-800">
            Ahora tienes acceso completo a todas las funcionalidades de SGI 360.
          </p>
        </div>
        
        <Link href="/dashboard">
          <button className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Ir al Dashboard
          </button>
        </Link>
      </div>
    </div>
  );
}
