'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, setTenantId } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { TenantOption } from '@/lib/types';
import { Building2, ArrowRight, Loader2, Globe, Shield, User } from 'lucide-react';
import { COUNTRIES } from '@/lib/countries';

const ROLE_LABELS: Record<string, string> = {
  TENANT_ADMIN: 'Administrador',
  TENANT_USER: 'Usuario',
};

const COUNTRY_FLAGS = COUNTRIES;

// Bandera chiquita: emoji + fallback textual (en Windows los emoji de bandera
// no renderizan y quedan las letras del código — igual de legible)
function FlagBadge({ country }: { country?: string | null }) {
  if (!country) return null;
  const c = COUNTRY_FLAGS[country];
  return (
    <span className="absolute -bottom-2 -right-2 flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-0.5 shadow-sm">
      <span className="text-sm leading-none" aria-hidden>{c?.flag ?? '🌐'}</span>
      <span className="text-[10px] font-semibold text-neutral-600 uppercase">{country}</span>
    </span>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

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
      const res = await apiFetch<{ accessToken?: string; activeTenant?: { id: string; name: string; slug: string } }>(
        '/auth/switch-tenant',
        { method: 'POST', json: { tenantId } }
      );
      // El Bearer tiene prioridad sobre la cookie: hay que reemplazar el token
      // viejo (que apunta al tenant origen) ANTES de pedir /auth/me.
      if (typeof window !== 'undefined') {
        if (res.accessToken) window.localStorage.setItem('accessToken', res.accessToken);
        window.localStorage.setItem('tenantId', tenantId);
        if (res.activeTenant?.id) window.localStorage.setItem('activeTenant', JSON.stringify(res.activeTenant));
      }
      setTenantId(tenantId);
      await refreshAuth();
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message ?? 'Error al cambiar de organización');
      setSwitching(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-neutral-900">¿Qué sistema de gestión querés usar?</h1>
        <p className="text-sm text-neutral-500 mt-2">Elegí el espacio de trabajo con el que vas a trabajar</p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 max-w-lg mx-auto">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
        </div>
      ) : tenants.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center max-w-lg mx-auto">
          <Building2 className="h-10 w-10 text-neutral-200 mx-auto mb-3" />
          <p className="text-neutral-500">No tenés sistemas de gestión asignados</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tenants.map((t) => (
            <button
              key={t.tenantId}
              onClick={() => switchTenant(t.tenantId)}
              disabled={switching !== null}
              className="group relative flex flex-col items-center rounded-2xl border-2 border-neutral-200 bg-white px-6 py-8 text-center transition-all hover:border-brand-500 hover:shadow-xl hover:-translate-y-1 disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {/* Avatar con logo o iniciales + bandera del país */}
              <div className="relative mb-5">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 ring-1 ring-neutral-200 group-hover:ring-brand-300 transition-all">
                  {t.logoUrl ? (
                    <img src={t.logoUrl} alt={t.name} className="max-h-16 max-w-[80%] object-contain" />
                  ) : (
                    <span className="text-2xl font-bold text-brand-700">{initials(t.name)}</span>
                  )}
                </div>
                <FlagBadge country={t.country} />
              </div>

              <p className="font-bold text-lg text-neutral-900 group-hover:text-brand-700 transition-colors">{t.name}</p>
              {t.country && COUNTRY_FLAGS[t.country] && (
                <p className="text-xs text-neutral-400 mt-0.5">{COUNTRY_FLAGS[t.country].name}</p>
              )}

              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                {t.role === 'TENANT_ADMIN' ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                {ROLE_LABELS[t.role] || t.role}
              </span>

              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
                {switching === t.tenantId ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Ingresando…
                  </>
                ) : (
                  <>
                    Ingresar <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="mt-10 text-center text-xs text-neutral-400 flex items-center justify-center gap-1.5">
        <Globe className="h-3.5 w-3.5" />
        Podés cambiar de sistema de gestión en cualquier momento desde el menú de tu perfil
      </p>
    </div>
  );
}
