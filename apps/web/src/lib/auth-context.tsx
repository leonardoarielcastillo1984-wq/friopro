'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { apiFetch, setCsrfToken, setTenantId } from '@/lib/api';

type AuthUser = {
  id: string;
  email: string;
  name?: string;
  globalRole?: 'SUPER_ADMIN' | null;
};

type TenantInfo = {
  id: string;
  name: string;
  slug: string;
};

type AuthState = {
  user: AuthUser | null;
  tenant: TenantInfo | null;
  tenantRole: string | null;
  loading: boolean;
  error: string | null;
};

type AuthContextType = AuthState & {
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tenant: null,
    tenantRole: null,
    loading: true,
    error: null,
  });

  const refreshAuth = useCallback(async () => {
    try {
      const res = await apiFetch<{
        user: AuthUser;
        activeTenant?: TenantInfo | null;
        tenantRole?: string | null;
        csrfToken?: string;
      }>('/auth/me');

      if (!res?.user) {
        throw new Error('No authenticated session');
      }

      if (res?.csrfToken) setCsrfToken(res.csrfToken);

      if (res?.activeTenant?.id) {
        setTenantId(res.activeTenant.id);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('tenantId', res.activeTenant.id);
        }
      }

      // Guardar usuario con globalRole en localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('user', JSON.stringify(res.user));
        // Guardar globalRole específicamente
        if (res.user.globalRole) {
          window.localStorage.setItem('globalRole', res.user.globalRole);
          console.log('AuthContext: GlobalRole guardado:', res.user.globalRole);
        } else {
          window.localStorage.removeItem("globalRole");
        }
      }

      setState({
        user: res.user,
        tenant: res.activeTenant ?? null,
        tenantRole: res.tenantRole ?? null,
        loading: false,
        error: null,
      });
    } catch (e: any) {
      // Limpiar localStorage si hay error para forzar login fresco
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('user');
        window.localStorage.removeItem('accessToken');
        window.localStorage.removeItem('tenantId');
        window.localStorage.removeItem('csrfToken');
      }

      setState({
        user: null,
        tenant: null,
        tenantRole: null,
        loading: false,
        error: e?.message ?? null,
      });
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => null);
    } finally {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('user');
        window.localStorage.removeItem('accessToken');
        window.localStorage.removeItem('tenantId');
        window.localStorage.removeItem('csrfToken');
      }
      setCsrfToken(null);
      setTenantId(null);
      setState({ user: null, tenant: null, tenantRole: null, loading: false, error: null });
      window.location.href = '/login';
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
