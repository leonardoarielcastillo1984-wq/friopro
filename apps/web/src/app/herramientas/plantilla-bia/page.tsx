import type { Metadata } from 'next';
import { LeadMagnetLanding } from '@/components/marketing/LeadMagnetLanding';

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
        icono: 'doc',
        incluye: [
          'Listado de procesos con responsable y criticidad',
          'Impacto financiero, operativo, legal y reputacional (escala 1-5)',
          'RTO, RPO y MTPD por proceso — con guía de qué significa cada uno',
          'Dependencias: personas, sistemas, proveedores e infraestructura',
          'Priorización automática por puntaje total',
        ],
        cierre:
          'En SGI360 el BIA alimenta el mapa de procesos y los planes de continuidad documentados — cuando cambia un proceso, el análisis se actualiza solo.',
        faq: [
          {
            q: '¿Qué es un BIA?',
            a: 'El Business Impact Analysis (Análisis de Impacto al Negocio) es la base del sistema de continuidad del negocio de ISO 22301. Sirve para identificar qué procesos son críticos, cuánto daño causa una interrupción y cuánto tiempo puede durar antes de volverse inaceptable.',
          },
          {
            q: '¿Qué son RTO, RPO y MTPD?',
            a: 'RTO es el tiempo máximo objetivo para restablecer un proceso tras una interrupción. RPO es la pérdida de datos tolerable (cuánto histórico podés permitirte perder). MTPD es el máximo período de disrupción tolerable — el límite antes de que el daño sea inaceptable para el negocio.',
          },
          {
            q: '¿Cómo se determina qué procesos son críticos?',
            a: 'La plantilla suma cuatro impactos (financiero, operativo, legal y reputacional, cada uno de 1 a 5) y clasifica automáticamente: 16+ Crítico, 10-15 Alto, menos de 10 Medio. Los críticos son la prioridad del plan de continuidad.',
          },
          {
            q: '¿Sirve para certificar ISO 22301?',
            a: 'El BIA es un requisito explícito de la cláusula 8.2.2 de ISO 22301 — el auditor lo pide sí o sí. Esta plantilla cubre los campos que se evalúan: priorización por impacto, tiempos de recuperación y dependencias.',
          },
        ],
      }}
    />
  );
}
