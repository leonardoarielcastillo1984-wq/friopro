'use client';

import { useEffect, useState, Suspense, lazy } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getTenantId } from '@/lib/api';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { Loader2, AlertTriangle } from 'lucide-react';
import { LicenseBanner } from '@/components/LicenseBanner';

const FloatingHelpBot = lazy(() => import('@/components/FloatingHelpBot'));

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const tenantId = getTenantId();

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

  // Verificar que SUPER_ADMIN tenga un tenant seleccionado
  const isSuperAdmin = user?.globalRole === 'SUPER_ADMIN';
  if (isSuperAdmin && !tenantId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100/50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">Tenant requerido</h2>
          <p className="text-neutral-600 mb-4">
            Como Super Admin, necesitás seleccionar una empresa para trabajar.
          </p>
          <button
            onClick={() => router.push('/select-tenant')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Seleccionar empresa
          </button>
        </div>
      </div>
    );
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

      {/* Global help bot - lazy loaded */}
      <Suspense fallback={null}>
        <FloatingHelpBot />
      </Suspense>
    </div>
  );
}
