'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, MessageCircle, Shield, Zap } from 'lucide-react';
import { BUSINESS } from '@/lib/legal';
import { LeadCapture } from '@/components/marketing/LeadCapture';

const FAQ = [
  {
    q: '¿Para qué sirve este checklist ISO 9001?',
    a: 'Es un autodiagnóstico de tu Sistema de Gestión de Calidad: recorrés los requisitos clave de ISO 9001:2015 (contexto, liderazgo, planificación, soporte, operación, evaluación y mejora) y obtenés un porcentaje de cumplimiento que te muestra dónde están las brechas antes de una auditoría.',
  },
  {
    q: '¿Cuánto tiempo toma completarlo?',
    a: 'Entre 10 y 15 minutos. Son unos 50 ítems organizados por cláusula — marcás lo que tu empresa ya tiene implementado y el resultado se calcula automáticamente.',
  },
  {
    q: '¿Sirve para preparar una certificación ISO 9001?',
    a: 'Sirve como punto de partida: te muestra qué cláusulas están débiles y dónde enfocar el trabajo previo. No reemplaza la auditoría formal ni una consultoría, pero ordena las prioridades.',
  },
  {
    q: '¿Es gratis? ¿Tengo que registrarme?',
    a: 'Sí, es gratis y el autodiagnóstico funciona sin registro — los datos quedan en tu navegador. Si querés, podés dejarnos tu email al final y te enviamos el resultado con una guía para cerrar las brechas.',
  },
];

const FAQ_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const CLAUSULAS: { titulo: string; items: string[] }[] = [
  {
    titulo: '4. Contexto de la organización',
    items: [
      'Identificamos factores internos y externos que afectan el SGC',
      'Conocemos las necesidades de las partes interesadas',
      'Definimos el alcance del sistema de gestión',
      'Tenemos mapeados nuestros procesos y sus interacciones',
    ],
  },
  {
    titulo: '5. Liderazgo',
    items: [
      'La dirección demuestra compromiso con el SGC',
      'Existe una política de calidad comunicada',
      'Los roles y responsabilidades están asignados',
    ],
  },
  {
    titulo: '6. Planificación',
    items: [
      'Tenemos una matriz de riesgos y oportunidades por proceso',
      'Hay objetivos de calidad medibles con responsables y plazos',
      'Los cambios al SGC se planifican, no improvisan',
    ],
  },
  {
    titulo: '7. Soporte',
    items: [
      'Documentos controlados con un único vigente y aprobaciones',
      'Las personas tienen competencias definidas y capacitación registrada',
      'La infraestructura y ambiente de trabajo están gestionados',
      'Los instrumentos de medición están calibrados/verificados',
    ],
  },
  {
    titulo: '8. Operación',
    items: [
      'Los requisitos del cliente se revisan antes de comprometerlos',
      'Diseño y desarrollo (si aplica) sigue un proceso documentado',
      'Los proveedores se evalúan y controlan',
      'La producción/servicio se realiza bajo condiciones controladas',
      'Los productos no conformes se identifican y controlan',
    ],
  },
  {
    titulo: '9. Evaluación del desempeño',
    items: [
      'Medimos indicadores y analizamos tendencias',
      'Hacemos auditorías internas con programa anual',
      'La dirección revisa el SGC periódicamente',
    ],
  },
  {
    titulo: '10. Mejora',
    items: [
      'Las no conformidades generan acciones correctivas con causa raíz',
      'Verificamos que las acciones correctivas fueron eficaces',
      'Usamos datos del sistema para mejorar continuamente',
    ],
  },
];

export function ChecklistIso9001() {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const total = useMemo(() => CLAUSULAS.reduce((s, c) => s + c.items.length, 0), []);
  const done = checked.size;
  const pct = Math.round((done / total) * 100);

  const toggle = (id: string) => {
    const next = new Set(checked);
    next.has(id) ? next.delete(id) : next.add(id);
    setChecked(next);
  };

  const veredicto =
    pct >= 90 ? 'Tu SGC está en muy buen estado — enfocá esfuerzos en mantener la evidencia al día.'
    : pct >= 70 ? 'Base sólida, pero hay brechas que un auditor va a observar. Priorizá las cláusulas sin tildar.'
    : pct >= 40 ? 'Hay sistema pero está incompleto — la preparación para auditoría hoy requeriría trabajo intenso.'
    : 'El SGC está en etapa inicial — conviene estructurar los procesos antes de pensar en certificar.';

  const waLink = `https://wa.me/${BUSINESS.whatsappIntl}?text=${encodeURIComponent(
    `Hola, hice el checklist ISO 9001 y me dio ${pct}%. Quiero ver cómo SGI360 cubre las brechas.`,
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
        </div>
      </header>

      <section className="border-b border-slate-100 bg-gradient-to-b from-green-50/60 to-white py-14">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <span className="rounded-full bg-green-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-green-700">
            Herramienta gratuita
          </span>
          <h1 className="mt-5 text-4xl font-bold">Checklist ISO 9001 — Autodiagnóstico</h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-600">
            Tildá lo que tu empresa ya tiene implementado y obtené una lectura inmediata del estado
            de tu sistema de gestión. Sin registro — todo queda en tu navegador.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="mx-auto max-w-3xl px-6">
          {/* Progreso sticky */}
          <div className="sticky top-[72px] z-40 mb-8 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{done}/{total} ítems</span>
              <span className={`font-bold ${pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                {pct}%
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-600 to-emerald-500 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {CLAUSULAS.map((c, ci) => (
            <div key={ci} className="mb-8">
              <h2 className="mb-3 text-lg font-bold">{c.titulo}</h2>
              <div className="space-y-2">
                {c.items.map((item, ii) => {
                  const id = `${ci}-${ii}`;
                  const on = checked.has(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggle(id)}
                      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                        on
                          ? 'border-green-200 bg-green-50/60'
                          : 'border-slate-100 bg-slate-50/40 hover:border-slate-200'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                          on ? 'border-green-600 bg-green-600' : 'border-slate-300'
                        }`}
                      >
                        {on && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                      </span>
                      <span className={`text-[15px] leading-relaxed ${on ? 'text-slate-900' : 'text-slate-600'}`}>
                        {item}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Resultado */}
          <div className="rounded-3xl border-2 border-green-200 bg-gradient-to-b from-green-50/80 to-white p-8 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-green-600">Tu resultado</p>
            <p className="mt-2 text-6xl font-bold">{pct}%</p>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-slate-600">{veredicto}</p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={waLink}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-500 px-7 py-3.5 font-bold text-white transition-all hover:shadow-xl"
              >
                <MessageCircle className="h-5 w-5" />
                Ver cómo SGI360 cubre mis brechas
              </a>
              <Link
                href="/precios"
                className="rounded-2xl border-2 border-slate-200 px-7 py-3.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
              >
                Ver precio (USD 99/mes × 3 meses promo)
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Autodiagnóstico orientativo — no reemplaza una auditoría formal.
            </p>
          </div>

          {/* Captura de lead: diagnóstico + checklist por email */}
          <div className="mt-8">
            <LeadCapture
              source="checklist-iso-9001"
              titulo="Recibí tu diagnóstico + el checklist completo por email"
              descripcion={`Te enviamos tu resultado (${pct}%), el listado de los ${total} ítems por cláusula y una guía de cómo cerrar las brechas — gratis.`}
              buttonLabel="Enviarme mi diagnóstico"
              meta={{ score: pct, done, total }}
            />
          </div>
        </div>
      </section>

      {/* FAQ — contenido para SEO + FAQPage JSON-LD */}
      <section className="border-t border-slate-100 bg-slate-50/60 py-14">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-2xl font-bold text-slate-900">Preguntas frecuentes</h2>
          <div className="mt-6 space-y-3">
            {FAQ.map((f, i) => (
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

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
      />

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
