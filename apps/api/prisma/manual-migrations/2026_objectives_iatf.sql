-- Migración manual: cumplimiento IATF 16949 §6.2.1/6.2.1.1 en Objetivos SGI (Oct 2026)
-- Idempotente — aplicar en cada BD antes del deploy (sgi-postgres / sgi-postgres-testing).
--
-- Agrega a sgi_objectives:
--   · Despliegue en cascada (parentObjectiveId auto-FK + level)
--   · Aprobación por alta dirección (approvedById/Name/At)
--   · Cierre verificable (finalValue, evaluationComment, closedAt)
--   · Revisión periódica (reviewFrequency, nextReviewDate)
--   · Comunicación (communicatedAt, communicatedTo)
--   · Frecuencia de medición propia (measurementFrequency)
--   · Alineación a requisito de cliente (stakeholderId, customerRequirement)

BEGIN;

ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "parentObjectiveId" UUID;
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "level" TEXT;
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "approvedById" UUID;
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "approvedByName" TEXT;
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "finalValue" DOUBLE PRECISION;
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "evaluationComment" TEXT;
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "reviewFrequency" TEXT;
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "nextReviewDate" TIMESTAMP(3);
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "communicatedAt" TIMESTAMP(3);
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "communicatedTo" TEXT;
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "measurementFrequency" TEXT;
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "stakeholderId" UUID;
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "customerRequirement" TEXT;

DO $$ BEGIN
  ALTER TABLE sgi_objectives
    ADD CONSTRAINT sgi_objectives_parent_fk
    FOREIGN KEY ("parentObjectiveId") REFERENCES sgi_objectives(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS sgi_objectives_parent_idx ON sgi_objectives("parentObjectiveId");
CREATE INDEX IF NOT EXISTS sgi_objectives_stakeholder_idx ON sgi_objectives("stakeholderId");

COMMIT;
