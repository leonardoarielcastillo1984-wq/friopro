'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Wrench, Truck, Container, Link2, CalendarClock,
  ScanLine, PackageSearch, Disc, Fuel, Users, FileWarning, DollarSign, FileBarChart, LayoutGrid,
} from 'lucide-react';

const GROUPS: { label: string | null; items: { href: string; label: string; icon: any; exact?: boolean }[] }[] = [
  {
    label: null,
    items: [{ href: '/flota-360', label: 'Centro de trabajo', icon: LayoutDashboard, exact: true }],
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
      { href: '/flota-360/costos', label: 'Costos y TCO', icon: DollarSign },
      { href: '/flota-360/reportes', label: 'Reportes', icon: FileBarChart },
    ],
  },
];

export default function Flota360Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-0 -m-4 sm:-m-6 bg-neutral-50 min-h-[calc(100vh-4rem)]">
      <aside className="hidden lg:flex flex-col w-48 shrink-0 bg-[#0d1b3d] py-3 px-2">
        <div className="flex items-center gap-2 px-2 mb-3 pb-3 border-b border-white/10">
          <LayoutGrid className="h-4 w-4 text-blue-400" />
          <span className="font-semibold text-white text-[13px] tracking-tight">Flota 360</span>
        </div>
        <nav className="flex flex-col gap-3 overflow-y-auto">
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
      </aside>
      <div className="flex-1 min-w-0 p-3 sm:p-5">{children}</div>
    </div>
  );
}
