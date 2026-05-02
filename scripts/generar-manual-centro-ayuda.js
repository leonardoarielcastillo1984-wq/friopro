#!/usr/bin/env node
/**
 * Script para generar el Manual PDF del Centro de Ayuda de SGI 360
 * Uso: node generar-manual-centro-ayuda.js
 */

const fs = require('fs');
const path = require('path');

// Datos completos extraídos de /apps/web/src/app/(app)/modo-de-uso/page.tsx
const guides = [
  {
    id: 'inicio',
    title: 'Inicio / Dashboard',
    purpose: 'Pantalla principal con vista ejecutiva del SGI: métricas clave, alertas y accesos rápidos a módulos.',
    difficulty: 'Fácil',
    estimatedTime: '5 minutos',
    isoRef: null,
    mainFeatures: [
      'Tarjetas de métricas resumen con tendencias',
      'Gráficos de evolución por período',
      'Accesos directos personalizados',
      'Panel de alertas inteligentes'
    ],
    actions: [
      { name: 'Tarjetas de métricas', description: 'Cliqueá cualquier tarjeta para ir al módulo.', detail: 'Muestran conteo actual e indicador de tendencia (subida/bajada).' },
      { name: 'Filtros de período', description: 'Cambiá el rango de fechas del resumen.', detail: 'Soporta semana, mes, trimestre y año.' },
      { name: 'Accesos directos', description: 'Navegación rápida sin abrir el menú lateral.', detail: 'Se personalizan automáticamente según frecuencia de uso.' }
    ],
    steps: [
      { title: 'Acceder al Dashboard', description: 'Iniciá sesión. El Dashboard carga automáticamente.', subSteps: ['Ingresá email y contraseña', 'Sistema redirige a /dashboard'] },
      { title: 'Interpretar métricas', description: 'Observá las tarjetas de colores.', subSteps: ['Verde = todo en orden', 'Amarillo = atención requerida', 'Rojo = acción urgente pendiente'] },
      { title: 'Navegar por módulo', description: 'Cliqueá cualquier tarjeta para ir al detalle.', subSteps: ['Ej: clic en Documentos abre la lista completa', 'Ej: clic en Hallazgos IA abre la auditoría inteligente'] },
      { title: 'Revisar alertas', description: 'Bajá hasta "Alertas activas".', subSteps: ['Alertas: vencimientos de documentos, capacitaciones pendientes, auditorías programadas'] }
    ],
    tips: [
      'Usalo cada mañana como reunión de pie ejecutiva: 5 minutos.',
      'Configurá el período por defecto según tu ciclo de gestión.',
      'Las alertas se actualizan en tiempo real.'
    ],
    related: ['panel', 'notificaciones', 'reportes']
  },
  {
    id: 'panel',
    title: 'Panel General',
    purpose: 'Panel extendido con KPIs agregados por área. Ideal para reuniones de revisión por la dirección.',
    difficulty: 'Medio',
    estimatedTime: '15 minutos',
    isoRef: 'ISO 9001 §9.3',
    mainFeatures: [
      'KPIs por módulo (calidad, SST, ambiente, RRHH)',
      'Comparativas período actual vs anterior',
      'Alertas de desvíos críticos',
      'Exportación a PDF'
    ],
    actions: [
      { name: 'Exportar a PDF', description: 'Genera informe ejecutivo descargable.', detail: 'Incluye gráficos, tablas y resumen ejecutivo automático.' },
      { name: 'Cambiar período', description: 'Ajustá rango de análisis de KPIs.', detail: 'Soporta comparación año-a-año, mes-a-mes, trimestral.' },
      { name: 'Configurar alertas', description: 'Definí umbrales de desvío.', detail: 'Umbrales porcentuales o valores absolutos por indicador.' }
    ],
    steps: [
      { title: 'Acceder al Panel', description: 'Sidebar → "Panel General".', subSteps: ['El panel carga todos los KPIs activos por defecto'] },
      { title: 'Seleccionar módulos', description: 'Usá tabs superiores para filtrar por área.', subSteps: ['Tabs: Calidad, SST, Ambiente, RRHH, General'] },
      { title: 'Configurar período', description: 'Abrí selector de fechas.', subSteps: ['Elegí período actual y de comparación', 'Ej: Enero 2024 vs Enero 2023'] },
      { title: 'Exportar informe', description: 'Clic en "Exportar PDF".', subSteps: ['PDF generado con KPIs visibles', 'Descarga automática'] }
    ],
    tips: [
      'Revisalo mensualmente como input para Revisión por la Dirección (ISO 9001 §9.3).',
      'Los KPIs se calculan automáticamente desde datos de otros módulos.',
      'Usá comparativa año-a-año para tendencias a largo plazo.'
    ],
    related: ['inicio', 'indicadores', 'reportes']
  },
  {
    id: 'documentos',
    title: 'Documentos',
    purpose: 'Repositorio centralizado de documentos del SGI: procedimientos, instructivos, formularios. Gestiona versiones, aprobaciones, vigencias y vinculación normativa.',
    difficulty: 'Fácil',
    estimatedTime: '10 minutos',
    isoRef: 'ISO 9001 §7.5',
    mainFeatures: [
      'Subida multi-formato (PDF, Word, Excel, imágenes)',
      'Control de versiones automático',
      'Workflow de aprobación con estados',
      'Búsqueda avanzada por código, nombre, tipo',
      'Vinculación a cláusulas normativas'
    ],
    actions: [
      { name: 'Subir documento', description: 'Arrastrá archivo o usá botón de subida.', detail: 'El sistema extrae texto automáticamente para búsqueda y auditoría IA.' },
      { name: 'Ver detalle', description: 'Accedé a metadatos, versiones, historial y cláusulas vinculadas.', detail: 'Podés descargar cualquier versión histórica.' },
      { name: 'Nueva versión', description: 'Subí nueva versión manteniendo historial.', detail: 'Notifica automáticamente a usuarios con versión anterior.' },
      { name: 'Vincular cláusulas', description: 'Asociá a cláusulas normativas para auditoría IA.', detail: 'PRE-REQUISITO obligatorio para que la IA analice este documento.' },
      { name: 'Aprobar documento', description: 'Cambiá estado a "Aprobado" tras revisión.', detail: 'Disponible para todo el personal del tenant.' }
    ],
    steps: [
      { title: 'Subir documento', description: 'Clic en "Nuevo documento".', subSteps: ['Arrastrá archivo o seleccionalo', 'Completá código (PRO-CAL-001), título, tipo', 'Seleccioná proceso al que pertenece', 'Asigná responsable de mantenimiento'] },
      { title: 'Vincular cláusulas', description: 'En detalle del documento, sección "Cláusulas normativas".', subSteps: ['Clic "Vincular cláusula"', 'Seleccioná norma (ej: ISO 39001)', 'Marcá cláusulas aplicables (ej: 5.2, 5.3)', 'Confirmá vinculación'] },
      { title: 'Solicitar aprobación', description: 'Cambiá estado a "En revisión".', subSteps: ['Aprobador recibe notificación', 'Revisa y aprueba o rechaza con comentarios', 'Si aprueba, estado pasa a "Aprobado"'] },
      { title: 'Buscar documento', description: 'Usá barra de búsqueda superior.', subSteps: ['Buscá por código, título o contenido', 'Filtrá por tipo, estado o proceso', 'Resultados instantáneos'] }
    ],
    tips: [
      'Usá código estandarizado (PRO-XXX-NNN) para búsquedas y trazabilidad.',
      'Vinculá SIEMPRE cláusulas antes de usar Auditoría IA: sin vinculación no analiza.',
      'Documentos obsoletos se mantienen para auditoría pero no aparecen en búsquedas por defecto.'
    ],
    related: ['normativos', 'audit-ia', 'auditorias-iso']
  },
  {
    id: 'normativos',
    title: 'Normativos',
    purpose: 'Biblioteca central de normas, leyes, decretos aplicables. Referencia de requisitos legales y normativos.',
    difficulty: 'Medio',
    estimatedTime: '30 minutos por norma',
    isoRef: null,
    mainFeatures: [
      'Listado de normas con código, título, versión, estado',
      'Carga de PDFs oficiales',
      'Extracción automática de cláusulas con IA',
      'Vinculación con documentos internos'
    ],
    actions: [
      { name: 'Nuevo normativo', description: 'Registrá norma con código, título, versión y PDF.', detail: 'Extracción automática de cláusulas con IA (si está configurada).' },
      { name: 'Ver cláusulas', description: 'Consultá contenido estructurado: cláusulas, subcláusulas.', detail: 'Árbol navegable con número, título y contenido.' },
      { name: 'Vincular documentos', description: 'Asociá documentos internos a cláusulas.', detail: 'Base para análisis de cumplimiento de Auditoría IA.' },
      { name: 'Actualizar versión', description: 'Subí nueva versión manteniendo historial.', detail: 'Detecta cambios y alerta sobre documentos vinculados.' }
    ],
    steps: [
      { title: 'Cargar norma', description: 'Clic "Nueva norma".', subSteps: ['Completá código (ISO 39001:2012), título', 'Seleccioná tipo: ISO, Ley, Decreto, Reglamento', 'Subí PDF oficial', 'Marcá estado: En revisión o Vigente'] },
      { title: 'Extraer cláusulas', description: 'Una vez cargado PDF, iniciá extracción con IA.', subSteps: ['Clic "Extraer cláusulas con IA"', 'Procesa PDF y genera árbol de cláusulas', 'Revisá y corregí si es necesario', 'Marcá "Listo para uso"'] },
      { title: 'Vincular documentos', description: 'Navegá cláusulas y vinculá documentos.', subSteps: ['Seleccioná cláusula', 'Clic "Vincular documento"', 'Buscá documento en repositorio', 'Confirmá con tipo de cumplimiento'] },
      { title: 'Seguimiento de cambios', description: 'Cuando actualicés norma, revisá impacto.', subSteps: ['Subí nueva versión PDF', 'Sistema compara con anterior', 'Revisá cláusulas modificadas, agregadas o eliminadas', 'Actualizá documentos vinculados'] }
    ],
    tips: [
      'Priorizá normas ISO que certifiqués y leyes sectoriales obligatorias.',
      'Extracción IA requiere PDF con texto seleccionable (no escaneado sin OCR).',
      'Mantené calendario de revisiones normativas para anticipar cambios.'
    ],
    related: ['documentos', 'cumplimiento', 'audit-ia']
  },
  {
    id: 'audit-ia',
    title: 'Auditoría IA',
    purpose: 'Motor de IA que analiza automáticamente conformidad de documentos contra normas ISO. Detecta brechas con evidencia textual y sugiere acciones concretas.',
    difficulty: 'Medio',
    estimatedTime: '15 minutos (más vinculación)',
    isoRef: 'ISO 19011',
    mainFeatures: [
      'Análisis automático documento vs norma cláusula por cláusula',
      'Análisis profundo con citas textuales',
      'Hallazgos: Obligatorio (MUST) o Recomendado (SHOULD)',
      'Chat con agente IA',
      'Conversión directa a No Conformidades'
    ],
    actions: [
      { name: 'Analizar documento', description: 'Seleccioná documento y norma. Analiza solo cláusulas vinculadas.', detail: 'PRE-REQUISITO: documento debe tener cláusulas vinculadas en Documentos.' },
      { name: 'Ver hallazgos', description: 'Revisá hallazgos con descripción, evidencia y confianza.', detail: 'Incluye: cláusula, severidad, descripción fundamentada, evidencia textual, acciones.' },
      { name: 'Convertir a NC', description: 'Transformá hallazgo en No Conformidad formal.', detail: 'Traspasa título, descripción, cláusula y severidad automáticamente.' },
      { name: 'Chat con IA', description: 'Consultá asistente sobre normas y hallazgos.', detail: 'Tiene contexto de tus documentos y normas para respuestas personalizadas.' }
    ],
    steps: [
      { title: 'Preparar documento', description: 'ANTES de auditar, vinculá cláusulas.', subSteps: ['Andá a Documentos', 'Abrí documento a auditar', 'En "Cláusulas normativas", clic "Vincular"', 'Seleccioná norma y marcá cláusulas aplicables', 'Guardá cambios'] },
      { title: 'Ejecutar análisis', description: 'En Auditoría IA, clic "Analizar Documento vs Norma".', subSteps: ['Seleccioná documento del dropdown', 'Seleccioná norma del dropdown', 'Clic "Iniciar Análisis"', 'Sistema encola trabajo y muestra progreso'] },
      { title: 'Revisar hallazgos', description: 'Cuando estado sea "Completado".', subSteps: ['Cada hallazgo muestra: cláusula, severidad, descripción', 'Evidencia cita textualmente del documento', 'Acciones sugeridas son concretas', 'Porcentaje de confianza indica certeza'] },
      { title: 'Convertir a NC', description: 'Para hallazgos que requieren acción formal.', subSteps: ['Clic "Crear NCR" en hallazgo', 'Confirmá conversión', 'Sistema crea NC con datos pre-cargados'] },
      { title: 'Consultar IA', description: 'Usá Chat Auditor para preguntas.', subSteps: ['Andá a "Chat Auditor"', 'Escribí pregunta (ej: "¿Qué requiere cláusula 5.2 ISO 39001?")', 'IA responde con contexto de tus documentos'] }
    ],
    tips: [
      'Calidad del análisis depende de la calidad de la vinculación: vinculá solo cláusulas aplicables.',
      '5-10 cláusulas tarda segundos; 50+ tarda minutos.',
      'Hallazgos con confianza <70% revisarlos manualmente.',
      'Chat Auditor para profundizar: "¿Por qué este hallazgo es MUST?"',
      'NO reemplaza auditoría interna humana: es herramienta de preparación.'
    ],
    related: ['documentos', 'normativos', 'no-conformidades', 'auditorias-iso']
  },
  {
    id: 'auditorias-iso',
    title: 'Auditorías ISO',
    purpose: 'Gestión completa del programa de auditorías internas conforme ISO 19011: planificación anual, ejecución con checklist, hallazgos, seguimiento e informes.',
    difficulty: 'Avanzado',
    estimatedTime: '2-4 horas por auditoría',
    isoRef: 'ISO 19011:2018',
    mainFeatures: [
      'Programa anual con asignación de auditores',
      'Checklist personalizables por norma',
      'Registro de hallazgos (NC, observaciones, oportunidades)',
      'Gestión de equipo auditor',
      'Informe final exportable'
    ],
    actions: [
      { name: 'Nueva auditoría', description: 'Creá con alcance, norma, fecha, lugar y equipo.', detail: 'Podés crear internas, externas o de seguimiento.' },
      { name: 'Ejecutar checklist', description: 'Completá cada ítem con evidencia.', detail: 'Checklist desde plantillas normativas o personalizadas.' },
      { name: 'Registrar hallazgos', description: 'Agregá con clasificación y evidencia.', detail: 'Vinculación automática a cláusula normativa.' },
      { name: 'Gestionar equipo', description: 'Asigná auditores con roles y competencias.', detail: 'Verifica competencias requeridas según ISO 19011.' },
      { name: 'Generar informe', description: 'Exportá informe final con conclusiones.', detail: 'Portada, resumen, detalle de hallazgos, anexos, plan de acción.' }
    ],
    steps: [
      { title: 'Planificar auditoría', description: 'Clic "Nueva auditoría".', subSteps: ['Definí alcance (ej: "Proceso de producción")', 'Seleccioná norma', 'Asigná fecha y duración', 'Designá auditor líder y equipo', 'Agregá objetivos específicos'] },
      { title: 'Preparar checklist', description: 'Seleccioná o creá checklist.', subSteps: ['Elegí plantilla base', 'Personalizá agregando ítems específicos', 'Asigná peso o criticidad', 'Revisá con equipo'] },
      { title: 'Ejecutar auditoría', description: 'Completá checklist y registrá hallazgos.', subSteps: ['Para cada ítem: Conforme / No conforme / No aplica', 'Adjuntá evidencia (fotos, documentos)', 'Registrá hallazgos inmediatamente', 'Tomá notas de campo'] },
      { title: 'Cerrar hallazgos', description: 'Gestioná NC generadas.', subSteps: ['NC creadas automáticamente desde hallazgos', 'Asigná responsables y plazos', 'Verificá eficacia', 'Cerrá NC resuelta'] },
      { title: 'Generar informe', description: 'Una vez cerrados hallazgos.', subSteps: ['Revisá borrador automático', 'Agregá conclusiones del equipo', 'Exportá a PDF', 'Distribuí a dirección y áreas'] }
    ],
    tips: [
      'Planificá con 2 semanas de anticipación.',
      'Auditores internos NO auditan su propia área (ISO 19011 §4 e).',
      'Guardá evidencia fotográfica de cada hallazgo.',
      'Frecuencia basada en resultados previos, cambios críticos y riesgos.'
    ],
    related: ['audit-ia', 'no-conformidades', 'acciones']
  },
  {
    id: 'no-conformidades',
    title: 'No Conformidades',
    purpose: 'Registro y tratamiento formal de NC. Incluye análisis de causa raíz, acciones correctivas y verificación de eficacia.',
    difficulty: 'Avanzado',
    estimatedTime: '1-2 horas por NC',
    isoRef: 'ISO 9001 §10.2',
    mainFeatures: [
      'Listado con estados: Abierta, En tratamiento, En verificación, Cerrada',
      'Análisis de causa raíz: 5 Porqués, Ishikawa',
      'Plan de acción con responsables y plazos',
      'Verificación de eficacia con evidencia',
      'Origen configurable'
    ],
    actions: [
      { name: 'Nueva NC', description: 'Creá con descripción, origen, severidad, responsable.', detail: 'Descripción objetiva: ej "Falta registro" no "Operario descuidado".' },
      { name: 'Análisis causa raíz', description: 'Documentá análisis sistemático.', detail: 'Guía con 5 Porqués, Ishikawa.' },
      { name: 'Acciones correctivas', description: 'Definí acciones que eliminen causa.', detail: 'Diferenciá correctiva de inmediata (contención).' },
      { name: 'Verificar eficacia', description: 'Confirmá que la acción funcionó.', detail: 'Requiere evidencia de no repetición.' },
      { name: 'Cerrar NC', description: 'Marcá como cerrada tras verificación.', detail: 'Solo autorizados. Genera registro audit trail.' }
    ],
    steps: [
      { title: 'Detectar NC', description: 'En auditoría, inspección o reclamo.', subSteps: ['Describí evidencia objetivamente', 'Clasificá severidad: Crítica, Mayor, Menor, Observación', 'Asigná responsable'] },
      { title: 'Análisis causa raíz', description: 'Usá metodología estructurada.', subSteps: ['5 Porqués: preguntá "¿por qué?" 5 veces', 'Ishikawa: categorizá causas', 'Identificá causa fundamental'] },
      { title: 'Definir acciones', description: 'Correctivas e inmediatas.', subSteps: ['Inmediata: contener efecto', 'Correctiva: eliminar causa raíz', 'Asigná responsable y fecha'] },
      { title: 'Verificar eficacia', description: 'Después del plazo, confirmá.', subSteps: ['Evidencia de no repetición', 'Medí indicador', 'Documentá verificación'] },
      { title: 'Cerrar NC', description: 'Marcá como cerrada.', subSteps: ['Verificá acciones completas', 'Confirmá eficacia', 'Clic "Cerrar NC"'] }
    ],
    tips: [
      'Análisis de causa raíz es clave: sin él las NC se repiten.',
      'Diferenciá inmediata de correctiva.',
      'Verificación requiere TIEMPO: no cierres el mismo día.',
      'NC críticas requieren escalamiento a dirección.'
    ],
    related: ['auditorias-iso', 'acciones', 'audit-ia']
  },
  {
    id: 'riesgos',
    title: 'Riesgos',
    purpose: 'Identificación, evaluación y tratamiento de riesgos del SGI. Alineado con ISO 31000.',
    difficulty: 'Medio',
    estimatedTime: '30 minutos por riesgo',
    isoRef: 'ISO 31000',
    mainFeatures: [
      'Matriz de riesgos por proceso',
      'Evaluación probabilidad × impacto',
      'Planes de tratamiento y controles',
      'Seguimiento periódico'
    ],
    actions: [
      { name: 'Nuevo riesgo', description: 'Identificá con descripción, proceso, evaluación.', detail: 'Probabilidad, impacto y nivel inherente.' },
      { name: 'Agregar control', description: 'Definí controles preventivos o mitigadores.', detail: 'Tipo, responsable y frecuencia.' },
      { name: 'Reevaluar', description: 'Actualizá riesgo residual tras controles.', detail: 'Nuevo nivel considerando efectividad.' }
    ],
    steps: [
      { title: 'Identificar riesgo', description: 'Clic "Nuevo riesgo".', subSteps: ['Describí el riesgo', 'Asociá al proceso', 'Identificá fuente', 'Agregá causas'] },
      { title: 'Evaluar riesgo', description: 'Asigná probabilidad e impacto.', subSteps: ['Probabilidad: 1-5', 'Impacto: 1-5', 'Riesgo inherente = P × I', 'Clasificá: bajo, medio, alto, crítico'] },
      { title: 'Definir controles', description: 'Agregá controles existentes y planificados.', subSteps: ['Preventivo: evita que ocurra', 'Detectivo: detecta si ocurre', 'Correctivo: mitiga efectos', 'Asigná responsable y frecuencia'] },
      { title: 'Reevaluar residual', description: 'Calculá riesgo residual.', subSteps: ['Evaluá efectividad de cada control', 'Recalculá P × I residual', 'Si sigue alto, agregá más controles'] },
      { title: 'Seguimiento', description: 'Revisá periódicamente.', subSteps: ['Mensualmente riesgos críticos', 'Trimestralmente riesgos medios', 'Actualizá si hay cambios'] }
    ],
    tips: [
      'Actualizá riesgos ante cambios organizacionales.',
      'Vinculá riesgos a indicadores para monitoreo.',
      'Riesgos críticos requieren plan de contingencia.',
      'Involucrá al equipo operativo en identificación.'
    ],
    related: ['indicadores', 'auditorias-iso', 'documentos']
  },
  {
    id: 'indicadores',
    title: 'Indicadores',
    purpose: 'Definición y seguimiento de KPIs del sistema. Permite medir eficacia y cumplimiento de objetivos.',
    difficulty: 'Medio',
    estimatedTime: '20 minutos por indicador',
    isoRef: 'ISO 9001 §9.1',
    mainFeatures: [
      'Biblioteca de indicadores con fórmula y meta',
      'Registro de mediciones periódicas',
      'Gráficos de tendencia',
      'Alertas ante desvíos'
    ],
    actions: [
      { name: 'Nuevo indicador', description: 'Definí nombre, fórmula, unidad, meta, frecuencia.', detail: 'Fórmula puede usar datos de otros módulos o ser manual.' },
      { name: 'Cargar medición', description: 'Registrá valor medido en el período.', detail: 'Carga individual o masiva (importación Excel).' },
      { name: 'Ver tendencia', description: 'Entrá al detalle para ver gráfico histórico.', detail: 'Compará contra meta y límites de alerta.' }
    ],
    steps: [
      { title: 'Definir indicador', description: 'Clic "Nuevo indicador".', subSteps: ['Nombrá descriptivamente', 'Definí fórmula', 'Establecí meta y límites', 'Definí frecuencia', 'Asigná responsable'] },
      { title: 'Cargar medición', description: 'En fecha de medición, registrá valor.', subSteps: ['Andá al indicador', 'Clic "Nueva medición"', 'Ingresá valor y fecha', 'Adjuntá evidencia', 'Observá desvío'] },
      { title: 'Analizar tendencia', description: 'Revisá gráfico histórico.', subSteps: ['Identificá tendencias', 'Analizá desvíos', 'Investigá causas', 'Documentá acciones'] },
      { title: 'Configurar alertas', description: 'Definí umbrales de notificación.', subSteps: ['Umbrales: amarillo (atención), rojo (crítico)', 'Configurá email', 'Asigná responsables'] }
    ],
    tips: [
      'KPIs deben ser SMART: Específicos, Medibles, Alcanzables, Relevantes, Temporales.',
      'Evitá más de 10 KPIs por proceso.',
      'Vinculá a objetivos estratégicos.',
      'Revisá pertinencia anualmente.'
    ],
    related: ['panel', 'objetivos', 'reportes']
  },
  {
    id: 'capacitaciones',
    title: 'Capacitaciones',
    purpose: 'Plan anual de capacitación: necesidades, cursos, asistencia y evaluación de eficacia.',
    difficulty: 'Medio',
    estimatedTime: '30 minutos por curso',
    isoRef: 'ISO 9001 §7.2',
    mainFeatures: [
      'Plan anual de capacitaciones',
      'Registro de asistencia',
      'Evaluación pre/post',
      'Certificados asociados',
      'Vinculación con brechas de competencias'
    ],
    actions: [
      { name: 'Nueva capacitación', description: 'Programá curso con tema, fecha, duración, instructor.', detail: 'Vinculable a competencias y empleados específicos.' },
      { name: 'Marcar asistencia', description: 'Registrá empleados que asistieron.', detail: 'Importación masiva o marcación individual.' },
      { name: 'Evaluar eficacia', description: 'Completa encuesta/test al concluir.', detail: 'Nivel 1 (reacción), Nivel 2 (aprendizaje), Nivel 3 (aplicación).' }
    ],
    steps: [
      { title: 'Detectar necesidad', description: 'Identificá brechas de competencias.', subSteps: ['Revisá Matriz de Polivalencia', 'Revisá resultados de auditorías', 'Consultá con jefes', 'Documentá necesidades'] },
      { title: 'Programar capacitación', description: 'Clic "Nueva capacitación".', subSteps: ['Definí tema/objetivo', 'Seleccioná fecha y duración', 'Asigná instructor', 'Definí método', 'Establecí presupuesto'] },
      { title: 'Inscribir participantes', description: 'Agregá empleados al curso.', subSteps: ['Buscá por nombre o perfil', 'Verificá prerequisitos', 'Confirmá disponibilidad'] },
      { title: 'Ejecutar curso', description: 'Durante la capacitación, registrá asistencia.', subSteps: ['Marcá asistencia día por día', 'Adjuntá material didáctico', 'Registrá observaciones'] },
      { title: 'Evaluar eficacia', description: 'Después del curso, aplicá evaluación.', subSteps: ['Nivel 1: encuesta de satisfacción', 'Nivel 2: test de aprendizaje', 'Nivel 3: seguimiento a los 30/60/90 días', 'Documentá resultados'] }
    ],
    tips: [
      'Todo programa de capacitación debe partir de necesidades detectadas, no de cursos disponibles.',
      'Evaluá efecticacia a los 30/60/90 días: ¿se aplica lo aprendido?',
      'Vinculá capacitaciones a brechas de la Matriz de Polivalencia.',
      'Guardá certificados de instructores externos como evidencia.'
    ],
    related: ['rrhh', 'indicadores', 'auditorias-iso']
  },
  {
    id: 'rrhh',
    title: 'RRHH / Empleados',
    purpose: 'Gestión de personal del SGI: datos, competencias, evaluaciones y capacitaciones.',
    difficulty: 'Fácil',
    estimatedTime: '10 minutos',
    isoRef: 'ISO 9001 §7.2',
    mainFeatures: [
      'Directorio de empleados',
      'Competencias y matriz de polivalencia',
      'Historial de capacitaciones',
      'Evaluaciones de desempeño'
    ],
    actions: [
      { name: 'Nuevo empleado', description: 'Registrá datos personales y laborales.', detail: 'Incluye puesto, área, fecha ingreso.' },
      { name: 'Competencias', description: 'Asigná competencias requeridas por puesto.', detail: 'Vincula a Matriz de Polivalencia.' }
    ],
    steps: [
      { title: 'Crear empleado', description: 'Clic "Nuevo empleado".', subSteps: ['Completá datos', 'Asigná puesto', 'Guardá'] },
      { title: 'Asignar competencias', description: 'En perfil del empleado.', subSteps: ['Seleccioná competencias', 'Definí nivel DEBE', 'Guardá'] }
    ],
    tips: [
      'Mantené actualizados datos y competencias.',
      'Usá matriz para detectar brechas de capacitación.'
    ],
    related: ['capacitaciones', 'indicadores']
  },
  {
    id: 'clientes',
    title: 'Clientes',
    purpose: 'Base de clientes y partes interesadas del negocio.',
    difficulty: 'Fácil',
    estimatedTime: '5 minutos',
    mainFeatures: [
      'Directorio de clientes',
      'Segmentación',
      'Historial de interacciones'
    ],
    actions: [
      { name: 'Nuevo cliente', description: 'Registrá datos de contacto.', detail: 'Incluye datos fiscales y comerciales.' },
      { name: 'Ver historial', description: 'Consultá interacciones y documentos.', detail: 'Trazabilidad completa.' }
    ],
    steps: [
      { title: 'Crear cliente', description: 'Clic "Nuevo cliente".', subSteps: ['Completá datos', 'Guardá'] }
    ],
    tips: ['Mantené datos actualizados.'],
    related: ['partes-interesadas', 'documentos']
  },
  {
    id: 'proveedores',
    title: 'Proveedores',
    purpose: 'Gestión de proveedores y evaluación de desempeño.',
    difficulty: 'Fácil',
    estimatedTime: '10 minutos',
    mainFeatures: [
      'Registro de proveedores',
      'Evaluaciones',
      'Historial'
    ],
    actions: [
      { name: 'Nuevo proveedor', description: 'Registrá proveedor.', detail: 'Datos comerciales, contacto.' }
    ],
    steps: [
      { title: 'Registrar', description: 'Clic "Nuevo proveedor".', subSteps: ['Completá datos', 'Asigná categoría', 'Guardá'] }
    ],
    tips: ['Evaluá desempeño periódicamente.'],
    related: ['documentos', 'calidad']
  },
  {
    id: 'project360',
    title: 'Proyectos',
    purpose: 'Gestión integral de proyectos del SGI: mejoras, implementaciones, certificaciones.',
    difficulty: 'Medio',
    estimatedTime: '20 minutos',
    isoRef: 'ISO 9001 §6.2',
    mainFeatures: [
      'Proyectos activos y archivados',
      'Tableros Kanban personalizables',
      'Asignación de responsables y fechas',
      'Adjuntos y comentarios por proyecto'
    ],
    actions: [
      { name: 'Nuevo proyecto', description: 'Creá con nombre, descripción, responsable, fechas y presupuesto.', detail: 'Podés vincular a normativas ISO específicas.' },
      { name: 'Ver detalle', description: 'Entrá para gestionar tareas, archivos y comentarios.', detail: 'Incluye timeline, tareas, archivos adjuntos y log.' },
      { name: 'Cambiar estado', description: 'Mové tarjetas entre columnas en Kanban.', detail: 'Arrastrá y soltá para actualizar estado visualmente.' },
      { name: 'Archivar proyecto', description: 'Marcá como completado y archivalo.', detail: 'Siguen siendo buscables pero no aparecen en activos.' }
    ],
    steps: [
      { title: 'Crear proyecto', description: 'Clic "Nuevo Proyecto".', subSteps: ['Completá nombre descriptivo', 'Asigná responsable principal', 'Definí fechas de inicio y objetivo', 'Opcional: asigná presupuesto'] },
      { title: 'Agregar tareas', description: 'Dentro del proyecto, agregá tareas.', subSteps: ['Clic "Nueva tarea"', 'Describí la tarea concreta', 'Asigná responsable y fecha límite', 'Marcá dependencias si aplica'] },
      { title: 'Seguimiento Kanban', description: 'Usá vista Kanban para visualizar avance.', subSteps: ['Columnas: Backlog | En progreso | Revisión | Completado', 'Arrastrá tareas entre columnas', 'Registro automático de quién movió y cuándo'] },
      { title: 'Cerrar proyecto', description: 'Cuando todas las tareas estén completas.', subSteps: ['Verificá que no queden pendientes', 'Clic "Archivar proyecto"', 'Agregá resumen final y lecciones aprendidas'] }
    ],
    tips: [
      'Vinculá proyectos a objetivos del SGI para trazabilidad (ISO 9001 §6.2).',
      'Usá presupuesto para controlar inversiones.',
      'Proyectos archivados son evidencia para auditorías externas.'
    ],
    related: ['dashboard', 'documentos', 'indicadores']
  },
  {
    id: 'revision-direccion',
    title: 'Revisión por la Dirección',
    purpose: 'Gestión de revisiones por la dirección según ISO 9001 §9.3.',
    difficulty: 'Avanzado',
    estimatedTime: '2 horas',
    isoRef: 'ISO 9001 §9.3',
    mainFeatures: [
      'Agenda de revisión',
      'Entradas requeridas',
      'Actas y decisiones'
    ],
    actions: [
      { name: 'Nueva revisión', description: 'Programá revisión por la dirección.', detail: 'Fecha, participantes, agenda.' }
    ],
    steps: [
      { title: 'Programar', description: 'Clic "Nueva revisión".', subSteps: ['Definí fecha', 'Invitá participantes', 'Prepará entradas'] }
    ],
    tips: ['Realizá al menos una vez al año.'],
    related: ['panel', 'indicadores']
  },
  {
    id: 'licencias',
    title: 'Licencias',
    purpose: 'Gestión de licencias, permisos y autorizaciones legales.',
    difficulty: 'Fácil',
    estimatedTime: '10 minutos',
    mainFeatures: [
      'Registro de licencias',
      'Alertas de vencimiento',
      'Documentos asociados'
    ],
    actions: [
      { name: 'Nueva licencia', description: 'Registrá tipo, entidad, vencimiento.', detail: 'Alertas automáticas.' }
    ],
    steps: [
      { title: 'Crear licencia', description: 'Clic "Nueva licencia".', subSteps: ['Completá datos', 'Asociá documentos', 'Guardá'] }
    ],
    tips: ['Configurá alertas con anticipación suficiente.'],
    related: ['legales', 'documentos']
  },
  {
    id: 'calendario',
    title: 'Calendario',
    purpose: 'Calendario de eventos, auditorías, capacitaciones y vencimientos.',
    difficulty: 'Fácil',
    estimatedTime: '2 minutos',
    mainFeatures: [
      'Vista mensual/semanal/diaria',
      'Eventos de todos los módulos',
      'Filtros por tipo'
    ],
    actions: [
      { name: 'Ver eventos', description: 'Navegá por fechas.', detail: 'Cliqueá para ir al módulo origen.' }
    ],
    steps: [
      { title: 'Consultar calendario', description: 'Clic en evento.', subSteps: ['Navegá fechas', 'Filtrá por tipo', 'Cliqueá para detalle'] }
    ],
    tips: ['Usá filtros para enfocarte.'],
    related: ['auditorias-iso', 'capacitaciones']
  },
  {
    id: 'configuracion',
    title: 'Configuración',
    purpose: 'Configuración del sistema y preferencias del tenant.',
    difficulty: 'Fácil',
    estimatedTime: '10 minutos',
    mainFeatures: [
      'Datos de la empresa',
      'Preferencias del sistema',
      'Gestión de usuarios y roles'
    ],
    actions: [
      { name: 'Empresa', description: 'Configurá datos fiscales y de contacto.', detail: 'Logo, dirección, etc.' },
      { name: 'Usuarios', description: 'Gestión de accesos.', detail: 'Crear, editar, desactivar usuarios.' }
    ],
    steps: [
      { title: 'Configurar empresa', description: 'Clic "Empresa".', subSteps: ['Completá datos', 'Subí logo', 'Guardá'] }
    ],
    tips: ['Configurá correctamente los datos fiscales.'],
    related: ['empresa']
  },
  {
    id: 'reportes',
    title: 'Reportes',
    purpose: 'Generación de reportes e informes del sistema.',
    difficulty: 'Fácil',
    estimatedTime: '5 minutos',
    mainFeatures: [
      'Reportes predefinidos',
      'Personalización',
      'Exportación'
    ],
    actions: [
      { name: 'Generar reporte', description: 'Seleccioná reporte y filtros.', detail: 'PDF, Excel, etc.' }
    ],
    steps: [
      { title: 'Generar reporte', description: 'Seleccioná reporte.', subSteps: ['Elegí tipo', 'Aplicá filtros', 'Exportá'] }
    ],
    tips: ['Usá reportes para reuniones.'],
    related: ['panel', 'indicadores']
  },
  {
    id: 'notificaciones',
    title: 'Notificaciones',
    purpose: 'Centro de notificaciones y alertas del sistema.',
    difficulty: 'Fácil',
    estimatedTime: '2 minutos',
    mainFeatures: [
      'Bandeja de notificaciones',
      'Preferencias de notificación',
      'Historial'
    ],
    actions: [
      { name: 'Ver notificaciones', description: 'Consultá alertas pendientes.', detail: 'Cliqueá para ir al módulo origen.' },
      { name: 'Configurar', description: 'Definí preferencias.', detail: 'Email, push, in-app.' }
    ],
    steps: [
      { title: 'Consultar notificaciones', description: 'Clic en icono de campana.', subSteps: ['Revisá lista', 'Cliqueá para ir al origen'] }
    ],
    tips: ['No ignores notificaciones rojas.'],
    related: ['panel', 'inicio']
  },
  {
    id: 'simulacros',
    title: 'Simulacros',
    purpose: 'Gestión de simulacros y ejercicios de emergencia.',
    difficulty: 'Medio',
    estimatedTime: '20 minutos',
    mainFeatures: [
      'Planificación de simulacros',
      'Registro de participantes',
      'Evaluación de resultados'
    ],
    actions: [
      { name: 'Nuevo simulacro', description: 'Programá simulacro de emergencia.', detail: 'Tipo, fecha, escenario.' }
    ],
    steps: [
      { title: 'Programar simulacro', description: 'Clic "Nuevo simulacro".', subSteps: ['Definí escenario', 'Asigná fecha', 'Involucrá participantes'] }
    ],
    tips: ['Ejecutá simulacros periódicamente.'],
    related: ['emergencia']
  },
  {
    id: 'mantenimiento',
    title: 'Mantenimiento',
    purpose: 'Gestión de mantenimiento preventivo y correctivo de activos.',
    difficulty: 'Medio',
    estimatedTime: '15 minutos',
    mainFeatures: [
      'Plan de mantenimiento',
      'Órdenes de trabajo',
      'Historial de mantenimiento'
    ],
    actions: [
      { name: 'Nueva orden', description: 'Creá orden de mantenimiento.', detail: 'Preventivo o correctivo.' }
    ],
    steps: [
      { title: 'Crear orden', description: 'Clic "Nueva orden".', subSteps: ['Seleccioná activo', 'Definí tipo', 'Asigná técnico'] }
    ],
    tips: ['Priorizá mantenimiento preventivo.'],
    related: ['activos']
  },
  {
    id: 'activos',
    title: 'Activos',
    purpose: 'Inventario y gestión de activos de la organización.',
    difficulty: 'Fácil',
    estimatedTime: '5 minutos',
    mainFeatures: [
      'Registro de activos',
      'Asignación',
      'Historial'
    ],
    actions: [
      { name: 'Nuevo activo', description: 'Registrá activo.', detail: 'Código, ubicación, estado.' }
    ],
    steps: [
      { title: 'Crear activo', description: 'Clic "Nuevo activo".', subSteps: ['Completá datos', 'Asigná ubicación', 'Guardá'] }
    ],
    tips: ['Mantené inventario actualizado.'],
    related: ['mantenimiento']
  },
  {
    id: 'incidentes',
    title: 'Incidentes',
    purpose: 'Registro y seguimiento de incidentes de seguridad.',
    difficulty: 'Medio',
    estimatedTime: '20 minutos',
    mainFeatures: [
      'Registro de incidentes',
      'Investigación',
      'Acciones correctivas'
    ],
    actions: [
      { name: 'Nuevo incidente', description: 'Registrá incidente.', detail: 'Descripción, fecha, involucrados.' }
    ],
    steps: [
      { title: 'Registrar incidente', description: 'Clic "Nuevo incidente".', subSteps: ['Describí', 'Clasificá', 'Asigná responsable'] }
    ],
    tips: ['Investigá toda lesión.'],
    related: ['no-conformidades', 'riesgos']
  },
  {
    id: 'cumplimiento',
    title: 'Cumplimiento',
    purpose: 'Seguimiento de cumplimiento normativo y legal.',
    difficulty: 'Medio',
    estimatedTime: '30 minutos',
    mainFeatures: [
      'Requisitos legales',
      'Evaluaciones de cumplimiento',
      'Acciones correctivas'
    ],
    actions: [
      { name: 'Nueva evaluación', description: 'Evaluá cumplimiento de requisito.', detail: 'Cumple / No cumple / En progreso.' }
    ],
    steps: [
      { title: 'Evaluar cumplimiento', description: 'Clic "Nueva evaluación".', subSteps: ['Seleccioná requisito', 'Evaluá estado', 'Documentá evidencia'] }
    ],
    tips: ['Revisá cambios regulatorios.'],
    related: ['normativos', 'legales']
  },
  {
    id: 'contexto-sgi',
    title: 'Contexto SGI',
    purpose: 'Contexto específico del Sistema de Gestión Integral.',
    difficulty: 'Medio',
    estimatedTime: '1 hora',
    mainFeatures: [
      'Análisis de contexto',
      'Partes interesadas SGI',
      'Alcance'
    ],
    actions: [
      { name: 'Definir alcance', description: 'Establecé alcance del SGI.', detail: 'Productos, servicios, ubicaciones.' }
    ],
    steps: [
      { title: 'Definir', description: 'Clic "Definir alcance".', subSteps: ['Describí productos/servicios', 'Definí ubicaciones', 'Exclusiones si aplica'] }
    ],
    tips: ['Revisá anualmente.'],
    related: ['contexto', 'partes-interesadas']
  },
  {
    id: 'legales',
    title: 'Requisitos Legales',
    purpose: 'Repositorio de requisitos legales aplicables.',
    difficulty: 'Medio',
    estimatedTime: '20 minutos',
    mainFeatures: [
      'Registro de requisitos',
      'Evaluaciones de cumplimiento',
      'Vinculación normativa'
    ],
    actions: [
      { name: 'Nuevo requisito', description: 'Registrá requisito legal.', detail: 'Norma, artículo, descripción.' }
    ],
    steps: [
      { title: 'Crear requisito', description: 'Clic "Nuevo requisito".', subSteps: ['Completá datos', 'Vinculá norma', 'Guardá'] }
    ],
    tips: ['Revisá cambios regulatorios.'],
    related: ['normativos', 'cumplimiento']
  },
  {
    id: 'acciones',
    title: 'Acciones',
    purpose: 'Seguimiento de acciones correctivas, preventivas y de mejora.',
    difficulty: 'Fácil',
    estimatedTime: '5 minutos',
    mainFeatures: [
      'Listado de acciones',
      'Estados y plazos',
      'Responsables y seguimiento'
    ],
    actions: [
      { name: 'Nueva acción', description: 'Creá acción.', detail: 'Tipo, descripción, responsable, plazo.' }
    ],
    steps: [
      { title: 'Crear acción', description: 'Clic "Nueva acción".', subSteps: ['Describí', 'Asigná responsable', 'Definí plazo'] }
    ],
    tips: ['Seguimiento periódico.'],
    related: ['no-conformidades', 'auditorias-iso']
  },
  {
    id: 'planes',
    title: 'Planes',
    purpose: 'Planes de acción y mejora del SGI.',
    difficulty: 'Medio',
    estimatedTime: '30 minutos',
    mainFeatures: [
      'Planes estratégicos',
      'Planes operativos',
      'Seguimiento'
    ],
    actions: [
      { name: 'Nuevo plan', description: 'Creá plan de acción.', detail: 'Objetivos, acciones, plazos.' }
    ],
    steps: [
      { title: 'Crear plan', description: 'Clic "Nuevo plan".', subSteps: ['Definí objetivos', 'Asigná acciones', 'Establecí plazos'] }
    ],
    tips: ['Vinculá a objetivos.'],
    related: ['objetivos', 'indicadores']
  },
  {
    id: 'objetivos',
    title: 'Objetivos',
    purpose: 'Objetivos del SGI medibles y alcanzables.',
    difficulty: 'Medio',
    estimatedTime: '20 minutos',
    mainFeatures: [
      'Objetivos estratégicos',
      'KPIs asociados',
      'Seguimiento'
    ],
    actions: [
      { name: 'Nuevo objetivo', description: 'Definí objetivo SMART.', detail: 'Específico, medible, alcanzable.' }
    ],
    steps: [
      { title: 'Crear objetivo', description: 'Clic "Nuevo objetivo".', subSteps: ['Describí', 'Asigná indicadores', 'Guardá'] }
    ],
    tips: ['Revisá al menos anualmente.'],
    related: ['planes', 'indicadores']
  },
  {
    id: 'encuestas',
    title: 'Encuestas',
    purpose: 'Creación y aplicación de encuestas de satisfacción y clima.',
    difficulty: 'Fácil',
    estimatedTime: '15 minutos',
    mainFeatures: [
      'Creador de encuestas',
      'Aplicación',
      'Resultados y análisis'
    ],
    actions: [
      { name: 'Nueva encuesta', description: 'Creá encuesta.', detail: 'Preguntas, respuestas, lógica.' }
    ],
    steps: [
      { title: 'Crear encuesta', description: 'Clic "Nueva encuesta".', subSteps: ['Definí preguntas', 'Configurá respuestas', 'Publicá'] }
    ],
    tips: ['Anonimizá encuestas de clima.'],
    related: ['clientes', 'rrhh']
  },
  {
    id: 'gestion-cambios',
    title: 'Gestión de Cambios',
    purpose: 'Control de cambios en procesos, productos o infraestructura.',
    difficulty: 'Medio',
    estimatedTime: '20 minutos',
    mainFeatures: [
      'Solicitudes de cambio',
      'Evaluación de impacto',
      'Aprobaciones'
    ],
    actions: [
      { name: 'Nueva solicitud', description: 'Solicitá cambio formalmente.', detail: 'Descripción, justificación, impacto.' }
    ],
    steps: [
      { title: 'Solicitar cambio', description: 'Clic "Nueva solicitud".', subSteps: ['Describí cambio', 'Evaluá impacto', 'Solicitá aprobación'] }
    ],
    tips: ['Evaluá impacto antes de aprobar.'],
    related: ['documentos', 'no-conformidades']
  },
  {
    id: 'infraestructura',
    title: 'Infraestructura',
    purpose: 'Gestión de infraestructura, instalaciones y equipamiento.',
    difficulty: 'Fácil',
    estimatedTime: '10 minutos',
    mainFeatures: [
      'Registro de infraestructura',
      'Mantenimiento asociado',
      'Planificación'
    ],
    actions: [
      { name: 'Nueva infraestructura', description: 'Registrá instalación o equipo.', detail: 'Ubicación, capacidad, estado.' }
    ],
    steps: [
      { title: 'Crear infraestructura', description: 'Clic "Nueva".', subSteps: ['Completá datos', 'Asigná ubicación', 'Guardá'] }
    ],
    tips: ['Vinculá a mantenimiento.'],
    related: ['mantenimiento', 'activos']
  },
  {
    id: 'iperc',
    title: 'IPERC',
    purpose: 'Identificación de Peligros y Evaluación de Riesgos de Cargos (IPERC).',
    difficulty: 'Medio',
    estimatedTime: '30 minutos',
    mainFeatures: [
      'Identificación de peligros por puesto',
      'Evaluación de riesgos',
      'Medidas de control'
    ],
    actions: [
      { name: 'Nueva evaluación IPERC', description: 'Evaluá riesgos de un puesto.', detail: 'Peligros, riesgos, controles.' }
    ],
    steps: [
      { title: 'Crear IPERC', description: 'Clic "Nueva evaluación".', subSteps: ['Seleccioná puesto', 'Identificá peligros', 'Evaluá riesgos', 'Definí controles'] }
    ],
    tips: ['Actualizá ante cambios de proceso.'],
    related: ['riesgos', 'rrhh']
  },
  {
    id: 'calibraciones',
    title: 'Calibraciones',
    purpose: 'Programa de calibración de equipos de medición.',
    difficulty: 'Medio',
    estimatedTime: '15 minutos',
    mainFeatures: [
      'Inventario de equipos',
      'Programa de calibración',
      'Certificados'
    ],
    actions: [
      { name: 'Nuevo equipo', description: 'Registrá equipo de medición.', detail: 'Código, rango, tolerancia.' },
      { name: 'Programar calibración', description: 'Agendá calibración.', detail: 'Fecha, laboratorio, certificado.' }
    ],
    steps: [
      { title: 'Registrar equipo', description: 'Clic "Nuevo equipo".', subSteps: ['Completá datos', 'Definí frecuencia', 'Guardá'] },
      { title: 'Programar', description: 'Clic "Programar calibración".', subSteps: ['Seleccioná fecha', 'Elegí laboratorio', 'Guardá'] }
    ],
    tips: ['No operés equipos vencidos.'],
    related: ['mantenimiento', 'activos']
  },
  {
    id: 'contexto',
    title: 'Contexto de la Organización',
    purpose: 'Análisis del contexto organizacional según ISO 9001 §4.',
    difficulty: 'Medio',
    estimatedTime: '1 hora',
    mainFeatures: [
      'Análisis FODA',
      'Partes interesadas',
      'Alcance del SGI'
    ],
    actions: [
      { name: 'Nuevo análisis', description: 'Registrá análisis FODA.', detail: 'Fortalezas, oportunidades, debilidades, amenazas.' }
    ],
    steps: [
      { title: 'Crear análisis', description: 'Clic "Nuevo análisis".', subSteps: ['Completá FODA', 'Vinculá partes interesadas', 'Guardá'] }
    ],
    tips: ['Actualizá anualmente.'],
    related: ['partes-interesadas', 'riesgos']
  },
  {
    id: 'partes-interesadas',
    title: 'Partes Interesadas',
    purpose: 'Identificación y gestión de partes interesadas del SGI.',
    difficulty: 'Fácil',
    estimatedTime: '15 minutos',
    mainFeatures: [
      'Registro de partes interesadas',
      'Necesidades y expectativas',
      'Seguimiento'
    ],
    actions: [
      { name: 'Nueva parte', description: 'Registrá parte interesada.', detail: 'Cliente, proveedor, autoridad, etc.' }
    ],
    steps: [
      { title: 'Registrar parte', description: 'Clic "Nueva parte".', subSteps: ['Completá datos', 'Definí necesidades', 'Guardá'] }
    ],
    tips: ['Revisá anualmente.'],
    related: ['contexto', 'clientes']
  },
  {
    id: 'calidad',
    title: 'Calidad',
    purpose: 'Módulo de gestión de calidad: procesos, procedimientos y controles.',
    difficulty: 'Medio',
    estimatedTime: '30 minutos',
    mainFeatures: [
      'Procesos de calidad',
      'Controles de calidad',
      'Mejora continua'
    ],
    actions: [
      { name: 'Nuevo proceso', description: 'Registrá proceso de calidad.', detail: 'Mapa de proceso, responsable.' }
    ],
    steps: [
      { title: 'Crear proceso', description: 'Clic "Nuevo proceso".', subSteps: ['Definí entradas/salidas', 'Asigná responsable', 'Guardá'] }
    ],
    tips: ['Mapeá procesos clave.'],
    related: ['documentos', 'indicadores']
  },
  {
    id: 'ambientales',
    title: 'Ambientales',
    purpose: 'Gestión de aspectos e impactos ambientales.',
    difficulty: 'Medio',
    estimatedTime: '20 minutos',
    mainFeatures: [
      'Aspectos ambientales',
      'Impactos',
      'Programas de gestión'
    ],
    actions: [
      { name: 'Nuevo aspecto', description: 'Registrá aspecto ambiental.', detail: 'Tipo, magnitud, significancia.' }
    ],
    steps: [
      { title: 'Crear aspecto', description: 'Clic "Nuevo aspecto".', subSteps: ['Describí', 'Evaluá significancia', 'Guardá'] }
    ],
    tips: ['Revisá significancia periódicamente.'],
    related: ['riesgos', 'indicadores']
  },
  {
    id: 'seguridad360',
    title: 'Seguridad 360',
    purpose: 'Gestión integral de seguridad y salud ocupacional.',
    difficulty: 'Medio',
    estimatedTime: '1 hora',
    mainFeatures: [
      'Análisis de riesgos SST',
      'Incidentes',
      'Indicadores SST'
    ],
    actions: [
      { name: 'Nuevo análisis', description: 'Evaluá riesgos SST.', detail: 'Puestos, peligros, controles.' }
    ],
    steps: [
      { title: 'Evaluar', description: 'Clic "Nuevo análisis".', subSteps: ['Seleccioná puesto', 'Identificá peligros', 'Evaluá riesgos', 'Definí controles'] }
    ],
    tips: ['Actualizá ante cambios de proceso.'],
    related: ['incidentes', 'iperc', 'riesgos']
  },
  {
    id: 'audit360',
    title: 'Audit360',
    purpose: 'Auditorías integrales 360° del sistema de gestión.',
    difficulty: 'Avanzado',
    estimatedTime: '4-8 horas',
    mainFeatures: [
      'Auditorías multidimensionales',
      'Evaluación 360°',
      'Plan de acción'
    ],
    actions: [
      { name: 'Nueva auditoría 360', description: 'Iniciá auditoría integral.', detail: 'Cubre todos los módulos del SGI.' }
    ],
    steps: [
      { title: 'Iniciar', description: 'Clic "Nueva auditoría 360".', subSteps: ['Definí alcance', 'Asigná equipo', 'Programá fechas'] }
    ],
    tips: ['Auditoría integral anual recomendada.'],
    related: ['auditorias-iso', 'audit-ia']
  },
  {
    id: 'auditoria',
    title: 'Auditoría',
    purpose: 'Auditorías y evaluaciones del sistema.',
    difficulty: 'Medio',
    estimatedTime: '20 minutos',
    mainFeatures: [
      'Programa de auditorías',
      'Evaluaciones',
      'Hallazgos'
    ],
    actions: [
      { name: 'Nueva auditoría', description: 'Programá auditoría.', detail: 'Tipo, alcance, fecha.' }
    ],
    steps: [
      { title: 'Programar', description: 'Clic "Nueva auditoría".', subSteps: ['Definí tipo', 'Asigná alcance', 'Programá fecha'] }
    ],
    tips: ['Diferenciá tipos de auditoría.'],
    related: ['auditorias-iso', 'audit-ia']
  }
];

// Función para generar el HTML del manual
function generateManualHTML() {
  const now = new Date().toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Manual del Centro de Ayuda - SGI 360</title>
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
    }
    
    .cover {
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      text-align: center;
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      color: white;
      padding: 40px;
    }
    
    .cover h1 {
      font-size: 36pt;
      margin-bottom: 20px;
      font-weight: 700;
    }
    
    .cover .subtitle {
      font-size: 18pt;
      margin-bottom: 40px;
      opacity: 0.9;
    }
    
    .cover .meta {
      font-size: 12pt;
      opacity: 0.8;
    }
    
    .cover .logo-placeholder {
      width: 120px;
      height: 120px;
      background: white;
      border-radius: 20px;
      margin-bottom: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #1e40af;
      font-size: 48pt;
      font-weight: bold;
    }
    
    .toc {
      page-break-after: always;
      padding: 20px 0;
    }
    
    .toc h2 {
      color: #1e40af;
      border-bottom: 2px solid #1e40af;
      padding-bottom: 10px;
      margin-bottom: 30px;
    }
    
    .toc ul {
      list-style: none;
      padding: 0;
    }
    
    .toc li {
      margin: 8px 0;
      padding: 8px 0;
      border-bottom: 1px dotted #ccc;
      display: flex;
      justify-content: space-between;
    }
    
    .toc a {
      color: #333;
      text-decoration: none;
    }
    
    .toc .difficulty {
      font-size: 9pt;
      padding: 2px 8px;
      border-radius: 10px;
    }
    
    .difficulty-facil { background: #dcfce7; color: #166534; }
    .difficulty-medio { background: #fef3c7; color: #92400e; }
    .difficulty-avanzado { background: #fee2e2; color: #991b1b; }
    
    .module {
      page-break-before: always;
      padding: 20px 0;
    }
    
    .module-header {
      background: #f8fafc;
      border-left: 5px solid #1e40af;
      padding: 20px;
      margin-bottom: 25px;
    }
    
    .module-header h2 {
      color: #1e40af;
      margin: 0 0 10px 0;
      font-size: 20pt;
    }
    
    .module-meta {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      font-size: 10pt;
    }
    
    .badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-weight: 600;
    }
    
    .section {
      margin: 20px 0;
    }
    
    .section h3 {
      color: #1e40af;
      font-size: 14pt;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 8px;
      margin-bottom: 15px;
    }
    
    .section h4 {
      color: #374151;
      font-size: 12pt;
      margin: 15px 0 10px 0;
    }
    
    .purpose {
      background: #eff6ff;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #3b82f6;
      margin: 15px 0;
    }
    
    .features-list {
      list-style: none;
      padding: 0;
    }
    
    .features-list li {
      padding: 8px 0 8px 25px;
      position: relative;
    }
    
    .features-list li::before {
      content: "●";
      color: #3b82f6;
      position: absolute;
      left: 0;
    }
    
    .action-box {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 15px;
      margin: 10px 0;
    }
    
    .action-box h4 {
      color: #1e40af;
      margin: 0 0 8px 0;
      font-size: 11pt;
    }
    
    .action-box p {
      margin: 5px 0;
      font-size: 10pt;
    }
    
    .action-box .detail {
      color: #6b7280;
      font-style: italic;
    }
    
    .step {
      margin: 15px 0;
      padding: 15px;
      background: #f8fafc;
      border-radius: 8px;
    }
    
    .step-number {
      display: inline-block;
      width: 28px;
      height: 28px;
      background: #1e40af;
      color: white;
      border-radius: 50%;
      text-align: center;
      line-height: 28px;
      font-weight: bold;
      margin-right: 10px;
    }
    
    .step h4 {
      display: inline;
      color: #1f2937;
    }
    
    .substeps {
      margin: 10px 0 0 40px;
      padding: 0;
      list-style: none;
    }
    
    .substeps li {
      padding: 5px 0;
      font-size: 10pt;
      color: #4b5563;
    }
    
    .substeps li::before {
      content: "✓";
      color: #10b981;
      margin-right: 8px;
    }
    
    .tips-box {
      background: #fefce8;
      border: 1px solid #fde047;
      border-radius: 8px;
      padding: 15px;
      margin: 20px 0;
    }
    
    .tips-box h4 {
      color: #854d0e;
      margin: 0 0 10px 0;
    }
    
    .tips-box ul {
      margin: 0;
      padding-left: 20px;
    }
    
    .tips-box li {
      color: #713f12;
      margin: 5px 0;
    }
    
    .related {
      margin-top: 20px;
      padding: 15px;
      background: #f3f4f6;
      border-radius: 8px;
      font-size: 10pt;
    }
    
    .related strong {
      color: #374151;
    }
    
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 9pt;
      color: #6b7280;
      padding: 10px;
      border-top: 1px solid #e5e7eb;
    }
    
    .page-number:after {
      content: counter(page);
    }
    
    @media print {
      .module {
        page-break-inside: avoid;
      }
      
      .action-box, .step, .tips-box {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <!-- PORTADA -->
  <div class="cover">
    <div class="logo-placeholder">SGI</div>
    <h1>Manual del Centro de Ayuda</h1>
    <div class="subtitle">Guías paso a paso, funcionalidades y buenas prácticas<br>de cada módulo del Sistema de Gestión Integral 360</div>
    <div class="meta">
      <p>Documento generado el ${now}</p>
      <p>Versión 1.0</p>
    </div>
  </div>
  
  <!-- TABLA DE CONTENIDOS -->
  <div class="toc">
    <h2>📑 Tabla de Contenidos</h2>
    <ul>`;

  // Agregar índice
  guides.forEach((guide, index) => {
    const difficultyClass = `difficulty-${guide.difficulty.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`;
    html += `
      <li>
        <a href="#module-${guide.id}">${index + 1}. ${guide.title}</a>
        <span class="badge difficulty ${difficultyClass}">${guide.difficulty}</span>
      </li>`;
  });

  html += `
    </ul>
  </div>
  
  <!-- MÓDULOS -->
  <div class="modules">`;

  // Agregar cada módulo
  guides.forEach((guide, index) => {
    const difficultyClass = `difficulty-${guide.difficulty.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`;
    
    html += `
  <div class="module" id="module-${guide.id}">
    <div class="module-header">
      <h2>${index + 1}. ${guide.title}</h2>
      <div class="module-meta">
        <span class="badge ${difficultyClass}">Dificultad: ${guide.difficulty}</span>
        <span class="badge">⏱️ ${guide.estimatedTime}</span>
        ${guide.isoRef ? `<span class="badge">📋 ${guide.isoRef}</span>` : ''}
      </div>
    </div>
    
    <div class="purpose">
      <strong>Propósito:</strong> ${guide.purpose}
    </div>
    
    <div class="section">
      <h3>⭐ Funcionalidades Principales</h3>
      <ul class="features-list">`;
    
    guide.mainFeatures.forEach(feature => {
      html += `
        <li>${feature}</li>`;
    });
    
    html += `
      </ul>
    </div>
    
    <div class="section">
      <h3>🔘 Botones y Acciones</h3>`;
    
    guide.actions.forEach(action => {
      html += `
      <div class="action-box">
        <h4>▶ ${action.name}</h4>
        <p>${action.description}</p>
        ${action.detail ? `<p class="detail">${action.detail}</p>` : ''}
      </div>`;
    });
    
    html += `
    </div>
    
    <div class="section">
      <h3>📝 Pasos de Uso</h3>`;
    
    guide.steps.forEach((step, stepIndex) => {
      html += `
      <div class="step">
        <span class="step-number">${stepIndex + 1}</span>
        <h4>${step.title}</h4>
        <p>${step.description}</p>`;
      
      if (step.subSteps && step.subSteps.length > 0) {
        html += `
        <ul class="substeps">`;
        step.subSteps.forEach(sub => {
          html += `
          <li>${sub}</li>`;
        });
        html += `
        </ul>`;
      }
      
      html += `
      </div>`;
    });
    
    html += `
    </div>`;
    
    if (guide.tips && guide.tips.length > 0) {
      html += `
    <div class="tips-box">
      <h4>💡 Buenas Prácticas</h4>
      <ul>`;
      
      guide.tips.forEach(tip => {
        html += `
        <li>${tip}</li>`;
      });
      
      html += `
      </ul>
    </div>`;
    }
    
    if (guide.related && guide.related.length > 0) {
      html += `
    <div class="related">
      <strong>🔗 Módulos relacionados:</strong> ${guide.related.join(', ')}
    </div>`;
    }
    
    html += `
  </div>`;
  });

  html += `
  </div>
  
  <div class="footer">
    Manual del Centro de Ayuda - SGI 360 | Página <span class="page-number"></span>
  </div>
</body>
</html>`;

  return html;
}

// Función principal
function main() {
  console.log('📄 Generando Manual del Centro de Ayuda...\n');
  
  const html = generateManualHTML();
  
  // Guardar HTML
  const outputDir = path.join(__dirname, '..', 'docs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const htmlPath = path.join(outputDir, 'manual-centro-ayuda.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');
  
  console.log(`✅ HTML generado: ${htmlPath}`);
  console.log(`\n📊 Estadísticas:`);
  console.log(`   • Total de módulos: ${guides.length}`);
  console.log(`   • Módulos fáciles: ${guides.filter(g => g.difficulty === 'Fácil').length}`);
  console.log(`   • Módulos medios: ${guides.filter(g => g.difficulty === 'Medio').length}`);
  console.log(`   • Módulos avanzados: ${guides.filter(g => g.difficulty === 'Avanzado').length}`);
  
  console.log(`\n💡 Para convertir a PDF:`);
  console.log(`   1. Abrí el archivo HTML en Chrome/Edge`);
  console.log(`   2. Ctrl+P → Guardar como PDF`);
  console.log(`   3. Márgenes: Predeterminados`);
  console.log(`   4. Habilitar "Gráficos de fondo"`);
  
  // Opcionalmente, intentar usar Puppeteer si está instalado
  console.log(`\n🔄 Intentando generar PDF automáticamente...`);
  
  try {
    const { execSync } = require('child_process');
    
    // Verificar si Playwright está disponible
    const pdfScript = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://${htmlPath}', { waitUntil: 'networkidle' });
  await page.pdf({
    path: '${path.join(outputDir, 'manual-centro-ayuda.pdf')}',
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
  });
  await browser.close();
  console.log('PDF generado exitosamente');
})();
`;
    
    const scriptPath = path.join(outputDir, '_temp_pdf_gen.js');
    fs.writeFileSync(scriptPath, pdfScript);
    
    try {
      execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
      fs.unlinkSync(scriptPath);
      console.log(`\n✅ PDF generado: ${path.join(outputDir, 'manual-centro-ayuda.pdf')}`);
    } catch (e) {
      fs.unlinkSync(scriptPath);
      console.log(`\n⚠️ No se pudo generar PDF automáticamente.`);
      console.log(`   Instalá Playwright: npm install -g playwright`);
      console.log(`   Luego ejecutá: npx playwright install chromium`);
    }
  } catch (e) {
    console.log(`\n⚠️ PDF automático no disponible. Usá el método manual.`);
  }
}

main();
