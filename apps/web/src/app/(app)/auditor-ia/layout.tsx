'use client';
// ============================================================
// Auditor IA — shell con sub-nav propio + guard por permiso.
// ============================================================
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { hasModulePermission } from '@/hooks/useModulePermission';
import {
  ScanSearch, BookOpenCheck, History, ClipboardList, ArrowLeft, Lock, Bot,
} from 'lucide-react';

const ITEMS = [
  { href: '/auditor-ia', label: 'Revisiones', icon: ScanSearch, exact: true },
  { href: '/auditor-ia/normas', label: 'Extracción normativa', icon: BookOpenCheck },
  { href: '/auditor-ia/revisiones', label: 'Historial', icon: History },
];

export default function AuditorIaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, tenantRole, loading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    const isAdmin = user?.globalRole === 'SUPER_ADMIN' || tenantRole === 'TENANT_ADMIN';
    setAllowed(isAdmin || hasModulePermission('auditor-ia'));
  }, [loading, user?.globalRole, tenantRole]);

  return (
    <div className="flex gap-0 -m-4 sm:-m-6 min-h-[calc(100vh-4rem)]">
      <aside className="hidden lg:flex flex-col w-[230px] shrink-0 bg-[#0a1628] py-4 px-2.5 sticky top-0 h-screen">
        <div className="flex items-center gap-2 px-2.5 mb-1 pb-3 border-b border-white/10">
          <Bot className="h-4 w-4 text-violet-400 shrink-0" />
          <span className="font-bold text-white text-lg tracking-tight">
            Auditor <span className="text-violet-400">IA</span>
          </span>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-2.5 py-1.5 mb-2 rounded-md text-[12.5px] text-violet-300 hover:bg-white/5 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
          <span>Volver al SGI</span>
        </Link>
        <nav className="flex flex-col gap-0.5">
          {ITEMS.map((item) => {
            const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] transition-colors ${
                  active ? 'bg-violet-600 text-white font-medium' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="px-2.5 pt-3 mt-2 border-t border-white/10 text-[10px] text-slate-500">
          <ClipboardList className="h-3 w-3 inline mr-1 -mt-0.5" />
          La IA asiste — las decisiones de conformidad son humanas
        </div>
      </aside>

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
                No tenés permiso para usar Auditor IA. Pedile al administrador
                que lo habilite en tus permisos de módulo.
              </p>
              <Link href="/dashboard" className="text-[13px] text-violet-400">← Volver al inicio</Link>
            </div>
          </div>
        )}
        {allowed === true && children}
      </div>
    </div>
  );
}
