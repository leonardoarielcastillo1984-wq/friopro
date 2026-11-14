'use client';
// ============================================================
// Auditor IA — shell con nav superior (sin sidebar) + guard.
// ============================================================
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { hasModulePermission } from '@/hooks/useModulePermission';
import {
  ScanSearch, BookOpenCheck, History, ArrowLeft, Lock, Bot,
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
    <div className="-m-4 sm:-m-6 min-h-[calc(100vh-4rem)]">
      {/* Nav superior */}
      <div className="flex items-center gap-1.5 px-3 sm:px-5 pt-3 pb-2.5 border-b border-neutral-200 bg-white sticky top-0 z-20">
        <span className="flex items-center gap-1.5 mr-3">
          <Bot className="h-4 w-4 text-blue-600" />
          <span className="font-semibold text-neutral-900 text-[15px] tracking-tight">
            Auditor <span className="text-blue-600">IA</span>
          </span>
        </span>
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <Link
          href="/dashboard"
          className="ml-auto flex items-center gap-1 text-[12px] text-neutral-400 hover:text-neutral-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver al SGI
        </Link>
      </div>

      <div className="p-3 sm:p-5">
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
              <Link href="/dashboard" className="text-[13px] text-blue-500">← Volver al inicio</Link>
            </div>
          </div>
        )}
        {allowed === true && children}
      </div>
    </div>
  );
}
