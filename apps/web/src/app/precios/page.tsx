import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, MessageCircle, Shield, Zap } from 'lucide-react';
import { BUSINESS } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Precios — SGI360, USD 99/mes los primeros 3 meses | LOGISMART',
  description:
    'SGI360: USD 99/mes los primeros 3 meses (luego USD 299/mes) con todos los módulos — ISO 9001/14001/45001, IATF 16949 con core tools, gestión de flota, riesgos y resultados. Usuarios ilimitados.',
  alternates: { canonical: 'https://logismart.ar/precios' },
};

const INCLUYE = [
  'SGI completo: ISO 9001, 14001 y 45001',
  'IATF 16949 con core tools: APQP, PPAP, FMEA/AMFE, MSA, SPC y plan de control',
  'Gestión de riesgos, auditorías internas, NC y acciones correctivas (CAPA)',
  'Documentos controlados con versionado y aprobaciones',
  'Indicadores, objetivos y revisión por la dirección',
  'Mapa de procesos con plantillas IATF/ISO e implementación asistida por IA',
  'Flota 360: vehículos, OT, mantenimiento, inspecciones QR, conductores y TCO',
  'Resultados de negocio: P&L, flujo de caja, importación SII (Chile)',
  'RRHH: organigrama, capacitaciones, competencias y ausencias',
  'Cumplimiento normativo y matriz legal',
  'IA integrada en todos los módulos',
  'Usuarios ilimitados · 20 GB de almacenamiento',
];

export default function PreciosPage() {
  const waLink = `https://wa.me/${BUSINESS.whatsappIntl}?text=${encodeURIComponent(
    'Hola, quiero contratar SGI360 (USD 99/mes).',
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
          </Link>
          <a
            href={waLink}
            target="_blank"
            rel="noopener"
            className="rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg"
          >
            Hablar por WhatsApp
          </a>
        </div>
      </header>

      <section className="border-b border-slate-100 bg-gradient-to-b from-green-50/60 to-white py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <span className="rounded-full bg-green-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-green-700">
            Precio simple
          </span>
          <h1 className="mt-6 text-4xl font-bold sm:text-5xl">Un plan. Todo incluido.</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
            Sin cobro por usuario, sin módulos ocultos, sin tiers que bloquean lo importante.
            El SGI funciona cuando toda la empresa participa — por eso cobramos por empresa, no por asiento.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-lg px-6">
          <div className="rounded-3xl border-2 border-green-200 bg-white p-8 shadow-xl shadow-green-50">
            <div className="text-center">
              <p className="text-sm font-bold uppercase tracking-widest text-green-600">SGI 360 — Plan Completo</p>
              <div className="mt-4 flex items-baseline justify-center gap-2">
                <span className="text-5xl font-bold">USD 99</span>
                <span className="text-slate-400">/mes</span>
              </div>
              <div className="mt-3 rounded-xl bg-green-50 px-4 py-2.5">
                <p className="text-sm font-semibold text-green-700">
                  Precio promocional los primeros 3 meses
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Desde el cuarto mes: <span className="font-bold text-slate-700">USD 299/mes</span> — el valor real del sistema.
                </p>
              </div>
              <p className="mt-3 text-sm text-slate-500">por empresa · usuarios ilimitados · cancelás cuando quieras</p>
            </div>
            <ul className="mt-8 space-y-3">
              {INCLUYE.map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <span className="text-sm leading-relaxed text-slate-600">{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 space-y-3">
              <a
                href={waLink}
                target="_blank"
                rel="noopener"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-500 px-8 py-4 font-bold text-white transition-all hover:shadow-xl"
              >
                <MessageCircle className="h-5 w-5" />
                Empezar ahora
              </a>
              <Link
                href="/register"
                className="flex w-full items-center justify-center rounded-2xl border-2 border-slate-200 px-8 py-3.5 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50"
              >
                Crear cuenta gratis
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-14">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-2xl font-bold">Preguntas sobre el precio</h2>
          <div className="mt-6 space-y-4">
            {[
              {
                q: '¿De verdad usuarios ilimitados?',
                a: 'Sí. Cobramos por empresa, no por asiento — podés dar acceso a toda la operación. Un SGI solo funciona si todos participan.',
              },
              {
                q: '¿Cómo funciona el precio promocional?',
                a: 'Pagás USD 99/mes los primeros 3 meses para implementar y cargar tu sistema. Desde el cuarto mes, el valor es USD 299/mes — que sigue siendo menos que un consultor por día. La promo es válida una sola vez por empresa (no aplica crear una cuenta nueva para repetirla).',
              },
              {
                q: '¿Hay costos de implementación ocultos?',
                a: 'No. La implementación es guiada dentro del producto y los mapas de procesos tienen plantillas IATF/ISO importables. La mayoría de las pymes empieza a operar en días.',
              },
              {
                q: '¿Puedo probar antes de pagar?',
                a: 'Sí — creá la cuenta gratis y recorré la plataforma, o pedí una demo guiada por WhatsApp. Los 3 meses a USD 99 son la forma más barata de implementar con datos reales.',
              },
              {
                q: '¿Cómo se paga y en qué moneda?',
                a: 'El precio se expresa en USD para referencia regional; se factura en moneda local según el país (Argentina o Chile). Consultanos por WhatsApp para el valor exacto en tu moneda.',
              },
              {
                q: '¿Hay contrato de permanencia?',
                a: 'No. Es suscripción mensual o anual (con descuento en anual) — cancelás cuando quieras.',
              },
            ].map((f, i) => (
              <details key={i} className="group rounded-2xl border border-slate-100 bg-white p-5 open:border-green-100 open:shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-slate-900">
                  {f.q}
                  <span className="ml-4 text-xl leading-none text-green-600 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
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
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} LOGISMART · {BUSINESS.location} · {BUSINESS.email}</p>
        </div>
      </footer>
    </div>
  );
}
