-- Migración aditiva e idempotente: Registro de Intervenciones por QR
-- Bitácora de mantenimiento por activo/vehículo (cambio de aceite, frenos, etc.)

CREATE TABLE IF NOT EXISTS "maintenance_intervention_types" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"            UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "name"                TEXT NOT NULL,
  "category"            TEXT NOT NULL DEFAULT 'GENERAL',
  "description"         TEXT,
  "defaultKmInterval"   INTEGER,
  "defaultDaysInterval" INTEGER,
  "isBuiltIn"           BOOLEAN NOT NULL DEFAULT false,
  "isActive"            BOOLEAN NOT NULL DEFAULT true,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "maintenance_intervention_types_tenantId_idx"
  ON "maintenance_intervention_types" ("tenantId");

CREATE TABLE IF NOT EXISTS "maintenance_intervention_qrs" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"           UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "token"              TEXT NOT NULL UNIQUE,
  "isActive"           BOOLEAN NOT NULL DEFAULT true,
  "maintenanceAssetId" UUID NOT NULL REFERENCES "maintenance_assets"("id") ON DELETE CASCADE,
  "activoNombre"       TEXT NOT NULL,
  "activoCodigo"       TEXT,
  "titulo"             TEXT,
  "instrucciones"      TEXT,
  "useCount"           INTEGER NOT NULL DEFAULT 0,
  "lastUsedAt"         TIMESTAMPTZ,
  "generatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "maintenance_intervention_qrs_tenantId_idx"
  ON "maintenance_intervention_qrs" ("tenantId");
CREATE INDEX IF NOT EXISTS "maintenance_intervention_qrs_token_idx"
  ON "maintenance_intervention_qrs" ("token");

CREATE TABLE IF NOT EXISTS "maintenance_interventions" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"           UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "qrId"               UUID REFERENCES "maintenance_intervention_qrs"("id") ON DELETE SET NULL,
  "maintenanceAssetId" UUID NOT NULL REFERENCES "maintenance_assets"("id") ON DELETE CASCADE,
  "tiposLabel"         TEXT[] NOT NULL DEFAULT '{}',
  "descripcion"        TEXT,
  "odometro"           DOUBLE PRECISION,
  "performedAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "performedByName"    TEXT NOT NULL,
  "performedByEmail"   TEXT,
  "performedByPhone"   TEXT,
  "fotos"              JSONB,
  "planId"             UUID REFERENCES "maintenance_plans"("id") ON DELETE SET NULL,
  "cumplioPreventivo"  BOOLEAN NOT NULL DEFAULT false,
  "workOrderId"        UUID REFERENCES "work_orders"("id") ON DELETE SET NULL,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "maintenance_interventions_tenantId_idx"
  ON "maintenance_interventions" ("tenantId");
CREATE INDEX IF NOT EXISTS "maintenance_interventions_maintenanceAssetId_idx"
  ON "maintenance_interventions" ("maintenanceAssetId");
CREATE INDEX IF NOT EXISTS "maintenance_interventions_qrId_idx"
  ON "maintenance_interventions" ("qrId");

-- Throttling de recordatorios de mantenimiento preventivo
ALTER TABLE "maintenance_plans"
  ADD COLUMN IF NOT EXISTS "lastReminderSentAt" TIMESTAMPTZ;

-- Escalado de OTs vencidas
ALTER TABLE "work_orders"
  ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMPTZ;

-- Repuestos asignados a OTs (descuento automático de stock al completar)
CREATE TABLE IF NOT EXISTS "work_order_spare_parts" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"      UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "workOrderId"   UUID NOT NULL REFERENCES "work_orders"("id") ON DELETE CASCADE,
  "sparePartId"   UUID NOT NULL REFERENCES "maintenance_spare_parts"("id") ON DELETE CASCADE,
  "quantity"      INTEGER NOT NULL DEFAULT 1,
  "unitCost"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "stockDeducted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "work_order_spare_parts_tenantId_idx"
  ON "work_order_spare_parts" ("tenantId");
CREATE INDEX IF NOT EXISTS "work_order_spare_parts_workOrderId_idx"
  ON "work_order_spare_parts" ("workOrderId");
CREATE INDEX IF NOT EXISTS "work_order_spare_parts_sparePartId_idx"
  ON "work_order_spare_parts" ("sparePartId");
