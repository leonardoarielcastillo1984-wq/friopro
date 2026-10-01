-- 2026 — Tramos de servicio comercial dentro de la jornada
-- flotaServicioId en flota_servicio_registros: INICIO_SERVICIO y
-- CAMBIO_SERVICIO marcan desde cuándo la unidad cubre cada servicio.
ALTER TABLE flota_servicio_registros
  ADD COLUMN IF NOT EXISTS "flotaServicioId" UUID;
CREATE INDEX IF NOT EXISTS flota_servicio_registros_flota_servicio_idx
  ON flota_servicio_registros ("flotaServicioId");
