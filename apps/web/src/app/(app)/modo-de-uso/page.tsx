'use client';

import { useState, useMemo } from 'react';
import {
  Search, BookOpen, LayoutDashboard, BarChart3, FileText,
  BrainCircuit, AlertTriangle, Shield, TrendingUp, GraduationCap,
  ClipboardCheck, Users, Headphones, CreditCard, FileBarChart, Settings,
  Bell, Puzzle, Play, ChevronRight, Sparkles, ArrowRight,
  CheckCircle, AlertOctagon, Flame, Wrench, Truck, Scale,
  Compass, Target, Package, Award, Gauge, Lock,
  MessageCircle,
} from 'lucide-react';

interface GuideAction { name: string; description: string; }
interface GuideStep { title: string; description: string; }

interface ModuleGuide {
  id: string;
  title: string;
  icon: any;
  purpose: string;
  features?: string[];
  mainFeatures?: string[];
  actions: GuideAction[];
  steps?: GuideStep[];
  related?: string[];
  tips?: string[];
  tip?: string;
  screenshots?: { src: string; caption: string }[];
  screenshot?: string;
}

const guides: ModuleGuide[] = [
  {
    id: 'inicio',
    title: 'Inicio / Dashboard',
    icon: LayoutDashboard,
    purpose: 'Pantalla principal con un resumen visual del estado del sistema de gestión: indicadores clave, alertas y accesos rápidos a los módulos más usados.',
    mainFeatures: [
      'Tarjetas de métricas resumen (documentos, no conformidades, riesgos, auditorías).',
      'Gráficos de tendencia de los últimos períodos.',
      'Accesos directos a los módulos más usados.',
    ],
    actions: [
      { name: 'Tarjetas de métricas', description: 'Cliqueá cualquier tarjeta para ir al módulo correspondiente.' },
      { name: 'Filtros de período', description: 'Permite cambiar el rango de fechas del resumen.' },
    ],
    tip: 'Usá Inicio todas las mañanas como vista ejecutiva del estado general.',
  },
  {
    id: 'panel',
    title: 'Panel General',
    icon: BarChart3,
    purpose: 'Panel de control extendido con KPIs agregados del sistema. Ideal para reuniones de revisión por la dirección.',
    mainFeatures: [
      'KPIs por módulo (calidad, SST, ambiente, RRHH).',
      'Comparativas período actual vs. anterior.',
      'Alertas de desvíos críticos.',
    ],
    actions: [
      { name: 'Exportar a PDF', description: 'Genera un informe ejecutivo descargable.' },
      { name: 'Cambiar período', description: 'Ajustá el rango de análisis de los KPIs.' },
    ],
  },
  {
    id: 'project360',
    title: 'PROJECT360',
    icon: BarChart3,
    purpose: 'Gestión integral de proyectos del sistema de gestión (mejoras, implementaciones, certificaciones). Permite planificar, asignar recursos y dar seguimiento.',
    mainFeatures: [
      'Listado de proyectos activos y archivados.',
      'Tableros Kanban o listas con tareas.',
      'Asignación de responsables y fechas.',
    ],
    actions: [
      { name: 'Nuevo proyecto', description: 'Crea un proyecto con nombre, descripción, responsable y fechas.' },
      { name: 'Ver detalle', description: 'Entra al proyecto para gestionar sus tareas y archivos.' },
      { name: 'Editar', description: 'Modifica datos del proyecto (lápiz).' },
    ],
  },
  {
    id: 'mantenimiento',
    title: 'Mantenimiento',
    icon: Settings,
    purpose: 'Planificación y control del mantenimiento de activos (preventivo y correctivo). Alinea con ISO 9001 / ISO 14001 / ISO 45001.',
    mainFeatures: [
      'Listado de activos e instalaciones.',
      'Cronograma de mantenimientos preventivos.',
      'Órdenes de trabajo correctivas.',
    ],
    actions: [
      { name: 'Nuevo mantenimiento', description: 'Registra una intervención con fecha, tipo y responsable.' },
      { name: 'Marcar como completado', description: 'Cierra la intervención registrando resultado y costos.' },
    ],
  },
  {
    id: 'simulacros',
    title: 'Simulacros',
    icon: ClipboardCheck,
    purpose: 'Planificación y registro de simulacros (incendio, evacuación, emergencias). Requisito de planes de emergencia de ISO 45001.',
    mainFeatures: [
      'Programación de simulacros por año.',
      'Registro de participantes y observaciones.',
      'Planes de respuesta y recursos asociados.',
    ],
    actions: [
      { name: 'Nuevo simulacro', description: 'Crea un simulacro con fecha, tipo y escenario.' },
      { name: 'Cargar acta / evidencia', description: 'Adjunta documentación probatoria del simulacro realizado.' },
    ],
  },
  {
    id: 'documentos',
    title: 'Documentos',
    icon: FileText,
    purpose: 'Repositorio controlado de documentos del sistema (procedimientos, instructivos, formularios). Gestiona versiones y vigencias.',
    mainFeatures: [
      'Subida de archivos (PDF, Word, Excel, imágenes).',
      'Control de versiones y aprobaciones.',
      'Búsqueda por código, nombre o tipo.',
    ],
    actions: [
      { name: 'Subir documento', description: 'Arrastrá un archivo o usá el botón de subida. Completá código, título y tipo.' },
      { name: 'Ver detalle', description: 'Accedé al documento para ver metadatos, versiones e historial.' },
      { name: 'Descargar / Eliminar', description: 'Acciones disponibles desde la lista según permisos.' },
    ],
    tip: 'Usá el código estandarizado (ej: PRO-CAL-001) para facilitar búsquedas.',
  },
  {
    id: 'normativos',
    title: 'Normativos',
    icon: BookOpen,
    purpose: 'Biblioteca de normas aplicables (ISO 9001, 14001, 45001, leyes, decretos). Referencia central de requisitos legales y normativos.',
    mainFeatures: [
      'Listado de normas con código, título y estado.',
      'Carga de PDFs oficiales.',
      'Vinculación con requisitos y controles.',
    ],
    actions: [
      { name: 'Nuevo normativo', description: 'Registra una norma con código, título y PDF oficial.' },
      { name: 'Ver detalle', description: 'Consultá el contenido, requisitos y controles vinculados.' },
    ],
  },
  {
    id: 'auditoria-ia',
    title: 'Auditoría IA',
    icon: BrainCircuit,
    purpose: 'Asistente de inteligencia artificial que analiza documentos contra normas (Ollama/OpenAI) y detecta brechas de cumplimiento.',
    mainFeatures: [
      'Análisis automático de cumplimiento de un documento contra una norma.',
      'Detección de brechas y recomendaciones.',
      'Chat con el agente IA para consultas específicas.',
    ],
    actions: [
      { name: 'Analizar documento', description: 'Seleccioná documento y norma. La IA analiza y retorna hallazgos.' },
      { name: 'Chat con IA', description: 'Preguntale al asistente sobre normas, procedimientos o hallazgos.' },
    ],
    tip: 'Requiere que un administrador haya configurado la IA (Ollama o OpenAI) en el servidor.',
  },
  {
    id: 'auditorias-iso',
    title: 'Auditorías ISO',
    icon: ClipboardCheck,
    purpose: 'Gestión del programa de auditorías internas (planificación, checklist, hallazgos, reportes). Cubre ISO 19011.',
    mainFeatures: [
      'Programa anual de auditorías.',
      'Checklist personalizables por norma.',
      'Registro de hallazgos (no conformidades, observaciones, oportunidades).',
      'Informe final exportable.',
      'Auditores internos.',
    ],
    actions: [
      { name: 'Nueva auditoría', description: 'Creá una auditoría con alcance, norma, fecha y equipo auditor.' },
      { name: 'Ejecutar checklist', description: 'Dentro de la auditoría, completá cada ítem con evidencia.' },
      { name: 'Registrar hallazgos', description: 'Agregá hallazgos con evidencia y clasificación.' },
      { name: 'Generar reporte', description: 'Exporta el informe final con hallazgos y conclusiones.' },
    ],
  },
  {
    id: 'no-conformidades',
    title: 'No Conformidades',
    icon: AlertTriangle,
    purpose: 'Registro y tratamiento de no conformidades (internas, de auditoría, de cliente). Incluye análisis de causa raíz y acciones correctivas.',
    mainFeatures: [
      'Listado con estado (abierta, en tratamiento, cerrada).',
      'Análisis de causa raíz (5 porqués, Ishikawa).',
      'Plan de acción con responsables y plazos.',
      'Verificación de eficacia.',
    ],
    actions: [
      { name: 'Nueva NC', description: 'Creá con descripción, origen, severidad y responsable.' },
      { name: 'Cargar análisis', description: 'Documenta la causa raíz y acciones correctivas.' },
      { name: 'Cerrar NC', description: 'Marca como cerrada después de verificar la eficacia.' },
    ],
  },
  {
    id: 'riesgos',
    title: 'Riesgos',
    icon: Shield,
    purpose: 'Identificación, evaluación y tratamiento de riesgos del sistema de gestión (calidad, SST, ambiente). Alineado con ISO 31000.',
    mainFeatures: [
      'Matriz de riesgos por proceso.',
      'Evaluación con criterios de probabilidad e impacto.',
      'Planes de tratamiento y controles.',
      'Seguimiento periódico.',
    ],
    actions: [
      { name: 'Nuevo riesgo', description: 'Identificá un riesgo con descripción, proceso afectado y evaluación inicial.' },
      { name: 'Agregar control', description: 'Define controles preventivos o mitigadores.' },
      { name: 'Reevaluar', description: 'Actualizá el riesgo residual tras implementar controles.' },
    ],
  },
  {
    id: 'indicadores',
    title: 'Indicadores',
    icon: TrendingUp,
    purpose: 'Definición y seguimiento de KPIs del sistema (calidad, desempeño, procesos). Permite medir eficacia y cumplimiento de objetivos.',
    mainFeatures: [
      'Biblioteca de indicadores con fórmula y meta.',
      'Registro de mediciones periódicas.',
      'Gráficos de tendencia.',
      'Alertas ante desvíos.',
    ],
    actions: [
      { name: 'Nuevo indicador', description: 'Definí nombre, fórmula, unidad, meta y frecuencia.' },
      { name: 'Cargar medición', description: 'Registra el valor medido en el período.' },
      { name: 'Ver tendencia', description: 'Entra al detalle para ver gráfico histórico.' },
    ],
  },
  {
    id: 'capacitaciones',
    title: 'Capacitaciones',
    icon: GraduationCap,
    purpose: 'Gestión del plan anual de capacitación: necesidades detectadas, cursos programados, asistencia y evaluación de eficacia.',
    mainFeatures: [
      'Plan anual de capacitaciones.',
      'Registro de asistencia por curso.',
      'Evaluación de conocimientos pre/post.',
      'Certificados asociados.',
    ],
    actions: [
      { name: 'Nueva capacitación', description: 'Programa un curso con tema, fecha, duración e instructor.' },
      { name: 'Marcar asistencia', description: 'Registra empleados que asistieron.' },
      { name: 'Evaluar eficacia', description: 'Completa encuesta/test de eficacia al concluir.' },
    ],
  },
  {
    id: 'rrhh',
    title: 'RRHH',
    icon: Users,
    purpose: 'Gestión del capital humano: empleados, puestos, perfiles, competencias y organigrama. Base para capacitaciones y evaluaciones.',
    mainFeatures: [
      'Altas, bajas y modificaciones de empleados.',
      'Perfiles de puesto con competencias requeridas.',
      'Evaluación de competencias por empleado.',
      'Organigrama visual.',
    ],
    actions: [
      { name: 'Empleados', description: 'ABM de empleados con datos personales, puesto y estado.' },
      { name: 'Perfiles', description: 'Define qué competencias requiere cada puesto.' },
      { name: 'Competencias', description: 'Evalúa el nivel de cada empleado vs. lo requerido (brechas).' },
      { name: 'Organigrama', description: 'Visualiza la estructura jerárquica.' },
      { name: 'Nueva Evaluación', description: 'Evalúa competencias de un empleado. Requiere competencias previamente asignadas al perfil.' },
    ],
    tip: 'Para evaluar un empleado, primero asigná competencias a su perfil/puesto.',
  },
  {
    id: 'clientes',
    title: 'Clientes',
    icon: Headphones,
    purpose: 'CRM ligero orientado a satisfacción y retroalimentación del cliente. Gestiona contactos, encuestas y respuestas.',
    mainFeatures: [
      'Base de clientes con datos de contacto.',
      'Creación y envío de encuestas de satisfacción.',
      'Recolección y análisis de respuestas.',
      'NPS y tasa de respuesta.',
    ],
    actions: [
      { name: 'Nuevo cliente', description: 'Carga un cliente con nombre, email y datos fiscales.' },
      { name: 'Nueva encuesta', description: 'Diseña preguntas (estrellas, NPS, texto, opción múltiple).' },
      { name: 'Enviar encuesta', description: 'Selecciona clientes y envía por email (si está configurado).' },
      { name: 'Ver respuestas', description: 'Revisa las respuestas recibidas para una encuesta.' },
    ],
  },
  {
    id: 'licencias',
    title: 'Licencias',
    icon: CreditCard,
    purpose: 'Administración de la suscripción al sistema: plan contratado, facturas, pagos y cambios de plan.',
    mainFeatures: [
      'Plan actual y vencimiento.',
      'Historial de facturas.',
      'Medios de pago.',
      'Cambios de plan (upgrade/downgrade).',
    ],
    actions: [
      { name: 'Ver planes', description: 'Compara los planes disponibles y sus features.' },
      { name: 'Facturas', description: 'Descarga facturas PDF emitidas.' },
      { name: 'Pagos', description: 'Revisa pagos recibidos y estado.' },
    ],
  },
  {
    id: 'reportes',
    title: 'Reportes',
    icon: FileBarChart,
    purpose: 'Centro de reportes e informes del sistema: informe para la dirección, exportaciones personalizadas, etc.',
    mainFeatures: [
      'Informe de revisión por la dirección (ISO 9001 §9.3).',
      'Exportaciones a PDF / Excel.',
      'Reportes configurables por módulo.',
    ],
    actions: [
      { name: 'Informe de dirección', description: 'Genera un informe consolidado con todos los inputs requeridos por la norma.' },
      { name: 'Exportar', description: 'Exporta datos de cualquier módulo en el formato deseado.' },
    ],
  },
  {
    id: 'notificaciones',
    title: 'Notificaciones',
    icon: Bell,
    purpose: 'Centro de notificaciones del sistema: tareas pendientes, alertas de vencimientos, menciones.',
    mainFeatures: [
      'Lista de notificaciones recibidas.',
      'Marcadas como leídas / no leídas.',
      'Enlaces directos al origen.',
    ],
    actions: [
      { name: 'Marcar como leída', description: 'Click en la notificación.' },
      { name: 'Marcar todas como leídas', description: 'Botón superior para limpiar el contador.' },
    ],
  },
  {
    id: 'configuracion',
    title: 'Configuración',
    icon: Settings,
    purpose: 'Ajustes generales del usuario y del sistema: preferencias, usuarios y roles internos.',
    mainFeatures: [
      'Preferencias de usuario.',
      'Gestión de usuarios internos del tenant.',
      'Roles y permisos.',
    ],
    actions: [
      { name: 'Cambiar contraseña', description: 'Desde tu perfil.' },
      { name: 'Agregar usuario', description: 'Invita nuevos miembros del equipo a tu tenant.' },
    ],
  },
  {
    id: 'integraciones',
    title: 'Integraciones',
    icon: Puzzle,
    purpose: 'Conexión del SGI con servicios externos (email, almacenamiento en la nube, webhooks, IA).',
    mainFeatures: [
      'Configuración de proveedor de email.',
      'Integraciones con servicios de almacenamiento.',
      'Webhooks salientes.',
    ],
    actions: [
      { name: 'Conectar servicio', description: 'Completa credenciales según el servicio elegido.' },
      { name: 'Probar conexión', description: 'Verifica que la integración funcione correctamente.' },
    ],
  },
  {
    id: 'empresa',
    title: 'Configuración de la empresa',
    icon: Settings,
    purpose: 'Datos de la empresa (tenant): razón social, logo, dirección, datos fiscales, misión/visión.',
    mainFeatures: [
      'Identidad visual (logo, nombre comercial).',
      'Datos legales / fiscales.',
      'Políticas internas.',
    ],
    actions: [
      { name: 'Subir logo', description: 'El logo aparecerá en el sidebar y reportes.' },
      { name: 'Editar datos', description: 'Actualiza cualquier dato de la empresa.' },
    ],
  },
];


function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${q})`, 'gi'));
  return <>{parts.map((p, i) => p.toLowerCase() === query.toLowerCase() ? <mark key={i} className="bg-yellow-200 rounded px-0.5">{p}</mark> : <span key={i}>{p}</span>)}</>;
}

export default function CentroDeAyudaPage() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string>(guides[0].id);
  const [tab, setTab] = useState<'info'|'pasos'|'relaciones'>('info');

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return guides;
    return guides.filter(g =>
      g.title.toLowerCase().includes(q) ||
      g.purpose.toLowerCase().includes(q) ||
      (g.features || g.mainFeatures || []).some(f => f.toLowerCase().includes(q)) ||
      g.actions.some(a => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)) ||
      (g.steps || []).some(s => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
    );
  }, [q]);

  const current = guides.find(g => g.id === active) || guides[0];
  const CurrentIcon = current.icon;
  const feat = current.features || current.mainFeatures || [];
  const steps = current.steps || [];
  const related = current.related || [];
  const tips = current.tips || (current.tip ? [current.tip] : []);

  return (
    <div className="min-h-screen bg-gray-50">
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
        <aside className="bg-white border border-gray-200 rounded-xl p-4 h-fit sticky top-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">Módulos ({filtered.length})</h2>
          <nav className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
            {filtered.length === 0 && <p className="text-xs text-gray-500 px-3 py-2">Sin resultados</p>}
            {filtered.map(g => {
              const Icon = g.icon;
              return (
                <button key={g.id} onClick={() => { setActive(g.id); setTab('info'); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${active === g.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate"><Highlight text={g.title} query={query} /></span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 pt-6 pb-2 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                <CurrentIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{current.title}</h2>
                <p className="text-sm text-gray-500">{current.purpose}</p>
              </div>
            </div>
            <div className="flex gap-1">
              {(['info','pasos','relaciones'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${tab === t ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {t === 'info' ? 'Información' : t === 'pasos' ? 'Pasos de uso' : 'Relaciones'}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {tab === 'info' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Propósito</h3>
                  <p className="text-gray-800 leading-relaxed">{current.purpose}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Funcionalidades principales</h3>
                  <ul className="space-y-2">
                    {feat.map((f, i) => (
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
                      </div>
                    ))}
                  </div>
                </div>
                {tips.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-900">
                      <strong className="block mb-1">Buena práctica</strong>
                      {tips.map((t, i) => <p key={i}>{t}</p>)}
                    </div>
                  </div>
                )}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
                  <MessageCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <strong className="block mb-1">¿Tenés dudas?</strong>
                    <p>Usá el botón flotante de ayuda (esquina inferior derecha) para consultar con el asistente de IA contextual en cualquier pantalla del sistema.</p>
                  </div>
                </div>
              </div>
            )}

            {tab === 'pasos' && (
              <div className="space-y-4">
                {steps.length > 0 ? steps.map((s, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">{i+1}</div>
                      {i < steps.length - 1 && <div className="w-0.5 bg-blue-200 flex-1 mt-1" />}
                    </div>
                    <div className="pb-5">
                      <h4 className="font-medium text-gray-900"><Highlight text={s.title} query={query} /></h4>
                      <p className="text-sm text-gray-600 mt-1"><Highlight text={s.description} query={query} /></p>
                    </div>
                  </div>
                )) : <p className="text-sm text-gray-500">No hay pasos detallados para este módulo.</p>}
              </div>
            )}

            {tab === 'relaciones' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Este módulo se integra con los siguientes módulos del sistema:</p>
                {related.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {related.map((r, i) => (
                      <div key={i} className="flex items-center gap-3 border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                          <ArrowRight className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">{r}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-gray-500">No hay relaciones documentadas para este módulo.</p>}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
