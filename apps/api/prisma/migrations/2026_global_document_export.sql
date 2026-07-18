-- ============================================================
-- SISTEMA GLOBAL DE EXPORTACIÓN DOCUMENTAL - Etapa 1
-- Migración idempotente: 12 tablas nuevas
-- ============================================================

-- 1. document_output_definitions
CREATE TABLE IF NOT EXISTS "document_output_definitions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES "Tenant"("id"),
    "module" TEXT NOT NULL,
    "subModule" TEXT,
    "screenName" TEXT NOT NULL,
    "outputKey" TEXT NOT NULL,
    "outputType" TEXT NOT NULL,
    "description" TEXT,
    "documentId" UUID REFERENCES "Document"("id") ON DELETE SET NULL,
    "documentCode" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "templateId" UUID REFERENCES "document_templates"("id") ON DELETE SET NULL,
    "elaboratedById" UUID,
    "reviewedById" UUID,
    "approvedById" UUID,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "allowPrint" BOOLEAN NOT NULL DEFAULT true,
    "allowExport" BOOLEAN NOT NULL DEFAULT true,
    "includeQR" BOOLEAN NOT NULL DEFAULT true,
    "includeSignatures" BOOLEAN NOT NULL DEFAULT true,
    "includeWatermark" BOOLEAN NOT NULL DEFAULT false,
    "includeHistory" BOOLEAN NOT NULL DEFAULT false,
    "format" TEXT NOT NULL DEFAULT 'A4',
    "orientation" TEXT NOT NULL DEFAULT 'portrait',
    "confidentialLevel" TEXT,
    "observations" TEXT,
    "lastExportAt" TIMESTAMPTZ,
    "exportCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "deletedAt" TIMESTAMPTZ,
    UNIQUE ("tenantId", "outputKey")
);
CREATE INDEX IF NOT EXISTS "idx_dod_tenant" ON "document_output_definitions"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_dod_tenant_module" ON "document_output_definitions"("tenantId", "module");
CREATE INDEX IF NOT EXISTS "idx_dod_tenant_status" ON "document_output_definitions"("tenantId", "status");

-- 2. document_templates
CREATE TABLE IF NOT EXISTS "document_templates" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES "Tenant"("id"),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "headerLogoUrl" TEXT,
    "headerLogoSecondaryUrl" TEXT,
    "companyName" TEXT,
    "commercialName" TEXT,
    "companyAddress" TEXT,
    "companyCuit" TEXT,
    "companySite" TEXT,
    "footerText" TEXT,
    "footerLegalText" TEXT,
    "footerShowPageNum" BOOLEAN NOT NULL DEFAULT true,
    "footerShowDate" BOOLEAN NOT NULL DEFAULT true,
    "footerShowUser" BOOLEAN NOT NULL DEFAULT true,
    "footerShowQR" BOOLEAN NOT NULL DEFAULT true,
    "footerShowStatus" BOOLEAN NOT NULL DEFAULT true,
    "pageSize" TEXT NOT NULL DEFAULT 'A4',
    "orientation" TEXT NOT NULL DEFAULT 'portrait',
    "marginTop" INTEGER NOT NULL DEFAULT 25,
    "marginBottom" INTEGER NOT NULL DEFAULT 25,
    "marginLeft" INTEGER NOT NULL DEFAULT 20,
    "marginRight" INTEGER NOT NULL DEFAULT 20,
    "primaryColor" TEXT NOT NULL DEFAULT '#1e40af',
    "secondaryColor" TEXT NOT NULL DEFAULT '#64748b',
    "fontFamily" TEXT NOT NULL DEFAULT 'Arial, sans-serif',
    "fontSize" INTEGER NOT NULL DEFAULT 11,
    "showCoverPage" BOOLEAN NOT NULL DEFAULT false,
    "showTableOfContents" BOOLEAN NOT NULL DEFAULT false,
    "watermarkText" TEXT,
    "watermarkOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "showSignatures" BOOLEAN NOT NULL DEFAULT true,
    "signatureStyle" TEXT NOT NULL DEFAULT 'table',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "deletedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_dt_tenant" ON "document_templates"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_dt_tenant_active" ON "document_templates"("tenantId", "active");

-- Fix: document_output_definitions templateId FK needs document_templates to exist first
-- (already created above, so the FK in table 1 will work)

-- 3. document_template_versions
CREATE TABLE IF NOT EXISTS "document_template_versions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "templateId" UUID NOT NULL REFERENCES "document_templates"("id") ON DELETE CASCADE,
    "version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "changeReason" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_dtv_template" ON "document_template_versions"("templateId");

-- 4. document_revisions
CREATE TABLE IF NOT EXISTS "document_revisions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES "Tenant"("id"),
    "outputDefinitionId" UUID NOT NULL REFERENCES "document_output_definitions"("id") ON DELETE CASCADE,
    "revision" INTEGER NOT NULL,
    "changeReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "documentCode" TEXT,
    "title" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "approvedAt" TIMESTAMPTZ,
    "approvedById" UUID,
    "obsoleteAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_dr_tenant" ON "document_revisions"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_dr_output" ON "document_revisions"("outputDefinitionId");
CREATE INDEX IF NOT EXISTS "idx_dr_tenant_status" ON "document_revisions"("tenantId", "status");

-- 5. document_approvals
CREATE TABLE IF NOT EXISTS "document_approvals" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES "Tenant"("id"),
    "outputDefinitionId" UUID REFERENCES "document_output_definitions"("id") ON DELETE CASCADE,
    "revisionId" UUID REFERENCES "document_revisions"("id") ON DELETE CASCADE,
    "action" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "userId" UUID,
    "userName" TEXT,
    "userRole" TEXT,
    "digitalSignature" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_da_tenant" ON "document_approvals"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_da_output" ON "document_approvals"("outputDefinitionId");
CREATE INDEX IF NOT EXISTS "idx_da_revision" ON "document_approvals"("revisionId");

-- 6. document_exports
CREATE TABLE IF NOT EXISTS "document_exports" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES "Tenant"("id"),
    "outputDefinitionId" UUID REFERENCES "document_output_definitions"("id") ON DELETE SET NULL,
    "revisionId" UUID REFERENCES "document_revisions"("id") ON DELETE SET NULL,
    "documentCode" TEXT,
    "revisionNumber" INTEGER NOT NULL DEFAULT 0,
    "documentTitle" TEXT,
    "exportType" TEXT NOT NULL,
    "templateName" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "fileHash" TEXT,
    "filters" JSONB,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "userId" UUID,
    "userName" TEXT,
    "userIp" TEXT,
    "userAgent" TEXT,
    "validationTokenId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_de_tenant" ON "document_exports"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_de_output" ON "document_exports"("outputDefinitionId");
CREATE INDEX IF NOT EXISTS "idx_de_tenant_created" ON "document_exports"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_de_user" ON "document_exports"("userId");

-- 7. document_validation_tokens
CREATE TABLE IF NOT EXISTS "document_validation_tokens" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES "Tenant"("id"),
    "token" TEXT NOT NULL UNIQUE,
    "outputDefinitionId" UUID,
    "documentCode" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "exportId" UUID UNIQUE,
    "documentStatus" TEXT,
    "documentTitle" TEXT,
    "expiresAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_dvt_tenant" ON "document_validation_tokens"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_dvt_token" ON "document_validation_tokens"("token");

-- Fix FK: document_exports.validationTokenId -> document_validation_tokens.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_de_validation_token'
        AND table_name = 'document_exports'
    ) THEN
        ALTER TABLE "document_exports"
        ADD CONSTRAINT "fk_de_validation_token"
        FOREIGN KEY ("validationTokenId") REFERENCES "document_validation_tokens"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- Fix FK: document_validation_tokens.exportId -> document_exports.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_dvt_export'
        AND table_name = 'document_validation_tokens'
    ) THEN
        ALTER TABLE "document_validation_tokens"
        ADD CONSTRAINT "fk_dvt_export"
        FOREIGN KEY ("exportId") REFERENCES "document_exports"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- 8. document_signatures
CREATE TABLE IF NOT EXISTS "document_signatures" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES "Tenant"("id"),
    "revisionId" UUID REFERENCES "document_revisions"("id") ON DELETE SET NULL,
    "role" TEXT NOT NULL,
    "userId" UUID,
    "userName" TEXT,
    "userPosition" TEXT,
    "signedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "signatureHash" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_ds_tenant" ON "document_signatures"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_ds_revision" ON "document_signatures"("revisionId");

-- 9. document_retention_rules
CREATE TABLE IF NOT EXISTS "document_retention_rules" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES "Tenant"("id"),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "documentType" TEXT,
    "module" TEXT,
    "retentionYears" INTEGER NOT NULL DEFAULT 5,
    "medium" TEXT NOT NULL DEFAULT 'DIGITAL',
    "observations" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_drr_tenant" ON "document_retention_rules"("tenantId");

-- 10. document_code_rules
CREATE TABLE IF NOT EXISTS "document_code_rules" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES "Tenant"("id"),
    "module" TEXT NOT NULL,
    "subModule" TEXT,
    "processCode" TEXT,
    "typeAbbr" TEXT,
    "prefix" TEXT,
    "digitCount" INTEGER,
    "separator" TEXT,
    "nextSequence" INTEGER NOT NULL DEFAULT 1,
    "includeRevision" BOOLEAN NOT NULL DEFAULT true,
    "revisionFormat" TEXT NOT NULL DEFAULT 'R{NN}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE ("tenantId", "module", "subModule", "typeAbbr")
);
CREATE INDEX IF NOT EXISTS "idx_dcr_tenant" ON "document_code_rules"("tenantId");

-- 11. document_output_categories
CREATE TABLE IF NOT EXISTS "document_output_categories" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES "Tenant"("id"),
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "parentCategoryId" UUID REFERENCES "document_output_categories"("id") ON DELETE SET NULL,
    "color" TEXT DEFAULT '#3B82F6',
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE ("tenantId", "code")
);
CREATE INDEX IF NOT EXISTS "idx_doc_tenant" ON "document_output_categories"("tenantId");

-- 12. document_bulk_exports
CREATE TABLE IF NOT EXISTS "document_bulk_exports" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES "Tenant"("id"),
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "modules" TEXT[] NOT NULL DEFAULT '{}',
    "statuses" TEXT[] NOT NULL DEFAULT '{}',
    "dateFrom" TIMESTAMPTZ,
    "dateTo" TIMESTAMPTZ,
    "includeAnnexes" BOOLEAN NOT NULL DEFAULT false,
    "includeEvidence" BOOLEAN NOT NULL DEFAULT false,
    "includeObsolete" BOOLEAN NOT NULL DEFAULT false,
    "includeIndex" BOOLEAN NOT NULL DEFAULT true,
    "includeSeparators" BOOLEAN NOT NULL DEFAULT false,
    "outputMode" TEXT NOT NULL DEFAULT 'SINGLE_PDF',
    "fileName" TEXT,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "fileHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "userId" UUID,
    "userName" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "completedAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_dbe_tenant" ON "document_bulk_exports"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_dbe_tenant_type" ON "document_bulk_exports"("tenantId", "type");

-- ============================================================
-- ETAPAS 7-22: Columnas y tablas adicionales
-- ============================================================

-- 13. document_export_notifications (Etapa 7)
CREATE TABLE IF NOT EXISTS "document_export_notifications" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL REFERENCES "Tenant"("id"),
    "userId" UUID,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "data" JSONB,
    "readAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_den_tenant" ON "document_export_notifications"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_den_tenant_read" ON "document_export_notifications"("tenantId", "readAt");
CREATE INDEX IF NOT EXISTS "idx_den_user" ON "document_export_notifications"("userId");

-- Etapa 10: status column on document_validation_tokens
ALTER TABLE "document_validation_tokens" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- Etapa 9: tenantId column on document_template_versions
ALTER TABLE "document_template_versions" ADD COLUMN IF NOT EXISTS "tenantId" UUID REFERENCES "Tenant"("id");
CREATE INDEX IF NOT EXISTS "idx_dtv_tenant" ON "document_template_versions"("tenantId");
