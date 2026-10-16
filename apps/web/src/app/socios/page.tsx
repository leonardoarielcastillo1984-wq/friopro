import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Handshake, MessageCircle, Percent, Rocket, Shield, Users, Zap } from 'lucide-react';
import { BUSINESS } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Programa de Socios — Consultores ISO que recomiendan SGI360 | LOGISMART',
  description:
    'Sos consultor ISO 9001/14001/45001 o IATF 16949? Sumate al programa de socios de SGI360: comisión recurrente por cada cliente, implementación más rápida y un producto que hace brillar tu consultoría.',
  alternates: { canonical: 'https://logismart.ar/socios' },
};

export default function SociosPage() {
  const waLink = `https://wa.me/${BUSINESS.whatsappIntl}?text=${encodeURIComponent(
    'Hola, soy consultor ISO y quiero información sobre el programa de socios de SGI360.',
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
            <span className="text-xs text-slate-400">· Socios</span>
          </Link>
          <a
            href={waLink}
            target="_blank"
            rel="noopener"
            className="rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg"
          >
            Postularme
          </a>
        </div>
      </header>

      <section className="border-b border-slate-100 bg-gradient-to-b from-blue-50/60 to-white py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <span className="rounded-full bg-blue-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-700">
            Para consultores ISO
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-tight sm:text-5xl">
            Recomendá SGI360 a tus clientes y ganá comisión recurrente
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Si sos consultor de sistemas de gestión, SGI360 te convierte la recomendación en ingreso:
            comisión por cada cliente que traigas, mientras el cliente siga suscripto.
          </p>
          <a
            href={waLink}
            target="_blank"
            rel="noopener"
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-500 px-8 py-4 font-bold text-white transition-all hover:shadow-xl"
          >
            <MessageCircle className="h-5 w-5" />
            Quiero ser socio
          </a>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold">Qué te ofrecemos</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Percent, t: 'Comisión recurrente', d: 'Porcentaje de cada suscripción que referís — no es un fee único, es ingreso mensual mientras el cliente esté activo.' },
              { icon: Rocket, t: 'Implementación más rápida', d: 'Tu consultoría se enfoca en el contenido (procesos, riesgos, mejoras) y el software pone la estructura — proyectos más cortos y más clientes por mes.' },
              { icon: Users, t: 'Cuenta demo para vender', d: 'Acceso a un entorno de demostración para mostrar el producto a tus prospectos.' },
              { icon: Shield, t: 'Producto sólido detrás tuyo', d: 'ISO 9001/14001/45001, IATF 16949 con core tools, flota, RRHH y resultados — cubrís la operación completa del cliente.' },
              { icon: Handshake, t: 'Material de venta', d: 'Presentaciones, comparativas y argumentarios listos para tus propuestas.' },
              { icon: Zap, t: 'Soporte directo', d: 'Canal prioritario con el equipo de producto para resolver dudas de tus clientes.' },
            ].map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={i} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                    <Icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="mt-4 font-bold">{c.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{c.d}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-2xl font-bold">Cómo funciona</h2>
          <ol className="mt-6 space-y-4">
            {[
              'Nos contactás por WhatsApp y coordinamos una demo de 30 minutos.',
              'Te damos acceso al entorno demo y el material comercial.',
              'Cada cliente que traigas queda vinculado a tu cuenta de socio.',
              'Cobras comisión mensual por cada suscripción activa referida.',
            ].map((s, i) => (
              <li key={i} className="flex items-start gap-4 rounded-xl border border-slate-100 bg-white p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                  {i + 1}
                </span>
                <span className="text-[15px] leading-relaxed text-slate-600">{s}</span>
              </li>
            ))}
          </ol>
          <div className="mt-8 rounded-2xl border border-green-100 bg-green-50/60 p-6">
            <p className="font-semibold text-slate-900">Para consultores, esto es rentable dos veces:</p>
            <ul className="mt-3 space-y-2">
              {[
                'La comisión recurrente monetiza cada recomendación que ya hacés gratis.',
                'El software te libera del trabajo operativo de mantener el SGI del cliente — te concentrás en consultoría de valor.',
              ].map((x, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-blue-600 to-violet-600 py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white">¿Hablamos?</h2>
          <p className="mt-3 text-blue-100">
            Contanos tu perfil y cuántos clientes manejás — coordinamos la demo.
          </p>
          <a
            href={waLink}
            target="_blank"
            rel="noopener"
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 font-bold text-blue-700 transition-all hover:shadow-xl"
          >
            <MessageCircle className="h-5 w-5" />
            Contactar por WhatsApp
          </a>
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
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} LOGISMART · {BUSINESS.location} · {BUSINESS.email}</p>
        </div>
      </footer>
    </div>
  );
}
