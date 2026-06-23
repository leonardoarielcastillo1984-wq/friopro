// Registro central de descripciones de módulos del SGI 360.
// Se usa tanto en el menú lateral (Sidebar) como en los títulos de página (PageTitleHelp).
// La clave es el href/ruta del módulo.

export interface ModuleInfo {
  title: string;
  description: string;
}

export const MODULE_DESCRIPTIONS: Record<string, ModuleInfo> = {
  '/dashboard': {
    title: 'Inicio',
    description: 'Vista general del sistema con indicadores clave, alertas y accesos rápidos a tus módulos.',
  },
  '/command-center': {
    title: 'Command Center',
    description: 'Centro de comando con métricas en tiempo real, estado del SGI y alertas consolidadas.',
  },
  '/documents': {
    title: 'Documentos',
    description: 'Gestión documental: control de versiones, codificación, revisiones y aprobaciones.',
  },
  '/rrhh': {
    title: 'RRHH',
    description: 'Gestión de empleados, legajos, competencias y estructura organizacional.',
  },
  '/capacitaciones': {
    title: 'Capacitaciones',
    description: 'Planificación, seguimiento y registro de capacitaciones y formación del personal.',
  },
  '/clientes': {
    title: 'Clientes',
    description: 'Administración de clientes, contactos e información comercial.',
  },
  '/proveedores': {
    title: 'Proveedores',
    description: 'Registro, calificación y evaluación de proveedores.',
  },
  '/cumplimiento': {
    title: 'Normativos',
    description: 'Marco normativo y requisitos legales aplicables al sistema de gestión.',
  },
  '/contexto-sgi': {
    title: 'Contexto del SGI',
    description: 'Contexto de la organización, partes interesadas y análisis FODA (ISO §4).',
  },
  '/objetivos': {
    title: 'Objetivos SGI',
    description: 'Definición, planificación y seguimiento de los objetivos del sistema de gestión.',
  },
  '/objetivos/politicas': {
    title: 'Políticas SGI',
    description: 'Políticas del sistema integrado de gestión (calidad, ambiente, seguridad).',
  },
  '/calidad': {
    title: 'No Conformidades y Plan de acción',
    description: 'Gestión de no conformidades (NCR) y acciones correctivas/preventivas (CAPA).',
  },
  '/auditoria': {
    title: 'Auditorías',
    description: 'Planificación, ejecución y seguimiento de auditorías internas con asistencia de IA.',
  },
  '/revision-direccion': {
    title: 'Revisión por la Dirección',
    description: 'Revisiones por la dirección y análisis del desempeño del SGI (ISO §9.3).',
  },
  '/seguridad': {
    title: 'Seguridad & Ambiente',
    description: 'Gestión de seguridad, salud ocupacional y medio ambiente (matriz de riesgos, EPP, incidentes).',
  },
  '/indicadores': {
    title: 'Indicadores',
    description: 'Indicadores y KPIs de desempeño del sistema de gestión con tendencias.',
  },
  '/proyectos': {
    title: 'Proyectos',
    description: 'Gestión de proyectos, tareas, hitos y portafolio (PMO).',
  },
  '/project360': {
    title: 'Proyectos',
    description: 'Gestión de proyectos, tareas, hitos y portafolio (PMO).',
  },
  '/calendario': {
    title: 'Calendario',
    description: 'Calendario de actividades, vencimientos y eventos programados.',
  },
  '/infraestructura': {
    title: 'Infraestructura',
    description: 'Gestión de activos, mantenimiento e inspecciones inteligentes por QR.',
  },
  '/reportes': {
    title: 'Reportes',
    description: 'Generación, exportación y descarga de reportes del sistema.',
  },
  '/modo-de-uso': {
    title: 'Centro de Ayuda',
    description: 'Guías, tutoriales y asistente para aprender a usar SGI 360.',
  },
  '/clima': {
    title: 'Clima y Cultura',
    description: 'Encuestas de clima, sugerencias, análisis de sentimiento y planes de acción.',
  },
  '/notificaciones': {
    title: 'Notificaciones',
    description: 'Centro de notificaciones y avisos del sistema.',
  },
  '/configuracion': {
    title: 'Configuración',
    description: 'Preferencias y configuración de tu cuenta de usuario.',
  },
  '/configuracion/empresa': {
    title: 'Configuración de la empresa',
    description: 'Datos de la empresa, logo, firma y ajustes generales del tenant.',
  },
  '/admin': {
    title: 'Super Admin',
    description: 'Panel de administración global de la plataforma.',
  },
};

/** Obtiene la info del módulo por ruta (coincidencia exacta o por prefijo). */
export function getModuleInfo(href: string): ModuleInfo | null {
  if (MODULE_DESCRIPTIONS[href]) return MODULE_DESCRIPTIONS[href];
  // Coincidencia por prefijo más específico
  const match = Object.keys(MODULE_DESCRIPTIONS)
    .filter((path) => path !== '/' && (href === path || href.startsWith(path + '/')))
    .sort((a, b) => b.length - a.length)[0];
  return match ? MODULE_DESCRIPTIONS[match] : null;
}
