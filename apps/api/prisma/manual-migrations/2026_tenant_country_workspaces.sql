-- Multi-país: workspaces de un mismo grupo empresario (Dada Argentina / Dada Chile).
-- Aditiva e idempotente. Aplicar en prod:
--   docker exec -i sgi-postgres psql -U sgi -d sgi < 2026_tenant_country_workspaces.sql
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "parentTenantId" UUID;
CREATE INDEX IF NOT EXISTS "Tenant_parentTenantId_idx" ON "Tenant" ("parentTenantId");
