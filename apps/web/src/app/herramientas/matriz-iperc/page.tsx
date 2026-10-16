import type { Metadata } from 'next';
import { LeadMagnetLanding } from '@/components/marketing/LeadMagnetLanding';
import { ShieldAlert } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Plantilla Matriz IPERC gratis (Excel) — ISO 45001 | SGI360',
  description:
    'Descargá gratis la plantilla IPERC en Excel: identificación de peligros, evaluación de riesgos por probabilidad e impacto, controles y plan de acción. Lista para ISO 45001.',
  alternates: { canonical: 'https://logismart.ar/herramientas/matriz-iperc' },
};

export default function MatrizIpercPage() {
  return (
    <LeadMagnetLanding
      d={{
        norma: 'ISO 45001',
        tag: 'Descarga gratuita · Excel',
        h1: 'Matriz IPERC lista para usar — plantilla Excel gratis',
        sub: 'La matriz de Identificación de Peligros y Evaluación de Riesgos y Controles que usa la mayoría de las empresas para ISO 45001 — con la escala 5×5 ya armada y ejemplos cargados.',
        recursoTitulo: 'Plantilla Matriz IPERC (Excel)',
        fuente: 'matriz-iperc',
        downloadUrl: '/descargas/plantilla-matriz-iperc.xlsx',
        icono: ShieldAlert,
        incluye: [
          'Identificación de peligros por tarea/proceso con clasificación de tipo',
          'Evaluación probabilidad × impacto (escala 1-5) con nivel de riesgo automático',
          'Controles existentes y plan de acción con responsable y fecha',
          'Re-evaluación posterior al control — para demostrar eficacia en auditoría',
          '3 filas de ejemplo cargadas para copiar el formato',
        ],
        cierre:
          'En SGI360 la matriz IPERC está conectada con los procesos, los controles documentados y las acciones correctivas — el auditor ve el ciclo completo, no una planilla.',
      }}
    />
  );
}
