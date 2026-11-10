import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Biblioteca legal compartida multi-país (LegalLibrary).
 * Contenido base SST / ambiental / transversal para AR y CL.
 * NOTA: la normativa debe ser validada periódicamente por un profesional
 * de Seguridad e Higiene; esto es contenido de partida, no asesoría legal.
 */

type Entry = {
  country: string;           // AR | CL | ALL
  framework: 'ENVIRONMENTAL' | 'OHAS' | 'QUALITY' | 'OTHER';
  jurisdiction?: string;
  source: string;
  article?: string;
  title: string;
  description?: string;
  appliesTo?: string;
  enforcingAuthority?: string;
  sourceUrl?: string;
};

const ENTRIES: Entry[] = [
  // ═══════════════════════════ ARGENTINA — SST ═══════════════════════════
  {
    country: 'AR', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'Ley 19.587', title: 'Higiene y Seguridad en el Trabajo — ley madre',
    description: 'Establece el marco general de prevención de riesgos laborales. Exige mantener condiciones de higiene y seguridad y disponer servicios de S&H.',
    enforcingAuthority: 'SRT / Ministerio de Trabajo',
    sourceUrl: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/20000-24999/20454/norma.htm',
  },
  {
    country: 'AR', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'Decreto 351/79', title: 'Reglamentación de la Ley 19.587 (decreto reglamentario)',
    description: 'Reglamenta la ley madre: responsabilidades del empleador, condiciones de los locales, EPP, servicios de higiene y seguridad (arts. 84-91) y médicos de trabajo.',
    enforcingAuthority: 'SRT / Ministerio de Trabajo',
    sourceUrl: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/20000-24999/21012/norma.htm',
  },
  {
    country: 'AR', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'Ley 24.557', title: 'Ley de Riesgos del Trabajo (LRT) — contratación de ART',
    description: 'Obliga a asegurar a todo trabajador contra accidentes de trabajo y enfermedades profesionales mediante una Aseguradora de Riesgos del Trabajo (ART).',
    enforcingAuthority: 'SRT / ART',
    sourceUrl: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/35000-39999/36502/norma.htm',
  },
  {
    country: 'AR', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'Decreto 717/96', title: 'Reglamentario de la LRT — prestaciones y cumplimiento',
    description: 'Regula las prestaciones dinerarias y en especie de la ART, comisiones médicas y obligaciones del empleador frente a accidentes y enfermedades profesionales.',
    enforcingAuthority: 'SRT / ART',
  },
  {
    country: 'AR', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'Resolución SRT 299/11', title: 'Protocolos y normas técnicas de referencia',
    description: 'Establece el sistema de normas técnicas (protocolos) para evaluar y controlar condiciones de higiene y seguridad: iluminación, ruido, ergonomía, químicos, etc.',
    enforcingAuthority: 'SRT',
    sourceUrl: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/180000-184999/181447/norma.htm',
  },
  {
    country: 'AR', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'Resolución SRT 886/2015', title: 'Protocolo de ergonomía — manejo manual de cargas',
    description: 'Límites de levantamiento manual de cargas y evaluación ergonómica de tareas de manipulación de peso.',
    enforcingAuthority: 'SRT',
  },
  {
    country: 'AR', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'Resolución SRT 905/2015', title: 'Capacitaciones en Seguridad e Higiene',
    description: 'Obligación de capacitar y dar examen anual en seguridad e higiene a todo el personal, con registros y certificados.',
    enforcingAuthority: 'SRT',
  },
  {
    country: 'AR', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'Resolución SRT 84/12', title: 'Protocolo de iluminación',
    description: 'Valores de iluminación exigidos por tipo de tarea/área de trabajo y método de medición.',
    enforcingAuthority: 'SRT',
  },
  {
    country: 'AR', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'Decreto 911/96', title: 'Régimen de seguridad para la industria de la construcción',
    description: 'Requisitos especiales de higiene y seguridad para obras de construcción: plan de S&H, comités, protección contra caídas.',
    appliesTo: 'Construcción',
    enforcingAuthority: 'SRT',
  },
  {
    country: 'AR', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'Decreto 617/97', title: 'Régimen de seguridad para actividades agrarias',
    description: 'Condiciones de higiene y seguridad para trabajos agrarios: maquinaria rural, agroquímicos, vivienda rural.',
    appliesTo: 'Agrario / agroindustria',
    enforcingAuthority: 'SRT',
  },
  {
    country: 'AR', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'Ley 26.528', title: 'Régimen legal del teletrabajo',
    description: 'Regula el trabajo remoto: reversibilidad, compensación de gastos, derecho a la desconexión y condiciones del puesto de trabajo remoto.',
    appliesTo: 'Personal remoto / teletrabajo',
    enforcingAuthority: 'Ministerio de Trabajo',
  },
  {
    country: 'AR', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'Ley 24.449', title: 'Ley Nacional de Tránsito y Seguridad Vial',
    description: 'Para empresas con flotas o transporte: habilitación de conductores, requisitos de vehículos, seguridad vial ocupacional.',
    appliesTo: 'Transporte / logística / flota',
    enforcingAuthority: 'ANSV / DNRPA',
  },
  {
    country: 'AR', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'Decreto 351/79', article: 'Arts. 84-91', title: 'Servicios de Higiene y Seguridad y Médicos de Trabajo',
    description: 'Toda empresa debe contratar o constituir un servicio de higiene y seguridad profesional y médico laboral según cantidad de trabajadores y riesgo.',
    enforcingAuthority: 'SRT',
  },

  // ═══════════════════════════ ARGENTINA — AMBIENTAL ═══════════════════════════
  {
    country: 'AR', framework: 'ENVIRONMENTAL', jurisdiction: 'Nacional',
    source: 'Ley 24.051', title: 'Residuos Peligrosos — generación, manejo y disposición',
    description: 'Régimen de residuos peligrosos: registro de generadores, manifiesto, transporte habilitado y disposición final aprobada.',
    enforcingAuthority: 'SAyDS / provincias',
    sourceUrl: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/15000-19999/16514/norma.htm',
  },
  {
    country: 'AR', framework: 'ENVIRONMENTAL', jurisdiction: 'Nacional',
    source: 'Decreto 831/93', title: 'Reglamentario de la Ley 24.051 (residuos peligrosos)',
    description: 'Reglamenta la generación, manipulación, transporte, tratamiento y disposición final de residuos peligrosos y su registro.',
    enforcingAuthority: 'SAyDS / provincias',
  },
  {
    country: 'AR', framework: 'ENVIRONMENTAL', jurisdiction: 'Nacional',
    source: 'Ley 25.675', title: 'Presupuestos Mínimos de Protección Ambiental',
    description: 'Ley general del ambiente: EIA para actividades significativas, responsabilidad ambiental, derecho de información.',
    enforcingAuthority: 'SAyDS',
  },
  {
    country: 'AR', framework: 'ENVIRONMENTAL', jurisdiction: 'Nacional',
    source: 'Ley 25.612', title: 'Gestión Integral de Residuos Sólidos',
    description: 'Gestión de residuos industriales y sólidos: separación, tratamiento y disposición conforme a la normativa provincial/nacional.',
    enforcingAuthority: 'SAyDS / municipios',
  },
  {
    country: 'AR', framework: 'OTHER', jurisdiction: 'Nacional',
    source: 'Ley 18.284', title: 'Código Alimentario Argentino (CAA)',
    description: 'Para industrias alimentarias: condiciones higiénico-sanitarias de locales, procesos, productos y personal manipulador.',
    appliesTo: 'Alimentos / bebidas / gastronomía',
    enforcingAuthority: 'ANMAT / INAL',
  },

  // ═══════════════════════════ CHILE — SST ═══════════════════════════
  {
    country: 'CL', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'Ley 16.744', title: 'Seguro de Riesgos del Trabajo y Enfermedades Profesionales',
    description: 'Seguro obligatorio contra accidentes del trabajo y enfermedades profesionales (mutualidades / ISL). Cubre atención médica y prestaciones.',
    enforcingAuthority: 'SUSESO / mutualidades',
    sourceUrl: 'https://www.bcn.cl/leychile/navegar?idNorma=16750',
  },
  {
    country: 'CL', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'DS 594/1999 (MINSAL)', title: 'Condiciones Sanitarias y Ambientales Básicas en los Lugares de Trabajo',
    description: 'Reglamenta condiciones básicas de higiene en el trabajo: iluminación, ventilación, ruido, sustancias, EPP, comedores, sanitarios.',
    enforcingAuthority: 'Seremi de Salud',
    sourceUrl: 'https://www.bcn.cl/leychile/navegar?idNorma=167766',
  },
  {
    country: 'CL', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'DS 40/1969 (MINTRAB)', title: 'Reglamento sobre Prevención de Riesgos Profesionales',
    description: 'Organización de la prevención dentro de la empresa: planes, comités paritarios, expertos en prevención según tamaño y riesgo.',
    enforcingAuthority: 'Dirección del Trabajo / SUSESO',
  },
  {
    country: 'CL', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'DS 54/1969 (MINTRAB)', title: 'Departamentos de Prevención de Riesgos',
    description: 'Empresas con más de 100 trabajadores deben contar con un departamento de prevención de riesgos profesionales encabezado por un experto.',
    enforcingAuthority: 'Dirección del Trabajo',
  },
  {
    country: 'CL', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'DS 44/2023 (MINTRAB)', title: 'Reglamento sobre Gestión Preventiva de los Riesgos Laborales',
    description: 'Nuevo reglamento (vigente desde 2024): sistema de gestión preventiva, comités paritarios, plan de prevención, vigilancia de la salud.',
    enforcingAuthority: 'Dirección del Trabajo',
  },
  {
    country: 'CL', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'Ley 16.744', article: 'Arts. 38-40', title: 'Comité Paritario de Higiene y Seguridad',
    description: 'Empresas con más de 25 trabajadores deben constituir comité paritario con representantes del empleador y los trabajadores.',
    enforcingAuthority: 'SUSESO / mutualidades',
  },
  {
    country: 'CL', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'Ley 16.744', article: 'Art. 49', title: 'Plan de prevención de riesgos',
    description: 'Toda empresa debe formular un plan escrito de prevención de riesgos, con responsable y evaluación de condiciones del trabajo.',
    enforcingAuthority: 'SUSESO',
  },
  {
    country: 'CL', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'Ley 20.123', title: 'Subcontratación — obligaciones del mandante en prevención',
    description: 'El mandante debe proteger a trabajadores de contratistas en su obra/faena (art. 183-A Código del Trabajo) y coordinar la prevención.',
    appliesTo: 'Empresas con contratistas/subcontratas',
    enforcingAuthority: 'Dirección del Trabajo',
  },
  {
    country: 'CL', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'Ley 21.643', title: 'Modificación del Código del Trabajo en prevención de riesgos laborales (2024)',
    description: 'Reforma 2024: fortalece la gestión preventiva, responsabilidad del empleador, comités paritarios y fiscalización de la DT.',
    enforcingAuthority: 'Dirección del Trabajo',
  },
  {
    country: 'CL', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'DS 109/2005 (MINTRAB)', title: 'Calificación y evaluación de accidentes y enfermedades profesionales',
    description: 'Procedimiento para calificar accidentes del trabajo y enfermedades profesionales ante los organismos administradores.',
    enforcingAuthority: 'SUSESO',
  },
  {
    country: 'CL', framework: 'OHAS', jurisdiction: 'Nacional',
    source: 'Ley 18.010', title: 'Transporte Terrestre — condiciones y seguridad de flotas',
    description: 'Para empresas de transporte: requisitos de vehículos, conductores, habilitación y seguridad en la vía pública.',
    appliesTo: 'Transporte / logística / flota',
    enforcingAuthority: 'Ministerio de Transportes',
  },

  // ═══════════════════════════ CHILE — AMBIENTAL ═══════════════════════════
  {
    country: 'CL', framework: 'ENVIRONMENTAL', jurisdiction: 'Nacional',
    source: 'Ley 19.300', title: 'Bases Generales del Medio Ambiente (LBGMA)',
    description: 'Ley madre ambiental: instrumentos de gestión (EIA/SEIA), responsabilidad por daño ambiental, normas de emisión.',
    enforcingAuthority: 'MMA / SEA',
    sourceUrl: 'https://www.bcn.cl/leychile/navegar?idNorma=30667',
  },
  {
    country: 'CL', framework: 'ENVIRONMENTAL', jurisdiction: 'Nacional',
    source: 'DS 40/2012 (MMA)', title: 'Reglamento del Sistema de Evaluación de Impacto Ambiental (RSEIA)',
    description: 'Reglamenta el SEIA: proyectos/actividades sometidos a evaluación ambiental, entrada a DIA/EIA, fiscalización.',
    enforcingAuthority: 'SEA',
  },
  {
    country: 'CL', framework: 'ENVIRONMENTAL', jurisdiction: 'Nacional',
    source: 'Ley 20.920', title: 'REP — Responsabilidad Extendida del Productor',
    description: 'Gestión de residuos: obligaciones de productores de bienes prioritarios (neumáticos, envases, baterías, aceites, aparatos).',
    enforcingAuthority: 'MMA',
  },
  {
    country: 'CL', framework: 'ENVIRONMENTAL', jurisdiction: 'Nacional',
    source: 'DS 148/2003 (MINSAL)', title: 'Reglamento Sanitario sobre Manejo de Residuos Peligrosos',
    description: 'Condiciones para la generación, almacenamiento, transporte y disposición de residuos peligrosos con riesgo sanitario.',
    enforcingAuthority: 'Seremi de Salud',
  },
  {
    country: 'CL', framework: 'OTHER', jurisdiction: 'Nacional',
    source: 'DFL 725/1967', title: 'Código Sanitario',
    description: 'Código sanitario chileno: condiciones higiénico-sanitarias de establecimientos, alimentos, agua y salud ocupacional base.',
    enforcingAuthority: 'Seremi de Salud',
  },
  {
    country: 'CL', framework: 'OTHER', jurisdiction: 'Nacional',
    source: 'DS 977/1996 (MINSAL)', title: 'Reglamento Sanitario de los Alimentos',
    description: 'Para industrias alimentarias: condiciones de locales, procesos, personal manipulador y productos alimenticios.',
    appliesTo: 'Alimentos / bebidas / gastronomía',
    enforcingAuthority: 'Seremi de Salud',
  },
  {
    country: 'CL', framework: 'OTHER', jurisdiction: 'Nacional',
    source: 'Ley 21.015', title: 'Inclusión laboral de personas con discapacidad',
    description: 'Empresas de 100+ trabajadores deben contar con un porcentaje de personas con discapacidad o asignatarias de pensión de invalidez.',
    enforcingAuthority: 'Dirección del Trabajo',
  },

  // ═══════════════════════════ TRANSVERSALES (OIT) ═══════════════════════════
  {
    country: 'ALL', framework: 'OHAS',
    source: 'Convenio OIT C155', title: 'Seguridad y salud de los trabajadores y medio ambiente de trabajo',
    description: 'Convenio base de la OIT sobre políticas nacionales y de empresa en materia de SST — referencia internacional común.',
    enforcingAuthority: 'OIT / autoridad laboral nacional',
  },
  {
    country: 'ALL', framework: 'OHAS',
    source: 'Convenio OIT C187', title: 'Marco promocional para la seguridad y salud en el trabajo',
    description: 'Exige a los países promover cultura preventiva nacional y sistema nacional de SST; ratificado por Argentina y Chile.',
    enforcingAuthority: 'OIT',
  },
  {
    country: 'ALL', framework: 'OHAS',
    source: 'Convenio OIT C170', title: 'Sustancias químicas en el trabajo',
    description: 'Marco para clasificación, etiquetado, manejo y protección frente a sustancias químicas peligrosas.',
    enforcingAuthority: 'OIT / autoridad laboral nacional',
  },
];

async function main() {
  let created = 0, updated = 0;
  for (const e of ENTRIES) {
    const existing = await prisma.legalLibrary.findFirst({
      where: { country: e.country, source: e.source, title: e.title },
    });
    if (existing) {
      await prisma.legalLibrary.update({ where: { id: existing.id }, data: { ...e, isActive: true } });
      updated++;
    } else {
      await prisma.legalLibrary.create({ data: e });
      created++;
    }
  }
  console.log(`[seedLegalLibrary] ${created} creadas, ${updated} actualizadas — total ${ENTRIES.length} normas`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
