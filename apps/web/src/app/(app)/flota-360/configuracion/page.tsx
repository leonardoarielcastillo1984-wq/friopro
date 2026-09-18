'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Settings, Users, PackageSearch, ScanLine, ArrowRight, Database, CheckCircle2 } from 'lucide-react';

const ITEMS = [
  {
    href: '/mantenimiento',
    icon: Users,
    titulo: 'Técnicos y taller',
    descripcion: 'Capacidad diaria, especializaciones y disponibilidad del equipo de mantenimiento',
  },
  {
    href: '/flota-360/repuestos',
    icon: PackageSearch,
    titulo: 'Catálogo de repuestos',
    descripcion: 'Stock mínimo, ubicaciones y proveedores de repuestos',
  },
  {
    href: '/infraestructura',
    icon: ScanLine,
    titulo: 'Plantillas de inspección QR',
    descripcion: 'Checklists y formularios usados en las inspecciones de activos',
  },
];

export default function ConfiguracionFlotaPage() {
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  const cargarDemo = async () => {
    setSeeding(true);
    setSeedResult(null);
    setSeedError(null);
    try {
      const res = await apiFetch<any>('/fleet-ops/seed-demo', { method: 'POST' });
      if (res.yaExistia) {
        setSeedResult('Los datos de demostración ya estaban cargados.');
      } else {
        const r = res.resumen || {};
        setSeedResult(`Datos cargados: ${r.vehiculos} vehículos, ${r.ordenes} órdenes, ${r.planes} planes, ${r.inspecciones} inspecciones, ${r.cargasCombustible} cargas de combustible, ${r.conjuntos} conjuntos.`);
      }
    } catch (e: any) {
      setSeedError(e?.message || 'No se pudieron cargar los datos de demostración');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-[#0d1b3d]">Configuración</h1>
        <p className="text-xs text-neutral-500">Parámetros operativos del módulo de flota</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border border-neutral-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-neutral-800">{item.titulo}</span>
              </div>
              <p className="text-xs text-neutral-500 mb-3">{item.descripcion}</p>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 group-hover:underline">
                Abrir <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-neutral-400" />
          <div>
            <p className="text-sm font-medium text-neutral-800">Datos de demostración</p>
            <p className="text-xs text-neutral-500">Carga vehículos, planes, órdenes, inspecciones, neumáticos y costos de ejemplo para explorar el módulo</p>
            {seedResult && <p className="text-xs text-green-700 mt-1 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {seedResult}</p>}
            {seedError && <p className="text-xs text-red-600 mt-1">{seedError}</p>}
          </div>
        </div>
        <button
          onClick={cargarDemo}
          disabled={seeding}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Database className="h-3.5 w-3.5" /> {seeding ? 'Cargando…' : 'Cargar datos demo'}
        </button>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-5 w-5 text-neutral-400" />
          <div>
            <p className="text-sm font-medium text-neutral-800">Configuración general del sistema</p>
            <p className="text-xs text-neutral-500">Empresa, usuarios, roles y permisos</p>
          </div>
        </div>
        <Link href="/configuracion" className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
          Ir a Configuración <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
