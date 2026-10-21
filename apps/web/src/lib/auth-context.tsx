'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { apiFetch, apiPath, lsKey, setCsrfToken, setTenantId, LOGOUT_REDIRECT } from '@/lib/api';

type AuthUser = {
  id: string;
  email: string;
  name?: string;
  globalRole?: 'SUPER_ADMIN' | 'TENANT' | string | null;
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
        globalRole?: string | null;
        tenantId?: string | null;
      }>('/auth/me');

      if (!res?.user) {
        throw new Error('No authenticated session');
      }

      if (res?.csrfToken) setCsrfToken(res.csrfToken);

      if (res?.activeTenant?.id) {
        setTenantId(res.activeTenant.id);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(lsKey('tenantId'), res.activeTenant.id);
        }
      }

      // Fetch user permissions (for employee users)
      let permissions: Record<string, string> | null = null;
      // Skip loading permissions for Super Admin without tenant or on select-tenant page
      const isSelectTenantPage = typeof window !== 'undefined' && window.location.pathname === '/select-tenant';
      const isSuperAdminWithoutTenant = res.globalRole === 'SUPER_ADMIN' && !res.tenantId;
      if (res.tenantRole !== 'SUPER_ADMIN' && !isSelectTenantPage && !isSuperAdminWithoutTenant) {
        try {
          const permsRes = await apiFetch<{ permissions: Record<string, any> }>('/hr/users/me/permissions');
          if (permsRes?.permissions) {
            permissions = permsRes.permissions;
          }
        } catch (e) {
          // Ignore permission fetch errors
        }
      }

      // Guardar usuario con globalRole en localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(lsKey('user'), JSON.stringify(res.user));
        // Guardar globalRole específicamente
        if (res.user.globalRole) {
          window.localStorage.setItem(lsKey('globalRole'), res.user.globalRole);
        } else {
          window.localStorage.removeItem(lsKey('globalRole'));
        }
        // Guardar permisos
        if (permissions) {
          window.localStorage.setItem(lsKey('userPermissions'), JSON.stringify(permissions));
        } else {
          window.localStorage.removeItem(lsKey('userPermissions'));
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
        window.localStorage.removeItem(lsKey('user'));
        window.localStorage.removeItem(lsKey('accessToken'));
        window.localStorage.removeItem(lsKey('tenantId'));
        window.localStorage.removeItem(lsKey('csrfToken'));
        window.localStorage.removeItem(lsKey('userPermissions'));
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
      await fetch(apiPath('/api/auth/logout'), { method: 'POST', credentials: 'include' }).catch(() => null);
    } finally {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(lsKey('user'));
        window.localStorage.removeItem(lsKey('accessToken'));
        window.localStorage.removeItem(lsKey('tenantId'));
        window.localStorage.removeItem(lsKey('csrfToken'));
      }
      setCsrfToken(null);
      setTenantId(null);
      setState({ user: null, tenant: null, tenantRole: null, loading: false, error: null });
      window.location.href = LOGOUT_REDIRECT;
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
