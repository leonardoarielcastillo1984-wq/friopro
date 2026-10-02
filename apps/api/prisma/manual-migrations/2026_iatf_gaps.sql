-- Migración manual: cierre de gaps IATF 16949 (Oct 2026).
-- Idempotente — aplicar en cada BD antes del deploy (sgi-postgres / sgi-postgres-testing).
--
-- "NonConformity": disposición del producto NC (8.7.1.1 concesión, 8.7.1.4-5 reproceso/reparación)
-- "SupplierEvaluation": monitoreo suplementario 8.4.2.4 (PPM, disrupciones, flete premium, special status)
-- "ContingencyPlan": prueba de eficacia 6.1.2.3 + notificación al cliente
-- "gestion_cambio": flag de revisión de core tools 8.5.6.1
-- Nuevas tablas:
--   · customer_claims (10.2.5 reclamos / warranty / field failure + análisis)
--   · customer_scorecards (9.1.2.1 scorecard mensual por cliente)
--   · customer_specific_requirements (4.3.2 CSR: revisión + difusión)
--   · supplier_development_plans (8.4.2.5 desarrollo de proveedores)
--   · poka_yoke_devices + poka_yoke_verifications (10.2.4 error-proofing)

BEGIN;

ALTER TABLE "NonConformity" ADD COLUMN IF NOT EXISTS "disposition" TEXT;
ALTER TABLE "NonConformity" ADD COLUMN IF NOT EXISTS "dispositionNotes" TEXT;
ALTER TABLE "NonConformity" ADD COLUMN IF NOT EXISTS "concessionRef" TEXT;
ALTER TABLE "NonConformity" ADD COLUMN IF NOT EXISTS "concessionApprovedBy" TEXT;
ALTER TABLE "NonConformity" ADD COLUMN IF NOT EXISTS "concessionApprovedAt" TIMESTAMPTZ(3);
ALTER TABLE "NonConformity" ADD COLUMN IF NOT EXISTS "concessionExpiry" TIMESTAMPTZ(3);
ALTER TABLE "NonConformity" ADD COLUMN IF NOT EXISTS "reworkInstruction" TEXT;
ALTER TABLE "NonConformity" ADD COLUMN IF NOT EXISTS "reworkVerifiedAt" TIMESTAMPTZ(3);
ALTER TABLE "NonConformity" ADD COLUMN IF NOT EXISTS "customerNotifiedAt" TIMESTAMPTZ(3);

ALTER TABLE "supplier_evaluations" ADD COLUMN IF NOT EXISTS "deliveredPpm" DOUBLE PRECISION;
ALTER TABLE "supplier_evaluations" ADD COLUMN IF NOT EXISTS "customerDisruptions" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "supplier_evaluations" ADD COLUMN IF NOT EXISTS "premiumFreightIncidents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "supplier_evaluations" ADD COLUMN IF NOT EXISTS "specialStatusNotifications" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "supplier_evaluations" ADD COLUMN IF NOT EXISTS "specialStatusNotes" TEXT;

ALTER TABLE "contingency_plans" ADD COLUMN IF NOT EXISTS "lastTestedAt" TIMESTAMPTZ(3);
ALTER TABLE "contingency_plans" ADD COLUMN IF NOT EXISTS "testResult" TEXT;
ALTER TABLE "contingency_plans" ADD COLUMN IF NOT EXISTS "testNotes" TEXT;
ALTER TABLE "contingency_plans" ADD COLUMN IF NOT EXISTS "customerNotificationRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "contingency_plans" ADD COLUMN IF NOT EXISTS "customerNotificationContact" TEXT;

ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "requiresCoreToolsReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "gestion_cambio" ADD COLUMN IF NOT EXISTS "coreToolsReviewNotes" TEXT;

CREATE TABLE IF NOT EXISTS customer_claims (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"            UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  code                  TEXT NOT NULL,
  type                  TEXT NOT NULL DEFAULT 'COMPLAINT',
  status                TEXT NOT NULL DEFAULT 'OPEN',
  "productName"         TEXT,
  "partNumber"          TEXT,
  quantity              INTEGER,
  description           TEXT NOT NULL,
  "detectedAt"          TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "returnedPartsAnalysis" TEXT,
  "rootCause"           TEXT,
  "analysisMethod"      TEXT,
  "costAmount"          DOUBLE PRECISION,
  "customerId"          UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  "ncrId"               UUID REFERENCES "NonConformity"(id) ON DELETE SET NULL,
  "eightDCode"          TEXT,
  "closedAt"            TIMESTAMPTZ(3),
  "createdAt"           TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "createdById"         UUID,
  "deletedAt"           TIMESTAMPTZ(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_claims_tenant_code_key ON customer_claims("tenantId", code);
CREATE INDEX IF NOT EXISTS customer_claims_tenant_idx ON customer_claims("tenantId");
CREATE INDEX IF NOT EXISTS customer_claims_customer_idx ON customer_claims("customerId");
CREATE INDEX IF NOT EXISTS customer_claims_status_idx ON customer_claims(status);

CREATE TABLE IF NOT EXISTS customer_scorecards (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"                UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "customerId"              UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  period                    TEXT NOT NULL,
  "deliveredPpm"            DOUBLE PRECISION,
  "customerDisruptions"     INTEGER NOT NULL DEFAULT 0,
  "fieldFailures"           INTEGER NOT NULL DEFAULT 0,
  returns                   INTEGER NOT NULL DEFAULT 0,
  "premiumFreightIncidents" INTEGER NOT NULL DEFAULT 0,
  "specialStatusNotifications" INTEGER NOT NULL DEFAULT 0,
  "deliveryPerformance"     DOUBLE PRECISION,
  "qualityScore"            DOUBLE PRECISION,
  "overallScore"            DOUBLE PRECISION,
  notes                     TEXT,
  "createdAt"               TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt"               TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "createdById"             UUID
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_scorecards_customer_period_key ON customer_scorecards("customerId", period);
CREATE INDEX IF NOT EXISTS customer_scorecards_tenant_idx ON customer_scorecards("tenantId");
CREATE INDEX IF NOT EXISTS customer_scorecards_customer_idx ON customer_scorecards("customerId");

CREATE TABLE IF NOT EXISTS customer_specific_requirements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"          UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "customerId"        UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  source              TEXT,
  status              TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "documentId"        UUID,
  "responsibleId"     UUID,
  "reviewedAt"        TIMESTAMPTZ(3),
  "disseminatedAt"    TIMESTAMPTZ(3),
  "disseminationNotes" TEXT,
  "createdAt"         TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "createdById"       UUID,
  "deletedAt"         TIMESTAMPTZ(3)
);
CREATE INDEX IF NOT EXISTS csr_tenant_idx ON customer_specific_requirements("tenantId");
CREATE INDEX IF NOT EXISTS csr_customer_idx ON customer_specific_requirements("customerId");
CREATE INDEX IF NOT EXISTS csr_status_idx ON customer_specific_requirements(status);

CREATE TABLE IF NOT EXISTS supplier_development_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"  UUID NOT NULL,
  "supplierId" UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  objective   TEXT,
  actions     JSONB,
  status      TEXT NOT NULL DEFAULT 'ACTIVE',
  "targetDate"  TIMESTAMPTZ(3),
  "completedAt" TIMESTAMPTZ(3),
  evidence    TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "createdById" UUID,
  "deletedAt" TIMESTAMPTZ(3)
);
CREATE INDEX IF NOT EXISTS supplier_dev_plans_tenant_idx ON supplier_development_plans("tenantId");
CREATE INDEX IF NOT EXISTS supplier_dev_plans_supplier_idx ON supplier_development_plans("supplierId");

CREATE TABLE IF NOT EXISTS poka_yoke_devices (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"                UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  code                      TEXT NOT NULL,
  name                      TEXT NOT NULL,
  type                      TEXT NOT NULL DEFAULT 'CONTROL',
  location                  TEXT,
  process                   TEXT,
  "defectPrevented"         TEXT,
  "verificationFrequencyDays" INTEGER NOT NULL DEFAULT 30,
  "lastVerifiedAt"          TIMESTAMPTZ(3),
  "nextVerificationAt"      TIMESTAMPTZ(3),
  "verificationMethod"      TEXT,
  "lastVerificationResult"  TEXT,
  status                    TEXT NOT NULL DEFAULT 'ACTIVE',
  "isActive"                BOOLEAN NOT NULL DEFAULT true,
  "createdAt"               TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updatedAt"               TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "createdById"             UUID,
  "deletedAt"               TIMESTAMPTZ(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS poka_yoke_devices_tenant_code_key ON poka_yoke_devices("tenantId", code);
CREATE INDEX IF NOT EXISTS poka_yoke_devices_tenant_idx ON poka_yoke_devices("tenantId");

CREATE TABLE IF NOT EXISTS poka_yoke_verifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "deviceId"  UUID NOT NULL REFERENCES poka_yoke_devices(id) ON DELETE CASCADE,
  "tenantId"  UUID NOT NULL,
  "verifiedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  result      TEXT NOT NULL,
  "verifiedBy" TEXT,
  notes       TEXT
);
CREATE INDEX IF NOT EXISTS poka_yoke_verifications_device_idx ON poka_yoke_verifications("deviceId");
CREATE INDEX IF NOT EXISTS poka_yoke_verifications_tenant_idx ON poka_yoke_verifications("tenantId");

COMMIT;
