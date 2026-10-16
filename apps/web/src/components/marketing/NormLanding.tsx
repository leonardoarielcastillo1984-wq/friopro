import Link from 'next/link';
import { Shield, Zap, CheckCircle2, ArrowRight, MessageCircle, type LucideIcon } from 'lucide-react';
import { BUSINESS } from '@/lib/legal';

export interface NormLandingData {
  norma: string;
  tag: string;
  h1: string;
  sub: string;
  heroCta: string;
  dolorTitulo: string;
  dolores: string[];
  coberturaTitulo: string;
  cobertura: { icon: LucideIcon; titulo: string; desc: string }[];
  cierre: string;
}

export function NormLanding({ d }: { d: NormLandingData }) {
  const waLink = `https://wa.me/${BUSINESS.whatsappIntl}?text=${encodeURIComponent(
    `Hola, quiero información sobre SGI360 para ${d.norma}.`,
  )}`;

  return (
    <div className="min-h-screen bg-white font-sans antialiased text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold">LOGISMART</span>
            <span className="text-xs text-slate-400">· {d.norma}</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/sgi360-landing" className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:block">
              SGI360
            </Link>
            <a
              href={waLink}
              target="_blank"
              rel="noopener"
              className="rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg"
            >
              Pedir demo
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-slate-100 bg-gradient-to-b from-green-50/60 to-white py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <span className="rounded-full bg-green-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-green-700">
            {d.tag}
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-tight sm:text-5xl">{d.h1}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">{d.sub}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href={waLink}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-500 px-8 py-4 font-bold text-white transition-all hover:shadow-xl"
            >
              <MessageCircle className="h-5 w-5" />
              {d.heroCta}
            </a>
            <Link
              href="/precios"
              className="rounded-2xl border-2 border-slate-200 px-8 py-4 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50"
            >
              Ver precios
            </Link>
          </div>
        </div>
      </section>

      {/* Dolores */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-2xl font-bold">{d.dolorTitulo}</h2>
          <ul className="mt-6 space-y-3">
            {d.dolores.map((x, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />
                <span className="text-[15px] leading-relaxed text-slate-600">{x}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Cobertura */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold">{d.coberturaTitulo}</h2>
            <p className="mt-2 text-slate-500">Todo en una sola plataforma — sin planillas paralelas ni módulos de terceros.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {d.cobertura.map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={i} className="rounded-2xl border border-slate-100 bg-white p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
                    <Icon className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="mt-4 font-bold">{c.titulo}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{c.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Por qué SGI360 */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-2xl font-bold">Por qué SGI360</h2>
          <ul className="mt-6 space-y-3">
            {[
              'Precio promocional USD 99/mes los primeros 3 meses (luego USD 299/mes) — todos los módulos incluidos, sin cobro por usuario.',
              'Implementación en días: empezás a operar sin proyecto de consultoría.',
              'Trazabilidad completa para auditoría: documentos vigentes, aprobaciones y evidencia con fecha y responsable.',
              'IA integrada: asistente por módulo que responde sobre tus datos reales.',
              'Soporte en español, en tu zona horaria.',
            ].map((x, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                <span className="text-[15px] leading-relaxed text-slate-600">{x}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-[15px] leading-relaxed text-slate-600">{d.cierre}</p>
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-gradient-to-r from-green-600 to-emerald-500 py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">Implementá {d.norma} sin fricción</h2>
          <p className="mt-3 text-green-100">
            USD 99/mes los primeros 3 meses · luego USD 299/mes · todos los módulos · usuarios ilimitados.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href={waLink}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2 rounded-2xl bg-white px-8 py-4 font-bold text-green-700 transition-all hover:shadow-xl"
            >
              <MessageCircle className="h-5 w-5" />
              Hablar por WhatsApp
            </a>
            <Link
              href="/sgi360-landing"
              className="flex items-center gap-2 rounded-2xl border-2 border-white/30 px-8 py-4 text-sm font-semibold text-white transition-all hover:bg-white/10"
            >
              Conocer la plataforma
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
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
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} LOGISMART · {BUSINESS.location}</p>
        </div>
      </footer>
    </div>
  );
}
