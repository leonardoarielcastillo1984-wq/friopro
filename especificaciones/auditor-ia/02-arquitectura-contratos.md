# 02 — Arquitectura y contratos

## 1. Inventario observado (no es propuesta)

Las rutas son relativas a `apps/`. Se marca *(a verificar)* lo que no se inspeccionó en detalle.

| Área | Observado |
|---|---|
| Stack | Monorepo pnpm. `api`: Fastify, Prisma 5 (Postgres), Zod, BullMQ/Redis. `web`: Next.js App Router `src/app/(app)/*`, Tailwind, lucide |
| Tenancy | `plugins/dbContext.ts` → `runWithDbContext` hace `set_config('app.tenant_id'…)` por transacción. **No se encontraron** políticas RLS en `prisma/migrations` (grep `ENABLE ROW LEVEL SECURITY` = 0), así que el aislamiento depende de `where: { tenantId }` explícito. `utils/tenant-bypass.ts#getEffectiveTenantId` |
| Roles | `TenantRole` = `TENANT_ADMIN`, `TENANT_USER`. `globalRole` `SUPER_ADMIN`. Permisos por módulo en `User.permissions` (JSON `view`/`edit`) |
| Permisos backend | `plugins/user-permissions.ts`: `ROUTE_MODULE_MAP` con prefijos `/api/...`. En prod Nginx quita `/api` (comentario en `api/src/app.ts` L408). Es posible que no matchee en prod *(a verificar)*. Además es *fail-open* ante errores |
| Planes | `plugins/features.ts#requireFeature(req, key)` |
| Normativos | `NormativeStandard` (`version`, `filePath`, `fileHash` SHA-256, `status`), `NormativeClause` (`clauseNumber`, `content` con el texto completo, `pageNumber`, `keywords`), `DocumentClauseMapping`. Rutas `routes/normativos.ts`: `/upload`, `/:id/revision` (crea una nueva norma y archiva la anterior), `/from-template` (normas **sin PDF**, `filePath=''`) |
| Ingesta PDF | `jobs/processNormativeJob.ts` llama a `services/pdfParser.ts` (`pdf-parse` ^1.1.1). El texto se extrae sin páginas y `pageNumber` **siempre `null`**. Si el PDF es escaneado, lanza un error. **No hay OCR** |
| Documentos | `Document` (`content`, `htmlContent`, `filePath`, `version` Int, `status`, `process`, `departmentId`, `normativeIds`), `DocumentVersion`, `services/docxParser.ts` (mammoth) |
| Evidencias por cláusula | `routes/compliance-evidences.ts`: usa `tx.clauseEvidence`, pero **el modelo `ClauseEvidence` no está en `api/prisma/schema.prisma`** *(a verificar)*. `% ponderado por presencia` 40/30/20/10. `/clauses/:id/ai-analyze` no persiste nada y, si falla el parseo, inventa `CUMPLIMIENTO_PARCIAL` |
| IA auditora previa | `routes/audit.ts` (`/audit/analyze`, `/tenant-audit`, `/findings`, `/findings/:id/convert-to-ncr`, `/chat`), `AuditRun`, `AiFinding`, `jobs/auditJobs.ts`, `services/auditAnalysis.ts`. Web `/audit`. Deduplicación vía `NonConformity.aiFindingId` |
| Readiness | `routes/audit-readiness.ts` `/summary`: issues por módulo (objetivos, NC, riesgos, docs, capacitaciones, hallazgos, auditorías, revisión por la dirección, indicadores, contexto, proveedores, procesos, simulacros, infraestructura) |
| LLM | `services/llm/factory.ts` (`createLLMProvider`, `createLoggingLLMProvider`). Proveedores groq, openai y ollama. Claves por tenant cifradas (`tenantCrypto.ts`). `types.ts#LLMProvider.chat(messages, maxTokens, jsonMode)`. Los roles son solo `user`/`assistant` (sin `system`). `LoggingLLMProvider` escribe en `AIUsageLog` (tokens, sin costo). `auditJobs.ts` usa el proveedor global e ignora el del tenant |
| Jobs | `jobs/queue.ts`: colas normativa y auditoría, `attempts`, `backoff`, `lockDuration` 15 min, `recoverStuckNormatives` |
| Storage | `services/storage.ts` (local o S3, `buildStorageKey(tenantId, normativeId, file)`). `api/src/app.ts` sirve `/uploads/` con `@fastify/static` **sin autenticación** *(riesgo, a verificar con Nginx)* |
| Auditoría de cambios | Modelo `AuditEvent`, `services/audit.ts`, `services/auditLogger.ts` *(no inspeccionados)*. El hook `onResponse` solo registra `/audit360` |
| Notificaciones | `Notification`, `routes/notifications.ts` |
| Export | `routes/document-export.ts` (`/doc-export`), `services/document-export.ts`, `web/components/ExportButton.tsx` |
| Sedes | **No existe una entidad Sede** en el núcleo SGI. Hay `Process.sites String[]`, `SgiObjective.sites String[]` y `ActionPlan.site String?` |
| Pruebas | `node --test` (`api/src/__tests__`, `api/test`, `api/tests`) |
| Despliegue | docker compose (`docker-compose.yml`), workflow `.windsurf/workflows/deploy-safe.md` |

**Entidades por módulo** (todas con `tenantId`): `SgiObjective` (+`ObjectiveProgressLog`, `ObjectiveIndicator`), `Employee`/`Position`/`Competency`/`EmployeeCompetency`, `SgiTraining` y `Training` (dos modelos), `Supplier`/`SupplierEvaluation`, `OrganizationContext`/`Stakeholder`, `Risk`/`RiskTreatmentAction`, `Indicator`/`IndicatorMeasurement`, `NonConformity`, `ActionPlan`, `AuditProgram`/`Audit`/`AuditFinding`/`AuditChecklistItem`, `ManagementReview`, `Policy`, `ProcessMap`/`Process`, `EnvironmentalAspect`, `Customer`.

## 2. Vista de componentes (propuesta)

```
web /auditor-ia ──HTTP──► api routes/auditor-ia.ts ──► services/auditor-ia/*
                                   │                      ├─ extraction.ts   (PDF→páginas→requisitos)
                                   │                      ├─ connectors/*.ts (EvidenceConnector)
                                   │                      ├─ orchestrator.ts (revisión→evaluaciones)
                                   │                      ├─ llm-adapter.ts  (AuditorLLM → llm/factory)
                                   │                      ├─ schemas.ts      (Zod I/O del modelo)
                                   │                      └─ staleness.ts
                                   └─ jobs/auditorIaJobs.ts (cola "auditor-ia")
Proveedor de IA (externo/ollama) ◄── solo desde el worker/servidor, nunca desde web
```

El módulo funciona en `api`. El modelo corre en el proveedor configurado. Solo `llm-adapter.ts` conoce al proveedor.

## 3. Datos (migración aditiva única)

| Modelo | Campos esenciales | Relaciones e índices |
|---|---|---|
| `AuditorExtraction` | `id, tenantId, normativeId, fileHash, status, pageCount, diagnostics Json (textPages, emptyPages, encrypted), model, approvedById?, approvedAt?, createdAt` | `@@unique([normativeId, fileHash, revision])`, FK `NormativeStandard` |
| `AuditorSourcePage` | `extractionId, page Int, text Text, textHash` | Se borra en cascada con la extracción. Es la fuente de citas |
| `AuditorRequirement` | `id, tenantId, extractionId, clauseId (NormativeClause), code ("6.2-a"), statement (paráfrasis ≤300), verificationTypes String[] (DOCUMENT/RECORD/OBSERVATION/INTERVIEW), connectorKeys String[], page Int?, requiresDocumentedInfo Bool, status (PROPOSED/APPROVED/DISCARDED), order` | `@@index([extractionId])` |
| `AuditorReview` | `id, tenantId, extractionId, normativeId, scope Text, processIds String[], sites String[], periodFrom, periodTo, requirementIds String[]?, status, progress Int, totals Json, jobId, cancelRequested Bool, estTokens, usedTokens, model, config Json, createdById, startedAt, finishedAt, error` | `@@index([tenantId, status])` |
| `AuditorEvaluation` | `id, tenantId, reviewId, requirementId, attempt Int, workStatus, evidenceStatus, aiVerdict, humanDecision, explanation Text, limitations Json, gaps Json, proposals Json, questions Json, sourcesConsulted Json, sourcesUnavailable Json, sourceSnapshot Json [{type,id,version,updatedAt,hash}], model, promptVersion, tokens, decidedById?, decidedAt?, decisionComment?, naJustification?, naApprovedById?` | `@@unique([reviewId, requirementId, attempt])` |
| `AuditorEvidenceLink` | `id, tenantId, evaluationId, connectorKey, entityType, entityId, version?, entityUpdatedAt, title, url, origin (AUTO/SUGGESTED/MANUAL), aiAssessment (SUPPORTS/NOT_SUPPORTS/INCONCLUSIVE)?, inPeriod Bool, addedById?` | `@@index([entityType, entityId])` (para la invalidación) |
| `AuditorDocExtract` | `tenantId, documentId, documentVersion Int, fileHash, text Text, pages Int` | Caché de texto de adjuntos. Se borra con el documento |
| `AuditorDecisionLog` | `evaluationId, actorId, from, to, comment, createdAt` | Historial inmutable |
| `AiFinding` (existente) | **Campos aditivos:** `evaluationId?`, `requirementId?`, `validationStatus` (`DRAFT/VALIDATED/REJECTED/LINKED`), `actionPlanId?` | Se reusa `auditType='auditor_ia'` y `NonConformity.aiFindingId` |

## 4. API (`/auditor-ia`, registro con doble prefijo como `finanzas`)

En todos los endpoints rigen estas reglas:
- `requireFeature('auditor_ia')`.
- Permiso `auditor-ia` verificado **en el handler** (no depender de `ROUTE_MODULE_MAP`).
- `tenantId` vía `getEffectiveTenantId` y `where tenantId` en toda consulta.
- Zod en la entrada.

| Método y ruta | Entrada | Salida | Permiso | Errores |
|---|---|---|---|---|
| `GET /normas` | — | Normas con `extractionStatus`, `hasPdf` | view | — |
| `POST /normas/:normativeId/extracciones` | — | `{extractionId}` (202) | edit | 409 si ya existe una con el mismo hash. 422 si no tiene PDF |
| `GET /extracciones/:id` | — | Extracción, diagnóstico y requisitos | view | 404 |
| `PATCH /requisitos/:id` | `statement, verificationTypes, connectorKeys, status, page` | Requisito | edit | 409 si la extracción ya está `APPROVED` |
| `POST /extracciones/:id/aprobar` | — | Extracción | edit | 422 si quedan requisitos `PROPOSED` |
| `POST /revisiones/estimar` | Configuración de la revisión | `{requirements, estTokens, estCost?}` | edit | — |
| `POST /revisiones` | `{extractionId, scope, processIds, sites, periodFrom, periodTo, requirementIds?}` | `{reviewId}` (202) | edit | 422 límite de consumo. 409 si ya hay una idéntica en curso |
| `GET /revisiones` / `GET /revisiones/:id` | Filtros | Revisión, totales y matriz | view | 404 |
| `POST /revisiones/:id/cancelar` · `/reintentar` | — | Revisión | edit | 409 si el estado no lo permite |
| `GET /evaluaciones/:id` | — | Evaluación, evidencias, historial y staleness | view | 404 |
| `POST /evaluaciones/:id/decision` | `{decision, comment, naJustification?}` | Evaluación | edit (`NA_APPROVED` requiere admin y otro usuario) | 403, 422 |
| `POST /evaluaciones/:id/evidencias` · `DELETE …/:linkId` | `{connectorKey, entityId}` | Vínculo | edit | 404 si la entidad no es del tenant |
| `GET /conectores/:key/buscar?q=` | — | Hasta 20 candidatos | view más el permiso del módulo fuente | 403 |
| `POST /evaluaciones/:id/reevaluar` | — | Nuevo `attempt` (202) | edit | 409 si está en curso |
| `POST /evaluaciones/:id/hallazgos` | `{title, description, severity}` | Hallazgo `DRAFT` | edit | 409 si ya existe un borrador activo |
| `PATCH /hallazgos/:id` | `{validationStatus, comment}` | Hallazgo | edit | — |
| `POST /hallazgos/:id/vincular` | `{target: 'NC'\|'ACTION_PLAN', mode: 'create'\|'link', targetId?}` | Destino | edit + `calidad:edit` | 409 duplicado (`aiFindingId`). 422 si no está `VALIDATED` |
| `GET /revisiones/:id/preparacion` | — | Checklist, preguntas, pendientes | view | — |
| `GET /revisiones/:id/informe?format=pdf\|docx` | — | Archivo vía `services/document-export.ts` | view | — |
| `POST /revisiones/:id/consultar` | `{message}` (≤1000) | `{answer, citations[], outOfScope:boolean}` | view | 429 por límite |

## 5. Extracción y recuperación de fuentes

1. **Páginas:** usar la opción `pagerender` de `pdf-parse` para obtener el texto por página. No requiere dependencia nueva *(validar con un spike)*. Cada página se guarda en `AuditorSourcePage`.
2. **Diagnóstico:** el PDF es `UNREADABLE` si está cifrado, si `textPages/pageCount < 0.5` o si tiene menos de 200 caracteres en total. Ver D1 para OCR.
3. **Huella:** `NormativeStandard.fileHash`. Si ya existe una extracción con ese hash, se reutiliza y no se reprocesa.
4. **Requisitos:** se toman las cláusulas de `NormativeClause` (ya parseadas) y se resuelve la página buscando `clauseNumber + título` en las páginas. Luego la IA propone requisitos por cláusula, de a lotes, con el esquema `ExtractionOutput`.
5. **Recuperación para evaluar:** sin vectores. Cada requisito usa sus `connectorKeys`, más hasta K=5 fragmentos de documentos elegidos por `DocumentClauseMapping` y por coincidencia en Postgres (`ILIKE`/`to_tsvector('spanish')`) sobre `Document.content` y `AuditorDocExtract.text`. Cada fragmento tiene 1.500 caracteres como máximo.

Se justifica no usar vectores porque la evidencia principal es estructurada (registros) y los documentos de un tenant son del orden de cientos. Se puede revisar si en las métricas de v1 la cobertura de documentos resulta baja.

## 6. Conectores de evidencia

**Interfaz (`EvidenceConnector`):**
- `key`, `label`, `permissionModule` (clave de `User.permissions`).
- `collect(ctx, requirement): Promise<{items: EvidenceItem[], coverage: {queried, available, reason?}}>`.
- `search(ctx, q)` y `snapshot(entityId)`.

`ctx` incluye `{tenantId, userPerms, processIds, sites, periodFrom, periodTo, tx}`.

`EvidenceItem` = `{entityType, entityId, title, version?, updatedAt, url, inPeriod, summary (≤800 caracteres, campos seleccionados), hash}`. Cada conector devuelve 15 ítems como máximo.

| `key` | Entidades reales | Campos resumidos | URL |
|---|---|---|---|
| `documents` | `Document`, `DocumentVersion`, `DocumentClauseMapping` | Título, código, versión, estado, aprobación, fragmentos | `/documents/:id` |
| `objectives` | `SgiObjective`, `ObjectiveProgressLog`, `ObjectiveIndicator` | Meta, responsable, plazos, progreso, seguimiento | `/objetivos` |
| `competence` | `Position`, `Competency`, `EmployeeCompetency`, `SgiTraining`, `Training`, `TrainingEffectiveness` | Requisitos de puesto, brechas, eficacia | `/rrhh`, `/capacitaciones` |
| `suppliers` | `Supplier`, `SupplierEvaluation` | Criterios, evaluaciones, vencimientos | `/proveedores` |
| `context` | `OrganizationContext`, `Stakeholder` | Año, cuestiones, partes interesadas | `/contexto-sgi` |
| `risks` | `Risk`, `RiskTreatmentAction` | Nivel, tratamiento, revisión | `/riesgos` |
| `indicators` | `Indicator`, `IndicatorMeasurement` | Meta, mediciones en período | `/indicadores` |
| `ncr` | `NonConformity`, `ActionPlan` | Causa, acciones, eficacia, estado | `/no-conformidades`, `/planes-accion` *(rutas a verificar)* |
| `internal_audits` | `AuditProgram`, `Audit`, `AuditFinding`, `AuditChecklistItem` | Programa, ejecución, hallazgos | `/auditorias` |
| `management_review` | `ManagementReview` | Fecha, entradas y salidas | `/revision-direccion` |
| `processes` | `ProcessMap`, `Process` | Dueño, entradas/salidas, sedes | `/contexto-sgi?tab=mapa` |
| `policies` | `Policy` | Vigencia, aprobación | `/politicas` *(a verificar)* |

Para v1 se implementan todos los de la tabla salvo `policies` y `processes`, que se usan solo como filtro de alcance.

La asignación de conectores a un requisito es una sugerencia de la IA en la extracción, más una tabla semilla por cláusula ISO 9001 (`connectors/seed-iso9001.ts`). La persona la edita en P2.

## 7. Orquestación

Para cada requisito de una revisión (secuencial, con concurrencia 1 por revisión):
1. Si `cancelRequested`, se detiene.
2. `collect` de los conectores con permiso. Los demás quedan como `SOURCE_UNAVAILABLE`.
3. Se calcula `evidenceStatus` de forma determinista (presencia en período).
4. Si `verificationTypes ⊆ {OBSERVATION, INTERVIEW}`, el dictamen es `REQUIRES_EXTERNAL_VERIFICATION` sin llamar al modelo.
5. Si `ABSENT`, el dictamen es `INSUFFICIENT_EVIDENCE` sin llamar al modelo.
6. En los demás casos se llama a `AuditorLLM.evaluate`, se valida y se persiste junto con `sourceSnapshot`.
7. Se actualizan `progress` y `usedTokens`.

Persistir por requisito permite que un reintento retome los pendientes.

## 8. Adaptador de IA

- `AuditorLLM` = `{extract(clause, pagesText), evaluate(requirement, evidence[]), answer(question, reviewContext)}`. Internamente usa `createLoggingLLMProvider(tenant, prisma, tenantId, userId, 'auditor-ia')`, que respeta la clave del tenant a diferencia de `auditJobs.ts`.
- Cambio aditivo en `services/llm/types.ts`: se agrega el rol `system` y se mapea en `openai.ts` y `ollama.ts`. Las instrucciones van en `system` y los datos van en `user`, delimitados con `<<<DATOS id=…>>> … <<<FIN>>>` y con la indicación explícita de que son datos no confiables.
- Se usa `jsonMode=true`, `temperature` baja (si el proveedor lo permite), `promptVersion` constante y modelo por `AUDITOR_IA_MODEL`.

## 9. Esquemas del modelo (Zod en `schemas.ts`)

**`ExtractionOutput`** = `{requirements: [{clauseNumber, statement ≤300, verificationTypes[], connectorKeys[] ⊆ catálogo, requiresDocumentedInfo, pageHint?}] ≤ 15}`.

**`EvaluationOutput`** contiene:
- `verdict` ∈ {`EVIDENCE_SUPPORTS`, `POSSIBLE_GAP`, `REQUIRES_EXTERNAL_VERIFICATION`, `INSUFFICIENT_EVIDENCE`}.
- `evidence: [{ref, assessment: SUPPORTS|NOT_SUPPORTS|INCONCLUSIVE, aspect, note ≤300}]`.
- `gaps: [{description, relatedRefs[]}]`, `limitations[]`, `externalChecks[]`, `proposals: [{action, target}] ≤5`, `auditQuestions[] ≤5`, `explanation ≤1200`.

**`AnswerOutput`** = `{answer ≤1500, citations: [{ref}], outOfScope}`.

**Validación posterior:**
- Todo `ref` debe pertenecer al conjunto entregado; si no, se descarta la respuesta y se hace un reintento.
- Si el segundo intento también falla, el resultado es `CANNOT_EVALUATE` con `limitations=['salida inválida del modelo']`.
- Se eliminan las URLs y el código de los textos generados.
- No existe un camino que produzca un dictamen por defecto.

## 10. Actualización e invalidación

- `sourceSnapshot` guarda `{type, id, version|updatedAt, hash}` de cada evidencia, además de `extractionId`.
- Al abrir una revisión o una evaluación, `staleness.ts` compara los `updatedAt` con consultas agrupadas por tipo. Si hay diferencias, `workStatus=STALE` y se registra en `AuditorDecisionLog`.
- Una nueva extracción de la norma no invalida revisiones viejas: siguen ligadas a su `extractionId`.
- Revisiones programadas: **fuera de v1**. El diseño solo requiere un job repetible de BullMQ que cree `AuditorReview` con la configuración guardada.

## 11. Seguridad

| Tema | Medida |
|---|---|
| Autorización | Chequeo en el handler (permiso `auditor-ia` y del módulo fuente) además del plugin. Pruebas de acceso cruzado entre tenants por endpoint |
| Aislamiento | `tenantId` en cada consulta de conectores, incluida la búsqueda de entidades en vinculación manual |
| Archivos | Leer PDFs solo con `getStorage().download` del lado servidor. Prerrequisito: confirmar o cerrar el acceso público a `/uploads/` (D4) |
| Prompt injection | §8. Además, la salida solo puede referenciar refs entregados. No se siguen enlaces ni se ejecuta nada |
| Secretos | Solo en el servidor (`factory.ts`/`tenantCrypto.ts`). Web nunca llama al proveedor |
| Datos al proveedor | Resúmenes de 800 caracteres como máximo por ítem y fragmentos de 1.500. No se envían datos personales innecesarios: el conector `competence` envía agregados y códigos, no nombres |
| Retención | `AuditorSourcePage` y `AuditorDocExtract` se borran en cascada con la norma o el documento. Purga configurable `AUDITOR_IA_RETENTION_DAYS` para extractos de documentos |
| Registro | `AuditEvent` en las acciones de crear, cancelar, decidir, aprobar N/A, vincular, exportar y consultar (solo metadatos) |
| Límites | Rate limit por ruta `consultar` y tope de tokens por revisión y por mes por tenant |
