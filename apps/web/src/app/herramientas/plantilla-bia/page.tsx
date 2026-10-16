import type { Metadata } from 'next';
import { LeadMagnetLanding } from '@/components/marketing/LeadMagnetLanding';
import { FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Plantilla BIA gratis (Excel) — Análisis de Impacto al Negocio ISO 22301 | SGI360',
  description:
    'Descargá gratis la plantilla BIA en Excel: procesos críticos, RTO/RPO/MTPD, impactos financieros y operativos, dependencias y priorización. Lista para ISO 22301.',
  alternates: { canonical: 'https://logismart.ar/herramientas/plantilla-bia' },
};

export default function PlantillaBiaPage() {
  return (
    <LeadMagnetLanding
      d={{
        norma: 'ISO 22301',
        tag: 'Descarga gratuita · Excel',
        h1: 'Plantilla BIA — Análisis de Impacto al Negocio gratis',
        sub: 'La base de todo sistema de continuidad del negocio (ISO 22301): identificá procesos críticos, cuantificá el impacto de una interrupción y definí tiempos de recuperación.',
        recursoTitulo: 'Plantilla BIA — Análisis de Impacto al Negocio (Excel)',
        fuente: 'plantilla-bia',
        downloadUrl: '/descargas/plantilla-bia.xlsx',
        icono: FileText,
        incluye: [
          'Listado de procesos con responsable y criticidad',
          'Impacto financiero, operativo, legal y reputacional (escala 1-5)',
          'RTO, RPO y MTPD por proceso — con guía de qué significa cada uno',
          'Dependencias: personas, sistemas, proveedores e infraestructura',
          'Priorización automática por puntaje total',
        ],
        cierre:
          'En SGI360 el BIA alimenta el mapa de procesos y los planes de continuidad documentados — cuando cambia un proceso, el análisis se actualiza solo.',
      }}
    />
  );
}
