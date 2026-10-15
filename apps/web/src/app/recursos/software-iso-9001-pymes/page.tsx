import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cómo elegir software para ISO 9001 siendo pyme (Chile y Argentina) | SGI360',
  description:
    'Guía práctica para pymes que buscan software de gestión de calidad ISO 9001: funciones imprescindibles, errores comunes, costos reales y checklist de evaluación.',
  alternates: { canonical: 'https://logismart.ar/recursos/software-iso-9001-pymes' },
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Cómo elegir software para ISO 9001 siendo pyme',
  description:
    'Guía práctica para pymes de Chile y Argentina que buscan software de gestión de calidad ISO 9001.',
  inLanguage: 'es',
  author: { '@type': 'Organization', name: 'LOGISMART', url: 'https://logismart.ar' },
  publisher: { '@type': 'Organization', name: 'LOGISMART', url: 'https://logismart.ar' },
  mainEntityOfPage: 'https://logismart.ar/recursos/software-iso-9001-pymes',
  datePublished: '2026-10-15',
  about: { '@type': 'Thing', name: 'ISO 9001 software gestión calidad pyme' },
};

export default function SoftwareIso9001Pymes() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">ISO 9001</span>
      <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-900">
        Cómo elegir software para ISO 9001 siendo pyme
      </h1>
      <p className="mt-3 text-sm text-slate-400">Guía práctica · 8 min de lectura · LOGISMART</p>

      <div className="prose prose-slate mt-10 max-w-none space-y-6 text-[15px] leading-relaxed text-slate-600">
        <p className="text-lg text-slate-500">
          Si tu empresa necesita certificar o mantener ISO 9001, probablemente empezaste con Excel,
          carpetas en Drive y una persona que “lleva el sistema” de memoria. Funciona — hasta que
          llega la auditoría y nadie encuentra la versión vigente del procedimiento o el seguimiento
          de aquella no conformidad de hace tres meses. Esta guía resume qué mirar al elegir un
          software de gestión de calidad cuando no sos una multinacional.
        </p>

        <h2 className="text-2xl font-bold text-slate-900">Lo que el software tiene que resolver sí o sí</h2>
        <p>
          ISO 9001 no exige software, pero sí exige evidencia controlada. El mínimo razonable que una
          plataforma debe cubrir sin parches:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Documentos controlados</strong>: versionado real, aprobaciones con firma digital y un repositorio donde “el documento vigente” sea inequívoco. Si el control vive en nombres de archivo tipo <em>final_v3_FINAL.docx</em>, no es control.</li>
          <li><strong>No conformidades y acciones correctivas</strong>: registro con responsable, fecha de cierre, análisis de causa raíz y trazabilidad completa. Esto es lo primero que revisa cualquier auditor.</li>
          <li><strong>Riesgos y oportunidades</strong>: matriz por proceso con evaluación y planes asociados — la cláusula 6.1 es donde más observaciones reciben las pymes.</li>
          <li><strong>Indicadores y objetivos</strong>: KPIs con metas, responsables y seguimiento temporal, no una foto suelta una vez al año.</li>
          <li><strong>Auditorías internas</strong>: programa anual, listas de verificación y registro de hallazgos que alimenten las acciones correctivas.</li>
          <li><strong>Capacitaciones y competencias</strong>: quién está habilitado para qué puesto, con evidencia.</li>
        </ul>

        <h2 className="text-2xl font-bold text-slate-900">Errores que vemos seguido</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Comprar pensando en el auditor, no en la operación</strong>: si el sistema es un teatro para la certificación, se abandona a los dos meses. El valor real está en que la operación lo use todos los días.</li>
          <li><strong>Software que solo documenta</strong>: un Drive con workflow no es un SGI. Si no conecta riesgos → acciones → indicadores → revisión por dirección, estás pagando por un repositorio.</li>
          <li><strong>Depender del consultor eterno</strong>: si cada cambio de documento requiere al consultor que armó el sistema, el costo oculto supera al software.</li>
          <li><strong>Ignorar el soporte regional</strong>: normas laborales, IVA, SII/AFIP y legislación de seguridad son locales. Un software global sin localización termina en planillas paralelas.</li>
        </ul>

        <h2 className="text-2xl font-bold text-slate-900">Checklist rápida de evaluación</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>¿Cubre varias normas a la vez (9001 + 14001 + 45001) o hay que duplicar trabajo?</li>
          <li>¿Los módulos conversan entre sí? Una NC debería poder generar una acción, un riesgo o una capacitación sin re-cargar datos.</li>
          <li>¿La implementación se mide en días o en meses de consultoría?</li>
          <li>¿Hay trazabilidad completa (quién aprobó qué, cuándo) exportable para auditoría?</li>
          <li>¿Funciona en español con soporte en tu zona horaria?</li>
          <li>¿El precio escala por usuario o por empresa? Las sorpresas de “por usuario” castigan a las pymes que quieren que todos participen.</li>
        </ul>

        <h2 className="text-2xl font-bold text-slate-900">Cómo encaja SGI360</h2>
        <p>
          <Link href="/sgi360-landing" className="font-semibold text-green-700 hover:underline">SGI360</Link> es
          la plataforma de LOGISMART para sistemas de gestión integrados: cubre ISO 9001, 14001 y 45001
          (e IATF 16949 con core tools incluidas) en una sola base de datos — riesgos, auditorías, no
          conformidades, documentos, indicadores, capacitaciones, mapa de procesos y hasta la gestión
          de flota y los resultados financieros del negocio. Es SaaS, en español, y una pyme puede
          empezar a operar en días.
        </p>
        <p>
          Si tu empresa además fabrica para la industria automotriz, SGI360 incluye las
          core tools de IATF 16949 — APQP, PPAP, FMEA/AMFE, MSA, SPC y plan de control —
          integradas con los procesos del SGI, algo que casi ningún software de gestión ofrece
          de forma nativa.
        </p>

        <div className="rounded-2xl border border-green-100 bg-green-50/60 p-6">
          <p className="font-semibold text-slate-900">¿Querés verlo funcionando?</p>
          <p className="mt-1 text-sm text-slate-600">
            Podés recorrer los módulos de SGI360 o pedir una demo guiada para tu caso.
          </p>
          <Link
            href="/sgi360-landing"
            className="mt-4 inline-block rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:shadow-lg"
          >
            Ir a SGI360
          </Link>
        </div>
      </div>
    </article>
  );
}
