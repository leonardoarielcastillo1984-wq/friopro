import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Software para PRL e ISO 45001 en España — gestión de prevención de riesgos | SGI360',
  description:
    'Cómo digitalizar la Prevención de Riesgos Laborales (Ley 31/1995) e ISO 45001 en España: evaluación de riesgos, EPIs, reconocimientos médicos, formación y auditorías en un solo sistema.',
  alternates: { canonical: 'https://logismart.ar/recursos/iso-45001-prl-espana' },
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Software para PRL e ISO 45001 en España: digitalizar la prevención de riesgos laborales',
  description: 'Gestión de PRL e ISO 45001 para empresas en España: IPER, EPIs, vigilancia de la salud y formación.',
  inLanguage: 'es',
  author: { '@type': 'Organization', name: 'LOGISMART', url: 'https://logismart.ar' },
  publisher: { '@type': 'Organization', name: 'LOGISMART', url: 'https://logismart.ar' },
  mainEntityOfPage: 'https://logismart.ar/recursos/iso-45001-prl-espana',
  datePublished: '2026-10-16',
};

export default function Iso45001Espana() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">España · PRL</span>
      <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-900">
        Software para PRL e ISO 45001 en España: digitalizar la prevención de riesgos laborales
      </h1>
      <p className="mt-3 text-sm text-slate-400">Guía práctica · 8 min de lectura · LOGISMART</p>

      <div className="prose prose-slate mt-10 max-w-none space-y-6 text-[15px] leading-relaxed text-slate-600">
        <p className="text-lg text-slate-500">
          En España la Ley 31/1995 de Prevención de Riesgos Laborales obliga a toda empresa a evaluar
          riesgos, planificar la acción preventiva, formar a los trabajadores y vigilar su salud.
          ISO 45001 es el marco internacional que ordena todo eso en un sistema. El problema habitual:
          la PRL vive en carpetas del técnico y nadie sabe qué está vigente.
        </p>

        <h2 className="text-2xl font-bold text-slate-900">Lo que la ley exige documentar</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Evaluación de riesgos</strong> por puesto de trabajo (IPER) con planificación de la acción preventiva.</li>
          <li><strong>Formación e información</strong> a trabajadores, con evidencia por persona.</li>
          <li><strong>Vigilancia de la salud</strong>: reconocimientos médicos con resultados confidenciales y aptitud registrada.</li>
          <li><strong>Gestión de EPIs</strong>: entrega, firma y reposición por trabajador.</li>
          <li><strong>Investigación de accidentes</strong> y enfermedades profesionales con acciones correctoras.</li>
          <li><strong>Emergencias y simulacros</strong> con registro de ejecución.</li>
          <li><strong>Coordinación de actividades empresariales (CAE)</strong> cuando hay contratas.</li>
        </ul>

        <h2 className="text-2xl font-bold text-slate-900">Dónde se rompe la PRL en papel o Excel</h2>
        <ul className="list-disc space-y-3 pl-5">
          <li><strong>La IPER no se actualiza</strong>: se hizo para la inspección una vez; cuando cambia un puesto o una máquina, nadie la revisa — y la Inspección de Trabajo lo sanciona.</li>
          <li><strong>EPIs sin trazabilidad</strong>: entregas firmadas en papel que no se pueden cruzar con el stock ni con las reposiciones pendientes.</li>
          <li><strong>Formación dispersa</strong>: diplomas en PDF por carpetas; ante un accidente, demostrar quién fue formado para qué lleva días.</li>
          <li><strong>Auditorías ISO 45001</strong>: preparar la evidencia manualmente consume semanas del técnico.</li>
        </ul>

        <h2 className="text-2xl font-bold text-slate-900">Qué debe tener un software de PRL serio</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Evaluación de riesgos viva por puesto, con controles jerarquizados (eliminación → sustitución → ingeniería → administrativo → EPI).</li>
          <li>Incidentes y accidentes con investigación y acciones vinculadas — no un registro muerto.</li>
          <li>Vencimientos automáticos: reconocimientos médicos, EPIs, formaciones, revisión de equipos.</li>
          <li>Evidencia exportable para Inspección de Trabajo o auditoría ISO sin armado manual.</li>
          <li>Si la empresa también certifica 9001/14001, que el mismo sistema lo cubra — la PRL no debería ser un silo aparte.</li>
        </ul>

        <h2 className="text-2xl font-bold text-slate-900">SGI360 en España</h2>
        <p>
          <Link href="/sgi360-landing" className="font-semibold text-green-700 hover:underline">SGI360</Link> es
          una plataforma SaaS en español que cubre ISO 45001 (y por tanto la estructura de PRL) junto con
          ISO 9001 y 14001 en el mismo sistema: IPER por puesto, incidentes con causa raíz, matriz legal,
          formación, EPIs, vencimientos con aviso y auditorías internas. Para empresas que además operan
          flota, incluye mantenimiento, inspecciones QR y control de conductores. Precio: USD 99/mes los
          primeros 3 meses, luego USD 299/mes por empresa — usuarios ilimitados.
        </p>

        <div className="rounded-2xl border border-green-100 bg-green-50/60 p-6">
          <p className="font-semibold text-slate-900">¿Tu PRL vive en carpetas?</p>
          <p className="mt-1 text-sm text-slate-600">
            Mirá cómo se ve con trazabilidad automática y evidencia lista para inspección.
          </p>
          <Link
            href="/iso-45001"
            className="mt-4 inline-block rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:shadow-lg"
          >
            Ver SGI360 para ISO 45001
          </Link>
        </div>
      </div>
    </article>
  );
}
