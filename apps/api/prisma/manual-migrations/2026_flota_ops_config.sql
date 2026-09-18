-- Flota 360 — configuración operativa (alerta de estadía prolongada, etc.)
-- Aditiva e idempotente.
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS "flotaOpsConfig" JSONB;
