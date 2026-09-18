'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getTenantId } from '@/lib/api';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { Loader2 } from 'lucide-react';
import { LicenseBanner } from '@/components/LicenseBanner';
import { useDemoMode } from '@/hooks/useDemoMode';
import { DemoBanner } from '@/components/DemoBanner';
import { DemoWatermark } from '@/components/DemoWatermark';
import { DemoChecklist } from '@/components/DemoChecklist';
import { DemoExpiredModal } from '@/components/DemoExpiredModal';
import { SugerenciaBot } from '@/components/clima/SugerenciaBot';
import { BackButton } from './BackButton';
import ImpersonationBanner, { getImpersonationState } from '@/components/ImpersonationBanner';
import GlobalExportFAB from '@/components/GlobalExportFAB';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const tenantId = getTenantId();

  // Flota 360 tiene su propia navegación azul marino: el sidebar global se oculta en desktop
  // dentro del módulo para no mostrar dos menús laterales simultáneamente.
  const isFlota360 = pathname?.startsWith('/flota-360') ?? false;

  useEffect(() => {
    setIsImpersonating(!!getImpersonationState()?.isImpersonating);
    const handler = () => setIsImpersonating(!!getImpersonationState()?.isImpersonating);
    window.addEventListener('impersonation-change', handler);
    return () => window.removeEventListener('impersonation-change', handler);
  }, []);
  
  // Skip tenant-dependent components for Super Admin without tenant or on select-tenant page
  const isSelectTenantPage = typeof window !== 'undefined' && window.location.pathname === '/select-tenant';
  const isSuperAdmin = user?.globalRole === 'SUPER_ADMIN';
  const shouldSkipTenantData = isSelectTenantPage || (isSuperAdmin && !tenantId);
  const { status: demoStatus, checklist, allDone } = useDemoMode(shouldSkipTenantData ? null : tenantId);

  useSessionTimeout({
    timeoutMs: 30 * 60 * 1000, // 30 minutos de inactividad
    onInactive: () => {
      // Cerrar sesión activamente al detectar inactividad
      window.localStorage.removeItem('accessToken');
      window.localStorage.removeItem('csrfToken');
      window.localStorage.removeItem('tenantId');
      window.localStorage.removeItem('user');
      window.localStorage.removeItem('userPermissions');
      fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => null);
      window.location.href = '/sgi360-landing?reason=session_expired';
    },
    disabled: !user || loading,
  });

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/sgi360-landing');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100/50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-neutral-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={`min-h-screen bg-neutral-100/50 ${isImpersonating ? 'pt-9' : ''}`}>
      {/* Impersonation Banner */}
      <ImpersonationBanner />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar global — oculto en desktop dentro de Flota 360 (el módulo tiene su propia nav).
          En mobile sigue disponible vía botón de menú para no perder acceso al resto del SGI. */}
      <div className={isFlota360 ? 'lg:hidden' : ''}>
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Banners — con margen para no solapar el sidebar en desktop */}
      <div className={isFlota360 ? '' : 'lg:ml-[260px]'}>
        {!isSuperAdmin && <DemoBanner status={demoStatus} />}
        <LicenseBanner position="top" />
      </div>

      {/* Main content area */}
      <div className={isFlota360 ? '' : 'lg:ml-[260px]'}>
        {/* Topbar */}
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        {/* Page content */}
        <main className="p-4 sm:p-6">
          {!isFlota360 && <BackButton />}
          {children}
        </main>
      </div>

      {/* Demo overlay components */}
      {!isSuperAdmin && (
        <>
          <DemoWatermark status={demoStatus} />
          <DemoChecklist status={demoStatus} checklist={checklist} allDone={allDone} />
          <DemoExpiredModal status={demoStatus} />
        </>
      )}

      {/* Buzón de sugerencias global */}
      <SugerenciaBot />

      {/* Botón flotante de exportación PDF — disponible en todos los módulos */}
      <GlobalExportFAB />

    </div>
  );
}
