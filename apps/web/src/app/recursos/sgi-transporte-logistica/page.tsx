import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'SGI para empresas de transporte y logística: ISO, flota y seguridad en un solo sistema | SGI360',
  description:
    'Cómo las empresas de transporte y logística gestionan ISO 9001/45001, mantenimiento de flota, control de conductores y resultados de negocio sin sistemas separados.',
  alternates: { canonical: 'https://logismart.ar/recursos/sgi-transporte-logistica' },
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'SGI para empresas de transporte y logística: ISO, flota y seguridad en un solo sistema',
  description: 'Gestión integrada para empresas de transporte: ISO, flota, conductores y finanzas.',
  inLanguage: 'es',
  author: { '@type': 'Organization', name: 'LOGISMART', url: 'https://logismart.ar' },
  publisher: { '@type': 'Organization', name: 'LOGISMART', url: 'https://logismart.ar' },
  mainEntityOfPage: 'https://logismart.ar/recursos/sgi-transporte-logistica',
  datePublished: '2026-10-15',
};

export default function SgiTransporte() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">Transporte y logística</span>
      <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-900">
        SGI para transporte y logística: ISO, flota y seguridad en un solo sistema
      </h1>
      <p className="mt-3 text-sm text-slate-400">Guía práctica · 8 min de lectura · LOGISMART</p>

      <div className="prose prose-slate mt-10 max-w-none space-y-6 text-[15px] leading-relaxed text-slate-600">
        <p className="text-lg text-slate-500">
          Una empresa de transporte que quiere ISO 9001 enfrenta un problema que otras pymes no tienen:
          su sistema de gestión convive con una flota física que se mueve, se rompe, consume combustible
          y tiene conductores con vencimientos legales. La mayoría termina con un software de calidad por
          un lado, una planilla de mantenimiento por otro y los costos en un tercer lugar.
        </p>

        <h2 className="text-2xl font-bold text-slate-900">Lo que una empresa de transporte necesita gestionar junto</h2>
        <ul className="list-disc space-y-3 pl-5">
          <li><strong>Calidad (ISO 9001)</strong>: procesos de servicio, no conformidades de entregas, quejas de clientes, indicadores de puntualidad.</li>
          <li><strong>Seguridad (ISO 45001)</strong>: IPERC de la operación, fatiga de conductores, control pre-servicio, incidentes en ruta y simulacros.</li>
          <li><strong>Flota</strong>: órdenes de trabajo, planes de mantenimiento preventivo, neumáticos, combustible, vencimientos de documentación.</li>
          <li><strong>Conductores</strong>: licencias y exámenes al día, control pre-servicio (alcoholemia, presión, descanso), competencias requeridas por tipo de unidad.</li>
          <li><strong>Resultados</strong>: cuánto cuesta realmente cada unidad (TCO), fletes subcontratados, multas, seguros — todo pegando en el resultado del mes.</li>
        </ul>

        <h2 className="text-2xl font-bold text-slate-900">El costo de tenerlo separado</h2>
        <p>
          Cuando la flota vive en una planilla y el SGI en otra, pasan estas cosas: el mismo chofer se
          cuenta dos veces en los costos (o ninguna), el mantenimiento vencido de un camión no aparece
          como riesgo operativo en el SGI, y la auditoría encuentra que el “control de fatiga” es un
          papel firmado que nadie cruza con el plan de viaje. La integración no es lujo — es lo que hace
          que el sistema refleje la operación real.
        </p>

        <h2 className="text-2xl font-bold text-slate-900">Qué cambia cuando está integrado</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>El chofer hace su <strong>control pre-servicio desde un QR en la unidad</strong>, sin login ni app — presión, alcoholemia, descanso, medicamentos — y eso queda como evidencia del SGI.</li>
          <li>Una falla detectada en una <strong>inspección QR</strong> genera automáticamente hallazgo y puede escalar a no conformidad con su acción correctiva.</li>
          <li>Los <strong>costos de cada unidad</strong> (OT, repuestos, neumáticos, cuotas de leasing) alimentan directo el resultado del negocio — no hace falta re-cargar nada en finanzas.</li>
          <li>Los <strong>vencimientos</strong> (licencias, seguros, revisiones técnicas, planes de mantenimiento) tienen alerta, no sorpresa.</li>
        </ul>

        <h2 className="text-2xl font-bold text-slate-900">SGI360 para transporte</h2>
        <p>
          <Link href="/sgi360-landing" className="font-semibold text-green-700 hover:underline">SGI360</Link> nació
          exactamente para este caso: el SGI completo (riesgos, auditorías, NC, documentos, indicadores,
          cumplimiento legal) convive con <strong>Flota 360</strong> — vehículos, semirremolques, conjuntos
          tractor+semi, OT, planes, inspecciones QR, neumáticos, combustible, conductores con hub por QR
          y TCO por unidad — y con Resultados de Negocio, que en Chile además importa el registro de
          compras y ventas del SII automáticamente.
        </p>

        <div className="rounded-2xl border border-green-100 bg-green-50/60 p-6">
          <p className="font-semibold text-slate-900">¿Gestionás flota y calidad por separado?</p>
          <p className="mt-1 text-sm text-slate-600">
            Mirá cómo se ve todo integrado — del control del chofer al resultado del mes.
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
