import type { Metadata } from 'next';
import { NormLanding } from '@/components/marketing/NormLanding';
import { FileText, ShieldAlert, ClipboardCheck, BarChart3, Siren, RefreshCw } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Software ISO 22301 — Continuidad del Negocio | SGI360',
  description:
    'Implementá y mantené ISO 22301 sin planillas: análisis de impacto (BIA), planes de continuidad documentados, simulacros con registro, riesgos y auditorías en un solo sistema. USD 99/mes, usuarios ilimitados.',
  alternates: { canonical: 'https://logismart.ar/iso-22301' },
};

export default function Iso22301Page() {
  return (
    <NormLanding
      d={{
        norma: 'ISO 22301',
        tag: 'Continuidad del Negocio',
        h1: 'ISO 22301 que se puede probar, no que vive en una carpeta',
        sub: 'SGI360 cubre la estructura de ISO 22301 con el pack precargado: procesos críticos, evaluación de riesgos, planes de continuidad documentados y registro de simulacros — evidencia lista para cada auditoría.',
        heroCta: 'Quiero implementar ISO 22301',
        dolorTitulo: 'Lo que se complica sin un sistema dedicado',
        dolores: [
          'El BIA se hizo una vez en una presentación y nadie lo volvió a actualizar.',
          'Los planes de continuidad existen, pero en carpetas que nadie encuentra cuando pasan las cosas.',
          'Los simulacros se hacen "de memoria" y no queda registro de asistencia, duración ni lecciones aprendidas.',
          'Los árboles de contacto y responsabilidades se desactualizan con cada cambio de personal.',
          'Las lecciones aprendidas de incidentes reales no se conectan con acciones correctivas.',
        ],
        coberturaTitulo: 'Continuidad del negocio de punta a punta',
        cobertura: [
          { icon: ShieldAlert, titulo: 'Riesgos por proceso', desc: 'Identificación de amenazas y evaluación de impacto con probabilidad, controles y planes vinculados a cada proceso crítico.' },
          { icon: FileText, titulo: 'Planes documentados', desc: 'Planes de continuidad y contingencia con versionado real, aprobaciones y difusión controlada — el documento vigente es siempre el mismo para todos.' },
          { icon: Siren, titulo: 'Simulacros y ejercicios', desc: 'Planificación, registro de ejecución y lecciones aprendidas de cada simulacro, con evidencia adjunta para auditoría.' },
          { icon: ClipboardCheck, titulo: 'Auditorías y revisiones', desc: 'Programa de auditorías internas del SGCN y revisión por la dirección con actas y decisiones trazadas.' },
          { icon: BarChart3, titulo: 'Indicadores del SGCN', desc: 'KPIs de continuidad (cobertura de planes, cumplimiento de ejercicios) con metas, tendencia y alertas.' },
          { icon: RefreshCw, titulo: 'NC y mejora continua', desc: 'No conformidades e incidentes reales con causa raíz, acciones correctivas y verificación de eficacia.' },
        ],
        cierre:
          'Y si ya tenés ISO 9001 o ISO 27001, el mismo sistema las integra — continuidad como parte del SGI, no como proyecto paralelo.',
      }}
    />
  );
}
