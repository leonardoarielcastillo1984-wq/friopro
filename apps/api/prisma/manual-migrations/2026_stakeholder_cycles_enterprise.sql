-- =====================================================================
-- Migración Enterprise (aditiva, idempotente, sin borrar datos):
--  - evaluation_cycles.responsible  (responsable del ciclo)
--  - stakeholder_evaluations.criticality (1-5, para análisis IA)
-- =====================================================================
ALTER TABLE evaluation_cycles       ADD COLUMN IF NOT EXISTS "responsible" text;
ALTER TABLE stakeholder_evaluations ADD COLUMN IF NOT EXISTS "criticality" integer;
