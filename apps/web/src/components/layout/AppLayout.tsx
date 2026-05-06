'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getTenantId } from '@/lib/api';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { Loader2, AlertTriangle, Clock } from 'lucide-react';
import { LicenseBanner } from '@/components/LicenseBanner';
import { useDemoMode } from '@/hooks/useDemoMode';
import { DemoBanner } from '@/components/DemoBanner';
import { DemoWatermark } from '@/components/DemoWatermark';
import { DemoChecklist } from '@/components/DemoChecklist';
import { DemoExpiredModal } from '@/components/DemoExpiredModal';
import FloatingHelpBot from '@/components/FloatingHelpBot';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const tenantId = getTenantId();
  
  // Skip tenant-dependent components for Super Admin without tenant or on select-tenant page
  const isSelectTenantPage = typeof window !== 'undefined' && window.location.pathname === '/select-tenant';
  const isSuperAdmin = user?.globalRole === 'SUPER_ADMIN';
  const shouldSkipTenantData = isSelectTenantPage || (isSuperAdmin && !tenantId);
  const { status: demoStatus, checklist, allDone } = useDemoMode(shouldSkipTenantData ? null : tenantId);

  useSessionTimeout({
    timeoutMs: 30 * 60 * 1000, // 30 minutos de inactividad
    onInactive: () => setShowTimeoutModal(true),
    disabled: !user || loading,
  });

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
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
    <div className="min-h-screen bg-neutral-100/50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Demo Banner */}
      {!isSuperAdmin && <DemoBanner status={demoStatus} />}

      {/* License Banner - positioned at top */}
      <LicenseBanner position="top" />

      {/* Main content area */}
      <div className="lg:ml-[260px]">
        {/* Topbar */}
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        {/* Page content */}
        <main className="p-4 sm:p-6">
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

      {/* Global help bot - lazy loaded */}
      <Suspense fallback={null}>
        <FloatingHelpBot />
      </Suspense>

      {/* Session timeout modal */}
      {showTimeoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-6 text-center mx-4">
            <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">
              Sesión cerrada por inactividad
            </h2>
            <p className="text-neutral-600 mb-6">
              Tu sesión fue cerrada automáticamente tras 30 minutos de inactividad por seguridad.
            </p>
            <button
              onClick={() => {
                setShowTimeoutModal(false);
                router.replace('/login');
              }}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Volver a iniciar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
