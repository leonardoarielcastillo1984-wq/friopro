'use client';

import { useEffect, useState, createContext, useContext, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import P360Sidebar from '@/components/project360/layout/P360Sidebar';
import P360Header from '@/components/project360/layout/P360Header';
import {
  loginProject360,
  verifyProject360Session,
  getProject360Token,
  type P360Session,
} from '@/lib/project360-auth';

interface P360ContextValue {
  session: P360Session | null;
  refreshSession: () => Promise<void>;
}

const P360Context = createContext<P360ContextValue>({ session: null, refreshSession: async () => {} });

export function useP360() {
  return useContext(P360Context);
}

export default function Project360Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<P360Session | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const bootstrap = async () => {
    if (typeof window === 'undefined') return;

    // 1. Try existing P360 token first
    const existingToken = getProject360Token();
    if (existingToken) {
      const verified = await verifyProject360Session();
      if (verified) {
        setSession(verified);
        setLoading(false);
        return;
      }
    }

    // 2. Acceso INTERNO desde SGI360: auto-login usando el token SGI360
    const sgi360Token = localStorage.getItem('accessToken');
    const tenantId = localStorage.getItem('tenantId');
    if (sgi360Token) {
      try {
        const newSession = await loginProject360(sgi360Token, tenantId ?? '');
        setSession(newSession);
        setLoading(false);
        return;
      } catch (err) {
        console.error('[P360] Auto-login SGI360 falló:', err);
      }
    }

    // 3. Sin sesión SGI360 ni token P360 → landing de PROJECT360 (login independiente)
    router.replace('/proyect360-landing');
    setLoading(false);
  };

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshSession = async () => {
    const verified = await verifyProject360Session();
    if (verified) setSession(verified);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm text-gray-500 font-medium">Iniciando PROJECT360...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <P360Context.Provider value={{ session, refreshSession }}>
      <div className="fixed inset-0 z-[200] bg-gray-50 flex overflow-hidden">
        <P360Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-h-0 lg:ml-[240px]">
          <P360Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto p-5 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </P360Context.Provider>
  );
}
