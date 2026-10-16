import type { Metadata } from 'next';
import { ChecklistIso9001 } from '@/components/marketing/ChecklistIso9001';

export const metadata: Metadata = {
  title: 'Checklist ISO 9001 gratis — Autodiagnóstico interactivo | SGI360',
  description:
    'Checklist interactivo de ISO 9001:2015 — evaluá el estado de tu sistema de gestión en 10 minutos: contexto, liderazgo, riesgos, soporte, operación, evaluación y mejora. Gratis, sin registro.',
  alternates: { canonical: 'https://logismart.ar/herramientas/checklist-iso-9001' },
};

export default function ChecklistPage() {
  return <ChecklistIso9001 />;
}
