-- Flota 360 — estadíos operativos del vehículo (OPERATIVO / EN_TALLER / EN_REPARACION)
-- Aditiva e idempotente.
ALTER TABLE flota_vehiculos
  ADD COLUMN IF NOT EXISTS "estadoOperativo" VARCHAR(30) NOT NULL DEFAULT 'OPERATIVO';

-- Sincronizar con el status existente: los que ya estaban EN_TALLER quedan EN_TALLER
UPDATE flota_vehiculos SET "estadoOperativo" = 'EN_TALLER' WHERE status = 'EN_TALLER';

CREATE TABLE IF NOT EXISTS flota_vehiculo_estado_eventos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"      UUID NOT NULL,
  "vehiculoId"    UUID NOT NULL REFERENCES flota_vehiculos(id) ON DELETE CASCADE,
  estado          VARCHAR(30) NOT NULL,
  origen          VARCHAR(30) NOT NULL DEFAULT 'SISTEMA',
  notas           TEXT,
  "workOrderId"   UUID,
  "createdByName" VARCHAR(200),
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fvee_vehiculo ON flota_vehiculo_estado_eventos("vehiculoId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_fvee_tenant ON flota_vehiculo_estado_eventos("tenantId");
