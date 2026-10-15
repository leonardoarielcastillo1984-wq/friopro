import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Core tools IATF 16949: APQP, PPAP, FMEA, MSA y SPC en un solo sistema | SGI360',
  description:
    'Qué son las core tools automotrices de IATF 16949, por qué gestionarlas en Excel fragmentado genera riesgo de auditoría, y qué debe tener un software que las integre al SGI.',
  alternates: { canonical: 'https://logismart.ar/recursos/core-tools-iatf-16949' },
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Core tools de IATF 16949: APQP, PPAP, FMEA, MSA y SPC en un solo sistema',
  description: 'Guía de las core tools automotrices y su gestión integrada en software.',
  inLanguage: 'es',
  author: { '@type': 'Organization', name: 'LOGISMART', url: 'https://logismart.ar' },
  publisher: { '@type': 'Organization', name: 'LOGISMART', url: 'https://logismart.ar' },
  mainEntityOfPage: 'https://logismart.ar/recursos/core-tools-iatf-16949',
  datePublished: '2026-10-15',
  about: { '@type': 'Thing', name: 'IATF 16949 core tools APQP PPAP FMEA MSA SPC' },
};

export default function CoreToolsIatf() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">IATF 16949</span>
      <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-900">
        Core tools de IATF 16949: APQP, PPAP, FMEA, MSA y SPC en un solo sistema
      </h1>
      <p className="mt-3 text-sm text-slate-400">Guía práctica · 10 min de lectura · LOGISMART</p>

      <div className="prose prose-slate mt-10 max-w-none space-y-6 text-[15px] leading-relaxed text-slate-600">
        <p className="text-lg text-slate-500">
          Si tu empresa provee a la industria automotriz, IATF 16949 exige algo más que un SGC genérico:
          las cinco core tools. El problema es que casi nadie las gestiona como lo que son — un sistema
          interconectado — sino como planillas sueltas que se desactualizan entre sí.
        </p>

        <h2 className="text-2xl font-bold text-slate-900">Qué es cada una y cómo se conectan</h2>
        <ul className="list-disc space-y-3 pl-5">
          <li><strong>APQP (Planificación Avanzada de la Calidad del Producto)</strong>: la columna vertebral. Estructura el lanzamiento de producto en fases — desde el concepto hasta la producción — y es la fuente de las demás herramientas.</li>
          <li><strong>FMEA / AMFE (Análisis de Modos y Efectos de Falla)</strong>: identifica fallos potenciales del diseño (DFMEA) y del proceso (PFMEA), con severidad, ocurrencia y detección. Alimenta directamente el plan de control.</li>
          <li><strong>Plan de Control</strong>: traduce los riesgos del PFMEA en controles concretos por característica — qué se mide, con qué método, con qué frecuencia y cómo se reacciona.</li>
          <li><strong>MSA (Análisis de Sistemas de Medición)</strong>: valida que lo que medís en el plan de control sea confiable — estudios de repetibilidad y reproducibilidad (R&R), sesgo, linealidad.</li>
          <li><strong>SPC (Control Estadístico de Procesos)</strong>: monitorea en tiempo real las características especiales — cartas de control, Cp/Cpk/Ppk — para detectar variación antes de producir no conformes.</li>
          <li><strong>PPAP (Proceso de Aprobación de Piezas de Producción)</strong>: el paquete de evidencia que el cliente aprueba antes de producción serial — incluye resultados de FMEA, MSA, SPC y plan de control.</li>
        </ul>

        <h2 className="text-2xl font-bold text-slate-900">Por qué fallan en planillas sueltas</h2>
        <p>
          El diseño de las core tools asume consistencia: la característica que el PFMEA marca como
          crítica tiene que aparecer en el plan de control con su método de medición validado por MSA
          y monitoreada por SPC. En Excel eso significa copiar datos entre cuatro archivos — y cuando
          el PFMEA cambia en la revisión de enero, el plan de control sigue mostrando la versión de
          octubre. En auditoría, esa inconsistencia es una no conformidad mayor típica.
        </p>

        <h2 className="text-2xl font-bold text-slate-900">Qué pedirle a un software</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Datos compartidos, no copiados</strong>: la característica especial definida en el FMEA debe ser la misma entidad que aparece en el plan de control y en las cartas SPC.</li>
          <li><strong>Vínculo con el SGI</strong>: una desviación de SPC debería poder abrir una no conformidad y una acción correctiva sin re-cargar nada.</li>
          <li><strong>Historial de revisiones</strong>: FMEA vivos con control de cambios, no archivos renombrados.</li>
          <li><strong>PPAP armable desde el sistema</strong>: el paquete de aprobación se genera con la data real, no armado a mano tres días antes de la entrega.</li>
        </ul>

        <h2 className="text-2xl font-bold text-slate-900">Core tools dentro de SGI360</h2>
        <p>
          <Link href="/sgi360-landing" className="font-semibold text-green-700 hover:underline">SGI360</Link> incluye
          un módulo de core tools nativo — APQP, PPAP, FMEA/AMFE, MSA, SPC y plan de control — integrado
          al resto del SGI: los hallazgos alimentan no conformidades, los planes de acción tienen
          responsables y vencimientos, y el mapa de procesos IATF conecta cada herramienta con el
          proceso dueño. Es una de las pocas plataformas SaaS en español que ofrece esto sin módulos
          de terceros.
        </p>

        <div className="rounded-2xl border border-green-100 bg-green-50/60 p-6">
          <p className="font-semibold text-slate-900">¿Tu empresa trabaja con IATF 16949?</p>
          <p className="mt-1 text-sm text-slate-600">
            Mirá cómo SGI360 gestiona las core tools conectadas con el resto del sistema.
          </p>
          <Link
            href="/sgi360-landing"
            className="mt-4 inline-block rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:shadow-lg"
          >
            Conocer SGI360
          </Link>
        </div>
      </div>
    </article>
  );
}
