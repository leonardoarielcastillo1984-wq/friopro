import type { Metadata } from 'next';
import { LeadMagnetLanding } from '@/components/marketing/LeadMagnetLanding';

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
        icono: 'lock',
        incluye: [
          'Los 93 controles del Anexo A de ISO/IEC 27001:2022 ya listados',
          'Organizados por tema: organizacionales (37), personas (8), físicos (14), tecnológicos (34)',
          'Columnas: ¿Aplica? / justificación de inclusión o exclusión / estado de implementación',
          'Responsable, evidencia/documento vinculado y fecha de revisión',
          'Resumen automático: % de controles aplicables e implementados',
        ],
        cierre:
          'En SGI360 el SoA no es un archivo: cada control queda vinculado a documentos, riesgos y evidencias — la revisión independiente sale con un clic.',
        faq: [
          {
            q: '¿Qué es la Declaración de Aplicabilidad (SoA)?',
            a: 'Es el documento obligatorio de la cláusula 6.1.3 de ISO 27001 donde la organización declara, para cada control del Anexo A, si lo implementa o lo excluye — y por qué. Es lo primero que pide el auditor en una certificación.',
          },
          {
            q: '¿Cuántos controles tiene el Anexo A de ISO 27001:2022?',
            a: '93 controles organizados en 4 temas: 37 organizacionales (A.5), 8 de personas (A.6), 14 físicos (A.7) y 34 tecnológicos (A.8). La plantilla ya los trae listados y separados por grupo — solo completás aplicabilidad, justificación, estado y responsable.',
          },
          {
            q: '¿Puedo excluir controles del Anexo A?',
            a: 'Sí — no todos los controles aplican a todas las organizaciones. Pero cada exclusión tiene que estar justificada (ej: "no desarrollamos software" para controles de desarrollo seguro). Una exclusión sin justificación es no conformidad segura en auditoría.',
          },
          {
            q: '¿Qué campos mínimos evalúa el auditor en el SoA?',
            a: 'Aplicabilidad (SI/NO), justificación de inclusión o exclusión, estado de implementación, responsable y vínculo a la evidencia. La plantilla incluye desplegables en "¿Aplica?" y "Estado" para mantener consistencia.',
          },
        ],
      }}
    />
  );
}
