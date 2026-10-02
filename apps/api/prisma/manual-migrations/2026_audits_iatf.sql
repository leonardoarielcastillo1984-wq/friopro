-- Migración manual: cumplimiento IATF 16949 §9.2.2/§7.2.3 en módulo Auditorías (Oct 2026)
-- Idempotente — aplicar en cada BD antes del deploy (sgi-postgres / sgi-postgres-testing).
--
-- audits:
--   · shifts[] (cobertura de turnos 9.2.2.2)
--   · processId (FK débil al Mapa de Procesos → matriz de cobertura)
--   · triggerSource/triggerDescription (priorización por riesgo 9.2.2.1)
--   · reportDueDate (plazo de emisión del informe)
--   · productName/productionPhase/sampleSize (auditoría de producto 9.2.2.3)
-- audit_programs:
--   · priorityBasis (base de priorización del programa)
-- auditors:
--   · coreTools[], processApproach, competenceEvaluatedAt, competenceNotes (§7.2.3)
-- enum AuditType:
--   + SYSTEM, MANUFACTURING_PROCESS, PRODUCT

-- ALTER TYPE no puede ejecutarse dentro de una transacción (Postgres)
ALTER TYPE "AuditType" ADD VALUE IF NOT EXISTS 'SYSTEM';
ALTER TYPE "AuditType" ADD VALUE IF NOT EXISTS 'MANUFACTURING_PROCESS';
ALTER TYPE "AuditType" ADD VALUE IF NOT EXISTS 'PRODUCT';

BEGIN;

ALTER TABLE audits ADD COLUMN IF NOT EXISTS "shifts" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE audits ADD COLUMN IF NOT EXISTS "processId" UUID;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS "triggerSource" TEXT;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS "triggerDescription" TEXT;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS "reportDueDate" TIMESTAMPTZ(3);
ALTER TABLE audits ADD COLUMN IF NOT EXISTS "productName" TEXT;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS "productionPhase" TEXT;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS "sampleSize" TEXT;

ALTER TABLE audit_programs ADD COLUMN IF NOT EXISTS "priorityBasis" TEXT;

ALTER TABLE auditors ADD COLUMN IF NOT EXISTS "coreTools" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE auditors ADD COLUMN IF NOT EXISTS "processApproach" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE auditors ADD COLUMN IF NOT EXISTS "competenceEvaluatedAt" TIMESTAMPTZ(3);
ALTER TABLE auditors ADD COLUMN IF NOT EXISTS "competenceNotes" TEXT;

CREATE INDEX IF NOT EXISTS audits_process_id_idx ON audits("processId");

COMMIT;
