# 🧪 SGI 360 — End-to-End Test Scenarios

## Scenario 1: Complete User Journey (30 min)

### Context
Eres gerente de calidad en una empresa manufacturera. Quieres:
1. Subir tu manual de procedimientos
2. Subir la norma ISO 9001:2015
3. Hacer auditoría automática
4. Ver hallazgos y crear plan de acción

### Steps

#### 1.1: Login & Setup ✅
```
1. Ve a http://localhost:3000/login
2. Email: admin@tenant1.local
3. Password: Test123456
→ Esperas dashboard
```

**Verificar:**
- ✓ Navbar muestra tu nombre
- ✓ Logo del tenant visible
- ✓ Menu de navegación presente

#### 1.2: Subir Documento ✅
```
1. Click "Documentos" en navbar
2. "Nuevo Documento"
   - Título: "Manual de Procedimientos QA"
   - Tipo: "Procedimiento"
   - Contenido: (pega texto o sube PDF)
   - Status: "EFFECTIVE"
3. Submit
```

**Verificar:**
- ✓ Documento aparece en lista
- ✓ Status = EFFECTIVE
- ✓ Se puede hacer click para ver detalle

#### 1.3: Subir Norma ✅
```
1. Click "Normativos" en navbar
2. "Cargar Norma"
   - Norma: "ISO 9001:2015"
   - Código: "ISO9001-2015"
   - Archivo: (sube PDF de ISO 9001)
3. Submit
```

**Verificar:**
- ✓ Archivo sube sin error
- ✓ Status empieza en PROCESSING
- ✓ (Espera 5-10s) Status cambia a READY
- ✓ Se muestran cláusulas en árbol
- ✓ Haz click en cláusula → ver contenido

#### 1.4: Análisis IA ✅
```
1. Click "Auditoría IA" en navbar
2. Click "Análisis de Cumplimiento"
   - Documento: "Manual de Procedimientos QA"
   - Norma: "ISO 9001:2015"
3. "Iniciar Análisis"
```

**Verificar:**
- ✓ Status badge: "Analizando..."
- ✓ Progress bar animado
- ✓ La página actualiza cada 3s
- ✓ Después de 1-3 min: status = "COMPLETADO"

#### 1.5: Revisar Hallazgos ✅
```
1. Página muestra tabla de hallazgos:
   - Columnas: Severidad | Cláusula | Título | Descripción
   - Fila por cada gap encontrado
2. Click en severity badge (rojo/amarillo)
3. Revisa evidencia & acciones sugeridas
4. Para cada hallazgo, cambiar status:
   - OPEN → IN_PROGRESS
   - IN_PROGRESS → RESOLVED
   - RESOLVED → CLOSED
```

**Verificar:**
- ✓ Hallazgos muestran severidad (MUST=rojo, SHOULD=amarillo)
- ✓ Cada hallazgo tiene descripción & evidencia
- ✓ Confianza mostrada como progress bar (0-100%)
- ✓ Cambio de status se guarda inmediatamente

#### 1.6: Dashboard Audit ✅
```
1. Click "Auditoría IA" → dashboard
2. Deberías ver:
   - KPI card: "Hallazgos Abiertos" (número)
   - KPI card: "Críticos (MUST)" (número)
   - KPI card: "Importantes (SHOULD)" (número)
   - Lista de últimas auditorías
```

**Verificar:**
- ✓ Números son consistentes con hallazgos
- ✓ Última auditoría aparece en lista
- ✓ Status badge correcto

---

## Scenario 2: AI Chat Auditor (15 min)

### Context
Quieres hacer preguntas sobre cumplimiento sin hacer auditoría formal.

### Steps

#### 2.1: Chat General ✅
```
1. Click "Auditoría IA" → "Chat Auditor"
2. Pregunta sin contexto:
   "¿Cuáles son los requisitos principales de ISO 9001?"
3. Envía (Enter o click Send)
```

**Verificar:**
- ✓ Mensaje tuyo aparece (derecha, azul)
- ✓ Loading indicator (puntos animados)
- ✓ Respuesta de IA aparece (izquierda, blanco)
- ✓ Respuesta es relevante & coherente

#### 2.2: Chat con Contexto ✅
```
1. Click botón "Contexto" (arriba a la derecha)
2. Panel abre mostrando:
   - Lista de documentos con checkboxes
   - Lista de normas con checkboxes
3. Checkea:
   - Documento: "Manual de Procedimientos QA"
   - Norma: "ISO 9001:2015"
4. Click fuera del panel para cerrar
```

**Verificar:**
- ✓ Badge muestra "Contexto 2" (2 items seleccionados)
- ✓ Cada item tiene checkbox + nombre

#### 2.3: Chat Contextualizado ✅
```
1. Con contexto seleccionado, pregunta:
   "¿Qué falta en nuestro manual para ISO 9001?"
2. Envía
```

**Verificar:**
- ✓ Respuesta menciona documento + norma
- ✓ Recomendaciones son específicas al contexto
- ✓ Puedo hacer follow-up preguntas

#### 2.4: Nueva Conversación ✅
```
1. Click "Nueva" (botón con RotateCcw icon)
2. Chat limpia, vuelve a estado inicial
```

**Verificar:**
- ✓ Historial desaparece
- ✓ Puedo empezar nueva conversación

---

## Scenario 3: Full Tenant Audit (60 min)

### Context
Quieres auditar TODO el tenant a la vez (todos los docs vs todas las normas).

### Steps

#### 3.1: Prerequisitos ✅
```
Asegúrate de tener:
- 2+ documentos (status EFFECTIVE)
- 2+ normas (status READY)
```

#### 3.2: Iniciar Auditoría Completa ✅
```
1. Click "Auditoría IA" → "Análisis de Cumplimiento"
2. NO selecciones documento ni norma
3. Click "Auditoría Completa del Tenant"
4. Confirma en dialog
```

**Verificar:**
- ✓ Confirmación aparece: "¿Iniciar auditoría completa?"
- ✓ Sistema procesa y actualiza status

#### 3.3: Progress Tracking ✅
```
1. Página muestra:
   - Status: "Analizando..." (amarillo)
   - Progress bar animado
   - Mensaje: "La IA está analizando..."
2. Espera (puede tardar 10-30 min dependiendo de # docs/normas)
```

**Verificar:**
- ✓ No hay timeout
- ✓ Logs en servidor muestran progreso
- ✓ Status actualiza cada 3-5s

#### 3.4: Resultados Consolidados ✅
```
1. Status cambia a "COMPLETADO"
2. Tabla muestra estadísticas:
   - Total Cláusulas: (suma de todas)
   - Cubiertas: (# implementadas)
   - Faltantes: (# gaps)
   - Hallazgos: (# issues)
```

**Verificar:**
- ✓ Números son mayores que auditoría simple
- ✓ Hallazgos consolidados de todos los pares
- ✓ Se puede filtrar por doc/norma en BD

#### 3.5: Hallazgos Agrupados ✅
```
1. Dashboard → "Auditoría IA"
2. Filtra:
   GET /audit/findings?status=OPEN&severity=MUST
```

**Verificar:**
- ✓ Hallazgos filtrados correctamente
- ✓ Ordenados por severidad & fecha
- ✓ Mostrar documento + norma de cada hallazgo

---

## Scenario 4: Integration with NCR Management (20 min)

### Context
Wants to convert AI findings into formal NCRs for tracking.

### Steps

#### 4.1: View Findings ✅
```
1. Go to Audit Dashboard
2. Review critical findings (severity = MUST)
3. Identify 2-3 key gaps to convert to NCR
```

#### 4.2: Create NCR from Finding ✅
```
1. Click "No Conformidades" in navbar
2. "Nueva NCR"
   - Title: (copy from AI finding)
   - Description: (copy evidencia)
   - Severity: CRITICAL (if MUST)
   - Standard: ISO 9001:2015
   - Clause: 4.1 (from finding)
3. Submit
```

**Verificar:**
- ✓ NCR creada exitosamente
- ✓ Puedo ver en lista de NCRs
- ✓ Puedo hacer click para ver detalle
- ✓ Puedo cambiar status (OPEN → IN_ANALYSIS, etc.)

#### 4.3: Track Progress ✅
```
1. Click en NCR creada
2. Llena:
   - Root Cause: (análisis de causa raíz)
   - Corrective Action: (qué hacer)
3. Change Status → IN_PROGRESS
4. Save
```

**Verificar:**
- ✓ Cambios se guardan
- ✓ Status badge actualiza
- ✓ Progress indicator en página
- ✓ Otros usuarios ven cambio en real-time (si refresh)

---

## Scenario 5: Webhooks Notification (15 min)

### Context
Cuando se completa una auditoría, enviar notificación a Slack.

### Steps

#### 5.1: Setup Webhook ✅
```
1. Click "Integraciones" en navbar
2. "Conectar Webhook"
   - Provider: Slack
   - Name: "Audit Notifications"
   - URL: (tu Slack webhook URL)
   - Events: AUDIT_COMPLETED
3. Test Webhook → debería recibir mensaje en Slack
```

**Verificar:**
- ✓ Test button envía notificación
- ✓ Mensaje aparece en Slack
- ✓ Formato es legible con colores

#### 5.2: Trigger Real Webhook ✅
```
1. Go to Audit Analyze
2. Start analysis
3. Wait for completion
```

**Verificar:**
- ✓ Cuando audit completes, Slack recibe notificación
- ✓ Mensaje contiene: doc name, norma, # findings
- ✓ Link directo a auditoría en Slack

---

## Scenario 6: Error Handling (10 min)

### Context
Verificar que el sistema maneja errores gracefully.

### Steps

#### 6.1: Missing LLM Key ✅
```
1. Quita ANTHROPIC_API_KEY de .env
2. Intenta iniciar análisis
3. Debería recibir error: "LLM no configurada"
```

**Verificar:**
- ✓ Error message es útil
- ✓ No hay crash del sistema

#### 6.2: Document Too Large ✅
```
1. Sube documento muy grande (>50MB)
2. Intenta análisis
3. Debería timeout o warning
```

**Verificar:**
- ✓ Sistema no crashea
- ✓ Error es manejado

#### 6.3: No Normative Clauses ✅
```
1. Crea norma sin cláusulas (imposible, pero intenta)
2. Intenta análisis
```

**Verificar:**
- ✓ Sistema maneja gracefully
- ✓ 0 findings, no error

---

## Scenario 7: Multi-Tenant Isolation (15 min)

### Context
Verificar que Tenant A no puede ver datos de Tenant B.

### Steps

#### 7.1: Create Audit Run in Tenant A ✅
```
1. Logged in as admin@tenant1.local
2. Create audit run & findings
3. Note: AuditRun.id = "abc123"
```

#### 7.2: Try to Access from Tenant B ✅
```
1. Logout
2. Login as admin@tenant2.local
3. Intenta acceder a /audit/runs/abc123
4. Debería recibir: "Audit run not found" (403)
```

**Verificar:**
- ✓ No puedo ver audit runs de otro tenant
- ✓ No puedo ver findings de otro tenant
- ✓ RLS policy previene acceso

#### 7.3: Database Verification ✅
```
-- Como superadmin en BD:
SELECT * FROM "AuditRun" WHERE "tenantId" != current_setting('app.tenant_id');
```

**Verificar:**
- ✓ Query retorna 0 rows (RLS enforced)

---

## Scenario 8: Performance & Load (30 min - OPTIONAL)

### Context
Verificar que sistema escala con muchos datos.

### Steps

#### 8.1: Seed Large Dataset ✅
```
npm run seed:large  # Simular: 50 docs, 10 normas, 500 clauses
```

#### 8.2: Run Full Audit ✅
```
1. Start tenant-full-audit
2. Monitorear:
   - Worker logs
   - Memory usage
   - CPU usage
   - Database connections
```

**Verificar:**
- ✓ No OOM (out of memory)
- ✓ Completa en <5 min
- ✓ Worker processes sequentially (concurrency=2)
- ✓ Findings guardadas correctamente

#### 8.3: Query Performance ✅
```
SELECT COUNT(*) FROM "AiFinding" WHERE "tenantId" = ?;  -- <100ms
SELECT * FROM "AiFinding" WHERE status = 'OPEN' LIMIT 20;  -- <50ms
```

**Verificar:**
- ✓ Queries rápidas
- ✓ Indexes utilizados
- ✓ No full table scans

---

## 📋 Checklist Final

### API Endpoints ✅
- [ ] POST /audit/analyze — 202 response + jobId
- [ ] POST /audit/tenant-audit — 202 response + jobId
- [ ] GET /audit/runs — lista de auditorías
- [ ] GET /audit/runs/:runId — detalle con status
- [ ] GET /audit/runs/:runId/findings — findings por auditoría
- [ ] GET /audit/findings — todos los findings con filtros
- [ ] PATCH /audit/findings/:id — update status
- [ ] POST /audit/chat — respuesta contextualizada

### Frontend Pages ✅
- [ ] /audit — Dashboard con KPIs
- [ ] /audit/analyze — Análisis doc vs norma
- [ ] /audit/chat — Chat interactivo

### Database ✅
- [ ] AuditRun table creada con índices
- [ ] AiFinding table creada con índices
- [ ] RLS policies aplicadas
- [ ] Migrations ejecutadas exitosamente

### Security ✅
- [ ] Feature gate `ia_auditora` funciona
- [ ] Tenant isolation verificada
- [ ] JWT auth requerido en todas las rutas
- [ ] CSRF protection activa

### LLM Integration ✅
- [ ] Anthropic provider funciona
- [ ] OpenAI provider funciona (si configurado)
- [ ] Ollama provider funciona (si local)
- [ ] Batch processing >25 clauses
- [ ] JSON parsing robusto

---

## 🎯 Test Coverage Summary

| Category | Coverage | Notes |
|----------|----------|-------|
| Happy Path | 100% | Todos los flujos principales |
| Error Cases | 80% | Falta error boundary edge cases |
| Security | 90% | Multi-tenant verificado |
| Performance | 50% | Necesita stress testing |
| Integration | 85% | Webhook + multi-module flows |

---

**Total Test Time:** ~180 minutes (3 horas)
**Recommended Testing Window:** 1 full day (incluir delays & troubleshooting)

¡Buen testing! 🧪
