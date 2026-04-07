'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Clock, X, Sparkles, CreditCard } from 'lucide-react';
import { useLicense } from '@/hooks/useLicense';

interface LicenseBannerProps {
  position?: 'top' | 'bottom';
}

export function LicenseBanner({ position = 'top' }: LicenseBannerProps) {
  const router = useRouter();
  const { status, notifications, markNotificationAsRead } = useLicense();
  const [visibleBanners, setVisibleBanners] = useState<string[]>([]);
  const [dismissedBanners, setDismissedBanners] = useState<string[]>([]);

  // Determinar qué banners mostrar basado en el estado de licencia
  useEffect(() => {
    const banners: string[] = [];
    
    if (status.isInGracePeriod && status.graceDaysRemaining > 0) {
      banners.push('grace-period');
    }
    
    if (status.status === 'TRIAL' && status.daysRemaining <= 7 && status.daysRemaining > 0) {
      banners.push('trial-ending');
    }
    
    if (notifications.length > 0) {
      const unreadImportant = notifications.filter(n => 
        !n.isRead && 
        !dismissedBanners.includes(n.id) &&
        ['SUBSCRIPTION_EXPIRING_7D', 'SUBSCRIPTION_EXPIRING_3D', 'SUBSCRIPTION_EXPIRING_1D', 'PAYMENT_FAILED'].includes(n.type)
      );
      
      unreadImportant.forEach(n => {
        if (!visibleBanners.includes(n.id)) {
          banners.push(n.id);
        }
      });
    }
    
    setVisibleBanners(banners);
  }, [status, notifications, dismissedBanners]);

  const handleDismiss = (id: string) => {
    setDismissedBanners(prev => [...prev, id]);
    setVisibleBanners(prev => prev.filter(b => b !== id));
    
    // Si es una notificación, marcarla como leída
    if (id !== 'grace-period' && id !== 'trial-ending') {
      markNotificationAsRead(id);
    }
  };

  // Si no hay banners visibles, no renderizar nada
  if (visibleBanners.length === 0) return null;

  return (
    <div className={`fixed left-0 lg:left-[260px] right-0 z-50 ${position === 'top' ? 'top-0' : 'bottom-0'}`}>
      {visibleBanners.map((bannerId) => {
        // Banner de período de gracia
        if (bannerId === 'grace-period') {
          return (
            <div
              key={bannerId}
              className="bg-amber-50 border-b border-amber-200 px-4 py-3 animate-in slide-in-from-top"
            >
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-amber-800 font-medium text-sm">
                      Licencia vencida
                    </p>
                    <p className="text-amber-700 text-sm">
                      Tenés {status.graceDaysRemaining} días para renovar tu suscripción. 
                      Durante este período podés visualizar información pero no realizar operaciones.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => router.push('/planes')}
                    className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    Renovar ahora
                  </button>
                  <button
                    onClick={() => handleDismiss(bannerId)}
                    className="p-1 text-amber-600 hover:text-amber-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        }

        // Banner de trial terminando
        if (bannerId === 'trial-ending') {
          return (
            <div
              key={bannerId}
              className="bg-blue-50 border-b border-blue-200 px-4 py-3 animate-in slide-in-from-top"
            >
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="text-blue-800 font-medium text-sm">
                      Tu prueba gratuita finaliza en {status.daysRemaining} días
                    </p>
                    <p className="text-blue-700 text-sm">
                      Elegí un plan para continuar usando SGI 360 sin interrupciones.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => router.push('/planes')}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Ver planes
                  </button>
                  <button
                    onClick={() => handleDismiss(bannerId)}
                    className="p-1 text-blue-600 hover:text-blue-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        }

        // Banner de notificaciones específicas
        const notification = notifications.find(n => n.id === bannerId);
        if (notification) {
          const isPaymentFailed = notification.type === 'PAYMENT_FAILED';
          
          return (
            <div
              key={bannerId}
              className={`${isPaymentFailed ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'} border-b px-4 py-3 animate-in slide-in-from-top`}
            >
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isPaymentFailed ? (
                    <CreditCard className="w-5 h-5 text-red-600 flex-shrink-0" />
                  ) : (
                    <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  )}
                  <div>
                    <p className={`font-medium text-sm ${isPaymentFailed ? 'text-red-800' : 'text-amber-800'}`}>
                      {notification.title}
                    </p>
                    <p className={`text-sm ${isPaymentFailed ? 'text-red-700' : 'text-amber-700'}`}>
                      {notification.message}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => router.push('/planes')}
                    className={`px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                      isPaymentFailed 
                        ? 'bg-red-600 hover:bg-red-700' 
                        : 'bg-amber-600 hover:bg-amber-700'
                    }`}
                  >
                    {isPaymentFailed ? 'Actualizar pago' : 'Ver planes'}
                  </button>
                  <button
                    onClick={() => handleDismiss(bannerId)}
                    className={`p-1 ${isPaymentFailed ? 'text-red-600 hover:text-red-800' : 'text-amber-600 hover:text-amber-800'}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

export default LicenseBanner;
