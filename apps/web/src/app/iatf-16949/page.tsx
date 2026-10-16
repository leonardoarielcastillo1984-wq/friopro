import type { Metadata } from 'next';
import { NormLanding } from '@/components/marketing/NormLanding';
import { Car, GitBranch, Target, TrendingUp, FileCheck, Package } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Software IATF 16949 con Core Tools integradas — APQP, PPAP, FMEA, MSA, SPC | SGI360',
  description:
    'Plataforma para IATF 16949 con core tools nativas: APQP, PPAP, FMEA/AMFE, MSA, SPC y plan de control conectados al SGI. La característica del FMEA alimenta el plan de control y el SPC. USD 99/mes.',
  alternates: { canonical: 'https://logismart.ar/iatf-16949' },
};

export default function Iatf16949Page() {
  return (
    <NormLanding
      d={{
        norma: 'IATF 16949',
        tag: 'Industria Automotriz',
        h1: 'IATF 16949 con las core tools integradas de verdad',
        sub: 'SGI360 incluye APQP, PPAP, FMEA/AMFE, MSA, SPC y plan de control como módulo nativo — no como planillas anexas. Los datos fluyen entre herramientas y con el resto del SGI.',
        heroCta: 'Quiero implementar IATF 16949',
        dolorTitulo: 'El problema de las core tools en archivos sueltos',
        dolores: [
          'El PFMEA dice una cosa, el plan de control otra y el SPC monitorea una tercera versión — inconsistencia = NC mayor típica.',
          'El PPAP se arma a mano copiando datos de cuatro Excels distintos días antes de la entrega.',
          'Los estudios MSA viven en una carpeta que nadie cruza con el método de medición del plan de control.',
          'Cuando el cliente pide el historial de una característica especial, no hay trazabilidad completa.',
          'Los cambios de revisión del FMEA no se propagan — el plan de control queda con información vieja.',
        ],
        coberturaTitulo: 'Las 6 herramientas, un solo dato',
        cobertura: [
          { icon: GitBranch, titulo: 'APQP', desc: 'Planificación avanzada por fases con hitos, responsables y entregables por proyecto de producto.' },
          { icon: Target, titulo: 'FMEA / AMFE', desc: 'DFMEA y PFMEA con S/O/D o AP, revisiones versionadas y vínculo directo a características especiales.' },
          { icon: FileCheck, titulo: 'Plan de Control', desc: 'Generado desde el PFMEA: característica, método, frecuencia y plan de reacción — mismo dato, sin copiar.' },
          { icon: Package, titulo: 'MSA', desc: 'Estudios R&R, sesgo y linealidad de los sistemas de medición vinculados a cada característica.' },
          { icon: TrendingUp, titulo: 'SPC', desc: 'Cartas de control, Cp/Cpk/Ppk y alarmas de desviación sobre las características del plan de control.' },
          { icon: Car, titulo: 'PPAP', desc: 'El paquete de aprobación se compone desde la data real del sistema — FMEA, MSA, SPC y plan de control incluidos.' },
        ],
        cierre:
          'Y las core tools no quedan aisladas: una desviación de SPC puede abrir una no conformidad con acción correctiva dentro del mismo SGI — el mapa de procesos IATF ya viene como plantilla importable.',
      }}
    />
  );
}
