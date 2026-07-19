-- ============================================================================
-- Evaluación de Desempeño (Fase 1) — migración ADITIVA e IDEMPOTENTE
-- Crea escalas, plantillas/criterios, ciclos, evaluaciones, evaluadores,
-- respuestas, brechas, planes de desarrollo, devoluciones e historial.
-- Reutiliza Employee/Position/Department/Competency vía scalar FKs (sin FK física).
-- Columnas en camelCase (Prisma sin @map de columnas). No modifica tablas existentes.
-- ============================================================================

-- ---------- performance_scales ----------
CREATE TABLE IF NOT EXISTS "performance_scales" (
  "id"          UUID PRIMARY KEY,
  "tenantId"    UUID NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "isDefault"   BOOLEAN NOT NULL DEFAULT FALSE,
  "active"      BOOLEAN NOT NULL DEFAULT TRUE,
  "config"      JSONB,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdById" UUID,
  "updatedById" UUID,
  "deletedAt"   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "performance_scales_tenantId_idx" ON "performance_scales" ("tenantId");
CREATE INDEX IF NOT EXISTS "performance_scales_tenantId_active_idx" ON "performance_scales" ("tenantId", "active");

-- ---------- performance_scale_levels ----------
CREATE TABLE IF NOT EXISTS "performance_scale_levels" (
  "id"             UUID PRIMARY KEY,
  "tenantId"       UUID NOT NULL,
  "scaleId"        UUID NOT NULL REFERENCES "performance_scales"("id") ON DELETE CASCADE,
  "value"          INTEGER NOT NULL,
  "name"           TEXT NOT NULL,
  "description"    TEXT,
  "interpretation" TEXT,
  "isGap"          BOOLEAN NOT NULL DEFAULT FALSE,
  "order"          INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "performance_scale_levels_scaleId_value_key" ON "performance_scale_levels" ("scaleId", "value");
CREATE INDEX IF NOT EXISTS "performance_scale_levels_tenantId_idx" ON "performance_scale_levels" ("tenantId");

-- ---------- performance_templates ----------
CREATE TABLE IF NOT EXISTS "performance_templates" (
  "id"                      UUID PRIMARY KEY,
  "tenantId"                UUID NOT NULL,
  "name"                    TEXT NOT NULL,
  "description"             TEXT,
  "type"                    TEXT NOT NULL DEFAULT 'CUSTOM',
  "active"                  BOOLEAN NOT NULL DEFAULT TRUE,
  "appliesToPositionIds"    TEXT[] NOT NULL DEFAULT '{}',
  "appliesToDepartmentIds"  TEXT[] NOT NULL DEFAULT '{}',
  "appliesToProcessIds"     TEXT[] NOT NULL DEFAULT '{}',
  "appliesToLevels"         TEXT[] NOT NULL DEFAULT '{}',
  "appliesToContractTypes"  TEXT[] NOT NULL DEFAULT '{}',
  "appliesToPositionFamily" TEXT,
  "scaleId"                 UUID REFERENCES "performance_scales"("id"),
  "config"                  JSONB,
  "createdAt"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdById"             UUID,
  "updatedById"             UUID,
  "deletedAt"               TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "performance_templates_tenantId_idx" ON "performance_templates" ("tenantId");
CREATE INDEX IF NOT EXISTS "performance_templates_tenantId_active_idx" ON "performance_templates" ("tenantId", "active");

-- ---------- performance_criteria ----------
CREATE TABLE IF NOT EXISTS "performance_criteria" (
  "id"                 UUID PRIMARY KEY,
  "tenantId"           UUID NOT NULL,
  "templateId"         UUID NOT NULL REFERENCES "performance_templates"("id") ON DELETE CASCADE,
  "name"               TEXT NOT NULL,
  "description"        TEXT,
  "category"           TEXT,
  "weight"             DOUBLE PRECISION NOT NULL DEFAULT 0,
  "order"              INTEGER NOT NULL DEFAULT 0,
  "requiresComment"    BOOLEAN NOT NULL DEFAULT FALSE,
  "requiresEvidence"   BOOLEAN NOT NULL DEFAULT FALSE,
  "competencyId"       UUID,
  "linkedToObjectives" BOOLEAN NOT NULL DEFAULT FALSE,
  "consumesSgiData"    BOOLEAN NOT NULL DEFAULT FALSE,
  "sgiSource"          TEXT,
  "scaleId"            UUID REFERENCES "performance_scales"("id")
);
CREATE INDEX IF NOT EXISTS "performance_criteria_tenantId_idx" ON "performance_criteria" ("tenantId");
CREATE INDEX IF NOT EXISTS "performance_criteria_templateId_idx" ON "performance_criteria" ("templateId");

-- ---------- performance_cycles ----------
CREATE TABLE IF NOT EXISTS "performance_cycles" (
  "id"                        UUID PRIMARY KEY,
  "tenantId"                  UUID NOT NULL,
  "name"                      TEXT NOT NULL,
  "description"               TEXT,
  "type"                      TEXT NOT NULL DEFAULT 'ANUAL',
  "status"                    TEXT NOT NULL DEFAULT 'BORRADOR',
  "startDate"                 DATE,
  "endDate"                   DATE,
  "periodLabel"               TEXT,
  "ownerUserId"               UUID,
  "ownerEmployeeId"           UUID,
  "scopeDepartmentIds"        TEXT[] NOT NULL DEFAULT '{}',
  "scopeProcessIds"           TEXT[] NOT NULL DEFAULT '{}',
  "scopePositionIds"          TEXT[] NOT NULL DEFAULT '{}',
  "scopeEmployeeIds"          TEXT[] NOT NULL DEFAULT '{}',
  "templateId"                UUID REFERENCES "performance_templates"("id"),
  "scaleId"                   UUID REFERENCES "performance_scales"("id"),
  "requiresSelfEvaluation"    BOOLEAN NOT NULL DEFAULT TRUE,
  "requiresManagerEvaluation" BOOLEAN NOT NULL DEFAULT TRUE,
  "requiresHrReview"          BOOLEAN NOT NULL DEFAULT TRUE,
  "requiresFeedbackInterview" BOOLEAN NOT NULL DEFAULT FALSE,
  "allow90"                   BOOLEAN NOT NULL DEFAULT TRUE,
  "allow180"                  BOOLEAN NOT NULL DEFAULT FALSE,
  "allow360"                  BOOLEAN NOT NULL DEFAULT FALSE,
  "reminderConfig"            JSONB,
  "dueRules"                  JSONB,
  "createdAt"                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdById"               UUID,
  "updatedById"               UUID,
  "deletedAt"                 TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "performance_cycles_tenantId_idx" ON "performance_cycles" ("tenantId");
CREATE INDEX IF NOT EXISTS "performance_cycles_tenantId_status_idx" ON "performance_cycles" ("tenantId", "status");

-- ---------- performance_evaluations ----------
CREATE TABLE IF NOT EXISTS "performance_evaluations" (
  "id"                  UUID PRIMARY KEY,
  "tenantId"            UUID NOT NULL,
  "cycleId"             UUID NOT NULL REFERENCES "performance_cycles"("id") ON DELETE CASCADE,
  "employeeId"          UUID NOT NULL,
  "templateId"          UUID REFERENCES "performance_templates"("id"),
  "scaleId"             UUID REFERENCES "performance_scales"("id"),
  "positionId"          UUID,
  "departmentId"        UUID,
  "evaluatorUserId"     UUID,
  "evaluatorEmployeeId" UUID,
  "status"              TEXT NOT NULL DEFAULT 'BORRADOR',
  "selfScore"           DOUBLE PRECISION,
  "managerScore"        DOUBLE PRECISION,
  "finalScore"          DOUBLE PRECISION,
  "classification"      TEXT,
  "progressPct"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "dueDate"             TIMESTAMPTZ,
  "aiAnalysis"          JSONB,
  "config"              JSONB,
  "reopenReason"        TEXT,
  "reopenedById"        UUID,
  "reopenedAt"          TIMESTAMPTZ,
  "closedById"          UUID,
  "closedAt"            TIMESTAMPTZ,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdById"         UUID,
  "updatedById"         UUID,
  "deletedAt"           TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS "performance_evaluations_cycleId_employeeId_key" ON "performance_evaluations" ("cycleId", "employeeId");
CREATE INDEX IF NOT EXISTS "performance_evaluations_tenantId_idx" ON "performance_evaluations" ("tenantId");
CREATE INDEX IF NOT EXISTS "performance_evaluations_tenantId_employeeId_idx" ON "performance_evaluations" ("tenantId", "employeeId");
CREATE INDEX IF NOT EXISTS "performance_evaluations_tenantId_status_idx" ON "performance_evaluations" ("tenantId", "status");

-- ---------- performance_evaluators ----------
CREATE TABLE IF NOT EXISTS "performance_evaluators" (
  "id"                  UUID PRIMARY KEY,
  "tenantId"            UUID NOT NULL,
  "evaluationId"        UUID NOT NULL REFERENCES "performance_evaluations"("id") ON DELETE CASCADE,
  "evaluatorUserId"     UUID,
  "evaluatorEmployeeId" UUID,
  "role"                TEXT NOT NULL DEFAULT 'MANAGER',
  "weight"              DOUBLE PRECISION NOT NULL DEFAULT 100,
  "confidential"        BOOLEAN NOT NULL DEFAULT FALSE,
  "status"              TEXT NOT NULL DEFAULT 'PENDING',
  "submittedAt"         TIMESTAMPTZ,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "performance_evaluators_tenantId_idx" ON "performance_evaluators" ("tenantId");
CREATE INDEX IF NOT EXISTS "performance_evaluators_evaluationId_idx" ON "performance_evaluators" ("evaluationId");

-- ---------- performance_responses ----------
CREATE TABLE IF NOT EXISTS "performance_responses" (
  "id"           UUID PRIMARY KEY,
  "tenantId"     UUID NOT NULL,
  "evaluationId" UUID NOT NULL REFERENCES "performance_evaluations"("id") ON DELETE CASCADE,
  "criterionId"  UUID NOT NULL REFERENCES "performance_criteria"("id") ON DELETE CASCADE,
  "evaluatorId"  UUID REFERENCES "performance_evaluators"("id") ON DELETE CASCADE,
  "role"         TEXT NOT NULL DEFAULT 'MANAGER',
  "score"        DOUBLE PRECISION,
  "comment"      TEXT,
  "evidence"     TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "performance_responses_tenantId_idx" ON "performance_responses" ("tenantId");
CREATE INDEX IF NOT EXISTS "performance_responses_evaluationId_idx" ON "performance_responses" ("evaluationId");
CREATE INDEX IF NOT EXISTS "performance_responses_criterionId_idx" ON "performance_responses" ("criterionId");

-- ---------- performance_gaps ----------
CREATE TABLE IF NOT EXISTS "performance_gaps" (
  "id"                        UUID PRIMARY KEY,
  "tenantId"                  UUID NOT NULL,
  "evaluationId"              UUID NOT NULL REFERENCES "performance_evaluations"("id") ON DELETE CASCADE,
  "criterionId"               UUID,
  "competencyId"              UUID,
  "source"                    TEXT NOT NULL DEFAULT 'CRITERION',
  "label"                     TEXT,
  "expectedLevel"             DOUBLE PRECISION,
  "obtainedLevel"             DOUBLE PRECISION,
  "gapValue"                  DOUBLE PRECISION,
  "severity"                  TEXT,
  "description"               TEXT,
  "status"                    TEXT NOT NULL DEFAULT 'OPEN',
  "linkedTrainingNeedId"      UUID,
  "linkedDevelopmentActionId" UUID,
  "createdAt"                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "performance_gaps_tenantId_idx" ON "performance_gaps" ("tenantId");
CREATE INDEX IF NOT EXISTS "performance_gaps_evaluationId_idx" ON "performance_gaps" ("evaluationId");

-- ---------- performance_development_plans ----------
CREATE TABLE IF NOT EXISTS "performance_development_plans" (
  "id"           UUID PRIMARY KEY,
  "tenantId"     UUID NOT NULL,
  "evaluationId" UUID NOT NULL UNIQUE REFERENCES "performance_evaluations"("id") ON DELETE CASCADE,
  "employeeId"   UUID NOT NULL,
  "title"        TEXT,
  "summary"      TEXT,
  "status"       TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdById"  UUID
);
CREATE INDEX IF NOT EXISTS "performance_development_plans_tenantId_idx" ON "performance_development_plans" ("tenantId");
CREATE INDEX IF NOT EXISTS "performance_development_plans_tenantId_employeeId_idx" ON "performance_development_plans" ("tenantId", "employeeId");

-- ---------- performance_development_actions ----------
CREATE TABLE IF NOT EXISTS "performance_development_actions" (
  "id"                    UUID PRIMARY KEY,
  "tenantId"              UUID NOT NULL,
  "planId"                UUID NOT NULL REFERENCES "performance_development_plans"("id") ON DELETE CASCADE,
  "type"                  TEXT NOT NULL,
  "description"           TEXT,
  "competencyId"          UUID,
  "criterionId"           UUID,
  "responsibleUserId"     UUID,
  "responsibleEmployeeId" UUID,
  "targetDate"            TIMESTAMPTZ,
  "priority"              TEXT NOT NULL DEFAULT 'MEDIA',
  "status"                TEXT NOT NULL DEFAULT 'PENDIENTE',
  "evidence"              TEXT,
  "closedAt"              TIMESTAMPTZ,
  "linkedEntityType"      TEXT,
  "linkedEntityId"        UUID,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "performance_development_actions_tenantId_idx" ON "performance_development_actions" ("tenantId");
CREATE INDEX IF NOT EXISTS "performance_development_actions_planId_idx" ON "performance_development_actions" ("planId");

-- ---------- performance_feedbacks ----------
CREATE TABLE IF NOT EXISTS "performance_feedbacks" (
  "id"                    UUID PRIMARY KEY,
  "tenantId"              UUID NOT NULL,
  "evaluationId"          UUID NOT NULL REFERENCES "performance_evaluations"("id") ON DELETE CASCADE,
  "date"                  TIMESTAMPTZ,
  "responsibleUserId"     UUID,
  "participants"          TEXT[] NOT NULL DEFAULT '{}',
  "summary"               TEXT,
  "employeeComments"      TEXT,
  "agreements"            TEXT,
  "commitments"           TEXT,
  "nextFollowUp"          TIMESTAMPTZ,
  "notified"              BOOLEAN NOT NULL DEFAULT FALSE,
  "acknowledgedAt"        TIMESTAMPTZ,
  "acknowledgementStatus" TEXT,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "performance_feedbacks_tenantId_idx" ON "performance_feedbacks" ("tenantId");
CREATE INDEX IF NOT EXISTS "performance_feedbacks_evaluationId_idx" ON "performance_feedbacks" ("evaluationId");

-- ---------- performance_history ----------
CREATE TABLE IF NOT EXISTS "performance_history" (
  "id"           UUID PRIMARY KEY,
  "tenantId"     UUID NOT NULL,
  "evaluationId" UUID NOT NULL REFERENCES "performance_evaluations"("id") ON DELETE CASCADE,
  "fromStatus"   TEXT,
  "toStatus"     TEXT,
  "action"       TEXT NOT NULL,
  "userId"       UUID,
  "userName"     TEXT,
  "comment"      TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "performance_history_tenantId_idx" ON "performance_history" ("tenantId");
CREATE INDEX IF NOT EXISTS "performance_history_evaluationId_idx" ON "performance_history" ("evaluationId");
