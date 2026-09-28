-- Recursos necesarios por actividad de objetivo (ISO 9001 §6.2.2, aditivo)
ALTER TABLE objective_activities ADD COLUMN IF NOT EXISTS "resources" text;
