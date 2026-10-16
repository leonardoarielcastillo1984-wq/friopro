import type { Metadata } from 'next';
import { NormLanding } from '@/components/marketing/NormLanding';
import { FileText, ShieldAlert, ClipboardCheck, BarChart3, Lock, RefreshCw } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Software ISO 27001 — Sistema de Gestión de Seguridad de la Información | SGI360',
  description:
    'Implementá y mantené tu SGSI ISO 27001:2022 sin planillas: matriz de riesgos, SoA, documentos controlados, incidentes, auditorías internas e indicadores en un solo sistema. USD 99/mes, usuarios ilimitados.',
  alternates: { canonical: 'https://logismart.ar/iso-27001' },
};

export default function Iso27001Page() {
  return (
    <NormLanding
      d={{
        norma: 'ISO 27001',
        tag: 'Seguridad de la Información',
        h1: 'Certificá ISO 27001 con evidencia real, no con carpetas armadas a mano',
        sub: 'SGI360 cubre la estructura de ISO 27001:2022 con el pack precargado: cláusulas y controles del Anexo A ya estructurados, evaluación de riesgos por activo, Declaración de Aplicabilidad y trazabilidad automática para cada auditoría.',
        heroCta: 'Quiero implementar ISO 27001',
        dolorTitulo: 'Lo que se complica sin un sistema dedicado',
        dolores: [
          'La evaluación de riesgos se hizo una vez para certificar y quedó congelada en una planilla.',
          'El SoA (Declaración de Aplicabilidad) es un Excel que nadie actualiza cuando cambian los controles.',
          'Los incidentes de seguridad se reportan por mail y no queda trazabilidad del tratamiento.',
          'Las evidencias de controles se juntan a mano una semana antes de cada auditoría externa.',
          'Las revisiones de acceso y las concientizaciones no tienen registro de cumplimiento por persona.',
        ],
        coberturaTitulo: 'Todo el SGSI en una sola plataforma',
        cobertura: [
          { icon: ShieldAlert, titulo: 'Matriz de riesgos de SI', desc: 'Identificación y evaluación por probabilidad e impacto, con tratamiento, controles y plan de acción vinculados.' },
          { icon: Lock, titulo: 'Controles del Anexo A', desc: 'Los 93 controles de ISO 27001:2022 precargados y estructurados — marcá aplicables, justificá exclusiones y asigná responsables.' },
          { icon: FileText, titulo: 'Documentos y políticas', desc: 'Políticas de seguridad, procedimientos y registros con versionado real y flujo de aprobación.' },
          { icon: ClipboardCheck, titulo: 'Auditorías internas', desc: 'Programa anual, checklists por cláusula, hallazgos y seguimiento automático de acciones correctivas.' },
          { icon: BarChart3, titulo: 'Indicadores y objetivos', desc: 'KPIs del SGSI con metas y alertas, y objetivos de seguridad generados automáticamente desde el pack.' },
          { icon: RefreshCw, titulo: 'NC, incidentes y CAPA', desc: 'Registro de no conformidades e incidentes con causa raíz, acciones correctivas y verificación de eficacia.' },
        ],
        cierre:
          'Y si ya tenés ISO 9001 o querés agregar ISO 22301 mañana, el mismo sistema las integra — un solo SGSI integrado, sin módulos paralelos.',
      }}
    />
  );
}
