# Estado de implementación — Auditor IA

Estado al cierre de la primera implementación completa (E1–E9).

## Checklist por etapa

| Etapa | Alcance | Estado |
|-------|---------|--------|
| E1 | Schema `Auditor*` + extensión `AiFinding`, authz fail-closed, feature `auditor_ia`, rutas base | ✅ |
| E2 | Ingesta normativa por páginas (pdf-parse), diagnóstico de legibilidad, requisitos fallback, rutas de extracción | ✅ |
| E3 | Conectores de evidencia (objectives, risks, documents, indicators, ncr, internal_audits, management_review, context, suppliers, competence), seed ISO 9001, extracción de adjuntos de documentos | ✅ |
| E4 | `AuditorLLM` (logging provider), schemas Zod, orquestador, cola BullMQ `auditor-ia`, límites de tokens, rutas de revisiones/evaluaciones | ✅ |
| E5 | Pantalla `/auditor-ia` (P1 lista+modal, P2 extracción, P3 historial, P4 preparación), sub-nav, sidebar, permisos empleados | ✅ |
| E6 | Decisión humana, N/A proponer/aprobar, evidencia manual (buscar/vincular/quitar), reevaluación por job, staleness, hallazgos→NC/plan | ✅ |
| E7 | Preparación de auditoría + informe JSON/HTML/PDF (puppeteer vía `pdf-render.ts`) | ✅ |
| E8 | Consulta conversacional acotada a la revisión con citas R1..Rn | ✅ |
| E9 | Pruebas `node --test` (14/14) de funciones puras, checklist, este documento | ✅ |

## Decisiones de seguridad aplicadas

- **Authz fail-closed** en cada handler (`requireAuditorAccess`); el plugin global de permisos es fail-open y además se mapeó `/auditor-ia` y `/api/auditor-ia` al módulo en `ROUTE_MODULE_MAP`.
- **`userPerms` fail-closed**: el worker y la búsqueda de conectores devuelven `'admin'` SOLO a `SUPER_ADMIN` o `TENANT_ADMIN` verificado vía `TenantMembership`. Usuario no resoluble → `{}` (sin fuentes → evaluación conservadora).
- **Tenant scoping** en toda consulta; `tenantId` del contexto, nunca del body.
- **La IA no ejecuta acciones**: hallazgos nacen `DRAFT`, requieren validación humana para pasar a `VALIDATED` y luego a `LINKED` (NC/plan). Las propuestas del agente son solo texto.
- **Snapshot de fuentes** (`sourceSnapshot`) en cada evaluación + detector de cambios (`staleness.ts`) que marca `STALE` sin tocar el dictamen.
- **Anti-inyección**: `stripUrls` elimina URLs del texto del modelo; `invalidRefs` valida citas contra el conjunto entregado (reintento, luego `CANNOT_EVALUATE`).
- **Worker**: concurrencia 1, cola propia `auditor-ia`, cierre integrado en `main.ts` (`shutdownAuditorIaQueue`).

## Notas técnicas relevantes

- `AiFinding.evaluationId` / `requirementId` son **escalares** (sin relación Prisma) → filtrar por `evaluationId IN (...)` resolviendo ids primero.
- `AuditorReview` se relaciona con `extraction`, no con `normative` directamente.
- `AuditorEvaluation` tiene 4 ejes independientes: `workStatus`, `evidenceStatus`, `aiVerdict`, `humanDecision` (+ historial en `AuditorDecisionLog`).
- `Prisma.TransactionClient` no soporta `$transaction` anidado → las escrituras de staleness son secuenciales.
- El PDF del informe reutiliza `services/pdf-render.ts` (puppeteer ya instalado).
- La búsqueda de requisitos por página es conservadora: nunca se muestra como "aprobado por IA" lo que es fallback.

## Pendiente / riesgos conocidos

- **`prisma db push` a la DB local**: NO aplicado — la DB local tiene drift amplio de otros módulos (finanza, marketing, supply, legal_library, EmployeeSalary, referrals…) y un push habría creado todo. Para aplicar solo auditor-ia usar `apps/api/prisma/manual-migrations/2026_auditor_ia.sql` (`psql -f`), generado vía `prisma migrate diff`. El cliente Prisma está regenerado y `tsc -p tsconfig.json` compila limpio.
- **Migración manual**: lista en `apps/api/prisma/manual-migrations/2026_auditor_ia.sql` (8 tablas `auditor_*` + columnas nuevas de `AiFinding` + índices + FKs).
- **E2E con LLM real**: las pruebas cubren funciones puras; el flujo completo (extracción→revisión→dictamen→informe) requiere DB + provider configurado.
- **`policies`/`processes` como conectores**: no implementados en v1 (solo filtro de alcance), según spec §6.
- **Concurrencia entre revisiones** del mismo tenant: no hay lock explícito; BullMQ serializa por job pero dos revisiones pueden correr en paralelo si se encolan dos.
