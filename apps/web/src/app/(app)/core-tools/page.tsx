'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  Ruler, TrendingUp, AlertTriangle, ClipboardCheck, FolderKanban,
  PackageCheck, Wrench, Layers, ArrowRight,
} from 'lucide-react';

const TOOLS = [
  {
    href: '/core-tools/msa', icon: Ruler, color: 'bg-blue-500',
    title: 'MSA — Análisis de Sistemas de Medición',
    desc: 'Estudios Gage R&R, sesgo, linealidad, estabilidad y acuerdo de atributos sobre los equipos de medición.',
    tag: 'AIAG MSA-4',
  },
  {
    href: '/core-tools/spc', icon: TrendingUp, color: 'bg-emerald-500',
    title: 'SPC — Control Estadístico de Procesos',
    desc: 'Cartas X̄-R, X̄-S, I-MR, p, np, c, u con límites de control, Cp/Cpk/Pp/Ppk y reglas Western Electric.',
    tag: 'AIAG SPC-2',
  },
  {
    href: '/core-tools/fmea', icon: AlertTriangle, color: 'bg-red-500',
    title: 'FMEA — Análisis de Modos de Falla',
    desc: 'DFMEA y PFMEA con metodología AIAG-VDA: severidad, ocurrencia, detección y Action Priority.',
    tag: 'AIAG-VDA',
  },
  {
    href: '/core-tools/plan-control', icon: ClipboardCheck, color: 'bg-indigo-500',
    title: 'Planes de Control',
    desc: 'Planes de prototipo, pre-lanzamiento y producción vinculados al PFMEA con características especiales.',
    tag: 'IATF 8.5.1.1',
  },
  {
    href: '/core-tools/apqp', icon: FolderKanban, color: 'bg-violet-500',
    title: 'APQP — Planificación Avanzada',
    desc: 'Proyectos de lanzamiento con las 5 fases APQP y checklist de entregables por fase.',
    tag: 'AIAG APQP-2',
  },
  {
    href: '/core-tools/ppap', icon: PackageCheck, color: 'bg-amber-500',
    title: 'PPAP — Aprobación de Piezas',
    desc: 'Paquetes de aprobación con los 18 elementos, niveles de envío 1-5 y seguimiento de estado.',
    tag: 'AIAG PPAP-4',
  },
  {
    href: '/core-tools/8d', icon: Wrench, color: 'bg-cyan-500',
    title: '8D — Resolución de Problemas',
    desc: 'Reportes 8D vinculados a no conformidades con las 8 disciplinas y análisis de causa raíz asistido por IA.',
    tag: 'Ford / IATF',
  },
  {
    href: '/core-tools/lpa', icon: Layers, color: 'bg-pink-500',
    title: 'LPA — Auditorías por Capas',
    desc: 'Auditorías de proceso por capas con checklists, frecuencias y registro de ejecuciones con hallazgos.',
    tag: 'CQI-8 / IATF',
  },
];

export default function CoreToolsHub() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = async () => {
      const eps: Record<string, string> = {
        '/core-tools/msa': '/core-tools/msa',
        '/core-tools/spc': '/core-tools/spc',
        '/core-tools/fmea': '/core-tools/fmea',
        '/core-tools/plan-control': '/core-tools/control-plans',
        '/core-tools/apqp': '/core-tools/apqp',
        '/core-tools/ppap': '/core-tools/ppap',
        '/core-tools/8d': '/core-tools/eight-d',
        '/core-tools/lpa': '/core-tools/lpa/plans',
      };
      const out: Record<string, number> = {};
      await Promise.all(
        Object.entries(eps).map(async ([k, ep]) => {
          try {
            const res = await apiFetch<{ items: any[] }>(ep);
            out[k] = res.items?.length ?? 0;
          } catch {
            out[k] = 0;
          }
        })
      );
      setCounts(out);
    };
    load();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Core Tools — IATF 16949</h1>
        <p className="text-sm text-gray-500 mt-1">
          Herramientas técnicas de calidad automotriz: MSA, SPC, FMEA, Plan de Control, APQP, PPAP, 8D y LPA.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const count = counts[t.href];
          return (
            <Link
              key={t.href}
              href={t.href}
              className="group rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md hover:border-gray-300 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg ${t.color} flex items-center justify-center`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                {count !== undefined && (
                  <span className="text-xs font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                    {count} {count === 1 ? 'registro' : 'registros'}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-amber-700 transition-colors">
                {t.title}
              </h3>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{t.desc}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5">
                  {t.tag}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
