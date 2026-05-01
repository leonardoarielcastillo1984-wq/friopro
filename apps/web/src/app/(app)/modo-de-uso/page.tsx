'use client';

import { useState, useMemo } from 'react';
import {
  Search, BookOpen, LayoutDashboard, BarChart3, FileText,
  BrainCircuit, AlertTriangle, Shield, TrendingUp, GraduationCap,
  ClipboardCheck, Users, Headphones, CreditCard, FileBarChart, Settings,
  Bell, Puzzle, Play, ChevronRight, Sparkles, ArrowRight, Calendar,
  ChevronDown, ChevronUp, Lightbulb, ListChecks, AlertOctagon,
  ExternalLink, Info, Target, Compass, Eye,
  Package, Wrench, Truck, Gauge, Lock, MessageCircle,
} from 'lucide-react';

/* ───────── TIPOS ───────── */
interface GuideAction { name: string; description: string; detail?: string; }
interface GuideStep { title: string; description: string; subSteps?: string[]; }
interface Screenshot { label: string; caption: string; instruction: string; placeholder: string; }
interface ModuleGuide {
  id: string; title: string; icon: any; purpose: string;
  mainFeatures: string[]; actions: GuideAction[]; steps: GuideStep[];
  screenshots: Screenshot[]; related: string[]; tips: string[];
  isoRef?: string; difficulty?: 'Facil' | 'Medio' | 'Avanzado'; estimatedTime?: string;
}

const difficultyConfig: Record<string, { color: string; bg: string; border: string }> = {
  Facil: { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  Medio: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  Avanzado: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
};

/* ───────── GUÍAS INICIALES ───────── */
const guides: ModuleGuide[] = [
  {
    id: 'inicio', title: 'Inicio / Dashboard', icon: LayoutDashboard,
    purpose: 'Pantalla principal con vista ejecutiva del SGI: métricas clave, alertas y accesos rápidos a módulos.',
    mainFeatures: ['Tarjetas de métricas resumen con tendencias', 'Gráficos de evolución por período', 'Accesos directos personalizados', 'Panel de alertas inteligentes'],
    actions: [
      { name: 'Tarjetas de métricas', description: 'Cliqueá cualquier tarjeta para ir al módulo.', detail: 'Muestran conteo actual e indicador de tendencia (subida/bajada).' },
      { name: 'Filtros de período', description: 'Cambiá el rango de fechas del resumen.', detail: 'Soporta semana, mes, trimestre y año.' },
      { name: 'Accesos directos', description: 'Navegación rápida sin abrir el menú lateral.', detail: 'Se personalizan automáticamente según frecuencia de uso.' },
    ],
    steps: [
      { title: 'Acceder al Dashboard', description: 'Iniciá sesión. El Dashboard carga automáticamente.', subSteps: ['Ingresá email y contraseña', 'Sistema redirige a /dashboard'] },
      { title: 'Interpretar métricas', description: 'Observá las tarjetas de colores.', subSteps: ['Verde = todo en orden', 'Amarillo = atención requerida', 'Rojo = acción urgente pendiente'] },
      { title: 'Navegar por módulo', description: 'Cliqueá cualquier tarjeta para ir al detalle.', subSteps: ['Ej: clic en Documentos abre la lista completa', 'Ej: clic en Hallazgos IA abre la auditoría inteligente'] },
      { title: 'Revisar alertas', description: 'Bajá hasta "Alertas activas".', subSteps: ['Alertas: vencimientos de documentos, capacitaciones pendientes, auditorías programadas'] },
    ],
    screenshots: [
      { label: 'Dashboard principal', caption: 'Vista general con métricas y alertas', instruction: 'Capturar /dashboard mostrando tarjetas de métricas', placeholder: '[Capturar /dashboard con métricas visibles]' },
      { label: 'Selector de período', caption: 'Filtro de fechas', instruction: 'Capturar selector de fechas abierto', placeholder: '[Capturar selector de período]' },
      { label: 'Panel de alertas', caption: 'Alertas activas', instruction: 'Capturar sección de alertas con al menos 2 visibles', placeholder: '[Capturar panel de alertas]' },
    ],
    related: ['panel', 'notificaciones', 'reportes'],
    tips: ['Usalo cada mañana como reunión de pie ejecutiva: 5 minutos.', 'Configurá el período por defecto según tu ciclo de gestión.', 'Las alertas se actualizan en tiempo real.'],
    difficulty: 'Facil', estimatedTime: '5 minutos',
  },
  {
    id: 'panel', title: 'Panel General', icon: BarChart3,
    purpose: 'Panel extendido con KPIs agregados por área. Ideal para reuniones de revisión por la dirección.',
    mainFeatures: ['KPIs por módulo (calidad, SST, ambiente, RRHH)', 'Comparativas período actual vs anterior', 'Alertas de desvíos críticos', 'Exportación a PDF'],
    actions: [
      { name: 'Exportar a PDF', description: 'Genera informe ejecutivo descargable.', detail: 'Incluye gráficos, tablas y resumen ejecutivo automático.' },
      { name: 'Cambiar período', description: 'Ajustá rango de análisis de KPIs.', detail: 'Soporta comparación año-a-año, mes-a-mes, trimestral.' },
      { name: 'Configurar alertas', description: 'Definí umbrales de desvío.', detail: 'Umbrales porcentuales o valores absolutos por indicador.' },
    ],
    steps: [
      { title: 'Acceder al Panel', description: 'Sidebar → "Panel General".', subSteps: ['El panel carga todos los KPIs activos por defecto'] },
      { title: 'Seleccionar módulos', description: 'Usá tabs superiores para filtrar por área.', subSteps: ['Tabs: Calidad, SST, Ambiente, RRHH, General'] },
      { title: 'Configurar período', description: 'Abrí selector de fechas.', subSteps: ['Elegí período actual y de comparación', 'Ej: Enero 2024 vs Enero 2023'] },
      { title: 'Exportar informe', description: 'Clic en "Exportar PDF".', subSteps: ['PDF generado con KPIs visibles', 'Descarga automática'] },
    ],
    screenshots: [
      { label: 'Panel de KPIs', caption: 'Vista general con gráficos', instruction: 'Capturar /panel mostrando gráficos', placeholder: '[Capturar Panel General]' },
      { label: 'Selector de módulos', caption: 'Tabs de filtrado por área', instruction: 'Capturar tabs de Calidad, SST, Ambiente, RRHH', placeholder: '[Capturar tabs de módulos]' },
      { label: 'Exportación PDF', caption: 'Botón de exportación', instruction: 'Capturar botón Exportar PDF y diálogo', placeholder: '[Capturar exportación PDF]' },
    ],
    related: ['inicio', 'indicadores', 'reportes'],
    tips: ['Revisalo mensualmente como input para Revisión por la Dirección (ISO 9001 §9.3).', 'Los KPIs se calculan automáticamente desde datos de otros módulos.', 'Usá comparativa año-a-año para tendencias a largo plazo.'],
    difficulty: 'Medio', estimatedTime: '15 minutos', isoRef: 'ISO 9001 §9.3',
  },
  {
    id: 'documentos', title: 'Documentos', icon: FileText,
    purpose: 'Repositorio centralizado de documentos del SGI: procedimientos, instructivos, formularios. Gestiona versiones, aprobaciones, vigencias y vinculación normativa.',
    mainFeatures: ['Subida multi-formato (PDF, Word, Excel, imágenes)', 'Control de versiones automático', 'Workflow de aprobación con estados', 'Búsqueda avanzada por código, nombre, tipo', 'Vinculación a cláusulas normativas'],
    actions: [
      { name: 'Subir documento', description: 'Arrastrá archivo o usá botón de subida.', detail: 'El sistema extrae texto automáticamente para búsqueda y auditoría IA.' },
      { name: 'Ver detalle', description: 'Accedé a metadatos, versiones, historial y cláusulas vinculadas.', detail: 'Podés descargar cualquier versión histórica.' },
      { name: 'Nueva versión', description: 'Subí nueva versión manteniendo historial.', detail: 'Notifica automáticamente a usuarios con versión anterior.' },
      { name: 'Vincular cláusulas', description: 'Asociá a cláusulas normativas para auditoría IA.', detail: 'PRE-REQUISITO obligatorio para que la IA analice este documento.' },
      { name: 'Aprobar documento', description: 'Cambiá estado a "Aprobado" tras revisión.', detail: 'Disponible para todo el personal del tenant.' },
    ],
    steps: [
      { title: 'Subir documento', description: 'Clic en "Nuevo documento".', subSteps: ['Arrastrá archivo o seleccionalo', 'Completá código (PRO-CAL-001), título, tipo', 'Seleccioná proceso al que pertenece', 'Asigná responsable de mantenimiento'] },
      { title: 'Vincular cláusulas', description: 'En detalle del documento, sección "Cláusulas normativas".', subSteps: ['Clic "Vincular cláusula"', 'Seleccioná norma (ej: ISO 39001)', 'Marcá cláusulas aplicables (ej: 5.2, 5.3)', 'Confirmá vinculación'] },
      { title: 'Solicitar aprobación', description: 'Cambiá estado a "En revisión".', subSteps: ['Aprobador recibe notificación', 'Revisa y aprueba o rechaza con comentarios', 'Si aprueba, estado pasa a "Aprobado"'] },
      { title: 'Buscar documento', description: 'Usá barra de búsqueda superior.', subSteps: ['Buscá por código, título o contenido', 'Filtrá por tipo, estado o proceso', 'Resultados instantáneos'] },
    ],
    screenshots: [
      { label: 'Listado de documentos', caption: 'Repositorio con estados', instruction: 'Capturar /documents mostrando lista con estados', placeholder: '[Capturar listado de documentos]' },
      { label: 'Subida de archivo', caption: 'Formulario nuevo documento', instruction: 'Capturar formulario nuevo documento completo', placeholder: '[Capturar formulario nuevo documento]' },
      { label: 'Vinculación de cláusulas', caption: 'Panel de cláusulas normativas', instruction: 'Capturar sección de vinculación de un documento', placeholder: '[Capturar vinculación de cláusulas]' },
      { label: 'Historial de versiones', caption: 'Tabla de versiones', instruction: 'Capturar historial de versiones de un documento', placeholder: '[Capturar historial de versiones]' },
    ],
    related: ['normativos', 'audit-ia', 'auditorias-iso'],
    tips: ['Usá código estandarizado (PRO-XXX-NNN) para búsquedas y trazabilidad.', 'Vinculá SIEMPRE cláusulas antes de usar Auditoría IA: sin vinculación no analiza.', 'Documentos obsoletos se mantienen para auditoría pero no aparecen en búsquedas por defecto.'],
    difficulty: 'Facil', estimatedTime: '10 minutos', isoRef: 'ISO 9001 §7.5',
  },
  {
    id: 'normativos', title: 'Normativos', icon: BookOpen,
    purpose: 'Biblioteca central de normas, leyes, decretos aplicables. Referencia de requisitos legales y normativos.',
    mainFeatures: ['Listado de normas con código, título, versión, estado', 'Carga de PDFs oficiales', 'Extracción automática de cláusulas con IA', 'Vinculación con documentos internos'],
    actions: [
      { name: 'Nuevo normativo', description: 'Registrá norma con código, título, versión y PDF.', detail: 'Extracción automática de cláusulas con IA (si está configurada).' },
      { name: 'Ver cláusulas', description: 'Consultá contenido estructurado: cláusulas, subcláusulas.', detail: 'Árbol navegable con número, título y contenido.' },
      { name: 'Vincular documentos', description: 'Asociá documentos internos a cláusulas.', detail: 'Base para análisis de cumplimiento de Auditoría IA.' },
      { name: 'Actualizar versión', description: 'Subí nueva versión manteniendo historial.', detail: 'Detecta cambios y alerta sobre documentos vinculados.' },
    ],
    steps: [
      { title: 'Cargar norma', description: 'Clic "Nueva norma".', subSteps: ['Completá código (ISO 39001:2012), título', 'Seleccioná tipo: ISO, Ley, Decreto, Reglamento', 'Subí PDF oficial', 'Marcá estado: En revisión o Vigente'] },
      { title: 'Extraer cláusulas', description: 'Una vez cargado PDF, iniciá extracción con IA.', subSteps: ['Clic "Extraer cláusulas con IA"', 'Procesa PDF y genera árbol de cláusulas', 'Revisá y corregí si es necesario', 'Marcá "Listo para uso"'] },
      { title: 'Vincular documentos', description: 'Navegá cláusulas y vinculá documentos.', subSteps: ['Seleccioná cláusula', 'Clic "Vincular documento"', 'Buscá documento en repositorio', 'Confirmá con tipo de cumplimiento'] },
      { title: 'Seguimiento de cambios', description: 'Cuando actualicés norma, revisá impacto.', subSteps: ['Subí nueva versión PDF', 'Sistema compara con anterior', 'Revisá cláusulas modificadas, agregadas o eliminadas', 'Actualizá documentos vinculados'] },
    ],
    screenshots: [
      { label: 'Listado de normativos', caption: 'Biblioteca con estados', instruction: 'Capturar /normativos mostrando lista', placeholder: '[Capturar listado de normativos]' },
      { label: 'Árbol de cláusulas', caption: 'Estructura navegable', instruction: 'Capturar árbol de cláusulas de una norma ISO', placeholder: '[Capturar árbol de cláusulas]' },
      { label: 'Vista de cláusula', caption: 'Detalle con documentos vinculados', instruction: 'Capturar detalle de cláusula con 2+ documentos vinculados', placeholder: '[Capturar detalle de cláusula]' },
    ],
    related: ['documentos', 'cumplimiento', 'audit-ia'],
    tips: ['Priorizá normas ISO que certifiqués y leyes sectoriales obligatorias.', 'Extracción IA requiere PDF con texto seleccionable (no escaneado sin OCR).', 'Mantené calendario de revisiones normativas para anticipar cambios.'],
    difficulty: 'Medio', estimatedTime: '30 minutos por norma',
  },
  {
    id: 'audit-ia', title: 'Auditoría IA', icon: BrainCircuit,
    purpose: 'Motor de IA que analiza automáticamente conformidad de documentos contra normas ISO. Detecta brechas con evidencia textual y sugiere acciones concretas.',
    mainFeatures: ['Análisis automático documento vs norma cláusula por cláusula', 'Análisis profundo con citas textuales', 'Hallazgos: Obligatorio (MUST) o Recomendado (SHOULD)', 'Chat con agente IA', 'Conversión directa a No Conformidades'],
    actions: [
      { name: 'Analizar documento', description: 'Seleccioná documento y norma. Analiza solo cláusulas vinculadas.', detail: 'PRE-REQUISITO: documento debe tener cláusulas vinculadas en Documentos.' },
      { name: 'Ver hallazgos', description: 'Revisá hallazgos con descripción, evidencia y confianza.', detail: 'Incluye: cláusula, severidad, descripción fundamentada, evidencia textual, acciones.' },
      { name: 'Convertir a NC', description: 'Transformá hallazgo en No Conformidad formal.', detail: 'Traspasa título, descripción, cláusula y severidad automáticamente.' },
      { name: 'Chat con IA', description: 'Consultá asistente sobre normas y hallazgos.', detail: 'Tiene contexto de tus documentos y normas para respuestas personalizadas.' },
    ],
    steps: [
      { title: 'Preparar documento', description: 'ANTES de auditar, vinculá cláusulas.', subSteps: ['Andá a Documentos', 'Abrí documento a auditar', 'En "Cláusulas normativas", clic "Vincular"', 'Seleccioná norma y marcá cláusulas aplicables', 'Guardá cambios'] },
      { title: 'Ejecutar análisis', description: 'En Auditoría IA, clic "Analizar Documento vs Norma".', subSteps: ['Seleccioná documento del dropdown', 'Seleccioná norma del dropdown', 'Clic "Iniciar Análisis"', 'Sistema encola trabajo y muestra progreso'] },
      { title: 'Revisar hallazgos', description: 'Cuando estado sea "Completado".', subSteps: ['Cada hallazgo muestra: cláusula, severidad, descripción', 'Evidencia cita textualmente del documento', 'Acciones sugeridas son concretas', 'Porcentaje de confianza indica certeza'] },
      { title: 'Convertir a NC', description: 'Para hallazgos que requieren acción formal.', subSteps: ['Clic "Crear NCR" en hallazgo', 'Confirmá conversión', 'Sistema crea NC con datos pre-cargados'] },
      { title: 'Consultar IA', description: 'Usá Chat Auditor para preguntas.', subSteps: ['Andá a "Chat Auditor"', 'Escribí pregunta (ej: "¿Qué requiere cláusula 5.2 ISO 39001?")', 'IA responde con contexto de tus documentos'] },
    ],
    screenshots: [
      { label: 'Pantalla de análisis', caption: 'Formulario para iniciar auditoría', instruction: 'Capturar /audit/analyze mostrando dropdowns', placeholder: '[Capturar pantalla de análisis IA]' },
      { label: 'Progreso', caption: 'Barra con cláusulas procesadas', instruction: 'Capturar progreso durante análisis activo', placeholder: '[Capturar progreso de análisis]' },
      { label: 'Hallazgos', caption: 'Lista con severidad y confianza', instruction: 'Capturar hallazgos completados con 2+ visibles', placeholder: '[Capturar hallazgos generados]' },
      { label: 'Detalle de hallazgo', caption: 'Evidencia y acciones', instruction: 'Capturar detalle mostrando evidencia y acciones', placeholder: '[Capturar detalle de hallazgo]' },
      { label: 'Chat IA', caption: 'Conversación con asistente', instruction: 'Capturar chat auditor con 2+ mensajes', placeholder: '[Capturar chat auditor]' },
    ],
    related: ['documentos', 'normativos', 'no-conformidades', 'auditorias-iso'],
    tips: ['Calidad del análisis depende de la calidad de la vinculación: vinculá solo cláusulas aplicables.', '5-10 cláusulas tarda segundos; 50+ tarda minutos.', 'Hallazgos con confianza <70% revisarlos manualmente.', 'Chat Auditor para profundizar: "¿Por qué este hallazgo es MUST?"', 'NO reemplaza auditoría interna humana: es herramienta de preparación.'],
    difficulty: 'Medio', estimatedTime: '15 minutos (más vinculación)', isoRef: 'ISO 19011',
  },
  {
    id: 'auditorias-iso', title: 'Auditorías ISO', icon: ClipboardCheck,
    purpose: 'Gestión completa del programa de auditorías internas conforme ISO 19011: planificación anual, ejecución con checklist, hallazgos, seguimiento e informes.',
    mainFeatures: ['Programa anual con asignación de auditores', 'Checklist personalizables por norma', 'Registro de hallazgos (NC, observaciones, oportunidades)', 'Gestión de equipo auditor', 'Informe final exportable'],
    actions: [
      { name: 'Nueva auditoría', description: 'Creá con alcance, norma, fecha, lugar y equipo.', detail: 'Podés crear internas, externas o de seguimiento.' },
      { name: 'Ejecutar checklist', description: 'Completá cada ítem con evidencia.', detail: 'Checklist desde plantillas normativas o personalizadas.' },
      { name: 'Registrar hallazgos', description: 'Agregá con clasificación y evidencia.', detail: 'Vinculación automática a cláusula normativa.' },
      { name: 'Gestionar equipo', description: 'Asigná auditores con roles y competencias.', detail: 'Verifica competencias requeridas según ISO 19011.' },
      { name: 'Generar informe', description: 'Exportá informe final con conclusiones.', detail: 'Portada, resumen, detalle de hallazgos, anexos, plan de acción.' },
    ],
    steps: [
      { title: 'Planificar auditoría', description: 'Clic "Nueva auditoría".', subSteps: ['Definí alcance (ej: "Proceso de producción")', 'Seleccioná norma', 'Asigná fecha y duración', 'Designá auditor líder y equipo', 'Agregá objetivos específicos'] },
      { title: 'Preparar checklist', description: 'Seleccioná o creá checklist.', subSteps: ['Elegí plantilla base', 'Personalizá agregando ítems específicos', 'Asigná peso o criticidad', 'Revisá con equipo'] },
      { title: 'Ejecutar auditoría', description: 'Completá checklist y registrá hallazgos.', subSteps: ['Para cada ítem: Conforme / No conforme / No aplica', 'Adjuntá evidencia (fotos, documentos)', 'Registrá hallazgos inmediatamente', 'Tomá notas de campo'] },
      { title: 'Cerrar hallazgos', description: 'Gestioná NC generadas.', subSteps: ['NC creadas automáticamente desde hallazgos', 'Asigná responsables y plazos', 'Verificá eficacia', 'Cerrá NC resuelta'] },
      { title: 'Generar informe', description: 'Una vez cerrados hallazgos.', subSteps: ['Revisá borrador automático', 'Agregá conclusiones del equipo', 'Exportá a PDF', 'Distribuí a dirección y áreas'] },
    ],
    screenshots: [
      { label: 'Programa anual', caption: 'Calendario de auditorías', instruction: 'Capturar /auditorias mostrando programa', placeholder: '[Capturar programa de auditorías]' },
      { label: 'Nueva auditoría', caption: 'Formulario de planificación', instruction: 'Capturar formulario de nueva auditoría', placeholder: '[Capturar formulario nueva auditoría]' },
      { label: 'Checklist', caption: 'Ejecución con ítems y evidencia', instruction: 'Capturar checklist en ejecución con 5+ ítems', placeholder: '[Capturar checklist en ejecución]' },
      { label: 'Hallazgo', caption: 'Formulario de registro', instruction: 'Capturar formulario de registro de hallazgo', placeholder: '[Capturar registro de hallazgo]' },
      { label: 'Informe final', caption: 'Vista previa exportable', instruction: 'Capturar vista previa de informe', placeholder: '[Capturar informe final]' },
    ],
    related: ['audit-ia', 'no-conformidades', 'acciones'],
    tips: ['Planificá con 2 semanas de anticipación.', 'Auditores internos NO auditan su propia área (ISO 19011 §4 e).', 'Guardá evidencia fotográfica de cada hallazgo.', 'Frecuencia basada en resultados previos, cambios críticos y riesgos.'],
    difficulty: 'Avanzado', estimatedTime: '2-4 horas por auditoría', isoRef: 'ISO 19011:2018',
  },
  {
    id: 'no-conformidades', title: 'No Conformidades', icon: AlertTriangle,
    purpose: 'Registro y tratamiento formal de NC. Incluye análisis de causa raíz, acciones correctivas y verificación de eficacia.',
    mainFeatures: ['Listado con estados: Abierta, En tratamiento, En verificación, Cerrada', 'Análisis de causa raíz: 5 Porqués, Ishikawa', 'Plan de acción con responsables y plazos', 'Verificación de eficacia con evidencia', 'Origen configurable'],
    actions: [
      { name: 'Nueva NC', description: 'Creá con descripción, origen, severidad, responsable.', detail: 'Descripción objetiva: ej "Falta registro" no "Operario descuidado".' },
      { name: 'Análisis causa raíz', description: 'Documentá análisis sistemático.', detail: 'Guía con 5 Porqués, Ishikawa.' },
      { name: 'Acciones correctivas', description: 'Definí acciones que eliminen causa.', detail: 'Diferenciá correctiva de inmediata (contención).' },
      { name: 'Verificar eficacia', description: 'Confirmá que la acción funcionó.', detail: 'Requiere evidencia de no repetición.' },
      { name: 'Cerrar NC', description: 'Marcá como cerrada tras verificación.', detail: 'Solo autorizados. Genera registro audit trail.' },
    ],
    steps: [
      { title: 'Detectar NC', description: 'En auditoría, inspección o reclamo.', subSteps: ['Describí evidencia objetivamente', 'Clasificá severidad: Crítica, Mayor, Menor, Observación', 'Asigná responsable'] },
      { title: 'Análisis causa raíz', description: 'Usá metodología estructurada.', subSteps: ['5 Porqués: preguntá "¿por qué?" 5 veces', 'Ishikawa: categorizá causas', 'Identificá causa fundamental'] },
      { title: 'Definir acciones', description: 'Correctivas e inmediatas.', subSteps: ['Inmediata: contener efecto', 'Correctiva: eliminar causa raíz', 'Asigná responsable y fecha'] },
      { title: 'Verificar eficacia', description: 'Después del plazo, confirmá.', subSteps: ['Evidencia de no repetición', 'Medí indicador', 'Documentá verificación'] },
      { title: 'Cerrar NC', description: 'Marcá como cerrada.', subSteps: ['Verificá acciones completas', 'Confirmá eficacia', 'Clic "Cerrar NC"'] },
    ],
    screenshots: [
      { label: 'Listado NC', caption: 'NC con estados', instruction: 'Capturar /no-conformidades', placeholder: '[Capturar listado NC]' },
      { label: 'Nueva NC', caption: 'Formulario', instruction: 'Capturar formulario nueva NC', placeholder: '[Capturar formulario NC]' },
      { label: 'Causa raíz', caption: '5 Porqués o Ishikawa', instruction: 'Capturar análisis completado', placeholder: '[Capturar análisis causa raíz]' },
    ],
    related: ['auditorias-iso', 'acciones', 'audit-ia'],
    tips: ['Análisis de causa raíz es clave: sin él las NC se repiten.', 'Diferenciá inmediata de correctiva.', 'Verificación requiere TIEMPO: no cierres el mismo día.', 'NC críticas requieren escalamiento a dirección.'],
    difficulty: 'Avanzado', estimatedTime: '1-2 horas por NC', isoRef: 'ISO 9001 §10.2',
  },
  {
    id: 'riesgos', title: 'Riesgos', icon: Shield,
    purpose: 'Identificación, evaluación y tratamiento de riesgos del SGI. Alineado con ISO 31000.',
    mainFeatures: ['Matriz de riesgos por proceso', 'Evaluación probabilidad × impacto', 'Planes de tratamiento y controles', 'Seguimiento periódico'],
    actions: [
      { name: 'Nuevo riesgo', description: 'Identificá con descripción, proceso, evaluación.', detail: 'Probabilidad, impacto y nivel inherente.' },
      { name: 'Agregar control', description: 'Definí controles preventivos o mitigadores.', detail: 'Tipo, responsable y frecuencia.' },
      { name: 'Reevaluar', description: 'Actualizá riesgo residual tras controles.', detail: 'Nuevo nivel considerando efectividad.' },
    ],
    steps: [
      { title: 'Identificar riesgo', description: 'Clic "Nuevo riesgo".', subSteps: ['Describí el riesgo', 'Asociá al proceso', 'Identificá fuente', 'Agregá causas'] },
      { title: 'Evaluar riesgo', description: 'Asigná probabilidad e impacto.', subSteps: ['Probabilidad: 1-5', 'Impacto: 1-5', 'Riesgo inherente = P × I', 'Clasificá: bajo, medio, alto, crítico'] },
      { title: 'Definir controles', description: 'Agregá controles existentes y planificados.', subSteps: ['Preventivo: evita que ocurra', 'Detectivo: detecta si ocurre', 'Correctivo: mitiga efectos', 'Asigná responsable y frecuencia'] },
      { title: 'Reevaluar residual', description: 'Calculá riesgo residual.', subSteps: ['Evaluá efectividad de cada control', 'Recalculá P × I residual', 'Si sigue alto, agregá más controles'] },
      { title: 'Seguimiento', description: 'Revisá periódicamente.', subSteps: ['Mensualmente riesgos críticos', 'Trimestralmente riesgos medios', 'Actualizá si hay cambios'] },
    ],
    screenshots: [
      { label: 'Matriz de riesgos', caption: 'Mapa de calor', instruction: 'Capturar /riesgos mostrando matriz', placeholder: '[Capturar matriz de riesgos]' },
      { label: 'Nuevo riesgo', caption: 'Formulario', instruction: 'Capturar formulario nuevo riesgo', placeholder: '[Capturar formulario riesgo]' },
      { label: 'Evaluación', caption: 'Probabilidad e impacto', instruction: 'Capturar pantalla de evaluación', placeholder: '[Capturar evaluación]' },
    ],
    related: ['indicadores', 'auditorias-iso', 'documentos'],
    tips: ['Actualizá riesgos ante cambios organizacionales.', 'Vinculá riesgos a indicadores para monitoreo.', 'Riesgos críticos requieren plan de contingencia.', 'Involucrá al equipo operativo en identificación.'],
    difficulty: 'Medio', estimatedTime: '30 minutos por riesgo', isoRef: 'ISO 31000',
  },
  {
    id: 'indicadores', title: 'Indicadores', icon: TrendingUp,
    purpose: 'Definición y seguimiento de KPIs del sistema. Permite medir eficacia y cumplimiento de objetivos.',
    mainFeatures: ['Biblioteca de indicadores con fórmula y meta', 'Registro de mediciones periódicas', 'Gráficos de tendencia', 'Alertas ante desvíos'],
    actions: [
      { name: 'Nuevo indicador', description: 'Definí nombre, fórmula, unidad, meta, frecuencia.', detail: 'Fórmula puede usar datos de otros módulos o ser manual.' },
      { name: 'Cargar medición', description: 'Registrá valor medido en el período.', detail: 'Carga individual o masiva (importación Excel).' },
      { name: 'Ver tendencia', description: 'Entrá al detalle para ver gráfico histórico.', detail: 'Compará contra meta y límites de alerta.' },
    ],
    steps: [
      { title: 'Definir indicador', description: 'Clic "Nuevo indicador".', subSteps: ['Nombrá descriptivamente', 'Definí fórmula', 'Establecí meta y límites', 'Definí frecuencia', 'Asigná responsable'] },
      { title: 'Cargar medición', description: 'En fecha de medición, registrá valor.', subSteps: ['Andá al indicador', 'Clic "Nueva medición"', 'Ingresá valor y fecha', 'Adjuntá evidencia', 'Observá desvío'] },
      { title: 'Analizar tendencia', description: 'Revisá gráfico histórico.', subSteps: ['Identificá tendencias', 'Analizá desvíos', 'Investigá causas', 'Documentá acciones'] },
      { title: 'Configurar alertas', description: 'Definí umbrales de notificación.', subSteps: ['Umbrales: amarillo (atención), rojo (crítico)', 'Configurá email', 'Asigná responsables'] },
    ],
    screenshots: [
      { label: 'Biblioteca', caption: 'Listado con metas', instruction: 'Capturar /indicadores mostrando lista', placeholder: '[Capturar biblioteca]' },
      { label: 'Nuevo indicador', caption: 'Formulario con fórmula', instruction: 'Capturar formulario nuevo indicador', placeholder: '[Capturar nuevo indicador]' },
      { label: 'Gráfico', caption: 'Evolución histórica', instruction: 'Capturar gráfico de tendencia', placeholder: '[Capturar gráfico]' },
    ],
    related: ['panel', 'objetivos', 'reportes'],
    tips: ['KPIs deben ser SMART: Específicos, Medibles, Alcanzables, Relevantes, Temporales.', 'Evitá más de 10 KPIs por proceso.', 'Vinculá a objetivos estratégicos.', 'Revisá pertinencia anualmente.'],
    difficulty: 'Medio', estimatedTime: '20 minutos por indicador', isoRef: 'ISO 9001 §9.1',
  },
  {
    id: 'capacitaciones', title: 'Capacitaciones', icon: GraduationCap,
    purpose: 'Plan anual de capacitación: necesidades, cursos, asistencia y evaluación de eficacia.',
    mainFeatures: ['Plan anual de capacitaciones', 'Registro de asistencia', 'Evaluación pre/post', 'Certificados asociados', 'Vinculación con brechas de competencias'],
    actions: [
      { name: 'Nueva capacitación', description: 'Programá curso con tema, fecha, duración, instructor.', detail: 'Vinculable a competencias y empleados específicos.' },
      { name: 'Marcar asistencia', description: 'Registrá empleados que asistieron.', detail: 'Importación masiva o marcación individual.' },
      { name: 'Evaluar eficacia', description: 'Completa encuesta/test al concluir.', detail: 'Nivel 1 (reacción), Nivel 2 (aprendizaje), Nivel 3 (aplicación).' },
    ],
    steps: [
      { title: 'Detectar necesidad', description: 'Identificá brechas de competencias.', subSteps: ['Revisá Matriz de Polivalencia', 'Revisá resultados de auditorías', 'Consultá con jefes', 'Documentá necesidades'] },
      { title: 'Programar capacitación', description: 'Clic "Nueva capacitación".', subSteps: ['Definí tema/objetivo', 'Seleccioná fecha y duración', 'Asigná instructor', 'Definí método', 'Establecí presupuesto'] },
      { title: 'Inscribir participantes', description: 'Agregá empleados al curso.', subSteps: ['Buscá por nombre o perfil', 'Verificá prerequisitos', 'Confirmá disponibilidad'] },
      { title: 'Ejecutar curso', description: 'Durante la capacitación, registrá asistencia.', subSteps: ['Marcá asistencia día por día', 'Adjuntá material didáctico', 'Registrá observaciones'] },
      { title: 'Evaluar eficacia', description: 'Después del curso, aplicá evaluación.', subSteps: ['Nivel 1: encuesta de satisfacción', 'Nivel 2: test de aprendizaje', 'Nivel 3: seguimiento a los 30/60/90 días', 'Documentá resultados'] },
    ],
    screenshots: [
      { label: 'Plan anual', caption: 'Calendario de capacitaciones', instruction: 'Capturar /capacitaciones mostrando plan', placeholder: '[Capturar plan capacitaciones]' },
      { label: 'Nueva capacitación', caption: 'Formulario', instruction: 'Capturar formulario nueva capacitación', placeholder: '[Capturar nueva capacitación]' },
      { label: 'Asistencia', caption: 'Registro de asistencia', instruction: 'Capturar pantalla de asistencia', placeholder: '[Capturar asistencia]' },
    ],
    related: ['rrhh', 'indicadores', 'auditorias-iso'],
    tips: ['Todo programa de capacitación debe partir de necesidades detectadas, no de cursos disponibles.', 'Evaluá efecticacia a los 30/60/90 días: ¿se aplica lo aprendido?', 'Vinculá capacitaciones a brechas de la Matriz de Polivalencia.', 'Guardá certificados de instructores externos como evidencia.'],
    difficulty: 'Medio', estimatedTime: '30 minutos por curso', isoRef: 'ISO 9001 §7.2',
  },
  {
    id: 'rrhh', title: 'RRHH / Empleados', icon: Users,
    purpose: 'Gestión de personal del SGI: datos, competencias, evaluaciones y capacitaciones.',
    mainFeatures: ['Directorio de empleados', 'Competencias y matriz de polivalencia', 'Historial de capacitaciones', 'Evaluaciones de desempeño'],
    actions: [
      { name: 'Nuevo empleado', description: 'Registrá datos personales y laborales.', detail: 'Incluye puesto, área, fecha ingreso.' },
      { name: 'Competencias', description: 'Asigná competencias requeridas por puesto.', detail: 'Vincula a Matriz de Polivalencia.' },
    ],
    steps: [
      { title: 'Crear empleado', description: 'Clic "Nuevo empleado".', subSteps: ['Completá datos', 'Asigná puesto', 'Guardá'] },
      { title: 'Asignar competencias', description: 'En perfil del empleado.', subSteps: ['Seleccioná competencias', 'Definí nivel DEBE', 'Guardá'] },
    ],
    screenshots: [
      { label: 'Listado empleados', caption: 'Directorio', instruction: 'Capturar /rrhh', placeholder: '[Capturar RRHH]' },
    ],
    related: ['capacitaciones', 'indicadores'],
    tips: ['Mantené actualizados datos y competencias.', 'Usá matriz para detectar brechas de capacitación.'],
    difficulty: 'Facil', estimatedTime: '10 minutos', isoRef: 'ISO 9001 §7.2',
  },
  {
    id: 'clientes', title: 'Clientes', icon: Users,
    purpose: 'Base de clientes y partes interesadas del negocio.',
    mainFeatures: ['Directorio de clientes', 'Segmentación', 'Historial de interacciones'],
    actions: [
      { name: 'Nuevo cliente', description: 'Registrá datos de contacto.', detail: 'Incluye datos fiscales y comerciales.' },
      { name: 'Ver historial', description: 'Consultá interacciones y documentos.', detail: 'Trazabilidad completa.' },
    ],
    steps: [
      { title: 'Crear cliente', description: 'Clic "Nuevo cliente".', subSteps: ['Completá datos', 'Guardá'] },
    ],
    screenshots: [
      { label: 'Listado clientes', caption: 'Directorio', instruction: 'Capturar /clientes', placeholder: '[Capturar clientes]' },
    ],
    related: ['partes-interesadas', 'documentos'],
    tips: ['Mantené datos actualizados.'],
    difficulty: 'Facil', estimatedTime: '5 minutos',
  },
  {
    id: 'licencias', title: 'Licencias', icon: Lock,
    purpose: 'Gestión de licencias, permisos y autorizaciones legales.',
    mainFeatures: ['Registro de licencias', 'Alertas de vencimiento', 'Documentos asociados'],
    actions: [
      { name: 'Nueva licencia', description: 'Registrá tipo, entidad, vencimiento.', detail: 'Alertas automáticas.' },
    ],
    steps: [
      { title: 'Crear licencia', description: 'Clic "Nueva licencia".', subSteps: ['Completá datos', 'Asociá documentos', 'Guardá'] },
    ],
    screenshots: [
      { label: 'Listado licencias', caption: 'Licencias y vencimientos', instruction: 'Capturar /licencias', placeholder: '[Capturar licencias]' },
    ],
    related: ['legales', 'documentos'],
    tips: ['Configurá alertas con anticipación suficiente.'],
    difficulty: 'Facil', estimatedTime: '10 minutos',
  },
  {
    id: 'notificaciones', title: 'Notificaciones', icon: Bell,
    purpose: 'Centro de notificaciones y alertas del sistema.',
    mainFeatures: ['Bandeja de notificaciones', 'Preferencias de notificación', 'Historial'],
    actions: [
      { name: 'Ver notificaciones', description: 'Consultá alertas pendientes.', detail: 'Cliqueá para ir al módulo origen.' },
      { name: 'Configurar', description: 'Definí preferencias.', detail: 'Email, push, in-app.' },
    ],
    steps: [
      { title: 'Consultar notificaciones', description: 'Clic en icono de campana.', subSteps: ['Revisá lista', 'Cliqueá para ir al origen'] },
    ],
    screenshots: [
      { label: 'Bandeja', caption: 'Notificaciones', instruction: 'Capturar /notificaciones', placeholder: '[Capturar notificaciones]' },
    ],
    related: ['panel', 'inicio'],
    tips: ['No ignores notificaciones rojas.'],
    difficulty: 'Facil', estimatedTime: '2 minutos',
  },
  {
    id: 'configuracion', title: 'Configuración', icon: Settings,
    purpose: 'Configuración del sistema y preferencias del tenant.',
    mainFeatures: ['Datos de la empresa', 'Preferencias del sistema', 'Gestión de usuarios y roles'],
    actions: [
      { name: 'Empresa', description: 'Configurá datos fiscales y de contacto.', detail: 'Logo, dirección, etc.' },
      { name: 'Usuarios', description: 'Gestión de accesos.', detail: 'Crear, editar, desactivar usuarios.' },
    ],
    steps: [
      { title: 'Configurar empresa', description: 'Clic "Empresa".', subSteps: ['Completá datos', 'Subí logo', 'Guardá'] },
    ],
    screenshots: [
      { label: 'Configuración', caption: 'Panel de config', instruction: 'Capturar /configuracion', placeholder: '[Capturar configuración]' },
    ],
    related: ['empresa'],
    tips: ['Configurá correctamente los datos fiscales.'],
    difficulty: 'Facil', estimatedTime: '10 minutos',
  },
  {
    id: 'integraciones', title: 'Integraciones', icon: Puzzle,
    purpose: 'Conexiones con sistemas externos y APIs.',
    mainFeatures: ['Listado de integraciones activas', 'Configuración de APIs', 'Webhooks'],
    actions: [
      { name: 'Nueva integración', description: 'Configurá conexión con sistema externo.', detail: 'Requiere credenciales.' },
    ],
    steps: [
      { title: 'Crear integración', description: 'Clic "Nueva integración".', subSteps: ['Seleccioná tipo', 'Completá credenciales', 'Probar conexión'] },
    ],
    screenshots: [
      { label: 'Integraciones', caption: 'Listado', instruction: 'Capturar /integraciones', placeholder: '[Capturar integraciones]' },
    ],
    related: ['configuracion'],
    tips: ['Guardá credenciales de forma segura.'],
    difficulty: 'Avanzado', estimatedTime: '30 minutos',
  },
  {
    id: 'mantenimiento', title: 'Mantenimiento', icon: Wrench,
    purpose: 'Gestión de mantenimiento preventivo y correctivo de activos.',
    mainFeatures: ['Plan de mantenimiento', 'Órdenes de trabajo', 'Historial de mantenimiento'],
    actions: [
      { name: 'Nueva orden', description: 'Creá orden de mantenimiento.', detail: 'Preventivo o correctivo.' },
    ],
    steps: [
      { title: 'Crear orden', description: 'Clic "Nueva orden".', subSteps: ['Seleccioná activo', 'Definí tipo', 'Asigná técnico'] },
    ],
    screenshots: [
      { label: 'Mantenimiento', caption: 'Órdenes', instruction: 'Capturar /mantenimiento', placeholder: '[Capturar mantenimiento]' },
    ],
    related: ['activos'],
    tips: ['Priorizá mantenimiento preventivo.'],
    difficulty: 'Medio', estimatedTime: '15 minutos',
  },
  {
    id: 'simulacros', title: 'Simulacros', icon: AlertTriangle,
    purpose: 'Gestión de simulacros y ejercicios de emergencia.',
    mainFeatures: ['Planificación de simulacros', 'Registro de participantes', 'Evaluación de resultados'],
    actions: [
      { name: 'Nuevo simulacro', description: 'Programá simulacro de emergencia.', detail: 'Tipo, fecha, escenario.' },
    ],
    steps: [
      { title: 'Programar simulacro', description: 'Clic "Nuevo simulacro".', subSteps: ['Definí escenario', 'Asigná fecha', 'Involucrá participantes'] },
    ],
    screenshots: [
      { label: 'Simulacros', caption: 'Listado', instruction: 'Capturar /simulacros', placeholder: '[Capturar simulacros]' },
    ],
    related: ['emergencia'],
    tips: ['Ejecutá simulacros periódicamente.'],
    difficulty: 'Medio', estimatedTime: '20 minutos',
  },
  {
    id: 'activos', title: 'Activos', icon: Package,
    purpose: 'Inventario y gestión de activos de la organización.',
    mainFeatures: ['Registro de activos', 'Asignación', 'Historial'],
    actions: [
      { name: 'Nuevo activo', description: 'Registrá activo.', detail: 'Código, ubicación, estado.' },
    ],
    steps: [
      { title: 'Crear activo', description: 'Clic "Nuevo activo".', subSteps: ['Completá datos', 'Asigná ubicación', 'Guardá'] },
    ],
    screenshots: [
      { label: 'Activos', caption: 'Inventario', instruction: 'Capturar /activos', placeholder: '[Capturar activos]' },
    ],
    related: ['mantenimiento'],
    tips: ['Mantené inventario actualizado.'],
    difficulty: 'Facil', estimatedTime: '5 minutos',
  },
  {
    id: 'incidentes', title: 'Incidentes', icon: AlertOctagon,
    purpose: 'Registro y seguimiento de incidentes de seguridad.',
    mainFeatures: ['Registro de incidentes', 'Investigación', 'Acciones correctivas'],
    actions: [
      { name: 'Nuevo incidente', description: 'Registrá incidente.', detail: 'Descripción, fecha, involucrados.' },
    ],
    steps: [
      { title: 'Registrar incidente', description: 'Clic "Nuevo incidente".', subSteps: ['Describí', 'Clasificá', 'Asigná responsable'] },
    ],
    screenshots: [
      { label: 'Incidentes', caption: 'Listado', instruction: 'Capturar /incidentes', placeholder: '[Capturar incidentes]' },
    ],
    related: ['no-conformidades', 'riesgos'],
    tips: ['Investigá toda lesión.'],
    difficulty: 'Medio', estimatedTime: '20 minutos',
  },
  {
    id: 'calidad', title: 'Calidad', icon: Gauge,
    purpose: 'Módulo de gestión de calidad: procesos, procedimientos y controles.',
    mainFeatures: ['Procesos de calidad', 'Controles de calidad', 'Mejora continua'],
    actions: [
      { name: 'Nuevo proceso', description: 'Registrá proceso de calidad.', detail: 'Mapa de proceso, responsable.' },
    ],
    steps: [
      { title: 'Crear proceso', description: 'Clic "Nuevo proceso".', subSteps: ['Definí entradas/salidas', 'Asigná responsable', 'Guardá'] },
    ],
    screenshots: [
      { label: 'Calidad', caption: 'Procesos', instruction: 'Capturar /calidad', placeholder: '[Capturar calidad]' },
    ],
    related: ['documentos', 'indicadores'],
    tips: ['Mapeá procesos clave.'],
    difficulty: 'Medio', estimatedTime: '30 minutos',
  },
  {
    id: 'ambientales', title: 'Ambientales', icon: Compass,
    purpose: 'Gestión de aspectos e impactos ambientales.',
    mainFeatures: ['Aspectos ambientales', 'Impactos', 'Programas de gestión'],
    actions: [
      { name: 'Nuevo aspecto', description: 'Registrá aspecto ambiental.', detail: 'Tipo, magnitud, significancia.' },
    ],
    steps: [
      { title: 'Crear aspecto', description: 'Clic "Nuevo aspecto".', subSteps: ['Describí', 'Evaluá significancia', 'Guardá'] },
    ],
    screenshots: [
      { label: 'Ambientales', caption: 'Aspectos', instruction: 'Capturar /ambientales', placeholder: '[Capturar ambientales]' },
    ],
    related: ['riesgos', 'indicadores'],
    tips: ['Revisá significancia periódicamente.'],
    difficulty: 'Medio', estimatedTime: '20 minutos',
  },
  {
    id: 'contexto', title: 'Contexto de la Organización', icon: Target,
    purpose: 'Análisis del contexto organizacional según ISO 9001 §4.',
    mainFeatures: ['Análisis FODA', 'Partes interesadas', 'Alcance del SGI'],
    actions: [
      { name: 'Nuevo análisis', description: 'Registrá análisis FODA.', detail: 'Fortalezas, oportunidades, debilidades, amenazas.' },
    ],
    steps: [
      { title: 'Crear análisis', description: 'Clic "Nuevo análisis".', subSteps: ['Completá FODA', 'Vinculá partes interesadas', 'Guardá'] },
    ],
    screenshots: [
      { label: 'Contexto', caption: 'FODA', instruction: 'Capturar /contexto', placeholder: '[Capturar contexto]' },
    ],
    related: ['partes-interesadas', 'riesgos'],
    tips: ['Actualizá anualmente.'],
    difficulty: 'Medio', estimatedTime: '1 hora',
  },
  {
    id: 'partes-interesadas', title: 'Partes Interesadas', icon: Users,
    purpose: 'Identificación y gestión de partes interesadas del SGI.',
    mainFeatures: ['Registro de partes interesadas', 'Necesidades y expectativas', 'Seguimiento'],
    actions: [
      { name: 'Nueva parte', description: 'Registrá parte interesada.', detail: 'Cliente, proveedor, autoridad, etc.' },
    ],
    steps: [
      { title: 'Registrar parte', description: 'Clic "Nueva parte".', subSteps: ['Completá datos', 'Definí necesidades', 'Guardá'] },
    ],
    screenshots: [
      { label: 'Partes interesadas', caption: 'Listado', instruction: 'Capturar /partes-interesadas', placeholder: '[Capturar partes interesadas]' },
    ],
    related: ['contexto', 'clientes'],
    tips: ['Revisá anualmente.'],
    difficulty: 'Facil', estimatedTime: '15 minutos',
  },
  {
    id: 'reportes', title: 'Reportes', icon: FileBarChart,
    purpose: 'Generación de reportes e informes del sistema.',
    mainFeatures: ['Reportes predefinidos', 'Personalización', 'Exportación'],
    actions: [
      { name: 'Generar reporte', description: 'Seleccioná reporte y filtros.', detail: 'PDF, Excel, etc.' },
    ],
    steps: [
      { title: 'Generar reporte', description: 'Seleccioná reporte.', subSteps: ['Elegí tipo', 'Aplicá filtros', 'Exportá'] },
    ],
    screenshots: [
      { label: 'Reportes', caption: 'Listado', instruction: 'Capturar /reportes', placeholder: '[Capturar reportes]' },
    ],
    related: ['panel', 'indicadores'],
    tips: ['Usá reportes para reuniones.'],
    difficulty: 'Facil', estimatedTime: '5 minutos',
  },
  {
    id: 'planes', title: 'Planes', icon: Target,
    purpose: 'Planes de acción y mejora del SGI.',
    mainFeatures: ['Planes estratégicos', 'Planes operativos', 'Seguimiento'],
    actions: [
      { name: 'Nuevo plan', description: 'Creá plan de acción.', detail: 'Objetivos, acciones, plazos.' },
    ],
    steps: [
      { title: 'Crear plan', description: 'Clic "Nuevo plan".', subSteps: ['Definí objetivos', 'Asigná acciones', 'Establecí plazos'] },
    ],
    screenshots: [
      { label: 'Planes', caption: 'Listado', instruction: 'Capturar /planes', placeholder: '[Capturar planes]' },
    ],
    related: ['objetivos', 'indicadores'],
    tips: ['Vinculá a objetivos.'],
    difficulty: 'Medio', estimatedTime: '30 minutos',
  },
  {
    id: 'objetivos', title: 'Objetivos', icon: Target,
    purpose: 'Objetivos del SGI medibles y alcanzables.',
    mainFeatures: ['Objetivos estratégicos', 'KPIs asociados', 'Seguimiento'],
    actions: [
      { name: 'Nuevo objetivo', description: 'Definí objetivo SMART.', detail: 'Específico, medible, alcanzable.' },
    ],
    steps: [
      { title: 'Crear objetivo', description: 'Clic "Nuevo objetivo".', subSteps: ['Describí', 'Asigná indicadores', 'Guardá'] },
    ],
    screenshots: [
      { label: 'Objetivos', caption: 'Listado', instruction: 'Capturar /objetivos', placeholder: '[Capturar objetivos]' },
    ],
    related: ['planes', 'indicadores'],
    tips: ['Revisá al menos anualmente.'],
    difficulty: 'Medio', estimatedTime: '20 minutos',
  },
  {
    id: 'project360', title: 'Proyectos', icon: Target,
    purpose: 'Gestión integral de proyectos del SGI: mejoras, implementaciones, certificaciones.',
    mainFeatures: ['Proyectos activos y archivados', 'Tableros Kanban personalizables', 'Asignación de responsables y fechas', 'Adjuntos y comentarios por proyecto'],
    actions: [
      { name: 'Nuevo proyecto', description: 'Creá con nombre, descripción, responsable, fechas y presupuesto.', detail: 'Podés vincular a normativas ISO específicas.' },
      { name: 'Ver detalle', description: 'Entrá para gestionar tareas, archivos y comentarios.', detail: 'Incluye timeline, tareas, archivos adjuntos y log.' },
      { name: 'Cambiar estado', description: 'Mové tarjetas entre columnas en Kanban.', detail: 'Arrastrá y soltá para actualizar estado visualmente.' },
      { name: 'Archivar proyecto', description: 'Marcá como completado y archivalo.', detail: 'Siguen siendo buscables pero no aparecen en activos.' },
    ],
    steps: [
      { title: 'Crear proyecto', description: 'Clic "Nuevo Proyecto".', subSteps: ['Completá nombre descriptivo', 'Asigná responsable principal', 'Definí fechas de inicio y objetivo', 'Opcional: asigná presupuesto'] },
      { title: 'Agregar tareas', description: 'Dentro del proyecto, agregá tareas.', subSteps: ['Clic "Nueva tarea"', 'Describí la tarea concreta', 'Asigná responsable y fecha límite', 'Marcá dependencias si aplica'] },
      { title: 'Seguimiento Kanban', description: 'Usá vista Kanban para visualizar avance.', subSteps: ['Columnas: Backlog | En progreso | Revisión | Completado', 'Arrastrá tareas entre columnas', 'Registro automático de quién movió y cuándo'] },
      { title: 'Cerrar proyecto', description: 'Cuando todas las tareas estén completas.', subSteps: ['Verificá que no queden pendientes', 'Clic "Archivar proyecto"', 'Agregá resumen final y lecciones aprendidas'] },
    ],
    screenshots: [
      { label: 'Listado de proyectos', caption: 'Vista de lista', instruction: 'Capturar /project360 mostrando lista', placeholder: '[Capturar listado PROJECT360]' },
      { label: 'Vista Kanban', caption: 'Tablero con tareas', instruction: 'Capturar Kanban con 3+ columnas y 5+ tareas', placeholder: '[Capturar Kanban PROJECT360]' },
      { label: 'Detalle de proyecto', caption: 'Página con tareas y timeline', instruction: 'Capturar detalle de proyecto con tareas visibles', placeholder: '[Capturar detalle de proyecto]' },
    ],
    related: ['dashboard', 'documentos', 'indicadores'],
    tips: ['Vinculá proyectos a objetivos del SGI para trazabilidad (ISO 9001 §6.2).', 'Usá presupuesto para controlar inversiones.', 'Proyectos archivados son evidencia para auditorías externas.'],
    difficulty: 'Medio', estimatedTime: '20 minutos', isoRef: 'ISO 9001 §6.2',
  },
  {
    id: 'empresa', title: 'Empresa', icon: Settings,
    purpose: 'Datos y configuración de la organización tenant.',
    mainFeatures: ['Datos fiscales', 'Logo y branding', 'Configuración general'],
    actions: [
      { name: 'Editar empresa', description: 'Actualizá datos de la empresa.', detail: 'Nombre, CUIT, dirección, etc.' },
    ],
    steps: [
      { title: 'Editar empresa', description: 'Clic "Editar".', subSteps: ['Completá datos', 'Subí logo', 'Guardá'] },
    ],
    screenshots: [
      { label: 'Empresa', caption: 'Datos', instruction: 'Capturar /configuracion/empresa', placeholder: '[Capturar empresa]' },
    ],
    related: ['configuracion'],
    tips: ['Mantené datos actualizados.'],
    difficulty: 'Facil', estimatedTime: '5 minutos',
  },
  {
    id: 'cumplimiento', title: 'Cumplimiento', icon: Shield,
    purpose: 'Seguimiento de cumplimiento normativo y legal.',
    mainFeatures: ['Requisitos legales', 'Evaluaciones de cumplimiento', 'Acciones correctivas'],
    actions: [
      { name: 'Nueva evaluación', description: 'Evaluá cumplimiento de requisito.', detail: 'Cumple / No cumple / En progreso.' },
    ],
    steps: [
      { title: 'Evaluar cumplimiento', description: 'Clic "Nueva evaluación".', subSteps: ['Seleccioná requisito', 'Evaluá estado', 'Documentá evidencia'] },
    ],
    screenshots: [
      { label: 'Cumplimiento', caption: 'Evaluaciones', instruction: 'Capturar /cumplimiento', placeholder: '[Capturar cumplimiento]' },
    ],
    related: ['normativos', 'legales'],
    tips: ['Revisá cambios regulatorios.'],
    difficulty: 'Medio', estimatedTime: '30 minutos',
  },
  {
    id: 'gestion-cambios', title: 'Gestión de Cambios', icon: ArrowRight,
    purpose: 'Control de cambios en procesos, productos o infraestructura.',
    mainFeatures: ['Solicitudes de cambio', 'Evaluación de impacto', 'Aprobaciones'],
    actions: [
      { name: 'Nueva solicitud', description: 'Solicitá cambio formalmente.', detail: 'Descripción, justificación, impacto.' },
    ],
    steps: [
      { title: 'Solicitar cambio', description: 'Clic "Nueva solicitud".', subSteps: ['Describí cambio', 'Evaluá impacto', 'Solicitá aprobación'] },
    ],
    screenshots: [
      { label: 'Gestión cambios', caption: 'Solicitudes', instruction: 'Capturar /gestion-cambios', placeholder: '[Capturar gestión cambios]' },
    ],
    related: ['documentos', 'no-conformidades'],
    tips: ['Evaluá impacto antes de aprobar.'],
    difficulty: 'Medio', estimatedTime: '20 minutos',
  },
  {
    id: 'encuestas', title: 'Encuestas', icon: FileBarChart,
    purpose: 'Creación y aplicación de encuestas de satisfacción y clima.',
    mainFeatures: ['Creador de encuestas', 'Aplicación', 'Resultados y análisis'],
    actions: [
      { name: 'Nueva encuesta', description: 'Creá encuesta.', detail: 'Preguntas, respuestas, lógica.' },
    ],
    steps: [
      { title: 'Crear encuesta', description: 'Clic "Nueva encuesta".', subSteps: ['Definí preguntas', 'Configurá respuestas', 'Publicá'] },
    ],
    screenshots: [
      { label: 'Encuestas', caption: 'Listado', instruction: 'Capturar /encuestas', placeholder: '[Capturar encuestas]' },
    ],
    related: ['clientes', 'rrhh'],
    tips: ['Anonimizá encuestas de clima.'],
    difficulty: 'Facil', estimatedTime: '15 minutos',
  },
  {
    id: 'calendario', title: 'Calendario', icon: Calendar,
    purpose: 'Calendario de eventos, auditorías, capacitaciones y vencimientos.',
    mainFeatures: ['Vista mensual/semanal/diaria', 'Eventos de todos los módulos', 'Filtros por tipo'],
    actions: [
      { name: 'Ver eventos', description: 'Navegá por fechas.', detail: 'Cliqueá para ir al módulo origen.' },
    ],
    steps: [
      { title: 'Consultar calendario', description: 'Clic en evento.', subSteps: ['Navegá fechas', 'Filtrá por tipo', 'Cliqueá para detalle'] },
    ],
    screenshots: [
      { label: 'Calendario', caption: 'Vista mensual', instruction: 'Capturar /calendario', placeholder: '[Capturar calendario]' },
    ],
    related: ['auditorias-iso', 'capacitaciones'],
    tips: ['Usá filtros para enfocarte.'],
    difficulty: 'Facil', estimatedTime: '2 minutos',
  },
  {
    id: 'infraestructura', title: 'Infraestructura', icon: Truck,
    purpose: 'Gestión de infraestructura, instalaciones y equipamiento.',
    mainFeatures: ['Registro de infraestructura', 'Mantenimiento asociado', 'Planificación'],
    actions: [
      { name: 'Nueva infraestructura', description: 'Registrá instalación o equipo.', detail: 'Ubicación, capacidad, estado.' },
    ],
    steps: [
      { title: 'Crear infraestructura', description: 'Clic "Nueva".', subSteps: ['Completá datos', 'Asigná ubicación', 'Guardá'] },
    ],
    screenshots: [
      { label: 'Infraestructura', caption: 'Listado', instruction: 'Capturar /infraestructura', placeholder: '[Capturar infraestructura]' },
    ],
    related: ['mantenimiento', 'activos'],
    tips: ['Vinculá a mantenimiento.'],
    difficulty: 'Facil', estimatedTime: '10 minutos',
  },
  {
    id: 'iperc', title: 'IPERC', icon: Shield,
    purpose: 'Identificación de Peligros y Evaluación de Riesgos de Cargos (IPERC).',
    mainFeatures: ['Identificación de peligros por puesto', 'Evaluación de riesgos', 'Medidas de control'],
    actions: [
      { name: 'Nueva evaluación IPERC', description: 'Evaluá riesgos de un puesto.', detail: 'Peligros, riesgos, controles.' },
    ],
    steps: [
      { title: 'Crear IPERC', description: 'Clic "Nueva evaluación".', subSteps: ['Seleccioná puesto', 'Identificá peligros', 'Evaluá riesgos', 'Definí controles'] },
    ],
    screenshots: [
      { label: 'IPERC', caption: 'Evaluaciones', instruction: 'Capturar /iperc', placeholder: '[Capturar iperc]' },
    ],
    related: ['riesgos', 'rrhh'],
    tips: ['Actualizá ante cambios de proceso.'],
    difficulty: 'Medio', estimatedTime: '30 minutos',
  },
  {
    id: 'legales', title: 'Requisitos Legales', icon: Lock,
    purpose: 'Repositorio de requisitos legales aplicables.',
    mainFeatures: ['Registro de requisitos', 'Evaluaciones de cumplimiento', 'Vinculación normativa'],
    actions: [
      { name: 'Nuevo requisito', description: 'Registrá requisito legal.', detail: 'Norma, artículo, descripción.' },
    ],
    steps: [
      { title: 'Crear requisito', description: 'Clic "Nuevo requisito".', subSteps: ['Completá datos', 'Vinculá norma', 'Guardá'] },
    ],
    screenshots: [
      { label: 'Legales', caption: 'Requisitos', instruction: 'Capturar /legales', placeholder: '[Capturar legales]' },
    ],
    related: ['normativos', 'cumplimiento'],
    tips: ['Revisá cambios regulatorios.'],
    difficulty: 'Medio', estimatedTime: '20 minutos',
  },
  {
    id: 'calibraciones', title: 'Calibraciones', icon: Gauge,
    purpose: 'Programa de calibración de equipos de medición.',
    mainFeatures: ['Inventario de equipos', 'Programa de calibración', 'Certificados'],
    actions: [
      { name: 'Nuevo equipo', description: 'Registrá equipo de medición.', detail: 'Código, rango, tolerancia.' },
      { name: 'Programar calibración', description: 'Agendá calibración.', detail: 'Fecha, laboratorio, certificado.' },
    ],
    steps: [
      { title: 'Registrar equipo', description: 'Clic "Nuevo equipo".', subSteps: ['Completá datos', 'Definí frecuencia', 'Guardá'] },
      { title: 'Programar', description: 'Clic "Programar calibración".', subSteps: ['Seleccioná fecha', 'Elegí laboratorio', 'Guardá'] },
    ],
    screenshots: [
      { label: 'Calibraciones', caption: 'Equipos', instruction: 'Capturar /calibraciones', placeholder: '[Capturar calibraciones]' },
    ],
    related: ['mantenimiento', 'activos'],
    tips: ['No operés equipos vencidos.'],
    difficulty: 'Medio', estimatedTime: '15 minutos',
  },
  {
    id: 'acciones', title: 'Acciones', icon: ArrowRight,
    purpose: 'Seguimiento de acciones correctivas, preventivas y de mejora.',
    mainFeatures: ['Listado de acciones', 'Estados y plazos', 'Responsables y seguimiento'],
    actions: [
      { name: 'Nueva acción', description: 'Creá acción.', detail: 'Tipo, descripción, responsable, plazo.' },
    ],
    steps: [
      { title: 'Crear acción', description: 'Clic "Nueva acción".', subSteps: ['Describí', 'Asigná responsable', 'Definí plazo'] },
    ],
    screenshots: [
      { label: 'Acciones', caption: 'Listado', instruction: 'Capturar /acciones', placeholder: '[Capturar acciones]' },
    ],
    related: ['no-conformidades', 'auditorias-iso'],
    tips: ['Seguimiento periódico.'],
    difficulty: 'Facil', estimatedTime: '5 minutos',
  },
  {
    id: 'auditoria', title: 'Auditoría', icon: ClipboardCheck,
    purpose: 'Auditorías y evaluaciones del sistema.',
    mainFeatures: ['Programa de auditorías', 'Evaluaciones', 'Hallazgos'],
    actions: [
      { name: 'Nueva auditoría', description: 'Programá auditoría.', detail: 'Tipo, alcance, fecha.' },
    ],
    steps: [
      { title: 'Programar', description: 'Clic "Nueva auditoría".', subSteps: ['Definí tipo', 'Asigná alcance', 'Programá fecha'] },
    ],
    screenshots: [
      { label: 'Auditoría', caption: 'Listado', instruction: 'Capturar /auditoria', placeholder: '[Capturar auditoría]' },
    ],
    related: ['auditorias-iso', 'audit-ia'],
    tips: ['Diferenciá tipos de auditoría.'],
    difficulty: 'Medio', estimatedTime: '20 minutos',
  },
  {
    id: 'audit360', title: 'Audit360', icon: ClipboardCheck,
    purpose: 'Auditorías integrales 360° del sistema de gestión.',
    mainFeatures: ['Auditorías multidimensionales', 'Evaluación 360°', 'Plan de acción'],
    actions: [
      { name: 'Nueva auditoría 360', description: 'Iniciá auditoría integral.', detail: 'Cubre todos los módulos del SGI.' },
    ],
    steps: [
      { title: 'Iniciar', description: 'Clic "Nueva auditoría 360".', subSteps: ['Definí alcance', 'Asigná equipo', 'Programá fechas'] },
    ],
    screenshots: [
      { label: 'Audit360', caption: 'Listado', instruction: 'Capturar /audit360', placeholder: '[Capturar audit360]' },
    ],
    related: ['auditorias-iso', 'audit-ia'],
    tips: ['Auditoría integral anual recomendada.'],
    difficulty: 'Avanzado', estimatedTime: '4-8 horas',
  },
  {
    id: 'contexto-sgi', title: 'Contexto SGI', icon: Target,
    purpose: 'Contexto específico del Sistema de Gestión Integral.',
    mainFeatures: ['Análisis de contexto', 'Partes interesadas SGI', 'Alcance'],
    actions: [
      { name: 'Definir alcance', description: 'Establecé alcance del SGI.', detail: 'Productos, servicios, ubicaciones.' },
    ],
    steps: [
      { title: 'Definir', description: 'Clic "Definir alcance".', subSteps: ['Describí productos/servicios', 'Definí ubicaciones', 'Exclusiones si aplica'] },
    ],
    screenshots: [
      { label: 'Contexto SGI', caption: 'Alcance', instruction: 'Capturar /contexto-sgi', placeholder: '[Capturar contexto-sgi]' },
    ],
    related: ['contexto', 'partes-interesadas'],
    tips: ['Revisá anualmente.'],
    difficulty: 'Medio', estimatedTime: '1 hora',
  },
  {
    id: 'dashboard-simple', title: 'Dashboard Simple', icon: LayoutDashboard,
    purpose: 'Vista simplificada del dashboard para usuarios operativos.',
    mainFeatures: ['Métricas esenciales', 'Accesos directos', 'Alertas prioritarias'],
    actions: [
      { name: 'Ver métricas', description: 'Consultá métricas clave.', detail: 'Sin detalles complejos.' },
    ],
    steps: [
      { title: 'Consultar', description: 'Accedé a /dashboard-simple.', subSteps: ['Revisá métricas', 'Atendé alertas rojas'] },
    ],
    screenshots: [
      { label: 'Dashboard Simple', caption: 'Vista', instruction: 'Capturar /dashboard-simple', placeholder: '[Capturar dashboard-simple]' },
    ],
    related: ['inicio'],
    tips: ['Ideal para operarios y supervisores.'],
    difficulty: 'Facil', estimatedTime: '2 minutos',
  },
  {
    id: 'proveedores', title: 'Proveedores', icon: Truck,
    purpose: 'Gestión de proveedores y evaluación de desempeño.',
    mainFeatures: ['Registro de proveedores', 'Evaluaciones', 'Historial'],
    actions: [
      { name: 'Nuevo proveedor', description: 'Registrá proveedor.', detail: 'Datos comerciales, contacto.' },
    ],
    steps: [
      { title: 'Registrar', description: 'Clic "Nuevo proveedor".', subSteps: ['Completá datos', 'Asigná categoría', 'Guardá'] },
    ],
    screenshots: [
      { label: 'Proveedores', caption: 'Listado', instruction: 'Capturar /proveedores', placeholder: '[Capturar proveedores]' },
    ],
    related: ['documentos', 'calidad'],
    tips: ['Evaluá desempeño periódicamente.'],
    difficulty: 'Facil', estimatedTime: '10 minutos',
  },
  {
    id: 'revision-direccion', title: 'Revisión por la Dirección', icon: FileBarChart,
    purpose: 'Gestión de revisiones por la dirección según ISO 9001 §9.3.',
    mainFeatures: ['Agenda de revisión', 'Entradas requeridas', 'Actas y decisiones'],
    actions: [
      { name: 'Nueva revisión', description: 'Programá revisión por la dirección.', detail: 'Fecha, participantes, agenda.' },
    ],
    steps: [
      { title: 'Programar', description: 'Clic "Nueva revisión".', subSteps: ['Definí fecha', 'Invitá participantes', 'Prepará entradas'] },
    ],
    screenshots: [
      { label: 'Revisión', caption: 'Actas', instruction: 'Capturar /revision-direccion', placeholder: '[Capturar revisión-direccion]' },
    ],
    related: ['panel', 'indicadores'],
    tips: ['Realizá al menos una vez al año.'],
    difficulty: 'Avanzado', estimatedTime: '2 horas', isoRef: 'ISO 9001 §9.3',
  },
  {
    id: 'seguridad360', title: 'Seguridad 360', icon: Shield,
    purpose: 'Gestión integral de seguridad y salud ocupacional.',
    mainFeatures: ['Análisis de riesgos SST', 'Incidentes', 'Indicadores SST'],
    actions: [
      { name: 'Nuevo análisis', description: 'Evaluá riesgos SST.', detail: 'Puestos, peligros, controles.' },
    ],
    steps: [
      { title: 'Evaluar', description: 'Clic "Nuevo análisis".', subSteps: ['Seleccioná puesto', 'Identificá peligros', 'Evaluá riesgos', 'Definí controles'] },
    ],
    screenshots: [
      { label: 'Seguridad360', caption: 'Riesgos', instruction: 'Capturar /seguridad360', placeholder: '[Capturar seguridad360]' },
    ],
    related: ['incidentes', 'iperc', 'riesgos'],
    tips: ['Actualizá ante cambios de proceso.'],
    difficulty: 'Medio', estimatedTime: '1 hora',
  },
];

/* ───────── COMPONENTE AYUDA ───────── */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${q})`, 'gi'));
  return <>{parts.map((p, i) => p.toLowerCase() === query.toLowerCase() ? <mark key={i} className="bg-yellow-200 rounded px-0.5">{p}</mark> : <span key={i}>{p}</span>)}</>;
}

function ScreenshotDisplay({ guideId, index, sc }: { guideId: string; index: number; sc: Screenshot }) {
  const [failed, setFailed] = useState(false);
  const imgSrc = `/help/${guideId}-${index + 1}.png`;

  if (!failed) {
    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center gap-2">
          <Eye className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">{sc.label}</span>
          <span className="text-xs text-gray-400">— {sc.caption}</span>
        </div>
        <div className="p-4 bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt={sc.caption}
            className="w-full rounded-lg border border-gray-200 shadow-sm"
            onError={() => setFailed(true)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center gap-2">
        <Eye className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-700">{sc.label}</span>
        <span className="text-xs text-gray-400">— {sc.caption}</span>
      </div>
      <div className="p-6 bg-gray-100 flex flex-col items-center justify-center min-h-[200px]">
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-8 text-center max-w-md">
          <Info className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-600">{sc.placeholder}</p>
          <p className="text-xs text-gray-400 mt-1">{sc.instruction}</p>
          <p className="text-xs text-blue-600 mt-3">💡 Reemplazá este placeholder con la imagen real: guardá la captura como <code className="bg-gray-100 px-1 rounded">{guideId}-{index + 1}.png</code> en <code className="bg-gray-100 px-1 rounded">/public/help/</code></p>
        </div>
      </div>
    </div>
  );
}

export default function CentroDeAyudaPage() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string>(guides[0].id);
  const [tab, setTab] = useState<'info' | 'pasos' | 'screenshots'>('info');
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return guides;
    return guides.filter(g =>
      g.title.toLowerCase().includes(q) ||
      g.purpose.toLowerCase().includes(q) ||
      g.mainFeatures.some(f => f.toLowerCase().includes(q)) ||
      g.actions.some(a => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)) ||
      g.steps.some(s => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)) ||
      g.tips.some(t => t.toLowerCase().includes(q))
    );
  }, [q]);

  const current = guides.find(g => g.id === active) || guides[0];
  const CurrentIcon = current.icon;
  const diff = current.difficulty ? difficultyConfig[current.difficulty] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Centro de Ayuda</h1>
                <p className="text-sm text-gray-500">Guías paso a paso, funcionalidades y buenas prácticas de cada módulo.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 max-w-md w-full">
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); setTab('info'); }}
                placeholder="Buscar en el sistema..."
                className="bg-transparent text-sm w-full outline-none text-gray-800 placeholder:text-gray-400"
              />
              {query && <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600 text-xs">Limpiar</button>}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="bg-white border border-gray-200 rounded-xl p-4 h-fit sticky top-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">Módulos ({filtered.length})</h2>
          <nav className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
            {filtered.length === 0 && <p className="text-xs text-gray-500 px-3 py-2">Sin resultados</p>}
            {filtered.map(g => {
              const Icon = g.icon;
              return (
                <button key={g.id} onClick={() => { setActive(g.id); setTab('info'); setExpandedStep(null); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${active === g.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate"><Highlight text={g.title} query={query} /></span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 pt-6 pb-2 border-b border-gray-100">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                <CurrentIcon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-xl font-semibold text-gray-900">{current.title}</h2>
                  {diff && (
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${diff.bg} ${diff.color} ${diff.border}`}>
                      {current.difficulty}
                    </span>
                  )}
                  {current.estimatedTime && (
                    <span className="text-xs text-gray-500">⏱️ {current.estimatedTime}</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">{current.purpose}</p>
                {current.isoRef && (
                  <p className="text-xs text-blue-600 mt-1">📋 {current.isoRef}</p>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              {(['info', 'pasos', 'screenshots'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${tab === t ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {t === 'info' ? 'Información' : t === 'pasos' ? 'Pasos de uso' : 'Capturas de pantalla'}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* INFO TAB */}
            {tab === 'info' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Funcionalidades principales</h3>
                  <ul className="space-y-2">
                    {current.mainFeatures.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-800">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                        <span><Highlight text={f} query={query} /></span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Botones y acciones</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {current.actions.map((a, i) => (
                      <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-2 font-medium text-gray-900 text-sm">
                          <Play className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <Highlight text={a.name} query={query} />
                        </div>
                        <p className="text-sm text-gray-600 mt-1 ml-5"><Highlight text={a.description} query={query} /></p>
                        {a.detail && (
                          <p className="text-xs text-gray-400 mt-1 ml-5 italic"><Highlight text={a.detail} query={query} /></p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {current.tips.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-900">
                      <strong className="block mb-1">Buenas prácticas</strong>
                      <ul className="space-y-1">
                        {current.tips.map((t, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-yellow-600 mt-0.5">•</span>
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {current.related.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Módulos relacionados</h3>
                    <div className="flex flex-wrap gap-2">
                      {current.related.map((r, i) => {
                        const relatedGuide = guides.find(g => g.id === r);
                        if (!relatedGuide) return null;
                        const RIcon = relatedGuide.icon;
                        return (
                          <button key={i} onClick={() => { setActive(r); setTab('info'); }}
                            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors">
                            <RIcon className="h-3.5 w-3.5" />
                            {relatedGuide.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
                  <MessageCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <strong className="block mb-1">¿Tenés dudas?</strong>
                    <p>Usá el botón flotante de ayuda (esquina inferior derecha) para consultar con el asistente de IA contextual en cualquier pantalla.</p>
                  </div>
                </div>
              </div>
            )}

            {/* PASOS TAB */}
            {tab === 'pasos' && (
              <div className="space-y-3">
                {current.steps.length > 0 ? current.steps.map((s, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 text-sm">{s.title}</h4>
                        <p className="text-xs text-gray-500">{s.description}</p>
                      </div>
                      {expandedStep === i ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    </button>
                    {expandedStep === i && s.subSteps && (
                      <div className="px-4 pb-3 pl-16">
                        <ul className="space-y-1.5">
                          {s.subSteps.map((sub, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                              <ListChecks className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                              {sub}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )) : <p className="text-sm text-gray-500">No hay pasos detallados para este módulo.</p>}
              </div>
            )}

            {/* SCREENSHOTS TAB */}
            {tab === 'screenshots' && (
              <div className="space-y-4">
                {current.screenshots.length > 0 ? current.screenshots.map((sc, i) => (
                  <ScreenshotDisplay key={i} guideId={current.id} index={i} sc={sc} />
                )) : <p className="text-sm text-gray-500">No hay capturas documentadas para este módulo.</p>}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
