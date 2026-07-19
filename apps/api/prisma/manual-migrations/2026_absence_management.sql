-- ============================================================================
-- Ausencias y Disponibilidad (Fase 1) — migración ADITIVA e IDEMPOTENTE
-- Crea catálogo de tipos, políticas, feriados, saldos + movimientos,
-- solicitudes + aprobaciones + adjuntos. No modifica tablas existentes.
-- Columnas en camelCase (Prisma sin @map de columnas).
-- ============================================================================

-- ---------- absence_types ----------
CREATE TABLE IF NOT EXISTS "absence_types" (
  "id"                    UUID PRIMARY KEY,
  "tenantId"              UUID NOT NULL,
  "code"                  TEXT NOT NULL,
  "name"                  TEXT NOT NULL,
  "description"           TEXT,
  "color"                 TEXT DEFAULT '#3B82F6',
  "active"                BOOLEAN NOT NULL DEFAULT TRUE,
  "requiresBalance"       BOOLEAN NOT NULL DEFAULT FALSE,
  "deductsBalance"        BOOLEAN NOT NULL DEFAULT FALSE,
  "requiresDocumentation" BOOLEAN NOT NULL DEFAULT FALSE,
  "requiresApproval"      BOOLEAN NOT NULL DEFAULT TRUE,
  "allowsSelfService"     BOOLEAN NOT NULL DEFAULT TRUE,
  "countingMode"          TEXT NOT NULL DEFAULT 'BUSINESS',
  "allowsHalfDay"         BOOLEAN NOT NULL DEFAULT FALSE,
  "allowsRetroactive"     BOOLEAN NOT NULL DEFAULT FALSE,
  "requiresSubstitute"    BOOLEAN NOT NULL DEFAULT FALSE,
  "requiresCoverage"      BOOLEAN NOT NULL DEFAULT FALSE,
  "sensitiveData"         BOOLEAN NOT NULL DEFAULT FALSE,
  "approvalRule"          TEXT,
  "minAdvanceDays"        INTEGER,
  "maxDurationDays"       INTEGER,
  "config"                JSONB,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdById"           UUID,
  "updatedById"           UUID,
  "deletedAt"             TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS "absence_types_tenantId_code_key" ON "absence_types" ("tenantId", "code");
CREATE INDEX IF NOT EXISTS "absence_types_tenantId_idx" ON "absence_types" ("tenantId");
CREATE INDEX IF NOT EXISTS "absence_types_tenantId_active_idx" ON "absence_types" ("tenantId", "active");

-- ---------- absence_policies ----------
CREATE TABLE IF NOT EXISTS "absence_policies" (
  "id"                       UUID PRIMARY KEY,
  "tenantId"                 UUID NOT NULL,
  "workingWeekdays"          INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  "allowNegativeBalance"     BOOLEAN NOT NULL DEFAULT FALSE,
  "allowExceptions"          BOOLEAN NOT NULL DEFAULT TRUE,
  "defaultMinAdvanceDays"    INTEGER NOT NULL DEFAULT 0,
  "defaultMaxDurationDays"   INTEGER,
  "carryoverEnabled"         BOOLEAN NOT NULL DEFAULT TRUE,
  "carryoverMaxDays"         INTEGER,
  "carryoverExpiryMonths"    INTEGER,
  "pendingRequestSlaHours"   INTEGER NOT NULL DEFAULT 48,
  "sensitiveVisibilityRoles" TEXT[] NOT NULL DEFAULT '{}',
  "config"                   JSONB,
  "createdAt"                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "absence_policies_tenantId_key" ON "absence_policies" ("tenantId");

-- ---------- absence_holidays ----------
CREATE TABLE IF NOT EXISTS "absence_holidays" (
  "id"        UUID PRIMARY KEY,
  "tenantId"  UUID NOT NULL,
  "date"      DATE NOT NULL,
  "name"      TEXT NOT NULL,
  "scope"     TEXT,
  "location"  TEXT,
  "recurring" BOOLEAN NOT NULL DEFAULT FALSE,
  "active"    BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "absence_holidays_tenantId_idx" ON "absence_holidays" ("tenantId");
CREATE INDEX IF NOT EXISTS "absence_holidays_tenantId_date_idx" ON "absence_holidays" ("tenantId", "date");

-- ---------- absence_balances ----------
CREATE TABLE IF NOT EXISTS "absence_balances" (
  "id"                 UUID PRIMARY KEY,
  "tenantId"           UUID NOT NULL,
  "employeeId"         UUID NOT NULL,
  "absenceTypeId"      UUID NOT NULL,
  "period"             TEXT NOT NULL,
  "assignedDays"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "carriedDays"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "accruedDays"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "usedDays"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reservedDays"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pendingDays"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "adjustmentPositive" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "adjustmentNegative" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "expiresAt"          TIMESTAMPTZ,
  "status"             TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes"              TEXT,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdById"        UUID,
  "updatedById"        UUID
);
CREATE UNIQUE INDEX IF NOT EXISTS "absence_balances_tenantId_employeeId_absenceTypeId_period_key"
  ON "absence_balances" ("tenantId", "employeeId", "absenceTypeId", "period");
CREATE INDEX IF NOT EXISTS "absence_balances_tenantId_idx" ON "absence_balances" ("tenantId");
CREATE INDEX IF NOT EXISTS "absence_balances_tenantId_employeeId_idx" ON "absence_balances" ("tenantId", "employeeId");

-- ---------- absence_balance_movements ----------
CREATE TABLE IF NOT EXISTS "absence_balance_movements" (
  "id"            UUID PRIMARY KEY,
  "tenantId"      UUID NOT NULL,
  "balanceId"     UUID NOT NULL,
  "movementType"  TEXT NOT NULL,
  "source"        TEXT NOT NULL,
  "field"         TEXT,
  "previousValue" DOUBLE PRECISION,
  "newValue"      DOUBLE PRECISION,
  "delta"         DOUBLE PRECISION,
  "reason"        TEXT,
  "referenceType" TEXT,
  "referenceId"   UUID,
  "userId"        UUID,
  "userName"      TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "absence_balance_movements_tenantId_idx" ON "absence_balance_movements" ("tenantId");
CREATE INDEX IF NOT EXISTS "absence_balance_movements_balanceId_idx" ON "absence_balance_movements" ("balanceId");

-- ---------- absence_requests ----------
CREATE TABLE IF NOT EXISTS "absence_requests" (
  "id"                   UUID PRIMARY KEY,
  "tenantId"             UUID NOT NULL,
  "code"                 TEXT,
  "employeeId"           UUID NOT NULL,
  "absenceTypeId"        UUID NOT NULL,
  "startDate"            DATE NOT NULL,
  "endDate"              DATE NOT NULL,
  "halfDay"              BOOLEAN NOT NULL DEFAULT FALSE,
  "startTime"            TEXT,
  "endTime"              TEXT,
  "countingMode"         TEXT NOT NULL DEFAULT 'BUSINESS',
  "computedDays"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reason"               TEXT,
  "notes"                TEXT,
  "substituteEmployeeId" UUID,
  "affectedProcessIds"   TEXT[] NOT NULL DEFAULT '{}',
  "affectedFunctions"    TEXT,
  "status"               TEXT NOT NULL DEFAULT 'DRAFT',
  "createdByHr"          BOOLEAN NOT NULL DEFAULT FALSE,
  "origin"               TEXT NOT NULL DEFAULT 'EMPLOYEE',
  "balanceReserved"      BOOLEAN NOT NULL DEFAULT FALSE,
  "balanceUsed"          BOOLEAN NOT NULL DEFAULT FALSE,
  "createdById"          UUID,
  "updatedById"          UUID,
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt"            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "absence_requests_tenantId_idx" ON "absence_requests" ("tenantId");
CREATE INDEX IF NOT EXISTS "absence_requests_tenantId_employeeId_idx" ON "absence_requests" ("tenantId", "employeeId");
CREATE INDEX IF NOT EXISTS "absence_requests_tenantId_status_idx" ON "absence_requests" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "absence_requests_tenantId_startDate_endDate_idx" ON "absence_requests" ("tenantId", "startDate", "endDate");

-- ---------- absence_approvals ----------
CREATE TABLE IF NOT EXISTS "absence_approvals" (
  "id"                 UUID PRIMARY KEY,
  "tenantId"           UUID NOT NULL,
  "requestId"          UUID NOT NULL,
  "stepOrder"          INTEGER NOT NULL DEFAULT 1,
  "approverRole"       TEXT,
  "approverUserId"     UUID,
  "approverEmployeeId" UUID,
  "approverName"       TEXT,
  "decision"           TEXT NOT NULL DEFAULT 'PENDING',
  "comment"            TEXT,
  "previousStatus"     TEXT,
  "newStatus"          TEXT,
  "decidedAt"          TIMESTAMPTZ,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "absence_approvals_tenantId_idx" ON "absence_approvals" ("tenantId");
CREATE INDEX IF NOT EXISTS "absence_approvals_requestId_idx" ON "absence_approvals" ("requestId");

-- ---------- absence_attachments ----------
CREATE TABLE IF NOT EXISTS "absence_attachments" (
  "id"             UUID PRIMARY KEY,
  "tenantId"       UUID NOT NULL,
  "requestId"      UUID NOT NULL,
  "fileName"       TEXT NOT NULL,
  "fileUrl"        TEXT NOT NULL,
  "fileType"       TEXT,
  "category"       TEXT,
  "sensitive"      BOOLEAN NOT NULL DEFAULT FALSE,
  "uploadedById"   UUID,
  "uploadedByName" TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt"      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "absence_attachments_tenantId_idx" ON "absence_attachments" ("tenantId");
CREATE INDEX IF NOT EXISTS "absence_attachments_requestId_idx" ON "absence_attachments" ("requestId");

-- ---------- Foreign keys entre modelos nuevos (guardadas) ----------
DO $$ BEGIN
  ALTER TABLE "absence_balances"
    ADD CONSTRAINT "absence_balances_absenceTypeId_fkey"
    FOREIGN KEY ("absenceTypeId") REFERENCES "absence_types"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "absence_balance_movements"
    ADD CONSTRAINT "absence_balance_movements_balanceId_fkey"
    FOREIGN KEY ("balanceId") REFERENCES "absence_balances"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "absence_requests"
    ADD CONSTRAINT "absence_requests_absenceTypeId_fkey"
    FOREIGN KEY ("absenceTypeId") REFERENCES "absence_types"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "absence_approvals"
    ADD CONSTRAINT "absence_approvals_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "absence_requests"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "absence_attachments"
    ADD CONSTRAINT "absence_attachments_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "absence_requests"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
