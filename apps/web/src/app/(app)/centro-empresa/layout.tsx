'use client';
// ============================================================
// Shell del Centro de Control Empresarial — sub-nav propio
// (mismo patrón que Flota 360) + guard de acceso por permiso.
// ============================================================
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { hasModulePermission } from '@/hooks/useModulePermission';
import {
  LayoutGrid, LayoutDashboard, Building2, Network, TrendingUp,
  Bell, Settings, ArrowLeft, Menu, X, Lock,
} from 'lucide-react';

const ITEMS = [
  { href: '/centro-empresa', label: 'Vista general', icon: LayoutDashboard, exact: true },
  { href: '/centro-empresa/campus', label: 'Campus 3D', icon: Building2 },
  { href: '/centro-empresa/procesos', label: 'Mapa de Procesos 3D', icon: Network },
  { href: '/centro-empresa/indicadores', label: 'Indicadores', icon: TrendingUp },
  { href: '/centro-empresa/alertas', label: 'Alertas', icon: Bell },
  { href: '/centro-empresa/configuracion', label: 'Configuración', icon: Settings },
];

function NavContent({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2 px-2.5 mb-1 pb-3 border-b border-white/10">
        <Building2 className="h-4 w-4 text-sky-400 shrink-0" />
        <span className="font-bold text-white text-xl tracking-tight">Centro <span className="text-sky-400">Empresarial</span></span>
      </div>
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-2 px-2.5 py-1.5 mb-2 rounded-md text-[12.5px] text-sky-300 hover:bg-white/5 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
        <span>Volver al SGI</span>
      </Link>
      <nav className="flex flex-col gap-0.5 overflow-y-auto flex-1">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] transition-colors ${
                active ? 'bg-sky-600 text-white font-medium shadow-sm' : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-2.5 pt-3 mt-2 border-t border-white/10 text-[10px] text-slate-500">
        <LayoutGrid className="h-3 w-3 inline mr-1 -mt-0.5" />
        Capa de consolidación — datos de los módulos SGI
      </div>
    </>
  );
}

export default function CentroEmpresaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, tenantRole, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    const isAdmin = user?.globalRole === 'SUPER_ADMIN' || tenantRole === 'TENANT_ADMIN';
    setAllowed(isAdmin || hasModulePermission('centro-empresa'));
  }, [loading, user?.globalRole, tenantRole]);

  return (
    <div className="flex gap-0 -m-4 sm:-m-6 min-h-[calc(100vh-4rem)]">
      <aside className="hidden lg:flex flex-col w-[256px] shrink-0 bg-[#0a1628] py-4 px-2.5 sticky top-0 h-screen shadow-[1px_0_0_rgba(255,255,255,0.06)]">
        <NavContent pathname={pathname} />
      </aside>

      <div className="lg:hidden fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú de Centro Empresarial"
          className="flex items-center gap-2 rounded-full bg-[#0a1628] px-4 py-2.5 text-white shadow-lg text-[12.5px] font-medium"
        >
          <Menu className="h-4 w-4" /> Centro Empresarial
        </button>
      </div>
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col bg-[#0a1628] py-3 px-2 lg:hidden">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
              className="absolute right-2 top-2 rounded-md p-1.5 text-slate-300 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
            <NavContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      <div className="flex-1 min-w-0 p-3 sm:p-5">
        {allowed === null && (
          <div className="flex items-center justify-center min-h-[50vh] text-sm text-slate-400">Verificando permisos…</div>
        )}
        {allowed === false && (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center max-w-sm p-6">
              <Lock size={34} className="text-slate-500 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-slate-200 mb-2">Acceso restringido</h2>
              <p className="text-[13px] text-slate-400 mb-4">
                No tenés permiso para ver el Centro Empresarial. Pedile al administrador
                que lo habilite en tus permisos de módulo.
              </p>
              <Link href="/dashboard" className="text-[13px] text-sky-400">← Volver al inicio</Link>
            </div>
          </div>
        )}
        {allowed === true && children}
      </div>
    </div>
  );
}
