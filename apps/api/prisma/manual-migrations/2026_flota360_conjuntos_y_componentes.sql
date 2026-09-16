-- Migración 100% aditiva e idempotente para Flota 360.
-- NO borra, renombra ni altera ninguna tabla/columna/dato existente.
-- Crea únicamente tablas nuevas para:
--   1) Conjuntos Operativos (acople temporal tractor + semi)
--   2) Catálogo de componentes y reglas de servicio ("Planes y frecuencias")
-- Semi se modela reutilizando la tabla flota_vehiculos existente con tipo='SEMI' (ya soportado hoy).

CREATE TABLE IF NOT EXISTS "flota_conjuntos_operativos" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "tractorId" UUID NOT NULL REFERENCES "flota_vehiculos"("id") ON DELETE CASCADE,
  "semiId" UUID NOT NULL REFERENCES "flota_vehiculos"("id") ON DELETE CASCADE,
  "estado" TEXT NOT NULL DEFAULT 'ACOPLADO',
  "fechaAcople" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "fechaDesacople" TIMESTAMPTZ,
  "ubicacion" TEXT,
  "viajeId" TEXT,
  "notas" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "flota_conjuntos_operativos_tenantId_idx" ON "flota_conjuntos_operativos" ("tenantId");
CREATE INDEX IF NOT EXISTS "flota_conjuntos_operativos_tractorId_idx" ON "flota_conjuntos_operativos" ("tractorId");
CREATE INDEX IF NOT EXISTS "flota_conjuntos_operativos_semiId_idx" ON "flota_conjuntos_operativos" ("semiId");
CREATE INDEX IF NOT EXISTS "flota_conjuntos_operativos_estado_idx" ON "flota_conjuntos_operativos" ("estado");

CREATE TABLE IF NOT EXISTS "flota_conjunto_eventos" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "conjuntoId" UUID NOT NULL REFERENCES "flota_conjuntos_operativos"("id") ON DELETE CASCADE,
  "tipo" TEXT NOT NULL DEFAULT 'ACOPLE',
  "fecha" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "ubicacion" TEXT,
  "viajeId" TEXT,
  "notas" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "flota_conjunto_eventos_tenantId_idx" ON "flota_conjunto_eventos" ("tenantId");
CREATE INDEX IF NOT EXISTS "flota_conjunto_eventos_conjuntoId_idx" ON "flota_conjunto_eventos" ("conjuntoId");

CREATE TABLE IF NOT EXISTS "maintenance_component_rules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "nombre" TEXT NOT NULL,
  "categoria" TEXT NOT NULL DEFAULT 'GENERAL',
  "tipoActivoAplicable" TEXT NOT NULL DEFAULT 'TODOS',
  "frecuenciaKm" DOUBLE PRECISION,
  "frecuenciaDias" INTEGER,
  "horasMotor" DOUBLE PRECISION,
  "ciclos" INTEGER,
  "condicionObservada" BOOLEAN NOT NULL DEFAULT false,
  "kmAnticipacion" DOUBLE PRECISION,
  "diasAnticipacion" INTEGER,
  "criticidad" TEXT NOT NULL DEFAULT 'MEDIA',
  "duracionEstimada" DOUBLE PRECISION,
  "accionVencimiento" TEXT NOT NULL DEFAULT 'ALERTA',
  "checklistPlantillaId" UUID,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "maintenance_component_rules_tenantId_idx" ON "maintenance_component_rules" ("tenantId");

CREATE TABLE IF NOT EXISTS "maintenance_component_rule_spare_parts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ruleId" UUID NOT NULL REFERENCES "maintenance_component_rules"("id") ON DELETE CASCADE,
  "sparePartId" UUID NOT NULL,
  "cantidad" INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS "maintenance_component_rule_spare_parts_ruleId_idx" ON "maintenance_component_rule_spare_parts" ("ruleId");

CREATE TABLE IF NOT EXISTS "maintenance_component_rule_assets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ruleId" UUID NOT NULL REFERENCES "maintenance_component_rules"("id") ON DELETE CASCADE,
  "assetId" UUID NOT NULL,
  "generatedPlanId" UUID,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "maintenance_component_rule_assets_rule_asset_unique" UNIQUE ("ruleId", "assetId")
);

CREATE INDEX IF NOT EXISTS "maintenance_component_rule_assets_ruleId_idx" ON "maintenance_component_rule_assets" ("ruleId");
CREATE INDEX IF NOT EXISTS "maintenance_component_rule_assets_assetId_idx" ON "maintenance_component_rule_assets" ("assetId");
