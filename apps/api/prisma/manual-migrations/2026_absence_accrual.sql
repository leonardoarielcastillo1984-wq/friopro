-- ============================================================================
-- Ausencias y Disponibilidad (Fase 4) — migración ADITIVA e IDEMPOTENTE
-- Motor de devengamiento configurable. No modifica tablas existentes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "absence_accrual_rules" (
  "id"               UUID PRIMARY KEY,
  "tenantId"         UUID NOT NULL,
  "name"             TEXT NOT NULL,
  "absenceTypeId"    UUID NOT NULL,
  "method"           TEXT NOT NULL DEFAULT 'ANNUAL',
  "contractType"     TEXT,
  "location"         TEXT,
  "minTenureMonths"  INTEGER,
  "maxTenureMonths"  INTEGER,
  "daysGranted"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "carryoverMaxDays" INTEGER,
  "expiryMonths"     INTEGER,
  "requiresReview"   BOOLEAN NOT NULL DEFAULT FALSE,
  "active"           BOOLEAN NOT NULL DEFAULT TRUE,
  "priority"         INTEGER NOT NULL DEFAULT 0,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdById"      UUID
);
CREATE INDEX IF NOT EXISTS "absence_accrual_rules_tenantId_idx" ON "absence_accrual_rules" ("tenantId");
CREATE INDEX IF NOT EXISTS "absence_accrual_rules_tenantId_absenceTypeId_idx" ON "absence_accrual_rules" ("tenantId", "absenceTypeId");
