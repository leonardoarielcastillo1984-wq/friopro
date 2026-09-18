'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './fleet.css';
import {
  LayoutDashboard, Wrench, Truck, Container, Link2, CalendarClock,
  ScanLine, PackageSearch, Disc, Fuel, Users, FileWarning, DollarSign,
  FileBarChart, LayoutGrid, ArrowLeft, Settings, Menu, X, TrendingUp, BookOpen,
  HardHat, Activity,
} from 'lucide-react';

const GROUPS: { label: string | null; items: { href: string; label: string; icon: any; exact?: boolean }[] }[] = [
  {
    label: null,
    items: [
      { href: '/flota-360', label: 'Centro de trabajo', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: 'Flota',
    items: [
      { href: '/flota-360/vehiculos', label: 'Vehículos', icon: Truck },
      { href: '/flota-360/semis', label: 'Semis', icon: Container },
      { href: '/flota-360/conjuntos', label: 'Conjuntos operativos', icon: Link2 },
    ],
  },
  {
    label: 'Mantenimiento',
    items: [
      { href: '/flota-360/ordenes', label: 'Órdenes de trabajo', icon: Wrench },
      { href: '/flota-360/mecanicos', label: 'Mecánicos', icon: HardHat },
      { href: '/flota-360/planes', label: 'Planes y frecuencias', icon: CalendarClock },
      { href: '/flota-360/inspecciones', label: 'Inspecciones QR', icon: ScanLine },
      { href: '/flota-360/repuestos', label: 'Repuestos e inventario', icon: PackageSearch },
    ],
  },
  {
    label: 'Recursos',
    items: [
      { href: '/flota-360/neumaticos', label: 'Neumáticos', icon: Disc },
      { href: '/flota-360/combustible', label: 'Combustible', icon: Fuel },
      { href: '/flota-360/conductores', label: 'Conductores', icon: Users },
      { href: '/flota-360/documentacion', label: 'Documentación', icon: FileWarning },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { href: '/flota-360/panel', label: 'Panel', icon: TrendingUp },
      { href: '/flota-360/disponibilidad', label: 'Disponibilidad', icon: Activity },
      { href: '/flota-360/costos', label: 'Costos y TCO', icon: DollarSign },
      { href: '/flota-360/reportes', label: 'Reportes', icon: FileBarChart },
      { href: '/flota-360/configuracion', label: 'Configuración', icon: Settings },
    ],
  },
];

function NavContent({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2 px-2.5 mb-1 pb-3 border-b border-white/10">
        <LayoutGrid className="h-4 w-4 text-blue-400 shrink-0" />
        <span className="font-bold text-white text-2xl tracking-tight">Flota <span className="text-blue-400">360</span></span>
      </div>
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-2 px-2.5 py-1.5 mb-2 rounded-md text-[12.5px] text-blue-300 hover:bg-white/5 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
        <span>Volver al SGI</span>
      </Link>
      <Link
        href="/modo-de-uso?guide=flota-360"
        onClick={onNavigate}
        className="flex items-center gap-2 px-2.5 py-1.5 mb-2 rounded-md text-[12.5px] text-blue-300 hover:bg-white/5 hover:text-white transition-colors"
      >
        <BookOpen className="h-3.5 w-3.5 shrink-0" />
        <span>Guía de uso</span>
      </Link>
      <nav className="flex flex-col gap-3 overflow-y-auto flex-1">
        {GROUPS.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-0.5">
            {group.label && (
              <span className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-blue-300/50">{group.label}</span>
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
                    active
                      ? 'bg-blue-600 text-white font-medium shadow-sm'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
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

export default function Flota360Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="fleet-shell flex gap-0 -m-4 sm:-m-6 min-h-[calc(100vh-4rem)]">
      {/* Sidebar desktop — única navegación visible dentro del módulo */}
      <aside className="hidden lg:flex flex-col w-[256px] shrink-0 bg-[#0d1b3d] py-4 px-2.5 sticky top-0 h-screen shadow-[1px_0_0_rgba(255,255,255,0.06)]">
        <NavContent pathname={pathname} />
      </aside>

      {/* Mobile: barra superior compacta + drawer propio del módulo */}
      <div className="lg:hidden fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú de Flota 360"
          className="flex items-center gap-2 rounded-full bg-[#0d1b3d] px-4 py-2.5 text-white shadow-lg text-[12.5px] font-medium"
        >
          <Menu className="h-4 w-4" /> Flota 360
        </button>
      </div>
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col bg-[#0d1b3d] py-3 px-2 lg:hidden">
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
