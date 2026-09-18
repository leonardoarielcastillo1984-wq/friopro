-- Flota 360 — variables configurables del análisis de reemplazo (gemelo digital)
-- Aditiva e idempotente.
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS "flotaReemplazoConfig" JSONB;
