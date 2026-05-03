'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch } from '@/lib/api';

type CompanySettings = {
  companyName: string;
  legalName?: string;
  taxId?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  primaryColor?: string;
  headerText?: string;
  footerText?: string;
};

type CompanyContextType = {
  settings: CompanySettings | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const CompanyContext = createContext<CompanyContextType>({
  settings: null,
  loading: true,
  refresh: async () => {},
});

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadSettings() {
    try {
      const res = await apiFetch('/company/settings') as { settings: CompanySettings | null };
      if (res.settings) {
        setSettings(res.settings);
      }
    } catch (err) {
      console.error('Error loading company settings:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Skip loading company settings for Super Admin without tenant or on select-tenant page
    if (typeof window !== 'undefined') {
      const isSelectTenantPage = window.location.pathname === '/select-tenant';
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const isSuperAdmin = user?.globalRole === 'SUPER_ADMIN';
      
      if (isSelectTenantPage || (isSuperAdmin && !localStorage.getItem('tenantId'))) {
        setLoading(false);
        return;
      }
    }
    loadSettings();
  }, []);

  return (
    <CompanyContext.Provider value={{ settings, loading, refresh: loadSettings }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
