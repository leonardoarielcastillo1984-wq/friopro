-- Migración manual: tablas Auditor IA + columnas AiFinding (sg= auditor-ia)
-- Aplicar con: docker exec -i sgi-postgres psql -U sgi -d sgi < 2026_auditor_ia.sql

-- AlterTable
ALTER TABLE "AiFinding" ADD COLUMN     "actionPlanId" UUID,
ADD COLUMN     "evaluationId" UUID,
ADD COLUMN     "linkedAt" TIMESTAMPTZ,
ADD COLUMN     "linkedById" UUID,
ADD COLUMN     "requirementId" UUID,
ADD COLUMN     "validatedAt" TIMESTAMPTZ,
ADD COLUMN     "validatedById" UUID,
ADD COLUMN     "validationNote" TEXT,
ADD COLUMN     "validationStatus" TEXT;

-- CreateTable
CREATE TABLE "auditor_extractions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "normativeId" UUID NOT NULL,
    "fileHash" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'EXTRACTING',
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "diagnostics" JSONB,
    "model" TEXT,
    "error" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMPTZ,
    "rejectedById" UUID,
    "rejectedAt" TIMESTAMPTZ,
    "rejectNote" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "auditor_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditor_source_pages" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "extractionId" UUID NOT NULL,
    "page" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,

    CONSTRAINT "auditor_source_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditor_requirements" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "extractionId" UUID NOT NULL,
    "clauseId" UUID,
    "code" TEXT NOT NULL,
    "clauseNumber" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "verificationTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "connectorKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "page" INTEGER,
    "requiresDocumentedInfo" BOOLEAN NOT NULL DEFAULT false,
    "origin" TEXT NOT NULL DEFAULT 'AI',
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "auditor_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditor_reviews" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "extractionId" UUID NOT NULL,
    "normativeId" UUID NOT NULL,
    "scope" TEXT,
    "processIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "periodFrom" TIMESTAMPTZ,
    "periodTo" TIMESTAMPTZ,
    "requirementIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "totalRequirements" INTEGER NOT NULL DEFAULT 0,
    "totals" JSONB,
    "jobId" TEXT,
    "dedupeKey" TEXT,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "estTokens" INTEGER NOT NULL DEFAULT 0,
    "usedTokens" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "config" JSONB,
    "createdById" UUID,
    "startedAt" TIMESTAMPTZ,
    "finishedAt" TIMESTAMPTZ,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "auditor_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditor_evaluations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "requirementId" UUID NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "workStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "evidenceStatus" TEXT NOT NULL DEFAULT 'NOT_SEARCHED',
    "aiVerdict" TEXT NOT NULL DEFAULT 'NONE',
    "humanDecision" TEXT NOT NULL DEFAULT 'PENDING',
    "explanation" TEXT,
    "limitations" JSONB,
    "externalChecks" JSONB,
    "gaps" JSONB,
    "proposals" JSONB,
    "auditQuestions" JSONB,
    "sourcesConsulted" JSONB,
    "sourcesUnavailable" JSONB,
    "sourceSnapshot" JSONB,
    "model" TEXT,
    "promptVersion" TEXT,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "noProvider" BOOLEAN NOT NULL DEFAULT false,
    "decidedById" UUID,
    "decidedAt" TIMESTAMPTZ,
    "decisionComment" TEXT,
    "naJustification" TEXT,
    "naProposedById" UUID,
    "naApprovedById" UUID,
    "naApprovedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "auditor_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditor_evidence_links" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "evaluationId" UUID NOT NULL,
    "connectorKey" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "version" TEXT,
    "entityUpdatedAt" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "url" TEXT,
    "summary" TEXT,
    "entityHash" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'AUTO',
    "aiAssessment" TEXT,
    "inPeriod" BOOLEAN NOT NULL DEFAULT true,
    "addedById" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditor_evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditor_doc_extracts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "documentVersion" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "pages" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "auditor_doc_extracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditor_decision_logs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "evaluationId" UUID NOT NULL,
    "axis" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT NOT NULL,
    "actorId" UUID,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditor_decision_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "auditor_extractions_tenantId_idx" ON "auditor_extractions"("tenantId");
CREATE INDEX "auditor_extractions_tenantId_status_idx" ON "auditor_extractions"("tenantId", "status");
CREATE UNIQUE INDEX "auditor_extractions_normativeId_fileHash_revision_key" ON "auditor_extractions"("normativeId", "fileHash", "revision");
CREATE INDEX "auditor_source_pages_tenantId_idx" ON "auditor_source_pages"("tenantId");
CREATE UNIQUE INDEX "auditor_source_pages_extractionId_page_key" ON "auditor_source_pages"("extractionId", "page");
CREATE INDEX "auditor_requirements_tenantId_idx" ON "auditor_requirements"("tenantId");
CREATE INDEX "auditor_requirements_extractionId_idx" ON "auditor_requirements"("extractionId");
CREATE UNIQUE INDEX "auditor_requirements_extractionId_code_key" ON "auditor_requirements"("extractionId", "code");
CREATE INDEX "auditor_reviews_tenantId_status_idx" ON "auditor_reviews"("tenantId", "status");
CREATE INDEX "auditor_reviews_tenantId_dedupeKey_idx" ON "auditor_reviews"("tenantId", "dedupeKey");
CREATE INDEX "auditor_reviews_extractionId_idx" ON "auditor_reviews"("extractionId");
CREATE INDEX "auditor_evaluations_tenantId_idx" ON "auditor_evaluations"("tenantId");
CREATE INDEX "auditor_evaluations_reviewId_idx" ON "auditor_evaluations"("reviewId");
CREATE INDEX "auditor_evaluations_requirementId_idx" ON "auditor_evaluations"("requirementId");
CREATE UNIQUE INDEX "auditor_evaluations_reviewId_requirementId_attempt_key" ON "auditor_evaluations"("reviewId", "requirementId", "attempt");
CREATE INDEX "auditor_evidence_links_tenantId_idx" ON "auditor_evidence_links"("tenantId");
CREATE INDEX "auditor_evidence_links_evaluationId_idx" ON "auditor_evidence_links"("evaluationId");
CREATE INDEX "auditor_evidence_links_tenantId_entityType_entityId_idx" ON "auditor_evidence_links"("tenantId", "entityType", "entityId");
CREATE UNIQUE INDEX "auditor_doc_extracts_documentId_key" ON "auditor_doc_extracts"("documentId");
CREATE INDEX "auditor_doc_extracts_tenantId_idx" ON "auditor_doc_extracts"("tenantId");
CREATE INDEX "auditor_decision_logs_evaluationId_idx" ON "auditor_decision_logs"("evaluationId");
CREATE INDEX "auditor_decision_logs_tenantId_idx" ON "auditor_decision_logs"("tenantId");
CREATE INDEX "AiFinding_evaluationId_idx" ON "AiFinding"("evaluationId");
ALTER TABLE "auditor_extractions" ADD CONSTRAINT "auditor_extractions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auditor_extractions" ADD CONSTRAINT "auditor_extractions_normativeId_fkey" FOREIGN KEY ("normativeId") REFERENCES "NormativeStandard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auditor_source_pages" ADD CONSTRAINT "auditor_source_pages_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "auditor_extractions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auditor_requirements" ADD CONSTRAINT "auditor_requirements_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "auditor_extractions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auditor_requirements" ADD CONSTRAINT "auditor_requirements_clauseId_fkey" FOREIGN KEY ("clauseId") REFERENCES "NormativeClause"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "auditor_reviews" ADD CONSTRAINT "auditor_reviews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auditor_reviews" ADD CONSTRAINT "auditor_reviews_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "auditor_extractions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auditor_evaluations" ADD CONSTRAINT "auditor_evaluations_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "auditor_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auditor_evaluations" ADD CONSTRAINT "auditor_evaluations_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "auditor_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auditor_evidence_links" ADD CONSTRAINT "auditor_evidence_links_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "auditor_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auditor_doc_extracts" ADD CONSTRAINT "auditor_doc_extracts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auditor_decision_logs" ADD CONSTRAINT "auditor_decision_logs_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "auditor_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
