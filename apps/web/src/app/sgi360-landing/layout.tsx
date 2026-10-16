import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: { absolute: 'SGI360 — SGI con 8 normas ISO precargadas, IATF 16949, Core Tools y Flota' },
  description:
    'SGI360 es la plataforma de gestión integrada (SGI/QHSE) de LOGISMART para Latinoamérica: packs precargados de ISO 9001, 14001, 45001, 27001, 22301, 28000, 9004 e IATF 16949 con core tools (APQP, PPAP, FMEA, MSA, SPC). Aplicá la norma y se generan cláusulas, mapa de procesos, objetivos y riesgos automáticamente.',
  keywords: [
    'software ISO 9001', 'sistema de gestión integrado', 'SGI', 'QHSE',
    'software de calidad', 'auditorías internas', 'no conformidades',
    'gestión de riesgos', 'documentos controlados', 'indicadores KPI',
    'ISO 14001', 'ISO 45001', 'ISO 27001', 'ISO 22301', 'ISO 28000',
    'IATF 16949', 'core tools', 'APQP', 'PPAP', 'FMEA', 'AMFE', 'MSA',
    'SPC', 'plan de control', 'gestión de flota', 'software ISO 27001',
    'mantenimiento de vehículos', 'software Chile', 'software Argentina',
  ],
  openGraph: {
    title: 'SGI360 — SGI con 8 normas ISO precargadas, IATF 16949 y Flota',
    description:
      'Plataforma SGI/QHSE para Latinoamérica: packs de ISO 9001/14001/45001/27001/22301/28000/9004 e IATF 16949 con core tools. Aplicá la norma y se generan cláusulas, procesos, objetivos y riesgos.',
    url: 'https://logismart.ar/sgi360-landing',
    siteName: 'LOGISMART',
    locale: 'es_LA',
    type: 'website',
    images: [
      { url: 'https://logismart.ar/og-cover.jpg', width: 1200, height: 630, alt: 'SGI360 — SGI con core tools IATF 16949, flota y riesgos' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SGI360 — SGI con 8 normas ISO precargadas, IATF 16949 y Flota',
    images: ['https://logismart.ar/og-cover.jpg'],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://logismart.ar/sgi360-landing' },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      name: 'SGI360',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      inLanguage: 'es',
      availableLanguage: 'es',
      areaServed: [
        'Argentina', 'Chile', 'Uruguay', 'Paraguay', 'Bolivia', 'Perú',
        'Ecuador', 'Colombia', 'México', 'España',
      ],
      url: 'https://logismart.ar/sgi360-landing',
      description:
        'Sistema de Gestión Integrado (SGI/QHSE) en la nube con packs precargados de ISO 9001, ISO 14001, ISO 45001, ISO 27001, ISO 22301, ISO 28000, ISO 9004 e IATF 16949: al aplicar una norma se generan automáticamente las cláusulas, el mapa de procesos, los objetivos y los riesgos sugeridos. Además: core tools automotrices (APQP, PPAP, FMEA/AMFE, MSA, SPC, plan de control), auditorías, CAPA, documentos controlados, indicadores, gestión de flota y resultados financieros con IA integrada.',
      featureList: [
        'Core tools IATF 16949: APQP, PPAP, FMEA/AMFE, MSA, SPC y Plan de Control',
        'Gestión de riesgos y oportunidades (matriz, IPERC, ambientales)',
        'Gestión de flota: vehículos, mantenimiento, inspecciones QR, conductores, TCO',
        'Auditorías internas ISO con planificación anual',
        'No conformidades y acciones correctivas (CAPA)',
        'Documentos controlados con control de versiones',
        'Indicadores de desempeño con metas y alertas',
        'Mapa de procesos interactivo con subprocesos',
        'Capacitaciones y competencias de RRHH',
        'Packs normativos precargados: 8 normas con cláusulas, procesos, objetivos y riesgos autogenerados',
        'Cumplimiento normativo y matriz legal',
        'Resultados de negocio con importación del SII (Chile)',
        'Inteligencia artificial integrada',
      ],
      brand: { '@type': 'Brand', name: 'LOGISMART' },
      offers: {
        '@type': 'Offer',
        price: '99',
        priceCurrency: 'USD',
        description: 'USD 99/mes los primeros 3 meses, luego USD 299/mes por empresa — usuarios ilimitados',
      },
    },
    {
      '@type': 'Organization',
      name: 'LOGISMART',
      url: 'https://logismart.ar',
      logo: 'https://logismart.ar/favicon.svg',
      description:
        'Desarrollador de SGI360 y la suite 360 de gestión empresarial para Latinoamérica.',
    },
    {
      '@type': 'WebSite',
      name: 'LOGISMART',
      url: 'https://logismart.ar',
      inLanguage: 'es',
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: '¿Qué normas cubre SGI360?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'SGI360 incluye packs precargados de ISO 9001, ISO 14001, ISO 45001, ISO 27001, ISO 22301, ISO 28000, ISO 9004 e IATF 16949 con core tools (APQP, PPAP, FMEA/AMFE, MSA, SPC y plan de control). Al aplicar un pack, la plataforma genera automáticamente cláusulas, mapa de procesos, objetivos y riesgos sugeridos.',
          },
        },
        {
          '@type': 'Question',
          name: '¿SGI360 sirve para pymes?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Está pensado para pymes y empresas medianas de Latinoamérica: implementación en días, sin infraestructura propia ni consultores permanentes.',
          },
        },
        {
          '@type': 'Question',
          name: '¿SGI360 incluye gestión de flota?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Sí, el módulo Flota 360 cubre vehículos, mantenimiento, inspecciones QR, neumáticos, combustible, conductores con control pre-servicio y costos con TCO.',
          },
        },
        {
          '@type': 'Question',
          name: '¿SGI360 se conecta con el SII de Chile?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Sí: importa automáticamente el Registro de Compras y Ventas del SII para el módulo de Resultados de Negocio.',
          },
        },
      ],
    },
  ],
};

export default function Sgi360LandingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
