-- Migración manual: gaps ISO 45001 / ISO 14001 / IATF 16949 (segunda ronda)
-- Aplicar con: docker exec -i <postgres-container> psql -U sgi -d sgi < 2026_iso_gaps.sql

BEGIN;

-- IATF 8.4.2.4.1 — auditoría de segunda parte vinculada a proveedor
ALTER TABLE audits ADD COLUMN IF NOT EXISTS "supplierId" UUID;
CREATE INDEX IF NOT EXISTS audits_supplierId_idx ON audits ("supplierId");

-- IATF 8.5.6.1.1 — controles de proceso temporales/alternativos
ALTER TABLE gestion_cambio ADD COLUMN IF NOT EXISTS "usesTemporaryControls" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE gestion_cambio ADD COLUMN IF NOT EXISTS "temporaryControlsDesc" TEXT;
ALTER TABLE gestion_cambio ADD COLUMN IF NOT EXISTS "temporaryControlsEndDate" TIMESTAMPTZ;

-- IATF 7.1.5.3 — requisitos de laboratorio en equipos de medición
ALTER TABLE measuring_equipment ADD COLUMN IF NOT EXISTS "isExternalLab" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE measuring_equipment ADD COLUMN IF NOT EXISTS "labAccreditation" TEXT;
ALTER TABLE measuring_equipment ADD COLUMN IF NOT EXISTS "labScope" TEXT;

-- ISO 14001 6.1.2 — perspectiva de ciclo de vida
ALTER TABLE environmental_aspects ADD COLUMN IF NOT EXISTS "lifeCycleStage" TEXT;

-- IATF 10.3.1 — lecciones aprendidas en NC
ALTER TABLE "NonConformity" ADD COLUMN IF NOT EXISTS "lessonsLearned" TEXT;

-- ISO 45001 8.1.4 / 14001 8.1 — requisitos EHS a contratistas/proveedores
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "ehsRequirements" TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "ehsApproved" BOOLEAN NOT NULL DEFAULT false;

-- ISO 9001/14001/45001 6.1.3 + 9.1.2 — registro de requisitos legales y evaluación de cumplimiento
CREATE TABLE IF NOT EXISTS legal_requirements (
  id UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  framework TEXT NOT NULL,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  "appliesTo" TEXT,
  "lastEvaluationDate" TIMESTAMPTZ,
  "lastEvaluationResult" TEXT,
  "nextEvaluationDate" TIMESTAMPTZ,
  "evaluationFrequency" TEXT NOT NULL DEFAULT 'YEARLY',
  "responsibleId" UUID,
  evidence TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS legal_requirements_tenantId_idx ON legal_requirements ("tenantId");
CREATE INDEX IF NOT EXISTS legal_requirements_framework_idx ON legal_requirements (framework);
CREATE INDEX IF NOT EXISTS legal_requirements_nextEvaluationDate_idx ON legal_requirements ("nextEvaluationDate");

CREATE TABLE IF NOT EXISTS legal_compliance_evaluations (
  id UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "requirementId" UUID NOT NULL REFERENCES legal_requirements(id) ON DELETE CASCADE,
  "evaluationDate" TIMESTAMPTZ NOT NULL DEFAULT now(),
  result TEXT NOT NULL,
  findings TEXT,
  "correctiveRequired" BOOLEAN NOT NULL DEFAULT false,
  "evaluatedBy" TEXT,
  evidence TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS legal_compliance_evaluations_tenantId_idx ON legal_compliance_evaluations ("tenantId");
CREATE INDEX IF NOT EXISTS legal_compliance_evaluations_requirementId_idx ON legal_compliance_evaluations ("requirementId");
CREATE INDEX IF NOT EXISTS legal_compliance_evaluations_evaluationDate_idx ON legal_compliance_evaluations ("evaluationDate");

-- ISO 45001 8.1.2 — entregas de EPP
CREATE TABLE IF NOT EXISTS ppe_deliveries (
  id UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "employeeId" UUID,
  "employeeName" TEXT,
  item TEXT NOT NULL,
  size TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  "deliveredAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expiryDate" TIMESTAMPTZ,
  "receivedBy" TEXT,
  "deliveredBy" TEXT,
  notes TEXT,
  "deletedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ppe_deliveries_tenantId_idx ON ppe_deliveries ("tenantId");
CREATE INDEX IF NOT EXISTS ppe_deliveries_employeeId_idx ON ppe_deliveries ("employeeId");
CREATE INDEX IF NOT EXISTS ppe_deliveries_expiryDate_idx ON ppe_deliveries ("expiryDate");

-- ISO 45001 8.1 — permisos de trabajo de alto riesgo
CREATE TABLE IF NOT EXISTS work_permits (
  id UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'REQUESTED',
  "requestedBy" TEXT,
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMPTZ,
  "startDate" TIMESTAMPTZ NOT NULL,
  "endDate" TIMESTAMPTZ NOT NULL,
  workers TEXT[] NOT NULL DEFAULT '{}',
  hazards TEXT,
  controls TEXT,
  "ppeRequired" TEXT[] NOT NULL DEFAULT '{}',
  "contractorId" UUID,
  "closedAt" TIMESTAMPTZ,
  "closureNotes" TEXT,
  "deletedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT work_permits_tenant_code_key UNIQUE ("tenantId", code)
);
CREATE INDEX IF NOT EXISTS work_permits_tenantId_idx ON work_permits ("tenantId");
CREATE INDEX IF NOT EXISTS work_permits_status_idx ON work_permits (status);
CREATE INDEX IF NOT EXISTS work_permits_startDate_idx ON work_permits ("startDate");

-- ISO 45001 9.1.1 — exámenes médicos ocupacionales
CREATE TABLE IF NOT EXISTS medical_exams (
  id UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "employeeId" UUID,
  "employeeName" TEXT,
  "examType" TEXT NOT NULL,
  "examDate" TIMESTAMPTZ NOT NULL,
  result TEXT NOT NULL,
  restrictions TEXT,
  "nextExamDate" TIMESTAMPTZ,
  "performedBy" TEXT,
  notes TEXT,
  "deletedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS medical_exams_tenantId_idx ON medical_exams ("tenantId");
CREATE INDEX IF NOT EXISTS medical_exams_employeeId_idx ON medical_exams ("employeeId");
CREATE INDEX IF NOT EXISTS medical_exams_nextExamDate_idx ON medical_exams ("nextExamDate");

COMMIT;
