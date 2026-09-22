'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Ruler, TrendingUp, AlertTriangle, ClipboardCheck,
  FolderKanban, PackageCheck, Wrench, Layers, ArrowLeft, Menu, X, LayoutGrid,
} from 'lucide-react';

const GROUPS: { label: string | null; items: { href: string; label: string; icon: any; exact?: boolean }[] }[] = [
  {
    label: null,
    items: [{ href: '/core-tools', label: 'Panel', icon: LayoutDashboard, exact: true }],
  },
  {
    label: 'Medición y proceso',
    items: [
      { href: '/core-tools/msa', label: 'MSA — Estudios R&R', icon: Ruler },
      { href: '/core-tools/spc', label: 'SPC — Cartas de control', icon: TrendingUp },
    ],
  },
  {
    label: 'Riesgo y control',
    items: [
      { href: '/core-tools/fmea', label: 'FMEA (AIAG-VDA)', icon: AlertTriangle },
      { href: '/core-tools/plan-control', label: 'Planes de control', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Lanzamiento',
    items: [
      { href: '/core-tools/apqp', label: 'APQP — Proyectos', icon: FolderKanban },
      { href: '/core-tools/ppap', label: 'PPAP — Aprobaciones', icon: PackageCheck },
    ],
  },
  {
    label: 'Resolución y auditoría',
    items: [
      { href: '/core-tools/8d', label: 'Reportes 8D', icon: Wrench },
      { href: '/core-tools/lpa', label: 'LPA — Auditorías por capas', icon: Layers },
    ],
  },
];

function NavContent({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2 px-2.5 mb-1 pb-3 border-b border-white/10">
        <LayoutGrid className="h-4 w-4 text-amber-400 shrink-0" />
        <span className="font-bold text-white text-2xl tracking-tight">Core <span className="text-amber-400">Tools</span></span>
      </div>
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-2 px-2.5 py-1.5 mb-2 rounded-md text-[12.5px] text-amber-300 hover:bg-white/5 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
        <span>Volver al SGI</span>
      </Link>
      <nav className="flex flex-col gap-3 overflow-y-auto flex-1">
        {GROUPS.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-0.5">
            {group.label && (
              <span className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300/50">{group.label}</span>
            )}
            {group.items.map((item) => {
              const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] transition-colors ${
                    active ? 'bg-amber-600 text-white font-medium shadow-sm' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );
}

export default function CoreToolsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex gap-0 -m-4 sm:-m-6 min-h-[calc(100vh-4rem)]">
      <aside className="hidden lg:flex flex-col w-[256px] shrink-0 bg-[#1a1408] py-4 px-2.5 sticky top-0 h-screen shadow-[1px_0_0_rgba(255,255,255,0.06)]">
        <NavContent pathname={pathname} />
      </aside>

      <div className="lg:hidden fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú de Core Tools"
          className="flex items-center gap-2 rounded-full bg-[#1a1408] px-4 py-2.5 text-white shadow-lg text-[12.5px] font-medium"
        >
          <Menu className="h-4 w-4" /> Core Tools
        </button>
      </div>
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col bg-[#1a1408] py-3 px-2 lg:hidden">
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

      <div className="flex-1 min-w-0 p-3 sm:p-5">{children}</div>
    </div>
  );
}
