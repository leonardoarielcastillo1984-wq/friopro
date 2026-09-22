-- Core Tools IATF 16949 — MSA, SPC, FMEA, Control Plan, APQP, PPAP, 8D, LPA
-- 100% aditiva e idempotente. Aplicar con:
--   docker exec -i sgi-postgres[-testing] psql -U sgi -d sgi < 2026_core_tools.sql

CREATE TABLE IF NOT EXISTS msa_studies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"        UUID NOT NULL,
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  "studyType"       TEXT NOT NULL DEFAULT 'GRR_CROSS',
  "equipmentId"     UUID,
  "equipmentName"   TEXT,
  characteristic    TEXT,
  "partsCount"      INTEGER NOT NULL DEFAULT 10,
  "operatorsCount"  INTEGER NOT NULL DEFAULT 3,
  "trialsCount"     INTEGER NOT NULL DEFAULT 3,
  tolerance         DOUBLE PRECISION,
  "referenceValues" JSONB,
  readings          JSONB,
  results           JSONB,
  status            TEXT NOT NULL DEFAULT 'DRAFT',
  conclusion        TEXT,
  "aiInterpretation" TEXT,
  "createdById"     UUID,
  "deletedAt"       TIMESTAMP,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS msa_studies_tenant_idx ON msa_studies ("tenantId");

CREATE TABLE IF NOT EXISTS spc_charts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"       UUID NOT NULL,
  code             TEXT NOT NULL,
  name             TEXT NOT NULL,
  process          TEXT,
  characteristic   TEXT NOT NULL,
  unit             TEXT,
  "chartType"      TEXT NOT NULL DEFAULT 'XBAR_R',
  "subgroupSize"   INTEGER NOT NULL DEFAULT 5,
  usl              DOUBLE PRECISION,
  lsl              DOUBLE PRECISION,
  target           DOUBLE PRECISION,
  subgroups        JSONB,
  limits           JSONB,
  capability       JSONB,
  alarms           JSONB,
  status           TEXT NOT NULL DEFAULT 'ACTIVE',
  "aiInterpretation" TEXT,
  "deletedAt"      TIMESTAMP,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS spc_charts_tenant_idx ON spc_charts ("tenantId");

CREATE TABLE IF NOT EXISTS fmea_studies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  code       TEXT NOT NULL,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'PFMEA',
  process    TEXT,
  product    TEXT,
  team       TEXT,
  status     TEXT NOT NULL DEFAULT 'DRAFT',
  items      JSONB,
  "deletedAt" TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fmea_studies_tenant_idx ON fmea_studies ("tenantId");

CREATE TABLE IF NOT EXISTS control_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"  UUID NOT NULL,
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  phase       TEXT NOT NULL DEFAULT 'PRODUCTION',
  "partNumber" TEXT,
  process     TEXT,
  "fmeaId"    UUID,
  items       JSONB,
  status      TEXT NOT NULL DEFAULT 'DRAFT',
  "deletedAt" TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS control_plans_tenant_idx ON control_plans ("tenantId");

CREATE TABLE IF NOT EXISTS apqp_projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"    UUID NOT NULL,
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  customer      TEXT,
  "partNumber"  TEXT,
  "currentPhase" INTEGER NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'ACTIVE',
  phases        JSONB,
  "startDate"   TIMESTAMP,
  "dueDate"     TIMESTAMP,
  "deletedAt"   TIMESTAMP,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS apqp_projects_tenant_idx ON apqp_projects ("tenantId");

CREATE TABLE IF NOT EXISTS ppap_submissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"   UUID NOT NULL,
  code         TEXT NOT NULL,
  "partNumber" TEXT NOT NULL,
  "partName"   TEXT,
  customer     TEXT,
  level        INTEGER NOT NULL DEFAULT 3,
  "apqpId"     UUID,
  elements     JSONB,
  status       TEXT NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP,
  "approvedAt" TIMESTAMP,
  "deletedAt"  TIMESTAMP,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ppap_submissions_tenant_idx ON ppap_submissions ("tenantId");

CREATE TABLE IF NOT EXISTS eight_d_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"   UUID NOT NULL,
  code         TEXT NOT NULL,
  title        TEXT NOT NULL,
  "ncrId"      UUID,
  status       TEXT NOT NULL DEFAULT 'OPEN',
  disciplines  JSONB,
  "aiAnalysis" TEXT,
  "openedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "closedAt"   TIMESTAMP,
  "deletedAt"  TIMESTAMP,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eight_d_reports_tenant_idx ON eight_d_reports ("tenantId");

CREATE TABLE IF NOT EXISTS lpa_plans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  name       TEXT NOT NULL,
  area       TEXT,
  layer      TEXT,
  frequency  TEXT NOT NULL DEFAULT 'WEEKLY',
  checklist  JSONB,
  active     BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lpa_plans_tenant_idx ON lpa_plans ("tenantId");

CREATE TABLE IF NOT EXISTS lpa_executions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"   UUID NOT NULL,
  "planId"     UUID NOT NULL REFERENCES lpa_plans(id) ON DELETE CASCADE,
  "auditorName" TEXT,
  "executedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  responses    JSONB,
  score        DOUBLE PRECISION,
  findings     JSONB,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lpa_executions_tenant_idx ON lpa_executions ("tenantId");
CREATE INDEX IF NOT EXISTS lpa_executions_plan_idx ON lpa_executions ("planId");

-- IA + vínculos reales entre módulos (Control Plan/APQP/PPAP/LPA con notas de IA; 8D con Plan de Acción real)
ALTER TABLE control_plans ADD COLUMN IF NOT EXISTS "aiNotes" TEXT;
ALTER TABLE apqp_projects ADD COLUMN IF NOT EXISTS "aiNotes" TEXT;
ALTER TABLE ppap_submissions ADD COLUMN IF NOT EXISTS "aiNotes" TEXT;
ALTER TABLE lpa_plans ADD COLUMN IF NOT EXISTS "aiNotes" TEXT;
ALTER TABLE eight_d_reports ADD COLUMN IF NOT EXISTS "actionPlanId" UUID;
CREATE SEQUENCE IF NOT EXISTS action_plan_seq;
