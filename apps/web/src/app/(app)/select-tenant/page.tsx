'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { TenantOption } from '@/lib/types';
import { Building2, ArrowRight, Loader2, Globe, Shield, User } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  TENANT_ADMIN: 'Administrador',
  TENANT_USER: 'Usuario',
};

export default function SelectTenantPage() {
  const router = useRouter();
  const { refreshAuth } = useAuth();
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{ tenants: TenantOption[] }>('/auth/tenants');
        setTenants(res.tenants);
      } catch (err: any) {
        setError(err?.message ?? 'Error al cargar organizaciones');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function switchTenant(tenantId: string) {
    setError(null);
    setSwitching(tenantId);
    try {
      await apiFetch('/auth/switch-tenant', { method: 'POST', json: { tenantId } });
      await refreshAuth();
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message ?? 'Error al cambiar de organización');
      setSwitching(null);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="text-center mb-8">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 mb-4">
          <Globe className="h-7 w-7 text-brand-600" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900">Seleccionar organización</h1>
        <p className="text-sm text-neutral-500 mt-1">Elegí la organización con la que querés trabajar</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : tenants.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
          <Building2 className="h-10 w-10 text-neutral-200 mx-auto mb-3" />
          <p className="text-neutral-500">No tenés organizaciones asignadas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tenants.map((t) => (
            <button
              key={t.tenantId}
              onClick={() => switchTenant(t.tenantId)}
              disabled={switching !== null}
              className="w-full group flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-5 text-left transition-all hover:border-brand-300 hover:shadow-md disabled:opacity-60"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100 transition-colors">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-neutral-900 truncate">{t.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-neutral-400 font-mono">{t.slug}</span>
                  <span className="text-neutral-200">·</span>
                  <span className="text-xs text-neutral-500 flex items-center gap-1">
                    {t.role === 'TENANT_ADMIN' ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                    {ROLE_LABELS[t.role] || t.role}
                  </span>
                </div>
              </div>
              {switching === t.tenantId ? (
                <Loader2 className="h-5 w-5 animate-spin text-brand-600 flex-shrink-0" />
              ) : (
                <ArrowRight className="h-5 w-5 text-neutral-300 group-hover:text-brand-500 transition-colors flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
