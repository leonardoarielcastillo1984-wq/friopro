-- FLOTA 360 — Trazabilidad del registro maestro de vehículos y semis
-- 100% aditiva. SIN foreign keys a propósito: el historial de auditoría debe
-- sobrevivir al borrado físico de la unidad y al borrado del usuario actor
-- (no cascade, no bloqueo de esas operaciones).
-- Aplicar en testing y producción:
--   docker exec -i sgi-postgres psql -U sgi -d sgi < apps/api/prisma/manual-migrations/2026_vehiculo_historial_cambios.sql

CREATE TABLE IF NOT EXISTS flota_vehiculo_historial_cambios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"      UUID NOT NULL,
  "vehiculoId"    UUID NOT NULL,
  "tipoActivo"    TEXT NOT NULL,
  dominio         TEXT NOT NULL,
  accion          TEXT NOT NULL,
  origen          TEXT NOT NULL DEFAULT 'WEB',
  cambios         JSONB,
  motivo          TEXT,
  "usuarioId"     UUID,
  "usuarioNombre" TEXT,
  "requestId"     TEXT,
  "userAgent"     TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flota_veh_hist_cambios_vehiculo_idx
  ON flota_vehiculo_historial_cambios ("vehiculoId", "createdAt");
CREATE INDEX IF NOT EXISTS flota_veh_hist_cambios_tenant_idx
  ON flota_vehiculo_historial_cambios ("tenantId", "createdAt");
