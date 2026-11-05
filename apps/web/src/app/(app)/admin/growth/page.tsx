'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  ArrowLeft, Eye, Wrench, UserPlus, Users, TrendingUp,
  Mail, MousePointerClick, Loader2, RefreshCw,
} from 'lucide-react';

interface GrowthStats {
  days: number;
  funnel: {
    pageViews: number;
    toolViews: number;
    leads: number;
    registerStarted: number;
    registerCompleted: number;
    newTenants: number;
  };
  leadsBySource: { source: string; count: number }[];
  referrals: { clicked: number; registered: number; rewarded: number };
  daily: { d: string; pageViews: number; leads: number; tenants: number }[];
  recentLeads: { email: string; nombre: string | null; empresa: string | null; source: string; createdAt: string }[];
}

function FunnelStep({ icon: Icon, label, value, pct, color }: {
  icon: any; label: string; value: number; pct?: number; color: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className={`rounded-lg p-2 ${color}`}><Icon className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-neutral-500">{label}</div>
        <div className="text-lg font-bold text-neutral-900">{value.toLocaleString('es-AR')}</div>
      </div>
      {pct !== undefined && (
        <div className="text-right">
          <div className="text-sm font-semibold text-neutral-700">{pct.toFixed(1)}%</div>
          <div className="text-[10px] text-neutral-400">conv.</div>
        </div>
      )}
    </div>
  );
}

export default function AdminGrowthPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<GrowthStats | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user?.globalRole !== 'SUPER_ADMIN') {
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<GrowthStats>(`/growth/stats?days=${days}`);
      setStats(data);
    } catch { /* sin permiso o endpoint caído */ }
    setLoading(false);
  };

  useEffect(() => {
    if (user?.globalRole === 'SUPER_ADMIN') void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, user]);

  if (authLoading || !stats) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  const f = stats.funnel;
  const conv = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
  const maxLead = Math.max(...stats.leadsBySource.map((s) => s.count), 1);
  const maxDaily = Math.max(...stats.daily.map((d) => d.pageViews), 1);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="rounded-lg border border-neutral-200 p-2 text-neutral-500 hover:bg-neutral-50">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Growth</h1>
            <p className="text-xs text-neutral-500">Funnel de adquisición · últimos {days} días</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          >
            <option value={7}>7 días</option>
            <option value={30}>30 días</option>
            <option value={90}>90 días</option>
            <option value={365}>1 año</option>
          </select>
          <button onClick={load} className="rounded-lg border border-neutral-200 p-2 text-neutral-500 hover:bg-neutral-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Funnel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-neutral-900">Funnel de adquisición</h2>
          <div className="divide-y divide-neutral-100">
            <FunnelStep icon={Eye} label="Visitas a páginas públicas" value={f.pageViews} color="bg-sky-100 text-sky-600" />
            <FunnelStep icon={Wrench} label="Uso de herramientas gratis" value={f.toolViews} pct={conv(f.toolViews, f.pageViews)} color="bg-violet-100 text-violet-600" />
            <FunnelStep icon={Mail} label="Leads capturados" value={f.leads} pct={conv(f.leads, f.pageViews)} color="bg-amber-100 text-amber-600" />
            <FunnelStep icon={MousePointerClick} label="Registros iniciados" value={f.registerStarted} pct={conv(f.registerStarted, f.pageViews)} color="bg-blue-100 text-blue-600" />
            <FunnelStep icon={UserPlus} label="Registros completados" value={f.registerCompleted} pct={conv(f.registerCompleted, f.registerStarted)} color="bg-emerald-100 text-emerald-600" />
            <FunnelStep icon={Users} label="Tenants nuevos" value={f.newTenants} pct={conv(f.newTenants, f.pageViews)} color="bg-green-100 text-green-600" />
          </div>
        </div>

        {/* Referidos + actividad diaria */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">Programa de referidos</h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-neutral-50 p-3">
                <div className="text-2xl font-bold text-neutral-900">{stats.referrals.clicked}</div>
                <div className="text-[11px] text-neutral-500">Clicks</div>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3">
                <div className="text-2xl font-bold text-neutral-900">{stats.referrals.registered}</div>
                <div className="text-[11px] text-neutral-500">Registrados</div>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <div className="text-2xl font-bold text-emerald-700">{stats.referrals.rewarded}</div>
                <div className="text-[11px] text-emerald-600">Premiados</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">Visitas por día</h2>
            <div className="flex h-28 items-end gap-[3px]">
              {stats.daily.slice(-30).map((d) => (
                <div key={d.d} className="group relative flex-1">
                  <div
                    className="w-full rounded-t bg-brand-400/80 transition-colors group-hover:bg-brand-500"
                    style={{ height: `${Math.max((d.pageViews / maxDaily) * 100, 2)}%` }}
                  />
                  <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-neutral-800 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {d.d}: {d.pageViews}v · {d.leads}l · {d.tenants}t
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Leads por fuente */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">Leads por fuente</h2>
          {stats.leadsBySource.length === 0 && <p className="text-sm text-neutral-400">Sin leads en el período.</p>}
          <div className="space-y-2">
            {stats.leadsBySource.map((s) => (
              <div key={s.source} className="flex items-center gap-3">
                <span className="w-40 truncate text-xs text-neutral-600">{s.source}</span>
                <div className="h-2 flex-1 rounded-full bg-neutral-100">
                  <div className="h-2 rounded-full bg-brand-500" style={{ width: `${(s.count / maxLead) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-xs font-semibold text-neutral-800">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Últimos leads */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">Últimos leads</h2>
          <div className="divide-y divide-neutral-100">
            {stats.recentLeads.map((l, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-neutral-800">{l.email}</div>
                  <div className="truncate text-xs text-neutral-400">
                    {[l.nombre, l.empresa].filter(Boolean).join(' · ') || l.source}
                  </div>
                </div>
                <div className="ml-3 flex-shrink-0 text-right">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">{l.source}</span>
                  <div className="mt-0.5 text-[10px] text-neutral-400">
                    {new Date(l.createdAt).toLocaleDateString('es-AR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-neutral-400">
        <TrendingUp className="mr-1 inline h-3 w-3" />
        Datos propios del funnel — sin cookies de terceros.
      </p>
    </div>
  );
}
