-- ============================================================================
-- Ausencias y Disponibilidad (Fase 3) — migración ADITIVA e IDEMPOTENTE
-- Reglas de cobertura/criticidad + matriz de delegación temporal.
-- No modifica tablas existentes. Columnas camelCase.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "absence_coverage_rules" (
  "id"                 UUID PRIMARY KEY,
  "tenantId"           UUID NOT NULL,
  "scopeType"          TEXT NOT NULL,
  "scopeId"            UUID,
  "scopeKey"           TEXT,
  "scopeName"          TEXT,
  "minCoveragePercent" DOUBLE PRECISION NOT NULL DEFAULT 60,
  "critical"           BOOLEAN NOT NULL DEFAULT FALSE,
  "onBreach"           TEXT NOT NULL DEFAULT 'WARN',
  "active"             BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdById"        UUID
);
CREATE INDEX IF NOT EXISTS "absence_coverage_rules_tenantId_idx" ON "absence_coverage_rules" ("tenantId");
CREATE INDEX IF NOT EXISTS "absence_coverage_rules_tenantId_scopeType_idx" ON "absence_coverage_rules" ("tenantId", "scopeType");

CREATE TABLE IF NOT EXISTS "absence_delegations" (
  "id"                         UUID PRIMARY KEY,
  "tenantId"                   UUID NOT NULL,
  "functionName"               TEXT NOT NULL,
  "usualResponsibleEmployeeId" UUID,
  "substituteEmployeeId"       UUID,
  "delegationKind"             TEXT NOT NULL DEFAULT 'FUNCTIONAL',
  "scope"                      TEXT,
  "startDate"                  DATE NOT NULL,
  "endDate"                    DATE NOT NULL,
  "status"                     TEXT NOT NULL DEFAULT 'SCHEDULED',
  "approvedById"               UUID,
  "approvedByName"             TEXT,
  "observations"               TEXT,
  "requestId"                  UUID,
  "createdAt"                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdById"                UUID
);
CREATE INDEX IF NOT EXISTS "absence_delegations_tenantId_idx" ON "absence_delegations" ("tenantId");
CREATE INDEX IF NOT EXISTS "absence_delegations_tenantId_status_idx" ON "absence_delegations" ("tenantId", "status");
