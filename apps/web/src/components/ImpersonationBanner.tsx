'use client';

import { useEffect, useState } from 'react';
import { Shield, X, AlertTriangle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface ImpersonationState {
  isImpersonating: boolean;
  tenantName: string;
  tenantId: string;
  originalToken: string;
}

export function getImpersonationState(): ImpersonationState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('impersonation');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setImpersonationState(state: ImpersonationState) {
  localStorage.setItem('impersonation', JSON.stringify(state));
}

export function clearImpersonationState() {
  localStorage.removeItem('impersonation');
}

export default function ImpersonationBanner() {
  const [state, setState] = useState<ImpersonationState | null>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    setState(getImpersonationState());

    const handler = () => setState(getImpersonationState());
    window.addEventListener('impersonation-change', handler);
    return () => window.removeEventListener('impersonation-change', handler);
  }, []);

  if (!state?.isImpersonating) return null;

  const handleExit = async () => {
    setExiting(true);
    try {
      const res = await apiFetch<{ accessToken: string }>('/super-admin/impersonate/exit', {
        method: 'POST',
      });

      localStorage.setItem('accessToken', state.originalToken);
      localStorage.removeItem('tenantId');
      localStorage.removeItem('activeTenant');
      clearImpersonationState();

      window.dispatchEvent(new Event('impersonation-change'));
      window.location.href = '/admin';
    } catch (err) {
      localStorage.setItem('accessToken', state.originalToken);
      localStorage.removeItem('tenantId');
      localStorage.removeItem('activeTenant');
      clearImpersonationState();
      window.location.href = '/admin';
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 flex-shrink-0">
            <AlertTriangle className="w-4 h-4 animate-pulse" />
            <Shield className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 text-sm font-medium truncate">
            <span className="hidden sm:inline text-amber-100">MODO IMPERSONACIÓN ACTIVO</span>
            <span className="text-white font-bold">→</span>
            <span className="bg-amber-600 rounded px-2 py-0.5 text-xs font-bold tracking-wide uppercase truncate">
              {state.tenantName}
            </span>
          </div>
          <span className="text-amber-100 text-xs hidden md:inline">
            Estás viendo el sistema como TENANT_ADMIN de este cliente
          </span>
        </div>

        <button
          onClick={handleExit}
          disabled={exiting}
          className="flex items-center gap-2 bg-white text-amber-700 hover:bg-amber-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex-shrink-0 disabled:opacity-60"
        >
          <X className="w-3.5 h-3.5" />
          {exiting ? 'Saliendo...' : 'Salir de impersonación'}
        </button>
      </div>
    </div>
  );
}
