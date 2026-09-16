'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Wrench, Truck, Container, Link2, CalendarClock,
  ScanLine, PackageSearch, Disc, Fuel, Users, FileWarning, DollarSign, FileBarChart,
} from 'lucide-react';

const NAV = [
  { href: '/flota-360', label: 'Centro de trabajo', icon: LayoutDashboard, exact: true },
  { href: '/flota-360/vehiculos', label: 'Vehículos', icon: Truck },
  { href: '/flota-360/semis', label: 'Semis', icon: Container },
  { href: '/flota-360/conjuntos', label: 'Conjuntos operativos', icon: Link2 },
  { href: '/flota-360/ordenes', label: 'Órdenes de trabajo', icon: Wrench },
  { href: '/flota-360/planes', label: 'Planes y frecuencias', icon: CalendarClock },
  { href: '/flota-360/inspecciones', label: 'Inspecciones QR', icon: ScanLine },
  { href: '/flota-360/repuestos', label: 'Repuestos e inventario', icon: PackageSearch },
  { href: '/flota-360/neumaticos', label: 'Neumáticos', icon: Disc },
  { href: '/flota-360/combustible', label: 'Combustible', icon: Fuel },
  { href: '/flota-360/conductores', label: 'Conductores', icon: Users },
  { href: '/flota-360/documentacion', label: 'Documentación', icon: FileWarning },
  { href: '/flota-360/costos', label: 'Costos y TCO', icon: DollarSign },
  { href: '/flota-360/reportes', label: 'Reportes', icon: FileBarChart },
];

export default function Flota360Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-4 -m-4 sm:-m-6">
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-neutral-200 bg-white py-4 px-2 min-h-[calc(100vh-4rem)]">
        <div className="flex items-center gap-2 px-2 mb-4">
          <Truck className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-neutral-900 text-sm">Flota 360</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 min-w-0 p-2 sm:p-4">{children}</div>
    </div>
  );
}
