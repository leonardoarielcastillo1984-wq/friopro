import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Car, FileSpreadsheet, Globe, Truck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Recursos — Guías sobre SGI, ISO 9001, IATF 16949 y core tools | SGI360',
  description:
    'Guías prácticas para empresas que buscan implementar o mantener un Sistema de Gestión Integrado: ISO 9001 en pymes, core tools de IATF 16949, y cuándo pasar de Excel a un software dedicado.',
  alternates: { canonical: 'https://logismart.ar/recursos' },
};

const ARTICULOS = [
  {
    href: '/recursos/software-iso-9001-pymes',
    icon: BookOpen,
    tag: 'ISO 9001',
    title: 'Cómo elegir software para ISO 9001 siendo pyme (Chile y Argentina)',
    desc: 'Qué funciones son imprescindibles, qué errores evitar y cómo evaluar plataformas de gestión de calidad sin consultores caros.',
    tiempo: '8 min',
  },
  {
    href: '/recursos/core-tools-iatf-16949',
    icon: Car,
    tag: 'IATF 16949',
    title: 'Core tools de IATF 16949: APQP, PPAP, FMEA, MSA y SPC en un solo sistema',
    desc: 'Qué es cada core tool, por qué fallan en planillas sueltas y qué debe tener un software para gestionarlas integradas.',
    tiempo: '10 min',
  },
  {
    href: '/recursos/sgi-vs-excel',
    icon: FileSpreadsheet,
    tag: 'Comparativa',
    title: 'SGI con Excel vs software dedicado: comparación honesta',
    desc: 'Cuándo las planillas alcanzan, cuándo se convierten en riesgo y cómo medir el costo real de cada opción.',
    tiempo: '7 min',
  },
  {
    href: '/recursos/sgi-transporte-logistica',
    icon: Truck,
    tag: 'Transporte',
    title: 'SGI para transporte y logística: ISO, flota y seguridad en un solo sistema',
    desc: 'Cómo gestionar calidad, mantenimiento de flota, control de conductores y resultados sin sistemas separados.',
    tiempo: '8 min',
  },
  {
    href: '/recursos/software-calidad-latam',
    icon: Globe,
    tag: 'Panorama',
    title: 'Software de gestión de calidad en Latinoamérica: opciones y cómo compararlas',
    desc: 'Suites enterprise, planillas, herramientas genéricas y SaaS regionales — qué evaluar según el tamaño de tu operación.',
    tiempo: '9 min',
  },
];

export default function RecursosPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <span className="text-xs font-bold uppercase tracking-widest text-green-600">Recursos</span>
      <h1 className="mt-3 text-4xl font-bold text-slate-900">
        Guías para gestionar la calidad sin vueltas
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-500">
        Contenido práctico sobre sistemas de gestión integrados, normas ISO e IATF y
        digitalización de procesos — basado en lo que vemos implementando SGI360 en empresas reales.
      </p>

      <div className="mt-12 grid gap-6">
        {ARTICULOS.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="group flex items-start gap-5 rounded-2xl border border-slate-100 bg-white p-6 transition-all hover:border-green-200 hover:shadow-lg"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-50">
                <Icon className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">{a.tag}</span>
                  <span className="text-xs text-slate-400">{a.tiempo} de lectura</span>
                </div>
                <h2 className="mt-2 text-lg font-bold text-slate-900 group-hover:text-green-700">{a.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{a.desc}</p>
              </div>
              <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-green-600" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
