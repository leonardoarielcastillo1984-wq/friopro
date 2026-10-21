-- Insumos y consumibles (Infraestructura): catálogo por rubro,
-- necesidades mensuales por sector y movimientos de stock.
-- 100% aditiva — no toca tablas existentes. Idempotente.

CREATE TABLE IF NOT EXISTS supply_items (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "rubro" TEXT NOT NULL DEFAULT 'OTRO',
  "unit" TEXT NOT NULL DEFAULT 'unidad',
  "description" TEXT,
  "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "leadTimeDays" INTEGER NOT NULL DEFAULT 3,
  "minStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "safetyFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.2,
  "supplier" TEXT,
  "supplierCode" TEXT,
  "location" TEXT,
  "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deletedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS supply_items_tenant_idx ON supply_items("tenantId");
CREATE INDEX IF NOT EXISTS supply_items_code_idx ON supply_items("code");
CREATE INDEX IF NOT EXISTS supply_items_rubro_idx ON supply_items("rubro");

CREATE TABLE IF NOT EXISTS supply_needs (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "itemId" UUID NOT NULL REFERENCES supply_items(id) ON DELETE CASCADE,
  "sector" TEXT NOT NULL,
  "departmentId" UUID,
  "period" TEXT NOT NULL,
  "monthlyQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "responsibleId" UUID,
  "responsibleName" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT supply_needs_tenant_item_sector_period_key UNIQUE ("tenantId","itemId","sector","period")
);
CREATE INDEX IF NOT EXISTS supply_needs_tenant_period_idx ON supply_needs("tenantId","period");

CREATE TABLE IF NOT EXISTS supply_movements (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "itemId" UUID NOT NULL REFERENCES supply_items(id) ON DELETE CASCADE,
  "delta" DOUBLE PRECISION NOT NULL,
  "motivo" TEXT NOT NULL,
  "sector" TEXT,
  "userId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS supply_movements_tenant_idx ON supply_movements("tenantId");
CREATE INDEX IF NOT EXISTS supply_movements_item_idx ON supply_movements("itemId");
CREATE INDEX IF NOT EXISTS supply_movements_created_idx ON supply_movements("createdAt");
