import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ClipboardCheck, FileText, Lock, Shield, ShieldAlert, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Herramientas gratuitas ISO — checklists, plantillas IPERC, BIA y SoA | SGI360',
  description:
    'Herramientas gratuitas para tu sistema de gestión: checklist ISO 9001 interactivo, plantilla matriz IPERC, plantilla BIA y Declaración de Aplicabilidad ISO 27001 en Excel.',
  alternates: { canonical: 'https://logismart.ar/herramientas' },
};

const HERRAMIENTAS = [
  {
    href: '/herramientas/checklist-iso-9001',
    icon: ClipboardCheck,
    tag: 'Interactiva · sin registro',
    title: 'Checklist ISO 9001 — Autodiagnóstico',
    desc: 'Evaluá el estado de tu sistema de gestión en 10 minutos: contexto, liderazgo, riesgos, soporte, operación, evaluación y mejora.',
    norma: 'ISO 9001',
  },
  {
    href: '/herramientas/matriz-iperc',
    icon: ShieldAlert,
    tag: 'Excel descargable',
    title: 'Plantilla Matriz IPERC',
    desc: 'Identificación de peligros y evaluación de riesgos con escala 5×5, controles y plan de acción — lista para ISO 45001.',
    norma: 'ISO 45001',
  },
  {
    href: '/herramientas/plantilla-bia',
    icon: FileText,
    tag: 'Excel descargable',
    title: 'Plantilla BIA — Análisis de Impacto al Negocio',
    desc: 'Procesos críticos, RTO/RPO/MTPD, impactos y dependencias — la base del sistema de continuidad de ISO 22301.',
    norma: 'ISO 22301',
  },
  {
    href: '/herramientas/soa-iso-27001',
    icon: Lock,
    tag: 'Excel descargable',
    title: 'SoA ISO 27001 — Declaración de Aplicabilidad',
    desc: 'Los 93 controles del Anexo A ya listados con aplicabilidad, justificación, estado y responsable.',
    norma: 'ISO 27001',
  },
];

export default function HerramientasPage() {
  return (
    <div className="min-h-screen bg-white font-sans antialiased text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold">LOGISMART</span>
            <span className="text-xs text-slate-400">· Herramientas gratis</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/recursos" className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:block">
              Recursos
            </Link>
            <Link href="/sgi360-landing" className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:block">
              SGI360
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-slate-100 bg-gradient-to-b from-green-50/60 to-white py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <span className="rounded-full bg-green-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-green-700">
            Herramientas gratuitas
          </span>
          <h1 className="mt-5 text-4xl font-bold">Plantillas y checklists para tu sistema de gestión</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Herramientas gratis que usamos con clientes reales — checklists interactivos y plantillas
            Excel listas para ISO 9001, 45001, 22301 y 27001.
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto grid max-w-4xl gap-5 px-6">
          {HERRAMIENTAS.map((h) => {
            const Icon = h.icon;
            return (
              <Link
                key={h.href}
                href={h.href}
                className="group flex items-start gap-5 rounded-2xl border border-slate-100 bg-white p-6 transition-all hover:border-green-200 hover:shadow-lg"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-50">
                  <Icon className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">{h.norma}</span>
                    <span className="text-xs text-slate-400">{h.tag}</span>
                  </div>
                  <h2 className="mt-2 text-lg font-bold text-slate-900 group-hover:text-green-700">{h.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">{h.desc}</p>
                </div>
                <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-green-600" />
              </Link>
            );
          })}
        </div>
      </section>

      <footer className="bg-slate-900 py-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 px-6 text-center">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-green-600 to-emerald-500">
              <Shield className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-white">SGI360</span>
            <span className="text-xs text-slate-400">by LOGISMART</span>
          </div>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} LOGISMART</p>
        </div>
      </footer>
    </div>
  );
}
