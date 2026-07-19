-- Trazabilidad estratégica en sgi_objectives (2026-07-08, aditivo)
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "originType" text;
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "originId" text;
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "strategicPriority" text;
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "strategicWeight" float;
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "contextYear" integer;
