import type { Metadata } from 'next';
import { LeadMagnetLanding } from '@/components/marketing/LeadMagnetLanding';
import { Lock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'SoA ISO 27001 gratis (Excel) — Declaración de Aplicabilidad | SGI360',
  description:
    'Descargá gratis la Declaración de Aplicabilidad ISO 27001:2022 en Excel: los 93 controles del Anexo A listados con campos de aplicabilidad, justificación, estado y responsable.',
  alternates: { canonical: 'https://logismart.ar/herramientas/soa-iso-27001' },
};

export default function SoaIso27001Page() {
  return (
    <LeadMagnetLanding
      d={{
        norma: 'ISO 27001',
        tag: 'Descarga gratuita · Excel',
        h1: 'Declaración de Aplicabilidad ISO 27001:2022 — los 93 controles en Excel',
        sub: 'El documento más pesado de armar en un SGSI, ya listo: los 93 controles del Anexo A organizados por tema, con los campos que el auditor pide — aplicabilidad, justificación, estado y responsable.',
        recursoTitulo: 'SoA ISO 27001:2022 — Declaración de Aplicabilidad (Excel)',
        fuente: 'soa-iso-27001',
        downloadUrl: '/descargas/soa-iso-27001.xlsx',
        icono: Lock,
        incluye: [
          'Los 93 controles del Anexo A de ISO/IEC 27001:2022 ya listados',
          'Organizados por tema: organizacionales (37), personas (8), físicos (14), tecnológicos (34)',
          'Columnas: ¿Aplica? / justificación de inclusión o exclusión / estado de implementación',
          'Responsable, evidencia/documento vinculado y fecha de revisión',
          'Resumen automático: % de controles aplicables e implementados',
        ],
        cierre:
          'En SGI360 el SoA no es un archivo: cada control queda vinculado a documentos, riesgos y evidencias — la revisión independiente sale con un clic.',
      }}
    />
  );
}
