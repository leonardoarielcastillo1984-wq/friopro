-- =====================================================================
-- Migración: Gestión por períodos/ciclos de evaluación de Partes Interesadas
-- Idempotente y segura (no borra ni modifica datos existentes).
-- Crea: evaluation_cycles, stakeholder_evaluations
-- Backfill: 1 ciclo "SGI 2026" por tenant con stakeholders + 1 evaluación
--           inicial por stakeholder copiando su evaluación actual.
-- =====================================================================

-- 1) Tabla de ciclos/períodos ----------------------------------------
CREATE TABLE IF NOT EXISTS evaluation_cycles (
  "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"  uuid NOT NULL,
  "name"      text NOT NULL,
  "year"      integer NOT NULL,
  "status"    text NOT NULL DEFAULT 'ACTIVE',
  "startDate" timestamptz,
  "endDate"   timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "evaluation_cycles_tenantId_year_key"
  ON evaluation_cycles ("tenantId", "year");
CREATE INDEX IF NOT EXISTS "evaluation_cycles_tenantId_idx"
  ON evaluation_cycles ("tenantId");

-- 2) Tabla de evaluaciones por período -------------------------------
CREATE TABLE IF NOT EXISTS stakeholder_evaluations (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"            uuid NOT NULL,
  "stakeholderId"       uuid NOT NULL,
  "cycleId"             uuid NOT NULL,
  "complianceStatus"    text,
  "complianceLevel"     integer,
  "evaluationDate"      timestamptz,
  "complianceEvidence"  text,
  "indicatorNote"       text,
  "indicatorId"         uuid,
  "requiresAction"      boolean NOT NULL DEFAULT false,
  "actionItemId"        uuid,
  "influence"           integer,
  "interest"            integer,
  "observations"        text,
  "needs"               text,
  "expectations"        text,
  "requirements"        text,
  "reviewFrequency"     text,
  "nextEvaluationDate"  timestamptz,
  "followUpResponsible" text,
  "createdAt"           timestamptz NOT NULL DEFAULT now(),
  "updatedAt"           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "stakeholder_evaluations_stakeholderId_fkey"
    FOREIGN KEY ("stakeholderId") REFERENCES stakeholders ("id") ON DELETE CASCADE,
  CONSTRAINT "stakeholder_evaluations_cycleId_fkey"
    FOREIGN KEY ("cycleId") REFERENCES evaluation_cycles ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "stakeholder_evaluations_stakeholderId_cycleId_key"
  ON stakeholder_evaluations ("stakeholderId", "cycleId");
CREATE INDEX IF NOT EXISTS "stakeholder_evaluations_tenantId_idx"
  ON stakeholder_evaluations ("tenantId");
CREATE INDEX IF NOT EXISTS "stakeholder_evaluations_cycleId_idx"
  ON stakeholder_evaluations ("cycleId");
CREATE INDEX IF NOT EXISTS "stakeholder_evaluations_stakeholderId_idx"
  ON stakeholder_evaluations ("stakeholderId");

-- 3) Backfill: ciclo inicial "SGI 2026" por tenant con stakeholders ---
INSERT INTO evaluation_cycles ("id","tenantId","name","year","status","startDate","endDate","createdAt","updatedAt")
SELECT gen_random_uuid(), t."tenantId", 'SGI 2026', 2026, 'ACTIVE',
       make_timestamptz(2026,1,1,0,0,0), make_timestamptz(2026,12,31,23,59,59), now(), now()
FROM (SELECT DISTINCT "tenantId" FROM stakeholders WHERE "deletedAt" IS NULL) t
ON CONFLICT ("tenantId","year") DO NOTHING;

-- 4) Backfill: evaluación inicial por stakeholder en el ciclo 2026 ----
INSERT INTO stakeholder_evaluations (
  "id","tenantId","stakeholderId","cycleId",
  "complianceStatus","complianceLevel","evaluationDate","complianceEvidence",
  "indicatorId","requiresAction","actionItemId","influence","interest",
  "needs","expectations","requirements","createdAt","updatedAt"
)
SELECT gen_random_uuid(), s."tenantId", s."id", c."id",
  s."compliance_status", s."compliance_level", s."last_evaluation_date", s."compliance_evidence",
  s."indicator_id", COALESCE(s."requires_action", false), s."action_item_id", s."influence", s."interest",
  s."needs", s."expectations", s."requirements", now(), now()
FROM stakeholders s
JOIN evaluation_cycles c ON c."tenantId" = s."tenantId" AND c."year" = 2026
WHERE s."deletedAt" IS NULL
ON CONFLICT ("stakeholderId","cycleId") DO NOTHING;
