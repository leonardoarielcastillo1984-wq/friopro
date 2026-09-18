'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Settings, Users, PackageSearch, ScanLine, ArrowRight, Database, CheckCircle2, TrendingUp } from 'lucide-react';

const REEMPLAZO_CAMPOS: { key: string; label: string; ayuda: string; suffix: string }[] = [
  { key: 'vidaUtilAnios', label: 'Vida útil de referencia', ayuda: 'Años para prorratear el costo de una unidad nueva', suffix: 'años' },
  { key: 'depreciacionAnualPct', label: 'Depreciación anual', ayuda: '% anual para estimar el valor residual', suffix: '%' },
  { key: 'umbralReemplazarPct', label: 'Umbral REEMPLAZAR', ayuda: 'Proyección 12m ≥ este % del costo anual de una nueva', suffix: '%' },
  { key: 'umbralEvaluarPct', label: 'Umbral EVALUAR', ayuda: 'Proyección 12m ≥ este % → evaluar reemplazo', suffix: '%' },
  { key: 'tendenciaVigilarPct', label: 'Tendencia VIGILAR', ayuda: 'Crecimiento de costo semestral que dispara vigilancia', suffix: '%' },
  { key: 'acumuladoVigilarPct', label: 'Acumulado VIGILAR', ayuda: 'Reparaciones acumuladas vs valor de adquisición', suffix: '%' },
];

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
  const [reemplazo, setReemplazo] = useState<Record<string, string>>({});
  const [reemplazoSaving, setReemplazoSaving] = useState(false);
  const [reemplazoMsg, setReemplazoMsg] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ config: Record<string, number> }>('/fleet-ops/config-reemplazo')
      .then((res) => {
        const cfg: Record<string, string> = {};
        for (const c of REEMPLAZO_CAMPOS) cfg[c.key] = res.config?.[c.key] != null ? String(res.config[c.key]) : '';
        setReemplazo(cfg);
      })
      .catch(() => {});
  }, []);

  const guardarReemplazo = async () => {
    setReemplazoSaving(true);
    setReemplazoMsg(null);
    try {
      const body: Record<string, number> = {};
      for (const c of REEMPLAZO_CAMPOS) {
        const n = Number(reemplazo[c.key]);
        if (!Number.isNaN(n) && reemplazo[c.key] !== '') body[c.key] = n;
      }
      await apiFetch('/fleet-ops/config-reemplazo', { method: 'PUT', json: body });
      setReemplazoMsg('Variables guardadas. Se aplican en el próximo cálculo del gemelo digital.');
    } catch (e: any) {
      setReemplazoMsg(e?.message || 'No se pudieron guardar las variables');
    } finally {
      setReemplazoSaving(false);
    }
  };

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

      {/* Variables del análisis de reemplazo */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-neutral-800">Análisis de reemplazo</h2>
        </div>
        <p className="text-xs text-neutral-500 mb-4">
          Variables que usa el gemelo digital para recomendar mantener, vigilar o reemplazar una unidad.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
          {REEMPLAZO_CAMPOS.map((c) => (
            <div key={c.key}>
              <label className="block text-xs font-medium text-neutral-600 mb-1">{c.label} <span className="text-neutral-400">({c.suffix})</span></label>
              <input
                type="number"
                value={reemplazo[c.key] ?? ''}
                onChange={(e) => setReemplazo({ ...reemplazo, [c.key]: e.target.value })}
                className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm"
              />
              <p className="text-[11px] text-neutral-400 mt-0.5">{c.ayuda}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={guardarReemplazo}
            disabled={reemplazoSaving}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {reemplazoSaving ? 'Guardando…' : 'Guardar variables'}
          </button>
          {reemplazoMsg && <p className="text-xs text-neutral-600">{reemplazoMsg}</p>}
        </div>
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
