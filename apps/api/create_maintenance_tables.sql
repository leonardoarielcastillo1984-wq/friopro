-- Crear tablas de mantenimiento manualmente

-- Maintenance Assets
CREATE TABLE IF NOT EXISTS "maintenance_assets" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(255) NOT NULL UNIQUE,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50) DEFAULT 'OTHER',
    "status" VARCHAR(50) DEFAULT 'ACTIVE',
    "location" VARCHAR(255),
    "department" VARCHAR(255),
    "manufacturer" VARCHAR(255),
    "model" VARCHAR(255),
    "serialNumber" VARCHAR(255),
    "purchaseDate" TIMESTAMP WITH TIME ZONE,
    "warrantyDate" TIMESTAMP WITH TIME ZONE,
    "acquisitionCost" DOUBLE PRECISION DEFAULT 0,
    "totalMaintenanceCost" DOUBLE PRECISION DEFAULT 0,
    "lastMaintenanceDate" TIMESTAMP WITH TIME ZONE,
    "nextMaintenanceDate" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_maintenance_assets_tenantId" ON "maintenance_assets"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_maintenance_assets_code" ON "maintenance_assets"("code");

-- Maintenance Technicians
CREATE TABLE IF NOT EXISTS "maintenance_technicians" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(255) NOT NULL UNIQUE,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(255),
    "specialization" VARCHAR(255),
    "certification" VARCHAR(255),
    "isActive" BOOLEAN DEFAULT true,
    "availabilityStatus" VARCHAR(50) DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_maintenance_technicians_tenantId" ON "maintenance_technicians"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_maintenance_technicians_code" ON "maintenance_technicians"("code");

-- Maintenance Plans
CREATE TABLE IF NOT EXISTS "maintenance_plans" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(255) NOT NULL UNIQUE,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(50) DEFAULT 'PREVENTIVE',
    "status" VARCHAR(50) DEFAULT 'ACTIVE',
    "assetId" UUID,
    "frequencyValue" INTEGER DEFAULT 30,
    "frequencyUnit" VARCHAR(50) DEFAULT 'DAYS',
    "nextExecutionDate" TIMESTAMP WITH TIME ZONE,
    "lastExecutionDate" TIMESTAMP WITH TIME ZONE,
    "totalExecutions" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_maintenance_plans_tenantId" ON "maintenance_plans"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_maintenance_plans_assetId" ON "maintenance_plans"("assetId");

-- Maintenance Spare Parts
CREATE TABLE IF NOT EXISTS "maintenance_spare_parts" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(255) NOT NULL UNIQUE,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(255),
    "currentStock" INTEGER DEFAULT 0,
    "minStock" INTEGER DEFAULT 0,
    "maxStock" INTEGER,
    "unitCost" DOUBLE PRECISION DEFAULT 0,
    "supplier" VARCHAR(255),
    "supplierCode" VARCHAR(255),
    "location" VARCHAR(255),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_maintenance_spare_parts_tenantId" ON "maintenance_spare_parts"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_maintenance_spare_parts_code" ON "maintenance_spare_parts"("code");

-- Work Orders
CREATE TABLE IF NOT EXISTS "work_orders" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(255) NOT NULL UNIQUE,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(50) DEFAULT 'CORRECTIVE',
    "priority" VARCHAR(50) DEFAULT 'MEDIUM',
    "status" VARCHAR(50) DEFAULT 'PENDING',
    "assetId" UUID NOT NULL,
    "technicianId" UUID,
    "scheduledDate" TIMESTAMP WITH TIME ZONE,
    "startedAt" TIMESTAMP WITH TIME ZONE,
    "completedAt" TIMESTAMP WITH TIME ZONE,
    "estimatedDuration" INTEGER,
    "actualDuration" INTEGER,
    "laborCost" DOUBLE PRECISION DEFAULT 0,
    "partsCost" DOUBLE PRECISION DEFAULT 0,
    "totalCost" DOUBLE PRECISION DEFAULT 0,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_work_orders_tenantId" ON "work_orders"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_work_orders_assetId" ON "work_orders"("assetId");
CREATE INDEX IF NOT EXISTS "idx_work_orders_technicianId" ON "work_orders"("technicianId");
CREATE INDEX IF NOT EXISTS "idx_work_orders_status" ON "work_orders"("status");

-- Maintenance Costs
CREATE TABLE IF NOT EXISTS "maintenance_costs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "costType" VARCHAR(50) DEFAULT 'PREVENTIVE',
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "assetId" UUID NOT NULL,
    "workOrderId" UUID,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_maintenance_costs_tenantId" ON "maintenance_costs"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_maintenance_costs_assetId" ON "maintenance_costs"("assetId");
CREATE INDEX IF NOT EXISTS "idx_maintenance_costs_workOrderId" ON "maintenance_costs"("workOrderId");

