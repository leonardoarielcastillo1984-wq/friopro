'use client';

import Link from 'next/link';
import { CheckCircle2, FileText, Lock, MessageCircle, Shield, ShieldAlert, Zap } from 'lucide-react';
import { BUSINESS } from '@/lib/legal';
import { LeadCapture } from '@/components/marketing/LeadCapture';

export interface LeadMagnetLandingData {
  norma: string;            // ej: 'ISO 45001' — se usa en el texto del WhatsApp
  tag: string;              // badge superior
  h1: string;
  sub: string;
  recursoTitulo: string;    // nombre del recurso (en el form y el email)
  incluye: string[];        // bullets de "qué incluye"
  fuente: string;           // source tag para /leads
  downloadUrl?: string;     // link directo post-form
  cierre?: string;
  /** FAQ visible + FAQPage JSON-LD para rich results en Google */
  faq?: { q: string; a: string }[];
  /** key del icono (las páginas son Server Components — no pueden pasar funciones a un client component) */
  icono: 'shield' | 'doc' | 'lock';
}

const ICONOS = { shield: ShieldAlert, doc: FileText, lock: Lock };

export function LeadMagnetLanding({ d }: { d: LeadMagnetLandingData }) {
  const Icono = ICONOS[d.icono];
  const faqJsonLd = d.faq?.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: d.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }
    : null;
  const waLink = `https://wa.me/${BUSINESS.whatsappIntl}?text=${encodeURIComponent(
    `Hola, descargué ${d.recursoTitulo} y quiero ver cómo SGI360 lo gestiona para ${d.norma}.`,
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
            <span className="text-xs text-slate-400">· Herramientas gratis</span>
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
      </header>

      {/* Hero */}
      <section className="border-b border-slate-100 bg-gradient-to-b from-green-50/60 to-white py-16">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-6 lg:grid-cols-2">
          <div>
            <span className="rounded-full bg-green-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-green-700">
              {d.tag}
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight">{d.h1}</h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">{d.sub}</p>

            <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-100">
                  <Icono className="h-5 w-5 text-green-700" />
                </div>
                <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Qué incluye</p>
              </div>
              <ul className="mt-3 space-y-2">
                {d.incluye.map((x, i) => (
                  <li key={i} className="flex items-start gap-2 text-[15px] text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <LeadCapture
              source={d.fuente}
              titulo={d.recursoTitulo}
              descripcion="Completá el formulario y te lo enviamos por email al instante — gratis, sin tarjeta."
              buttonLabel="Enviarme la plantilla"
              downloadUrl={d.downloadUrl}
              downloadLabel="Descargar la plantilla"
            />
            <p className="mt-3 text-center text-xs text-slate-400">
              +100 gerentes de calidad y SSOMA ya la descargaron.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ — contenido sustancial + rich results */}
      {d.faq && d.faq.length > 0 && (
        <section className="border-b border-slate-100 bg-slate-50/60 py-14">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-2xl font-bold">Preguntas frecuentes</h2>
            <div className="mt-6 space-y-3">
              {d.faq.map((f, i) => (
                <details key={i} className="group rounded-2xl border border-slate-200 bg-white p-5 open:border-green-200">
                  <summary className="cursor-pointer list-none text-[15px] font-bold text-slate-900 transition-colors group-open:text-green-700">
                    {f.q}
                  </summary>
                  <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Del Excel al sistema */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-2xl font-bold">Del Excel al sistema</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
            La plantilla te ordena para arrancar — pero el Excel se desactualiza, no avisa vencimientos
            y no deja trazabilidad. En SGI360 esto mismo vive adentro del sistema: con responsables,
            alertas, evidencia y auditoría lista.
          </p>
          {d.cierre && (
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{d.cierre}</p>
          )}
          <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row">
            <a
              href={waLink}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-500 px-7 py-3.5 font-bold text-white transition-all hover:shadow-xl"
            >
              <MessageCircle className="h-5 w-5" />
              Ver cómo funciona en SGI360
            </a>
            <Link
              href="/sgi360-landing"
              className="rounded-2xl border-2 border-slate-200 px-7 py-3.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
            >
              Conocer la plataforma
            </Link>
          </div>
        </div>
      </section>

      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

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
