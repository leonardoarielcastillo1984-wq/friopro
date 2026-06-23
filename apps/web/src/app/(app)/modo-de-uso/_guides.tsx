'use client';
// Datos del Centro de Ayuda — reflejan los módulos y pestañas REALES del sistema.
// Cada guía mapea a una ruta real (route) y sus secciones (tabs) para "Abrir esta pantalla".
// Las capturas viven en /public/help/{id}-{n}.png (ver scripts/capture-help-screenshots.mjs).

import {
  LayoutDashboard, Brain, FileText, Users, GraduationCap, Headphones, Truck,
  BookOpen, Compass, Target, ScrollText, ClipboardCheck, BrainCircuit,
  FileBarChart, Shield, TrendingUp, BarChart3, CalendarDays, Package,
  FileSpreadsheet, Wind, Settings, Building2, Bell, HelpCircle,
} from 'lucide-react';

export type Difficulty = 'Fácil' | 'Medio' | 'Avanzado';

export interface GuideAction { name: string; description: string; detail?: string; }
export interface GuideStep { title: string; description: string; subSteps?: string[]; }
export interface GuideTab { key: string; label: string; }
export interface Screenshot { label: string; caption: string; route?: string; }
export interface ModuleGuide {
  id: string;
  title: string;
  icon: any;
  route: string;
  group: string;
  purpose: string;
  tabs?: GuideTab[];
  mainFeatures: string[];
  actions: GuideAction[];
  steps: GuideStep[];
  screenshots: Screenshot[];
  related: string[];
  tips: string[];
  isoRef?: string;
  difficulty?: Difficulty;
  estimatedTime?: string;
}

export const difficultyConfig: Record<string, { color: string; bg: string; border: string }> = {
  'Fácil': { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  'Medio': { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  'Avanzado': { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
};

export const guides: ModuleGuide[] = [
  /* ───────── 1. Visión general ───────── */
  {
    id: 'dashboard', title: 'Inicio', icon: LayoutDashboard, route: '/dashboard',
    group: 'Visión general',
    purpose: 'Vista general del SGI: indicadores clave, alertas y accesos rápidos a tus módulos.',
    mainFeatures: ['Tarjetas de métricas con tendencia', 'Alertas de vencimientos y pendientes', 'Accesos rápidos a los módulos', 'Resumen del estado del sistema'],
    actions: [
      { name: 'Tarjetas de métricas', description: 'Cliqueá una tarjeta para abrir el módulo correspondiente.', detail: 'Muestran conteo actual y tendencia.' },
      { name: 'Alertas', description: 'Revisá vencimientos y tareas pendientes del sistema.', detail: 'Se actualizan automáticamente.' },
    ],
    steps: [
      { title: 'Revisar el estado general', description: 'Al iniciar sesión, el Inicio carga automáticamente.', subSteps: ['Observá las tarjetas de métricas', 'Verde = en orden, ámbar = atención, rojo = urgente'] },
      { title: 'Atender alertas', description: 'Bajá al panel de alertas.', subSteps: ['Cliqueá una alerta para ir a su origen'] },
    ],
    screenshots: [{ label: 'Inicio', caption: 'Vista general con métricas y alertas', route: '/dashboard' }],
    related: ['command-center', 'indicadores', 'reportes'],
    tips: ['Usalo como tablero de arranque diario.', 'Cliqueá las métricas para navegar directo al módulo.'],
    difficulty: 'Fácil', estimatedTime: '5 minutos',
  },
  {
    id: 'command-center', title: 'Command Center', icon: Brain, route: '/command-center',
    group: 'Visión general',
    purpose: 'Torre de control con IA: métricas en tiempo real, estado consolidado del SGI y alertas inteligentes.',
    mainFeatures: ['Panel consolidado en tiempo real', 'Alertas priorizadas por IA', 'Estado global de cumplimiento', 'Recomendaciones automáticas'],
    actions: [
      { name: 'Explorar paneles', description: 'Recorré las tarjetas con el estado de cada área del SGI.', detail: 'Se nutre de datos de todos los módulos.' },
      { name: 'Atender recomendaciones', description: 'Seguí las acciones sugeridas por la IA.', detail: 'Prioriza lo más crítico primero.' },
    ],
    steps: [
      { title: 'Abrir Command Center', description: 'Sidebar → "Command Center".', subSteps: ['Esperá la carga de datos en tiempo real'] },
      { title: 'Interpretar el tablero', description: 'Revisá indicadores y alertas consolidadas.', subSteps: ['Atendé primero las alertas rojas'] },
    ],
    screenshots: [{ label: 'Command Center', caption: 'Torre de control con IA', route: '/command-center' }],
    related: ['dashboard', 'indicadores'],
    tips: ['Ideal para una vista ejecutiva rápida del SGI.'],
    difficulty: 'Medio', estimatedTime: '10 minutos',
  },
  {
    id: 'documents', title: 'Documentos', icon: FileText, route: '/documents',
    group: 'Visión general',
    purpose: 'Gestión documental del SGI: subida, control de versiones, codificación y aprobaciones.',
    tabs: [
      { key: 'lista', label: 'Lista' },
      { key: 'maestro', label: 'Maestro' },
      { key: 'config', label: 'Codificación' },
    ],
    mainFeatures: ['Subida multi-formato (PDF, Word, Excel)', 'Extracción de texto para búsqueda y auditoría IA', 'Codificación automática por tipo documental', 'Vinculación a normativas', 'Listado maestro de documentos'],
    actions: [
      { name: 'Subir documento', description: 'Botón "Subir documento" en la pestaña Lista.', detail: 'Extrae el texto automáticamente para búsqueda y Auditoría IA.' },
      { name: 'Maestro', description: 'Pestaña "Maestro": listado maestro con código, tipo y estado.', detail: 'Vista consolidada para control documental.' },
      { name: 'Codificación', description: 'Pestaña "Codificación": configurá tipos documentales y su secuencia de código.', detail: 'Define abreviatura, color y numeración (PRO-CAL-001).' },
    ],
    steps: [
      { title: 'Subir un documento', description: 'Pestaña Lista → "Subir documento".', subSteps: ['Seleccioná el archivo', 'Completá título, tipo documental y departamento', 'Vinculá normativas si aplica', 'Asigná responsable y guardá'] },
      { title: 'Configurar codificación', description: 'Pestaña Codificación.', subSteps: ['Creá tipos documentales con abreviatura', 'Definí la secuencia de numeración'] },
    ],
    screenshots: [
      { label: 'Lista de documentos', caption: 'Repositorio con filtros y estados', route: '/documents' },
      { label: 'Maestro', caption: 'Listado maestro de documentos', route: '/documents' },
      { label: 'Codificación', caption: 'Configuración de tipos y códigos', route: '/documents' },
    ],
    related: ['cumplimiento', 'auditoria', 'calidad'],
    tips: ['Vinculá las normativas antes de usar Auditoría IA.', 'Usá la codificación estandarizada para trazabilidad.'],
    difficulty: 'Fácil', estimatedTime: '10 minutos', isoRef: 'ISO 9001 §7.5',
  },

  /* ───────── 2. Personas y base de datos ───────── */
  {
    id: 'rrhh', title: 'RRHH', icon: Users, route: '/rrhh',
    group: 'Personas',
    purpose: 'Gestión de empleados, legajos, competencias y estructura organizacional.',
    mainFeatures: ['Directorio de empleados', 'Legajos y datos laborales', 'Competencias y matriz de polivalencia', 'Organigrama'],
    actions: [
      { name: 'Nuevo empleado', description: 'Registrá datos personales y laborales.', detail: 'Puesto, área y fecha de ingreso.' },
      { name: 'Competencias', description: 'Asigná competencias requeridas por puesto.', detail: 'Base para detectar brechas de capacitación.' },
    ],
    steps: [
      { title: 'Dar de alta un empleado', description: 'Botón "Nuevo".', subSteps: ['Completá datos y puesto', 'Guardá'] },
      { title: 'Gestionar competencias', description: 'En el perfil del empleado.', subSteps: ['Asigná competencias y nivel requerido'] },
    ],
    screenshots: [{ label: 'RRHH', caption: 'Directorio de empleados', route: '/rrhh' }],
    related: ['capacitaciones', 'clima', 'indicadores'],
    tips: ['Mantené competencias actualizadas para planificar capacitaciones.'],
    difficulty: 'Fácil', estimatedTime: '10 minutos', isoRef: 'ISO 9001 §7.2',
  },
  {
    id: 'capacitaciones', title: 'Capacitaciones', icon: GraduationCap, route: '/capacitaciones',
    group: 'Personas',
    purpose: 'Planificación, seguimiento y registro de capacitaciones y formación del personal.',
    mainFeatures: ['Plan de capacitaciones', 'Registro de asistencia', 'Evaluación de eficacia', 'Vinculación a competencias'],
    actions: [
      { name: 'Nueva capacitación', description: 'Programá tema, fecha, duración e instructor.', detail: 'Vinculable a empleados y competencias.' },
      { name: 'Registrar asistencia', description: 'Marcá los empleados que asistieron.', detail: 'Individual o masiva.' },
    ],
    steps: [
      { title: 'Programar una capacitación', description: 'Botón "Nueva".', subSteps: ['Definí tema, fecha e instructor', 'Inscribí participantes'] },
      { title: 'Cerrar y evaluar', description: 'Al finalizar.', subSteps: ['Registrá asistencia', 'Evaluá eficacia'] },
    ],
    screenshots: [{ label: 'Capacitaciones', caption: 'Plan y registro de capacitaciones', route: '/capacitaciones' }],
    related: ['rrhh', 'indicadores'],
    tips: ['Partí de necesidades detectadas, no de cursos disponibles.'],
    difficulty: 'Medio', estimatedTime: '20 minutos', isoRef: 'ISO 9001 §7.2',
  },
  {
    id: 'clientes', title: 'Clientes', icon: Headphones, route: '/clientes',
    group: 'Personas',
    purpose: 'Administración de clientes, contactos, encuestas de satisfacción e información comercial.',
    mainFeatures: ['Directorio de clientes', 'Encuestas de satisfacción', 'Historial de interacciones', 'Indicadores de atención'],
    actions: [
      { name: 'Nuevo cliente', description: 'Registrá datos de contacto y comerciales.', detail: 'Incluye datos fiscales.' },
      { name: 'Encuestas', description: 'Creá y aplicá encuestas de satisfacción.', detail: 'Analizá resultados y tendencias.' },
    ],
    steps: [
      { title: 'Dar de alta un cliente', description: 'Botón "Nuevo".', subSteps: ['Completá datos', 'Guardá'] },
    ],
    screenshots: [{ label: 'Clientes', caption: 'Gestión de clientes y satisfacción', route: '/clientes' }],
    related: ['proveedores', 'indicadores'],
    tips: ['Medí la satisfacción periódicamente para detectar mejoras.'],
    difficulty: 'Fácil', estimatedTime: '10 minutos',
  },
  {
    id: 'proveedores', title: 'Proveedores', icon: Truck, route: '/proveedores',
    group: 'Personas',
    purpose: 'Registro, calificación y evaluación de proveedores.',
    mainFeatures: ['Directorio de proveedores', 'Evaluación de desempeño', 'Historial y categorización'],
    actions: [
      { name: 'Nuevo proveedor', description: 'Registrá datos comerciales y de contacto.', detail: 'Asigná categoría.' },
      { name: 'Evaluar', description: 'Calificá el desempeño del proveedor.', detail: 'Base para la reevaluación periódica.' },
    ],
    steps: [
      { title: 'Registrar un proveedor', description: 'Botón "Nuevo".', subSteps: ['Completá datos y categoría', 'Guardá'] },
    ],
    screenshots: [{ label: 'Proveedores', caption: 'Gestión y evaluación de proveedores', route: '/proveedores' }],
    related: ['clientes', 'documents'],
    tips: ['Evaluá el desempeño con criterios objetivos.'],
    difficulty: 'Fácil', estimatedTime: '10 minutos', isoRef: 'ISO 9001 §8.4',
  },
  /* ───────── 3. Marco normativo ───────── */
  {
    id: 'cumplimiento', title: 'Normativos y Legales', icon: BookOpen, route: '/cumplimiento',
    group: 'Marco normativo',
    purpose: 'Marco normativo y requisitos legales aplicables: normas ISO, leyes y decretos.',
    tabs: [
      { key: 'normativos', label: 'Normativos' },
      { key: 'legales', label: 'Legales' },
    ],
    mainFeatures: ['Biblioteca de normas (ISO, leyes, decretos)', 'Cláusulas estructuradas', 'Requisitos legales aplicables', 'Vinculación con documentos internos'],
    actions: [
      { name: 'Nuevo normativo', description: 'Pestaña Normativos → cargá una norma con código, versión y PDF.', detail: 'Permite estructurar cláusulas para auditoría.' },
      { name: 'Requisitos legales', description: 'Pestaña Legales → registrá requisitos legales aplicables.', detail: 'Vinculá con la norma o documento correspondiente.' },
    ],
    steps: [
      { title: 'Cargar una norma', description: 'Pestaña Normativos → "Nuevo".', subSteps: ['Completá código y versión', 'Subí el PDF oficial'] },
      { title: 'Registrar requisito legal', description: 'Pestaña Legales.', subSteps: ['Describí el requisito', 'Vinculá la fuente normativa'] },
    ],
    screenshots: [
      { label: 'Normativos', caption: 'Biblioteca de normas', route: '/cumplimiento' },
      { label: 'Legales', caption: 'Requisitos legales aplicables', route: '/cumplimiento?tab=legales' },
    ],
    related: ['documents', 'auditoria'],
    tips: ['Mantené un calendario de revisión normativa.'],
    difficulty: 'Medio', estimatedTime: '20 minutos', isoRef: 'ISO 9001 §6.1',
  },

  /* ───────── 4. Contexto estratégico ───────── */
  {
    id: 'contexto-sgi', title: 'Contexto del SGI', icon: Compass, route: '/contexto-sgi',
    group: 'Contexto estratégico',
    purpose: 'Análisis estratégico, partes interesadas y mapa de procesos (ISO §4).',
    tabs: [
      { key: 'contexto', label: 'Contexto / FODA' },
      { key: 'partes', label: 'Partes Interesadas' },
      { key: 'mapa', label: 'Mapa de Procesos' },
    ],
    mainFeatures: ['Análisis FODA', 'Cuestiones internas y externas', 'Matriz de partes interesadas', 'Mapa de procesos'],
    actions: [
      { name: 'FODA', description: 'Pestaña Contexto / FODA: documentá fortalezas, oportunidades, debilidades y amenazas.', detail: 'Base del contexto organizacional.' },
      { name: 'Partes interesadas', description: 'Pestaña Partes: registrá partes con sus necesidades y expectativas.', detail: 'ISO §4.2.' },
      { name: 'Mapa de procesos', description: 'Pestaña Mapa: definí los procesos del SGI y sus relaciones.', detail: 'ISO §4.4.' },
    ],
    steps: [
      { title: 'Definir el contexto', description: 'Pestaña Contexto / FODA.', subSteps: ['Completá el análisis FODA', 'Registrá cuestiones internas y externas'] },
      { title: 'Mapear partes y procesos', description: 'Pestañas Partes y Mapa.', subSteps: ['Cargá partes interesadas', 'Definí el mapa de procesos'] },
    ],
    screenshots: [
      { label: 'Contexto / FODA', caption: 'Análisis estratégico', route: '/contexto-sgi' },
      { label: 'Partes Interesadas', caption: 'Matriz de partes interesadas', route: '/contexto-sgi?tab=partes' },
      { label: 'Mapa de Procesos', caption: 'Procesos del SGI', route: '/contexto-sgi?tab=mapa' },
    ],
    related: ['objetivos', 'seguridad'],
    tips: ['Revisá el contexto al menos una vez al año.'],
    difficulty: 'Medio', estimatedTime: '45 minutos', isoRef: 'ISO 9001 §4',
  },
  {
    id: 'objetivos', title: 'Objetivos SGI', icon: Target, route: '/objetivos',
    group: 'Contexto estratégico',
    purpose: 'Definición, planificación y seguimiento de los objetivos del sistema de gestión.',
    mainFeatures: ['Objetivos SMART', 'Planes de acción asociados', 'Vinculación con indicadores', 'Seguimiento de avance'],
    actions: [
      { name: 'Nuevo objetivo', description: 'Definí un objetivo medible.', detail: 'Asigná responsable y plazo.' },
      { name: 'Plan de acción', description: 'Agregá acciones para alcanzar el objetivo.', detail: 'Con responsables y fechas.' },
    ],
    steps: [
      { title: 'Crear un objetivo', description: 'Botón "Nuevo objetivo".', subSteps: ['Redactá el objetivo en formato SMART', 'Vinculá indicadores', 'Asigná responsable'] },
    ],
    screenshots: [{ label: 'Objetivos SGI', caption: 'Objetivos y planes de acción', route: '/objetivos' }],
    related: ['politicas', 'indicadores', 'contexto-sgi'],
    tips: ['Vinculá cada objetivo a un indicador para medir su cumplimiento.'],
    difficulty: 'Medio', estimatedTime: '20 minutos', isoRef: 'ISO 9001 §6.2',
  },
  {
    id: 'politicas', title: 'Políticas SGI', icon: ScrollText, route: '/objetivos/politicas',
    group: 'Contexto estratégico',
    purpose: 'Políticas del sistema integrado de gestión (calidad, ambiente, seguridad).',
    mainFeatures: ['Redacción de políticas', 'Versionado', 'Difusión y comunicación'],
    actions: [
      { name: 'Editar política', description: 'Redactá o actualizá la política del SGI.', detail: 'Debe alinearse con el contexto y los objetivos.' },
    ],
    steps: [
      { title: 'Definir la política', description: 'Editá el contenido de la política.', subSteps: ['Alineá con contexto y objetivos', 'Guardá y comunicá'] },
    ],
    screenshots: [{ label: 'Políticas SGI', caption: 'Política integrada de gestión', route: '/objetivos/politicas' }],
    related: ['objetivos', 'contexto-sgi'],
    tips: ['La política debe ser coherente con el contexto de la organización.'],
    difficulty: 'Fácil', estimatedTime: '15 minutos', isoRef: 'ISO 9001 §5.2',
  },

  /* ───────── 5. Calidad y mejora continua ───────── */
  {
    id: 'calidad', title: 'Calidad / Mejora Continua', icon: ClipboardCheck, route: '/calidad',
    group: 'Calidad',
    purpose: 'No conformidades, incidentes, acciones CAPA y gestión de cambios (ISO §8, §10).',
    tabs: [
      { key: 'nc', label: 'No Conformidades' },
      { key: 'incidentes', label: 'Incidentes / Accidentes' },
      { key: 'acciones', label: 'Acciones CAPA' },
      { key: 'cambios', label: 'Gestión de Cambios' },
    ],
    mainFeatures: ['No conformidades con causa raíz', 'Incidentes y accidentes', 'Acciones correctivas/preventivas (CAPA)', 'Gestión de cambios'],
    actions: [
      { name: 'Nueva NC', description: 'Pestaña No Conformidades → registrá la NC con descripción y severidad.', detail: 'Documentá causa raíz y plan de acción.' },
      { name: 'Incidente / Accidente', description: 'Pestaña Incidentes → registrá el evento e investigación.', detail: 'Vinculable a acciones.' },
      { name: 'Acción CAPA', description: 'Pestaña Acciones CAPA → seguí acciones correctivas y preventivas.', detail: 'Con responsable, plazo y verificación de eficacia.' },
      { name: 'Gestión de cambios', description: 'Pestaña Gestión de Cambios → controlá cambios planificados.', detail: 'Evaluación de impacto y aprobación.' },
    ],
    steps: [
      { title: 'Registrar una NC', description: 'Pestaña No Conformidades → "Nueva".', subSteps: ['Describí la NC objetivamente', 'Clasificá severidad', 'Documentá causa raíz', 'Definí acciones'] },
      { title: 'Hacer seguimiento CAPA', description: 'Pestaña Acciones CAPA.', subSteps: ['Asigná responsable y plazo', 'Verificá eficacia antes de cerrar'] },
    ],
    screenshots: [
      { label: 'No Conformidades', caption: 'Listado y tratamiento de NC', route: '/calidad' },
      { label: 'Incidentes / Accidentes', caption: 'Registro de incidentes', route: '/calidad?tab=incidentes' },
      { label: 'Acciones CAPA', caption: 'Acciones correctivas/preventivas', route: '/calidad?tab=acciones' },
      { label: 'Gestión de Cambios', caption: 'Control de cambios', route: '/calidad?tab=cambios' },
    ],
    related: ['auditoria', 'seguridad', 'indicadores'],
    tips: ['Sin análisis de causa raíz, las NC se repiten.', 'Verificá la eficacia antes de cerrar una acción.'],
    difficulty: 'Avanzado', estimatedTime: '1-2 horas', isoRef: 'ISO 9001 §10.2',
  },
  {
    id: 'auditoria', title: 'Auditorías', icon: BrainCircuit, route: '/auditoria',
    group: 'Calidad',
    purpose: 'Análisis de cumplimiento con IA y gestión de auditorías internas ISO.',
    tabs: [
      { key: 'ia', label: 'Auditoría IA' },
      { key: 'iso', label: 'Auditorías ISO' },
    ],
    mainFeatures: ['Análisis automático documento vs norma', 'Hallazgos con evidencia textual', 'Conversión de hallazgos a No Conformidades', 'Programa de auditorías internas'],
    actions: [
      { name: 'Analizar con IA', description: 'Pestaña Auditoría IA → seleccioná documento y norma para analizarlos.', detail: 'Requiere que el documento tenga normativas vinculadas.' },
      { name: 'Convertir a NC', description: 'Transformá un hallazgo en No Conformidad formal.', detail: 'Pasa a Calidad → No Conformidades.' },
      { name: 'Auditoría ISO', description: 'Pestaña Auditorías ISO → planificá y ejecutá auditorías internas.', detail: 'Checklist, hallazgos e informe final.' },
    ],
    steps: [
      { title: 'Ejecutar Auditoría IA', description: 'Pestaña Auditoría IA.', subSteps: ['Vinculá normativas al documento (en Documentos)', 'Seleccioná documento y norma', 'Iniciá el análisis', 'Revisá hallazgos y evidencia'] },
      { title: 'Planificar Auditoría ISO', description: 'Pestaña Auditorías ISO → "Nueva".', subSteps: ['Definí alcance, norma y equipo', 'Ejecutá el checklist', 'Registrá hallazgos y generá informe'] },
    ],
    screenshots: [
      { label: 'Auditoría IA', caption: 'Análisis de cumplimiento con IA', route: '/auditoria' },
      { label: 'Auditorías ISO', caption: 'Programa de auditorías internas', route: '/auditoria?tab=iso' },
    ],
    related: ['documents', 'cumplimiento', 'calidad'],
    tips: ['Vinculá solo las cláusulas aplicables para mejorar el análisis IA.', 'Los hallazgos con baja confianza revisalos manualmente.'],
    difficulty: 'Avanzado', estimatedTime: '30 minutos', isoRef: 'ISO 19011',
  },
  {
    id: 'revision-direccion', title: 'Revisión por la Dirección', icon: FileBarChart, route: '/revision-direccion',
    group: 'Calidad',
    purpose: 'Revisiones por la dirección y análisis del desempeño del SGI (ISO §9.3).',
    mainFeatures: ['Informe de revisión por la dirección', 'Entradas y salidas requeridas', 'Decisiones y acciones', 'Histórico de revisiones'],
    actions: [
      { name: 'Nueva revisión', description: 'Generá un informe de revisión por la dirección.', detail: 'Consolida entradas de todos los módulos.' },
    ],
    steps: [
      { title: 'Preparar la revisión', description: 'Botón "Nuevo Informe".', subSteps: ['Reuní las entradas requeridas (indicadores, NC, auditorías)', 'Documentá decisiones y acciones'] },
    ],
    screenshots: [{ label: 'Revisión por la Dirección', caption: 'Informe de revisión', route: '/revision-direccion' }],
    related: ['indicadores', 'auditoria', 'reportes'],
    tips: ['Realizá la revisión al menos una vez al año.'],
    difficulty: 'Avanzado', estimatedTime: '2 horas', isoRef: 'ISO 9001 §9.3',
  },
  /* ───────── 6. Seguridad & Ambiente ───────── */
  {
    id: 'seguridad', title: 'Seguridad & Ambiente', icon: Shield, route: '/seguridad',
    group: 'Seguridad & Ambiente',
    purpose: 'Riesgos, peligros SST (IPERC), aspectos ambientales y simulacros (ISO 14001 / 45001).',
    tabs: [
      { key: 'riesgos', label: 'Riesgos' },
      { key: 'iperc', label: 'IPERC — Peligros SST' },
      { key: 'ambientales', label: 'Aspectos Ambientales' },
      { key: 'simulacros', label: 'Simulacros' },
    ],
    mainFeatures: ['Matriz de riesgos', 'IPERC: identificación de peligros y evaluación de riesgos', 'Aspectos e impactos ambientales', 'Programa de simulacros'],
    actions: [
      { name: 'Nuevo riesgo', description: 'Pestaña Riesgos → identificá y evaluá un riesgo.', detail: 'Probabilidad × impacto y controles.' },
      { name: 'IPERC', description: 'Pestaña IPERC → evaluá peligros por puesto/tarea.', detail: 'Medidas de control SST.' },
      { name: 'Aspecto ambiental', description: 'Pestaña Aspectos Ambientales → registrá aspectos e impactos.', detail: 'Evaluación de significancia.' },
      { name: 'Simulacro', description: 'Pestaña Simulacros → planificá y evaluá simulacros.', detail: 'Registro de participantes y resultados.' },
    ],
    steps: [
      { title: 'Evaluar un riesgo', description: 'Pestaña Riesgos → "Nuevo".', subSteps: ['Describí el riesgo y el proceso', 'Evaluá probabilidad e impacto', 'Definí controles'] },
      { title: 'Cargar IPERC', description: 'Pestaña IPERC.', subSteps: ['Seleccioná puesto/tarea', 'Identificá peligros', 'Definí medidas de control'] },
    ],
    screenshots: [
      { label: 'Riesgos', caption: 'Matriz de riesgos', route: '/seguridad' },
      { label: 'IPERC', caption: 'Peligros SST por puesto', route: '/seguridad?tab=iperc' },
      { label: 'Aspectos Ambientales', caption: 'Aspectos e impactos', route: '/seguridad?tab=ambientales' },
      { label: 'Simulacros', caption: 'Programa de simulacros', route: '/seguridad?tab=simulacros' },
    ],
    related: ['calidad', 'indicadores', 'contexto-sgi'],
    tips: ['Actualizá la evaluación ante cambios de proceso.', 'Vinculá riesgos críticos a planes de acción.'],
    difficulty: 'Medio', estimatedTime: '45 minutos', isoRef: 'ISO 45001 / 14001',
  },
  {
    id: 'indicadores', title: 'Indicadores', icon: TrendingUp, route: '/indicadores',
    group: 'Seguridad & Ambiente',
    purpose: 'Indicadores y KPIs de desempeño del SGI con tendencias y metas.',
    mainFeatures: ['Biblioteca de indicadores', 'Mediciones periódicas', 'Gráficos de tendencia', 'Alertas por desvío'],
    actions: [
      { name: 'Nuevo indicador', description: 'Definí nombre, fórmula, meta y frecuencia.', detail: 'Asigná responsable.' },
      { name: 'Cargar medición', description: 'Registrá el valor del período.', detail: 'Compará contra la meta.' },
    ],
    steps: [
      { title: 'Definir un indicador', description: 'Botón "Nuevo".', subSteps: ['Nombre, fórmula, meta y frecuencia', 'Asigná responsable'] },
      { title: 'Cargar mediciones', description: 'En el indicador.', subSteps: ['Ingresá el valor del período', 'Revisá la tendencia'] },
    ],
    screenshots: [{ label: 'Indicadores', caption: 'KPIs y tendencias', route: '/indicadores' }],
    related: ['objetivos', 'revision-direccion', 'reportes'],
    tips: ['KPIs SMART; evitá más de 10 por proceso.'],
    difficulty: 'Medio', estimatedTime: '20 minutos', isoRef: 'ISO 9001 §9.1',
  },

  /* ───────── 7. Proyectos y acciones ───────── */
  {
    id: 'proyectos', title: 'Proyectos', icon: BarChart3, route: '/project360',
    group: 'Proyectos',
    purpose: 'Gestión de proyectos, tareas, hitos y portafolio (PMO).',
    mainFeatures: ['Proyectos y portafolio', 'Tableros con tareas', 'Responsables y fechas', 'Adjuntos y seguimiento'],
    actions: [
      { name: 'Nuevo proyecto', description: 'Creá un proyecto con responsable y fechas.', detail: 'Vinculable a objetivos del SGI.' },
      { name: 'Gestionar tareas', description: 'Agregá tareas y seguí su avance.', detail: 'Tablero por estados.' },
    ],
    steps: [
      { title: 'Crear un proyecto', description: 'Botón "Nuevo".', subSteps: ['Nombre, responsable y fechas', 'Agregá tareas'] },
    ],
    screenshots: [{ label: 'Proyectos', caption: 'Gestión de proyectos', route: '/project360' }],
    related: ['objetivos', 'calendario', 'indicadores'],
    tips: ['Vinculá proyectos a objetivos para trazabilidad.'],
    difficulty: 'Medio', estimatedTime: '20 minutos', isoRef: 'ISO 9001 §6.2',
  },
  {
    id: 'calendario', title: 'Calendario', icon: CalendarDays, route: '/calendario',
    group: 'Proyectos',
    purpose: 'Calendario de actividades, vencimientos y eventos programados del SGI.',
    mainFeatures: ['Vista mensual / semanal', 'Eventos de todos los módulos', 'Vencimientos y recordatorios'],
    actions: [
      { name: 'Ver eventos', description: 'Navegá por fechas y filtrá por tipo.', detail: 'Cliqueá un evento para ir a su origen.' },
    ],
    steps: [
      { title: 'Consultar el calendario', description: 'Navegá por fechas.', subSteps: ['Filtrá por tipo de evento', 'Cliqueá para ver el detalle'] },
    ],
    screenshots: [{ label: 'Calendario', caption: 'Actividades y vencimientos', route: '/calendario' }],
    related: ['proyectos', 'capacitaciones', 'auditoria'],
    tips: ['Usalo para anticipar vencimientos y auditorías.'],
    difficulty: 'Fácil', estimatedTime: '5 minutos',
  },

  /* ───────── 8. Infraestructura ───────── */
  {
    id: 'infraestructura', title: 'Infraestructura', icon: Package, route: '/infraestructura',
    group: 'Infraestructura',
    purpose: 'Gestión de activos, mantenimiento, calibraciones e inspecciones inteligentes por QR (ISO §7.1).',
    tabs: [
      { key: 'mantenimiento', label: 'Mantenimiento' },
      { key: 'calibraciones', label: 'Calibraciones' },
      { key: 'inspecciones', label: 'Inspecciones Inteligentes' },
    ],
    mainFeatures: ['Plan de mantenimiento y órdenes de trabajo', 'Programa de calibración de equipos', 'Inspecciones inteligentes por QR', 'Historial por activo'],
    actions: [
      { name: 'Mantenimiento', description: 'Pestaña Mantenimiento → creá órdenes preventivas o correctivas.', detail: 'Asigná técnico y activo.' },
      { name: 'Calibraciones', description: 'Pestaña Calibraciones → registrá equipos y su programa.', detail: 'Frecuencia y certificados.' },
      { name: 'Inspecciones', description: 'Pestaña Inspecciones Inteligentes → inspecciones por QR.', detail: 'Checklist y evidencia en campo.' },
    ],
    steps: [
      { title: 'Crear una orden de mantenimiento', description: 'Pestaña Mantenimiento.', subSteps: ['Seleccioná activo y tipo', 'Asigná técnico y fecha'] },
      { title: 'Programar calibración', description: 'Pestaña Calibraciones.', subSteps: ['Registrá el equipo', 'Definí la frecuencia'] },
    ],
    screenshots: [
      { label: 'Mantenimiento', caption: 'Órdenes y plan de mantenimiento', route: '/infraestructura' },
      { label: 'Calibraciones', caption: 'Equipos y programa de calibración', route: '/infraestructura?tab=calibraciones' },
      { label: 'Inspecciones Inteligentes', caption: 'Inspecciones por QR', route: '/infraestructura?tab=inspecciones' },
    ],
    related: ['indicadores', 'seguridad'],
    tips: ['Priorizá el mantenimiento preventivo.', 'No operés equipos de medición con calibración vencida.'],
    difficulty: 'Medio', estimatedTime: '20 minutos', isoRef: 'ISO 9001 §7.1',
  },

  /* ───────── 9. Administración y otros ───────── */
  {
    id: 'reportes', title: 'Reportes', icon: FileSpreadsheet, route: '/reportes',
    group: 'Administración',
    purpose: 'Generación, exportación y descarga de reportes del sistema.',
    mainFeatures: ['Reportes por módulo', 'Exportación a PDF/Excel', 'Informe para la dirección'],
    actions: [
      { name: 'Generar reporte', description: 'Seleccioná el tipo de reporte y aplicá filtros.', detail: 'Descargá en PDF o Excel.' },
    ],
    steps: [
      { title: 'Generar un reporte', description: 'Elegí el reporte.', subSteps: ['Aplicá filtros y período', 'Exportá'] },
    ],
    screenshots: [{ label: 'Reportes', caption: 'Generación de reportes', route: '/reportes' }],
    related: ['indicadores', 'revision-direccion'],
    tips: ['Usá los reportes como evidencia en auditorías.'],
    difficulty: 'Fácil', estimatedTime: '5 minutos',
  },
  {
    id: 'clima', title: 'Clima y Cultura', icon: Wind, route: '/clima',
    group: 'Personas',
    purpose: 'Encuestas de clima, sugerencias, análisis de sentimiento y planes de acción.',
    mainFeatures: ['Encuestas de clima', 'Buzón de sugerencias', 'Análisis de sentimiento', 'Planes de acción'],
    actions: [
      { name: 'Nueva encuesta', description: 'Creá y publicá una encuesta de clima.', detail: 'Resultados anónimos.' },
      { name: 'Plan de acción', description: 'Definí acciones a partir de los resultados.', detail: 'Seguimiento del impacto.' },
    ],
    steps: [
      { title: 'Lanzar una encuesta', description: 'Botón "Nueva encuesta".', subSteps: ['Definí preguntas', 'Publicá y recolectá respuestas'] },
    ],
    screenshots: [{ label: 'Clima y Cultura', caption: 'Encuestas y análisis de clima', route: '/clima' }],
    related: ['rrhh', 'indicadores'],
    tips: ['Anonimizá las encuestas de clima para mayor sinceridad.'],
    difficulty: 'Fácil', estimatedTime: '15 minutos',
  },
  {
    id: 'configuracion', title: 'Configuración', icon: Settings, route: '/configuracion',
    group: 'Administración',
    purpose: 'Gestión de usuarios, plan y datos de tu organización.',
    mainFeatures: ['Gestión de usuarios y roles', 'Plan y suscripción', 'Datos de la organización'],
    actions: [
      { name: 'Usuarios', description: 'Creá, editá o desactivá usuarios.', detail: 'Asigná roles y permisos.' },
      { name: 'Plan', description: 'Consultá y gestioná el plan contratado.', detail: 'Define los módulos disponibles.' },
    ],
    steps: [
      { title: 'Gestionar usuarios', description: 'Sección Usuarios.', subSteps: ['Invitá usuarios', 'Asigná roles'] },
    ],
    screenshots: [{ label: 'Configuración', caption: 'Usuarios, plan y organización', route: '/configuracion' }],
    related: ['configuracion-empresa', 'notificaciones'],
    tips: ['Asigná el rol mínimo necesario a cada usuario.'],
    difficulty: 'Medio', estimatedTime: '15 minutos',
  },
  {
    id: 'configuracion-empresa', title: 'Configuración de la empresa', icon: Building2, route: '/configuracion/empresa',
    group: 'Administración',
    purpose: 'Datos de la empresa, logo, firma y ajustes generales del tenant.',
    mainFeatures: ['Datos fiscales y de contacto', 'Logo y firma', 'Ajustes generales'],
    actions: [
      { name: 'Editar empresa', description: 'Actualizá los datos de la organización.', detail: 'Logo, dirección y datos fiscales.' },
    ],
    steps: [
      { title: 'Configurar la empresa', description: 'Completá los datos.', subSteps: ['Subí el logo', 'Guardá'] },
    ],
    screenshots: [{ label: 'Configuración de la empresa', caption: 'Datos del tenant', route: '/configuracion/empresa' }],
    related: ['configuracion'],
    tips: ['Mantené los datos fiscales correctos para los reportes.'],
    difficulty: 'Fácil', estimatedTime: '10 minutos',
  },
  {
    id: 'notificaciones', title: 'Notificaciones', icon: Bell, route: '/notificaciones',
    group: 'Administración',
    purpose: 'Centro de notificaciones y avisos del sistema.',
    mainFeatures: ['Bandeja de notificaciones', 'Avisos por módulo', 'Acceso directo al origen'],
    actions: [
      { name: 'Revisar notificaciones', description: 'Consultá los avisos pendientes.', detail: 'Cliqueá para ir al módulo de origen.' },
    ],
    steps: [
      { title: 'Consultar notificaciones', description: 'Abrí la bandeja.', subSteps: ['Cliqueá un aviso para ir a su origen'] },
    ],
    screenshots: [{ label: 'Notificaciones', caption: 'Bandeja de notificaciones', route: '/notificaciones' }],
    related: ['dashboard', 'configuracion'],
    tips: ['No ignores los avisos de vencimiento.'],
    difficulty: 'Fácil', estimatedTime: '2 minutos',
  },
  {
    id: 'modo-de-uso', title: 'Centro de Ayuda', icon: HelpCircle, route: '/modo-de-uso',
    group: 'Administración',
    purpose: 'Guías, tutoriales y asistente para aprender a usar SGI 360 módulo por módulo.',
    mainFeatures: ['Guías por módulo con pasos', 'Capturas reales de cada pantalla', 'Buscador global', 'Acceso directo a cada módulo'],
    actions: [
      { name: 'Buscar', description: 'Usá el buscador para encontrar un módulo o función.', detail: 'Filtra guías por título, función o paso.' },
      { name: 'Abrir esta pantalla', description: 'Abrí el módulo real desde la guía.', detail: 'Te lleva directo a la pantalla descrita.' },
    ],
    steps: [
      { title: 'Buscar ayuda', description: 'Escribí en el buscador.', subSteps: ['Seleccioná el módulo en la lista', 'Leé Información, Pasos y Capturas'] },
    ],
    screenshots: [{ label: 'Centro de Ayuda', caption: 'Guías y capturas por módulo', route: '/modo-de-uso' }],
    related: ['dashboard', 'command-center'],
    tips: ['Volvé acá cada vez que tengas una duda sobre cómo usar un módulo.'],
    difficulty: 'Fácil', estimatedTime: '2 minutos',
  },
];
