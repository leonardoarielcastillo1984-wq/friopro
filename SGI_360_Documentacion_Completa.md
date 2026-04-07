# SGI 360 - Sistema de Gestión Integrado
## Documentación Completa del Sistema

**Versión:** 1.0  
**Última actualización:** 2026-04-03  
**Estado:** Todos los módulos operativos y blindados

---

## 📋 Índice de Módulos

1. [Panel General / Dashboard](#1-panel-general--dashboard)
2. [Mantenimiento](#2-mantenimiento)
3. [RRHH (Recursos Humanos)](#3-rrhh-recursos-humanos)
4. [Documentos](#4-documentos)
5. [Reportes](#5-reportes)
6. [Simulacros / Emergencias](#6-simulacros--emergencias)
7. [Project360](#7-project360)
8. [Clientes](#8-clientes)
9. [Encuestas](#9-encuestas)
10. [Capacitaciones](#10-capacitaciones)
11. [Indicadores](#11-indicadores)
12. [Riesgos](#12-riesgos)
13. [No Conformidades (NCR)](#13-no-conformidades-ncr)
14. [Auditorías](#14-auditorías)
15. [Normativos](#15-normativos)
16. [Configuración](#16-configuración)
17. [Administración](#17-administración)
18. [Inteligencia / IA](#18-inteligencia--ia)

---

## 1. Panel General / Dashboard

**Propósito:** Vista ejecutiva consolidada de todos los módulos del SGI.

### Funcionalidades:
- **Dashboard Principal:** Resumen ejecutivo con métricas en tiempo real
- **Indicadores Clave (KPIs):** Evolución de Indicadores, No Conformidades Abiertas
- **Gráficos Modernos:** Diseño visual mejorado con Recharts
- **Salud por Módulo:** Porcentaje de cumplimiento por área
  - Documentos (% vigentes)
  - No Conformidades (% cerradas)
  - Riesgos (% bajos/medios)
  - Normativos (% listos)
  - Auditoría IA (% hallazgos cerrados)
  - Capacitaciones (% completadas)
- **Alertas Activas:** NCRs vencidas, críticas, riesgos críticos
- **Distribuciones:** Riesgos por nivel, NCRs por estado

### Endpoints:
```
GET /dashboard - Estadísticas consolidadas
```

### Archivos:
- `apps/web/src/app/(app)/panel/page.tsx`
- `apps/web/src/app/(app)/dashboard/page.tsx`
- `apps/api/src/routes/dashboard.ts`

---

## 2. Mantenimiento

**Propósito:** Gestión integral de mantenimiento industrial.

### Funcionalidades:
**Activos:**
- Crear/editar/eliminar activos (código: ACT-XXXXX)
- Clasificación por tipo y ubicación
- Especificaciones técnicas
- Documentación adjunta
- QR/Barcode para identificación

**Técnicos:**
- Registro de técnicos especializados
- Asignación de habilidades
- Control de disponibilidad

**Planes de Mantenimiento:**
- Planes preventivos (diario, semanal, mensual, anual)
- Planes predictivos (basados en condición)
- Planes correctivos
- Trigger automático de órdenes

**Órdenes de Trabajo (OT):**
- Generación automática desde planes
- Asignación de técnicos
- Estados: Pendiente → En Progreso → Completada → Cancelada
- Registro de tiempo y materiales
- Checklist de actividades
- Firmas digitales
- Fotos/evidencia

**Dashboard:**
- OTs pendientes, en progreso, completadas
- Activos por estado
- Técnicos ocupados/disponibles
- Alertas de mantenimiento vencido

### Endpoints:
```
GET/POST /maintenance/assets
GET/PUT/DELETE /maintenance/assets/:id
GET/POST /maintenance/technicians
GET/POST /maintenance/plans
GET/POST /maintenance/work-orders
```

### Archivos:
- `apps/api/src/routes/maintenance.ts`
- `apps/web/src/app/(app)/mantenimiento/page.tsx`

---

## 3. RRHH (Recursos Humanos)

**Propósito:** Gestión del capital humano.

### Funcionalidades:
**Empleados:**
- Ficha completa del empleado
- Documentos personales (CV, contratos, certificados)
- Historial de puestos
- Control de vencimientos (certificaciones médicas, capacitaciones)

**Puestos:**
- Descripción de cargos
- Requisitos del puesto
- Responsabilidades
- Organigrama

**Organización:**
- Departamentos
- Jerarquías
- Jefaturas

**Documentación:**
- Subida de documentos por empleado
- Categorización automática
- Alertas de vencimiento

### Endpoints:
```
GET/POST /hr/employees
GET/PUT/DELETE /hr/employees/:id
GET/POST /hr/positions
GET/POST /hr/departments
GET/POST /hr/documents
```

### Archivos:
- `apps/api/src/routes/hr.ts`
- `apps/web/src/app/(app)/rrhh/page.tsx`

---

## 4. Documentos

**Propósito:** Gestión documental del sistema de calidad.

### Funcionalidades:
**Documentos:**
- Crear documento (código: DOC-XXX)
- Tipos: Manual, Procedimiento, Instructivo, Formato, Política, Externo
- Estados: Borrador, En Revisión, Vigente, Obsoleto
- Control de versiones (v1.0, v1.1, etc.)
- Aprobaciones con workflow
- Vinculación con normativos (mapeo ISO)

**Versiones:**
- Historial completo de cambios
- Comparación entre versiones
- Rollback a versiones anteriores

**Aprobaciones:**
- Flujo de aprobación configurable
- Notificaciones a aprobadores
- Firma digital
- Rechazo con comentarios

**Vencimientos:**
- Fecha de revisión programada
- Alertas automáticas
- Renovación de documentos

### Endpoints:
```
GET/POST /documents
GET/PUT/DELETE /documents/:id
GET/POST /documents/:id/versions
POST /documents/:id/approve
POST /documents/:id/reject
```

### Archivos:
- `apps/api/src/routes/documents.ts`
- `apps/web/src/app/(app)/documents/page.tsx`

---

## 5. Reportes

**Propósito:** Generación de reportes ejecutivos y operativos.

### Funcionalidades:
**Reportes Predefinidos:**
- Dashboard de cumplimiento ISO
- Estado de documentos
- No conformidades por área
- Indicadores de desempeño
- Auditorías programadas
- Riesgos críticos

**Reportes Personalizados:**
- Selección de módulos
- Filtros por fecha, área, estado
- Exportación a Excel/PDF
- Programación de envío

**KPIs:**
- Configuración de indicadores
- Metas y umbrales
- Alertas por desviación
- Histórico de mediciones

### Endpoints:
```
GET /reports
POST /reports/generate
GET /reports/:id/download
```

### Archivos:
- `apps/api/src/routes/reports.ts`
- `apps/web/src/app/(app)/reportes/page.tsx`

---

## 6. Simulacros / Emergencias

**Propósito:** Gestión de emergencias y simulacros.

### Funcionalidades:
**Planes de Contingencia:**
- Crear planes por tipo de emergencia
- Asignación de brigadistas
- Rutas de evacuación
- Puntos de reunión
- Estados: Borrador, Aprobado, En Revisión, Obsoleto

**Simulacros (Drills):**
- Programación de simulacros
- Escenarios de simulacro
- Evaluación de respuesta
- Hallazgos y acciones correctivas
- Estados: Programado, En Ejecución, Completado, Cancelado

**Recursos de Emergencia:**
- Inventario de equipos
- Ubicación de recursos
- Mantenimiento de equipos
- Inspecciones periódicas

**Brigadistas:**
- Registro de brigadistas
- Capacitaciones específicas
- Designación de roles

### Endpoints:
```
GET/POST /emergency/contingency-plans
GET/PUT/DELETE /emergency/contingency-plans/:id
GET/POST /emergency/drills
GET/PUT/DELETE /emergency/drills/:id
GET/POST /emergency/resources
GET/PUT/DELETE /emergency/resources/:id
```

### Archivos:
- `apps/api/src/routes/emergency.ts`
- `apps/web/src/app/(app)/simulacros/page.tsx`

---

## 7. Project360

**Propósito:** Gestión de planes de acción y mejora continua.

### Funcionalidades:
**Proyectos/Planes de Acción:**
- Crear proyecto (código: PROJ-YYYY-XXX)
- Origen: Hallazgo Auditoría, No Conformidad, Incidente, Desvío Simulacro, Problema Mantenimiento, Riesgo Detectado, Objetivo Dirección, Manual
- Responsable asignado
- Fechas de inicio y objetivo
- Prioridad: Baja, Media, Alta, Crítica
- Estados: Pendiente, En Ejecución, En Riesgo, Vencido, Completado, Cancelado, En Pausa
- Indicador KPI asociado

**Vistas:**
- Vista Lista: Tabla con todos los proyectos
- Vista Tablero (Kanban): Columnas por estado
- Semáforo de estado (verde/amarillo/rojo)

**Tareas:**
- Crear tareas dentro de proyectos
- Asignación de responsables
- Fechas de vencimiento
- Dependencias entre tareas
- Evidencia requerida
- Estados: Pendiente, En Progreso, Bloqueada, Completada, Cancelada

**Comentarios:**
- Comentarios en tareas
- Menciones a usuarios
- Adjuntos en comentarios

**Adjuntos:**
- Subir archivos a proyectos
- Categorización de adjuntos
- Control de versiones

**Historial:**
- Registro de todas las actividades
- Cambios de estado
- Actualizaciones de progreso

**Notificaciones:**
- Notificaciones automáticas
- Recordatorios de vencimiento
- Alertas de riesgo

**Exportación:**
- Exportar proyectos a Excel
- Reportes de avance

### Endpoints:
```
GET/POST /project360/projects
GET/PUT/DELETE /project360/projects/:id
GET /project360/stats
GET/POST /project360/projects/:id/tasks
POST /project360/tasks/:taskId/comments
GET/POST /project360/projects/:id/attachments
GET /project360/projects/:id/history
GET/POST /project360/notifications
POST /project360/projects/:id/reminders
```

### Archivos:
- `apps/api/src/routes/project360.ts`
- `apps/web/src/app/(app)/project360/page.tsx`
- `apps/web/src/app/(app)/project360/components.tsx`
- `apps/web/src/app/(app)/project360/board-card.tsx`
- `apps/web/src/lib/project360-export.ts`

---

## 8. Clientes

**Propósito:** Gestión de relaciones con clientes (CRM).

### Funcionalidades:
**Clientes:**
- Crear cliente (código: CLI-YYYY-NNN)
- Datos de contacto
- Información comercial
- Historial de interacciones
- Segmentación

**Encuestas asignadas:**
- Vincular encuestas a clientes
- Seguimiento de respuestas
- Tasa de respuesta

**Comunicaciones:**
- Envío de encuestas por email
- Historial de envíos
- Seguimiento de lectura

### Endpoints:
```
GET/POST /customers
GET/PUT/DELETE /customers/:id
POST /customers/:id/surveys/:surveyId/send
```

### Archivos:
- `apps/api/src/routes/customers.ts`
- `apps/web/src/app/(app)/clientes/page.tsx`

---

## 9. Encuestas

**Propósito:** Gestión de encuestas de satisfacción y feedback.

### Funcionalidades:
**Encuestas:**
- Crear encuesta (código: SRV-YYYY-NNN)
- Tipos: Satisfacción, NPS, Feedback, Custom
- Preguntas de diferentes tipos:
  - Opción múltiple
  - Escala Likert (1-5)
  - Texto libre
  - Sí/No
  - Rating

**Preguntas y Opciones:**
- Agregar/editar/eliminar preguntas
- Reordenar preguntas
- Opciones condicionales
- Preguntas obligatorias/opcionales

**Asignación:**
- Asignar a clientes específicos
- Asignación masiva
- Segmentación

**Respuestas:**
- Recopilación de respuestas
- Token único de acceso
- Acceso público seguro

**Análisis:**
- Estadísticas de respuestas
- Tasa de respuesta
- NPS Score
- Satisfacción promedio
- Exportación de resultados

### Endpoints:
```
GET/POST /surveys
GET/PUT/DELETE /surveys/:id
POST /surveys/:id/questions
POST /surveys/:id/assign
GET /surveys/public/:token
POST /surveys/public/:token/submit
```

### Archivos:
- `apps/api/src/routes/surveys.ts`
- `apps/web/src/app/(app)/encuestas/page.tsx`
- `apps/api/src/routes/survey-public.ts`

---

## 10. Capacitaciones

**Propósito:** Gestión de formación y entrenamiento.

### Funcionalidades:
**Capacitaciones:**
- Crear capacitación
- Programación de fechas
- Modalidad: Presencial, Virtual, Híbrida
- Instructores internos/externos
- Ubicación/sala virtual
- Material de capacitación

**Participantes:**
- Inscripción de participantes
- Lista de asistencia
- Control de firma digital
- Evaluaciones

**Evaluaciones:**
- Evaluación de satisfacción
- Evaluación de aprendizaje
- Certificados de participación

**Seguimiento:**
- Capacitaciones completadas por empleado
- Histórico de formación
- Requerimientos de capacitación

### Endpoints:
```
GET/POST /trainings
GET/PUT/DELETE /trainings/:id
POST /trainings/:id/attendees
POST /trainings/:id/evaluations
```

### Archivos:
- `apps/api/src/routes/trainings.ts`
- `apps/web/src/app/(app)/capacitaciones/page.tsx`

---

## 11. Indicadores

**Propósito:** Gestión de KPIs y métricas de desempeño.

### Funcionalidades:
**Indicadores:**
- Crear indicador
- Nombre y descripción
- Unidad de medida (%, número, tiempo, dinero)
- Frecuencia de medición
- Meta/objetivo
- Umbrales de alerta
- Responsable de medición

**Mediciones:**
- Registrar medición periódica
- Valor actual vs meta
- Tendencia (subiendo/bajando/estable)
- Histórico de mediciones

**Alertas:**
- Alerta por debajo de meta
- Streak de indicadores (varios períodos fuera de meta)
- Notificaciones automáticas

**Dashboard:**
- Gráfico de evolución
- Comparación períodos
- Análisis de tendencias

**Vinculación:**
- Relación con riesgos
- Relación con objetivos estratégicos
- Relación con auditorías

### Endpoints:
```
GET/POST /indicators
GET/PUT/DELETE /indicators/:id
POST /indicators/:id/measurements
GET /indicators/:id/trend
```

### Archivos:
- `apps/api/src/routes/indicators.ts`
- `apps/web/src/app/(app)/indicadores/page.tsx`

---

## 12. Riesgos

**Propósito:** Gestión de riesgos empresariales.

### Funcionalidades:
**Riesgos:**
- Crear riesgo (código auto-generado)
- Descripción del riesgo
- Causas y consecuencias
- Categoría: Ambiental, Calidad, Seguridad, Legal, IATF, Tecnológico, Financiero, Reputacional

**Evaluación:**
- Probabilidad (1-5)
- Impacto (1-5)
- Nivel de riesgo (Probabilidad × Impacto)
  - Crítico: 20-25
  - Alto: 12-19
  - Medio: 5-11
  - Bajo: 1-4

**Matriz de Riesgos:**
- Visualización matriz 5×5
- Mapa de calor
- Distribución por nivel

**Tratamiento:**
- Estrategia: Evitar, Mitigar, Transferir, Aceptar
- Plan de acción
- Responsable
- Fecha de implementación

**Monitoreo:**
- Estados: Identificado, Evaluado, Mitigando, Monitoreado, Cerrado
- Reevaluación periódica
- Histórico de cambios de nivel

### Endpoints:
```
GET/POST /risks
GET/PUT/DELETE /risks/:id
POST /risks/:id/assess
POST /risks/:id/mitigate
```

### Archivos:
- `apps/api/src/routes/risks.ts`
- `apps/web/src/app/(app)/riesgos/page.tsx`

---

## 13. No Conformidades (NCR)

**Propósito:** Gestión de acciones correctivas.

### Funcionalidades:
**NCRs:**
- Crear NCR (código auto-generado)
- Descripción de la no conformidad
- Origen: Auditoría, Inspección, Cliente, Proceso Interno
- Severidad: Crítica, Mayor, Menor
- Área afectada

**Análisis:**
- Análisis de causa raíz (5 Porqués, Ishikawa, etc.)
- Determinación de causas
- Documentación de análisis

**Acciones Correctivas:**
- Plan de acción
- Responsable de implementación
- Fechas de implementación y verificación
- Evidencia de cierre

**Workflow:**
- Estados: Abierta → En Análisis → Acción Correctiva → Verificación → Cerrada
- Escalamiento automático por vencimiento
- Notificaciones a responsables
- Rechazo de cierre con comentarios

**Dashboard:**
- NCRs abiertas/cerradas
- Por severidad
- Por área
- Tiempo promedio de cierre
- Tendencias

### Endpoints:
```
GET/POST /ncr
GET/PUT/DELETE /ncr/:id
POST /ncr/:id/analyze
POST /ncr/:id/actions
POST /ncr/:id/close
```

### Archivos:
- `apps/api/src/routes/ncr.ts`
- `apps/web/src/app/(app)/no-conformidades/page.tsx`

---

## 14. Auditorías

**Propósito:** Gestión de auditorías internas y análisis con IA.

### Funcionalidades:
**Auditorías Internas (ISO):**
- Programar auditoría
- Tipo: Interna, Externa, Certificación, Seguimiento
- Norma: ISO 9001, ISO 14001, ISO 45001, IATF 16949, etc.
- Auditores asignados
- Áreas a auditar
- Fechas programadas

**Checklist:**
- Crear checklist por norma
- Preguntas de verificación
- Evidencia requerida
- Calificación: Cumple, No Cumple, Observación, No Aplica

**Hallazgos:**
- Registro de hallazgos
- Clasificación: No Conformidad Mayor, No Conformidad Menor, Observación, Oportunidad de Mejora
- Vinculación a cláusulas de norma
- Acciones correctivas derivadas

**Reportes:**
- Generación automática de informe
- Resumen ejecutivo
- Listado de hallazgos
- Plan de acción

**Análisis con IA:**
- Subir documento
- Comparar contra norma
- Análisis automático de cumplimiento
- Detección de hallazgos potenciales
- Score de cumplimiento (%)
- Recomendaciones de mejora
- Chat con IA para consultas

**Programa Anual:**
- Programación anual de auditorías
- Distribución por área
- Recursos asignados
- Dashboard de cumplimiento

### Endpoints:
```
GET/POST /audit/audits
GET/PUT/DELETE /audit/audits/:id
GET/POST /audit/checklists
GET/POST /audit/findings
POST /audit/analyze
GET /audit/schedule
```

### Archivos:
- `apps/api/src/routes/audit.ts`
- `apps/api/src/routes/audits.ts`
- `apps/web/src/app/(app)/auditorias/page.tsx`
- `apps/web/src/app/(app)/audit/page.tsx`

---

## 15. Normativos

**Propósito:** Gestión de normas y requisitos legales.

### Funcionalidades:
**Normas:**
- Subir norma (PDF)
- Información: Nombre, código, versión, fecha
- Tipo: ISO, Legal, Regulatorio, Interno
- Estado: Borrador, Activo, Obsoleto

**Procesamiento:**
- Extracción automática de texto
- Identificación de cláusulas
- Estructura jerárquica (capítulos, secciones)
- Procesamiento asíncrono con cola de trabajos

**Cláusulas:**
- Visualización de cláusulas
- Numeración automática
- Título y descripción
- Requisitos específicos

**Mapeo:**
- Vincular cláusula con documento del sistema
- Tipo de cumplimiento: Cumple, Referencia, Implementa, No Aplica
- Matriz de trazabilidad

**Brechas:**
- Análisis de brechas de cumplimiento
- Recomendaciones de implementación
- Priorización

### Endpoints:
```
GET/POST /normativos
GET/DELETE /normativos/:id
GET /normativos/:id/clauses
GET /normativos/:id/processing-status
POST /documents/:id/clauses
```

### Archivos:
- `apps/api/src/routes/normativos.ts`
- `apps/web/src/app/(app)/normativos/page.tsx`

---

## 16. Configuración

**Propósito:** Configuración general del sistema.

### Funcionalidades:
**Configuración de Empresa:**
- Nombre de la organización
- Logo y branding
- Información de contacto
- Dirección
- Configuración regional (idioma, moneda, zona horaria)

**Configuración General:**
- Preferencias de notificación
- Configuración de email
- Configuración de integraciones
- Parámetros del sistema

**Integraciones:**
- Webhooks
- APIs externas
- Conectores (email, storage, etc.)

### Endpoints:
```
GET/PUT /settings
GET/PUT /company-settings
GET/POST /integrations
```

### Archivos:
- `apps/api/src/routes/settings.ts`
- `apps/api/src/routes/company-settings.ts`
- `apps/api/src/routes/integrations.ts`
- `apps/web/src/app/(app)/configuracion/page.tsx`
- `apps/web/src/app/(app)/configuracion/empresa/page.tsx`

---

## 17. Administración

**Propósito:** Gestión de usuarios, permisos y auditoría.

### Funcionalidades:
**Usuarios:**
- Crear/editar/eliminar usuarios
- Asignación de roles
- Estados: Activo, Inactivo, Suspendido
- Información de contacto
- Preferencias personales

**Roles y Permisos:**
- Definición de roles (Admin, Usuario, Auditor, etc.)
- Permisos por módulo
- Permisos granulares (crear, editar, eliminar, ver)
- Roles personalizados

**Departamentos:**
- Crear departamentos
- Jerarquías
- Jefaturas
- Asignación de usuarios

**Auditoría:**
- Registro de actividades de usuarios
- Log de cambios
- IP y timestamp
- Exportación de logs

### Endpoints:
```
GET/POST /admin/users
GET/PUT/DELETE /admin/users/:id
GET/POST /admin/roles
GET/POST /admin/departments
GET /admin/audit-logs
```

### Archivos:
- `apps/api/src/routes/admin.ts`
- `apps/web/src/app/(app)/admin/page.tsx`
- `apps/web/src/app/(app)/admin/departments/page.tsx`

---

## 18. Inteligencia / IA

**Propósito:** Análisis avanzado con inteligencia artificial.

### Funcionalidades:
**Smart Alerts:**
- Alertas inteligentes basadas en patrones
- Configuración de reglas
- Umbrales dinámicos
- Notificaciones proactivas

**Análisis Predictivo:**
- Predicción de tendencias
- Análisis de correlación
- Pronósticos de KPIs
- Detección de anomalías

**Insights:**
- Análisis automático de datos
- Recomendaciones de mejora
- Hallazgos automáticos
- Reportes ejecutivos generados por IA

**Revisión por la Dirección:**
- Agenda de reuniones de revisión
- Minutas de reunión
- Seguimiento de acciones derivadas
- Dashboard para dirección

### Endpoints:
```
GET /intelligence/insights
GET /intelligence/alerts
GET /intelligence/predictions
POST /intelligence/analyze
GET/POST /management-review/meetings
GET /management-review/reports
```

### Archivos:
- `apps/api/src/routes/intelligence.ts`
- `apps/api/src/routes/managementReview.ts`

---

## 🔧 Arquitectura Técnica

### Backend (API)
**Framework:** Fastify + TypeScript  
**Base de Datos:** PostgreSQL + Prisma ORM  
**Autenticación:** JWT + CSRF tokens  
**Queue:** BullMQ (Redis) para jobs asíncronos  
**Storage:** Local/DigitalOcean Spaces para archivos  
**Email:** Resend  
**IA:** OpenAI/Anthropic para análisis

### Frontend (Web)
**Framework:** Next.js 14 + React 18  
**Estilos:** Tailwind CSS  
**Componentes:** shadcn/ui + Radix UI  
**Gráficos:** Recharts  
**Tablas:** TanStack Table  
**Formularios:** React Hook Form + Zod

### Estructura de Carpetas
```
apps/
├── api/                    # Backend Fastify
│   ├── src/
│   │   ├── routes/        # Endpoints por módulo
│   │   ├── prisma/        # Schema y migraciones
│   │   └── jobs/          # Workers y colas
│   └── package.json
└── web/                   # Frontend Next.js
    ├── src/
    │   ├── app/(app)/     # Páginas de la app
    │   ├── components/    # Componentes reutilizables
    │   └── lib/          # Utilidades y API client
    └── package.json
```

---

## 📝 Notas Importantes

### Convenciones de Código
- Todos los módulos usan prefijo en español para rutas de frontend
- Backend usa inglés para endpoints API
- Códigos auto-generados: `{PREFIX}-{YYYY}-{NNN}`

### Seguridad
- Todas las rutas protegidas con autenticación JWT
- CSRF tokens para operaciones de escritura
- Tenant isolation en todos los endpoints
- Rate limiting aplicado

### Soft Delete
- La mayoría de entidades usan soft delete (campo `deletedAt`)
- Los datos eliminados se mantienen para auditoría

---

## 📅 Historial de Blindaje

| Módulo | Fecha | Estado |
|--------|-------|--------|
| Mantenimiento | 2026-04-03 | ✅ Blindado |
| RRHH | 2026-04-03 | ✅ Blindado |
| Documentos | 2026-04-03 | ✅ Blindado |
| Reportes | 2026-04-03 | ✅ Blindado |
| Simulacros | 2026-04-03 | ✅ Blindado |
| Project360 | 2026-04-03 | ✅ Blindado |
| Panel General | 2026-04-03 | ✅ Blindado |
| Clientes | 2026-04-03 | ✅ Blindado |
| Encuestas | 2026-04-03 | ✅ Blindado |
| Capacitaciones | 2026-04-03 | ✅ Blindado |
| Indicadores | 2026-04-03 | ✅ Blindado |
| Riesgos | 2026-04-03 | ✅ Blindado |
| NCR | 2026-04-03 | ✅ Blindado |
| Auditorías | 2026-04-03 | ✅ Blindado |
| Normativos | 2026-04-03 | ✅ Blindado |
| Configuración | 2026-04-03 | ✅ Blindado |
| Inteligencia | 2026-04-03 | ✅ Blindado |

---

**Fin del documento**
