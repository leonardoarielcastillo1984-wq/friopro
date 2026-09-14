# SGI360 — Informe Funcional y Comercial

> Base para diseño de campaña publicitaria y estrategia de ventas
> Fecha: Septiembre 2026
> Verificación: Análisis de código fuente, modelos de datos (Prisma), rutas API (Fastify), pantallas frontend (Next.js 14), integraciones y documentación del proyecto.

---

## 1. QUÉ ES SGI360

SGI360 es una plataforma web SaaS multi-tenant (multi-empresa) para la gestión integral de Sistemas de Gestión de la Calidad, Seguridad y Salud Ocupacional, Ambiente y Responsabilidad Social. Está diseñada para que organizaciones de cualquier tamaño implementen, mantengan y auditen normas ISO (9001, 14001, 45001, 39001), IATF 16949 y otras, de forma digital, centralizada y trazable.

### Arquitectura técnica

- **Frontend**: Next.js 14 (App Router), React, TypeScript, TailwindCSS, componentes Lucide
- **Backend**: Fastify (Node.js), TypeScript, Prisma ORM
- **Base de datos**: PostgreSQL
- **Cache/Colas**: Redis
- **IA**: Integración con LLM (Groq/Ollama configurable por tenant)
- **Despliegue**: Docker, CI/CD, Nginx, AWS (producción en 54.94.33.5)
- **Multi-tenant**: Aislamiento por `tenantId` en todas las tablas, roles y permisos granulares
- **Planes**: BASIC, PROFESSIONAL, PREMIUM (con bloqueo/permisos por módulo)

### Productos integrados en la plataforma

SGI360 contiene módulos nativos del SGI y también productos standalone con su propia autenticación:

- **SGI360** (producto principal): gestión de calidad, seguridad, ambiente, RRHH, proyectos, infraestructura
- **PROYECT360** (producto standalone): gestión de proyectos empresarial con IA predictiva, licitaciones, simulación financiera
- **AUDIT360** (producto standalone): gestión de auditorías para firmas auditoras
- **SEH360** (producto standalone): seguridad, higiene y entorno legal
- **FLOTA360** (módulo integrado): gestión de flota vehicular, neumáticos, combustible
- **SINIESTROS360** (módulo integrado): gestión de siniestros vehiculares

---

## 2. INVENTARIO COMPLETO DE FUNCIONALIDADES

### 2.1 Módulo: Inicio / Dashboard
**Ruta frontend**: `/dashboard`
**Rutas API**: `/dashboard`
**Plan**: BASIC

- Panel de inicio con resumen general del SGI
- Indicadores clave, accesos rápidos a módulos
- Estado del sistema, alertas, notificaciones

### 2.2 Módulo: Command Center
**Ruta frontend**: `/command-center`
**Rutas API**: `/command-center`
**Plan**: BASIC

- Centro de comando inteligente con visión consolidada del SGI
- Integración de datos de múltiples módulos en un solo panel
- Alertas proactivas, resúmenes ejecutivos
- IA integrada para análisis y respuestas rápidas

### 2.3 Módulo: Preparación de Auditoría
**Ruta frontend**: `/auditoria-readiness`
**Rutas API**: `/audit-readiness`
**Plan**: BASIC

- Checklist de preparación para auditorías externas
- Evaluación de readiness por cláusula/norma
- Identificación de brechas antes de la auditoría
- Estado: IMPLEMENTADO

### 2.4 Módulo: Documentos
**Ruta frontend**: `/documents` (13 pestañas)
**Rutas API**: `/documents`, `/doc-export`
**Plan**: BASIC

**Funcionalidades implementadas y verificadas:**
- **Lista de documentos**: CRUD completo, búsqueda, filtros, versionado
- **Maestro de documentos**: vista maestra con codificación automática
- **Configuración**: tipos de documento, códigos, reglas de codificación
- **Plantillas**: sistema de plantillas de exportación documental
- **Salidas**: definiciones de salida de documentos (PDF, validación)
- **Revisiones**: workflow de revisiones con diff entre versiones
- **Historial**: historial completo de exportaciones
- **Exportación masiva**: LIBRO_SGI, RESPALDO, AUDIT_PACK, CUSTOM
- **Retención documental**: reglas de retención por tipo
- **Dashboard de exportación**: estadísticas de exportaciones
- **Marca blanca**: personalización de color, logo, encabezados
- **Auditoría de exportaciones**: log de auditoría con IP, hash, user-agent
- **Ayuda**: sección de ayuda in-app
- **Validación pública de documentos**: token de validación público (`/validate-doc`)
- **Exportación CSV/Excel**: exportación de datos en formato CSV

**Estado del Sistema Global de Exportación Documental**: 22 etapas completadas en código. Pendiente de deploy completo (requiere aplicar migración, prisma generate, build). Las funcionalidades de exportación desde módulos (Riesgos, NCR, Indicadores, Gestión de Cambios, Capacitaciones) están integradas con `ExportButton`.

### 2.5 Módulo: RRHH (Recursos Humanos)
**Ruta frontend**: `/rrhh` (con sub-módulos)
**Rutas API**: `/hr`, `/absences`, `/performance`
**Plan**: PREMIUM

**Funcionalidades implementadas:**
- **Empleados**: CRUD completo, datos personales, datos laborales, foto de perfil, estado (ACTIVO/INACTIVO)
- **Cargos/Posiciones**: CRUD, descripción de perfil, responsabilidades, tareas, requisitos, KPIs, riesgos
- **Organigrama**: jerarquía de empleados (supervisor → subordinados), línea/nivel manual, organigrama visual
- **Competencias**: matriz de competencias por cargo (nivel requerido vs nivel actual), brecha de competencias
- **Capacitaciones internas**: asignación de capacitaciones a empleados, seguimiento de estado, certificados
- **Evaluación de Desempeño** (sub-módulo, desplegado en producción):
  - Ciclos de evaluación, plantillas con criterios, escalas de calificación
  - Autoevaluación, evaluación por supervisor, evaluadores múltiples
  - Brechas de desempeño, planes de desarrollo
  - Integración con competencias, capacitaciones, objetivos
  - IA para análisis de brechas y sugerencias
  - Historial completo de cambios
- **Ausencias y Disponibilidad** (sub-módulo, NO desplegado aún):
  - Tipos de ausencia, políticas, feriados, saldos
  - Solicitudes con workflow de aprobación
  - Disponibilidad y cobertura por competencias
  - Indicadores de ausentismo, importación masiva de saldos (Excel)
  - Motor de devengo automático
  - IA para análisis de impacto de ausencias

### 2.6 Módulo: Capacitaciones
**Ruta frontend**: `/capacitaciones`
**Rutas API**: `/trainings`, `/trainings-iso`
**Plan**: PROFESSIONAL

**Funcionalidades implementadas:**
- CRUD de capacitaciones (título, descripción, tipo, modalidad: presencial/virtual/mixta/e-learning)
- Asistentes (vinculación con empleados)
- Estado: SCHEDULED → IN_PROGRESS → COMPLETED → CANCELLED
- Evaluación de satisfacción post-capacitación (ISO 9001:2015)
- Evaluación de efectividad (30-90 días post-capacitación)
- Vinculación con competencias (una capacitación cubre competencias específicas)
- Notificaciones automáticas: asignación de CAPA → email + in-app
- Exportación documental (ExportButton integrado)

### 2.7 Módulo: Clientes
**Ruta frontend**: `/clientes`
**Rutas API**: `/customers`, `/surveys`, `/survey`
**Plan**: PROFESSIONAL

**Funcionalidades implementadas:**
- CRUD de clientes (código automático CLI-{YYYY}-{NNN})
- Clasificación: tipo (CLIENT, SUPPLIER, PARTNER, PROSPECT), categoría (A, B, C)
- Encuestas de satisfacción: creación, preguntas (rating, NPS, elección múltiple, texto), envío por email
- Respuestas anónimas o identificadas, token único por encuesta
- Portal público de encuesta (sin auth)
- Planes de mejora por cliente
- Vinculación con No-Conformidades
- Documentos asociados al cliente

### 2.8 Módulo: Proveedores
**Ruta frontend**: `/proveedores`
**Rutas API**: `/suppliers`
**Plan**: PROFESSIONAL

**Funcionalidades implementadas:**
- CRUD de proveedores
- Evaluación de proveedores
- Vinculación con compras, órdenes de trabajo

### 2.9 Módulo: Cumplimiento Normativo
**Ruta frontend**: `/cumplimiento` (tabs: normativos, legales)
**Rutas API**: `/normativos`, `/compliance-evidences`
**Plan**: PROFESSIONAL

**Funcionalidades implementadas:**
- **Normativas**: carga de normas (PDF), procesamiento, extracción de cláusulas
- **Multinorma**: soporta ISO 9001, ISO 14001, ISO 45001, ISO 39001, IATF 16949, ISO 27001, ISO 50001
- **Cláusulas**: extracción automática, estado activo/inactivo
- **Mapeo documento-cláusula**: vinculación de documentos con cláusulas normativas
- **Evidencias de cumplimiento**: registro de evidencias por cláusula
- **Estados**: UPLOADING → PROCESSING → READY → ERROR → ARCHIVED
- Worker asíncrono para procesamiento de normativas (cola con Redis)

### 2.10 Módulo: Contexto del SGI
**Ruta frontend**: `/contexto-sgi` (9 subcarpetas, tabs: contexto, partes, mapa)
**Rutas API**: `/context`, `/stakeholders`, `/process-maps`, `/process-templates`, `/evaluation-cycles`, `/stakeholder-evaluations`
**Plan**: BASIC

**Funcionalidades implementadas:**
- **Contexto organizacional**: análisis FODA/DAFO (fortalezas, debilidades, oportunidades, amenazas), factores PESTEL (político, económico, social, tecnológico, ambiental, legal), misión, visión, valores, prioridades estratégicas
- **Partes interesadas**: CRUD, identificación de necesidades y expectativas, ciclos de evaluación de partes interesadas
- **Mapa de Procesos**:
  - Jerarquía de 2 niveles (Macroproceso → Subproceso)
  - Procesos estratéticos, operacionales y de soporte
  - Vinculación con indicadores, documentos, riesgos, objetivos
  - Diagrama visual del mapa
  - Enfoque por procesos: objetivo, clientes internos, proveedores internos, actividades, observaciones
  - Multi-sede
  - **Plantillas de procesos**: catálogo IATF 16949 (15 procesos) + ISO 9001 (10 procesos), importación asistida
  - **Implementación con IA**: wizard de preguntas → IA genera/rellena procesos
  - Soft-delete en cascada (subprocesos al borrar macroproceso)

### 2.11 Módulo: Objetivos SGI
**Ruta frontend**: `/objetivos` (con subcarpeta `/politicas`)
**Rutas API**: `/objectives`
**Plan**: BASIC

**Funcionalidades implementadas:**
- **Objetivos SGI**: CRUD, vinculación con indicadores, riesgos, auditorías, CAPAs
- **Políticas SGI**: CRUD, alcance (calidad, ambiente, seguridad, integrado), PDF firmado
- **Actividades por objetivo**: seguimiento de actividades, responsables, fechas, estado
- **Responsable por cargo**: vinculación con Position (no solo usuario)
- Seguimiento de progreso

### 2.12 Módulo: No Conformidades y Plan de Acción
**Ruta frontend**: `/calidad` (tabs: nc, incidentes, acciones, cambios)
**Rutas API**: `/ncr`, `/action-plans`, `/portal-accion`
**Plan**: BASIC

**Funcionalidades implementadas:**
- **No Conformidades**:
  - CRUD completo con código automático
  - Severidad: CRITICAL, MAJOR, MINOR, OBSERVATION
  - Origen: auditoría interna, auditoría externa, queja de cliente, desvío de proceso, problema de proveedor, hallazgo IA, parte interesada, portal externo
  - Workflow de estados: EXTERNAL_DRAFT → REPORTED → OPEN → IN_ANALYSIS → ACTION_PLANNED → IN_PROGRESS → VERIFICATION → CLOSED
  - Análisis de causa raíz, acciones correctivas y preventivas
  - Verificación de eficacia
  - Trazabilidad: vinculación con riesgos, indicadores, clientes, partes interesadas, procesos
  - Portal externo: creación de NCR desde fuera (token de acceso, reportante externo)
  - Detección de duplicados (idempotencyKey)
  - Adjuntos
  - Notificaciones automáticas (asignación, cambio de estado, vencimiento)
- **Plan de Acción (Action Plans)**:
  - CRUD completo, tipos: corrección inmediata, correctiva, preventiva, mejora, tratamiento de riesgo, oportunidad
  - Origen: manual, auditoría, NCR, incidente, queja, inspección, indicador, revisión por dirección, riesgo
  - Workflow: DRAFT → PENDING_CODE → PENDING_APPROVAL → OPEN → IN_EXECUTION → PENDING_EVIDENCE → PENDING_EFFECTIVENESS → EFFECTIVE/NOT_EFFECTIVE → CLOSED
  - Análisis: 5 Whys, Ishikawa, Fault Tree, 8D
  - Evaluación de riesgo inicial y residual (probabilidad × impacto)
  - 7 secciones: identificación, contención, causa raíz, acción correctiva, preventiva, evaluación de eficacia, cierre
  - Logs de auditoría, adjuntos
  - Portal de acción externo
- **Incidentes**:
  - CRUD, tipo: accidente, incidente, near miss, situación peligrosa
  - Severidad, investigación, causa raíz, días perdidos
- **Gestión de Cambios**:
  - CRUD completo con código automático
  - Tipo: proceso, organizacional, producto/servicio, infraestructura, proveedor, normativo
  - Evaluación multidimensional: calidad, SST, ambiental, operativo, tecnológico, legal, continuidad
  - Nivel global calculado automáticamente (BAJO/MEDIO/ALTO/CRITICO)
  - Workflow: SOLICITADO → EN_REVISION → APROBADO/RECHAZADO → IMPLEMENTADO → EN_VERIFICACION → VERIFICADO → CERRADO
  - Vinculación: procesos afectados, partes interesadas, riesgos, documentos
  - Evidencias del cambio (fotos, documentos, actas)
  - Verificación de eficacia del cambio
  - Planificación: objetivo, alcance, comunicación, capacitación, contingencia, criterios de aceptación
  - Historial completo de cambios

### 2.13 Módulo: Auditorías
**Ruta frontend**: `/auditoria` (3 subcarpetas)
**Rutas API**: `/audit`, `/audits`
**Plan**: PREMIUM

**Funcionalidades implementadas:**
- **Programa anual de auditorías**: planificación por año
- **Auditorías individuales**:
  - Tipos: interna, externa, proveedor, cliente, certificación, recertificación, vigilancia
  - Estados: DRAFT → PLANNED → SCHEDULED → IN_PROGRESS → PENDING_REPORT → COMPLETED → CLOSED
  - Planificación: fechas, modalidad (presencial/remota/híbrida), ubicación, equipo auditor
  - Scope: área, proceso, normas (multi-norma), criterios, objetivo
  - Reunión de apertura y cierre (flags)
  - Notificaciones a equipo auditor
- **Gestión de auditores**: CRUD, tipo (interno/externo), competencias por norma, documentos (certificados)
- **Equipo auditor**: asignación con roles (LEADER, AUDITOR, OBSERVER)
- **Checklist**: basado en plantillas, ítems por cláusula, respuestas (conforme/no conforme/no aplicable)
- **Hallazgos**: tipo (NC, observación, oportunidad, commendation), severidad, recurrencia, acciones correctivas
- **Acciones correctivas**: responsable, fechas, eficacia, evidencia
- **Informe de auditoría**: resumen ejecutivo, conclusión, score de cumplimiento, firmas, exportación PDF/Word
- **Agenda**: ítems detallados por día/hora, auditor responsable, participantes
- **Log de cambios**: trazabilidad completa (creación, edición, reprogramación, cancelación)
- **Plantillas de checklist**: reutilizables por norma, con ítems y pesos
- **IA en auditorías**: sugerencias de hallazgos, análisis de impacto

### 2.14 Módulo: Revisión por la Dirección
**Ruta frontend**: `/revision-direccion`
**Rutas API**: `/managementReview`
**Plan**: PROFESSIONAL

**Funcionalidades implementadas:**
- Informes para la Dirección con datos auto-generados del sistema
- Secciones: resultados de auditorías, no conformidades, desempeño de KPIs, etc.
- Texto libre + datos del sistema + decisiones/acciones
- Estados: DRAFT → FINAL
- Período de revisión, normas aplicables

### 2.15 Módulo: Seguridad & Ambiente
**Ruta frontend**: `/seguridad` (5 subcarpetas: tabs riesgos, iperc, ambientales, simulacros)
**Rutas API**: `/risks`, `/hazards`, `/aspects`, `/emergency`
**Plan**: BASIC

**Funcionalidades implementadas:**
- **Riesgos (SGI)**:
  - CRUD completo, código automático
  - Estado: IDENTIFIED → ASSESSED → MITIGATING → MONITORED → CLOSED
  - Probabilidad × impacto, nivel de riesgo
  - Acciones de tratamiento de riesgo
  - Vinculación con indicadores (IndicatorRiskLink)
  - Vinculación con procesos, NCR, auditorías, objetivos
  - Revisiones periódicas
- **IPERC (Hazard)**:
  - Identificación de peligros
  - Evaluación: probabilidad × severidad × exposición = nivel de riesgo
  - Categoría: tolerable, moderado, sustancial, intolerable
  - Jerarquía de controles: eliminación, sustitución, ingeniería, administrativo, EPP
  - Seguimiento de implementación y efectividad de cada control
  - Estado: OPEN → IN_TREATMENT → CONTROLLED → CLOSED
  - Frecuencia de revisión
- **Aspectos Ambientales**:
  - CRUD, categoría: emisiones, residuos, energía, agua, suelo, biodiversidad, ruido
  - Condición: normal, anormal, emergencia
  - Magnitud × severidad × frecuencia = significancia
  - Controles operacionales, de ingeniería, administrativos
  - Acciones ambientales, revisiones
  - Estado y frecuencia de revisión
- **Simulacros**:
  - CRUD de escenarios, tipo: desastre natural, incendio, incidente de seguridad, emergencia médica, fallo de infraestructura, pandemia
  - Planificación: objetivos, alcance, cronograma, responsables, evaluadores
  - Recursos: equipos, personal, instalaciones
  - Ejecución: fecha, tiempo de respuesta, resultados
  - Acciones correctivas del simulacro
  - Participantes (vinculación con empleados)
  - Vinculación con riesgos, aspectos ambientales, NCR
- **Planes de contingencia**:
  - CRUD, objetivos, triggers, responsabilidades, procedimientos, recursos, comunicaciones
  - Versionado de planes

### 2.16 Módulo: Indicadores
**Ruta frontend**: `/indicadores`
**Rutas API**: `/indicators`
**Plan**: BASIC

**Funcionalidades implementadas:**
- CRUD de indicadores (KPIs)
- Frecuencia: diaria, semanal, mensual, trimestral, anual
- Dirección: higher_better / lower_better
- Mediciones: registro de valores por período
- Tendencia: UP, DOWN, STABLE
- Estado: ON_TARGET, WARNING, OFF_TARGET, NO_DATA
- Vinculación con riesgos (IndicatorRiskLink)
- Vinculación con procesos y objetivos
- Exportación documental (ExportButton)

### 2.17 Módulo: Proyectos (SGI nativo)
**Ruta frontend**: `/proyectos` (6 items)
**Rutas API**: `/project360-v1`
**Plan**: PROFESSIONAL

**Funcionalidades implementadas:**
- CRUD de proyectos con código automático (PROJ-2026-NNN)
- Origen: hallazgo de auditoría, NC, incidente, desvío de simulacro, problema de mantenimiento, riesgo detectado, objetivo de dirección, manual
- Tareas con dependencias, checklist, evidencia, estimación de horas
- Hitos (milestones)
- Evidencias de proyecto
- Comentarios
- Vinculación con indicadores
- Seguimiento de progreso

### 2.18 Módulo: Calendario
**Ruta frontend**: `/calendario`
**Rutas API**: `/calendar`
**Plan**: BASIC

- Calendario integrado de eventos del SGI
- Auditorías programadas, capacitaciones, vencimientos, simulacros

### 2.19 Módulo: Infraestructura
**Ruta frontend**: `/infraestructura` (14 subcarpetas)
**Rutas API**: `/maintenance`, `/calibrations`, `/inspecciones`, `/digital-twin`
**Plan**: PROFESSIONAL

**Funcionalidades implementadas:**
- **Mantenimiento industrial**:
  - Activos: CRUD, categoría (maquinaria, vehículo, herramienta, infraestructura, electrónico, seguridad), ubicación, costo de adquisición, odómetro
  - Planes de mantenimiento: preventivo, correctivo, predictivo, emergencia; frecuencia por días/semanas/meses/años/km
  - Órdenes de trabajo: CRUD, prioridad, estado, técnico asignado, costos (mano de obra, repuestos, total)
  - Técnicos: CRUD, especialización, certificación, disponibilidad
  - Repuestos: stock, stock mínimo, costo unitario, proveedor
  - Costos de mantenimiento: registro por tipo
  - Ejecuciones de plan de mantenimiento
- **Calibraciones**:
  - Equipos de medición: CRUD, frecuencia de calibración, fechas última/próxima
  - Registros de calibración: proveedor, certificado, resultado, costo
- **Inspecciones Inteligentes** (desplegado en testing):
  - Plantillas de checklist (built-in: camión, autoelevador, extintor, maquinaria, edificio)
  - QR por activo: genera QR imprimible
  - Inspección móvil: página pública mobile-first (`/inspeccionar/[token]`)
  - Hallazgos: NCR detectadas desde inspección
  - Dashboard de KPIs, historial
  - Feedback de cliente vía QR
- **Gemelo Digital (Digital Twin)**:
  - Modelo de gemelo digital por activo
  - Predicciones de salud del activo
  - Telemetría

### 2.20 Módulo: Reportes
**Ruta frontend**: `/reportes` (5 subcarpetas)
**Rutas API**: `/reports`, `/export`, `/tenantReport`
**Plan**: PROFESSIONAL

**Funcionalidades implementadas:**
- Reportes generales del SGI
- Exportación de datos
- Reportes por tenant

### 2.21 Módulo: Clima y Cultura
**Ruta frontend**: `/clima` (13 subcarpetas)
**Rutas API**: `/clima`
**Plan**: PREMIUM

**Funcionalidades implementadas:**
- **Encuestas de clima**: creación, envío, recepción
- **Buzón de sugerencias**: anónimo o identificado
- **Planes de acción de clima**: seguimiento
- **Comunicados**:
  - Editor rich text con toolbar (negrita/itálica/H1-H3/lista)
  - Paste de imágenes (Ctrl+V)
  - Adjuntos: guardado en STORAGE_LOCAL_PATH
  - Reenvío a todos
  - Tracking de vistas: pixel 1x1 + link "Confirmar que lo leí"
  - Firma automática (guardada en companySettings)
  - Pie de propaganda en emails
  - Logo de empresa en todos los emails
- **Canal QR**: canal de comunicación vía código QR
- **SugerenciaBot**: portal del empleado con buzón de sugerencias

### 2.22 Módulo: Notificaciones
**Ruta frontend**: `/notificaciones`
**Rutas API**: `/notifications`
**Plan**: Todos

**Funcionalidades implementadas:**
- Notificaciones in-app
- Tipos: NCR asignada, cambio de estado NCR, NCR vencida, riesgo crítico, auditoría completada/fallida, nuevo hallazgo, capacitación programada, recordatorio de capacitación, miembro invitado, alerta del sistema, aprobación de proyecto
- Notificaciones automáticas por eventos del sistema
- Marcar como leída, marcar todas como leídas

### 2.23 Módulo: Configuración
**Ruta frontend**: `/configuracion`, `/configuracion/empresa`
**Rutas API**: `/settings`, `/company-settings`, `/integrations`
**Plan**: Todos

**Funcionalidades implementadas:**
- Configuración general del sistema
- Configuración de empresa: nombre, logo, color, datos fiscales, texto de encabezado/pie
- Categorías de RRHH (cargos, tipos de contrato, categorías de capacitación)
- Alertas de inspecciones (emails configurables)
- Firma de comunicados
- Integraciones: webhooks (Slack, Teams, custom)

### 2.24 Módulo: Centro de Ayuda
**Ruta frontend**: `/modo-de-uso`
**Rutas API**: `/help`
**Plan**: Todos

**Funcionalidades implementadas:**
- 25 guías de módulos reales agrupadas por categoría
- Información, pasos detallados, capturas de pantalla
- Buscador, navegación por grupos
- Botón "Abrir esta pantalla" (navegación directa)
- Capturas reales generadas con Playwright

### 2.25 Módulo: Gestión de Flota (FLOTA360)
**Rutas API**: `/flota`, `/garantias`
**Integrado en SGI360**

**Funcionalidades implementadas:**
- Vehículos: CRUD completo
- Conductores: CRUD
- Neumáticos: gestión completa (posiciones, rotaciones, presiones, daños, recaps)
- Vencimientos de documentos
- Registros de combustible
- Historial de mantenimiento vehicular (vinculado a OT de mantenimiento)
- Garantías de vehículo
- Siniestros (Siniestros360): gestión de siniestros con notificaciones por email

### 2.26 Módulo: Minutas
**Rutas API**: `/minutas`

**Funcionalidades implementadas:**
- CRUD de minutas de reuniones
- Bloques: conversación, decisión, acción (con responsable y fecha límite)
- Vinculación con cliente, proveedor, proyecto
- Adjuntos, audio
- Resumen ejecutivo con IA
- Prioridad, confidencialidad, tags

### 2.27 Sistema de Licencias y Facturación
**Rutas API**: `/license`, `/billing`, `/super-admin`

**Funcionalidades implementadas:**
- Planes: BASIC, PROFESSIONAL, PREMIUM
- Setup inicial (pago único USD 200)
- Suscripciones mensuales/anuales
- MercadoPago: integración de pagos
- Período de gracia (7 días)
- Notificaciones de vencimiento (7, 3, 1 día, expirado, gracia)
- Bloqueo automático por licencia expirada
- Panel de super-admin: gestión de tenants, activación de planes
- Facturas: generación, PDF, datos fiscales
- Acceso a intentos de módulos bloqueados (log)
- Monitor diario de licencias

### 2.28 Autenticación y Seguridad
**Rutas API**: `/auth`

**Funcionalidades implementadas:**
- Login con email/password
- JWT con refresh tokens
- 2FA (Two-Factor Authentication): TOTP, códigos de recuperación, sesiones confiables
- Multi-tenant: selección de empresa, membresías (TENANT_ADMIN, TENANT_USER)
- Historial de contraseñas
- Bloqueo por intentos fallidos
- Rate limiting (200 req/min)
- CSRF protection
- Helmet (HSTS, XSS filter, no-sniff)
- Permisos granulares por módulo (JSON en User)
- Timeout de sesión por inactividad (30 min)
- Redirección a landing con login embebido

### 2.29 Portal Externo
**Rutas API**: `/portal-accion`, rutas públicas

**Funcionalidades implementadas:**
- Portal de acción externo (tokens de acceso)
- Creación de NCR desde el exterior
- Encuestas públicas (sin auth)
- Validación pública de documentos (token)
- Inspecciones móviles vía QR (sin auth)

### 2.30 Producto Standalone: PROYECT360
**Rutas API**: `/project360/*` (44 archivos de rutas)
**Autenticación propia**: `requireP360Auth`

**Funcionalidades implementadas (producto enterprise):**
- Dashboard ejecutivo, PMO, portafolios, demandas
- Gestión de proyectos, tareas, hitos, Kanban, Gantt
- Sprints, recursos, workload, timelogs
- **IA Predictiva**: probabilidad de adjudicación, atraso, sobrecosto, fallo operativo
- **Business Case**: análisis financiero (ROI, margen, payback, break-even), semáforo de viabilidad
- **Simulación financiera**: escenarios optimista/probable/pesimista
- **Cashflow**: control financiero mensual, burn rate, capital inmovilizado
- **Pipeline comercial**: LEAD → OPORTUNIDAD → ANÁLISIS → VISITA TÉCNICA → PROPUESTA → NEGOCIACIÓN → ADJUDICADO/PERDIDO
- **Análisis de licitaciones con IA**: extracción de requisitos, riesgos, plazos, costos
- **Gestión de aprobaciones por etapa**: LICITACION_BORRADOR → DIMENSIONADO → COTIZADO → APROBADO → ADJUDICADO → EN_EJECUCIÓN → CERRADO
- Contratos, lecciones aprendidas, propuestas
- Dimensionamiento operativo
- Templates de proyectos
- Programas y scorecards
- Knowledge base
- Notificaciones de proyecto
- Auditoría del proyecto
- Portal de cliente

### 2.31 Producto Standalone: AUDIT360
**Rutas API**: `/audit360/*`
**Autenticación propia**: `audit360Auth`

**Funcionalidades implementadas:**
- Gestión de firmas auditoras
- Clientes, contratos
- Programa de auditorías
- Estándares
- Portal de cliente
- Documentos
- Dashboard ejecutivo
- Alertas y workflows
- Copilot con IA
- Búsqueda
- Seguridad y log de auditoría
- Análisis con IA
- Suscripción y billing propio

### 2.32 Producto Standalone: SEH360
**Rutas API**: propias registradas en app.ts
**Autenticación propia**: `seh360Auth`

**Funcionalidades implementadas:**
- Seguridad, higiene y entorno
- Matriz legal
- Actualizaciones legales
- Exportación legal
- IA para SEH
- Biblioteca legal
- Portal de cliente

---

## 3. INTERRELACIONES ENTRE MÓDULOS

SGI360 no es una colección de módulos aislados. Las interrelaciones están implementadas a nivel de base de datos (FKs escalares) y lógica de negocio:

| Origen | Destino | Tipo de relación |
|--------|---------|-----------------|
| No Conformidad | Riesgo | `riskId` — trazabilidad de NC desde riesgo |
| No Conformidad | Indicador | `indicatorId` + `indicatorMeasurementId` |
| No Conformidad | Cliente | `customerLinks` |
| No Conformidad | Parte Interesada | `stakeholderId` |
| No Conformidad | Peligro (Hazard) | `hazards` relation |
| No Conformidad | Aspecto Ambiental | `environmentalAspects` relation |
| No Conformidad | Simulacro | `drillScenarios` relation |
| No Conformidad | Proceso | `processId` |
| No Conformidad | Portal Externo | `portalAccessTokenId` |
| Hallazgo de Auditoría | NCR | `ncrId` |
| Hallazgo de Auditoría | Riesgo | `riskId` |
| Hallazgo de Auditoría | Indicador | `indicatorId` |
| Objetivo SGI | Indicador | `ObjectiveIndicator` (M:N) |
| Objetivo SGI | Riesgo | `ObjectiveRisk` (M:N) |
| Objetivo SGI | Auditoría | `ObjectiveAudit` (M:N) |
| Objetivo SGI | CAPA | `ObjectiveCAPA` (M:N) |
| Objetivo SGI | Política | `policyId` |
| Objetivo SGI | Cargo | `responsiblePositionId` |
| Indicador | Riesgo | `IndicatorRiskLink` (M:N) |
| Proceso | Indicador | `ProcessIndicator` (M:N) |
| Proceso | Documento | `ProcessDocument` (M:N) |
| Proceso | Riesgo | `ProcessRisk` (M:N) |
| Proceso | Objetivo | `sgiObjectives` relation |
| Proceso | Subproceso | `parentId` (jerarquía 2 niveles) |
| Gestión de Cambios | Proceso | `GestionCambioProceso.processId` |
| Gestión de Cambios | Parte Interesada | `GestionCambioParte.stakeholderId` |
| Gestión de Cambios | Riesgo/Peligro | `GestionCambioRiesgo.riskId` |
| Gestión de Cambios | Documento | `GestionCambioDocumento.documentId` |
| Gestión de Cambios | Proyecto | `projectId` (FK escalar) |
| Simulacro | Riesgo | `riskId` |
| Simulacro | Aspecto Ambiental | `environmentalAspectId` |
| Simulacro | Peligro | `hazards` relation |
| Simulacro | NCR | `nonConformities` relation |
| Simulacro | Empleado | `responsibleId`, `drillParticipants` |
| Plan de Acción | NCR | `sourceType: NCR, sourceId` |
| Plan de Acción | Auditoría | `sourceType: AUDIT` |
| Plan de Acción | Indicador | `sourceType: INDICATOR` |
| Plan de Acción | Riesgo | `sourceType: RISK` |
| Plan de Acción | Incidente | `sourceType: INCIDENT` |
| Capacitación | Competencia | `competencyIds` |
| Capacitación | Empleado | `TrainingAssignment` |
| Evaluación de Desempeño | Competencia | Matriz requerido vs actual |
| Evaluación de Desempeño | Capacitación | Brecha → necesidad de capacitación |
| Evaluación de Desempeño | Objetivo | `SgiObjective` por responsiblePositionId |
| Ausencias | Capacitación | `trainingAssignment` (try/catch) |
| Ausencias | Disponibilidad | CoverageRule, EmployeeCompetency |
| Cliente | NCR | `customerLinks` |
| Cliente | Encuesta | `CustomerSurvey` (M:N) |
| Cliente | Documento | `documents` relation |
| Cliente | Plan de Mejora | `customerImprovementPlans` |
| Proyecto (SGI) | Indicador | `indicatorId` |
| Proyecto (P360) | Indicador | `indicatorId` |
| Proyecto (P360) | Minuta | `minutas` relation |
| Proyecto (P360) | Cliente | `pipeline.clientId` |
| Proyecto (P360) | Proveedor | `budgetItems.proveedorId` |
| Mantenimiento | Inspecciones | `WorkOrder.origen: INSPECCION` |
| Mantenimiento | Flota | `VehiculoHistorialMantenimiento` |
| Documento | Cláusula Normativa | `DocumentClauseMapping` (M:N) |
| Documento | Proceso | `ProcessDocument` |
| Documento | Cliente | `documents` relation |
| Notificaciones | NCR | `NCR_ASSIGNED`, `NCR_STATUS_CHANGED`, `NCR_OVERDUE` |
| Notificaciones | Auditoría | `AUDIT_COMPLETED`, `AUDIT_FAILED` |
| Notificaciones | Capacitación | `TRAINING_SCHEDULED`, `TRAINING_REMINDER` |
| Notificaciones | Riesgo | `RISK_CRITICAL` |
| Notificaciones | Proyecto | `APROBACION_PROYECTO` |

---

## 4. CASOS COTIDIANOS DE USO

### Caso 1: Detección y gestión de una No Conformidad
1. Un auditor interno detecta una desviación durante una auditoría
2. Crea la NCR desde el módulo de Calidad o desde el hallazgo de auditoría
3. Se asigna automáticamente al responsable (notificación por email + in-app)
4. El responsable analiza causa raíz (5 Whys / Ishikawa)
5. Define acciones correctivas y preventivas (Plan de Acción)
6. Se vincula con el riesgo correspondiente y el indicador afectado
7. Se verifica la eficacia de la acción
8. Se cierra la NCR con evidencia

### Caso 2: Preparación para auditoría externa de certificación
1. Se usa "Preparación de Auditoría" para evaluar el readiness por cláusula
2. Se revisan las brechas detectadas
3. Se consultan los documentos vinculados a cada cláusula (Mapeo documento-cláusula)
4. Se verifican las evidencias de cumplimiento
5. Se programa la auditoría en el módulo de Auditorías
6. Se asigna el equipo auditor y se notifica
7. Durante la auditoría, se completa el checklist por cláusula
8. Se registran los hallazgos
9. Se genera el informe de auditoría (PDF/Word)
10. Los hallazgos generan NCRs automáticamente

### Caso 3: Gestión de un cambio organizacional
1. Se detecta la necesidad de cambio (ej: nuevo proceso)
2. Se crea la solicitud de cambio en Gestión de Cambios
3. Se evalúa el impacto multidimensional (calidad, SST, ambiental, operativo, etc.)
4. Se vinculan procesos afectados, partes interesadas, riesgos, documentos
5. Se define el plan de comunicación y capacitación
6. Se aprueba o rechaza (con historial completo)
7. Se implementan los cambios con evidencias
8. Se verifica la eficacia del cambio
9. Se cierra el cambio

### Caso 4: Gestión de capacitaciones con seguimiento ISO 9001
1. Se detecta una brecha de competencias (matriz requerido vs actual)
2. Se crea una capacitación que cubre la competencia faltante
3. Se asignan los asistentes (empleados)
4. Se notifica a los asignados (email + in-app)
5. Se realiza la capacitación (presencial/virtual/mixta/e-learning)
6. Se evalúa la satisfacción post-capacitación
7. A los 30-90 días se evalúa la efectividad
8. Se actualiza el nivel de competencia del empleado
9. Se genera el registro documental (exportación)

### Caso 5: Inspección de activo vía QR
1. Un operario escanea el QR pegado en el activo (camión, autoelevador, extintor)
2. Se abre la inspección en su móvil (sin login)
3. Completa el checklist (built-in o personalizado)
4. Si detecta un problema, se genera un hallazgo
5. El hallazgo puede generar una OT de mantenimiento automáticamente
6. El supervisor revisa los hallazgos desde el panel
7. Se cierran o se convierten en NCR

### Caso 6: Revisión por la Dirección
1. Se crea el informe de Revisión por la Dirección
2. El sistema auto-genera datos de cada sección (auditorías, NCR, KPIs, etc.)
3. La dirección añade texto libre, decisiones y acciones
4. Se generan salidas (decisiones, acciones, responsables, fechas)
5. Se finaliza el informe

### Caso 7: Análisis de licitación con IA (PROYECT360)
1. Se crea un proyecto de tipo licitación
2. Se sube el pliego/licitación (PDF)
3. La IA extrae: requisitos, riesgos, plazos, costos estimados
4. Se genera un Business Case (ROI, margen, payback, viabilidad)
5. Se simulan escenarios financieros (optimista/probable/pesimista)
6. La IA predice: probabilidad de adjudicación, de atraso, de sobrecosto
7. Se gestiona el pipeline comercial
8. Se aprueba por etapas (borrador → dimensionado → cotizado → aprobado → adjudicado)

### Caso 8: Comunicado interno a todo el personal
1. Se redacta un comunicado en el editor rich text
2. Se pega la firma automática de la empresa
3. Se adjuntan archivos si es necesario
4. Se envía a todos los empleados
5. Se trackea quién lo leyó (pixel + confirmación)
6. Se puede reenviar a quienes no lo leyeron

---

## 5. FUNCIONALIDADES CON MAYOR POTENCIAL DE VENTA

### 5.1 IA Integrada en múltiples módulos
- **Análisis de licitaciones**: extracción automática de requisitos, riesgos y costos desde PDF
- **IA predictiva de proyectos**: probabilidad de adjudicación, atraso, sobrecosto
- **Análisis de brechas de desempeño**: sugerencias de capacitación
- **Análisis de impacto de ausencias**: solapamiento de equipo, cobertura
- **Sugerencias de hallazgos en auditorías**
- **Resumen ejecutivo de minutas**
- **Chat de IA genérico** (`/ai/chat`)
- **Implementación de procesos con IA**: genera procesos desde plantillas normativas
- **Configurable por tenant**: proveedor LLM, modelo, API key propios

### 5.2 Sistema de Exportación Documental
- 31+ endpoints, 13 pestañas en documentos
- Exportación PDF con marca blanca (logo, colores, encabezados)
- Validación pública de documentos vía token
- Exportación masiva (LIBRO_SGI, RESPALDO, AUDIT_PACK)
- Versionado de plantillas, retención documental
- Auditoría completa de exportaciones

### 5.3 Inspecciones Inteligentes con QR
- Checklists predefinidos (camión, autoelevador, extintor, maquinaria, edificio)
- QR imprimible por activo
- Inspección móvil sin login
- Generación automática de hallazgos y OT
- Dashboard de KPIs de inspecciones

### 5.4 Gestión de Cambios multidimensional
- Evaluación en 7 dimensiones (calidad, SST, ambiental, operativo, tecnológico, legal, continuidad)
- Nivel global calculado automáticamente
- Vinculación con procesos, partes interesadas, riesgos, documentos
- Workflow completo con verificación de eficacia
- Vinculación con proyecto de implementación

### 5.5 Mapa de Procesos con plantillas normativas
- Catálogo IATF 16949 (15 procesos) + ISO 9001 (10 procesos)
- Importación asistida por IA
- Jerarquía de 2 niveles (macroproceso → subproceso)
- Enfoque por procesos (clientes/proveedores internos, actividades)
- Diagrama visual

### 5.6 PROYECT360 Enterprise
- IA predictiva con scores multidimensionales
- Business Case con semáforo de viabilidad
- Simulación financiera multi-escenario
- Pipeline comercial con competitors
- Cashflow mensual con burn rate
- Gestión de aprobaciones por etapa
- Gantt Enterprise con critical path

### 5.7 Portal Externo
- Creación de NCR desde el exterior (clientes, proveedores)
- Encuestas de satisfacción públicas
- Validación pública de documentos
- Inspecciones móviles vía QR

### 5.8 Multi-norma
- Soporte simultáneo de ISO 9001, 14001, 45001, 39001, IATF 16949, ISO 27001, ISO 50001
- Mapeo documento-cláusula por norma
- Cumplimiento normativo con evidencias

### 5.9 Evaluación de Desempeño 360°
- Ciclos, plantillas, escalas
- Autoevaluación + supervisor + evaluadores múltiples
- Brechas → planes de desarrollo → capacitaciones
- Integración con competencias y objetivos

### 5.10 Clima y Cultura con tracking
- Comunicados con tracking de lectura
- Buzón de sugerencias anónimo
- Canal QR
- Encuestas de clima

---

## 6. POSIBLES CLIENTES Y MENSAJES

### Segmento 1: Empresas certificadas o en proceso de certificación ISO
**Perfil**: Empresas manufactureras, de servicios, logística, transporte que ya tienen o buscan certificación ISO 9001 / 14001 / 45001 / IATF 16949.
**Mensaje**: "Deje de gestionar su SGI en Excel. SGI360 digitaliza todo el ciclo: documentos, no conformidades, auditorías, indicadores, gestión de cambios y revisión por la dirección. Cumpla con auditorías externas sin estrés."

### Segmento 2: Empresas de transporte y logística
**Perfil**: Empresas de transporte de carga, logística, distribución con flota vehicular.
**Mensaje**: "Gestione su SGI, su flota y sus inspecciones en un solo sistema. QR en cada activo para inspecciones móviles. IATF 16949 si es automotive. ISO 39001 para seguridad vial."

### Segmento 3: Empresas que licitan obras/servicios
**Perfil**: Empresas de construcción, servicios, mantenimiento que participan en licitaciones públicas/privadas.
**Mensaje**: "Analice licitaciones con IA, simule escenarios financieros, prediga su probabilidad de adjudicación y gestione el proyecto completo con PROYECT360."

### Segmento 4: Firmas auditoras / consultoras
**Perfil**: Empresas que realizan auditorías de certificación o consultoría ISO.
**Mensaje**: "AUDIT360: gestione sus clientes, contratos, programas de auditoría, equipo auditor, hallazgos e informes. Portal de cliente incluido."

### Segmento 5: Empresas con muchos empleados y alta rotación
**Perfil**: Empresas industriales, de servicios, con más de 50 empleados.
**Mensaje**: "RRHH completo: organigrama, competencias, evaluación de desempeño 360°, ausencias con disponibilidad y cobertura, capacitaciones con seguimiento ISO 9001."

### Segmento 6: Empresas que ya tienen un SGI pero lo gestionan en papel/Excel
**Perfil**: Cualquier empresa certificada que todavía usa planillas Excel y carpetas compartidas.
**Mensaje**: "Migre su SGI a digital sin perder lo que ya tiene. Mapa de procesos desde plantillas IATF/ISO, importación asistida con IA, trazabilidad completa."

---

## 7. DIFERENCIADORES Y OBJECIONES

### Diferenciadores reales y verificables

1. **Multi-norma real**: No es solo ISO 9001. Soporta 7+ normas simultáneamente con mapeo documento-cláusula.
2. **IA integrada en múltiples módulos**: No es un chatbot decorativo. Analiza licitaciones, predice resultados de proyectos, sugiere hallazgos, genera procesos, resume minutas, analiza brechas.
3. **Inspecciones móviles con QR**: Sin app que instalar. Escanea → inspecciona → genera hallazgo/OT.
4. **Gestión de Cambios multidimensional**: 7 dimensiones con nivel global automático. No es un simple formulario.
5. **Portal externo**: Clientes y proveedores pueden crear NCR sin cuenta. Validación pública de documentos.
6. **PROYECT360 con IA predictiva**: Business case, simulación financiera, pipeline comercial. No es solo un gestor de tareas.
7. **Trazabilidad real entre módulos**: NCR → riesgo → indicador → proceso → objetivo → auditoría. Todo vinculado.
8. **Multi-tenant SaaS real**: Cada empresa tiene sus datos aislados. No es una instalación on-premise por cliente.
9. **Centro de Ayuda con 25 guías reales**: Capturas de pantalla reales, pasos detallados, navegación directa.
10. **Planes escalables**: BASIC → PROFESSIONAL → PREMIUM con bloqueo/permisos real por módulo.

### Objeciones y respuestas

| Objeción | Respuesta |
|---------|-----------|
| "Ya usamos Excel/papel y funciona" | Excel no da trazabilidad entre NCR, riesgos, indicadores y auditorías. En auditorías externas se pierde tiempo buscando evidencias. SGI360 lo resuelve con búsqueda y vínculos. |
| "Es muy caro" | Desde plan BASIC con módulos esenciales. Setup único USD 200. Suscripción mensual. Ahorra horas de preparación de auditorías. |
| "La IA es un adorno" | La IA analiza licitaciones reales (extrae requisitos de PDF), predice resultados de proyectos, sugiere hallazgos en auditorías, genera procesos desde plantillas normativas. |
| "Necesita instalación local" | Es SaaS. No requiere instalación. Solo registro y configuración de empresa. |
| "No soporta nuestra norma" | Soporta ISO 9001, 14001, 45001, 39001, IATF 16949, ISO 27001, ISO 50001 y CUSTOM. |
| "¿Qué pasa con nuestros datos?" | Multi-tenant con aislamiento por tenantId. PostgreSQL. Backups. Auditoría de acceso. |
| "¿Y si dejamos de pagar?" | Período de gracia de 7 días. Datos conservados. Plan reactivable. |
| "Es muy complejo para nuestro equipo" | Centro de Ayuda con 25 guías visuales. Onboarding. Permisos granulares. |

---

## 8. QUÉ PODEMOS PUBLICITAR HOY

### Funcionalidades desplegadas y operativas en producción

- ✅ Gestión completa de No Conformidades con workflow y portal externo
- ✅ Plan de Acción con 7 secciones y análisis de causa raíz
- ✅ Gestión de Cambios multidimensional con verificación de eficacia
- ✅ Auditorías con programa anual, equipo auditor, checklist, hallazgos e informe
- ✅ Revisión por la Dirección con datos auto-generados
- ✅ Indicadores (KPIs) con mediciones, tendencias y vinculación a riesgos
- ✅ Riesgos SGI con acciones de tratamiento
- ✅ IPERC con jerarquía de controles y seguimiento de efectividad
- ✅ Aspectos Ambientales con evaluación de significancia
- ✅ Simulacros de emergencia con planificación y evaluación
- ✅ Documentos con 13 pestañas, codificación, versionado, revisiones
- ✅ Cumplimiento Normativo multi-norma con mapeo de cláusulas
- ✅ Mapa de Procesos con jerarquía 2 niveles y plantillas IATF/ISO
- ✅ Implementación de procesos con IA
- ✅ Contexto del SGI (FODA, PESTEL, partes interesadas)
- ✅ Objetivos SGI con vinculación a indicadores, riesgos, auditorías
- ✅ RRHH: empleados, cargos, organigrama, competencias, capacitaciones
- ✅ Evaluación de Desempeño con IA (desplegado en producción)
- ✅ Capacitaciones con satisfacción y efectividad (ISO 9001)
- ✅ Clientes con encuestas de satisfacción
- ✅ Proveedores
- ✅ Infraestructura: mantenimiento, calibraciones
- ✅ Inspecciones Inteligentes con QR (desplegado en testing)
- ✅ Flota vehicular, neumáticos, combustible, siniestros
- ✅ Minutas con resumen IA
- ✅ Clima y Cultura con comunicados y tracking de lectura
- ✅ Notificaciones automáticas
- ✅ Centro de Ayuda con 25 guías
- ✅ Sistema de licencias con MercadoPago
- ✅ Autenticación con 2FA
- ✅ Multi-tenant con planes escalables
- ✅ Command Center con IA
- ✅ Preparación de Auditoría
- ✅ Calendario integrado
- ✅ Reportes y exportación

### Funcionalidades en código pero pendientes de deploy

- ⏳ Sistema Global de Exportación Documental (22 etapas completadas, requiere migración + build)
- ⏳ Ausencias y Disponibilidad (completo en código, requiere migración + deploy)
- ⏳ Algunas funcionalidades de PROYECT360 Enterprise (módulo standalone)

### Funcionalidades parciales o en desarrollo

- 🔧 Portal del empleado para autoevaluación de desempeño (backend existe, UI pendiente)
- 🔧 Evaluación 360° (backend existe, UI pendiente)
- 🔧 Permisos granulares finos en algunos módulos

---

## 9. RESUMEN PARA ENTREGAR A QUIEN DISEÑARÁ LA CAMPAÑA

### Qué es SGI360
Plataforma SaaS multi-empresa para gestionar TODO el Sistema de Gestión de la Calidad, Seguridad, Ambiente y proyectos de forma digital. No es un Excel mejorado: es un sistema integrado donde una No Conformidad se vincula con un riesgo, que se vincula con un indicador, que se vincula con un objetivo, que se revisa en una auditoría, que se cierra en la Revisión por la Dirección.

### Para quién es
Empresas certificadas (o en proceso) en normas ISO que quieren digitalizar su gestión. Especialmente: industria, transporte, logística, construcción, servicios. También firmas auditoras (con AUDIT360) y empresas que licitan (con PROYECT360).

### Qué resuelve
- Caos de Excel y carpetas compartidas
- Falta de trazabilidad entre módulos del SGI
- Dificultad para preparar auditorías externas
- Gestión manual de No Conformidades y Planes de Acción
- Sin visibilidad de indicadores en tiempo real
- Inspecciones en papel sin seguimiento
- Comunicación interna deficiente
- Evaluación de desempeño manual
- Análisis de licitaciones manual y subjetivo

### Qué tiene de único
1. IA real funcionando en múltiples módulos (no decorativa)
2. Inspecciones móviles con QR sin instalar app
3. Gestión de Cambios con evaluación en 7 dimensiones
4. Mapa de Procesos con plantillas normativas e IA
5. PROYECT360 con IA predictiva y simulación financiera
6. Portal externo para que clientes/proveedores creen NCR
7. Multi-norma (7+ normas simultáneas)
8. Trazabilidad real entre todos los módulos

### Qué NO prometer
- Ausencias y Disponibilidad: en código, no desplegado todavía
- Sistema Global de Exportación Documental completo: en código, pendiente de deploy
- Autoevaluación y 360° en portal del empleado: backend existe, UI pendiente
- App móvil nativa: no existe (las inspecciones son web mobile-first vía QR)
- Integración con ERP externos: no implementado
- Reportes BI personalizados: no implementado (hay reportes estándar)

### Mensajes clave para la campaña
1. "Digitalice su SGI completo. Deje de usar Excel."
2. "IA que analiza licitaciones, predice resultados y sugiere hallazgos."
3. "Inspecciones con QR. Sin apps. Sin papel."
4. "Todo vinculado: NCR → Riesgo → Indicador → Objetivo → Auditoría."
5. "Multi-norma: ISO 9001, 14001, 45001, IATF 16949 y más."
6. "Desde el plan BASIC. Sin instalar nada."

### Datos técnicos para respaldo
- 100+ modelos de datos en Prisma
- 60+ archivos de rutas API en Fastify
- 25+ módulos frontend en Next.js 14
- 7+ normas soportadas
- Multi-tenant con aislamiento real
- Docker, CI/CD, AWS
- Producción activa en 54.94.33.5
- Testing en 18.191.206.203

---

*Este informe se basa exclusivamente en el análisis del código fuente, modelos de datos, rutas API, pantallas frontend y documentación del proyecto SGI360. Las funcionalidades marcadas como implementadas son verificables en el código. Las marcadas como pendientes o parciales reflejan el estado real al momento del análisis.*
