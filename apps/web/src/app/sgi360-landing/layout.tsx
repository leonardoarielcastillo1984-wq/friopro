import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: { absolute: 'SGI360 — SGI con IATF 16949, Core Tools, Flota y Gestión de Riesgos' },
  description:
    'SGI360 es la plataforma de gestión integrada (SGI/QHSE) de LOGISMART para Latinoamérica: ISO 9001, 14001, 45001 e IATF 16949 con core tools automotrices (APQP, PPAP, FMEA, MSA, SPC), gestión de riesgos, auditorías, documentos controlados, gestión de flota y resultados de negocio con IA integrada.',
  keywords: [
    'software ISO 9001', 'sistema de gestión integrado', 'SGI', 'QHSE',
    'software de calidad', 'auditorías internas', 'no conformidades',
    'gestión de riesgos', 'documentos controlados', 'indicadores KPI',
    'ISO 14001', 'ISO 45001', 'IATF 16949', 'core tools', 'APQP', 'PPAP',
    'FMEA', 'AMFE', 'MSA', 'SPC', 'plan de control', 'gestión de flota',
    'mantenimiento de vehículos', 'software Chile', 'software Argentina',
  ],
  openGraph: {
    title: 'SGI360 — SGI con IATF 16949, Core Tools, Flota y Gestión de Riesgos',
    description:
      'Plataforma SGI/QHSE para Latinoamérica: ISO 9001/14001/45001, IATF 16949 con core tools, gestión de flota, riesgos y resultados con IA.',
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
    title: 'SGI360 — SGI con IATF 16949, Core Tools, Flota y Riesgos',
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
        'Sistema de Gestión Integrado (SGI/QHSE) en la nube para ISO 9001, ISO 14001, ISO 45001 e IATF 16949: core tools automotrices (APQP, PPAP, FMEA/AMFE, MSA, SPC, plan de control), gestión de riesgos, auditorías internas, no conformidades y CAPA, documentos controlados, indicadores, cumplimiento normativo, gestión de flota y resultados financieros con IA integrada.',
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
            text: 'SGI360 soporta ISO 9001 (calidad), ISO 14001 (ambiente) e ISO 45001 (seguridad y salud laboral), además de IATF 16949 para la industria automotriz — incluyendo las core tools: APQP, PPAP, FMEA/AMFE, MSA, SPC y plan de control.',
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
