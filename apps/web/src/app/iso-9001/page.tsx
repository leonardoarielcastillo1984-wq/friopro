import type { Metadata } from 'next';
import { NormLanding } from '@/components/marketing/NormLanding';
import { FileText, ShieldAlert, ClipboardCheck, BarChart3, GraduationCap, RefreshCw } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Software ISO 9001 para pymes — Sistema de Gestión de Calidad | SGI360',
  description:
    'Implementá y mantené ISO 9001 sin consultores eternos: documentos controlados, riesgos, no conformidades, auditorías internas, indicadores y revisión por dirección en un solo sistema. USD 99/mes, usuarios ilimitados.',
  alternates: { canonical: 'https://logismart.ar/iso-9001' },
};

export default function Iso9001Page() {
  return (
    <NormLanding
      d={{
        norma: 'ISO 9001',
        tag: 'Gestión de Calidad',
        h1: 'Certificá y mantené ISO 9001 sin vivir de las planillas',
        sub: 'SGI360 cubre todos los requisitos de ISO 9001:2015 con trazabilidad automática — documentos vigentes, riesgos por proceso, no conformidades con acciones correctivas y evidencia lista para auditoría.',
        heroCta: 'Quiero certificar ISO 9001',
        dolorTitulo: 'Lo que se complica sin un sistema dedicado',
        dolores: [
          'El documento "vigente" es el que cada uno guardó en su carpeta — el control de versiones (cláusula 7.5) es ficticio.',
          'Las no conformidades quedan abiertas meses porque nadie recibe aviso del vencimiento.',
          'La matriz de riesgos se hizo una vez para la certificación y nunca se actualizó.',
          'Antes de cada auditoría externa hay una semana de armado manual de evidencia.',
          'Los indicadores se miden "cuando alguien se acuerda" y no hay historial de tendencia.',
        ],
        coberturaTitulo: 'Todo ISO 9001:2015 cubierto',
        cobertura: [
          { icon: FileText, titulo: 'Documentos controlados', desc: 'Versionado real, flujo de aprobación y un único documento vigente por código.' },
          { icon: ShieldAlert, titulo: 'Riesgos y oportunidades', desc: 'Matriz por proceso (cláusula 6.1) con evaluación, controles y planes vinculados.' },
          { icon: ClipboardCheck, titulo: 'Auditorías internas', desc: 'Programa anual, checklists, hallazgos y seguimiento automático de acciones.' },
          { icon: BarChart3, titulo: 'Indicadores y objetivos', desc: 'KPIs con metas, responsables, tendencia histórica y alertas fuera de objetivo.' },
          { icon: GraduationCap, titulo: 'Capacitaciones', desc: 'Matriz de competencias por puesto, planes anuales y evidencia de eficacia.' },
          { icon: RefreshCw, titulo: 'NC y acciones correctivas', desc: 'Causa raíz (5 porqués, Ishikawa), plan de acción con responsables y verificación de eficacia.' },
        ],
        cierre:
          'Y si mañana necesitás ISO 14001 o 45001, el mismo sistema ya las soporta — el SGI crece con la empresa sin migraciones.',
      }}
    />
  );
}
