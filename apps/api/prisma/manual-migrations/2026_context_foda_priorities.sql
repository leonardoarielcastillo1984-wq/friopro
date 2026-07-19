-- Fase 5 — Prioridad estratégica por ítem FODA (aditivo, idempotente).
-- Agrega columna JSON opcional a organization_context sin afectar datos existentes.
ALTER TABLE "organization_context" ADD COLUMN IF NOT EXISTS "fodaPriorities" jsonb;
