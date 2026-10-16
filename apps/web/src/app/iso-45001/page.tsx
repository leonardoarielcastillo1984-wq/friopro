import type { Metadata } from 'next';
import { NormLanding } from '@/components/marketing/NormLanding';
import { HardHat, AlertTriangle, ClipboardCheck, Stethoscope, FileWarning, Bell } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Software ISO 45001 — Gestión de Seguridad y Salud Laboral | SGI360',
  description:
    'Gestioná seguridad y salud ocupacional ISO 45001: IPERC por puesto, incidentes y casi-accidentes, ART/leyes locales, EPP, simulacros y capacitaciones con evidencia. USD 99/mes, usuarios ilimitados.',
  alternates: { canonical: 'https://logismart.ar/iso-45001' },
};

export default function Iso45001Page() {
  return (
    <NormLanding
      d={{
        norma: 'ISO 45001',
        tag: 'Seguridad y Salud Laboral',
        h1: 'Gestioná la seguridad laboral con evidencia real, no con carpetas',
        sub: 'SGI360 cubre ISO 45001: IPERC por puesto de trabajo, gestión de incidentes con investigación, cumplimiento normativo, EPP, simulacros y capacitaciones — todo con trazabilidad auditable.',
        heroCta: 'Quiero gestionar seguridad con ISO 45001',
        dolorTitulo: 'Lo que pasa cuando la seguridad vive en papel',
        dolores: [
          'La IPERC se hizo para la ART una vez y nadie la actualizó cuando cambió el puesto o el proceso.',
          'Los casi-accidentes se reportan por WhatsApp (o no se reportan) y no generan acciones correctivas.',
          'Los EPP se entregan sin registro de quién recibió qué y cuándo toca reposición.',
          'La matriz legal de seguridad está desactualizada y nadie sabe qué norma nueva aplica.',
          'El control pre-servicio de conductores u operarios es un papel que se firma sin verificar.',
        ],
        coberturaTitulo: 'Seguridad gestionada de punta a punta',
        cobertura: [
          { icon: HardHat, titulo: 'IPERC y riesgos por puesto', desc: 'Identificación de peligros por puesto/proceso con evaluación y controles jerarquizados.' },
          { icon: FileWarning, titulo: 'Incidentes y casi-accidentes', desc: 'Registro con investigación, causa raíz, días perdidos y acciones correctivas vinculadas.' },
          { icon: ClipboardCheck, titulo: 'Cumplimiento normativo', desc: 'Matriz legal de seguridad laboral con normas aplicables, responsables y evidencias.' },
          { icon: Stethoscope, titulo: 'Control pre-servicio', desc: 'Chequeo del operario/conductor vía QR antes de cada jornada: presión, alcoholemia, descanso.' },
          { icon: Bell, titulo: 'Vencimientos y alertas', desc: 'Exámenes médicos, licencias, EPP y planes de capacitación con aviso automático.' },
          { icon: AlertTriangle, titulo: 'Simulacros y emergencias', desc: 'Planificación de simulacros, registros de ejecución y lecciones aprendidas.' },
        ],
        cierre:
          'Además la seguridad no queda aislada: un incidente puede generar una NC, una acción correctiva y una capacitación correctiva sin re-cargar datos en otros sistemas.',
      }}
    />
  );
}
