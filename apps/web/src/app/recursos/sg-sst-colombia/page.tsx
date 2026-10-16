import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'SG-SST Colombia: software para cumplir la Resolución 0312 | SGI360',
  description:
    'Cómo gestionar el Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) en Colombia: estándares mínimos Resolución 0312, peligros IPVR, incidentes, capacitaciones y evidencias en un solo sistema.',
  alternates: { canonical: 'https://logismart.ar/recursos/sg-sst-colombia' },
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'SG-SST Colombia: software para cumplir la Resolución 0312 de estándares mínimos',
  description: 'Gestión del SG-SST en Colombia: IPVR, incidentes, capacitaciones y evidencias auditables.',
  inLanguage: 'es',
  author: { '@type': 'Organization', name: 'LOGISMART', url: 'https://logismart.ar' },
  publisher: { '@type': 'Organization', name: 'LOGISMART', url: 'https://logismart.ar' },
  mainEntityOfPage: 'https://logismart.ar/recursos/sg-sst-colombia',
  datePublished: '2026-10-16',
};

export default function SgSstColombia() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">Colombia · SG-SST</span>
      <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-900">
        SG-SST en Colombia: cómo cumplir la Resolución 0312 con software
      </h1>
      <p className="mt-3 text-sm text-slate-400">Guía práctica · 8 min de lectura · LOGISMART</p>

      <div className="prose prose-slate mt-10 max-w-none space-y-6 text-[15px] leading-relaxed text-slate-600">
        <p className="text-lg text-slate-500">
          En Colombia toda empresa — sin importar tamaño — debe implementar el Sistema de Gestión de
          Seguridad y Salud en el Trabajo (Decreto 1072/2015) y demostrar los estándares mínimos de la
          Resolución 0312 de 2019. La ARL y el Ministerio de Trabajo pueden pedir evidencia en cualquier
          momento: quien la tiene en papeles sueltos, sufre.
        </p>

        <h2 className="text-2xl font-bold text-slate-900">Los estándares mínimos de la Res. 0312</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Recurso humano</strong>: responsable del SG-SST, comité (COPASST o vigía) y licencia de seguridad.</li>
          <li><strong>Capacitación</strong>: plan anual de capacitación en SST con evidencia por trabajador.</li>
          <li><strong>IPVR</strong>: matriz de identificación de peligros y valoración de riesgos — la base de todo el sistema.</li>
          <li><strong>Condiciones de salud</strong>: exámenes médicos ocupacionales, estilos de vida, acciones preventivas.</li>
          <li><strong>Seguridad</strong>: higiene industrial, registros de incidentes/accidentes con investigación, mantenimiento, señalización, emergencias.</li>
          <li><strong>Gestión</strong>: plan de trabajo anual, indicadores, auditoría anual, revisión por la alta dirección, acciones correctivas.</li>
        </ul>

        <h2 className="text-2xl font-bold text-slate-900">Por qué se incumple sin sistema</h2>
        <ul className="list-disc space-y-3 pl-5">
          <li><strong>La IPVR es una foto</strong>: se hizo para la ARL una vez y no se actualiza con los cambios de puesto o proceso.</li>
          <li><strong>Capacitaciones sin evidencia</strong>: la lista de asistencia en papel no se cruza con el plan anual ni con la matriz de peligros del puesto.</li>
          <li><strong>Incidentes sin cierre</strong>: se reportan a la ARL pero la investigación interna y las acciones quedan sin seguimiento.</li>
          <li><strong>El plan de trabajo anual se queda en el papel</strong>: nadie sabe qué % va ejecutado ni qué está vencido.</li>
        </ul>

        <h2 className="text-2xl font-bold text-slate-900">Cómo un software cubre la 0312</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>IPVR viva por puesto con valoración, controles y responsables.</li>
          <li>Incidentes y accidentes con investigación, causa raíz y acciones con fecha de cierre.</li>
          <li>Plan anual de capacitación con evidencia por trabajador y alertas de vencimiento.</li>
          <li>Exámenes médicos ocupacionales con vencimiento y aptitud registrada.</li>
          <li>Plan de trabajo del SG-SST con % de ejecución real, indicadores y auditoría anual.</li>
          <li>Evidencia exportable para la ARL o el Ministerio en minutos, no en semanas.</li>
        </ul>

        <h2 className="text-2xl font-bold text-slate-900">SGI360 en Colombia</h2>
        <p>
          <Link href="/sgi360-landing" className="font-semibold text-green-700 hover:underline">SGI360</Link> cubre
          la estructura del SG-SST con los mismos módulos de ISO 45001 — IPVR, incidentes, capacitación,
          emergencias, cumplimiento legal — dentro de un SGI completo que además maneja calidad, ambiente,
          flota y resultados. SaaS, en español, implementación en días. Precio: USD 99/mes los primeros
          3 meses, luego USD 299/mes por empresa — usuarios ilimitados.
        </p>

        <div className="rounded-2xl border border-green-100 bg-green-50/60 p-6">
          <p className="font-semibold text-slate-900">¿El SG-SST de tu empresa está al día?</p>
          <p className="mt-1 text-sm text-slate-600">
            Mirá cómo se gestiona con evidencia automática y vencimientos con alerta.
          </p>
          <Link
            href="/iso-45001"
            className="mt-4 inline-block rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:shadow-lg"
          >
            Ver SGI360 para SST
          </Link>
        </div>
      </div>
    </article>
  );
}
