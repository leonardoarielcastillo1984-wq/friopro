-- Migración aditiva e idempotente: repuestos consumidos en intervenciones QR

CREATE TABLE IF NOT EXISTS "maintenance_intervention_spare_parts" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"       UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "interventionId" UUID NOT NULL REFERENCES "maintenance_interventions"("id") ON DELETE CASCADE,
  "sparePartId"    UUID NOT NULL REFERENCES "maintenance_spare_parts"("id") ON DELETE CASCADE,
  "quantity"       INTEGER NOT NULL DEFAULT 1,
  "unitCost"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "maintenance_intervention_spare_parts_tenantId_idx"
  ON "maintenance_intervention_spare_parts" ("tenantId");
CREATE INDEX IF NOT EXISTS "maintenance_intervention_spare_parts_interventionId_idx"
  ON "maintenance_intervention_spare_parts" ("interventionId");
CREATE INDEX IF NOT EXISTS "maintenance_intervention_spare_parts_sparePartId_idx"
  ON "maintenance_intervention_spare_parts" ("sparePartId");
