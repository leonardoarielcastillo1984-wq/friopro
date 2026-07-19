-- Gestión, medición y trazabilidad avanzada de Objetivos SGI360 (2026-07-13, aditivo)

-- 1) Nuevos campos en sgi_objectives
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "primaryIndicatorId" uuid;
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "baselineValue" double precision;
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "progressMethod" text DEFAULT 'MANUAL';
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "lastProgressNote" text;
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "responsiblePositionId" uuid;
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "involvedProcessIds" text[] DEFAULT '{}';
ALTER TABLE sgi_objectives ADD COLUMN IF NOT EXISTS "policyIds" text[] DEFAULT '{}';

-- Objetivos existentes: método manual por defecto (retrocompatible)
UPDATE sgi_objectives SET "progressMethod" = 'MANUAL' WHERE "progressMethod" IS NULL;

-- FKs (SetNull para no romper objetivos si se borra el KPI/puesto)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sgi_objectives_primaryIndicatorId_fkey') THEN
    ALTER TABLE sgi_objectives ADD CONSTRAINT "sgi_objectives_primaryIndicatorId_fkey"
      FOREIGN KEY ("primaryIndicatorId") REFERENCES "Indicator"("id") ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sgi_objectives_responsiblePositionId_fkey') THEN
    ALTER TABLE sgi_objectives ADD CONSTRAINT "sgi_objectives_responsiblePositionId_fkey"
      FOREIGN KEY ("responsiblePositionId") REFERENCES "Position"("id") ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS sgi_objectives_primaryIndicatorId_idx ON sgi_objectives ("primaryIndicatorId");
CREATE INDEX IF NOT EXISTS sgi_objectives_responsiblePositionId_idx ON sgi_objectives ("responsiblePositionId");

-- 2) Historial de seguimiento (inmutable)
CREATE TABLE IF NOT EXISTS objective_progress_logs (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"         uuid NOT NULL,
  "objectiveId"      uuid NOT NULL,
  "userId"           uuid,
  "userName"         text,
  "previousProgress" integer,
  "newProgress"      integer,
  "previousStatus"   text,
  "newStatus"        text,
  "kpiValue"         double precision,
  "justification"    text,
  "source"           text NOT NULL DEFAULT 'MANUAL',
  "evidenceUrl"      text,
  "evidenceName"     text,
  "createdAt"        timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'objective_progress_logs_objectiveId_fkey') THEN
    ALTER TABLE objective_progress_logs ADD CONSTRAINT "objective_progress_logs_objectiveId_fkey"
      FOREIGN KEY ("objectiveId") REFERENCES sgi_objectives("id") ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS objective_progress_logs_tenantId_idx ON objective_progress_logs ("tenantId");
CREATE INDEX IF NOT EXISTS objective_progress_logs_objectiveId_idx ON objective_progress_logs ("objectiveId");
