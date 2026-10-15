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
    title: 'SGI360 — Sistema de Gestión Integrado',
    description:
      'Centralizá ISO 9001, 14001 y 45001 en una sola plataforma con IA integrada: riesgos, auditorías, indicadores y documentación.',
    url: 'https://logismart.ar/sgi360-landing',
    siteName: 'LOGISMART',
    locale: 'es_LA',
    type: 'website',
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
        price: '0',
        priceCurrency: 'USD',
        description: 'Demo y planes disponibles en logismart.ar',
      },
      areaServed: ['CL', 'AR', 'LATAM'],
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
