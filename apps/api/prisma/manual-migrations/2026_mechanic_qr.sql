-- Migración aditiva e idempotente: QR personal del mecánico
-- Al escanearlo, el mecánico ve sus OTs asignadas (hoy/pendientes) y puede iniciarlas/completarlas.

CREATE TABLE IF NOT EXISTS "mechanic_qrs" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"     UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "token"        TEXT NOT NULL UNIQUE,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "technicianId" UUID NOT NULL REFERENCES "maintenance_technicians"("id") ON DELETE CASCADE,
  "useCount"     INTEGER NOT NULL DEFAULT 0,
  "lastUsedAt"   TIMESTAMPTZ,
  "generatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "mechanic_qrs_tenantId_idx" ON "mechanic_qrs" ("tenantId");
CREATE INDEX IF NOT EXISTS "mechanic_qrs_token_idx" ON "mechanic_qrs" ("token");
CREATE INDEX IF NOT EXISTS "mechanic_qrs_technicianId_idx" ON "mechanic_qrs" ("technicianId");
