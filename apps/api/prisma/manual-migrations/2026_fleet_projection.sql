-- ═══════════════════════════════════════════════════════════════
-- FLOTA 360 — Proyección por vehículo/componente (gemelo digital)
-- Catálogo técnico de referencias + mediciones de condición +
-- origen de instalación + perfil/ritmo de uso del vehículo.
-- 100% aditiva e idempotente.
--
-- Aplicar en TESTING:
--   docker exec -i sgi-postgres-testing psql -U sgi -d sgi < 2026_fleet_projection.sql
-- ═══════════════════════════════════════════════════════════════

-- Origen declarado del componente en su ciclo de instalación
ALTER TABLE fleet_component_installations
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'ORIGEN_DESCONOCIDO',
  ADD COLUMN IF NOT EXISTS "origenNotas" TEXT;

-- Perfil de uso declarado + ritmo de uso declarado (km/mes) del vehículo
ALTER TABLE flota_vehiculos
  ADD COLUMN IF NOT EXISTS "perfilUso" TEXT,
  ADD COLUMN IF NOT EXISTS "kmMesEstimado" DOUBLE PRECISION;

-- Catálogo técnico de referencias por componente (tenantId NULL = global)
CREATE TABLE IF NOT EXISTS fleet_component_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "componentKey" TEXT NOT NULL,
  "componentLabel" TEXT NOT NULL,
  sistema TEXT NOT NULL DEFAULT 'GENERAL',
  "tipoMetrica" TEXT NOT NULL,
  "marcaVehiculo" TEXT,
  "modeloVehiculo" TEXT,
  motor TEXT,
  caja TEXT,
  "regimenUso" TEXT,
  tarea TEXT,
  "intervaloKm" DOUBLE PRECISION,
  "intervaloHoras" DOUBLE PRECISION,
  "intervaloMeses" DOUBLE PRECISION,
  "rangoMinKm" DOUBLE PRECISION,
  "rangoMaxKm" DOUBLE PRECISION,
  "rangoMinMeses" DOUBLE PRECISION,
  "rangoMaxMeses" DOUBLE PRECISION,
  unidad TEXT NOT NULL DEFAULT 'km',
  fuente TEXT,
  "documentoSeccion" TEXT,
  "fuenteUrl" TEXT,
  "fechaRevision" TIMESTAMPTZ,
  "aprobadoPor" TEXT,
  estado TEXT NOT NULL DEFAULT 'FALTANTE',
  version INT NOT NULL DEFAULT 1,
  "supersedesId" UUID,
  notas TEXT,
  "matchRegex" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fcr_tenant ON fleet_component_references("tenantId");
CREATE INDEX IF NOT EXISTS idx_fcr_key ON fleet_component_references("componentKey");

-- Mediciones reales de condición por componente
CREATE TABLE IF NOT EXISTS fleet_component_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "vehiculoId" UUID NOT NULL REFERENCES flota_vehiculos(id) ON DELETE CASCADE,
  "componentKey" TEXT NOT NULL,
  "instanceId" UUID,
  tipo TEXT NOT NULL,
  valor DOUBLE PRECISION,
  "valorTexto" TEXT,
  unidad TEXT,
  "kmAlMedir" DOUBLE PRECISION,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  "workOrderId" UUID,
  "registradoPor" TEXT,
  notas TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fcm_tenant ON fleet_component_measurements("tenantId");
CREATE INDEX IF NOT EXISTS idx_fcm_vehiculo ON fleet_component_measurements("vehiculoId");
CREATE INDEX IF NOT EXISTS idx_fcm_key ON fleet_component_measurements("componentKey");
