-- ═══════════════════════════════════════════════════════════════
-- FLOTA 360 — Control de presión de neumáticos (ronda auditable)
-- Aditivo e idempotente. Crea la tabla de rondas y agrega
-- accion/controlId a las mediciones de presión existentes.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS flota_neumatico_control_presion (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"          UUID NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  "vehiculoId"        UUID NOT NULL REFERENCES flota_vehiculos(id) ON DELETE CASCADE,
  fecha               TIMESTAMPTZ NOT NULL DEFAULT now(),
  observador          TEXT,
  "kmAlControlar"     DOUBLE PRECISION,
  notas               TEXT,
  "cubiertasRevisadas" INT NOT NULL DEFAULT 0,
  "cubiertasInfladas"  INT NOT NULL DEFAULT 0,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flota_neumatico_control_presion_tenant_idx  ON flota_neumatico_control_presion ("tenantId");
CREATE INDEX IF NOT EXISTS flota_neumatico_control_presion_veh_idx     ON flota_neumatico_control_presion ("vehiculoId");

-- Cada medición de presión puede pertenecer a una ronda de control
ALTER TABLE flota_neumatico_presiones ADD COLUMN IF NOT EXISTS accion TEXT NOT NULL DEFAULT 'VERIFICADA';
ALTER TABLE flota_neumatico_presiones ADD COLUMN IF NOT EXISTS "controlId" UUID REFERENCES flota_neumatico_control_presion(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS flota_neumatico_presiones_control_idx ON flota_neumatico_presiones ("controlId");
